'use client';

import { useState, useEffect } from 'react';
import { DataTable, FormModal, KPICard, KPIGrid } from '@/components/ui';
import type { Column, FieldDef } from '@/components/ui';

interface TrainingSchedule {
  id: number;
  title: string | null;
  scheduledDate: string | null;
  startTime: string | null;
  endTime: string | null;
  method: string | null;
  maxParticipants: number | null;
  status: string;
  checklistId: number | null;
  mentorId: number | null;
  mentorRole: string | null;
  mentorStartDate: string | null;
  mentorEndDate: string | null;
  mentorOutcome: string | null;
  resourceIds: string | null;
  trainingProgram: { id: number; name: string };
}

interface TrainingProgram { id: number; name: string; }
interface Trainer { id: number; name: string; }
interface Venue { id: number; name: string; }
interface Mentor { id: number; name: string; }
interface TrainingResource { id: number; name: string; resourceType: string | null; quantity: number; status: string }
interface ChecklistTemplate { id: number; name: string; }
interface ChecklistItem { itemId: number; label: string; isMandatory: boolean; auto: boolean; done: boolean; checkedAt: string | null; }
interface ChecklistData { scheduleId: number; checklistId: number | null; checklistName: string | null; items: ChecklistItem[]; completedCount?: number; mandatoryPending?: number; }
interface CostItem { id: number; head: string; amount: number; description: string | null; }
const COST_HEADS = ['TRAINER_FEE', 'VENUE', 'TRAVEL', 'ACCOMMODATION', 'MATERIAL', 'CERTIFICATION', 'SOFTWARE', 'FOOD', 'EMPLOYEE_TRAVEL', 'OTHER'];

// §22/§28: trainer/HR marks attendance per nominee.
interface AttRow { employeeId: number; name: string; status: string; attendedDuration: string; remarks: string; }
const ATT_STATUSES = ['PRESENT', 'ABSENT', 'EXCUSED', 'LATE'];

interface ApiResponse {
  data: TrainingSchedule[];
  pagination: { page: number; limit: number; total: number; totalPages: number };
}

const statuses = ['PENDING', 'SCHEDULED', 'COMPLETED', 'CANCELLED'];
const methods = ['CLASSROOM', 'ONLINE', 'OJT', 'SEMINAR', 'WORKSHOP'];

export default function TrainingCalendarPage() {
  const [records, setRecords] = useState<TrainingSchedule[]>([]);
  const [programs, setPrograms] = useState<TrainingProgram[]>([]);
  const [trainers, setTrainers] = useState<Trainer[]>([]);
  const [venues, setVenues] = useState<Venue[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [attNotice, setAttNotice] = useState<string | null>(null);
  const [month, setMonth] = useState(() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
  });
  const [status, setStatus] = useState('');
  const [page, setPage] = useState(1);
  const [pagination, setPagination] = useState({ page: 1, limit: 20, total: 0, totalPages: 0 });
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<TrainingSchedule | null>(null);
  const [refresh, setRefresh] = useState(0);
  const [checklistTemplates, setChecklistTemplates] = useState<ChecklistTemplate[]>([]);
  const [mentors, setMentors] = useState<Mentor[]>([]);
  const [resources, setResources] = useState<TrainingResource[]>([]);
  const [methodOptions, setMethodOptions] = useState<string[]>([]);
  const [checklistFor, setChecklistFor] = useState<TrainingSchedule | null>(null);
  const [checklistData, setChecklistData] = useState<ChecklistData | null>(null);
  const [checklistLoading, setChecklistLoading] = useState(false);
  const [costsFor, setCostsFor] = useState<TrainingSchedule | null>(null);
  const [costs, setCosts] = useState<CostItem[]>([]);
  const [costsLoading, setCostsLoading] = useState(false);
  const [costForm, setCostForm] = useState({ head: 'TRAINER_FEE', amount: '', description: '' });
  const [attFor, setAttFor] = useState<TrainingSchedule | null>(null);
  const [attRows, setAttRows] = useState<AttRow[]>([]);
  const [attLoading, setAttLoading] = useState(false);
  const [empNames, setEmpNames] = useState<Record<number, string>>({});
  // §16: calendar views — list, month grid, week, day, year (color-coded).
  const [view, setView] = useState<'list' | 'grid' | 'week' | 'day' | 'year'>('list');
  const [gridRecords, setGridRecords] = useState<TrainingSchedule[]>([]);
  const [weekAnchor, setWeekAnchor] = useState(() => new Date().toISOString().slice(0, 10));
  const [dayAnchor, setDayAnchor] = useState(() => new Date().toISOString().slice(0, 10));
  const [yearAnchor, setYearAnchor] = useState(() => new Date().getFullYear());
  // §19: availability browser.
  const [availOpen, setAvailOpen] = useState(false);
  const [availDate, setAvailDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [availData, setAvailData] = useState<{ venues: { id: number; name: string; capacity: number | null; available: boolean; bookings: { id: number; title: string; startTime: string | null; endTime: string | null }[] }[]; resources: { id: number; name: string; resourceType: string | null; quantity: number; status: string; used: number; remaining: number; available: boolean }[] } | null>(null);
  const [availLoading, setAvailLoading] = useState(false);

  const loadAvailability = async (d: string) => {
    setAvailLoading(true);
    try {
      const res = await fetch(`/api/training-schedules/availability?date=${d}`);
      if (res.ok) setAvailData(await res.json());
    } finally {
      setAvailLoading(false);
    }
  };

  useEffect(() => {
    const loadOptions = async () => {
      const [p, t, v, c, e, m, r] = await Promise.all([
        fetch('/api/training-programs'),
        fetch('/api/trainers'),
        fetch('/api/training-venues'),
        fetch('/api/training-checklists'),
        fetch('/api/employees?limit=500'),
        fetch('/api/training-mentors'),
        fetch('/api/training-resources'),
      ]);
      if (p.ok) setPrograms(await p.json());
      if (t.ok) setTrainers(await t.json());
      if (v.ok) setVenues(await v.json());
      if (m.ok) { const j = await m.json(); setMentors(j.data ?? []); }
      if (r.ok) { const j = await r.json(); setResources(j.data ?? []); }
      // §9: method dropdown prefers the TrainingMethod master; legacy values kept.
      try {
        const mj = await fetch('/api/training-methods');
        if (mj.ok) {
          const list = (await mj.json()).data ?? [];
          const names = list.filter((x: { isActive: boolean }) => x.isActive).map((x: { name: string }) => x.name);
          setMethodOptions([...new Set([...methods, ...names])]);
        }
      } catch { /* master unavailable — fall back to static list */ }
      if (c.ok) {
        const j = await c.json();
        setChecklistTemplates(j.data ?? []);
      }
      if (e.ok) {
        const j = await e.json();
        const list = Array.isArray(j) ? j : j.data ?? [];
        const map: Record<number, string> = {};
        for (const emp of list) map[emp.id] = emp.fullName ?? emp.name ?? `#${emp.id}`;
        setEmpNames(map);
      }
    };
    void loadOptions();
  }, []);

  const openChecklist = async (row: TrainingSchedule) => {
    setChecklistFor(row);
    setChecklistLoading(true);
    setChecklistData(null);
    try {
      const res = await fetch(`/api/training-schedules/${row.id}/checklist`);
      if (res.ok) {
        const j = await res.json();
        setChecklistData(j.data);
      }
    } finally {
      setChecklistLoading(false);
    }
  };

  const toggleChecklistItem = async (itemId: number, done: boolean) => {
    if (!checklistFor) return;
    const res = await fetch(`/api/training-schedules/${checklistFor.id}/checklist`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ itemId, done }),
    });
    if (res.ok) await openChecklist(checklistFor);
  };

  const openCosts = async (row: TrainingSchedule) => {
    setCostsFor(row);
    setCostsLoading(true);
    try {
      const res = await fetch(`/api/training-cost-items?scheduleId=${row.id}`);
      if (res.ok) {
        const j = await res.json();
        setCosts(j.data ?? []);
      }
    } finally {
      setCostsLoading(false);
    }
  };

  const addCost = async () => {
    if (!costsFor || !costForm.amount) return;
    const res = await fetch('/api/training-cost-items', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        trainingScheduleId: costsFor.id,
        head: costForm.head,
        amount: Number(costForm.amount),
        description: costForm.description || null,
      }),
    });
    if (!res.ok) {
      const e = await res.json();
      setError(e.error ?? 'Add cost failed');
      return;
    }
    setCostForm({ head: 'TRAINER_FEE', amount: '', description: '' });
    await openCosts(costsFor);
  };

  const removeCost = async (itemId: number) => {
    const res = await fetch(`/api/training-cost-items/${itemId}`, { method: 'DELETE' });
    if (res.ok && costsFor) await openCosts(costsFor);
  };

  // §22: trainer/HR attendance marking — merge nominations with existing marks.
  const openAttendance = async (row: TrainingSchedule) => {
    setAttFor(row);
    setAttNotice(null);
    setAttLoading(true);
    try {
      const [nRes, aRes] = await Promise.all([
        fetch(`/api/training-nominations?scheduleId=${row.id}&limit=200`),
        fetch(`/api/training-attendance?scheduleId=${row.id}`),
      ]);
      const nJson = nRes.ok ? await nRes.json() : { data: [] };
      const aJson = aRes.ok ? await aRes.json() : { data: [] };
      const marked = new Map<number, { status: string; attendedDuration: number | null; remarks: string | null }>();
      for (const a of aJson.data ?? []) {
        marked.set(a.employeeId, { status: a.status, attendedDuration: a.attendedDuration, remarks: a.remarks });
      }
      const noms = nJson.data ?? nJson.nominations ?? [];
      setAttRows(
        noms
          .filter((n: { status?: string }) => n.status !== 'CANCELLED' && n.status !== 'REJECTED')
          .map((n: { employeeId: number }) => {
            const m = marked.get(n.employeeId);
            return {
              employeeId: n.employeeId,
              name: empNames[n.employeeId] ?? `Employee #${n.employeeId}`,
              status: m?.status ?? 'ABSENT',
              attendedDuration: m?.attendedDuration != null ? String(m.attendedDuration) : '',
              remarks: m?.remarks ?? '',
            };
          }),
      );
    } finally {
      setAttLoading(false);
    }
  };

  const saveAttendance = async () => {
    if (!attFor || attRows.length === 0) return;
    const res = await fetch('/api/training-attendance', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        trainingScheduleId: attFor.id,
        rows: attRows.map((r) => ({
          employeeId: r.employeeId,
          status: r.status,
          attendedDuration: r.attendedDuration ? Number(r.attendedDuration) : null,
          remarks: r.remarks || null,
        })),
      }),
    });
    if (!res.ok) {
      setError((await res.json()).error ?? 'Attendance save failed');
      return;
    }
    setAttFor(null);
    setAttRows([]);
  };

  // §22: pre-fill attendance rows from HRMS daily attendance for the date.
  const pullHrms = async () => {
    if (!attFor) return;
    const res = await fetch('/api/training-attendance/pull', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ trainingScheduleId: attFor.id }),
    });
    const json = await res.json();
    if (!res.ok) {
      setError(json.error ?? 'HRMS pull failed');
      return;
    }
    setError(null);
    setAttNotice(`Pulled ${json.pulled} rows from HRMS attendance (${json.skipped} skipped)`);
    await openAttendance(attFor);
  };

  useEffect(() => {
    let mounted = true;
    const load = async () => {
      setLoading(true);
      setError(null);
      try {
        const params = new URLSearchParams({ page: String(page), limit: '20' });
        if (month) params.set('month', month);
        if (status) params.set('status', status);
        const res = await fetch(`/api/training-schedules?${params}`);
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
  }, [page, month, status, refresh]);

  // Non-list views need a wider unpaginated fetch for their range.
  useEffect(() => {
    if (view === 'list') return;
    let mounted = true;
    const load = async () => {
      const params = new URLSearchParams({ page: '1', limit: '500' });
      if (view === 'year') {
        params.set('year', String(yearAnchor));
      } else {
        const anchorMonth = view === 'week' ? weekAnchor.slice(0, 7) : view === 'day' ? dayAnchor.slice(0, 7) : month;
        if (anchorMonth) params.set('month', anchorMonth);
      }
      if (status) params.set('status', status);
      const res = await fetch(`/api/training-schedules?${params}`);
      if (res.ok && mounted) {
        const j: ApiResponse = await res.json();
        setGridRecords(j.data);
      }
    };
    void load();
    return () => { mounted = false; };
  }, [view, month, status, refresh, weekAnchor, dayAnchor, yearAnchor]);

  const handleSave = async (values: Record<string, string | number | boolean>) => {
    const payload = {
      ...values,
      status: (values.status as string)?.toUpperCase() ?? 'PENDING',
      trainingProgramId: Number(values.trainingProgramId),
      trainerId: values.trainerId ? Number(values.trainerId) : null,
      coTrainerId: values.coTrainerId ? Number(values.coTrainerId) : null,
      venueId: values.venueId ? Number(values.venueId) : null,
      maxParticipants: values.maxParticipants ? Number(values.maxParticipants) : null,
      targetDepartmentId: values.targetDepartmentId ? Number(values.targetDepartmentId) : null,
      trainingPlanLineId: values.trainingPlanLineId ? Number(values.trainingPlanLineId) : null,
      checklistId: values.checklistId ? Number(values.checklistId) : null,
      mentorId: values.mentorId ? Number(values.mentorId) : null,
      // §19: resourceIds is stored as a JSON array string.
      resourceIds: values.resourceIds
        ? JSON.stringify(String(values.resourceIds).split(',').map((s) => Number(s.trim())).filter((n) => Number.isInteger(n) && n > 0))
        : null,
    };

    const url = editing ? `/api/training-schedules/${editing.id}` : '/api/training-schedules';
    const method = editing ? 'PUT' : 'POST';

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
    setModalOpen(false);
    setEditing(null);
  };

  const handleDelete = async (row: TrainingSchedule) => {
    const res = await fetch(`/api/training-schedules/${row.id}`, { method: 'DELETE' });
    if (!res.ok) {
      const err = await res.json();
      setError(err.error ?? 'Delete failed');
      return;
    }
    setRefresh((n) => n + 1);
  };

  const statusColor = (s: string) => {
    switch (s) {
      case 'SCHEDULED': return { bg: '#dbeafe', text: '#1e40af' };
      case 'COMPLETED': return { bg: '#dcfce7', text: '#166534' };
      case 'PENDING': return { bg: '#fef9c3', text: '#854d0e' };
      case 'CANCELLED': return { bg: '#fee2e2', text: '#991b1b' };
      default: return { bg: '#e5e7eb', text: '#374151' };
    }
  };

  const columns: Column<TrainingSchedule>[] = [
    { key: 'scheduledDate', label: 'Date', render: (row) => (row.scheduledDate ? new Date(row.scheduledDate).toLocaleDateString() : '—') },
    { key: 'trainingProgram', label: 'Program', render: (row) => row.trainingProgram.name },
    { key: 'title', label: 'Title', render: (row) => row.title || '—' },
    { key: 'startTime', label: 'Time', render: (row) => [row.startTime, row.endTime].filter(Boolean).join(' - ') || '—' },
    { key: 'method', label: 'Method', render: (row) => row.method || '—' },
    { key: 'maxParticipants', label: 'Max', render: (row) => row.maxParticipants ?? '—' },
    { key: 'status', label: 'Status', render: (row) => {
      const c = statusColor(row.status);
      return <span className="rounded px-2 py-0.5 text-xs font-semibold" style={{ backgroundColor: c.bg, color: c.text }}>{row.status}</span>;
    } },
    { key: 'checklistId', label: 'Checklist', render: (row) =>
      row.checklistId ? (
        <button onClick={() => void openChecklist(row)} className="rounded px-2 py-0.5 text-xs text-white" style={{ backgroundColor: 'var(--accent)' }}>
          View
        </button>
      ) : '—',
    },
    { key: 'id', label: 'Costs', render: (row) => (
      <button onClick={() => void openCosts(row)} className="rounded px-2 py-0.5 text-xs text-white" style={{ backgroundColor: '#7c3aed' }}>
        Costs
      </button>
    ) },
    { key: 'status2', label: 'Attend.', render: (row) => (
      <button onClick={() => void openAttendance(row)} className="rounded px-2 py-0.5 text-xs text-white" style={{ backgroundColor: '#059669' }}>
        Mark
      </button>
    ) },
  ];

  const fields: FieldDef[] = [
    { name: 'trainingProgramId', label: 'Training Program', type: 'select', required: true, options: programs.map((p) => ({ label: p.name, value: p.id })) },
    { name: 'title', label: 'Title', type: 'text' },
    { name: 'scheduledDate', label: 'Date', type: 'date' },
    { name: 'startTime', label: 'Start Time', type: 'text', placeholder: '09:00' },
    { name: 'endTime', label: 'End Time', type: 'text', placeholder: '17:00' },
    { name: 'duration', label: 'Duration (hours)', type: 'number' },
    { name: 'method', label: 'Method', type: 'select', options: (methodOptions.length ? methodOptions : methods).map((m) => ({ label: m, value: m })) },
    { name: 'venueId', label: 'Venue', type: 'select', options: [{ label: '— None —', value: 0 }, ...venues.map((v) => ({ label: v.name, value: v.id }))] },
    { name: 'meetingLink', label: 'Meeting Link', type: 'text' },
    { name: 'trainerId', label: 'Trainer', type: 'select', options: [{ label: '— None —', value: 0 }, ...trainers.map((t) => ({ label: t.name, value: t.id }))] },
    { name: 'coTrainerId', label: 'Co-Trainer', type: 'select', options: [{ label: '— None —', value: 0 }, ...trainers.map((t) => ({ label: t.name, value: t.id }))] },
    { name: 'coordinator', label: 'Coordinator', type: 'text' },
    // §17: mentor master link + per-schedule engagement window.
    { name: 'mentorId', label: 'Mentor (Master)', type: 'select', options: [{ label: '— None —', value: 0 }, ...mentors.map((m) => ({ label: m.name, value: m.id }))] },
    { name: 'mentorRole', label: 'Mentor Role', type: 'text', placeholder: 'e.g. Coach, Guide' },
    { name: 'mentorStartDate', label: 'Mentor Start', type: 'date' },
    { name: 'mentorEndDate', label: 'Mentor End', type: 'date' },
    { name: 'mentorOutcome', label: 'Mentor Expected Outcome', type: 'text' },
    // §19: bookable resources (comma-separated TrainingResource ids).
    { name: 'resourceIds', label: 'Resources', type: 'text', placeholder: 'comma-separated resource IDs', helpText: resources.length ? `Available: ${resources.filter((r) => r.status === 'AVAILABLE').map((r) => `${r.id}:${r.name}`).join(', ')}` : 'No resources configured' },
    { name: 'maxParticipants', label: 'Max Participants', type: 'number' },
    { name: 'targetDepartmentId', label: 'Target Department ID', type: 'number' },
    { name: 'targetEmployeeIds', label: 'Target Employee IDs', type: 'text', placeholder: 'comma-separated IDs' },
    { name: 'checklistId', label: 'Checklist', type: 'select', options: [{ label: '— None —', value: 0 }, ...checklistTemplates.map((c) => ({ label: c.name, value: c.id }))] },
    { name: 'status', label: 'Status', type: 'select', options: statuses.map((s) => ({ label: s, value: s })), defaultValue: 'PENDING' },
  ];

  const initialValues = editing
    ? {
        trainingProgramId: editing.trainingProgram.id,
        title: editing.title ?? '',
        scheduledDate: editing.scheduledDate ? new Date(editing.scheduledDate).toISOString().split('T')[0] : '',
        startTime: editing.startTime ?? '',
        endTime: editing.endTime ?? '',
        method: editing.method ?? '',
        status: editing.status,
        checklistId: editing.checklistId ?? 0,
        mentorId: editing.mentorId ?? 0,
        mentorRole: editing.mentorRole ?? '',
        mentorStartDate: editing.mentorStartDate ? editing.mentorStartDate.slice(0, 10) : '',
        mentorEndDate: editing.mentorEndDate ? editing.mentorEndDate.slice(0, 10) : '',
        mentorOutcome: editing.mentorOutcome ?? '',
        resourceIds: (() => { try { return (JSON.parse(editing.resourceIds ?? '[]') as number[]).join(','); } catch { return ''; } })(),
      }
    : { status: 'PENDING' };

  const today = new Date().toISOString().split('T')[0];
  const kpis = {
    upcoming: records.filter((r) => r.status === 'SCHEDULED' && r.scheduledDate && r.scheduledDate >= today).length,
    completed: records.filter((r) => r.status === 'COMPLETED').length,
    cancelled: records.filter((r) => r.status === 'CANCELLED').length,
    pending: records.filter((r) => r.status === 'PENDING').length,
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold" style={{ color: 'var(--foreground)' }}>Training Calendar</h1>
        <button
          onClick={() => { setEditing(null); setModalOpen(true); }}
          className="rounded-lg px-4 py-2 text-sm font-medium text-white transition hover:opacity-90"
          style={{ backgroundColor: 'var(--accent)' }}
        >
          + Add Schedule
        </button>
      </div>

      <KPIGrid columns={4}>
        <KPICard label="Upcoming" value={kpis.upcoming} tone="info" />
        <KPICard label="Completed" value={kpis.completed} tone="success" />
        <KPICard label="Pending" value={kpis.pending} tone="warning" />
        <KPICard label="Cancelled" value={kpis.cancelled} tone="danger" />
      </KPIGrid>

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
          type="month"
          value={month}
          onChange={(e) => { setMonth(e.target.value); setPage(1); }}
          className="rounded border bg-transparent px-3 py-2 text-sm"
        />
        <select
          value={status}
          onChange={(e) => { setStatus(e.target.value); setPage(1); }}
          className="rounded border bg-transparent px-3 py-2 text-sm"
        >
          <option value="">All statuses</option>
          {statuses.map((s) => <option key={s} value={s}>{s}</option>)}
        </select>
        <button
          onClick={() => setAvailOpen(true)}
          className="rounded-lg px-3 py-2 text-xs font-medium"
          style={{ border: '1px solid var(--border)', color: 'var(--foreground)' }}
        >
          Availability
        </button>
        <div className="ml-auto flex rounded-lg border" style={{ borderColor: 'var(--border)' }}>
          {(['list', 'grid', 'week', 'day', 'year'] as const).map((v) => (
            <button
              key={v}
              onClick={() => setView(v)}
              className="rounded-lg px-3 py-1.5 text-xs font-medium"
              style={{
                backgroundColor: view === v ? 'var(--accent)' : 'transparent',
                color: view === v ? '#fff' : 'var(--foreground-muted)',
              }}
            >
              {v === 'list' ? '☰ List' : v === 'grid' ? '▦ Month' : v === 'week' ? 'Week' : v === 'day' ? 'Day' : 'Year'}
            </button>
          ))}
        </div>
      </div>

      {view === 'list' && (
        <DataTable
          columns={columns}
          data={records}
          pagination={pagination}
          loading={loading}
          onPageChange={setPage}
          onEdit={(row) => { setEditing(row); setModalOpen(true); }}
          onDelete={handleDelete}
        />
      )}

      {view === 'grid' && <MonthGrid records={gridRecords} month={month} statusColor={statusColor} onView={openChecklist} onAttend={openAttendance} />}

      {view === 'week' && (
        <WeekGrid records={gridRecords} anchor={weekAnchor} onAnchor={setWeekAnchor} statusColor={statusColor} onAttend={openAttendance} />
      )}
      {view === 'day' && (
        <DayView records={gridRecords} anchor={dayAnchor} onAnchor={setDayAnchor} statusColor={statusColor} onAttend={openAttendance} />
      )}
      {view === 'year' && (
        <YearGrid records={gridRecords} year={yearAnchor} onYear={setYearAnchor} statusColor={statusColor} />
      )}

      <FormModal
        title={editing ? 'Edit Schedule' : 'Add Schedule'}
        fields={fields}
        initialValues={initialValues}
        isOpen={modalOpen}
        onClose={() => { setModalOpen(false); setEditing(null); }}
        onSubmit={handleSave}
        submitLabel={editing ? 'Update' : 'Create'}
      />

      {checklistFor && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ backgroundColor: 'rgba(0,0,0,0.4)' }}>
          <div className="w-full max-w-lg rounded-xl p-5" style={{ backgroundColor: 'var(--surface)' }}>
            <div className="mb-3 flex items-center justify-between">
              <div>
                <h2 className="text-lg font-semibold" style={{ color: 'var(--foreground)' }}>
                  {checklistData?.checklistName ?? 'Checklist'}
                </h2>
                <p className="text-xs" style={{ color: 'var(--foreground-muted)' }}>
                  {checklistFor.title ?? checklistFor.trainingProgram.name} — {checklistFor.scheduledDate ? new Date(checklistFor.scheduledDate).toLocaleDateString() : 'unscheduled'}
                </p>
              </div>
              <button onClick={() => { setChecklistFor(null); setChecklistData(null); }} className="rounded px-2 py-1 text-sm" style={{ color: 'var(--foreground-muted)' }}>✕</button>
            </div>

            {checklistLoading && <p className="py-6 text-center text-sm" style={{ color: 'var(--foreground-muted)' }}>Loading…</p>}

            {!checklistLoading && checklistData && checklistData.items.length === 0 && (
              <p className="py-6 text-center text-sm" style={{ color: 'var(--foreground-muted)' }}>No checklist attached to this schedule.</p>
            )}

            {!checklistLoading && checklistData && checklistData.items.length > 0 && (
              <>
                <div className="mb-3 flex gap-4 text-xs" style={{ color: 'var(--foreground-muted)' }}>
                  <span>{checklistData.completedCount ?? 0}/{checklistData.items.length} done</span>
                  {(checklistData.mandatoryPending ?? 0) > 0 && (
                    <span style={{ color: '#dc2626' }}>{checklistData.mandatoryPending} mandatory pending</span>
                  )}
                </div>
                <ul className="max-h-80 space-y-1 overflow-y-auto">
                  {checklistData.items.map((it) => (
                    <li key={it.itemId} className="flex items-center gap-2 rounded-lg border px-3 py-2" style={{ borderColor: 'var(--border)' }}>
                      {it.auto ? (
                        <span className="flex h-5 w-5 items-center justify-center rounded-full text-xs font-bold text-white" style={{ backgroundColor: it.done ? '#16a34a' : '#cbd5e1' }} title="Auto-verified by system">
                          {it.done ? '✓' : '…'}
                        </span>
                      ) : (
                        <input
                          type="checkbox"
                          checked={it.done}
                          onChange={(e) => void toggleChecklistItem(it.itemId, e.target.checked)}
                          className="h-4 w-4"
                        />
                      )}
                      <span className="flex-1 text-sm" style={{ color: 'var(--foreground)', textDecoration: it.done ? 'line-through' : 'none', opacity: it.done ? 0.7 : 1 }}>
                        {it.label}
                      </span>
                      {it.isMandatory && <span className="rounded px-1.5 py-0.5 text-[10px] font-semibold" style={{ backgroundColor: '#fee2e2', color: '#991b1b' }}>REQ</span>}
                      {it.auto && <span className="rounded px-1.5 py-0.5 text-[10px] font-semibold" style={{ backgroundColor: '#dbeafe', color: '#1e40af' }}>AUTO</span>}
                    </li>
                  ))}
                </ul>
              </>
            )}
          </div>
        </div>
      )}

      {costsFor && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ backgroundColor: 'rgba(0,0,0,0.4)' }}>
          <div className="w-full max-w-lg rounded-xl p-5" style={{ backgroundColor: 'var(--surface)' }}>
            <div className="mb-3 flex items-center justify-between">
              <div>
                <h2 className="text-lg font-semibold" style={{ color: 'var(--foreground)' }}>Training Costs</h2>
                <p className="text-xs" style={{ color: 'var(--foreground-muted)' }}>
                  {costsFor.title ?? costsFor.trainingProgram.name} — {costsFor.scheduledDate ? new Date(costsFor.scheduledDate).toLocaleDateString() : 'unscheduled'}
                </p>
              </div>
              <button onClick={() => { setCostsFor(null); setCosts([]); }} className="rounded px-2 py-1 text-sm" style={{ color: 'var(--foreground-muted)' }}>✕</button>
            </div>

            {costsLoading && <p className="py-6 text-center text-sm" style={{ color: 'var(--foreground-muted)' }}>Loading…</p>}

            {!costsLoading && (
              <>
                <table className="mb-3 w-full text-left text-sm">
                  <thead>
                    <tr style={{ color: 'var(--foreground-muted)' }}>
                      <th className="py-1 font-medium">Head</th>
                      <th className="py-1 font-medium">Description</th>
                      <th className="py-1 text-right font-medium">Amount</th>
                      <th className="py-1" />
                    </tr>
                  </thead>
                  <tbody>
                    {costs.map((c) => (
                      <tr key={c.id} className="border-t" style={{ borderColor: 'var(--border)' }}>
                        <td className="py-1.5 pr-2 text-xs font-medium">{c.head.replace(/_/g, ' ')}</td>
                        <td className="py-1.5 pr-2 text-xs">{c.description ?? '—'}</td>
                        <td className="py-1.5 pr-2 text-right">{Number(c.amount).toLocaleString()}</td>
                        <td className="py-1.5 text-right">
                          <button onClick={() => void removeCost(c.id)} className="rounded px-1.5 py-0.5 text-[10px] text-white" style={{ backgroundColor: '#dc2626' }}>✕</button>
                        </td>
                      </tr>
                    ))}
                    {costs.length === 0 && <tr><td colSpan={4} className="py-4 text-center" style={{ color: 'var(--foreground-muted)' }}>No cost items yet.</td></tr>}
                    {costs.length > 0 && (
                      <tr className="border-t font-semibold" style={{ borderColor: 'var(--border)' }}>
                        <td className="py-1.5" colSpan={2}>Total</td>
                        <td className="py-1.5 text-right">{costs.reduce((s, c) => s + Number(c.amount), 0).toLocaleString()}</td>
                        <td />
                      </tr>
                    )}
                  </tbody>
                </table>

                <div className="flex flex-wrap items-center gap-2 rounded-lg border p-3" style={{ borderColor: 'var(--border)' }}>
                  <select value={costForm.head} onChange={(e) => setCostForm((f) => ({ ...f, head: e.target.value }))} className="rounded border bg-transparent px-2 py-1.5 text-xs">
                    {COST_HEADS.map((h) => <option key={h} value={h}>{h.replace(/_/g, ' ')}</option>)}
                  </select>
                  <input type="number" value={costForm.amount} onChange={(e) => setCostForm((f) => ({ ...f, amount: e.target.value }))} placeholder="Amount" className="w-28 rounded border bg-transparent px-2 py-1.5 text-xs" />
                  <input type="text" value={costForm.description} onChange={(e) => setCostForm((f) => ({ ...f, description: e.target.value }))} placeholder="Description" className="flex-1 rounded border bg-transparent px-2 py-1.5 text-xs" />
                  <button onClick={() => void addCost()} disabled={!costForm.amount} className="rounded px-3 py-1.5 text-xs font-medium text-white disabled:opacity-50" style={{ backgroundColor: 'var(--accent)' }}>
                    + Add
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {attFor && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="w-full max-w-2xl rounded-xl p-5" style={{ backgroundColor: 'var(--background)' }}>
            <div className="mb-4 flex items-center justify-between">
              <div>
                <h2 className="text-lg font-semibold" style={{ color: 'var(--foreground)' }}>Mark Attendance</h2>
                <p className="text-xs" style={{ color: 'var(--foreground-muted)' }}>
                  {attFor.title ?? attFor.trainingProgram.name} — {attFor.scheduledDate ? new Date(attFor.scheduledDate).toLocaleDateString() : 'unscheduled'}
                </p>
              </div>
              <button onClick={() => { setAttFor(null); setAttRows([]); setAttNotice(null); }} className="rounded px-2 py-1 text-sm" style={{ color: 'var(--foreground-muted)' }}>✕</button>
            </div>

            {attNotice && (
              <p className="mb-3 rounded-lg px-3 py-2 text-xs" style={{ backgroundColor: '#f0fdf4', color: '#166534' }}>{attNotice}</p>
            )}

            {attLoading && <p className="py-6 text-center text-sm" style={{ color: 'var(--foreground-muted)' }}>Loading…</p>}

            {!attLoading && attRows.length === 0 && (
              <p className="py-6 text-center text-sm" style={{ color: 'var(--foreground-muted)' }}>No confirmed nominations for this schedule.</p>
            )}

            {!attLoading && attRows.length > 0 && (
              <>
                <table className="mb-4 w-full text-left text-sm">
                  <thead>
                    <tr style={{ color: 'var(--foreground-muted)' }}>
                      <th className="py-1 font-medium">Employee</th>
                      <th className="py-1 font-medium">Status</th>
                      <th className="py-1 font-medium">Hrs</th>
                      <th className="py-1 font-medium">Remarks</th>
                    </tr>
                  </thead>
                  <tbody>
                    {attRows.map((r, i) => (
                      <tr key={r.employeeId} className="border-t" style={{ borderColor: 'var(--border)' }}>
                        <td className="py-1.5 pr-2 text-xs font-medium">{r.name}</td>
                        <td className="py-1.5 pr-2">
                          <select
                            value={r.status}
                            onChange={(e) => setAttRows((rows) => rows.map((x, j) => (j === i ? { ...x, status: e.target.value } : x)))}
                            className="rounded border bg-transparent px-2 py-1 text-xs"
                          >
                            {ATT_STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
                          </select>
                        </td>
                        <td className="py-1.5 pr-2">
                          <input
                            type="number" min={0} step="0.5" value={r.attendedDuration}
                            onChange={(e) => setAttRows((rows) => rows.map((x, j) => (j === i ? { ...x, attendedDuration: e.target.value } : x)))}
                            className="w-16 rounded border bg-transparent px-2 py-1 text-xs"
                          />
                        </td>
                        <td className="py-1.5">
                          <input
                            type="text" value={r.remarks}
                            onChange={(e) => setAttRows((rows) => rows.map((x, j) => (j === i ? { ...x, remarks: e.target.value } : x)))}
                            className="w-full rounded border bg-transparent px-2 py-1 text-xs"
                          />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                <div className="flex justify-end gap-2">
                  <button
                    onClick={() => void pullHrms()}
                    title="Pre-fill rows from HRMS daily attendance for this date"
                    className="mr-auto rounded-lg px-4 py-2 text-sm font-medium"
                    style={{ border: '1px solid var(--border)', color: 'var(--foreground)' }}
                  >
                    ⇣ Pull HRMS
                  </button>
                  <button onClick={() => { setAttFor(null); setAttRows([]); }} className="rounded-lg px-4 py-2 text-sm" style={{ color: 'var(--foreground-muted)' }}>Cancel</button>
                  <button onClick={() => void saveAttendance()} className="rounded-lg px-4 py-2 text-sm font-medium text-white" style={{ backgroundColor: 'var(--accent)' }}>Save Attendance</button>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {/* §19: venue/resource availability browser. */}
      {availOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="max-h-[85vh] w-full max-w-3xl overflow-y-auto rounded-xl p-5" style={{ backgroundColor: 'var(--background)' }}>
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-lg font-semibold" style={{ color: 'var(--foreground)' }}>Venue &amp; Resource Availability</h2>
              <button onClick={() => setAvailOpen(false)} className="rounded px-2 py-1 text-sm" style={{ color: 'var(--foreground-muted)' }}>✕</button>
            </div>
            <div className="mb-4 flex items-center gap-3">
              <input
                type="date"
                value={availDate}
                onChange={(e) => { setAvailDate(e.target.value); void loadAvailability(e.target.value); }}
                className="rounded border bg-transparent px-3 py-2 text-sm"
              />
              {!availData && !availLoading && (
                <button onClick={() => void loadAvailability(availDate)} className="rounded-lg px-4 py-2 text-sm font-medium text-white" style={{ backgroundColor: 'var(--accent)' }}>Check</button>
              )}
              {availLoading && <span className="text-xs" style={{ color: 'var(--foreground-muted)' }}>Loading…</span>}
            </div>
            {availData && (
              <div className="grid gap-4 md:grid-cols-2">
                <div>
                  <h3 className="mb-2 text-sm font-semibold" style={{ color: 'var(--foreground)' }}>Venues</h3>
                  <ul className="space-y-1 text-xs">
                    {availData.venues.map((v) => (
                      <li key={v.id} className="flex items-center justify-between rounded border px-2 py-1.5" style={{ borderColor: 'var(--border)' }}>
                        <span>{v.name}{v.capacity ? ` (${v.capacity})` : ''}</span>
                        {v.available
                          ? <span className="rounded px-2 py-0.5 font-medium" style={{ backgroundColor: '#dcfce7', color: '#166534' }}>Free</span>
                          : <span className="rounded px-2 py-0.5 font-medium" style={{ backgroundColor: '#fee2e2', color: '#991b1b' }} title={v.bookings.map((b) => `${b.title} ${b.startTime ?? ''}-${b.endTime ?? ''}`).join('; ')}>Booked ({v.bookings.length})</span>}
                      </li>
                    ))}
                    {availData.venues.length === 0 && <li className="text-xs" style={{ color: 'var(--foreground-muted)' }}>No venues configured.</li>}
                  </ul>
                </div>
                <div>
                  <h3 className="mb-2 text-sm font-semibold" style={{ color: 'var(--foreground)' }}>Resources</h3>
                  <ul className="space-y-1 text-xs">
                    {availData.resources.map((r) => (
                      <li key={r.id} className="flex items-center justify-between rounded border px-2 py-1.5" style={{ borderColor: 'var(--border)' }}>
                        <span>{r.name}{r.resourceType ? ` · ${r.resourceType}` : ''}</span>
                        {r.available
                          ? <span className="rounded px-2 py-0.5 font-medium" style={{ backgroundColor: '#dcfce7', color: '#166534' }}>{r.remaining}/{r.quantity} free</span>
                          : <span className="rounded px-2 py-0.5 font-medium" style={{ backgroundColor: '#fee2e2', color: '#991b1b' }}>{r.status !== 'AVAILABLE' ? r.status : 'Fully booked'}</span>}
                      </li>
                    ))}
                    {availData.resources.length === 0 && <li className="text-xs" style={{ color: 'var(--foreground-muted)' }}>No resources configured.</li>}
                  </ul>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// §16: month-grid calendar — schedules placed in day cells, color-coded by status.
function MonthGrid({
  records,
  month,
  statusColor,
  onView,
  onAttend,
}: {
  records: TrainingSchedule[];
  month: string;
  statusColor: (s: string) => { bg: string; text: string };
  onView: (row: TrainingSchedule) => void;
  onAttend: (row: TrainingSchedule) => void;
}) {
  const [y, m] = month.split('-').map(Number);
  const first = new Date(y, m - 1, 1);
  const daysInMonth = new Date(y, m, 0).getDate();
  const startDow = first.getDay(); // 0=Sun
  const cells: (number | null)[] = [
    ...Array<null>(startDow).fill(null),
    ...Array.from({ length: daysInMonth }, (_, i) => i + 1),
  ];
  while (cells.length % 7 !== 0) cells.push(null);

  const byDay = new Map<number, TrainingSchedule[]>();
  for (const r of records) {
    if (!r.scheduledDate) continue;
    const d = new Date(r.scheduledDate);
    if (d.getFullYear() === y && d.getMonth() === m - 1) {
      const list = byDay.get(d.getDate()) ?? [];
      list.push(r);
      byDay.set(d.getDate(), list);
    }
  }

  const today = new Date();
  const isToday = (d: number) => today.getFullYear() === y && today.getMonth() === m - 1 && today.getDate() === d;

  return (
    <div className="rounded-xl border" style={{ borderColor: 'var(--border)' }}>
      <div className="grid grid-cols-7 text-center text-xs font-medium" style={{ color: 'var(--foreground-muted)' }}>
        {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((d) => (
          <div key={d} className="border-b py-2" style={{ borderColor: 'var(--border)' }}>{d}</div>
        ))}
      </div>
      <div className="grid grid-cols-7">
        {cells.map((day, i) => (
          <div
            key={i}
            className="min-h-24 border-b border-r p-1"
            style={{ borderColor: 'var(--border)', backgroundColor: day && isToday(day) ? 'var(--accent-soft, rgba(59,130,246,0.06))' : 'transparent' }}
          >
            {day && (
              <>
                <div className="mb-1 text-xs font-medium" style={{ color: isToday(day) ? 'var(--accent)' : 'var(--foreground-muted)' }}>
                  {day}
                </div>
                <div className="space-y-1">
                  {(byDay.get(day) ?? []).map((r) => {
                    const c = statusColor(r.status);
                    return (
                      <button
                        key={r.id}
                        onClick={() => onAttend(r)}
                        onContextMenu={(e) => { e.preventDefault(); onView(r); }}
                        title={`${r.trainingProgram.name}${r.title ? ` — ${r.title}` : ''} (${r.status})`}
                        className="block w-full truncate rounded px-1.5 py-0.5 text-left text-[10px] font-medium"
                        style={{ backgroundColor: c.bg, color: c.text }}
                      >
                        {r.startTime ? `${r.startTime} ` : ''}{r.trainingProgram.name}
                      </button>
                    );
                  })}
                </div>
              </>
            )}
          </div>
        ))}
      </div>
      <div className="flex gap-3 px-3 py-2 text-[10px]" style={{ color: 'var(--foreground-muted)' }}>
        {['SCHEDULED', 'PENDING', 'COMPLETED', 'CANCELLED'].map((s) => {
          const c = statusColor(s);
          return (
            <span key={s} className="flex items-center gap-1">
              <span className="inline-block h-2 w-2 rounded" style={{ backgroundColor: c.bg, border: `1px solid ${c.text}` }} />
              {s}
            </span>
          );
        })}
        <span className="ml-auto">Click = attendance · Right-click = checklist</span>
      </div>
    </div>
  );
}

// §16: week view — 7 day columns around the anchor date.
function WeekGrid({
  records,
  anchor,
  onAnchor,
  statusColor,
  onAttend,
}: {
  records: TrainingSchedule[];
  anchor: string;
  onAnchor: (d: string) => void;
  statusColor: (s: string) => { bg: string; text: string };
  onAttend: (row: TrainingSchedule) => void;
}) {
  const base = new Date(`${anchor}T00:00:00`);
  const weekStart = new Date(base);
  weekStart.setDate(base.getDate() - base.getDay());
  const days = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(weekStart);
    d.setDate(weekStart.getDate() + i);
    return d;
  });
  const iso = (d: Date) => d.toISOString().slice(0, 10);
  const byDay = new Map<string, TrainingSchedule[]>();
  for (const r of records) {
    if (!r.scheduledDate) continue;
    const k = new Date(r.scheduledDate).toISOString().slice(0, 10);
    const list = byDay.get(k) ?? [];
    list.push(r);
    byDay.set(k, list);
  }
  const shift = (n: number) => {
    const d = new Date(base);
    d.setDate(base.getDate() + n * 7);
    onAnchor(d.toISOString().slice(0, 10));
  };
  const today = new Date().toISOString().slice(0, 10);

  return (
    <div className="rounded-xl border" style={{ borderColor: 'var(--border)' }}>
      <div className="flex items-center gap-2 border-b px-3 py-2" style={{ borderColor: 'var(--border)' }}>
        <button onClick={() => shift(-1)} className="rounded border px-2 py-0.5 text-xs" style={{ borderColor: 'var(--border)' }}>‹ Prev</button>
        <span className="text-xs font-medium" style={{ color: 'var(--foreground)' }}>
          Week of {iso(weekStart)} — {iso(days[6])}
        </span>
        <button onClick={() => shift(1)} className="rounded border px-2 py-0.5 text-xs" style={{ borderColor: 'var(--border)' }}>Next ›</button>
        <button onClick={() => onAnchor(today)} className="ml-auto rounded border px-2 py-0.5 text-xs" style={{ borderColor: 'var(--border)' }}>Today</button>
      </div>
      <div className="grid grid-cols-7">
        {days.map((d) => {
          const key = iso(d);
          const items = byDay.get(key) ?? [];
          return (
            <div key={key} className="min-h-40 border-r p-1.5 last:border-r-0" style={{ borderColor: 'var(--border)', backgroundColor: key === today ? 'var(--accent-soft, rgba(59,130,246,0.06))' : 'transparent' }}>
              <div className="mb-1 text-xs font-medium" style={{ color: key === today ? 'var(--accent)' : 'var(--foreground-muted)' }}>
                {d.toLocaleDateString(undefined, { weekday: 'short', day: 'numeric' })}
              </div>
              <div className="space-y-1">
                {items.map((r) => {
                  const c = statusColor(r.status);
                  return (
                    <button
                      key={r.id}
                      onClick={() => onAttend(r)}
                      title={`${r.trainingProgram.name}${r.title ? ` — ${r.title}` : ''} (${r.status})`}
                      className="block w-full truncate rounded px-1.5 py-0.5 text-left text-[10px] font-medium"
                      style={{ backgroundColor: c.bg, color: c.text }}
                    >
                      {r.startTime ? `${r.startTime} ` : ''}{r.trainingProgram.name}
                    </button>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// §16: day view — all sessions on the anchor date, sorted by start time.
function DayView({
  records,
  anchor,
  onAnchor,
  statusColor,
  onAttend,
}: {
  records: TrainingSchedule[];
  anchor: string;
  onAnchor: (d: string) => void;
  statusColor: (s: string) => { bg: string; text: string };
  onAttend: (row: TrainingSchedule) => void;
}) {
  const items = records
    .filter((r) => r.scheduledDate && new Date(r.scheduledDate).toISOString().slice(0, 10) === anchor)
    .sort((a, b) => (a.startTime ?? '').localeCompare(b.startTime ?? ''));
  const shift = (n: number) => {
    const d = new Date(`${anchor}T00:00:00`);
    d.setDate(d.getDate() + n);
    onAnchor(d.toISOString().slice(0, 10));
  };
  const today = new Date().toISOString().slice(0, 10);

  return (
    <div className="rounded-xl border" style={{ borderColor: 'var(--border)' }}>
      <div className="flex items-center gap-2 border-b px-3 py-2" style={{ borderColor: 'var(--border)' }}>
        <button onClick={() => shift(-1)} className="rounded border px-2 py-0.5 text-xs" style={{ borderColor: 'var(--border)' }}>‹ Prev</button>
        <input type="date" value={anchor} onChange={(e) => onAnchor(e.target.value)} className="rounded border bg-transparent px-2 py-0.5 text-xs" style={{ borderColor: 'var(--border)' }} />
        <button onClick={() => shift(1)} className="rounded border px-2 py-0.5 text-xs" style={{ borderColor: 'var(--border)' }}>Next ›</button>
        <button onClick={() => onAnchor(today)} className="ml-auto rounded border px-2 py-0.5 text-xs" style={{ borderColor: 'var(--border)' }}>Today</button>
      </div>
      {items.length === 0 && (
        <p className="py-8 text-center text-sm" style={{ color: 'var(--foreground-muted)' }}>No trainings on this day.</p>
      )}
      <div className="divide-y" style={{ borderColor: 'var(--border)' }}>
        {items.map((r) => {
          const c = statusColor(r.status);
          return (
            <button key={r.id} onClick={() => onAttend(r)} className="flex w-full items-center gap-3 px-4 py-2.5 text-left hover:opacity-80">
              <span className="w-24 font-mono text-xs" style={{ color: 'var(--foreground-muted)' }}>
                {r.startTime ?? '—'}{r.endTime ? `–${r.endTime}` : ''}
              </span>
              <span className="rounded px-2 py-0.5 text-[10px] font-bold" style={{ backgroundColor: c.bg, color: c.text }}>{r.status}</span>
              <span className="text-sm font-medium" style={{ color: 'var(--foreground)' }}>
                {r.trainingProgram.name}{r.title ? ` — ${r.title}` : ''}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

// §16: year view — 12 month cells with session counts by status.
function YearGrid({
  records,
  year,
  onYear,
  statusColor,
}: {
  records: TrainingSchedule[];
  year: number;
  onYear: (y: number) => void;
  statusColor: (s: string) => { bg: string; text: string };
}) {
  const byMonth = new Map<number, TrainingSchedule[]>();
  for (const r of records) {
    if (!r.scheduledDate) continue;
    const d = new Date(r.scheduledDate);
    if (d.getFullYear() !== year) continue;
    const list = byMonth.get(d.getMonth()) ?? [];
    list.push(r);
    byMonth.set(d.getMonth(), list);
  }
  const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

  return (
    <div className="rounded-xl border" style={{ borderColor: 'var(--border)' }}>
      <div className="flex items-center gap-2 border-b px-3 py-2" style={{ borderColor: 'var(--border)' }}>
        <button onClick={() => onYear(year - 1)} className="rounded border px-2 py-0.5 text-xs" style={{ borderColor: 'var(--border)' }}>‹ {year - 1}</button>
        <span className="text-xs font-medium" style={{ color: 'var(--foreground)' }}>{year}</span>
        <button onClick={() => onYear(year + 1)} className="rounded border px-2 py-0.5 text-xs" style={{ borderColor: 'var(--border)' }}>{year + 1} ›</button>
      </div>
      <div className="grid grid-cols-4 gap-3 p-3">
        {monthNames.map((name, i) => {
          const items = byMonth.get(i) ?? [];
          const counts = new Map<string, number>();
          for (const r of items) counts.set(r.status, (counts.get(r.status) ?? 0) + 1);
          return (
            <div key={name} className="rounded-lg border p-3" style={{ borderColor: 'var(--border)' }}>
              <div className="mb-1 flex items-center justify-between">
                <span className="text-xs font-semibold" style={{ color: 'var(--foreground)' }}>{name}</span>
                <span className="text-[10px]" style={{ color: 'var(--foreground-muted)' }}>{items.length} session{items.length === 1 ? '' : 's'}</span>
              </div>
              <div className="flex flex-wrap gap-1">
                {[...counts.entries()].map(([s, n]) => {
                  const c = statusColor(s);
                  return (
                    <span key={s} className="rounded px-1.5 py-0.5 text-[9px] font-bold" style={{ backgroundColor: c.bg, color: c.text }}>
                      {s} {n}
                    </span>
                  );
                })}
                {items.length === 0 && <span className="text-[10px]" style={{ color: 'var(--foreground-muted)' }}>—</span>}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
