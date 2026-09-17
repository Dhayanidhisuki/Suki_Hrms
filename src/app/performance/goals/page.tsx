/**
 * Goal Assignment (manager / HR) — BRD §17.
 *
 * Flow: pick a cycle and employee → create a draft goal set → apply a
 * template or add KPIs by hand → submit for the employee's acceptance.
 *
 * Model A totals are live here via the shared WeightageBuilder, but the API
 * is the enforcement point: PUT re-validates weightages, BRD §41 dates and
 * per-type targets, and submit re-validates from the stored rows.
 */

'use client';

import { useCallback, useEffect, useState } from 'react';
import {
  Alert, Button, EmptyState, PageHeader, SectionCard, Spinner, StatusBadge, type BadgeTone,
} from '@/components/ui';
import WeightageBuilder, { type BuilderKra, type MasterKpi, type MasterKra } from '@/components/performance/WeightageBuilder';

interface Cycle { id: number; code: string; name: string; status: string; startDate: string; endDate: string }
interface Employee { id: number; employeeCode: string; firstName: string; lastName: string }
interface GoalSetRow {
  id: number;
  employeeId: number;
  cycleId: number;
  status: 'DRAFT' | 'PENDING_ACCEPTANCE' | 'ACCEPTED' | 'RETURNED';
  employeeRemark: string | null;
  employee: Employee | null;
  cycle: { id: number; code: string; name: string; status: string };
  _count: { kras: number };
}
interface TemplateRow { id: number; code: string; name: string; status: string }

const STATUS_TONE: Record<GoalSetRow['status'], BadgeTone> = {
  DRAFT: 'neutral',
  PENDING_ACCEPTANCE: 'warning',
  ACCEPTED: 'success',
  RETURNED: 'danger',
};
const STATUS_LABEL: Record<GoalSetRow['status'], string> = {
  DRAFT: 'Draft',
  PENDING_ACCEPTANCE: 'Pending employee acceptance',
  ACCEPTED: 'Accepted',
  RETURNED: 'Returned by employee',
};

const inputCls = 'rounded-lg border px-3 py-2 text-sm focus:outline-none focus:ring-2';
const inputStyle = { backgroundColor: 'var(--background)', color: 'var(--foreground)', borderColor: 'var(--border)' } as const;

const fullName = (e: Employee | null) => (e ? `${e.employeeCode} — ${e.firstName} ${e.lastName}` : 'Unknown employee');

export default function GoalAssignmentPage() {
  const [cycles, setCycles] = useState<Cycle[]>([]);
  const [cycleId, setCycleId] = useState('');
  const [sets, setSets] = useState<GoalSetRow[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [templates, setTemplates] = useState<TemplateRow[]>([]);
  const [kras, setKras] = useState<MasterKra[]>([]);
  const [kpis, setKpis] = useState<MasterKpi[]>([]);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const [openSet, setOpenSet] = useState<GoalSetRow | null>(null);
  const [lines, setLines] = useState<BuilderKra[]>([]);
  const [newEmployeeId, setNewEmployeeId] = useState('');

  const activeCycle = cycles.find((c) => String(c.id) === cycleId);
  const readOnly = openSet != null && (openSet.status === 'ACCEPTED' || openSet.status === 'PENDING_ACCEPTANCE');

  const fetchSets = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/performance/goals?${new URLSearchParams(cycleId ? { cycleId } : {})}`);
      if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error ?? 'Failed to load goal sets');
      setSets((await res.json()).data ?? []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  }, [cycleId]);

  // This page loads its data in an effect, the pattern every list screen in
  // this app uses. react-hooks/set-state-in-effect flags any setState
  // reachable from an effect — including one that only runs after an await —
  // so it cannot be satisfied by reordering; only moving data loading out of
  // effects entirely would clear it, which is a repo-wide change.
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { void fetchSets(); }, [fetchSets]);

  useEffect(() => {
    void (async () => {
      const [c, t, k, p, e] = await Promise.all([
        fetch('/api/masters/performance-cycles'),
        fetch('/api/masters/goal-templates?status=ACTIVE'),
        fetch('/api/masters/kra?status=ACTIVE'),
        fetch('/api/masters/kpi?status=ACTIVE'),
        fetch('/api/employees?limit=1000'),
      ]);
      if (c.ok) {
        const list: Cycle[] = (await c.json()).data ?? [];
        setCycles(list);
        // Default to the open cycle — the only one goals can be assigned in.
        const active = list.find((x) => x.status === 'ACTIVE');
        if (active) setCycleId(String(active.id));
      }
      if (t.ok) setTemplates((await t.json()).data ?? []);
      if (k.ok) setKras((await k.json()).data ?? []);
      if (p.ok) setKpis((await p.json()).data ?? []);
      if (e.ok) setEmployees((await e.json()).data ?? []);
    })();
  }, []);

  /** Load one set's full structure into the builder. */
  const openBuilder = async (row: GoalSetRow) => {
    setError(null);
    const res = await fetch(`/api/performance/goals/${row.id}`);
    if (!res.ok) {
      setError((await res.json().catch(() => ({}))).error ?? 'Failed to open goal set');
      return;
    }
    const full = await res.json();
    setOpenSet({ ...row, ...full });
    setLines(
      (full.kras ?? []).map((k: { kraId: number; weightage: string; kpis: Array<Record<string, unknown>> }) => ({
        kraId: k.kraId,
        weightage: Number(k.weightage),
        kpis: k.kpis.map((p) => ({
          kpiId: p.kpiId as number,
          target: Number(p.target),
          weightage: Number(p.weightage),
          description: p.description as string,
          measurementType: p.measurementType as MasterKpi['measurementType'],
          unit: p.unit as string,
          startDate: String(p.startDate).slice(0, 10),
          endDate: String(p.endDate).slice(0, 10),
          frequency: p.frequency as string,
          evidenceRequired: Boolean(p.evidenceRequired),
          employeeComments: (p.employeeComments as string) ?? '',
          managerComments: (p.managerComments as string) ?? '',
        })),
      }))
    );
  };

  const call = async (url: string, method: string, body?: unknown) => {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        ...(body ? { body: JSON.stringify(body) } : {}),
      });
      const payload = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error([payload.error, ...(payload.details ?? [])].filter(Boolean).join(' · '));
      return payload;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Request failed');
      return null;
    } finally {
      setBusy(false);
    }
  };

  const createSet = async () => {
    if (!newEmployeeId || !cycleId) return;
    const created = await call('/api/performance/goals', 'POST', {
      employeeId: Number(newEmployeeId),
      cycleId: Number(cycleId),
    });
    if (created) {
      setNewEmployeeId('');
      setNotice('Draft goal set created. Apply a template or add KRAs.');
      await fetchSets();
    }
  };

  const applyTemplate = async (templateId: number) => {
    if (!openSet) return;
    const applied = await call(`/api/performance/goals/${openSet.id}/apply-template`, 'POST', {
      templateId,
      replaceExisting: true,
    });
    if (applied) {
      setNotice('Template applied — adjust targets, dates and weightages before submitting.');
      await openBuilder(openSet);
    }
  };

  const saveLines = async () => {
    if (!openSet) return;
    const saved = await call(`/api/performance/goals/${openSet.id}`, 'PUT', {
      kras: lines.map((k) => ({
        kraId: k.kraId,
        weightage: Number(k.weightage),
        kpis: k.kpis.map((p) => ({
          kpiId: p.kpiId,
          description: p.description,
          measurementType: p.measurementType,
          unit: p.unit,
          target: Number(p.target),
          weightage: Number(p.weightage),
          startDate: p.startDate,
          endDate: p.endDate,
          frequency: p.frequency,
          evidenceRequired: Boolean(p.evidenceRequired),
          employeeComments: p.employeeComments || null,
          managerComments: p.managerComments || null,
        })),
      })),
    });
    if (saved) {
      setNotice('Goals saved.');
      await fetchSets();
    }
  };

  const submitSet = async () => {
    if (!openSet) return;
    const done = await call(`/api/performance/goals/${openSet.id}/submit`, 'POST');
    if (done) {
      setNotice('Submitted — the employee can now review and accept.');
      setOpenSet(null);
      await fetchSets();
    }
  };

  const assignable = employees.filter((e) => !sets.some((s) => s.employeeId === e.id && String(s.cycleId) === cycleId));

  return (
    <div className="space-y-4">
      <PageHeader
        eyebrow="Performance"
        title="Goal Assignment"
        description="Assign KRA/KPI goals to your team for a performance cycle, then submit them for acceptance. BRD §17."
        actions={openSet ? <Button variant="ghost" onClick={() => setOpenSet(null)}>Back to list</Button> : undefined}
      />

      {notice && <Alert tone="success" onDismiss={() => setNotice(null)}>{notice}</Alert>}
      {error && <Alert tone="danger" onDismiss={() => setError(null)}>{error}</Alert>}

      {openSet ? (
        <SectionCard
          title={fullName(openSet.employee)}
          description={`${openSet.cycle.code} — ${openSet.cycle.name}`}
          actions={<StatusBadge tone={STATUS_TONE[openSet.status]} dot>{STATUS_LABEL[openSet.status]}</StatusBadge>}
        >
          {openSet.status === 'RETURNED' && openSet.employeeRemark && (
            <Alert tone="warning">Returned by the employee: “{openSet.employeeRemark}”</Alert>
          )}
          {readOnly && (
            <Alert tone="info">
              {openSet.status === 'ACCEPTED'
                ? 'These goals have been accepted and are read-only.'
                : 'These goals are awaiting employee acceptance. The employee must return them before you can edit.'}
            </Alert>
          )}

          {!readOnly && templates.length > 0 && (
            <div className="mb-3 flex flex-wrap items-center gap-2">
              <span className="text-xs" style={{ color: 'var(--foreground-muted)' }}>Start from a template:</span>
              <select
                className={inputCls} style={inputStyle} value=""
                onChange={(e) => { if (e.target.value) void applyTemplate(Number(e.target.value)); }}
                disabled={busy}
              >
                <option value="">Choose a template…</option>
                {templates.map((t) => <option key={t.id} value={t.id}>{t.code} — {t.name}</option>)}
              </select>
              <span className="text-[11px]" style={{ color: 'var(--foreground-muted)' }}>
                Applying replaces the current KRAs.
              </span>
            </div>
          )}

          <WeightageBuilder
            mode="goal"
            masterKras={kras}
            masterKpis={kpis}
            value={lines}
            onChange={setLines}
            cycleWindow={activeCycle ? { startDate: activeCycle.startDate, endDate: activeCycle.endDate } : undefined}
            readOnly={readOnly}
          />

          {!readOnly && (
            <div className="mt-4 flex flex-wrap gap-2">
              <Button variant="secondary" onClick={saveLines} disabled={busy}>Save draft</Button>
              <Button variant="primary" onClick={submitSet} disabled={busy}>Submit for acceptance</Button>
            </div>
          )}
        </SectionCard>
      ) : (
        <>
          <SectionCard title="Cycle">
            <div className="flex flex-wrap items-end gap-3">
              <label className="text-xs">
                <span className="block" style={{ color: 'var(--foreground-muted)' }}>Performance cycle</span>
                <select className={inputCls} style={inputStyle} value={cycleId} onChange={(e) => setCycleId(e.target.value)}>
                  <option value="">All cycles</option>
                  {cycles.map((c) => <option key={c.id} value={c.id}>{c.code} — {c.name} ({c.status})</option>)}
                </select>
              </label>
              {activeCycle && activeCycle.status === 'ACTIVE' && (
                <>
                  <label className="text-xs">
                    <span className="block" style={{ color: 'var(--foreground-muted)' }}>Assign goals to</span>
                    <select className={inputCls} style={inputStyle} value={newEmployeeId} onChange={(e) => setNewEmployeeId(e.target.value)}>
                      <option value="">Choose an employee…</option>
                      {assignable.map((e) => <option key={e.id} value={e.id}>{fullName(e)}</option>)}
                    </select>
                  </label>
                  <Button variant="primary" onClick={createSet} disabled={!newEmployeeId || busy}>+ Create goal set</Button>
                </>
              )}
            </div>
            {activeCycle && activeCycle.status !== 'ACTIVE' && (
              <Alert tone="warning">
                Goals can only be assigned while a cycle is Active — this one is {activeCycle.status.toLowerCase()}.
              </Alert>
            )}
          </SectionCard>

          <SectionCard title="Goal sets" count={loading ? undefined : sets.length} flush>
            {loading ? (
              <div className="flex justify-center p-8"><Spinner /></div>
            ) : sets.length === 0 ? (
              <EmptyState title="No goal sets yet" description="Pick an active cycle and an employee to create one." />
            ) : (
              <ul className="divide-y" style={{ borderColor: 'var(--border)' }}>
                {sets.map((s) => (
                  <li key={s.id} className="flex flex-wrap items-center gap-3 p-3">
                    <div className="min-w-0 flex-1">
                      <div className="font-medium">{fullName(s.employee)}</div>
                      <div className="text-[11px]" style={{ color: 'var(--foreground-muted)' }}>
                        {s.cycle.code} · {s._count.kras} KRA{s._count.kras === 1 ? '' : 's'}
                      </div>
                    </div>
                    <StatusBadge tone={STATUS_TONE[s.status]} dot>{STATUS_LABEL[s.status]}</StatusBadge>
                    <Button variant="ghost" size="sm" onClick={() => void openBuilder(s)}>
                      {s.status === 'ACCEPTED' || s.status === 'PENDING_ACCEPTANCE' ? 'View' : 'Build goals'}
                    </Button>
                  </li>
                ))}
              </ul>
            )}
          </SectionCard>
        </>
      )}
    </div>
  );
}
