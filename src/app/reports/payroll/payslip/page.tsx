/**
 * Reports > Payroll > Payslip Report — every active employee for the
 * selected month, with a PDF download icon per row producing that
 * employee's "Time Card / Salary Slip (FORM-25B)" payslip, matching the
 * company's paper format exactly. Sourced from an already-calculated
 * PayrollLine — never recomputes payroll.
 */

'use client';

import { useCallback, useEffect, useState, type CSSProperties } from 'react';

interface PayslipSummaryRow {
  employeeId: number;
  employeeCode: string;
  employeeName: string;
  department: string | null;
  designation: string | null;
  netPay: number | null;
  hasPayslip: boolean;
}

const MONTH_OPTIONS = [
  { value: 1, label: 'January' }, { value: 2, label: 'February' }, { value: 3, label: 'March' },
  { value: 4, label: 'April' }, { value: 5, label: 'May' }, { value: 6, label: 'June' },
  { value: 7, label: 'July' }, { value: 8, label: 'August' }, { value: 9, label: 'September' },
  { value: 10, label: 'October' }, { value: 11, label: 'November' }, { value: 12, label: 'December' },
];

export default function PayslipReportPage() {
  const now = new Date();
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [search, setSearch] = useState('');
  const [rows, setRows] = useState<PayslipSummaryRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const yearOptions = (() => {
    const y = now.getFullYear();
    return [y - 2, y - 1, y, y + 1];
  })();

  const loadData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const qs = new URLSearchParams({ year: String(year), month: String(month) });
      const res = await fetch(`/api/reports/payroll/payslip?${qs.toString()}`);
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? 'Failed to load');
      setRows(json.data ?? []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load');
      setRows([]);
    } finally {
      setLoading(false);
    }
  }, [year, month]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const downloadPdf = (employeeId: number) => {
    const qs = new URLSearchParams({ year: String(year), month: String(month), employeeId: String(employeeId), format: 'pdf' });
    window.open(`/api/reports/payroll/payslip?${qs.toString()}`, '_blank');
  };

  const displayRows = rows.filter((r) => {
    const q = search.trim().toLowerCase();
    if (!q) return true;
    return r.employeeCode.toLowerCase().includes(q) || r.employeeName.toLowerCase().includes(q);
  });

  const inputStyle: CSSProperties = { backgroundColor: 'var(--surface)', color: 'var(--foreground)', borderColor: 'var(--border)' };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h1 className="text-xl font-semibold" style={{ color: 'var(--foreground)' }}>Payslip Report</h1>
      </div>

      {error && (
        <div className="rounded-lg px-3 py-2 text-sm" style={{ backgroundColor: '#fef2f2', color: '#dc2626' }}>{error}</div>
      )}

      <section className="rounded-xl border p-3" style={{ borderColor: 'var(--border)', backgroundColor: 'var(--surface)' }}>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4 items-end">
          <div className="flex flex-col gap-1">
            <label className="text-sm font-medium" style={{ color: 'var(--foreground)' }}>Year</label>
            <select value={year} onChange={(e) => setYear(Number(e.target.value))} className="w-full rounded-lg border px-3 py-2 text-sm" style={inputStyle}>
              {yearOptions.map((y) => <option key={y} value={y}>{y}</option>)}
            </select>
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-sm font-medium" style={{ color: 'var(--foreground)' }}>Month</label>
            <select value={month} onChange={(e) => setMonth(Number(e.target.value))} className="w-full rounded-lg border px-3 py-2 text-sm" style={inputStyle}>
              {MONTH_OPTIONS.map((m) => <option key={m.value} value={m.value}>{m.label}</option>)}
            </select>
          </div>
          <div className="flex flex-col gap-1 sm:col-span-2">
            <label className="text-sm font-medium" style={{ color: 'var(--foreground)' }}>Search</label>
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Employee Code / Name"
              className="w-full rounded-lg border px-3 py-2 text-sm"
              style={inputStyle}
            />
          </div>
        </div>
      </section>

      <section className="rounded-xl border p-3 overflow-x-auto" style={{ borderColor: 'var(--border)', backgroundColor: 'var(--surface)' }}>
        <table className="min-w-full text-sm">
          <thead>
            <tr style={{ backgroundColor: 'var(--surface-hover)' }}>
              <Th>Emp Code</Th>
              <Th>Employee</Th>
              <Th>Department</Th>
              <Th>Designation</Th>
              <ThRight>Net Pay</ThRight>
              <Th>Status</Th>
              <Th>{null}</Th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={7} className="px-3 py-8 text-center" style={{ color: 'var(--foreground-muted)' }}>Loading...</td></tr>
            ) : displayRows.length === 0 ? (
              <tr><td colSpan={7} className="px-3 py-8 text-center" style={{ color: 'var(--foreground-muted)' }}>No employees found.</td></tr>
            ) : (
              displayRows.map((r) => (
                <tr key={r.employeeId} style={{ borderTop: '1px solid var(--border)' }}>
                  <Td>{r.employeeCode}</Td>
                  <Td>{r.employeeName}</Td>
                  <Td>{r.department ?? ''}</Td>
                  <Td>{r.designation ?? ''}</Td>
                  <TdRight>{r.netPay !== null ? r.netPay.toFixed(2) : '—'}</TdRight>
                  <td className="px-3 py-1.5">
                    <span
                      className="rounded-full px-2 py-0.5 text-xs font-medium"
                      style={r.hasPayslip ? { backgroundColor: '#dcfce7', color: '#166534' } : { backgroundColor: '#f3f4f6', color: '#6b7280' }}
                    >
                      {r.hasPayslip ? 'Processed' : 'No Payroll'}
                    </span>
                  </td>
                  <td className="px-3 py-1.5">
                    <button
                      onClick={() => downloadPdf(r.employeeId)}
                      disabled={!r.hasPayslip}
                      title={r.hasPayslip ? 'Download payslip PDF' : 'No processed payroll for this month'}
                      className="inline-flex items-center justify-center rounded-lg border p-1.5 disabled:opacity-30"
                      style={{ borderColor: 'var(--accent)', color: 'var(--accent)' }}
                    >
                      <PdfIcon />
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </section>
    </div>
  );
}

function Th({ children }: { children: React.ReactNode }) {
  return <th className="whitespace-nowrap px-3 py-2 text-left font-medium" style={{ color: 'var(--foreground-muted)' }}>{children}</th>;
}
function ThRight({ children }: { children: React.ReactNode }) {
  return <th className="whitespace-nowrap px-3 py-2 text-right font-medium" style={{ color: 'var(--foreground-muted)' }}>{children}</th>;
}
function Td({ children }: { children: React.ReactNode }) {
  return <td className="whitespace-nowrap px-3 py-1.5" style={{ color: 'var(--foreground)' }}>{children}</td>;
}
function TdRight({ children }: { children: React.ReactNode }) {
  return <td className="whitespace-nowrap px-3 py-1.5 text-right" style={{ color: 'var(--foreground)' }}>{children}</td>;
}

function PdfIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M14 3H6a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9z" />
      <path d="M14 3v6h6" />
      <path d="M9 13h1a1.5 1.5 0 0 1 0 3H9v-3zm0 3v2" />
    </svg>
  );
}
