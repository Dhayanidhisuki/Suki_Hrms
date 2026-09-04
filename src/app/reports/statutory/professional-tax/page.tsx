/**
 * Professional Tax Report — consolidated half-yearly summary, employee-wise
 * detail, and slab table (BRD: KUN_HRMS___PT_BRD_.txt). Read-only over
 * PayrollLine data already computed by Payroll Phase 1 — no new PT
 * calculation here. On-screen + browser-native print, no PDF pipeline.
 */

'use client';

import { Fragment, useState, useEffect, useCallback } from 'react';
import { DataTable, SearchableSelect, type Column } from '@/components/ui';

interface EmployeeOption {
  id: number;
  employeeCode: string;
  firstName: string;
  lastName: string;
}
interface UnitOption {
  id: number;
  name: string;
}
interface MonthlyRow {
  sNo: number;
  year: number;
  month: number;
  monthLabel: string;
  totalEmployees: number;
  taxableEmployees: number;
  grossSalary: number;
  ptAmount: number;
  cumulativePT: number;
}
interface SlabRow {
  id: number;
  minSalary: number;
  maxSalary: number | null;
  monthlyPT: number;
  halfYearlyPT: number;
}
interface EmployeeMonth {
  year: number;
  month: number;
  monthLabel: string;
  grossEarnings: number;
  professionalTax: number;
}
interface EmployeeRow {
  employeeId: number;
  employeeCode: string;
  name: string;
  unit: string | null;
  months: EmployeeMonth[];
  totalGross: number;
  totalPT: number;
}
interface ReportData {
  financialYear: number;
  halfType: string;
  half: number;
  months: { year: number; month: number; label: string }[];
  summary: { totalEmployees: number; taxableEmployees: number; totalGrossSalary: number; totalPT: number };
  monthly: MonthlyRow[];
  slabs: SlabRow[];
  employees: EmployeeRow[];
}

const now = new Date();
const defaultFY = now.getMonth() >= 3 ? now.getFullYear() : now.getFullYear() - 1;

export default function ProfessionalTaxReportPage() {
  const [financialYear, setFinancialYear] = useState(defaultFY);
  const [halfType, setHalfType] = useState<'FINANCIAL' | 'NON_FINANCIAL'>('FINANCIAL');
  const [half, setHalf] = useState<1 | 2>(1);
  const [unitId, setUnitId] = useState<number | ''>('');
  const [employeeId, setEmployeeId] = useState<number | ''>('');
  const [status, setStatus] = useState('active');
  const [employees, setEmployees] = useState<EmployeeOption[]>([]);
  const [units, setUnits] = useState<UnitOption[]>([]);
  const [data, setData] = useState<ReportData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch('/api/employees?limit=200')
      .then((r) => r.json())
      .then((json: { data: EmployeeOption[] }) => setEmployees(json.data ?? []))
      .catch(() => {});
    fetch('/api/masters/units?limit=100')
      .then((r) => r.json())
      .then((json: { data: UnitOption[] }) => setUnits(json.data ?? []))
      .catch(() => {});
  }, []);

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({ financialYear: String(financialYear), halfType, half: String(half), status });
      if (unitId) params.set('unitId', String(unitId));
      if (employeeId) params.set('employeeId', String(employeeId));
      const res = await fetch(`/api/reports/professional-tax?${params}`);
      if (!res.ok) throw new Error('Failed to fetch report');
      setData(await res.json());
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  }, [financialYear, halfType, half, unitId, employeeId, status]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const monthlyColumns: Column<MonthlyRow>[] = [
    { key: 'sNo', label: 'S.No' },
    { key: 'monthLabel', label: 'Month' },
    { key: 'totalEmployees', label: 'Total Employees' },
    { key: 'taxableEmployees', label: 'Taxable Employees' },
    { key: 'grossSalary', label: 'Gross Salary' },
    { key: 'ptAmount', label: 'PT Amount' },
    { key: 'cumulativePT', label: 'Cumulative PT', className: 'font-medium' },
  ];

  const slabColumns: Column<SlabRow>[] = [
    { key: 'minSalary', label: 'Salary From' },
    { key: 'maxSalary', label: 'Salary To', render: (r) => (r.maxSalary === null ? 'Above' : String(r.maxSalary)) },
    { key: 'monthlyPT', label: 'Monthly PT' },
    { key: 'halfYearlyPT', label: 'Half-Yearly PT' },
  ];

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between print:hidden">
        <h1 className="text-xl font-semibold" style={{ color: 'var(--foreground)' }}>Professional Tax Report</h1>
        <button
          onClick={() => window.print()}
          className="rounded-lg px-3 py-2 text-sm font-medium text-white"
          style={{ backgroundColor: 'var(--accent)' }}
        >
          Print
        </button>
      </div>

      <div className="flex flex-wrap items-end gap-3 rounded-lg border p-3 print:hidden" style={{ borderColor: 'var(--border)', backgroundColor: 'var(--surface)' }}>
        <div className="flex flex-col gap-1">
          <label className="text-xs font-medium" style={{ color: 'var(--foreground-muted)' }}>Financial Year</label>
          <input
            type="number"
            value={financialYear}
            onChange={(e) => setFinancialYear(Number(e.target.value))}
            className="w-28 rounded-lg border px-3 py-2 text-sm"
            style={{ backgroundColor: 'var(--surface)', color: 'var(--foreground)', borderColor: 'var(--border)' }}
          />
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-xs font-medium" style={{ color: 'var(--foreground-muted)' }}>Half Type</label>
          <select
            value={halfType}
            onChange={(e) => setHalfType(e.target.value as typeof halfType)}
            className="rounded-lg border px-3 py-2 text-sm"
            style={{ backgroundColor: 'var(--surface)', color: 'var(--foreground)', borderColor: 'var(--border)' }}
          >
            <option value="FINANCIAL">Financial (Apr-Sep / Oct-Mar)</option>
            <option value="NON_FINANCIAL">Non-Financial (Mar-Aug / Sep-Feb)</option>
          </select>
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-xs font-medium" style={{ color: 'var(--foreground-muted)' }}>Period</label>
          <select
            value={half}
            onChange={(e) => setHalf(Number(e.target.value) as 1 | 2)}
            className="rounded-lg border px-3 py-2 text-sm"
            style={{ backgroundColor: 'var(--surface)', color: 'var(--foreground)', borderColor: 'var(--border)' }}
          >
            <option value={1}>I Half</option>
            <option value={2}>II Half</option>
          </select>
        </div>
        <div className="flex flex-col gap-1 w-48">
          <label className="text-xs font-medium" style={{ color: 'var(--foreground-muted)' }}>Unit</label>
          <SearchableSelect
            value={unitId}
            options={units.map((u) => ({ label: u.name, value: u.id }))}
            onChange={(v) => setUnitId(v === '' ? '' : Number(v))}
            placeholder="All Units"
          />
        </div>
        <div className="flex flex-col gap-1 w-56">
          <label className="text-xs font-medium" style={{ color: 'var(--foreground-muted)' }}>Employee</label>
          <SearchableSelect
            value={employeeId}
            options={employees.map((e) => ({ label: `${e.employeeCode} — ${e.firstName} ${e.lastName}`, value: e.id }))}
            onChange={(v) => setEmployeeId(v === '' ? '' : Number(v))}
            placeholder="All Employees"
          />
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-xs font-medium" style={{ color: 'var(--foreground-muted)' }}>Status</label>
          <select
            value={status}
            onChange={(e) => setStatus(e.target.value)}
            className="rounded-lg border px-3 py-2 text-sm"
            style={{ backgroundColor: 'var(--surface)', color: 'var(--foreground)', borderColor: 'var(--border)' }}
          >
            <option value="active">Active</option>
            <option value="all">All</option>
          </select>
        </div>
      </div>

      {error && (
        <div className="rounded-lg px-3 py-2 text-sm" style={{ backgroundColor: '#fef2f2', color: '#dc2626', border: '1px solid #fecaca' }}>
          {error}
        </div>
      )}

      {loading || !data ? (
        <p className="text-sm" style={{ color: 'var(--foreground-muted)' }}>Loading...</p>
      ) : (
        <>
          <div className="grid grid-cols-4 gap-3">
            {[
              { label: 'Total Employees', value: data.summary.totalEmployees },
              { label: 'Taxable Employees', value: data.summary.taxableEmployees },
              { label: 'Total Gross Salary', value: `₹${data.summary.totalGrossSalary}` },
              { label: 'Total Professional Tax', value: `₹${data.summary.totalPT}` },
            ].map((card) => (
              <div key={card.label} className="rounded-lg border p-4" style={{ borderColor: 'var(--border)', backgroundColor: 'var(--surface)' }}>
                <p className="text-xs" style={{ color: 'var(--foreground-muted)' }}>{card.label}</p>
                <p className="mt-1 text-xl font-semibold" style={{ color: 'var(--foreground)' }}>{card.value}</p>
              </div>
            ))}
          </div>

          <div>
            <h2 className="mb-2 text-sm font-semibold" style={{ color: 'var(--foreground)' }}>A. Half-Yearly Professional Tax Summary</h2>
            <DataTable columns={monthlyColumns} data={data.monthly.map((r) => ({ ...r, id: r.sNo }))} emptyMessage="No data." />
          </div>

          <div>
            <h2 className="mb-2 text-sm font-semibold" style={{ color: 'var(--foreground)' }}>B. Professional Tax Slab Details</h2>
            <DataTable columns={slabColumns} data={data.slabs.map((r) => ({ ...r, id: r.id }))} emptyMessage="No slabs configured." />
          </div>

          <div>
            <h2 className="mb-2 text-sm font-semibold" style={{ color: 'var(--foreground)' }}>C. Employee-wise Professional Tax Details</h2>
            <div className="overflow-x-auto rounded-lg border" style={{ borderColor: 'var(--border)', backgroundColor: 'var(--surface)' }}>
              <table className="min-w-full text-sm">
                <thead>
                  <tr style={{ backgroundColor: 'var(--surface-hover)' }}>
                    <th rowSpan={2} className="px-3 py-2 text-left align-bottom" style={{ color: 'var(--foreground-muted)' }}>Emp Code</th>
                    <th rowSpan={2} className="px-3 py-2 text-left align-bottom" style={{ color: 'var(--foreground-muted)' }}>Name</th>
                    {data.months.map((m) => (
                      <th key={`${m.year}-${m.month}`} colSpan={2} className="px-3 py-2 text-center" style={{ color: 'var(--foreground-muted)' }}>
                        {m.label}
                      </th>
                    ))}
                    <th rowSpan={2} className="px-3 py-2 text-right align-bottom" style={{ color: 'var(--foreground-muted)' }}>Total Gross</th>
                    <th rowSpan={2} className="px-3 py-2 text-right align-bottom" style={{ color: 'var(--foreground-muted)' }}>Total PT</th>
                  </tr>
                  <tr style={{ backgroundColor: 'var(--surface-hover)' }}>
                    {data.months.map((m) => (
                      <Fragment key={`${m.year}-${m.month}`}>
                        <th className="px-2 py-1 text-right text-xs" style={{ color: 'var(--foreground-muted)' }}>Gross</th>
                        <th className="px-2 py-1 text-right text-xs" style={{ color: 'var(--foreground-muted)' }}>PT</th>
                      </Fragment>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {data.employees.length === 0 ? (
                    <tr>
                      <td colSpan={4 + data.months.length * 2} className="px-3 py-8 text-center" style={{ color: 'var(--foreground-muted)' }}>
                        No employees found.
                      </td>
                    </tr>
                  ) : (
                    data.employees.map((e) => (
                      <tr key={e.employeeId} style={{ borderTop: '1px solid var(--border)' }}>
                        <td className="px-3 py-1.5" style={{ color: 'var(--foreground)' }}>{e.employeeCode}</td>
                        <td className="px-3 py-1.5" style={{ color: 'var(--foreground)' }}>{e.name}</td>
                        {e.months.map((m) => (
                          <Fragment key={`${m.year}-${m.month}`}>
                            <td className="px-2 py-1.5 text-right" style={{ color: 'var(--foreground)' }}>{m.grossEarnings}</td>
                            <td className="px-2 py-1.5 text-right" style={{ color: 'var(--foreground)' }}>{m.professionalTax}</td>
                          </Fragment>
                        ))}
                        <td className="px-3 py-1.5 text-right font-medium" style={{ color: 'var(--foreground)' }}>{e.totalGross}</td>
                        <td className="px-3 py-1.5 text-right font-medium" style={{ color: 'var(--foreground)' }}>{e.totalPT}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
