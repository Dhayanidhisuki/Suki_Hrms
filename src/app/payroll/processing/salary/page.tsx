/**
 * Payroll Run — select/create a year+month run, Calculate, review the
 * employee grid (gross/OT/PF/ESI/PT/TDS/net, HOLD rows flagged), Approve,
 * Lock. Standard DataTable list pattern, not a novel grid like Attendance's
 * monthly workbench.
 *
 * UI pass (2026-09): pipeline stepper for the run status, KPI totals strip,
 * grouped action toolbar and INR formatting. Actions/fields are unchanged.
 */

'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import Link from 'next/link';
import { DataTable, PageHeader, Alert, StatusBadge, SectionCard, Button, KPICard, KPIGrid, Stepper, type Column } from '@/components/ui';
import PayrollDetailDialog from '@/components/payroll/PayrollDetailDialog';

interface LineComponent {
  id: number;
  amount: string;
  isAdhoc: boolean;
  salaryComponent: { id: number; code: string; name: string; type: string };
}

interface PayrollLine {
  id: number;
  employeeId: number;
  totalWorkingDays: number;
  payableDays: string;
  lopDays: number;
  grossEarnings: string;
  otAmount: string;
  pfEmployee: string;
  esiEmployee: string;
  professionalTax: string;
  tds: string;
  otherEarningsTotal: string;
  otherDeductionsTotal: string;
  lomAmount: string;
  lwfAmount: string;
  healthInsurance: string;
  licAmount: string;
  netSalary: string;
  status: string;
  holdReason: string | null;
  employee: { id: number; employeeCode: string; firstName: string; lastName: string };
  components: LineComponent[];
}

type RunStatus = 'DRAFT' | 'CALCULATED' | 'VALIDATED' | 'SUBMITTED' | 'APPROVED' | 'LOCKED' | 'POSTED';

interface PayrollRun {
  id: number;
  year: number;
  month: number;
  status: RunStatus;
  lines: PayrollLine[];
}

interface RunSummary {
  id: number;
  year: number;
  month: number;
  status: string;
}

const now = new Date();

/** Full pipeline in order — optional stages (VALIDATED/SUBMITTED/POSTED) are shown only once the run has reached them. */
const PIPELINE: RunStatus[] = ['DRAFT', 'CALCULATED', 'VALIDATED', 'SUBMITTED', 'APPROVED', 'LOCKED', 'POSTED'];
const OPTIONAL_STAGES: RunStatus[] = ['VALIDATED', 'SUBMITTED', 'POSTED'];
const STAGE_LABEL: Record<RunStatus, string> = {
  DRAFT: 'Draft',
  CALCULATED: 'Calculated',
  VALIDATED: 'Validated',
  SUBMITTED: 'Submitted',
  APPROVED: 'Approved',
  LOCKED: 'Locked',
  POSTED: 'Posted',
};

function statusBadgeTone(status: RunStatus) {
  if (status === 'DRAFT') return 'neutral' as const;
  if (status === 'CALCULATED' || status === 'VALIDATED' || status === 'SUBMITTED') return 'warning' as const;
  if (status === 'APPROVED') return 'info' as const;
  return 'success' as const;
}

const inr = new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 });
const fmt = (v: string | number | null | undefined) => inr.format(Number(v ?? 0));
const monthName = (m: number) => new Date(2000, m - 1, 1).toLocaleString('default', { month: 'long' });

export default function PayrollSalaryPage() {
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [run, setRun] = useState<PayrollRun | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [dialogLine, setDialogLine] = useState<{ runId: number; lineId: number } | null>(null);

  const fetchRun = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const listRes = await fetch('/api/payroll/runs');
      if (!listRes.ok) throw new Error('Failed to fetch runs');
      const { data }: { data: RunSummary[] } = await listRes.json();
      const match = data.find((r) => r.year === year && r.month === month);
      if (!match) {
        setRun(null);
        return;
      }
      const runRes = await fetch(`/api/payroll/runs/${match.id}`);
      if (!runRes.ok) throw new Error('Failed to fetch run');
      setRun(await runRes.json());
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  }, [year, month]);

  useEffect(() => {
    fetchRun();
  }, [fetchRun]);

  const runAction = async (url: string, method: string, body?: Record<string, unknown>) => {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: body ? JSON.stringify(body) : undefined,
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? 'Action failed');
      setSuccessMessage(json.message ?? 'Done');
      await fetchRun();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setBusy(false);
    }
  };

  const lines = useMemo(() => run?.lines ?? [], [run]);
  const totals = useMemo(() => {
    const sum = (k: keyof PayrollLine) => lines.reduce((acc, l) => acc + Number(l[k] ?? 0), 0);
    return {
      employees: lines.length,
      hold: lines.filter((l) => l.status === 'HOLD').length,
      gross: sum('grossEarnings'),
      ot: sum('otAmount'),
      deductions: sum('pfEmployee') + sum('esiEmployee') + sum('professionalTax') + sum('tds') + sum('otherDeductionsTotal'),
      net: sum('netSalary'),
    };
  }, [lines]);

  const filteredLines = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return lines;
    return lines.filter((l) => `${l.employee.employeeCode} ${l.employee.firstName} ${l.employee.lastName}`.toLowerCase().includes(q));
  }, [lines, search]);

  // Stepper: hide optional stages the run hasn't passed through so the
  // default 4-stage chain reads as 4 steps, not 7.
  const stepperSteps = useMemo(() => {
    if (!run) return [];
    const reachedIdx = PIPELINE.indexOf(run.status);
    return PIPELINE.filter((s, i) => !OPTIONAL_STAGES.includes(s) || i <= reachedIdx).map((s) => ({ key: s, label: STAGE_LABEL[s] }));
  }, [run]);
  const completedKeys = useMemo(() => {
    if (!run) return [];
    const reachedIdx = PIPELINE.indexOf(run.status);
    return PIPELINE.slice(0, reachedIdx);
  }, [run]);

  const canEdit = run && (run.status === 'DRAFT' || run.status === 'CALCULATED');

  const money = (k: keyof PayrollLine, color?: string, tooltip?: (r: PayrollLine) => string) => {
    const Cell = (r: PayrollLine) => (
      <span
        className="tabular-nums"
        style={color ? { color } : undefined}
        title={tooltip ? tooltip(r) : undefined}
      >
        {fmt(r[k] as string)}
      </span>
    );
    Cell.displayName = `MoneyCell(${String(k)})`;
    return Cell;
  };

  const totalDeductions = (r: PayrollLine) =>
    Number(r.pfEmployee) + Number(r.esiEmployee) + Number(r.professionalTax) + Number(r.tds) + Number(r.otherDeductionsTotal);

  const grossTooltip = (r: PayrollLine) => {
    const earnings = r.components.filter((c) => c.salaryComponent.type === 'earning');
    return earnings.map((c) => `${c.salaryComponent.name}: ${fmt(c.amount)}`).join(' + ');
  };

  const deductionTooltip = (r: PayrollLine) => {
    const parts: string[] = [];
    if (Number(r.pfEmployee) > 0) parts.push(`PF: ${fmt(r.pfEmployee)}`);
    if (Number(r.esiEmployee) > 0) parts.push(`ESI: ${fmt(r.esiEmployee)}`);
    if (Number(r.professionalTax) > 0) parts.push(`PT: ${fmt(r.professionalTax)}`);
    if (Number(r.tds) > 0) parts.push(`TDS: ${fmt(r.tds)}`);
    if (Number(r.lomAmount) > 0) parts.push(`LOM: ${fmt(r.lomAmount)}`);
    if (Number(r.lwfAmount) > 0) parts.push(`LWF: ${fmt(r.lwfAmount)}`);
    if (Number(r.healthInsurance) > 0) parts.push(`Health Insurance: ${fmt(r.healthInsurance)}`);
    if (Number(r.licAmount) > 0) parts.push(`LIC: ${fmt(r.licAmount)}`);
    const other = Number(r.otherDeductionsTotal) - Number(r.lomAmount) - Number(r.lwfAmount) - Number(r.healthInsurance) - Number(r.licAmount);
    if (other > 0) parts.push(`Other: ${fmt(other)}`);
    return parts.join(' + ') || 'No deductions';
  };

  const columns: Column<PayrollLine>[] = [
    {
      key: 'employee',
      label: 'Employee',
      render: (r) => (
        <div className="leading-tight">
          <div className="font-medium">{r.employee.firstName} {r.employee.lastName}</div>
          <div className="text-[11px]" style={{ color: 'var(--foreground-muted)' }}>{r.employee.employeeCode}</div>
        </div>
      ),
    },
    {
      key: 'payableDays',
      label: 'Payable Days',
      render: (r) => (
        <span className="tabular-nums">
          {r.payableDays}<span style={{ color: 'var(--foreground-muted)' }}>/{r.totalWorkingDays}</span>
        </span>
      ),
    },
    {
      key: 'lopDays',
      label: 'LOP',
      render: (r) => (r.lopDays > 0 ? <StatusBadge tone="danger">{r.lopDays}</StatusBadge> : <span style={{ color: 'var(--foreground-muted)' }}>0</span>),
    },
    { key: 'grossEarnings', label: 'Gross', className: 'text-right', render: money('grossEarnings', 'var(--success, #22b573)', grossTooltip) },
    { key: 'otAmount', label: 'OT', className: 'text-right', render: money('otAmount', 'var(--success, #22b573)') },
    { key: 'pfEmployee', label: 'PF', className: 'text-right', render: money('pfEmployee', 'var(--warning, #f0b429)', deductionTooltip) },
    { key: 'esiEmployee', label: 'ESI', className: 'text-right', render: money('esiEmployee', 'var(--warning, #f0b429)', deductionTooltip) },
    { key: 'professionalTax', label: 'PT', className: 'text-right', render: money('professionalTax', 'var(--warning, #f0b429)', deductionTooltip) },
    { key: 'tds', label: 'TDS', className: 'text-right', render: money('tds', 'var(--warning, #f0b429)', deductionTooltip) },
    {
      key: 'totalDeductions',
      label: 'Deductions',
      className: 'text-right',
      render: (r) => (
        <span className="tabular-nums font-medium" style={{ color: 'var(--warning, #f0b429)' }} title={deductionTooltip(r)}>
          -{fmt(totalDeductions(r))}
        </span>
      ),
    },
    {
      key: 'netSalary',
      label: 'Net Salary',
      className: 'text-right',
      render: (r) => <span className="font-semibold tabular-nums" style={{ color: 'var(--success, #22b573)' }}>{fmt(r.netSalary)}</span>,
    },
    {
      key: 'status',
      label: 'Status',
      render: (r) =>
        r.status === 'HOLD' ? (
          <StatusBadge tone="danger" dot title={r.holdReason ?? undefined}>HOLD</StatusBadge>
        ) : (
          <StatusBadge tone="success" dot>OK</StatusBadge>
        ),
    },
    {
      key: 'payslip',
      label: 'Payslip',
      render: (r) => (
        <div className="flex items-center gap-2">
          <button
            onClick={() => setDialogLine({ runId: run?.id ?? 0, lineId: r.id })}
            className="text-xs font-medium hover:underline"
            style={{ color: 'var(--accent)' }}
          >
            View
          </button>
          <Link
            href={`/payroll/outputs/payslip?runId=${run?.id}&lineId=${r.id}`}
            target="_blank"
            className="text-xs font-medium hover:underline"
            style={{ color: 'var(--foreground-muted)' }}
          >
            Print / PDF
          </Link>
        </div>
      ),
    },
  ];

  const periodPicker = (
    <div className="inline-flex items-center overflow-hidden rounded-lg border" style={{ borderColor: 'var(--border)', backgroundColor: 'var(--surface)' }}>
      <select
        value={month}
        onChange={(e) => setMonth(Number(e.target.value))}
        className="bg-transparent px-3 py-2 text-sm focus:outline-none"
        style={{ color: 'var(--foreground)' }}
        aria-label="Month"
      >
        {Array.from({ length: 12 }, (_, i) => i + 1).map((m) => (
          <option key={m} value={m}>{monthName(m)}</option>
        ))}
      </select>
      <span className="h-5 w-px" style={{ backgroundColor: 'var(--border)' }} aria-hidden />
      <input
        type="number"
        value={year}
        onChange={(e) => setYear(Number(e.target.value))}
        className="w-20 bg-transparent px-3 py-2 text-sm tabular-nums focus:outline-none"
        style={{ color: 'var(--foreground)' }}
        aria-label="Year"
      />
    </div>
  );

  return (
    <div className="space-y-4">
      <PageHeader
        eyebrow="Payroll"
        title="Salary Processing"
        description="Create the month's run, calculate from attendance + salary structure, review each employee, then approve and lock."
        actions={
          <>
            {periodPicker}
            {run && <StatusBadge tone={statusBadgeTone(run.status)} size="sm" dot>{STAGE_LABEL[run.status] ?? run.status}</StatusBadge>}
          </>
        }
      />

      {error && <Alert tone="danger" onDismiss={() => setError(null)}>{error}</Alert>}
      {successMessage && <Alert tone="success" onDismiss={() => setSuccessMessage(null)}>{successMessage}</Alert>}

      {/* Pipeline + actions */}
      {run && (
        <SectionCard>
          <div className="flex flex-col gap-4">
            <div className="overflow-x-auto pb-1">
              <Stepper steps={stepperSteps} activeKey={run.status} completedKeys={completedKeys} />
            </div>
            <div className="flex flex-wrap items-center gap-2 border-t pt-3" style={{ borderColor: 'var(--border)' }}>
              <span className="mr-1 text-xs font-medium" style={{ color: 'var(--foreground-muted)' }}>Actions</span>
              {canEdit && (
                <Button variant="primary" size="sm" loading={busy} onClick={() => runAction(`/api/payroll/runs/${run.id}/calculate`, 'POST')}>
                  Calculate
                </Button>
              )}
              {canEdit && (
                <Button size="sm" disabled={busy} onClick={() => runAction(`/api/payroll/runs/${run.id}/apply-benefit-rates`, 'POST')}>
                  Apply Canteen/Petrol
                </Button>
              )}
              {canEdit && (
                <Link href={`/payroll/processing/additions-deductions?runId=${run.id}`} className="inline-flex items-center rounded-lg border px-3 py-1.5 text-xs font-medium transition hover:brightness-95" style={{ borderColor: 'var(--border)', color: 'var(--foreground)', backgroundColor: 'var(--surface)' }}>
                  Additions / Deductions
                </Link>
              )}
              {canEdit && (
                <Link href={`/payroll/processing/salary/bulk-adhoc?runId=${run.id}`} className="inline-flex items-center rounded-lg border px-3 py-1.5 text-xs font-medium transition hover:brightness-95" style={{ borderColor: 'var(--border)', color: 'var(--foreground)', backgroundColor: 'var(--surface)' }}>
                  Bulk Upload Benefits
                </Link>
              )}
              {run.status === 'CALCULATED' && (
                <>
                  <span className="mx-1 h-5 w-px" style={{ backgroundColor: 'var(--border)' }} aria-hidden />
                  <Button variant="success" size="sm" disabled={busy} onClick={() => runAction(`/api/payroll/runs/${run.id}/approve`, 'POST')}>
                    Approve
                  </Button>
                </>
              )}
              {run.status === 'APPROVED' && (
                <>
                  <span className="mx-1 h-5 w-px" style={{ backgroundColor: 'var(--border)' }} aria-hidden />
                  <Button variant="danger" size="sm" disabled={busy} onClick={() => runAction(`/api/payroll/runs/${run.id}/lock`, 'POST')}>
                    Lock
                  </Button>
                </>
              )}
              {(run.status === 'LOCKED' || run.status === 'POSTED') && (
                <span className="text-xs" style={{ color: 'var(--foreground-muted)' }}>This run is {STAGE_LABEL[run.status].toLowerCase()} — no further changes can be made.</span>
              )}
            </div>
          </div>
        </SectionCard>
      )}

      {/* KPI totals */}
      {run && lines.length > 0 && (
        <KPIGrid columns={4}>
          <KPICard label="Employees" value={totals.employees} subtitle={totals.hold > 0 ? `${totals.hold} on hold` : 'All clear'} tone={totals.hold > 0 ? 'warning' : 'success'} />
          <KPICard label="Total Gross" value={fmt(totals.gross)} subtitle={`OT ${fmt(totals.ot)}`} tone="info" />
          <KPICard label="Total Deductions" value={fmt(totals.deductions)} subtitle="PF + ESI + PT + TDS + other" tone="danger" />
          <KPICard label="Total Net Payable" value={fmt(totals.net)} tone="success" />
        </KPIGrid>
      )}

      {/* Employee grid */}
      {!run && !loading ? (
        <SectionCard>
          <div className="flex flex-col items-center py-8 text-center">
            <p className="text-sm font-medium" style={{ color: 'var(--foreground)' }}>
              No payroll run for {monthName(month)} {year} yet
            </p>
            <p className="mt-1 text-xs" style={{ color: 'var(--foreground-muted)' }}>
              Create the run to start calculating salaries for this period.
            </p>
            <Button variant="primary" className="mt-4" loading={busy} onClick={() => runAction('/api/payroll/runs', 'POST', { year, month })}>
              Create Run
            </Button>
          </div>
        </SectionCard>
      ) : (
        <DataTable
          variant="card"
          columns={columns}
          data={filteredLines}
          loading={loading}
          searchValue={search}
          searchPlaceholder="Search employee…"
          onSearchChange={setSearch}
          filters={
            lines.length > 0 ? (
              <span className="text-xs" style={{ color: 'var(--foreground-muted)' }}>
                {filteredLines.length} of {lines.length} employees
              </span>
            ) : undefined
          }
          emptyMessage="No employees calculated yet — click Calculate."
        />
      )}

      {dialogLine && (
        <PayrollDetailDialog
          runId={dialogLine.runId}
          lineId={dialogLine.lineId}
          onClose={() => setDialogLine(null)}
        />
      )}
    </div>
  );
}
