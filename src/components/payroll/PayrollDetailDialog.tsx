'use client';

import { useState, useEffect, useMemo } from 'react';

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
  attendanceBonus: string;
  petrolAllowance: string;
  doubleMachineIncentive: string;
  shiftIncentive: string;
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
  const [data, setData] = useState<PayrollDetailData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    Promise.all([
      fetch(`/api/payroll/runs/${runId}/lines/${lineId}`),
      fetch(`/api/reports/leave?year=${new Date().getFullYear()}&month=${new Date().getMonth() + 1}`),
    ])
      .then(async ([lineRes, balRes]) => {
        if (!lineRes.ok) throw new Error('Failed to fetch payroll line');
        const line = await lineRes.json();
        const balJson = await balRes.json();
        const balances: LeaveBalance[] = (balJson.balances ?? []).filter((b: any) => b.employeeCode === line.employee.employeeCode);
        if (!cancelled) {
          setData({ line, leaveBalances: balances });
        }
      })
      .catch((err) => {
        if (!cancelled) setError(err.message);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => { cancelled = true; };
  }, [runId, lineId]);

  const earnings = useMemo(() => {
    const list = data?.line.components
      .filter((c) => c.salaryComponent.type === 'earning')
      .map((c) => ({ label: c.salaryComponent.name, amount: Number(c.amount) })) ?? [];
    if (Number(data?.line.otAmount ?? 0) > 0) list.push({ label: 'Overtime', amount: Number(data?.line.otAmount) });
    if (Number(data?.line.attendanceBonus ?? 0) > 0) list.push({ label: 'Attendance Bonus', amount: Number(data?.line.attendanceBonus) });
    if (Number(data?.line.petrolAllowance ?? 0) > 0) list.push({ label: 'Petrol Allowance', amount: Number(data?.line.petrolAllowance) });
    if (Number(data?.line.doubleMachineIncentive ?? 0) > 0) list.push({ label: 'Double Machine Incentive', amount: Number(data?.line.doubleMachineIncentive) });
    if (Number(data?.line.shiftIncentive ?? 0) > 0) list.push({ label: 'Shift Incentive', amount: Number(data?.line.shiftIncentive) });
    return list;
  }, [data]);

  const deductions = useMemo(() => {
    const list = data?.line.components
      .filter((c) => c.salaryComponent.type === 'deduction')
      .map((c) => ({ label: c.salaryComponent.name, amount: Number(c.amount) })) ?? [];
    if (Number(data?.line.pfEmployee ?? 0) > 0) list.push({ label: 'Provident Fund (PF)', amount: Number(data?.line.pfEmployee) });
    if (Number(data?.line.esiEmployee ?? 0) > 0) list.push({ label: 'Employee State Insurance (ESI)', amount: Number(data?.line.esiEmployee) });
    if (Number(data?.line.professionalTax ?? 0) > 0) list.push({ label: 'Professional Tax', amount: Number(data?.line.professionalTax) });
    if (Number(data?.line.tds ?? 0) > 0) list.push({ label: 'Tax Deducted at Source (TDS)', amount: Number(data?.line.tds) });
    if (Number(data?.line.lomAmount ?? 0) > 0) list.push({ label: 'LOM (Loss of Minutes)', amount: Number(data?.line.lomAmount) });
    if (Number(data?.line.lwfAmount ?? 0) > 0) list.push({ label: 'Labour Welfare Fund (LWF)', amount: Number(data?.line.lwfAmount) });
    if (Number(data?.line.healthInsurance ?? 0) > 0) list.push({ label: 'Health Insurance', amount: Number(data?.line.healthInsurance) });
    if (Number(data?.line.licAmount ?? 0) > 0) list.push({ label: 'LIC', amount: Number(data?.line.licAmount) });
    return list;
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

  if (error || !data) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ backgroundColor: 'rgba(0,0,0,0.4)' }} onClick={onClose}>
        <div className="w-full max-w-5xl rounded-xl p-6" style={{ backgroundColor: 'var(--surface)', border: '1px solid var(--border)' }} onClick={(e) => e.stopPropagation()}>
          <p className="text-sm" style={{ color: '#dc2626' }}>{error ?? 'No data'}</p>
          <button onClick={onClose} className="mt-4 rounded-lg border px-4 py-2 text-sm font-medium">Close</button>
        </div>
      </div>
    );
  }

  const { line } = data;
  const monthName = new Date(2000, line.payrollRun.month - 1, 1).toLocaleString('default', { month: 'long' });

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
                Leave Details
              </h3>
              <table className="w-full text-sm">
                <tbody>
                  {data.leaveBalances.map((b, idx) => (
                    <tr key={idx}>
                      <td className="py-1" style={{ color: 'var(--foreground)' }}>{b.leaveType}</td>
                      <td className="py-1 text-right tabular-nums" style={{ color: 'var(--foreground-muted)' }}>{fmt(b.closing)}</td>
                    </tr>
                  ))}
                  {data.leaveBalances.length === 0 && (
                    <tr><td colSpan={2} style={{ color: 'var(--foreground-muted)' }}>No leave balances</td></tr>
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
