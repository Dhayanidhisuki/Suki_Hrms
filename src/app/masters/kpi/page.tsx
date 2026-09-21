/**
 * KPI Master — BRD §9 "KPI Master" + §10 measurement methods.
 *
 * Every KPI belongs to exactly one KRA. Reached from the KRA Master's KPI
 * count (?kraId=…), which pre-filters and pre-selects that KRA.
 *
 * Target/weightage here are the *defaults* a template or goal assignment
 * starts from — BRD §17 lets a manager override both per employee.
 */

'use client';

import { Suspense, useCallback, useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import {
  Alert, Button, ConfirmDialog, DataTable, FormModal, PageHeader, SectionCard, StatusBadge,
  type Column, type FieldDef,
} from '@/components/ui';
import { MEASUREMENT_FREQUENCIES, MEASUREMENT_TYPE_OPTIONS, type MeasurementType } from '@/lib/performance/measurement';

interface Kpi {
  id: number;
  code: string;
  name: string;
  description: string;
  kraId: number;
  measurementType: MeasurementType;
  unit: string;
  target: string;
  minThreshold: string | null;
  maxTarget: string | null;
  weightage: string;
  frequency: string;
  dataSource: string | null;
  status: 'ACTIVE' | 'INACTIVE';
  kra: { id: number; code: string; name: string };
}

interface KraOption { id: number; code: string; name: string }

const inputCls = 'rounded-lg border px-3 py-2 text-sm focus:outline-none focus:ring-2';
const inputStyle = { backgroundColor: 'var(--background)', color: 'var(--foreground)', borderColor: 'var(--border)' } as const;

const TYPE_LABEL = new Map(MEASUREMENT_TYPE_OPTIONS.map((o) => [o.value, o.label]));

function KpiMasterInner() {
  const searchParams = useSearchParams();
  const kraIdFromUrl = searchParams.get('kraId') ?? '';

  const [rows, setRows] = useState<Kpi[]>([]);
  const [kras, setKras] = useState<KraOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [search, setSearch] = useState('');
  const [kraId, setKraId] = useState(kraIdFromUrl);
  const [status, setStatus] = useState('');
  const [page, setPage] = useState(1);
  const [pagination, setPagination] = useState({ page: 1, limit: 20, total: 0, totalPages: 1 });

  const [modalOpen, setModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [initialValues, setInitialValues] = useState<Record<string, string | number | boolean | undefined>>({});
  const [deleteId, setDeleteId] = useState<number | null>(null);

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({
        page: String(page),
        limit: '20',
        ...(search ? { search } : {}),
        ...(kraId ? { kraId } : {}),
        ...(status ? { status } : {}),
      });
      const res = await fetch(`/api/masters/kpi?${params}`);
      if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error ?? 'Failed to load KPIs');
      const body = await res.json();
      setRows(body.data ?? []);
      setPagination(body.pagination ?? { page: 1, limit: 20, total: 0, totalPages: 1 });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  }, [search, kraId, status, page]);

  // This page loads its data in an effect, the pattern every list screen in
  // this app uses. react-hooks/set-state-in-effect flags any setState
  // reachable from an effect — including one that only runs after an await —
  // so it cannot be satisfied by reordering; only moving data loading out of
  // effects entirely would clear it, which is a repo-wide change.
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { void fetchData(); }, [fetchData]);

  useEffect(() => {
    void (async () => {
      // Dropdown source — needs the whole set, not page 1.
      const res = await fetch('/api/masters/kra?status=ACTIVE&all=true');
      if (res.ok) setKras((await res.json()).data ?? []);
    })();
  }, []);

  const fields: FieldDef[] = useMemo(() => [
    { name: 'code', label: 'KPI Code', type: 'text', required: true, maxLength: 30, placeholder: 'e.g. KPI-REV-Q' },
    { name: 'name', label: 'KPI Name', type: 'text', required: true, placeholder: 'e.g. Quarterly Revenue' },
    { name: 'description', label: 'Description', type: 'textarea', required: true },
    {
      name: 'kraId', label: 'KRA', type: 'select', required: true,
      options: kras.map((k) => ({ label: `${k.code} — ${k.name}`, value: k.id })),
    },
    {
      name: 'measurementType', label: 'Measurement Type', type: 'select', required: true, defaultValue: 'HIGHER_IS_BETTER',
      options: MEASUREMENT_TYPE_OPTIONS.map((o) => ({ label: o.label, value: o.value })),
      helpText: 'Rating based fixes the target to the 1-5 scale',
    },
    { name: 'unit', label: 'Unit', type: 'text', required: true, maxLength: 30, placeholder: 'e.g. ₹, %, days, tickets, Rating' },
    { name: 'target', label: 'Target', type: 'number', required: true, step: '0.0001' },
    { name: 'minThreshold', label: 'Minimum Threshold', type: 'number', step: '0.0001', helpText: 'Optional' },
    { name: 'maxTarget', label: 'Maximum Target', type: 'number', step: '0.0001', helpText: 'Optional' },
    { name: 'weightage', label: 'Default Weightage (%)', type: 'number', required: true, min: 0, max: 100, step: '0.01' },
    {
      name: 'frequency', label: 'Measurement Frequency', type: 'select', required: true, defaultValue: 'QUARTERLY',
      options: MEASUREMENT_FREQUENCIES.map((f) => ({ label: f.charAt(0) + f.slice(1).toLowerCase().replace('_', '-'), value: f })),
    },
    { name: 'dataSource', label: 'Data Source', type: 'text', maxLength: 150, helpText: 'Optional — e.g. CRM export, finance MIS' },
    {
      name: 'status', label: 'Status', type: 'select', required: true, defaultValue: 'ACTIVE',
      options: [{ label: 'Active', value: 'ACTIVE' }, { label: 'Inactive', value: 'INACTIVE' }],
    },
  ], [kras]);

  const handleAdd = () => {
    setEditingId(null);
    setInitialValues({
      status: 'ACTIVE',
      measurementType: 'HIGHER_IS_BETTER',
      frequency: 'QUARTERLY',
      // Carry the filtered KRA into the form so "add a KPI to this KRA" works
      // in one click from the KRA Master.
      ...(kraId ? { kraId: Number(kraId) } : {}),
    });
    setModalOpen(true);
  };

  const handleEdit = (row: Kpi) => {
    setEditingId(row.id);
    setInitialValues({
      code: row.code,
      name: row.name,
      description: row.description,
      kraId: row.kraId,
      measurementType: row.measurementType,
      unit: row.unit,
      target: Number(row.target),
      minThreshold: row.minThreshold != null ? Number(row.minThreshold) : '',
      maxTarget: row.maxTarget != null ? Number(row.maxTarget) : '',
      weightage: Number(row.weightage),
      frequency: row.frequency,
      dataSource: row.dataSource ?? '',
      status: row.status,
    });
    setModalOpen(true);
  };

  const handleSubmit = async (values: Record<string, string | number | boolean>) => {
    const payload = {
      ...values,
      minThreshold: values.minThreshold === '' ? null : values.minThreshold,
      maxTarget: values.maxTarget === '' ? null : values.maxTarget,
      dataSource: values.dataSource || null,
    };
    const res = await fetch(editingId ? `/api/masters/kpi/${editingId}` : '/api/masters/kpi', {
      method: editingId ? 'PUT' : 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error ?? 'Save failed');
    setModalOpen(false);
    await fetchData();
  };

  const handleDelete = async (id: number) => {
    const res = await fetch(`/api/masters/kpi/${id}`, { method: 'DELETE' });
    if (!res.ok) {
      setError((await res.json().catch(() => ({}))).error ?? 'Delete failed');
      return;
    }
    await fetchData();
  };

  const columns: Column<Kpi>[] = [
    { key: 'code', label: 'Code', className: 'font-medium' },
    {
      key: 'name',
      label: 'KPI',
      render: (row) => (
        <div className="leading-tight">
          <div className="font-medium">{row.name}</div>
          <div className="text-[11px]" style={{ color: 'var(--foreground-muted)' }}>{row.kra.code} — {row.kra.name}</div>
        </div>
      ),
    },
    { key: 'measurementType', label: 'Measurement', render: (row) => <span className="text-xs">{TYPE_LABEL.get(row.measurementType) ?? row.measurementType}</span> },
    {
      key: 'target',
      label: 'Target',
      render: (row) => <span className="tabular-nums">{Number(row.target)} {row.unit}</span>,
    },
    { key: 'weightage', label: 'Default wt.', render: (row) => <span className="tabular-nums">{Number(row.weightage)}%</span> },
    { key: 'frequency', label: 'Frequency', render: (row) => <span className="text-xs">{row.frequency}</span> },
    {
      key: 'status',
      label: 'Status',
      render: (row) => <StatusBadge tone={row.status === 'ACTIVE' ? 'success' : 'danger'} dot>{row.status === 'ACTIVE' ? 'Active' : 'Inactive'}</StatusBadge>,
    },
  ];

  const activeKra = kras.find((k) => String(k.id) === kraId);

  return (
    <div className="space-y-4">
      <PageHeader
        eyebrow="Performance Masters"
        title="KPI Master"
        description="Measurable indicators, each belonging to exactly one KRA. BRD §9-§10."
        actions={<Button variant="primary" onClick={handleAdd} disabled={kras.length === 0}>+ Add KPI</Button>}
      />
      {kras.length === 0 && !loading && (
        <Alert tone="warning">Define at least one active KRA before adding KPIs — every KPI must belong to a KRA.</Alert>
      )}
      <SectionCard
        title={activeKra ? `KPIs under ${activeKra.code} — ${activeKra.name}` : 'Key Performance Indicators'}
        count={loading ? undefined : rows.length}
        flush
      >
        {error && <div className="p-3"><Alert tone="danger" onDismiss={() => setError(null)}>{error}</Alert></div>}
        <DataTable
          variant="card"
          columns={columns}
          data={rows}
          loading={loading}
          pagination={pagination}
          onPageChange={setPage}
          searchValue={search}
          searchPlaceholder="Search KPI code or name…"
          onSearchChange={(v) => { setSearch(v); setPage(1); }}
          filters={
            <>
              <select className={inputCls} style={inputStyle} value={kraId} onChange={(e) => { setKraId(e.target.value); setPage(1); }}>
                <option value="">All KRAs</option>
                {kras.map((k) => <option key={k.id} value={k.id}>{k.code} — {k.name}</option>)}
              </select>
              <select className={inputCls} style={inputStyle} value={status} onChange={(e) => { setStatus(e.target.value); setPage(1); }}>
                <option value="">All statuses</option>
                <option value="ACTIVE">Active</option>
                <option value="INACTIVE">Inactive</option>
              </select>
            </>
          }
          onEdit={handleEdit}
          onDelete={(row) => setDeleteId(row.id)}
          emptyMessage="No KPIs defined yet."
        />
      </SectionCard>
      <FormModal
        title={editingId ? 'Edit KPI' : 'Add KPI'}
        fields={fields}
        initialValues={initialValues}
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        onSubmit={handleSubmit}
        submitLabel={editingId ? 'Update' : 'Create'}
      />
      <ConfirmDialog
        isOpen={deleteId != null}
        title="Delete KPI"
        message="This cannot be undone. A KPI already used by a template or assigned goal cannot be deleted — set it Inactive instead."
        onConfirm={async () => { if (deleteId != null) await handleDelete(deleteId); setDeleteId(null); }}
        onClose={() => setDeleteId(null)}
      />
    </div>
  );
}

export default function KpiMasterPage() {
  // useSearchParams needs a Suspense boundary during prerender.
  return (
    <Suspense fallback={null}>
      <KpiMasterInner />
    </Suspense>
  );
}
