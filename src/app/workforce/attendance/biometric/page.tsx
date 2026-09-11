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

import { useState, useEffect, useCallback, useMemo, type ReactNode } from 'react';
import { DataTable, FormModal, type Column, type FieldDef } from '@/components/ui';

/* ── Icons (inline; no icon library in this project) ──────────────────── */
const Icon = {
  Calendar: () => (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M8 2v4" /><path d="M16 2v4" /><rect width="18" height="18" x="3" y="4" rx="2" /><path d="M3 10h18" />
    </svg>
  ),
  Refresh: () => (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 12a9 9 0 0 0-9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" /><path d="M3 3v5h5" />
      <path d="M3 12a9 9 0 0 0 9 9 9.75 9.75 0 0 0 6.74-2.74L21 16" /><path d="M16 16h5v5" />
    </svg>
  ),
  Download: () => (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" /><path d="m7 10 5 5 5-5" /><path d="M12 15V3" />
    </svg>
  ),
  File: () => (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7Z" /><path d="M14 2v4a2 2 0 0 0 2 2h4" />
    </svg>
  ),
  Upload: () => (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" /><path d="m17 8-5-5-5 5" /><path d="M12 3v12" />
    </svg>
  ),
  Check: () => (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
      <path d="M20 6 9 17l-5-5" />
    </svg>
  ),
  X: () => (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
      <path d="M18 6 6 18" /><path d="m6 6 12 12" />
    </svg>
  ),
};

/** Small rounded pill — used for status/result/count badges throughout this page. */
function Pill({ tone, icon, children }: { tone: 'success' | 'danger' | 'warning' | 'neutral'; icon?: ReactNode; children: ReactNode }) {
  const map = {
    success: { bg: 'var(--success-soft)', fg: 'var(--success)' },
    danger: { bg: 'var(--danger-soft)', fg: 'var(--danger)' },
    warning: { bg: 'var(--warning-soft)', fg: 'var(--warning)' },
    neutral: { bg: 'var(--surface-muted)', fg: 'var(--foreground-muted)' },
  }[tone];
  return (
    <span
      className="inline-flex items-center gap-1 whitespace-nowrap rounded-full px-2.5 py-1 text-xs font-medium"
      style={{ backgroundColor: map.bg, color: map.fg }}
    >
      {icon}
      {children}
    </span>
  );
}

/** Card wrapper matching the mockup — white rounded card, optional header row. */
function Card({ title, subtitle, headerExtra, action, children }: { title?: string; subtitle?: ReactNode; headerExtra?: ReactNode; action?: ReactNode; children: ReactNode }) {
  return (
    <div className="rounded-xl border" style={{ borderColor: 'var(--border)', backgroundColor: 'var(--surface)' }}>
      {(title || action) && (
        <div className="flex flex-wrap items-start justify-between gap-3 border-b p-4" style={{ borderColor: 'var(--border)' }}>
          <div>
            <div className="flex items-center gap-2">
              {title && (
                <h2 className="text-base font-semibold" style={{ color: 'var(--foreground)' }}>
                  {title}
                </h2>
              )}
              {headerExtra}
            </div>
            {subtitle && (
              <p className="mt-1 text-xs" style={{ color: 'var(--foreground-muted)' }}>
                {subtitle}
              </p>
            )}
          </div>
          {action}
        </div>
      )}
      <div className="p-4">{children}</div>
    </div>
  );
}

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
    { key: 'empIdRaw', label: 'Employee ID' },
    {
      key: 'matchedEmployee',
      label: 'Employee Name',
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
    { key: 'inTimeRaw', label: 'In Time', render: (r) => formatRawTime(r.inTimeRaw) },
    { key: 'outTimeRaw', label: 'Out Time', render: (r) => formatRawTime(r.outTimeRaw) },
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

  const sNoColumns: Column<ImportRow & { id: number; sNo: number }>[] = [
    { key: 'sNo', label: 'S.No' },
    ...columns,
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
  const [showAllUnmatched, setShowAllUnmatched] = useState(false);
  const UNMATCHED_PREVIEW = 6;
  const [testBusy, setTestBusy] = useState(false);
  const [testResult, setTestResult] = useState<{ ok: boolean; text: string } | null>(null);

  /** One probe to the device API — tells HR whether the box is reachable before they hit Sync Now. */
  const testConnection = async () => {
    setTestBusy(true);
    setTestResult(null);
    try {
      const res = await fetch('/api/biometric/sync?test=1');
      const json = (await res.json()) as { ok: boolean; url: string; httpStatus: number | null; ms: number; rows?: number; error?: string };
      setTestResult(
        json.ok
          ? { ok: true, text: `Device API at ${json.url} is reachable (HTTP ${json.httpStatus}, ${json.ms} ms${json.rows !== undefined ? `, ${json.rows} rows today` : ''}).` }
          : { ok: false, text: json.error ?? 'Device API is not reachable.' }
      );
    } catch (err) {
      setTestResult({ ok: false, text: err instanceof Error ? err.message : 'Connection test failed' });
    } finally {
      setTestBusy(false);
    }
  };

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

  // ── Derived display bits ─────────────────────────────────────────────────
  const latestRun = sync?.runs[0] ?? null;
  const monthLabel = `${year}-${String(month).padStart(2, '0')}`;
  const monthTone = monthStatus === 'FROZEN' ? 'danger' : monthStatus === 'FINALIZED' ? 'success' : 'neutral';
  const monthText = monthStatus === 'FROZEN' ? 'Frozen' : monthStatus === 'FINALIZED' ? 'Finalized' : 'Open';
  const unmatchedShown = showAllUnmatched ? (sync?.unmatched ?? []) : (sync?.unmatched ?? []).slice(0, UNMATCHED_PREVIEW);
  /** "2026-09-07" (or ISO) -> "7/9/2026" like the mockup's range column. */
  const dmy = (iso: string) => {
    const [y, m, d] = iso.slice(0, 10).split('-').map(Number);
    return `${d}/${m}/${y}`;
  };
  const inputStyle = { backgroundColor: 'var(--surface)', color: 'var(--foreground)', borderColor: 'var(--border)' };
  const th = 'whitespace-nowrap px-3 py-2.5 text-left text-xs font-medium';
  const td = 'px-3 py-2.5 text-sm';

  return (
    <div className="space-y-5">
      {/* ── Page header ─────────────────────────────────────────────────── */}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold" style={{ color: 'var(--foreground)' }}>
            Biometric Attendance
          </h1>
          <p className="mt-1 text-sm" style={{ color: 'var(--foreground-muted)' }}>
            Manage device sync and attendance records
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <label
            className="inline-flex items-center gap-2 rounded-lg border px-3 py-2 text-sm"
            style={inputStyle}
          >
            <input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className="bg-transparent outline-none"
              style={{ color: 'var(--foreground)' }}
            />
            <span style={{ color: 'var(--foreground-muted)' }}>
              <Icon.Calendar />
            </span>
          </label>
          <span
            className="rounded-lg px-4 py-2 text-sm font-medium"
            style={{
              backgroundColor: monthTone === 'danger' ? 'var(--danger-soft)' : monthTone === 'success' ? 'var(--success-soft)' : 'var(--surface-muted)',
              color: monthTone === 'danger' ? 'var(--danger)' : monthTone === 'success' ? 'var(--success)' : 'var(--foreground-muted)',
            }}
          >
            {monthStatus === 'FROZEN' ? '🔒 ' : ''}
            {monthLabel} {monthText}
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
        <div className="rounded-lg px-3 py-2 text-sm" style={{ backgroundColor: 'var(--danger-soft)', color: 'var(--danger)' }}>
          {error}
        </div>
      )}

      {/* ── Device Sync ─────────────────────────────────────────────────── */}
      <Card
        title="Device Sync"
        headerExtra={
          latestRun ? (
            latestRun.status === 'success' ? (
              <Pill tone="success" icon={<Icon.Check />}>Last sync successful</Pill>
            ) : (
              <Pill tone="danger" icon={<Icon.X />}>Last sync failed</Pill>
            )
          ) : null
        }
        subtitle={
          sync === null
            ? 'Loading status…'
            : !sync.configured
              ? 'Device API is not configured on the server.'
              : sync.scheduler
                ? (sync.scheduler.running
                  ? 'A sync is in progress. '
                  : latestRun?.startedAt
                    ? `Last sync: ${new Date(latestRun.finishedAt ?? latestRun.startedAt).toLocaleString()}. `
                    : 'No sync has run yet. ') +
                  (sync.scheduler.nextRunAt
                    ? `Next sync: ${new Date(sync.scheduler.nextRunAt).toLocaleString()}.`
                    : '')
                : `Device API ${sync.apiUrl} configured; scheduler starts with the server.`
        }
        action={
          <div className="flex flex-wrap items-center gap-2">
            <div className="inline-flex items-center gap-2 rounded-lg border px-3 py-2 text-sm" style={inputStyle}>
              <input
                type="date"
                value={syncRange.start}
                onChange={(e) => setSyncRange((r) => ({ ...r, start: e.target.value }))}
                className="bg-transparent outline-none"
                style={{ color: 'var(--foreground)' }}
              />
              <span style={{ color: 'var(--foreground-muted)' }}>→</span>
              <input
                type="date"
                value={syncRange.end}
                onChange={(e) => setSyncRange((r) => ({ ...r, end: e.target.value }))}
                className="bg-transparent outline-none"
                style={{ color: 'var(--foreground)' }}
              />
              <span style={{ color: 'var(--foreground-muted)' }}>
                <Icon.Calendar />
              </span>
            </div>
            <button
              onClick={testConnection}
              disabled={testBusy || sync?.configured === false}
              title="Send one request to the device API and report whether it answers"
              className="rounded-lg border px-3 py-2 text-sm font-medium transition hover:opacity-80 disabled:opacity-50"
              style={{ borderColor: 'var(--accent)', color: 'var(--accent)', backgroundColor: 'var(--surface)' }}
            >
              {testBusy ? 'Testing…' : 'Test Connection'}
            </button>
            <button
              onClick={runSyncNow}
              disabled={syncBusy || sync?.configured === false}
              className="inline-flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-semibold text-white transition hover:opacity-90 disabled:opacity-50"
              style={{ backgroundColor: 'var(--accent)' }}
            >
              <span className={syncBusy ? 'animate-spin' : ''}>
                <Icon.Refresh />
              </span>
              {syncBusy ? 'Syncing…' : 'Sync Now'}
            </button>
          </div>
        }
      >
        {testResult && (
          <div
            className="mb-4 rounded-lg px-3 py-2 text-sm"
            style={{
              backgroundColor: testResult.ok ? 'var(--success-soft)' : 'var(--danger-soft)',
              color: testResult.ok ? 'var(--success)' : 'var(--danger)',
            }}
          >
            {testResult.text}
          </div>
        )}
        {syncMsg && (
          <div
            className="mb-4 rounded-lg px-3 py-2 text-sm"
            style={{
              backgroundColor: syncMsg.startsWith('Sync failed') ? 'var(--danger-soft)' : 'var(--success-soft)',
              color: syncMsg.startsWith('Sync failed') ? 'var(--danger)' : 'var(--success)',
            }}
          >
            {syncMsg}
          </div>
        )}

        <div className="grid grid-cols-1 gap-4 xl:grid-cols-[1.6fr_1fr]">
          {/* Sync history */}
          <div className="rounded-xl border" style={{ borderColor: 'var(--border)' }}>
            <div className="flex items-center gap-2 px-4 py-3">
              <h3 className="text-base font-semibold" style={{ color: 'var(--foreground)' }}>
                Sync History
              </h3>
              {sync && <Pill tone="success">Recent {sync.runs.length} records</Pill>}
            </div>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr style={{ backgroundColor: 'var(--surface-hover)', color: 'var(--foreground-muted)' }}>
                    {['S.No', 'When', 'Trigger', 'Range', 'Result', 'Rows', 'New', 'Upd', 'Same', 'Frozen'].map((h) => (
                      <th key={h} className={th}>
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {!sync || sync.runs.length === 0 ? (
                    <tr>
                      <td colSpan={10} className="px-4 py-8 text-center text-sm" style={{ color: 'var(--foreground-muted)' }}>
                        {sync === null ? 'Loading…' : 'No sync runs yet.'}
                      </td>
                    </tr>
                  ) : (
                    sync.runs.map((r, i) => (
                      <tr key={r.id} style={{ borderTop: '1px solid var(--border)', color: 'var(--foreground)' }} title={r.error ?? undefined}>
                        <td className={td}>{i + 1}</td>
                        <td className={`${td} whitespace-nowrap`}>{new Date(r.startedAt).toLocaleString()}</td>
                        <td className={`${td} capitalize`}>{r.trigger}</td>
                        <td className={`${td} whitespace-nowrap`}>
                          {dmy(r.rangeStart)} → {dmy(r.rangeEnd)}
                        </td>
                        <td className={td}>
                          {r.status === 'success' ? (
                            <Pill tone="success" icon={<Icon.Check />}>Success</Pill>
                          ) : r.status === 'failed' ? (
                            <Pill tone="danger" icon={<Icon.X />}>Failed</Pill>
                          ) : (
                            <Pill tone="warning">{r.status}</Pill>
                          )}
                        </td>
                        <td className={`${td} tabular-nums`}>{r.rowsFetched}</td>
                        <td className={`${td} tabular-nums`}>{r.daysCreated}</td>
                        <td className={`${td} tabular-nums`}>{r.daysUpdated}</td>
                        <td className={`${td} tabular-nums`}>{r.daysUnchanged}</td>
                        <td className={`${td} tabular-nums`}>{r.skippedFrozen}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* Unmatched device IDs */}
          <div className="rounded-xl border" style={{ borderColor: 'var(--border)' }}>
            <div className="flex flex-wrap items-start justify-between gap-2 px-4 py-3">
              <div>
                <h3 className="text-base font-semibold" style={{ color: 'var(--foreground)' }}>
                  Unmatched Device IDs <span style={{ color: 'var(--accent)' }}>(Latest Run)</span>
                </h3>
                <p className="mt-0.5 text-xs" style={{ color: 'var(--foreground-muted)' }}>
                  {!sync || sync.unmatched.length === 0
                    ? 'Every device user matched an employee.'
                    : "Enter the device ID as the employee's Employee Code to map them; the next sync picks it up."}
                </p>
              </div>
              {sync && sync.unmatched.length > UNMATCHED_PREVIEW && (
                <button
                  onClick={() => setShowAllUnmatched((v) => !v)}
                  className="rounded-lg border px-3 py-1.5 text-xs font-medium"
                  style={{ borderColor: 'var(--border)', color: 'var(--foreground)' }}
                >
                  {showAllUnmatched ? 'Show Less' : 'View All'}
                </button>
              )}
            </div>
            {sync && sync.unmatched.length > 0 && (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr style={{ backgroundColor: 'var(--surface-hover)', color: 'var(--foreground-muted)' }}>
                      {['S.No', 'Device ID', 'Name', 'Status', 'Days'].map((h) => (
                        <th key={h} className={th}>
                          {h}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {unmatchedShown.map((u, i) => (
                      <tr key={u.userid} style={{ borderTop: '1px solid var(--border)', color: 'var(--foreground)' }}>
                        <td className={td}>{i + 1}</td>
                        <td className={`${td} font-mono`}>{u.userid}</td>
                        <td className={td}>{u.username || '—'}</td>
                        <td className={td}>
                          <Pill tone="danger" icon={<Icon.X />}>Unmatched</Pill>
                        </td>
                        <td className={`${td} tabular-nums`}>{u.days}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      </Card>

      {/* ── Bulk Upload ─────────────────────────────────────────────────── */}
      <Card
        title="Bulk Upload"
        subtitle="Download the template, fill in attendance details (EMP_ID, Name, Date, In-Time, Out-Time) one row per employee per day, then upload it back. Working hours and overtime are calculated automatically. Use this for manual entries when the automated device sync is not available."
      >
        <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
          {/* Step 1 */}
          <div className="rounded-xl border p-4" style={{ borderColor: 'var(--border)' }}>
            <div className="flex items-start gap-3">
              <span className="inline-flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-lg" style={{ backgroundColor: 'var(--success-soft)', color: 'var(--success)' }}>
                <Icon.Download />
              </span>
              <div>
                <div className="text-sm font-semibold" style={{ color: 'var(--foreground)' }}>Download Template</div>
                <div className="text-xs" style={{ color: 'var(--foreground-muted)' }}>Get the latest template file</div>
              </div>
            </div>
            <button
              onClick={downloadTemplate}
              className="mt-4 inline-flex w-full items-center justify-center gap-2 rounded-lg border px-3 py-2 text-xs font-medium transition hover:opacity-80"
              style={{ borderColor: 'var(--accent)', color: 'var(--accent)', backgroundColor: 'var(--success-soft)' }}
            >
              <Icon.Upload />
              Download Template
            </button>
          </div>

          {/* Step 2 */}
          <div className="rounded-xl border p-4" style={{ borderColor: 'var(--border)' }}>
            <div className="flex items-start gap-3">
              <span className="inline-flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-lg" style={{ backgroundColor: 'var(--success-soft)', color: 'var(--success)' }}>
                <Icon.File />
              </span>
              <div>
                <div className="text-sm font-semibold" style={{ color: 'var(--foreground)' }}>Choose File</div>
                <div className="text-xs" style={{ color: 'var(--foreground-muted)' }}>Select the filled template file</div>
              </div>
            </div>
            <label
              className="mt-4 flex w-full cursor-pointer items-center justify-center gap-2 rounded-lg border border-dashed px-3 py-2 text-xs font-medium transition hover:opacity-80"
              style={{ borderColor: 'var(--accent)', color: 'var(--accent)' }}
            >
              <Icon.Upload />
              <span className="truncate">{uploadedFile ? uploadedFile.name : 'Choose File'}</span>
              <input type="file" accept=".csv" className="hidden" onChange={(e) => setUploadedFile(e.target.files?.[0] ?? null)} />
            </label>
          </div>

          {/* Step 3 */}
          <div className="rounded-xl border p-4" style={{ borderColor: 'var(--border)' }}>
            <div className="flex items-start gap-3">
              <span className="inline-flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-lg" style={{ backgroundColor: 'var(--success-soft)', color: 'var(--success)' }}>
                <Icon.File />
              </span>
              <div>
                <div className="text-sm font-semibold" style={{ color: 'var(--foreground)' }}>Parse &amp; Import</div>
                <div className="text-xs" style={{ color: 'var(--foreground-muted)' }}>Validate and import data</div>
              </div>
            </div>
            <div className="mt-4 flex flex-wrap items-center gap-2">
              <label className="text-xs" style={{ color: 'var(--foreground)' }}>Source Tag</label>
              <select
                value={fromWhere}
                onChange={(e) => setFromWhere(e.target.value as 'MANUAL' | 'BIOMETRIC')}
                className="rounded-lg border px-2 py-1.5 text-xs"
                style={inputStyle}
              >
                <option value="MANUAL">Manual</option>
                <option value="BIOMETRIC">Biometric</option>
              </select>
              <button
                onClick={handleImport}
                disabled={importing}
                className="ml-auto inline-flex items-center gap-2 rounded-lg px-3 py-2 text-xs font-semibold text-white transition hover:opacity-90 disabled:opacity-50"
                style={{ backgroundColor: 'var(--accent)' }}
              >
                <Icon.Upload />
                {importing ? 'Importing…' : 'Parse & Import'}
              </button>
            </div>
          </div>
        </div>

        {importError && (
          <div className="mt-4 rounded-lg px-3 py-2 text-sm" style={{ backgroundColor: 'var(--danger-soft)', color: 'var(--danger)' }}>
            {importError}
          </div>
        )}
        {importResult && (
          <div className="mt-4 space-y-1 rounded-lg px-3 py-2 text-sm" style={{ backgroundColor: 'var(--success-soft)', color: 'var(--success)' }}>
            <div>
              Processed {importResult.monthsProcessed} month{importResult.monthsProcessed === 1 ? '' : 's'}, {importResult.imported} employee-period
              row(s) imported.
            </div>
            <div>Unmatched EMP_IDs: {importResult.unmatched}</div>
            {importResult.duplicatesMerged > 0 && <div>Duplicate rows for the same employee/period merged: {importResult.duplicatesMerged}</div>}
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
            {importResult.apiErrors.length > 0 && <div style={{ color: 'var(--danger)' }}>Errors: {importResult.apiErrors.join('; ')}</div>}
          </div>
        )}
      </Card>

      {/* ── Latest Updated Attendance Details ─────────────────────────────── */}
      <Card
        title="Latest Updated Attendance Details"
        subtitle="Overview of the latest attendance from automated biometric sync and manual bulk uploads. New syncs or uploads replace the previous values for the same employee and period."
        action={<Pill tone="success">{rows.length} records Found</Pill>}
      >
        <DataTable
          columns={sNoColumns}
          data={rows.map((r, i) => ({ ...r, sNo: i + 1 }))}
          loading={loading}
          emptyMessage="No attendance data available for this date. Sync the device or upload a file."
        />
      </Card>

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
