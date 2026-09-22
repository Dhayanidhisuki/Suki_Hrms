/**
 * My Goals (employee view) — BRD §17 acceptance step.
 *
 * Read-only: the employee reviews what their manager assigned, then accepts
 * or returns it with a remark. Only the employee the goals belong to can act
 * here — the API refuses acceptance from anyone else, HR included, since
 * acceptance is the employee's own acknowledgement.
 */

'use client';

import { useCallback, useEffect, useState } from 'react';
import {
  Alert, Button, EmptyState, PageHeader, SectionCard, Spinner, StatusBadge, type BadgeTone,
} from '@/components/ui';
import { MEASUREMENT_TYPE_OPTIONS, type MeasurementType } from '@/lib/performance/measurement';

interface GoalKpi {
  id: number;
  description: string;
  measurementType: MeasurementType;
  unit: string;
  target: string;
  weightage: string;
  startDate: string;
  endDate: string;
  frequency: string;
  evidenceRequired: boolean;
  managerComments: string | null;
  kpi: { id: number; code: string; name: string };
}
interface GoalKra {
  id: number;
  weightage: string;
  kraCode?: string | null;
  kraName?: string | null;
  kra: { id: number; code: string; name: string; category: string };
  kpis: GoalKpi[];
}
interface GoalSet {
  id: number;
  status: 'DRAFT' | 'PENDING_ACCEPTANCE' | 'ACCEPTED' | 'RETURNED' | 'COMPLETED';
  employeeRemark: string | null;
  cycle: { id: number; code: string; name: string; startDate: string; endDate: string };
  kras: GoalKra[];
  _count?: { kras: number };
}

const STATUS_TONE: Record<GoalSet['status'], BadgeTone> = {
  DRAFT: 'neutral',
  PENDING_ACCEPTANCE: 'warning',
  ACCEPTED: 'success',
  RETURNED: 'danger',
  COMPLETED: 'success',
};
const STATUS_LABEL: Record<GoalSet['status'], string> = {
  DRAFT: 'Being prepared by your manager',
  PENDING_ACCEPTANCE: 'Awaiting your acceptance',
  ACCEPTED: 'Accepted',
  RETURNED: 'Returned to your manager',
  COMPLETED: 'Completed',
};

const TYPE_LABEL = new Map(MEASUREMENT_TYPE_OPTIONS.map((o) => [o.value, o.label]));

export default function MyGoalsPage() {
  const [sets, setSets] = useState<GoalSet[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [remark, setRemark] = useState('');

  const fetchGoals = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      // The goal-assignment list filters by employeeId rather than a "mine"
      // flag, so resolve the viewer's own employee row first — same approach
      // as the KPI/KRA tab on the employee profile. Passing the id explicitly
      // also keeps this page scoped to self for an HR user, who would
      // otherwise match the unfiltered branch and see the whole company.
      const meRes = await fetch('/api/auth/me');
      if (!meRes.ok) throw new Error('Could not load your profile');
      const me = await meRes.json();
      if (typeof me.employeeId !== 'number') {
        setSets([]);
        setError('No employee record is linked to this login, so goals are not available.');
        return;
      }

      const listRes = await fetch(`/api/performance/goal-assignment?employeeId=${me.employeeId}`);
      if (!listRes.ok) throw new Error((await listRes.json().catch(() => ({}))).error ?? 'Failed to load your goals');
      const rows: Array<{ id: number }> = (await listRes.json()).data ?? [];
      // The list returns headers only; the KRA/KPI detail is per-set.
      const details = await Promise.all(
        rows.map(async (r) => {
          const res = await fetch(`/api/performance/goal-assignment/${r.id}`);
          return res.ok ? ((await res.json()) as GoalSet) : null;
        })
      );
      setSets(details.filter((d): d is GoalSet => d != null));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  }, []);

  // This page loads its data in an effect, the pattern every list screen in
  // this app uses. react-hooks/set-state-in-effect flags any setState
  // reachable from an effect — including one that only runs after an await —
  // so it cannot be satisfied by reordering; only moving data loading out of
  // effects entirely would clear it, which is a repo-wide change.
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { void fetchGoals(); }, [fetchGoals]);

  const respond = async (setId: number, action: 'ACCEPT' | 'RETURN') => {
    if (action === 'RETURN' && !remark.trim()) {
      setError('Add a remark so your manager knows what to change.');
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const url =
        action === 'ACCEPT'
          ? `/api/performance/goal-assignment/${setId}/accept`
          : `/api/performance/goal-assignment/${setId}/return`;
      const res = await fetch(url, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ employeeRemarks: remark.trim() || null }),
      });
      const payload = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(payload.error ?? 'Request failed');
      setNotice(action === 'ACCEPT' ? 'Goals accepted.' : 'Goals returned to your manager.');
      setRemark('');
      await fetchGoals();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Request failed');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-4">
      <PageHeader
        eyebrow="Performance"
        title="My Goals"
        description="The KRAs and KPIs assigned to you for this performance cycle. Review and accept them, or return them with a comment."
      />

      {notice && <Alert tone="success" onDismiss={() => setNotice(null)}>{notice}</Alert>}
      {error && <Alert tone="danger" onDismiss={() => setError(null)}>{error}</Alert>}

      {loading ? (
        <div className="flex justify-center p-8"><Spinner /></div>
      ) : sets.length === 0 ? (
        <EmptyState title="No goals assigned yet" description="Your manager has not assigned goals for an open cycle." />
      ) : (
        sets.map((set) => (
          <SectionCard
            key={set.id}
            title={`${set.cycle.code} — ${set.cycle.name}`}
            description={`${set.cycle.startDate.slice(0, 10)} → ${set.cycle.endDate.slice(0, 10)}`}
            actions={<StatusBadge tone={STATUS_TONE[set.status]} dot>{STATUS_LABEL[set.status]}</StatusBadge>}
          >
            {set.status === 'DRAFT' && (
              <Alert tone="info">Your manager is still preparing these goals. You will be able to accept them once submitted.</Alert>
            )}
            {set.status === 'RETURNED' && set.employeeRemark && (
              <Alert tone="warning">You returned these goals: “{set.employeeRemark}”</Alert>
            )}

            <div className="space-y-3">
              {set.kras.map((kra) => (
                <div key={kra.id} className="rounded-lg border" style={{ borderColor: 'var(--border)' }}>
                  <div className="flex items-center justify-between gap-3 border-b p-2.5" style={{ borderColor: 'var(--border)', backgroundColor: 'var(--surface-muted)' }}>
                    <div className="leading-tight">
                      <div className="font-medium">{kra.kraCode ?? kra.kra.code} — {kra.kraName ?? kra.kra.name}</div>
                      <div className="text-[11px]" style={{ color: 'var(--foreground-muted)' }}>{kra.kra.category}</div>
                    </div>
                    <StatusBadge tone="accent">{Number(kra.weightage)}%</StatusBadge>
                  </div>
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="text-left" style={{ color: 'var(--foreground-muted)' }}>
                          <th className="px-2.5 py-2 font-medium">KPI</th>
                          <th className="px-2.5 py-2 font-medium">Measurement</th>
                          <th className="px-2.5 py-2 font-medium">Target</th>
                          <th className="px-2.5 py-2 font-medium">Weight</th>
                          <th className="px-2.5 py-2 font-medium">Period</th>
                          <th className="px-2.5 py-2 font-medium">Evidence</th>
                        </tr>
                      </thead>
                      <tbody>
                        {kra.kpis.map((kpi) => (
                          <tr key={kpi.id} className="border-t align-top" style={{ borderColor: 'var(--border)' }}>
                            <td className="px-2.5 py-2">
                              <div className="font-medium">{kpi.kpi.code} — {kpi.kpi.name}</div>
                              <div className="text-[11px]" style={{ color: 'var(--foreground-muted)' }}>{kpi.description}</div>
                              {kpi.managerComments && (
                                <div className="mt-1 text-[11px] italic" style={{ color: 'var(--foreground-muted)' }}>
                                  Manager: {kpi.managerComments}
                                </div>
                              )}
                            </td>
                            <td className="px-2.5 py-2 text-xs">{TYPE_LABEL.get(kpi.measurementType) ?? kpi.measurementType}</td>
                            <td className="px-2.5 py-2 tabular-nums">{Number(kpi.target)} {kpi.unit}</td>
                            <td className="px-2.5 py-2 tabular-nums">{Number(kpi.weightage)}%</td>
                            <td className="px-2.5 py-2 text-xs tabular-nums">
                              {kpi.startDate.slice(0, 10)} → {kpi.endDate.slice(0, 10)}
                              <div style={{ color: 'var(--foreground-muted)' }}>{kpi.frequency}</div>
                            </td>
                            <td className="px-2.5 py-2 text-xs">{kpi.evidenceRequired ? 'Required' : '—'}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              ))}
            </div>

            {set.status === 'PENDING_ACCEPTANCE' && (
              <div className="mt-4 space-y-2">
                <label className="block text-xs">
                  <span style={{ color: 'var(--foreground-muted)' }}>Comment (required if you return these goals)</span>
                  <textarea
                    rows={2}
                    className="w-full rounded-lg border px-3 py-2 text-sm focus:outline-none focus:ring-2"
                    style={{ backgroundColor: 'var(--background)', color: 'var(--foreground)', borderColor: 'var(--border)' }}
                    value={remark}
                    onChange={(e) => setRemark(e.target.value)}
                  />
                </label>
                <div className="flex flex-wrap gap-2">
                  <Button variant="primary" onClick={() => void respond(set.id, 'ACCEPT')} disabled={busy}>Accept goals</Button>
                  <Button variant="secondary" onClick={() => void respond(set.id, 'RETURN')} disabled={busy}>Return to manager</Button>
                </div>
              </div>
            )}
          </SectionCard>
        ))
      )}
    </div>
  );
}
