/**
 * Shared payslip rendering — itemized earnings/deductions grouped by Gross
 * tier, statutory totals, net salary. Used by the HR payslip page
 * (/payroll/outputs/payslip, with ad-hoc add/remove) and the ESS payslip
 * page (/ess/payslip, read-only) so the money-display logic — which has
 * already had real bugs fixed in it — lives in exactly one place.
 */

'use client';

import type { ReactNode } from 'react';

export interface LineComponent {
  id: number;
  amount: string;
  isAdhoc: boolean;
  salaryComponent: { code: string; name: string; type: string; grossTier: string; includeInGross: boolean };
}

export interface PayrollLineDetail {
  id: number;
  totalWorkingDays: number;
  payableDays: string;
  lopDays: number;
  grossEarnings: string;
  fixedGross: string;
  additionalGross: string;
  performanceIncentive: string;
  otAmount: string;
  otIncentiveAmount: string;
  pfEmployee: string;
  pfEmployer: string;
  epsEmployer: string;
  esiEmployee: string;
  esiEmployer: string;
  professionalTax: string;
  tds: string;
  otherEarningsTotal: string;
  otherDeductionsTotal: string;
  lomAmount: string;
  lwfAmount: string;
  healthInsurance: string;
  licAmount: string;
  attendanceBonus: string;
  petrolAllowance: string;
  doubleMachineIncentive: string;
  shiftIncentive: string;
  netSalary: string;
  status: string;
  holdReason: string | null;
  employee: { employeeCode: string; firstName: string; lastName: string };
  payrollRun: { year: number; month: number; status: string };
  components: LineComponent[];
}

export function fmt(n: string | number) {
  const v = Number(n ?? 0);
  return v.toLocaleString('en-IN');
}

export function PayslipView({
  line,
  canEdit = false,
  onRemoveAdhoc,
  headerActions,
}: {
  line: PayrollLineDetail;
  /** Show the × remove button on ad-hoc rows. Only meaningful with onRemoveAdhoc. */
  canEdit?: boolean;
  onRemoveAdhoc?: (componentRowId: number) => void;
  /** Extra buttons rendered next to Print, e.g. "+ Add Earning/Deduction" on the HR page. */
  headerActions?: ReactNode;
}) {
  const rawEarnings = line.components.filter((c) => c.salaryComponent.type === 'earning');
  const rawDeductions = line.components.filter((c) => c.salaryComponent.type === 'deduction');

  // Earnings rows (+ green) — grouped by Gross tier for subtotal display.
  // Driven by each component's own grossTier/includeInGross metadata (set
  // server-side in payrollCalculation.ts) rather than a hardcoded component
  // code list, so every earning row is covered and a newly added component
  // never silently falls through.
  const fixedGrossEarn = rawEarnings.filter((c) => c.salaryComponent.includeInGross !== false && c.salaryComponent.grossTier === 'FIXED');
  const additionalGrossEarn = rawEarnings.filter((c) => c.salaryComponent.includeInGross !== false && c.salaryComponent.grossTier !== 'FIXED');
  const ctcOnlyEarn = rawEarnings.filter((c) => c.salaryComponent.includeInGross === false);

  type EarnRow = { label: string; amount: number; isAdhoc: boolean; id?: number; isSubtotal?: boolean; isGross?: boolean };
  const earnings: EarnRow[] = [];

  fixedGrossEarn.forEach((c) => earnings.push({ label: c.salaryComponent.name, amount: Number(c.amount), isAdhoc: c.isAdhoc, id: c.id }));
  if (Number(line.fixedGross) > 0) {
    earnings.push({ label: 'Fixed Gross', amount: Number(line.fixedGross), isAdhoc: false, isSubtotal: true });
  }

  additionalGrossEarn.forEach((c) => earnings.push({ label: c.salaryComponent.name, amount: Number(c.amount), isAdhoc: c.isAdhoc, id: c.id }));
  if (Number(line.additionalGross) > 0) {
    earnings.push({ label: 'Additional', amount: Number(line.additionalGross), isAdhoc: false, isSubtotal: true });
  }

  if (Number(line.grossEarnings) > 0 && (Number(line.fixedGross) > 0 || Number(line.additionalGross) > 0)) {
    earnings.push({ label: 'Gross Salary', amount: Number(line.grossEarnings), isAdhoc: false, isGross: true });
  }

  ctcOnlyEarn.forEach((c) => earnings.push({ label: c.salaryComponent.name, amount: Number(c.amount), isAdhoc: c.isAdhoc, id: c.id }));

  if (Number(line.performanceIncentive) > 0) earnings.push({ label: 'Performance Incentive (PMS)', amount: Number(line.performanceIncentive), isAdhoc: false });
  if (Number(line.otAmount) > 0) earnings.push({ label: 'Overtime', amount: Number(line.otAmount), isAdhoc: false });
  if (Number(line.otIncentiveAmount) > 0) earnings.push({ label: 'OT Incentive Bonus', amount: Number(line.otIncentiveAmount), isAdhoc: false });
  if (Number(line.attendanceBonus) > 0) earnings.push({ label: 'Attendance Bonus', amount: Number(line.attendanceBonus), isAdhoc: false });
  if (Number(line.petrolAllowance) > 0) earnings.push({ label: 'Petrol Allowance', amount: Number(line.petrolAllowance), isAdhoc: false });
  if (Number(line.doubleMachineIncentive) > 0) earnings.push({ label: 'Double Machine Incentive', amount: Number(line.doubleMachineIncentive), isAdhoc: false });
  if (Number(line.shiftIncentive) > 0) earnings.push({ label: 'Shift Incentive', amount: Number(line.shiftIncentive), isAdhoc: false });

  const otherAutoEarnings = Number(line.otherEarningsTotal) - Number(line.performanceIncentive) - Number(line.otAmount) - Number(line.otIncentiveAmount) - Number(line.attendanceBonus) - Number(line.petrolAllowance) - Number(line.doubleMachineIncentive) - Number(line.shiftIncentive);
  if (otherAutoEarnings > 0) {
    earnings.push({ label: 'Other Earnings', amount: otherAutoEarnings, isAdhoc: false });
  }

  const otherAutoDeductions =
    Number(line.otherDeductionsTotal) -
    Number(line.lomAmount) -
    Number(line.lwfAmount) -
    Number(line.healthInsurance) -
    Number(line.licAmount);

  const deductions: { label: string; amount: number; isAdhoc: boolean; id?: number }[] = [
    { label: 'Provident Fund (PF)', amount: Number(line.pfEmployee), isAdhoc: false },
    { label: 'Employee State Insurance (ESI)', amount: Number(line.esiEmployee), isAdhoc: false },
    { label: 'Professional Tax', amount: Number(line.professionalTax), isAdhoc: false },
    { label: 'Tax Deducted at Source (TDS)', amount: Number(line.tds), isAdhoc: false },
    { label: 'LOM (Loss of Minutes)', amount: Number(line.lomAmount), isAdhoc: false },
    { label: 'Labour Welfare Fund (LWF)', amount: Number(line.lwfAmount), isAdhoc: false },
    { label: 'Health Insurance', amount: Number(line.healthInsurance), isAdhoc: false },
    { label: 'LIC', amount: Number(line.licAmount), isAdhoc: false },
    ...(otherAutoDeductions > 0 ? [{ label: 'Other Auto Deductions', amount: otherAutoDeductions, isAdhoc: false }] : []),
  ];

  rawDeductions.forEach((c) => {
    const isPf = c.salaryComponent.code.toLowerCase().includes('pf') || c.salaryComponent.name.toLowerCase().includes('pf');
    const isEsi = c.salaryComponent.code.toLowerCase().includes('esi') || c.salaryComponent.name.toLowerCase().includes('esi');
    if (!isPf && !isEsi) {
      deductions.push({ label: c.salaryComponent.name, amount: Number(c.amount), isAdhoc: c.isAdhoc, id: c.id });
    }
  });

  // Use the actual stored totals (not sum of displayed rows) so the
  // sub-values always reconcile to the net salary exactly.
  const totalEarnings = Number(line.grossEarnings) + Number(line.otherEarningsTotal);
  const totalDeductions = Number(line.pfEmployee) + Number(line.esiEmployee) + Number(line.professionalTax) + Number(line.tds) + Number(line.otherDeductionsTotal);
  const net = Number(line.netSalary);

  return (
    <div className="mx-auto max-w-2xl space-y-4">
      <div className="flex items-center justify-between print:hidden">
        <h1 className="text-xl font-semibold" style={{ color: 'var(--foreground)' }}>Payslip</h1>
        <div className="flex gap-2">
          {headerActions}
          <button
            onClick={() => window.print()}
            className="rounded-lg px-3 py-2 text-sm font-medium text-white"
            style={{ backgroundColor: 'var(--accent)' }}
          >
            Print
          </button>
        </div>
      </div>

      <div className="rounded-lg border p-5" style={{ borderColor: 'var(--border)', backgroundColor: 'var(--surface)' }}>
        <div className="mb-4 flex items-center justify-between">
          <div>
            <p className="text-sm font-semibold" style={{ color: 'var(--foreground)' }}>
              {line.employee.employeeCode} — {line.employee.firstName} {line.employee.lastName}
            </p>
            <p className="text-xs" style={{ color: 'var(--foreground-muted)' }}>
              {new Date(2000, line.payrollRun.month - 1, 1).toLocaleString('default', { month: 'long' })} {line.payrollRun.year} · Payable {line.payableDays}/{line.totalWorkingDays} days (LOP {line.lopDays})
            </p>
          </div>
          {line.status === 'HOLD' && (
            <span className="rounded-full px-2 py-0.5 text-xs font-medium" style={{ backgroundColor: '#fee2e2', color: '#991b1b' }}>
              HOLD — {line.holdReason}
            </span>
          )}
        </div>

        <div className="grid grid-cols-2 gap-6">
          <div>
            <h2 className="mb-2 text-xs font-bold uppercase tracking-wider" style={{ color: 'var(--success, #22b573)' }}>Earnings</h2>
            <table className="w-full text-sm">
              <tbody>
                {earnings.map((c, idx) => (
                  <tr key={`e-${idx}`} style={c.isGross ? { borderTop: '2px solid var(--border)', borderBottom: '1px solid var(--border)' } : c.isSubtotal ? { borderTop: '1px solid var(--border)' } : undefined}>
                    <td className="py-1" style={{ color: 'var(--foreground)', fontWeight: c.isSubtotal || c.isGross ? 600 : 400, paddingLeft: c.isSubtotal ? '0.5rem' : 0 }}>
                      {c.label}
                      {c.isAdhoc && <span className="ml-1 text-xs" style={{ color: 'var(--foreground-muted)' }}>(ad-hoc)</span>}
                    </td>
                    <td className="py-1 pr-1 text-right" style={{ color: 'var(--success, #22b573)', fontWeight: c.isSubtotal || c.isGross ? 600 : 500 }}>
                      +{fmt(c.amount)}
                    </td>
                    <td className="py-1 pl-1 text-right print:hidden">
                      {canEdit && c.isAdhoc && c.id && onRemoveAdhoc && (
                        <button onClick={() => onRemoveAdhoc(c.id!)} className="text-xs hover:underline" style={{ color: '#991b1b' }}>×</button>
                      )}
                    </td>
                  </tr>
                ))}
                <tr style={{ borderTop: '1px solid var(--border)' }}>
                  <td className="py-1.5 text-xs font-semibold" style={{ color: 'var(--foreground)' }}>Total Earnings</td>
                  <td className="py-1.5 pr-1 text-right font-semibold" style={{ color: 'var(--success, #22b573)' }}>+{fmt(totalEarnings)}</td>
                  <td />
                </tr>
              </tbody>
            </table>
          </div>

          <div>
            <h2 className="mb-2 text-xs font-bold uppercase tracking-wider" style={{ color: 'var(--warning, #f0b429)' }}>Deductions</h2>
            <table className="w-full text-sm">
              <tbody>
                {deductions.map((c, idx) => (
                  <tr key={`d-${idx}`}>
                    <td className="py-1" style={{ color: 'var(--foreground)', opacity: c.amount > 0 ? 1 : 0.5 }}>
                      {c.label}
                      {c.isAdhoc && <span className="ml-1 text-xs" style={{ color: 'var(--foreground-muted)' }}>(ad-hoc)</span>}
                    </td>
                    <td className="py-1 pr-1 text-right" style={{ color: c.amount > 0 ? 'var(--warning, #f0b429)' : 'var(--foreground-muted)', fontWeight: c.amount > 0 ? 500 : 400 }}>
                      {c.amount > 0 ? `-${fmt(c.amount)}` : '—'}
                    </td>
                    <td className="py-1 pl-1 text-right print:hidden">
                      {canEdit && c.isAdhoc && c.id && c.amount > 0 && onRemoveAdhoc && (
                        <button onClick={() => onRemoveAdhoc(c.id!)} className="text-xs hover:underline" style={{ color: '#991b1b' }}>×</button>
                      )}
                    </td>
                  </tr>
                ))}
                <tr style={{ borderTop: '1px solid var(--border)' }}>
                  <td className="py-1.5 text-xs font-semibold" style={{ color: 'var(--foreground)' }}>Total Deductions</td>
                  <td className="py-1.5 pr-1 text-right font-semibold" style={{ color: 'var(--warning, #f0b429)' }}>-{fmt(totalDeductions)}</td>
                  <td />
                </tr>
              </tbody>
            </table>
          </div>
        </div>

        <div className="mt-5 flex items-center justify-between rounded-lg px-4 py-3" style={{ backgroundColor: 'var(--surface-hover)' }}>
          <div className="space-y-1">
            <p className="text-xs" style={{ color: 'var(--foreground-muted)' }}>{fmt(totalEarnings)} − {fmt(totalDeductions)}</p>
            <span className="text-sm font-semibold" style={{ color: 'var(--foreground)' }}>Net Salary</span>
          </div>
          <span className="text-lg font-bold" style={{ color: 'var(--foreground)' }}>₹{fmt(net)}</span>
        </div>
      </div>
    </div>
  );
}
