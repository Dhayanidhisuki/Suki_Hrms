/**
 * KRA Master — BRD §8 "KRA Master".
 *
 * A KRA is a major responsibility/result area, optionally scoped to a
 * department, designation or job role. KPIs (BRD §9) hang off these; the
 * row action links through to this KRA's KPIs.
 */

'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import {
  Alert, Button, ConfirmDialog, DataTable, FormModal, PageHeader, SectionCard, StatusBadge,
  type Column, type FieldDef,
} from '@/components/ui';

interface Kra {
  id: number;
  code: string;
  name: string;
  description: string;
  departmentId: number | null;
  designationId: number | null;
  jobRole: string | null;
  category: string;
  defaultWeightage: string | null;
  status: 'ACTIVE' | 'INACTIVE';
  effectiveFrom: string;
  effectiveTo: string | null;
  _count: { kpis: number };
}

interface Option { id: number; code: string; name: string }

const inputCls = 'rounded-lg border px-3 py-2 text-sm focus:outline-none focus:ring-2';
const inputStyle = { backgroundColor: 'var(--background)', color: 'var(--foreground)', borderColor: 'var(--border)' } as const;

export default function KraMasterPage() {
  const [rows, setRows] = useState<Kra[]>([]);
  const [departments, setDepartments] = useState<Option[]>([]);
  const [designations, setDesignations] = useState<Option[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [search, setSearch] = useState('');
  const [departmentId, setDepartmentId] = useState('');
  const [designationId, setDesignationId] = useState('');
  const [status, setStatus] = useState('');

  const [modalOpen, setModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [initialValues, setInitialValues] = useState<Record<string, string | number | boolean | undefined>>({});
  const [deleteId, setDeleteId] = useState<number | null>(null);

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({
        ...(search ? { search } : {}),
        ...(departmentId ? { departmentId } : {}),
        ...(designationId ? { designationId } : {}),
        ...(status ? { status } : {}),
      });
      const res = await fetch(`/api/masters/kra?${params}`);
      if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error ?? 'Failed to load KRAs');
      setRows((await res.json()).data ?? []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  }, [search, departmentId, designationId, status]);

  // This page loads its data in an effect, the pattern every list screen in
  // this app uses. react-hooks/set-state-in-effect flags any setState
  // reachable from an effect — including one that only runs after an await —
  // so it cannot be satisfied by reordering; only moving data loading out of
  // effects entirely would clear it, which is a repo-wide change.
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { void fetchData(); }, [fetchData]);

  useEffect(() => {
    void (async () => {
      const [d, g] = await Promise.all([fetch('/api/masters/departments?limit=500'), fetch('/api/masters/designations?limit=500')]);
      if (d.ok) setDepartments((await d.json()).data ?? []);
      if (g.ok) setDesignations((await g.json()).data ?? []);
    })();
  }, []);

  const fields: FieldDef[] = useMemo(() => [
    { name: 'code', label: 'KRA Code', type: 'text', required: true, maxLength: 30, placeholder: 'e.g. KRA-REV' },
    { name: 'name', label: 'KRA Name', type: 'text', required: true, placeholder: 'e.g. Revenue Achievement' },
    { name: 'description', label: 'Description', type: 'textarea', required: true },
    { name: 'category', label: 'Category', type: 'text', required: true, placeholder: 'e.g. Financial, Operational, People' },
    {
      name: 'departmentId', label: 'Department', type: 'select',
      options: [{ label: 'All departments', value: '' }, ...departments.map((d) => ({ label: `${d.code} — ${d.name}`, value: d.id }))],
      helpText: 'Optional — leave blank to make this KRA available company-wide',
    },
    {
      name: 'designationId', label: 'Designation', type: 'select',
      options: [{ label: 'All designations', value: '' }, ...designations.map((d) => ({ label: `${d.code} — ${d.name}`, value: d.id }))],
    },
    { name: 'jobRole', label: 'Job Role', type: 'text', maxLength: 100, helpText: 'Optional free text — this system has no Job Role master' },
    { name: 'defaultWeightage', label: 'Default Weightage (%)', type: 'number', min: 0, max: 100, step: '0.01', helpText: 'Optional starting weightage when this KRA is added to a template' },
    { name: 'effectiveFrom', label: 'Effective From', type: 'date', required: true },
    { name: 'effectiveTo', label: 'Effective To', type: 'date', helpText: 'Optional — leave blank for open-ended' },
    {
      name: 'status', label: 'Status', type: 'select', required: true, defaultValue: 'ACTIVE',
      options: [{ label: 'Active', value: 'ACTIVE' }, { label: 'Inactive', value: 'INACTIVE' }],
    },
  ], [departments, designations]);

  const handleAdd = () => {
    setEditingId(null);
    setInitialValues({ status: 'ACTIVE', effectiveFrom: new Date().toISOString().slice(0, 10) });
    setModalOpen(true);
  };

  const handleEdit = (row: Kra) => {
    setEditingId(row.id);
    setInitialValues({
      code: row.code,
      name: row.name,
      description: row.description,
      category: row.category,
      departmentId: row.departmentId ?? '',
      designationId: row.designationId ?? '',
      jobRole: row.jobRole ?? '',
      defaultWeightage: row.defaultWeightage ?? '',
      effectiveFrom: row.effectiveFrom.slice(0, 10),
      effectiveTo: row.effectiveTo?.slice(0, 10) ?? '',
      status: row.status,
    });
    setModalOpen(true);
  };

  const handleSubmit = async (values: Record<string, string | number | boolean>) => {
    // Empty selects/dates come back as '' — the API's nullish fields need null.
    const payload = {
      ...values,
      departmentId: values.departmentId || null,
      designationId: values.designationId || null,
      jobRole: values.jobRole || null,
      defaultWeightage: values.defaultWeightage === '' ? null : values.defaultWeightage,
      effectiveTo: values.effectiveTo || null,
    };
    const res = await fetch(editingId ? `/api/masters/kra/${editingId}` : '/api/masters/kra', {
      method: editingId ? 'PUT' : 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error ?? 'Save failed');
    setModalOpen(false);
    await fetchData();
  };

  const handleDelete = async (id: number) => {
    const res = await fetch(`/api/masters/kra/${id}`, { method: 'DELETE' });
    if (!res.ok) {
      setError((await res.json().catch(() => ({}))).error ?? 'Delete failed');
      return;
    }
    await fetchData();
  };

  const deptName = (id: number | null) => departments.find((d) => d.id === id)?.name ?? null;
  const desigName = (id: number | null) => designations.find((d) => d.id === id)?.name ?? null;

  const columns: Column<Kra>[] = [
    { key: 'code', label: 'Code', className: 'font-medium' },
    {
      key: 'name',
      label: 'KRA',
      render: (row) => (
        <div className="leading-tight">
          <div className="font-medium">{row.name}</div>
          <div className="text-[11px]" style={{ color: 'var(--foreground-muted)' }}>{row.category}</div>
        </div>
      ),
    },
    {
      key: 'scope',
      label: 'Applies to',
      render: (row) => {
        const parts = [deptName(row.departmentId), desigName(row.designationId), row.jobRole].filter(Boolean);
        return parts.length ? parts.join(' · ') : <span style={{ color: 'var(--foreground-muted)' }}>Company-wide</span>;
      },
    },
    {
      key: 'defaultWeightage',
      label: 'Default wt.',
      render: (row) => (row.defaultWeightage != null ? `${Number(row.defaultWeightage)}%` : '—'),
    },
    {
      key: 'effective',
      label: 'Effective',
      render: (row) => (
        <span className="text-xs tabular-nums">
          {row.effectiveFrom.slice(0, 10)} → {row.effectiveTo ? row.effectiveTo.slice(0, 10) : 'open'}
        </span>
      ),
    },
    {
      key: 'kpis',
      label: 'KPIs',
      render: (row) => (
        <Link href={`/masters/kpi?kraId=${row.id}`} className="underline" style={{ color: 'var(--accent)' }}>
          {row._count.kpis}
        </Link>
      ),
    },
    {
      key: 'status',
      label: 'Status',
      render: (row) => <StatusBadge tone={row.status === 'ACTIVE' ? 'success' : 'danger'} dot>{row.status === 'ACTIVE' ? 'Active' : 'Inactive'}</StatusBadge>,
    },
  ];

  return (
    <div className="space-y-4">
      <PageHeader
        eyebrow="Performance Masters"
        title="KRA Master"
        description="Key Result Areas — the responsibility areas KPIs are measured under. BRD §8."
        actions={<Button variant="primary" onClick={handleAdd}>+ Add KRA</Button>}
      />
      <SectionCard title="Key Result Areas" count={loading ? undefined : rows.length} flush>
        {error && <div className="p-3"><Alert tone="danger" onDismiss={() => setError(null)}>{error}</Alert></div>}
        <DataTable
          variant="card"
          columns={columns}
          data={rows}
          loading={loading}
          searchValue={search}
          searchPlaceholder="Search code, name or category…"
          onSearchChange={setSearch}
          filters={
            <>
              <select className={inputCls} style={inputStyle} value={departmentId} onChange={(e) => setDepartmentId(e.target.value)}>
                <option value="">All departments</option>
                {departments.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
              </select>
              <select className={inputCls} style={inputStyle} value={designationId} onChange={(e) => setDesignationId(e.target.value)}>
                <option value="">All designations</option>
                {designations.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
              </select>
              <select className={inputCls} style={inputStyle} value={status} onChange={(e) => setStatus(e.target.value)}>
                <option value="">All statuses</option>
                <option value="ACTIVE">Active</option>
                <option value="INACTIVE">Inactive</option>
              </select>
            </>
          }
          onEdit={handleEdit}
          onDelete={(row) => setDeleteId(row.id)}
          emptyMessage="No KRAs defined yet."
        />
      </SectionCard>
      <FormModal
        title={editingId ? 'Edit KRA' : 'Add KRA'}
        fields={fields}
        initialValues={initialValues}
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        onSubmit={handleSubmit}
        submitLabel={editingId ? 'Update' : 'Create'}
      />
      <ConfirmDialog
        isOpen={deleteId != null}
        title="Delete KRA"
        message="This cannot be undone. A KRA already used by a KPI, template or assigned goal cannot be deleted — set it Inactive instead."
        onConfirm={async () => { if (deleteId != null) await handleDelete(deleteId); setDeleteId(null); }}
        onClose={() => setDeleteId(null)}
      />
    </div>
  );
}
