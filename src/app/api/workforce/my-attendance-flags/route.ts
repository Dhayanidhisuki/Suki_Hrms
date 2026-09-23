/**
 * GET /api/workforce/my-attendance-flags?years=2
 *
 * The signed-in employee's own attendance, counted per status and bucketed by
 * week, calendar month and year — the source behind the ESS Attendance Flag
 * Summary's week / month / year switch.
 *
 * Self-service: the employee is resolved from the session and never taken from
 * a query parameter, same rule as /api/workforce/my-dashboard.
 *
 * All three granularities ship in one payload so the switch costs no request.
 * The row count is bounded by (periods x distinct statuses), not by days.
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getCompanyId } from '@/lib/companyScope';
import { resolveOwnEmployeeId } from '@/lib/reportingManager';

interface FlagRow {
  yr: number;
  mo: number;
  wk: Date;
  status: string;
  n: number;
}

type Granularity = 'week' | 'month' | 'year';

interface FlagBucket {
  g: Granularity;
  label: string;
  sort: string;
  status: string;
  count: number;
}

const MONTH_SHORT = [
  'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
  'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec',
];

export async function GET(request: NextRequest) {
  const userId = Number(request.headers.get('x-user-id'));
  if (!userId) {
    return NextResponse.json({ error: 'Unauthorized — authentication required' }, { status: 401 });
  }
  const scope = getCompanyId(request);
  if ('error' in scope) return scope.error;

  const ownEmployeeId = await resolveOwnEmployeeId(userId);
  if (!ownEmployeeId) {
    return NextResponse.json({ error: 'This login has no linked employee record' }, { status: 403 });
  }

  const today = new Date();
  const yearsBack = Math.min(5, Math.max(1, Number(request.nextUrl.searchParams.get('years')) || 2));
  const start = new Date(Date.UTC(today.getUTCFullYear() - (yearsBack - 1), 0, 1));

  const rows = await prisma.$queryRaw<FlagRow[]>`
    SELECT
      DATEPART(year, a.[date])  AS yr,
      DATEPART(month, a.[date]) AS mo,
      CAST(DATEADD(day, -((DATEPART(weekday, a.[date]) + @@DATEFIRST - 2) % 7), a.[date]) AS date) AS wk,
      a.[status] AS status,
      COUNT(*) AS n
    FROM [DailyAttendance] a
    WHERE a.[employeeId] = ${ownEmployeeId}
      AND a.[date] >= ${start}
      AND a.[date] <= ${today}
    GROUP BY
      DATEPART(year, a.[date]),
      DATEPART(month, a.[date]),
      CAST(DATEADD(day, -((DATEPART(weekday, a.[date]) + @@DATEFIRST - 2) % 7), a.[date]) AS date),
      a.[status]
  `;

  const statuses = new Set<string>();
  const acc = new Map<string, FlagBucket>();

  const bump = (g: Granularity, sort: string, label: string, status: string, n: number) => {
    const key = `${g}|${sort}|${status}`;
    let b = acc.get(key);
    if (!b) { b = { g, label, sort, status, count: 0 }; acc.set(key, b); }
    b.count += n;
  };

  for (const row of rows) {
    const status = row.status;
    statuses.add(status);
    const n = Number(row.n) || 0;
    const wk = new Date(row.wk);
    const yr = Number(row.yr);
    const mo = Number(row.mo);

    bump('week', wk.toISOString().slice(0, 10),
      `${wk.getUTCDate()} ${MONTH_SHORT[wk.getUTCMonth()]}`, status, n);
    bump('month', `${yr}-${String(mo).padStart(2, '0')}`,
      `${MONTH_SHORT[mo - 1]} ${String(yr).slice(2)}`, status, n);
    bump('year', String(yr), String(yr), status, n);
  }

  // Keep each granularity to a readable window.
  const keep = (g: Granularity, limit: number) => {
    const sorts = Array.from(
      new Set(Array.from(acc.values()).filter((b) => b.g === g).map((b) => b.sort))
    ).sort();
    return new Set(sorts.slice(-limit));
  };
  const windows: Record<Granularity, Set<string>> = {
    week: keep('week', 12),
    month: keep('month', 12),
    year: keep('year', yearsBack),
  };

  const buckets = Array.from(acc.values())
    .filter((b) => windows[b.g].has(b.sort))
    .sort((a, b) => (a.sort < b.sort ? -1 : a.sort > b.sort ? 1 : 0));

  return NextResponse.json({ statuses: Array.from(statuses).sort(), buckets });
}
