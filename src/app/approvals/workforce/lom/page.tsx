/**
 * LOM (Loss of Minutes) Approval — HR/Admin approves late arrival and
 * early checkout minutes for salary deduction. Only approved LOM minutes
 * are deducted in payroll.
 *
 * Supports bulk select + bulk approve/reject, same pattern as OT Approval.
 *
 * UI pass (2026-09): the three queues are tabs with counts, a KPI strip
 * summarises pending minutes, late/early are shown as tone-coded chips.
 * Endpoints, columns and actions are unchanged.
 */

'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { DataTable, ConfirmDialog, FormModal, PageHeader, StatusBadge, SectionCard, Tabs, Button, KPICard, KPIGrid, useToast, type Column, type FieldDef } from '@/components/ui';

interface LomRow {
  id: number;
  date: string;
  lateMinutes: number;
  earlyOutMinutes: number;
  lomApprovedMinutes: number | null;
  lomApprovalStatus: string | null;
  employee: { employeeCode: string; firstName: string; lastName: string };
  shiftMaster: { code: string; name: string; graceMinutes: number } | null;
}

type LomStatus = 'pending' | 'approved' | 'rejected';

const rejectFields: FieldDef[] = [{ name: 'rejectionReason', label: 'Rejection Reason', type: 'textarea', required: true }];

function formatMinutes(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return h > 0 ? `${h}h ${String(m).padStart(2, '0')}m` : `${m}m`;
}

function useLomQueue(status: LomStatus) {
  const [records, setRecords] = useState<LomRow[]>([]);
  const [loading, setLoading] = useState(true);
  const toast = useToast();

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/workforce/attendance/lom?status=${status}`);
      if (res.status === 403) {
        setRecords([]);
        return;
      }
      if (!res.ok) throw new Error((await res.json()).error ?? 'Failed to fetch');
      const json: { data: LomRow[] } = await res.json();
      setRecords(json.data);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  }, [status, toast]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  return { records, loading, refetch: fetchData };
}

const MinutesChip = ({ minutes, tone }: { minutes: number; tone: 'warning' | 'danger' }) =>
  minutes > 0 ? (
    <StatusBadge tone={tone}><span className="tabular-nums">{formatMinutes(minutes)}</span></StatusBadge>
  ) : (
    <span className="text-xs" style={{ color: 'var(--foreground-muted)' }}>—</span>
  );

function LomQueueSection({ status, description, onLoaded }: { status: LomStatus; description: string; onLoaded: (s: LomStatus, rows: LomRow[]) => void }) {
  const { records, loading, refetch } = useLomQueue(status);
  const toast = useToast();
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const [bulkApproveOpen, setBulkApproveOpen] = useState(false);
  const [bulkRejectOpen, setBulkRejectOpen] = useState(false);
  const [rejectId, setRejectId] = useState<number | null>(null);

  useEffect(() => {
    if (!loading) onLoaded(status, records);
  }, [records, loading, status, onLoaded]);

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

  const handleBulkApprove = async () => {
    const ids = Array.from(selectedIds);
    if (ids.length === 0) return;
    setBulkApproveOpen(false);
    try {
      const res = await fetch('/api/workforce/attendance/lom/bulk-approve', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ids }),
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
      const res = await fetch('/api/workforce/attendance/lom/bulk-reject', {
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

  const columns: Column<LomRow>[] = [
    ...(status === 'pending'
      ? [{
          key: '_select',
          label: '',
          className: 'w-10',
          render: (r: LomRow) => (
            <input
              type="checkbox"
              checked={selectedIds.has(r.id)}
              onChange={(e) => { e.stopPropagation(); toggleSelect(r.id); }}
              className="h-4 w-4 cursor-pointer accent-[var(--accent)]"
              aria-label={`Select ${r.employee.employeeCode}`}
            />
          ),
        }]
      : []),
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
        const d = new Date(r.date);
        return (
          <span className="tabular-nums">
            {d.toLocaleDateString(undefined, { day: '2-digit', month: 'short' })}
            <span className="ml-1.5 text-[11px]" style={{ color: 'var(--foreground-muted)' }}>{d.toLocaleDateString(undefined, { weekday: 'short' })}</span>
          </span>
        );
      },
    },
    {
      key: 'shiftMaster',
      label: 'Shift',
      render: (r) =>
        r.shiftMaster ? (
          <div className="leading-tight">
            <div className="text-xs font-medium">{r.shiftMaster.code}</div>
            <div className="text-[11px]" style={{ color: 'var(--foreground-muted)' }}>{r.shiftMaster.graceMinutes}m grace</div>
          </div>
        ) : (
          <span style={{ color: 'var(--foreground-muted)' }}>—</span>
        ),
    },
    { key: 'lateMinutes', label: 'Late', render: (r) => <MinutesChip minutes={r.lateMinutes} tone="warning" /> },
    { key: 'earlyOutMinutes', label: 'Early Out', render: (r) => <MinutesChip minutes={r.earlyOutMinutes} tone="danger" /> },
    {
      key: '_total',
      label: 'Total',
      className: 'text-right',
      render: (r) => <span className="font-semibold tabular-nums">{formatMinutes(r.lateMinutes + r.earlyOutMinutes)}</span>,
    },
    ...(status === 'approved'
      ? [{
          key: 'lomApprovedMinutes',
          label: 'Approved (after grace)',
          className: 'text-right',
          render: (r: LomRow) => <span className="font-semibold tabular-nums" style={{ color: 'var(--danger)' }}>−{formatMinutes(r.lomApprovedMinutes ?? 0)}</span>,
        }]
      : []),
  ];

  return (
    <SectionCard
      description={description}
      flush
      actions={
        status === 'pending' && records.length > 0 ? (
          <div className="flex flex-wrap items-center gap-2">
            <label className="flex cursor-pointer items-center gap-1.5 text-xs" style={{ color: 'var(--foreground-muted)' }}>
              <input type="checkbox" checked={allSelected} onChange={toggleSelectAll} className="h-3.5 w-3.5 accent-[var(--accent)]" />
              Select all
            </label>
            {selectedIds.size > 0 && (
              <>
                <StatusBadge tone="accent">{selectedIds.size} selected</StatusBadge>
                <Button variant="success" size="sm" onClick={() => setBulkApproveOpen(true)}>Approve selected</Button>
                <Button variant="danger" size="sm" onClick={() => setBulkRejectOpen(true)}>Reject selected</Button>
              </>
            )}
          </div>
        ) : undefined
      }
    >
      <DataTable
        variant="card"
        columns={columns}
        data={records}
        loading={loading}
        emptyMessage={`No ${status} LOM entries.`}
        renderRowActions={status === 'pending' ? (row) => (
          <div className="inline-flex items-center gap-1.5">
            <Button
              variant="success"
              size="xs"
              onClick={async () => {
                const res = await fetch(`/api/workforce/attendance/lom/${row.id}/approve`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}' });
                if (!res.ok) { const err = await res.json(); toast.error(err.error ?? 'Approve failed'); return; }
                refetch();
              }}
            >
              Approve
            </Button>
            <Button variant="danger" size="xs" onClick={() => setRejectId(row.id)}>
              Reject
            </Button>
          </div>
        ) : undefined}
      />

      <ConfirmDialog
        title={`Bulk Approve ${selectedIds.size} LOM Entries`}
        message={`Approve ${selectedIds.size} LOM entries? Approved minutes (late + early-out minus shift grace) will be deducted in payroll.`}
        confirmLabel="Approve All"
        isOpen={bulkApproveOpen}
        onConfirm={handleBulkApprove}
        onClose={() => setBulkApproveOpen(false)}
      />

      <FormModal
        title="Reject LOM Entry"
        fields={rejectFields}
        initialValues={{}}
        isOpen={rejectId !== null}
        onClose={() => setRejectId(null)}
        onSubmit={async (values) => {
          const res = await fetch(`/api/workforce/attendance/lom/${rejectId}/reject`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ rejectionReason: values.rejectionReason }) });
          if (!res.ok) { const err = await res.json(); throw new Error(err.error ?? 'Reject failed'); }
          setRejectId(null);
          refetch();
        }}
        submitLabel="Reject"
      />

      <FormModal
        title={`Bulk Reject ${selectedIds.size} LOM Entries`}
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

const TAB_META: Record<LomStatus, { label: string; description: string }> = {
  pending: { label: 'Pending', description: 'LOM entries awaiting your review. Only approved minutes are deducted in payroll.' },
  approved: { label: 'Approved', description: 'LOM entries that have been approved and will be deducted in payroll.' },
  rejected: { label: 'Rejected', description: 'LOM entries that were rejected — no deduction will apply.' },
};

export default function LomApprovalPage() {
  const [tab, setTab] = useState<LomStatus>('pending');
  const [rowsByStatus, setRowsByStatus] = useState<Record<LomStatus, LomRow[]>>({ pending: [], approved: [], rejected: [] });
  const onLoaded = useCallback((s: LomStatus, rows: LomRow[]) => {
    setRowsByStatus((prev) => (prev[s] === rows ? prev : { ...prev, [s]: rows }));
  }, []);

  const kpi = useMemo(() => {
    const pending = rowsByStatus.pending;
    const late = pending.reduce((a, r) => a + r.lateMinutes, 0);
    const early = pending.reduce((a, r) => a + r.earlyOutMinutes, 0);
    const approvedMin = rowsByStatus.approved.reduce((a, r) => a + (r.lomApprovedMinutes ?? 0), 0);
    return { pendingCount: pending.length, late, early, approvedMin, approvedCount: rowsByStatus.approved.length };
  }, [rowsByStatus]);

  return (
    <div className="space-y-4">
      <PageHeader
        eyebrow="Time Office · Approvals"
        title="LOM Approval"
        description="Late arrival (after grace) and early checkout minutes require HR/Admin approval before being deducted from salary."
      />

      <KPIGrid columns={4}>
        <KPICard label="Pending Entries" value={kpi.pendingCount} tone={kpi.pendingCount > 0 ? 'warning' : 'success'} />
        <KPICard label="Pending Late" value={formatMinutes(kpi.late)} tone="warning" />
        <KPICard label="Pending Early Out" value={formatMinutes(kpi.early)} tone="danger" />
        <KPICard label="Approved for Deduction" value={formatMinutes(kpi.approvedMin)} subtitle={`${kpi.approvedCount} entries`} tone="info" />
      </KPIGrid>

      <Tabs
        tabs={(['pending', 'approved', 'rejected'] as LomStatus[]).map((s) => ({ key: s, label: TAB_META[s].label, count: rowsByStatus[s].length }))}
        active={tab}
        onChange={setTab}
      />

      {/* All three sections stay mounted so counts remain accurate; only the active one is visible. */}
      {(['pending', 'approved', 'rejected'] as LomStatus[]).map((s) => (
        <div key={s} hidden={tab !== s}>
          <LomQueueSection status={s} description={TAB_META[s].description} onLoaded={onLoaded} />
        </div>
      ))}
    </div>
  );
}
