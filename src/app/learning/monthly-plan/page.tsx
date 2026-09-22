'use client';

import { useState, useEffect, useCallback } from 'react';
import { DataTable, FormModal, KPICard, KPIGrid } from '@/components/ui';
import type { Column, FieldDef } from '@/components/ui';

interface PlanLine {
  id: number;
  trainingProgramId: number;
  departmentId: number | null;
  employeeGroup: string | null;
  participantCount: number | null;
  trainerId: number | null;
  mentorEmployeeId: number | null;
  plannedDate: string | null;
  duration: number | null;
  venueId: number | null;
  method: string | null;
  budget: number | null;
  estimatedCost: number | null;
  status: string;
  trainingProgram: { id: number; name: string; category: string | null };
}

interface MonthlyPlan {
  id: number;
  trainingPlanId: number | null;
  year: number;
  month: number;
  departmentId: number | null;
  status: string;
  remarks: string | null;
  lines: PlanLine[];
}

interface Opt { id: number; name: string; }
interface AnnualPlan { id: number; year: number; name: string | null; }

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const STATUS_TONE: Record<string, { bg: string; fg: string }> = {
  DRAFT: { bg: '#e5e7eb', fg: '#374151' },
  SUBMITTED: { bg: '#fef9c3', fg: '#854d0e' },
  UNDER_REVIEW: { bg: '#fef9c3', fg: '#854d0e' },
  APPROVED: { bg: '#dbeafe', fg: '#1e40af' },
  SCHEDULED: { bg: '#dbeafe', fg: '#1e40af' },
  IN_PROGRESS: { bg: '#ffedd5', fg: '#9a3412' },
  COMPLETED: { bg: '#dcfce7', fg: '#166534' },
  CANCELLED: { bg: '#fee2e2', fg: '#991b1b' },
  POSTPONED: { bg: '#ffedd5', fg: '#9a3412' },
};

// Actions offered per status (mirrors API TRANSITIONS).
const ACTIONS: Record<string, { action: string; label: string; color: string }[]> = {
  DRAFT: [{ action: 'SUBMIT', label: 'Submit', color: 'var(--accent)' }],
  SUBMITTED: [
    { action: 'REVIEW', label: 'Start Review', color: '#d97706' },
    { action: 'APPROVE', label: 'Approve', color: '#16a34a' },
    { action: 'RETURN', label: 'Return', color: '#d97706' },
  ],
  UNDER_REVIEW: [
    { action: 'APPROVE', label: 'Approve', color: '#16a34a' },
    { action: 'RETURN', label: 'Return', color: '#d97706' },
  ],
  APPROVED: [
    { action: 'SCHEDULE', label: 'Schedule', color: 'var(--accent)' },
    { action: 'START', label: 'Start', color: '#16a34a' },
    { action: 'POSTPONE', label: 'Postpone', color: '#d97706' },
    { action: 'CANCEL', label: 'Cancel', color: '#dc2626' },
  ],
  SCHEDULED: [
    { action: 'START', label: 'Start', color: '#16a34a' },
    { action: 'POSTPONE', label: 'Postpone', color: '#d97706' },
    { action: 'CANCEL', label: 'Cancel', color: '#dc2626' },
  ],
  IN_PROGRESS: [{ action: 'COMPLETE', label: 'Complete', color: '#16a34a' }],
  POSTPONED: [
    { action: 'SUBMIT', label: 'Re-Submit', color: 'var(--accent)' },
    { action: 'CANCEL', label: 'Cancel', color: '#dc2626' },
  ],
};

export default function MonthlyPlanPage() {
  const [records, setRecords] = useState<MonthlyPlan[]>([]);
  const [programs, setPrograms] = useState<Opt[]>([]);
  const [trainers, setTrainers] = useState<Opt[]>([]);
  const [venues, setVenues] = useState<Opt[]>([]);
  const [departments, setDepartments] = useState<Opt[]>([]);
  const [annualPlans, setAnnualPlans] = useState<AnnualPlan[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [year, setYear] = useState(String(new Date().getFullYear()));
  const [status, setStatus] = useState('');
  const [page, setPage] = useState(1);
  const [pagination, setPagination] = useState({ page: 1, limit: 20, total: 0, totalPages: 0 });
  const [modalOpen, setModalOpen] = useState(false);
  const [detail, setDetail] = useState<MonthlyPlan | null>(null);
  const [lineForm, setLineForm] = useState({ trainingProgramId: '', plannedDate: '', trainerId: '', venueId: '', participantCount: '', estimatedCost: '' });
  const [refresh, setRefresh] = useState(0);

  useEffect(() => {
    const load = async () => {
      const [p, t, v, d, a] = await Promise.all([
        fetch('/api/training-programs'), fetch('/api/trainers'), fetch('/api/training-venues'),
        fetch('/api/masters/departments'), fetch('/api/training-plans?limit=100'),
      ]);
      if (p.ok) setPrograms(await p.json());
      if (t.ok) setTrainers(await t.json());
      if (v.ok) setVenues(await v.json());
      if (d.ok) {
        const j = await d.json();
        setDepartments(j.data ?? j);
      }
      if (a.ok) {
        const j = await a.json();
        setAnnualPlans(j.data ?? []);
      }
    };
    void load();
  }, []);

  const fetchPlans = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ page: String(page), limit: '20' });
      if (year) params.set('year', year);
      if (status) params.set('status', status);
      const res = await fetch(`/api/monthly-training-plans?${params}`);
      if (!res.ok) throw new Error('Failed to fetch');
      const json = await res.json();
      setRecords(json.data);
      setPagination(json.pagination);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  }, [page, year, status]);

  useEffect(() => {
    const t = setTimeout(() => void fetchPlans(), 0);
    return () => clearTimeout(t);
  }, [fetchPlans, refresh]);

  const handleCreate = async (values: Record<string, string | number | boolean>) => {
    const res = await fetch('/api/monthly-training-plans', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        year: Number(values.year),
        month: Number(values.month),
        departmentId: values.departmentId ? Number(values.departmentId) : null,
        trainingPlanId: values.trainingPlanId ? Number(values.trainingPlanId) : null,
        remarks: values.remarks || null,
        generateFromAnnual: Boolean(values.generateFromAnnual),
        lines: [],
      }),
    });
    if (!res.ok) {
      const e = await res.json();
      throw new Error(e.error ?? 'Create failed');
    }
    setModalOpen(false);
    setRefresh((n) => n + 1);
  };

  const handleAction = async (id: number, action: string) => {
    const res = await fetch(`/api/monthly-training-plans/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action }),
    });
    if (!res.ok) {
      const e = await res.json();
      setError(e.error ?? `${action} failed`);
      return;
    }
    setRefresh((n) => n + 1);
    if (detail?.id === id) {
      const j = await res.json();
      setDetail(j);
    }
  };

  const handleAddLine = async () => {
    if (!detail || !lineForm.trainingProgramId) return;
    const lines = [
      ...detail.lines.map((l) => ({
        trainingProgramId: l.trainingProgramId, departmentId: l.departmentId, employeeGroup: l.employeeGroup,
        participantCount: l.participantCount, trainerId: l.trainerId, mentorEmployeeId: l.mentorEmployeeId,
        plannedDate: l.plannedDate, duration: l.duration, venueId: l.venueId, method: l.method,
        budget: l.budget, estimatedCost: l.estimatedCost, status: l.status,
      })),
      {
        trainingProgramId: Number(lineForm.trainingProgramId),
        plannedDate: lineForm.plannedDate || null,
        trainerId: lineForm.trainerId ? Number(lineForm.trainerId) : null,
        venueId: lineForm.venueId ? Number(lineForm.venueId) : null,
        participantCount: lineForm.participantCount ? Number(lineForm.participantCount) : null,
        estimatedCost: lineForm.estimatedCost ? Number(lineForm.estimatedCost) : null,
      },
    ];
    const res = await fetch(`/api/monthly-training-plans/${detail.id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        year: detail.year, month: detail.month, departmentId: detail.departmentId,
        trainingPlanId: detail.trainingPlanId, remarks: detail.remarks, lines,
      }),
    });
    if (!res.ok) {
      const e = await res.json();
      setError(e.error ?? 'Add line failed');
      return;
    }
    const j = await res.json();
    setDetail(j);
    setLineForm({ trainingProgramId: '', plannedDate: '', trainerId: '', venueId: '', participantCount: '', estimatedCost: '' });
    setRefresh((n) => n + 1);
  };

  const fields: FieldDef[] = [
    { name: 'year', label: 'Year', type: 'number', required: true, defaultValue: new Date().getFullYear() },
    { name: 'month', label: 'Month', type: 'select', required: true, options: MONTHS.map((m, i) => ({ label: m, value: i + 1 })) },
    { name: 'departmentId', label: 'Department', type: 'select', options: [{ label: '— All —', value: 0 }, ...departments.map((d) => ({ label: d.name, value: d.id }))] },
    { name: 'trainingPlanId', label: 'Source Annual Plan', type: 'select', options: [{ label: '— None —', value: 0 }, ...annualPlans.map((p) => ({ label: `${p.name ?? 'Plan'} (${p.year})`, value: p.id }))] },
    { name: 'generateFromAnnual', label: 'Generate lines from annual plan', type: 'checkbox', defaultValue: false },
    { name: 'remarks', label: 'Remarks', type: 'text' },
  ];

  const columns: Column<MonthlyPlan>[] = [
    { key: 'year', label: 'Period', render: (r) => `${MONTHS[r.month - 1]} ${r.year}` },
    { key: 'departmentId', label: 'Department', render: (r) => departments.find((d) => d.id === r.departmentId)?.name ?? '— All —' },
    { key: 'lines', label: 'Programs', render: (r) => r.lines.length },
    { key: 'estimatedCost', label: 'Est. Cost', render: (r) => r.lines.reduce((s, l) => s + (Number(l.estimatedCost) || 0), 0).toLocaleString() },
    { key: 'status', label: 'Status', render: (r) => {
      const c = STATUS_TONE[r.status] ?? STATUS_TONE.DRAFT;
      return <span className="rounded px-2 py-0.5 text-xs font-semibold" style={{ backgroundColor: c.bg, color: c.fg }}>{r.status.replace(/_/g, ' ')}</span>;
    } },
    { key: 'id', label: 'Actions', render: (r) => (
      <div className="flex gap-1">
        <button onClick={() => setDetail(r)} className="rounded px-2 py-0.5 text-xs text-white" style={{ backgroundColor: 'var(--accent)' }}>View</button>
        {(ACTIONS[r.status] ?? []).slice(0, 1).map((a) => (
          <button key={a.action} onClick={() => void handleAction(r.id, a.action)} className="rounded px-2 py-0.5 text-xs text-white" style={{ backgroundColor: a.color }}>{a.label}</button>
        ))}
      </div>
    ) },
  ];

  const kpis = {
    total: pagination.total,
    approved: records.filter((r) => ['APPROVED', 'SCHEDULED', 'IN_PROGRESS', 'COMPLETED'].includes(r.status)).length,
    pending: records.filter((r) => ['DRAFT', 'SUBMITTED', 'UNDER_REVIEW'].includes(r.status)).length,
    completed: records.filter((r) => r.status === 'COMPLETED').length,
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold" style={{ color: 'var(--foreground)' }}>Monthly Training Plan</h1>
        <button onClick={() => setModalOpen(true)} className="rounded-lg px-4 py-2 text-sm font-medium text-white transition hover:opacity-90" style={{ backgroundColor: 'var(--accent)' }}>
          + New Monthly Plan
        </button>
      </div>

      <KPIGrid columns={4}>
        <KPICard label="Total Plans" value={kpis.total} tone="info" />
        <KPICard label="Approved+" value={kpis.approved} tone="success" />
        <KPICard label="In Approval" value={kpis.pending} tone="warning" />
        <KPICard label="Completed" value={kpis.completed} tone="info" />
      </KPIGrid>

      {error && <div className="rounded-lg px-3 py-2 text-sm" style={{ backgroundColor: '#fef2f2', color: '#dc2626', border: '1px solid #fecaca' }}>{error}</div>}

      <div className="flex flex-wrap items-center gap-3">
        <input type="number" value={year} onChange={(e) => { setYear(e.target.value); setPage(1); }} placeholder="Year" className="w-28 rounded border bg-transparent px-3 py-2 text-sm" />
        <select value={status} onChange={(e) => { setStatus(e.target.value); setPage(1); }} className="rounded border bg-transparent px-3 py-2 text-sm">
          <option value="">All statuses</option>
          {Object.keys(STATUS_TONE).map((s) => <option key={s} value={s}>{s.replace(/_/g, ' ')}</option>)}
        </select>
      </div>

      <DataTable columns={columns} data={records} pagination={pagination} loading={loading} onPageChange={setPage} />

      <FormModal
        title="New Monthly Training Plan"
        fields={fields}
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        onSubmit={handleCreate}
        submitLabel="Create"
      />

      {detail && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ backgroundColor: 'rgba(0,0,0,0.4)' }}>
          <div className="max-h-[90vh] w-full max-w-3xl overflow-y-auto rounded-xl p-5" style={{ backgroundColor: 'var(--surface)' }}>
            <div className="mb-4 flex items-start justify-between">
              <div>
                <h2 className="text-lg font-semibold" style={{ color: 'var(--foreground)' }}>
                  {MONTHS[detail.month - 1]} {detail.year} Plan
                </h2>
                <span className="mt-1 inline-block rounded px-2 py-0.5 text-xs font-semibold" style={{ backgroundColor: STATUS_TONE[detail.status]?.bg, color: STATUS_TONE[detail.status]?.fg }}>
                  {detail.status.replace(/_/g, ' ')}
                </span>
              </div>
              <button onClick={() => setDetail(null)} className="rounded px-2 py-1 text-sm" style={{ color: 'var(--foreground-muted)' }}>✕</button>
            </div>

            <div className="mb-4 flex flex-wrap gap-2">
              {(ACTIONS[detail.status] ?? []).map((a) => (
                <button key={a.action} onClick={() => void handleAction(detail.id, a.action)} className="rounded px-3 py-1 text-xs font-medium text-white" style={{ backgroundColor: a.color }}>
                  {a.label}
                </button>
              ))}
            </div>

            <h3 className="mb-2 text-sm font-medium" style={{ color: 'var(--foreground-muted)' }}>Plan Lines ({detail.lines.length})</h3>
            <table className="mb-4 w-full text-left text-sm">
              <thead>
                <tr style={{ color: 'var(--foreground-muted)' }}>
                  <th className="py-1 pr-2 font-medium">Program</th>
                  <th className="py-1 pr-2 font-medium">Date</th>
                  <th className="py-1 pr-2 font-medium">Trainer</th>
                  <th className="py-1 pr-2 font-medium">Venue</th>
                  <th className="py-1 pr-2 font-medium">Participants</th>
                  <th className="py-1 pr-2 font-medium">Est. Cost</th>
                </tr>
              </thead>
              <tbody>
                {detail.lines.map((l) => (
                  <tr key={l.id} className="border-t" style={{ borderColor: 'var(--border)' }}>
                    <td className="py-1.5 pr-2">{l.trainingProgram.name}</td>
                    <td className="py-1.5 pr-2">{l.plannedDate ? new Date(l.plannedDate).toLocaleDateString() : '—'}</td>
                    <td className="py-1.5 pr-2">{trainers.find((t) => t.id === l.trainerId)?.name ?? '—'}</td>
                    <td className="py-1.5 pr-2">{venues.find((v) => v.id === l.venueId)?.name ?? '—'}</td>
                    <td className="py-1.5 pr-2">{l.participantCount ?? '—'}</td>
                    <td className="py-1.5 pr-2">{l.estimatedCost != null ? Number(l.estimatedCost).toLocaleString() : '—'}</td>
                  </tr>
                ))}
                {detail.lines.length === 0 && <tr><td colSpan={6} className="py-4 text-center" style={{ color: 'var(--foreground-muted)' }}>No lines yet.</td></tr>}
              </tbody>
            </table>

            {['DRAFT', 'POSTPONED'].includes(detail.status) && (
              <div className="rounded-lg border p-3" style={{ borderColor: 'var(--border)' }}>
                <h4 className="mb-2 text-xs font-semibold" style={{ color: 'var(--foreground-muted)' }}>Add Line</h4>
                <div className="grid grid-cols-2 gap-2 md:grid-cols-3">
                  <select value={lineForm.trainingProgramId} onChange={(e) => setLineForm((f) => ({ ...f, trainingProgramId: e.target.value }))} className="rounded border bg-transparent px-2 py-1.5 text-sm">
                    <option value="">Program…</option>
                    {programs.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
                  </select>
                  <input type="date" value={lineForm.plannedDate} onChange={(e) => setLineForm((f) => ({ ...f, plannedDate: e.target.value }))} className="rounded border bg-transparent px-2 py-1.5 text-sm" />
                  <select value={lineForm.trainerId} onChange={(e) => setLineForm((f) => ({ ...f, trainerId: e.target.value }))} className="rounded border bg-transparent px-2 py-1.5 text-sm">
                    <option value="">Trainer…</option>
                    {trainers.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
                  </select>
                  <select value={lineForm.venueId} onChange={(e) => setLineForm((f) => ({ ...f, venueId: e.target.value }))} className="rounded border bg-transparent px-2 py-1.5 text-sm">
                    <option value="">Venue…</option>
                    {venues.map((v) => <option key={v.id} value={v.id}>{v.name}</option>)}
                  </select>
                  <input type="number" value={lineForm.participantCount} onChange={(e) => setLineForm((f) => ({ ...f, participantCount: e.target.value }))} placeholder="Participants" className="rounded border bg-transparent px-2 py-1.5 text-sm" />
                  <input type="number" value={lineForm.estimatedCost} onChange={(e) => setLineForm((f) => ({ ...f, estimatedCost: e.target.value }))} placeholder="Est. cost" className="rounded border bg-transparent px-2 py-1.5 text-sm" />
                </div>
                <button onClick={() => void handleAddLine()} disabled={!lineForm.trainingProgramId} className="mt-2 rounded px-3 py-1.5 text-xs font-medium text-white disabled:opacity-50" style={{ backgroundColor: 'var(--accent)' }}>
                  + Add Line
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
