'use client';

import { useState, useEffect, useMemo } from 'react';
import { useToast } from '@/components/ui';

interface SalaryComponent {
  id: number;
  code: string;
  name: string;
  type: string;
}

interface LineComponent {
  id: number;
  amount: string;
  isAdhoc: boolean;
  salaryComponent: SalaryComponent;
}

interface LeaveBalance {
  leaveType: string;
  opening: number;
  accrued: number;
  availed: number;
  closing: number;
}

interface AttendanceSummary {
  presentDays: number;
  absentDays: number;
  leaveDays: number;
  lopDays: number;
  clDays: number;
  slDays: number;
  elDays: number;
  compOffDays: number;
  otherLeaveDays: number;
}

interface PayrollLineDetail {
  id: number;
  employeeId: number;
  employee: { employeeCode: string; firstName: string; lastName: string };
  payrollRun: { year: number; month: number };
  totalWorkingDays: number;
  payableDays: string;
  lopDays: number;
  grossEarnings: string;
  otherEarningsTotal: string;
  otAmount: string;
  otherDeductionsTotal: string;
  pfEmployee: string;
  esiEmployee: string;
  professionalTax: string;
  tds: string;
  lomAmount: string;
  lwfAmount: string;
  healthInsurance: string;
  licAmount: string;
  netSalary: string;
  components: LineComponent[];
}

interface PayrollDetailData {
  line: PayrollLineDetail;
  attendance: AttendanceSummary | null;
  leaveBalances: LeaveBalance[];
}

interface PayrollDetailDialogProps {
  runId: number;
  lineId: number;
  onClose: () => void;
}

function fmt(n: string | number) {
  const v = Number(n ?? 0);
  return v.toLocaleString('en-IN', { maximumFractionDigits: 0 });
}

export default function PayrollDetailDialog({ runId, lineId, onClose }: PayrollDetailDialogProps) {
  const toast = useToast();
  const [data, setData] = useState<PayrollDetailData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    Promise.all([
      fetch(`/api/payroll/runs/${runId}/lines/${lineId}`),
      fetch(`/api/workforce/attendance/monthly?year=2026&month=7`),
      fetch(`/api/reports/leave?year=2026&month=7`),
    ])
      .then(async ([lineRes, attRes, balRes]) => {
        if (!lineRes.ok) throw new Error('Failed to fetch payroll line');
        const line = await lineRes.json();
        const attJson = await attRes.json();
        const att = ((attJson.data ?? []) as Array<{ employeeId: number; summary?: AttendanceSummary | null }>)
          .find((r) => r.employeeId === line.employeeId);
        const balJson = await balRes.json();
        // The endpoint returns balances for several employees, so the rows
        // carry an employeeCode that LeaveBalance itself does not.
        const balances: LeaveBalance[] = ((balJson.balances ?? []) as Array<LeaveBalance & { employeeCode: string }>)
          .filter((b) => b.employeeCode === line.employee.employeeCode);
        if (!cancelled) {
          setData({ line, attendance: att?.summary ?? null, leaveBalances: balances });
        }
      })
      .catch((err) => {
        if (!cancelled) toast.error(err instanceof Error ? err.message : 'Failed to load payroll details');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => { cancelled = true; };
  }, [runId, lineId, toast]);

  // Rows always print ascending by code (falling back to label for the
  // fields below that aren't sourced from a SalaryComponent — Overtime, LOM,
  // TDS… — and so have none). A fixed order here, unlike the Salary
  // Components admin table's own toggleable code sort.
  const byCodeAsc = (a: { label: string; code?: string }, b: { label: string; code?: string }) =>
    (a.code ?? a.label).localeCompare(b.code ?? b.label);

  const earnings = useMemo(() => {
    const list: { label: string; amount: number; code?: string }[] = data?.line.components
      .filter((c) => c.salaryComponent.type === 'earning')
      .map((c) => ({ label: c.salaryComponent.name, amount: Number(c.amount), code: c.salaryComponent.code })) ?? [];
    if (Number(data?.line.otAmount ?? 0) > 0) list.push({ label: 'Overtime', amount: Number(data?.line.otAmount) });
    // ATT_BONUS / PETROL / DM_INCENTIVE / SHIFT_BONUS are component rows, so
    // the map above already covers them — these were re-pushed from
    // PayrollLine properties that do not exist.
    return list.sort(byCodeAsc);
  }, [data]);

  const deductions = useMemo(() => {
    const list: { label: string; amount: number; code?: string }[] = data?.line.components
      .filter((c) => c.salaryComponent.type === 'deduction')
      .map((c) => ({ label: c.salaryComponent.name, amount: Number(c.amount), code: c.salaryComponent.code })) ?? [];

    const has = (code: string) => data?.line.components.some((c) => c.salaryComponent.code.toUpperCase() === code);

    if (Number(data?.line.pfEmployee ?? 0) > 0 && !has('PF') && !has('PROVIDENT_FUND')) {
      list.push({ label: 'Provident Fund (PF)', amount: Number(data?.line.pfEmployee) });
    }
    if (Number(data?.line.esiEmployee ?? 0) > 0 && !has('ESI')) {
      list.push({ label: 'Employee State Insurance (ESI)', amount: Number(data?.line.esiEmployee) });
    }
    if (Number(data?.line.professionalTax ?? 0) > 0 && !has('PT') && !has('PROFESSIONAL_TAX')) {
      list.push({ label: 'Professional Tax', amount: Number(data?.line.professionalTax) });
    }
    if (Number(data?.line.tds ?? 0) > 0 && !has('TDS')) {
      list.push({ label: 'Tax Deducted at Source (TDS)', amount: Number(data?.line.tds) });
    }
    if (Number(data?.line.lomAmount ?? 0) > 0) {
      list.push({ label: 'LOM (Loss of Minutes)', amount: Number(data?.line.lomAmount) });
    }
    if (Number(data?.line.lwfAmount ?? 0) > 0) {
      list.push({ label: 'Labour Welfare Fund (LWF)', amount: Number(data?.line.lwfAmount) });
    }
    if (Number(data?.line.healthInsurance ?? 0) > 0) {
      list.push({ label: 'Health Insurance', amount: Number(data?.line.healthInsurance) });
    }
    if (Number(data?.line.licAmount ?? 0) > 0) {
      list.push({ label: 'LIC', amount: Number(data?.line.licAmount) });
    }

    // Show any remaining auto-deductions (e.g. Canteen, benefit rates) that
    // are not already displayed as explicit components or lines above.
    const displayed = list.reduce((s, r) => s + r.amount, 0);
    const pfEsiPtTds =
      Number(data?.line.pfEmployee ?? 0) +
      Number(data?.line.esiEmployee ?? 0) +
      Number(data?.line.professionalTax ?? 0) +
      Number(data?.line.tds ?? 0);
    const expectedOtherDeductions = Number(data?.line.otherDeductionsTotal ?? 0);
    const otherAuto = expectedOtherDeductions - (displayed - pfEsiPtTds);
    if (otherAuto > 0) {
      list.push({ label: 'Other Auto Deductions', amount: otherAuto });
    }

    return list.sort(byCodeAsc);
  }, [data]);

  if (loading) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ backgroundColor: 'rgba(0,0,0,0.4)' }}>
        <div className="w-full max-w-5xl rounded-xl p-6" style={{ backgroundColor: 'var(--surface)', border: '1px solid var(--border)' }}>
          <p className="text-sm" style={{ color: 'var(--foreground-muted)' }}>Loading…</p>
        </div>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ backgroundColor: 'rgba(0,0,0,0.4)' }} onClick={onClose}>
        <div className="w-full max-w-5xl rounded-xl p-6" style={{ backgroundColor: 'var(--surface)', border: '1px solid var(--border)' }} onClick={(e) => e.stopPropagation()}>
          <p className="text-sm" style={{ color: '#dc2626' }}>Failed to load payroll details</p>
          <button onClick={onClose} className="mt-4 rounded-lg border px-4 py-2 text-sm font-medium">Close</button>
        </div>
      </div>
    );
  }

  const { line } = data;
  const monthName = new Date(2000, line.payrollRun.month - 1, 1).toLocaleString('default', { month: 'long' });
  const att = data.attendance;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ backgroundColor: 'rgba(0,0,0,0.4)' }} onClick={onClose}>
      <div
        className="w-full max-w-6xl rounded-xl shadow-2xl overflow-hidden"
        style={{ backgroundColor: 'var(--surface)', border: '1px solid var(--border)', maxHeight: '90vh' }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-5 py-3 border-b" style={{ borderColor: 'var(--border)' }}>
          <div>
            <h2 className="text-base font-semibold" style={{ color: 'var(--foreground)' }}>
              Salary Details — {line.employee.employeeCode} {line.employee.firstName} {line.employee.lastName} -
            </h2>
            <p className="text-xs" style={{ color: 'var(--foreground-muted)' }}>
              {monthName} {line.payrollRun.year} · Payable {line.payableDays}/{line.totalWorkingDays} days (LOP {line.lopDays})
            </p>
          </div>
          <div className="flex items-center gap-2">
            <a
              href={`/payroll/outputs/payslip?runId=${runId}&lineId=${lineId}`}
              target="_blank"
              rel="noreferrer"
              className="text-xs font-medium hover:underline"
              style={{ color: 'var(--accent)' }}
            >
              Open payslip
            </a>
            <button onClick={onClose} className="text-lg leading-none hover:opacity-70" style={{ color: 'var(--foreground-muted)' }}>
              ×
            </button>
          </div>
        </div>

        <div className="overflow-y-auto p-5" style={{ maxHeight: 'calc(90vh - 64px)' }}>
          {att && (
            <div className="mb-4 grid grid-cols-6 gap-3 rounded-lg border p-3 text-center" style={{ borderColor: 'var(--border)' }}>
              <div><p className="text-xs" style={{ color: 'var(--foreground-muted)' }}>Present</p><p className="font-semibold tabular-nums" style={{ color: 'var(--success, #22b573)' }}>{fmt(att.presentDays)}</p></div>
              <div><p className="text-xs" style={{ color: 'var(--foreground-muted)' }}>Absent</p><p className="font-semibold tabular-nums" style={{ color: 'var(--foreground)' }}>{fmt(att.absentDays)}</p></div>
              <div><p className="text-xs" style={{ color: 'var(--foreground-muted)' }}>Leave</p><p className="font-semibold tabular-nums" style={{ color: 'var(--accent)' }}>{fmt(att.leaveDays)}</p></div>
              <div><p className="text-xs" style={{ color: 'var(--foreground-muted)' }}>CL</p><p className="font-semibold tabular-nums" style={{ color: 'var(--foreground)' }}>{fmt(att.clDays)}</p></div>
              <div><p className="text-xs" style={{ color: 'var(--foreground-muted)' }}>LOP</p><p className="font-semibold tabular-nums" style={{ color: 'var(--warning, #f0b429)' }}>{fmt(att.lopDays)}</p></div>
              <div><p className="text-xs" style={{ color: 'var(--foreground-muted)' }}>EL / SL</p><p className="font-semibold tabular-nums" style={{ color: 'var(--foreground)' }}>{fmt(att.elDays)}/{fmt(att.slDays)}</p></div>
            </div>
          )}

          <div className="grid grid-cols-3 gap-4">
            {/* Earnings */}
            <div className="rounded-lg border p-3" style={{ borderColor: 'var(--border)' }}>
              <h3 className="mb-2 text-xs font-bold uppercase tracking-wider" style={{ color: 'var(--success, #22b573)' }}>
                Total Earning Details
              </h3>
              <table className="w-full text-sm">
                <tbody>
                  {earnings.map((c, idx) => (
                    <tr key={idx}>
                      <td className="py-1" style={{ color: 'var(--foreground)' }}>{c.label}</td>
                      <td className="py-1 text-right tabular-nums" style={{ color: 'var(--success, #22b573)' }}>{fmt(c.amount)}</td>
                    </tr>
                  ))}
                  {earnings.length === 0 && (
                    <tr><td colSpan={2} style={{ color: 'var(--foreground-muted)' }}>No earning components</td></tr>
                  )}
                </tbody>
              </table>
            </div>

            {/* Deductions */}
            <div className="rounded-lg border p-3" style={{ borderColor: 'var(--border)' }}>
              <h3 className="mb-2 text-xs font-bold uppercase tracking-wider" style={{ color: 'var(--warning, #f0b429)' }}>
                Total Deduction Details
              </h3>
              <table className="w-full text-sm">
                <tbody>
                  {deductions.map((c, idx) => (
                    <tr key={idx}>
                      <td className="py-1" style={{ color: 'var(--foreground)' }}>{c.label}</td>
                      <td className="py-1 text-right tabular-nums" style={{ color: 'var(--warning, #f0b429)' }}>{fmt(c.amount)}</td>
                    </tr>
                  ))}
                  {deductions.length === 0 && (
                    <tr><td colSpan={2} style={{ color: 'var(--foreground-muted)' }}>No deduction components</td></tr>
                  )}
                </tbody>
              </table>
            </div>

            {/* Leave */}
            <div className="rounded-lg border p-3" style={{ borderColor: 'var(--border)' }}>
              <h3 className="mb-2 text-xs font-bold uppercase tracking-wider" style={{ color: 'var(--accent)' }}>
                Leave Details (Remaining)
              </h3>
              <table className="w-full text-sm">
                <thead>
                  <tr>
                    <th className="py-1 text-left text-xs font-medium" style={{ color: 'var(--foreground-muted)' }}>Type</th>
                    <th className="py-1 text-right text-xs font-medium" style={{ color: 'var(--foreground-muted)' }}>Opng</th>
                    <th className="py-1 text-right text-xs font-medium" style={{ color: 'var(--foreground-muted)' }}>Used</th>
                    <th className="py-1 text-right text-xs font-medium" style={{ color: 'var(--foreground-muted)' }}>Rem</th>
                  </tr>
                </thead>
                <tbody>
                  {data.leaveBalances.map((b, idx) => (
                    <tr key={idx}>
                      <td className="py-1" style={{ color: 'var(--foreground)' }}>{b.leaveType}</td>
                      <td className="py-1 text-right tabular-nums" style={{ color: 'var(--foreground-muted)' }}>{fmt(b.opening + b.accrued)}</td>
                      <td className="py-1 text-right tabular-nums" style={{ color: 'var(--warning, #f0b429)' }}>{fmt(b.availed)}</td>
                      <td className="py-1 text-right tabular-nums font-medium" style={{ color: 'var(--success, #22b573)' }}>{fmt(b.closing)}</td>
                    </tr>
                  ))}
                  {data.leaveBalances.length === 0 && (
                    <tr><td colSpan={4} style={{ color: 'var(--foreground-muted)' }}>No leave balances</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

          <div className="mt-4 grid grid-cols-4 gap-4 rounded-lg border p-4" style={{ borderColor: 'var(--border)' }}>
            <div>
              <p className="text-xs" style={{ color: 'var(--foreground-muted)' }}>Gross Earnings</p>
              <p className="text-lg font-semibold tabular-nums" style={{ color: 'var(--success, #22b573)' }}>+{fmt(line.grossEarnings)}</p>
            </div>
            <div>
              <p className="text-xs" style={{ color: 'var(--foreground-muted)' }}>Other Earnings</p>
              <p className="text-lg font-semibold tabular-nums" style={{ color: 'var(--success, #22b573)' }}>+{fmt(line.otherEarningsTotal)}</p>
            </div>
            <div>
              <p className="text-xs" style={{ color: 'var(--foreground-muted)' }}>Total Deductions</p>
              <p className="text-lg font-semibold tabular-nums" style={{ color: 'var(--warning, #f0b429)' }}>-{fmt(Number(line.pfEmployee) + Number(line.esiEmployee) + Number(line.professionalTax) + Number(line.tds) + Number(line.otherDeductionsTotal))}</p>
            </div>
            <div>
              <p className="text-xs" style={{ color: 'var(--foreground-muted)' }}>Net Salary</p>
              <p className="text-lg font-semibold tabular-nums" style={{ color: 'var(--foreground)' }}>{fmt(line.netSalary)}</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
