/**
 * Dashboard — Statutory Summary
 *
 * Shows PF, ESI, PT, TDS, LWF totals from the latest payroll run.
 */

'use client';

import { useState, useEffect, useCallback } from 'react';
import { KPIGrid, KPICard, Spinner } from '@/components/ui';

interface StatData {
  pfEmployee: number; pfEmployer: number;
  esiEmployee: number; esiEmployer: number;
  professionalTax: number; tds: number; lwf: number;
}

export default function StatutorySummaryPage() {
  const [data, setData] = useState<StatData | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const now = new Date();
      const res = await fetch(`/api/reports/payroll-summary?year=${now.getFullYear()}&month=${now.getMonth() + 1}`);
      if (!res.ok) { setData(null); return; }
      const json = await res.json();
      const t = json.totals ?? {};
      setData({
        pfEmployee: t.pfEmployee ?? 0, pfEmployer: t.pfEmployer ?? 0,
        esiEmployee: t.esiEmployee ?? 0, esiEmployer: t.esiEmployer ?? 0,
        professionalTax: t.professionalTax ?? 0, tds: t.tds ?? 0, lwf: t.lwfAmount ?? 0,
      });
    } catch {} finally { setLoading(false); }
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  const fmt = (v: number) => `₹${v.toLocaleString('en-IN', { minimumFractionDigits: 2 })}`;

  return (
    <div className="space-y-6">
      <h1 className="text-xl font-semibold" style={{ color: 'var(--foreground)' }}>Statutory Summary</h1>
      {loading ? <Spinner /> : data ? (
        <>
          <KPIGrid>
            <KPICard label="PF (Employee)" value={fmt(data.pfEmployee)} tone="info" />
            <KPICard label="PF (Employer)" value={fmt(data.pfEmployer)} tone="info" />
            <KPICard label="ESI (Employee)" value={fmt(data.esiEmployee)} tone="info" />
            <KPICard label="ESI (Employer)" value={fmt(data.esiEmployer)} tone="info" />
          </KPIGrid>
          <KPIGrid>
            <KPICard label="Professional Tax" value={fmt(data.professionalTax)} tone="warning" />
            <KPICard label="TDS" value={fmt(data.tds)} tone="danger" />
            <KPICard label="LWF" value={fmt(data.lwf)} tone="info" />
            <KPICard label="Total Statutory" value={fmt(data.pfEmployee + data.pfEmployer + data.esiEmployee + data.esiEmployer + data.professionalTax + data.tds + data.lwf)} tone="success" />
          </KPIGrid>
        </>
      ) : <div className="text-sm" style={{ color: 'var(--foreground-muted)' }}>No payroll data for the current month.</div>}
    </div>
  );
}
