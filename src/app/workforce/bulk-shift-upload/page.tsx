/**
 * Bulk Shift Upload — admin uploads a CSV/Excel file to create shift
 * assignment overrides in bulk. Expected columns: employeeCode, date, shiftCode
 *
 * UI pass (2026-09): 3-step layout (template → upload → results), drag-and-drop
 * zone, result KPIs and an errors-first result table. Endpoint unchanged.
 */

'use client';

import { useState, useRef, useMemo } from 'react';
import Link from 'next/link';
import { PageHeader, Alert, StatusBadge, SectionCard, Tabs, Button, Stepper, KPICard, KPIGrid } from '@/components/ui';

interface UploadResult {
  row: number;
  employeeCode: string;
  date: string;
  shiftCode: string;
  status: 'ok' | 'error';
  message?: string;
}

type ResultFilter = 'errors' | 'all';

const UploadIcon = () => (
  <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
    <path d="m17 8-5-5-5 5M12 3v12" />
  </svg>
);

const FileIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
    <path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z" />
    <path d="M14 2v6h6M8 13h8M8 17h8" />
  </svg>
);

const formatBytes = (n: number) => (n < 1024 ? `${n} B` : n < 1024 * 1024 ? `${(n / 1024).toFixed(1)} KB` : `${(n / 1024 / 1024).toFixed(1)} MB`);

export default function BulkShiftUploadPage() {
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [result, setResult] = useState<{ created: number; errors: number; total: number; results: UploadResult[] } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const [resultFilter, setResultFilter] = useState<ResultFilter>('errors');
  const fileRef = useRef<HTMLInputElement>(null);

  const step = result ? 'results' : file ? 'upload' : 'template';
  const completed = result ? ['template', 'upload'] : file ? ['template'] : [];

  const handleUpload = async () => {
    if (!file) {
      alert('Please select a file first');
      return;
    }
    setUploading(true);
    setError(null);
    setResult(null);
    try {
      const formData = new FormData();
      formData.append('file', file);
      const res = await fetch('/api/workforce/bulk-shift-upload', {
        method: 'POST',
        body: formData,
      });
      const json = await res.json();
      if (!res.ok) {
        setError(json.error ?? 'Upload failed');
        return;
      }
      setResult(json);
      setResultFilter(json.errors > 0 ? 'errors' : 'all');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Upload failed');
    } finally {
      setUploading(false);
    }
  };

  const downloadTemplate = () => {
    const csv = 'employeeCode,date,shiftCode\nRC027,2026-07-20,GENERAL\nRC028,2026-07-20,MORNING\n';
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'bulk-shift-template.csv';
    a.click();
    URL.revokeObjectURL(url);
  };

  const pickFile = (f: File | null | undefined) => {
    if (!f) return;
    setFile(f);
    setResult(null);
    setError(null);
  };

  const reset = () => {
    setFile(null);
    setResult(null);
    setError(null);
    if (fileRef.current) fileRef.current.value = '';
  };

  const visibleResults = useMemo(() => {
    if (!result) return [];
    return resultFilter === 'errors' ? result.results.filter((r) => r.status === 'error') : result.results;
  }, [result, resultFilter]);

  const successRate = result && result.total > 0 ? Math.round((result.created / result.total) * 100) : 0;

  return (
    <div className="space-y-4">
      <PageHeader
        eyebrow="Time Office"
        title="Bulk Shift Upload"
        description="Create many shift overrides at once from a CSV or Excel file. Each row becomes a manual override for that employee and date, and the employee is notified."
        actions={
          <Link href="/workforce/shift-plan" className="inline-flex items-center rounded-lg border px-3 py-2 text-sm font-medium transition hover:brightness-95" style={{ borderColor: 'var(--border)', color: 'var(--foreground)', backgroundColor: 'var(--surface)' }}>
            View Shift Plan
          </Link>
        }
      />

      <SectionCard>
        <Stepper
          steps={[{ key: 'template', label: '1 · Prepare file' }, { key: 'upload', label: '2 · Upload' }, { key: 'results', label: '3 · Review results' }]}
          activeKey={step}
          completedKeys={completed}
        />
      </SectionCard>

      {error && <Alert tone="danger" onDismiss={() => setError(null)}>{error}</Alert>}

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[360px_1fr]">
        {/* Step 1: format */}
        <SectionCard title="File format" description="CSV or XLSX with exactly these headers in the first row.">
          <div className="overflow-hidden rounded-lg border" style={{ borderColor: 'var(--border)' }}>
            <table className="w-full text-xs">
              <thead>
                <tr style={{ backgroundColor: 'var(--surface-hover)' }}>
                  <th className="px-3 py-2 text-left font-semibold" style={{ color: 'var(--foreground-muted)' }}>Column</th>
                  <th className="px-3 py-2 text-left font-semibold" style={{ color: 'var(--foreground-muted)' }}>Example</th>
                </tr>
              </thead>
              <tbody style={{ color: 'var(--foreground)' }}>
                {[
                  ['employeeCode', 'RC027', 'Active employee code'],
                  ['date', '2026-07-20', 'YYYY-MM-DD (Excel dates also accepted)'],
                  ['shiftCode', 'GENERAL', 'Code from Shift Master'],
                ].map(([col, ex, hint]) => (
                  <tr key={col} style={{ borderTop: '1px solid var(--border)' }}>
                    <td className="px-3 py-2 align-top">
                      <code className="rounded px-1.5 py-0.5 font-mono text-[11px]" style={{ backgroundColor: 'var(--surface-muted)' }}>{col}</code>
                      <div className="mt-0.5 text-[11px]" style={{ color: 'var(--foreground-muted)' }}>{hint}</div>
                    </td>
                    <td className="px-3 py-2 align-top font-mono text-[11px] tabular-nums">{ex}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <Button size="sm" className="mt-3 w-full" onClick={downloadTemplate} leftIcon={<FileIcon />}>Download CSV template</Button>
        </SectionCard>

        {/* Step 2: upload */}
        <SectionCard title="Upload" description="Drop the file here or browse. Existing overrides for the same employee/date are updated.">
          <div
            onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
            onDragLeave={() => setDragOver(false)}
            onDrop={(e) => { e.preventDefault(); setDragOver(false); pickFile(e.dataTransfer.files?.[0]); }}
            onClick={() => fileRef.current?.click()}
            role="button"
            tabIndex={0}
            onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); fileRef.current?.click(); } }}
            className="flex cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed px-6 py-10 text-center transition"
            style={{
              borderColor: dragOver ? 'var(--accent)' : file ? 'var(--success)' : 'var(--border)',
              backgroundColor: dragOver ? 'var(--accent-soft)' : file ? 'var(--success-soft)' : 'var(--surface-muted)',
            }}
          >
            <input ref={fileRef} type="file" accept=".csv,.xlsx,.xls" className="hidden" onChange={(e) => pickFile(e.target.files?.[0])} />
            <div className="mb-3 flex h-14 w-14 items-center justify-center rounded-full" style={{ backgroundColor: 'var(--surface)', color: file ? 'var(--success)' : 'var(--accent)' }}>
              {file ? <FileIcon /> : <UploadIcon />}
            </div>
            {file ? (
              <>
                <p className="text-sm font-medium" style={{ color: 'var(--foreground)' }}>{file.name}</p>
                <p className="mt-0.5 text-xs" style={{ color: 'var(--foreground-muted)' }}>{formatBytes(file.size)} · click to choose a different file</p>
              </>
            ) : (
              <>
                <p className="text-sm font-medium" style={{ color: 'var(--foreground)' }}>Drag & drop your file here</p>
                <p className="mt-0.5 text-xs" style={{ color: 'var(--foreground-muted)' }}>or click to browse · .csv, .xlsx, .xls</p>
              </>
            )}
          </div>

          <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
            <div className="text-xs" style={{ color: 'var(--foreground-muted)' }}>
              {file ? 'Ready to upload.' : 'No file selected.'}
            </div>
            <div className="flex gap-2">
              {(file || result) && <Button onClick={reset} disabled={uploading}>Reset</Button>}
              <Button variant="primary" onClick={handleUpload} disabled={!file} loading={uploading} leftIcon={!uploading ? <UploadIcon /> : undefined}>
                {uploading ? 'Uploading…' : 'Upload & apply'}
              </Button>
            </div>
          </div>
        </SectionCard>
      </div>

      {/* Step 3: results */}
      {result && (
        <>
          <KPIGrid columns={3}>
            <KPICard label="Rows Processed" value={result.total} tone="info" />
            <KPICard label="Overrides Created" value={result.created} subtitle={`${successRate}% success`} tone="success" />
            <KPICard label="Rows with Errors" value={result.errors} subtitle={result.errors > 0 ? 'fix and re-upload just these rows' : 'no errors'} tone={result.errors > 0 ? 'danger' : 'success'} />
          </KPIGrid>

          {result.errors === 0 ? (
            <Alert tone="success">All {result.created} rows applied successfully. Employees have been notified of their new shifts.</Alert>
          ) : (
            <Alert tone="warning">{result.errors} of {result.total} rows failed. Successful rows are already applied; correct the failed rows and upload them again.</Alert>
          )}

          <SectionCard
            title="Row results"
            count={visibleResults.length}
            flush
            actions={
              <Tabs<ResultFilter>
                variant="segmented"
                tabs={[{ key: 'errors', label: 'Errors', count: result.errors }, { key: 'all', label: 'All rows', count: result.total }]}
                active={resultFilter}
                onChange={setResultFilter}
              />
            }
          >
            {visibleResults.length === 0 ? (
              <div className="px-4 py-8 text-center text-sm" style={{ color: 'var(--foreground-muted)' }}>No rows to show.</div>
            ) : (
              <div className="overflow-x-auto">
                <table className="min-w-full text-xs">
                  <thead>
                    <tr style={{ backgroundColor: 'var(--surface-hover)' }}>
                      {['Row', 'Employee', 'Date', 'Shift', 'Status', 'Message'].map((h) => (
                        <th key={h} className="px-4 py-2.5 text-left font-semibold" style={{ color: 'var(--foreground-muted)' }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody style={{ color: 'var(--foreground)' }}>
                    {visibleResults.map((r, i) => (
                      <tr key={i} style={{ borderTop: '1px solid var(--border)' }}>
                        <td className="px-4 py-2 tabular-nums" style={{ color: 'var(--foreground-muted)' }}>#{r.row}</td>
                        <td className="px-4 py-2 font-medium">{r.employeeCode || <span style={{ color: 'var(--foreground-muted)' }}>—</span>}</td>
                        <td className="px-4 py-2 font-mono tabular-nums">{r.date}</td>
                        <td className="px-4 py-2">{r.shiftCode ? <StatusBadge tone="neutral">{r.shiftCode}</StatusBadge> : '—'}</td>
                        <td className="px-4 py-2"><StatusBadge tone={r.status === 'ok' ? 'success' : 'danger'} dot>{r.status === 'ok' ? 'Applied' : 'Failed'}</StatusBadge></td>
                        <td className="px-4 py-2" style={{ color: r.status === 'ok' ? 'var(--foreground-muted)' : 'var(--danger)' }}>{r.message ?? (r.status === 'ok' ? 'Override created, employee notified' : '')}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </SectionCard>
        </>
      )}
    </div>
  );
}
