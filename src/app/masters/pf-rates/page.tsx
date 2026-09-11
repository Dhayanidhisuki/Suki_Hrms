'use client';

import { useState, useEffect, useCallback } from 'react';
import { DataTable, FormModal, ConfirmDialog, type Column, type FieldDef, KPICard, KPIGrid } from '@/components/ui';
import { useModuleStats } from '@/hooks/useModuleStats';

interface SalaryComponentOption {
  id: number;
  code: string;
  name: string;
}

interface RateComponent {
  id?: number;
  salaryComponentId: number;
  calculationType: 'percentage' | 'inr';
  value: number;
  salaryComponent?: SalaryComponentOption;
}

interface PfRateRecord {
  id: number;
  code: string;
  employeeContributionRate: number;
  employerContributionRate: number;
  pensionContributionRate: number | null;
  wageCeilingMonthly: number;
  effectiveFrom: string;
  effectiveTo: string | null;
  isActive: boolean;
  components?: RateComponent[];
}

interface ApiResponse {
  data: PfRateRecord[];
  pagination: { page: number; limit: number; total: number; totalPages: number };
}

const fields: FieldDef[] = [
  { name: 'code', label: 'Code', type: 'text', required: true, placeholder: 'e.g. PF-2026' },
  { name: 'employeeContributionRate', label: 'Employee Rate %', type: 'number', required: true, step: '0.01', min: 0, max: 100 },
  { name: 'employerContributionRate', label: 'Employer Rate %', type: 'number', required: true, step: '0.01', min: 0, max: 100 },
  { name: 'pensionContributionRate', label: 'Pension Rate %', type: 'number', step: '0.01', min: 0, max: 100, helpText: 'EPS share, e.g. 8.33' },
  { name: 'wageCeilingMonthly', label: 'Wage Ceiling (Monthly)', type: 'number', required: true, step: '0.01', min: 0 },
  { name: 'effectiveFrom', label: 'Effective From', type: 'date', required: true },
  { name: 'effectiveTo', label: 'Effective To', type: 'date', helpText: 'Leave blank for currently active' },
  { name: 'isActive', label: 'Active', type: 'checkbox', defaultValue: true },
];

const columns: Column<PfRateRecord>[] = [
  { key: 'code', label: 'Code', sortable: true, className: 'font-medium' },
  { key: 'employeeContributionRate', label: 'Emp Rate %', render: (row) => `${row.employeeContributionRate}%` },
  { key: 'employerContributionRate', label: 'Empr Rate %', render: (row) => `${row.employerContributionRate}%` },
  { key: 'pensionContributionRate', label: 'Pension %', render: (row) => (row.pensionContributionRate ? `${row.pensionContributionRate}%` : '—') },
  { key: 'wageCeilingMonthly', label: 'Wage Ceiling' },
];

export default function PfRatesPage() {
  const [records, setRecords] = useState<PfRateRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [pagination, setPagination] = useState({ page: 1, limit: 20, total: 0, totalPages: 0 });

  const { stats } = useModuleStats('pf-rates');
  const [modalOpen, setModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [initialValues, setInitialValues] = useState<Record<string, string | number | boolean | undefined>>({});
  const [deleteId, setDeleteId] = useState<number | null>(null);

  // Components state
  const [salaryComponents, setSalaryComponents] = useState<SalaryComponentOption[]>([]);
  const [rateComponents, setRateComponents] = useState<RateComponent[]>([]);
  const [componentModalOpen, setComponentModalOpen] = useState(false);
  const [newComponent, setNewComponent] = useState<{ salaryComponentId: string; calculationType: 'percentage' | 'inr'; value: string }>({
    salaryComponentId: '',
    calculationType: 'percentage',
    value: '',
  });

  const fetchData = useCallback(async () => {
    setLoading(true); setError(null);
    try {
      const params = new URLSearchParams({ page: String(page), limit: '20', ...(search ? { search } : {}) });
      const res = await fetch(`/api/masters/pf-rates?${params}`);
      if (!res.ok) throw new Error('Failed to fetch');
      const json: ApiResponse = await res.json();
      setRecords(json.data); setPagination(json.pagination);
    } catch (err) { setError(err instanceof Error ? err.message : 'Unknown error'); }
    finally { setLoading(false); }
  }, [page, search]);

  const fetchSalaryComponents = useCallback(async () => {
    try {
      const res = await fetch('/api/masters/salary-components?limit=500');
      if (!res.ok) return;
      const json = await res.json();
      const items: SalaryComponentOption[] = (json.data ?? json.items ?? json ?? []).map((x: { id: number; code: string; name: string }) => ({ id: x.id, code: x.code, name: x.name }));
      setSalaryComponents(items);
    } catch {
      // optional
    }
  }, []);

  useEffect(() => { fetchData(); fetchSalaryComponents(); }, [fetchData, fetchSalaryComponents]);

  const handleAdd = () => {
    setEditingId(null);
    setInitialValues({ isActive: true });
    setRateComponents([]);
    setModalOpen(true);
  };

  const handleEdit = (row: PfRateRecord) => {
    setEditingId(row.id);
    const vals: Record<string, string | number | boolean | undefined> = {};
    for (const f of fields) {
      let v = row[f.name as keyof PfRateRecord] as string | number | boolean | undefined;
      if (v === undefined || v === null) v = f.defaultValue ?? '';
      if (f.type === 'date' && typeof v === 'string' && v) v = v.slice(0, 10);
      vals[f.name] = v;
    }
    setInitialValues(vals);
    setRateComponents(row.components ?? []);
    setModalOpen(true);
  };

  const handleSubmit = async (values: Record<string, string | number | boolean>) => {
    const payload: Record<string, unknown> = { ...values, components: rateComponents };
    for (const f of fields) {
      if (!f.required && payload[f.name] === '') payload[f.name] = null;
    }
    const url = editingId ? `/api/masters/pf-rates/${editingId}` : '/api/masters/pf-rates';
    const method = editingId ? 'PUT' : 'POST';
    const res = await fetch(url, { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
    if (!res.ok) { const err = await res.json(); throw new Error(err.error ?? 'Save failed'); }
    fetchData();
  };

  const handleDelete = async (id: number) => {
    const res = await fetch(`/api/masters/pf-rates/${id}`, { method: 'DELETE' });
    if (!res.ok) { const err = await res.json(); setError(err.error ?? 'Deactivate failed'); return; }
    fetchData();
  };

  const addComponent = () => {
    if (!newComponent.salaryComponentId || !newComponent.value) return;
    const sc = salaryComponents.find((s) => s.id === Number(newComponent.salaryComponentId));
    if (!sc) return;
    setRateComponents((prev) => [
      ...prev,
      {
        salaryComponentId: sc.id,
        calculationType: newComponent.calculationType,
        value: Number(newComponent.value),
        salaryComponent: sc,
      },
    ]);
    setNewComponent({ salaryComponentId: '', calculationType: 'percentage', value: '' });
    setComponentModalOpen(false);
  };

  const removeComponent = (idx: number) => {
    setRateComponents((prev) => prev.filter((_, i) => i !== idx));
  };

  const allColumns: Column<PfRateRecord>[] = [
    ...columns,
    {
      key: 'components',
      label: 'Components',
      render: (row) =>
        row.components && row.components.length > 0
          ? row.components.map((c, i) => (
              <span key={i} className="mr-1 inline-block rounded px-1.5 py-0.5 text-[10px] font-medium" style={{ backgroundColor: '#e0e7ff', color: '#3730a3' }}>
                {c.salaryComponent?.code ?? '?'}: {c.calculationType === 'percentage' ? `${c.value}%` : `₹${c.value}`}
              </span>
            ))
          : '—',
    },
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
        <h1 className="text-xl font-semibold" style={{ color: 'var(--foreground)' }}>PF Rates</h1>
        <button onClick={handleAdd} className="rounded-lg px-4 py-2 text-sm font-medium text-white transition hover:opacity-90" style={{ backgroundColor: 'var(--accent)' }}>
          + Add PF Rate
        </button>
      </div>

      <KPIGrid columns={2}>
        <KPICard label="Total PF Rates" value={stats.total} tone="info" />
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
        title={editingId ? 'Edit PF Rate' : 'Add PF Rate'}
        fields={fields}
        initialValues={initialValues}
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        onSubmit={handleSubmit}
        submitLabel={editingId ? 'Update' : 'Create'}
      >
        {/* Add Components section inside the modal */}
        <div className="mt-4 rounded-lg border p-3" style={{ borderColor: 'var(--border)' }}>
          <div className="mb-2 flex items-center justify-between">
            <span className="text-sm font-medium" style={{ color: 'var(--foreground)' }}>Salary Components</span>
            <button
              type="button"
              onClick={() => setComponentModalOpen(true)}
              className="rounded-lg border px-2 py-1 text-xs font-medium transition hover:opacity-80"
              style={{ borderColor: 'var(--accent)', color: 'var(--accent)' }}
            >
              + Add Component
            </button>
          </div>
          {rateComponents.length === 0 ? (
            <p className="text-xs" style={{ color: 'var(--foreground-muted)' }}>No components added yet.</p>
          ) : (
            <div className="space-y-1">
              {rateComponents.map((c, i) => (
                <div key={i} className="flex items-center justify-between rounded border px-2 py-1 text-xs" style={{ borderColor: 'var(--border)' }}>
                  <span style={{ color: 'var(--foreground)' }}>
                    <strong>{c.salaryComponent?.code ?? '?'}</strong> — {c.salaryComponent?.name ?? ''}
                  </span>
                  <span className="flex items-center gap-2">
                    <span className="rounded px-1.5 py-0.5 font-medium" style={{ backgroundColor: '#e0e7ff', color: '#3730a3' }}>
                      {c.calculationType === 'percentage' ? `${c.value}%` : `₹${c.value}`}
                    </span>
                    <button type="button" onClick={() => removeComponent(i)} className="text-red-600 hover:underline">Remove</button>
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      </FormModal>

      {/* Add Component Dialog */}
      {componentModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={() => setComponentModalOpen(false)}>
          <div className="w-full max-w-md rounded-lg border p-4 shadow-lg" style={{ backgroundColor: 'var(--surface)', borderColor: 'var(--border)' }} onClick={(e) => e.stopPropagation()}>
            <h3 className="mb-3 text-sm font-semibold" style={{ color: 'var(--foreground)' }}>Add Salary Component</h3>
            <div className="space-y-3">
              <div>
                <label className="mb-1 block text-xs font-medium" style={{ color: 'var(--foreground-muted)' }}>Salary Component</label>
                <select
                  value={newComponent.salaryComponentId}
                  onChange={(e) => setNewComponent((p) => ({ ...p, salaryComponentId: e.target.value }))}
                  className="w-full rounded-lg border px-3 py-2 text-sm"
                  style={{ backgroundColor: 'var(--surface)', color: 'var(--foreground)', borderColor: 'var(--border)' }}
                >
                  <option value="">Select component…</option>
                  {salaryComponents.map((sc) => (
                    <option key={sc.id} value={sc.id}>{sc.code} — {sc.name}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium" style={{ color: 'var(--foreground-muted)' }}>Calculation Type</label>
                <select
                  value={newComponent.calculationType}
                  onChange={(e) => setNewComponent((p) => ({ ...p, calculationType: e.target.value as 'percentage' | 'inr' }))}
                  className="w-full rounded-lg border px-3 py-2 text-sm"
                  style={{ backgroundColor: 'var(--surface)', color: 'var(--foreground)', borderColor: 'var(--border)' }}
                >
                  <option value="percentage">Percentage (%)</option>
                  <option value="inr">INR (₹)</option>
                </select>
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium" style={{ color: 'var(--foreground-muted)' }}>
                  {newComponent.calculationType === 'percentage' ? 'Percentage Value (%)' : 'Amount (₹)'}
                </label>
                <input
                  type="number"
                  value={newComponent.value}
                  onChange={(e) => setNewComponent((p) => ({ ...p, value: e.target.value }))}
                  step="0.01"
                  min="0"
                  className="w-full rounded-lg border px-3 py-2 text-sm"
                  style={{ backgroundColor: 'var(--surface)', color: 'var(--foreground)', borderColor: 'var(--border)' }}
                />
              </div>
            </div>
            <div className="mt-4 flex justify-end gap-2">
              <button onClick={() => setComponentModalOpen(false)} className="rounded-lg border px-3 py-1.5 text-sm" style={{ borderColor: 'var(--border)', color: 'var(--foreground)' }}>Cancel</button>
              <button onClick={addComponent} className="rounded-lg px-3 py-1.5 text-sm font-medium text-white" style={{ backgroundColor: 'var(--accent)' }}>Add</button>
            </div>
          </div>
        </div>
      )}

      <ConfirmDialog
        title="Deactivate PF Rate"
        message="Are you sure you want to deactivate this PF rate? This will set it as inactive."
        confirmLabel="Deactivate"
        isOpen={deleteId !== null}
        onConfirm={() => deleteId && handleDelete(deleteId)}
        onClose={() => setDeleteId(null)}
      />
    </div>
  );
}
