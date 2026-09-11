/**
 * Designation JD Upload (KUN BRD review, 2026-09-10, item 4) — bulk-fills
 * Designation.jobDescription from an Excel file: one row per Designation
 * Code + Job Description. Matches existing designations by code; never
 * creates one. Same three-step download/upload/import shape as
 * employees/bulk-upload, but far simpler (two columns, one API call).
 */

'use client';

import { useState } from 'react';
import Link from 'next/link';
import * as XLSX from 'xlsx';

interface DesignationOption {
  id: number;
  code: string;
  name: string;
  jobDescription: string | null;
}

interface ParsedRow {
  row: number;
  code: string;
  jobDescription: string;
}

interface ResultRow {
  row: number;
  code: string;
  status: 'updated' | 'not_found';
}

const HEADERS = ['Designation Code', 'Job Description'];

export default function DesignationJdUploadPage() {
  const [downloading, setDownloading] = useState(false);
  const [parsing, setParsing] = useState(false);
  const [fileError, setFileError] = useState<string | null>(null);
  const [rows, setRows] = useState<ParsedRow[]>([]);
  const [importing, setImporting] = useState(false);
  const [results, setResults] = useState<ResultRow[] | null>(null);
  const [importError, setImportError] = useState<string | null>(null);

  const downloadTemplate = async () => {
    setDownloading(true);
    try {
      const res = await fetch('/api/masters/designations?limit=500');
      const json: { data: DesignationOption[] } = await res.json();
      const designations = json.data ?? [];

      const templateSheet = XLSX.utils.aoa_to_sheet([
        HEADERS,
        ...designations.map((d) => [d.code, d.jobDescription ?? '']),
      ]);
      templateSheet['!cols'] = [{ wch: 20 }, { wch: 80 }];

      const refSheet = XLSX.utils.aoa_to_sheet([
        ['Designation Code', 'Designation Name'],
        ...designations.map((d) => [d.code, d.name]),
      ]);
      refSheet['!cols'] = [{ wch: 20 }, { wch: 40 }];

      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, templateSheet, 'JD Upload');
      XLSX.utils.book_append_sheet(wb, refSheet, 'Reference — Designations');
      XLSX.writeFile(wb, 'designation-jd-upload-template.xlsx');
    } catch {
      setFileError('Could not build the template — try again.');
    } finally {
      setDownloading(false);
    }
  };

  const handleFile = async (file: File) => {
    setFileError(null);
    setResults(null);
    setRows([]);
    setParsing(true);
    try {
      const buf = await file.arrayBuffer();
      const wb = XLSX.read(buf, { type: 'array' });
      const sheet = wb.Sheets[wb.SheetNames[0]];
      const aoa = XLSX.utils.sheet_to_json<string[]>(sheet, { header: 1, blankrows: false });
      if (aoa.length < 2) {
        setFileError('No data rows found — fill in at least one row below the header.');
        return;
      }
      const parsed: ParsedRow[] = [];
      for (let i = 1; i < aoa.length; i++) {
        const [code, jd] = aoa[i];
        const codeStr = String(code ?? '').trim();
        const jdStr = String(jd ?? '').trim();
        if (!codeStr && !jdStr) continue; // blank row
        if (!codeStr || !jdStr) continue; // partial row — silently skipped, same as an empty row
        parsed.push({ row: i + 1, code: codeStr, jobDescription: jdStr });
      }
      if (parsed.length === 0) {
        setFileError('No usable rows — every row needs both Designation Code and Job Description.');
        return;
      }
      setRows(parsed);
    } catch {
      setFileError('Could not read the uploaded file — make sure it is the downloaded .xlsx template.');
    } finally {
      setParsing(false);
    }
  };

  const handleImport = async () => {
    setImporting(true);
    setImportError(null);
    try {
      const res = await fetch('/api/masters/designations/jd-bulk-import', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ rows: rows.map(({ code, jobDescription }) => ({ code, jobDescription })) }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? 'Import failed');
      setResults(json.results);
    } catch (err) {
      setImportError(err instanceof Error ? err.message : 'Import failed');
    } finally {
      setImporting(false);
    }
  };

  const updatedCount = results?.filter((r) => r.status === 'updated').length ?? 0;
  const notFoundCount = results?.filter((r) => r.status === 'not_found').length ?? 0;

  return (
    <div className="space-y-4">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold" style={{ color: 'var(--foreground)' }}>
            Designation JD Upload
          </h1>
          <p className="text-sm" style={{ color: 'var(--foreground-muted)' }}>
            Bulk-fill Job Descriptions by Designation Code. Matches existing designations only — it never creates one.
          </p>
        </div>
        <Link
          href="/masters/designations-grades"
          className="shrink-0 rounded-lg border px-4 py-2 text-sm font-medium transition hover:opacity-80"
          style={{ borderColor: 'var(--border)', color: 'var(--foreground)' }}
        >
          Back to Designations
        </Link>
      </div>

      <div className="card space-y-3 p-5">
        <h2 className="text-sm font-semibold" style={{ color: 'var(--foreground)' }}>
          Step 1 — Download template
        </h2>
        <p className="text-xs" style={{ color: 'var(--foreground-muted)' }}>
          Pre-filled with every current Designation Code (and its existing JD, if any) — edit the Job Description column and re-upload.
        </p>
        <button
          type="button"
          onClick={downloadTemplate}
          disabled={downloading}
          className="rounded-lg px-4 py-2 text-sm font-medium text-white transition disabled:opacity-50"
          style={{ backgroundColor: 'var(--accent)' }}
        >
          {downloading ? 'Preparing...' : 'Download Excel Template'}
        </button>
      </div>

      <div className="card space-y-3 p-5">
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
        {parsing && (
          <p className="text-sm" style={{ color: 'var(--foreground-muted)' }}>
            Reading file...
          </p>
        )}
        {fileError && (
          <div className="rounded-lg px-3 py-2 text-sm" style={{ backgroundColor: 'var(--danger-soft)', color: 'var(--danger)' }}>
            {fileError}
          </div>
        )}
      </div>

      {rows.length > 0 && (
        <div className="card space-y-3 p-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h2 className="text-sm font-semibold" style={{ color: 'var(--foreground)' }}>
              Step 3 — Review &amp; import ({rows.length} row{rows.length !== 1 ? 's' : ''} ready)
            </h2>
            <button
              type="button"
              onClick={handleImport}
              disabled={importing}
              className="rounded-lg px-4 py-2 text-sm font-medium text-white transition disabled:opacity-50"
              style={{ backgroundColor: 'var(--accent)' }}
            >
              {importing ? 'Importing...' : `Import ${rows.length} JD${rows.length !== 1 ? 's' : ''}`}
            </button>
          </div>

          {importError && (
            <div className="rounded-lg px-3 py-2 text-sm" style={{ backgroundColor: 'var(--danger-soft)', color: 'var(--danger)' }}>
              {importError}
            </div>
          )}
          {results && (
            <div className="rounded-lg px-3 py-2 text-sm" style={{ backgroundColor: 'var(--success-soft)', color: 'var(--success)' }}>
              {updatedCount} designation{updatedCount !== 1 ? 's' : ''} updated
              {notFoundCount > 0 ? `, ${notFoundCount} code${notFoundCount !== 1 ? 's' : ''} not found (see below)` : ''}.
            </div>
          )}

          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left" style={{ color: 'var(--foreground-muted)' }}>
                  <th className="py-2 pr-4">Row</th>
                  <th className="py-2 pr-4">Designation Code</th>
                  <th className="py-2 pr-4">Job Description</th>
                  {results && <th className="py-2 pr-4">Result</th>}
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => {
                  const result = results?.find((res) => res.row === r.row);
                  return (
                    <tr key={r.row} style={{ borderTop: '1px solid var(--border)' }}>
                      <td className="py-2 pr-4">{r.row}</td>
                      <td className="py-2 pr-4 font-medium">{r.code}</td>
                      <td className="max-w-md truncate py-2 pr-4" style={{ color: 'var(--foreground-muted)' }} title={r.jobDescription}>
                        {r.jobDescription}
                      </td>
                      {results && (
                        <td
                          className="py-2 pr-4"
                          style={{ color: result?.status === 'updated' ? 'var(--success)' : 'var(--danger)' }}
                        >
                          {result?.status === 'updated' ? 'Updated' : 'Code not found'}
                        </td>
                      )}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
