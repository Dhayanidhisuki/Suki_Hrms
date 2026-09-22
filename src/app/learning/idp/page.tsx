'use client';

/**
 * Individual Development Plans (BRD §48/§53) — employee career-development
 * goals tied to competency/skill gaps, target levels, recommended programs
 * and mentors.
 */

import { useState, useEffect } from 'react';
import { DataTable, FormModal, ConfirmDialog, KPICard, KPIGrid } from '@/components/ui';
import type { Column, FieldDef } from '@/components/ui';
import { exportCsv } from '@/lib/exportCsv';
import { exportXlsx } from '@/lib/exportXlsx';
import { printTable } from '@/lib/printTable';

interface Idp {
  id: number;
  employeeId: number;
  title: string;
  goal: string | null;
  targetDate: string | null;
  status: string;
  approvedByUserId: number | null;
  mentorEmployeeId: number | null;
}

const fields: FieldDef[] = [
  { name: 'employeeId', label: 'Employee ID', type: 'number', required: true },
  { name: 'title', label: 'Development Goal Title', type: 'text', required: true },
  { name: 'goal', label: 'Goal / Outcome', type: 'textarea' },
  { name: 'competencyId', label: 'Competency ID', type: 'number' },
  { name: 'skillId', label: 'Skill ID', type: 'number' },
  { name: 'targetLevelId', label: 'Target Level ID', type: 'number' },
  { name: 'trainingProgramId', label: 'Recommended Program ID', type: 'number' },
  { name: 'mentorEmployeeId', label: 'Mentor Employee ID', type: 'number' },
  { name: 'startDate', label: 'Start Date', type: 'date' },
  { name: 'targetDate', label: 'Target Date', type: 'date' },
];

const TONE: Record<string, { bg: string; fg: string }> = {
  ACTIVE: { bg: '#dbeafe', fg: '#1e40af' },
  COMPLETED: { bg: '#dcfce7', fg: '#166534' },
  ON_HOLD: { bg: '#fef9c3', fg: '#854d0e' },
  CANCELLED: { bg: '#f1f5f9', fg: '#475569' },
};

export default function IdpPage() {
  const [rows, setRows] = useState<Idp[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState('');
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Idp | null>(null);
  const [deleteId, setDeleteId] = useState<number | null>(null);
  const [refresh, setRefresh] = useState(0);

  useEffect(() => {
    let mounted = true;
    fetch(`/api/idp${statusFilter ? `?status=${statusFilter}` : ''}`)
      .then(async (r) => {
        if (!r.ok) throw new Error('Failed');
        return r.json();
      })
      .then((j) => { if (mounted) setRows(j.data); })
      .catch((e) => { if (mounted) setError(e.message); })
      .finally(() => { if (mounted) setLoading(false); });
    return () => { mounted = false; };
  }, [statusFilter, refresh]);

  const handleSubmit = async (values: Record<string, string | number | boolean>) => {
    const res = await fetch(editing ? `/api/idp/${editing.id}` : '/api/idp', {
      method: editing ? 'PUT' : 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(values),
    });
    if (!res.ok) throw new Error((await res.json()).error ?? 'Save failed');
    setEditing(null);
    setRefresh((n) => n + 1);
  };

  const approve = async (id: number) => {
    const res = await fetch(`/api/idp/${id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'APPROVE' }) });
    if (!res.ok) { setError((await res.json()).error ?? 'Approve failed'); return; }
    setRefresh((n) => n + 1);
  };

  const columns: Column<Idp>[] = [
    { key: 'employeeId', label: 'Employee' },
    { key: 'title', label: 'Goal', sortable: true },
    { key: 'mentorEmployeeId', label: 'Mentor', render: (r) => r.mentorEmployeeId ?? '—' },
    { key: 'targetDate', label: 'Target', render: (r) => r.targetDate?.slice(0, 10) ?? '—' },
    {
      key: 'status', label: 'Status',
      render: (r) => {
        const t = TONE[r.status] ?? TONE.ACTIVE;
        return <span className="rounded-full px-2 py-0.5 text-xs font-medium" style={{ backgroundColor: t.bg, color: t.fg }}>{r.status.replace('_', ' ')}</span>;
      },
    },
    {
      key: 'actions', label: 'Approval',
      render: (r) => r.approvedByUserId
        ? <span className="text-xs" style={{ color: '#166534' }}>Approved</span>
        : <button onClick={() => approve(r.id)} className="rounded px-2 py-0.5 text-xs font-medium text-white" style={{ backgroundColor: '#16a34a' }}>Approve</button>,
    },
  ];

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold" style={{ color: 'var(--foreground)' }}>Individual Development Plans</h1>
        <div className="flex gap-2">
          <button
            onClick={() => exportCsv('idp.csv', rows.map((r) => ({ Employee: r.employeeId, Title: r.title, Goal: r.goal ?? '', Mentor: r.mentorEmployeeId ?? '', Target: r.targetDate?.slice(0, 10) ?? '', Status: r.status, Approved: r.approvedByUserId ? 'Yes' : 'No' })))}
            className="rounded-lg px-4 py-2 text-sm font-medium" style={{ border: '1px solid var(--border)', color: 'var(--foreground)' }}
          >
            Export CSV
          </button>
          <button
            onClick={() => exportXlsx('idp.xlsx', rows.map((r) => ({ Employee: r.employeeId, Title: r.title, Goal: r.goal ?? '', Mentor: r.mentorEmployeeId ?? '', Target: r.targetDate?.slice(0, 10) ?? '', Status: r.status, Approved: r.approvedByUserId ? 'Yes' : 'No' })), 'IDP')}
            className="rounded-lg px-4 py-2 text-sm font-medium" style={{ border: '1px solid var(--border)', color: 'var(--foreground)' }}
          >
            Export Excel
          </button>
          <button
            onClick={() => printTable('Individual Development Plans', [
              { label: 'Employee', value: (r: { employeeId: number }) => r.employeeId },
              { label: 'Title', value: (r: { title: string }) => r.title },
              { label: 'Goal', value: (r: { goal: string | null }) => r.goal },
              { label: 'Mentor', value: (r: { mentorEmployeeId: number | null }) => r.mentorEmployeeId },
              { label: 'Target', value: (r: { targetDate: string | null }) => r.targetDate?.slice(0, 10) },
              { label: 'Status', value: (r: { status: string }) => r.status },
              { label: 'Approved', value: (r: { approvedByUserId: number | null }) => (r.approvedByUserId ? 'Yes' : 'No') },
            ], rows)}
            className="rounded-lg px-4 py-2 text-sm font-medium" style={{ border: '1px solid var(--border)', color: 'var(--foreground)' }}
            title="Print or save as PDF via the browser print dialog"
          >
            Print / PDF
          </button>
          <button onClick={() => { setEditing(null); setModalOpen(true); }} className="rounded-lg px-4 py-2 text-sm font-medium text-white" style={{ backgroundColor: 'var(--accent)' }}>
            + New IDP
          </button>
        </div>
      </div>

      <KPIGrid columns={4}>
        <KPICard label="Total Plans" value={rows.length} tone="info" />
        <KPICard label="Active" value={rows.filter((r) => r.status === 'ACTIVE').length} tone="info" />
        <KPICard label="Completed" value={rows.filter((r) => r.status === 'COMPLETED').length} tone="success" />
        <KPICard label="Approved" value={rows.filter((r) => r.approvedByUserId).length} tone="success" />
      </KPIGrid>

      <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className="rounded border bg-transparent px-3 py-2 text-sm" style={{ borderColor: 'var(--border)' }}>
        <option value="">All Statuses</option>
        {Object.keys(TONE).map((s) => <option key={s} value={s}>{s.replace('_', ' ')}</option>)}
      </select>

      {error && <div className="rounded-lg px-3 py-2 text-sm" style={{ backgroundColor: '#fef2f2', color: '#dc2626', border: '1px solid #fecaca' }}>{error}</div>}

      <DataTable
        columns={columns}
        data={rows}
        loading={loading}
        onEdit={(r) => { setEditing(r); setModalOpen(true); }}
        onDelete={(r) => setDeleteId(r.id)}
        emptyMessage="No development plans yet."
      />

      <FormModal
        title={editing ? 'Edit IDP' : 'New Individual Development Plan'}
        fields={fields}
        initialValues={editing ? { ...editing, targetDate: editing.targetDate?.slice(0, 10) } as Record<string, string | number | boolean> : {}}
        isOpen={modalOpen}
        onClose={() => { setModalOpen(false); setEditing(null); }}
        onSubmit={handleSubmit}
        submitLabel={editing ? 'Update' : 'Create'}
      />

      <ConfirmDialog
        title="Delete IDP"
        message="Delete this development plan?"
        isOpen={deleteId !== null}
        onConfirm={async () => {
          if (deleteId) await fetch(`/api/idp/${deleteId}`, { method: 'DELETE' });
          setDeleteId(null);
          setRefresh((n) => n + 1);
        }}
        onClose={() => setDeleteId(null)}
      />
    </div>
  );
}
