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
  netSalary: string;
  status: string;
  holdReason: string | null;
  employee: { employeeCode: string; firstName: string; lastName: string };
  payrollRun: { year: number; month: number; status: string };
  components: LineComponent[];
}

/**
 * The "Other Earnings" residual: the part of otherEarningsTotal that is not
 * already itemised elsewhere on the payslip.
 *
 * otherEarningsTotal (payrollCalculation.ts) = ad-hoc earnings + every "auto"
 * earning — OT, OT incentive, performance incentive, attendance bonus,
 * petrol, double machine, shift bonus, heat/night/food allowances. The three
 * that are PayrollLine columns get their own rows above, and any auto earning
 * that produced a PayrollLineComponent is listed by name; both must be
 * subtracted or they show twice.
 *
 * Which components sit inside otherEarningsTotal rather than grossEarnings
 * cannot be read off the component's own flags — NIGHT_ALLOWANCE is flagged
 * includeInGross = true yet payroll accumulates it into autoEarningsTotal.
 * So it is derived from the two figures payroll actually stored: whatever the
 * listed earning components total beyond grossEarnings is, by definition, the
 * part of them already counted in otherEarningsTotal.
 *
 * A positive result means payroll credited an auto earning that never got a
 * component row (its SalaryComponent master is missing) — exactly what the
 * catch-all row is for.
 *
 * `earningComponents` must be displayableEarningComponents(...): passing a
 * column mirror would subtract the same money twice, once here and once as its
 * own column below.
 */
/**
 * Component codes that MIRROR a PayrollLine column.
 *
 * Several figures reach the payslip by two routes: a column on PayrollLine
 * (`line.otAmount`, `line.lomAmount`, …) which is rendered by its own hardcoded
 * row, and — when the matching SalaryComponent exists — a PayrollLineComponent
 * that payroll also writes. Nothing arbitrated between them, so a company that
 * happened to have the component would see the same money on two lines and the
 * itemised earnings would overstate Total Earnings.
 *
 * The column wins. It is the value the stored totals are built from, so it is
 * the one guaranteed to reconcile; the mirroring component is suppressed here.
 * That generalises what this file already did for PF/ESI — which it did by
 * substring-matching the code and NAME for "pf"/"esi", quietly hiding
 * legitimate rows like ARREAR_PF and ARREAR_ESI too. Matching exact codes
 * fixes that as a side effect.
 *
 * Nothing changes for existing data: none of these components exist yet (see
 * COLUMN_BACKED_DO_NOT_SEED in tests/unit/string-key-consistency.test.ts, which
 * stops them being seeded). This makes the payslip correct if one ever is.
 */
const COLUMN_MIRRORED_EARNINGS = new Set([
  'PERFORMANCE_INS', // line.performanceIncentive
  'OT_PAY',          // line.otAmount
  'OT_INCENTIVE',    // line.otIncentiveAmount
]);

const COLUMN_MIRRORED_DEDUCTIONS = new Set([
  'PF',          // line.pfEmployee
  'ESI',         // line.esiEmployee
  'LOM',         // line.lomAmount
  'LWF',         // line.lwfAmount
  'HEALTH_INS',  // line.healthInsurance
  'LIC',         // line.licAmount
]);

/**
 * The earning/deduction components the payslip actually lists — everything
 * except the column mirrors above. These are also what the two residual
 * helpers must be given, so a mirrored amount is never counted as both a
 * component and a column.
 */
export function displayableEarningComponents<T extends { salaryComponent: { type: string; code: string } }>(components: T[]): T[] {
  return components.filter(
    (c) => c.salaryComponent.type === 'earning' && !COLUMN_MIRRORED_EARNINGS.has(c.salaryComponent.code)
  );
}

export function displayableDeductionComponents<T extends { salaryComponent: { type: string; code: string } }>(components: T[]): T[] {
  return components.filter(
    (c) => c.salaryComponent.type === 'deduction' && !COLUMN_MIRRORED_DEDUCTIONS.has(c.salaryComponent.code)
  );
}

export function computeOtherAutoEarnings(
  line: Pick<PayrollLineDetail, 'otherEarningsTotal' | 'performanceIncentive' | 'otAmount' | 'otIncentiveAmount' | 'grossEarnings'>,
  earningComponents: { amount: string | number }[]
): number {
  const componentEarningsTotal = earningComponents.reduce((sum, c) => sum + Number(c.amount), 0);
  const itemisedFromOtherTotal = Math.max(0, componentEarningsTotal - Number(line.grossEarnings));
  return (
    Number(line.otherEarningsTotal)
    - Number(line.performanceIncentive)
    - Number(line.otAmount)
    - Number(line.otIncentiveAmount)
    - itemisedFromOtherTotal
  );
}

/**
 * The "Other Auto Deductions" residual — the deduction-side twin of
 * computeOtherAutoEarnings, and it had the same double-counting flaw.
 *
 * otherDeductionsTotal (payrollCalculation.ts:958) =
 *   recurringDeductions + ad-hoc deductions + autoDeductionsTotal
 *
 * Every recurring deduction component is added to recurringDeductions AND
 * written as a PayrollLineComponent (payrollCalculation.ts:313-315), so it is
 * listed by name on the payslip as well as being inside otherDeductionsTotal.
 * Subtracting only the four column-backed auto deductions (LOM, LWF, health,
 * LIC) left those components counted twice — a real "Medical" (DED-2) row of
 * ₹500 showed as its own line and again inside the residual, so the itemised
 * deductions overstated the stated Total Deductions by ₹500.
 *
 * `displayedComponents` must be exactly the component rows the payslip
 * renders — i.e. excluding the PF/ESI rows, which are mirrors of the
 * pfEmployee/esiEmployee columns (their amounts match those columns to the
 * rupee) and are shown from the columns instead, never from the component.
 *
 * Defined as "stated total minus everything else displayed", so the listed
 * rows always reconcile to Total Deductions by construction.
 */
export function computeOtherAutoDeductions(
  line: Pick<PayrollLineDetail, 'otherDeductionsTotal' | 'lomAmount' | 'lwfAmount' | 'healthInsurance' | 'licAmount'>,
  displayedComponents: { amount: string | number }[]
): number {
  const displayedComponentTotal = displayedComponents.reduce((sum, c) => sum + Number(c.amount), 0);
  return (
    Number(line.otherDeductionsTotal)
    - Number(line.lomAmount)
    - Number(line.lwfAmount)
    - Number(line.healthInsurance)
    - Number(line.licAmount)
    - displayedComponentTotal
  );
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
  // Only components that do NOT mirror a column. Both the rendered rows and the
  // residual calculations work from these, so a mirror can never be counted
  // once as a component and again as a column.
  const rawEarnings = displayableEarningComponents(line.components);
  const rawDeductions = displayableDeductionComponents(line.components);

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
  // Attendance Bonus, Petrol Allowance, Double Machine Incentive and Shift
  // Incentive are NOT PayrollLine columns — they are PayrollLineComponent
  // rows (ATT_BONUS / PETROL / DM_INCENTIVE / SHIFT_BONUS), so the
  // metadata-driven loops above already render them by name. They used to be
  // pushed again from `line.<name>` here; those properties never existed on
  // the payload, so every read was `undefined` → NaN, which silently
  // suppressed the "Other Earnings" row below (NaN > 0 is false).

  // See computeOtherAutoEarnings above for why this is a residual.
  const otherAutoEarnings = computeOtherAutoEarnings(line, rawEarnings);
  if (otherAutoEarnings > 0) {
    earnings.push({ label: 'Other Earnings', amount: otherAutoEarnings, isAdhoc: false });
  }

  // rawDeductions already excludes every column mirror (PF/ESI included), so
  // this is simply what gets rendered.
  const displayedDeductionComponents = rawDeductions;

  const otherAutoDeductions = computeOtherAutoDeductions(line, displayedDeductionComponents);

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

  displayedDeductionComponents.forEach((c) => {
    deductions.push({ label: c.salaryComponent.name, amount: Number(c.amount), isAdhoc: c.isAdhoc, id: c.id });
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
