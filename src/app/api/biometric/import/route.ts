/**
 * POST /api/biometric/import
 * Body: { periodStartDate, source: 'hours' | 'intime' | 'outtime', fromWhere?, rows: [...] }
 *
 * The single ingestion path for biometric/legacy attendance data — used both
 * by an external device/vendor pushing JSON directly, and by the Biometric
 * module's bulk-paste UI (three panes, one per source shape) for when that
 * automation isn't running. One BiometricAttendanceImport row per
 * (companyId, empIdRaw, year, attForMonth); each source merges its own
 * columns into that row via upsert — see prisma/schema.prisma's model
 * comment. Matches empIdRaw -> Employee.oldEmployeeCode, then pushes matched
 * rows through convertImportToDailyAttendance.
 *
 * GET /api/biometric/import?date=YYYY-MM-DD
 * Lists every import row whose wage period covers that calendar date, for
 * the Biometric module's day viewer — one flattened record per employee with
 * that day's hours/in-time/out-time and match status.
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { checkSpecificPermission } from '@/lib/rbac-employee';
import { getCompanyId } from '@/lib/companyScope';
import { convertImportToDailyAttendance } from '@/lib/biometricConversion';
import {
  biometricImportEnvelopeSchema,
  biometricHoursRowSchema,
  biometricInTimeRowSchema,
  biometricOutTimeRowSchema,
} from '@/lib/validations/workforce';

const ROW_SCHEMAS = {
  hours: biometricHoursRowSchema,
  intime: biometricInTimeRowSchema,
  outtime: biometricOutTimeRowSchema,
} as const;

function dayFieldNames(source: 'hours' | 'intime' | 'outtime') {
  const suffix = source === 'hours' ? '' : source === 'intime' ? 'InTime' : 'OutTime';
  return Array.from({ length: 31 }, (_, i) => `day${i + 1}${suffix}`);
}

function isRealValue(v: unknown): v is number {
  return typeof v === 'number' && Number.isFinite(v) && v !== 0;
}

function naturalKey(r: Record<string, unknown>): string {
  return `${r.empIdRaw}|${r.year}|${r.attForMonth}`;
}

/**
 * The legacy export routinely contains many rows for the same
 * (empIdRaw, year, attForMonth) — not distinct periods, but the same period
 * logged repeatedly: one "real" row with most days populated (typically
 * FROM_WHERE = MOBILE APP or BIOMETRIC), plus a string of near-empty rows
 * that each carry exactly one non-zero day (typically FROM_WHERE = MANUAL,
 * TOTAL equal to that one day's value) — apparently single-day manual
 * entries appended as full-width rows instead of updating the real row's
 * day cell.
 *
 * Importing these naively (last row wins, whole-row overwrite) means
 * whichever near-empty row happens to be processed last wipes out the real
 * data — confirmed happening: a day that was correctly "Present" ended up
 * "Absent" after import. Fixed by merging at the DAY level within one
 * request: the row with the most non-zero days is the base (the real
 * monthly record); any OTHER row's day value only fills in a day the base
 * left blank — it can never overwrite a day the base already has real data
 * for. Ties for "which row fills a given blank day" go to the higher REF_NO
 * (a later, more authoritative entry per the source's own ordering).
 */
function mergeDuplicateRows(
  parsedRows: { key: string; refNo: number; data: Record<string, unknown> }[],
  fields: string[]
): { merged: Record<string, unknown>; duplicateCount: number }[] {
  const groups = new Map<string, typeof parsedRows>();
  for (const row of parsedRows) {
    const list = groups.get(row.key) ?? [];
    list.push(row);
    groups.set(row.key, list);
  }

  const result: { merged: Record<string, unknown>; duplicateCount: number }[] = [];
  for (const group of groups.values()) {
    if (group.length === 1) {
      result.push({ merged: group[0].data, duplicateCount: 0 });
      continue;
    }
    const countRealDays = (data: Record<string, unknown>) => fields.filter((f) => isRealValue(data[f])).length;
    const base = group.reduce((a, b) => (countRealDays(b.data) > countRealDays(a.data) ? b : a));

    const merged: Record<string, unknown> = { ...base.data };
    for (const field of fields) {
      if (isRealValue(merged[field])) continue; // base already has real data for this day — never overwritten
      let best: { refNo: number; value: unknown } | null = null;
      for (const candidate of group) {
        if (candidate === base) continue;
        const v = candidate.data[field];
        if (isRealValue(v) && (!best || candidate.refNo > best.refNo)) {
          best = { refNo: candidate.refNo, value: v };
        }
      }
      if (best) merged[field] = best.value;
    }
    result.push({ merged, duplicateCount: group.length - 1 });
  }
  return result;
}

export async function GET(request: NextRequest) {
  const permErr = await checkSpecificPermission(request, 'workforce.biometric.view');
  if (permErr) return permErr;
  const scope = getCompanyId(request);
  if ('error' in scope) return scope.error;

  const { searchParams } = new URL(request.url);
  const dateParam = searchParams.get('date');
  if (!dateParam) {
    return NextResponse.json({ error: 'date is required (YYYY-MM-DD)' }, { status: 400 });
  }
  const date = new Date(dateParam);
  if (Number.isNaN(date.getTime())) {
    return NextResponse.json({ error: 'Invalid date' }, { status: 400 });
  }

  const earliestPeriodStart = new Date(date);
  earliestPeriodStart.setUTCDate(earliestPeriodStart.getUTCDate() - 30);

  const rows = await prisma.biometricAttendanceImport.findMany({
    where: {
      companyId: scope.companyId,
      periodStartDate: { gte: earliestPeriodStart, lte: date },
    },
    include: {
      matchedEmployee: { select: { id: true, employeeCode: true, firstName: true, lastName: true } },
    },
  });

  const data = rows
    .map((row) => {
      const dayIndex = Math.round((date.getTime() - row.periodStartDate.getTime()) / 86400000) + 1;
      if (dayIndex < 1 || dayIndex > 31) return null;
      const r = row as unknown as Record<string, unknown>;
      return {
        id: row.id,
        empIdRaw: row.empIdRaw,
        year: row.year,
        attForMonth: row.attForMonth,
        fromWhere: row.fromWhere,
        matchedEmployee: row.matchedEmployee,
        processedAt: row.processedAt,
        hours: r[`day${dayIndex}`] ?? null,
        inTimeRaw: r[`day${dayIndex}InTime`] ?? null,
        outTimeRaw: r[`day${dayIndex}OutTime`] ?? null,
      };
    })
    .filter((r): r is NonNullable<typeof r> => r !== null);

  return NextResponse.json({ data, date: dateParam });
}

export async function POST(request: NextRequest) {
  const permErr = await checkSpecificPermission(request, 'workforce.biometric.edit');
  if (permErr) return permErr;
  const scope = getCompanyId(request);
  if ('error' in scope) return scope.error;

  const envelope = biometricImportEnvelopeSchema.safeParse(await request.json().catch(() => null));
  if (!envelope.success) {
    return NextResponse.json(
      { error: 'Validation failed', details: envelope.error.flatten() },
      { status: 400 }
    );
  }
  const { periodStartDate, source, fromWhere, rows } = envelope.data;
  const rowSchema = ROW_SCHEMAS[source];
  const fields = dayFieldNames(source);
  const userId = Number(request.headers.get('x-user-id'));

  const rowErrors: { index: number; error: unknown }[] = [];
  const validRows: { key: string; refNo: number; data: Record<string, unknown> }[] = [];
  for (let i = 0; i < rows.length; i++) {
    const parsed = rowSchema.safeParse(rows[i]);
    if (!parsed.success) {
      rowErrors.push({ index: i, error: parsed.error.flatten() });
      continue;
    }
    const data = parsed.data as unknown as Record<string, unknown>;
    validRows.push({ key: naturalKey(data), refNo: Number(data.refNo) || 0, data });
  }

  // Collapses the legacy export's repeated rows for the same period into one
  // merged row per (empIdRaw, year, attForMonth) before touching the DB —
  // see mergeDuplicateRows for why this can't be a simple last-row-wins.
  const mergedRows = mergeDuplicateRows(validRows, fields);
  let duplicatesMerged = 0;

  let unmatchedCount = 0;
  let importedCount = 0;
  const conversionTotals = { converted: 0, skippedFrozen: 0, unmatchedTimes: 0 };

  for (const { merged: r, duplicateCount } of mergedRows) {
    duplicatesMerged += duplicateCount;

    const employee = await prisma.employee.findFirst({
      where: { companyId: scope.companyId, oldEmployeeCode: String(r.empIdRaw), deletedAt: null },
      select: { id: true },
    });
    if (!employee) unmatchedCount++;

    const dayData: Record<string, unknown> = {};
    for (const f of fields) dayData[f] = r[f] ?? null;

    const sourceOnlyData: Record<string, unknown> =
      source === 'hours'
        ? {
            refNo: (r.refNo as number | null | undefined) ?? null,
            total: (r.total as number | undefined) ?? 0,
            totalLom: (r.totalLom as number | undefined) ?? 0,
            totalOtHrs: (r.totalOtHrs as number | undefined) ?? 0,
            creatUserIdCd: (r.creatUserIdCd as string | null | undefined) ?? null,
            creatDt: (r.creatDt as Date | null | undefined) ?? null,
            lstUpdtUserIdCd: (r.lstUpdtUserIdCd as string | null | undefined) ?? null,
            lstUpdtTs: (r.lstUpdtTs as Date | null | undefined) ?? null,
            attEndMonth: (r.attEndMonth as Date | null | undefined) ?? null,
          }
        : {};

    const saved = await prisma.biometricAttendanceImport.upsert({
      where: {
        companyId_empIdRaw_year_attForMonth: {
          companyId: scope.companyId,
          empIdRaw: String(r.empIdRaw),
          year: Number(r.year),
          attForMonth: String(r.attForMonth),
        },
      },
      update: {
        periodStartDate,
        fromWhere,
        matchedEmployeeId: employee?.id ?? null,
        ...sourceOnlyData,
        ...dayData,
      },
      create: {
        companyId: scope.companyId,
        empIdRaw: String(r.empIdRaw),
        year: Number(r.year),
        attForMonth: String(r.attForMonth),
        periodStartDate,
        fromWhere,
        matchedEmployeeId: employee?.id ?? null,
        ...sourceOnlyData,
        ...dayData,
      },
    });
    importedCount++;

    if (saved.matchedEmployeeId) {
      const result = await convertImportToDailyAttendance(saved.id, userId || null);
      conversionTotals.converted += result.converted;
      conversionTotals.skippedFrozen += result.skippedFrozen;
      conversionTotals.unmatchedTimes += result.unmatchedTimes;
    }
  }

  return NextResponse.json(
    {
      message: `Imported ${importedCount} of ${rows.length} row(s)`,
      imported: importedCount,
      unmatched: unmatchedCount,
      duplicatesMerged,
      rowErrors,
      conversion: conversionTotals,
    },
    { status: 201 }
  );
}
