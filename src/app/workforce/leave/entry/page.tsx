/**
 * Leave Entry — apply for leave on behalf of an employee (BRD §10).
 * numberOfDays is computed client-side from fromDate/toDate (or 0.5 for a
 * half day) before submitting.
 *
 * Also hosts Bulk Upload: download a template, upload it, review a dry-run
 * validation report, then import. The dry run writes nothing, which matters
 * here because back-dated rows import as approved and move the balance
 * ledger — see the bulk-upload route for the status rule.
 */

'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import * as XLSX from 'xlsx';
import { DataTable, FormModal, useToast, type Column, type FieldDef } from '@/components/ui';
import { buildLeaveTemplateWorkbook } from '@/lib/leave-bulk-import';

interface BulkRowResult {
  row: number;
  employeeCode: string;
  employeeName: string | null;
  leaveTypeCode: string;
  fromDate: string | null;
  toDate: string | null;
  numberOfDays: number | null;
  plannedStatus: 'approved' | 'pending_manager' | null;
  status: 'ok' | 'error';
  errors: string[];
  warnings: string[];
  applicationId?: number;
}

interface BulkSummary {
  total: number;
  ok: number;
  errors: number;
  toApprove: number;
  toPending: number;
  blankRowsSkipped: number;
  imported?: number;
  failedDuringImport?: number;
}

interface BulkResponse {
  mode: 'validate' | 'import';
  summary: BulkSummary;
  rows: BulkRowResult[];
}

interface EmployeeOption {
  id: number;
  employeeCode: string;
  oldEmployeeCode: string | null;
  firstName: string;
  lastName: string;
}
interface LeaveMasterOption {
  id: number;
  code: string;
  name: string;
}
interface LeaveApplicationRow {
  id: number;
  fromDate: string;
  toDate: string;
  numberOfDays: string;
  isHalfDay: boolean;
  reason: string | null;
  status: string;
  employee: { oldEmployeeCode: string | null; firstName: string; lastName: string };
  leaveMaster: { code: string; name: string };
}

export default function LeaveEntryPage() {
  const toast = useToast();
  const [records, setRecords] = useState<LeaveApplicationRow[]>([]);
  const [employees, setEmployees] = useState<EmployeeOption[]>([]);
  const [leaveMasters, setLeaveMasters] = useState<LeaveMasterOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);

  // Bulk upload
  const [bulkOpen, setBulkOpen] = useState(false);
  const [bulkFile, setBulkFile] = useState<File | null>(null);
  const [bulkBusy, setBulkBusy] = useState<'validate' | 'import' | null>(null);
  const [bulkResult, setBulkResult] = useState<BulkResponse | null>(null);
  const [bulkError, setBulkError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    fetch('/api/employees?limit=200')
      .then((r) => r.json())
      .then((json: { data: EmployeeOption[] }) => setEmployees(json.data ?? []))
      .catch(() => {});
    fetch('/api/masters/leave-masters?limit=100')
      .then((r) => r.json())
      .then((json: { data: LeaveMasterOption[] }) => setLeaveMasters(json.data ?? []))
      .catch(() => {});
  }, []);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/workforce/leave/applications');
      if (!res.ok) throw new Error('Failed to fetch');
      const json: { data: LeaveApplicationRow[] } = await res.json();
      setRecords(json.data);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const fields: FieldDef[] = [
    { name: 'employeeId', label: 'Employee', type: 'select', required: true, options: employees.map((e) => ({ label: e.oldEmployeeCode ? `${e.oldEmployeeCode} — ${e.firstName} ${e.lastName}` : `${e.firstName} ${e.lastName}`, value: e.id })) },
    { name: 'leaveMasterId', label: 'Leave Type', type: 'select', required: true, options: leaveMasters.map((l) => ({ label: `${l.name} (${l.code})`, value: l.id })) },
    { name: 'fromDate', label: 'From Date', type: 'date', required: true },
    { name: 'toDate', label: 'To Date', type: 'date', required: true, showIf: (v) => !v.isHalfDay },
    { name: 'isHalfDay', label: 'Half Day', type: 'checkbox' },
    { name: 'reason', label: 'Reason', type: 'textarea' },
  ];

  const handleSubmit = async (values: Record<string, string | number | boolean>) => {
    const fromDate = String(values.fromDate);
    const isHalfDay = Boolean(values.isHalfDay);
    // A half day is one date; the working-day count is computed on the server.
    const toDate = isHalfDay ? fromDate : String(values.toDate);

    const res = await fetch('/api/workforce/leave/applications', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        employeeId: Number(values.employeeId),
        leaveMasterId: Number(values.leaveMasterId),
        fromDate,
        toDate,
        isHalfDay,
        reason: values.reason || null,
      }),
    });
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error ?? 'Save failed');
    }
    const created = await res.json();
    if (created?.plan) {
      const skipped = created.plan.skippedDates?.length ?? 0;
      toast.success(`Applied for ${created.plan.count} working day(s)${skipped ? ` — ${skipped} weekly off/holiday skipped` : ''}.`);
    }
    fetchData();
  };

  const downloadTemplate = () => {
    const wb = buildLeaveTemplateWorkbook(
      leaveMasters.map((l) => ({ id: l.id, code: l.code, name: l.name })),
      employees.map((e) => ({ id: e.id, employeeCode: e.employeeCode, oldEmployeeCode: e.oldEmployeeCode, firstName: e.firstName, lastName: e.lastName }))
    );
    XLSX.writeFile(wb, 'leave-bulk-upload-template.xlsx');
  };

  const resetBulk = () => {
    setBulkFile(null);
    setBulkResult(null);
    setBulkError(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const runBulk = async (mode: 'validate' | 'import') => {
    if (!bulkFile) return;
    setBulkBusy(mode);
    setBulkError(null);
    try {
      const body = new FormData();
      body.append('file', bulkFile);
      body.append('mode', mode);
      const res = await fetch('/api/workforce/leave/bulk-upload', { method: 'POST', body });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json.error ?? 'Upload failed');
      setBulkResult(json as BulkResponse);
      if (mode === 'import') {
        const s = (json as BulkResponse).summary;
        toast.success(`Imported ${s.imported ?? 0} of ${s.total} row(s)`);
        fetchData();
      }
    } catch (err) {
      setBulkError(err instanceof Error ? err.message : 'Upload failed');
    } finally {
      setBulkBusy(null);
    }
  };

  // Only offer Import once a dry run has actually passed something — the
  // button should never be the first thing that touches the database.
  const canImport =
    bulkResult?.mode === 'validate' && bulkResult.summary.ok > 0 && bulkBusy === null;

  const columns: Column<LeaveApplicationRow>[] = [
    { key: 'employee', label: 'Employee', render: (r) => r.employee.oldEmployeeCode ? `${r.employee.oldEmployeeCode} — ${r.employee.firstName} ${r.employee.lastName}` : `${r.employee.firstName} ${r.employee.lastName}` },
    { key: 'leaveMaster', label: 'Leave Type', render: (r) => r.leaveMaster.name },
    { key: 'fromDate', label: 'From', render: (r) => new Date(r.fromDate).toLocaleDateString() },
    { key: 'toDate', label: 'To', render: (r) => new Date(r.toDate).toLocaleDateString() },
    { key: 'numberOfDays', label: 'Days' },
    {
      key: 'status',
      label: 'Status',
      render: (r) => (
        <span
          className="rounded-full px-2 py-0.5 text-xs font-medium"
          style={{
            backgroundColor: r.status === 'approved' ? '#dcfce7' : r.status === 'rejected' ? '#fee2e2' : r.status === 'cancelled' ? '#f3f4f6' : '#fef9c3',
            color: r.status === 'approved' ? '#166534' : r.status === 'rejected' ? '#991b1b' : r.status === 'cancelled' ? '#4b5563' : '#854d0e',
          }}
        >
          {r.status}
        </span>
      ),
    },
  ];

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold" style={{ color: 'var(--foreground)' }}>
          Leave Entry
        </h1>
        <div className="flex items-center gap-2">
          <button
            onClick={() => { setBulkOpen((v) => !v); }}
            className="rounded-lg border px-4 py-2 text-sm font-medium transition hover:opacity-90"
            style={{ borderColor: 'var(--accent)', color: 'var(--accent)' }}
          >
            {bulkOpen ? 'Hide Bulk Upload' : 'Bulk Upload'}
          </button>
          <button
            onClick={() => setModalOpen(true)}
            className="rounded-lg px-4 py-2 text-sm font-medium text-white transition hover:opacity-90"
            style={{ backgroundColor: 'var(--accent)' }}
          >
            + Apply for Leave
          </button>
        </div>
      </div>

      {bulkOpen && (
        <section className="space-y-4 rounded-xl border p-4" style={{ borderColor: 'var(--border)', backgroundColor: 'var(--surface)' }}>
          <div>
            <h2 className="text-sm font-semibold" style={{ color: 'var(--foreground)' }}>Bulk Upload</h2>
            <p className="mt-1 text-xs" style={{ color: 'var(--foreground-muted)' }}>
              Leave starting before this month is imported as <strong>approved</strong> — it deducts the balance and marks
              those days as Leave in attendance. Leave from this month onward is imported as <strong>pending</strong> and
              goes through Manager then HR approval. Validate first; nothing is written until you import.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={downloadTemplate}
              className="rounded-lg border px-3 py-1.5 text-sm font-medium"
              style={{ borderColor: 'var(--border)', color: 'var(--foreground)' }}
            >
              Download Template
            </button>
            <input
              ref={fileInputRef}
              type="file"
              accept=".xlsx,.xls,.csv"
              onChange={(e) => { setBulkFile(e.target.files?.[0] ?? null); setBulkResult(null); setBulkError(null); }}
              className="text-sm"
              style={{ color: 'var(--foreground)' }}
            />
            <button
              onClick={() => runBulk('validate')}
              disabled={!bulkFile || bulkBusy !== null}
              className="rounded-lg px-3 py-1.5 text-sm font-semibold text-white disabled:opacity-40"
              style={{ backgroundColor: 'var(--primary)' }}
            >
              {bulkBusy === 'validate' ? 'Validating…' : 'Validate'}
            </button>
            <button
              onClick={() => runBulk('import')}
              disabled={!canImport}
              className="rounded-lg px-3 py-1.5 text-sm font-semibold text-white disabled:opacity-40"
              style={{ backgroundColor: 'var(--accent)' }}
            >
              {bulkBusy === 'import' ? 'Importing…' : `Import${bulkResult?.mode === 'validate' ? ` ${bulkResult.summary.ok}` : ''}`}
            </button>
            {(bulkFile || bulkResult) && (
              <button onClick={resetBulk} className="rounded-lg border px-3 py-1.5 text-sm font-medium" style={{ borderColor: 'var(--border)', color: 'var(--foreground-muted)' }}>
                Clear
              </button>
            )}
          </div>

          {bulkError && (
            <div className="rounded-lg border px-3 py-2 text-sm" style={{ borderColor: '#fecaca', backgroundColor: '#fef2f2', color: '#991b1b' }}>
              {bulkError}
            </div>
          )}

          {bulkResult && (
            <div className="space-y-3">
              <div className="flex flex-wrap gap-4 text-sm" style={{ color: 'var(--foreground)' }}>
                <span>Rows: <strong>{bulkResult.summary.total}</strong></span>
                <span style={{ color: '#166534' }}>Ready: <strong>{bulkResult.summary.ok}</strong></span>
                <span style={{ color: '#991b1b' }}>Errors: <strong>{bulkResult.summary.errors}</strong></span>
                <span>Will approve: <strong>{bulkResult.summary.toApprove}</strong></span>
                <span>Will stay pending: <strong>{bulkResult.summary.toPending}</strong></span>
                {bulkResult.summary.imported !== undefined && (
                  <span style={{ color: '#166534' }}>Imported: <strong>{bulkResult.summary.imported}</strong></span>
                )}
              </div>

              <div className="overflow-x-auto rounded-lg border" style={{ borderColor: 'var(--border)' }}>
                <table className="w-full text-xs">
                  <thead>
                    <tr style={{ backgroundColor: 'var(--surface-muted, rgba(0,0,0,0.03))' }}>
                      {['Row', 'Employee', 'Type', 'From', 'To', 'Days', 'Will be', 'Status', 'Details'].map((h) => (
                        <th key={h} className="px-2 py-1.5 text-left font-semibold" style={{ color: 'var(--foreground-muted)' }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {/* Errors first — the whole point of the review step is fixing them. */}
                    {[...bulkResult.rows].sort((a, b) => (a.status === b.status ? a.row - b.row : a.status === 'error' ? -1 : 1)).map((r) => (
                      <tr key={r.row} className="border-t" style={{ borderColor: 'var(--border)' }}>
                        <td className="px-2 py-1.5" style={{ color: 'var(--foreground-muted)' }}>{r.row}</td>
                        <td className="px-2 py-1.5" style={{ color: 'var(--foreground)' }}>{r.employeeCode}{r.employeeName ? ` — ${r.employeeName}` : ''}</td>
                        <td className="px-2 py-1.5" style={{ color: 'var(--foreground)' }}>{r.leaveTypeCode}</td>
                        <td className="px-2 py-1.5" style={{ color: 'var(--foreground)' }}>{r.fromDate ?? '—'}</td>
                        <td className="px-2 py-1.5" style={{ color: 'var(--foreground)' }}>{r.toDate ?? '—'}</td>
                        <td className="px-2 py-1.5" style={{ color: 'var(--foreground)' }}>{r.numberOfDays ?? '—'}</td>
                        <td className="px-2 py-1.5" style={{ color: 'var(--foreground-muted)' }}>
                          {r.plannedStatus === 'approved' ? 'Approved' : r.plannedStatus === 'pending_manager' ? 'Pending' : '—'}
                        </td>
                        <td className="px-2 py-1.5">
                          <span className="rounded-full px-2 py-0.5 text-[11px] font-medium" style={{
                            backgroundColor: r.status === 'ok' ? '#dcfce7' : '#fee2e2',
                            color: r.status === 'ok' ? '#166534' : '#991b1b',
                          }}>
                            {r.status === 'ok' ? (r.applicationId ? 'imported' : 'ready') : 'error'}
                          </span>
                        </td>
                        <td className="px-2 py-1.5" style={{ color: r.errors.length ? '#991b1b' : '#854d0e' }}>
                          {[...r.errors, ...r.warnings].join('; ') || ''}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </section>
      )}

      <DataTable columns={columns} data={records} loading={loading} emptyMessage="No leave applications yet." />

      <FormModal
        title="Apply for Leave"
        fields={fields}
        initialValues={{ isHalfDay: false }}
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        onSubmit={handleSubmit}
        submitLabel="Apply"
      />
    </div>
  );
}
