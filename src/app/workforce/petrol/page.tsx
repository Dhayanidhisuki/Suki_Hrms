'use client';
import { useState, useEffect, useCallback } from 'react';
import { DataTable, FormModal, type Column, type FieldDef } from '@/components/ui';

interface Row {
  id: number; travelDate: string; km: string; ratePerKm: string;
  eligibleAmount: string; approvedAmount: string; status: string;
  employee: { employeeCode: string; firstName: string; lastName: string };
  [key: string]: unknown;
}

const columns: Column<Row>[] = [
  { key: 'employeeCode', label: 'Code', sortable: true, className: 'font-medium' },
  { key: 'name', label: 'Name', sortable: true },
  { key: 'travelDate', label: 'Travel Date', sortable: true },
  { key: 'km', label: 'KM', sortable: true },
  { key: 'ratePerKm', label: 'Rate/KM' },
  { key: 'eligibleAmount', label: 'Eligible', sortable: true },
  { key: 'approvedAmount', label: 'Approved' },
  { key: 'status', label: 'Status', sortable: true },
];

const fields: FieldDef[] = [
  { name: 'employeeId', label: 'Employee ID', type: 'number', required: true },
  { name: 'travelDate', label: 'Travel Date', type: 'date', required: true },
  { name: 'km', label: 'KM', type: 'number', required: true },
  { name: 'ratePerKm', label: 'Rate per KM', type: 'number', required: true },
];

export default function PetrolPage() {
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [modalOpen, setModalOpen] = useState(false);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/workforce/petrol');
      if (!res.ok) throw new Error('Failed');
      const json = await res.json();
      const mapped = (json.data ?? []).map((r: Record<string, unknown>) => ({
        ...r,
        employeeCode: (r.employee as Record<string, unknown>).employeeCode as string,
        name: `${(r.employee as Record<string, unknown>).firstName} ${(r.employee as Record<string, unknown>).lastName}`.trim(),
        travelDate: (r.travelDate as string)?.slice(0, 10) ?? '',
      })) as Row[];
      setRows(mapped);
    } catch (err) { setError(err instanceof Error ? err.message : 'Error'); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  const handleSubmit = async (values: Record<string, string | number | boolean>) => {
    const res = await fetch('/api/workforce/petrol', {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(values),
    });
    if (res.ok) { setModalOpen(false); fetchData(); }
    else { const j = await res.json().catch(() => ({})); alert(j.error ?? 'Failed'); }
  };

  const handleApprove = async (id: number) => {
    const res = await fetch(`/api/workforce/petrol/${id}/approve`, { method: 'POST' });
    if (res.ok) fetchData(); else alert('Failed to approve');
  };

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-xl font-semibold" style={{ color: 'var(--foreground)' }}>Petrol Allowance</h1>
          <p className="mt-1 text-sm" style={{ color: 'var(--foreground-muted)' }}>Track KM-based petrol allowance and approve for payroll.</p>
        </div>
        <button onClick={() => setModalOpen(true)} className="rounded-lg px-4 py-2 text-sm font-semibold text-white" style={{ backgroundColor: 'var(--primary)' }}>Add Entry</button>
      </div>
      {error && <div className="rounded-lg border border-red-300 bg-red-50 p-3 text-sm text-red-700">{error}</div>}
      {loading ? <div className="text-sm" style={{ color: 'var(--foreground-muted)' }}>Loading…</div> : (
        <DataTable data={rows} columns={columns} emptyMessage="No petrol entries" renderRowActions={(row) =>
          row.status === 'PENDING' ? (
            <button onClick={() => handleApprove(row.id)} className="rounded px-2 py-1 text-xs font-medium text-white" style={{ backgroundColor: 'var(--success)' }}>Approve</button>
          ) : <span className="text-xs" style={{ color: row.status === 'APPROVED' ? 'var(--success)' : 'var(--danger)' }}>{row.status}</span>
        } />
      )}
      <FormModal isOpen={modalOpen} onClose={() => setModalOpen(false)} title="Add Petrol Entry" fields={fields} onSubmit={handleSubmit} />
    </div>
  );
}
