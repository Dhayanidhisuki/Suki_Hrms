'use client';

import { useState, useEffect } from 'react';
import { DataTable, FormModal, ConfirmDialog, KPICard, KPIGrid } from '@/components/ui';
import type { Column, FieldDef } from '@/components/ui';

interface Assessment {
  id: number;
  trainingProgramId: number | null;
  trainingScheduleId: number | null;
  title: string;
  description: string | null;
  assessmentType: string;
  passingScore: number;
  durationMinutes: number | null;
  maxAttempts: number;
  promoteOnPass: boolean;
  promoteToLevelId: number | null;
  questionIds: string | null;
}

interface Question {
  id: number;
  question: string;
  questionType: string;
  maxScore: number;
}

interface Program { id: number; name: string }
interface Schedule { id: number; title: string | null; scheduledDate: string | null; trainingProgram?: { name: string } | null }
interface Level { id: number; name: string; levelNumber: number }
interface Attempt {
  id: number;
  assessmentId: number;
  employeeId: number;
  answersJson: string | null;
  maxScore: number;
  result: string;
  submittedAt: string | null;
}
interface AttemptAnswer { questionId: number; answer: string; score: number | null; }

const TYPE_OPTIONS = [
  { label: 'Pre-Training', value: 'PRE' },
  { label: 'Post-Training', value: 'POST' },
  { label: 'Periodic', value: 'PERIODIC' },
  { label: 'Certification', value: 'CERTIFICATION' },
];

function parseIds(json: string | null): number[] {
  if (!json) return [];
  try {
    const arr = JSON.parse(json);
    return Array.isArray(arr) ? arr.map(Number).filter((n) => Number.isFinite(n)) : [];
  } catch {
    return [];
  }
}

export default function AssessmentsPage() {
  const [records, setRecords] = useState<Assessment[]>([]);
  const [questions, setQuestions] = useState<Question[]>([]);
  const [programs, setPrograms] = useState<Program[]>([]);
  const [schedules, setSchedules] = useState<Schedule[]>([]);
  const [levels, setLevels] = useState<Level[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [refresh, setRefresh] = useState(0);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [initialValues, setInitialValues] = useState<Record<string, string | number | boolean | undefined>>({});
  const [selectedQuestions, setSelectedQuestions] = useState<number[]>([]);
  const [deleteId, setDeleteId] = useState<number | null>(null);
  const [pendingGrading, setPendingGrading] = useState<Attempt[]>([]);
  const [grading, setGrading] = useState<Attempt | null>(null);
  const [gradeScores, setGradeScores] = useState<Record<number, string>>({});

  useEffect(() => {
    let mounted = true;
    const load = async () => {
      setLoading(true);
      setError(null);
      try {
        const [aRes, qRes, pRes, sRes, lRes, gRes] = await Promise.all([
          fetch('/api/assessments'),
          fetch('/api/question-bank'),
          fetch('/api/training-programs'),
          fetch('/api/training-schedules?limit=200'),
          fetch('/api/skill-levels'),
          fetch('/api/assessment-attempts?pendingGrading=1'),
        ]);
        const [aJson, qJson, pJson, sJson, lJson, gJson] = await Promise.all([aRes.json(), qRes.json(), pRes.json(), sRes.json(), lRes.json(), gRes.json()]);
        if (!mounted) return;
        setRecords(Array.isArray(aJson) ? aJson : aJson.data ?? []);
        setQuestions(Array.isArray(qJson) ? qJson : qJson.data ?? []);
        setPrograms(Array.isArray(pJson) ? pJson : pJson.data ?? []);
        setSchedules(Array.isArray(sJson) ? sJson : sJson.data ?? []);
        setLevels(Array.isArray(lJson) ? lJson : lJson.data ?? []);
        setPendingGrading(gJson.data ?? []);
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
    { name: 'title', label: 'Assessment Title', type: 'text', required: true },
    { name: 'assessmentType', label: 'Type', type: 'select', options: TYPE_OPTIONS, required: true },
    {
      name: 'trainingProgramId', label: 'Training Program', type: 'select',
      options: programs.map((p) => ({ label: p.name, value: p.id })),
    },
    {
      name: 'trainingScheduleId', label: 'Training Schedule', type: 'select',
      options: schedules.map((s) => ({
        label: `${s.trainingProgram?.name ?? s.title ?? `Schedule #${s.id}`} — ${s.scheduledDate ? s.scheduledDate.slice(0, 10) : 'unscheduled'}`,
        value: s.id,
      })),
    },
    { name: 'passingScore', label: 'Passing Score (%)', type: 'number', required: true, defaultValue: 70, min: 0, max: 100 },
    { name: 'durationMinutes', label: 'Duration (minutes)', type: 'number' },
    { name: 'maxAttempts', label: 'Max Attempts', type: 'number', defaultValue: 1, min: 1, max: 10 },
    { name: 'promoteOnPass', label: 'Promote Proficiency on Pass', type: 'checkbox' },
    {
      name: 'promoteToLevelId', label: 'Promote To Level', type: 'select',
      options: levels.map((l) => ({ label: `${l.levelNumber} — ${l.name}`, value: l.id })),
    },
    { name: 'description', label: 'Description', type: 'textarea' },
  ];

  const scheduleLabel = (id: number | null) => {
    const s = schedules.find((x) => x.id === id);
    return s ? `${s.trainingProgram?.name ?? s.title ?? `#${s.id}`} (${s.scheduledDate ? s.scheduledDate.slice(0, 10) : '—'})` : '—';
  };

  const handleSubmit = async (values: Record<string, string | number | boolean>) => {
    const payload = { ...values, questionIds: JSON.stringify(selectedQuestions) };
    const url = editingId ? `/api/assessments/${editingId}` : '/api/assessments';
    const res = await fetch(url, {
      method: editingId ? 'PUT' : 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    if (!res.ok) throw new Error((await res.json()).error ?? 'Save failed');
    setRefresh((n) => n + 1);
  };

  const handleDelete = async (id: number) => {
    const res = await fetch(`/api/assessments/${id}`, { method: 'DELETE' });
    if (!res.ok) {
      setError((await res.json()).error ?? 'Delete failed');
      return;
    }
    setRefresh((n) => n + 1);
  };

  const submitGrades = async () => {
    if (!grading) return;
    let answers: AttemptAnswer[] = [];
    try { answers = JSON.parse(grading.answersJson ?? '[]'); } catch { /* ignore */ }
    const scores = answers
      .filter((a) => a.score == null)
      .map((a) => ({ questionId: a.questionId, score: parseFloat(gradeScores[a.questionId] ?? '0') }));
    if (scores.some((s) => !Number.isFinite(s.score))) {
      setError('Enter a numeric score for every pending question');
      return;
    }
    const res = await fetch('/api/assessment-attempts', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ attemptId: grading.id, scores }),
    });
    if (!res.ok) {
      setError((await res.json()).error ?? 'Grading failed');
      return;
    }
    setGrading(null);
    setRefresh((n) => n + 1);
  };

  const toggleQuestion = (id: number) => {
    setSelectedQuestions((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  };

  const columns: Column<Assessment>[] = [
    { key: 'title', label: 'Assessment', sortable: true },
    { key: 'assessmentType', label: 'Type', render: (r) => TYPE_OPTIONS.find((t) => t.value === r.assessmentType)?.label ?? r.assessmentType },
    { key: 'trainingProgramId', label: 'Program', render: (r) => programs.find((p) => p.id === r.trainingProgramId)?.name ?? '—' },
    { key: 'trainingScheduleId', label: 'Schedule', render: (r) => scheduleLabel(r.trainingScheduleId) },
    { key: 'questions', label: 'Questions', render: (r) => parseIds(r.questionIds).length },
    { key: 'passingScore', label: 'Pass %', render: (r) => `${r.passingScore}%` },
  ];

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold" style={{ color: 'var(--foreground)' }}>Assessments</h1>
        <button
          onClick={() => { setEditingId(null); setInitialValues({ assessmentType: 'POST', passingScore: 70 }); setSelectedQuestions([]); setModalOpen(true); }}
          className="rounded-lg px-4 py-2 text-sm font-medium text-white transition hover:opacity-90"
          style={{ backgroundColor: 'var(--accent)' }}
        >
          + Add Assessment
        </button>
      </div>

      <KPIGrid columns={3}>
        <KPICard label="Assessments" value={records.length} tone="info" />
        <KPICard label="Pre-Training" value={records.filter((r) => r.assessmentType === 'PRE').length} tone="warning" />
        <KPICard label="Post-Training" value={records.filter((r) => r.assessmentType === 'POST').length} tone="success" />
      </KPIGrid>

      {error && <div className="rounded-lg px-3 py-2 text-sm" style={{ backgroundColor: '#fef2f2', color: '#dc2626', border: '1px solid #fecaca' }}>{error}</div>}

      {pendingGrading.length > 0 && (
        <div className="rounded-xl border p-4" style={{ borderColor: '#f59e0b', backgroundColor: '#fffbeb' }}>
          <h2 className="text-sm font-semibold mb-2" style={{ color: '#92400e' }}>Awaiting Manual Grading ({pendingGrading.length})</h2>
          <div className="space-y-1">
            {pendingGrading.map((a) => (
              <div key={a.id} className="flex items-center justify-between text-sm" style={{ color: 'var(--foreground)' }}>
                <span>
                  Attempt #{a.id} — {records.find((r) => r.id === a.assessmentId)?.title ?? `Assessment ${a.assessmentId}`} — Employee #{a.employeeId}
                  {a.submittedAt && <em className="text-xs ml-2" style={{ color: 'var(--foreground-muted)' }}>{new Date(a.submittedAt).toLocaleDateString()}</em>}
                </span>
                <button
                  onClick={() => { setGrading(a); setGradeScores({}); }}
                  className="rounded-lg px-3 py-1 text-xs font-medium text-white"
                  style={{ backgroundColor: 'var(--accent)' }}
                >
                  Grade
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      <DataTable
        columns={columns}
        data={records}
        loading={loading}
        onEdit={(r) => {
          setEditingId(r.id);
          setInitialValues({
            title: r.title,
            assessmentType: r.assessmentType,
            trainingProgramId: r.trainingProgramId ?? undefined,
            trainingScheduleId: r.trainingScheduleId ?? undefined,
            passingScore: r.passingScore,
            durationMinutes: r.durationMinutes ?? undefined,
            maxAttempts: r.maxAttempts ?? 1,
            promoteOnPass: r.promoteOnPass ?? false,
            promoteToLevelId: r.promoteToLevelId ?? undefined,
            description: r.description ?? '',
          });
          setSelectedQuestions(parseIds(r.questionIds));
          setModalOpen(true);
        }}
        onDelete={(r) => setDeleteId(r.id)}
      />

      <FormModal
        title={editingId ? 'Edit Assessment' : 'Add Assessment'}
        fields={fields}
        initialValues={initialValues}
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        onSubmit={handleSubmit}
        submitLabel={editingId ? 'Update' : 'Create'}
      >
        <div className="flex flex-col gap-1">
          <span className="text-sm font-medium" style={{ color: 'var(--foreground)' }}>
            Questions ({selectedQuestions.length} selected)
          </span>
          <div className="max-h-48 overflow-y-auto rounded-lg border p-2 space-y-1" style={{ borderColor: 'var(--border)' }}>
            {questions.length === 0 && (
              <span className="text-xs" style={{ color: 'var(--foreground-muted)' }}>No questions in the bank yet.</span>
            )}
            {questions.map((q) => (
              <label key={q.id} className="flex items-start gap-2 cursor-pointer text-sm" style={{ color: 'var(--foreground)' }}>
                <input
                  type="checkbox"
                  checked={selectedQuestions.includes(q.id)}
                  onChange={() => toggleQuestion(q.id)}
                  className="mt-0.5 h-4 w-4"
                  style={{ accentColor: 'var(--accent)' }}
                />
                <span>#{q.id} — {q.question.length > 70 ? `${q.question.slice(0, 70)}…` : q.question} <em className="text-xs" style={{ color: 'var(--foreground-muted)' }}>({q.questionType}, {q.maxScore}pt)</em></span>
              </label>
            ))}
          </div>
        </div>
      </FormModal>

      {grading && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="w-full max-w-lg rounded-xl p-5 space-y-3" style={{ backgroundColor: 'var(--background)' }}>
            <h2 className="text-lg font-semibold" style={{ color: 'var(--foreground)' }}>
              Grade Attempt #{grading.id}
            </h2>
            <div className="max-h-80 overflow-y-auto space-y-3">
              {(() => {
                let answers: AttemptAnswer[] = [];
                try { answers = JSON.parse(grading.answersJson ?? '[]'); } catch { /* ignore */ }
                return answers.filter((a) => a.score == null).map((a) => {
                  const q = questions.find((x) => x.id === a.questionId);
                  return (
                    <div key={a.questionId} className="rounded-lg border p-3 space-y-1" style={{ borderColor: 'var(--border)' }}>
                      <div className="text-sm font-medium" style={{ color: 'var(--foreground)' }}>
                        {q?.question ?? `Question #${a.questionId}`}
                        <em className="ml-2 text-xs" style={{ color: 'var(--foreground-muted)' }}>max {q?.maxScore ?? '?'}pt</em>
                      </div>
                      <div className="text-xs whitespace-pre-wrap" style={{ color: 'var(--foreground-muted)' }}>
                        Answer: {a.answer || '—'}
                      </div>
                      <input
                        type="number" min={0} max={q?.maxScore} step="0.5"
                        value={gradeScores[a.questionId] ?? ''}
                        onChange={(e) => setGradeScores((p) => ({ ...p, [a.questionId]: e.target.value }))}
                        placeholder={`Score (0–${q?.maxScore ?? '?'})`}
                        className="w-32 rounded-lg border px-2 py-1 text-sm"
                        style={{ borderColor: 'var(--border)', backgroundColor: 'var(--background)', color: 'var(--foreground)' }}
                      />
                    </div>
                  );
                });
              })()}
            </div>
            <div className="flex justify-end gap-2">
              <button onClick={() => setGrading(null)} className="rounded-lg px-4 py-2 text-sm" style={{ color: 'var(--foreground-muted)' }}>Cancel</button>
              <button onClick={submitGrades} className="rounded-lg px-4 py-2 text-sm font-medium text-white" style={{ backgroundColor: 'var(--accent)' }}>Submit Grades</button>
            </div>
          </div>
        </div>
      )}

      <ConfirmDialog
        title="Delete Assessment"
        message="Delete this assessment? Existing attempts are kept."
        isOpen={deleteId !== null}
        onConfirm={() => deleteId && handleDelete(deleteId)}
        onClose={() => setDeleteId(null)}
      />
    </div>
  );
}
