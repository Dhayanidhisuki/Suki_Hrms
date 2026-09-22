/**
 * Goal Assignment Coverage.
 *
 * For one performance cycle: who has been assigned goals, who has accepted,
 * and — the reason the report exists — who has nothing at all. Driven from
 * the employee population rather than from goal sets, so an employee with no
 * record still appears as a row.
 *
 * Read-only. Nothing here advances a workflow.
 */

'use client';

import { useCallback, useEffect, useState } from 'react';
import * as XLSX from 'xlsx';
import {
  Alert, Button, DataTable, KPICard, KPIGrid, PageHeader, SectionCard, StatusBadge, Spinner,
  type BadgeTone, type Column,
} from '@/components/ui';

interface Row {
  // DataTable keys rows by `id`; coverage is per employee, and an employee
  // with no goal set has no goalSetId to key on.
  id: number;
  employeeId: number;
  employeeCode: string;
  employeeName: string;
  designation: string | null;
  department: string | null;
  joinDate: string | null;
  reportingManager: string | null;
  goalSetId: number | null;
  status: string;
  fromTemplate: boolean;
  kraCount: number;
  kpiCount: number;
  submittedAt: string | null;
  acceptedAt: string | null;
  returnedAt: string | null;
  employeeRemark: string | null;
  pendingDays: number | null;
}

interface Summary {
  eligible: number;
  withGoals: number;
  notAssigned: number;
  accepted: number;
  assignedPct: number;
  acceptedPct: number;
  byStatus: Record<string, number>;
  joinedAfterCycle: number;
  shown: number;
}

interface Cycle {
  id: number;
  code: string;
  name: string;
  startDate?: string;
  endDate?: string;
  goalSettingEnd?: string;
  status?: string;
}

interface Department { id: number; name: string }

const EMPTY_SUMMARY: Summary = {
  eligible: 0, withGoals: 0, notAssigned: 0, accepted: 0,
  assignedPct: 0, acceptedPct: 0, byStatus: {}, joinedAfterCycle: 0, shown: 0,
};

const STATUSES = ['NOT_ASSIGNED', 'DRAFT', 'PENDING_ACCEPTANCE', 'ACCEPTED', 'RETURNED', 'COMPLETED'];

const STATUS_TONE: Record<string, BadgeTone> = {
  NOT_ASSIGNED: 'danger',
  DRAFT: 'neutral',
  PENDING_ACCEPTANCE: 'warning',
  ACCEPTED: 'success',
  RETURNED: 'danger',
  COMPLETED: 'info',
};

const inputCls = 'rounded-lg border px-3 py-2 text-sm focus:outline-none focus:ring-2';
const inputStyle = { backgroundColor: 'var(--background)', color: 'var(--foreground)', borderColor: 'var(--border)' } as const;

const titleCase = (s: string) => s.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
const day = (s: string | null) => s?.slice(0, 10) ?? '';

export default function GoalCoverageReportPage() {
  const [cycles, setCycles] = useState<Cycle[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [cycleId, setCycleId] = useState('');
  const [departmentId, setDepartmentId] = useState('');
  const [status, setStatus] = useState('');
  const [q, setQ] = useState('');

  const [cycle, setCycle] = useState<Cycle | null>(null);
  const [rows, setRows] = useState<Row[]>([]);
  const [summary, setSummary] = useState<Summary>(EMPTY_SUMMARY);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Filter sources. The cycle drives everything, so default to the first
  // Active one — a coverage report with no cycle selected shows nothing and
  // looks broken.
  const loadFilters = useCallback(async () => {
    try {
      const [cyclesRes, deptRes] = await Promise.all([
        fetch('/api/masters/performance-cycles'),
        fetch('/api/masters/departments?limit=500'),
      ]);
      const cyclesBody = cyclesRes.ok ? await cyclesRes.json() : {};
      const deptBody = deptRes.ok ? await deptRes.json() : {};
      const cycleList: Cycle[] = cyclesBody.data ?? [];
      setCycles(cycleList);
      setDepartments(deptBody.data ?? []);
      const preferred = cycleList.find((c) => c.status === 'ACTIVE') ?? cycleList[0];
      if (preferred) setCycleId(String(preferred.id));
    } catch {
      setError('Could not load cycles and departments.');
    }
  }, []);

  // Same fetch-in-effect shape every list screen in this app uses.
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { void loadFilters(); }, [loadFilters]);

  const fetchData = useCallback(async () => {
    if (!cycleId) return;
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({
        cycleId,
        ...(departmentId ? { departmentId } : {}),
        ...(status ? { status } : {}),
        ...(q ? { q } : {}),
      });
      const res = await fetch(`/api/reports/performance/goal-coverage?${params}`);
      if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error ?? 'Failed to load coverage');
      const body = await res.json();
      setCycle(body.cycle ?? null);
      setRows(((body.data ?? []) as Omit<Row, 'id'>[]).map((r) => ({ ...r, id: r.employeeId })));
      setSummary(body.summary ?? EMPTY_SUMMARY);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
      setRows([]);
      setSummary(EMPTY_SUMMARY);
    } finally {
      setLoading(false);
    }
  }, [cycleId, departmentId, status, q]);

  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { void fetchData(); }, [fetchData]);

  const exportExcel = () => {
    if (rows.length === 0) return;
    const sheet = rows.map((r) => ({
      'Employee Code': r.employeeCode,
      'Employee Name': r.employeeName,
      Designation: r.designation ?? '',
      Department: r.department ?? '',
      'Join Date': day(r.joinDate),
      'Reporting Manager': r.reportingManager ?? '',
      Status: titleCase(r.status),
      'From Template': r.goalSetId ? (r.fromTemplate ? 'Yes' : 'No') : '',
      KRAs: r.goalSetId ? r.kraCount : '',
      KPIs: r.goalSetId ? r.kpiCount : '',
      'Assigned On': day(r.submittedAt),
      'Accepted On': day(r.acceptedAt),
      'Returned On': day(r.returnedAt),
      'Days Pending': r.pendingDays ?? '',
      'Employee Remark': r.employeeRemark ?? '',
    }));
    const ws = XLSX.utils.json_to_sheet(sheet);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Goal Coverage');
    XLSX.writeFile(wb, `goal-coverage-${cycle?.code ?? cycleId}.xlsx`);
  };

  const columns: Column<Row>[] = [
    {
      key: 'employee',
      label: 'Employee',
      render: (r) => (
        <div className="leading-tight">
          <div className="font-medium">{r.employeeCode} — {r.employeeName}</div>
          <div className="text-[11px]" style={{ color: 'var(--foreground-muted)' }}>
            {[r.designation, r.department].filter(Boolean).join(' · ') || '—'}
          </div>
        </div>
      ),
    },
    {
      key: 'reportingManager',
      label: 'Manager',
      render: (r) => <span className="text-xs">{r.reportingManager ?? '—'}</span>,
    },
    {
      key: 'goals',
      label: 'KRAs / KPIs',
      render: (r) => (
        <span className="text-xs tabular-nums">
          {r.goalSetId ? `${r.kraCount} / ${r.kpiCount}` : '—'}
        </span>
      ),
    },
    {
      key: 'assignedOn',
      label: 'Assigned',
      render: (r) => <span className="text-xs tabular-nums">{day(r.submittedAt) || '—'}</span>,
    },
    {
      key: 'pendingDays',
      label: 'Waiting',
      render: (r) =>
        r.pendingDays == null ? (
          <span className="text-xs">—</span>
        ) : (
          <span
            className="text-xs tabular-nums"
            style={{ color: r.pendingDays > 14 ? 'var(--danger)' : 'var(--foreground-muted)' }}
          >
            {r.pendingDays}d
          </span>
        ),
    },
    {
      key: 'status',
      label: 'Status',
      render: (r) => (
        <StatusBadge tone={STATUS_TONE[r.status] ?? 'neutral'} dot>
          {titleCase(r.status)}
        </StatusBadge>
      ),
    },
  ];

  return (
    <div className="space-y-4">
      <PageHeader
        eyebrow="Performance Reports"
        title="Goal Assignment Coverage"
        description="Who has goals for a cycle, who has accepted, and who has nothing yet. Counted against the employees eligible for that cycle."
        actions={<Button variant="primary" onClick={exportExcel} disabled={rows.length === 0}>Export Excel</Button>}
      />

      {error && <Alert tone="danger" onDismiss={() => setError(null)}>{error}</Alert>}

      <SectionCard title="Filters">
        <div className="flex flex-wrap items-end gap-3">
          <label className="text-xs">
            <span className="block" style={{ color: 'var(--foreground-muted)' }}>Cycle</span>
            <select className={inputCls} style={inputStyle} value={cycleId} onChange={(e) => setCycleId(e.target.value)}>
              <option value="">Select a cycle</option>
              {cycles.map((c) => <option key={c.id} value={c.id}>{c.code} — {c.name}</option>)}
            </select>
          </label>
          <label className="text-xs">
            <span className="block" style={{ color: 'var(--foreground-muted)' }}>Department</span>
            <select className={inputCls} style={inputStyle} value={departmentId} onChange={(e) => setDepartmentId(e.target.value)}>
              <option value="">All departments</option>
              {departments.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
            </select>
          </label>
          <label className="text-xs">
            <span className="block" style={{ color: 'var(--foreground-muted)' }}>Status</span>
            <select className={inputCls} style={inputStyle} value={status} onChange={(e) => setStatus(e.target.value)}>
              <option value="">All statuses</option>
              {STATUSES.map((s) => <option key={s} value={s}>{titleCase(s)}</option>)}
            </select>
          </label>
          <label className="text-xs">
            <span className="block" style={{ color: 'var(--foreground-muted)' }}>Employee</span>
            <input
              className={inputCls}
              style={inputStyle}
              placeholder="Code or name"
              value={q}
              onChange={(e) => setQ(e.target.value)}
            />
          </label>
        </div>
      </SectionCard>

      {!cycleId ? (
        <SectionCard title="Coverage">
          <p className="p-6 text-center text-sm" style={{ color: 'var(--foreground-muted)' }}>
            Select a performance cycle to measure coverage against.
          </p>
        </SectionCard>
      ) : (
        <>
          <KPIGrid columns={4}>
            <KPICard label="Eligible employees" value={summary.eligible} tone="info" subtitle={cycle ? `${cycle.code} — ${cycle.name}` : undefined} />
            <KPICard label="Assigned" value={`${summary.assignedPct}%`} tone={summary.assignedPct >= 100 ? 'success' : 'warning'} subtitle={`${summary.withGoals} of ${summary.eligible}`} />
            <KPICard label="Accepted" value={`${summary.acceptedPct}%`} tone={summary.acceptedPct >= 100 ? 'success' : 'warning'} subtitle={`${summary.accepted} of ${summary.eligible}`} />
            <KPICard label="Not assigned" value={summary.notAssigned} tone={summary.notAssigned > 0 ? 'danger' : 'success'} subtitle={summary.notAssigned > 0 ? 'No goal set for this cycle' : 'Everyone has goals'} />
          </KPIGrid>

          <SectionCard title="Coverage" count={loading ? undefined : summary.shown} flush>
            {loading ? (
              <div className="flex justify-center p-8"><Spinner /></div>
            ) : (
              <>
                <DataTable
                  variant="card"
                  columns={columns}
                  data={rows}
                  loading={loading}
                  emptyMessage="No employees match these filters."
                />
                <div
                  className="flex flex-wrap items-center gap-x-5 gap-y-2 border-t px-4 py-3 text-xs"
                  style={{ borderColor: 'var(--border)', color: 'var(--foreground-muted)' }}
                >
                  {STATUSES.map((s) => (
                    <span key={s}>
                      {titleCase(s)}{' '}
                      <span className="font-medium tabular-nums" style={{ color: 'var(--foreground)' }}>
                        {summary.byStatus[s] ?? 0}
                      </span>
                    </span>
                  ))}
                  {summary.joinedAfterCycle > 0 && (
                    <span className="ml-auto">
                      {summary.joinedAfterCycle} employee{summary.joinedAfterCycle === 1 ? '' : 's'} excluded — joined after the cycle ended
                    </span>
                  )}
                </div>
              </>
            )}
          </SectionCard>
        </>
      )}
    </div>
  );
}
