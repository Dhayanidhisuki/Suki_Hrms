'use client';
import { useState, useEffect, useCallback } from 'react';
import { DataTable, FormModal, type Column, type FieldDef } from '@/components/ui';

interface Row {
  id: number; date: string; tokensUsed: number; ratePerToken: string;
  employeeContribution: string; companyContribution: string;
  employee: { employeeCode: string; firstName: string; lastName: string };
  [key: string]: unknown;
}

const columns: Column<Row>[] = [
  { key: 'employeeCode', label: 'Code', sortable: true, className: 'font-medium' },
  { key: 'name', label: 'Name', sortable: true },
  { key: 'date', label: 'Date', sortable: true },
  { key: 'tokensUsed', label: 'Tokens', sortable: true },
  { key: 'ratePerToken', label: 'Rate' },
  { key: 'employeeContribution', label: 'Emp. Contribution', sortable: true },
  { key: 'companyContribution', label: 'Co. Contribution' },
];

const fields: FieldDef[] = [
  { name: 'employeeId', label: 'Employee ID', type: 'number', required: true },
  { name: 'date', label: 'Date', type: 'date', required: true },
  { name: 'tokensUsed', label: 'Tokens Used', type: 'number', required: true },
  { name: 'ratePerToken', label: 'Rate per Token', type: 'number', required: true },
  { name: 'companyContribution', label: 'Company Contribution', type: 'number' },
];

export default function CanteenPage() {
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [year, setYear] = useState(new Date().getUTCFullYear());
  const [month, setMonth] = useState(new Date().getUTCMonth() + 1);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/workforce/canteen?year=${year}&month=${month}`);
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
  }, [year, month]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const handleSubmit = async (values: Record<string, string | number | boolean>) => {
    const res = await fetch('/api/workforce/canteen', {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(values),
    });
    if (res.ok) { setModalOpen(false); fetchData(); }
    else { const j = await res.json().catch(() => ({})); alert(j.error ?? 'Failed'); }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-xl font-semibold" style={{ color: 'var(--foreground)' }}>Canteen Tokens</h1>
          <p className="mt-1 text-sm" style={{ color: 'var(--foreground-muted)' }}>Track canteen token usage and employee contributions.</p>
        </div>
        <button onClick={() => setModalOpen(true)} className="rounded-lg px-4 py-2 text-sm font-semibold text-white" style={{ backgroundColor: 'var(--primary)' }}>Add Entry</button>
      </div>
      <div className="flex gap-3 items-end">
        <div>
          <label className="text-sm font-medium" style={{ color: 'var(--foreground)' }}>Year</label>
          <input type="number" value={year} onChange={(e) => setYear(parseInt(e.target.value))} className="mt-1 w-24 rounded-lg border px-3 py-2 text-sm" style={{ borderColor: 'var(--border)', backgroundColor: 'var(--surface)', color: 'var(--foreground)' }} />
        </div>
        <div>
          <label className="text-sm font-medium" style={{ color: 'var(--foreground)' }}>Month</label>
          <select value={month} onChange={(e) => setMonth(parseInt(e.target.value))} className="mt-1 rounded-lg border px-3 py-2 text-sm" style={{ borderColor: 'var(--border)', backgroundColor: 'var(--surface)', color: 'var(--foreground)' }}>
            {Array.from({ length: 12 }, (_, i) => <option key={i + 1} value={i + 1}>{i + 1}</option>)}
          </select>
        </div>
      </div>
      {error && <div className="rounded-lg border border-red-300 bg-red-50 p-3 text-sm text-red-700">{error}</div>}
      {loading ? <div className="text-sm" style={{ color: 'var(--foreground-muted)' }}>Loading…</div> : (
        <DataTable data={rows} columns={columns} emptyMessage="No canteen entries" />
      )}
      <FormModal isOpen={modalOpen} onClose={() => setModalOpen(false)} title="Add Canteen Entry" fields={fields} onSubmit={handleSubmit} />
    </div>
  );
}
