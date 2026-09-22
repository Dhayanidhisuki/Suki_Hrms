/**
 * Goal Assignment — apply an Active template to employees for a cycle.
 *
 * Bulk assign deep-copies the template snapshot and lands each set in
 * Pending Acceptance, so later template edits cannot rewrite issued goals.
 * A set the employee returns can be re-assigned, which re-issues it from the
 * (possibly corrected) template.
 */

'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Alert, Button, DataTable, PageHeader, SectionCard, Spinner, StatusBadge,
  type Column, type BadgeTone,
} from '@/components/ui';

interface Cycle { id: number; code: string; name: string; status: string; startDate: string; endDate: string }
interface Employee {
  id: number;
  employeeCode: string;
  firstName: string;
  lastName: string;
  jobInfos?: Array<{ department?: { id: number; name: string } | null; designation?: { id: number; name: string } | null }>;
}
interface TemplateKpi { kpiId: number; weightage: string; target: string; unit?: string; kpi?: { code: string; name: string } }
interface TemplateKra {
  kraId: number;
  weightage: string;
  kraCode?: string | null;
  kraName?: string | null;
  kra?: { code: string; name: string };
  kpis: TemplateKpi[];
}
interface TemplateRow {
  id: number;
  code: string;
  name: string;
  departmentId: number | null;
  designationId: number | null;
  kras: TemplateKra[];
  _count?: { kras: number };
}
interface AssignmentRow {
  id: number;
  employeeId: number;
  cycleId: number;
  status: 'DRAFT' | 'PENDING_ACCEPTANCE' | 'ACCEPTED' | 'RETURNED' | 'COMPLETED';
  createdAt: string;
  submittedAt: string | null;
  employeeRemark: string | null;
  employee: { id: number; employeeCode: string; firstName: string; lastName: string } | null;
  cycle: { id: number; code: string; name: string; status: string };
  template: { id: number; code: string; name: string } | null;
  _count: { kras: number };
  kras?: Array<{
    id: number;
    weightage: string;
    kraCode?: string | null;
    kraName?: string | null;
    kra: { code: string; name: string; category: string };
    kpis: Array<{
      id: number;
      target: string;
      unit: string;
      weightage: string;
      measurementType: string;
      kpi: { code: string; name: string };
    }>;
  }>;
}

interface Option { id: number; code: string; name: string }

const STATUS_TONE: Record<AssignmentRow['status'], BadgeTone> = {
  DRAFT: 'neutral',
  PENDING_ACCEPTANCE: 'warning',
  ACCEPTED: 'success',
  RETURNED: 'danger',
  COMPLETED: 'success',
};
const STATUS_LABEL: Record<AssignmentRow['status'], string> = {
  DRAFT: 'Draft',
  PENDING_ACCEPTANCE: 'Pending Acceptance',
  ACCEPTED: 'Accepted',
  RETURNED: 'Returned',
  COMPLETED: 'Completed',
};

const inputCls = 'rounded-lg border px-3 py-2 text-sm focus:outline-none focus:ring-2';
const inputStyle = { backgroundColor: 'var(--background)', color: 'var(--foreground)', borderColor: 'var(--border)' } as const;

const fullName = (e: AssignmentRow['employee'] | Employee | null) =>
  e ? `${e.employeeCode} — ${e.firstName} ${e.lastName}` : 'Unknown employee';

export default function GoalAssignmentPage() {
  const [cycles, setCycles] = useState<Cycle[]>([]);
  const [templates, setTemplates] = useState<TemplateRow[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [departments, setDepartments] = useState<Option[]>([]);
  const [rows, setRows] = useState<AssignmentRow[]>([]);

  const [cycleId, setCycleId] = useState('');
  const [departmentId, setDepartmentId] = useState('');
  const [status, setStatus] = useState('');

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const [wizard, setWizard] = useState(false);
  const [wizCycleId, setWizCycleId] = useState('');
  const [wizTemplateId, setWizTemplateId] = useState('');
  const [wizDept, setWizDept] = useState('');
  const [wizDesig, setWizDesig] = useState('');
  const [wizSearch, setWizSearch] = useState('');
  const [selected, setSelected] = useState<number[]>([]);
  const [viewing, setViewing] = useState<AssignmentRow | null>(null);

  const fetchRows = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        ...(cycleId ? { cycleId } : {}),
        ...(departmentId ? { departmentId } : {}),
        ...(status ? { status } : {}),
      });
      const res = await fetch(`/api/performance/goal-assignment?${params}`);
      if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error ?? 'Failed to load assignments');
      setRows((await res.json()).data ?? []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  }, [cycleId, departmentId, status]);

  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { void fetchRows(); }, [fetchRows]);

  useEffect(() => {
    void (async () => {
      const [c, t, e, d] = await Promise.all([
        fetch('/api/masters/performance-cycles'),
        fetch('/api/performance/goal-templates'),
        fetch('/api/employees?limit=1000'),
        fetch('/api/masters/departments?limit=500'),
      ]);
      if (c.ok) {
        const list: Cycle[] = (await c.json()).data ?? [];
        setCycles(list);
        const active = list.find((x) => x.status === 'ACTIVE');
        if (active) {
          setCycleId(String(active.id));
          setWizCycleId(String(active.id));
        }
      }
      if (t.ok) setTemplates((await t.json()).data ?? []);
      if (e.ok) setEmployees((await e.json()).data ?? []);
      if (d.ok) setDepartments((await d.json()).data ?? []);
    })();
  }, []);

  const designations = useMemo(() => {
    const map = new Map<number, string>();
    for (const emp of employees) {
      const d = emp.jobInfos?.[0]?.designation;
      if (d) map.set(d.id, d.name);
    }
    return [...map.entries()].map(([id, name]) => ({ id, name }));
  }, [employees]);

  const assignedIds = useMemo(() => {
    const targetCycle = Number(wizCycleId || cycleId);
    return new Set(rows.filter((r) => r.cycleId === targetCycle).map((r) => r.employeeId));
  }, [rows, wizCycleId, cycleId]);

  const pickable = useMemo(() => {
    const q = wizSearch.trim().toLowerCase();
    return employees.filter((emp) => {
      if (assignedIds.has(emp.id)) return false;
      const job = emp.jobInfos?.[0];
      if (wizDept && job?.department?.id !== Number(wizDept)) return false;
      if (wizDesig && job?.designation?.id !== Number(wizDesig)) return false;
      if (!q) return true;
      return `${emp.employeeCode} ${emp.firstName} ${emp.lastName}`.toLowerCase().includes(q);
    });
  }, [employees, assignedIds, wizDept, wizDesig, wizSearch]);

  const preview = templates.find((t) => String(t.id) === wizTemplateId);

  const openView = async (row: AssignmentRow) => {
    const res = await fetch(`/api/performance/goal-assignment/${row.id}`);
    if (!res.ok) {
      setError((await res.json().catch(() => ({}))).error ?? 'Failed to load assignment');
      return;
    }
    setViewing(await res.json());
  };

  const assign = async () => {
    if (!wizCycleId || !wizTemplateId || selected.length === 0) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch('/api/performance/goal-assignment', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          cycleId: Number(wizCycleId),
          templateId: Number(wizTemplateId),
          employeeIds: selected,
        }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error([body.error, ...(body.details ?? [])].filter(Boolean).join(' · '));
      const skipNote = body.skippedCount ? ` ${body.skippedCount} skipped.` : '';
      setNotice(`Assigned goals to ${body.assignedCount} employee${body.assignedCount === 1 ? '' : 's'}.${skipNote}`);
      setWizard(false);
      setSelected([]);
      await fetchRows();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Assign failed');
    } finally {
      setBusy(false);
    }
  };

  const columns: Column<AssignmentRow>[] = [
    { key: 'employee', label: 'Employee Name', render: (r) => fullName(r.employee) },
    { key: 'template', label: 'Template Used', render: (r) => (r.template ? `${r.template.code} — ${r.template.name}` : '—') },
    { key: 'cycle', label: 'Cycle', render: (r) => r.cycle.code },
    {
      key: 'status',
      label: 'Status',
      render: (r) => <StatusBadge tone={STATUS_TONE[r.status]} dot>{STATUS_LABEL[r.status]}</StatusBadge>,
    },
    {
      key: 'assigned',
      label: 'Assigned Date',
      render: (r) => (r.submittedAt ?? r.createdAt).slice(0, 10),
    },
  ];

  const wizCycle = cycles.find((c) => String(c.id) === wizCycleId);

  return (
    <div className="space-y-4">
      <PageHeader
        eyebrow="Performance"
        title="Goal Assignment"
        description="Assign an Active goal template to employees for a performance cycle. Each assignment copies the template snapshot; the employee then accepts or returns it."
        actions={
          viewing || wizard
            ? <Button variant="ghost" onClick={() => { setViewing(null); setWizard(false); }}>Back to list</Button>
            : <Button variant="primary" onClick={() => { setWizard(true); setError(null); }}>Assign Goals</Button>
        }
      />

      {notice && <Alert tone="success" onDismiss={() => setNotice(null)}>{notice}</Alert>}
      {error && <Alert tone="danger" onDismiss={() => setError(null)}>{error}</Alert>}

      {viewing ? (
        <SectionCard
          title={fullName(viewing.employee)}
          description={`${viewing.cycle.code} — ${viewing.template ? `${viewing.template.code} ${viewing.template.name}` : 'Custom'}`}
          actions={<StatusBadge tone={STATUS_TONE[viewing.status]} dot>{STATUS_LABEL[viewing.status]}</StatusBadge>}
        >
          {viewing.status === 'RETURNED' && viewing.employeeRemark && (
            <Alert tone="warning">Returned: “{viewing.employeeRemark}”</Alert>
          )}
          <div className="space-y-3">
            {(viewing.kras ?? []).map((kra) => (
              <div key={kra.id} className="rounded-lg border" style={{ borderColor: 'var(--border)' }}>
                <div className="flex justify-between gap-2 border-b p-2.5" style={{ borderColor: 'var(--border)', backgroundColor: 'var(--surface-muted)' }}>
                  <span className="font-medium">{kra.kraCode ?? kra.kra.code} — {kra.kraName ?? kra.kra.name}</span>
                  <StatusBadge tone="accent">{Number(kra.weightage)}%</StatusBadge>
                </div>
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-left" style={{ color: 'var(--foreground-muted)' }}>
                      <th className="px-2.5 py-2 font-medium">KPI</th>
                      <th className="px-2.5 py-2 font-medium">Target</th>
                      <th className="px-2.5 py-2 font-medium">Weight</th>
                    </tr>
                  </thead>
                  <tbody>
                    {kra.kpis.map((kpi) => (
                      <tr key={kpi.id} className="border-t" style={{ borderColor: 'var(--border)' }}>
                        <td className="px-2.5 py-2">{kpi.kpi.code} — {kpi.kpi.name}</td>
                        <td className="px-2.5 py-2 tabular-nums">{Number(kpi.target)} {kpi.unit}</td>
                        <td className="px-2.5 py-2 tabular-nums">{Number(kpi.weightage)}%</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ))}
          </div>
        </SectionCard>
      ) : wizard ? (
        <SectionCard title="Assign Goals">
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            <label className="text-xs">
              <span className="block" style={{ color: 'var(--foreground-muted)' }}>Cycle *</span>
              <select className={inputCls} style={{ ...inputStyle, width: '100%' }} value={wizCycleId} onChange={(e) => setWizCycleId(e.target.value)}>
                <option value="">Choose a cycle…</option>
                {cycles.map((c) => <option key={c.id} value={c.id}>{c.code} — {c.name} ({c.status})</option>)}
              </select>
            </label>
            <label className="text-xs sm:col-span-2">
              <span className="block" style={{ color: 'var(--foreground-muted)' }}>Template *</span>
              <select className={inputCls} style={{ ...inputStyle, width: '100%' }} value={wizTemplateId} onChange={(e) => setWizTemplateId(e.target.value)}>
                <option value="">Choose an Active template…</option>
                {templates.map((t) => <option key={t.id} value={t.id}>{t.code} — {t.name}</option>)}
              </select>
            </label>
          </div>
          {wizCycle && wizCycle.status !== 'ACTIVE' && (
            <Alert tone="warning">Goals can only be assigned while a cycle is Active — this one is {wizCycle.status.toLowerCase()}.</Alert>
          )}

          {preview && (
            <div className="mt-4 rounded-lg border p-3" style={{ borderColor: 'var(--border)' }}>
              <div className="mb-2 text-sm font-medium">Preview — {preview.code}</div>
              {/*
                Full KRA → KPI breakdown, not just a count: this is exactly the
                snapshot each selected employee is about to receive, so the
                assigner should see the targets before confirming.
              */}
              <ul className="space-y-2 text-sm">
                {preview.kras.map((k) => (
                  <li key={k.kraId}>
                    <div className="flex justify-between gap-2 font-medium">
                      <span>{k.kraCode ?? k.kra?.code ? `${k.kraCode ?? k.kra?.code} — ${k.kraName ?? k.kra?.name}` : `KRA #${k.kraId}`}</span>
                      <span className="tabular-nums" style={{ color: 'var(--foreground-muted)' }}>
                        {Number(k.weightage)}%
                      </span>
                    </div>
                    <ul className="mt-1 space-y-0.5 pl-3">
                      {k.kpis.map((p) => (
                        <li
                          key={p.kpiId}
                          className="flex justify-between gap-2 text-xs"
                          style={{ color: 'var(--foreground-muted)' }}
                        >
                          <span className="truncate">{p.kpi ? `${p.kpi.code} — ${p.kpi.name}` : `KPI #${p.kpiId}`}</span>
                          <span className="shrink-0 tabular-nums">
                            target {Number(p.target)}{p.unit ? ` ${p.unit}` : ''} · {Number(p.weightage)}%
                          </span>
                        </li>
                      ))}
                    </ul>
                  </li>
                ))}
              </ul>
            </div>
          )}

          <div className="mt-4 grid gap-3 sm:grid-cols-3">
            <label className="text-xs">
              <span className="block" style={{ color: 'var(--foreground-muted)' }}>Filter department</span>
              <select className={inputCls} style={{ ...inputStyle, width: '100%' }} value={wizDept} onChange={(e) => setWizDept(e.target.value)}>
                <option value="">All</option>
                {departments.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
              </select>
            </label>
            <label className="text-xs">
              <span className="block" style={{ color: 'var(--foreground-muted)' }}>Filter designation</span>
              <select className={inputCls} style={{ ...inputStyle, width: '100%' }} value={wizDesig} onChange={(e) => setWizDesig(e.target.value)}>
                <option value="">All</option>
                {designations.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
              </select>
            </label>
            <label className="text-xs">
              <span className="block" style={{ color: 'var(--foreground-muted)' }}>Search employees</span>
              <input className={inputCls} style={{ ...inputStyle, width: '100%' }} value={wizSearch} onChange={(e) => setWizSearch(e.target.value)} />
            </label>
          </div>

          <div className="mt-3 max-h-64 overflow-y-auto rounded-lg border" style={{ borderColor: 'var(--border)' }}>
            {pickable.length === 0 ? (
              <p className="p-3 text-sm" style={{ color: 'var(--foreground-muted)' }}>No matching employees (or they already have goals for this cycle).</p>
            ) : pickable.map((emp) => (
              <label key={emp.id} className="flex items-center gap-2 border-b px-3 py-2 text-sm last:border-b-0" style={{ borderColor: 'var(--border)' }}>
                <input
                  type="checkbox"
                  checked={selected.includes(emp.id)}
                  onChange={(e) => setSelected((curr) => (e.target.checked ? [...curr, emp.id] : curr.filter((id) => id !== emp.id)))}
                />
                <span>{fullName(emp)}</span>
                <span className="ml-auto text-[11px]" style={{ color: 'var(--foreground-muted)' }}>
                  {emp.jobInfos?.[0]?.department?.name ?? ''}
                </span>
              </label>
            ))}
          </div>

          <div className="mt-4 flex flex-wrap gap-2">
            <Button
              variant="primary"
              onClick={() => void assign()}
              disabled={busy || !wizCycleId || !wizTemplateId || selected.length === 0 || wizCycle?.status !== 'ACTIVE'}
            >
              {busy ? 'Assigning…' : `Confirm assign (${selected.length})`}
            </Button>
            <Button variant="ghost" onClick={() => setWizard(false)}>Cancel</Button>
          </div>
        </SectionCard>
      ) : loading ? (
        <div className="flex justify-center p-8"><Spinner /></div>
      ) : (
        <DataTable
          variant="card"
          columns={columns}
          data={rows}
          searchPlaceholder="Filter in this list…"
          filters={
            <>
              <select className={inputCls} style={inputStyle} value={cycleId} onChange={(e) => setCycleId(e.target.value)}>
                <option value="">All cycles</option>
                {cycles.map((c) => <option key={c.id} value={c.id}>{c.code} — {c.name}</option>)}
              </select>
              <select className={inputCls} style={inputStyle} value={departmentId} onChange={(e) => setDepartmentId(e.target.value)}>
                <option value="">All departments</option>
                {departments.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
              </select>
              <select className={inputCls} style={inputStyle} value={status} onChange={(e) => setStatus(e.target.value)}>
                <option value="">All statuses</option>
                <option value="PENDING_ACCEPTANCE">Pending</option>
                <option value="ACCEPTED">Accepted</option>
                <option value="RETURNED">Returned</option>
                <option value="DRAFT">Draft</option>
              </select>
            </>
          }
          emptyMessage="No goal assignments yet. Use Assign Goals to copy a template onto employees."
          renderRowActions={(row) => (
            <Button variant="ghost" size="xs" onClick={() => void openView(row)}>View</Button>
          )}
        />
      )}
    </div>
  );
}
