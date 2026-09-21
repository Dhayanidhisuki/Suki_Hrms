/**
 * Employee Master → KPI / KRA tab.
 *
 * Shows each assigned goal set with KRA/KPI breakdown. Accept/Return is
 * only shown when the logged-in user *is* this employee and the set is
 * pending acceptance. Managers still build/assign on /performance/goal-assignment.
 */

'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { Alert, Button, EmptyState, Spinner, StatusBadge, type BadgeTone } from '@/components/ui';

interface GoalKpi {
  id: number;
  target: string;
  unit: string;
  weightage: string;
  kpi: { code: string; name: string };
}
interface GoalKra {
  id: number;
  weightage: string;
  kra: { code: string; name: string; category: string };
  kpis: GoalKpi[];
}
interface GoalSetRow {
  id: number;
  employeeId: number;
  status: 'DRAFT' | 'PENDING_ACCEPTANCE' | 'ACCEPTED' | 'RETURNED' | 'COMPLETED';
  submittedAt: string | null;
  acceptedAt: string | null;
  employeeRemark: string | null;
  cycle: { id: number; code: string; name: string; status: string };
  template?: { code: string; name: string } | null;
  _count: { kras: number };
  kras?: GoalKra[];
}

const STATUS_TONE: Record<GoalSetRow['status'], BadgeTone> = {
  DRAFT: 'neutral',
  PENDING_ACCEPTANCE: 'warning',
  ACCEPTED: 'success',
  RETURNED: 'danger',
  COMPLETED: 'success',
};
const STATUS_LABEL: Record<GoalSetRow['status'], string> = {
  DRAFT: 'Draft',
  PENDING_ACCEPTANCE: 'Pending acceptance',
  ACCEPTED: 'Accepted',
  RETURNED: 'Returned by employee',
  COMPLETED: 'Completed',
};

export default function EmployeeKraTab({ employeeId }: { employeeId: string | number }) {
  const [rows, setRows] = useState<GoalSetRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [selfEmployeeId, setSelfEmployeeId] = useState<number | null>(null);
  const [remark, setRemark] = useState('');
  const [openId, setOpenId] = useState<number | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [listRes, meRes] = await Promise.all([
        fetch(`/api/performance/goal-assignment?employeeId=${employeeId}`),
        fetch('/api/auth/me'),
      ]);
      if (!listRes.ok) throw new Error((await listRes.json().catch(() => ({}))).error ?? 'Failed to load goals');
      const headers: GoalSetRow[] = (await listRes.json()).data ?? [];
      if (meRes.ok) {
        const me = await meRes.json();
        setSelfEmployeeId(typeof me.employeeId === 'number' ? me.employeeId : null);
      }
      const details = await Promise.all(
        headers.map(async (h) => {
          const res = await fetch(`/api/performance/goal-assignment/${h.id}`);
          return res.ok ? ({ ...h, ...(await res.json()) } as GoalSetRow) : h;
        })
      );
      setRows(details);
      if (details[0]) setOpenId(details[0].id);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  }, [employeeId]);

  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { void load(); }, [load]);

  const isSelf = selfEmployeeId != null && selfEmployeeId === Number(employeeId);

  const respond = async (id: number, action: 'ACCEPT' | 'RETURN') => {
    if (action === 'RETURN' && !remark.trim()) {
      setError('Add a remark so the manager knows what to change.');
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const url =
        action === 'ACCEPT'
          ? `/api/performance/goal-assignment/${id}/accept`
          : `/api/performance/goal-assignment/${id}/return`;
      const res = await fetch(url, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ employeeRemarks: remark.trim() || null }),
      });
      if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error ?? 'Request failed');
      setNotice(action === 'ACCEPT' ? 'Goals accepted.' : 'Goals returned.');
      setRemark('');
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Request failed');
    } finally {
      setBusy(false);
    }
  };

  if (loading) return <div className="flex justify-center p-8"><Spinner /></div>;
  if (error && rows.length === 0) return <Alert tone="danger">{error}</Alert>;
  if (rows.length === 0) {
    return (
      <EmptyState
        title="No goals assigned"
        description="This employee has no KRA/KPI goals for any performance cycle yet."
      />
    );
  }

  return (
    <div className="space-y-3">
      {notice && <Alert tone="success">{notice}</Alert>}
      {error && <Alert tone="danger">{error}</Alert>}
      {rows.map((row) => {
        const open = openId === row.id;
        return (
          <div key={row.id} className="rounded-lg border" style={{ borderColor: 'var(--border)' }}>
            <button
              type="button"
              className="flex w-full flex-wrap items-center gap-3 p-3 text-left"
              onClick={() => setOpenId(open ? null : row.id)}
            >
              <div className="min-w-0 flex-1 leading-tight">
                <div className="font-medium">{row.cycle.code} — {row.cycle.name}</div>
                <div className="text-[11px]" style={{ color: 'var(--foreground-muted)' }}>
                  {row.template ? `${row.template.code} · ` : ''}
                  {row._count.kras} KRA{row._count.kras === 1 ? '' : 's'}
                  {row.acceptedAt
                    ? ` · accepted ${row.acceptedAt.slice(0, 10)}`
                    : row.submittedAt
                      ? ` · assigned ${row.submittedAt.slice(0, 10)}`
                      : ''}
                </div>
              </div>
              <StatusBadge tone={STATUS_TONE[row.status]} dot>{STATUS_LABEL[row.status]}</StatusBadge>
            </button>

            {open && (
              <div className="space-y-3 border-t p-3" style={{ borderColor: 'var(--border)' }}>
                {(row.kras ?? []).map((kra) => (
                  <div key={kra.id}>
                    <div className="mb-1 flex justify-between text-sm">
                      <span className="font-medium">{kra.kra.code} — {kra.kra.name}</span>
                      <span className="tabular-nums" style={{ color: 'var(--foreground-muted)' }}>{Number(kra.weightage)}%</span>
                    </div>
                    <ul className="space-y-0.5 text-sm">
                      {kra.kpis.map((kpi) => (
                        <li key={kpi.id} className="flex justify-between gap-2">
                          <span>{kpi.kpi.code} — {kpi.kpi.name}</span>
                          <span className="shrink-0 tabular-nums" style={{ color: 'var(--foreground-muted)' }}>
                            {Number(kpi.target)} {kpi.unit} · {Number(kpi.weightage)}%
                          </span>
                        </li>
                      ))}
                    </ul>
                  </div>
                ))}

                {isSelf && row.status === 'PENDING_ACCEPTANCE' && (
                  <div className="space-y-2">
                    <textarea
                      rows={2}
                      className="w-full rounded-lg border px-3 py-2 text-sm"
                      style={{ backgroundColor: 'var(--background)', color: 'var(--foreground)', borderColor: 'var(--border)' }}
                      placeholder="Comment (required to return)"
                      value={remark}
                      onChange={(e) => setRemark(e.target.value)}
                    />
                    <div className="flex gap-2">
                      <Button variant="primary" size="sm" onClick={() => void respond(row.id, 'ACCEPT')} disabled={busy}>Accept</Button>
                      <Button variant="secondary" size="sm" onClick={() => void respond(row.id, 'RETURN')} disabled={busy}>Return</Button>
                    </div>
                  </div>
                )}

                <Link
                  href="/performance/goal-assignment"
                  className="inline-block text-sm underline"
                  style={{ color: 'var(--accent)' }}
                >
                  Open assignment
                </Link>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
