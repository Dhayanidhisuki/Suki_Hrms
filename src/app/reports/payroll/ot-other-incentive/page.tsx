/**
 * OT & Other Incentive Register — three views over one month's payroll run:
 *
 *   Register    — one row per employee, matching the column set of KUN's
 *                 manual "Overtime Salary Register" workbook exactly.
 *   Department  — one row per department, every column a sum of the register
 *                 above. Derived server-side from the same rows, so the two
 *                 can never disagree. NOTE the workbook's own summary sheet
 *                 mislabels two of these: its "Cumulative" is the MONTHLY OT
 *                 incentive and its "Shift Cont" is the OT WEEKLY incentive.
 *                 Both are labelled honestly here.
 *   Trend       — trailing 12 months, one row per incentive category.
 *
 * Excel export mirrors the workbook's own layout (company/address/title rows
 * above the header, column widths) so the output can drop straight into the
 * existing filing.
 */

'use client';

import { useState, useEffect, useCallback, useMemo, type CSSProperties } from 'react';
import * as XLSX from 'xlsx';

type OcSource = 'payroll' | 'manual' | 'none';

/** Per-cell provenance, produced alongside the value in otIncentiveRegister.ts. */
interface CellExplain {
  source: string;
  formula?: string;
  notes?: string[];
}

interface RegisterRow {
  employeeId: number;
  slNo: number;
  employeeCode: string;
  employeeName: string;
  monthYearLabel: string;
  category: string | null;
  department: string | null;
  designation: string | null;
  dateOfJoining: string | null;
  gender: string | null;
  basic: number;
  otHours: number;
  otValue: number | null;
  otAmount: number;
  otMonthlyIncentive: number;
  otWeeklyIncentive: number;
  doubleMachineIncentive: number;
  attendanceBonus: number;
  shiftIncentive: number;
  employeeReferral: number;
  extraWork: number;
  petrolAllowance: number;
  performanceIncentive: number;
  totOcEarnings: number;
  ocEmployeeEsi: number;
  ocEmployerEsi: number;
  totOcNet: number;
  bankAccountNumber: string | null;
  bankIfsc: string | null;
  bankName: string | null;
  remarks: string;
  sources: { doubleMachineIncentive: OcSource; attendanceBonus: OcSource; shiftIncentive: OcSource };
  explain: Record<string, CellExplain>;
  otStale: boolean;
  storedOtAmount: number | null;
}

interface DepartmentRow {
  department: string;
  otHours: number;
  otAmount: number;
  otMonthlyIncentive: number;
  otWeeklyIncentive: number;
  doubleMachineIncentive: number;
  attendanceBonus: number;
  extraWork: number;
  employeeReferral: number;
  shiftIncentive: number;
  totOcEarnings: number;
}

interface Totals {
  otHours: number; otAmount: number; otMonthlyIncentive: number; otWeeklyIncentive: number;
  doubleMachineIncentive: number; attendanceBonus: number; shiftIncentive: number;
  employeeReferral: number; extraWork: number;
  petrolAllowance: number; performanceIncentive: number; totOcEarnings: number;
  ocEmployeeEsi: number; ocEmployerEsi: number; totOcNet: number;
}

interface RegisterData {
  run: { id: number; year: number; month: number; status: string } | null;
  rows: RegisterRow[];
  totals: Totals;
  departmentSummary: DepartmentRow[];
  staleOtRows: number;
  heldRows: number;
  offRunRows: number;
  esiRates: { employee: number; employer: number } | null;
}

interface TrendData {
  periods: { year: number; month: number; label: string; hasRun: boolean }[];
  rows: { category: string; values: (number | null)[] }[];
}

const MONTH_OPTIONS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
].map((label, i) => ({ value: i + 1, label }));

/**
 * Register columns, in the workbook's exact order.
 *
 * `uiHidden` keeps a column out of the on-screen table only — every export
 * (CSV and Excel) always writes the full set, so the downloaded file stays a
 * drop-in replacement for the manual workbook. `total` names the totals field
 * to show for that column in the footer.
 */
const REGISTER_COLUMNS: {
  key: keyof RegisterRow;
  label: string;
  numeric?: boolean;
  width: number;
  uiHidden?: boolean;
  total?: keyof Totals;
}[] = [
  { key: 'slNo', label: 'Sl No', width: 6 },
  { key: 'employeeCode', label: 'Emp ID', width: 10 },
  { key: 'employeeName', label: 'Employee Name', width: 24 },
  { key: 'monthYearLabel', label: 'Month/Year', width: 11 },
  { key: 'category', label: 'Category', width: 11 },
  { key: 'department', label: 'Department', width: 16 },
  { key: 'designation', label: 'Designation', width: 18 },
  { key: 'dateOfJoining', label: 'Date of Joining', width: 14 },
  { key: 'gender', label: 'Gender', width: 8 },
  { key: 'basic', label: 'Basic (Th)', numeric: true, width: 11 },
  { key: 'otHours', label: 'OT Hrs', numeric: true, width: 9, total: 'otHours' },
  { key: 'otValue', label: 'OT Value', numeric: true, width: 10, uiHidden: true },
  { key: 'otAmount', label: 'OT Amount', numeric: true, width: 12, total: 'otAmount' },
  { key: 'otMonthlyIncentive', label: 'OT Mon Incentive', numeric: true, width: 15, total: 'otMonthlyIncentive' },
  { key: 'otWeeklyIncentive', label: 'OT Weekly Inc', numeric: true, width: 13, total: 'otWeeklyIncentive' },
  { key: 'doubleMachineIncentive', label: 'DM_INC', numeric: true, width: 12, total: 'doubleMachineIncentive' },
  { key: 'attendanceBonus', label: 'ATT_BONUS', numeric: true, width: 12, total: 'attendanceBonus' },
  { key: 'shiftIncentive', label: 'Shift Incentive', numeric: true, width: 13, total: 'shiftIncentive' },
  { key: 'employeeReferral', label: 'Employee Referral', numeric: true, width: 16, total: 'employeeReferral' },
  { key: 'petrolAllowance', label: 'Petrol Allowance', numeric: true, width: 14, total: 'petrolAllowance' },
  { key: 'performanceIncentive', label: 'Performance Incentive', numeric: true, width: 18, total: 'performanceIncentive' },
  { key: 'totOcEarnings', label: 'Tot OC Ear', numeric: true, width: 12, uiHidden: true, total: 'totOcEarnings' },
  { key: 'ocEmployeeEsi', label: 'OC Empl ESI', numeric: true, width: 12, uiHidden: true, total: 'ocEmployeeEsi' },
  { key: 'ocEmployerEsi', label: 'OC Emplr ESI', numeric: true, width: 12, uiHidden: true, total: 'ocEmployerEsi' },
  { key: 'totOcNet', label: 'Tot OC Net', numeric: true, width: 12, uiHidden: true, total: 'totOcNet' },
  { key: 'bankAccountNumber', label: 'Bank A/c No', width: 18, uiHidden: true },
  { key: 'bankIfsc', label: 'Bank IFSC', width: 13, uiHidden: true },
  { key: 'bankName', label: 'Bank Name', width: 22, uiHidden: true },
  { key: 'remarks', label: 'Remarks', width: 14 },
];

/** Columns actually rendered in the on-screen table. */
const VISIBLE_COLUMNS = REGISTER_COLUMNS.filter((c) => !c.uiHidden);

/** Which register column each OC source flag belongs to. */
const SOURCE_KEYS: Partial<Record<keyof RegisterRow, keyof RegisterRow['sources']>> = {
  doubleMachineIncentive: 'doubleMachineIncentive',
  attendanceBonus: 'attendanceBonus',
  shiftIncentive: 'shiftIncentive',
};

const DEPARTMENT_COLUMNS: { key: keyof DepartmentRow; label: string; hint?: string }[] = [
  { key: 'department', label: 'Department' },
  { key: 'otHours', label: 'OT Hrs' },
  { key: 'otAmount', label: 'OT' },
  { key: 'otMonthlyIncentive', label: 'OT Mon Incentive', hint: 'the workbook calls this "Cumulative"' },
  { key: 'otWeeklyIncentive', label: 'OT Weekly Inc', hint: 'the workbook calls this "Shift Cont"' },
  { key: 'doubleMachineIncentive', label: 'DM_INC' },
  { key: 'attendanceBonus', label: 'ATT_BONUS' },
  { key: 'extraWork', label: 'Extra Work', hint: 'no per-employee source exists — always zero' },
  { key: 'employeeReferral', label: 'Employee Referral' },
  { key: 'shiftIncentive', label: 'Shift Incentive' },
  { key: 'totOcEarnings', label: 'Tot OC Ear' },
];

const money = (n: number) => n.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const hours = (n: number) => n.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

/** Column label for an explain key, for the provenance panel's headings. */
const LABEL_FOR: Record<string, string> = Object.fromEntries(
  REGISTER_COLUMNS.map((c) => [String(c.key), c.label])
);

/**
 * Provenance panel. One component, two modes: a single cell, or every
 * explained column in the row. Rendered as a panel rather than a positioned
 * popover because this table is 21 columns wide and horizontally scrolled —
 * an anchored popover would land off-screen as often as not.
 */
function ExplainPanel({
  row, field, onClose, onShowAll,
}: {
  row: RegisterRow;
  field: string | null;
  onClose: () => void;
  onShowAll: () => void;
}) {
  const keys = field ? [field] : REGISTER_COLUMNS.map((c) => String(c.key)).filter((k) => row.explain?.[k]);
  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto p-4"
      style={{ backgroundColor: 'rgba(0,0,0,0.4)' }}
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label="Figure breakdown"
    >
      <div
        className="mt-10 w-full max-w-2xl rounded-xl border p-4"
        style={{ borderColor: 'var(--border)', backgroundColor: 'var(--surface)' }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 className="text-base font-semibold" style={{ color: 'var(--foreground)' }}>
              {field ? LABEL_FOR[field] ?? field : 'Full breakdown'}
            </h2>
            <p className="text-xs" style={{ color: 'var(--foreground-muted)' }}>
              {row.employeeCode} — {row.employeeName} · {row.monthYearLabel}
            </p>
          </div>
          <div className="flex items-center gap-2">
            {field && (
              <button
                onClick={onShowAll}
                className="rounded-lg border px-2.5 py-1 text-xs font-medium"
                style={{ borderColor: 'var(--border)', color: 'var(--foreground)' }}
              >
                Show full breakdown
              </button>
            )}
            <button
              onClick={onClose}
              className="rounded-lg border px-2.5 py-1 text-xs font-medium"
              style={{ borderColor: 'var(--border)', color: 'var(--foreground)' }}
            >
              Close
            </button>
          </div>
        </div>

        <div className="mt-3 space-y-3">
          {keys.map((k) => {
            const e = row.explain?.[k];
            if (!e) return null;
            const raw = (row as unknown as Record<string, unknown>)[k];
            const shown = raw === null || raw === undefined || raw === ''
              ? '—'
              : typeof raw === 'number'
                ? (k === 'otHours' ? hours(raw) : money(raw))
                : String(raw);
            return (
              <div key={k} className="rounded-lg border p-3" style={{ borderColor: 'var(--border)' }}>
                <div className="flex items-baseline justify-between gap-3">
                  <span className="text-sm font-semibold" style={{ color: 'var(--foreground)' }}>
                    {LABEL_FOR[k] ?? k}
                  </span>
                  <span className="text-sm tabular-nums" style={{ color: 'var(--foreground)' }}>{shown}</span>
                </div>
                <p className="mt-1.5 text-xs" style={{ color: 'var(--foreground-muted)' }}>
                  <strong style={{ color: 'var(--foreground)' }}>Source:</strong> {e.source}
                </p>
                {e.formula && (
                  <p className="mt-1 text-xs" style={{ color: 'var(--foreground-muted)' }}>
                    <strong style={{ color: 'var(--foreground)' }}>Working:</strong>{' '}
                    <span className="tabular-nums">{e.formula}</span>
                  </p>
                )}
                {e.notes && e.notes.length > 0 && (
                  <ul className="mt-1 list-disc pl-5 text-xs" style={{ color: 'var(--foreground-muted)' }}>
                    {e.notes.map((nte, i) => <li key={i}>{nte}</li>)}
                  </ul>
                )}
              </div>
            );
          })}
          {keys.length === 0 && (
            <p className="text-sm" style={{ color: 'var(--foreground-muted)' }}>
              Nothing to explain for this column — it is copied straight from the employee record.
            </p>
          )}
        </div>
      </div>
    </div>
  );
}

export default function OtOtherIncentiveReportPage() {
  const now = new Date();
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [view, setView] = useState<'register' | 'department' | 'trend'>('register');
  const [department, setDepartment] = useState('');
  const [search, setSearch] = useState('');

  const [data, setData] = useState<RegisterData | null>(null);
  const [trend, setTrend] = useState<TrendData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  // The provenance panel. `field` null means "every explained column in this
  // row" — the view for walking someone through one employee's figure.
  const [inspect, setInspect] = useState<{ row: RegisterRow; field: string | null } | null>(null);
  const [howOpen, setHowOpen] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      if (view === 'trend') {
        const res = await fetch(`/api/reports/payroll/ot-other-incentive?year=${year}&month=${month}&view=trend`);
        if (!res.ok) throw new Error((await res.json()).error ?? 'Failed to load');
        setTrend(await res.json());
      } else {
        const res = await fetch(`/api/reports/payroll/ot-other-incentive?year=${year}&month=${month}`);
        if (!res.ok) throw new Error((await res.json()).error ?? 'Failed to load');
        setData(await res.json());
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load');
    } finally {
      setLoading(false);
    }
  }, [year, month, view]);

  useEffect(() => { load(); }, [load]);

  const departments = useMemo(
    () => [...new Set((data?.rows ?? []).map((r) => r.department ?? '—'))].sort((a, b) => a.localeCompare(b)),
    [data]
  );

  // Filtering is client-side over the month's rows, and re-numbers Sl No so
  // the filtered view (and its export) reads as its own register.
  const filteredRows = useMemo(() => {
    const q = search.trim().toLowerCase();
    return (data?.rows ?? [])
      .filter((r) => (department === '' || (r.department ?? '—') === department))
      .filter((r) => q === '' || r.employeeCode.toLowerCase().includes(q) || r.employeeName.toLowerCase().includes(q))
      .map((r, i) => ({ ...r, slNo: i + 1 }));
  }, [data, department, search]);

  const filteredTotals = useMemo(() => {
    const t: Totals = {
      otHours: 0, otAmount: 0, otMonthlyIncentive: 0, otWeeklyIncentive: 0,
      doubleMachineIncentive: 0, attendanceBonus: 0, shiftIncentive: 0,
      employeeReferral: 0, extraWork: 0, petrolAllowance: 0, performanceIncentive: 0,
      totOcEarnings: 0, ocEmployeeEsi: 0, ocEmployerEsi: 0, totOcNet: 0,
    };
    for (const r of filteredRows) {
      t.otHours += r.otHours; t.otAmount += r.otAmount;
      t.otMonthlyIncentive += r.otMonthlyIncentive; t.otWeeklyIncentive += r.otWeeklyIncentive;
      t.doubleMachineIncentive += r.doubleMachineIncentive; t.attendanceBonus += r.attendanceBonus;
      t.shiftIncentive += r.shiftIncentive; t.employeeReferral += r.employeeReferral;
      t.extraWork += r.extraWork; t.petrolAllowance += r.petrolAllowance;
      t.performanceIncentive += r.performanceIncentive; t.totOcEarnings += r.totOcEarnings;
      t.ocEmployeeEsi += r.ocEmployeeEsi; t.ocEmployerEsi += r.ocEmployerEsi; t.totOcNet += r.totOcNet;
    }
    return t;
  }, [filteredRows]);

  const filteredDepartments = useMemo(() => {
    if (department === '') return data?.departmentSummary ?? [];
    return (data?.departmentSummary ?? []).filter((d) => d.department === department);
  }, [data, department]);

  const monthLabel = MONTH_OPTIONS[month - 1]?.label.toUpperCase() ?? '';
  const isFiltered = department !== '' || search.trim() !== '';

  const downloadCsv = () => {
    const qs = new URLSearchParams({ year: String(year), month: String(month), format: 'csv' });
    if (view === 'trend') qs.set('view', 'trend');
    else if (view === 'department') qs.set('view', 'department');
    if (department !== '') qs.set('department', department);
    if (search.trim() !== '') qs.set('search', search.trim());
    window.open(`/api/reports/payroll/ot-other-incentive?${qs.toString()}`, '_blank');
  };

  const downloadExcel = () => {
    const wb = XLSX.utils.book_new();
    const titleRows = [
      ['KUN AEROSPACE PVT LTD'],
      ['NO.22&23, AMBATTUR INDUSTRIAL ESTATE,CHENNAI 58.'],
      [`OVERTIME SALARY REGISTER FOR THE MONTH OF ${monthLabel}'${year}`],
    ];

    if (view === 'trend' && trend) {
      const aoa: (string | number | null)[][] = [
        ...titleRows,
        ['SL.NO', 'Overtime Comparison', ...trend.periods.map((p) => p.label)],
        ...trend.rows.map((r, i) => [i + 1, r.category, ...r.values]),
      ];
      const ws = XLSX.utils.aoa_to_sheet(aoa);
      ws['!cols'] = [{ wch: 7 }, { wch: 32 }, ...trend.periods.map(() => ({ wch: 14 }))];
      XLSX.utils.book_append_sheet(wb, ws, 'Overtime Comparison');
    } else if (view === 'department') {
      const aoa: (string | number)[][] = [
        ...titleRows,
        DEPARTMENT_COLUMNS.map((c) => c.label),
        ...filteredDepartments.map((d) => DEPARTMENT_COLUMNS.map((c) => d[c.key])),
        ['Grand Total', filteredTotals.otHours, filteredTotals.otAmount, filteredTotals.otMonthlyIncentive,
          filteredTotals.otWeeklyIncentive, filteredTotals.doubleMachineIncentive, filteredTotals.attendanceBonus,
          filteredTotals.extraWork, filteredTotals.employeeReferral, filteredTotals.shiftIncentive,
          filteredTotals.totOcEarnings],
      ];
      const ws = XLSX.utils.aoa_to_sheet(aoa);
      ws['!cols'] = [{ wch: 20 }, ...DEPARTMENT_COLUMNS.slice(1).map(() => ({ wch: 15 }))];
      XLSX.utils.book_append_sheet(wb, ws, 'Department Summary');
    } else {
      const aoa: (string | number | null)[][] = [
        ...titleRows,
        REGISTER_COLUMNS.map((c) => c.label),
        ...filteredRows.map((r) => REGISTER_COLUMNS.map((c) => {
          const v = r[c.key];
          return typeof v === 'number' || typeof v === 'string' ? v : v === null ? '' : String(v);
        })),
      ];
      const ws = XLSX.utils.aoa_to_sheet(aoa);
      ws['!cols'] = REGISTER_COLUMNS.map((c) => ({ wch: c.width }));
      XLSX.utils.book_append_sheet(wb, ws, 'Salary Export');
    }

    const tag = view === 'trend' ? 'trend' : view === 'department' ? 'department' : 'register';
    XLSX.writeFile(wb, `overtime-salary-${tag}-${year}-${String(month).padStart(2, '0')}.xlsx`);
  };

  const inputStyle: CSSProperties = { backgroundColor: 'var(--surface)', color: 'var(--foreground)', borderColor: 'var(--border)' };
  const cardStyle: CSSProperties = { borderColor: 'var(--border)', backgroundColor: 'var(--surface)' };
  const yearOptions = Array.from({ length: 6 }, (_, i) => now.getFullYear() - 4 + i);

  const noRun = view !== 'trend' && !loading && !error && data !== null && data.run === null;
  const exportDisabled = loading || !!error || (view === 'trend' ? !trend : noRun || filteredRows.length === 0);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h1 className="text-xl font-semibold" style={{ color: 'var(--foreground)' }}>OT &amp; Other Incentive Register</h1>
        <div className="flex items-center gap-2">
          <button
            onClick={downloadExcel}
            disabled={exportDisabled}
            className="inline-flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-sm font-medium disabled:opacity-40"
            style={{ borderColor: 'var(--accent)', color: 'var(--accent)' }}
          >
            Download Excel
          </button>
          <button
            onClick={downloadCsv}
            disabled={exportDisabled}
            className="inline-flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-sm font-medium disabled:opacity-40"
            style={{ borderColor: 'var(--accent)', color: 'var(--accent)' }}
          >
            Download CSV
          </button>
        </div>
      </div>

      <section className="rounded-xl border p-3" style={cardStyle}>
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
            <select value={view} onChange={(e) => setView(e.target.value as typeof view)} className="w-full rounded-lg border px-3 py-2 text-sm" style={inputStyle}>
              <option value="register">Register</option>
              <option value="department">Department Summary</option>
              <option value="trend">12-Month Trend</option>
            </select>
          </div>
          {view !== 'trend' && (
            <>
              <div className="flex flex-col gap-1">
                <label className="text-sm font-medium" style={{ color: 'var(--foreground)' }}>Department</label>
                <select value={department} onChange={(e) => setDepartment(e.target.value)} className="w-full rounded-lg border px-3 py-2 text-sm" style={inputStyle}>
                  <option value="">All departments</option>
                  {departments.map((d) => <option key={d} value={d}>{d}</option>)}
                </select>
              </div>
              {view === 'register' && (
                <div className="flex flex-col gap-1">
                  <label className="text-sm font-medium" style={{ color: 'var(--foreground)' }}>Employee</label>
                  <input
                    type="search"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    placeholder="Code or name…"
                    className="w-full rounded-lg border px-3 py-2 text-sm"
                    style={inputStyle}
                  />
                </div>
              )}
            </>
          )}
        </div>
      </section>

      <section className="rounded-xl border" style={{ borderColor: 'var(--border)', backgroundColor: 'var(--surface)' }}>
        <button
          onClick={() => setHowOpen((o) => !o)}
          aria-expanded={howOpen}
          className="flex w-full items-center justify-between px-3 py-2 text-left text-sm font-medium"
          style={{ color: 'var(--foreground)' }}
        >
          How this report works
          <span aria-hidden style={{ color: 'var(--foreground-muted)' }}>{howOpen ? '▾' : '▸'}</span>
        </button>
        {howOpen && (
          <div className="space-y-3 border-t px-3 py-3 text-xs" style={{ borderColor: 'var(--border)', color: 'var(--foreground-muted)' }}>
            <div>
              <p className="font-semibold" style={{ color: 'var(--foreground)' }}>Payroll-derived columns</p>
              <p>
                <strong>OT Hrs</strong>, <strong>OT Amount</strong> and <strong>OT Mon Incentive</strong> come from
                {' '}<code>computeEmployeeOtForMonth()</code> — the same function payroll itself calls. They carry
                payroll&rsquo;s attendance-status filter, the per-day threshold, rounding slab and daily cap, then the weekly
                and monthly caps, and the OT incentive slab is matched on the <em>capped</em> hours. They can never be
                substituted with a hand-keyed figure.
              </p>
            </div>
            <div>
              <p className="font-semibold" style={{ color: 'var(--foreground)' }}>Manually maintained columns</p>
              <p>
                <strong>DM_INC</strong>, <strong>ATT_BONUS</strong>, <strong>Shift Incentive</strong>,
                {' '}<strong>OT Weekly Inc</strong> and <strong>Employee Referral</strong> all originate in
                {' '}<strong>Workforce &rsaquo; Benefits &rsaquo; Double Machine Incentive</strong>. Payroll pays the rows marked
                complete and writes a component for each, and this report shows that component. OT Weekly Inc and
                Employee Referral have no payroll counterpart at all — there is no rule engine for either.
              </p>
            </div>
            <div>
              <p className="font-semibold" style={{ color: 'var(--foreground)' }}>What the accent colour means</p>
              <p>
                A figure shown in accent with a <strong>*</strong> was keyed in the Benefits module but payroll has
                <em> not</em> paid it for this period — usually because the row is not yet complete, or the run has not been
                recalculated. It will not appear on a payslip until it is.
              </p>
            </div>
            <div>
              <p className="font-semibold" style={{ color: 'var(--foreground)' }}>What &ldquo;hold&rdquo; does</p>
              <p>
                A Benefits entry marked <em>hold</em> pays <strong>zero</strong> across all five incentive columns and is
                excluded from the totals and the ESI split, on both the payslip and here. The keyed amounts stay visible on
                the Benefits screen itself. It is the only status that stops payment.
              </p>
            </div>
            <div>
              <p className="font-semibold" style={{ color: 'var(--foreground)' }}>Tracing any number</p>
              <p>
                Press <strong>i</strong> beside a figure for its source and working, or
                {' '}<strong>Show full breakdown</strong> for every column in that row at once — including the columns kept
                off-screen for width (OT Value, Tot OC Ear, both ESI columns, Tot OC Net).
              </p>
            </div>
          </div>
        )}
      </section>

      {loading && <p className="text-sm" style={{ color: 'var(--foreground-muted)' }}>Loading…</p>}
      {error && <p className="text-sm" style={{ color: 'var(--danger, #dc2626)' }}>{error}</p>}

      {noRun && (
        <section className="rounded-xl border p-8 text-center" style={cardStyle}>
          <p className="text-sm font-medium" style={{ color: 'var(--foreground)' }}>
            No payroll run for {MONTH_OPTIONS[month - 1]?.label} {year}.
          </p>
          <p className="mt-1 text-sm" style={{ color: 'var(--foreground-muted)' }}>
            Every OT figure in this register comes from the same calculation payroll runs, so there is
            nothing to show until payroll has been processed for this period. Run payroll first, then
            come back.
          </p>
        </section>
      )}

      {!loading && !error && data?.run && data.heldRows > 0 && view !== 'trend' && (
        <section className="rounded-xl border p-3" style={{ borderColor: 'var(--border)', backgroundColor: 'var(--surface)' }}>
          <p className="text-sm" style={{ color: 'var(--foreground)' }}>
            <strong>{data.heldRows}</strong> {data.heldRows === 1 ? 'row is' : 'rows are'} marked{' '}
            <em>hold</em>{' '}in Workforce &rsaquo; Benefits &rsaquo; Double Machine Incentive, so every incentive column
            pays zero for {data.heldRows === 1 ? 'that employee' : 'those employees'}. The amounts on hold are still
            visible on that screen.
          </p>
        </section>
      )}

      {!loading && !error && data?.run && data.offRunRows > 0 && view !== 'trend' && (
        <section className="rounded-xl border p-3" style={{ borderColor: 'var(--border)', backgroundColor: 'var(--surface)' }}>
          <p className="text-sm" style={{ color: 'var(--foreground)' }}>
            <strong>{data.offRunRows}</strong> {data.offRunRows === 1 ? 'employee has' : 'employees have'} a Benefits
            entry for this month but no payroll line. {data.offRunRows === 1 ? 'That row is' : 'Those rows are'} included
            and marked <em>NO PAYROLL LINE</em>, with no OT — the incentive is still owed, but it will not reach a
            payslip until they are on the run.
          </p>
        </section>
      )}

      {!loading && !error && data?.run && data.staleOtRows > 0 && view !== 'trend' && (
        <section className="rounded-xl border p-3" style={{ borderColor: 'var(--warning, #d97706)', backgroundColor: 'var(--surface)' }}>
          <p className="text-sm" style={{ color: 'var(--foreground)' }}>
            <strong>{data.staleOtRows}</strong> {data.staleOtRows === 1 ? 'employee’s' : 'employees’'} OT no longer
            matches the amount stored on their payroll line — attendance changed after this run was calculated.
            Those rows are marked <em>STALE</em>. Recalculate the run before paying from this register.
          </p>
        </section>
      )}

      {/* ── Register ── */}
      {!loading && !error && view === 'register' && data?.run && (
        <section className="rounded-xl border p-3 overflow-x-auto" style={cardStyle}>
          <p className="mb-2 text-xs" style={{ color: 'var(--foreground-muted)' }}>
            {filteredRows.length} of {data.rows.length} employees{isFiltered ? ' (filtered)' : ''}
            {data.esiRates && ` · OC ESI at ${data.esiRates.employee}% employee / ${data.esiRates.employer}% employer`}
          </p>
          <table className="text-sm" style={{ minWidth: '1900px' }}>
            <thead>
              <tr style={{ borderBottom: '1px solid var(--border)' }}>
                {VISIBLE_COLUMNS.map((c) => (
                  <th key={String(c.key)} className={`px-2 py-2 font-semibold whitespace-nowrap ${c.numeric ? 'text-right' : 'text-left'}`} style={{ color: 'var(--foreground)' }}>
                    {c.label}
                  </th>
                ))}
                <th className="px-2 py-2 text-left font-semibold whitespace-nowrap" style={{ color: 'var(--foreground)' }}>
                  Breakdown
                </th>
              </tr>
            </thead>
            <tbody>
              {filteredRows.map((r) => (
                <tr key={r.employeeId} style={{ borderTop: '1px solid var(--border)' }}>
                  {VISIBLE_COLUMNS.map((c) => {
                    const v = r[c.key];
                    const sourceKey = SOURCE_KEYS[c.key];
                    const source = sourceKey ? r.sources[sourceKey] : undefined;
                    // Payroll's own component is the expected source once a
                    // run exists, so the marker flags the exception: a figure
                    // keyed in the Benefits module that payroll has not paid.
                    const fellBack = source === 'manual';
                    return (
                      <td
                        key={String(c.key)}
                        className={`px-2 py-1.5 whitespace-nowrap ${c.numeric ? 'text-right tabular-nums' : 'text-left'}`}
                        style={{ color: fellBack ? 'var(--accent)' : 'var(--foreground)' }}
                        title={fellBack ? 'Keyed in Workforce > Benefits > Double Machine Incentive but not yet paid by payroll for this period' : undefined}
                      >
                        {v === null || v === undefined || v === ''
                          ? '—'
                          : c.numeric
                            ? (c.key === 'otHours' ? hours(v as number) : money(v as number))
                            : String(v)}
                        {fellBack && <span aria-hidden className="ml-0.5">*</span>}
                        {r.explain?.[String(c.key)] && (
                          <button
                            onClick={() => setInspect({ row: r, field: String(c.key) })}
                            title={`Where does this ${c.label} come from?`}
                            aria-label={`Explain ${c.label} for ${r.employeeName}`}
                            className="ml-1 rounded-full px-1 text-[10px] leading-none opacity-40 hover:opacity-100"
                            style={{ border: '1px solid var(--border)', color: 'var(--foreground-muted)' }}
                          >
                            i
                          </button>
                        )}
                      </td>
                    );
                  })}
                  <td className="px-2 py-1.5 whitespace-nowrap">
                    <button
                      onClick={() => setInspect({ row: r, field: null })}
                      className="rounded-lg border px-2 py-0.5 text-xs font-medium"
                      style={{ borderColor: 'var(--border)', color: 'var(--foreground)' }}
                    >
                      Show full breakdown
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr style={{ borderTop: '2px solid var(--border)', fontWeight: 600 }}>
                {[...VISIBLE_COLUMNS, null].map((c, i) => c === null ? (
                  <td key="__breakdown" className="px-2 py-2" />
                ) : (
                  <td
                    key={String(c.key)}
                    className={`px-2 py-2 whitespace-nowrap ${c.numeric ? 'text-right tabular-nums' : 'text-left'}`}
                    style={{ color: 'var(--foreground)' }}
                  >
                    {i === 0
                      ? `Total${isFiltered ? ' (filtered)' : ''}`
                      : c.total
                        ? (c.total === 'otHours' ? hours(filteredTotals[c.total]) : money(filteredTotals[c.total]))
                        : ''}
                  </td>
                ))}
              </tr>
            </tfoot>
          </table>
          <p className="mt-2 text-xs" style={{ color: 'var(--foreground-muted)' }}>
            DM_INC, ATT_BONUS, Shift Incentive, OT Weekly Inc and Employee Referral originate in{' '}
            <strong>Workforce &rsaquo; Benefits &rsaquo; Double Machine Incentive</strong> and are paid by payroll once the row is
            marked complete. * in accent colour marks a figure keyed there that payroll has <em>not</em> paid for this
            period — it will not appear on a payslip until the row is completed and the run recalculated.
          </p>
          <p className="mt-1 text-xs" style={{ color: 'var(--foreground-muted)' }}>
            Kept off screen for width, but always written to the CSV and Excel exports:{' '}
            {REGISTER_COLUMNS.filter((c) => c.uiHidden).map((c) => c.label).join(', ')}.
          </p>
        </section>
      )}

      {/* ── Department summary ── */}
      {!loading && !error && view === 'department' && data?.run && (
        <section className="rounded-xl border p-3 overflow-x-auto" style={cardStyle}>
          <table className="text-sm w-full">
            <thead>
              <tr style={{ borderBottom: '1px solid var(--border)' }}>
                {DEPARTMENT_COLUMNS.map((c) => (
                  <th
                    key={String(c.key)}
                    className={`px-2 py-2 font-semibold whitespace-nowrap ${c.key === 'department' ? 'text-left' : 'text-right'}`}
                    style={{ color: 'var(--foreground)' }}
                    title={c.hint}
                  >
                    {c.label}{c.hint && <span aria-hidden className="ml-0.5" style={{ color: 'var(--foreground-muted)' }}>†</span>}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filteredDepartments.map((d) => (
                <tr key={d.department} style={{ borderTop: '1px solid var(--border)' }}>
                  {DEPARTMENT_COLUMNS.map((c) => (
                    <td key={String(c.key)} className={`px-2 py-1.5 whitespace-nowrap ${c.key === 'department' ? 'text-left' : 'text-right tabular-nums'}`} style={{ color: 'var(--foreground)' }}>
                      {c.key === 'department' ? d.department : c.key === 'otHours' ? hours(d[c.key]) : money(d[c.key] as number)}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr style={{ borderTop: '2px solid var(--border)', fontWeight: 600 }}>
                <td className="px-2 py-2" style={{ color: 'var(--foreground)' }}>Grand Total</td>
                <td className="px-2 py-2 text-right tabular-nums" style={{ color: 'var(--foreground)' }}>{hours(filteredTotals.otHours)}</td>
                <td className="px-2 py-2 text-right tabular-nums" style={{ color: 'var(--foreground)' }}>{money(filteredTotals.otAmount)}</td>
                <td className="px-2 py-2 text-right tabular-nums" style={{ color: 'var(--foreground)' }}>{money(filteredTotals.otMonthlyIncentive)}</td>
                <td className="px-2 py-2 text-right tabular-nums" style={{ color: 'var(--foreground)' }}>{money(filteredTotals.otWeeklyIncentive)}</td>
                <td className="px-2 py-2 text-right tabular-nums" style={{ color: 'var(--foreground)' }}>{money(filteredTotals.doubleMachineIncentive)}</td>
                <td className="px-2 py-2 text-right tabular-nums" style={{ color: 'var(--foreground)' }}>{money(filteredTotals.attendanceBonus)}</td>
                <td className="px-2 py-2 text-right tabular-nums" style={{ color: 'var(--foreground)' }}>{money(filteredTotals.extraWork)}</td>
                <td className="px-2 py-2 text-right tabular-nums" style={{ color: 'var(--foreground)' }}>{money(filteredTotals.employeeReferral)}</td>
                <td className="px-2 py-2 text-right tabular-nums" style={{ color: 'var(--foreground)' }}>{money(filteredTotals.shiftIncentive)}</td>
                <td className="px-2 py-2 text-right tabular-nums" style={{ color: 'var(--foreground)' }}>{money(filteredTotals.totOcEarnings)}</td>
              </tr>
            </tfoot>
          </table>
          <p className="mt-2 text-xs" style={{ color: 'var(--foreground-muted)' }}>
            † The manual workbook labels these columns &ldquo;Cumulative&rdquo; and &ldquo;Shift Cont&rdquo;. They are in fact the
            monthly OT incentive and the OT weekly incentive respectively — renamed here to match the register above.
            &ldquo;Extra Work&rdquo; has no per-employee source in the system and is always zero.
          </p>
        </section>
      )}

      {inspect && (
        <ExplainPanel
          row={inspect.row}
          field={inspect.field}
          onClose={() => setInspect(null)}
          onShowAll={() => setInspect({ row: inspect.row, field: null })}
        />
      )}

      {/* ── Trend ── */}
      {!loading && !error && view === 'trend' && trend && (
        <section className="rounded-xl border p-3 overflow-x-auto" style={cardStyle}>
          <table className="text-sm" style={{ minWidth: '1100px' }}>
            <thead>
              <tr style={{ borderBottom: '1px solid var(--border)' }}>
                <th className="px-2 py-2 text-left font-semibold" style={{ color: 'var(--foreground)' }}>SL.NO</th>
                <th className="px-2 py-2 text-left font-semibold whitespace-nowrap" style={{ color: 'var(--foreground)' }}>Overtime Comparison</th>
                {trend.periods.map((p) => (
                  <th key={p.label} className="px-2 py-2 text-right font-semibold whitespace-nowrap" style={{ color: p.hasRun ? 'var(--foreground)' : 'var(--foreground-muted)' }}>
                    {p.label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {trend.rows.map((r, i) => (
                <tr
                  key={r.category}
                  style={{
                    borderTop: '1px solid var(--border)',
                    fontWeight: r.category === 'Total Amount' ? 600 : undefined,
                  }}
                >
                  <td className="px-2 py-1.5" style={{ color: 'var(--foreground)' }}>{i + 1}</td>
                  <td className="px-2 py-1.5 whitespace-nowrap" style={{ color: 'var(--foreground)' }}>{r.category}</td>
                  {r.values.map((v, j) => (
                    <td key={j} className="px-2 py-1.5 text-right tabular-nums" style={{ color: v === null ? 'var(--foreground-muted)' : 'var(--foreground)' }}>
                      {v === null ? '—' : money(v)}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
          <p className="mt-2 text-xs" style={{ color: 'var(--foreground-muted)' }}>
            &ldquo;—&rdquo; marks a month with no payroll run. &ldquo;Total Amount&rdquo; is the sum of the incentive rows above it;
            &ldquo;LOP Salary Recovered&rdquo; is structured gross minus earned gross and sits outside that total.
          </p>
        </section>
      )}
    </div>
  );
}
