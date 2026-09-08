/**
 * Bulk Upload Benefits — the "manual entry + bulk upload" path the BRD
 * asked for on Double Machine Allowance / Attendance Bonus / Extra Work
 * Allowance / Referral Bonus (no approval chain was specified for these,
 * unlike Mispunch/OT/Leave — HR just enters/uploads and it lands on the
 * payslip). Works for any earning/deduction salary component, not just
 * those four — one row per employee, applied via the same
 * PayrollLineComponent.isAdhoc mechanism the single-line Add Ad-hoc Line
 * action and Apply Canteen/Petrol both use, just looped client-side over
 * the uploaded rows and posted to the existing per-line adhoc endpoint.
 */

'use client';

import { useState, useMemo, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import * as XLSX from 'xlsx';
import { DataTable, type Column } from '@/components/ui';

interface RunLine {
  id: number;
  employee: { employeeCode: string; firstName: string; lastName: string };
}
interface RunResponse {
  id: number;
  status: string;
  lines: RunLine[];
}
interface SalaryComponentOption {
  id: number;
  code: string;
  name: string;
  type: string;
}

interface UploadRow {
  id: number;
  row: number;
  employeeCode: string;
  componentCode: string;
  amount: number;
  employeeName?: string;
  status: 'ready' | 'applying' | 'applied' | 'failed';
  error?: string;
}

const TEMPLATE_COLUMNS = ['Employee Code', 'Component Code', 'Amount'];

function BulkAdhocContent() {
  const runId = useSearchParams().get('runId');
  const [run, setRun] = useState<RunResponse | null>(null);
  const [components, setComponents] = useState<SalaryComponentOption[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [rows, setRows] = useState<UploadRow[]>([]);
  const [running, setRunning] = useState(false);
  const [fileError, setFileError] = useState<string | null>(null);

  const load = useMemo(
    () => async () => {
      if (!runId) return;
      const [runRes, compRes] = await Promise.all([fetch(`/api/payroll/runs/${runId}`), fetch('/api/masters/salary-components?limit=500')]);
      setRun(await runRes.json());
      const compJson = await compRes.json();
      setComponents((compJson.data ?? []).filter((c: SalaryComponentOption) => c.type === 'earning' || c.type === 'deduction'));
      setLoaded(true);
    },
    [runId]
  );
  useState(() => {
    load();
  });

  const downloadTemplate = () => {
    const wb = XLSX.utils.book_new();
    const sheet = XLSX.utils.aoa_to_sheet([TEMPLATE_COLUMNS, ['EMP001', 'DOUBLE_MACHINE', '500']]);
    sheet['!cols'] = TEMPLATE_COLUMNS.map(() => ({ wch: 22 }));
    XLSX.utils.book_append_sheet(wb, sheet, 'Ad-hoc Lines');

    const compRows = [['Component Code', 'Name', 'Type'], ...components.map((c) => [c.code, c.name, c.type])];
    const compSheet = XLSX.utils.aoa_to_sheet(compRows);
    compSheet['!cols'] = [{ wch: 20 }, { wch: 30 }, { wch: 12 }];
    XLSX.utils.book_append_sheet(wb, compSheet, 'Valid Component Codes');

    XLSX.writeFile(wb, 'payroll-bulk-adhoc-template.xlsx');
  };

  const handleFile = async (file: File) => {
    setFileError(null);
    setRows([]);
    if (!run) return;
    const buf = await file.arrayBuffer();
    const wb = XLSX.read(buf, { type: 'array' });
    const sheet = wb.Sheets[wb.SheetNames[0]];
    const parsed: Record<string, unknown>[] = XLSX.utils.sheet_to_json(sheet, { defval: '' });
    if (parsed.length === 0) {
      setFileError('No rows found in the uploaded file.');
      return;
    }

    const lineByEmployeeCode = new Map(run.lines.map((l) => [l.employee.employeeCode, l]));
    const componentByCode = new Map(components.map((c) => [c.code, c]));

    const built: UploadRow[] = parsed.map((r, i) => {
      const employeeCode = String(r['Employee Code'] ?? '').trim();
      const componentCode = String(r['Component Code'] ?? '').trim();
      const amount = Number(r['Amount']);
      const line = lineByEmployeeCode.get(employeeCode);
      const component = componentByCode.get(componentCode);

      let error: string | undefined;
      if (!line) error = `Employee code "${employeeCode}" not found in this run`;
      else if (!component) error = `Component code "${componentCode}" not found`;
      else if (!Number.isFinite(amount) || amount <= 0) error = 'Amount must be a positive number';

      return {
        id: i,
        row: i + 2,
        employeeCode,
        componentCode,
        amount,
        employeeName: line ? `${line.employee.firstName} ${line.employee.lastName}` : undefined,
        status: error ? 'failed' : 'ready',
        error,
      };
    });
    setRows(built);
  };

  const runUpload = async () => {
    if (!run) return;
    const lineByEmployeeCode = new Map(run.lines.map((l) => [l.employee.employeeCode, l]));
    const componentByCode = new Map(components.map((c) => [c.code, c]));
    setRunning(true);
    try {
      for (let i = 0; i < rows.length; i++) {
        const r = rows[i];
        if (r.status !== 'ready') continue;
        setRows((prev) => prev.map((row, idx) => (idx === i ? { ...row, status: 'applying' } : row)));
        const line = lineByEmployeeCode.get(r.employeeCode);
        const component = componentByCode.get(r.componentCode);
        if (!line || !component) continue;
        try {
          const res = await fetch(`/api/payroll/runs/${run.id}/lines/${line.id}/adhoc`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ salaryComponentId: component.id, amount: r.amount }),
          });
          if (!res.ok) throw new Error((await res.json()).error ?? 'Failed');
          setRows((prev) => prev.map((row, idx) => (idx === i ? { ...row, status: 'applied' } : row)));
        } catch (err) {
          setRows((prev) => prev.map((row, idx) => (idx === i ? { ...row, status: 'failed', error: err instanceof Error ? err.message : 'Failed' } : row)));
        }
      }
    } finally {
      setRunning(false);
    }
  };

  const columns: Column<UploadRow>[] = [
    { key: 'row', label: 'Row' },
    { key: 'employeeCode', label: 'Employee Code', render: (r) => `${r.employeeCode}${r.employeeName ? ` — ${r.employeeName}` : ''}` },
    { key: 'componentCode', label: 'Component' },
    { key: 'amount', label: 'Amount' },
    { key: 'status', label: 'Status' },
    { key: 'error', label: 'Details', render: (r) => r.error ?? '' },
  ];

  if (!runId) return <p className="text-sm" style={{ color: 'var(--foreground-muted)' }}>Open this page from Salary Processing (needs a runId).</p>;
  if (!loaded) return <p className="text-sm" style={{ color: 'var(--foreground-muted)' }}>Loading…</p>;

  const readyCount = rows.filter((r) => r.status === 'ready').length;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold" style={{ color: 'var(--foreground)' }}>
            Bulk Upload Benefits
          </h1>
          <p className="text-sm" style={{ color: 'var(--foreground-muted)' }}>
            One row per employee — applies as an ad-hoc line on their payslip for this run only.
          </p>
        </div>
        <Link href="/payroll/processing/salary" className="rounded-lg border px-4 py-2 text-sm font-medium" style={{ borderColor: 'var(--border)', color: 'var(--foreground)' }}>
          Back to Salary Processing
        </Link>
      </div>

      <div className="card p-5 space-y-3">
        <button onClick={downloadTemplate} className="rounded-lg px-4 py-2 text-sm font-medium text-white" style={{ backgroundColor: 'var(--accent)' }}>
          Download Template
        </button>
        <input
          type="file"
          accept=".xlsx,.xls"
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) handleFile(f);
          }}
          className="block text-sm"
        />
        {fileError && (
          <div className="rounded-lg px-3 py-2 text-sm" style={{ backgroundColor: '#fef2f2', color: '#dc2626' }}>
            {fileError}
          </div>
        )}
      </div>

      {rows.length > 0 && (
        <div className="card p-5 space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold" style={{ color: 'var(--foreground)' }}>
              {rows.length} row(s), {readyCount} ready
            </h2>
            <button
              onClick={runUpload}
              disabled={running || readyCount === 0}
              className="rounded-lg px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
              style={{ backgroundColor: 'var(--accent)' }}
            >
              {running ? 'Applying…' : `Apply ${readyCount} Line(s)`}
            </button>
          </div>
          <DataTable columns={columns} data={rows} emptyMessage="No rows." />
        </div>
      )}
    </div>
  );
}

export default function BulkAdhocPage() {
  return (
    <Suspense fallback={null}>
      <BulkAdhocContent />
    </Suspense>
  );
}
