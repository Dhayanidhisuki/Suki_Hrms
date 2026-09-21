/**
 * F&F Settlement Register.
 *
 * One row per settlement in a last-working-day range, with the component
 * breakdown behind the net. Figures are the stored settlement columns, never
 * recalculated, so the register always agrees with what was approved and paid.
 */

'use client';

import { useCallback, useEffect, useState } from 'react';
import * as XLSX from 'xlsx';
import {
  Alert, Button, DataTable, PageHeader, SectionCard, StatusBadge, Spinner,
  type BadgeTone, type Column,
} from '@/components/ui';
import { FNF_STATUS_TONE } from '@/lib/fnf/workflow';

interface Row {
  // DataTable keys rows by `id`; the register's identity is the settlement.
  id: number;
  settlementId: number;
  employeeCode: string;
  employeeName: string;
  designation: string | null;
  department: string | null;
  exitType: string | null;
  lastWorkingDay: string;
  status: string;
  unpaidSalary: number;
  leaveEncashment: number;
  gratuity: number;
  bonusProportion: number;
  arrearsAmount: number;
  incentiveAmount: number;
  otherPayments: number;
  noticePay: number;
  loanRecovery: number;
  assetRecovery: number;
  tdsDeduction: number;
  pfDeduction: number;
  esiDeduction: number;
  ptDeduction: number;
  otherDeductions: number;
  totalPayable: number;
  totalRecovery: number;
  netPayable: number;
  paymentDate: string | null;
}

interface Totals { count: number; totalPayable: number; totalRecovery: number; netPayable: number }

const STATUSES = [
  'pending', 'calculated', 'pending_manager', 'submitted', 'approved',
  'finance_verified', 'paid', 'completed', 'rejected', 'cancelled', 'on_hold',
];

const inputCls = 'rounded-lg border px-3 py-2 text-sm focus:outline-none focus:ring-2';
const inputStyle = { backgroundColor: 'var(--background)', color: 'var(--foreground)', borderColor: 'var(--border)' } as const;

const money = (n: number) => n.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const titleCase = (s: string) => s.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());

export default function FullAndFinalRegisterPage() {
  const [rows, setRows] = useState<Row[]>([]);
  const [totals, setTotals] = useState<Totals>({ count: 0, totalPayable: 0, totalRecovery: 0, netPayable: 0 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [status, setStatus] = useState('');

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({
        ...(from ? { from } : {}),
        ...(to ? { to } : {}),
        ...(status ? { status } : {}),
      });
      const res = await fetch(`/api/reports/payroll/full-and-final?${params}`);
      if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error ?? 'Failed to load the register');
      const body = await res.json();
      setRows(((body.data ?? []) as Omit<Row, 'id'>[]).map((r) => ({ ...r, id: r.settlementId })));
      setTotals(body.totals ?? { count: 0, totalPayable: 0, totalRecovery: 0, netPayable: 0 });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  }, [from, to, status]);

  // Same fetch-in-effect shape every list screen in this app uses.
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { void fetchData(); }, [fetchData]);

  const exportExcel = () => {
    if (rows.length === 0) return;
    const sheet = rows.map((r) => ({
      'Settlement ID': r.settlementId,
      'Employee Code': r.employeeCode,
      'Employee Name': r.employeeName,
      Designation: r.designation ?? '',
      Department: r.department ?? '',
      'Exit Type': r.exitType ? titleCase(r.exitType) : '',
      'Last Working Day': r.lastWorkingDay?.slice(0, 10) ?? '',
      Status: titleCase(r.status),
      'Unpaid Salary': r.unpaidSalary,
      'Leave Encashment': r.leaveEncashment,
      Gratuity: r.gratuity,
      Bonus: r.bonusProportion,
      Arrears: r.arrearsAmount,
      Incentive: r.incentiveAmount,
      'Other Payments': r.otherPayments,
      'Notice Pay': r.noticePay,
      'Loan Recovery': r.loanRecovery,
      'Asset Recovery': r.assetRecovery,
      TDS: r.tdsDeduction,
      PF: r.pfDeduction,
      ESI: r.esiDeduction,
      PT: r.ptDeduction,
      'Other Deductions': r.otherDeductions,
      'Total Payable': r.totalPayable,
      'Total Recovery': r.totalRecovery,
      'Net Payable': r.netPayable,
      'Payment Date': r.paymentDate?.slice(0, 10) ?? '',
    }));
    const ws = XLSX.utils.json_to_sheet(sheet);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'F&F Register');
    const tag = [from, to].filter(Boolean).join('_to_') || 'all';
    XLSX.writeFile(wb, `fnf-register-${tag}.xlsx`);
  };

  const columns: Column<Row>[] = [
    {
      key: 'employee',
      label: 'Employee',
      render: (r) => (
        <div className="leading-tight">
          <div className="font-medium">{r.employeeCode} — {r.employeeName}</div>
          <div className="text-[11px]" style={{ color: 'var(--foreground-muted)' }}>
            {[r.designation, r.department].filter(Boolean).join(' · ') || '—'}
          </div>
        </div>
      ),
    },
    { key: 'exitType', label: 'Exit', render: (r) => <span className="text-xs">{r.exitType ? titleCase(r.exitType) : '—'}</span> },
    { key: 'lastWorkingDay', label: 'LWD', render: (r) => <span className="text-xs tabular-nums">{r.lastWorkingDay?.slice(0, 10) ?? '—'}</span> },
    { key: 'totalPayable', label: 'Payable', render: (r) => <span className="tabular-nums">{money(r.totalPayable)}</span> },
    { key: 'totalRecovery', label: 'Recovery', render: (r) => <span className="tabular-nums">{money(r.totalRecovery)}</span> },
    { key: 'netPayable', label: 'Net', render: (r) => <span className="font-medium tabular-nums">{money(r.netPayable)}</span> },
    {
      key: 'status',
      label: 'Status',
      render: (r) => (
        <StatusBadge tone={(FNF_STATUS_TONE[r.status] ?? 'neutral') as BadgeTone} dot>
          {titleCase(r.status)}
        </StatusBadge>
      ),
    },
  ];

  return (
    <div className="space-y-4">
      <PageHeader
        eyebrow="Payroll Reports"
        title="F&F Settlement Register"
        description="Settlements by last working day, with the component breakdown behind each net. Figures are as stored — never recalculated."
        actions={<Button variant="primary" onClick={exportExcel} disabled={rows.length === 0}>Export Excel</Button>}
      />

      {error && <Alert tone="danger" onDismiss={() => setError(null)}>{error}</Alert>}

      <SectionCard title="Filters">
        <div className="flex flex-wrap items-end gap-3">
          <label className="text-xs">
            <span className="block" style={{ color: 'var(--foreground-muted)' }}>Last working day from</span>
            <input type="date" className={inputCls} style={inputStyle} value={from} onChange={(e) => setFrom(e.target.value)} />
          </label>
          <label className="text-xs">
            <span className="block" style={{ color: 'var(--foreground-muted)' }}>To</span>
            <input type="date" className={inputCls} style={inputStyle} value={to} onChange={(e) => setTo(e.target.value)} />
          </label>
          <label className="text-xs">
            <span className="block" style={{ color: 'var(--foreground-muted)' }}>Status</span>
            <select className={inputCls} style={inputStyle} value={status} onChange={(e) => setStatus(e.target.value)}>
              <option value="">All statuses</option>
              {STATUSES.map((s) => <option key={s} value={s}>{titleCase(s)}</option>)}
            </select>
          </label>
        </div>
      </SectionCard>

      <SectionCard title="Settlements" count={loading ? undefined : totals.count} flush>
        {loading ? (
          <div className="flex justify-center p-8"><Spinner /></div>
        ) : (
          <>
            <DataTable
              variant="card"
              columns={columns}
              data={rows}
              loading={loading}
              emptyMessage="No settlements match these filters."
            />
            {rows.length > 0 && (
              <div
                className="flex flex-wrap justify-end gap-6 border-t px-4 py-3 text-sm"
                style={{ borderColor: 'var(--border)' }}
              >
                <span style={{ color: 'var(--foreground-muted)' }}>
                  Payable <span className="font-medium tabular-nums" style={{ color: 'var(--foreground)' }}>{money(totals.totalPayable)}</span>
                </span>
                <span style={{ color: 'var(--foreground-muted)' }}>
                  Recovery <span className="font-medium tabular-nums" style={{ color: 'var(--foreground)' }}>{money(totals.totalRecovery)}</span>
                </span>
                <span style={{ color: 'var(--foreground-muted)' }}>
                  Net <span className="font-semibold tabular-nums" style={{ color: 'var(--foreground)' }}>{money(totals.netPayable)}</span>
                </span>
              </div>
            )}
          </>
        )}
      </SectionCard>
    </div>
  );
}
