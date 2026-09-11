/**
 * Dashboard — Payroll Processing Status
 *
 * Shows the status of all payroll runs for the current company, with
 * KPI summary and a table of runs by period.
 */

'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { KPIGrid, KPICard, DataTable, Spinner } from '@/components/ui';
import type { Column } from '@/components/ui';

interface PayrollRunRow {
  id: number;
  year: number;
  month: number;
  status: string;
  _count: { lines: number };
}

export default function PayrollProcessingStatusPage() {
  const [runs, setRuns] = useState<PayrollRunRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    setLoading(true); setError(null);
    try {
      const res = await fetch('/api/payroll/runs?limit=50');
      if (!res.ok) throw new Error('Failed to fetch');
      const json = await res.json();
      setRuns(json.data ?? []);
    } catch (err) { setError(err instanceof Error ? err.message : 'Error'); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  const statusColors: Record<string, string> = {
    DRAFT: '#9ca3af', CALCULATED: '#3b82f6', VALIDATED: '#8b5cf6',
    SUBMITTED: '#f59e0b', APPROVED: '#10b981', LOCKED: '#ef4444', POSTED: '#6366f1',
  };

  const counts = {
    draft: runs.filter((r) => r.status === 'DRAFT').length,
    calculated: runs.filter((r) => r.status === 'CALCULATED').length,
    approved: runs.filter((r) => r.status === 'APPROVED').length,
    posted: runs.filter((r) => r.status === 'POSTED').length,
  };

  const columns: Column<PayrollRunRow>[] = [
    { key: 'year', label: 'Year', sortable: true },
    { key: 'month', label: 'Month', render: (r) => new Date(2000, r.month - 1, 1).toLocaleString('default', { month: 'long' }) },
    { key: 'status', label: 'Status', render: (r) => (
      <span className="rounded-full px-2 py-0.5 text-xs font-medium text-white" style={{ backgroundColor: statusColors[r.status] ?? '#9ca3af' }}>
        {r.status}
      </span>
    )},
    { key: '_count', label: 'Employees', render: (r) => r._count.lines },
    { key: 'id', label: 'Action', render: (r) => (
      <Link href={`/payroll/processing/salary?runId=${r.id}`} className="text-xs font-medium text-blue-600 hover:underline">
        Open →
      </Link>
    )},
  ];

  return (
    <div className="space-y-6">
      <h1 className="text-xl font-semibold" style={{ color: 'var(--foreground)' }}>Payroll Processing Status</h1>
      {error && <div className="rounded-lg border border-red-300 bg-red-50 p-3 text-sm text-red-700">{error}</div>}
      {loading ? <Spinner /> : (
        <>
          <KPIGrid>
            <KPICard label="Draft" value={counts.draft} tone="info" />
            <KPICard label="Calculated" value={counts.calculated} tone="info" />
            <KPICard label="Approved" value={counts.approved} tone="success" />
            <KPICard label="Posted" value={counts.posted} tone="info" />
          </KPIGrid>
          <DataTable columns={columns} data={runs} loading={loading} emptyMessage="No payroll runs found." />
        </>
      )}
    </div>
  );
}
