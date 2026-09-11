/**
 * Dashboard — Payroll Status
 *
 * Overview of the latest payroll run status with quick KPIs.
 */

'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { KPIGrid, KPICard, Spinner } from '@/components/ui';

interface RunData {
  id: number; year: number; month: number; status: string;
  _count: { lines: number };
}

export default function PayrollStatusPage() {
  const [runs, setRuns] = useState<RunData[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/payroll/runs?limit=12');
      if (!res.ok) return;
      const json = await res.json();
      setRuns(json.data ?? []);
    } catch {} finally { setLoading(false); }
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  const latest = runs[0];
  const statusColors: Record<string, string> = {
    DRAFT: '#9ca3af', CALCULATED: '#3b82f6', VALIDATED: '#8b5cf6',
    SUBMITTED: '#f59e0b', APPROVED: '#10b981', LOCKED: '#ef4444', POSTED: '#6366f1',
  };

  return (
    <div className="space-y-6">
      <h1 className="text-xl font-semibold" style={{ color: 'var(--foreground)' }}>Payroll Status</h1>
      {loading ? <Spinner /> : latest ? (
        <>
          <KPIGrid>
            <KPICard label="Latest Period" value={`${latest.month}/${latest.year}`} tone="info" />
            <KPICard label="Status" value={latest.status} tone="info" />
            <KPICard label="Employees" value={latest._count.lines} tone="info" />
            <KPICard label="Total Runs" value={runs.length} tone="success" />
          </KPIGrid>
          <div className="rounded-lg border p-4" style={{ borderColor: 'var(--border)' }}>
            <h2 className="mb-3 text-sm font-semibold" style={{ color: 'var(--foreground)' }}>Recent Runs</h2>
            <div className="space-y-2">
              {runs.slice(0, 6).map((r) => (
                <Link key={r.id} href={`/payroll/processing/salary?runId=${r.id}`}
                  className="flex items-center justify-between rounded-lg border p-3 text-sm hover:bg-gray-50"
                  style={{ borderColor: 'var(--border)' }}>
                  <span>{new Date(2000, r.month - 1, 1).toLocaleString('default', { month: 'long' })} {r.year}</span>
                  <span className="rounded-full px-2 py-0.5 text-xs font-medium text-white"
                    style={{ backgroundColor: statusColors[r.status] ?? '#9ca3af' }}>{r.status}</span>
                  <span className="text-xs" style={{ color: 'var(--foreground-muted)' }}>{r._count.lines} emp</span>
                </Link>
              ))}
            </div>
          </div>
        </>
      ) : <div className="text-sm" style={{ color: 'var(--foreground-muted)' }}>No payroll runs found.</div>}
    </div>
  );
}
