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
  esiEmployee: string;
  professionalTax: string;
  tds: string;
  otherEarningsTotal: string;
  otherDeductionsTotal: string;
  netSalary: string;
  status: string;
  holdReason: string | null;
  employee: { employeeCode: string; firstName: string; lastName: string };
  payrollRun: { year: number; month: number; status: string };
  components: LineComponent[];
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
      const err = await res.json();
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
  const earnings = line.components.filter((c) => c.salaryComponent.type === 'earning');
  const deductions = line.components.filter((c) => c.salaryComponent.type === 'deduction');

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
            <h2 className="mb-2 text-xs font-bold uppercase tracking-wider" style={{ color: 'var(--foreground-muted)' }}>
              Earnings
            </h2>
            <table className="w-full text-sm">
              <tbody>
                {earnings.map((c) => (
                  <tr key={c.id}>
                    <td className="py-1" style={{ color: 'var(--foreground)' }}>
                      {c.salaryComponent.name}
                      {c.isAdhoc && <span className="ml-1 text-xs" style={{ color: 'var(--foreground-muted)' }}>(ad-hoc)</span>}
                    </td>
                    <td className="py-1 text-right" style={{ color: 'var(--foreground)' }}>{c.amount}</td>
                    <td className="py-1 pl-2 text-right print:hidden">
                      {editable && c.isAdhoc && (
                        <button onClick={() => handleRemoveAdhoc(c.id)} className="text-xs hover:underline" style={{ color: '#991b1b' }}>
                          ×
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
                <tr style={{ borderTop: '1px solid var(--border)' }}>
                  <td className="py-1 font-medium" style={{ color: 'var(--foreground)' }}>Overtime</td>
                  <td className="py-1 text-right" style={{ color: 'var(--foreground)' }}>{line.otAmount}</td>
                  <td />
                </tr>
              </tbody>
            </table>
          </div>

          <div>
            <h2 className="mb-2 text-xs font-bold uppercase tracking-wider" style={{ color: 'var(--foreground-muted)' }}>
              Deductions
            </h2>
            <table className="w-full text-sm">
              <tbody>
                {deductions.map((c) => (
                  <tr key={c.id}>
                    <td className="py-1" style={{ color: 'var(--foreground)' }}>
                      {c.salaryComponent.name}
                      {c.isAdhoc && <span className="ml-1 text-xs" style={{ color: 'var(--foreground-muted)' }}>(ad-hoc)</span>}
                    </td>
                    <td className="py-1 text-right" style={{ color: 'var(--foreground)' }}>{c.amount}</td>
                    <td className="py-1 pl-2 text-right print:hidden">
                      {editable && c.isAdhoc && (
                        <button onClick={() => handleRemoveAdhoc(c.id)} className="text-xs hover:underline" style={{ color: '#991b1b' }}>
                          ×
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
                <tr>
                  <td className="py-1" style={{ color: 'var(--foreground)' }}>Professional Tax</td>
                  <td className="py-1 text-right" style={{ color: 'var(--foreground)' }}>{line.professionalTax}</td>
                  <td />
                </tr>
                <tr>
                  <td className="py-1" style={{ color: 'var(--foreground)' }}>TDS</td>
                  <td className="py-1 text-right" style={{ color: 'var(--foreground)' }}>{line.tds}</td>
                  <td />
                </tr>
              </tbody>
            </table>
          </div>
        </div>

        <div className="mt-5 flex items-center justify-between rounded-lg px-4 py-3" style={{ backgroundColor: 'var(--surface-hover)' }}>
          <span className="text-sm font-semibold" style={{ color: 'var(--foreground)' }}>Net Salary</span>
          <span className="text-lg font-bold" style={{ color: 'var(--foreground)' }}>₹{line.netSalary}</span>
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
            const err = await res.json();
            throw new Error(err.error ?? 'Add failed');
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
