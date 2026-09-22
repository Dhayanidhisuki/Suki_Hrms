'use client';

import { useState, useEffect } from 'react';
import { DataTable, FormModal, ConfirmDialog, KPICard, KPIGrid } from '@/components/ui';
import type { Column, FieldDef } from '@/components/ui';

interface Budget {
  id: number;
  year: string;
  departmentId: number | null;
  allocatedAmount: string | number;
  utilizedAmount: string | number;
  isActive: boolean;
}

interface Department { id: number; name: string }

export default function BudgetsPage() {
  const [records, setRecords] = useState<Budget[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [refresh, setRefresh] = useState(0);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [initialValues, setInitialValues] = useState<Record<string, string | number | boolean | undefined>>({});
  const [deleteId, setDeleteId] = useState<number | null>(null);

  const deptName = (id: number | null) => departments.find((d) => d.id === id)?.name ?? 'All Departments';
  const money = (v: string | number) => `₹${Number(v).toLocaleString('en-IN')}`;

  useEffect(() => {
    let mounted = true;
    const load = async () => {
      setLoading(true);
      setError(null);
      try {
        const [bRes, dRes] = await Promise.all([
          fetch('/api/training-budgets'),
          fetch('/api/masters/departments?limit=200'),
        ]);
        const [bJson, dJson] = await Promise.all([bRes.json(), dRes.json()]);
        if (!mounted) return;
        setRecords(Array.isArray(bJson) ? bJson : bJson.data ?? []);
        setDepartments(Array.isArray(dJson) ? dJson : dJson.data ?? []);
      } catch (err) {
        if (mounted) setError(err instanceof Error ? err.message : 'Failed to load');
      } finally {
        if (mounted) setLoading(false);
      }
    };
    void load();
    return () => { mounted = false; };
  }, [refresh]);

  const fields: FieldDef[] = [
    { name: 'year', label: 'Year', type: 'text', required: true, placeholder: '2026' },
    { name: 'departmentId', label: 'Department (blank = company-wide)', type: 'select', options: departments.map((d) => ({ label: d.name, value: d.id })) },
    { name: 'allocatedAmount', label: 'Allocated Amount (₹)', type: 'number', required: true },
  ];

  const handleSubmit = async (values: Record<string, string | number | boolean>) => {
    const url = editingId ? `/api/training-budgets/${editingId}` : '/api/training-budgets';
    const res = await fetch(url, {
      method: editingId ? 'PUT' : 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(values),
    });
    if (!res.ok) throw new Error((await res.json()).error ?? 'Save failed');
    setRefresh((n) => n + 1);
  };

  const handleDelete = async (id: number) => {
    const res = await fetch(`/api/training-budgets/${id}`, { method: 'DELETE' });
    if (!res.ok) {
      setError((await res.json()).error ?? 'Delete failed');
      return;
    }
    setRefresh((n) => n + 1);
  };

  const totalAllocated = records.reduce((s, r) => s + Number(r.allocatedAmount), 0);
  const totalUtilized = records.reduce((s, r) => s + Number(r.utilizedAmount), 0);

  const columns: Column<Budget>[] = [
    { key: 'year', label: 'Year', sortable: true },
    { key: 'departmentId', label: 'Department', render: (r) => deptName(r.departmentId) },
    { key: 'allocatedAmount', label: 'Allocated', render: (r) => money(r.allocatedAmount) },
    { key: 'utilizedAmount', label: 'Utilized', render: (r) => money(r.utilizedAmount) },
    {
      key: 'utilization', label: 'Utilization',
      render: (r) => {
        const pct = Number(r.allocatedAmount) > 0 ? Math.round((Number(r.utilizedAmount) / Number(r.allocatedAmount)) * 100) : 0;
        return (
          <div className="flex items-center gap-2">
            <div className="h-2 w-24 rounded-full" style={{ backgroundColor: 'var(--surface-muted)' }}>
              <div className="h-2 rounded-full" style={{
                width: `${Math.min(pct, 100)}%`,
                backgroundColor: pct >= 100 ? '#dc2626' : pct >= 75 ? '#d97706' : '#16a34a',
              }} />
            </div>
            <span className="text-xs">{pct}%</span>
          </div>
        );
      },
    },
  ];

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold" style={{ color: 'var(--foreground)' }}>Training Budgets</h1>
        <button
          onClick={() => { setEditingId(null); setInitialValues({}); setModalOpen(true); }}
          className="rounded-lg px-4 py-2 text-sm font-medium text-white transition hover:opacity-90"
          style={{ backgroundColor: 'var(--accent)' }}
        >
          + Add Budget
        </button>
      </div>

      <KPIGrid columns={3}>
        <KPICard label="Total Allocated" value={money(totalAllocated)} tone="info" />
        <KPICard label="Total Utilized" value={money(totalUtilized)} tone="warning" />
        <KPICard label="Remaining" value={money(totalAllocated - totalUtilized)} tone="success" />
      </KPIGrid>

      {error && <div className="rounded-lg px-3 py-2 text-sm" style={{ backgroundColor: '#fef2f2', color: '#dc2626', border: '1px solid #fecaca' }}>{error}</div>}

      <DataTable
        columns={columns}
        data={records}
        loading={loading}
        onEdit={(r) => {
          setEditingId(r.id);
          setInitialValues({
            year: r.year,
            departmentId: r.departmentId ?? undefined,
            allocatedAmount: Number(r.allocatedAmount),
          });
          setModalOpen(true);
        }}
        onDelete={(r) => setDeleteId(r.id)}
      />

      <FormModal title={editingId ? 'Edit Budget' : 'Add Budget'} fields={fields} initialValues={initialValues}
        isOpen={modalOpen} onClose={() => setModalOpen(false)} onSubmit={handleSubmit}
        submitLabel={editingId ? 'Update' : 'Create'} />

      <ConfirmDialog title="Delete Budget" message="Delete this budget record?"
        isOpen={deleteId !== null} onConfirm={() => deleteId && handleDelete(deleteId)} onClose={() => setDeleteId(null)} />
    </div>
  );
}
