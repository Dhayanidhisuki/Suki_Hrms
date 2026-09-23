/** One bucket of the attendance trend — a week or a calendar month. */
export interface AttendanceTrendPoint {
  label: string;
  /** Present as a percentage of attendance opportunities in the bucket. */
  rate: number;
  present: number;
  absent: number;
  /** Rows counted, i.e. excluding weekly-offs and holidays. */
  counted: number;
}

export type AttendanceGranularity = 'week' | 'month' | 'year';

/**
 * One period x department x unit cell of the Attendance Overview.
 * The client sums these to whatever the dropdowns are set to, so switching
 * department, unit or granularity costs no extra request.
 */
export type AttendanceDimension = 'department' | 'unit' | 'employee';

export interface AttendanceOverviewBucket {
  g: AttendanceGranularity;
  label: string;
  /** Sortable period key (ISO date / YYYY-MM / YYYY). */
  sort: string;
  department: string;
  unit: string;
  /** "CODE · Name", or "Unassigned" outside the employee-grouped fetch. */
  employee: string;
  present: number;
  absent: number;
  /** Rows counted, i.e. excluding weekly-offs and holidays. */
  counted: number;
}

export interface AttendanceOverview {
  departments: string[];
  units: string[];
  /** Only populated by the employee-grouped fetch. */
  employees?: string[];
  buckets: AttendanceOverviewBucket[];
}

/** Response shape of GET /api/dashboard/overview. */
export interface OverviewData {
  asOf: string;
  headcount: {
    total: number;
    byDepartment: Array<{ department: string; count: number }>;
  };
  attendanceToday: {
    present: number;
    /** Present but after shift start — a subset of `present`, not an extra. */
    late: number;
    onLeave: number;
    absent: number;
    marked: number;
    unmarked: number;
    /** null when nothing is marked for today yet. */
    rate: number | null;
  };
  pendingApprovals: { leave: number; overtime: number; compOff: number; total: number };
  attendanceTrend: AttendanceTrendPoint[];
  /** Same series bucketed by calendar month, for the overview chart's toggle. */
  attendanceTrendMonthly: AttendanceTrendPoint[];
  /** Department- and unit-dimensioned attendance for the lead chart. */
  attendanceOverview: AttendanceOverview;
  /** Empty when no leave was applied for in the window. */
  leaveByStatus: Array<{ label: string; approved: number; pending: number; rejected: number }>;
  salaryCost: Array<{ label: string; gross: number; net: number; ot: number }>;
  statutory: {
    pfEmployee: number; pfEmployer: number;
    esiEmployee: number; esiEmployer: number;
    professionalTax: number; tds: number;
  } | null;
  /** The most recent run that actually has calculated lines, if any. */
  settledRun: { id: number; label: string } | null;
  payrollRun: {
    id: number; year: number; month: number; status: string; label: string;
    totalLines: number; clearedLines: number; holdLines: number; grossAtRisk: number;
  } | null;
  attrition: {
    months: Array<{ label: string; exits: number }>;
    totalExits12m: number;
    rate: number;
  };
}
