'use client';

/**
 * Training Reports (BRD §41) — generic report viewer. Pick a report type,
 * optional date range, then render the columns/rows returned by
 * /api/training-reports and export to CSV.
 */

import { useState } from 'react';
import { DataTable, SectionCard } from '@/components/ui';
import type { Column } from '@/components/ui';
import { exportCsv } from '@/lib/exportCsv';
import { exportXlsx } from '@/lib/exportXlsx';

type Cell = string | number | null;
interface ReportData { type: string; columns: string[]; rows: Cell[][] }

const REPORTS = [
  { value: 'schedule-list', label: 'Schedule List' },
  { value: 'employee-history', label: 'Employee Training History' },
  { value: 'department-wise', label: 'Department-wise Nominations' },
  { value: 'hours', label: 'Training Hours (Monthly)' },
  { value: 'cost', label: 'Training Cost' },
  { value: 'budget', label: 'Budget Utilization' },
  { value: 'effectiveness', label: 'Effectiveness' },
  { value: 'certification', label: 'Certification Register' },
  { value: 'assessment-results', label: 'Assessment Results' },
  { value: 'attendance', label: 'Attendance Register' },
  { value: 'planned-vs-actual', label: 'Planned vs Actual' },
  { value: 'annual', label: 'Annual Training Report' },
  { value: 'monthly', label: 'Monthly Training Report' },
  { value: 'tna', label: 'TNA Report' },
  { value: 'pending', label: 'Pending Training' },
  { value: 'overdue', label: 'Overdue Training' },
  { value: 'upcoming', label: 'Upcoming Training' },
  { value: 'trainer-performance', label: 'Trainer Performance' },
  { value: 'roi', label: 'Training ROI' },
  { value: 'feedback', label: 'Feedback Report' },
];

export default function TrainingReportsPage() {
  const [type, setType] = useState('schedule-list');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [report, setReport] = useState<ReportData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const run = async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({ type });
      if (from) params.set('from', from);
      if (to) params.set('to', to);
      const res = await fetch(`/api/training-reports?${params}`);
      if (!res.ok) throw new Error((await res.json()).error ?? 'Failed');
      setReport(await res.json());
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed');
      setReport(null);
    } finally {
      setLoading(false);
    }
  };

  interface RowObj { [key: string]: Cell; id: number }
  const tableData: RowObj[] = (report?.rows ?? []).map((r, i) => {
    const o: RowObj = { id: i };
    report?.columns.forEach((c, ci) => { o[c] = r[ci]; });
    return o;
  });
  const cols: Column<RowObj>[] = (report?.columns ?? []).map((c) => ({
    key: c, label: c, render: (row) => String(row[c] ?? '—'),
  }));

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-semibold" style={{ color: 'var(--foreground)' }}>Training Reports</h1>

      <SectionCard>
        <div className="flex flex-wrap items-end gap-3">
          <div>
            <label className="mb-1 block text-xs" style={{ color: 'var(--foreground-muted)' }}>Report</label>
            <select value={type} onChange={(e) => setType(e.target.value)} className="rounded border bg-transparent px-3 py-2 text-sm" style={{ borderColor: 'var(--border)' }}>
              {REPORTS.map((r) => <option key={r.value} value={r.value}>{r.label}</option>)}
            </select>
          </div>
          <div>
            <label className="mb-1 block text-xs" style={{ color: 'var(--foreground-muted)' }}>From</label>
            <input type="date" value={from} onChange={(e) => setFrom(e.target.value)} className="rounded border bg-transparent px-3 py-2 text-sm" style={{ borderColor: 'var(--border)' }} />
          </div>
          <div>
            <label className="mb-1 block text-xs" style={{ color: 'var(--foreground-muted)' }}>To</label>
            <input type="date" value={to} onChange={(e) => setTo(e.target.value)} className="rounded border bg-transparent px-3 py-2 text-sm" style={{ borderColor: 'var(--border)' }} />
          </div>
          <button onClick={run} disabled={loading} className="rounded-lg px-4 py-2 text-sm font-medium text-white disabled:opacity-50" style={{ backgroundColor: 'var(--accent)' }}>
            {loading ? 'Running…' : 'Run Report'}
          </button>
          {report && (
            <>
              <button
                onClick={() => exportCsv(`${type}.csv`, tableData.map((row) => Object.fromEntries(Object.entries(row).filter(([k]) => k !== 'id'))))}
                className="rounded-lg px-4 py-2 text-sm font-medium" style={{ border: '1px solid var(--border)', color: 'var(--foreground)' }}
              >
                Export CSV
              </button>
              <button
                onClick={() => exportXlsx(`${type}.xlsx`, tableData.map((row) => Object.fromEntries(Object.entries(row).filter(([k]) => k !== 'id'))), String(type))}
                className="rounded-lg px-4 py-2 text-sm font-medium" style={{ border: '1px solid var(--border)', color: 'var(--foreground)' }}
              >
                Export Excel
              </button>
              <button
                onClick={() => window.print()}
                className="rounded-lg px-4 py-2 text-sm font-medium" style={{ border: '1px solid var(--border)', color: 'var(--foreground)' }}
                title="Print or save as PDF via the browser print dialog"
              >
                Print / PDF
              </button>
            </>
          )}
        </div>
      </SectionCard>

      {error && <div className="rounded-lg px-3 py-2 text-sm" style={{ backgroundColor: '#fef2f2', color: '#dc2626', border: '1px solid #fecaca' }}>{error}</div>}

      {report && (
        <SectionCard title={REPORTS.find((r) => r.value === type)?.label} count={report.rows.length} flush>
          <DataTable columns={cols} data={tableData} loading={loading} emptyMessage="No rows for this report." />
        </SectionCard>
      )}
    </div>
  );
}
