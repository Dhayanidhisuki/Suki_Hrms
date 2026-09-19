/**
 * Reports > Payroll > Performance Incentive Report — the only place the
 * computed Performance Incentive amount is shown (CTC-only "Performance
 * Incentive" component from Employee Master × the total % from Workforce >
 * Benefits > Performance Incentive, attendance- and ESI-adjusted). Column
 * set mirrors the company's existing "PMS Incentives Register" export
 * one-for-one — see src/lib/performanceIncentiveReport.ts. Two views:
 * Employee-wise (pick one employee) and Overall (every employee for the
 * period, with a total row, selectable rows). Download as Excel or PDF —
 * for a bulk selection, just the selected employees, or everyone shown.
 */

'use client';

import { useCallback, useEffect, useMemo, useState, type CSSProperties } from 'react';
import * as XLSX from 'xlsx';
import { useToast } from '@/components/ui';

interface Row {
  employeeId: number;
  employeeCode: string;
  employeeName: string;
  monthYearLabel: string;
  department: string | null;
  designation: string | null;
  dateOfJoining: string | null;
  category: string | null;
  ctcAmount: number;
  daysInMonth: number;
  lopDays: number;
  presentDays: number;
  pmsIncEarning: number;
  percent: number | null;
  pmsIncent: number;
  esiEligible: boolean;
  esiEmployeeDeduction: number;
  esiEmployerContribution: number;
  finalAmount: number;
  bankAccountNo: string | null;
  bankIfsc: string | null;
  bankName: string | null;
  remarks: string;
}

const MONTH_OPTIONS = [
  { value: 1, label: 'January' }, { value: 2, label: 'February' }, { value: 3, label: 'March' },
  { value: 4, label: 'April' }, { value: 5, label: 'May' }, { value: 6, label: 'June' },
  { value: 7, label: 'July' }, { value: 8, label: 'August' }, { value: 9, label: 'September' },
  { value: 10, label: 'October' }, { value: 11, label: 'November' }, { value: 12, label: 'December' },
];

const EXCEL_COLUMNS: { key: keyof Row; label: string }[] = [
  { key: 'employeeCode', label: 'Emp ID' },
  { key: 'employeeName', label: 'Employee Name' },
  { key: 'monthYearLabel', label: 'Month/ Year' },
  { key: 'department', label: 'Department' },
  { key: 'designation', label: 'Designation' },
  { key: 'dateOfJoining', label: 'Date of Joining' },
  { key: 'category', label: 'CATEGORY' },
  { key: 'ctcAmount', label: 'PMS INC FI' },
  { key: 'daysInMonth', label: 'Sal Cal Days' },
  { key: 'lopDays', label: 'LOP AVAILED' },
  { key: 'presentDays', label: 'Pay Days' },
  { key: 'pmsIncEarning', label: 'PMS Inc Earning' },
  { key: 'percent', label: 'PMS %' },
  { key: 'pmsIncent', label: 'PMS Incent' },
  { key: 'esiEmployeeDeduction', label: 'PMS EMPESI(0.75%)' },
  { key: 'esiEmployerContribution', label: 'PMS EMPloyer(3.25%)' },
  { key: 'finalAmount', label: 'PMS NET' },
  { key: 'bankAccountNo', label: 'Bank A/c No' },
  { key: 'bankIfsc', label: 'Bank IFSC' },
  { key: 'bankName', label: 'Bank Name' },
  { key: 'remarks', label: 'Remarks' },
];

export default function PerformanceIncentiveReportPage() {
  const now = new Date();
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [view, setView] = useState<'overall' | 'employee'>('overall');
  const [employeeId, setEmployeeId] = useState<number | ''>('');
  const [rows, setRows] = useState<Row[]>([]);
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const [loading, setLoading] = useState(true);
  const toast = useToast();

  const yearOptions = (() => {
    const y = now.getFullYear();
    return [y - 2, y - 1, y, y + 1];
  })();

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const qs = new URLSearchParams({ year: String(year), month: String(month) });
      const res = await fetch(`/api/reports/payroll/performance-incentive?${qs.toString()}`);
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? 'Failed to load');
      setRows(json.data ?? []);
      setSelectedIds(new Set());
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to load');
      setRows([]);
    } finally {
      setLoading(false);
    }
  }, [year, month, toast]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const displayRows = useMemo(
    () => (view === 'employee' && employeeId !== '' ? rows.filter((r) => r.employeeId === employeeId) : rows),
    [view, employeeId, rows]
  );

  const total = displayRows.reduce((sum, r) => sum + r.finalAmount, 0);

  // Rows to actually export: the selection if any rows are checked,
  // otherwise everything currently displayed (view-filtered).
  const exportRows = useMemo(
    () => (selectedIds.size > 0 ? displayRows.filter((r) => selectedIds.has(r.employeeId)) : displayRows),
    [selectedIds, displayRows]
  );

  const toggleAll = () => {
    setSelectedIds((prev) =>
      prev.size === displayRows.length ? new Set() : new Set(displayRows.map((r) => r.employeeId))
    );
  };
  const toggleOne = (id: number) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const downloadPdf = () => {
    const qs = new URLSearchParams({ year: String(year), month: String(month), format: 'pdf' });
    if (view === 'employee' && employeeId !== '') qs.set('employeeId', String(employeeId));
    else if (selectedIds.size > 0) qs.set('employeeIds', exportRows.map((r) => r.employeeId).join(','));
    window.open(`/api/reports/payroll/performance-incentive?${qs.toString()}`, '_blank');
  };

  const downloadExcel = () => {
    const data = exportRows.map((r) => {
      const out: Record<string, string | number> = {};
      for (const col of EXCEL_COLUMNS) {
        const v = r[col.key] as string | number | null;
        out[col.label] = v === null ? '' : v;
      }
      return out;
    });
    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Performance Incentive');
    const scopeTag = view === 'employee' && employeeId !== '' ? `-emp${employeeId}` : selectedIds.size > 0 ? '-selected' : '';
    XLSX.writeFile(wb, `performance-incentive-${year}-${String(month).padStart(2, '0')}${scopeTag}.xlsx`);
  };

  const inputStyle: CSSProperties = { backgroundColor: 'var(--surface)', color: 'var(--foreground)', borderColor: 'var(--border)' };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h1 className="text-xl font-semibold" style={{ color: 'var(--foreground)' }}>Performance Incentive Report</h1>
        <div className="flex items-center gap-2">
          {selectedIds.size > 0 && (
            <span className="text-xs" style={{ color: 'var(--foreground-muted)' }}>{selectedIds.size} selected</span>
          )}
          <button
            onClick={downloadExcel}
            disabled={exportRows.length === 0}
            className="inline-flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-sm font-medium disabled:opacity-40"
            style={{ borderColor: 'var(--accent)', color: 'var(--accent)' }}
          >
            Download Excel
          </button>
          <button
            onClick={downloadPdf}
            disabled={exportRows.length === 0}
            className="inline-flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-sm font-medium disabled:opacity-40"
            style={{ borderColor: 'var(--accent)', color: 'var(--accent)' }}
          >
            Download PDF
          </button>
        </div>
      </div>

      <section className="rounded-xl border p-3" style={{ borderColor: 'var(--border)', backgroundColor: 'var(--surface)' }}>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-5 items-end">
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
          <div className="flex flex-col gap-1">
            <label className="text-sm font-medium" style={{ color: 'var(--foreground)' }}>View</label>
            <select value={view} onChange={(e) => setView(e.target.value as 'overall' | 'employee')} className="w-full rounded-lg border px-3 py-2 text-sm" style={inputStyle}>
              <option value="overall">Overall</option>
              <option value="employee">Employee-wise</option>
            </select>
          </div>
          {view === 'employee' && (
            <div className="flex flex-col gap-1 sm:col-span-2">
              <label className="text-sm font-medium" style={{ color: 'var(--foreground)' }}>Employee</label>
              <select
                value={employeeId}
                onChange={(e) => setEmployeeId(e.target.value === '' ? '' : Number(e.target.value))}
                className="w-full rounded-lg border px-3 py-2 text-sm"
                style={inputStyle}
              >
                <option value="">Select employee…</option>
                {rows.map((r) => (
                  <option key={r.employeeId} value={r.employeeId}>{r.employeeCode} — {r.employeeName}</option>
                ))}
              </select>
            </div>
          )}
        </div>
      </section>

      <section className="rounded-xl border p-3 overflow-x-auto" style={{ borderColor: 'var(--border)', backgroundColor: 'var(--surface)' }}>
        <table className="text-sm" style={{ minWidth: '2260px' }}>
          <thead>
            <tr style={{ backgroundColor: 'var(--surface-hover)' }}>
              {view === 'overall' && (
                <th className="px-3 py-2 text-left">
                  <input
                    type="checkbox"
                    checked={displayRows.length > 0 && selectedIds.size === displayRows.length}
                    onChange={toggleAll}
                    aria-label="Select all"
                  />
                </th>
              )}
              <Th>Sl No</Th>
              <Th>Emp ID</Th>
              <Th>Employee Name</Th>
              <Th>Month/Yr</Th>
              <Th>Department</Th>
              <Th>Designation</Th>
              <Th>DOJ</Th>
              <Th>Category</Th>
              <ThRight>PMS INC FI</ThRight>
              <ThRight>Sal Cal Days</ThRight>
              <ThRight>LOP Availed</ThRight>
              <ThRight>Pay Days</ThRight>
              <ThRight>PMS Inc Earning</ThRight>
              <ThRight>PMS %</ThRight>
              <ThRight>PMS Incent</ThRight>
              <Th>ESI</Th>
              <ThRight>PMS EMPESI(0.75%)</ThRight>
              <ThRight>PMS EMPloyer(3.25%)</ThRight>
              <ThRight>PMS NET</ThRight>
              <Th>Bank A/c No</Th>
              <Th>Bank IFSC</Th>
              <Th>Bank Name</Th>
              <Th>Remarks</Th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={24} className="px-3 py-8 text-center" style={{ color: 'var(--foreground-muted)' }}>Loading...</td></tr>
            ) : displayRows.length === 0 ? (
              <tr><td colSpan={24} className="px-3 py-8 text-center" style={{ color: 'var(--foreground-muted)' }}>
                {view === 'employee' && employeeId === '' ? 'Select an employee.' : 'No data for this period.'}
              </td></tr>
            ) : (
              displayRows.map((r, idx) => (
                <tr key={r.employeeId} style={{ borderTop: '1px solid var(--border)' }}>
                  {view === 'overall' && (
                    <td className="px-3 py-1.5">
                      <input
                        type="checkbox"
                        checked={selectedIds.has(r.employeeId)}
                        onChange={() => toggleOne(r.employeeId)}
                        aria-label={`Select ${r.employeeCode}`}
                      />
                    </td>
                  )}
                  <Td>{idx + 1}</Td>
                  <Td>{r.employeeCode}</Td>
                  <Td>{r.employeeName}</Td>
                  <Td>{r.monthYearLabel}</Td>
                  <Td>{r.department ?? ''}</Td>
                  <Td>{r.designation ?? ''}</Td>
                  <Td>{r.dateOfJoining ?? ''}</Td>
                  <Td>{r.category ?? ''}</Td>
                  <TdRight>{r.ctcAmount.toFixed(2)}</TdRight>
                  <TdRight>{r.daysInMonth.toFixed(2)}</TdRight>
                  <TdRight>{r.lopDays.toFixed(2)}</TdRight>
                  <TdRight>{r.presentDays.toFixed(2)}</TdRight>
                  <TdRight>{r.pmsIncEarning.toFixed(2)}</TdRight>
                  <TdRight>{r.percent === null ? '—' : r.percent.toFixed(2)}</TdRight>
                  <TdRight>{r.pmsIncent.toFixed(2)}</TdRight>
                  <Td>{r.esiEligible ? 'Yes' : 'No'}</Td>
                  <TdRight>{r.esiEligible ? r.esiEmployeeDeduction.toFixed(2) : '0.00'}</TdRight>
                  <TdRight>{r.esiEligible ? r.esiEmployerContribution.toFixed(2) : '0.00'}</TdRight>
                  <TdRight><span className="font-medium">{r.finalAmount.toFixed(2)}</span></TdRight>
                  <Td>{r.bankAccountNo ?? ''}</Td>
                  <Td>{r.bankIfsc ?? ''}</Td>
                  <Td>{r.bankName ?? ''}</Td>
                  <Td>{r.remarks}</Td>
                </tr>
              ))
            )}
          </tbody>
          {displayRows.length > 0 && (
            <tfoot>
              <tr style={{ borderTop: '2px solid var(--border)' }}>
                <td colSpan={view === 'overall' ? 19 : 18} className="px-3 py-2 text-right font-semibold" style={{ color: 'var(--foreground)' }}>Total ({displayRows.length} employee{displayRows.length === 1 ? '' : 's'})</td>
                <td className="px-3 py-2 text-right font-semibold" style={{ color: 'var(--foreground)' }}>{total.toFixed(2)}</td>
                <td colSpan={4}></td>
              </tr>
            </tfoot>
          )}
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
