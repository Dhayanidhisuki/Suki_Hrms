/**
 * Employee Self Service — My Trainings (BRD §36).
 *
 * Self-service view for the logged-in employee (resolved server-side from
 * Employee.userId via /api/my-trainings — never a picker of "which employee").
 * Shows upcoming trainings they're nominated for, pending nominations,
 * completed training history, and lets them submit feedback on completed
 * sessions.
 */

'use client';

import { useState, useEffect, useCallback } from 'react';
import { DataTable, FormModal, type Column, type FieldDef } from '@/components/ui';

interface ScheduleLite {
  id: number;
  title: string | null;
  scheduledDate: string | null;
  startTime: string | null;
  endTime: string | null;
  method: string | null;
  status: string;
  trainingProgram: { name: string } | null;
}

interface NominationRow {
  id: number;
  trainingScheduleId: number;
  status: string;
  reason: string | null;
  priority: string;
  schedule: ScheduleLite | null;
}

interface HistoryRow {
  id: number;
  programName: string;
  scheduledDate: string | null;
  method: string | null;
  attendanceStatus: string;
  attendancePercent: number | null;
  result: string;
}

interface TrainingRequest {
  id: number;
  source: string;
  reason: string | null;
  priority: string;
  status: string;
  competencyName: string | null;
  programName: string | null;
  createdAt: string;
}

// §4/§17: schedules the caller mentors — they evaluate mentees here.
interface MentoringGroup {
  schedule: ScheduleLite;
  mentees: { employeeId: number; employeeName: string; evaluated: boolean }[];
}

interface MyTrainings {
  nominations: NominationRow[];
  upcoming: NominationRow[];
  history: HistoryRow[];
  pendingFeedback: NominationRow[];
  mandatoryPending: NominationRow[];
  myRequests: TrainingRequest[];
  mentoring?: MentoringGroup[];
  ratingScale?: { value: number; label: string }[];
}

// §23: employee induction checklist + confirmation.
interface InductionAssignment {
  id: number;
  status: string;
  employeeConfirmed: boolean;
  checklistJson: string | null;
  assignedDate: string;
  targetDate: string | null;
  program: { id: number; name: string; durationDays: number | null; topicsJson: string | null; description: string | null } | null;
}
interface ChecklistTopic { topic?: string; done?: boolean; date?: string | null; }

// §24/§26: assessments the employee can take from ESS.
interface AssessmentRow {
  id: number;
  title: string;
  assessmentType: string;
  passingScore: number;
  durationMinutes: number | null;
  maxAttempts: number;
  questionCount: number;
  latestAttempt: { id: number; result: string; scorePercent: number; submittedAt: string | null } | null;
  attemptCount: number;
}
interface TakeQuestion {
  id: number;
  question: string;
  questionType: string;
  options: string | null;
  maxScore: number;
}
interface TakeState {
  assessment: { id: number; title: string; assessmentType: string; passingScore: number; durationMinutes: number | null };
  questions: TakeQuestion[];
  attempt: { id: number; startedAt: string } | null;
  latestAttempt: { id: number; result: string; scorePercent: number } | null;
  attemptCount: number;
}

const STATUS_TONE: Record<string, { bg: string; fg: string }> = {
  PENDING: { bg: '#fef9c3', fg: '#854d0e' },
  NOMINATED: { bg: '#fef9c3', fg: '#854d0e' },
  SUBMITTED: { bg: '#fef9c3', fg: '#854d0e' },
  DRAFT: { bg: '#f1f5f9', fg: '#475569' },
  RETURNED: { bg: '#ffedd5', fg: '#9a3412' },
  PLANNED: { bg: '#dbeafe', fg: '#1e40af' },
  RESOLVED: { bg: '#dcfce7', fg: '#166534' },
  APPROVED: { bg: '#dcfce7', fg: '#166534' },
  REJECTED: { bg: '#fee2e2', fg: '#991b1b' },
  CANCELLED: { bg: '#f1f5f9', fg: '#475569' },
  COMPLETED: { bg: '#dcfce7', fg: '#166534' },
  SCHEDULED: { bg: '#dbeafe', fg: '#1e40af' },
};

function StatusBadge({ status }: { status: string }) {
  const tone = STATUS_TONE[status] ?? { bg: 'var(--surface-muted)', fg: 'var(--foreground-muted)' };
  return (
    <span className="rounded-full px-2 py-0.5 text-xs font-medium" style={{ backgroundColor: tone.bg, color: tone.fg }}>
      {status}
    </span>
  );
}

export default function MyTrainingsPage() {
  const [data, setData] = useState<MyTrainings>({ nominations: [], upcoming: [], history: [], pendingFeedback: [], mandatoryPending: [], myRequests: [] });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [checkingIn, setCheckingIn] = useState<number | null>(null);
  const [feedbackModal, setFeedbackModal] = useState<number | null>(null); // trainingScheduleId
  const [requestModal, setRequestModal] = useState(false);
  const [inductions, setInductions] = useState<InductionAssignment[]>([]);
  const [competencyOpts, setCompetencyOpts] = useState<{ id: number; name: string }[]>([]);
  const [programOpts, setProgramOpts] = useState<{ id: number; name: string }[]>([]);
  // §24/§26: take-test state.
  const [assessments, setAssessments] = useState<AssessmentRow[]>([]);
  const [take, setTake] = useState<TakeState | null>(null);
  const [answers, setAnswers] = useState<Record<number, string>>({});
  const [secondsLeft, setSecondsLeft] = useState<number | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [testResult, setTestResult] = useState<{ result: string; scorePercent: number } | null>(null);
  // §4/§17: mentor evaluation modal — which mentee of which schedule.
  const [evalTarget, setEvalTarget] = useState<{ scheduleId: number; employeeId: number; employeeName: string } | null>(null);

  // §47: rating scale from the Training Rating master (fallback 1–5).
  const [ratingOpts, setRatingOpts] = useState<{ value: number; label: string }[]>(
    [1, 2, 3, 4, 5].map((n) => ({ value: n, label: String(n) }))
  );

  // Load competency + program options once for the request form.
  useEffect(() => {
    const load = async () => {
      const [c, p] = await Promise.all([fetch('/api/competencies'), fetch('/api/training-programs')]);
      if (c.ok) {
        const j = await c.json();
        setCompetencyOpts(j.data ?? j);
      }
      if (p.ok) {
        const j = await p.json();
        setProgramOpts(j.data ?? j);
      }
    };
    void load();
  }, []);

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [res, iRes, aRes] = await Promise.all([
        fetch('/api/my-trainings'),
        fetch('/api/my-trainings/induction'),
        fetch('/api/my-trainings/assessments'),
      ]);
      if (!res.ok) throw new Error((await res.json()).error ?? 'Failed to fetch');
      const json: { data: MyTrainings } = await res.json();
      setData(json.data);
      // §47: rating scale shipped with the payload (Training Rating master).
      if (json.data.ratingScale?.length) setRatingOpts(json.data.ratingScale);
      if (iRes.ok) {
        const iJson = await iRes.json();
        setInductions(iJson.data ?? []);
      }
      if (aRes.ok) {
        const aJson = await aRes.json();
        setAssessments(aJson.data ?? []);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  }, []);

  // §23: induction self-service actions.
  const inductionAction = useCallback(async (assignmentId: number, action: string, index?: number) => {
    setError(null);
    setNotice(null);
    try {
      const res = await fetch('/api/my-trainings/induction', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ assignmentId, action, index }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? 'Action failed');
      await fetchData();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Action failed');
    }
  }, [fetchData]);

  const checkIn = useCallback(async (scheduleId: number) => {
    setCheckingIn(scheduleId);
    setError(null);
    setNotice(null);
    try {
      const res = await fetch(`/api/training-schedules/${scheduleId}/check-in`, { method: 'POST' });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? 'Check-in failed');
      setNotice(json.message ?? 'Checked in');
      await fetchData();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Check-in failed');
    } finally {
      setCheckingIn(null);
    }
  }, [fetchData]);

  // §24/§26: start/resume an attempt, then load the sanitized question paper.
  const openTake = useCallback(async (assessmentId: number) => {
    setError(null);
    setTestResult(null);
    try {
      const start = await fetch('/api/assessment-attempts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ assessmentId }),
      });
      const startJson = await start.json();
      if (!start.ok && start.status !== 400) throw new Error(startJson.error ?? 'Could not start attempt');
      const res = await fetch(`/api/my-trainings/assessments?assessmentId=${assessmentId}`);
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? 'Could not load assessment');
      setTake(json.data as TakeState);
      setAnswers({});
      setSecondsLeft(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not open assessment');
    }
  }, []);

  const submitTake = useCallback(async () => {
    if (!take || submitting) return;
    setSubmitting(true);
    setError(null);
    try {
      const answersJson = JSON.stringify(
        take.questions.map((q) => ({ questionId: q.id, answer: answers[q.id] ?? '' }))
      );
      const res = await fetch('/api/assessment-attempts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ assessmentId: take.assessment.id, answersJson }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? 'Submit failed');
      setTestResult({ result: json.result, scorePercent: json.scorePercent });
      setTake(null);
      setSecondsLeft(null);
      await fetchData();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Submit failed');
    } finally {
      setSubmitting(false);
    }
  }, [take, answers, submitting, fetchData]);

  // §26: countdown timer — auto-submits when the allowed time expires.
  useEffect(() => {
    if (!take?.attempt?.startedAt || !take.assessment.durationMinutes) return;
    const deadline = new Date(take.attempt.startedAt).getTime() + take.assessment.durationMinutes * 60_000;
    const tick = () => {
      const left = Math.max(0, Math.round((deadline - Date.now()) / 1000));
      setSecondsLeft(left);
      if (left === 0) void submitTake();
    };
    const t = setInterval(tick, 1000);
    const first = setTimeout(tick, 0);
    return () => { clearInterval(t); clearTimeout(first); };
  }, [take, submitTake]);

  useEffect(() => {
    const t = setTimeout(() => void fetchData(), 0);
    return () => clearTimeout(t);
  }, [fetchData]);

  // QR check-in landing: /ess/my-trainings?checkin=<scheduleId>
  useEffect(() => {
    const param = new URLSearchParams(window.location.search).get('checkin');
    if (!param) return;
    const scheduleId = Number(param);
    if (!scheduleId) return;
    window.history.replaceState({}, '', window.location.pathname);
    const t = setTimeout(() => void checkIn(scheduleId), 0);
    return () => clearTimeout(t);
  }, [checkIn]);

  const feedbackFields: FieldDef[] = [
    { name: 'trainerRating', label: 'Trainer Rating (1–5)', type: 'select', required: true, options: ratingOpts },
    { name: 'contentRating', label: 'Content Rating (1–5)', type: 'select', required: true, options: ratingOpts },
    { name: 'materialRating', label: 'Material Quality (1–5)', type: 'select', options: ratingOpts },
    { name: 'durationRating', label: 'Duration (1–5)', type: 'select', options: ratingOpts },
    { name: 'relevanceRating', label: 'Job Relevance (1–5)', type: 'select', options: ratingOpts },
    { name: 'learningOutcomeRating', label: 'Learning Outcome (1–5)', type: 'select', options: ratingOpts },
    { name: 'venueRating', label: 'Venue Rating (1–5)', type: 'select', options: ratingOpts },
    { name: 'overallRating', label: 'Overall Rating (1–5)', type: 'select', required: true, options: ratingOpts },
    { name: 'comments', label: 'Comments', type: 'textarea', placeholder: 'What did you like? What could improve?' },
  ];

  const handleFeedbackSubmit = async (values: Record<string, string | number | boolean>) => {
    if (!feedbackModal) return;
    const res = await fetch('/api/training-feedback', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        trainingScheduleId: feedbackModal,
        ...values,
      }),
    });
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error ?? 'Feedback submission failed');
    }
    setFeedbackModal(null);
    await fetchData();
  };

  // §4/§28: mentor submits the post-training effectiveness evaluation.
  const evalFields: FieldDef[] = [
    { name: 'evaluationStage', label: 'Evaluation Stage', type: 'select', required: true, options: ['IMMEDIATE', 'D30', 'D60', 'D90'].map((v) => ({ value: v, label: v === 'IMMEDIATE' ? 'Immediate' : `${v.slice(1)}-Day Review` })) },
    { name: 'applicationOfLearning', label: 'Application of Learning (1–5)', type: 'select', required: true, options: ratingOpts },
    { name: 'behavioralChange', label: 'Behavioral Change (1–5)', type: 'select', required: true, options: ratingOpts },
    { name: 'skillImprovement', label: 'Skill Improvement (1–5)', type: 'select', required: true, options: ratingOpts },
    { name: 'productivityImprovement', label: 'Productivity Improvement (1–5)', type: 'select', options: ratingOpts },
    { name: 'qualityImprovement', label: 'Quality Improvement (1–5)', type: 'select', options: ratingOpts },
    { name: 'effectivenessRating', label: 'Overall Effectiveness', type: 'select', options: ['EXCELLENT', 'GOOD', 'AVERAGE', 'POOR'].map((v) => ({ value: v, label: v })) },
    { name: 'evaluationDate', label: 'Evaluation Date', type: 'date' },
    { name: 'remarks', label: 'Comments', type: 'textarea' },
  ];

  const handleEvalSubmit = async (values: Record<string, string | number | boolean>) => {
    if (!evalTarget) return;
    const res = await fetch('/api/training-effectiveness', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        trainingScheduleId: evalTarget.scheduleId,
        employeeId: evalTarget.employeeId,
        ...values,
        evaluationDate: values.evaluationDate || null,
        effectivenessRating: values.effectivenessRating || null,
      }),
    });
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error ?? 'Evaluation failed');
    }
    setEvalTarget(null);
    setNotice(`Evaluation submitted for ${evalTarget.employeeName}.`);
    await fetchData();
  };

  const requestFields: FieldDef[] = [
    { name: 'competencyId', label: 'Competency', type: 'select', options: [{ value: 0, label: '— Select —' }, ...competencyOpts.map((c) => ({ value: c.id, label: c.name }))] },
    { name: 'trainingProgramId', label: 'or Training Program', type: 'select', options: [{ value: 0, label: '— Select —' }, ...programOpts.map((p) => ({ value: p.id, label: p.name }))] },
    { name: 'priority', label: 'Priority', type: 'select', defaultValue: 'MEDIUM', options: ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'].map((v) => ({ value: v, label: v })) },
    { name: 'reason', label: 'Why do you need this training?', type: 'textarea', required: true },
  ];

  const handleRequestSubmit = async (values: Record<string, string | number | boolean>) => {
    const res = await fetch('/api/my-trainings/requests', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        competencyId: Number(values.competencyId) || null,
        trainingProgramId: Number(values.trainingProgramId) || null,
        priority: values.priority,
        reason: values.reason,
      }),
    });
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error ?? 'Request failed');
    }
    setRequestModal(false);
    setNotice('Training request submitted for approval.');
    await fetchData();
  };

  const requestColumns: Column<TrainingRequest>[] = [
    { key: 'programName', label: 'Requested', render: (r) => r.programName ?? r.competencyName ?? '—' },
    { key: 'reason', label: 'Reason', render: (r) => r.reason ?? '—' },
    { key: 'priority', label: 'Priority' },
    { key: 'status', label: 'Status', render: (r) => <StatusBadge status={r.status} /> },
    { key: 'createdAt', label: 'Requested On', render: (r) => r.createdAt?.slice(0, 10) ?? '—' },
  ];

  const nominationColumns: Column<NominationRow>[] = [
    {
      key: 'program',
      label: 'Program',
      render: (r) => r.schedule?.trainingProgram?.name ?? r.schedule?.title ?? '—',
    },
    {
      key: 'date',
      label: 'Date & Time',
      render: (r) => r.schedule?.scheduledDate
        ? `${r.schedule.scheduledDate.slice(0, 10)} ${r.schedule.startTime ?? ''}`.trim()
        : '—',
    },
    { key: 'method', label: 'Method', render: (r) => r.schedule?.method ?? '—' },
    { key: 'reason', label: 'Reason', render: (r) => r.reason ?? '—' },
    { key: 'status', label: 'Status', render: (r) => <StatusBadge status={r.status} /> },
    {
      key: 'checkin',
      label: 'Check-in',
      render: (r) => {
        const today = new Date().toISOString().slice(0, 10);
        const isToday = r.schedule?.scheduledDate?.slice(0, 10) === today;
        const canCheckIn = isToday && ['APPROVED', 'NOMINATED'].includes(r.status) && ['SCHEDULED', 'IN_PROGRESS'].includes(r.schedule?.status ?? '');
        return canCheckIn ? (
          <button
            onClick={() => checkIn(r.trainingScheduleId)}
            disabled={checkingIn === r.trainingScheduleId}
            className="rounded px-2 py-0.5 text-xs font-medium text-white disabled:opacity-50"
            style={{ backgroundColor: '#16a34a' }}
          >
            {checkingIn === r.trainingScheduleId ? 'Checking…' : 'Check In'}
          </button>
        ) : '—';
      },
    },
    {
      key: 'feedback',
      label: 'Feedback',
      render: (r) =>
        r.schedule?.status === 'COMPLETED' ? (
          <button
            onClick={() => setFeedbackModal(r.trainingScheduleId)}
            className="rounded px-2 py-0.5 text-xs font-medium text-white"
            style={{ backgroundColor: 'var(--accent)' }}
          >
            Give Feedback
          </button>
        ) : '—',
    },
  ];

  const historyColumns: Column<HistoryRow>[] = [
    { key: 'programName', label: 'Program' },
    { key: 'scheduledDate', label: 'Date', render: (r) => (r.scheduledDate ? r.scheduledDate.slice(0, 10) : '—') },
    { key: 'method', label: 'Method', render: (r) => r.method ?? '—' },
    { key: 'attendanceStatus', label: 'Attendance' },
    { key: 'attendancePercent', label: 'Attendance %', render: (r) => (r.attendancePercent != null ? `${r.attendancePercent}%` : '—') },
    { key: 'result', label: 'Result' },
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold" style={{ color: 'var(--foreground)' }}>My Trainings</h1>
        <button
          onClick={() => setRequestModal(true)}
          className="rounded-lg px-4 py-2 text-sm font-medium text-white transition hover:opacity-90"
          style={{ backgroundColor: 'var(--accent)' }}
        >
          + Request Training
        </button>
      </div>

      {error && (
        <div className="rounded-lg px-3 py-2 text-sm" style={{ backgroundColor: '#fef2f2', color: '#dc2626', border: '1px solid #fecaca' }}>
          {error}
        </div>
      )}
      {notice && (
        <div className="rounded-lg px-3 py-2 text-sm" style={{ backgroundColor: '#f0fdf4', color: '#166534', border: '1px solid #bbf7d0' }}>
          {notice}
        </div>
      )}

      {data.mandatoryPending.length > 0 && (
        <section className="rounded-xl border p-4" style={{ borderColor: '#fca5a5', backgroundColor: '#fef2f2' }}>
          <h2 className="mb-2 flex items-center gap-2 text-sm font-semibold" style={{ color: '#991b1b' }}>
            Mandatory Trainings Due
            <span className="inline-flex h-5 min-w-5 items-center justify-center rounded-full px-1.5 text-[11px] font-bold text-white" style={{ backgroundColor: '#dc2626' }}>
              {data.mandatoryPending.length}
            </span>
          </h2>
          <DataTable
            columns={nominationColumns}
            data={data.mandatoryPending}
            loading={loading}
            emptyMessage="No mandatory trainings pending."
          />
        </section>
      )}

      {inductions.length > 0 && (
        <section className="rounded-xl border p-4" style={{ borderColor: 'var(--border)' }}>
          <h2 className="mb-3 text-sm font-semibold" style={{ color: 'var(--foreground)' }}>My Induction</h2>
          <div className="space-y-3">
            {inductions.map((a) => {
              let items: ChecklistTopic[] = [];
              try { items = JSON.parse(a.checklistJson ?? '[]'); } catch { /* ignore */ }
              return (
                <div key={a.id} className="rounded-lg border p-3" style={{ borderColor: 'var(--border)' }}>
                  <div className="mb-2 flex items-center justify-between">
                    <div>
                      <span className="text-sm font-medium" style={{ color: 'var(--foreground)' }}>
                        {a.program?.name ?? `Induction #${a.id}`}
                      </span>
                      <em className="ml-2 text-xs" style={{ color: 'var(--foreground-muted)' }}>
                        {a.program?.durationDays ? `${a.program.durationDays}d` : ''} {a.targetDate ? `· due ${a.targetDate.slice(0, 10)}` : ''}
                      </em>
                    </div>
                    <StatusBadge status={a.status} />
                  </div>
                  {items.length > 0 && (
                    <div className="mb-2 space-y-1">
                      {items.map((it, i) => (
                        <label key={i} className="flex items-center gap-2 text-sm" style={{ color: 'var(--foreground)' }}>
                          <input
                            type="checkbox"
                            checked={!!it.done}
                            disabled={a.status === 'COMPLETED' || a.status === 'CANCELLED'}
                            onChange={() => void inductionAction(a.id, 'CHECK_ITEM', i)}
                            className="h-4 w-4"
                            style={{ accentColor: 'var(--accent)' }}
                          />
                          <span style={{ textDecoration: it.done ? 'line-through' : 'none', color: it.done ? 'var(--foreground-muted)' : 'var(--foreground)' }}>
                            {it.topic ?? `Item ${i + 1}`}
                          </span>
                        </label>
                      ))}
                    </div>
                  )}
                  <div className="flex gap-2">
                    {a.status === 'PENDING' && (
                      <button onClick={() => void inductionAction(a.id, 'START')} className="rounded px-3 py-1 text-xs font-medium text-white" style={{ backgroundColor: 'var(--accent)' }}>
                        Start Induction
                      </button>
                    )}
                    {a.status !== 'COMPLETED' && a.status !== 'CANCELLED' && !a.employeeConfirmed && (
                      <button onClick={() => void inductionAction(a.id, 'CONFIRM')} className="rounded px-3 py-1 text-xs font-medium text-white" style={{ backgroundColor: '#059669' }}>
                        Confirm Completed
                      </button>
                    )}
                    {a.employeeConfirmed && <span className="text-xs" style={{ color: '#059669' }}>✓ Confirmed</span>}
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      )}

      {assessments.length > 0 && (
        <section>
          <h2 className="mb-2 text-sm font-medium" style={{ color: 'var(--foreground-muted)' }}>My Assessments</h2>
          <div className="overflow-hidden rounded-xl border" style={{ borderColor: 'var(--border)' }}>
            <table className="w-full text-sm">
              <tbody>
                {assessments.map((a) => {
                  const submitted = a.latestAttempt?.submittedAt;
                  const result = a.latestAttempt?.result;
                  const canTake = !submitted && a.attemptCount < a.maxAttempts;
                  const grading = result === 'GRADING_PENDING';
                  return (
                    <tr key={a.id} className="border-b last:border-0" style={{ borderColor: 'var(--border)' }}>
                      <td className="px-3 py-2 font-medium" style={{ color: 'var(--foreground)' }}>{a.title}</td>
                      <td className="px-3 py-2 text-xs" style={{ color: 'var(--foreground-muted)' }}>
                        {a.assessmentType} · {a.questionCount} questions · pass {a.passingScore}%{a.durationMinutes ? ` · ${a.durationMinutes} min` : ''}
                      </td>
                      <td className="px-3 py-2 text-xs" style={{ color: 'var(--foreground-muted)' }}>
                        {a.attemptCount}/{a.maxAttempts} attempts
                      </td>
                      <td className="px-3 py-2">
                        {submitted && result ? (
                          <StatusBadge status={result === 'GRADING_PENDING' ? 'PENDING' : result} />
                        ) : '—'}
                        {submitted && result && result !== 'GRADING_PENDING' && (
                          <span className="ml-2 text-xs" style={{ color: 'var(--foreground-muted)' }}>{a.latestAttempt?.scorePercent}%</span>
                        )}
                      </td>
                      <td className="px-3 py-2 text-right">
                        {canTake ? (
                          <button
                            onClick={() => void openTake(a.id)}
                            className="rounded px-3 py-1 text-xs font-medium text-white"
                            style={{ backgroundColor: 'var(--accent)' }}
                          >
                            {a.latestAttempt && !submitted ? 'Resume' : 'Take Test'}
                          </button>
                        ) : grading ? (
                          <span className="text-xs" style={{ color: 'var(--foreground-muted)' }}>Awaiting grading</span>
                        ) : null}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {(data.mentoring?.length ?? 0) > 0 && (
        <section>
          <h2 className="mb-2 text-sm font-medium" style={{ color: 'var(--foreground-muted)' }}>My Mentoring — Sessions I Mentor</h2>
          <div className="space-y-3">
            {(data.mentoring ?? []).map((m) => (
              <div key={m.schedule.id} className="rounded-xl border p-3" style={{ borderColor: 'var(--border)' }}>
                <div className="mb-2 flex items-center justify-between">
                  <div>
                    <span className="text-sm font-medium" style={{ color: 'var(--foreground)' }}>
                      {m.schedule.trainingProgram?.name ?? m.schedule.title ?? `Session #${m.schedule.id}`}
                    </span>
                    <em className="ml-2 text-xs" style={{ color: 'var(--foreground-muted)' }}>
                      {m.schedule.scheduledDate?.slice(0, 10) ?? ''}
                    </em>
                  </div>
                  <StatusBadge status={m.schedule.status} />
                </div>
                {m.mentees.length === 0 ? (
                  <p className="text-xs" style={{ color: 'var(--foreground-muted)' }}>No mentees nominated yet.</p>
                ) : (
                  <div className="space-y-1">
                    {m.mentees.map((e) => (
                      <div key={e.employeeId} className="flex items-center justify-between text-sm">
                        <span style={{ color: 'var(--foreground)' }}>{e.employeeName}</span>
                        {e.evaluated ? (
                          <span className="text-xs" style={{ color: '#059669' }}>✓ Evaluated</span>
                        ) : (
                          <button
                            onClick={() => setEvalTarget({ scheduleId: m.schedule.id, employeeId: e.employeeId, employeeName: e.employeeName })}
                            className="rounded px-3 py-1 text-xs font-medium text-white"
                            style={{ backgroundColor: 'var(--accent)' }}
                          >
                            Evaluate
                          </button>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        </section>
      )}

      <section>
        <h2 className="mb-2 text-sm font-medium" style={{ color: 'var(--foreground-muted)' }}>Upcoming & Pending</h2>
        <DataTable
          columns={nominationColumns}
          data={data.nominations}
          loading={loading}
          emptyMessage="No training nominations yet."
        />
      </section>

      {data.myRequests.length > 0 && (
        <section>
          <h2 className="mb-2 text-sm font-medium" style={{ color: 'var(--foreground-muted)' }}>My Training Requests</h2>
          <DataTable
            columns={requestColumns}
            data={data.myRequests}
            loading={loading}
            emptyMessage="No requests yet."
          />
        </section>
      )}

      <section>
        <h2 className="mb-2 text-sm font-medium" style={{ color: 'var(--foreground-muted)' }}>Training History</h2>
        <DataTable
          columns={historyColumns}
          data={data.history}
          loading={loading}
          emptyMessage="No completed trainings yet."
        />
      </section>

      <FormModal
        title="Training Feedback"
        fields={feedbackFields}
        isOpen={feedbackModal !== null}
        onClose={() => setFeedbackModal(null)}
        onSubmit={handleFeedbackSubmit}
        submitLabel="Submit Feedback"
      />

      <FormModal
        title="Request Training"
        fields={requestFields}
        isOpen={requestModal}
        onClose={() => setRequestModal(false)}
        onSubmit={handleRequestSubmit}
        submitLabel="Submit Request"
      />

      <FormModal
        title={evalTarget ? `Evaluate — ${evalTarget.employeeName}` : 'Evaluate'}
        fields={evalFields}
        isOpen={evalTarget !== null}
        onClose={() => setEvalTarget(null)}
        onSubmit={handleEvalSubmit}
        submitLabel="Submit Evaluation"
      />

      {/* §26: result banner after a submitted attempt. */}
      {testResult && (
        <div className="fixed inset-x-0 bottom-4 z-50 mx-auto w-fit rounded-lg px-4 py-2 text-sm font-medium text-white shadow-lg" style={{ backgroundColor: testResult.result === 'PASS' ? '#16a34a' : testResult.result === 'FAIL' ? '#dc2626' : '#2563eb' }}>
          {testResult.result === 'GRADING_PENDING'
            ? 'Submitted — awaiting trainer grading'
            : `${testResult.result} — ${testResult.scorePercent}%`}
          <button className="ml-3 underline" onClick={() => setTestResult(null)}>Dismiss</button>
        </div>
      )}

      {/* §24/§26: take-test modal — questions rendered per type, countdown timer. */}
      {take && (
        <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto p-6" style={{ backgroundColor: 'rgba(0,0,0,0.4)' }}>
          <div className="w-full max-w-2xl rounded-xl p-5" style={{ backgroundColor: 'var(--surface, #fff)' }}>
            <div className="mb-3 flex items-center justify-between">
              <div>
                <h2 className="text-lg font-semibold" style={{ color: 'var(--foreground)' }}>{take.assessment.title}</h2>
                <p className="text-xs" style={{ color: 'var(--foreground-muted)' }}>
                  {take.assessment.assessmentType} · {take.questions.length} questions · pass {take.assessment.passingScore}%
                </p>
              </div>
              {secondsLeft != null && (
                <span className="rounded-lg px-3 py-1 font-mono text-sm font-bold" style={{ backgroundColor: secondsLeft < 60 ? '#fee2e2' : 'var(--surface-muted)', color: secondsLeft < 60 ? '#dc2626' : 'var(--foreground)' }}>
                  {Math.floor(secondsLeft / 60)}:{String(secondsLeft % 60).padStart(2, '0')}
                </span>
              )}
            </div>

            <div className="max-h-[60vh] space-y-4 overflow-y-auto pr-1">
              {take.questions.map((q, i) => {
                const type = (q.questionType ?? 'MCQ').toUpperCase();
                let opts: string[] = [];
                try { opts = JSON.parse(q.options ?? '[]'); } catch { /* ignore */ }
                const val = answers[q.id] ?? '';
                const set = (v: string) => setAnswers((prev) => ({ ...prev, [q.id]: v }));
                return (
                  <div key={q.id} className="rounded-lg border p-3" style={{ borderColor: 'var(--border)' }}>
                    <p className="mb-2 text-sm font-medium" style={{ color: 'var(--foreground)' }}>
                      {i + 1}. {q.question} <span className="text-xs font-normal" style={{ color: 'var(--foreground-muted)' }}>({q.maxScore} mark{q.maxScore > 1 ? 's' : ''})</span>
                    </p>
                    {(type === 'MCQ' || type === 'MULTI_SELECT' || type === 'MULTIPLE_SELECT') && (
                      <div className="space-y-1">
                        {opts.map((o) => {
                          const multi = type !== 'MCQ';
                          const checked = multi ? val.split(',').map((s) => s.trim()).includes(o) : val === o;
                          return (
                            <label key={o} className="flex items-center gap-2 text-sm" style={{ color: 'var(--foreground)' }}>
                              <input
                                type={multi ? 'checkbox' : 'radio'}
                                name={`q${q.id}`}
                                checked={checked}
                                onChange={() => {
                                  if (!multi) { set(o); return; }
                                  const cur = val ? val.split(',').map((s) => s.trim()).filter(Boolean) : [];
                                  set(checked ? cur.filter((x) => x !== o).join(',') : [...cur, o].join(','));
                                }}
                                style={{ accentColor: 'var(--accent)' }}
                              />
                              {o}
                            </label>
                          );
                        })}
                      </div>
                    )}
                    {type === 'TRUE_FALSE' && (
                      <div className="flex gap-4">
                        {['True', 'False'].map((o) => (
                          <label key={o} className="flex items-center gap-2 text-sm" style={{ color: 'var(--foreground)' }}>
                            <input type="radio" name={`q${q.id}`} checked={val === o} onChange={() => set(o)} style={{ accentColor: 'var(--accent)' }} />
                            {o}
                          </label>
                        ))}
                      </div>
                    )}
                    {type === 'RATING' && (
                      <select
                        value={val}
                        onChange={(e) => set(e.target.value)}
                        className="rounded border px-2 py-1 text-sm"
                        style={{ borderColor: 'var(--border)', color: 'var(--foreground)', backgroundColor: 'transparent' }}
                      >
                        <option value="">— Rate —</option>
                        {[1, 2, 3, 4, 5].map((n) => <option key={n} value={n}>{n}</option>)}
                      </select>
                    )}
                    {(type === 'FILL_BLANK' || type === 'SHORT_ANSWER') && (
                      <input
                        value={val}
                        onChange={(e) => set(e.target.value)}
                        className="w-full rounded border px-2 py-1 text-sm"
                        style={{ borderColor: 'var(--border)', color: 'var(--foreground)', backgroundColor: 'transparent' }}
                        placeholder="Your answer"
                      />
                    )}
                    {(type === 'DESCRIPTIVE' || type === 'SCENARIO' || type === 'PRACTICAL' || !['MCQ', 'MULTI_SELECT', 'MULTIPLE_SELECT', 'TRUE_FALSE', 'RATING', 'FILL_BLANK', 'SHORT_ANSWER'].includes(type)) && (
                      <textarea
                        value={val}
                        onChange={(e) => set(e.target.value)}
                        rows={3}
                        className="w-full rounded border px-2 py-1 text-sm"
                        style={{ borderColor: 'var(--border)', color: 'var(--foreground)', backgroundColor: 'transparent' }}
                        placeholder="Your answer (graded by trainer)"
                      />
                    )}
                  </div>
                );
              })}
            </div>

            <div className="mt-4 flex justify-end gap-2">
              <button
                onClick={() => { setTake(null); setSecondsLeft(null); }}
                className="rounded-lg px-4 py-2 text-sm font-medium"
                style={{ color: 'var(--foreground-muted)', border: '1px solid var(--border)' }}
              >
                Close
              </button>
              <button
                onClick={() => void submitTake()}
                disabled={submitting}
                className="rounded-lg px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
                style={{ backgroundColor: '#16a34a' }}
              >
                {submitting ? 'Submitting…' : 'Submit Test'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
