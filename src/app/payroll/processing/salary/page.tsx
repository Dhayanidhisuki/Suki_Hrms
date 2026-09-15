/**
 * Payroll Run — select/create a year+month run, Calculate, review the
 * employee grid (gross/OT/PF/ESI/PT/TDS/net, HOLD rows flagged), Approve,
 * Lock. Standard DataTable list pattern, not a novel grid like Attendance's
 * monthly workbench.
 *
 * UI pass (2026-09): pipeline stepper for the run status, KPI totals strip,
 * grouped action toolbar and INR formatting. Actions/fields are unchanged.
 *
 * Pass 2 (2026-09): Auto Payroll button (Calculate + Approve + mark PROCESSED),
 * multi-select with bulk status change (OK / HOLD with comments), inline
 * editable money columns, delete employee from run, add individual employee,
 * summary dialog showing Completed / On Hold / Pending breakdown.
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

// ── Inline editable money cell ──────────────────────────────────────
function EditableCell({
  line,
  field,
  canEdit,
  color,
  tooltip,
  onSave,
}: {
  line: PayrollLine;
  field: keyof PayrollLine;
  canEdit: boolean;
  color?: string;
  tooltip?: string;
  onSave: (lineId: number, field: string, value: number) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState(String(line[field] ?? '0'));

  useEffect(() => { setValue(String(line[field] ?? '0')); }, [line[field]]);

  if (!canEdit) {
    return (
      <span className="tabular-nums" style={color ? { color } : undefined} title={tooltip}>
        {fmt(line[field] as string)}
      </span>
    );
  }

  if (editing) {
    return (
      <input
        type="number"
        autoFocus
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onBlur={() => {
          setEditing(false);
          const num = Number(value);
          if (!isNaN(num) && num !== Number(line[field])) {
            onSave(line.id, field, num);
          } else {
            setValue(String(line[field] ?? '0'));
          }
        }}
        onKeyDown={(e) => {
          if (e.key === 'Enter') (e.target as HTMLInputElement).blur();
          if (e.key === 'Escape') {
            setValue(String(line[field] ?? '0'));
            setEditing(false);
          }
        }}
        className="w-24 rounded border px-2 py-1 text-sm tabular-nums focus:outline-none focus:ring-2"
        style={{ backgroundColor: 'var(--surface)', borderColor: 'var(--accent)', color: 'var(--foreground)' }}
      />
    );
  }

  return (
    <span
      className="tabular-nums cursor-text rounded px-1 hover:ring-1"
      style={color ? { color } : undefined}
      title={tooltip ?? 'Click to edit'}
      onClick={() => setEditing(true)}
    >
      {fmt(line[field] as string)}
    </span>
  );
}

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

  // Multi-select
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());

  // On-hold dialog
  const [holdDialogOpen, setHoldDialogOpen] = useState(false);
  const [holdReason, setHoldReason] = useState('');

  // Summary dialog
  const [summaryOpen, setSummaryOpen] = useState(false);

  // Add employee dialog
  const [addOpen, setAddOpen] = useState(false);
  const [addEmployeeId, setAddEmployeeId] = useState('');
  const [availableEmployees, setAvailableEmployees] = useState<{ id: number; employeeCode: string; firstName: string; lastName: string }[]>([]);

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

  // ── Inline edit save ──────────────────────────────────────────────
  const handleInlineSave = async (lineId: number, field: string, value: number) => {
    if (!run) return;
    try {
      const res = await fetch(`/api/payroll/runs/${run.id}/lines/${lineId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ [field]: value }),
      });
      if (!res.ok) {
        const json = await res.json();
        throw new Error(json.error ?? 'Update failed');
      }
      // Update local state without full refetch for speed
      setRun((prev) => prev ? {
        ...prev,
        lines: prev.lines.map((l) => l.id === lineId ? { ...l, [field]: String(value) } : l),
      } : null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Update failed');
    }
  };

  // ── Auto Payroll ──────────────────────────────────────────────────
  const handleAutoPayroll = async () => {
    if (!run) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/payroll/runs/${run.id}/auto-payroll`, { method: 'POST' });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? 'Auto-payroll failed');
      setSuccessMessage(json.message ?? 'Auto-payroll complete');
      await fetchRun();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setBusy(false);
    }
  };

  // ── Bulk status change ─────────────────────────────────────────────
  const handleBulkStatus = async (status: 'OK' | 'HOLD' | 'PROCESSED', reason?: string) => {
    if (!run || selectedIds.size === 0) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/payroll/runs/${run.id}/lines/bulk-status`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ lineIds: Array.from(selectedIds), status, holdReason: reason }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? 'Bulk update failed');
      setSuccessMessage(json.message ?? 'Updated');
      setSelectedIds(new Set());
      await fetchRun();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setBusy(false);
    }
  };

  // ── Delete line ────────────────────────────────────────────────────
  const handleDeleteLine = async (line: PayrollLine) => {
    if (!run) return;
    if (!confirm(`Remove ${line.employee.firstName} ${line.employee.lastName} (${line.employee.employeeCode}) from this run?`)) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/payroll/runs/${run.id}/lines/${line.id}`, { method: 'DELETE' });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? 'Delete failed');
      setSuccessMessage(json.message ?? 'Removed');
      await fetchRun();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setBusy(false);
    }
  };

  // ── Add employee ──────────────────────────────────────────────────
  const openAddDialog = async () => {
    if (!run) return;
    try {
      const res = await fetch('/api/employees?limit=500');
      const json = await res.json();
      const allEmps: { id: number; employeeCode: string; firstName: string; lastName: string }[] = json.data ?? json ?? [];
      const inRun = new Set(run.lines.map((l) => l.employeeId));
      setAvailableEmployees(allEmps.filter((e) => !inRun.has(e.id)));
      setAddEmployeeId('');
      setAddOpen(true);
    } catch {
      setError('Failed to load employees');
    }
  };

  const handleAddEmployee = async () => {
    if (!run || !addEmployeeId) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/payroll/runs/${run.id}/lines`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ employeeId: Number(addEmployeeId) }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? 'Add failed');
      setSuccessMessage(json.message ?? 'Added');
      setAddOpen(false);
      await fetchRun();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setBusy(false);
    }
  };

  // ── Toggle selection ──────────────────────────────────────────────
  const toggleSelect = (id: number) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleSelectAll = () => {
    if (selectedIds.size === filteredLines.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(filteredLines.map((l) => l.id)));
    }
  };

  const lines = useMemo(() => run?.lines ?? [], [run]);
  const totals = useMemo(() => {
    const sum = (k: keyof PayrollLine) => lines.reduce((acc, l) => acc + Number(l[k] ?? 0), 0);
    return {
      employees: lines.length,
      hold: lines.filter((l) => l.status === 'HOLD').length,
      processed: lines.filter((l) => l.status === 'PROCESSED').length,
      pending: lines.filter((l) => l.status === 'OK').length,
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
  const canAutoPayroll = run && run.status !== 'LOCKED' && run.status !== 'POSTED';

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

  const editableCell = (field: keyof PayrollLine, color?: string, tooltip?: (r: PayrollLine) => string) => {
    const Cell = (r: PayrollLine) => (
      <EditableCell line={r} field={field} canEdit={!!canEdit} color={color} tooltip={tooltip?.(r)} onSave={handleInlineSave} />
    );
    Cell.displayName = `EditableCell(${String(field)})`;
    return Cell;
  };

  const columns: Column<PayrollLine>[] = [
    {
      key: 'select',
      label: (
        <input
          type="checkbox"
          checked={filteredLines.length > 0 && selectedIds.size === filteredLines.length}
          onChange={toggleSelectAll}
          className="h-4 w-4"
          style={{ accentColor: 'var(--accent)' }}
        />
      ) as unknown as string,
      render: (r) => (
        <input
          type="checkbox"
          checked={selectedIds.has(r.id)}
          onChange={() => toggleSelect(r.id)}
          className="h-4 w-4"
          style={{ accentColor: 'var(--accent)' }}
        />
      ),
      className: 'w-10',
    },
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
    { key: 'grossEarnings', label: 'Gross', className: 'text-right', render: editableCell('grossEarnings', 'var(--success, #22b573)', grossTooltip) },
    { key: 'otAmount', label: 'OT', className: 'text-right', render: editableCell('otAmount', 'var(--success, #22b573)') },
    { key: 'pfEmployee', label: 'PF', className: 'text-right', render: editableCell('pfEmployee', 'var(--warning, #f0b429)', deductionTooltip) },
    { key: 'esiEmployee', label: 'ESI', className: 'text-right', render: editableCell('esiEmployee', 'var(--warning, #f0b429)', deductionTooltip) },
    { key: 'professionalTax', label: 'PT', className: 'text-right', render: editableCell('professionalTax', 'var(--warning, #f0b429)', deductionTooltip) },
    { key: 'tds', label: 'TDS', className: 'text-right', render: editableCell('tds', 'var(--warning, #f0b429)', deductionTooltip) },
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
      render: (r) => {
        if (r.status === 'HOLD') return <StatusBadge tone="danger" dot title={r.holdReason ?? undefined}>HOLD</StatusBadge>;
        if (r.status === 'PROCESSED') return <StatusBadge tone="success" dot>PROCESSED</StatusBadge>;
        return <StatusBadge tone="info" dot>OK</StatusBadge>;
      },
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
              {canEdit && (
                <Button size="sm" variant="primary" onClick={openAddDialog}>+ Add Employee</Button>
              )}

              {/* Auto Payroll button */}
              {canAutoPayroll && (
                <>
                  <span className="mx-1 h-5 w-px" style={{ backgroundColor: 'var(--border)' }} aria-hidden />
                  <Button variant="success" size="sm" loading={busy} onClick={handleAutoPayroll}>
                    Auto Payroll
                  </Button>
                </>
              )}

              {/* Summary button */}
              <Button size="sm" onClick={() => setSummaryOpen(true)}>Summary</Button>

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

            {/* Bulk actions for selected rows */}
            {selectedIds.size > 0 && canEdit && (
              <div className="flex flex-wrap items-center gap-2 border-t pt-3" style={{ borderColor: 'var(--border)' }}>
                <span className="text-xs font-medium" style={{ color: 'var(--foreground-muted)' }}>
                  {selectedIds.size} selected:
                </span>
                <Button size="sm" disabled={busy} onClick={() => handleBulkStatus('OK')}>
                  Mark Complete
                </Button>
                <Button size="sm" variant="danger" disabled={busy} onClick={() => { setHoldReason(''); setHoldDialogOpen(true); }}>
                  Put On Hold
                </Button>
                <Button size="sm" variant="success" disabled={busy} onClick={() => handleBulkStatus('PROCESSED')}>
                  Mark Processed
                </Button>
                <button
                  className="text-xs hover:underline"
                  style={{ color: 'var(--foreground-muted)' }}
                  onClick={() => setSelectedIds(new Set())}
                >
                  Clear selection
                </button>
              </div>
            )}
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
          onDelete={canEdit ? handleDeleteLine : undefined}
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

      {/* Salary detail dialog */}
      {dialogLine && (
        <PayrollDetailDialog
          runId={dialogLine.runId}
          lineId={dialogLine.lineId}
          onClose={() => setDialogLine(null)}
        />
      )}

      {/* On-hold comment dialog */}
      {holdDialogOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center" style={{ backgroundColor: 'rgba(0,0,0,0.4)' }}>
          <div className="rounded-xl border p-6 shadow-lg" style={{ borderColor: 'var(--border)', backgroundColor: 'var(--surface)', minWidth: 400 }}>
            <h3 className="mb-4 text-lg font-semibold" style={{ color: 'var(--foreground)' }}>Put On Hold</h3>
            <p className="mb-2 text-sm" style={{ color: 'var(--foreground-muted)' }}>
              {selectedIds.size} employee(s) will be put on hold. Enter a reason:
            </p>
            <textarea
              value={holdReason}
              onChange={(e) => setHoldReason(e.target.value)}
              placeholder="e.g. Attendance not finalized, salary discrepancy…"
              className="mb-4 w-full rounded-lg border px-3 py-2 text-sm focus:outline-none focus:ring-2"
              style={{ backgroundColor: 'var(--surface)', borderColor: 'var(--border)', color: 'var(--foreground)', minHeight: 80 }}
              autoFocus
            />
            <div className="flex justify-end gap-2">
              <Button size="sm" onClick={() => setHoldDialogOpen(false)}>Cancel</Button>
              <Button size="sm" variant="danger" disabled={!holdReason.trim() || busy} loading={busy} onClick={() => { handleBulkStatus('HOLD', holdReason); setHoldDialogOpen(false); }}>
                Confirm Hold
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Summary dialog */}
      {summaryOpen && run && (
        <div className="fixed inset-0 z-50 flex items-center justify-center" style={{ backgroundColor: 'rgba(0,0,0,0.4)' }}>
          <div className="rounded-xl border shadow-lg" style={{ borderColor: 'var(--border)', backgroundColor: 'var(--surface)', minWidth: 500, maxWidth: 700, maxHeight: '80vh', overflow: 'auto' }}>
            <div className="flex items-center justify-between border-b px-6 py-4" style={{ borderColor: 'var(--border)' }}>
              <h3 className="text-lg font-semibold" style={{ color: 'var(--foreground)' }}>
                Payroll Summary — {monthName(run.month)} {run.year}
              </h3>
              <button onClick={() => setSummaryOpen(false)} className="text-sm hover:opacity-70" style={{ color: 'var(--foreground-muted)' }}>✕</button>
            </div>
            <div className="p-6 space-y-4">
              {/* Status counts */}
              <div className="grid grid-cols-3 gap-3">
                <div className="rounded-lg border p-4 text-center" style={{ borderColor: 'var(--border)' }}>
                  <div className="text-2xl font-bold" style={{ color: 'var(--success, #22b573)' }}>{totals.processed}</div>
                  <div className="text-xs" style={{ color: 'var(--foreground-muted)' }}>Processed</div>
                </div>
                <div className="rounded-lg border p-4 text-center" style={{ borderColor: 'var(--border)' }}>
                  <div className="text-2xl font-bold" style={{ color: 'var(--warning, #f0b429)' }}>{totals.pending}</div>
                  <div className="text-xs" style={{ color: 'var(--foreground-muted)' }}>Pending (OK)</div>
                </div>
                <div className="rounded-lg border p-4 text-center" style={{ borderColor: 'var(--border)' }}>
                  <div className="text-2xl font-bold" style={{ color: 'var(--danger, #ef4444)' }}>{totals.hold}</div>
                  <div className="text-xs" style={{ color: 'var(--foreground-muted)' }}>On Hold</div>
                </div>
              </div>

              {/* Processed list */}
              {lines.filter((l) => l.status === 'PROCESSED').length > 0 && (
                <div>
                  <h4 className="mb-2 text-sm font-medium" style={{ color: 'var(--success, #22b573)' }}>Processed ({lines.filter((l) => l.status === 'PROCESSED').length})</h4>
                  <div className="space-y-1">
                    {lines.filter((l) => l.status === 'PROCESSED').map((l) => (
                      <div key={l.id} className="flex justify-between text-xs" style={{ color: 'var(--foreground)' }}>
                        <span>{l.employee.firstName} {l.employee.lastName} ({l.employee.employeeCode})</span>
                        <span className="tabular-nums">{fmt(l.netSalary)}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* On hold list */}
              {lines.filter((l) => l.status === 'HOLD').length > 0 && (
                <div>
                  <h4 className="mb-2 text-sm font-medium" style={{ color: 'var(--danger, #ef4444)' }}>On Hold ({lines.filter((l) => l.status === 'HOLD').length})</h4>
                  <div className="space-y-1">
                    {lines.filter((l) => l.status === 'HOLD').map((l) => (
                      <div key={l.id} className="flex justify-between text-xs" style={{ color: 'var(--foreground)' }}>
                        <span>{l.employee.firstName} {l.employee.lastName} ({l.employee.employeeCode})</span>
                        <span className="text-[11px]" style={{ color: 'var(--foreground-muted)' }}>{l.holdReason ?? 'No reason'}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Pending list */}
              {lines.filter((l) => l.status === 'OK').length > 0 && (
                <div>
                  <h4 className="mb-2 text-sm font-medium" style={{ color: 'var(--warning, #f0b429)' }}>Pending ({lines.filter((l) => l.status === 'OK').length})</h4>
                  <div className="space-y-1">
                    {lines.filter((l) => l.status === 'OK').map((l) => (
                      <div key={l.id} className="flex justify-between text-xs" style={{ color: 'var(--foreground)' }}>
                        <span>{l.employee.firstName} {l.employee.lastName} ({l.employee.employeeCode})</span>
                        <span className="tabular-nums">{fmt(l.netSalary)}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Add employee dialog */}
      {addOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center" style={{ backgroundColor: 'rgba(0,0,0,0.4)' }}>
          <div className="rounded-xl border p-6 shadow-lg" style={{ borderColor: 'var(--border)', backgroundColor: 'var(--surface)', minWidth: 400 }}>
            <h3 className="mb-4 text-lg font-semibold" style={{ color: 'var(--foreground)' }}>Add Employee to Run</h3>
            {availableEmployees.length === 0 ? (
              <p className="text-sm" style={{ color: 'var(--foreground-muted)' }}>All active employees are already in this run.</p>
            ) : (
              <>
                <select
                  value={addEmployeeId}
                  onChange={(e) => setAddEmployeeId(e.target.value)}
                  className="mb-4 w-full rounded-lg border px-3 py-2 text-sm focus:outline-none focus:ring-2"
                  style={{ backgroundColor: 'var(--surface)', borderColor: 'var(--border)', color: 'var(--foreground)' }}
                >
                  <option value="">Select employee…</option>
                  {availableEmployees.map((e) => (
                    <option key={e.id} value={e.id}>{e.firstName} {e.lastName} ({e.employeeCode})</option>
                  ))}
                </select>
              </>
            )}
            <div className="flex justify-end gap-2">
              <Button size="sm" onClick={() => setAddOpen(false)}>Cancel</Button>
              {availableEmployees.length > 0 && (
                <Button size="sm" variant="primary" disabled={!addEmployeeId || busy} loading={busy} onClick={handleAddEmployee}>
                  Add & Calculate
                </Button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
