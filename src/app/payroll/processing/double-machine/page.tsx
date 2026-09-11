'use client';
import { useState, useEffect, useCallback } from 'react';
import { DataTable, FormModal, type Column, type FieldDef } from '@/components/ui';

interface Row {
  id: number; date: string; machine1: string | null; machine2: string | null;
  numMachines: number; workingHours: string; incentiveRate: string; calculatedIncentive: string;
  status: string; hrRemarks: string | null;
  employee: { employeeCode: string; firstName: string; lastName: string };
  [key: string]: unknown;
}

const columns: Column<Row>[] = [
  { key: 'employeeCode', label: 'Code', sortable: true, className: 'font-medium' },
  { key: 'name', label: 'Name', sortable: true },
  { key: 'date', label: 'Date', sortable: true },
  { key: 'numMachines', label: 'Machines' },
  { key: 'workingHours', label: 'Hours' },
  { key: 'incentiveRate', label: 'Rate' },
  { key: 'calculatedIncentive', label: 'Incentive', sortable: true },
  { key: 'status', label: 'Status', sortable: true },
];

const fields: FieldDef[] = [
  { name: 'employeeId', label: 'Employee ID', type: 'number', required: true },
  { name: 'date', label: 'Date', type: 'date', required: true },
  { name: 'machine1', label: 'Machine 1', type: 'text' },
  { name: 'machine2', label: 'Machine 2', type: 'text' },
  { name: 'numMachines', label: 'Num Machines', type: 'number' },
  { name: 'workingHours', label: 'Working Hours', type: 'number', required: true },
  { name: 'incentiveRate', label: 'Incentive Rate', type: 'number', required: true },
  { name: 'hrRemarks', label: 'HR Remarks', type: 'textarea' },
];

export default function DoubleMachinePage() {
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [modalOpen, setModalOpen] = useState(false);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/payroll/double-machine');
      if (!res.ok) throw new Error('Failed');
      const json = await res.json();
      const mapped = (json.data ?? []).map((r: Record<string, unknown>) => ({
        ...r,
        employeeCode: (r.employee as Record<string, unknown>).employeeCode as string,
        name: `${(r.employee as Record<string, unknown>).firstName} ${(r.employee as Record<string, unknown>).lastName}`.trim(),
        date: (r.date as string)?.slice(0, 10) ?? '',
      })) as Row[];
      setRows(mapped);
    } catch (err) { setError(err instanceof Error ? err.message : 'Error'); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  const handleSubmit = async (values: Record<string, string | number | boolean>) => {
    const res = await fetch('/api/payroll/double-machine', {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(values),
    });
    if (res.ok) { setModalOpen(false); fetchData(); }
    else { const j = await res.json().catch(() => ({})); alert(j.error ?? 'Failed'); }
  };

  const handleApprove = async (id: number) => {
    const res = await fetch(`/api/payroll/double-machine/${id}/approve`, { method: 'POST' });
    if (res.ok) fetchData(); else alert('Failed to approve');
  };

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-xl font-semibold" style={{ color: 'var(--foreground)' }}>Double Machine Entry</h1>
          <p className="mt-1 text-sm" style={{ color: 'var(--foreground-muted)' }}>Track dual-machine work and calculate incentives.</p>
        </div>
        <button onClick={() => setModalOpen(true)} className="rounded-lg px-4 py-2 text-sm font-semibold text-white" style={{ backgroundColor: 'var(--primary)' }}>Add Entry</button>
      </div>
      {error && <div className="rounded-lg border border-red-300 bg-red-50 p-3 text-sm text-red-700">{error}</div>}
      {loading ? <div className="text-sm" style={{ color: 'var(--foreground-muted)' }}>Loading…</div> : (
        <DataTable data={rows} columns={columns} emptyMessage="No entries" renderRowActions={(row) =>
          row.status === 'PENDING' ? (
            <button onClick={() => handleApprove(row.id)} className="rounded px-2 py-1 text-xs font-medium text-white" style={{ backgroundColor: 'var(--success)' }}>Approve</button>
          ) : <span className="text-xs" style={{ color: row.status === 'APPROVED' ? 'var(--success)' : 'var(--danger)' }}>{row.status}</span>
        } />
      )}
      <FormModal isOpen={modalOpen} onClose={() => setModalOpen(false)} title="Add Double Machine Entry" fields={fields} onSubmit={handleSubmit} />
    </div>
  );
}
