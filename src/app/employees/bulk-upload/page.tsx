/**
 * Bulk Upload — download a fillable Excel template (name-based columns, plus
 * a Reference Lists sheet of valid Company/Department/... names), then
 * upload it back. Each row is resolved to an /api/employees payload
 * client-side (employee-bulk-import.ts) and POSTed one at a time, same as
 * the Add Employee wizard — so it shares that endpoint's validation,
 * employeeCode generation, and JobInfo creation instead of duplicating it.
 */

'use client';

import { useState, useMemo } from 'react';
import Link from 'next/link';
import * as XLSX from 'xlsx';
import { fetchAllMaster, fetchEmployeeRefs } from '@/lib/employee-form-fields';
import { buildTemplateWorkbook, parseWorkbookRows, type BulkImportMasters, type RowResult } from '@/lib/employee-bulk-import';

type RowStatus = RowResult & { status: 'pending' | 'creating' | 'created' | 'failed'; resultError?: string };

export default function BulkUploadEmployeesPage() {
  const [downloading, setDownloading] = useState(false);
  const [parsing, setParsing] = useState(false);
  const [rows, setRows] = useState<RowStatus[]>([]);
  const [importing, setImporting] = useState(false);
  const [fileError, setFileError] = useState<string | null>(null);

  const masters = useMemo(
    () => async (): Promise<BulkImportMasters> => {
      const [companies, units, departments, subDepartments, designations, employeeTypes, categories, grades, levels, reportingManagers] =
        await Promise.all([
          fetchAllMaster('companies'),
          fetchAllMaster('units'),
          fetchAllMaster('departments'),
          fetchAllMaster('sub-departments'),
          fetchAllMaster('designations'),
          fetchAllMaster('employee-types'),
          fetchAllMaster('categories'),
          fetchAllMaster('grades'),
          fetchAllMaster('levels'),
          fetchEmployeeRefs(),
        ]);
      return { companies, units, departments, subDepartments, designations, employeeTypes, categories, grades, levels, reportingManagers };
    },
    []
  );

  const downloadTemplate = async () => {
    setDownloading(true);
    try {
      const m = await masters();
      const wb = buildTemplateWorkbook(m);
      XLSX.writeFile(wb, 'employee-bulk-upload-template.xlsx');
    } finally {
      setDownloading(false);
    }
  };

  const handleFile = async (file: File) => {
    setFileError(null);
    setRows([]);
    setParsing(true);
    try {
      const m = await masters();
      const parsed = await parseWorkbookRows(file, m);
      if (parsed.length === 0) {
        setFileError('No rows found in the uploaded file.');
        return;
      }
      setRows(parsed.map((r) => ({ ...r, status: r.error ? 'failed' : 'pending', resultError: r.error })));
    } catch (err) {
      setFileError(err instanceof Error ? err.message : 'Failed to read the uploaded file');
    } finally {
      setParsing(false);
    }
  };

  const runImport = async () => {
    setImporting(true);
    try {
      for (let i = 0; i < rows.length; i++) {
        const r = rows[i];
        if (!r.payload) continue; // already flagged failed at parse time
        setRows((prev) => prev.map((row, idx) => (idx === i ? { ...row, status: 'creating' } : row)));
        try {
          const res = await fetch('/api/employees', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(r.payload),
          });
          const data = await res.json();
          if (!res.ok) throw new Error(data.error ?? 'Failed to create employee');
          setRows((prev) => prev.map((row, idx) => (idx === i ? { ...row, status: 'created' } : row)));
        } catch (err) {
          setRows((prev) =>
            prev.map((row, idx) =>
              idx === i ? { ...row, status: 'failed', resultError: err instanceof Error ? err.message : 'Failed' } : row
            )
          );
        }
      }
    } finally {
      setImporting(false);
    }
  };

  const importableCount = rows.filter((r) => r.payload).length;
  const createdCount = rows.filter((r) => r.status === 'created').length;
  const failedCount = rows.filter((r) => r.status === 'failed').length;

  const STATUS_LABEL: Record<RowStatus['status'], string> = {
    pending: 'Ready',
    creating: 'Creating…',
    created: 'Created',
    failed: 'Failed',
  };
  const STATUS_COLOR: Record<RowStatus['status'], string> = {
    pending: 'var(--foreground-muted)',
    creating: 'var(--warning)',
    created: 'var(--success)',
    failed: 'var(--danger)',
  };

  return (
    <div className="space-y-4">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold" style={{ color: 'var(--foreground)' }}>
            Bulk Upload Employees
          </h1>
          <p className="text-sm" style={{ color: 'var(--foreground-muted)' }}>
            Download the template, fill one row per employee (see the Reference Lists sheet for valid names), then upload it here.
          </p>
        </div>
        <Link
          href="/employees"
          className="rounded-lg border px-4 py-2 text-sm font-medium transition hover:opacity-80 shrink-0"
          style={{ borderColor: 'var(--border)', color: 'var(--foreground)' }}
        >
          Back to Employee Master
        </Link>
      </div>

      <div className="card p-5 space-y-3">
        <h2 className="text-sm font-semibold" style={{ color: 'var(--foreground)' }}>
          Step 1 — Download template
        </h2>
        <button
          type="button"
          onClick={downloadTemplate}
          disabled={downloading}
          className="rounded-lg px-4 py-2 text-sm font-medium text-white transition disabled:opacity-50"
          style={{ backgroundColor: 'var(--accent)' }}
        >
          {downloading ? 'Preparing…' : 'Download Excel Template'}
        </button>
      </div>

      <div className="card p-5 space-y-3">
        <h2 className="text-sm font-semibold" style={{ color: 'var(--foreground)' }}>
          Step 2 — Upload filled template
        </h2>
        <input
          type="file"
          accept=".xlsx,.xls"
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) handleFile(f);
          }}
          className="text-sm"
        />
        {parsing && <p className="text-sm" style={{ color: 'var(--foreground-muted)' }}>Reading file…</p>}
        {fileError && (
          <div className="rounded-lg px-3 py-2 text-sm" style={{ backgroundColor: 'var(--danger-soft)', color: 'var(--danger)' }}>
            {fileError}
          </div>
        )}
      </div>

      {rows.length > 0 && (
        <div className="card p-5 space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold" style={{ color: 'var(--foreground)' }}>
              Step 3 — Review &amp; import ({rows.length} row{rows.length !== 1 ? 's' : ''}, {importableCount} ready
              {createdCount > 0 ? `, ${createdCount} created` : ''}
              {failedCount > 0 ? `, ${failedCount} failed` : ''})
            </h2>
            <button
              type="button"
              onClick={runImport}
              disabled={importing || importableCount === 0}
              className="rounded-lg px-4 py-2 text-sm font-medium text-white transition disabled:opacity-50"
              style={{ backgroundColor: 'var(--accent)' }}
            >
              {importing ? 'Importing…' : `Import ${importableCount} Employee${importableCount !== 1 ? 's' : ''}`}
            </button>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left" style={{ color: 'var(--foreground-muted)' }}>
                  <th className="py-2 pr-4">Row</th>
                  <th className="py-2 pr-4">Name</th>
                  <th className="py-2 pr-4">Status</th>
                  <th className="py-2 pr-4">Details</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.row} style={{ borderTop: '1px solid var(--border)' }}>
                    <td className="py-2 pr-4">{r.row}</td>
                    <td className="py-2 pr-4">{r.employeeName}</td>
                    <td className="py-2 pr-4" style={{ color: STATUS_COLOR[r.status] }}>
                      {STATUS_LABEL[r.status]}
                    </td>
                    <td className="py-2 pr-4" style={{ color: 'var(--foreground-muted)' }}>
                      {r.resultError ?? ''}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
