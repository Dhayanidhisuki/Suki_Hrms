/**
 * Performance Incentive — single page with Company Incentive configuration
 * (HR/Admin) and Individual Incentive employee-level grid (Reporting Manager
 * or HR/Admin), per the BRD. Replaces the previous PMS Incentive page.
 */

'use client';

import { useState, useEffect, useCallback, useMemo, useRef, type ReactNode } from 'react';
import * as XLSX from 'xlsx';
import { buildPmsTemplateWorkbook, parsePmsWorkbookRows, monthName, type PmsImportRow } from '@/lib/pms-bulk-import';

interface UserAccess {
  canViewAll: boolean;
  canManageConfig: boolean;
  canApprove: boolean;
  canSubmit: boolean;
  isReportingManager: boolean;
  ownEmployeeId: number | null;
}

interface PmsConfig {
  id: number | null;
  financialYear: string;
  effectiveFrom: string;
  effectiveTo: string;
  calculationBasis: string;
  salaryComponentId: number | null;
  incentiveType: string;
  companyPercent: number;
  companyValue: number | null;
  targetIncentiveAmount: number | null;
  remarks: string;
  status: string;
}

interface IncentiveRow {
  recordId: number | null;
  employeeId: number;
  employeeCode: string;
  employeeName: string;
  department: { id: number; name: string } | null;
  designation: { id: number; name: string } | null;
  reportingManager: { id: number; employeeCode: string; firstName: string; lastName: string } | null;
  year: number;
  month: number;
  financialYear: string;
  calculationBasis: string;
  salaryComponentId: number | null;
  incentiveType: string;
  basisAmount: number;
  companyPercent: number;
  individualPercent: number;
  totalPercent: number;
  companyValue: number | null;
  individualValue: number | null;
  companyAmount: number;
  individualAmount: number;
  overallAmount: number;
  performanceIncentive: number;
  monthDays: number;
  presentDays: number;
  incentiveMoney: number;
  incentiveEarn: number;
  employeeEsi: number;
  employerEsi: number;
  pmsNet: number;
  status: string;
  supportingFileName: string | null;
  supportingFilePath: string | null;
  remarks: string | null;
  rejectionReason: string | null;
  submittedByUserId: number | null;
  approvedByUserId: number | null;
  approvedDate: string | null;
}

interface RowEdit {
  companyPercent?: number | '';
  companyValue?: number | null;
  individualPercent?: number | '';
  individualValue?: number | null;
  remarks?: string | null;
}

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

const STATUS_COLORS: Record<string, { bg: string; fg: string }> = {
  draft: { bg: '#f3f4f6', fg: '#4b5563' },
  submitted: { bg: '#fef9c3', fg: '#854d0e' },
  under_review: { bg: '#dbeafe', fg: '#1e40af' },
  approved: { bg: '#dcfce7', fg: '#166534' },
  rejected: { bg: '#fee2e2', fg: '#991b1b' },
  returned: { bg: '#ffedd5', fg: '#9a3412' },
  finalized: { bg: '#e0e7ff', fg: '#3730a3' },
  pending_hr: { bg: '#fef9c3', fg: '#854d0e' },
};

function toDateInput(year: number, month: number, day: number): string {
  return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

function financialYearForDate(date = new Date()): string {
  const y = date.getFullYear();
  const m = date.getMonth() + 1;
  return m >= 4 ? `${y}-${String((y + 1) % 100).padStart(2, '0')}` : `${y - 1}-${String(y % 100).padStart(2, '0')}`;
}

function yearMonthForDate(d: string | Date | null | undefined): { year: number; month: number } {
  const date = d ? (typeof d === 'string' ? new Date(d) : d) : new Date();
  return { year: date.getFullYear(), month: date.getMonth() + 1 };
}

export default function PerformanceIncentivePage() {
  const [access, setAccess] = useState<UserAccess | null>(null);
  const [config, setConfig] = useState<PmsConfig>(() => {
    const now = new Date();
    const year = now.getFullYear();
    const month = now.getMonth() + 1;
    const lastDay = new Date(year, month, 0).getDate();
    return {
      id: null,
      financialYear: financialYearForDate(now),
      effectiveFrom: toDateInput(year, month, 1),
      effectiveTo: toDateInput(year, month, lastDay),
      calculationBasis: 'basic',
      salaryComponentId: null,
      incentiveType: 'percentage',
      companyPercent: 0,
      companyValue: null,
      targetIncentiveAmount: null,
      remarks: '',
      status: 'active',
    };
  });
  const [rows, setRows] = useState<IncentiveRow[]>([]);
  const [departments, setDepartments] = useState<{ id: number; name: string }[]>([]);
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const [bulkBusy, setBulkBusy] = useState(false);
  const [loading, setLoading] = useState(false);
  const [savingConfig, setSavingConfig] = useState(false);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [departmentFilter, setDepartmentFilter] = useState<string | number>('');
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [importOpen, setImportOpen] = useState(false);
  const [importRows, setImportRows] = useState<(PmsImportRow & { status: 'ready' | 'applying' | 'applied' | 'failed' })[]>([]);
  const [importing, setImporting] = useState(false);
  const [parsingImport, setParsingImport] = useState(false);
  const [importFileError, setImportFileError] = useState<string | null>(null);
  const [duplicatePopup, setDuplicatePopup] = useState<{ code: string; name: string; reason: string }[] | null>(null);
  const [chosenFile, setChosenFile] = useState<File | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingRow, setEditingRow] = useState<IncentiveRow | null>(null);
  const [modalEmployeeId, setModalEmployeeId] = useState<number | ''>('');
  const [modalYear, setModalYear] = useState<number>(0);
  const [modalMonth, setModalMonth] = useState<number>(0);
  const [modalForm, setModalForm] = useState<RowEdit>({});
  const [modalSaving, setModalSaving] = useState(false);
  const [modalError, setModalError] = useState<string | null>(null);


  useEffect(() => {
    fetch('/api/payroll/pms?scope=access')
      .then((r) => r.json())
      .then((json: { data: UserAccess }) => setAccess(json.data))
      .catch(() => {});
  }, []);

  const loadData = useCallback(async () => {
    if (!config.financialYear) return;
    const { year, month } = yearMonthForDate(config.effectiveFrom);
    setLoading(true);
    setError(null);
    try {
      const [configRes, listRes] = await Promise.all([
        fetch(`/api/payroll/pms?scope=config&financialYear=${config.financialYear}`),
        fetch(`/api/payroll/pms?scope=list&financialYear=${config.financialYear}&year=${year}&month=${month}&status=${statusFilter}&search=${encodeURIComponent(search)}&limit=1000`),
      ]);
      const configJson = await configRes.json();
      const listJson = await listRes.json();

      if (configJson.data) {
        const c = configJson.data.config;
        if (c) {
          setConfig((prev) => ({
            ...prev,
            id: c.id,
            calculationBasis: c.calculationBasis,
            salaryComponentId: c.salaryComponentId,
            incentiveType: c.incentiveType,
            companyPercent: Number(c.companyPercent ?? 0),
            companyValue: c.companyValue === null ? null : Number(c.companyValue),
            targetIncentiveAmount: c.targetIncentiveAmount === null ? null : Number(c.targetIncentiveAmount),
            remarks: c.remarks ?? '',
            status: c.status,
          }));
        }
      }

      if (listJson.data?.rows) {
        setRows(listJson.data.rows);
        setDepartments(listJson.data.departments ?? []);
      } else {
        setRows([]);
        setDepartments([]);
      }
      setSelectedIds(new Set());
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load data');
    } finally {
      setLoading(false);
    }
  }, [config.financialYear, config.effectiveFrom, search, statusFilter]);

  useEffect(() => {
    const t = setTimeout(() => loadData(), 250);
    return () => clearTimeout(t);
  }, [loadData]);

  const configYearMonth = useMemo(() => yearMonthForDate(config.effectiveFrom), [config.effectiveFrom]);

  const yearOptions = useMemo(() => {
    const current = new Date().getFullYear();
    const years: { value: number; label: string }[] = [];
    for (let y = current - 2; y <= current + 2; y++) years.push({ value: y, label: String(y) });
    return years;
  }, []);

  const setYearMonth = (year: number, month: number) => {
    const lastDay = new Date(year, month, 0).getDate();
    const from = new Date(year, month - 1, 1);
    setConfig((c) => ({ ...c, effectiveFrom: toDateInput(year, month, 1), effectiveTo: toDateInput(year, month, lastDay), financialYear: financialYearForDate(from) }));
  };

  const departmentOptions = useMemo(() => {
    return [{ value: '', label: 'All Departments' }, ...departments.map((d) => ({ value: d.id, label: d.name }))];
  }, [departments]);

  const filteredRows = useMemo(() => {
    if (departmentFilter === '') return rows;
    const depId = Number(departmentFilter);
    return rows.filter((r) => r.department?.id === depId);
  }, [rows, departmentFilter]);

  // The grid lists only saved records; employees without a record for the
  // period feed the Add modal's picker.
  const records = useMemo(() => filteredRows.filter((r) => r.recordId !== null), [filteredRows]);

  const canEditRow = (row: IncentiveRow): boolean => {
    if (!access) return false;
    if (access.canApprove) return true;
    if (access.isReportingManager && row.reportingManager?.id === access.ownEmployeeId) {
      return ['draft', 'returned'].includes(row.status) || row.recordId === null;
    }
    return false;
  };

  const saveConfig = async () => {
    if (!access?.canManageConfig) return;
    setSavingConfig(true);
    setError(null);
    try {
      const res = await fetch('/api/payroll/pms/config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...config,
          effectiveFrom: new Date(config.effectiveFrom).toISOString(),
          effectiveTo: new Date(config.effectiveTo).toISOString(),
          targetIncentiveAmount: null,
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? 'Save failed');
      setSuccess('Configuration saved.');
      await loadData();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Save failed');
    } finally {
      setSavingConfig(false);
    }
  };

  const buildRowPayload = (row: IncentiveRow, edit: RowEdit, submit = false) => {
    const companyPercent = edit.companyPercent !== undefined && edit.companyPercent !== '' ? Number(edit.companyPercent) : row.companyPercent;
    const companyValue = edit.companyValue !== undefined ? edit.companyValue : row.companyValue;
    const individualPercent = edit.individualPercent !== undefined && edit.individualPercent !== '' ? Number(edit.individualPercent) : row.individualPercent;
    const individualValue = edit.individualValue !== undefined ? edit.individualValue : row.individualValue;

    const payload: Record<string, unknown> = {
      financialYear: row.financialYear,
      year: row.year,
      month: row.month,
      individualPercent,
      individualValue,
      remarks: edit.remarks ?? row.remarks,
      submit,
    };

    if (access?.canApprove) {
      payload.companyPercent = companyPercent;
      payload.companyValue = companyValue;
    }

    return payload;
  };

  async function apiSaveRow(row: IncentiveRow, payload: Record<string, unknown>) {
    const res = row.recordId
      ? await fetch(`/api/payroll/pms/${row.recordId}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        })
      : await fetch('/api/payroll/pms', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ ...payload, employeeId: row.employeeId }),
        });
    const json = await res.json();
    if (!res.ok) throw new Error(json.error ?? 'Save failed');
    return json;
  }

  const bulkApplyCompany = async () => {
    if (!access?.canApprove) return;
    if (filteredRows.length === 0) {
      setError('No employees to apply.');
      return;
    }
    if (config.companyPercent > 50) {
      setError('Company % cannot exceed 50.');
      return;
    }
    setLoading(true);
    setError(null);
    setSuccess(null);
    try {
      await Promise.all(
        filteredRows.map((row) =>
          apiSaveRow(row, buildRowPayload(row, { companyPercent: config.companyPercent }, false))
        )
      );
      setSuccess(`Company % applied to ${filteredRows.length} employee(s).`);
      await loadData();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Bulk apply failed');
    } finally {
      setLoading(false);
    }
  };

  const downloadPmsTemplate = () => {
    const wb = buildPmsTemplateWorkbook(
      filteredRows.map((r) => ({
        employeeId: r.employeeId,
        employeeCode: r.employeeCode,
        employeeName: r.employeeName,
        departmentName: r.department?.name ?? null,
        managerName: r.reportingManager ? `${r.reportingManager.firstName} ${r.reportingManager.lastName}` : null,
        year: r.year,
        month: r.month,
        companyPercent: r.companyPercent,
        remarks: r.remarks,
      }))
    );
    XLSX.writeFile(wb, `pms-incentive-${configYearMonth.year}-${String(configYearMonth.month).padStart(2, '0')}.xlsx`);
  };

  const handleImportFile = async () => {
    const file = chosenFile;
    if (!file) {
      setImportFileError('Choose a file first.');
      return;
    }
    setImportFileError(null);
    setImportRows([]);
    setParsingImport(true);
    try {
      const parsed = await parsePmsWorkbookRows(file, rows, access?.canApprove === true);
      if (parsed.length === 0) {
        setImportFileError('No rows found in the uploaded file.');
        return;
      }
      setImportRows(parsed.map((r) => ({ ...r, status: r.error ? 'failed' : 'ready' })));
      const dups = parsed.filter((p) => p.error?.startsWith('Duplicate'));
      if (dups.length > 0) {
        setDuplicatePopup(dups.map((p) => ({ code: p.employeeCode, name: p.employeeName ?? '', reason: p.error ?? '' })));
      }
    } catch (err) {
      setImportFileError(err instanceof Error ? err.message : 'Failed to read the uploaded file');
    } finally {
      setParsingImport(false);
    }
  };

  const runImport = async () => {
    setImporting(true);
    try {
      const byEmployee = new Map(rows.map((r) => [r.employeeId, r]));
      for (let i = 0; i < importRows.length; i++) {
        const r = importRows[i];
        if (r.status !== 'ready' || r.employeeId === undefined) continue;
        setImportRows((prev) => prev.map((row, idx) => (idx === i ? { ...row, status: 'applying' } : row)));
        const row = byEmployee.get(r.employeeId);
        if (!row) continue;
        const edit: RowEdit = { individualPercent: r.individualPercent, remarks: r.remarks ?? row.remarks };
        if (access?.canApprove && r.companyPercent !== undefined) edit.companyPercent = r.companyPercent;
        try {
          // Imported rows always go straight into the Process bucket.
          await apiSaveRow(row, buildRowPayload(row, edit, true));
          setImportRows((prev) => prev.map((row, idx) => (idx === i ? { ...row, status: 'applied' } : row)));
        } catch (err) {
          setImportRows((prev) => prev.map((row, idx) => (idx === i ? { ...row, status: 'failed', error: err instanceof Error ? err.message : 'Failed' } : row)));
        }
      }
      setSuccess('Import complete.');
      await loadData();
    } finally {
      setImporting(false);
    }
  };

  const uploadFile = async (row: IncentiveRow, file: File) => {
    if (!row.recordId) {
      setError('Save the incentive record before uploading a file.');
      return;
    }
    const form = new FormData();
    form.append('file', file);
    try {
      const res = await fetch(`/api/payroll/pms/${row.recordId}/upload`, { method: 'POST', body: form });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? 'Upload failed');
      setSuccess('Supporting document uploaded.');
      await loadData();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Upload failed');
    }
  };

  const selectableRows = records;

  const deleteRecord = async (row: IncentiveRow) => {
    if (!row.recordId) return;
    setBulkBusy(true);
    setError(null);
    setSuccess(null);
    try {
      const res = await fetch('/api/payroll/pms', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ids: [row.recordId] }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? 'Delete failed');
      setSuccess('Record deleted.');
      await loadData();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Delete failed');
    } finally {
      setBulkBusy(false);
    }
  };

  // ── Add / Edit modal ───────────────────────────────────────────────────
  const openAdd = () => {
    setEditingRow(null);
    setModalEmployeeId('');
    setModalYear(configYearMonth.year);
    setModalMonth(configYearMonth.month);
    setModalForm({ individualPercent: '', individualValue: null, remarks: null });
    setModalError(null);
    setModalOpen(true);
  };

  const openEdit = (row: IncentiveRow) => {
    setEditingRow(row);
    setModalEmployeeId(row.employeeId);
    setModalYear(row.year);
    setModalMonth(row.month);
    setModalForm({
      companyPercent: row.companyPercent,
      companyValue: row.companyValue,
      individualPercent: row.individualPercent,
      individualValue: row.individualValue,
      remarks: row.remarks,
    });
    setModalError(null);
    setModalOpen(true);
  };

  const modalRow = filteredRows.find((r) => r.employeeId === modalEmployeeId) ?? null;

  const saveModal = async () => {
    const row = modalRow;
    if (!row) {
      setModalError('Select an employee.');
      return;
    }
    setModalSaving(true);
    setModalError(null);
    try {
      const payload = {
        ...buildRowPayload(row, modalForm, true),
        year: modalYear,
        month: modalMonth,
        financialYear: financialYearForDate(new Date(modalYear, modalMonth - 1, 1)),
      };
      await apiSaveRow(row, payload);
      setSuccess(editingRow ? 'Incentive updated.' : 'Incentive added.');
      setModalOpen(false);
      await loadData();
    } catch (err) {
      setModalError(err instanceof Error ? err.message : 'Save failed');
    } finally {
      setModalSaving(false);
    }
  };

  const exportPmsExcel = () => {
    const wb = buildPmsTemplateWorkbook(
      records.map((r) => ({
        employeeId: r.employeeId,
        employeeCode: r.employeeCode,
        employeeName: r.employeeName,
        departmentName: r.department?.name ?? null,
        managerName: r.reportingManager ? `${r.reportingManager.firstName} ${r.reportingManager.lastName}` : null,
        year: r.year,
        month: r.month,
        companyPercent: r.companyPercent,
        individualPercent: r.individualPercent,
        remarks: r.remarks,
      }))
    );
    XLSX.writeFile(wb, `pms-incentive-${configYearMonth.year}-${String(configYearMonth.month).padStart(2, '0')}.xlsx`);
  };

  const toggleSelect = (employeeId: number) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(employeeId)) next.delete(employeeId);
      else next.add(employeeId);
      return next;
    });
  };

  const toggleSelectAll = () => {
    setSelectedIds((prev) =>
      prev.size === selectableRows.length ? new Set() : new Set(selectableRows.map((r) => r.employeeId))
    );
  };

  const bulkAction = async (path: 'hold' | 'approve') => {
    if (selectedIds.size === 0) return;
    setBulkBusy(true);
    setError(null);
    setSuccess(null);
    try {
      const results = await Promise.allSettled(
        Array.from(selectedIds).map(async (employeeId) => {
          const row = rows.find((r) => r.employeeId === employeeId);
          if (!row) throw new Error('Row not found');
          // Rows with no saved record yet need one created (as draft) before
          // the status action can target it.
          let recordId = row.recordId;
          if (recordId === null) {
            const created = await apiSaveRow(row, buildRowPayload(row, {}, false));
            recordId = created.id;
          }
          const res = await fetch(`/api/payroll/pms/${recordId}/${path}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: '{}',
          });
          if (!res.ok) throw new Error((await res.json()).error ?? `${path} failed`);
        })
      );
      const failed = results.filter((r) => r.status === 'rejected');
      setSelectedIds(new Set());
      if (failed.length > 0) {
        setError(`${failed.length} of ${selectedIds.size} row(s) failed — ${(failed[0] as PromiseRejectedResult).reason?.message ?? 'see console'}`);
      } else {
        setSuccess(path === 'approve' ? `${selectedIds.size} employee(s) marked Complete.` : `${selectedIds.size} employee(s) put on Hold.`);
      }
      await loadData();
    } finally {
      setBulkBusy(false);
    }
  };

  if (!access) {
    return (
      <div className="space-y-4">
        <h1 className="text-xl font-semibold" style={{ color: 'var(--foreground)' }}>
          Performance Incentive
        </h1>
        <p style={{ color: 'var(--foreground-muted)' }}>Loading...</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-xl font-semibold" style={{ color: 'var(--foreground)' }}>
          Performance Incentive
        </h1>
        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={exportPmsExcel}
            disabled={records.length === 0}
            className="rounded-lg border px-3 py-1.5 text-sm font-medium disabled:opacity-40"
            style={{ borderColor: 'var(--accent)', color: 'var(--accent)' }}
          >
            Export Excel
          </button>
          <span className="rounded-full px-3 py-1 text-xs font-medium" style={{ backgroundColor: 'var(--surface-hover)', color: 'var(--foreground-muted)' }}>
            {access.canApprove ? 'HR / Admin' : 'Reporting Manager'}
          </span>
        </div>
      </div>

      {error && (
        <div className="rounded-lg px-3 py-2 text-sm" style={{ backgroundColor: '#fef2f2', color: '#dc2626' }}>
          {error}
        </div>
      )}
      {success && (
        <div className="rounded-lg px-3 py-2 text-sm" style={{ backgroundColor: '#dcfce7', color: '#166534' }}>
          {success}
        </div>
      )}

      {/* Incentive Configuration */}
      {access.canManageConfig && (
        <section className="rounded-xl border p-3" style={{ borderColor: 'var(--border)', backgroundColor: 'var(--surface)' }}>
          <h2 className="mb-3 text-sm font-semibold" style={{ color: 'var(--foreground)' }}>
            Incentive Configuration
          </h2>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-7 items-end">
            <Select
              label="Year"
              value={configYearMonth.year}
              options={yearOptions}
              onChange={(v) => setYearMonth(Number(v), configYearMonth.month)}
            />
            <Select
              label="Month"
              value={configYearMonth.month}
              options={MONTH_OPTIONS}
              onChange={(v) => setYearMonth(configYearMonth.year, Number(v))}
            />
            <Select
              label="Department"
              value={departmentFilter}
              options={departmentOptions}
              onChange={(v) => setDepartmentFilter(v)}
            />
            <Field
              label="Company %"
              value={config.companyPercent}
              type="number"
              onChange={(v) => setConfig((c) => ({ ...c, companyPercent: Number(v) }))}
            />
            <Field label="Remarks" value={config.remarks} onChange={(v) => setConfig((c) => ({ ...c, remarks: String(v) }))} />
            <div className="flex items-end gap-2">
              <button
                onClick={saveConfig}
                disabled={savingConfig}
                className="rounded-lg px-3 py-2 text-sm font-medium text-white disabled:opacity-50"
                style={{ backgroundColor: 'var(--accent)' }}
              >
                {savingConfig ? 'Saving...' : 'Save'}
              </button>
              <button
                onClick={bulkApplyCompany}
                disabled={loading}
                className="rounded-lg px-3 py-2 text-sm font-medium text-white disabled:opacity-50"
                style={{ backgroundColor: '#0f766e' }}
              >
                {loading ? 'Applying...' : 'Apply'}
              </button>
            </div>
          </div>
        </section>
      )}

      {/* Individual Incentive */}
      <section className="rounded-xl border p-3" style={{ borderColor: 'var(--border)', backgroundColor: 'var(--surface)' }}>
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="text-sm font-semibold" style={{ color: 'var(--foreground)' }}>
              Individual Incentive — Employee Level
            </h2>
            {access.isReportingManager && !access.canApprove && (
              <>
                <select
                  value={configYearMonth.year}
                  onChange={(e) => setYearMonth(Number(e.target.value), configYearMonth.month)}
                  className="rounded-lg border px-2 py-1.5 text-sm"
                  style={{ backgroundColor: 'var(--surface)', color: 'var(--foreground)', borderColor: 'var(--border)' }}
                >
                  {yearOptions.map((o) => (
                    <option key={o.value} value={o.value}>{o.label}</option>
                  ))}
                </select>
                <select
                  value={configYearMonth.month}
                  onChange={(e) => setYearMonth(configYearMonth.year, Number(e.target.value))}
                  className="rounded-lg border px-2 py-1.5 text-sm"
                  style={{ backgroundColor: 'var(--surface)', color: 'var(--foreground)', borderColor: 'var(--border)' }}
                >
                  {MONTH_OPTIONS.map((o) => (
                    <option key={o.value} value={o.value}>{o.label}</option>
                  ))}
                </select>
              </>
            )}
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search..."
              className="w-36 rounded-lg border px-2 py-1.5 text-sm"
              style={{ backgroundColor: 'var(--surface)', color: 'var(--foreground)', borderColor: 'var(--border)' }}
            />
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="rounded-lg border px-2 py-1.5 text-sm"
              style={{ backgroundColor: 'var(--surface)', color: 'var(--foreground)', borderColor: 'var(--border)' }}
            >
              <option value="">All Statuses</option>
              <option value="draft">Draft</option>
              <option value="process">Process</option>
              <option value="hold">Hold</option>
              <option value="complete">Complete</option>
            </select>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <button
            onClick={() => { setImportOpen(true); setImportRows([]); setChosenFile(null); setImportFileError(null); }}
            className="rounded-lg border px-3 py-1.5 text-sm font-medium"
            style={{ borderColor: 'var(--border)', color: 'var(--foreground)' }}
          >
            Import
          </button>
          {access.canApprove && (
            <>
              <button
                onClick={() => bulkAction('hold')}
                disabled={bulkBusy || selectedIds.size === 0}
                className="rounded-lg border px-3 py-1.5 text-sm font-medium disabled:opacity-40"
                style={{ borderColor: '#b45309', color: '#b45309' }}
              >
                {bulkBusy ? 'Working…' : `Hold${selectedIds.size ? ` (${selectedIds.size})` : ''}`}
              </button>
              <button
                onClick={() => bulkAction('approve')}
                disabled={bulkBusy || selectedIds.size === 0}
                className="rounded-lg px-3 py-1.5 text-sm font-medium text-white disabled:opacity-40"
                style={{ backgroundColor: '#166534' }}
              >
                {bulkBusy ? 'Working…' : `Complete${selectedIds.size ? ` (${selectedIds.size})` : ''}`}
              </button>
            </>
          )}
          <button
            onClick={openAdd}
            disabled={bulkBusy}
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
                    onChange={toggleSelectAll}
                    aria-label="Select all"
                  />
                </th>
                <th className="px-3 py-2 text-left font-medium" style={{ color: 'var(--foreground-muted)' }}>S.No</th>
                <th className="px-3 py-2 text-left font-medium" style={{ color: 'var(--foreground-muted)' }}>Emp Code</th>
                <th className="px-3 py-2 text-left font-medium" style={{ color: 'var(--foreground-muted)' }}>Employee</th>
                <th className="px-3 py-2 text-left font-medium" style={{ color: 'var(--foreground-muted)' }}>Dept</th>
                <th className="px-3 py-2 text-left font-medium" style={{ color: 'var(--foreground-muted)' }}>Designation</th>
                <th className="px-3 py-2 text-left font-medium" style={{ color: 'var(--foreground-muted)' }}>Manager</th>
                <th className="px-3 py-2 text-right font-medium" style={{ color: 'var(--foreground-muted)' }}>Year</th>
                <th className="px-3 py-2 text-right font-medium" style={{ color: 'var(--foreground-muted)' }}>Month</th>
                <th className="px-3 py-2 text-right font-medium" style={{ color: 'var(--foreground-muted)' }}>Company %</th>
                <th className="px-3 py-2 text-right font-medium" style={{ color: 'var(--foreground-muted)' }}>Individual %</th>
                <th className="px-3 py-2 text-right font-medium" style={{ color: 'var(--foreground-muted)' }}>PMS %</th>
                <th className="px-3 py-2 text-left font-medium" style={{ color: 'var(--foreground-muted)' }}>Status</th>
                <th className="px-3 py-2 text-left font-medium" style={{ color: 'var(--foreground-muted)' }}>File</th>
                <th className="px-3 py-2 text-left font-medium" style={{ color: 'var(--foreground-muted)' }}>Remarks</th>
                <th className="px-3 py-2 text-left font-medium" style={{ color: 'var(--foreground-muted)' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={16} className="px-3 py-8 text-center" style={{ color: 'var(--foreground-muted)' }}>
                    Loading...
                  </td>
                </tr>
              ) : records.length === 0 ? (
                <tr>
                  <td colSpan={16} className="px-3 py-8 text-center" style={{ color: 'var(--foreground-muted)' }}>
                    No records found. Use Add to create one.
                  </td>
                </tr>
              ) : (
                records.map((row, idx) => (
                  <tr key={row.recordId} style={{ borderTop: '1px solid var(--border)' }}>
                    <td className="px-3 py-2">
                      <input
                        type="checkbox"
                        checked={selectedIds.has(row.employeeId)}
                        onChange={() => toggleSelect(row.employeeId)}
                        aria-label={`Select ${row.employeeCode}`}
                      />
                    </td>
                    <td className="px-3 py-2" style={{ color: 'var(--foreground)' }}>{idx + 1}</td>
                    <td className="px-3 py-2" style={{ color: 'var(--foreground)' }}>{row.employeeCode}</td>
                    <td className="px-3 py-2 font-medium" style={{ color: 'var(--foreground)' }}>{row.employeeName}</td>
                    <td className="px-3 py-2" style={{ color: 'var(--foreground)' }}>{row.department?.name ?? '—'}</td>
                    <td className="px-3 py-2" style={{ color: 'var(--foreground)' }}>{row.designation?.name ?? '—'}</td>
                    <td className="px-3 py-2" style={{ color: 'var(--foreground)' }}>
                      {row.reportingManager ? `${row.reportingManager.firstName} ${row.reportingManager.lastName}` : '—'}
                    </td>
                    <td className="px-3 py-2 text-right" style={{ color: 'var(--foreground)' }}>{row.year}</td>
                    <td className="px-3 py-2 text-right" style={{ color: 'var(--foreground)' }}>{MONTH_OPTIONS.find((m) => m.value === row.month)?.label ?? row.month}</td>
                    <td className="px-3 py-2 text-right" style={{ color: 'var(--foreground)' }}>{row.companyPercent.toFixed(2)}%</td>
                    <td className="px-3 py-2 text-right" style={{ color: 'var(--foreground)' }}>{row.individualPercent.toFixed(2)}%</td>
                    <td className="px-3 py-2 text-right font-medium" style={{ color: 'var(--foreground)' }}>{row.totalPercent.toFixed(2)}%</td>
                    <td className="px-3 py-2">
                      <StatusBadge status={row.status} />
                    </td>
                    <td className="px-3 py-2">
                      {row.supportingFileName ? (
                        <a href={row.supportingFilePath ?? '#'} target="_blank" rel="noopener noreferrer" className="text-xs hover:underline" style={{ color: 'var(--accent)' }}>
                          {row.supportingFileName}
                        </a>
                      ) : (
                        <input
                          type="file"
                          disabled={!canEditRow(row)}
                          onChange={(e) => {
                            const file = e.target.files?.[0];
                            if (file) uploadFile(row, file);
                          }}
                          className="w-28 text-xs"
                        />
                      )}
                    </td>
                    <td className="px-3 py-2" style={{ color: 'var(--foreground)' }}>{row.remarks ?? ''}</td>
                    <td className="px-3 py-2">
                      <div className="flex items-center gap-1.5">
                        <button
                          onClick={() => openEdit(row)}
                          disabled={bulkBusy || !canEditRow(row)}
                          className="rounded-lg border px-2.5 py-1 text-xs font-medium disabled:opacity-40"
                          style={{ borderColor: 'var(--border)', color: 'var(--foreground)' }}
                        >
                          Edit
                        </button>
                        <button
                          onClick={() => deleteRecord(row)}
                          disabled={bulkBusy || !canEditRow(row)}
                          className="rounded-lg border px-2.5 py-1 text-xs font-medium disabled:opacity-40"
                          style={{ borderColor: '#dc2626', color: '#dc2626' }}
                        >
                          Delete
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

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
                {editingRow ? 'Edit' : 'Add'} Performance Incentive
              </h2>
              <button onClick={() => setModalOpen(false)} className="text-xl leading-none" style={{ color: 'var(--foreground-muted)' }}>
                ×
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-4 space-y-4">
              <div>
                <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide" style={{ color: 'var(--foreground-muted)' }}>
                  Employee Details
                </h3>
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <ModalField label="Employee Name">
                    <select
                      value={modalEmployeeId}
                      disabled={editingRow !== null}
                      onChange={(e) => setModalEmployeeId(e.target.value === '' ? '' : Number(e.target.value))}
                      className="w-full rounded-lg border px-3 py-2 text-sm"
                      style={{ backgroundColor: 'var(--surface)', color: 'var(--foreground)', borderColor: 'var(--border)' }}
                    >
                      <option value="">Select Employee</option>
                      {(editingRow ? filteredRows : filteredRows.filter((r) => r.recordId === null)).map((e) => (
                        <option key={e.employeeId} value={e.employeeId}>
                          {e.employeeCode} — {e.employeeName}
                        </option>
                      ))}
                    </select>
                    {!editingRow && filteredRows.filter((r) => r.recordId === null).length === 0 && (
                      <p className="mt-1 text-xs" style={{ color: 'var(--foreground-muted)' }}>
                        All employees already have a record for this period.
                      </p>
                    )}
                  </ModalField>
                  <ModalField label="Employee Code">
                    <input value={modalRow?.employeeCode ?? ''} disabled className="w-full rounded-lg border px-3 py-2 text-sm opacity-70" style={{ backgroundColor: 'var(--surface)', color: 'var(--foreground)', borderColor: 'var(--border)' }} />
                  </ModalField>
                  <ModalField label="Department">
                    <input value={modalRow?.department?.name ?? ''} disabled className="w-full rounded-lg border px-3 py-2 text-sm opacity-70" style={{ backgroundColor: 'var(--surface)', color: 'var(--foreground)', borderColor: 'var(--border)' }} />
                  </ModalField>
                  <ModalField label="Designation">
                    <input value={modalRow?.designation?.name ?? ''} disabled className="w-full rounded-lg border px-3 py-2 text-sm opacity-70" style={{ backgroundColor: 'var(--surface)', color: 'var(--foreground)', borderColor: 'var(--border)' }} />
                  </ModalField>
                  <ModalField label="Year">
                    <select
                      value={modalYear}
                      onChange={(e) => setModalYear(Number(e.target.value))}
                      className="w-full rounded-lg border px-3 py-2 text-sm disabled:opacity-70"
                      style={{ backgroundColor: 'var(--surface)', color: 'var(--foreground)', borderColor: 'var(--border)' }}
                    >
                      {yearOptions.map((o) => (
                        <option key={o.value} value={o.value}>{o.label}</option>
                      ))}
                    </select>
                  </ModalField>
                  <ModalField label="Month">
                    <select
                      value={modalMonth}
                      onChange={(e) => setModalMonth(Number(e.target.value))}
                      className="w-full rounded-lg border px-3 py-2 text-sm disabled:opacity-70"
                      style={{ backgroundColor: 'var(--surface)', color: 'var(--foreground)', borderColor: 'var(--border)' }}
                    >
                      {MONTH_OPTIONS.map((o) => (
                        <option key={o.value} value={o.value}>{o.label}</option>
                      ))}
                    </select>
                  </ModalField>
                </div>
              </div>

              <div>
                <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide" style={{ color: 'var(--foreground-muted)' }}>
                  Incentive Details
                </h3>
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  {access.canApprove && (
                    <ModalField label="Company %">
                      <input
                        type="number"
                        step="0.01"
                        min={0}
                        max={50}
                        value={modalForm.companyPercent ?? ''}
                        onChange={(e) => setModalForm((f) => ({ ...f, companyPercent: e.target.value === '' ? '' : Number(e.target.value) }))}
                        className="w-full rounded-lg border px-3 py-2 text-sm"
                        style={{ backgroundColor: 'var(--surface)', color: 'var(--foreground)', borderColor: 'var(--border)' }}
                      />
                    </ModalField>
                  )}
                  {(modalRow?.incentiveType ?? 'percentage') !== 'fixed' ? (
                    <ModalField label="Individual %">
                      <input
                        type="number"
                        step="0.01"
                        min={0}
                        max={50}
                        value={modalForm.individualPercent ?? ''}
                        onChange={(e) => setModalForm((f) => ({ ...f, individualPercent: e.target.value === '' ? '' : Number(e.target.value) }))}
                        className="w-full rounded-lg border px-3 py-2 text-sm"
                        style={{ backgroundColor: 'var(--surface)', color: 'var(--foreground)', borderColor: 'var(--border)' }}
                      />
                    </ModalField>
                  ) : (
                    <ModalField label="Individual Value (₹)">
                      <input
                        type="number"
                        step="0.01"
                        min={0}
                        value={modalForm.individualValue ?? ''}
                        onChange={(e) => setModalForm((f) => ({ ...f, individualValue: e.target.value === '' ? null : Number(e.target.value) }))}
                        className="w-full rounded-lg border px-3 py-2 text-sm"
                        style={{ backgroundColor: 'var(--surface)', color: 'var(--foreground)', borderColor: 'var(--border)' }}
                      />
                    </ModalField>
                  )}
                  <ModalField label="Remarks">
                    <input
                      value={modalForm.remarks ?? ''}
                      onChange={(e) => setModalForm((f) => ({ ...f, remarks: e.target.value }))}
                      className="w-full rounded-lg border px-3 py-2 text-sm"
                      style={{ backgroundColor: 'var(--surface)', color: 'var(--foreground)', borderColor: 'var(--border)' }}
                    />
                  </ModalField>
                </div>
              </div>

              {modalError && (
                <div className="rounded-lg px-3 py-2 text-sm" style={{ backgroundColor: '#fef2f2', color: '#dc2626' }}>
                  {modalError}
                </div>
              )}
            </div>

            <div className="flex items-center justify-end gap-2 border-t px-4 py-3" style={{ borderColor: 'var(--border)' }}>
              <button
                type="button"
                onClick={() => {
                  setModalForm({});
                  setModalEmployeeId('');
                  setModalError(null);
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

      {/* Import Modal */}
      {importOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          style={{ backgroundColor: 'rgba(0,0,0,0.4)' }}
          onClick={() => setImportOpen(false)}
        >
          <div
            className="flex max-h-[90vh] w-full max-w-4xl flex-col overflow-hidden rounded-xl border shadow-2xl"
            style={{ backgroundColor: 'var(--surface)', borderColor: 'var(--border)' }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b px-4 py-3" style={{ borderColor: 'var(--border)' }}>
              <div>
                <h2 className="text-sm font-semibold" style={{ color: 'var(--foreground)' }}>
                  Import PMS Incentive
                </h2>
                <p className="text-xs" style={{ color: 'var(--foreground-muted)' }}>
                  {monthName(configYearMonth.month)} {configYearMonth.year} — {access.canApprove ? 'all employees' : 'your team'} — fill the Individual % column in the template.
                </p>
              </div>
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
                  setChosenFile(e.target.files?.[0] ?? null);
                  setImportRows([]);
                  setImportFileError(null);
                  e.target.value = '';
                }}
              />
              <button
                type="button"
                onClick={handleImportFile}
                disabled={parsingImport}
                className="rounded-lg px-3 py-1.5 text-sm font-medium text-white disabled:opacity-50"
                style={{ backgroundColor: 'var(--accent)' }}
              >
                {parsingImport ? 'Reading…' : 'Upload'}
              </button>
              <button
                type="button"
                onClick={downloadPmsTemplate}
                disabled={filteredRows.length === 0}
                className="rounded-lg border px-3 py-1.5 text-sm font-medium disabled:opacity-50"
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

            {importFileError && (
              <div className="mx-4 mt-3 rounded-lg px-3 py-2 text-sm" style={{ backgroundColor: '#fef2f2', color: '#dc2626' }}>
                {importFileError}
              </div>
            )}

            <div className="min-h-[240px] flex-1 overflow-auto p-4">
              {importRows.length === 0 ? (
                <div className="py-10 text-center text-sm" style={{ color: 'var(--foreground-muted)' }}>
                  No records found. Choose a filled template and click Upload.
                </div>
              ) : (
                <>
                  <div className="mb-2 text-sm" style={{ color: 'var(--foreground-muted)' }}>
                    {importRows.length} row(s) — {importRows.filter((r) => r.status === 'ready').length} ready
                    {importRows.some((r) => r.status === 'applied') ? `, ${importRows.filter((r) => r.status === 'applied').length} imported` : ''}
                    {importRows.some((r) => r.status === 'failed') ? `, ${importRows.filter((r) => r.status === 'failed').length} failed` : ''}
                  </div>
                  <table className="min-w-full text-sm">
                    <thead>
                      <tr style={{ backgroundColor: 'var(--surface-hover)' }}>
                        <th className="px-3 py-2 text-left font-medium" style={{ color: 'var(--foreground-muted)' }}>Row</th>
                        <th className="px-3 py-2 text-left font-medium" style={{ color: 'var(--foreground-muted)' }}>Employee</th>
                        <th className="px-3 py-2 text-right font-medium" style={{ color: 'var(--foreground-muted)' }}>Company %</th>
                        <th className="px-3 py-2 text-right font-medium" style={{ color: 'var(--foreground-muted)' }}>Individual %</th>
                        <th className="px-3 py-2 text-left font-medium" style={{ color: 'var(--foreground-muted)' }}>Remarks</th>
                        <th className="px-3 py-2 text-left font-medium" style={{ color: 'var(--foreground-muted)' }}>Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {importRows.map((r) => (
                        <tr key={r.row} style={{ borderTop: '1px solid var(--border)' }}>
                          <td className="px-3 py-2" style={{ color: 'var(--foreground)' }}>{r.row}</td>
                          <td className="px-3 py-2" style={{ color: 'var(--foreground)' }}>
                            {r.employeeCode}
                            {r.employeeName ? <span className="text-xs" style={{ color: 'var(--foreground-muted)' }}> — {r.employeeName}</span> : null}
                          </td>
                          <td className="px-3 py-2 text-right" style={{ color: 'var(--foreground)' }}>{r.companyPercent ?? '—'}</td>
                          <td className="px-3 py-2 text-right" style={{ color: 'var(--foreground)' }}>{r.individualPercent ?? '—'}</td>
                          <td className="px-3 py-2" style={{ color: 'var(--foreground)' }}>{r.remarks ?? ''}</td>
                          <td className="px-3 py-2">
                            {r.status === 'failed' ? (
                              <span className="text-xs font-medium" style={{ color: '#dc2626' }}>{r.error ?? 'Failed'}</span>
                            ) : (
                              <span
                                className="rounded-full px-2 py-0.5 text-xs font-medium"
                                style={{
                                  backgroundColor: r.status === 'applied' ? '#dcfce7' : r.status === 'applying' ? '#fef9c3' : '#f3f4f6',
                                  color: r.status === 'applied' ? '#166534' : r.status === 'applying' ? '#854d0e' : '#4b5563',
                                }}
                              >
                                {r.status === 'applied' ? 'Imported' : r.status === 'applying' ? 'Applying…' : 'ready'}
                              </span>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </>
              )}
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
                onClick={runImport}
                disabled={importing || importRows.every((r) => r.status !== 'ready')}
                className="rounded-lg px-4 py-1.5 text-sm font-medium text-white disabled:opacity-50"
                style={{ backgroundColor: 'var(--accent)' }}
              >
                {importing ? 'Importing…' : 'Confirm'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Duplicate entries popup — import rows skipped because the employee
          already has a record for this period (or appears twice in the file) */}
      {duplicatePopup && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          style={{ backgroundColor: 'rgba(0,0,0,0.4)' }}
          onClick={() => setDuplicatePopup(null)}
        >
          <div
            className="w-full max-w-md rounded-xl border p-5"
            style={{ backgroundColor: 'var(--surface)', borderColor: 'var(--border)' }}
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="text-sm font-semibold" style={{ color: 'var(--foreground)' }}>
              Duplicate entries skipped ({duplicatePopup.length})
            </h3>
            <p className="mt-1 text-xs" style={{ color: 'var(--foreground-muted)' }}>
              Same employee, year and month cannot be imported twice.
            </p>
            <div className="mt-3 max-h-64 overflow-y-auto">
              {duplicatePopup.map((d, i) => (
                <div key={i} className="border-b py-2 text-sm last:border-b-0" style={{ borderColor: 'var(--border)' }}>
                  <span className="font-medium" style={{ color: 'var(--foreground)' }}>{d.code}</span>
                  {d.name && <span style={{ color: 'var(--foreground)' }}> — {d.name}</span>}
                  <div className="text-xs" style={{ color: 'var(--foreground-muted)' }}>{d.reason}</div>
                </div>
              ))}
            </div>
            <div className="mt-4 flex justify-end">
              <button
                onClick={() => setDuplicatePopup(null)}
                className="rounded-lg px-4 py-1.5 text-sm font-medium text-white"
                style={{ backgroundColor: 'var(--accent)' }}
              >
                OK
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function Field({
  label,
  value,
  onChange,
  disabled = false,
  type = 'text',
  help,
}: {
  label: string;
  value: string | number;
  onChange: (v: string | number) => void;
  disabled?: boolean;
  type?: 'text' | 'number' | 'date';
  help?: string;
}) {
  return (
    <div className="flex flex-col gap-1">
      <label className="text-sm font-medium" style={{ color: 'var(--foreground)' }}>
        {label}
      </label>
      <input
        type={type}
        value={value}
        disabled={disabled}
        onChange={(e) => onChange(type === 'number' ? (e.target.value === '' ? '' : Number(e.target.value)) : e.target.value)}
        className="w-full rounded-lg border px-3 py-2 text-sm"
        style={{
          backgroundColor: disabled ? 'var(--surface-muted)' : 'var(--surface)',
          color: 'var(--foreground)',
          borderColor: 'var(--border)',
          opacity: disabled ? 0.7 : 1,
        }}
      />
      {help && <span className="text-xs" style={{ color: 'var(--foreground-muted)' }}>{help}</span>}
    </div>
  );
}

function Select({
  label,
  value,
  options,
  onChange,
  disabled = false,
}: {
  label: string;
  value: string | number;
  options: { value: string | number; label: string }[];
  onChange: (v: string | number) => void;
  disabled?: boolean;
}) {
  return (
    <div className="flex flex-col gap-1">
      <label className="text-sm font-medium" style={{ color: 'var(--foreground)' }}>
        {label}
      </label>
      <select
        value={value}
        disabled={disabled}
        onChange={(e) => onChange(e.target.value)}
        className="w-full rounded-lg border px-3 py-2 text-sm"
        style={{
          backgroundColor: disabled ? 'var(--surface-muted)' : 'var(--surface)',
          color: 'var(--foreground)',
          borderColor: 'var(--border)',
          opacity: disabled ? 0.7 : 1,
        }}
      >
        {options.map((o) => (
          <option key={String(o.value)} value={o.value}>{o.label}</option>
        ))}
      </select>
    </div>
  );
}

// Display the same bucket labels the status filter uses: a filled record
// (submitted / under_review / returned / pending_hr) reads as "process",
// rejected reads as "hold", approved/finalized as "complete".
const STATUS_BUCKET: Record<string, string> = {
  draft: 'draft',
  submitted: 'process',
  under_review: 'process',
  returned: 'process',
  pending_hr: 'process',
  rejected: 'hold',
  approved: 'complete',
  finalized: 'complete',
};

const BUCKET_COLORS: Record<string, { bg: string; fg: string }> = {
  draft: STATUS_COLORS.draft,
  process: STATUS_COLORS.submitted,
  hold: STATUS_COLORS.rejected,
  complete: STATUS_COLORS.approved,
};

function StatusBadge({ status }: { status: string }) {
  const bucket = STATUS_BUCKET[status] ?? status;
  const colors = BUCKET_COLORS[bucket] ?? BUCKET_COLORS.draft;
  return (
    <span
      className="rounded-full px-2 py-0.5 text-xs font-medium"
      style={{ backgroundColor: colors.bg, color: colors.fg }}
    >
      {bucket}
    </span>
  );
}

function ModalField({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex flex-col gap-1">
      <label className="text-sm font-medium" style={{ color: 'var(--foreground)' }}>
        {label}
      </label>
      {children}
    </div>
  );
}


