/**
 * Employee Self Service — Leave Management. Apply for leave, see remaining
 * balance per leave type at a glance, and review/cancel application
 * history. Self-service: always the logged-in user's own employee record,
 * resolved server-side. Two-stage approval (Reporting Manager → HR), same
 * engine as the HR-side Leave Approval page — this is just the self-scoped
 * apply/view surface.
 */

'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { Trash2 } from 'lucide-react';
import {
  DataTable,
  FormModal,
  Button,
  GaugeCard,
  GAUGE_TONES,
  PageBreadcrumb,
  useToast,
  useConfirm,
  type Column,
  type FieldDef,
} from '@/components/ui';
import { handleExport } from '@/lib/export-utils';

interface LeaveType {
  id: number;
  code: string;
  name: string;
  description: string | null;
}

interface LeaveBalanceRow {
  id: number;
  year: number;
  openingBalance: string;
  accrued: string;
  availed: string;
  closingBalance: string;
  previousClosingBalance: number | null;
  leaveMaster: { id: number; code: string; name: string };
}

interface LeaveApplicationRow {
  id: number;
  fromDate: string;
  toDate: string;
  numberOfDays: string;
  isHalfDay: boolean;
  reason: string | null;
  status: string;
  appliedAt: string;
  managerRejectionReason: string | null;
  rejectionReason: string | null;
  leaveMaster: { id: number; code: string; name: string };
}

interface CompOffBalance { available: number; earned: number; used: number; expired: number }

const STATUS_TONE: Record<string, { bg: string; fg: string }> = {
  pending_manager: { bg: '#fef9c3', fg: '#854d0e' },
  pending_hr: { bg: '#dbeafe', fg: '#1e40af' },
  approved: { bg: '#dcfce7', fg: '#166534' },
  rejected: { bg: '#fee2e2', fg: '#991b1b' },
  cancelled: { bg: '#f1f5f9', fg: '#475569' },
};

const STATUS_LABEL: Record<string, string> = {
  pending_manager: 'Pending Manager',
  pending_hr: 'Pending HR',
  approved: 'Approved',
  rejected: 'Rejected',
  cancelled: 'Cancelled',
};

const CANCELLABLE = new Set(['pending_manager', 'pending_hr', 'approved']);

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric', timeZone: 'UTC' });
}

/** GET /api/workforce/my-leave/preview — the plan the server will debit. */
interface LeavePreview {
  count: number;
  calendarDays: number;
  skippedDates: { date: string; reason: 'WeeklyOff' | 'Holiday' }[];
  punchedDates: string[];
  workedFullDayDates: string[];
  sandwichDates: string[];
}

function fmtShort(ymd: string): string {
  return new Date(`${ymd}T00:00:00Z`).toLocaleDateString('en-IN', { weekday: 'short', day: '2-digit', month: 'short', timeZone: 'UTC' });
}

const CAL_MONTH_NAMES = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
const CAL_DOW = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'];
const isoOf = (year: number, month: number, day: number) => `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;

export default function EssLeavePage() {
  const { confirm } = useConfirm();
  const [year, setYear] = useState(new Date().getFullYear());
  const [types, setTypes] = useState<LeaveType[]>([]);
  const [balances, setBalances] = useState<LeaveBalanceRow[]>([]);
  const [applications, setApplications] = useState<LeaveApplicationRow[]>([]);
  const [compOffBalance, setCompOffBalance] = useState<CompOffBalance | null>(null);
  const [reportingManagerName, setReportingManagerName] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const toast = useToast();

  const [typeFilter, setTypeFilter] = useState('All');
  const [statusFilter, setStatusFilter] = useState('All');

  // Re-seeds FormModal's internal values when its object identity changes
  // (even while already open) — how the Comp-Off dialog below feeds its
  // confirmed dates back into the form it sits on top of.
  const [formInitialValues, setFormInitialValues] = useState<Record<string, string | number | boolean>>({});
  const [compOffModalOpen, setCompOffModalOpen] = useState(false);
  const [compOffWorkedDate, setCompOffWorkedDate] = useState('');
  const [compOffLeaveDate, setCompOffLeaveDate] = useState('');
  // Which date the calendar's next click sets — auto-advances from worked
  // to off once the worked date is picked, but either dot can be reselected.
  const [compOffPickMode, setCompOffPickMode] = useState<'worked' | 'off'>('worked');
  const [compOffCalMonth, setCompOffCalMonth] = useState(() => new Date().getMonth());
  const [compOffCalYear, setCompOffCalYear] = useState(() => new Date().getFullYear());
  const [compOffEligibleDates, setCompOffEligibleDates] = useState<string[]>([]);
  const [compOffExpiryMonths, setCompOffExpiryMonths] = useState(0);

  const openCompOffModal = useCallback(() => {
    const now = new Date();
    setCompOffCalMonth(now.getMonth());
    setCompOffCalYear(now.getFullYear());
    setCompOffModalOpen(true);
    fetch('/api/workforce/comp-off-eligible-dates')
      .then((res) => (res.ok ? res.json() : { dates: [], expiryMonths: 0 }))
      .then((json: { dates: string[]; expiryMonths: number }) => {
        setCompOffEligibleDates(json.dates ?? []);
        setCompOffExpiryMonths(json.expiryMonths ?? 0);
      })
      .catch(() => {
        setCompOffEligibleDates([]);
        setCompOffExpiryMonths(0);
      });
  }, []);

  const fetchAll = useCallback(async () => {
    setLoading(true);
    try {
      const [typesRes, leaveRes] = await Promise.all([
        fetch('/api/workforce/my-leave/types'),
        fetch(`/api/workforce/my-leave?year=${year}`),
      ]);
      if (!typesRes.ok) throw new Error((await typesRes.json().catch(() => ({}))).error ?? 'Failed to load leave types');
      if (!leaveRes.ok) throw new Error((await leaveRes.json().catch(() => ({}))).error ?? 'Failed to load leave data');
      const typesJson = await typesRes.json();
      const leaveJson = await leaveRes.json();
      setTypes(typesJson.data ?? []);
      setBalances(leaveJson.balances ?? []);
      setApplications(leaveJson.applications ?? []);
      setCompOffBalance(leaveJson.compOffBalance ?? null);
      setReportingManagerName(leaveJson.reportingManagerName ?? null);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to load');
    } finally {
      setLoading(false);
    }
  }, [year, toast]);

  useEffect(() => {
    // The fetch flips `loading` on entry, which is the point: that state is
    // what drives the spinner.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void fetchAll();
  }, [fetchAll]);

  function computeDays(fromDate: string, toDate: string, isHalfDay: boolean): number {
    if (!fromDate || !toDate) return 0;
    if (isHalfDay) return 0.5;
    const from = new Date(fromDate);
    const to = new Date(toDate);
    const diff = Math.round((to.getTime() - from.getTime()) / 86400000) + 1;
    return diff > 0 ? diff : 0;
  }

  const applyForLeave = async (values: Record<string, string | number | boolean>) => {
    const leaveMasterId = String(values.leaveMasterId);
    const isHalfDay = Boolean(values.isHalfDay);
    const fromDate = String(values.fromDate);
    const toDate = isHalfDay ? fromDate : String(values.toDate);

    const res = await fetch('/api/workforce/my-leave', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        leaveMasterId,
        fromDate,
        toDate,
        isHalfDay,
        reason: values.reason || null,
      }),
    });
    if (!res.ok) {
      const j = await res.json().catch(() => ({}));
      throw new Error(j.error ?? 'Failed to submit application');
    }
    toast.success('Leave application submitted for approval.');
    await fetchAll();
  };

  async function cancelApplication(id: number) {
    if (
      !(await confirm({
        title: 'Cancel this leave application?',
        message: 'The application will be withdrawn from the approval queue.',
        confirmLabel: 'Cancel application',
        cancelLabel: 'Keep it',
        tone: 'danger',
      }))
    )
      return;
    try {
      const res = await fetch(`/api/workforce/my-leave/${id}/cancel`, { method: 'POST' });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        throw new Error(j.error ?? 'Failed to cancel');
      }
      toast.success('Leave application cancelled.');
      await fetchAll();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to cancel');
    }
  }

  function exportLeaveData(format: 'csv' | 'excel' | 'pdf') {
    const exportData = applications.map((a) => ({
      'Leave Type': a.leaveMaster.name,
      'From Date': formatDate(a.fromDate),
      'To Date': formatDate(a.toDate),
      Days: Number(a.numberOfDays).toFixed(1),
      'Half Day': a.isHalfDay ? 'Yes' : 'No',
      Status: STATUS_LABEL[a.status] ?? a.status,
      Reason: a.reason ?? '',
      'Rejection Reason': a.rejectionReason ?? a.managerRejectionReason ?? '',
    }));

    handleExport({
      filename: `leave-applications_${year}`,
      data: exportData,
      format,
      title: `Leave Applications - ${year}`,
    });
  }

  const filteredApplications = useMemo(() => {
    return applications.filter((a) => {
      if (typeFilter !== 'All' && String(a.leaveMaster.id) !== typeFilter) return false;
      if (statusFilter !== 'All' && a.status !== statusFilter) return false;
      return true;
    });
  }, [applications, typeFilter, statusFilter]);

  // FormModal owns its own field state; these mirror just the fields the
  // preview panel needs, kept in sync via onFieldChange below.
  const [formLeaveMasterId, setFormLeaveMasterId] = useState('');
  const [formFromDate, setFormFromDate] = useState('');
  const [formToDate, setFormToDate] = useState('');
  const [formHalfDay, setFormHalfDay] = useState(false);
  const selectedType = types.find((t) => String(t.id) === formLeaveMasterId);
  const isCompOff = selectedType?.code === 'COMPOFF';
  // Working days come from the server (weekly offs / holidays skipped, the
  // same computation approval debits); the local calendar count only fills
  // in while the preview is loading.
  const [serverPreview, setServerPreview] = useState<LeavePreview | null>(null);
  useEffect(() => {
    if (!formLeaveMasterId || !formFromDate || (!formHalfDay && !formToDate)) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setServerPreview(null);
      return;
    }
    const to = formHalfDay ? formFromDate : formToDate;
    const controller = new AbortController();
    fetch(`/api/workforce/my-leave/preview?leaveMasterId=${formLeaveMasterId}&from=${formFromDate}&to=${to}&isHalfDay=${formHalfDay}`, { signal: controller.signal })
      .then((r) => (r.ok ? r.json() : null))
      .then((j: LeavePreview | null) => setServerPreview(j))
      .catch(() => {});
    return () => controller.abort();
  }, [formLeaveMasterId, formFromDate, formToDate, formHalfDay]);
  const previewDays = serverPreview ? serverPreview.count : computeDays(formFromDate, formHalfDay ? formFromDate : formToDate, formHalfDay);

  // Comp-Off draws from a separate running ledger (CompOffBalance), not
  // LeaveBalance, so its remaining count has to be looked up there instead.
  const remainingByTypeId = useMemo(() => {
    const map = new Map<number, number>();
    for (const b of balances) map.set(b.leaveMaster.id, Number(b.closingBalance));
    const compOffType = types.find((t) => t.code === 'COMPOFF');
    if (compOffType && compOffBalance) map.set(compOffType.id, compOffBalance.available);
    return map;
  }, [balances, compOffBalance, types]);

  const selectedRemaining = selectedType ? remainingByTypeId.get(selectedType.id) : undefined;
  const remainingAfter = selectedRemaining !== undefined ? selectedRemaining - previewDays : undefined;

  const compOffTypeId = types.find((t) => t.code === 'COMPOFF')?.id;
  /** Comp-Off selected → dates come from the dedicated calendar dialog, not the plain date fields. */
  const isManagerCompOff = (v: Record<string, string | number | boolean | undefined>) =>
    compOffTypeId !== undefined && String(v.leaveMasterId) === String(compOffTypeId);

  const fields: FieldDef[] = [
    {
      name: 'leaveMasterId',
      label: 'Leave Type',
      type: 'select',
      required: true,
      options: types.map((t) => {
        const remaining = remainingByTypeId.get(t.id);
        return { value: String(t.id), label: remaining !== undefined ? `${t.name} (${remaining} left)` : t.name };
      }),
    },
    {
      name: 'fromDate',
      label: 'From Date',
      type: 'date',
      required: true,
      showIf: (v) => !isManagerCompOff(v),
    },
    {
      name: 'toDate',
      label: 'To Date',
      type: 'date',
      required: true,
      showIf: (v) => !v.isHalfDay && !isManagerCompOff(v),
    },
    {
      name: 'isHalfDay',
      label: 'Half day',
      type: 'checkbox',
      showIf: (v) => !isManagerCompOff(v),
    },
    { name: 'reason', label: 'Reason', type: 'textarea' },
  ];

  const inputClass =
    'h-9 cursor-pointer rounded-lg border border-[var(--border-main)] bg-[var(--bg-subtle)] px-3 text-[12px] font-semibold text-[var(--text-secondary)] outline-none focus:border-[var(--primary)]';

  const columns: Column<LeaveApplicationRow>[] = [
    { key: 'appliedAt', label: 'Submitted', render: (r) => formatDate(r.appliedAt) },
    {
      key: 'numberOfDays',
      label: 'Amount',
      render: (r) => (
        <span
          className="inline-block rounded-md px-2 py-0.5 text-xs font-semibold tabular-nums"
          style={{ backgroundColor: 'var(--bg-subtle)', color: 'var(--text-secondary)' }}
        >
          {Number(r.numberOfDays).toFixed(r.isHalfDay ? 1 : 0)}d
        </span>
      ),
    },
    { key: 'type', label: 'Type', render: (r) => r.leaveMaster.name },
    {
      key: 'date',
      label: 'Date',
      render: (r) => `${formatDate(r.fromDate)} – ${formatDate(r.toDate)}`,
    },
    { key: 'to', label: 'To', render: () => reportingManagerName ?? '—' },
    {
      key: 'status',
      label: 'Status',
      render: (r) => {
        const tone = STATUS_TONE[r.status] ?? { bg: '#f3f4f6', fg: '#4b5563' };
        return (
          <span className="rounded-full px-2 py-0.5 text-xs font-medium" style={{ backgroundColor: tone.bg, color: tone.fg }}>
            {STATUS_LABEL[r.status] ?? r.status}
          </span>
        );
      },
    },
  ];

  const gaugeCards = [
    ...balances.map((b, i) => {
      const closing = Number(b.closingBalance);
      const max = Number(b.openingBalance) + Number(b.accrued);
      const prev = b.previousClosingBalance;
      const deltaPct = prev !== null && prev > 0 ? Math.round(((closing - prev) / prev) * 100) : null;
      return (
        <GaugeCard
          key={b.id}
          label={b.leaveMaster.name}
          value={Math.round(closing)}
          max={max}
          deltaPct={deltaPct}
          tone={GAUGE_TONES[i % GAUGE_TONES.length]}
        />
      );
    }),
    // Comp-Off draws from a separate running ledger (CompOffBalance), not
    // LeaveBalance, so it has no prior-year snapshot to compare against —
    // shown with no delta rather than a fabricated one.
    compOffBalance && compOffBalance.earned > 0 ? (
      <GaugeCard
        key="compoff"
        label="Comp-Off"
        value={Math.round(compOffBalance.available)}
        max={Math.max(compOffBalance.earned, compOffBalance.available)}
        deltaPct={null}
        tone={GAUGE_TONES[balances.length % GAUGE_TONES.length]}
      />
    ) : null,
  ].filter(Boolean);

  return (
    <div className="space-y-5">
      <div>
        <PageBreadcrumb items={[{ label: 'Dashboard', href: '/ess/dashboard' }, { label: 'My Requests' }]} />
        <h1 className="mt-1 text-2xl font-bold tracking-tight" style={{ color: 'var(--text-primary)' }}>My Requests</h1>
      </div>

      {gaugeCards.length > 0 && (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">{gaugeCards}</div>
      )}

      <div className="rounded-2xl border p-5" style={{ borderColor: 'var(--border-main)', backgroundColor: 'var(--bg-card)' }}>
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-lg font-bold" style={{ color: 'var(--text-primary)' }}>My Requests</h2>
          <div className="flex flex-wrap items-center gap-2">
            <Button variant="ghost" size="sm" onClick={() => exportLeaveData('csv')} disabled={applications.length === 0}>CSV</Button>
            <Button variant="ghost" size="sm" onClick={() => exportLeaveData('excel')} disabled={applications.length === 0}>Excel</Button>
            <Button variant="ghost" size="sm" onClick={() => exportLeaveData('pdf')} disabled={applications.length === 0}>PDF</Button>
            <Button
              variant="primary"
              onClick={() => {
                setFormLeaveMasterId('');
                setFormFromDate('');
                setFormToDate('');
                setFormHalfDay(false);
                setFormInitialValues({});
                setCompOffWorkedDate('');
                setCompOffLeaveDate('');
                setCompOffPickMode('worked');
                setModalOpen(true);
              }}
            >
              Submit Request
            </Button>
          </div>
        </div>

        <DataTable
          variant="card"
          columns={columns}
          data={filteredApplications}
          loading={loading}
          emptyMessage={`No leave applications for ${year}.`}
          renderRowActions={(row) =>
            CANCELLABLE.has(row.status) ? (
              <button
                onClick={() => cancelApplication(row.id)}
                title="Cancel this request"
                className="rounded-md p-1.5 text-[var(--danger)] transition hover:bg-[var(--danger-soft)]"
              >
                <Trash2 size={14} />
              </button>
            ) : null
          }
          filters={
            <div className="flex flex-wrap items-center gap-2">
              <select value={typeFilter} onChange={(e) => setTypeFilter(e.target.value)} aria-label="Leave Type" className={inputClass}>
                <option value="All">All leave types</option>
                {types.map((t) => (
                  <option key={t.id} value={t.id}>{t.name}</option>
                ))}
              </select>
              <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} aria-label="Status" className={inputClass}>
                <option value="All">All statuses</option>
                {Object.entries(STATUS_LABEL).map(([value, label]) => (
                  <option key={value} value={value}>{label}</option>
                ))}
              </select>
              <input
                type="number"
                value={year}
                onChange={(e) => setYear(Number(e.target.value))}
                aria-label="Year"
                className={`${inputClass} w-24 cursor-text`}
              />
            </div>
          }
        />
      </div>

      <FormModal
        title="Submit Leave Request"
        fields={fields}
        initialValues={formInitialValues}
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        onSubmit={applyForLeave}
        submitLabel="Submit Request"
        onFieldChange={(name, value, values) => {
          if (name === 'leaveMasterId') {
            setFormLeaveMasterId(String(value));
            if (compOffTypeId !== undefined && String(value) === String(compOffTypeId)) {
              setCompOffWorkedDate('');
              setCompOffLeaveDate('');
              setCompOffPickMode('worked');
              openCompOffModal();
            }
          }
          if (name === 'fromDate') setFormFromDate(String(value));
          if (name === 'toDate') setFormToDate(String(value));
          if (name === 'isHalfDay') setFormHalfDay(Boolean(value));
          void values;
        }}
      >
        {previewDays > 0 && (
          <div className="text-xs" style={{ color: remainingAfter !== undefined && remainingAfter < 0 ? '#991b1b' : 'var(--text-muted)' }}>
            {previewDays} working day{previewDays !== 1 ? 's' : ''} will be requested
            {serverPreview && serverPreview.skippedDates.length > 0 && (
              <> ({serverPreview.skippedDates.map((d) => `${fmtShort(d.date)} ${d.reason === 'WeeklyOff' ? 'weekly off' : 'holiday'}`).join(', ')} skipped)</>
            )}
            {serverPreview && serverPreview.sandwichDates.length > 0 && (
              <> — {serverPreview.sandwichDates.map((d) => fmtShort(d)).join(', ')} counted as LOP (sandwiched)</>
            )}
            .
            {remainingAfter !== undefined && (
              remainingAfter < 0
                ? ` Only ${selectedRemaining} available — this exceeds your balance.`
                : ` ${remainingAfter} will remain after this request.`
            )}
          </div>
        )}
        {serverPreview && serverPreview.count === 0 && (
          <div className="text-xs" style={{ color: '#991b1b' }}>Every date in this range is a weekly off or holiday — nothing to apply for.</div>
        )}
        {serverPreview && (formHalfDay ? serverPreview.workedFullDayDates : serverPreview.punchedDates).length > 0 && (
          <div className="text-xs" style={{ color: '#991b1b' }}>
            Attendance is already punched on {(formHalfDay ? serverPreview.workedFullDayDates : serverPreview.punchedDates).map(fmtShort).join(', ')} — leave cannot be applied for a worked day.
          </div>
        )}

        {/* Comp-Off has no row in the gauge cards above driven by
            LeaveBalance (it draws from a separate ledger), so without this
            the employee would have no way to know what they can actually
            take before submitting. */}
        {isCompOff && compOffBalance && (
          <div className="rounded-lg border px-3 py-2 text-xs" style={{ borderColor: 'var(--border-main)', backgroundColor: 'var(--bg-subtle)' }}>
            <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
              <span style={{ color: 'var(--text-muted)' }}>Comp-Off Balance:</span>
              <span style={{ color: 'var(--text-primary)' }}>
                <strong>{compOffBalance.available}</strong> available
              </span>
              <span style={{ color: 'var(--text-muted)' }}>
                ({compOffBalance.earned} earned · {compOffBalance.used} used
                {compOffBalance.expired > 0 ? ` · ${compOffBalance.expired} expired` : ''})
              </span>
            </div>
            {previewDays > compOffBalance.available && (
              <div className="mt-1" style={{ color: '#854d0e' }}>
                This request ({previewDays} day{previewDays !== 1 ? 's' : ''}) exceeds your available balance — it will be refused at submission.
              </div>
            )}
            {(compOffWorkedDate || compOffLeaveDate) && (
              <div className="mt-2 flex flex-wrap items-center gap-2">
                {compOffWorkedDate && (
                  <span className="rounded-full px-2.5 py-1 font-medium" style={{ backgroundColor: '#dcfce7', color: '#166534' }}>
                    Worked: {compOffWorkedDate}
                  </span>
                )}
                {compOffLeaveDate && (
                  <span className="rounded-full px-2.5 py-1 font-medium" style={{ backgroundColor: '#fee2e2', color: '#991b1b' }}>
                    Off: {compOffLeaveDate}
                  </span>
                )}
                <button
                  type="button"
                  onClick={openCompOffModal}
                  className="text-xs font-medium underline"
                  style={{ color: 'var(--primary, #2563eb)' }}
                >
                  Change dates
                </button>
              </div>
            )}
          </div>
        )}
      </FormModal>

      {compOffModalOpen && (
        <div className="fixed inset-0 z-[80] flex items-center justify-center p-4" style={{ backgroundColor: 'rgba(0,0,0,0.4)' }} onClick={() => setCompOffModalOpen(false)}>
          <div
            className="w-full max-w-md rounded-xl shadow-2xl"
            style={{ backgroundColor: 'var(--surface, #fff)', border: '1px solid var(--border, #e5e7eb)' }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b px-5 py-4" style={{ borderColor: 'var(--border, #e5e7eb)' }}>
              <h2 className="text-base font-semibold" style={{ color: 'var(--foreground, #111827)' }}>Compensatory Off</h2>
              <button onClick={() => setCompOffModalOpen(false)} className="text-lg leading-none hover:opacity-70" style={{ color: 'var(--foreground-muted, #6b7280)' }}>×</button>
            </div>

            <div className="space-y-4 px-5 py-4">
              <div className="rounded-lg border px-3 py-2 text-sm" style={{ borderColor: 'var(--border, #e5e7eb)', backgroundColor: 'rgba(59,130,246,0.06)' }}>
                Available Comp-Off balance:{' '}
                <strong>{compOffBalance ? compOffBalance.available : 0} day{compOffBalance?.available === 1 ? '' : 's'}</strong>
              </div>

              {compOffWorkedDate && compOffExpiryMonths > 0 && (
                <div className="rounded-lg border px-3 py-2 text-xs" style={{ borderColor: 'var(--border, #e5e7eb)', backgroundColor: 'rgba(220,38,38,0.06)', color: '#991b1b' }}>
                  Must be taken by{' '}
                  <strong>
                    {new Date(
                      new Date(compOffWorkedDate).setUTCMonth(new Date(compOffWorkedDate).getUTCMonth() + compOffExpiryMonths)
                    ).toLocaleDateString('en-IN', { timeZone: 'UTC', day: '2-digit', month: 'short', year: 'numeric' })}
                  </strong>{' '}
                  ({compOffExpiryMonths} month{compOffExpiryMonths === 1 ? '' : 's'} policy) or it will expire.
                </div>
              )}

              {/* Pick-mode toggle — click a dot to choose which date the
                  calendar's next click sets. Picking a worked date
                  auto-advances to off-date mode. */}
              <div className="flex items-center gap-3 text-sm">
                <button
                  type="button"
                  onClick={() => setCompOffPickMode('worked')}
                  className="flex items-center gap-1.5 rounded-full border px-2.5 py-1 font-medium transition"
                  style={{
                    borderColor: compOffPickMode === 'worked' ? '#16a34a' : 'var(--border, #e5e7eb)',
                    color: 'var(--foreground, #111827)',
                    backgroundColor: compOffPickMode === 'worked' ? '#dcfce7' : 'transparent',
                  }}
                >
                  <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: '#16a34a' }} />
                  Date Worked
                </button>
                <button
                  type="button"
                  onClick={() => setCompOffPickMode('off')}
                  className="flex items-center gap-1.5 rounded-full border px-2.5 py-1 font-medium transition"
                  style={{
                    borderColor: compOffPickMode === 'off' ? '#dc2626' : 'var(--border, #e5e7eb)',
                    color: 'var(--foreground, #111827)',
                    backgroundColor: compOffPickMode === 'off' ? '#fee2e2' : 'transparent',
                  }}
                >
                  <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: '#dc2626' }} />
                  Date Off
                </button>
              </div>

              {/* Inline calendar — click a date to set whichever dot is
                  active above. Worked dates show green, the off date red. */}
              <div className="rounded-lg border p-3" style={{ borderColor: 'var(--border, #e5e7eb)' }}>
                <div className="mb-2 flex items-center justify-between">
                  <button
                    type="button"
                    onClick={() => { if (compOffCalMonth === 0) { setCompOffCalMonth(11); setCompOffCalYear(compOffCalYear - 1); } else setCompOffCalMonth(compOffCalMonth - 1); }}
                    className="rounded-md px-2 py-1 text-sm hover:opacity-70"
                    style={{ color: 'var(--foreground, #111827)' }}
                  >
                    ‹
                  </button>
                  <span className="text-sm font-semibold" style={{ color: 'var(--foreground, #111827)' }}>
                    {CAL_MONTH_NAMES[compOffCalMonth]} {compOffCalYear}
                  </span>
                  <button
                    type="button"
                    onClick={() => { if (compOffCalMonth === 11) { setCompOffCalMonth(0); setCompOffCalYear(compOffCalYear + 1); } else setCompOffCalMonth(compOffCalMonth + 1); }}
                    className="rounded-md px-2 py-1 text-sm hover:opacity-70"
                    style={{ color: 'var(--foreground, #111827)' }}
                  >
                    ›
                  </button>
                </div>
                <div className="grid grid-cols-7 gap-1 text-center">
                  {CAL_DOW.map((d) => (
                    <div key={d} className="py-1 text-[11px] font-semibold uppercase" style={{ color: 'var(--foreground-muted, #6b7280)' }}>{d}</div>
                  ))}
                  {(() => {
                    const firstDow = new Date(Date.UTC(compOffCalYear, compOffCalMonth, 1)).getUTCDay();
                    const daysInMonth = new Date(Date.UTC(compOffCalYear, compOffCalMonth + 1, 0)).getUTCDate();
                    const todayIso = new Date().toISOString().slice(0, 10);
                    const cells: (number | null)[] = [...Array(firstDow).fill(null), ...Array.from({ length: daysInMonth }, (_, i) => i + 1)];
                    // The eligible-worked-dates list is attendance-based
                    // (every OT-approved weekly-off/holiday day not yet
                    // settled as comp-off) and has no 1:1 link to the
                    // aggregate CompOffBalance pool — there can be more
                    // eligible dates than days actually available to spend.
                    // Only offer as many as the balance can back, earliest
                    // first, so the calendar never dangles a date the
                    // request would just fail on.
                    const spendableWorkedDates = compOffEligibleDates
                      .slice()
                      .sort()
                      .slice(0, Math.floor(compOffBalance?.available ?? 0));
                    return cells.map((day, idx) => {
                      if (day === null) return <div key={`e${idx}`} />;
                      const dateStr = isoOf(compOffCalYear, compOffCalMonth, day);
                      const isWorked = dateStr === compOffWorkedDate;
                      const isOff = dateStr === compOffLeaveDate;
                      // "Eligible" worked dates are earning-eligibility (an
                      // OT-approved weekly-off/holiday day not yet settled as
                      // comp-off) — a separate concept from spend-eligibility
                      // (the aggregate CompOffBalance actually has a day to
                      // give). A date can look eligible here while the
                      // balance is still 0 if that day was never actually
                      // credited — so nothing is pickable at all once the
                      // balance runs out, regardless of what the calendar
                      // would otherwise highlight.
                      const hasNoBalance = !compOffBalance || compOffBalance.available <= 0;
                      const isEligibleWorked = spendableWorkedDates.includes(dateStr);
                      const disallowWorked = hasNoBalance || (compOffPickMode === 'worked' && !isEligibleWorked);
                      const offMaxIso = (() => {
                        if (!compOffWorkedDate || compOffExpiryMonths <= 0) return null;
                        const d = new Date(compOffWorkedDate);
                        d.setUTCMonth(d.getUTCMonth() + compOffExpiryMonths);
                        return d.toISOString().slice(0, 10);
                      })();
                      const disallowOff =
                        compOffPickMode === 'off' &&
                        (dateStr < todayIso || (offMaxIso !== null && dateStr > offMaxIso));
                      return (
                        <button
                          key={dateStr}
                          type="button"
                          disabled={disallowWorked || disallowOff}
                          onClick={() => {
                            if (compOffPickMode === 'worked') {
                              setCompOffWorkedDate(dateStr);
                              if (compOffLeaveDate && compOffLeaveDate <= dateStr) setCompOffLeaveDate('');
                              setCompOffPickMode('off');
                            } else {
                              setCompOffLeaveDate(dateStr);
                            }
                          }}
                          className="mx-auto flex h-8 w-8 items-center justify-center rounded-full text-xs font-medium transition disabled:opacity-30"
                          style={{
                            backgroundColor: isWorked ? '#16a34a' : isOff ? '#dc2626' : 'transparent',
                            color: isWorked || isOff ? '#fff' : 'var(--foreground, #111827)',
                            boxShadow: !isWorked && !isOff && isEligibleWorked ? 'inset 0 0 0 1.5px #16a34a' : undefined,
                          }}
                        >
                          {day}
                        </button>
                      );
                    });
                  })()}
                </div>
              </div>

              {(compOffWorkedDate || compOffLeaveDate) && (
                <div className="flex flex-wrap items-center justify-center gap-2 text-sm">
                  <span className="rounded-full px-2.5 py-1 font-semibold" style={{ backgroundColor: compOffWorkedDate ? '#dcfce7' : 'var(--bg-subtle, #f3f4f6)', color: compOffWorkedDate ? '#166534' : 'var(--foreground-muted, #6b7280)' }}>
                    {compOffWorkedDate ? new Date(compOffWorkedDate).getUTCDate() : '—'}
                  </span>
                  <span style={{ color: 'var(--foreground-muted, #6b7280)' }}>→</span>
                  <span className="rounded-full px-2.5 py-1 font-semibold" style={{ backgroundColor: compOffLeaveDate ? '#fee2e2' : 'var(--bg-subtle, #f3f4f6)', color: compOffLeaveDate ? '#991b1b' : 'var(--foreground-muted, #6b7280)' }}>
                    {compOffLeaveDate ? new Date(compOffLeaveDate).getUTCDate() : '—'}
                  </span>
                </div>
              )}

              {compOffBalance && compOffBalance.available <= 0 && (
                <p className="text-xs font-medium" style={{ color: '#dc2626' }}>
                  You have no Comp-Off balance available right now.
                </p>
              )}

              <div className="flex justify-end gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => {
                    setCompOffModalOpen(false);
                    if (!compOffLeaveDate) {
                      setFormInitialValues({ ...formInitialValues, leaveMasterId: '' });
                      setFormLeaveMasterId('');
                    }
                  }}
                  className="rounded-lg border px-4 py-2 text-sm font-medium transition hover:opacity-80"
                  style={{ borderColor: 'var(--border, #e5e7eb)', color: 'var(--foreground, #111827)' }}
                >
                  Cancel
                </button>
                <button
                  type="button"
                  disabled={!compOffWorkedDate || !compOffLeaveDate}
                  onClick={() => {
                    setFormInitialValues({
                      leaveMasterId: String(compOffTypeId ?? ''),
                      fromDate: compOffLeaveDate,
                      toDate: compOffLeaveDate,
                      isHalfDay: false,
                      // LeaveApplication has no worked-date column of its own
                      // (only the older, separate CompOffRequest table does)
                      // — encoded into reason so the merged Comp-Off history
                      // view (/api/workforce/comp-off-request) can parse it
                      // back out for the "Worked On" column instead of
                      // showing "—" for every calendar-flow request.
                      reason: `Worked on ${compOffWorkedDate}`,
                    });
                    setFormFromDate(compOffLeaveDate);
                    setFormToDate(compOffLeaveDate);
                    setFormHalfDay(false);
                    setCompOffModalOpen(false);
                  }}
                  className="rounded-lg px-4 py-2 text-sm font-medium text-white transition disabled:opacity-50"
                  style={{ backgroundColor: 'var(--primary, #2563eb)' }}
                >
                  Confirm
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
