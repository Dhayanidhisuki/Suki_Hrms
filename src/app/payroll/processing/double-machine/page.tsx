/**
 * Double Machine Incentive — legacy flow: the grid lists only saved records
 * (empty until HR adds rows), footer buttons Delete / Bulk Upload / On Hold /
 * Complete / Edit / Add, and Add/Edit opens a modal with the employee picker
 * and the five incentive amount fields.
 */

'use client';

import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties, type ReactNode } from 'react';
import * as XLSX from 'xlsx';
import { useToast } from '@/components/ui';
import {
  buildDoubleMachineTemplateWorkbook,
  monthName,
  parseDoubleMachineWorkbookRows,
  type DoubleMachineImportRow,
} from '@/lib/double-machine-bulk-import';

interface IncentiveRow {
  recordId: number | null;
  employeeId: number;
  employeeCode: string;
  oldEmployeeCode: string | null;
  referenceCode: string;
  employeeName: string;
  department: { id: number; name: string } | null;
  designation: { id: number; name: string } | null;
  year: number;
  month: number;
  doubleMachine: number;
  attendanceBonus: number;
  shiftIncentive: number;
  otWeeklyInc: number;
  employeeR: number;
  status: string;
  remarks: string | null;
  hasPayrollLine: boolean;
  approvedBy: string | null;
  approvedAt: string | null;
  updatedBy: string | null;
  updatedAt: string | null;
  rejectionReason: string | null;
}

const AMOUNT_KEYS = ['doubleMachine', 'attendanceBonus', 'shiftIncentive', 'otWeeklyInc', 'employeeR'] as const;
type AmountKey = (typeof AMOUNT_KEYS)[number];

const AMOUNT_FIELDS: { key: AmountKey; label: string }[] = [
  { key: 'doubleMachine', label: 'Double Machine Cost (DM Cost)' },
  { key: 'attendanceBonus', label: 'Attendance Bonus' },
  { key: 'shiftIncentive', label: 'Shift Incentive' },
  { key: 'otWeeklyInc', label: 'OT Weekly Inc' },
  { key: 'employeeR', label: 'Employee R' },
];

const MONTH_OPTIONS = [
  { value: 1, label: 'January' },
  { value: 2, label: 'February' },
  { value: 3, label: 'March' },
  { value: 4, label: 'April' },
  { value: 5, label: 'May' },
  { value: 6, label: 'June' },
  { value: 7, label: 'July' },
  { value: 8, label: 'August' },
  { value: 9, label: 'September' },
  { value: 10, label: 'October' },
  { value: 11, label: 'November' },
  { value: 12, label: 'December' },
];

const STATUS_FILTERS = [
  { value: '', label: 'All Statuses' },
  { value: 'draft', label: 'Draft' },
  { value: 'process', label: 'Process' },
  { value: 'hold', label: 'Hold' },
  { value: 'complete', label: 'Complete' },
];

const STATUS_COLORS: Record<string, { bg: string; fg: string }> = {
  draft: { bg: '#f3f4f6', fg: '#4b5563' },
  process: { bg: '#fef9c3', fg: '#854d0e' },
  hold: { bg: '#ffedd5', fg: '#9a3412' },
  complete: { bg: '#dcfce7', fg: '#166534' },
};

function fmtAmt(n: number) {
  return Number(n || 0).toFixed(1);
}

const EMPTY_AMOUNTS: Record<AmountKey, string> = {
  doubleMachine: '',
  attendanceBonus: '',
  shiftIncentive: '',
  otWeeklyInc: '',
  employeeR: '',
};

/**
 * The four states a DoubleMachineIncentive row moves through, in order.
 * `hold` is a branch off the main line rather than a step on it — it is the
 * only status that stops payment, and a held row can be returned to process.
 */
const WORKFLOW_STEPS = ['draft', 'process', 'complete'] as const;

/** Which salary component each amount field reaches the payslip as. */
const FIELD_TO_COMPONENT: Record<AmountKey, string> = {
  doubleMachine: 'DM_INCENTIVE',
  attendanceBonus: 'ATT_BONUS',
  shiftIncentive: 'SHIFT_BONUS',
  otWeeklyInc: 'OT_WEEKLY_INC',
  employeeR: 'EMP_REFERRAL',
};

/** Draft → Process → Complete, with Hold shown as the branch it is. */
function StatusPipeline({ status }: { status: string }) {
  if (status === 'hold') {
    return (
      <span className="inline-flex items-center gap-1 text-[11px]" style={{ color: '#b45309' }}>
        <span aria-hidden>⏸</span> On hold — pays ₹0
      </span>
    );
  }
  const at = WORKFLOW_STEPS.indexOf(status as (typeof WORKFLOW_STEPS)[number]);
  return (
    <span className="inline-flex items-center gap-0.5 text-[11px]" title={`Draft → Process → Complete (currently ${status})`}>
      {WORKFLOW_STEPS.map((step, i) => (
        <span key={step} className="inline-flex items-center gap-0.5">
          <span
            className="rounded px-1 py-px"
            style={
              i < at
                ? { backgroundColor: 'var(--surface-hover)', color: 'var(--foreground-muted)' }
                : i === at
                  ? { backgroundColor: step === 'complete' ? '#166534' : 'var(--accent)', color: '#fff', fontWeight: 600 }
                  : { color: 'var(--foreground-muted)', opacity: 0.5 }
            }
          >
            {step}
          </span>
          {i < WORKFLOW_STEPS.length - 1 && <span aria-hidden style={{ color: 'var(--foreground-muted)', opacity: 0.5 }}>›</span>}
        </span>
      ))}
    </span>
  );
}

/** What this row does to payroll for the selected period, in plain terms. */
function payrollImpact(row: IncentiveRow): { tone: 'paid' | 'blocked' | 'none'; headline: string; detail: string } {
  const nonzero = AMOUNT_KEYS.filter((k) => Number(row[k]) > 0);
  const total = nonzero.reduce((s, k) => s + Number(row[k]), 0);
  if (!row.hasPayrollLine) {
    return {
      tone: 'blocked',
      headline: 'No payroll line — will not reach any payslip',
      detail: 'This employee has no payroll line for the period, so nothing here can be paid even once approved.',
    };
  }
  if (row.status === 'hold') {
    return {
      tone: 'blocked',
      headline: 'Paid ₹0 — held',
      detail: row.rejectionReason ? `Reason: ${row.rejectionReason}` : 'No reason recorded.',
    };
  }
  if (row.status !== 'complete') {
    return {
      tone: 'none',
      headline: `Will NOT be paid — status is ${row.status}`,
      detail: 'Payroll pays complete rows only. Approve it, then recalculate the run.',
    };
  }
  if (nonzero.length === 0) {
    return { tone: 'none', headline: 'Approved, but every amount is zero', detail: 'Nothing to pay.' };
  }
  return {
    tone: 'paid',
    headline: `Will be paid — ${fmtAmt(total)} across ${nonzero.length} component${nonzero.length === 1 ? '' : 's'}`,
    detail: nonzero.map((k) => `${FIELD_TO_COMPONENT[k]} ${fmtAmt(Number(row[k]))}`).join(' · '),
  };
}

export default function DoubleMachineIncentivePage() {
  const toast = useToast();
  const now = new Date();
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [departmentId, setDepartmentId] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [searchInput, setSearchInput] = useState('');
  const [search, setSearch] = useState('');
  const [rows, setRows] = useState<IncentiveRow[]>([]);
  const [departments, setDepartments] = useState<{ id: number; name: string }[]>([]);
  // Payroll for this period is APPROVED/LOCKED — the payslips are out, so
  // every write control is disabled rather than letting the user discover the
  // 409 by pressing a button.
  const [periodLocked, setPeriodLocked] = useState(false);
  const [periodRunStatus, setPeriodRunStatus] = useState<string | null>(null);
  const [statusCounts, setStatusCounts] = useState<Record<string, number>>({});
  /** Row whose audit trail is open. */
  const [auditRow, setAuditRow] = useState<IncentiveRow | null>(null);
  const [auditEntries, setAuditEntries] = useState<{ id: number; activityType: string; at: string; by: string | null; oldValue: string | null; newValue: string | null }[] | null>(null);
  const [page, setPage] = useState(1);
  const [pagination, setPagination] = useState({ page: 1, limit: 50, total: 0, totalPages: 1 });
  // Totals come from the server across the whole filtered set, not just the
  // visible page — a page-only total reads as a grand total and misleads.
  const [serverTotals, setServerTotals] = useState<Record<AmountKey, number> & { recordCount: number }>(
    { doubleMachine: 0, attendanceBonus: 0, shiftIncentive: 0, otWeeklyInc: 0, employeeR: 0, recordCount: 0 }
  );
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());

  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);

  // Add / Edit modal
  const [modalOpen, setModalOpen] = useState(false);
  const [modalEmployeeId, setModalEmployeeId] = useState<number | ''>('');
  const [modalYear, setModalYear] = useState(year);
  const [modalMonth, setModalMonth] = useState(month);
  const [modalAmounts, setModalAmounts] = useState<Record<AmountKey, string>>({ ...EMPTY_AMOUNTS });
  const [modalRemarks, setModalRemarks] = useState('');
  const [editingId, setEditingId] = useState<number | null>(null);
  const [modalSaving, setModalSaving] = useState(false);

  const [importOpen, setImportOpen] = useState(false);
  const [importRows, setImportRows] = useState<(DoubleMachineImportRow & { status: 'ready' | 'failed' })[]>([]);
  const [chosenFile, setChosenFile] = useState<File | null>(null);
  const [parsing, setParsing] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const yearOptions = useMemo(() => {
    const y = new Date().getFullYear();
    return [y - 2, y - 1, y, y + 1];
  }, []);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const qs = new URLSearchParams({
        year: String(year),
        month: String(month),
        status: statusFilter,
        search,
        page: String(page),
      });
      if (departmentId) qs.set('departmentId', departmentId);
      const res = await fetch(`/api/payroll/double-machine?${qs.toString()}`);
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? 'Failed to load');
      setRows(json.data?.rows ?? []);
      setDepartments(json.data?.departments ?? []);
      setPeriodLocked(Boolean(json.data?.periodLocked));
      setPeriodRunStatus(json.data?.periodRunStatus ?? null);
      setStatusCounts(json.data?.statusCounts ?? {});
      if (json.data?.pagination) setPagination(json.data.pagination);
      if (json.data?.totals) setServerTotals(json.data.totals);
      setSelectedIds(new Set());
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to load');
      setRows([]);
    } finally {
      setLoading(false);
    }
  }, [year, month, departmentId, statusFilter, search, page, toast]);

  // Any filter change puts us back on page 1 — otherwise narrowing the filters
  // while on page 4 shows an empty grid that looks like "no records".
  useEffect(() => {
    setPage(1);
  }, [year, month, departmentId, statusFilter, search]);

  // Audit trail for the open row — from the endpoint that reads the
  // EmployeeActivity rows this module has always written under
  // module='double-machine', which nothing previously surfaced.
  useEffect(() => {
    if (!auditRow?.recordId) return;
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(`/api/payroll/double-machine/${auditRow.recordId}/audit`);
        const json = await res.json();
        if (!cancelled) setAuditEntries(res.ok ? json.data ?? [] : []);
      } catch {
        if (!cancelled) setAuditEntries([]);
      }
    })();
    return () => { cancelled = true; };
  }, [auditRow]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // The grid lists only saved records — employees without a record for the
  // period are still available for the Add/Edit modal picker.
  const records = useMemo(() => rows.filter((r) => r.recordId !== null), [rows]);
  const allEmployees = rows;

  const toggleAll = () => {
    setSelectedIds((prev) =>
      prev.size === records.length ? new Set() : new Set(records.map((r) => r.recordId!))
    );
  };

  const toggleOne = (id: number) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const selectedRecords = records.filter((r) => selectedIds.has(r.recordId!));

  // The grid had no totals at all, so an import could not be sanity-checked
  // or reconciled against the OT & Other Incentive register. These cover every
  // row the current filters match, not just this page.
  const columnTotals = serverTotals;
  const grandTotal = AMOUNT_KEYS.reduce((sum, k) => sum + columnTotals[k], 0);

  /**
   * One transactional request for the whole selection. This used to fire one
   * POST per row, so a mid-way failure left the selection half-applied with no
   * indication of which half. `complete` is now reachable only through here —
   * it is what payroll pays.
   */
  const bulkStatus = async (action: 'approve' | 'hold' | 'return') => {
    if (selectedRecords.length === 0) return;
    setBusy(true);
    try {
      const res = await fetch('/api/payroll/double-machine/bulk-status', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ids: selectedRecords.map((r) => r.recordId), action }),
      });
      const json = await res.json();
      if (!res.ok) {
        const detail = Array.isArray(json.rejected) && json.rejected.length
          ? ` — ${json.rejected[0].reason}`
          : '';
        throw new Error((json.error ?? 'Action failed') + detail);
      }
      const verb = action === 'approve' ? 'approved' : action === 'hold' ? 'put on hold' : 'returned';
      toast.success(`${json.updated} record(s) ${verb}.`);
      await loadData();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Action failed');
    } finally {
      setBusy(false);
    }
  };

  const deleteRecord = async (row: IncentiveRow) => {
    if (!row.recordId) return;
    setBusy(true);
    try {
      const res = await fetch('/api/payroll/double-machine', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ids: [row.recordId] }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? 'Delete failed');
      toast.success('Record deleted.');
      await loadData();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Delete failed');
    } finally {
      setBusy(false);
    }
  };

  const openAdd = () => {
    setEditingId(null);
    setModalEmployeeId('');
    setModalYear(year);
    setModalMonth(month);
    setModalAmounts({ ...EMPTY_AMOUNTS });
    setModalRemarks('');
    setModalOpen(true);
  };

  const openEdit = (row: IncentiveRow) => {
    setEditingId(row.recordId);
    setModalEmployeeId(row.employeeId);
    setModalYear(row.year);
    setModalMonth(row.month);
    setModalAmounts({
      doubleMachine: String(row.doubleMachine || ''),
      attendanceBonus: String(row.attendanceBonus || ''),
      shiftIncentive: String(row.shiftIncentive || ''),
      otWeeklyInc: String(row.otWeeklyInc || ''),
      employeeR: String(row.employeeR || ''),
    });
    setModalRemarks(row.remarks ?? '');
    setModalOpen(true);
  };

  const modalEmployee = allEmployees.find((e) => e.employeeId === modalEmployeeId) ?? null;

  const saveModal = async () => {
    if (modalEmployeeId === '') {
      toast.warning('Select an employee.');
      return;
    }
    setModalSaving(true);
    try {
      const amounts = Object.fromEntries(
        AMOUNT_KEYS.map((k) => [k, modalAmounts[k] === '' ? 0 : Number(modalAmounts[k])])
      );
      const hasValue = Object.values(amounts).some((v) => (v as number) > 0);
      const res = await fetch('/api/payroll/double-machine', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          employeeId: modalEmployeeId,
          year: modalYear,
          month: modalMonth,
          ...amounts,
          status: hasValue ? 'process' : 'draft',
          remarks: modalRemarks || null,
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? 'Save failed');
      toast.success(editingId ? 'Incentive updated.' : 'Incentive added.');
      setModalOpen(false);
      await loadData();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Save failed');
    } finally {
      setModalSaving(false);
    }
  };

  const exportExcel = () => {
    const wb = buildDoubleMachineTemplateWorkbook(
      records.map((r) => ({
        employeeCode: r.employeeCode,
        employeeName: r.employeeName,
        departmentName: r.department?.name ?? null,
        designationName: r.designation?.name ?? null,
        month: r.month,
        doubleMachine: r.doubleMachine,
        attendanceBonus: r.attendanceBonus,
        shiftIncentive: r.shiftIncentive,
        otWeeklyInc: r.otWeeklyInc,
        employeeR: r.employeeR,
      }))
    );
    XLSX.writeFile(wb, `double-machine-incentive-${year}-${String(month).padStart(2, '0')}.xlsx`);
  };

  const downloadSample = () => {
    const wb = buildDoubleMachineTemplateWorkbook(
      allEmployees.map((r) => ({
        employeeCode: r.employeeCode,
        employeeName: r.employeeName,
        departmentName: r.department?.name ?? null,
        designationName: r.designation?.name ?? null,
        month,
        doubleMachine: 0,
        attendanceBonus: 0,
        shiftIncentive: 0,
        otWeeklyInc: 0,
        employeeR: 0,
      }))
    );
    XLSX.writeFile(wb, 'double-machine-incentive-sample.xlsx');
  };

  const handleUploadParse = async () => {
    if (!chosenFile) {
      toast.warning('Choose a file first.');
      return;
    }
    setParsing(true);
    try {
      const parsed = await parseDoubleMachineWorkbookRows(chosenFile, allEmployees);
      if (parsed.length === 0) {
        toast.warning('No records found.');
        setImportRows([]);
        return;
      }
      setImportRows(parsed.map((r) => ({ ...r, status: r.error ? 'failed' : 'ready' })));
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to read file');
    } finally {
      setParsing(false);
    }
  };

  const confirmImport = async () => {
    const ready = importRows.filter((r) => r.status === 'ready' && r.employeeId);
    if (ready.length === 0) {
      toast.warning('No valid rows to confirm.');
      return;
    }
    setConfirming(true);
    try {
      const res = await fetch('/api/payroll/double-machine/bulk', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          year,
          month,
          rows: ready.map((r) => ({
            employeeId: r.employeeId,
            doubleMachine: r.doubleMachine,
            attendanceBonus: r.attendanceBonus,
            shiftIncentive: r.shiftIncentive,
            otWeeklyInc: r.otWeeklyInc,
            employeeR: r.employeeR,
          })),
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? 'Import failed');
      toast.success(json.message ?? 'Import complete.');
      setImportOpen(false);
      setImportRows([]);
      setChosenFile(null);
      await loadData();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Import failed');
    } finally {
      setConfirming(false);
    }
  };

  const inputStyle: CSSProperties = {
    backgroundColor: 'var(--surface)',
    color: 'var(--foreground)',
    borderColor: 'var(--border)',
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h1 className="text-xl font-semibold" style={{ color: 'var(--foreground)' }}>
          Double Machine &amp; Other Incentives
        </h1>
        <button
          onClick={exportExcel}
          disabled={records.length === 0}
          className="inline-flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-sm font-medium disabled:opacity-40"
          style={{ borderColor: 'var(--accent)', color: 'var(--accent)' }}
        >
          <ExportIcon />
          Export Excel
        </button>
      </div>

      {/* Filters */}
      <section className="rounded-xl border p-3" style={{ borderColor: 'var(--border)', backgroundColor: 'var(--surface)' }}>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-5 items-end">
          <Field label="Year">
            <select value={year} onChange={(e) => setYear(Number(e.target.value))} className="w-full rounded-lg border px-3 py-2 text-sm" style={inputStyle}>
              {yearOptions.map((y) => (
                <option key={y} value={y}>{y}</option>
              ))}
            </select>
          </Field>
          <Field label="Month">
            <select value={month} onChange={(e) => setMonth(Number(e.target.value))} className="w-full rounded-lg border px-3 py-2 text-sm" style={inputStyle}>
              {MONTH_OPTIONS.map((m) => (
                <option key={m.value} value={m.value}>{m.label}</option>
              ))}
            </select>
          </Field>
          <Field label="Department">
            <select value={departmentId} onChange={(e) => setDepartmentId(e.target.value)} className="w-full rounded-lg border px-3 py-2 text-sm" style={inputStyle}>
              <option value="">All Departments</option>
              {departments.map((d) => (
                <option key={d.id} value={d.id}>{d.name}</option>
              ))}
            </select>
          </Field>
          <Field label="Status">
            <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className="w-full rounded-lg border px-3 py-2 text-sm" style={inputStyle}>
              {STATUS_FILTERS.map((s) => (
                <option key={s.value} value={s.value}>{s.label}</option>
              ))}
            </select>
          </Field>
          <Field label="Search By">
            <input
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') setSearch(searchInput.trim());
              }}
              placeholder="Employee Code / Name"
              className="w-full rounded-lg border px-3 py-2 text-sm"
              style={inputStyle}
            />
          </Field>
        </div>
      </section>

      {/* Records grid */}
      {Object.keys(statusCounts).length > 0 && (
        <section className="flex flex-wrap items-center gap-3 rounded-xl border px-3 py-2 text-sm"
          style={{ borderColor: 'var(--border)', backgroundColor: 'var(--surface)' }}>
          <span style={{ color: 'var(--foreground-muted)' }}>This period:</span>
          {(['draft', 'process', 'hold', 'complete'] as const).map((st) => (
            <span key={st} className="inline-flex items-center gap-1" style={{ color: 'var(--foreground)' }}>
              <strong>{statusCounts[st] ?? 0}</strong>
              <span style={{ color: 'var(--foreground-muted)' }}>{st}</span>
            </span>
          ))}
          <span className="ml-auto text-xs" style={{ color: 'var(--foreground-muted)' }}>
            {(statusCounts.complete ?? 0) === 0
              ? 'Nothing is approved yet — payroll will pay none of this.'
              : `Only the ${statusCounts.complete} complete row(s) will be paid.`}
          </span>
        </section>
      )}

      {periodLocked && (
        <section className="rounded-xl border p-3" style={{ borderColor: '#b45309', backgroundColor: 'var(--surface)' }}>
          <p className="text-sm" style={{ color: 'var(--foreground)' }}>
            Payroll for this period is <strong>{periodRunStatus?.toLowerCase()}</strong> — payslips have already been
            produced from these figures, so nothing here can be added, edited, approved or deleted. Reopen the payroll
            run first if a correction is genuinely needed.
          </p>
        </section>
      )}

      <section className="rounded-xl border p-3" style={{ borderColor: 'var(--border)', backgroundColor: 'var(--surface)' }}>
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-sm font-semibold" style={{ color: 'var(--foreground)' }}>
            Employee Incentives — {monthName(month)} {year}
          </h2>
          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={() => {
                setImportOpen(true);
                setImportRows([]);
                setChosenFile(null);
              }}
              disabled={periodLocked}
              className="inline-flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-sm font-medium disabled:opacity-40"
              style={{ borderColor: 'var(--border)', color: 'var(--foreground)' }}
            >
              <UploadIcon />
              Bulk Upload
            </button>
            <button
              onClick={() => bulkStatus('return')}
              disabled={busy || selectedIds.size === 0 || periodLocked}
              title="Send an approved or held row back to Process for rework"
              className="rounded-lg border px-3 py-1.5 text-sm font-medium disabled:opacity-40"
              style={{ borderColor: 'var(--border)', color: 'var(--foreground)' }}
            >
              {busy ? 'Working…' : `Return${selectedIds.size ? ` (${selectedIds.size})` : ''}`}
            </button>
            <button
              onClick={() => bulkStatus('hold')}
              disabled={busy || selectedIds.size === 0 || periodLocked}
              title="Do not pay this row — payroll and the OT & Other Incentive register both honour it"
              className="rounded-lg border px-3 py-1.5 text-sm font-medium disabled:opacity-40"
              style={{ borderColor: '#b45309', color: '#b45309' }}
            >
              {busy ? 'Working…' : `On Hold${selectedIds.size ? ` (${selectedIds.size})` : ''}`}
            </button>
            <button
              onClick={() => bulkStatus('approve')}
              disabled={busy || selectedIds.size === 0 || periodLocked}
              title="Approve for payment — payroll pays complete rows"
              className="rounded-lg px-3 py-1.5 text-sm font-medium text-white disabled:opacity-40"
              style={{ backgroundColor: '#166534' }}
            >
              {busy ? 'Working…' : `Approve${selectedIds.size ? ` (${selectedIds.size})` : ''}`}
            </button>
            <button
              onClick={openAdd}
              disabled={busy || periodLocked}
              className="rounded-lg px-3 py-1.5 text-sm font-medium text-white disabled:opacity-50"
              style={{ backgroundColor: 'var(--accent)' }}
            >
              Add
            </button>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead>
              <tr style={{ backgroundColor: 'var(--surface-hover)' }}>
                <th className="px-3 py-2 text-left font-medium" style={{ color: 'var(--foreground-muted)' }}>
                  <input
                    type="checkbox"
                    checked={records.length > 0 && selectedIds.size === records.length}
                    onChange={toggleAll}
                    aria-label="Select all"
                  />
                </th>
                <Th>S.No</Th>
                <Th>Emp Code</Th>
                <Th>Employee</Th>
                <Th>Dept</Th>
                <Th>Designation</Th>
                <Th>Month</Th>
                <ThRight>Double Machine</ThRight>
                <ThRight>Att. Bonus</ThRight>
                <ThRight>Shift Incentive</ThRight>
                <ThRight>OT Weekly Inc</ThRight>
                <ThRight>Employee R</ThRight>
                <Th>Status</Th>
                <Th>Payroll Impact</Th>
                <Th>Actions</Th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={14} className="px-3 py-8 text-center" style={{ color: 'var(--foreground-muted)' }}>
                    Loading...
                  </td>
                </tr>
              ) : records.length === 0 ? (
                <tr>
                  <td colSpan={14} className="px-3 py-8 text-center" style={{ color: 'var(--foreground-muted)' }}>
                    No records found. Use Add to create one.
                  </td>
                </tr>
              ) : (
                records.map((row, idx) => {
                  const sc = STATUS_COLORS[row.status] ?? STATUS_COLORS.draft;
                  return (
                    <tr key={row.recordId} style={{ borderTop: '1px solid var(--border)' }}>
                      <td className="px-3 py-1.5">
                        <input
                          type="checkbox"
                          checked={selectedIds.has(row.recordId!)}
                          onChange={() => toggleOne(row.recordId!)}
                          aria-label={`Select ${row.employeeCode}`}
                        />
                      </td>
                      <Td>{idx + 1}</Td>
                      <Td>{row.employeeCode}</Td>
                      <Td>{row.employeeName}</Td>
                      <Td>{row.department?.name ?? ''}</Td>
                      <Td>{row.designation?.name ?? ''}</Td>
                      <Td>{monthName(row.month)}</Td>
                      <td className="px-3 py-1.5 text-right" style={{ color: 'var(--foreground)' }}>{fmtAmt(row.doubleMachine)}</td>
                      <td className="px-3 py-1.5 text-right" style={{ color: 'var(--foreground)' }}>{fmtAmt(row.attendanceBonus)}</td>
                      <td className="px-3 py-1.5 text-right" style={{ color: 'var(--foreground)' }}>{fmtAmt(row.shiftIncentive)}</td>
                      <td className="px-3 py-1.5 text-right" style={{ color: 'var(--foreground)' }}>{fmtAmt(row.otWeeklyInc)}</td>
                      <td className="px-3 py-1.5 text-right" style={{ color: 'var(--foreground)' }}>{fmtAmt(row.employeeR)}</td>
                      <td className="px-3 py-1.5">
                        <span
                          className="rounded-full px-2 py-0.5 text-xs font-medium"
                          style={{ backgroundColor: sc.bg, color: sc.fg }}
                          title={
                            row.status === 'complete' && row.approvedBy
                              ? `Approved by ${row.approvedBy}${row.approvedAt ? ` on ${row.approvedAt.slice(0, 10)}` : ''} — payroll pays this`
                              : row.rejectionReason
                                ? `Reason: ${row.rejectionReason}`
                                : row.updatedBy
                                  ? `Last changed by ${row.updatedBy}${row.updatedAt ? ` on ${row.updatedAt.slice(0, 10)}` : ''}`
                                  : undefined
                          }
                        >
                          {row.status}
                        </span>
                        {(row.approvedBy || row.updatedBy) && (
                          <div className="mt-0.5 text-[11px]" style={{ color: 'var(--foreground-muted)' }}>
                            {row.status === 'complete' && row.approvedBy
                              ? `✓ ${row.approvedBy}`
                              : row.updatedBy}
                          </div>
                        )}
                        <div className="mt-1"><StatusPipeline status={row.status} /></div>
                        {row.recordId && (
                          <button
                            onClick={() => { setAuditRow(row); setAuditEntries(null); }}
                            className="mt-1 text-[11px] underline"
                            style={{ color: 'var(--foreground-muted)' }}
                          >
                            audit trail
                          </button>
                        )}
                      </td>
                      <td className="px-3 py-1.5" style={{ maxWidth: 280 }}>
                        {(() => {
                          const im = payrollImpact(row);
                          const tone = im.tone === 'paid' ? '#166534' : im.tone === 'blocked' ? '#b45309' : 'var(--foreground-muted)';
                          return (
                            <>
                              <div className="text-xs font-medium" style={{ color: tone }}>{im.headline}</div>
                              <div className="text-[11px]" style={{ color: 'var(--foreground-muted)' }}>{im.detail}</div>
                            </>
                          );
                        })()}
                      </td>
                      <td className="px-3 py-1.5">
                        <div className="flex items-center gap-1.5">
                          <button
                            onClick={() => openEdit(row)}
                            disabled={busy || periodLocked}
                            className="rounded-lg border px-2.5 py-1 text-xs font-medium disabled:opacity-40"
                            style={{ borderColor: 'var(--border)', color: 'var(--foreground)' }}
                          >
                            Edit
                          </button>
                          <button
                            onClick={() => deleteRecord(row)}
                            disabled={busy || periodLocked}
                            className="rounded-lg border px-2.5 py-1 text-xs font-medium disabled:opacity-40"
                            style={{ borderColor: '#dc2626', color: '#dc2626' }}
                          >
                            Delete
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
            {!loading && serverTotals.recordCount > 0 && (
              <tfoot>
                <tr style={{ borderTop: '2px solid var(--border)', fontWeight: 600 }}>
                  <td className="px-3 py-2" colSpan={7} style={{ color: 'var(--foreground)' }}>
                    Total — {serverTotals.recordCount} record(s) matching the current filters
                  </td>
                  {AMOUNT_KEYS.map((k) => (
                    <td key={k} className="px-3 py-2 text-right tabular-nums" style={{ color: 'var(--foreground)' }}>
                      {fmtAmt(columnTotals[k])}
                    </td>
                  ))}
                  <td className="px-3 py-2 text-right tabular-nums" colSpan={3} style={{ color: 'var(--foreground)' }}>
                    {fmtAmt(grandTotal)}
                  </td>
                </tr>
              </tfoot>
            )}
          </table>
        </div>
        {pagination.totalPages > 1 && (
          <div className="flex items-center justify-between gap-2 border-t px-3 py-2" style={{ borderColor: 'var(--border)' }}>
            <span className="text-xs" style={{ color: 'var(--foreground-muted)' }}>
              Showing {(pagination.page - 1) * pagination.limit + 1}–
              {Math.min(pagination.page * pagination.limit, pagination.total)} of {pagination.total}
            </span>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={loading || pagination.page <= 1}
                className="rounded-lg border px-3 py-1 text-xs font-medium disabled:opacity-40"
                style={{ borderColor: 'var(--border)', color: 'var(--foreground)' }}
              >
                Previous
              </button>
              <span className="text-xs" style={{ color: 'var(--foreground-muted)' }}>
                Page {pagination.page} of {pagination.totalPages}
              </span>
              <button
                onClick={() => setPage((p) => Math.min(pagination.totalPages, p + 1))}
                disabled={loading || pagination.page >= pagination.totalPages}
                className="rounded-lg border px-3 py-1 text-xs font-medium disabled:opacity-40"
                style={{ borderColor: 'var(--border)', color: 'var(--foreground)' }}
              >
                Next
              </button>
            </div>
          </div>
        )}
      </section>

      {/* Add / Edit modal */}
      {modalOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          style={{ backgroundColor: 'rgba(0,0,0,0.45)' }}
          onClick={() => setModalOpen(false)}
        >
          <div
            className="flex max-h-[90vh] w-full max-w-2xl flex-col overflow-hidden rounded-xl border shadow-2xl"
            style={{ backgroundColor: 'var(--surface)', borderColor: 'var(--border)' }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b px-4 py-3" style={{ borderColor: 'var(--border)' }}>
              <h2 className="text-sm font-semibold" style={{ color: 'var(--foreground)' }}>
                {editingId ? 'Edit' : 'Add'} Double Machine Incentive
              </h2>
              <button onClick={() => setModalOpen(false)} className="text-xl leading-none" style={{ color: 'var(--foreground-muted)' }}>
                ×
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-4 space-y-4">
              <div>
                <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide" style={{ color: 'var(--foreground-muted)' }}>
                  Control Plan Parameters
                </h3>
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <Field label="Employee Name">
                    <select
                      value={modalEmployeeId}
                      disabled={editingId !== null}
                      onChange={(e) => setModalEmployeeId(e.target.value === '' ? '' : Number(e.target.value))}
                      className="w-full rounded-lg border px-3 py-2 text-sm"
                      style={inputStyle}
                    >
                      <option value="">Select Employee</option>
                      {allEmployees.map((e) => (
                        <option key={e.employeeId} value={e.employeeId}>
                          {e.employeeCode} — {e.employeeName}
                        </option>
                      ))}
                    </select>
                  </Field>
                  <Field label="Employee Code">
                    <input value={modalEmployee?.employeeCode ?? ''} disabled className="w-full rounded-lg border px-3 py-2 text-sm opacity-70" style={inputStyle} />
                  </Field>
                  <Field label="Department">
                    <input value={modalEmployee?.department?.name ?? ''} disabled className="w-full rounded-lg border px-3 py-2 text-sm opacity-70" style={inputStyle} />
                  </Field>
                  <Field label="Designation">
                    <input value={modalEmployee?.designation?.name ?? ''} disabled className="w-full rounded-lg border px-3 py-2 text-sm opacity-70" style={inputStyle} />
                  </Field>
                  <Field label="Year">
                    <select value={modalYear} onChange={(e) => setModalYear(Number(e.target.value))} className="w-full rounded-lg border px-3 py-2 text-sm" style={inputStyle}>
                      {yearOptions.map((y) => (
                        <option key={y} value={y}>{y}</option>
                      ))}
                    </select>
                  </Field>
                  <Field label="Month">
                    <select value={modalMonth} onChange={(e) => setModalMonth(Number(e.target.value))} className="w-full rounded-lg border px-3 py-2 text-sm" style={inputStyle}>
                      {MONTH_OPTIONS.map((m) => (
                        <option key={m.value} value={m.value}>{m.label}</option>
                      ))}
                    </select>
                  </Field>
                </div>
              </div>

              <div>
                <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide" style={{ color: 'var(--foreground-muted)' }}>
                  Incentive Details
                </h3>
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  {AMOUNT_FIELDS.map((f) => (
                    <Field key={f.key} label={f.label}>
                      <input
                        type="number"
                        step="0.1"
                        min={0}
                        value={modalAmounts[f.key]}
                        onChange={(e) => setModalAmounts((prev) => ({ ...prev, [f.key]: e.target.value }))}
                        placeholder="₹ 0.00"
                        className="w-full rounded-lg border px-3 py-2 text-sm"
                        style={inputStyle}
                      />
                    </Field>
                  ))}
                  <Field label="Remarks">
                    <input
                      value={modalRemarks}
                      onChange={(e) => setModalRemarks(e.target.value)}
                      className="w-full rounded-lg border px-3 py-2 text-sm"
                      style={inputStyle}
                    />
                  </Field>
                </div>
              </div>

            </div>

            <div className="flex items-center justify-end gap-2 border-t px-4 py-3" style={{ borderColor: 'var(--border)' }}>
              <button
                type="button"
                onClick={() => {
                  setModalAmounts({ ...EMPTY_AMOUNTS });
                  setModalRemarks('');
                  setModalEmployeeId('');
                }}
                className="rounded-lg border px-4 py-1.5 text-sm font-medium"
                style={{ borderColor: 'var(--border)', color: 'var(--foreground)' }}
              >
                Clear
              </button>
              <button
                type="button"
                onClick={saveModal}
                disabled={modalSaving}
                className="rounded-lg px-4 py-1.5 text-sm font-medium text-white disabled:opacity-50"
                style={{ backgroundColor: 'var(--accent)' }}
              >
                {modalSaving ? 'Saving…' : 'Save'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Bulk upload modal */}
      {importOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ backgroundColor: 'rgba(0,0,0,0.45)' }} onClick={() => setImportOpen(false)}>
          <div
            className="flex max-h-[90vh] w-full max-w-5xl flex-col overflow-hidden rounded-xl border shadow-2xl"
            style={{ backgroundColor: 'var(--surface)', borderColor: 'var(--border)' }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b px-4 py-3" style={{ borderColor: 'var(--border)' }}>
              <h2 className="text-sm font-semibold" style={{ color: 'var(--foreground)' }}>
                Double Machine File Upload
              </h2>
              <button onClick={() => setImportOpen(false)} className="text-xl leading-none" style={{ color: 'var(--foreground-muted)' }}>
                ×
              </button>
            </div>

            <div className="flex flex-wrap items-center gap-2 border-b px-4 py-3" style={{ borderColor: 'var(--border)' }}>
              <button
                type="button"
                onClick={() => fileRef.current?.click()}
                className="rounded-lg border px-3 py-1.5 text-sm font-medium"
                style={{ borderColor: 'var(--border)', color: 'var(--foreground)' }}
              >
                Choose File
              </button>
              <input
                ref={fileRef}
                type="file"
                accept=".xlsx,.xls"
                className="hidden"
                onChange={(e) => {
                  const f = e.target.files?.[0] ?? null;
                  setChosenFile(f);
                  setImportRows([]);
                  e.target.value = '';
                }}
              />
              <button
                type="button"
                onClick={handleUploadParse}
                disabled={parsing}
                className="rounded-lg px-3 py-1.5 text-sm font-medium text-white disabled:opacity-50"
                style={{ backgroundColor: 'var(--accent)' }}
              >
                {parsing ? 'Reading…' : 'Upload'}
              </button>
              <button
                type="button"
                onClick={downloadSample}
                className="rounded-lg border px-3 py-1.5 text-sm font-medium"
                style={{ borderColor: 'var(--border)', color: 'var(--foreground)' }}
              >
                Sample
              </button>
              {chosenFile && (
                <span className="text-xs" style={{ color: 'var(--foreground-muted)' }}>
                  {chosenFile.name}
                </span>
              )}
            </div>

            <div className="min-h-[240px] flex-1 overflow-auto p-4">
              <table className="min-w-full text-sm">
                <thead>
                  <tr style={{ backgroundColor: 'var(--surface-hover)' }}>
                    <Th>S.No</Th>
                    <Th>Emp Code</Th>
                    <Th>Employee</Th>
                    <Th>Dept</Th>
                    <Th>Designation</Th>
                    <Th>Month</Th>
                    <ThRight>Double Machine</ThRight>
                    <ThRight>Att. Bonus</ThRight>
                    <ThRight>Shift Incentive</ThRight>
                    <ThRight>OT Weekly Inc</ThRight>
                    <ThRight>Employee R</ThRight>
                    <Th>Status</Th>
                  </tr>
                </thead>
                <tbody>
                  {importRows.length === 0 ? (
                    <tr>
                      <td colSpan={12} className="px-3 py-10 text-center text-sm" style={{ color: 'var(--foreground-muted)' }}>
                        No records found. Choose a filled template and click Upload.
                      </td>
                    </tr>
                  ) : (
                    importRows.map((r, i) => (
                      <tr key={r.row} style={{ borderTop: '1px solid var(--border)' }}>
                        <Td>{i + 1}</Td>
                        <Td>{r.employeeCode}</Td>
                        <Td>{r.employeeName}</Td>
                        <Td>{r.departmentName}</Td>
                        <Td>{r.designationName}</Td>
                        <Td>{r.month || monthName(month)}</Td>
                        <td className="px-3 py-1.5 text-right" style={{ color: 'var(--foreground)' }}>{fmtAmt(r.doubleMachine)}</td>
                        <td className="px-3 py-1.5 text-right" style={{ color: 'var(--foreground)' }}>{fmtAmt(r.attendanceBonus)}</td>
                        <td className="px-3 py-1.5 text-right" style={{ color: 'var(--foreground)' }}>{fmtAmt(r.shiftIncentive)}</td>
                        <td className="px-3 py-1.5 text-right" style={{ color: 'var(--foreground)' }}>{fmtAmt(r.otWeeklyInc)}</td>
                        <td className="px-3 py-1.5 text-right" style={{ color: 'var(--foreground)' }}>{fmtAmt(r.employeeR)}</td>
                        <td className="px-3 py-1.5">
                          {r.error ? (
                            <span className="text-xs font-medium" style={{ color: '#dc2626' }}>{r.error}</span>
                          ) : (
                            <span
                              className="rounded-full px-2 py-0.5 text-xs font-medium"
                              style={{ backgroundColor: STATUS_COLORS.draft.bg, color: STATUS_COLORS.draft.fg }}
                            >
                              ready
                            </span>
                          )}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>

            <div className="flex items-center justify-end gap-2 border-t px-4 py-3" style={{ borderColor: 'var(--border)' }}>
              <button
                type="button"
                onClick={() => setImportOpen(false)}
                className="rounded-lg border px-4 py-1.5 text-sm font-medium"
                style={{ borderColor: 'var(--border)', color: 'var(--foreground)' }}
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={confirmImport}
                disabled={confirming || importRows.every((r) => r.status !== 'ready')}
                className="rounded-lg px-4 py-1.5 text-sm font-medium text-white disabled:opacity-50"
                style={{ backgroundColor: 'var(--accent)' }}
              >
                {confirming ? 'Saving…' : 'Confirm'}
              </button>
            </div>
          </div>
        </div>
      )}
      {auditRow && (
        <div
          className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto p-4"
          style={{ backgroundColor: 'rgba(0,0,0,0.4)' }}
          onClick={() => setAuditRow(null)}
          role="dialog"
          aria-modal="true"
          aria-label="Audit trail"
        >
          <div
            className="mt-10 w-full max-w-xl rounded-xl border p-4"
            style={{ borderColor: 'var(--border)', backgroundColor: 'var(--surface)' }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-3">
              <div>
                <h2 className="text-base font-semibold" style={{ color: 'var(--foreground)' }}>Audit trail</h2>
                <p className="text-xs" style={{ color: 'var(--foreground-muted)' }}>
                  {auditRow.employeeCode} — {auditRow.employeeName} · {monthName(auditRow.month)} {auditRow.year}
                </p>
              </div>
              <button
                onClick={() => setAuditRow(null)}
                className="rounded-lg border px-2.5 py-1 text-xs font-medium"
                style={{ borderColor: 'var(--border)', color: 'var(--foreground)' }}
              >
                Close
              </button>
            </div>

            <div className="mt-3 rounded-lg border p-3 text-xs" style={{ borderColor: 'var(--border)', color: 'var(--foreground-muted)' }}>
              <div><strong style={{ color: 'var(--foreground)' }}>Current status:</strong> {auditRow.status}</div>
              {auditRow.approvedBy && (
                <div><strong style={{ color: 'var(--foreground)' }}>Approved by:</strong> {auditRow.approvedBy}
                  {auditRow.approvedAt ? ` on ${auditRow.approvedAt.slice(0, 10)}` : ''}</div>
              )}
              {auditRow.rejectionReason && (
                <div><strong style={{ color: 'var(--foreground)' }}>Hold / return reason:</strong> {auditRow.rejectionReason}</div>
              )}
              {auditRow.updatedBy && (
                <div><strong style={{ color: 'var(--foreground)' }}>Last changed by:</strong> {auditRow.updatedBy}
                  {auditRow.updatedAt ? ` on ${auditRow.updatedAt.slice(0, 10)}` : ''}</div>
              )}
            </div>

            <div className="mt-3 space-y-2">
              {auditEntries === null && (
                <p className="text-xs" style={{ color: 'var(--foreground-muted)' }}>Loading…</p>
              )}
              {auditEntries?.length === 0 && (
                <p className="text-xs" style={{ color: 'var(--foreground-muted)' }}>
                  No recorded activity. Rows created before the transition routes existed have no trail.
                </p>
              )}
              {auditEntries?.map((e) => (
                <div key={e.id} className="rounded-lg border p-2 text-xs" style={{ borderColor: 'var(--border)' }}>
                  <div className="flex items-baseline justify-between gap-2">
                    <span className="font-medium" style={{ color: 'var(--foreground)' }}>
                      {e.activityType.replace(/^double_machine_/, '').replace(/_/g, ' ')}
                    </span>
                    <span style={{ color: 'var(--foreground-muted)' }}>{e.at.slice(0, 19).replace('T', ' ')}</span>
                  </div>
                  <div style={{ color: 'var(--foreground-muted)' }}>
                    {e.by ?? 'unknown user'}
                    {e.oldValue && e.newValue ? ` · ${e.oldValue} → ${e.newValue}` : ''}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

    </div>
  );
}

function Th({ children }: { children: ReactNode }) {
  return (
    <th className="whitespace-nowrap px-3 py-2 text-left font-medium" style={{ color: 'var(--foreground-muted)' }}>
      {children}
    </th>
  );
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex flex-col gap-1">
      <label className="text-sm font-medium" style={{ color: 'var(--foreground)' }}>
        {label}
      </label>
      {children}
    </div>
  );
}

function ThRight({ children }: { children: ReactNode }) {
  return (
    <th className="whitespace-nowrap px-3 py-2 text-right font-medium" style={{ color: 'var(--foreground-muted)' }}>
      {children}
    </th>
  );
}

function Td({ children }: { children: ReactNode }) {
  return (
    <td className="whitespace-nowrap px-3 py-1.5" style={{ color: 'var(--foreground)' }}>
      {children}
    </td>
  );
}

function ExportIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M14 3h7v7" />
      <path d="M10 14 21 3" />
      <path d="M21 14v6a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1h6" />
    </svg>
  );
}

function UploadIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M12 16V4" />
      <path d="m7 9 5-5 5 5" />
      <path d="M5 20h14" />
    </svg>
  );
}
