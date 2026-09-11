/**
 * Dashboard — Leave Summary
 *
 * Shows leave application KPIs for the current month.
 */

'use client';

import { useState, useEffect, useCallback } from 'react';
import { KPIGrid, KPICard, Spinner } from '@/components/ui';

interface LeaveData {
  totalApplications: number;
  approved: number;
  pending: number;
  rejected: number;
  byLeaveType: Array<{ leaveType: string; count: number; days: number }>;
}

export default function LeaveSummaryDashboardPage() {
  const [data, setData] = useState<LeaveData | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const now = new Date();
      const res = await fetch(`/api/reports/leave?year=${now.getFullYear()}&month=${now.getMonth() + 1}`);
      if (!res.ok) return;
      setData(await res.json());
    } catch {} finally { setLoading(false); }
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  return (
    <div className="space-y-6">
      <h1 className="text-xl font-semibold" style={{ color: 'var(--foreground)' }}>Leave Summary</h1>
      {loading ? <Spinner /> : data ? (
        <>
          <KPIGrid>
            <KPICard label="Total Applications" value={data.totalApplications} tone="info" />
            <KPICard label="Approved" value={data.approved} tone="success" />
            <KPICard label="Pending" value={data.pending} tone="warning" />
            <KPICard label="Rejected" value={data.rejected} tone="danger" />
          </KPIGrid>
          {data.byLeaveType.length > 0 && (
            <div className="rounded-lg border p-4" style={{ borderColor: 'var(--border)' }}>
              <h2 className="mb-3 text-sm font-semibold" style={{ color: 'var(--foreground)' }}>By Leave Type</h2>
              <table className="w-full text-sm">
                <thead><tr className="border-b" style={{ borderColor: 'var(--border)' }}>
                  <th className="py-2 text-left">Leave Type</th><th className="py-2 text-right">Count</th><th className="py-2 text-right">Days</th>
                </tr></thead>
                <tbody>
                  {data.byLeaveType.map((t, i) => (
                    <tr key={i} className="border-b" style={{ borderColor: 'var(--border)' }}>
                      <td className="py-2">{t.leaveType}</td>
                      <td className="py-2 text-right">{t.count}</td>
                      <td className="py-2 text-right">{t.days}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      ) : <div className="text-sm" style={{ color: 'var(--foreground-muted)' }}>No leave data for the current month.</div>}
    </div>
  );
}
