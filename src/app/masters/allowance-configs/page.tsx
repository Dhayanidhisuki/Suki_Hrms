'use client';
import { useState, useEffect, useCallback } from 'react';
import { DataTable, FormModal, type Column, type FieldDef } from '@/components/ui';

interface Row {
  id: number; componentCode: string; amount: string; eligibilityType: string; eligibilityValue: string | null; isActive: boolean;
  [key: string]: unknown;
}

const columns: Column<Row>[] = [
  { key: 'componentCode', label: 'Component Code', sortable: true },
  { key: 'amount', label: 'Amount', sortable: true },
  { key: 'eligibilityType', label: 'Eligibility' },
  { key: 'eligibilityValue', label: 'Eligibility Value' },
  { key: 'isActive', label: 'Active', sortable: true },
];

const fields: FieldDef[] = [
  { name: 'componentCode', label: 'Component Code', type: 'text', required: true, placeholder: 'e.g. HEAT_ALLOW' },
  { name: 'amount', label: 'Amount', type: 'number', required: true },
  { name: 'eligibilityType', label: 'Eligibility Type', type: 'select', options: [
    { value: 'ALL', label: 'All' }, { value: 'DESIGNATION', label: 'Designation' },
    { value: 'DEPARTMENT', label: 'Department' }, { value: 'SHIFT', label: 'Shift' },
  ]},
  { name: 'eligibilityValue', label: 'Eligibility Value (comma-separated IDs)', type: 'text' },
  { name: 'isActive', label: 'Active', type: 'checkbox' },
];

export default function AllowanceConfigsPage() {
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [modalOpen, setModalOpen] = useState(false);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/masters/allowance-configs');
      if (!res.ok) throw new Error('Failed');
      const json = await res.json();
      setRows(json.data ?? []);
    } catch (err) { setError(err instanceof Error ? err.message : 'Error'); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  const handleSubmit = async (values: Record<string, string | number | boolean>) => {
    const res = await fetch('/api/masters/allowance-configs', {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(values),
    });
    if (res.ok) { setModalOpen(false); fetchData(); }
    else { const j = await res.json().catch(() => ({})); alert(j.error ?? 'Failed'); }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-xl font-semibold" style={{ color: 'var(--foreground)' }}>Allowance Configs</h1>
          <p className="mt-1 text-sm" style={{ color: 'var(--foreground-muted)' }}>Configure special allowances (heat, etc.) linked to salary components.</p>
        </div>
        <button onClick={() => setModalOpen(true)} className="rounded-lg px-4 py-2 text-sm font-semibold text-white" style={{ backgroundColor: 'var(--primary)' }}>Add Config</button>
      </div>
      {error && <div className="rounded-lg border border-red-300 bg-red-50 p-3 text-sm text-red-700">{error}</div>}
      {loading ? <div className="text-sm" style={{ color: 'var(--foreground-muted)' }}>Loading…</div> : (
        <DataTable data={rows} columns={columns} emptyMessage="No allowance configs" />
      )}
      <FormModal isOpen={modalOpen} onClose={() => setModalOpen(false)} title="Add Allowance Config" fields={fields} onSubmit={handleSubmit} />
    </div>
  );
}
