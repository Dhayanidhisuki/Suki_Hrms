/**
 * Biometric Attendance — Phase 1.
 *
 * Viewer: shows one calendar day's imported rows (from BiometricAttendanceImport,
 * merged from all 3 legacy sources) via GET /api/biometric/import?date=.
 *
 * Bulk upload: one plain template — EMP_ID, Name, Date, In-Time, Out-Time,
 * one row per employee per day — the fallback path for when the automated
 * device push isn't working. "Download Template" gets a blank CSV; fill it
 * in and upload it back. Client-side, the per-day rows are grouped by
 * calendar month per employee and reshaped into the wide day1..day31 shape
 * POST /api/biometric/import expects (as an 'intime' and an 'outtime'
 * source, one call per month present in the file) — the same endpoint a
 * live device/vendor push would call. Working hours and OT are computed
 * from the in/out times by the shared conversion pipeline
 * (src/lib/biometricConversion.ts), not here — that applies to every
 * biometric ingestion path, not just this upload form.
 *
 * Reopen: when the viewed calendar month is FROZEN, an in-page Reopen action
 * calls the existing /api/workforce/attendance/monthly/reopen endpoint
 * directly — no detour to the Monthly Attendance page needed to correct
 * biometric data.
 */

'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { DataTable, FormModal, type Column, type FieldDef } from '@/components/ui';

interface ImportRow {
  id: number;
  empIdRaw: string;
  year: number;
  attForMonth: string;
  fromWhere: string;
  matchedEmployee: { id: number; employeeCode: string; firstName: string; lastName: string } | null;
  processedAt: string | null;
  hours: string | null;
  inTimeRaw: string | null;
  outTimeRaw: string | null;
}

interface SyncRun {
  id: number;
  trigger: string;
  rangeStart: string;
  rangeEnd: string;
  status: string;
  rowsFetched: number;
  daysCreated: number;
  daysUpdated: number;
  daysUnchanged: number;
  skippedFrozen: number;
  error: string | null;
  startedAt: string;
  finishedAt: string | null;
}

interface SyncStatus {
  configured: boolean;
  apiUrl: string | null;
  scheduler: { intervalHours: number; running: boolean; lastStartedAt: string | null; lastFinishedAt: string | null; nextRunAt: string | null } | null;
  runs: SyncRun[];
  unmatched: { userid: string; username: string; days: number }[];
}

function todayIso() {
  return new Date().toISOString().slice(0, 10);
}

/** "HH.MM" -> "HH:MM" for display; 0/null means no punch that day. */
function formatRawTime(raw: string | null): string {
  if (raw === null) return '—';
  const value = Number(raw);
  if (!Number.isFinite(value) || value <= 0) return '—';
  const hour = Math.floor(value);
  const minute = Math.round((value - hour) * 100);
  return `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`;
}

/** Splits one CSV line into cells, honoring double-quoted fields (Excel wraps saved cells in quotes). */
function splitCsvLine(line: string): string[] {
  const cells: string[] = [];
  let cur = '';
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      if (inQuotes && line[i + 1] === '"') {
        cur += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (ch === ',' && !inQuotes) {
      cells.push(cur);
      cur = '';
    } else {
      cur += ch;
    }
  }
  cells.push(cur);
  return cells;
}

/**
 * Parses an uploaded CSV (from the downloaded template) into an array of
 * {COLUMN_NAME: rawValue} rows — the same shape parseSsmsGrid used to
 * produce, so the mapHoursRow/mapInTimeRow/mapOutTimeRow functions below
 * work unchanged regardless of source.
 */
function parseCsv(raw: string): Record<string, string>[] {
  const lines = raw.replace(/\r\n/g, '\n').split('\n').filter((l) => l.trim() !== '');
  if (lines.length < 2) return [];
  const headers = splitCsvLine(lines[0]).map((h) => h.trim().toUpperCase());
  const rows: Record<string, string>[] = [];
  for (let i = 1; i < lines.length; i++) {
    const cells = splitCsvLine(lines[i]);
    const rowObj: Record<string, string> = {};
    headers.forEach((h, idx) => {
      rowObj[h] = (cells[idx] ?? '').trim();
    });
    rows.push(rowObj);
  }
  return rows;
}

const TEMPLATE_HEADERS = ['EMP_ID', 'NAME', 'DATE', 'IN_TIME', 'OUT_TIME'];

/** Downloads the blank bulk-upload template, one example row included for guidance. */
function downloadTemplate() {
  const example = ['100265', 'Employee Name (for your reference only)', todayIso(), '09:05', '18:30'];
  const csv = [TEMPLATE_HEADERS.join(','), example.join(',')].join('\n');
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'biometric_attendance_template.csv';
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

/** "HH:MM" -> the legacy HH.MM decimal encoding the import API/conversion pipeline expects, or null for a blank/invalid cell (no punch that day). */
function hhmmToDecimal(v: string | undefined): number | null {
  if (!v || !v.trim()) return null;
  const m = v.trim().match(/^(\d{1,2}):(\d{2})$/);
  if (!m) return null;
  const hour = Number(m[1]);
  const minute = Number(m[2]);
  if (hour < 0 || hour > 23 || minute < 0 || minute > 59) return null;
  return hour + minute / 100;
}

interface MonthGroup {
  periodStartDate: string; // YYYY-MM-01
  attForMonth: string; // e.g. "September"
  year: number;
  intimeRows: Map<string, Record<string, unknown>>; // empIdRaw -> row
  outtimeRows: Map<string, Record<string, unknown>>;
}

/**
 * Groups the template's per-day rows by calendar month, reshaping each
 * employee's days in that month into the wide day1InTime../day1OutTime..
 * shape the import API expects — one call per (month, source) covers every
 * employee in the file, same as the legacy wide-table upload path did.
 */
function buildMonthGroups(rows: Record<string, string>[]): { groups: MonthGroup[]; rowErrors: string[] } {
  const groups = new Map<string, MonthGroup>();
  const rowErrors: string[] = [];

  rows.forEach((c, idx) => {
    const empIdRaw = c['EMP_ID']?.trim();
    const dateStr = c['DATE']?.trim();
    if (!empIdRaw || !dateStr) {
      rowErrors.push(`Row ${idx + 2}: EMP_ID and DATE are required — skipped.`);
      return;
    }
    const dateMatch = dateStr.match(/^(\d{4})-(\d{2})-(\d{2})$/);
    if (!dateMatch) {
      rowErrors.push(`Row ${idx + 2}: DATE "${dateStr}" isn't YYYY-MM-DD — skipped.`);
      return;
    }
    const [, yearStr, monthStr, dayStr] = dateMatch;
    const year = Number(yearStr);
    const monthNum = Number(monthStr);
    const dayOfMonth = Number(dayStr);

    const inDecimal = hhmmToDecimal(c['IN_TIME']);
    const outDecimal = hhmmToDecimal(c['OUT_TIME']);
    if (c['IN_TIME']?.trim() && inDecimal === null) rowErrors.push(`Row ${idx + 2}: IN_TIME "${c['IN_TIME']}" isn't HH:MM — ignored.`);
    if (c['OUT_TIME']?.trim() && outDecimal === null) rowErrors.push(`Row ${idx + 2}: OUT_TIME "${c['OUT_TIME']}" isn't HH:MM — ignored.`);
    if (inDecimal === null && outDecimal === null) return; // nothing usable for this row

    const monthKey = `${year}-${monthStr}`;
    const attForMonth = new Date(Date.UTC(year, monthNum - 1, 1)).toLocaleString('en-US', { month: 'long', timeZone: 'UTC' });
    let group = groups.get(monthKey);
    if (!group) {
      group = { periodStartDate: `${yearStr}-${monthStr}-01`, attForMonth, year, intimeRows: new Map(), outtimeRows: new Map() };
      groups.set(monthKey, group);
    }

    if (inDecimal !== null) {
      const row = group.intimeRows.get(empIdRaw) ?? { empIdRaw, year, attForMonth };
      row[`day${dayOfMonth}InTime`] = inDecimal;
      group.intimeRows.set(empIdRaw, row);
    }
    if (outDecimal !== null) {
      const row = group.outtimeRows.get(empIdRaw) ?? { empIdRaw, year, attForMonth };
      row[`day${dayOfMonth}OutTime`] = outDecimal;
      group.outtimeRows.set(empIdRaw, row);
    }
  });

  return { groups: [...groups.values()], rowErrors };
}

interface ImportSummary {
  monthsProcessed: number;
  imported: number;
  unmatched: number;
  duplicatesMerged: number;
  converted: number;
  skippedFrozen: number;
  unmatchedTimes: number;
  rowErrors: string[];
  apiErrors: string[];
}

export default function BiometricAttendancePage() {
  const [date, setDate] = useState(todayIso());
  const [rows, setRows] = useState<ImportRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [monthStatus, setMonthStatus] = useState<'OPEN' | 'FINALIZED' | 'FROZEN'>('OPEN');
  const [reopenModalOpen, setReopenModalOpen] = useState(false);

  const [uploadedFile, setUploadedFile] = useState<File | null>(null);
  const [fromWhere, setFromWhere] = useState<'MANUAL' | 'BIOMETRIC'>('MANUAL');
  const [importing, setImporting] = useState(false);
  const [importResult, setImportResult] = useState<ImportSummary | null>(null);
  const [importError, setImportError] = useState<string | null>(null);

  const [year, month] = useMemo(() => {
    const [y, m] = date.split('-').map(Number);
    return [y, m];
  }, [date]);

  const fetchViewer = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [bioRes, monthlyRes] = await Promise.all([
        fetch(`/api/biometric/import?date=${date}`),
        fetch(`/api/workforce/attendance/monthly?year=${year}&month=${month}`),
      ]);
      if (!bioRes.ok) throw new Error('Failed to load biometric data');
      const bioJson: { data: ImportRow[] } = await bioRes.json();
      setRows(bioJson.data ?? []);

      if (monthlyRes.ok) {
        const monthlyJson: { data: { summary: { status: 'OPEN' | 'FINALIZED' | 'FROZEN' } | null }[] } = await monthlyRes.json();
        setMonthStatus(monthlyJson.data[0]?.summary?.status ?? 'OPEN');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  }, [date, year, month]);

  useEffect(() => {
    fetchViewer();
  }, [fetchViewer]);

  const handleImport = async () => {
    setImportError(null);
    setImportResult(null);
    if (!uploadedFile) {
      setImportError('Choose a filled-in template file first.');
      return;
    }
    let text: string;
    try {
      text = await uploadedFile.text();
    } catch {
      setImportError('Could not read the selected file.');
      return;
    }
    const parsedRows = parseCsv(text);
    if (parsedRows.length === 0) {
      setImportError('No data rows found in the uploaded file — make sure the header row and at least one filled-in row are present.');
      return;
    }

    const { groups, rowErrors } = buildMonthGroups(parsedRows);
    if (groups.length === 0) {
      setImportError('No usable rows found — every row needs EMP_ID, DATE, and at least one of IN_TIME/OUT_TIME.');
      return;
    }

    setImporting(true);
    const summary: ImportSummary = {
      monthsProcessed: groups.length,
      imported: 0,
      unmatched: 0,
      duplicatesMerged: 0,
      converted: 0,
      skippedFrozen: 0,
      unmatchedTimes: 0,
      rowErrors,
      apiErrors: [],
    };
    try {
      for (const group of groups) {
        for (const [source, rowsMap] of [
          ['intime', group.intimeRows],
          ['outtime', group.outtimeRows],
        ] as const) {
          if (rowsMap.size === 0) continue;
          const res = await fetch('/api/biometric/import', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              periodStartDate: group.periodStartDate,
              source,
              fromWhere,
              rows: [...rowsMap.values()],
            }),
          });
          const json = await res.json();
          if (!res.ok) {
            summary.apiErrors.push(`${group.attForMonth} ${group.year} (${source}): ${json.error ?? 'import failed'}`);
            continue;
          }
          summary.imported += json.imported;
          summary.unmatched += json.unmatched;
          summary.duplicatesMerged += json.duplicatesMerged;
          summary.converted += json.conversion.converted;
          summary.skippedFrozen += json.conversion.skippedFrozen;
          summary.unmatchedTimes += json.conversion.unmatchedTimes;
        }
      }
      setImportResult(summary);
      setUploadedFile(null);
      fetchViewer();
    } catch (err) {
      setImportError(err instanceof Error ? err.message : 'Import failed');
    } finally {
      setImporting(false);
    }
  };

  const columns: Column<ImportRow & { id: number }>[] = [
    { key: 'empIdRaw', label: 'EMP_ID' },
    {
      key: 'matchedEmployee',
      label: 'Employee',
      render: (r) =>
        r.matchedEmployee ? (
          `${r.matchedEmployee.employeeCode} — ${r.matchedEmployee.firstName} ${r.matchedEmployee.lastName}`
        ) : (
          <span className="rounded-full px-2 py-0.5 text-xs font-medium" style={{ backgroundColor: '#fee2e2', color: '#991b1b' }}>
            Unmatched
          </span>
        ),
    },
    { key: 'attForMonth', label: 'Wage Period' },
    { key: 'hours', label: 'Hours', render: (r) => (r.hours ?? '—') },
    { key: 'inTimeRaw', label: 'In', render: (r) => formatRawTime(r.inTimeRaw) },
    { key: 'outTimeRaw', label: 'Out', render: (r) => formatRawTime(r.outTimeRaw) },
    {
      key: 'fromWhere',
      label: 'Source',
      render: (r) => (
        <span
          className="rounded-full px-2 py-0.5 text-xs font-medium"
          style={{
            backgroundColor: r.fromWhere === 'BIOMETRIC' ? '#dbeafe' : '#f3f4f6',
            color: r.fromWhere === 'BIOMETRIC' ? '#1e40af' : '#374151',
          }}
        >
          {r.fromWhere}
        </span>
      ),
    },
  ];

  const reopenFields: FieldDef[] = [{ name: 'reason', label: 'Reopen Reason', type: 'textarea', required: true }];

  // ── Device sync (automatic every N hours + manual catch-up) ──────────────
  const [sync, setSync] = useState<SyncStatus | null>(null);
  const [syncBusy, setSyncBusy] = useState(false);
  const [syncMsg, setSyncMsg] = useState<string | null>(null);
  const [syncRange, setSyncRange] = useState(() => {
    const end = todayIso();
    const start = new Date(Date.now() - 6 * 86400000).toISOString().slice(0, 10);
    return { start, end };
  });

  const loadSync = useCallback(async () => {
    try {
      const res = await fetch('/api/biometric/sync');
      if (!res.ok) return;
      setSync((await res.json()) as SyncStatus);
    } catch {
      /* status card is best-effort */
    }
  }, []);

  useEffect(() => {
    loadSync();
  }, [loadSync]);

  const runSyncNow = async () => {
    setSyncBusy(true);
    setSyncMsg(null);
    try {
      const res = await fetch('/api/biometric/sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ startDate: syncRange.start, endDate: syncRange.end }),
      });
      const json = await res.json();
      if (!res.ok && !json.runId) throw new Error(json.error ?? 'Sync failed');
      setSyncMsg(
        json.status === 'success'
          ? `Synced: ${json.rowsFetched} device rows → ${json.daysCreated} new, ${json.daysUpdated} updated, ${json.daysUnchanged} unchanged, ${json.skippedFrozen} frozen-skipped, ${json.unmatched.length} unmatched IDs.`
          : `Sync failed: ${json.error}`
      );
      await loadSync();
      fetchViewer();
    } catch (err) {
      setSyncMsg(err instanceof Error ? err.message : 'Sync failed');
    } finally {
      setSyncBusy(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-xl font-semibold" style={{ color: 'var(--foreground)' }}>
          Biometric Attendance
        </h1>
        <div className="flex items-center gap-2">
          <input
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            className="rounded-lg border px-3 py-2 text-sm"
            style={{ backgroundColor: 'var(--surface)', color: 'var(--foreground)', borderColor: 'var(--border)' }}
          />
          <span
            className="rounded-full px-3 py-1 text-xs font-medium"
            style={{
              backgroundColor: monthStatus === 'FROZEN' ? '#fee2e2' : monthStatus === 'FINALIZED' ? '#fef9c3' : '#dcfce7',
              color: monthStatus === 'FROZEN' ? '#991b1b' : monthStatus === 'FINALIZED' ? '#854d0e' : '#166534',
            }}
          >
            {monthStatus === 'FROZEN' ? `🔒 ${year}-${String(month).padStart(2, '0')} Frozen` : `${year}-${String(month).padStart(2, '0')} ${monthStatus}`}
          </span>
          {monthStatus === 'FROZEN' && (
            <button
              onClick={() => setReopenModalOpen(true)}
              className="rounded-lg border px-3 py-2 text-sm font-medium"
              style={{ borderColor: 'var(--border)', color: 'var(--foreground)' }}
            >
              Reopen this period
            </button>
          )}
        </div>
      </div>

      {error && (
        <div className="rounded-lg px-3 py-2 text-sm" style={{ backgroundColor: '#fef2f2', color: '#dc2626', border: '1px solid #fecaca' }}>
          {error}
        </div>
      )}

      {/* Device sync — the automated path: the server pulls from the biometric controller every N hours; this card shows status and lets HR run a catch-up now */}
      <div className="rounded-lg border p-4 space-y-3" style={{ borderColor: 'var(--border)', backgroundColor: 'var(--surface)' }}>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-base font-semibold" style={{ color: 'var(--foreground)' }}>
              Device Sync
            </h2>
            <p className="text-xs" style={{ color: 'var(--foreground-muted)' }}>
              {sync === null
                ? 'Loading status…'
                : !sync.configured
                  ? 'Device API is not configured on the server.'
                  : sync.scheduler
                    ? `Automatic every ${sync.scheduler.intervalHours} h from ${sync.apiUrl}. ` +
                      (sync.scheduler.running
                        ? 'A run is in progress.'
                        : sync.scheduler.nextRunAt
                          ? `Next run ${new Date(sync.scheduler.nextRunAt).toLocaleString()}.`
                          : '')
                    : `Device API ${sync.apiUrl} configured; scheduler starts with the server.`}
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <input
              type="date"
              value={syncRange.start}
              onChange={(e) => setSyncRange((r) => ({ ...r, start: e.target.value }))}
              className="rounded-lg border px-3 py-2 text-sm"
              style={{ backgroundColor: 'var(--surface)', color: 'var(--foreground)', borderColor: 'var(--border)' }}
            />
            <span className="text-xs" style={{ color: 'var(--foreground-muted)' }}>
              to
            </span>
            <input
              type="date"
              value={syncRange.end}
              onChange={(e) => setSyncRange((r) => ({ ...r, end: e.target.value }))}
              className="rounded-lg border px-3 py-2 text-sm"
              style={{ backgroundColor: 'var(--surface)', color: 'var(--foreground)', borderColor: 'var(--border)' }}
            />
            <button
              onClick={runSyncNow}
              disabled={syncBusy || sync?.configured === false}
              className="rounded-lg px-3 py-2 text-sm font-medium text-white disabled:opacity-50"
              style={{ backgroundColor: 'var(--accent)' }}
            >
              {syncBusy ? 'Syncing…' : 'Sync now'}
            </button>
          </div>
        </div>

        {syncMsg && (
          <div className="rounded-lg px-3 py-2 text-sm" style={{ backgroundColor: syncMsg.startsWith('Sync failed') ? '#fef2f2' : '#f0fdf4', color: syncMsg.startsWith('Sync failed') ? '#dc2626' : '#166534', border: `1px solid ${syncMsg.startsWith('Sync failed') ? '#fecaca' : '#bbf7d0'}` }}>
            {syncMsg}
          </div>
        )}

        {sync && sync.runs.length > 0 && (
          <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
            <div className="overflow-x-auto rounded-lg border" style={{ borderColor: 'var(--border)' }}>
              <table className="w-full text-xs">
                <thead>
                  <tr style={{ backgroundColor: 'var(--surface-hover)', color: 'var(--foreground-muted)' }}>
                    {['When', 'Trigger', 'Range', 'Result', 'Rows', 'New', 'Upd', 'Same', 'Frozen'].map((h) => (
                      <th key={h} className="whitespace-nowrap px-2 py-1.5 text-left font-medium">
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {sync.runs.map((r) => (
                    <tr key={r.id} style={{ borderTop: '1px solid var(--border)', color: 'var(--foreground)' }} title={r.error ?? undefined}>
                      <td className="whitespace-nowrap px-2 py-1.5">{new Date(r.startedAt).toLocaleString()}</td>
                      <td className="px-2 py-1.5">{r.trigger}</td>
                      <td className="whitespace-nowrap px-2 py-1.5">
                        {r.rangeStart.slice(0, 10)} → {r.rangeEnd.slice(0, 10)}
                      </td>
                      <td className="px-2 py-1.5" style={{ color: r.status === 'success' ? '#166534' : r.status === 'failed' ? '#b91c1c' : undefined }}>
                        {r.status}
                        {r.error ? ' ⚠' : ''}
                      </td>
                      <td className="px-2 py-1.5 tabular-nums">{r.rowsFetched}</td>
                      <td className="px-2 py-1.5 tabular-nums">{r.daysCreated}</td>
                      <td className="px-2 py-1.5 tabular-nums">{r.daysUpdated}</td>
                      <td className="px-2 py-1.5 tabular-nums">{r.daysUnchanged}</td>
                      <td className="px-2 py-1.5 tabular-nums">{r.skippedFrozen}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="rounded-lg border p-3" style={{ borderColor: 'var(--border)' }}>
              <div className="mb-1 text-xs font-semibold uppercase tracking-wide" style={{ color: 'var(--foreground-muted)' }}>
                Unmatched device IDs (latest run)
              </div>
              {sync.unmatched.length === 0 ? (
                <p className="text-sm" style={{ color: 'var(--foreground-muted)' }}>
                  Every device user matched an employee.
                </p>
              ) : (
                <>
                  <p className="mb-2 text-xs" style={{ color: 'var(--foreground-muted)' }}>
                    Enter the device ID as the employee&apos;s Employee Code to map them; the next sync picks it up.
                  </p>
                  <ul className="flex flex-wrap gap-1.5">
                    {sync.unmatched.map((u) => (
                      <li key={u.userid} className="rounded-full border px-2 py-0.5 text-xs" style={{ borderColor: 'var(--border)', color: 'var(--foreground)' }} title={`${u.days} day(s) in range`}>
                        <span className="font-mono">{u.userid}</span> {u.username}
                      </li>
                    ))}
                  </ul>
                </>
              )}
            </div>
          </div>
        )}
      </div>

      <DataTable columns={columns} data={rows.map((r) => ({ ...r }))} loading={loading} emptyMessage="No biometric data imported for this date." />

      {/* Bulk upload — the fallback path for when the automated device push isn't running */}
      <div className="rounded-lg border p-4 space-y-4" style={{ borderColor: 'var(--border)', backgroundColor: 'var(--surface)' }}>
        <h2 className="text-base font-semibold" style={{ color: 'var(--foreground)' }}>
          Bulk Upload
        </h2>
        <p className="text-sm" style={{ color: 'var(--foreground-muted)' }}>
          Use this when the automated device push isn&apos;t working: download the template, fill in one row per employee per day (EMP_ID,
          Name, Date, In-Time, Out-Time), and upload it back below. Working hours and overtime are calculated automatically from the
          in/out times.
        </p>

        <div className="flex flex-wrap items-center gap-3">
          <button
            onClick={downloadTemplate}
            className="rounded-lg border px-3 py-2 text-sm font-medium"
            style={{ borderColor: 'var(--border)', color: 'var(--foreground)' }}
          >
            Download Template
          </button>
          <input
            type="file"
            accept=".csv"
            onChange={(e) => setUploadedFile(e.target.files?.[0] ?? null)}
            className="text-sm"
            style={{ color: 'var(--foreground)' }}
          />
          {uploadedFile && (
            <span className="text-xs" style={{ color: 'var(--foreground-muted)' }}>
              {uploadedFile.name}
            </span>
          )}
        </div>

        <div className="flex flex-wrap items-end gap-3">
          <div className="flex flex-col gap-1">
            <label className="text-xs font-medium" style={{ color: 'var(--foreground-muted)' }}>
              Source Tag
            </label>
            <select
              value={fromWhere}
              onChange={(e) => setFromWhere(e.target.value as 'MANUAL' | 'BIOMETRIC')}
              className="rounded-lg border px-3 py-2 text-sm"
              style={{ backgroundColor: 'var(--surface)', color: 'var(--foreground)', borderColor: 'var(--border)' }}
            >
              <option value="MANUAL">Manual</option>
              <option value="BIOMETRIC">Biometric</option>
            </select>
          </div>
          <button
            onClick={handleImport}
            disabled={importing}
            className="rounded-lg px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
            style={{ backgroundColor: 'var(--accent)' }}
          >
            {importing ? 'Importing...' : 'Parse & Import'}
          </button>
        </div>

        {importError && (
          <div className="rounded-lg px-3 py-2 text-sm" style={{ backgroundColor: '#fef2f2', color: '#dc2626', border: '1px solid #fecaca' }}>
            {importError}
          </div>
        )}
        {importResult && (
          <div className="rounded-lg px-3 py-2 text-sm space-y-1" style={{ backgroundColor: '#f0fdf4', color: '#166534', border: '1px solid #bbf7d0' }}>
            <div>
              Processed {importResult.monthsProcessed} month{importResult.monthsProcessed === 1 ? '' : 's'}, {importResult.imported} employee-period
              row(s) imported.
            </div>
            <div>Unmatched EMP_IDs: {importResult.unmatched}</div>
            {importResult.duplicatesMerged > 0 && (
              <div>Duplicate rows for the same employee/period merged: {importResult.duplicatesMerged}</div>
            )}
            <div>
              Pushed to Daily Attendance: {importResult.converted} day(s), skipped (frozen month): {importResult.skippedFrozen}, unparseable
              punch times: {importResult.unmatchedTimes}
            </div>
            {importResult.rowErrors.length > 0 && (
              <div>
                Row warnings ({importResult.rowErrors.length}):
                <ul className="list-disc pl-5">
                  {importResult.rowErrors.slice(0, 10).map((e, i) => (
                    <li key={i}>{e}</li>
                  ))}
                </ul>
              </div>
            )}
            {importResult.apiErrors.length > 0 && (
              <div style={{ color: '#dc2626' }}>
                Errors: {importResult.apiErrors.join('; ')}
              </div>
            )}
          </div>
        )}
      </div>

      <FormModal
        title="Reopen Period"
        fields={reopenFields}
        initialValues={{}}
        isOpen={reopenModalOpen}
        onClose={() => setReopenModalOpen(false)}
        onSubmit={async (values) => {
          const res = await fetch('/api/workforce/attendance/monthly/reopen', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ year, month, reason: values.reason }),
          });
          const json = await res.json();
          if (!res.ok) throw new Error(json.error ?? 'Reopen failed');
          fetchViewer();
        }}
        submitLabel="Reopen"
      />
    </div>
  );
}
