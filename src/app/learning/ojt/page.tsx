'use client';

import { useState, useEffect } from 'react';
import { DataTable, FormModal, ConfirmDialog, KPICard, KPIGrid } from '@/components/ui';
import type { Column, FieldDef } from '@/components/ui';

interface Ojt {
  id: number;
  employeeId: number;
  mentorEmployeeId: number | null;
  trainerId: number | null;
  competencyId: number | null;
  trainingProgramId: number | null;
  startDate: string | null;
  endDate: string | null;
  checklistId: number | null;
  skillsCovered: string | null;
  observation: string | null;
  assessmentId: number | null;
  assessmentScore: number | null;
  status: string;
  remarks: string | null;
}

interface Employee { id: number; firstName: string; lastName: string | null; employeeCode: string }
interface Trainer { id: number; name: string }
interface Competency { id: number; name: string }
interface Program { id: number; name: string }
interface Assessment { id: number; title: string }
interface Checklist { id: number; name: string }

const STATUS_OPTIONS = [
  { label: 'In Progress', value: 'IN_PROGRESS' },
  { label: 'Completed', value: 'COMPLETED' },
  { label: 'Cancelled', value: 'CANCELLED' },
];

export default function OjtPage() {
  const [records, setRecords] = useState<Ojt[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [trainers, setTrainers] = useState<Trainer[]>([]);
  const [competencies, setCompetencies] = useState<Competency[]>([]);
  const [programs, setPrograms] = useState<Program[]>([]);
  const [assessments, setAssessments] = useState<Assessment[]>([]);
  const [checklists, setChecklists] = useState<Checklist[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [refresh, setRefresh] = useState(0);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [initialValues, setInitialValues] = useState<Record<string, string | number | boolean | undefined>>({});
  const [deleteId, setDeleteId] = useState<number | null>(null);

  const empLabel = (e: Employee) => `${e.firstName} ${e.lastName ?? ''} (${e.employeeCode})`.trim();
  const empName = (id: number | null) => { if (id == null) return '—'; const e = employees.find((x) => x.id === id); return e ? empLabel(e) : `#${id}`; };
  const trainerName = (id: number | null) => trainers.find((t) => t.id === id)?.name ?? '—';
  const compName = (id: number | null) => competencies.find((c) => c.id === id)?.name ?? '—';

  useEffect(() => {
    let mounted = true;
    const load = async () => {
      setLoading(true);
      setError(null);
      try {
        const [oRes, eRes, tRes, cRes, pRes, aRes, kRes] = await Promise.all([
          fetch('/api/ojt-assignments'),
          fetch('/api/employees?limit=500'),
          fetch('/api/trainers'),
          fetch('/api/competencies'),
          fetch('/api/training-programs'),
          fetch('/api/assessments').catch(() => null),
          fetch('/api/training-checklists').catch(() => null),
        ]);
        const [oJson, eJson, tJson, cJson, pJson] = await Promise.all([oRes.json(), eRes.json(), tRes.json(), cRes.json(), pRes.json()]);
        const list = async (r: Response | null) => {
          if (!r?.ok) return [];
          const j = await r.json();
          return Array.isArray(j) ? j : j.data ?? [];
        };
        const aJson = await list(aRes);
        const kJson = await list(kRes);
        if (!mounted) return;
        setRecords(Array.isArray(oJson) ? oJson : oJson.data ?? []);
        setEmployees(Array.isArray(eJson) ? eJson : eJson.data ?? []);
        setTrainers(Array.isArray(tJson) ? tJson : tJson.data ?? []);
        setCompetencies(Array.isArray(cJson) ? cJson : cJson.data ?? []);
        setPrograms(Array.isArray(pJson) ? pJson : pJson.data ?? []);
        setAssessments(aJson.map((x: Assessment) => ({ id: x.id, title: x.title })));
        setChecklists(kJson.map((x: Checklist) => ({ id: x.id, name: x.name })));
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
    { name: 'employeeId', label: 'Trainee Employee', type: 'select', required: true, options: employees.map((e) => ({ label: empLabel(e), value: e.id })) },
    { name: 'mentorEmployeeId', label: 'Mentor (Employee)', type: 'select', options: employees.map((e) => ({ label: empLabel(e), value: e.id })) },
    { name: 'trainerId', label: 'Trainer (Master)', type: 'select', options: trainers.map((t) => ({ label: t.name, value: t.id })) },
    { name: 'competencyId', label: 'Competency', type: 'select', options: competencies.map((c) => ({ label: c.name, value: c.id })) },
    { name: 'trainingProgramId', label: 'Training Program', type: 'select', options: programs.map((p) => ({ label: p.name, value: p.id })) },
    { name: 'startDate', label: 'Start Date', type: 'date' },
    { name: 'endDate', label: 'End Date', type: 'date' },
    { name: 'checklistId', label: 'Checklist', type: 'select', options: checklists.map((c) => ({ label: c.name, value: c.id })) },
    { name: 'skillsCovered', label: 'Skills Covered', type: 'text' },
    { name: 'assessmentId', label: 'Linked Assessment', type: 'select', options: assessments.map((a) => ({ label: a.title, value: a.id })) },
    { name: 'assessmentScore', label: 'Assessment Score', type: 'number', min: 0 },
    { name: 'observation', label: 'Observation', type: 'textarea' },
    { name: 'status', label: 'Status', type: 'select', options: STATUS_OPTIONS, required: true },
    { name: 'remarks', label: 'Remarks', type: 'textarea' },
  ];

  const handleSubmit = async (values: Record<string, string | number | boolean>) => {
    const payload: Record<string, string | number | boolean | null> = { ...values };
    for (const key of ['mentorEmployeeId', 'trainerId', 'competencyId', 'trainingProgramId', 'checklistId', 'assessmentId']) {
      payload[key] = payload[key] ? Number(payload[key]) : null;
    }
    payload.assessmentScore = payload.assessmentScore !== '' && payload.assessmentScore != null ? Number(payload.assessmentScore) : null;
    const url = editingId ? `/api/ojt-assignments/${editingId}` : '/api/ojt-assignments';
    const res = await fetch(url, {
      method: editingId ? 'PUT' : 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    if (!res.ok) throw new Error((await res.json()).error ?? 'Save failed');
    setRefresh((n) => n + 1);
  };

  const handleDelete = async (id: number) => {
    const res = await fetch(`/api/ojt-assignments/${id}`, { method: 'DELETE' });
    if (!res.ok) {
      setError((await res.json()).error ?? 'Delete failed');
      return;
    }
    setRefresh((n) => n + 1);
  };

  const columns: Column<Ojt>[] = [
    { key: 'employeeId', label: 'Trainee', render: (r) => empName(r.employeeId) },
    { key: 'mentorEmployeeId', label: 'Mentor', render: (r) => r.mentorEmployeeId ? empName(r.mentorEmployeeId) : trainerName(r.trainerId) },
    { key: 'competencyId', label: 'Competency', render: (r) => compName(r.competencyId) },
    { key: 'startDate', label: 'Start', render: (r) => r.startDate?.slice(0, 10) ?? '—' },
    { key: 'endDate', label: 'End', render: (r) => r.endDate?.slice(0, 10) ?? '—' },
    { key: 'status', label: 'Status' },
  ];

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold" style={{ color: 'var(--foreground)' }}>On-the-Job Training</h1>
        <button
          onClick={() => { setEditingId(null); setInitialValues({ status: 'IN_PROGRESS' }); setModalOpen(true); }}
          className="rounded-lg px-4 py-2 text-sm font-medium text-white transition hover:opacity-90"
          style={{ backgroundColor: 'var(--accent)' }}
        >
          + Assign OJT
        </button>
      </div>

      <KPIGrid columns={3}>
        <KPICard label="In Progress" value={records.filter((r) => r.status === 'IN_PROGRESS').length} tone="info" />
        <KPICard label="Completed" value={records.filter((r) => r.status === 'COMPLETED').length} tone="success" />
        <KPICard label="Cancelled" value={records.filter((r) => r.status === 'CANCELLED').length} tone="danger" />
      </KPIGrid>

      {error && <div className="rounded-lg px-3 py-2 text-sm" style={{ backgroundColor: '#fef2f2', color: '#dc2626', border: '1px solid #fecaca' }}>{error}</div>}

      <DataTable
        columns={columns}
        data={records}
        loading={loading}
        onEdit={(r) => {
          setEditingId(r.id);
          setInitialValues({
            employeeId: r.employeeId,
            mentorEmployeeId: r.mentorEmployeeId ?? undefined,
            trainerId: r.trainerId ?? undefined,
            competencyId: r.competencyId ?? undefined,
            trainingProgramId: r.trainingProgramId ?? undefined,
            startDate: r.startDate ? r.startDate.slice(0, 10) : '',
            endDate: r.endDate ? r.endDate.slice(0, 10) : '',
            checklistId: r.checklistId ?? undefined,
            skillsCovered: r.skillsCovered ?? '',
            assessmentId: r.assessmentId ?? undefined,
            assessmentScore: r.assessmentScore ?? '',
            observation: r.observation ?? '',
            status: r.status,
            remarks: r.remarks ?? '',
          });
          setModalOpen(true);
        }}
        onDelete={(r) => setDeleteId(r.id)}
      />

      <FormModal title={editingId ? 'Edit OJT Assignment' : 'Assign OJT'} fields={fields} initialValues={initialValues}
        isOpen={modalOpen} onClose={() => setModalOpen(false)} onSubmit={handleSubmit}
        submitLabel={editingId ? 'Update' : 'Assign'} />

      <ConfirmDialog title="Delete OJT Assignment" message="Delete this OJT assignment?"
        isOpen={deleteId !== null} onConfirm={() => deleteId && handleDelete(deleteId)} onClose={() => setDeleteId(null)} />
    </div>
  );
}
