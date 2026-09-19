/**
 * Evaluation tab — scorecard with weighted scoring (BRD §5.11, §5.12).
 * Reads ?scheduleId= from URL. Shows snapshot criteria, allows scoring,
 * calculates weighted total, submits with Pass/Fail/Hold/Re-interview.
 */

'use client';

import { Suspense, useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { useToast } from '@/components/ui';
import SearchableSelect from '@/components/ui/SearchableSelect';

interface CriteriaItem {
  criteriaId: number;
  criteriaName: string;
  maxScore: number;
  minScore: number;
  weightage: number;
  passingScore: number;
  ratingScale: string;
}

interface ExistingEval {
  id: number;
  criteriaId: number;
  score: number;
  maxScore: number;
  remarks: string | null;
}

interface ScheduleInfo {
  id: number;
  status: string;
  candidateId: number;
  interviewLevelId: number;
  interviewTypeId: number;
}

interface EvalData {
  schedule: ScheduleInfo;
  criteria: CriteriaItem[];
  existingEvaluations: ExistingEval[];
  summary: { result: string; weightedScore: number; recommendation: string; strengths: string; weaknesses: string; finalRemarks: string } | null;
}

interface ScheduleOption { id: number; candidate: { firstName: string; lastName: string }; interviewLevel: { levelName: string }; scheduledDate: string }

const inputClass = 'w-full rounded-lg border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--accent)]';
const inputStyle = { backgroundColor: 'var(--surface)', color: 'var(--foreground)', borderColor: 'var(--border)' } as const;
const labelClass = 'block text-sm font-medium mb-1';

export default function EvaluationTab() {
  return (
    <Suspense fallback={<div className="p-4 text-sm" style={{ color: 'var(--foreground-muted)' }}>Loading...</div>}>
      <EvaluationInner />
    </Suspense>
  );
}

function EvaluationInner() {
  const searchParams = useSearchParams();
  const toast = useToast();
  const scheduleIdParam = searchParams.get('scheduleId') ?? '';

  const [scheduleId, setScheduleId] = useState(scheduleIdParam);
  const [schedules, setSchedules] = useState<ScheduleOption[]>([]);
  const [data, setData] = useState<EvalData | null>(null);
  const [loading, setLoading] = useState(false);

  const [scores, setScores] = useState<Record<number, number>>({});
  const [remarks, setRemarks] = useState<Record<number, string>>({});
  const [recommendation, setRecommendation] = useState('');
  const [strengths, setStrengths] = useState('');
  const [weaknesses, setWeaknesses] = useState('');
  const [finalRemarks, setFinalRemarks] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    fetch('/api/recruitment/interview-schedules?limit=50').then((r) => r.json()).then((j) => setSchedules(j.data ?? []));
  }, []);

  const fetchData = async (id: string) => {
    if (!id) { setData(null); return; }
    setLoading(true);
    try {
      const res = await fetch(`/api/recruitment/interview-schedules/${id}/evaluate`);
      const json = await res.json();
      if (json.criteria) {
        setData(json);
        // Pre-fill from existing evaluations
        const sMap: Record<number, number> = {};
        const rMap: Record<number, string> = {};
        for (const ev of json.existingEvaluations ?? []) {
          sMap[ev.criteriaId] = ev.score;
          if (ev.remarks) rMap[ev.criteriaId] = ev.remarks;
        }
        setScores(sMap);
        setRemarks(rMap);
        if (json.summary) {
          setRecommendation(json.summary.recommendation ?? '');
          setStrengths(json.summary.strengths ?? '');
          setWeaknesses(json.summary.weaknesses ?? '');
          setFinalRemarks(json.summary.finalRemarks ?? '');
        }
      }
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed to load');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (scheduleIdParam && !scheduleId) setScheduleId(scheduleIdParam);
  }, [scheduleIdParam]);

  useEffect(() => {
    fetchData(scheduleId);
  }, [scheduleId]);

  // Live weighted score calculation
  const liveCalc = (() => {
    if (!data?.criteria.length) return { weighted: 0, passing: 70, result: '—' };
    let weighted = 0;
    let totalWeight = 0;
    for (const c of data.criteria) {
      const score = scores[c.criteriaId] ?? 0;
      const weight = c.weightage ?? 0;
      weighted += (score / c.maxScore) * weight;
      totalWeight += weight;
    }
    const normalized = totalWeight > 0 ? (weighted / totalWeight) * 100 : 0;
    const passing = data.criteria[0]?.passingScore ?? 70;
    const result = normalized >= passing ? 'Pass' : 'Fail';
    return { weighted: normalized, passing, result };
  })();

  const submit = async () => {
    if (!scheduleId || !data) return;
    if (data.criteria.some((c) => scores[c.criteriaId] == null)) {
      toast.error('Please score all criteria');
      return;
    }
    setSubmitting(true);
    try {
      const payload = {
        evaluations: data.criteria.map((c) => ({
          criteriaId: c.criteriaId,
          score: scores[c.criteriaId],
          maxScore: c.maxScore,
          remarks: remarks[c.criteriaId] ?? null,
        })),
        recommendation: recommendation || null,
        strengths: strengths || null,
        weaknesses: weaknesses || null,
        finalRemarks: finalRemarks || null,
      };
      const res = await fetch(`/api/recruitment/interview-schedules/${scheduleId}/evaluate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? 'Submission failed');
      toast.success(`Evaluation submitted — ${json.evaluationSummary?.result} (${Number(json.evaluationSummary?.weightedScore).toFixed(1)}%)`);
      fetchData(scheduleId);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Submission failed');
    } finally {
      setSubmitting(false);
    }
  };

  const scheduleOptions = schedules.map((s) => ({
    label: `#${s.id} — ${s.candidate?.firstName} ${s.candidate?.lastName} (${s.interviewLevel?.levelName ?? ''}, ${new Date(s.scheduledDate).toLocaleDateString()})`,
    value: s.id,
  }));

  return (
    <div className="space-y-4">
      <div className="max-w-md">
        <label className={labelClass} style={{ color: 'var(--foreground)' }}>Select Interview Schedule</label>
        <SearchableSelect value={scheduleId} options={scheduleOptions} onChange={(v) => setScheduleId(String(v))} placeholder="Search by candidate or schedule..." />
      </div>

      {loading && <div className="p-4 text-sm" style={{ color: 'var(--foreground-muted)' }}>Loading scorecard...</div>}

      {data && !loading && (
        <>
          {/* Live score summary */}
          <div className="card p-4">
            <div className="flex items-center justify-between">
              <div>
                <span className="text-xs" style={{ color: 'var(--foreground-muted)' }}>Weighted Score</span>
                <p className="text-2xl font-bold" style={{ color: liveCalc.result === 'Pass' ? '#16a34a' : '#dc2626' }}>
                  {liveCalc.weighted.toFixed(1)}%
                </p>
              </div>
              <div className="text-right">
                <span className="text-xs" style={{ color: 'var(--foreground-muted)' }}>Passing Score</span>
                <p className="text-lg font-semibold" style={{ color: 'var(--foreground)' }}>{liveCalc.passing}%</p>
              </div>
              <div className="text-right">
                <span className="text-xs" style={{ color: 'var(--foreground-muted)' }}>Result</span>
                <p className="text-lg font-semibold" style={{ color: liveCalc.result === 'Pass' ? '#16a34a' : '#dc2626' }}>
                  {liveCalc.result}
                </p>
              </div>
            </div>
          </div>

          {data.summary && (
            <div className="card p-4" style={{ backgroundColor: '#f0fdf4' }}>
              <p className="text-sm font-semibold" style={{ color: '#166534' }}>
                Already evaluated — {data.summary.result} ({Number(data.summary.weightedScore).toFixed(1)}%) · {data.summary.recommendation}
              </p>
            </div>
          )}

          {/* Scorecard */}
          <div className="card p-5 space-y-4">
            <h3 className="text-base font-semibold" style={{ color: 'var(--foreground)' }}>Scorecard</h3>
            <div className="space-y-3">
              {data.criteria.map((c) => (
                <div key={c.criteriaId} className="grid grid-cols-12 gap-3 items-start rounded-lg border p-3" style={{ borderColor: 'var(--border)' }}>
                  <div className="col-span-4">
                    <p className="text-sm font-medium" style={{ color: 'var(--foreground)' }}>{c.criteriaName}</p>
                    <p className="text-xs" style={{ color: 'var(--foreground-muted)' }}>
                      Max: {c.maxScore} · Weight: {c.weightage}% · Pass: {c.passingScore}%
                    </p>
                  </div>
                  <div className="col-span-2">
                    <label className="text-xs" style={{ color: 'var(--foreground-muted)' }}>Score (0-{c.maxScore})</label>
                    <input
                      type="number"
                      min={0}
                      max={c.maxScore}
                      step="0.5"
                      className={inputClass}
                      style={inputStyle}
                      value={scores[c.criteriaId] ?? ''}
                      onChange={(e) => setScores({ ...scores, [c.criteriaId]: Number(e.target.value) })}
                    />
                  </div>
                  <div className="col-span-6">
                    <label className="text-xs" style={{ color: 'var(--foreground-muted)' }}>Remarks</label>
                    <input
                      className={inputClass}
                      style={inputStyle}
                      value={remarks[c.criteriaId] ?? ''}
                      onChange={(e) => setRemarks({ ...remarks, [c.criteriaId]: e.target.value })}
                      placeholder="Optional"
                    />
                  </div>
                </div>
              ))}
            </div>

            {/* Summary fields */}
            <div className="space-y-3 border-t pt-4" style={{ borderColor: 'var(--border)' }}>
              <div>
                <label className={labelClass} style={{ color: 'var(--foreground)' }}>Recommendation</label>
                <select className={inputClass} style={inputStyle} value={recommendation} onChange={(e) => setRecommendation(e.target.value)}>
                  <option value="">Auto (based on score)</option>
                  <option value="Select">Select</option>
                  <option value="Reject">Reject</option>
                  <option value="Hold">Hold</option>
                  <option value="Next Level">Next Level</option>
                  <option value="Re-interview">Re-interview</option>
                </select>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className={labelClass} style={{ color: 'var(--foreground)' }}>Strengths</label>
                  <textarea className={inputClass} style={inputStyle} rows={2} value={strengths} onChange={(e) => setStrengths(e.target.value)} />
                </div>
                <div>
                  <label className={labelClass} style={{ color: 'var(--foreground)' }}>Weaknesses</label>
                  <textarea className={inputClass} style={inputStyle} rows={2} value={weaknesses} onChange={(e) => setWeaknesses(e.target.value)} />
                </div>
              </div>
              <div>
                <label className={labelClass} style={{ color: 'var(--foreground)' }}>Final Remarks</label>
                <textarea className={inputClass} style={inputStyle} rows={2} value={finalRemarks} onChange={(e) => setFinalRemarks(e.target.value)} />
              </div>
            </div>

            <div className="flex justify-end">
              <button onClick={submit} disabled={submitting} className="rounded-lg px-6 py-2 text-sm font-medium text-white" style={{ backgroundColor: 'var(--accent)', opacity: submitting ? 0.6 : 1 }}>
                {submitting ? 'Submitting...' : 'Submit Evaluation'}
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
