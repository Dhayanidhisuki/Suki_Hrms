'use client';
import { useState, useEffect, useCallback } from 'react';
import { DataTable, FormModal, type Column, type FieldDef } from '@/components/ui';

interface Row {
  id: number; type: string; name: string; amount: string; calculationType: string;
  eligibleShiftCodes: string | null; isActive: boolean;
  [key: string]: unknown;
}

const columns: Column<Row>[] = [
  { key: 'type', label: 'Type', sortable: true },
  { key: 'name', label: 'Name', sortable: true },
  { key: 'amount', label: 'Amount', sortable: true },
  { key: 'calculationType', label: 'Calc Type' },
  { key: 'eligibleShiftCodes', label: 'Shift Codes' },
  { key: 'isActive', label: 'Active', sortable: true },
];

const fields: FieldDef[] = [
  { name: 'type', label: 'Type', type: 'select', required: true, options: [
    { value: 'ATTENDANCE_BONUS', label: 'Attendance Bonus' },
    { value: 'SHIFT_BONUS', label: 'Shift Bonus' },
    { value: 'PRODUCTION', label: 'Production' },
    { value: 'SPECIAL', label: 'Special' },
    { value: 'OTHER', label: 'Other' },
  ]},
  { name: 'name', label: 'Name', type: 'text', required: true },
  { name: 'amount', label: 'Amount', type: 'number', required: true },
  { name: 'calculationType', label: 'Calc Type', type: 'select', options: [
    { value: 'FLAT', label: 'Flat' }, { value: 'FORMULA', label: 'Formula' },
  ]},
  { name: 'formula', label: 'Formula (JSON)', type: 'textarea' },
  { name: 'eligibility', label: 'Eligibility (JSON)', type: 'textarea' },
  { name: 'eligibleShiftCodes', label: 'Eligible Shift Codes', type: 'text', placeholder: 'comma-separated' },
  { name: 'isActive', label: 'Active', type: 'checkbox' },
];

export default function IncentivePoliciesPage() {
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [modalOpen, setModalOpen] = useState(false);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/masters/incentive-policies');
      if (!res.ok) throw new Error('Failed');
      const json = await res.json();
      setRows(json.data ?? []);
    } catch (err) { setError(err instanceof Error ? err.message : 'Error'); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  const handleSubmit = async (values: Record<string, string | number | boolean>) => {
    const res = await fetch('/api/masters/incentive-policies', {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(values),
    });
    if (res.ok) { setModalOpen(false); fetchData(); }
    else { const j = await res.json().catch(() => ({})); alert(j.error ?? 'Failed'); }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-xl font-semibold" style={{ color: 'var(--foreground)' }}>Incentive Policies</h1>
          <p className="mt-1 text-sm" style={{ color: 'var(--foreground-muted)' }}>Configure incentive types and calculation rules.</p>
        </div>
        <button onClick={() => setModalOpen(true)} className="rounded-lg px-4 py-2 text-sm font-semibold text-white" style={{ backgroundColor: 'var(--primary)' }}>Add Policy</button>
      </div>
      {error && <div className="rounded-lg border border-red-300 bg-red-50 p-3 text-sm text-red-700">{error}</div>}
      {loading ? <div className="text-sm" style={{ color: 'var(--foreground-muted)' }}>Loading…</div> : (
        <DataTable data={rows} columns={columns} emptyMessage="No incentive policies" />
      )}
      <FormModal isOpen={modalOpen} onClose={() => setModalOpen(false)} title="Add Incentive Policy" fields={fields} onSubmit={handleSubmit} />
    </div>
  );
}
