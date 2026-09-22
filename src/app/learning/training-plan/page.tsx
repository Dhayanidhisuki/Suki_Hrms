'use client';

import { useState, useEffect } from 'react';
import { DataTable, FormModal, KPICard, KPIGrid } from '@/components/ui';
import type { Column, FieldDef } from '@/components/ui';

interface TrainingPlan {
  id: number;
  year: string;
  title: string | null;
  departmentId: number | null;
  status: string;
}

interface TrainingProgram {
  id: number;
  code: string | null;
  name: string;
}

interface Competency {
  id: number;
  name: string;
}

interface Trainer {
  id: number;
  name: string;
}

interface TrainingPlanLine {
  id: number;
  plannedMonth: number;
  trainingPlan: { id: number; year: string; title: string | null };
  trainingProgram: { id: number; name: string };
  competency: { id: number; name: string } | null;
  trainerId: number | null;
  participantCount: number | null;
  estimatedCost: number | null;
  priority: string;
  isMandatory: boolean;
  status: string;
  traineeCategory: string | null;
  mentorType: string | null;
  mentorEmployeeId: number | null;
  externalMentorName: string | null;
  trainerType: string | null;
  targetDepartments: string | null;
  schedulePeriod: string | null;
  monthFrom: number | null;
  monthTo: number | null;
  remarks: string | null;
  postponedTo: string | null;
}

interface EmployeeOption {
  id: number;
  firstName: string;
  lastName: string;
  employeeCode: string;
}

interface ApiResponse {
  data: TrainingPlanLine[];
  pagination: { page: number; limit: number; total: number; totalPages: number };
}

const months = Array.from({ length: 12 }, (_, i) => ({ label: new Date(0, i).toLocaleString('default', { month: 'long' }), value: i + 1 }));
const statuses = ['DRAFT', 'SUBMITTED', 'APPROVED', 'SCHEDULED'];
const priorities = ['LOW', 'MEDIUM', 'HIGH'];
const traineeCategories = ['STAFF', 'WORKER'];
const mentorTypes = ['INTERNAL', 'EXTERNAL'];
const schedulePeriods = [
  { label: 'Quarterly', value: 'QUARTERLY' },
  { label: 'Half-Yearly', value: 'HALF_YEARLY' },
  { label: 'Yearly', value: 'YEARLY' },
  { label: 'Month-wise (From–To)', value: 'MONTH_WISE' },
];

export default function TrainingPlanPage() {
  const [records, setRecords] = useState<TrainingPlanLine[]>([]);
  const [plans, setPlans] = useState<TrainingPlan[]>([]);
  const [programs, setPrograms] = useState<TrainingProgram[]>([]);
  const [competencies, setCompetencies] = useState<Competency[]>([]);
  const [trainers, setTrainers] = useState<Trainer[]>([]);
  const [employees, setEmployees] = useState<EmployeeOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [year, setYear] = useState(new Date().getFullYear().toString());
  const [month, setMonth] = useState('');
  const [status, setStatus] = useState('');
  const [page, setPage] = useState(1);
  const [pagination, setPagination] = useState({ page: 1, limit: 20, total: 0, totalPages: 0 });

  const [planModalOpen, setPlanModalOpen] = useState(false);
  const [lineModalOpen, setLineModalOpen] = useState(false);
  const [editingLine, setEditingLine] = useState<TrainingPlanLine | null>(null);
  const [refresh, setRefresh] = useState(0);

  useEffect(() => {
    const loadOptions = async () => {
      const [plansRes, programsRes, compRes, trainersRes, employeesRes] = await Promise.all([
        fetch('/api/training-plans?limit=100'),
        fetch('/api/training-programs'),
        fetch('/api/competencies?limit=100'),
        fetch('/api/trainers'),
        fetch('/api/employees?limit=500'),
      ]);
      if (plansRes.ok) setPlans((await plansRes.json()).data);
      if (programsRes.ok) setPrograms(await programsRes.json());
      if (compRes.ok) setCompetencies((await compRes.json()).data);
      if (trainersRes.ok) setTrainers(await trainersRes.json());
      if (employeesRes.ok) {
        const ej = await employeesRes.json();
        setEmployees(Array.isArray(ej) ? ej : ej.data ?? []);
      }
    };
    void loadOptions();
  }, [refresh]);

  useEffect(() => {
    let mounted = true;
    const load = async () => {
      setLoading(true);
      setError(null);
      try {
        const params = new URLSearchParams({ page: String(page), limit: '20' });
        if (year) params.set('year', year);
        if (month) params.set('month', month);
        if (status) params.set('status', status);
        const res = await fetch(`/api/training-plan-lines?${params}`);
        if (!res.ok) throw new Error('Failed to fetch');
        const json: ApiResponse = await res.json();
        if (!mounted) return;
        setRecords(json.data);
        setPagination(json.pagination);
      } catch (err) {
        if (!mounted) return;
        setError(err instanceof Error ? err.message : 'Unknown error');
      } finally {
        if (!mounted) return;
        setLoading(false);
      }
    };
    void load();
    return () => { mounted = false; };
  }, [page, year, month, status, refresh]);

  const handleAddPlan = async (values: Record<string, string | number | boolean>) => {
    const payload = {
      ...values,
      status: (values.status as string)?.toUpperCase() ?? 'DRAFT',
    };
    const res = await fetch('/api/training-plans', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error ?? 'Save failed');
    }
    setRefresh((n) => n + 1);
    setPlanModalOpen(false);
  };

  const handleSaveLine = async (values: Record<string, string | number | boolean>) => {
    const numOrNull = (v: unknown) => (v ? Number(v) : null);
    const payload = {
      ...values,
      competencyId: numOrNull(values.competencyId),
      trainerId: numOrNull(values.trainerId),
      mentorEmployeeId: numOrNull(values.mentorEmployeeId),
      monthFrom: numOrNull(values.monthFrom),
      monthTo: numOrNull(values.monthTo),
      postponedTo: values.postponedTo || null,
      status: (values.status as string)?.toUpperCase() ?? 'DRAFT',
      priority: (values.priority as string)?.toUpperCase() ?? 'MEDIUM',
    };

    const url = editingLine ? `/api/training-plan-lines/${editingLine.id}` : '/api/training-plan-lines';
    const method = editingLine ? 'PUT' : 'POST';

    const res = await fetch(url, {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });

    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error ?? 'Save failed');
    }

    setRefresh((n) => n + 1);
    setLineModalOpen(false);
    setEditingLine(null);
  };

  const handleDelete = async (row: TrainingPlanLine) => {
    const res = await fetch(`/api/training-plan-lines/${row.id}`, { method: 'DELETE' });
    if (!res.ok) {
      const err = await res.json();
      setError(err.error ?? 'Delete failed');
      return;
    }
    setRefresh((n) => n + 1);
  };

  const planFields: FieldDef[] = [
    { name: 'year', label: 'Year', type: 'text', required: true, defaultValue: year },
    { name: 'departmentId', label: 'Department ID', type: 'number' },
    { name: 'title', label: 'Title', type: 'text' },
    { name: 'totalEstimatedCost', label: 'Total Estimated Cost', type: 'number' },
    { name: 'totalApprovedBudget', label: 'Total Approved Budget', type: 'number' },
    { name: 'status', label: 'Status', type: 'select', options: statuses.map((s) => ({ label: s, value: s })), defaultValue: 'DRAFT' },
  ];

  const lineFields: FieldDef[] = [
    { name: 'trainingPlanId', label: 'Training Plan', type: 'select', required: true, options: plans.map((p) => ({ label: `${p.year} — ${p.title || 'Plan'}`, value: p.id })) },
    { name: 'plannedMonth', label: 'Month', type: 'select', required: true, options: months.map((m) => ({ label: m.label, value: m.value })) },
    { name: 'competencyId', label: 'Competency (optional)', type: 'select', options: [{ label: '— None —', value: 0 }, ...competencies.map((c) => ({ label: c.name, value: c.id }))] },
    { name: 'trainingProgramId', label: 'Training Program', type: 'select', required: true, options: programs.map((p) => ({ label: p.name, value: p.id })) },
    { name: 'trainerId', label: 'Trainer (optional)', type: 'select', options: [{ label: '— None —', value: 0 }, ...trainers.map((t) => ({ label: t.name, value: t.id }))] },
    { name: 'trainerType', label: 'Trainer Type (e.g. Competency Based)', type: 'text' },
    { name: 'traineeCategory', label: 'Trainee Category', type: 'select', options: [{ label: '— Select —', value: '' }, ...traineeCategories.map((c) => ({ label: c === 'STAFF' ? 'Staff' : 'Worker', value: c }))] },
    { name: 'targetDepartments', label: 'Departments / Trainees (manual)', type: 'textarea', placeholder: 'e.g. 1. MED  2. Production  3. Quality' },
    { name: 'mentorType', label: 'Mentor Type', type: 'select', options: [{ label: '— None —', value: '' }, ...mentorTypes.map((m) => ({ label: m === 'INTERNAL' ? 'Internal' : 'External', value: m }))] },
    { name: 'mentorEmployeeId', label: 'Internal Mentor (employee)', type: 'select', options: [{ label: '— Select employee —', value: 0 }, ...employees.map((e) => ({ label: `${e.firstName} ${e.lastName} (${e.employeeCode})`, value: e.id }))], helpText: 'Used when Mentor Type = Internal' },
    { name: 'externalMentorName', label: 'External Mentor Name', type: 'text', placeholder: 'Type mentor name manually', helpText: 'Used when Mentor Type = External' },
    { name: 'schedulePeriod', label: 'Schedule Period', type: 'select', options: [{ label: '— Select —', value: '' }, ...schedulePeriods] },
    { name: 'monthFrom', label: 'From Month (month-wise)', type: 'select', options: [{ label: '—', value: '' }, ...months.map((m) => ({ label: m.label, value: m.value }))] },
    { name: 'monthTo', label: 'To Month (month-wise)', type: 'select', options: [{ label: '—', value: '' }, ...months.map((m) => ({ label: m.label, value: m.value }))] },
    { name: 'postponedTo', label: 'Postponed To (date)', type: 'date' },
    { name: 'remarks', label: 'Remarks', type: 'textarea' },
    { name: 'participantCount', label: 'Participants', type: 'number' },
    { name: 'estimatedCost', label: 'Estimated Cost', type: 'number' },
    { name: 'priority', label: 'Priority', type: 'select', options: priorities.map((p) => ({ label: p, value: p })), defaultValue: 'MEDIUM' },
    { name: 'isMandatory', label: 'Mandatory', type: 'checkbox', defaultValue: false },
    { name: 'status', label: 'Status', type: 'select', options: statuses.map((s) => ({ label: s, value: s })), defaultValue: 'DRAFT' },
  ];

  const lineInitialValues = editingLine
    ? {
        trainingPlanId: editingLine.trainingPlan.id,
        plannedMonth: editingLine.plannedMonth,
        competencyId: editingLine.competency?.id ?? 0,
        trainingProgramId: editingLine.trainingProgram.id,
        trainerId: editingLine.trainerId ?? 0,
        trainerType: editingLine.trainerType ?? '',
        traineeCategory: editingLine.traineeCategory ?? '',
        targetDepartments: editingLine.targetDepartments ?? '',
        mentorType: editingLine.mentorType ?? '',
        mentorEmployeeId: editingLine.mentorEmployeeId ?? 0,
        externalMentorName: editingLine.externalMentorName ?? '',
        schedulePeriod: editingLine.schedulePeriod ?? '',
        monthFrom: editingLine.monthFrom ?? '',
        monthTo: editingLine.monthTo ?? '',
        postponedTo: editingLine.postponedTo ? editingLine.postponedTo.slice(0, 10) : '',
        remarks: editingLine.remarks ?? '',
        participantCount: editingLine.participantCount ?? '',
        estimatedCost: editingLine.estimatedCost ?? '',
        priority: editingLine.priority,
        isMandatory: editingLine.isMandatory,
        status: editingLine.status,
      }
    : { status: 'DRAFT', priority: 'MEDIUM', isMandatory: false };

  const columns: Column<TrainingPlanLine>[] = [
    { key: 'planYear', label: 'Year', render: (row) => row.trainingPlan.year },
    { key: 'planTitle', label: 'Plan', render: (row) => row.trainingPlan.title || '—' },
    { key: 'plannedMonth', label: 'Month', render: (row) => months[row.plannedMonth - 1]?.label || row.plannedMonth },
    { key: 'trainingProgram', label: 'Program', render: (row) => row.trainingProgram.name },
    { key: 'competency', label: 'Competency', render: (row) => row.competency?.name || '—' },
    { key: 'participantCount', label: 'Participants', render: (row) => row.participantCount ?? '—' },
    { key: 'estimatedCost', label: 'Est. Cost', render: (row) => (row.estimatedCost != null ? `₹${row.estimatedCost}` : '—') },
    { key: 'priority', label: 'Priority' },
    { key: 'status', label: 'Status' },
  ];

  // §14: annual plan approval workflow (SUBMIT/APPROVE/REJECT/RETURN/RESUBMIT/CANCEL).
  const planAction = async (planId: number, action: string) => {
    const reason = ['REJECT', 'RETURN'].includes(action) ? window.prompt(`${action} reason:`) ?? '' : undefined;
    const res = await fetch(`/api/training-plans/${planId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action, reason }),
    });
    if (!res.ok) {
      setError((await res.json()).error ?? `${action} failed`);
      return;
    }
    setRefresh((n) => n + 1);
  };

  const planButtons = (p: TrainingPlan): { action: string; label: string; color: string }[] => {
    switch (p.status) {
      case 'DRAFT': return [{ action: 'SUBMIT', label: 'Submit', color: 'var(--accent)' }];
      case 'RETURNED': return [{ action: 'RESUBMIT', label: 'Resubmit', color: 'var(--accent)' }];
      case 'SUBMITTED':
      case 'UNDER_REVIEW':
        return [
          { action: 'APPROVE', label: 'Approve', color: '#059669' },
          { action: 'RETURN', label: 'Return', color: '#d97706' },
          { action: 'REJECT', label: 'Reject', color: '#dc2626' },
        ];
      case 'APPROVED': return [{ action: 'CANCEL', label: 'Cancel', color: '#dc2626' }];
      default: return [];
    }
  };

  const kpis = {
    planned: records.length,
    pending: records.filter((r) => r.status === 'DRAFT' || r.status === 'SUBMITTED').length,
    approved: records.filter((r) => r.status === 'APPROVED' || r.status === 'SCHEDULED').length,
    cost: records.reduce((sum, r) => sum + (r.estimatedCost || 0), 0),
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold" style={{ color: 'var(--foreground)' }}>Training Plan</h1>
        <div className="flex gap-2">
          <button
            onClick={() => setPlanModalOpen(true)}
            className="rounded-lg px-3 py-2 text-sm font-medium text-white transition hover:opacity-90"
            style={{ backgroundColor: 'var(--accent)' }}
          >
            + Add Plan
          </button>
          <button
            onClick={() => { setEditingLine(null); setLineModalOpen(true); }}
            className="rounded-lg px-3 py-2 text-sm font-medium text-white transition hover:opacity-90"
            style={{ backgroundColor: '#0ea5e9' }}
          >
            + Add Line
          </button>
        </div>
      </div>

      <KPIGrid columns={4}>
        <KPICard label="Planned Programs" value={kpis.planned} tone="info" />
        <KPICard label="Pending Approvals" value={kpis.pending} tone="warning" />
        <KPICard label="Approved / Scheduled" value={kpis.approved} tone="success" />
        <KPICard label="Estimated Cost" value={`₹${kpis.cost.toLocaleString()}`} tone="info" />
      </KPIGrid>

      {plans.filter((p) => !year || p.year === year).length > 0 && (
        <div className="rounded-xl border p-4" style={{ borderColor: 'var(--border)' }}>
          <h2 className="mb-2 text-sm font-semibold" style={{ color: 'var(--foreground)' }}>Plan Approval</h2>
          <div className="space-y-1">
            {plans.filter((p) => !year || p.year === year).map((p) => (
              <div key={p.id} className="flex items-center justify-between text-sm" style={{ color: 'var(--foreground)' }}>
                <span>
                  {p.title ?? `Plan #${p.id}`} <em className="text-xs" style={{ color: 'var(--foreground-muted)' }}>({p.year})</em>
                  <span className="ml-2 rounded-full px-2 py-0.5 text-xs font-medium" style={{ backgroundColor: 'var(--surface-muted)', color: 'var(--foreground-muted)' }}>{p.status}</span>
                </span>
                <span className="flex gap-1">
                  <a
                    href={`/api/training-plans/${p.id}/export-excel`}
                    className="rounded px-2 py-0.5 text-xs font-medium text-white"
                    style={{ backgroundColor: '#0d9488' }}
                    title="Download annual training calendar (reference Excel format)"
                  >
                    Calendar Excel
                  </a>
                  {planButtons(p).map((b) => (
                    <button key={b.action} onClick={() => void planAction(p.id, b.action)} className="rounded px-2 py-0.5 text-xs font-medium text-white" style={{ backgroundColor: b.color }}>
                      {b.label}
                    </button>
                  ))}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {error && (
        <div
          className="rounded-lg px-3 py-2 text-sm"
          style={{ backgroundColor: '#fef2f2', color: '#dc2626', border: '1px solid #fecaca' }}
        >
          {error}
        </div>
      )}

      <div className="flex flex-wrap items-center gap-3">
        <input
          type="text"
          value={year}
          onChange={(e) => { setYear(e.target.value); setPage(1); }}
          placeholder="Year"
          className="rounded border bg-transparent px-3 py-2 text-sm"
        />
        <select
          value={month}
          onChange={(e) => { setMonth(e.target.value); setPage(1); }}
          className="rounded border bg-transparent px-3 py-2 text-sm"
        >
          <option value="">All months</option>
          {months.map((m) => <option key={m.value} value={m.value}>{m.label}</option>)}
        </select>
        <select
          value={status}
          onChange={(e) => { setStatus(e.target.value); setPage(1); }}
          className="rounded border bg-transparent px-3 py-2 text-sm"
        >
          <option value="">All statuses</option>
          {statuses.map((s) => <option key={s} value={s}>{s}</option>)}
        </select>
      </div>

      <DataTable
        columns={columns}
        data={records}
        pagination={pagination}
        loading={loading}
        onPageChange={setPage}
        onEdit={(row) => { setEditingLine(row); setLineModalOpen(true); }}
        onDelete={handleDelete}
      />

      <FormModal
        title="Add Training Plan"
        fields={planFields}
        initialValues={{}}
        isOpen={planModalOpen}
        onClose={() => setPlanModalOpen(false)}
        onSubmit={handleAddPlan}
        submitLabel="Create Plan"
      />

      <FormModal
        title={editingLine ? 'Edit Plan Line' : 'Add Plan Line'}
        fields={lineFields}
        initialValues={lineInitialValues}
        isOpen={lineModalOpen}
        onClose={() => { setLineModalOpen(false); setEditingLine(null); }}
        onSubmit={handleSaveLine}
        submitLabel={editingLine ? 'Update' : 'Create'}
      />
    </div>
  );
}
