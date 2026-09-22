/**
 * Performance Incentive Report — the only place the calculated incentive
 * amount is ever shown. Reads the employee's CTC-only (grossTier =
 * NON_PAYROLL) "Performance Incentive" component amount as the base figure,
 * attendance present-days, and — for the percentage and status/remarks —
 * the existing Workforce > Benefits > Performance Incentive page's data
 * (PmsIncentive: companyPercent + managerPercent = total %, and status).
 * Writes nothing back anywhere; never consulted by payrollCalculation.ts.
 *
 * Column set matches the company's existing "PMS Incentives Register"
 * export (Sl No / Emp ID / Employee Name / Month-Year / Department /
 * Designation / DOJ / CATEGORY / PMS INC FI / Sal Cal Days / LOP AVAILED /
 * Pay Days / PMS Inc Earning / PMS % / PMS Incent / PMS EMPESI(0.75%) /
 * PMS EMPloyer(3.25%) / PMS NET / Bank A/c No / Bank IFSC / Bank Name /
 * Remarks) one-for-one, so this report can replace that manual register.
 *
 * Formula (confirmed against both the reference sheet and the register):
 *   oneDayValue    = ctcAmount ("PMS INC FI", from Employee Master CTC) / daysInMonth ("Sal Cal Days")
 *   pmsIncEarning  = oneDayValue * presentDays ("Pay Days")
 *   percent        = PmsIncentive.companyPercent + PmsIncentive.managerPercent ("PMS %")
 *   pmsIncent (A)  = pmsIncEarning * (percent / 100)   ["PMS Incent"]
 *   if ESI-eligible: empEsi = A * esiEmployeeRate/100 ; employerEsi = A * esiEmployerRate/100 ; net = A - empEsi
 *   else:            empEsi = 0 ; employerEsi = 0 ; net = A            ["PMS NET"]
 *   remarks        = PmsIncentive.status, bucketed the same way the PMS
 *                    Incentive page's own status filter/badge does.
 */

import { prisma } from '@/lib/prisma';

export function daysInMonth(year: number, month: number) {
  return new Date(Date.UTC(year, month, 0)).getUTCDate();
}

const MONTH_ABBR = ['', 'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

// Same bucketing as the PMS Incentive page's own status badge/filter
// (src/app/payroll/processing/pms-incentive/page.tsx STATUS_BUCKET) — kept
// in sync intentionally so "Remarks" here always reads identically to what
// HR sees on that page.
const STATUS_REMARKS: Record<string, string> = {
  draft: 'DRAFT',
  submitted: 'PROCESS',
  under_review: 'PROCESS',
  returned: 'PROCESS',
  pending_hr: 'PROCESS',
  rejected: 'HOLD',
  approved: 'COMPLETE',
  finalized: 'COMPLETE',
};

export interface PerformanceIncentiveRow {
  employeeId: number;
  employeeCode: string;
  employeeName: string;
  monthYearLabel: string;
  department: string | null;
  designation: string | null;
  dateOfJoining: string | null;
  category: string | null;
  year: number;
  month: number;
  // "PMS INC FI" — the CTC-quoted monthly Performance Incentive figure.
  ctcAmount: number;
  // "Sal Cal Days"
  daysInMonth: number;
  // "LOP AVAILED"
  lopDays: number;
  // "Pay Days"
  presentDays: number;
  // "PMS Inc Earning" — attendance-adjusted amount, before percent.
  pmsIncEarning: number;
  // "PMS %"
  percent: number | null;
  // "PMS Incent" — percent-adjusted amount (A), before any ESI deduction.
  pmsIncent: number;
  esiEligible: boolean;
  // "PMS EMPESI(0.75%)"
  esiEmployeeDeduction: number;
  // "PMS EMPloyer(3.25%)" — informational employer-side ESI cost, not
  // subtracted from the employee's amount.
  esiEmployerContribution: number;
  // "PMS NET" — what actually gets shown/paid out via this report.
  finalAmount: number;
  bankAccountNo: string | null;
  bankIfsc: string | null;
  bankName: string | null;
  remarks: string;
}

function displayCode(emp: { employeeCode: string; oldEmployeeCode: string | null }) {
  return emp.oldEmployeeCode?.trim() || emp.employeeCode;
}

export async function computePerformanceIncentiveRows(
  companyId: number,
  year: number,
  month: number,
  employeeId?: number
): Promise<PerformanceIncentiveRow[]> {
  const employees = await prisma.employee.findMany({
    where: {
      companyId,
      deletedAt: null,
      isActive: true,
      ...(employeeId ? { id: employeeId } : {}),
    },
    select: {
      id: true,
      employeeCode: true,
      oldEmployeeCode: true,
      firstName: true,
      lastName: true,
      bankDetail: { select: { accountNumber: true, ifscCode: true, bankName: true } },
      jobInfos: {
        where: { effectiveTo: null },
        take: 1,
        select: {
          esiApplicable: true,
          joinDate: true,
          department: { select: { name: true } },
          designation: { select: { name: true } },
          category: { select: { name: true } },
          employeeType: { select: { name: true } },
        },
      },
      salaryRevisions: {
        where: { effectiveTo: null },
        take: 1,
        select: { grossSalary: true },
      },
      ctcRecords: {
        where: { effectiveTo: null },
        take: 1,
        select: { id: true, components: { include: { salaryComponent: true } } },
      },
    },
  });
  if (employees.length === 0) return [];

  const empIds = employees.map((e) => e.id);
  const [pmsRows, attendanceSummaries, esiRate, payrollLines] = await Promise.all([
    prisma.pmsIncentive.findMany({
      where: { employeeId: { in: empIds }, year, month },
      select: { employeeId: true, companyPercent: true, managerPercent: true, totalPercent: true, status: true },
    }),
    prisma.monthlyAttendanceSummary.findMany({ where: { employeeId: { in: empIds }, year, month }, select: { employeeId: true, presentDays: true } }),
    prisma.esiRate.findFirst({ where: { effectiveTo: null, isActive: true } }),
    prisma.payrollLine.findMany({
      where: { employeeId: { in: empIds }, payrollRun: { companyId, year, month } },
      select: { employeeId: true, grossEarnings: true },
    }),
  ]);
  const pmsByEmp = new Map(pmsRows.map((p) => [p.employeeId, p]));
  const presentDaysByEmp = new Map(attendanceSummaries.map((s) => [s.employeeId, Number(s.presentDays)]));
  const grossEarningsByEmp = new Map(payrollLines.map((l) => [l.employeeId, Number(l.grossEarnings)]));

  const dim = daysInMonth(year, month);
  const monthYearLabel = `${MONTH_ABBR[month]}-${String(year).slice(-2)}`;

  return employees.map((e) => {
    const jobInfo = e.jobInfos[0];
    // CTC amount = sum of all NON_PAYROLL components on the employee's
    // current CTC revision (today that's specifically "Performance
    // Incentive" — the only intended use of the NON_PAYROLL tier).
    const ctcAmount = (e.ctcRecords[0]?.components ?? [])
      .filter((c) => c.salaryComponent.grossTier === 'NON_PAYROLL')
      .reduce((sum, c) => sum + Number(c.amount), 0);
    const presentDaysRaw = presentDaysByEmp.get(e.id);
    const presentDays = presentDaysRaw ?? 0;
    const hasAttendance = presentDaysRaw !== undefined;
    const lopDays = hasAttendance ? Math.max(0, dim - presentDays) : dim;
    const pms = pmsByEmp.get(e.id);
    // "we should calculate both percentage in addition (company + manager)"
    // — use the stored totalPercent when present (it's already that sum,
    // set by the PMS Incentive page's own save logic), else derive it.
    const percent = pms ? Number(pms.totalPercent ?? Number(pms.companyPercent) + Number(pms.managerPercent)) : null;

    const oneDayValue = dim > 0 ? ctcAmount / dim : 0;
    const pmsIncEarning = oneDayValue * presentDays;
    const pmsIncent = percent !== null ? pmsIncEarning * (percent / 100) : 0;

    const esiApplicable = jobInfo?.esiApplicable ?? false;
    let esiEligible = false;
    if (esiApplicable && esiRate) {
      const ceiling = Number(esiRate.wageCeilingMonthly);
      const structuredGross = Number(e.salaryRevisions[0]?.grossSalary ?? 0);
      const monthGross = grossEarningsByEmp.get(e.id);
      if (structuredGross > 0 && structuredGross <= ceiling) esiEligible = true;
      else if (monthGross !== undefined && monthGross <= ceiling) esiEligible = true;
    }
    const esiEmployeeDeduction = esiEligible && esiRate ? pmsIncent * (Number(esiRate.employeeContributionRate) / 100) : 0;
    const esiEmployerContribution = esiEligible && esiRate ? pmsIncent * (Number(esiRate.employerContributionRate) / 100) : 0;
    const finalAmount = pmsIncent - esiEmployeeDeduction;

    let remarks: string;
    if (!pms) remarks = 'NOT STARTED';
    else remarks = STATUS_REMARKS[pms.status] ?? pms.status.toUpperCase();
    if (ctcAmount === 0) remarks = 'NO CTC INCENTIVE SET';
    else if (!hasAttendance) remarks = 'NO ATTENDANCE';

    return {
      employeeId: e.id,
      employeeCode: displayCode(e),
      employeeName: `${e.firstName} ${e.lastName}`.trim(),
      monthYearLabel,
      department: jobInfo?.department?.name ?? null,
      designation: jobInfo?.designation?.name ?? null,
      dateOfJoining: jobInfo?.joinDate ? jobInfo.joinDate.toISOString().slice(0, 10) : null,
      category: jobInfo?.category?.name ?? jobInfo?.employeeType?.name ?? null,
      year,
      month,
      ctcAmount: round2(ctcAmount),
      daysInMonth: dim,
      lopDays: round2(lopDays),
      presentDays,
      pmsIncEarning: round2(pmsIncEarning),
      percent,
      pmsIncent: round2(pmsIncent),
      esiEligible,
      esiEmployeeDeduction: round2(esiEmployeeDeduction),
      esiEmployerContribution: round2(esiEmployerContribution),
      finalAmount: round2(finalAmount),
      bankAccountNo: e.bankDetail?.accountNumber ?? null,
      bankIfsc: e.bankDetail?.ifscCode ?? null,
      bankName: e.bankDetail?.bankName ?? null,
      remarks,
    };
  });
}

function round2(n: number) {
  return Math.round(n * 100) / 100;
}
