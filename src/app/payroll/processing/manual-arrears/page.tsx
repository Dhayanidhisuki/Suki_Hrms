/**
 * Manual Arrears — list, create, approve, reject, and apply arrears
 * for non-revision arrear types (ALLOWANCE, DEDUCTION_REVERSAL,
 * ATTENDANCE, INCENTIVE, MANUAL — BRD §5).
 */

'use client';

import { useState, useEffect, useCallback } from 'react';
import { DataTable, FormModal, useToast, type Column, type FieldDef } from '@/components/ui';

interface Row {
  id: number;
  arrearType: string;
  amountType: string;
  amount: string;
  arrearYear: number;
  arrearMonth: number;
  description: string | null;
  status: string;
  employee: { oldEmployeeCode: string | null; firstName: string; lastName: string };
  [key: string]: unknown;
}

const columns: Column<Row>[] = [
  { key: 'employeeCode', label: 'Code', sortable: true, className: 'font-medium' },
  { key: 'name', label: 'Name', sortable: true },
  { key: 'arrearType', label: 'Type', sortable: true },
  { key: 'amountType', label: 'Earning/Deduction' },
  { key: 'amount', label: 'Amount', sortable: true },
  { key: 'arrearPeriod', label: 'Period' },
  { key: 'status', label: 'Status', sortable: true },
];

const fields: FieldDef[] = [
  { name: 'employeeId', label: 'Employee ID', type: 'number', required: true },
  { name: 'arrearType', label: 'Arrear Type', type: 'select', required: true, options: [
    { value: 'ALLOWANCE', label: 'Allowance Arrear' },
    { value: 'DEDUCTION_REVERSAL', label: 'Deduction Reversal' },
    { value: 'ATTENDANCE', label: 'Attendance Arrear' },
    { value: 'INCENTIVE', label: 'Incentive Arrear' },
    { value: 'MANUAL', label: 'Manual Arrear' },
  ]},
  { name: 'amountType', label: 'Amount Type', type: 'select', options: [
    { value: 'EARNING', label: 'Earning' },
    { value: 'DEDUCTION', label: 'Deduction' },
  ]},
  { name: 'amount', label: 'Amount', type: 'number', required: true },
  { name: 'arrearYear', label: 'Arrear Year', type: 'number', required: true },
  { name: 'arrearMonth', label: 'Arrear Month (1-12)', type: 'number', required: true },
  { name: 'description', label: 'Description', type: 'textarea' },
];

export default function ManualArrearsPage() {
  const toast = useToast();
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/payroll/manual-arrears');
      if (!res.ok) throw new Error('Failed');
      const json = await res.json();
      const mapped = (json.data ?? []).map((r: Record<string, unknown>) => ({
        ...r,
        employeeCode: ((r.employee as Record<string, unknown>).oldEmployeeCode as string | null) ?? '',
        name: `${(r.employee as Record<string, unknown>).firstName} ${(r.employee as Record<string, unknown>).lastName}`.trim(),
        arrearPeriod: `${r.arrearYear}-${String(r.arrearMonth).padStart(2, '0')}`,
      })) as Row[];
      setRows(mapped);
    } catch (err) { toast.error(err instanceof Error ? err.message : 'Error'); }
    finally { setLoading(false); }
  }, [toast]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const handleSubmit = async (values: Record<string, string | number | boolean>) => {
    const res = await fetch('/api/payroll/manual-arrears', {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(values),
    });
    if (res.ok) { setModalOpen(false); fetchData(); }
    else { const j = await res.json().catch(() => ({})); toast.error(j.error ?? 'Failed'); }
  };

  const handleApprove = async (id: number) => {
    const res = await fetch(`/api/payroll/manual-arrears/${id}/approve`, { method: 'POST' });
    if (res.ok) fetchData(); else toast.error('Failed to approve');
  };

  const handleReject = async (id: number) => {
    const reason = prompt('Rejection reason:');
    if (!reason) return;
    const res = await fetch(`/api/payroll/manual-arrears/${id}/reject`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ reason }),
    });
    if (res.ok) fetchData(); else toast.error('Failed to reject');
  };

  const handleApply = async (id: number) => {
    const runId = prompt('Payroll Run ID to apply to:');
    if (!runId) return;
    const res = await fetch(`/api/payroll/manual-arrears/${id}/apply`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ payrollRunId: parseInt(runId) }),
    });
    if (res.ok) fetchData(); else { const j = await res.json().catch(() => ({})); toast.error(j.error ?? 'Failed to apply'); }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-xl font-semibold" style={{ color: 'var(--foreground)' }}>Manual Arrears</h1>
          <p className="mt-1 text-sm" style={{ color: 'var(--foreground-muted)' }}>
            Non-revision arrears: allowance, deduction reversal, attendance, incentive, manual.
          </p>
        </div>
        <button onClick={() => setModalOpen(true)} className="rounded-lg px-4 py-2 text-sm font-semibold text-white" style={{ backgroundColor: 'var(--primary)' }}>Add Arrear</button>
      </div>
      {loading ? <div className="text-sm" style={{ color: 'var(--foreground-muted)' }}>Loading…</div> : (
        <DataTable
          data={rows}
          columns={columns}
          emptyMessage="No manual arrears"
          renderRowActions={(row) => (
            <div className="flex gap-2">
              {row.status === 'PENDING' && (
                <>
                  <button onClick={() => handleApprove(row.id)} className="rounded px-2 py-1 text-xs font-medium text-white" style={{ backgroundColor: 'var(--success)' }}>Approve</button>
                  <button onClick={() => handleReject(row.id)} className="rounded px-2 py-1 text-xs font-medium text-white" style={{ backgroundColor: 'var(--danger)' }}>Reject</button>
                </>
              )}
              {row.status === 'APPROVED' && (
                <button onClick={() => handleApply(row.id)} className="rounded px-2 py-1 text-xs font-medium text-white" style={{ backgroundColor: 'var(--primary)' }}>Apply to Run</button>
              )}
              {row.status === 'APPLIED' && <span className="text-xs" style={{ color: 'var(--success)' }}>Applied</span>}
              {row.status === 'REJECTED' && <span className="text-xs" style={{ color: 'var(--danger)' }}>Rejected</span>}
            </div>
          )}
        />
      )}
      <FormModal isOpen={modalOpen} onClose={() => setModalOpen(false)} title="Add Manual Arrear" fields={fields} onSubmit={handleSubmit} />
    </div>
  );
}
