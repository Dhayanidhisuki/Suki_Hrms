'use client';

import { useState, useEffect, useCallback } from 'react';
import { DataTable, FormModal, ConfirmDialog, type Column, type FieldDef, KPICard, KPIGrid } from '@/components/ui';
import { useModuleStats } from '@/hooks/useModuleStats';

interface EsiRateRecord {
  id: number;
  code: string;
  employeeContributionRate: number;
  employerContributionRate: number;
  wageCeilingMonthly: number;
  effectiveFrom: string;
  effectiveTo: string | null;
  isActive: boolean;
}

interface ApiResponse {
  data: EsiRateRecord[];
  pagination: { page: number; limit: number; total: number; totalPages: number };
}

// Code is auto-generated (ESI-<n>), not typed — mirrors Salary Components'
// and PF Rates' auto-code convention.
function generateEsiRateCode(existing: EsiRateRecord[]): string {
  const nums = existing
    .map((r) => /^ESI-(\d+)$/.exec(r.code))
    .filter((m): m is RegExpExecArray => m !== null)
    .map((m) => Number(m[1]));
  return `ESI-${(nums.length ? Math.max(...nums) : 0) + 1}`;
}

function buildFields(existing: EsiRateRecord[], isEditing: boolean): FieldDef[] {
  return [
    isEditing
      ? { name: 'code', label: 'Code', type: 'text', required: true }
      : { name: 'code', label: 'Code', type: 'text', required: true, hidden: true, compute: () => generateEsiRateCode(existing) },
    { name: 'employeeContributionRate', label: 'Employee Rate %', type: 'number', required: true, step: '0.01', min: 0, max: 100 },
    { name: 'employerContributionRate', label: 'Employer Rate %', type: 'number', required: true, step: '0.01', min: 0, max: 100 },
    { name: 'wageCeilingMonthly', label: 'Wage Ceiling (Monthly)', type: 'number', required: true, step: '0.01', min: 0 },
    { name: 'effectiveFrom', label: 'Effective From', type: 'date', required: true },
    { name: 'effectiveTo', label: 'Effective To', type: 'date', helpText: 'Leave blank for currently active' },
    { name: 'isActive', label: 'Active', type: 'checkbox', defaultValue: true },
  ];
}

const columns: Column<EsiRateRecord>[] = [
  { key: 'code', label: 'Code', sortable: true, className: 'font-medium' },
  { key: 'employeeContributionRate', label: 'Emp Rate %', render: (row) => `${row.employeeContributionRate}%` },
  { key: 'employerContributionRate', label: 'Empr Rate %', render: (row) => `${row.employerContributionRate}%` },
  { key: 'wageCeilingMonthly', label: 'Wage Ceiling' },
];

export default function EsiRatesPage() {
  const [records, setRecords] = useState<EsiRateRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [pagination, setPagination] = useState({ page: 1, limit: 20, total: 0, totalPages: 0 });

  const { stats } = useModuleStats('esi-rates');
  const [modalOpen, setModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [initialValues, setInitialValues] = useState<Record<string, string | number | boolean | undefined>>({});
  const [deleteId, setDeleteId] = useState<number | null>(null);

  const fetchData = useCallback(async () => {
    setLoading(true); setError(null);
    try {
      const params = new URLSearchParams({ page: String(page), limit: '20', ...(search ? { search } : {}) });
      const res = await fetch(`/api/masters/esi-rates?${params}`);
      if (!res.ok) throw new Error('Failed to fetch');
      const json: ApiResponse = await res.json();
      setRecords(json.data); setPagination(json.pagination);
    } catch (err) { setError(err instanceof Error ? err.message : 'Unknown error'); }
    finally { setLoading(false); }
  }, [page, search]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const handleAdd = () => {
    setEditingId(null);
    setInitialValues({ isActive: true });
    setModalOpen(true);
  };

  const handleEdit = (row: EsiRateRecord) => {
    setEditingId(row.id);
    const vals: Record<string, string | number | boolean | undefined> = {};
    for (const f of buildFields(records, true)) {
      let v = row[f.name as keyof EsiRateRecord] as string | number | boolean | undefined;
      if (v === undefined || v === null) v = f.defaultValue ?? '';
      if (f.type === 'date' && typeof v === 'string' && v) v = v.slice(0, 10);
      vals[f.name] = v;
    }
    setInitialValues(vals);
    setModalOpen(true);
  };

  const handleSubmit = async (values: Record<string, string | number | boolean>) => {
    const payload: Record<string, unknown> = { ...values };
    for (const f of buildFields(records, editingId !== null)) {
      if (!f.required && payload[f.name] === '') payload[f.name] = null;
    }
    const url = editingId ? `/api/masters/esi-rates/${editingId}` : '/api/masters/esi-rates';
    const method = editingId ? 'PUT' : 'POST';
    const res = await fetch(url, { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
    if (!res.ok) { const err = await res.json(); throw new Error(err.error ?? 'Save failed'); }
    fetchData();
  };

  const handleDelete = async (id: number) => {
    const res = await fetch(`/api/masters/esi-rates/${id}`, { method: 'DELETE' });
    if (!res.ok) { const err = await res.json(); setError(err.error ?? 'Deactivate failed'); return; }
    fetchData();
  };

  const allColumns: Column<EsiRateRecord>[] = [
    ...columns,
    {
      key: 'effectiveFrom',
      label: 'Effective From',
      render: (row) => new Date(row.effectiveFrom).toLocaleDateString(),
      className: 'whitespace-nowrap',
    },
    {
      key: 'effectiveTo',
      label: 'Effective To',
      render: (row) => (row.effectiveTo ? new Date(row.effectiveTo).toLocaleDateString() : 'Current'),
      className: 'whitespace-nowrap',
    },
    {
      key: 'isActive',
      label: 'Status',
      render: (row) => (
        <span className="px-2 py-0.5 text-xs font-medium rounded-full" style={{ backgroundColor: row.isActive ? '#dcfce7' : '#fee2e2', color: row.isActive ? '#166534' : '#991b1b' }}>
          {row.isActive ? 'Active' : 'Inactive'}
        </span>
      ),
    },
  ];

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold" style={{ color: 'var(--foreground)' }}>ESI Rates</h1>
        <button onClick={handleAdd} className="rounded-lg px-4 py-2 text-sm font-medium text-white transition hover:opacity-90" style={{ backgroundColor: 'var(--accent)' }}>
          + Add ESI Rate
        </button>
      </div>

      <KPIGrid columns={2}>
        <KPICard label="Total ESI Rates" value={stats.total} tone="info" />
        <KPICard label="Active" value={stats.active ?? 0} tone="success" />
      </KPIGrid>

      {error && <div className="rounded-lg px-3 py-2 text-sm" style={{ backgroundColor: '#fef2f2', color: '#dc2626', border: '1px solid #fecaca' }}>{error}</div>}

      <DataTable
        columns={allColumns}
        data={records}
        pagination={pagination}
        loading={loading}
        searchValue={search}
        onSearchChange={(v) => { setSearch(v); setPage(1); }}
        onPageChange={setPage}
        onEdit={handleEdit}
        onDelete={(row) => setDeleteId(row.id)}
      />

      <FormModal
        title={editingId ? 'Edit ESI Rate' : 'Add ESI Rate'}
        fields={buildFields(records, editingId !== null)}
        initialValues={initialValues}
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        onSubmit={handleSubmit}
        submitLabel={editingId ? 'Update' : 'Create'}
      />

      <ConfirmDialog
        title="Deactivate ESI Rate"
        message="Are you sure you want to deactivate this ESI rate? This will set it as inactive."
        confirmLabel="Deactivate"
        isOpen={deleteId !== null}
        onConfirm={() => deleteId && handleDelete(deleteId)}
        onClose={() => setDeleteId(null)}
      />
    </div>
  );
}
