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
    const numberOfDays = computeDays(fromDate, toDate, isHalfDay);

    const res = await fetch('/api/workforce/my-leave', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        leaveMasterId,
        fromDate,
        toDate,
        numberOfDays,
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
  const previewDays = computeDays(formFromDate, formHalfDay ? formFromDate : formToDate, formHalfDay);

  const fields: FieldDef[] = [
    {
      name: 'leaveMasterId',
      label: 'Leave Type',
      type: 'select',
      required: true,
      options: types.map((t) => ({ value: String(t.id), label: t.name })),
    },
    { name: 'fromDate', label: 'From Date', type: 'date', required: true },
    { name: 'toDate', label: 'To Date', type: 'date', required: true, showIf: (v) => !v.isHalfDay },
    { name: 'isHalfDay', label: 'Half day', type: 'checkbox' },
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
        initialValues={{}}
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        onSubmit={applyForLeave}
        submitLabel="Submit Request"
        onFieldChange={(name, value, values) => {
          if (name === 'leaveMasterId') setFormLeaveMasterId(String(value));
          if (name === 'fromDate') setFormFromDate(String(value));
          if (name === 'toDate') setFormToDate(String(value));
          if (name === 'isHalfDay') setFormHalfDay(Boolean(value));
          void values;
        }}
      >
        {previewDays > 0 && (
          <div className="text-xs" style={{ color: 'var(--text-muted)' }}>
            {previewDays} day{previewDays !== 1 ? 's' : ''} will be requested.
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
          </div>
        )}
      </FormModal>
    </div>
  );
}
