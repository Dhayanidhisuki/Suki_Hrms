/**
 * POST /api/workforce/leave/bulk-upload
 *   Body: FormData with "file" (CSV/XLSX) and "mode" = validate | import
 *
 * Bulk leave entry for the Leave Entry page. `validate` is a dry run — it
 * reads the sheet, resolves and checks every row, and writes nothing.
 * `import` re-runs the identical checks and then commits the rows that pass.
 *
 * Status per row is decided by date (see statusForRow): leave starting
 * before the current calendar month is back-dated and lands `approved`,
 * running the same side-effect chain as HR approval via commitLeaveApproval
 * — balance ledger, DailyAttendance, monthly summary, comp-off ledger.
 * Anything from this month onward lands `pending_manager` and goes through
 * the normal stages, writing nothing but the application row.
 *
 * The batch-only checks — a running balance tally, in-file overlap, and
 * duplicate detection — exist because none of them can be caught one row at
 * a time: two rows for the same employee can each pass against the stored
 * balance and together overdraw it.
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { checkSpecificPermission } from '@/lib/rbac-employee';
import { getCompanyId } from '@/lib/companyScope';
import {
  parseLeaveWorkbook,
  daysInclusive,
  statusForRow,
  type ParsedLeaveRow,
} from '@/lib/leave-bulk-import';
import {
  checkFrozenMonths,
  checkSufficientBalance,
  commitLeaveApproval,
  type LeaveApprovalTarget,
} from '@/lib/leave/finalizeApproval';

export interface RowResult {
  row: number;
  employeeCode: string;
  employeeName: string | null;
  leaveTypeCode: string;
  fromDate: string | null;
  toDate: string | null;
  numberOfDays: number | null;
  /** What this row would land as, once it passes. */
  plannedStatus: 'approved' | 'pending_manager' | null;
  status: 'ok' | 'error';
  errors: string[];
  warnings: string[];
  /** Only set by mode=import, for rows that were actually written. */
  applicationId?: number;
}

/** A row that passed validation, carrying everything the commit needs. */
interface ReadyRow {
  parsed: ParsedLeaveRow;
  result: RowResult;
  employeeId: number;
  leaveMasterId: number;
  leaveCode: string;
  fromDate: Date;
  toDate: Date;
  numberOfDays: number;
  plannedStatus: 'approved' | 'pending_manager';
}

const utc = (iso: string) => new Date(`${iso}T00:00:00.000Z`);

/** Do two inclusive date ranges share any day? */
function overlaps(aFrom: string, aTo: string, bFrom: string, bTo: string): boolean {
  return aFrom <= bTo && bFrom <= aTo;
}

export async function POST(request: NextRequest) {
  const userId = Number(request.headers.get('x-user-id'));
  if (!userId) {
    return NextResponse.json({ error: 'Unauthorized — authentication required' }, { status: 401 });
  }
  const permErr = await checkSpecificPermission(request, 'workforce.leave.edit');
  if (permErr) return permErr;
  const scope = getCompanyId(request);
  if ('error' in scope) return scope.error;

  const form = await request.formData().catch(() => null);
  const file = form?.get('file');
  const mode = String(form?.get('mode') ?? 'validate');
  if (!(file instanceof File)) {
    return NextResponse.json({ error: 'No file uploaded' }, { status: 400 });
  }
  if (mode !== 'validate' && mode !== 'import') {
    return NextResponse.json({ error: 'mode must be "validate" or "import"' }, { status: 400 });
  }

  let parsed;
  try {
    parsed = parseLeaveWorkbook(await file.arrayBuffer());
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Could not read the uploaded file' },
      { status: 400 }
    );
  }
  if (parsed.rows.length === 0) {
    return NextResponse.json({ error: 'No rows found on the Leave sheet.' }, { status: 400 });
  }

  // ── Resolve the masters the sheet refers to, once ──
  const employees = await prisma.employee.findMany({
    where: { companyId: scope.companyId, deletedAt: null },
    select: { id: true, employeeCode: true, oldEmployeeCode: true, firstName: true, lastName: true },
  });
  const employeeByCode = new Map<string, (typeof employees)[number]>();
  for (const e of employees) {
    employeeByCode.set(e.employeeCode.toUpperCase(), e);
    if (e.oldEmployeeCode) employeeByCode.set(e.oldEmployeeCode.toUpperCase(), e);
  }

  const leaveTypes = await prisma.leaveMaster.findMany({
    where: { isActive: true, deletedAt: null },
    select: { id: true, code: true },
  });
  const typeByCode = new Map(leaveTypes.map((t) => [t.code.toUpperCase(), t]));

  // Existing applications for the employees named in the file, for overlap
  // and duplicate detection. Cancelled and rejected ones don't block.
  const referencedIds = [
    ...new Set(
      parsed.rows
        .map((r) => employeeByCode.get(r.employeeCode.toUpperCase())?.id)
        .filter((id): id is number => typeof id === 'number')
    ),
  ];
  const existing = referencedIds.length
    ? await prisma.leaveApplication.findMany({
        where: {
          employeeId: { in: referencedIds },
          status: { in: ['pending_manager', 'pending_hr', 'approved'] },
        },
        select: { id: true, employeeId: true, leaveMasterId: true, fromDate: true, toDate: true },
      })
    : [];
  const existingByEmployee = new Map<number, typeof existing>();
  for (const a of existing) {
    existingByEmployee.set(a.employeeId, [...(existingByEmployee.get(a.employeeId) ?? []), a]);
  }

  // ── Validate every row ──
  const results: RowResult[] = [];
  const ready: ReadyRow[] = [];
  // Running tally of days already claimed by earlier rows in this same file,
  // keyed by employee + leave type + year — without it two rows can each pass
  // against the stored balance and together overdraw it.
  const reserved = new Map<string, number>();
  // Accepted rows so far, for in-file overlap detection.
  const acceptedByEmployee = new Map<number, { fromDate: string; toDate: string; row: number }[]>();

  for (const p of parsed.rows) {
    const result: RowResult = {
      row: p.row,
      employeeCode: p.employeeCode,
      employeeName: null,
      leaveTypeCode: p.leaveTypeCode,
      fromDate: p.fromDate,
      toDate: p.toDate,
      numberOfDays: null,
      plannedStatus: null,
      status: 'error',
      errors: [...p.errors],
      warnings: [],
    };

    const employee = employeeByCode.get(p.employeeCode.toUpperCase());
    if (p.employeeCode && !employee) result.errors.push(`Employee "${p.employeeCode}" not found in this company`);
    if (employee) result.employeeName = `${employee.firstName} ${employee.lastName}`.trim();

    const leaveType = typeByCode.get(p.leaveTypeCode.toUpperCase());
    if (p.leaveTypeCode && !leaveType) result.errors.push(`Leave Type "${p.leaveTypeCode}" not found or inactive`);

    if (result.errors.length > 0 || !employee || !leaveType || !p.fromDate || !p.toDate) {
      results.push(result);
      continue;
    }

    // Days: calculate from the range unless the sheet stated a figure, and
    // warn (don't fail) when the two disagree — a spreadsheet is easy to get
    // wrong and HR should see the discrepancy rather than have it silently
    // accepted or silently overridden.
    const calculated = p.isHalfDay ? 0.5 : daysInclusive(p.fromDate, p.toDate);
    const numberOfDays = p.statedDays ?? calculated;
    if (p.statedDays !== null && p.statedDays !== calculated) {
      result.warnings.push(
        `Sheet says ${p.statedDays} day(s) but the dates give ${calculated} — using ${p.statedDays} as stated`
      );
    }
    result.numberOfDays = numberOfDays;

    const plannedStatus = statusForRow(p.fromDate);
    result.plannedStatus = plannedStatus;

    // Duplicate: same employee, same type, same exact range, already present.
    const priors = existingByEmployee.get(employee.id) ?? [];
    const isDuplicate = priors.some(
      (a) =>
        a.leaveMasterId === leaveType.id &&
        a.fromDate.toISOString().slice(0, 10) === p.fromDate &&
        a.toDate.toISOString().slice(0, 10) === p.toDate
    );
    if (isDuplicate) {
      result.errors.push('This leave already exists for this employee (same type and dates)');
    }

    // Overlap against what's already in the system.
    const clash = priors.find((a) =>
      overlaps(p.fromDate!, p.toDate!, a.fromDate.toISOString().slice(0, 10), a.toDate.toISOString().slice(0, 10))
    );
    if (clash && !isDuplicate) {
      result.errors.push(
        `Overlaps an existing leave (${clash.fromDate.toISOString().slice(0, 10)} to ${clash.toDate.toISOString().slice(0, 10)})`
      );
    }

    // Overlap against earlier rows in this same file.
    const inFile = (acceptedByEmployee.get(employee.id) ?? []).find((a) =>
      overlaps(p.fromDate!, p.toDate!, a.fromDate, a.toDate)
    );
    if (inFile) {
      result.errors.push(`Overlaps row ${inFile.row} in this file for the same employee`);
    }

    const target: LeaveApprovalTarget = {
      id: 0, // not yet created; only used by the commit path
      employeeId: employee.id,
      leaveMasterId: leaveType.id,
      fromDate: utc(p.fromDate),
      toDate: utc(p.toDate),
      numberOfDays,
      leaveCode: leaveType.code,
    };

    // Balance and freeze only gate rows that will be approved on import —
    // a pending row writes neither the ledger nor attendance, so it is held
    // to the same bar the single-entry screen applies (balance only).
    const year = target.fromDate.getUTCFullYear();
    const key = `${employee.id}:${leaveType.id}:${year}`;
    const alreadyReserved = reserved.get(key) ?? 0;

    const balanceBlock = await checkSufficientBalance(target, alreadyReserved);
    if (balanceBlock) result.errors.push(balanceBlock.message);

    if (plannedStatus === 'approved') {
      const frozenBlock = await checkFrozenMonths(target);
      if (frozenBlock) result.errors.push(frozenBlock.message);
    }

    if (result.errors.length > 0) {
      results.push(result);
      continue;
    }

    result.status = 'ok';
    reserved.set(key, alreadyReserved + numberOfDays);
    acceptedByEmployee.set(employee.id, [
      ...(acceptedByEmployee.get(employee.id) ?? []),
      { fromDate: p.fromDate, toDate: p.toDate, row: p.row },
    ]);
    results.push(result);
    ready.push({
      parsed: p,
      result,
      employeeId: employee.id,
      leaveMasterId: leaveType.id,
      leaveCode: leaveType.code,
      fromDate: target.fromDate,
      toDate: target.toDate,
      numberOfDays,
      plannedStatus,
    });
  }

  const summary = {
    total: results.length,
    ok: results.filter((r) => r.status === 'ok').length,
    errors: results.filter((r) => r.status === 'error').length,
    toApprove: ready.filter((r) => r.plannedStatus === 'approved').length,
    toPending: ready.filter((r) => r.plannedStatus === 'pending_manager').length,
    blankRowsSkipped: parsed.blankRows,
  };

  if (mode === 'validate') {
    return NextResponse.json({ mode, summary, rows: results });
  }

  // ── Import ──
  // Each row is committed independently: a failure on one leaves the rows
  // before it in place and is reported against that row, the same way the
  // employee import treats a partially-written employee. The alternative —
  // one transaction for the whole file — would roll back a 200-row load
  // because of a single late failure.
  let imported = 0;
  for (const r of ready) {
    try {
      const created = await prisma.leaveApplication.create({
        data: {
          employeeId: r.employeeId,
          leaveMasterId: r.leaveMasterId,
          companyId: scope.companyId,
          fromDate: r.fromDate,
          toDate: r.toDate,
          numberOfDays: r.numberOfDays,
          isHalfDay: r.parsed.isHalfDay,
          reason: r.parsed.reason,
          contactDuringLeave: r.parsed.contactDuringLeave,
          addressDuringLeave: r.parsed.addressDuringLeave,
          status: r.plannedStatus,
        },
      });
      r.result.applicationId = created.id;

      if (r.plannedStatus === 'approved') {
        await commitLeaveApproval(
          {
            id: created.id,
            employeeId: r.employeeId,
            leaveMasterId: r.leaveMasterId,
            fromDate: r.fromDate,
            toDate: r.toDate,
            numberOfDays: r.numberOfDays,
            leaveCode: r.leaveCode,
          },
          userId
        );
      }
      imported++;
    } catch (err) {
      r.result.status = 'error';
      r.result.errors.push(err instanceof Error ? err.message : 'Import failed for this row');
    }
  }

  return NextResponse.json({
    mode,
    summary: { ...summary, imported, failedDuringImport: ready.length - imported },
    rows: results,
  });
}
