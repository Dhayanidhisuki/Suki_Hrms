/**
 * OT & Other Incentive Report — one row per employee for a selected payroll
 * month: OT hours, OT amount, the OT Incentive Bonus (the 50/80-hour flat
 * bonus configured under Masters > OT Incentive Slabs), and every other
 * personal incentive payroll already computes: Double Machine, Shift
 * Bonus, Attendance Bonus, Petrol Allowance, Performance Incentive.
 */

'use client';

import { useState, useEffect, useCallback } from 'react';
import { DataTable, type Column } from '@/components/ui';

interface IncentiveRow {
  id: number;
  employeeCode: string;
  employeeName: string;
  department: string;
  otHours: number;
  otAmount: number;
  otIncentiveAmount: number;
  doubleMachineIncentive: number;
  shiftIncentive: number;
  attendanceBonus: number;
  petrolAllowance: number;
  performanceIncentive: number;
}

interface ReportData {
  run: { id: number; year: number; month: number; status: string };
  rows: IncentiveRow[];
  totals: Omit<IncentiveRow, 'id' | 'employeeCode' | 'employeeName' | 'department'>;
}

const money = (n: number) => n.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

const columns: Column<IncentiveRow>[] = [
  { key: 'employeeCode', label: 'Code', sortable: true, className: 'font-medium' },
  { key: 'employeeName', label: 'Name' },
  { key: 'department', label: 'Department' },
  { key: 'otHours', label: 'OT Hours', render: (r) => r.otHours.toFixed(2) },
  { key: 'otAmount', label: 'OT Amount', render: (r) => money(r.otAmount) },
  { key: 'otIncentiveAmount', label: 'OT Incentive Bonus', render: (r) => money(r.otIncentiveAmount) },
  { key: 'doubleMachineIncentive', label: 'Double Machine', render: (r) => money(r.doubleMachineIncentive) },
  { key: 'shiftIncentive', label: 'Shift Bonus', render: (r) => money(r.shiftIncentive) },
  { key: 'attendanceBonus', label: 'Attendance Bonus', render: (r) => money(r.attendanceBonus) },
  { key: 'petrolAllowance', label: 'Petrol Allowance', render: (r) => money(r.petrolAllowance) },
  { key: 'performanceIncentive', label: 'Performance Incentive', render: (r) => money(r.performanceIncentive) },
];

export default function OtOtherIncentiveReportPage() {
  const [year, setYear] = useState(new Date().getFullYear());
  const [month, setMonth] = useState(new Date().getMonth() + 1);
  const [data, setData] = useState<ReportData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/reports/payroll/ot-other-incentive?year=${year}&month=${month}`);
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        throw new Error(j.error ?? 'Failed to load report');
      }
      setData(await res.json());
    } catch (err) {
      setData(null);
      setError(err instanceof Error ? err.message : 'Failed to load report');
    } finally {
      setLoading(false);
    }
  }, [year, month]);

  useEffect(() => {
    void fetchData();
  }, [fetchData]);

  const handleExport = () => {
    window.open(`/api/reports/payroll/ot-other-incentive?year=${year}&month=${month}&format=csv`, '_blank');
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold" style={{ color: 'var(--foreground)' }}>OT &amp; Other Incentive Report</h1>
        <div className="flex items-center gap-2">
          <select
            value={month}
            onChange={(e) => setMonth(Number(e.target.value))}
            className="rounded-lg border px-3 py-2 text-sm"
            style={{ backgroundColor: 'var(--surface)', color: 'var(--foreground)', borderColor: 'var(--border)' }}
          >
            {Array.from({ length: 12 }, (_, i) => i + 1).map((m) => (
              <option key={m} value={m}>{new Date(2000, m - 1, 1).toLocaleString('default', { month: 'long' })}</option>
            ))}
          </select>
          <input
            type="number"
            value={year}
            onChange={(e) => setYear(Number(e.target.value))}
            className="w-24 rounded-lg border px-3 py-2 text-sm"
            style={{ backgroundColor: 'var(--surface)', color: 'var(--foreground)', borderColor: 'var(--border)' }}
          />
          <button onClick={handleExport} className="rounded-lg px-4 py-2 text-sm font-semibold text-white" style={{ backgroundColor: 'var(--primary)' }}>
            Export CSV
          </button>
        </div>
      </div>

      {error && <div className="rounded-lg border border-red-300 bg-red-50 p-3 text-sm text-red-700">{error}</div>}

      {loading ? (
        <div className="text-sm" style={{ color: 'var(--foreground-muted)' }}>Loading…</div>
      ) : data ? (
        <div className="space-y-6">
          <div className="grid grid-cols-4 gap-4">
            <div className="rounded-lg border p-4" style={{ borderColor: 'var(--border)' }}>
              <div className="text-sm" style={{ color: 'var(--foreground-muted)' }}>Employees</div>
              <div className="text-2xl font-bold" style={{ color: 'var(--foreground)' }}>{data.rows.length}</div>
            </div>
            <div className="rounded-lg border p-4" style={{ borderColor: 'var(--border)' }}>
              <div className="text-sm" style={{ color: 'var(--foreground-muted)' }}>Total OT Hours</div>
              <div className="text-2xl font-bold" style={{ color: 'var(--foreground)' }}>{data.totals.otHours.toFixed(2)}</div>
            </div>
            <div className="rounded-lg border p-4" style={{ borderColor: 'var(--border)' }}>
              <div className="text-sm" style={{ color: 'var(--foreground-muted)' }}>Total OT Amount</div>
              <div className="text-2xl font-bold" style={{ color: 'var(--foreground)' }}>{money(data.totals.otAmount)}</div>
            </div>
            <div className="rounded-lg border p-4" style={{ borderColor: 'var(--border)' }}>
              <div className="text-sm" style={{ color: 'var(--foreground-muted)' }}>Total OT Incentive Bonus</div>
              <div className="text-2xl font-bold" style={{ color: 'var(--foreground)' }}>{money(data.totals.otIncentiveAmount)}</div>
            </div>
          </div>

          <DataTable<IncentiveRow>
            data={data.rows}
            columns={columns}
            rowKey={(r) => r.employeeCode}
            emptyMessage="No payroll lines for this period."
          />
        </div>
      ) : null}
    </div>
  );
}
