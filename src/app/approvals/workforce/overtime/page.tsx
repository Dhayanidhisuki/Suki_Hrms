/**
 * OT Approval — two queues, same shape as Mispunch Approval
 * (src/app/approvals/workforce/mispunch/page.tsx): "Pending My Approval
 * (Reporting Manager)" is hierarchy-gated, "Pending HR Approval" is
 * RBAC-gated (workforce.ot.approve). HR's Approve action additionally asks
 * how to settle it when the day is a Sunday or a declared holiday
 * (HolidayMaster) — Paid OT or Comp-Off (BRD: "Either based on approval") —
 * the API silently forces "OT" for any other day regardless of what's
 * picked here.
 *
 * Bulk actions: select multiple rows, then Approve All or Reject All.
 * For HR scope, the settlement type (OT / COMP_OFF) applies to all
 * Sunday/Holiday rows in the selection; weekday rows are always OT.
 *
 * UI pass (2026-09): section cards with counts, KPI strip, radio-card
 * settlement picker, theme-aware badges. Actions and payloads unchanged.
 */

'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { DataTable, ConfirmDialog, FormModal, PageHeader, Alert, StatusBadge, SectionCard, Button, KPICard, KPIGrid, useToast, type Column, type FieldDef } from '@/components/ui';
import MasterGroupTabs from '@/components/masters/MasterGroupTabs';

interface OtRow {
  id: number;
  otApprovalStatus?: string | null;
  otMinutesApproved?: number | null;
  date: string;
  otMinutesCalculated: number;
  employee: { employeeCode: string; firstName: string; lastName: string };
}

const rejectFields: FieldDef[] = [{ name: 'rejectionReason', label: 'Rejection Reason', type: 'textarea', required: true }];

function formatHoursMinutes(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return `${h}h ${String(m).padStart(2, '0')}m`;
}

function isSundayOrHoliday(iso: string, holidaySet: Set<string>): boolean {
  return new Date(iso).getUTCDay() === 0 || holidaySet.has(iso.slice(0, 10));
}

/** This company's declared holidays, for the same Sunday-or-Holiday Comp-Off choice the API enforces server-side. */
function useHolidaySet(): Set<string> {
  const [holidaySet, setHolidaySet] = useState<Set<string>>(new Set());
  useEffect(() => {
    fetch('/api/auth/me')
      .then((r) => r.json())
      .then((me: { companyId: number | null }) => {
        if (!me.companyId) return;
        return fetch(`/api/masters/holidays?companyId=${me.companyId}&limit=500`)
          .then((r) => r.json())
          .then((json: { data: { date: string }[] }) => setHolidaySet(new Set(json.data.map((h) => h.date.slice(0, 10)))));
      })
      .catch(() => {});
  }, []);
  return holidaySet;
}

function useOtQueue(scope: 'manager' | 'hr' | 'actioned') {
  const [records, setRecords] = useState<OtRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [visible, setVisible] = useState(true);
  const toast = useToast();

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/workforce/attendance/ot?scope=${scope}`);
      if (res.status === 403) {
        setVisible(false);
        return;
      }
      if (!res.ok) throw new Error((await res.json()).error ?? 'Failed to fetch');
      const json: { data: OtRow[] } = await res.json();
      setRecords(json.data);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  }, [scope, toast]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  return { records, loading, visible, refetch: fetchData };
}

/** Two-option radio card for OT vs Comp-Off — same values the API expects. */
function SettlementPicker({ value, onChange, compact }: { value: 'OT' | 'COMP_OFF'; onChange: (v: 'OT' | 'COMP_OFF') => void; compact?: boolean }) {
  const opts: { v: 'OT' | 'COMP_OFF'; label: string; hint: string }[] = [
    { v: 'OT', label: 'Paid Overtime', hint: 'Minutes billed in payroll' },
    { v: 'COMP_OFF', label: 'Comp-Off', hint: '1 compensatory leave day' },
  ];
  return (
    <div className={`grid gap-2 ${compact ? 'grid-cols-2' : 'grid-cols-1 sm:grid-cols-2'}`} role="radiogroup">
      {opts.map((o) => {
        const active = o.v === value;
        return (
          <button
            key={o.v}
            type="button"
            role="radio"
            aria-checked={active}
            onClick={() => onChange(o.v)}
            className={`flex flex-col items-start rounded-lg border text-left transition ${compact ? 'px-2.5 py-1.5' : 'px-3 py-2.5'}`}
            style={{
              borderColor: active ? 'var(--accent)' : 'var(--border)',
              backgroundColor: active ? 'var(--accent-soft)' : 'var(--surface)',
              boxShadow: active ? '0 0 0 1px var(--accent) inset' : 'none',
            }}
          >
            <span className={`font-medium ${compact ? 'text-xs' : 'text-sm'}`} style={{ color: active ? 'var(--accent)' : 'var(--foreground)' }}>{o.label}</span>
            {!compact && <span className="text-[11px]" style={{ color: 'var(--foreground-muted)' }}>{o.hint}</span>}
          </button>
        );
      })}
    </div>
  );
}

function OtQueueSection({
  title,
  scope,
  description,
  holidaySet,
  onCount,
}: {
  title: string;
  scope: 'manager' | 'hr';
  description: string;
  holidaySet: Set<string>;
  onCount?: (scope: 'manager' | 'hr', count: number, minutes: number) => void;
}) {
  const { records, loading, visible, refetch } = useOtQueue(scope);
  const toast = useToast();
  const [approveRow, setApproveRow] = useState<OtRow | null>(null);
  const [settlementType, setSettlementType] = useState<'OT' | 'COMP_OFF'>('OT');
  const [rejectId, setRejectId] = useState<number | null>(null);

  // Bulk selection state
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const [bulkSettlementType, setBulkSettlementType] = useState<'OT' | 'COMP_OFF'>('OT');
  const [bulkApproveOpen, setBulkApproveOpen] = useState(false);
  const [bulkRejectOpen, setBulkRejectOpen] = useState(false);

  useEffect(() => {
    if (!loading) onCount?.(scope, records.length, records.reduce((a, r) => a + r.otMinutesCalculated, 0));
  }, [records, loading, scope, onCount]);

  if (!visible) return null;

  const toggleSelect = (id: number) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const allSelected = records.length > 0 && selectedIds.size === records.length;
  const toggleSelectAll = () => {
    if (allSelected) setSelectedIds(new Set());
    else setSelectedIds(new Set(records.map((r) => r.id)));
  };

  const handleApprove = async () => {
    if (!approveRow) return;
    const res = await fetch(`/api/workforce/attendance/ot/${approveRow.id}/approve`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: scope === 'hr' ? JSON.stringify({ settlementType }) : undefined,
    });
    if (!res.ok) {
      const err = await res.json();
      toast.error(err.error ?? 'Approve failed');
      return;
    }
    setApproveRow(null);
    refetch();
  };

  const handleBulkApprove = async () => {
    const ids = Array.from(selectedIds);
    if (ids.length === 0) return;
    setBulkApproveOpen(false);
    try {
      const res = await fetch('/api/workforce/attendance/ot/bulk-approve', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ids, settlementType: bulkSettlementType }),
      });
      const json = await res.json();
      if (!res.ok) {
        toast.error(json.error ?? 'Bulk approve failed');
        return;
      }
      toast.success(`Approved ${json.approved} of ${json.total} (${json.skipped} skipped)`);
      setSelectedIds(new Set());
      refetch();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Bulk approve failed');
    }
  };

  const handleBulkReject = async (values: Record<string, string | number | boolean>) => {
    const ids = Array.from(selectedIds);
    if (ids.length === 0) return;
    try {
      const res = await fetch('/api/workforce/attendance/ot/bulk-reject', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ids, rejectionReason: String(values.rejectionReason) }),
      });
      const json = await res.json();
      if (!res.ok) {
        throw new Error(json.error ?? 'Bulk reject failed');
      }
      toast.success(`Rejected ${json.rejected} of ${json.total} (${json.skipped} skipped)`);
      setSelectedIds(new Set());
      setBulkRejectOpen(false);
      refetch();
    } catch (err) {
      throw err instanceof Error ? err : new Error('Bulk reject failed');
    }
  };

  const columns: Column<OtRow>[] = [
    {
      key: '_select',
      label: '',
      className: 'w-10',
      render: (r) => (
        <input
          type="checkbox"
          checked={selectedIds.has(r.id)}
          onChange={(e) => { e.stopPropagation(); toggleSelect(r.id); }}
          className="h-4 w-4 cursor-pointer accent-[var(--accent)]"
          aria-label={`Select ${r.employee.employeeCode}`}
        />
      ),
    },
    {
      key: 'employee',
      label: 'Employee',
      render: (r) => (
        <div className="leading-tight">
          <div className="font-medium">{r.employee.firstName} {r.employee.lastName}</div>
          <div className="text-[11px]" style={{ color: 'var(--foreground-muted)' }}>{r.employee.employeeCode}</div>
        </div>
      ),
    },
    {
      key: 'date',
      label: 'Date',
      render: (r) => {
        const iso = r.date.slice(0, 10);
        const d = new Date(r.date);
        const isSunday = d.getUTCDay() === 0;
        const isHoliday = holidaySet.has(iso);
        return (
          <div className="flex items-center gap-2">
            <span className="tabular-nums">{d.toLocaleDateString(undefined, { day: '2-digit', month: 'short', year: 'numeric' })}</span>
            <span className="text-[11px]" style={{ color: 'var(--foreground-muted)' }}>{d.toLocaleDateString(undefined, { weekday: 'short' })}</span>
            {isSunday && <StatusBadge tone="info">Weekly Off</StatusBadge>}
            {isHoliday && <StatusBadge tone="warning">Holiday</StatusBadge>}
          </div>
        );
      },
    },
    {
      key: 'otMinutesCalculated',
      label: 'OT Worked',
      className: 'text-right',
      render: (r) => <span className="font-semibold tabular-nums">{formatHoursMinutes(r.otMinutesCalculated)}</span>,
    },
  ];

  return (
    <SectionCard
      title={title}
      description={description}
      count={loading ? undefined : records.length}
      flush
      actions={
        records.length > 0 ? (
          <div className="flex flex-wrap items-center gap-2">
            <label className="flex cursor-pointer items-center gap-1.5 text-xs" style={{ color: 'var(--foreground-muted)' }}>
              <input type="checkbox" checked={allSelected} onChange={toggleSelectAll} className="h-3.5 w-3.5 accent-[var(--accent)]" />
              Select all
            </label>
            {selectedIds.size > 0 && (
              <>
                <StatusBadge tone="accent">{selectedIds.size} selected</StatusBadge>
                {scope === 'hr' && <SettlementPicker compact value={bulkSettlementType} onChange={setBulkSettlementType} />}
                <Button variant="success" size="sm" onClick={() => setBulkApproveOpen(true)}>Approve selected</Button>
                <Button variant="danger" size="sm" onClick={() => setBulkRejectOpen(true)}>Reject selected</Button>
              </>
            )}
          </div>
        ) : undefined
      }
    >
      <DataTable
        columns={columns}
        data={records}
        loading={loading}
        emptyMessage="Nothing pending here."
        variant="card"
        renderRowActions={(row) => (
          <div className="inline-flex items-center gap-1.5">
            <Button
              variant="success"
              size="xs"
              onClick={() => {
                setApproveRow(row);
                setSettlementType('OT');
              }}
            >
              Approve
            </Button>
            <Button variant="danger" size="xs" onClick={() => setRejectId(row.id)}>
              Reject
            </Button>
          </div>
        )}
      />

      {/* Bulk approve confirmation */}
      <ConfirmDialog
        title={`Bulk Approve ${selectedIds.size} OT Entries`}
        message={
          scope === 'hr'
            ? `Settle ${selectedIds.size} selected OT entries as ${bulkSettlementType === 'OT' ? 'Paid Overtime' : 'Comp-Off'}? Sunday/Holiday rows will use this settlement; weekday rows are always OT.`
            : `Forward ${selectedIds.size} selected OT entries to HR for final approval?`
        }
        confirmLabel="Approve All"
        isOpen={bulkApproveOpen}
        onConfirm={handleBulkApprove}
        onClose={() => setBulkApproveOpen(false)}
      />

      {scope === 'manager' ? (
        <ConfirmDialog
          title="Approve Overtime"
          message="This sends the OT on to HR for final approval. Continue?"
          confirmLabel="Approve"
          isOpen={approveRow !== null}
          onConfirm={handleApprove}
          onClose={() => setApproveRow(null)}
        />
      ) : (
        approveRow !== null && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ backgroundColor: 'rgba(0,0,0,0.45)' }}>
            <div className="w-full max-w-md rounded-xl border p-5 space-y-4 shadow-xl" style={{ backgroundColor: 'var(--surface)', borderColor: 'var(--border)' }}>
              <div>
                <h2 className="text-base font-semibold" style={{ color: 'var(--foreground)' }}>Approve Overtime</h2>
                <p className="mt-1 text-sm" style={{ color: 'var(--foreground-muted)' }}>
                  {approveRow.employee.firstName} {approveRow.employee.lastName} ({approveRow.employee.employeeCode})
                </p>
              </div>

              <div className="grid grid-cols-2 gap-3 rounded-lg p-3" style={{ backgroundColor: 'var(--surface-muted)' }}>
                <div>
                  <p className="text-[11px] uppercase tracking-wide" style={{ color: 'var(--foreground-muted)' }}>Date</p>
                  <p className="text-sm font-medium" style={{ color: 'var(--foreground)' }}>{new Date(approveRow.date).toLocaleDateString(undefined, { weekday: 'short', day: '2-digit', month: 'short', year: 'numeric' })}</p>
                </div>
                <div>
                  <p className="text-[11px] uppercase tracking-wide" style={{ color: 'var(--foreground-muted)' }}>OT Worked</p>
                  <p className="text-sm font-semibold tabular-nums" style={{ color: 'var(--foreground)' }}>{formatHoursMinutes(approveRow.otMinutesCalculated)}</p>
                </div>
              </div>

              {isSundayOrHoliday(approveRow.date, holidaySet) ? (
                <div className="flex flex-col gap-2">
                  <label className="text-xs font-medium" style={{ color: 'var(--foreground-muted)' }}>
                    Settle this weekly-off / holiday work as
                  </label>
                  <SettlementPicker value={settlementType} onChange={setSettlementType} />
                </div>
              ) : (
                <Alert tone="info">Settled as Paid Overtime — only weekly-off / holiday work can be converted to Comp-Off.</Alert>
              )}

              <div className="flex justify-end gap-2 pt-1">
                <Button onClick={() => setApproveRow(null)}>Cancel</Button>
                <Button variant="primary" onClick={handleApprove}>Approve</Button>
              </div>
            </div>
          </div>
        )
      )}

      {/* Single reject */}
      <FormModal
        title="Reject Overtime"
        fields={rejectFields}
        initialValues={{}}
        isOpen={rejectId !== null}
        onClose={() => setRejectId(null)}
        onSubmit={async (values) => {
          const res = await fetch(`/api/workforce/attendance/ot/${rejectId}/reject`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ rejectionReason: values.rejectionReason }),
          });
          if (!res.ok) {
            const err = await res.json();
            throw new Error(err.error ?? 'Reject failed');
          }
          refetch();
        }}
        submitLabel="Reject"
      />

      {/* Bulk reject */}
      <FormModal
        title={`Bulk Reject ${selectedIds.size} OT Entries`}
        fields={rejectFields}
        initialValues={{}}
        isOpen={bulkRejectOpen}
        onClose={() => setBulkRejectOpen(false)}
        onSubmit={handleBulkReject}
        submitLabel="Reject All"
      />
    </SectionCard>
  );
}

const HIST_TONE: Record<string, { bg: string; fg: string }> = {
  pending_manager: { bg: '#fef9c3', fg: '#854d0e' },
  pending_hr: { bg: '#dbeafe', fg: '#1e40af' },
  approved: { bg: '#dcfce7', fg: '#166534' },
  rejected: { bg: '#fee2e2', fg: '#991b1b' },
};
const HIST_LABEL: Record<string, string> = {
  pending_manager: 'Pending Manager',
  pending_hr: 'Pending HR',
  approved: 'Approved',
  rejected: 'Rejected',
};

/**
 * What this approver has already decided. A day leaves both pending queues
 * the moment it is actioned, so without this the approver has no record of
 * what they settled.
 */
function OtHistorySection() {
  const { records, loading, visible } = useOtQueue('actioned');
  if (!visible) return null;

  const columns: Column<OtRow>[] = [
    { key: 'employee', label: 'Employee', render: (r) => `${r.employee.employeeCode} — ${r.employee.firstName} ${r.employee.lastName}` },
    { key: 'date', label: 'Date', render: (r) => new Date(r.date).toLocaleDateString('en-IN', { timeZone: 'UTC' }) },
    { key: 'otMinutesCalculated', label: 'OT Hours', render: (r) => formatHoursMinutes(r.otMinutesApproved ?? r.otMinutesCalculated) },
    {
      key: 'otApprovalStatus',
      label: 'Status',
      render: (r) => {
        const st = r.otApprovalStatus ?? '';
        const tone = HIST_TONE[st] ?? { bg: '#f1f5f9', fg: '#475569' };
        return <span className="rounded-full px-2 py-0.5 text-xs font-medium" style={{ backgroundColor: tone.bg, color: tone.fg }}>{HIST_LABEL[st] ?? st}</span>;
      },
    },
  ];

  return (
    <div className="space-y-2">
      <div>
        <h2 className="text-sm font-semibold" style={{ color: 'var(--foreground)' }}>My Approval History</h2>
        <p className="text-xs" style={{ color: 'var(--foreground-muted)' }}>Overtime you have already actioned. Read-only.</p>
      </div>
      <DataTable columns={columns} data={records} loading={loading} emptyMessage="You have not actioned any overtime yet." />
    </div>
  );
}

export default function OvertimeApprovalPage() {
  const holidaySet = useHolidaySet();
  const [counts, setCounts] = useState<Record<'manager' | 'hr', { count: number; minutes: number }>>({
    manager: { count: 0, minutes: 0 },
    hr: { count: 0, minutes: 0 },
  });
  const onCount = useCallback((scope: 'manager' | 'hr', count: number, minutes: number) => {
    setCounts((prev) => (prev[scope].count === count && prev[scope].minutes === minutes ? prev : { ...prev, [scope]: { count, minutes } }));
  }, []);
  const totalPending = useMemo(() => counts.manager.count + counts.hr.count, [counts]);
  const totalMinutes = useMemo(() => counts.manager.minutes + counts.hr.minutes, [counts]);

  return (
    <div className="space-y-4">
      <MasterGroupTabs groupLabel="Workforce" moduleLabel="Approval Center" />
      <PageHeader
        eyebrow="Time Office · Approvals"
        title="OT Approval"
        description="Overtime is queued automatically once a day has eligible minutes. Reporting Managers review first, then HR settles it as Paid OT or Comp-Off for weekly-off / holiday work."
      />

      <KPIGrid columns={3}>
        <KPICard label="Awaiting Manager" value={counts.manager.count} subtitle={formatHoursMinutes(counts.manager.minutes)} tone="warning" />
        <KPICard label="Awaiting HR" value={counts.hr.count} subtitle={formatHoursMinutes(counts.hr.minutes)} tone="info" />
        <KPICard label="Total Pending OT" value={formatHoursMinutes(totalMinutes)} subtitle={`${totalPending} entries`} tone={totalPending > 0 ? 'danger' : 'success'} />
      </KPIGrid>

      <OtQueueSection
        title="Pending My Approval (Reporting Manager)"
        scope="manager"
        description="Overtime worked by your direct reports, awaiting your review."
        holidaySet={holidaySet}
        onCount={onCount}
      />

      <OtQueueSection
        title="Pending HR Approval"
        scope="hr"
        description="Overtime already reviewed by the Reporting Manager, awaiting final HR approval and settlement."
        holidaySet={holidaySet}
        onCount={onCount}
      />

      <OtHistorySection />
    </div>
  );
}
