/**
 * Comp-Off Report — comp-off balances, transactions, and requests
 * matching with OT payroll (COMP_OFF settlements). Shows per-employee
 * balance, transaction log, requests, and OT days settled as comp-off.
 */

'use client';

import { useState, useEffect, useCallback } from 'react';
import * as XLSX from 'xlsx';
import { useToast } from '@/components/ui';

interface TxnRow {
  id: number;
  date: string;
  type: string; // CREDIT | DEBIT | EXPIRE | ENCASH
  days: number;
  balanceAfter: number;
  reason: string | null;
  sourceType: string | null; // OT_APPROVAL | LEAVE | MANUAL | EXPIRY
  sourceId: number | null;
}

interface ReqRow {
  id: number;
  workedDate: string;
  requestedDate: string;
  status: string;
  reason: string | null;
  approvedAt: string | null;
  rejectionReason: string | null;
}

interface OtCompOffRow {
  id: number;
  date: string;
  dayOfWeek: string;
  shiftCode: string;
  shiftName: string;
  status: string;
  otMinutesCalculated: number;
  otMinutesApproved: number | null;
  isHolidayWorked: boolean;
  isWeeklyOffWorked: boolean;
  otManagerActionAt: string | null;
  otHrActionAt: string | null;
}

interface CompOffRow {
  id: number;
  employeeCode: string;
  employeeName: string;
  department: string;
  currentBalance: number;
  totalEarned: number;
  totalUsed: number;
  totalExpired: number;
  totalEncashed: number;
  txnCount: number;
  creditsThisMonth: number;
  debitsThisMonth: number;
  expiredThisMonth: number;
  encashedThisMonth: number;
  requestCount: number;
  approvedRequests: number;
  pendingRequests: number;
  rejectedRequests: number;
  otCompOffCount: number;
  otCompOffMinutes: number;
  txnBreakdown: TxnRow[];
  reqBreakdown: ReqRow[];
  otCompOffBreakdown: OtCompOffRow[];
}

interface ReportData {
  policy: {
    minQualifyingHours: number;
    qualifyingDayTypes: string;
    expiryMonths: number;
    allowEncashment: boolean;
    encashmentRatePerDay: number | null;
    autoCreditOnApproval: boolean;
  } | null;
  rows: CompOffRow[];
  totals: {
    currentBalance: number;
    totalEarned: number;
    totalUsed: number;
    creditsThisMonth: number;
    debitsThisMonth: number;
    expiredThisMonth: number;
    encashedThisMonth: number;
    otCompOffCount: number;
    otCompOffMinutes: number;
    pendingRequests: number;
  };
}

const txnTypeColor: Record<string, string> = {
  CREDIT: '#166534',
  DEBIT: '#dc2626',
  EXPIRE: '#b45309',
  ENCASH: '#0891b2',
};

const reqStatusColor: Record<string, string> = {
  approved: '#166534',
  pending: '#b45309',
  rejected: '#dc2626',
};

export default function CompOffReportPage() {
  const [year, setYear] = useState(new Date().getFullYear());
  const [month, setMonth] = useState(new Date().getMonth() + 1);
  const [data, setData] = useState<ReportData | null>(null);
  const [loading, setLoading] = useState(true);
  const toast = useToast();
  const [expandedRows, setExpandedRows] = useState<Set<number>>(new Set());

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/reports/attendance/comp-off?year=${year}&month=${month}`);
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        throw new Error(j.error ?? 'Failed to load report');
      }
      setData(await res.json());
    } catch (err) {
      setData(null);
      toast.error(err instanceof Error ? err.message : 'Failed to load report');
    } finally {
      setLoading(false);
    }
  }, [year, month, toast]);

  useEffect(() => { void fetchData(); }, [fetchData]);

  const toggleRow = (id: number) => {
    setExpandedRows((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const expandAll = () => {
    if (!data) return;
    setExpandedRows(new Set(data.rows.map((r) => r.id)));
  };

  const collapseAll = () => setExpandedRows(new Set());

  const openExport = (format: 'csv' | 'pdf', detail: boolean) => {
    const params = new URLSearchParams({ year: String(year), month: String(month), format });
    if (detail) params.set('detail', '1');
    window.open(`/api/reports/attendance/comp-off?${params.toString()}`, '_blank');
  };
  const handleExport = (detail: boolean) => openExport('csv', detail);

  // One workbook covering both views: the per-employee summary and the flat
  // transaction log the detail export uses, built from the loaded rows.
  const handleExportExcel = () => {
    if (!data) return;
    const summary = data.rows.map((r, i) => ({
      'Sl No': i + 1,
      'Emp Code': r.employeeCode,
      'Employee Name': r.employeeName,
      Department: r.department,
      'Current Balance': r.currentBalance,
      'Total Earned': r.totalEarned,
      'Total Used': r.totalUsed,
      'Total Expired': r.totalExpired,
      'Total Encashed': r.totalEncashed,
      'Credits (This Month)': r.creditsThisMonth,
      'Debits (This Month)': r.debitsThisMonth,
      'Expired (This Month)': r.expiredThisMonth,
      'Encashed (This Month)': r.encashedThisMonth,
      Requests: r.requestCount,
      Approved: r.approvedRequests,
      Pending: r.pendingRequests,
      Rejected: r.rejectedRequests,
      'OT Comp-Off Days': r.otCompOffCount,
      'OT Comp-Off Minutes': r.otCompOffMinutes,
    }));
    const txns = data.rows.flatMap((r) =>
      r.txnBreakdown.map((t) => ({
        'Emp Code': r.employeeCode,
        'Employee Name': r.employeeName,
        Department: r.department,
        Date: t.date,
        Type: t.type,
        Days: t.days,
        'Balance After': t.balanceAfter,
        'Source Type': t.sourceType ?? '',
        Reason: t.reason ?? '',
      }))
    );
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(summary), 'Summary');
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(txns), 'Transactions');
    XLSX.writeFile(wb, `comp_off_${year}_${String(month).padStart(2, '0')}.xlsx`);
  };

  const hasRows = (data?.rows.length ?? 0) > 0;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold" style={{ color: 'var(--foreground)' }}>Comp-Off Report</h1>
        <div className="flex items-center gap-2">
          <select value={month} onChange={(e) => setMonth(Number(e.target.value))} className="rounded-lg border px-3 py-2 text-sm" style={{ backgroundColor: 'var(--surface)', color: 'var(--foreground)', borderColor: 'var(--border)' }}>
            {Array.from({ length: 12 }, (_, i) => i + 1).map((m) => <option key={m} value={m}>{new Date(2000, m - 1, 1).toLocaleString('default', { month: 'long' })}</option>)}
          </select>
          <input type="number" value={year} onChange={(e) => setYear(Number(e.target.value))} className="w-24 rounded-lg border px-3 py-2 text-sm" style={{ backgroundColor: 'var(--surface)', color: 'var(--foreground)', borderColor: 'var(--border)' }} />
          <button onClick={() => handleExport(false)} disabled={!hasRows} className="rounded-lg px-4 py-2 text-sm font-semibold text-white disabled:opacity-40" style={{ backgroundColor: 'var(--primary)' }}>Export Summary CSV</button>
          <button onClick={() => handleExport(true)} disabled={!hasRows} className="rounded-lg border px-4 py-2 text-sm font-medium disabled:opacity-40" style={{ borderColor: 'var(--border)', color: 'var(--foreground)' }}>Export Detail CSV</button>
          <button onClick={handleExportExcel} disabled={!hasRows} className="rounded-lg border px-4 py-2 text-sm font-medium disabled:opacity-40" style={{ borderColor: 'var(--accent)', color: 'var(--accent)' }}>Download Excel</button>
          <button onClick={() => openExport('pdf', false)} disabled={!hasRows} className="rounded-lg border px-4 py-2 text-sm font-medium disabled:opacity-40" style={{ borderColor: 'var(--accent)', color: 'var(--accent)' }}>Summary PDF</button>
          <button onClick={() => openExport('pdf', true)} disabled={!hasRows} className="rounded-lg border px-4 py-2 text-sm font-medium disabled:opacity-40" style={{ borderColor: 'var(--accent)', color: 'var(--accent)' }}>Detail PDF</button>
        </div>
      </div>

      {loading ? <div className="text-sm" style={{ color: 'var(--foreground-muted)' }}>Loading…</div> : data ? (
        <div className="space-y-6">
          {/* Comp-Off Policy */}
          {data.policy && (
            <div className="rounded-lg border p-4" style={{ borderColor: 'var(--border)' }}>
              <h2 className="mb-3 text-sm font-semibold" style={{ color: 'var(--foreground)' }}>Comp-Off Policy</h2>
              <div className="grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-6">
                <div><div className="text-xs" style={{ color: 'var(--foreground-muted)' }}>Min Qualifying Hours</div><div className="text-sm font-medium" style={{ color: 'var(--foreground)' }}>{data.policy.minQualifyingHours}</div></div>
                <div><div className="text-xs" style={{ color: 'var(--foreground-muted)' }}>Qualifying Day Types</div><div className="text-sm font-medium" style={{ color: 'var(--foreground)' }}>{data.policy.qualifyingDayTypes}</div></div>
                <div><div className="text-xs" style={{ color: 'var(--foreground-muted)' }}>Expiry Months</div><div className="text-sm font-medium" style={{ color: 'var(--foreground)' }}>{data.policy.expiryMonths}</div></div>
                <div><div className="text-xs" style={{ color: 'var(--foreground-muted)' }}>Encashment</div><div className="text-sm font-medium" style={{ color: data.policy.allowEncashment ? '#166534' : '#dc2626' }}>{data.policy.allowEncashment ? 'Allowed' : 'Not Allowed'}</div></div>
                <div><div className="text-xs" style={{ color: 'var(--foreground-muted)' }}>Encashment Rate/Day</div><div className="text-sm font-medium" style={{ color: 'var(--foreground)' }}>{data.policy.encashmentRatePerDay != null ? `₹${data.policy.encashmentRatePerDay.toFixed(2)}` : '—'}</div></div>
                <div><div className="text-xs" style={{ color: 'var(--foreground-muted)' }}>Auto-Credit on Approval</div><div className="text-sm font-medium" style={{ color: data.policy.autoCreditOnApproval ? '#166534' : '#dc2626' }}>{data.policy.autoCreditOnApproval ? 'Yes' : 'No'}</div></div>
              </div>
            </div>
          )}

          {/* Summary Cards */}
          <div className="grid grid-cols-2 gap-4 md:grid-cols-5">
            <div className="rounded-lg border p-4" style={{ borderColor: 'var(--border)' }}>
              <div className="text-sm" style={{ color: 'var(--foreground-muted)' }}>Employees with Comp-Off</div>
              <div className="text-2xl font-bold" style={{ color: 'var(--foreground)' }}>{data.rows.length}</div>
            </div>
            <div className="rounded-lg border p-4" style={{ borderColor: 'var(--border)' }}>
              <div className="text-sm" style={{ color: 'var(--foreground-muted)' }}>Total Current Balance</div>
              <div className="text-2xl font-bold" style={{ color: 'var(--foreground)' }}>{data.totals.currentBalance.toFixed(2)}</div>
            </div>
            <div className="rounded-lg border p-4" style={{ borderColor: 'var(--border)' }}>
              <div className="text-sm" style={{ color: 'var(--foreground-muted)' }}>Credits (This Month)</div>
              <div className="text-2xl font-bold text-green-600">{data.totals.creditsThisMonth.toFixed(2)}</div>
            </div>
            <div className="rounded-lg border p-4" style={{ borderColor: 'var(--border)' }}>
              <div className="text-sm" style={{ color: 'var(--foreground-muted)' }}>Debits (This Month)</div>
              <div className="text-2xl font-bold text-red-500">{data.totals.debitsThisMonth.toFixed(2)}</div>
            </div>
            <div className="rounded-lg border p-4" style={{ borderColor: 'var(--border)' }}>
              <div className="text-sm" style={{ color: 'var(--foreground-muted)' }}>OT Comp-Off Days</div>
              <div className="text-2xl font-bold" style={{ color: '#7c3aed' }}>{data.totals.otCompOffCount}</div>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button onClick={expandAll} className="rounded-lg border px-3 py-1.5 text-xs font-medium" style={{ borderColor: 'var(--border)', color: 'var(--foreground)' }}>Expand All</button>
            <button onClick={collapseAll} className="rounded-lg border px-3 py-1.5 text-xs font-medium" style={{ borderColor: 'var(--border)', color: 'var(--foreground)' }}>Collapse All</button>
            <span className="text-xs" style={{ color: 'var(--foreground-muted)' }}>{data.totals.pendingRequests} pending requests</span>
          </div>

          {/* Summary Table */}
          <div className="overflow-x-auto rounded-lg border" style={{ borderColor: 'var(--border)', backgroundColor: 'var(--surface)' }}>
            <table className="min-w-full text-sm">
              <thead>
                <tr style={{ backgroundColor: 'var(--surface-hover)' }}>
                  <th className="px-3 py-3 text-left font-medium text-xs" style={{ color: 'var(--foreground-muted)' }}></th>
                  <th className="px-3 py-3 text-left font-medium text-xs" style={{ color: 'var(--foreground-muted)' }}>Code</th>
                  <th className="px-3 py-3 text-left font-medium text-xs" style={{ color: 'var(--foreground-muted)' }}>Name</th>
                  <th className="px-3 py-3 text-left font-medium text-xs" style={{ color: 'var(--foreground-muted)' }}>Dept</th>
                  <th className="px-3 py-3 text-right font-medium text-xs" style={{ color: 'var(--foreground-muted)' }}>Current Bal</th>
                  <th className="px-3 py-3 text-right font-medium text-xs" style={{ color: 'var(--foreground-muted)' }}>Total Earned</th>
                  <th className="px-3 py-3 text-right font-medium text-xs" style={{ color: 'var(--foreground-muted)' }}>Total Used</th>
                  <th className="px-3 py-3 text-right font-medium text-xs" style={{ color: 'var(--foreground-muted)' }}>Credits<br />(Month)</th>
                  <th className="px-3 py-3 text-right font-medium text-xs" style={{ color: 'var(--foreground-muted)' }}>Debits<br />(Month)</th>
                  <th className="px-3 py-3 text-center font-medium text-xs" style={{ color: 'var(--foreground-muted)' }}>OT Comp-Off<br />Days</th>
                  <th className="px-3 py-3 text-center font-medium text-xs" style={{ color: 'var(--foreground-muted)' }}>Requests</th>
                  <th className="px-3 py-3 text-center font-medium text-xs" style={{ color: 'var(--foreground-muted)' }}>Pending</th>
                </tr>
              </thead>
              <tbody>
                {data.rows.length === 0 ? (
                  <tr><td colSpan={12} className="px-4 py-8 text-center" style={{ color: 'var(--foreground-muted)' }}>No comp-off activity for this period.</td></tr>
                ) : data.rows.map((r) => (
                  <>
                    <tr key={r.id} className="transition-colors cursor-pointer" style={{ borderTop: '1px solid var(--border)' }} onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = 'var(--surface-hover)')} onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = 'transparent')} onClick={() => toggleRow(r.id)}>
                      <td className="px-3 py-3 text-center"><span className="text-xs" style={{ color: 'var(--accent)' }}>{expandedRows.has(r.id) ? '▼' : '▶'}</span></td>
                      <td className="px-3 py-3 font-medium" style={{ color: 'var(--foreground)' }}>{r.employeeCode}</td>
                      <td className="px-3 py-3" style={{ color: 'var(--foreground)' }}>{r.employeeName}</td>
                      <td className="px-3 py-3" style={{ color: 'var(--foreground)' }}>{r.department}</td>
                      <td className="px-3 py-3 text-right font-bold" style={{ color: 'var(--foreground)' }}>{r.currentBalance.toFixed(2)}</td>
                      <td className="px-3 py-3 text-right text-green-600">{r.totalEarned.toFixed(2)}</td>
                      <td className="px-3 py-3 text-right text-red-500">{r.totalUsed.toFixed(2)}</td>
                      <td className="px-3 py-3 text-right text-green-600">{r.creditsThisMonth.toFixed(2)}</td>
                      <td className="px-3 py-3 text-right text-red-500">{r.debitsThisMonth.toFixed(2)}</td>
                      <td className="px-3 py-3 text-center" style={{ color: '#7c3aed' }}>{r.otCompOffCount}</td>
                      <td className="px-3 py-3 text-center" style={{ color: 'var(--foreground)' }}>{r.requestCount}</td>
                      <td className="px-3 py-3 text-center text-amber-600">{r.pendingRequests}</td>
                    </tr>
                    {expandedRows.has(r.id) && (
                      <tr style={{ backgroundColor: 'var(--surface-hover)' }}>
                        <td colSpan={12} className="px-6 py-4">
                          <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
                            {/* Transactions */}
                            <div>
                              <h3 className="mb-2 text-xs font-semibold uppercase" style={{ color: 'var(--foreground-muted)' }}>
                                Transactions (This Month)
                              </h3>
                              {r.txnBreakdown.length === 0 ? (
                                <div className="text-xs" style={{ color: 'var(--foreground-muted)' }}>No transactions this month.</div>
                              ) : (
                                <table className="min-w-full text-xs">
                                  <thead>
                                    <tr style={{ borderBottom: '1px solid var(--border)' }}>
                                      <th className="px-2 py-1 text-left font-medium" style={{ color: 'var(--foreground-muted)' }}>Date</th>
                                      <th className="px-2 py-1 text-left font-medium" style={{ color: 'var(--foreground-muted)' }}>Type</th>
                                      <th className="px-2 py-1 text-right font-medium" style={{ color: 'var(--foreground-muted)' }}>Days</th>
                                      <th className="px-2 py-1 text-right font-medium" style={{ color: 'var(--foreground-muted)' }}>Bal After</th>
                                      <th className="px-2 py-1 text-left font-medium" style={{ color: 'var(--foreground-muted)' }}>Source</th>
                                      <th className="px-2 py-1 text-left font-medium" style={{ color: 'var(--foreground-muted)' }}>Reason</th>
                                    </tr>
                                  </thead>
                                  <tbody>
                                    {r.txnBreakdown.map((t, i) => (
                                      <tr key={i} style={{ borderTop: '1px solid var(--border)' }}>
                                        <td className="px-2 py-1" style={{ color: 'var(--foreground)' }}>{t.date}</td>
                                        <td className="px-2 py-1"><span style={{ color: txnTypeColor[t.type] ?? 'var(--foreground)' }}>{t.type}</span></td>
                                        <td className="px-2 py-1 text-right" style={{ color: 'var(--foreground)' }}>{t.days.toFixed(2)}</td>
                                        <td className="px-2 py-1 text-right" style={{ color: 'var(--foreground)' }}>{t.balanceAfter.toFixed(2)}</td>
                                        <td className="px-2 py-1" style={{ color: 'var(--foreground-muted)' }}>{t.sourceType ?? '—'}</td>
                                        <td className="px-2 py-1" style={{ color: 'var(--foreground-muted)' }}>{t.reason ?? '—'}</td>
                                      </tr>
                                    ))}
                                  </tbody>
                                </table>
                              )}
                            </div>

                            {/* Requests */}
                            <div>
                              <h3 className="mb-2 text-xs font-semibold uppercase" style={{ color: 'var(--foreground-muted)' }}>
                                Comp-Off Requests
                              </h3>
                              {r.reqBreakdown.length === 0 ? (
                                <div className="text-xs" style={{ color: 'var(--foreground-muted)' }}>No requests this month.</div>
                              ) : (
                                <table className="min-w-full text-xs">
                                  <thead>
                                    <tr style={{ borderBottom: '1px solid var(--border)' }}>
                                      <th className="px-2 py-1 text-left font-medium" style={{ color: 'var(--foreground-muted)' }}>Worked Date</th>
                                      <th className="px-2 py-1 text-left font-medium" style={{ color: 'var(--foreground-muted)' }}>Requested Date</th>
                                      <th className="px-2 py-1 text-left font-medium" style={{ color: 'var(--foreground-muted)' }}>Status</th>
                                      <th className="px-2 py-1 text-left font-medium" style={{ color: 'var(--foreground-muted)' }}>Reason</th>
                                    </tr>
                                  </thead>
                                  <tbody>
                                    {r.reqBreakdown.map((q, i) => (
                                      <tr key={i} style={{ borderTop: '1px solid var(--border)' }}>
                                        <td className="px-2 py-1" style={{ color: 'var(--foreground)' }}>{q.workedDate}</td>
                                        <td className="px-2 py-1" style={{ color: 'var(--foreground)' }}>{q.requestedDate}</td>
                                        <td className="px-2 py-1"><span style={{ color: reqStatusColor[q.status] ?? 'var(--foreground)' }}>{q.status}</span></td>
                                        <td className="px-2 py-1" style={{ color: 'var(--foreground-muted)' }}>{q.reason ?? '—'}</td>
                                      </tr>
                                    ))}
                                  </tbody>
                                </table>
                              )}
                            </div>

                            {/* OT Comp-Off Matching */}
                            <div>
                              <h3 className="mb-2 text-xs font-semibold uppercase" style={{ color: '#7c3aed' }}>
                                OT Settled as Comp-Off (Payroll Matching)
                              </h3>
                              {r.otCompOffBreakdown.length === 0 ? (
                                <div className="text-xs" style={{ color: 'var(--foreground-muted)' }}>No OT comp-off settlements this month.</div>
                              ) : (
                                <table className="min-w-full text-xs">
                                  <thead>
                                    <tr style={{ borderBottom: '1px solid var(--border)' }}>
                                      <th className="px-2 py-1 text-left font-medium" style={{ color: 'var(--foreground-muted)' }}>Date</th>
                                      <th className="px-2 py-1 text-left font-medium" style={{ color: 'var(--foreground-muted)' }}>Day</th>
                                      <th className="px-2 py-1 text-left font-medium" style={{ color: 'var(--foreground-muted)' }}>Shift</th>
                                      <th className="px-2 py-1 text-right font-medium" style={{ color: 'var(--foreground-muted)' }}>OT Calc Min</th>
                                      <th className="px-2 py-1 text-right font-medium" style={{ color: 'var(--foreground-muted)' }}>OT Appr Min</th>
                                      <th className="px-2 py-1 text-center font-medium" style={{ color: 'var(--foreground-muted)' }}>H/W</th>
                                      <th className="px-2 py-1 text-center font-medium" style={{ color: 'var(--foreground-muted)' }}>WO/W</th>
                                    </tr>
                                  </thead>
                                  <tbody>
                                    {r.otCompOffBreakdown.map((d, i) => (
                                      <tr key={i} style={{ borderTop: '1px solid var(--border)' }}>
                                        <td className="px-2 py-1" style={{ color: 'var(--foreground)' }}>{d.date}</td>
                                        <td className="px-2 py-1" style={{ color: 'var(--foreground-muted)' }}>{d.dayOfWeek}</td>
                                        <td className="px-2 py-1" style={{ color: 'var(--foreground)' }}>{d.shiftCode}</td>
                                        <td className="px-2 py-1 text-right" style={{ color: 'var(--foreground)' }}>{d.otMinutesCalculated}</td>
                                        <td className="px-2 py-1 text-right" style={{ color: 'var(--foreground)' }}>{d.otMinutesApproved ?? '—'}</td>
                                        <td className="px-2 py-1 text-center" style={{ color: d.isHolidayWorked ? '#7c3aed' : 'var(--foreground-muted)' }}>{d.isHolidayWorked ? '✓' : '—'}</td>
                                        <td className="px-2 py-1 text-center" style={{ color: d.isWeeklyOffWorked ? '#2563eb' : 'var(--foreground-muted)' }}>{d.isWeeklyOffWorked ? '✓' : '—'}</td>
                                      </tr>
                                    ))}
                                  </tbody>
                                </table>
                              )}
                            </div>
                          </div>
                        </td>
                      </tr>
                    )}
                  </>
                ))}
              </tbody>
              {data.rows.length > 0 && (
                <tfoot>
                  <tr style={{ borderTop: '2px solid var(--border)', backgroundColor: 'var(--surface-hover)' }}>
                    <td colSpan={4}></td>
                    <td className="px-3 py-3 text-right font-bold" style={{ color: 'var(--foreground)' }}>{data.totals.currentBalance.toFixed(2)}</td>
                    <td className="px-3 py-3 text-right font-bold text-green-600">{data.totals.totalEarned.toFixed(2)}</td>
                    <td className="px-3 py-3 text-right font-bold text-red-500">{data.totals.totalUsed.toFixed(2)}</td>
                    <td className="px-3 py-3 text-right font-bold text-green-600">{data.totals.creditsThisMonth.toFixed(2)}</td>
                    <td className="px-3 py-3 text-right font-bold text-red-500">{data.totals.debitsThisMonth.toFixed(2)}</td>
                    <td className="px-3 py-3 text-center font-bold" style={{ color: '#7c3aed' }}>{data.totals.otCompOffCount}</td>
                    <td colSpan={2}></td>
                  </tr>
                </tfoot>
              )}
            </table>
          </div>
        </div>
      ) : null}
    </div>
  );
}
