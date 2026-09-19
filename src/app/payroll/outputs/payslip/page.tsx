/**
 * Payslip — itemized view of one PayrollLine (earnings/deductions +
 * statutory totals + net salary), plus ad-hoc earning/deduction management
 * while the run is still editable. On-screen + browser-native print; no PDF
 * pipeline in Phase 1.
 *
 * The display logic (Gross tier grouping, statutory rows, totals) lives in
 * PayslipView, shared with the read-only ESS payslip page.
 */

'use client';

import { useState, useEffect, useCallback, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { FormModal, useToast, type FieldDef } from '@/components/ui';
import { PayslipView, type PayrollLineDetail } from '@/components/payroll/PayslipView';

interface ComponentOption {
  id: number;
  code: string;
  name: string;
  type: string;
}

function PayslipContent() {
  const toast = useToast();
  const searchParams = useSearchParams();
  const runId = searchParams.get('runId');
  const lineId = searchParams.get('lineId');

  const [line, setLine] = useState<PayrollLineDetail | null>(null);
  const [components, setComponents] = useState<ComponentOption[]>([]);
  const [loading, setLoading] = useState(true);
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
    try {
      const res = await fetch(`/api/payroll/runs/${runId}/lines/${lineId}`);
      if (!res.ok) throw new Error('Failed to fetch payslip');
      setLine(await res.json());
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  }, [runId, lineId, toast]);

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
      toast.error(err.error ?? 'Remove failed');
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
    return <p className="text-sm" style={{ color: 'var(--foreground-muted)' }}>Not found</p>;
  }

  const editable = line.payrollRun.status === 'DRAFT' || line.payrollRun.status === 'CALCULATED';

  return (
    <>
      <PayslipView
        line={line}
        canEdit={editable}
        onRemoveAdhoc={handleRemoveAdhoc}
        headerActions={
          editable && (
            <button
              onClick={() => setModalOpen(true)}
              className="rounded-lg border px-3 py-2 text-sm font-medium"
              style={{ borderColor: 'var(--border)', color: 'var(--foreground)' }}
            >
              + Add Earning/Deduction
            </button>
          )
        }
      />

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
    </>
  );
}

export default function PayslipPage() {
  return (
    <Suspense fallback={<p style={{ color: 'var(--foreground-muted)' }}>Loading...</p>}>
      <PayslipContent />
    </Suspense>
  );
}
