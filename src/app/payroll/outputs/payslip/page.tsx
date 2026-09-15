/**
 * Payslip — itemized view of one PayrollLine (earnings/deductions +
 * statutory totals + net salary), plus ad-hoc earning/deduction management
 * while the run is still editable. On-screen + browser-native print; no PDF
 * pipeline in Phase 1.
 */

'use client';

import { useState, useEffect, useCallback, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { FormModal, type FieldDef } from '@/components/ui';

interface ComponentOption {
  id: number;
  code: string;
  name: string;
  type: string;
}

interface LineComponent {
  id: number;
  amount: string;
  isAdhoc: boolean;
  salaryComponent: { code: string; name: string; type: string };
}

interface PayrollLineDetail {
  id: number;
  totalWorkingDays: number;
  payableDays: string;
  lopDays: number;
  grossEarnings: string;
  otAmount: string;
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

function fmt(n: string | number) {
  const v = Number(n ?? 0);
  return v.toLocaleString('en-IN');
}

function PayslipContent() {
  const searchParams = useSearchParams();
  const runId = searchParams.get('runId');
  const lineId = searchParams.get('lineId');

  const [line, setLine] = useState<PayrollLineDetail | null>(null);
  const [components, setComponents] = useState<ComponentOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [modalOpen, setModalOpen] = useState(false);

  useEffect(() => {
    fetch('/api/masters/salary-components?limit=100')
      .then((r) => r.json())
      .then((json: { data: ComponentOption[] }) => setComponents(json.data ?? []))
      .catch(() => {});
  }, []);

  const fetchLine = useCallback(async () => {
    if (!runId || !lineId) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/payroll/runs/${runId}/lines/${lineId}`);
      if (!res.ok) throw new Error('Failed to fetch payslip');
      setLine(await res.json());
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  }, [runId, lineId]);

  useEffect(() => {
    fetchLine();
  }, [fetchLine]);

  const handleRemoveAdhoc = async (componentRowId: number) => {
    if (!runId || !lineId) return;
    const res = await fetch(`/api/payroll/runs/${runId}/lines/${lineId}/adhoc?componentId=${componentRowId}`, { method: 'DELETE' });
    if (!res.ok) {
      const contentType = res.headers.get('content-type') ?? '';
      let err: { error?: string } = { error: 'Remove failed' };
      if (contentType.includes('application/json')) {
        try {
          err = await res.json();
        } catch {
          err = { error: `Remove failed (${res.status})` };
        }
      } else {
        err = { error: `Remove failed (${res.status})` };
      }
      setError(err.error ?? 'Remove failed');
      return;
    }
    fetchLine();
  };

  const adhocFields: FieldDef[] = [
    {
      name: 'salaryComponentId',
      label: 'Component',
      type: 'select',
      required: true,
      options: components
        .filter((c) => c.type === 'earning' || c.type === 'deduction')
        .map((c) => ({ label: `${c.name} (${c.type})`, value: c.id })),
    },
    { name: 'amount', label: 'Amount', type: 'number', required: true },
  ];

  if (!runId || !lineId) {
    return <p className="text-sm" style={{ color: 'var(--foreground-muted)' }}>Open a payslip from the Salary Processing grid.</p>;
  }
  if (loading) {
    return <p className="text-sm" style={{ color: 'var(--foreground-muted)' }}>Loading...</p>;
  }
  if (!line) {
    return <p className="text-sm" style={{ color: 'var(--foreground-muted)' }}>{error ?? 'Not found'}</p>;
  }

  const editable = line.payrollRun.status === 'DRAFT' || line.payrollRun.status === 'CALCULATED';
  const rawEarnings = line.components.filter((c) => c.salaryComponent.type === 'earning');
  const rawDeductions = line.components.filter((c) => c.salaryComponent.type === 'deduction');

  // Earnings rows (+ green)
  const earnings: { label: string; amount: number; isAdhoc: boolean; id?: number }[] = rawEarnings.map((c) => ({
    label: c.salaryComponent.name,
    amount: Number(c.amount),
    isAdhoc: c.isAdhoc,
    id: c.id,
  }));

  // Auto-earnings (not already in components)
  if (Number(line.otAmount) > 0) earnings.push({ label: 'Overtime', amount: Number(line.otAmount), isAdhoc: false });
  if (Number(line.attendanceBonus) > 0) earnings.push({ label: 'Attendance Bonus', amount: Number(line.attendanceBonus), isAdhoc: false });
  if (Number(line.petrolAllowance) > 0) earnings.push({ label: 'Petrol Allowance', amount: Number(line.petrolAllowance), isAdhoc: false });
  if (Number(line.doubleMachineIncentive) > 0) earnings.push({ label: 'Double Machine Incentive', amount: Number(line.doubleMachineIncentive), isAdhoc: false });
  if (Number(line.shiftIncentive) > 0) earnings.push({ label: 'Shift Incentive', amount: Number(line.shiftIncentive), isAdhoc: false });

  // Catch-all for other earnings stored in otherEarningsTotal but not
  // already shown as a component or auto-earning line above.
  const displayedEarnings = earnings.reduce((s, r) => s + r.amount, 0);
  const otherAutoEarnings = Number(line.otherEarningsTotal) - Number(line.otAmount) - Number(line.attendanceBonus) - Number(line.petrolAllowance) - Number(line.doubleMachineIncentive) - Number(line.shiftIncentive);
  // Subtract earning components that are NOT part of grossEarnings (e.g. NIGHT_ALLOWANCE)
  const nonGrossEarningComponents = rawEarnings
    .filter((c) => !['BASIC', 'HRA', 'CONVEYANCE', 'DA', 'SPECIAL_ALLOWANCE', 'BASIC_HRA'].includes(c.salaryComponent.code.toUpperCase()))
    .reduce((s, c) => s + Number(c.amount), 0);
  const otherEarningsCatchall = otherAutoEarnings - nonGrossEarningComponents;
  if (otherEarningsCatchall > 0) {
    earnings.push({ label: 'Other Earnings', amount: otherEarningsCatchall, isAdhoc: false });
  }

  // Standard statutory + auto deductions (always show for PDF-like overview)
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

  // Add custom/ad-hoc deduction components that are not already in the standard list
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
        <h1 className="text-xl font-semibold" style={{ color: 'var(--foreground)' }}>
          Payslip
        </h1>
        <div className="flex gap-2">
          {editable && (
            <button
              onClick={() => setModalOpen(true)}
              className="rounded-lg border px-3 py-2 text-sm font-medium"
              style={{ borderColor: 'var(--border)', color: 'var(--foreground)' }}
            >
              + Add Earning/Deduction
            </button>
          )}
          <button
            onClick={() => window.print()}
            className="rounded-lg px-3 py-2 text-sm font-medium text-white"
            style={{ backgroundColor: 'var(--accent)' }}
          >
            Print
          </button>
        </div>
      </div>

      {error && (
        <div className="rounded-lg px-3 py-2 text-sm" style={{ backgroundColor: '#fef2f2', color: '#dc2626', border: '1px solid #fecaca' }}>
          {error}
        </div>
      )}

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
            <h2 className="mb-2 text-xs font-bold uppercase tracking-wider" style={{ color: 'var(--success, #22b573)' }}>
              Earnings
            </h2>
            <table className="w-full text-sm">
              <tbody>
                {earnings.map((c, idx) => (
                  <tr key={`e-${idx}`}>
                    <td className="py-1" style={{ color: 'var(--foreground)' }}>
                      {c.label}
                      {c.isAdhoc && <span className="ml-1 text-xs" style={{ color: 'var(--foreground-muted)' }}>(ad-hoc)</span>}
                    </td>
                    <td className="py-1 pr-1 text-right" style={{ color: 'var(--success, #22b573)', fontWeight: 500 }}>
                      +{fmt(c.amount)}
                    </td>
                    <td className="py-1 pl-1 text-right print:hidden">
                      {editable && c.isAdhoc && c.id && (
                        <button onClick={() => handleRemoveAdhoc(c.id!)} className="text-xs hover:underline" style={{ color: '#991b1b' }}>
                          ×
                        </button>
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
            <h2 className="mb-2 text-xs font-bold uppercase tracking-wider" style={{ color: 'var(--warning, #f0b429)' }}>
              Deductions
            </h2>
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
                      {editable && c.isAdhoc && c.id && c.amount > 0 && (
                        <button onClick={() => handleRemoveAdhoc(c.id!)} className="text-xs hover:underline" style={{ color: '#991b1b' }}>
                          ×
                        </button>
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

      <FormModal
        title="Add Earning/Deduction"
        fields={adhocFields}
        initialValues={{}}
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        onSubmit={async (values) => {
          const res = await fetch(`/api/payroll/runs/${runId}/lines/${lineId}/adhoc`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ salaryComponentId: Number(values.salaryComponentId), amount: Number(values.amount) }),
          });
          if (!res.ok) {
            const contentType = res.headers.get('content-type') ?? '';
            let err: { error?: string } = { error: `Add failed (${res.status})` };
            if (contentType.includes('application/json')) {
              try {
                err = await res.json();
              } catch {
                // leave default
              }
            }
            throw new Error(err.error ?? `Add failed (${res.status})`);
          }
          fetchLine();
        }}
        submitLabel="Add"
      />
    </div>
  );
}

export default function PayslipPage() {
  return (
    <Suspense fallback={<p style={{ color: 'var(--foreground-muted)' }}>Loading...</p>}>
      <PayslipContent />
    </Suspense>
  );
}
