'use client';

import { useState, useEffect } from 'react';
import { DataTable, FormModal, ConfirmDialog, KPICard, KPIGrid } from '@/components/ui';
import type { Column, FieldDef } from '@/components/ui';

interface Effectiveness {
  id: number;
  trainingScheduleId: number;
  employeeId: number;
  preScore: number | null;
  postScore: number | null;
  scoreImprovement: number | null;
  level1Reaction: number | null;
  level2Learning: number | null;
  level3Behavior: number | null;
  level4Results: number | null;
  effectivenessRating: string | null;
  evaluationDate: string | null;
  remarks: string | null;
}

interface Employee { id: number; firstName: string; lastName: string | null; employeeCode: string }
interface Schedule { id: number; title: string | null; scheduledDate: string | null; trainingProgram?: { name: string } | null }

export default function EffectivenessPage() {
  const [records, setRecords] = useState<Effectiveness[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [schedules, setSchedules] = useState<Schedule[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [refresh, setRefresh] = useState(0);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [initialValues, setInitialValues] = useState<Record<string, string | number | boolean | undefined>>({});
  const [deleteId, setDeleteId] = useState<number | null>(null);

  const empLabel = (e: Employee) => `${e.firstName} ${e.lastName ?? ''} (${e.employeeCode})`.trim();
  const empName = (id: number) => { const e = employees.find((x) => x.id === id); return e ? empLabel(e) : `#${id}`; };
  const schedName = (id: number) => {
    const s = schedules.find((x) => x.id === id);
    return s ? `${s.trainingProgram?.name ?? s.title ?? `#${s.id}`} (${s.scheduledDate ? s.scheduledDate.slice(0, 10) : '—'})` : `#${id}`;
  };

  useEffect(() => {
    let mounted = true;
    const load = async () => {
      setLoading(true);
      setError(null);
      try {
        const [eRes, empRes, sRes] = await Promise.all([
          fetch('/api/training-effectiveness'),
          fetch('/api/employees?limit=500'),
          fetch('/api/training-schedules?limit=200'),
        ]);
        const [eJson, empJson, sJson] = await Promise.all([eRes.json(), empRes.json(), sRes.json()]);
        if (!mounted) return;
        setRecords(Array.isArray(eJson) ? eJson : eJson.data ?? []);
        setEmployees(Array.isArray(empJson) ? empJson : empJson.data ?? []);
        setSchedules(Array.isArray(sJson) ? sJson : sJson.data ?? []);
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
    {
      name: 'trainingScheduleId', label: 'Training Schedule', type: 'select', required: true,
      options: schedules.map((s) => ({
        label: `${s.trainingProgram?.name ?? s.title ?? `Schedule #${s.id}`} — ${s.scheduledDate ? s.scheduledDate.slice(0, 10) : 'unscheduled'}`,
        value: s.id,
      })),
    },
    { name: 'employeeId', label: 'Employee', type: 'select', required: true, options: employees.map((e) => ({ label: empLabel(e), value: e.id })) },
    { name: 'preScore', label: 'Pre-Training Score (%)', type: 'number', min: 0, max: 100 },
    { name: 'postScore', label: 'Post-Training Score (%)', type: 'number', min: 0, max: 100 },
    { name: 'level1Reaction', label: 'L1 Reaction (1–5)', type: 'number', min: 1, max: 5 },
    { name: 'level2Learning', label: 'L2 Learning (%)', type: 'number', min: 0, max: 100 },
    { name: 'level3Behavior', label: 'L3 Behavior (1–5)', type: 'number', min: 1, max: 5 },
    { name: 'level4Results', label: 'L4 Results (1–5)', type: 'number', min: 1, max: 5 },
    { name: 'evaluationDate', label: 'Evaluation Date', type: 'date' },
    { name: 'remarks', label: 'Remarks', type: 'textarea' },
  ];

  const handleSubmit = async (values: Record<string, string | number | boolean>) => {
    const url = editingId ? `/api/training-effectiveness/${editingId}` : '/api/training-effectiveness';
    const res = await fetch(url, {
      method: editingId ? 'PUT' : 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(values),
    });
    if (!res.ok) throw new Error((await res.json()).error ?? 'Save failed');
    setRefresh((n) => n + 1);
  };

  const handleDelete = async (id: number) => {
    const res = await fetch(`/api/training-effectiveness/${id}`, { method: 'DELETE' });
    if (!res.ok) {
      setError((await res.json()).error ?? 'Delete failed');
      return;
    }
    setRefresh((n) => n + 1);
  };

  const columns: Column<Effectiveness>[] = [
    { key: 'employeeId', label: 'Employee', render: (r) => empName(r.employeeId) },
    { key: 'trainingScheduleId', label: 'Training', render: (r) => schedName(r.trainingScheduleId) },
    { key: 'preScore', label: 'Pre %', render: (r) => r.preScore ?? '—' },
    { key: 'postScore', label: 'Post %', render: (r) => r.postScore ?? '—' },
    { key: 'scoreImprovement', label: 'Improvement', render: (r) => (r.scoreImprovement != null ? `${r.scoreImprovement > 0 ? '+' : ''}${r.scoreImprovement}` : '—') },
    {
      key: 'effectivenessRating', label: 'Rating',
      render: (r) => r.effectivenessRating ? (
        <span className="rounded-full px-2 py-0.5 text-xs font-medium" style={{
          backgroundColor: r.effectivenessRating === 'EXCELLENT' ? '#dcfce7' : r.effectivenessRating === 'GOOD' ? '#dbeafe' : r.effectivenessRating === 'AVERAGE' ? '#fef9c3' : '#fee2e2',
          color: r.effectivenessRating === 'EXCELLENT' ? '#15803d' : r.effectivenessRating === 'GOOD' ? '#1d4ed8' : r.effectivenessRating === 'AVERAGE' ? '#a16207' : '#b91c1c',
        }}>{r.effectivenessRating}</span>
      ) : '—',
    },
  ];

  const rated = records.filter((r) => r.effectivenessRating);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold" style={{ color: 'var(--foreground)' }}>Training Effectiveness</h1>
        <button
          onClick={() => { setEditingId(null); setInitialValues({}); setModalOpen(true); }}
          className="rounded-lg px-4 py-2 text-sm font-medium text-white transition hover:opacity-90"
          style={{ backgroundColor: 'var(--accent)' }}
        >
          + Evaluate
        </button>
      </div>

      <KPIGrid columns={4}>
        <KPICard label="Evaluations" value={records.length} tone="info" />
        <KPICard label="Excellent / Good" value={rated.filter((r) => r.effectivenessRating === 'EXCELLENT' || r.effectivenessRating === 'GOOD').length} tone="success" />
        <KPICard label="Average" value={rated.filter((r) => r.effectivenessRating === 'AVERAGE').length} tone="warning" />
        <KPICard label="Poor" value={rated.filter((r) => r.effectivenessRating === 'POOR').length} tone="danger" />
      </KPIGrid>

      {error && <div className="rounded-lg px-3 py-2 text-sm" style={{ backgroundColor: '#fef2f2', color: '#dc2626', border: '1px solid #fecaca' }}>{error}</div>}

      <DataTable
        columns={columns}
        data={records}
        loading={loading}
        onEdit={(r) => {
          setEditingId(r.id);
          setInitialValues({
            trainingScheduleId: r.trainingScheduleId,
            employeeId: r.employeeId,
            preScore: r.preScore ?? undefined,
            postScore: r.postScore ?? undefined,
            level1Reaction: r.level1Reaction ?? undefined,
            level2Learning: r.level2Learning ?? undefined,
            level3Behavior: r.level3Behavior ?? undefined,
            level4Results: r.level4Results ?? undefined,
            evaluationDate: r.evaluationDate ? r.evaluationDate.slice(0, 10) : '',
            remarks: r.remarks ?? '',
          });
          setModalOpen(true);
        }}
        onDelete={(r) => setDeleteId(r.id)}
      />

      <FormModal title={editingId ? 'Edit Evaluation' : 'New Evaluation'} fields={fields} initialValues={initialValues}
        isOpen={modalOpen} onClose={() => setModalOpen(false)} onSubmit={handleSubmit}
        submitLabel={editingId ? 'Update' : 'Create'} />

      <ConfirmDialog title="Delete Evaluation" message="Delete this effectiveness evaluation?"
        isOpen={deleteId !== null} onConfirm={() => deleteId && handleDelete(deleteId)} onClose={() => setDeleteId(null)} />
    </div>
  );
}
