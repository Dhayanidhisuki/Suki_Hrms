/**
 * Performance Cycles — BRD §7.
 *
 * Minimal on purpose: the cycle window, the goal-setting window and a
 * Draft/Active/Closed status. The assessment-phase windows the BRD also
 * lists (self, manager, reviewer, finalisation) belong with the assessment
 * module and are not modelled yet.
 *
 * Goals can only be assigned inside an ACTIVE cycle, and BRD §41 bounds every
 * KPI's dates to the cycle window.
 */

'use client';

import { useCallback, useEffect, useState } from 'react';
import {
  Alert, Button, ConfirmDialog, DataTable, FormModal, PageHeader, SectionCard, StatusBadge,
  type Column, type FieldDef,
} from '@/components/ui';

interface Cycle {
  id: number;
  code: string;
  name: string;
  cycleType: 'ANNUAL' | 'HALF_YEARLY' | 'QUARTERLY';
  startDate: string;
  endDate: string;
  goalSettingStart: string;
  goalSettingEnd: string;
  status: 'DRAFT' | 'ACTIVE' | 'CLOSED';
  _count: { goalSets: number };
}

const STATUS_TONE = { DRAFT: 'neutral', ACTIVE: 'success', CLOSED: 'danger' } as const;

const fields: FieldDef[] = [
  { name: 'code', label: 'Cycle Code', type: 'text', required: true, maxLength: 30, placeholder: 'e.g. FY2026-27' },
  { name: 'name', label: 'Cycle Name', type: 'text', required: true, placeholder: 'e.g. FY 2026–27 Annual Performance Review' },
  {
    name: 'cycleType', label: 'Cycle Type', type: 'select', required: true, defaultValue: 'ANNUAL',
    options: [
      { label: 'Annual', value: 'ANNUAL' },
      { label: 'Half-yearly', value: 'HALF_YEARLY' },
      { label: 'Quarterly', value: 'QUARTERLY' },
    ],
  },
  { name: 'startDate', label: 'Cycle Start', type: 'date', required: true },
  { name: 'endDate', label: 'Cycle End', type: 'date', required: true },
  { name: 'goalSettingStart', label: 'Goal Setting Start', type: 'date', required: true, helpText: 'Must fall inside the cycle window' },
  { name: 'goalSettingEnd', label: 'Goal Setting End', type: 'date', required: true },
  {
    name: 'status', label: 'Status', type: 'select', required: true, defaultValue: 'DRAFT',
    options: [
      { label: 'Draft', value: 'DRAFT' },
      { label: 'Active', value: 'ACTIVE' },
      { label: 'Closed', value: 'CLOSED' },
    ],
    helpText: 'Goals can only be assigned while the cycle is Active',
  },
];

export default function PerformanceCyclesPage() {
  const [rows, setRows] = useState<Cycle[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState('');
  const [modalOpen, setModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [initialValues, setInitialValues] = useState<Record<string, string | number | boolean | undefined>>({});
  const [deleteId, setDeleteId] = useState<number | null>(null);

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/masters/performance-cycles?${new URLSearchParams(status ? { status } : {})}`);
      if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error ?? 'Failed to load cycles');
      setRows((await res.json()).data ?? []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  }, [status]);

  // This page loads its data in an effect, the pattern every list screen in
  // this app uses. react-hooks/set-state-in-effect flags any setState
  // reachable from an effect — including one that only runs after an await —
  // so it cannot be satisfied by reordering; only moving data loading out of
  // effects entirely would clear it, which is a repo-wide change.
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { void fetchData(); }, [fetchData]);

  const handleAdd = () => {
    setEditingId(null);
    setInitialValues({ status: 'DRAFT', cycleType: 'ANNUAL' });
    setModalOpen(true);
  };

  const handleEdit = (row: Cycle) => {
    setEditingId(row.id);
    setInitialValues({
      code: row.code,
      name: row.name,
      cycleType: row.cycleType,
      startDate: row.startDate.slice(0, 10),
      endDate: row.endDate.slice(0, 10),
      goalSettingStart: row.goalSettingStart.slice(0, 10),
      goalSettingEnd: row.goalSettingEnd.slice(0, 10),
      status: row.status,
    });
    setModalOpen(true);
  };

  const handleSubmit = async (values: Record<string, string | number | boolean>) => {
    const res = await fetch(editingId ? `/api/masters/performance-cycles/${editingId}` : '/api/masters/performance-cycles', {
      method: editingId ? 'PUT' : 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(values),
    });
    if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error ?? 'Save failed');
    setModalOpen(false);
    await fetchData();
  };

  const columns: Column<Cycle>[] = [
    { key: 'code', label: 'Code', className: 'font-medium' },
    {
      key: 'name',
      label: 'Cycle',
      render: (row) => (
        <div className="leading-tight">
          <div className="font-medium">{row.name}</div>
          <div className="text-[11px]" style={{ color: 'var(--foreground-muted)' }}>{row.cycleType.replace('_', '-')}</div>
        </div>
      ),
    },
    {
      key: 'window',
      label: 'Cycle window',
      render: (row) => <span className="text-xs tabular-nums">{row.startDate.slice(0, 10)} → {row.endDate.slice(0, 10)}</span>,
    },
    {
      key: 'goalWindow',
      label: 'Goal setting',
      render: (row) => <span className="text-xs tabular-nums">{row.goalSettingStart.slice(0, 10)} → {row.goalSettingEnd.slice(0, 10)}</span>,
    },
    { key: 'goalSets', label: 'Goal sets', render: (row) => <span className="tabular-nums">{row._count.goalSets}</span> },
    {
      key: 'status',
      label: 'Status',
      render: (row) => <StatusBadge tone={STATUS_TONE[row.status]} dot>{row.status.charAt(0) + row.status.slice(1).toLowerCase()}</StatusBadge>,
    },
  ];

  return (
    <div className="space-y-4">
      <PageHeader
        eyebrow="Performance Masters"
        title="Performance Cycles"
        description="The appraisal period goals are assigned against. BRD §7."
        actions={<Button variant="primary" onClick={handleAdd}>+ Add Cycle</Button>}
      />
      <SectionCard title="Cycles" count={loading ? undefined : rows.length} flush>
        {error && <div className="p-3"><Alert tone="danger" onDismiss={() => setError(null)}>{error}</Alert></div>}
        <DataTable
          variant="card"
          columns={columns}
          data={rows}
          loading={loading}
          filters={
            <select
              className="rounded-lg border px-3 py-2 text-sm focus:outline-none focus:ring-2"
              style={{ backgroundColor: 'var(--background)', color: 'var(--foreground)', borderColor: 'var(--border)' }}
              value={status}
              onChange={(e) => setStatus(e.target.value)}
            >
              <option value="">All statuses</option>
              <option value="DRAFT">Draft</option>
              <option value="ACTIVE">Active</option>
              <option value="CLOSED">Closed</option>
            </select>
          }
          onEdit={handleEdit}
          onDelete={(row) => setDeleteId(row.id)}
          emptyMessage="No performance cycles yet."
        />
      </SectionCard>
      <FormModal
        title={editingId ? 'Edit Cycle' : 'Add Cycle'}
        fields={fields}
        initialValues={initialValues}
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        onSubmit={handleSubmit}
        submitLabel={editingId ? 'Update' : 'Create'}
      />
      <ConfirmDialog
        isOpen={deleteId != null}
        title="Delete Cycle"
        message="This cannot be undone. A cycle that already has assigned goals cannot be deleted — close it instead."
        onConfirm={async () => {
          if (deleteId != null) {
            const res = await fetch(`/api/masters/performance-cycles/${deleteId}`, { method: 'DELETE' });
            if (!res.ok) setError((await res.json().catch(() => ({}))).error ?? 'Delete failed');
            else await fetchData();
          }
          setDeleteId(null);
        }}
        onClose={() => setDeleteId(null)}
      />
    </div>
  );
}
