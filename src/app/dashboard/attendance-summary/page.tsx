/**
 * Dashboard — Attendance Summary
 *
 * Shows attendance KPIs for the current month.
 */

'use client';

import { useState, useEffect, useCallback } from 'react';
import { KPIGrid, KPICard, Spinner } from '@/components/ui';

interface AttData {
  headcount: number;
  totals: { lopDays: number; otMinutesTotal: number; lateMinutesTotal: number; earlyOutMinutesTotal: number; payableDays: number; totalWorkingDays: number; };
}

export default function AttendanceSummaryDashboardPage() {
  const [data, setData] = useState<AttData | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const now = new Date();
      const res = await fetch(`/api/reports/attendance-summary?year=${now.getFullYear()}&month=${now.getMonth() + 1}`);
      if (!res.ok) return;
      const json = await res.json();
      setData({ headcount: json.headcount ?? 0, totals: json.totals ?? {} });
    } catch {} finally { setLoading(false); }
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  return (
    <div className="space-y-6">
      <h1 className="text-xl font-semibold" style={{ color: 'var(--foreground)' }}>Attendance Summary</h1>
      {loading ? <Spinner /> : data ? (
        <>
          <KPIGrid>
            <KPICard label="Employees" value={data.headcount} tone="info" />
            <KPICard label="Total LOP Days" value={data.totals.lopDays ?? 0} tone="danger" />
            <KPICard label="Total OT (hrs)" value={Math.round((data.totals.otMinutesTotal ?? 0) / 60)} tone="info" />
            <KPICard label="Late (min)" value={data.totals.lateMinutesTotal ?? 0} tone="warning" />
          </KPIGrid>
          <KPIGrid>
            <KPICard label="Early Out (min)" value={data.totals.earlyOutMinutesTotal ?? 0} tone="warning" />
            <KPICard label="Payable Days" value={data.totals.payableDays ?? 0} tone="success" />
            <KPICard label="Working Days" value={data.totals.totalWorkingDays ?? 0} tone="info" />
            <KPICard label="Avg LOP/Emp" value={data.headcount > 0 ? ((data.totals.lopDays ?? 0) / data.headcount).toFixed(1) : '0'} tone="danger" />
          </KPIGrid>
        </>
      ) : <div className="text-sm" style={{ color: 'var(--foreground-muted)' }}>No attendance data for the current month.</div>}
    </div>
  );
}
