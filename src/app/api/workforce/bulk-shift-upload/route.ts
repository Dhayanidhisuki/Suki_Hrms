/**
 * POST /api/workforce/bulk-shift-upload
 *   — upload a CSV/Excel file with bulk shift assignments.
 *   Expected columns: employeeCode, date (YYYY-MM-DD), shiftCode
 *   Creates ShiftAssignmentOverride records for each row.
 *
 * Body: FormData with "file" field (CSV or XLSX)
 */

import { NextRequest, NextResponse } from 'next/server';
import * as XLSX from 'xlsx';
import { prisma } from '@/lib/prisma';
import { checkSpecificPermission } from '@/lib/rbac-employee';
import { getCompanyId } from '@/lib/companyScope';

interface BulkRow {
  employeeCode: string;
  date: string | number | Date;
  shiftCode: string;
}

export async function POST(request: NextRequest) {
  const userId = Number(request.headers.get('x-user-id'));
  if (!userId) {
    return NextResponse.json({ error: 'Unauthorized — authentication required' }, { status: 401 });
  }
  const permErr = await checkSpecificPermission(request, 'workforce.attendance.edit');
  if (permErr) return permErr;
  const scope = getCompanyId(request);
  if ('error' in scope) return scope.error;

  const formData = await request.formData();
  const file = formData.get('file');
  if (!file || !(file instanceof File)) {
    return NextResponse.json({ error: 'No file uploaded. Send a CSV or XLSX file with columns: employeeCode, date, shiftCode' }, { status: 400 });
  }

  const buffer = await file.arrayBuffer();
  const workbook = XLSX.read(buffer, { type: 'array' });
  const sheetName = workbook.SheetNames[0];
  const sheet = workbook.Sheets[sheetName];
  const rows = XLSX.utils.sheet_to_json<BulkRow>(sheet, { defval: null });

  if (rows.length === 0) {
    return NextResponse.json({ error: 'File is empty or has no data rows' }, { status: 400 });
  }

  // Preload all shifts (ShiftMaster is global, not company-scoped)
  const shifts = await prisma.shiftMaster.findMany({
    where: { isActive: true, deletedAt: null },
    select: { id: true, code: true },
  });
  const shiftMap = new Map(shifts.map((s) => [s.code.toUpperCase(), s.id]));

  // Preload all employees for this company
  const employees = await prisma.employee.findMany({
    where: { companyId: scope.companyId, isActive: true },
    select: { id: true, employeeCode: true },
  });
  const empMap = new Map(employees.map((e) => [e.employeeCode.toUpperCase(), e.id]));

  const results: { row: number; employeeCode: string; date: string; shiftCode: string; status: 'ok' | 'error'; message?: string }[] = [];
  let created = 0;
  let errors = 0;

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    const rowNum = i + 2; // Excel row (1-based + header)

    const employeeCode = String(row.employeeCode ?? '').trim();
    const rawDate = row.date;
    const shiftCode = String(row.shiftCode ?? '').trim();

    if (!employeeCode || rawDate === null || rawDate === undefined || rawDate === '' || !shiftCode) {
      results.push({ row: rowNum, employeeCode, date: String(rawDate ?? ''), shiftCode, status: 'error', message: 'Missing required field' });
      errors++;
      continue;
    }

    const employeeId = empMap.get(employeeCode.toUpperCase());
    if (!employeeId) {
      results.push({ row: rowNum, employeeCode, date: String(rawDate), shiftCode, status: 'error', message: 'Employee not found or inactive' });
      errors++;
      continue;
    }

    const shiftMasterId = shiftMap.get(shiftCode.toUpperCase());
    if (!shiftMasterId) {
      results.push({ row: rowNum, employeeCode, date: String(rawDate), shiftCode, status: 'error', message: 'Shift not found' });
      errors++;
      continue;
    }

    // Parse date — handle YYYY-MM-DD strings, Excel date serials, and Date objects
    let date: Date;
    const dateStr = String(rawDate);
    if (/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
      date = new Date(dateStr);
    } else if (typeof rawDate === 'number') {
      // Excel date serial (days since 1899-12-30)
      date = new Date(Math.round((rawDate - 25569) * 86400 * 1000));
    } else if (rawDate instanceof Date) {
      date = rawDate;
    } else {
      const parsed = new Date(dateStr);
      if (isNaN(parsed.getTime())) {
        results.push({ row: rowNum, employeeCode, date: dateStr, shiftCode, status: 'error', message: 'Invalid date format (use YYYY-MM-DD)' });
        errors++;
        continue;
      }
      date = parsed;
    }

    try {
      // Create or update the override
      await prisma.shiftAssignmentOverride.upsert({
        where: { employeeId_date: { employeeId, date } },
        update: { shiftMasterId, reason: `Bulk shift upload by user ${userId}`, createdByUserId: userId },
        create: { employeeId, date, shiftMasterId, reason: `Bulk shift upload by user ${userId}`, createdByUserId: userId },
      });

      // Create a notification for the employee
      await prisma.shiftChangeNotification.create({
        data: {
          employeeId,
          date,
          newShiftMasterId: shiftMasterId,
          reason: 'Bulk shift upload',
          createdByUserId: userId,
        },
      }).catch(() => {}); // notification failure shouldn't block the upload

      results.push({ row: rowNum, employeeCode, date: dateStr, shiftCode, status: 'ok' });
      created++;
    } catch (err) {
      results.push({ row: rowNum, employeeCode, date: dateStr, shiftCode, status: 'error', message: err instanceof Error ? err.message : 'Unknown error' });
      errors++;
    }
  }

  return NextResponse.json({ created, errors, total: rows.length, results });
}
