/** Response shape of GET /api/dashboard/overview. */
export interface OverviewData {
  asOf: string;
  headcount: {
    total: number;
    byDepartment: Array<{ department: string; count: number }>;
  };
  attendanceToday: {
    present: number;
    onLeave: number;
    absent: number;
    marked: number;
    unmarked: number;
    /** null when nothing is marked for today yet. */
    rate: number | null;
  };
  pendingApprovals: { leave: number; overtime: number; compOff: number; total: number };
  attendanceTrend: Array<{ label: string; rate: number }>;
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
