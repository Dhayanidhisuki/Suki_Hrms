/**
 * Recruitment Reports — BRD §18.
 * Single page with tabs for 9 report types.
 */

'use client';

import { useState, useEffect, useCallback } from 'react';
import { useToast } from '@/components/ui';

const REPORT_TABS = [
  { key: 'pipeline', label: 'Applicant Pipeline' },
  { key: 'time-to-hire', label: 'Time-to-Hire' },
  { key: 'sla-breach', label: 'SLA Breach' },
  { key: 'source-wise', label: 'Source-wise' },
  { key: 'offer-acceptance', label: 'Offer Acceptance' },
  { key: 'rejection', label: 'Rejection' },
  { key: 'interviewer-perf', label: 'Interviewer Performance' },
  { key: 'joining', label: 'Joining' },
  { key: 'bgv', label: 'BGV Status' },
] as const;

type ReportKey = (typeof REPORT_TABS)[number]['key'];

interface Column {
  key: string;
  label: string;
}

const COLUMNS: Record<ReportKey, Column[]> = {
  pipeline: [
    { key: 'applicationNo', label: 'App No' },
    { key: 'name', label: 'Name' },
    { key: 'department', label: 'Department' },
    { key: 'designation', label: 'Designation' },
    { key: 'status', label: 'Status' },
    { key: 'source', label: 'Source' },
  ],
  'time-to-hire': [
    { key: 'candidate', label: 'Candidate' },
    { key: 'department', label: 'Department' },
    { key: 'designation', label: 'Designation' },
    { key: 'daysToHire', label: 'Days to Hire' },
  ],
  'sla-breach': [
    { key: 'candidate', label: 'Candidate' },
    { key: 'applicationNo', label: 'App No' },
    { key: 'stage', label: 'Stage' },
    { key: 'daysInStage', label: 'Days in Stage' },
    { key: 'slaDays', label: 'SLA (days)' },
  ],
  'source-wise': [
    { key: 'channel', label: 'Channel' },
    { key: 'total', label: 'Total' },
    { key: 'joined', label: 'Joined' },
    { key: 'conversionRate', label: 'Conversion %' },
  ],
  'offer-acceptance': [
    { key: 'offerNo', label: 'Offer No' },
    { key: 'candidate', label: 'Candidate' },
    { key: 'status', label: 'Status' },
    { key: 'proposedSalary', label: 'CTC' },
  ],
  rejection: [
    { key: 'candidate', label: 'Candidate' },
    { key: 'applicationNo', label: 'App No' },
    { key: 'department', label: 'Department' },
    { key: 'rejectedAt', label: 'Rejected At' },
    { key: 'reason', label: 'Reason' },
  ],
  'interviewer-perf': [
    { key: 'interviewer', label: 'Interviewer' },
    { key: 'candidate', label: 'Candidate' },
    { key: 'totalScore', label: 'Score' },
    { key: 'result', label: 'Result' },
    { key: 'recommendation', label: 'Recommendation' },
  ],
  joining: [
    { key: 'candidate', label: 'Candidate' },
    { key: 'department', label: 'Department' },
    { key: 'joiningDate', label: 'Joining Date' },
    { key: 'joiningStatus', label: 'Status' },
  ],
  bgv: [
    { key: 'candidate', label: 'Candidate' },
    { key: 'step', label: 'BGV Step' },
    { key: 'status', label: 'Status' },
    { key: 'performedAt', label: 'Performed At' },
  ],
};

function formatValue(row: Record<string, unknown>, key: string): string {
  const v = row[key];
  if (v === null || v === undefined) return '—';
  if (typeof v === 'object' && 'name' in (v as Record<string, unknown>)) return String((v as Record<string, unknown>).name);
  if (key.includes('Date') || key.includes('At')) {
    try { return new Date(v as string).toLocaleDateString(); } catch { return String(v); }
  }
  if (key === 'proposedSalary' || key === 'ctc') {
    const n = Number(v);
    return isNaN(n) ? String(v) : `₹${n.toLocaleString()}`;
  }
  return String(v);
}

export default function RecruitmentReportsPage() {
  const [activeReport, setActiveReport] = useState<ReportKey>('pipeline');
  const [data, setData] = useState<Record<string, unknown>[]>([]);
  const [loading, setLoading] = useState(false);
  const toast = useToast();

  const fetchData = useCallback(async (report: ReportKey) => {
    setLoading(true);
    try {
      const res = await fetch(`/api/recruitment/reports?type=${report}`);
      if (!res.ok) throw new Error((await res.json()).error ?? 'Failed to fetch');
      const json: { data: Record<string, unknown>[] } = await res.json();
      setData(json.data);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Unknown error');
      setData([]);
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    fetchData(activeReport);
  }, [activeReport, fetchData]);

  const columns = COLUMNS[activeReport];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold" style={{ color: 'var(--foreground)' }}>Recruitment Reports</h1>
        <p className="text-sm" style={{ color: 'var(--foreground-muted)' }}>BRD §18 — 9 report types.</p>
      </div>

      <div className="flex flex-wrap gap-2">
        {REPORT_TABS.map((t) => (
          <button
            key={t.key}
            onClick={() => setActiveReport(t.key)}
            className="px-3 py-1.5 rounded-lg text-sm font-medium transition-colors"
            style={{
              backgroundColor: activeReport === t.key ? 'var(--accent)' : 'var(--surface)',
              color: activeReport === t.key ? '#fff' : 'var(--foreground)',
              border: `1px solid ${activeReport === t.key ? 'var(--accent)' : 'var(--border)'}`,
            }}
          >
            {t.label}
          </button>
        ))}
      </div>

      <div className="overflow-x-auto rounded-lg border" style={{ borderColor: 'var(--border)' }}>
        <table className="w-full text-sm">
          <thead style={{ backgroundColor: 'var(--surface)' }}>
            <tr>
              {columns.map((c) => (
                <th key={c.key} className="px-4 py-2 text-left font-semibold" style={{ color: 'var(--foreground)' }}>
                  {c.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={columns.length} className="px-4 py-8 text-center" style={{ color: 'var(--foreground-muted)' }}>
                  Loading...
                </td>
              </tr>
            ) : data.length === 0 ? (
              <tr>
                <td colSpan={columns.length} className="px-4 py-8 text-center" style={{ color: 'var(--foreground-muted)' }}>
                  No data for this report.
                </td>
              </tr>
            ) : (
              data.map((row, i) => (
                <tr key={i} style={{ borderTop: '1px solid var(--border)' }}>
                  {columns.map((c) => (
                    <td key={c.key} className="px-4 py-2" style={{ color: 'var(--foreground)' }}>
                      {formatValue(row, c.key)}
                    </td>
                  ))}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <p className="text-xs" style={{ color: 'var(--foreground-muted)' }}>
        Showing {data.length} record{data.length !== 1 ? 's' : ''}.
      </p>
    </div>
  );
}
