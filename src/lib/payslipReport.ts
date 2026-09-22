/**
 * Payslip Report (Reports > Payroll > Payslip) — the "Time Card / Salary
 * Slip (FORM-25B)" statutory format. Read-only, sourced from an already
 * calculated PayrollLine for the given employee/month; never recomputes
 * payroll itself.
 */

import { prisma } from '@/lib/prisma';
import { decryptField } from '@/lib/crypto';

export interface PayslipLine { name: string; amount: number; code?: string }

export interface PayslipData {
  companyName: string;
  companyAddress: string | null;
  factoryRegNo: string | null;
  monthLabel: string;
  employeeCode: string;
  employeeName: string;
  pfNumber: string | null;
  esiNumber: string | null;
  uanNumber: string | null;
  panNumber: string | null;
  fatherName: string | null;
  designation: string | null;
  department: string | null;
  dateOfJoining: string | null;
  bankAccountNo: string | null;
  nodPayable: number;
  nodWorking: number;
  lopDays: number;
  earnings: PayslipLine[];
  deductions: PayslipLine[];
  totalEarnings: number;
  totalDeductions: number;
  netPay: number;
}

const MONTH_NAMES = ['', 'January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

export interface PayslipSummaryRow {
  employeeId: number;
  employeeCode: string;
  employeeName: string;
  department: string | null;
  designation: string | null;
  netPay: number | null;
  hasPayslip: boolean;
}

function displayCode(emp: { employeeCode: string; oldEmployeeCode: string | null }) {
  return emp.oldEmployeeCode?.trim() || emp.employeeCode;
}

// List for the Payslip Report table — every active employee for the period,
// with net pay when a payroll line exists so the row's PDF icon can be
// disabled otherwise (nothing to download).
export async function listPayslipSummaries(companyId: number, year: number, month: number): Promise<PayslipSummaryRow[]> {
  const [employees, payrollRun] = await Promise.all([
    prisma.employee.findMany({
      where: { companyId, deletedAt: null, isActive: true },
      select: {
        id: true,
        employeeCode: true,
        oldEmployeeCode: true,
        firstName: true,
        lastName: true,
        jobInfos: {
          where: { effectiveTo: null },
          take: 1,
          select: { department: { select: { name: true } }, designation: { select: { name: true } } },
        },
      },
      orderBy: [{ firstName: 'asc' }],
    }),
    prisma.payrollRun.findFirst({ where: { companyId, year, month } }),
  ]);

  const lines = payrollRun
    ? await prisma.payrollLine.findMany({
        where: { payrollRunId: payrollRun.id, employeeId: { in: employees.map((e) => e.id) } },
        select: { employeeId: true, netSalary: true },
      })
    : [];
  const netByEmp = new Map(lines.map((l) => [l.employeeId, Number(l.netSalary)]));

  return employees.map((e) => ({
    employeeId: e.id,
    employeeCode: displayCode(e),
    employeeName: `${e.firstName} ${e.lastName}`.trim(),
    department: e.jobInfos[0]?.department?.name ?? null,
    designation: e.jobInfos[0]?.designation?.name ?? null,
    netPay: netByEmp.get(e.id) ?? null,
    hasPayslip: netByEmp.has(e.id),
  }));
}

export async function getPayslipData(companyId: number, year: number, month: number, employeeId: number): Promise<PayslipData | null> {
  const company = await prisma.company.findUnique({ where: { id: companyId }, select: { name: true, address: true, factoryRegNo: true } });
  if (!company) return null;

  const payrollRun = await prisma.payrollRun.findFirst({ where: { companyId, year, month } });
  if (!payrollRun) return null;

  const line = await prisma.payrollLine.findUnique({
    where: { payrollRunId_employeeId: { payrollRunId: payrollRun.id, employeeId } },
    include: { components: { include: { salaryComponent: { select: { code: true, name: true, type: true, grossTier: true, includeInGross: true } } } } },
  });
  if (!line) return null;

  const employee = await prisma.employee.findUnique({
    where: { id: employeeId },
    select: {
      employeeCode: true,
      oldEmployeeCode: true,
      firstName: true,
      lastName: true,
      kyc: { select: { pfNumber: true, uanNumber: true, esiNumber: true, panNumberEnc: true } },
      bankDetail: { select: { accountNumber: true } },
      dependents: { where: { relationship: 'father' }, take: 1, select: { name: true } },
      jobInfos: {
        where: { effectiveTo: null },
        take: 1,
        select: {
          joinDate: true,
          designation: { select: { name: true } },
          department: { select: { name: true } },
        },
      },
    },
  });
  if (!employee) return null;

  const jobInfo = employee.jobInfos[0];
  const displayCode = employee.oldEmployeeCode?.trim() || employee.employeeCode;

  // Same construction as the already-trusted PayrollDetailDialog
  // (src/components/payroll/PayrollDetailDialog.tsx — the "Salary Details"
  // panel shown from Employee Details) so this PDF always agrees with what
  // that panel already shows. Component rows (Basic/HRA/Conv.Allow/Night
  // Allowance/…) are only part of the story — Overtime, LOM, Health
  // Insurance etc. live as their own PayrollLine fields, never as
  // PayrollLineComponent rows. The earlier bug here was dropping those
  // fields entirely, so the payslip's own printed Total never matched its
  // own printed Net Pay.
  const earnings: PayslipLine[] = line.components
    .filter((c) => c.salaryComponent.type === 'earning')
    .map((c) => ({ name: c.salaryComponent.name, amount: Number(c.amount), code: c.salaryComponent.code }));
  if (Number(line.performanceIncentive) > 0) earnings.push({ name: 'Performance Incentive (PMS)', amount: Number(line.performanceIncentive) });
  if (Number(line.otAmount) > 0) earnings.push({ name: 'Overtime', amount: Number(line.otAmount) });
  if (Number(line.otIncentiveAmount) > 0) earnings.push({ name: 'OT Incentive Bonus', amount: Number(line.otIncentiveAmount) });

  const hasCode = (code: string) => line.components.some((c) => c.salaryComponent.code.toUpperCase() === code);
  const deductions: PayslipLine[] = line.components
    .filter((c) => c.salaryComponent.type === 'deduction')
    .map((c) => ({ name: c.salaryComponent.name, amount: Number(c.amount), code: c.salaryComponent.code }));
  if (Number(line.pfEmployee) > 0 && !hasCode('PF') && !hasCode('PROVIDENT_FUND')) {
    deductions.push({ name: 'Provident Fund (PF)', amount: Number(line.pfEmployee) });
  }
  if (Number(line.esiEmployee) > 0 && !hasCode('ESI')) {
    deductions.push({ name: 'Employee State Insurance (ESI)', amount: Number(line.esiEmployee) });
  }
  if (Number(line.professionalTax) > 0 && !hasCode('PT') && !hasCode('PROFESSIONAL_TAX')) {
    deductions.push({ name: 'Professional Tax', amount: Number(line.professionalTax) });
  }
  if (Number(line.tds) > 0 && !hasCode('TDS')) {
    deductions.push({ name: 'Tax Deducted at Source (TDS)', amount: Number(line.tds) });
  }
  if (Number(line.lomAmount) > 0) deductions.push({ name: 'LOM (Loss of Minutes)', amount: Number(line.lomAmount) });
  if (Number(line.lwfAmount) > 0) deductions.push({ name: 'Labour Welfare Fund (LWF)', amount: Number(line.lwfAmount) });
  if (Number(line.healthInsurance) > 0) deductions.push({ name: 'Health Insurance', amount: Number(line.healthInsurance) });
  if (Number(line.licAmount) > 0) deductions.push({ name: 'LIC', amount: Number(line.licAmount) });

  // Whatever of otherDeductionsTotal isn't already accounted for by what's
  // displayed above (minus the statutory fields, which aren't part of
  // otherDeductionsTotal) gets one labeled catch-all row — computed from
  // what's actually displayed, not a fixed field list, so it can never
  // double-count a component that happens to also be one of the statutory
  // fields.
  const deductionsDisplayed = deductions.reduce((s, d) => s + d.amount, 0);
  const pfEsiPtTds = Number(line.pfEmployee) + Number(line.esiEmployee) + Number(line.professionalTax) + Number(line.tds);
  const otherAutoDeductions = Number(line.otherDeductionsTotal) - (deductionsDisplayed - pfEsiPtTds);
  if (otherAutoDeductions > 0.01) deductions.push({ name: 'Other Auto Deductions', amount: otherAutoDeductions });

  // Authoritative totals (not a sum of the displayed rows) so Earnings −
  // Deductions always reconciles to Net Pay exactly, same as
  // payrollCalculation.ts itself guarantees for netSalary.
  const totalEarnings = Number(line.grossEarnings) + Number(line.otherEarningsTotal);
  const totalDeductions = pfEsiPtTds + Number(line.otherDeductionsTotal);

  // Payslip rows always print ascending by code (falling back to name for
  // the handful of fields — Overtime, LOM, TDS… — that aren't sourced from
  // a SalaryComponent and so have none) — a fixed print order, unlike the
  // Salary Components admin table where the code sort is just a view toggle.
  const byCodeAsc = (a: PayslipLine, b: PayslipLine) => (a.code ?? a.name).localeCompare(b.code ?? b.name);
  earnings.sort(byCodeAsc);
  deductions.sort(byCodeAsc);

  return {
    companyName: company.name,
    companyAddress: company.address,
    factoryRegNo: company.factoryRegNo,
    monthLabel: `${MONTH_NAMES[month]}/${year}`,
    employeeCode: displayCode,
    employeeName: `${employee.firstName} ${employee.lastName}`.trim(),
    pfNumber: employee.kyc?.pfNumber ?? null,
    esiNumber: employee.kyc?.esiNumber ?? null,
    uanNumber: employee.kyc?.uanNumber ?? null,
    panNumber: employee.kyc?.panNumberEnc ? decryptField(employee.kyc.panNumberEnc) : null,
    fatherName: employee.dependents[0]?.name ?? null,
    designation: jobInfo?.designation?.name ?? null,
    department: jobInfo?.department?.name ?? null,
    dateOfJoining: jobInfo?.joinDate ? jobInfo.joinDate.toISOString().slice(0, 10) : null,
    bankAccountNo: employee.bankDetail?.accountNumber ?? null,
    nodPayable: Number(line.payableDays),
    nodWorking: line.totalWorkingDays,
    lopDays: line.lopDays,
    earnings,
    deductions,
    totalEarnings: Math.round(totalEarnings * 100) / 100,
    totalDeductions: Math.round(totalDeductions * 100) / 100,
    netPay: Number(line.netSalary),
  };
}
