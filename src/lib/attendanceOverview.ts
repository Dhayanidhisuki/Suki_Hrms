/**
 * Attendance bucketed by period AND by department / unit / employee, for the
 * dashboard's Attendance Overview chart.
 *
 * Shared by /api/dashboard/overview (department and unit, shipped with the
 * rest of the dashboard payload) and /api/dashboard/attendance-overview
 * (employee, fetched only when that view is selected). Grouping by employee
 * multiplies the row count by headcount, so it is not something the default
 * dashboard load should carry.
 *
 * Done as one raw grouped query rather than through Prisma: attributing a row
 * to a department means joining DailyAttendance -> JobInfo, which groupBy
 * cannot traverse, and pulling employee-day rows into JS to attribute them
 * would scale with headcount x days. Grouping on (week, month, year,
 * department, unit, status) in SQL keeps the result proportional to the number
 * of periods instead.
 *
 * Grouping by week AND month means a week straddling a month boundary comes
 * back as two rows; the week view sums them back together, and the month view
 * gets each half in the right month.
 */
import { Prisma } from '@prisma/client';
import { prisma } from '@/lib/prisma';

const PRESENT_STATUSES = ['Present', 'HalfDay', 'OnDuty'];
const ABSENT_STATUSES = ['Absent', 'LOP'];

export type AttendanceGroupBy = 'department' | 'unit' | 'employee';

interface AttendanceDimRow {
  yr: number;
  mo: number;
  wk: Date;
  department: string | null;
  unit: string | null;
  employeeCode: string | null;
  employeeName: string | null;
  status: string;
  n: number;
}

export type Granularity = 'week' | 'month' | 'year';

export interface OverviewBucket {
  g: Granularity;
  label: string;
  sort: string;
  department: string;
  unit: string;
  employee: string;
  present: number;
  absent: number;
  counted: number;
}

const UNASSIGNED = 'Unassigned';

export async function attendanceOverview(
  companyId: number,
  today: Date,
  groupBy: AttendanceGroupBy = 'department'
) {
  const byEmployee = groupBy === 'employee';
  // Three calendar years back, so the yearly view has something to compare.
  const scanStart = new Date(Date.UTC(today.getUTCFullYear() - 2, 0, 1));

  const rows = await prisma.$queryRaw<AttendanceDimRow[]>`
    SELECT
      DATEPART(year, a.[date])  AS yr,
      DATEPART(month, a.[date]) AS mo,
      CAST(DATEADD(day, -((DATEPART(weekday, a.[date]) + @@DATEFIRST - 2) % 7), a.[date]) AS date) AS wk,
      d.[name] AS department,
      u.[name] AS unit,
      ${byEmployee ? Prisma.sql`e.[employeeCode] AS employeeCode, LTRIM(RTRIM(e.[firstName] + ' ' + ISNULL(e.[lastName], ''))) AS employeeName,` : Prisma.sql`CAST(NULL AS NVARCHAR(50)) AS employeeCode, CAST(NULL AS NVARCHAR(200)) AS employeeName,`}
      a.[status] AS status,
      COUNT(*) AS n
    FROM [DailyAttendance] a
    INNER JOIN [Employee] e ON e.[id] = a.[employeeId]
    LEFT JOIN [JobInfo] j ON j.[employeeId] = e.[id] AND j.[effectiveTo] IS NULL
    LEFT JOIN [Department] d ON d.[id] = j.[departmentId]
    LEFT JOIN [Unit] u ON u.[id] = j.[unitId]
    WHERE e.[companyId] = ${companyId}
      AND e.[deletedAt] IS NULL
      AND a.[date] >= ${scanStart}
      AND a.[date] <= ${today}
    GROUP BY
      DATEPART(year, a.[date]),
      DATEPART(month, a.[date]),
      CAST(DATEADD(day, -((DATEPART(weekday, a.[date]) + @@DATEFIRST - 2) % 7), a.[date]) AS date),
      d.[name], u.[name], a.[status]${byEmployee ? Prisma.sql`, e.[employeeCode], e.[firstName], e.[lastName]` : Prisma.empty}
  `;

  const departments = new Set<string>();
  const units = new Set<string>();
  const employees = new Set<string>();
  // key -> bucket, one map per granularity so labels cannot collide.
  const acc = new Map<string, OverviewBucket>();

  const bump = (
    g: Granularity,
    sort: string,
    label: string,
    department: string,
    unit: string,
    employee: string,
    status: string,
    n: number
  ) => {
    const key = `${g}|${sort}|${department}|${unit}|${employee}`;
    let b = acc.get(key);
    if (!b) {
      b = { g, label, sort, department, unit, employee, present: 0, absent: 0, counted: 0 };
      acc.set(key, b);
    }
    b.counted += n;
    if (PRESENT_STATUSES.includes(status)) b.present += n;
    else if (ABSENT_STATUSES.includes(status)) b.absent += n;
  };

  for (const row of rows) {
    // A weekly-off or a holiday is not an attendance opportunity, so counting
    // it would drag every rate down across the weekend.
    if (row.status === 'WeeklyOff' || row.status === 'Holiday') continue;

    const department = row.department ?? UNASSIGNED;
    const unit = row.unit ?? UNASSIGNED;
    const employee = row.employeeCode
      ? `${row.employeeCode} · ${row.employeeName ?? ''}`.trim()
      : UNASSIGNED;
    departments.add(department);
    units.add(unit);
    if (byEmployee) employees.add(employee);

    const n = Number(row.n) || 0;
    const wk = new Date(row.wk);
    const yr = Number(row.yr);
    const mo = Number(row.mo);

    bump('week', wk.toISOString().slice(0, 10),
      wk.toISOString().slice(5, 10).replace('-', '/'), department, unit, employee, row.status, n);

    const monthStart = new Date(Date.UTC(yr, mo - 1, 1));
    bump('month', `${yr}-${String(mo).padStart(2, '0')}`,
      monthStart.toLocaleString('en-US', { month: 'short', year: '2-digit', timeZone: 'UTC' }),
      department, unit, employee, row.status, n);

    bump('year', String(yr), String(yr), department, unit, employee, row.status, n);
  }

  // Trim each granularity to a readable window: 12 weeks, 12 months, 3 years.
  const keep = (g: Granularity, limit: number) => {
    const sorts = Array.from(
      new Set(Array.from(acc.values()).filter((b) => b.g === g).map((b) => b.sort))
    ).sort();
    return new Set(sorts.slice(-limit));
  };
  const windows: Record<Granularity, Set<string>> = {
    week: keep('week', 12),
    month: keep('month', 12),
    year: keep('year', 3),
  };

  const buckets = Array.from(acc.values())
    .filter((b) => windows[b.g].has(b.sort))
    .sort((a, b) => (a.sort < b.sort ? -1 : a.sort > b.sort ? 1 : 0));

  return {
    groupBy,
    departments: Array.from(departments).sort(),
    units: Array.from(units).sort(),
    employees: Array.from(employees).sort(),
    buckets,
  };
}