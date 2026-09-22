'use client';

import { useState, useEffect } from 'react';
import { DataTable, FormModal, ConfirmDialog, KPICard, KPIGrid } from '@/components/ui';
import type { Column, FieldDef } from '@/components/ui';

interface Group {
  id: number;
  name: string;
  description: string | null;
  isActive: boolean;
  competencyId: number | null;
  skillId: number | null;
  proficiencyLevelId: number | null;
  trainingProgramId: number | null;
  gradeId: number | null;
  passMark: number | null;
  durationMinutes: number | null;
  randomQuestions: boolean;
  negativeMarking: boolean;
  _count?: { questions: number };
}

interface Question {
  id: number;
  groupId: number | null;
  question: string;
  questionType: string;
  options: string | null;
  correctAnswer: string | null;
  maxScore: number;
  competencyId: number | null;
  skillId: number | null;
  proficiencyLevelId: number | null;
  category: string | null;
  topic: string | null;
  isActive: boolean;
}

const QUESTION_TYPES = [
  { label: 'Multiple Choice', value: 'MCQ' },
  { label: 'True / False', value: 'TRUE_FALSE' },
  { label: 'Short Answer', value: 'SHORT_ANSWER' },
  { label: 'Rating', value: 'RATING' },
];

interface Opt { id: number; name: string }

const baseGroupFields: FieldDef[] = [
  { name: 'name', label: 'Group Name', type: 'text', required: true },
  { name: 'description', label: 'Description', type: 'textarea' },
];

function optionsToLines(options: string | null): string {
  if (!options) return '';
  try {
    const arr = JSON.parse(options);
    return Array.isArray(arr) ? arr.join('\n') : options;
  } catch {
    return options;
  }
}

function linesToOptions(text: string): string | undefined {
  const lines = text.split('\n').map((l) => l.trim()).filter(Boolean);
  return lines.length ? JSON.stringify(lines) : undefined;
}

export default function QuestionBankPage() {
  const [groups, setGroups] = useState<Group[]>([]);
  const [questions, setQuestions] = useState<Question[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [refresh, setRefresh] = useState(0);
  const [groupFilter, setGroupFilter] = useState<number | ''>('');

  const [groupModal, setGroupModal] = useState(false);
  const [editGroupId, setEditGroupId] = useState<number | null>(null);
  const [groupValues, setGroupValues] = useState<Record<string, string | number | boolean | undefined>>({});
  const [deleteGroupId, setDeleteGroupId] = useState<number | null>(null);

  const [qModal, setQModal] = useState(false);
  const [editQId, setEditQId] = useState<number | null>(null);
  const [qValues, setQValues] = useState<Record<string, string | number | boolean | undefined>>({});
  const [deleteQId, setDeleteQId] = useState<number | null>(null);

  // §25: group link options — competency, skill, proficiency level, program, grade.
  const [comps, setComps] = useState<Opt[]>([]);
  const [skills, setSkills] = useState<Opt[]>([]);
  const [levels, setLevels] = useState<Opt[]>([]);
  const [programs, setPrograms] = useState<Opt[]>([]);
  const [grades, setGrades] = useState<Opt[]>([]);

  useEffect(() => {
    let mounted = true;
    const load = async () => {
      setLoading(true);
      setError(null);
      try {
        const [gRes, qRes, cRes, sRes, lRes, pRes, grRes] = await Promise.all([
          fetch('/api/question-bank-groups'),
          fetch(`/api/question-bank${groupFilter ? `?groupId=${groupFilter}` : ''}`),
          fetch('/api/competencies').catch(() => null),
          fetch('/api/skills').catch(() => null),
          fetch('/api/skill-levels').catch(() => null),
          fetch('/api/training-programs').catch(() => null),
          fetch('/api/masters/grades').catch(() => null),
        ]);
        if (!gRes.ok || !qRes.ok) throw new Error('Failed to fetch');
        const gJson = await gRes.json();
        const qJson = await qRes.json();
        if (!mounted) return;
        setGroups(Array.isArray(gJson) ? gJson : gJson.data ?? []);
        setQuestions(Array.isArray(qJson) ? qJson : qJson.data ?? []);
        const list = async (r: Response | null) => {
          if (!r?.ok) return [];
          const j = await r.json();
          return Array.isArray(j) ? j : j.data ?? [];
        };
        const [cl, sl, ll, pl, gl] = await Promise.all([list(cRes), list(sRes), list(lRes), list(pRes), list(grRes)]);
        setComps(cl.map((x: { id: number; name: string }) => ({ id: x.id, name: x.name })));
        setSkills(sl.map((x: { id: number; name: string }) => ({ id: x.id, name: x.name })));
        setLevels(ll.map((x: { id: number; name: string }) => ({ id: x.id, name: x.name })));
        setPrograms(pl.map((x: { id: number; name: string }) => ({ id: x.id, name: x.name })));
        setGrades(gl.map((x: { id: number; name: string }) => ({ id: x.id, name: x.name })));
      } catch (err) {
        if (mounted) setError(err instanceof Error ? err.message : 'Unknown error');
      } finally {
        if (mounted) setLoading(false);
      }
    };
    void load();
    return () => { mounted = false; };
  }, [refresh, groupFilter]);

  const opt = (list: Opt[]) => [{ label: '— None —', value: 0 }, ...list.map((x) => ({ label: x.name, value: x.id }))];
  const groupFields: FieldDef[] = [
    ...baseGroupFields,
    { name: 'competencyId', label: 'Competency', type: 'select', options: opt(comps) },
    { name: 'skillId', label: 'Skill', type: 'select', options: opt(skills) },
    { name: 'proficiencyLevelId', label: 'Proficiency Level', type: 'select', options: opt(levels) },
    { name: 'trainingProgramId', label: 'Training Program', type: 'select', options: opt(programs) },
    { name: 'gradeId', label: 'Grade', type: 'select', options: opt(grades) },
    { name: 'passMark', label: 'Pass Mark %', type: 'number', min: 0, max: 100 },
    { name: 'durationMinutes', label: 'Duration (min)', type: 'number' },
    { name: 'randomQuestions', label: 'Randomize Questions', type: 'checkbox', helpText: 'Shuffle question order per attempt' },
    { name: 'negativeMarking', label: 'Negative Marking', type: 'checkbox', helpText: 'Deduct 25% of max score for wrong answers' },
  ];

  const questionFields: FieldDef[] = [
    {
      name: 'groupId', label: 'Group', type: 'select',
      options: groups.map((g) => ({ label: g.name, value: g.id })),
    },
    { name: 'question', label: 'Question', type: 'textarea', required: true },
    { name: 'questionType', label: 'Type', type: 'select', options: QUESTION_TYPES, required: true },
    {
      name: 'optionsText', label: 'Options (one per line)', type: 'textarea',
      helpText: 'For MCQ only — each line becomes one option.',
    },
    { name: 'correctAnswer', label: 'Correct Answer', type: 'text', helpText: 'Must match an option exactly for auto-scoring.' },
    { name: 'maxScore', label: 'Max Score', type: 'number', required: true, defaultValue: 1 },
    // §24 question-level links — Category, Topic, Skill, Competency, Proficiency Level.
    { name: 'category', label: 'Category', type: 'text' },
    { name: 'topic', label: 'Topic', type: 'text' },
    { name: 'competencyId', label: 'Competency', type: 'select', options: opt(comps) },
    { name: 'skillId', label: 'Skill', type: 'select', options: opt(skills) },
    { name: 'proficiencyLevelId', label: 'Proficiency Level', type: 'select', options: opt(levels) },
  ];

  const submitGroup = async (values: Record<string, string | number | boolean>) => {
    const payload: Record<string, string | number | boolean | null> = { ...values };
    for (const key of ['competencyId', 'skillId', 'proficiencyLevelId', 'trainingProgramId', 'gradeId']) {
      payload[key] = payload[key] ? Number(payload[key]) : null;
    }
    const url = editGroupId ? `/api/question-bank-groups/${editGroupId}` : '/api/question-bank-groups';
    const res = await fetch(url, {
      method: editGroupId ? 'PUT' : 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    if (!res.ok) throw new Error((await res.json()).error ?? 'Save failed');
    setRefresh((n) => n + 1);
  };

  const submitQuestion = async (values: Record<string, string | number | boolean>) => {
    const { optionsText, ...rest } = values;
    const payload: Record<string, string | number | boolean | null | undefined> = {
      ...rest,
      options: linesToOptions(String(optionsText ?? '')),
    };
    for (const key of ['groupId', 'competencyId', 'skillId', 'proficiencyLevelId']) {
      payload[key] = payload[key] ? Number(payload[key]) : null;
    }
    const url = editQId ? `/api/question-bank/${editQId}` : '/api/question-bank';
    const res = await fetch(url, {
      method: editQId ? 'PUT' : 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    if (!res.ok) throw new Error((await res.json()).error ?? 'Save failed');
    setRefresh((n) => n + 1);
  };

  const doDelete = async (kind: 'group' | 'question', id: number) => {
    const res = await fetch(`/api/${kind === 'group' ? 'question-bank-groups' : 'question-bank'}/${id}`, { method: 'DELETE' });
    if (!res.ok) {
      setError((await res.json()).error ?? 'Delete failed');
      return;
    }
    setRefresh((n) => n + 1);
  };

  const groupColumns: Column<Group>[] = [
    { key: 'name', label: 'Group', sortable: true },
    { key: 'description', label: 'Description', render: (r) => r.description ?? '—' },
    { key: 'questions', label: 'Questions', render: (r) => r._count?.questions ?? 0 },
  ];

  const qColumns: Column<Question>[] = [
    { key: 'question', label: 'Question', render: (r) => (r.question.length > 80 ? `${r.question.slice(0, 80)}…` : r.question) },
    { key: 'groupId', label: 'Group', render: (r) => groups.find((g) => g.id === r.groupId)?.name ?? '—' },
    { key: 'questionType', label: 'Type' },
    { key: 'correctAnswer', label: 'Answer', render: (r) => r.correctAnswer ?? '—' },
    { key: 'maxScore', label: 'Score' },
  ];

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold" style={{ color: 'var(--foreground)' }}>Question Bank</h1>
        <div className="flex gap-2">
          <button onClick={() => { setEditGroupId(null); setGroupValues({}); setGroupModal(true); }}
            className="rounded-lg border px-4 py-2 text-sm font-medium transition hover:opacity-80"
            style={{ borderColor: 'var(--border)', color: 'var(--foreground)' }}>
            + Group
          </button>
          <button onClick={() => { setEditQId(null); setQValues({ questionType: 'MCQ', maxScore: 1 }); setQModal(true); }}
            className="rounded-lg px-4 py-2 text-sm font-medium text-white transition hover:opacity-90"
            style={{ backgroundColor: 'var(--accent)' }}>
            + Question
          </button>
        </div>
      </div>

      <KPIGrid columns={3}>
        <KPICard label="Groups" value={groups.length} tone="info" />
        <KPICard label="Questions" value={questions.length} tone="info" />
        <KPICard label="MCQ" value={questions.filter((q) => q.questionType === 'MCQ').length} tone="success" />
      </KPIGrid>

      {error && <div className="rounded-lg px-3 py-2 text-sm" style={{ backgroundColor: '#fef2f2', color: '#dc2626', border: '1px solid #fecaca' }}>{error}</div>}

      <section>
        <h2 className="mb-2 text-sm font-medium" style={{ color: 'var(--foreground-muted)' }}>Question Groups</h2>
        <DataTable
          columns={groupColumns}
          data={groups}
          loading={loading}
          onEdit={(r) => { setEditGroupId(r.id); setGroupValues({ name: r.name, description: r.description ?? '', competencyId: r.competencyId ?? 0, skillId: r.skillId ?? 0, proficiencyLevelId: r.proficiencyLevelId ?? 0, trainingProgramId: r.trainingProgramId ?? 0, gradeId: r.gradeId ?? 0, passMark: r.passMark ?? '', durationMinutes: r.durationMinutes ?? '', randomQuestions: r.randomQuestions, negativeMarking: r.negativeMarking }); setGroupModal(true); }}
          onDelete={(r) => setDeleteGroupId(r.id)}
        />
      </section>

      <section>
        <div className="mb-2 flex items-center gap-3">
          <h2 className="text-sm font-medium" style={{ color: 'var(--foreground-muted)' }}>Questions</h2>
          <select
            value={groupFilter}
            onChange={(e) => setGroupFilter(e.target.value === '' ? '' : Number(e.target.value))}
            className="rounded-lg border px-2 py-1 text-sm"
            style={{ backgroundColor: 'var(--surface)', color: 'var(--foreground)', borderColor: 'var(--border)' }}
          >
            <option value="">All groups</option>
            {groups.map((g) => <option key={g.id} value={g.id}>{g.name}</option>)}
          </select>
        </div>
        <DataTable
          columns={qColumns}
          data={questions}
          loading={loading}
          onEdit={(r) => {
            setEditQId(r.id);
            setQValues({
              groupId: r.groupId ?? undefined,
              question: r.question,
              questionType: r.questionType,
              optionsText: optionsToLines(r.options),
              correctAnswer: r.correctAnswer ?? '',
              maxScore: r.maxScore,
              category: r.category ?? '',
              topic: r.topic ?? '',
              competencyId: r.competencyId ?? 0,
              skillId: r.skillId ?? 0,
              proficiencyLevelId: r.proficiencyLevelId ?? 0,
            });
            setQModal(true);
          }}
          onDelete={(r) => setDeleteQId(r.id)}
        />
      </section>

      <FormModal title={editGroupId ? 'Edit Group' : 'Add Group'} fields={groupFields} initialValues={groupValues}
        isOpen={groupModal} onClose={() => setGroupModal(false)} onSubmit={submitGroup}
        submitLabel={editGroupId ? 'Update' : 'Create'} />

      <FormModal title={editQId ? 'Edit Question' : 'Add Question'} fields={questionFields} initialValues={qValues}
        isOpen={qModal} onClose={() => setQModal(false)} onSubmit={submitQuestion}
        submitLabel={editQId ? 'Update' : 'Create'} />

      <ConfirmDialog title="Delete Group" message="Delete this group? Its questions will become ungrouped."
        isOpen={deleteGroupId !== null} onConfirm={() => deleteGroupId && doDelete('group', deleteGroupId)} onClose={() => setDeleteGroupId(null)} />
      <ConfirmDialog title="Delete Question" message="Delete this question?"
        isOpen={deleteQId !== null} onConfirm={() => deleteQId && doDelete('question', deleteQId)} onClose={() => setDeleteQId(null)} />
    </div>
  );
}
