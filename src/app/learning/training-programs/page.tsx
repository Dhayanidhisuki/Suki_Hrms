'use client';

import { useState, useEffect } from 'react';
import { DataTable, FormModal, ConfirmDialog, KPICard, KPIGrid } from '@/components/ui';
import type { Column, FieldDef } from '@/components/ui';

interface Program {
  id: number;
  code: string | null;
  name: string;
  competencyId: number | null;
  skillId: number | null;
  category: string | null;
  type: string | null;
  objective: string | null;
  learningOutcome: string | null;
  targetAudience: string | null;
  method: string | null;
  duration: string | number | null;
  durationUnit: string;
  assessmentRequired: boolean;
  certificationRequired: boolean;
  isMandatory: boolean;
  validityMonths: number | null;
  refresherFrequency: string | null;
  estimatedCost: string | number | null;
}

const fields: FieldDef[] = [
  { name: 'code', label: 'Code', type: 'text', disabled: true, placeholder: 'Generated automatically' },
  { name: 'name', label: 'Program Name', type: 'text', required: true },
  { name: 'category', label: 'Category', type: 'select', options: [
    { value: 'TECHNICAL', label: 'Technical' },
    { value: 'FUNCTIONAL', label: 'Functional' },
    { value: 'BEHAVIORAL', label: 'Behavioral' },
    { value: 'LEADERSHIP', label: 'Leadership' },
    { value: 'COMPLIANCE', label: 'Compliance' },
    { value: 'SAFETY', label: 'Safety' },
  ] },
  { name: 'type', label: 'Type', type: 'select', options: [
    { value: 'INTERNAL', label: 'Internal' },
    { value: 'EXTERNAL', label: 'External' },
  ] },
  { name: 'method', label: 'Method', type: 'select', options: [
    { value: 'CLASSROOM', label: 'Classroom' },
    { value: 'ONLINE', label: 'Online' },
    { value: 'OJT', label: 'On the Job' },
    { value: 'SEMINAR', label: 'Seminar' },
    { value: 'WORKSHOP', label: 'Workshop' },
  ] },
  { name: 'duration', label: 'Duration', type: 'number' },
  { name: 'durationUnit', label: 'Duration Unit', type: 'select', options: [
    { value: 'HOURS', label: 'Hours' },
    { value: 'DAYS', label: 'Days' },
  ], defaultValue: 'HOURS' },
  { name: 'objective', label: 'Objective', type: 'textarea' },
  { name: 'learningOutcome', label: 'Learning Outcome', type: 'textarea' },
  { name: 'targetAudience', label: 'Target Audience', type: 'text' },
  { name: 'estimatedCost', label: 'Estimated Cost', type: 'number' },
  { name: 'assessmentRequired', label: 'Assessment Required', type: 'checkbox' },
  { name: 'certificationRequired', label: 'Certification Required', type: 'checkbox' },
  { name: 'isMandatory', label: 'Mandatory Program', type: 'checkbox', helpText: 'All eligible employees must complete this program' },
  { name: 'validityMonths', label: 'Certification Validity (months)', type: 'number' },
  { name: 'refresherFrequency', label: 'Refresher Frequency', type: 'text' },
];

export default function TrainingProgramsPage() {
  const [records, setRecords] = useState<Program[]>([]);
  const [competencies, setCompetencies] = useState<{ id: number; name: string }[]>([]);
  const [skills, setSkills] = useState<{ id: number; name: string }[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [refresh, setRefresh] = useState(0);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [initialValues, setInitialValues] = useState<Record<string, string | number | boolean | undefined>>({});
  const [deleteId, setDeleteId] = useState<number | null>(null);

  useEffect(() => {
    let mounted = true;
    const load = async () => {
      setLoading(true);
      setError(null);
      try {
        const [res, cRes, sRes] = await Promise.all([
          fetch('/api/training-programs?full=1'),
          fetch('/api/competencies'),
          fetch('/api/skills'),
        ]);
        if (!res.ok) throw new Error('Failed to fetch');
        const [json, cJson, sJson] = await Promise.all([res.json(), cRes.json(), sRes.json()]);
        if (!mounted) return;
        setRecords(json);
        setCompetencies(Array.isArray(cJson) ? cJson : cJson.data ?? []);
        setSkills(Array.isArray(sJson) ? sJson : sJson.data ?? []);
      } catch (err) {
        if (mounted) setError(err instanceof Error ? err.message : 'Unknown error');
      } finally {
        if (mounted) setLoading(false);
      }
    };
    void load();
    return () => { mounted = false; };
  }, [refresh]);

  const handleAdd = () => {
    setEditingId(null);
    setInitialValues({ durationUnit: 'HOURS' });
    setModalOpen(true);
  };

  const handleEdit = (row: Program) => {
    setEditingId(row.id);
    setInitialValues({
      code: row.code ?? '',
      name: row.name,
      category: row.category ?? '',
      type: row.type ?? '',
      method: row.method ?? '',
      duration: row.duration != null ? Number(row.duration) : '',
      durationUnit: row.durationUnit,
      objective: row.objective ?? '',
      learningOutcome: row.learningOutcome ?? '',
      targetAudience: row.targetAudience ?? '',
      validityMonths: row.validityMonths ?? '',
      refresherFrequency: row.refresherFrequency ?? '',
      competencyId: row.competencyId ?? '',
      skillId: row.skillId ?? '',
      assessmentRequired: row.assessmentRequired,
      certificationRequired: row.certificationRequired,
      isMandatory: row.isMandatory ?? false,
      estimatedCost: row.estimatedCost != null ? Number(row.estimatedCost) : '',
    });
    setModalOpen(true);
  };

  const handleSubmit = async (values: Record<string, string | number | boolean>) => {
    const payload = { ...values };
    if (editingId == null) delete payload.code;
    const url = editingId ? `/api/training-programs/${editingId}` : '/api/training-programs';
    const method = editingId ? 'PUT' : 'POST';
    const res = await fetch(url, { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error ?? 'Save failed');
    }
    setRefresh((n) => n + 1);
  };

  const handleDelete = async (id: number) => {
    const res = await fetch(`/api/training-programs/${id}`, { method: 'DELETE' });
    if (!res.ok) {
      const err = await res.json();
      setError(err.error ?? 'Delete failed');
      return;
    }
    setRefresh((n) => n + 1);
  };

  const columns: Column<Program>[] = [
    { key: 'code', label: 'Code' },
    { key: 'name', label: 'Program', sortable: true },
    { key: 'category', label: 'Category', render: (r) => r.category ?? '—' },
    { key: 'type', label: 'Type', render: (r) => r.type ?? '—' },
    { key: 'method', label: 'Method', render: (r) => r.method ?? '—' },
    { key: 'duration', label: 'Duration', render: (r) => (r.duration != null ? `${r.duration} ${r.durationUnit}` : '—') },
    { key: 'assessmentRequired', label: 'Assessment', render: (r) => (r.assessmentRequired ? 'Yes' : 'No') },
    { key: 'certificationRequired', label: 'Certified', render: (r) => (r.certificationRequired ? 'Yes' : 'No') },
    { key: 'estimatedCost', label: 'Est. Cost', render: (r) => (r.estimatedCost != null ? `₹${Number(r.estimatedCost).toLocaleString('en-IN')}` : '—') },
  ];

  // Competency/skill links drive the recommendation engine (BRD §32).
  const linkFields: FieldDef[] = [
    { name: 'competencyId', label: 'Addresses Competency', type: 'select', options: competencies.map((c) => ({ label: c.name, value: c.id })) },
    { name: 'skillId', label: 'Addresses Skill', type: 'select', options: skills.map((s) => ({ label: s.name, value: s.id })) },
  ];
  const allFields = [...fields, ...linkFields];

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold" style={{ color: 'var(--foreground)' }}>Training Programs</h1>
        <button onClick={handleAdd} className="rounded-lg px-4 py-2 text-sm font-medium text-white transition hover:opacity-90" style={{ backgroundColor: 'var(--accent)' }}>
          + Add Program
        </button>
      </div>

      <KPIGrid columns={3}>
        <KPICard label="Programs" value={records.length} tone="info" />
        <KPICard label="With Assessment" value={records.filter((r) => r.assessmentRequired).length} tone="warning" />
        <KPICard label="Certified Programs" value={records.filter((r) => r.certificationRequired).length} tone="success" />
      </KPIGrid>

      {error && <div className="rounded-lg px-3 py-2 text-sm" style={{ backgroundColor: '#fef2f2', color: '#dc2626', border: '1px solid #fecaca' }}>{error}</div>}

      <DataTable columns={columns} data={records} loading={loading} onEdit={handleEdit} onDelete={(row) => setDeleteId(row.id)} />

      <FormModal
        title={editingId ? 'Edit Program' : 'Add Program'}
        fields={editingId ? allFields : allFields.filter((f) => f.name !== 'code')}
        initialValues={initialValues}
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        onSubmit={handleSubmit}
        submitLabel={editingId ? 'Update' : 'Create'}
      />

      <ConfirmDialog
        title="Delete Program"
        message="Are you sure you want to delete this training program?"
        isOpen={deleteId !== null}
        onConfirm={() => deleteId && handleDelete(deleteId)}
        onClose={() => setDeleteId(null)}
      />
    </div>
  );
}
