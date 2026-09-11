/**
 * Dashboard — Headcount (Department-wise)
 *
 * Shows headcount breakdown by department.
 */

'use client';

import { useState, useEffect, useCallback } from 'react';
import { KPIGrid, KPICard, Spinner } from '@/components/ui';

interface HeadcountData {
  totalHeadcount: number;
  byDepartment: Array<{ department: string; count: number }>;
}

export default function HeadcountDashboardPage() {
  const [data, setData] = useState<HeadcountData | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/reports/headcount');
      if (!res.ok) return;
      setData(await res.json());
    } catch {} finally { setLoading(false); }
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  const maxCount = data ? Math.max(...data.byDepartment.map((d) => d.count), 1) : 1;

  return (
    <div className="space-y-6">
      <h1 className="text-xl font-semibold" style={{ color: 'var(--foreground)' }}>Headcount (Department-wise)</h1>
      {loading ? <Spinner /> : data ? (
        <>
          <KPIGrid>
            <KPICard label="Total Headcount" value={data.totalHeadcount} tone="info" />
            <KPICard label="Departments" value={data.byDepartment.length} tone="info" />
          </KPIGrid>
          <div className="rounded-lg border p-4" style={{ borderColor: 'var(--border)' }}>
            <h2 className="mb-3 text-sm font-semibold" style={{ color: 'var(--foreground)' }}>By Department</h2>
            <div className="space-y-2">
              {data.byDepartment.map((d) => (
                <div key={d.department} className="flex items-center gap-3">
                  <span className="w-40 text-sm truncate" style={{ color: 'var(--foreground)' }}>{d.department}</span>
                  <div className="flex-1 rounded-full" style={{ backgroundColor: 'var(--surface)', height: 24 }}>
                    <div className="h-full rounded-full" style={{ width: `${(d.count / maxCount) * 100}%`, backgroundColor: 'var(--primary)' }} />
                  </div>
                  <span className="w-10 text-right text-sm font-medium" style={{ color: 'var(--foreground)' }}>{d.count}</span>
                </div>
              ))}
            </div>
          </div>
        </>
      ) : <div className="text-sm" style={{ color: 'var(--foreground-muted)' }}>No data available.</div>}
    </div>
  );
}
