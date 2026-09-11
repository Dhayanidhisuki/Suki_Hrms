/**
 * Dashboard — Salary Cost
 *
 * Shows total salary cost breakdown from the latest payroll runs.
 */

'use client';

import { useState, useEffect, useCallback } from 'react';
import { KPIGrid, KPICard, Spinner } from '@/components/ui';

interface SummaryData {
  totalGross: number;
  totalNet: number;
  totalDeductions: number;
  totalOT: number;
  employeeCount: number;
}

export default function SalaryCostPage() {
  const [data, setData] = useState<SummaryData | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const now = new Date();
      const res = await fetch(`/api/reports/payroll-summary?year=${now.getFullYear()}&month=${now.getMonth() + 1}`);
      if (!res.ok) { setData(null); return; }
      const json = await res.json();
      setData({
        totalGross: json.totals?.grossEarnings ?? 0,
        totalNet: json.totals?.netSalary ?? 0,
        totalDeductions: (json.totals?.pfEmployee ?? 0) + (json.totals?.esiEmployee ?? 0) +
          (json.totals?.professionalTax ?? 0) + (json.totals?.tds ?? 0) + (json.totals?.otherDeductions ?? 0) +
          (json.totals?.lomAmount ?? 0) + (json.totals?.lwfAmount ?? 0) + (json.totals?.healthInsurance ?? 0) +
          (json.totals?.licAmount ?? 0),
        totalOT: json.totals?.otAmount ?? 0,
        employeeCount: json.headcount?.ok ?? 0,
      });
    } catch {} finally { setLoading(false); }
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  return (
    <div className="space-y-6">
      <h1 className="text-xl font-semibold" style={{ color: 'var(--foreground)' }}>Salary Cost</h1>
      {loading ? <Spinner /> : data ? (
        <>
          <KPIGrid>
            <KPICard label="Total Gross" value={`₹${data.totalGross.toLocaleString('en-IN', { minimumFractionDigits: 2 })}`} tone="info" />
            <KPICard label="Total Net" value={`₹${data.totalNet.toLocaleString('en-IN', { minimumFractionDigits: 2 })}`} tone="success" />
            <KPICard label="Total Deductions" value={`₹${data.totalDeductions.toLocaleString('en-IN', { minimumFractionDigits: 2 })}`} tone="danger" />
            <KPICard label="OT Amount" value={`₹${data.totalOT.toLocaleString('en-IN', { minimumFractionDigits: 2 })}`} tone="info" />
          </KPIGrid>
          <div className="rounded-lg border p-4" style={{ borderColor: 'var(--border)' }}>
            <div className="text-sm" style={{ color: 'var(--foreground-muted)' }}>Employees Processed</div>
            <div className="text-3xl font-bold" style={{ color: 'var(--foreground)' }}>{data.employeeCount}</div>
          </div>
        </>
      ) : <div className="text-sm" style={{ color: 'var(--foreground-muted)' }}>No payroll data for the current month.</div>}
    </div>
  );
}
