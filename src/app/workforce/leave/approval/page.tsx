/**
 * Leave Approval — pending queue with Approve / Reject actions (BRD §11).
 *
 * Rows are selectable so a queue can be cleared in one action: the bulk
 * endpoints dispatch each row by its own stage (manager vs HR) exactly as
 * the single-row routes do, and return per-row results — a frozen month or
 * an overdrawn balance skips that row rather than failing the batch, so the
 * outcome panel below the table is where the real answer is, not the toast.
 */

'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { DataTable, ConfirmDialog, FormModal, useToast, type Column, type FieldDef } from '@/components/ui';
import type { BulkLeaveResult } from '@/lib/leave/finalizeApproval';

interface LeaveApplicationRow {
  id: number;
  fromDate: string;
  toDate: string;
  numberOfDays: string;
  reason: string | null;
  status?: string;
  employee: { employeeCode: string; firstName: string; lastName: string };
  leaveMaster: { code: string; name: string };
}

const rejectFields: FieldDef[] = [{ name: 'rejectionReason', label: 'Rejection Reason', type: 'textarea', required: true }];

export default function LeaveApprovalPage() {
  const toast = useToast();
  const [records, setRecords] = useState<LeaveApplicationRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [approveId, setApproveId] = useState<number | null>(null);
  const [rejectId, setRejectId] = useState<number | null>(null);

  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const [bulkApproveOpen, setBulkApproveOpen] = useState(false);
  const [bulkRejectOpen, setBulkRejectOpen] = useState(false);
  const [bulkBusy, setBulkBusy] = useState(false);
  const [bulkResults, setBulkResults] = useState<BulkLeaveResult[] | null>(null);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/workforce/leave/applications?status=pending');
      if (!res.ok) throw new Error('Failed to fetch');
      const json: { data: LeaveApplicationRow[] } = await res.json();
      setRecords(json.data);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Drop selections for rows that are no longer in the queue — after a bulk
  // action the approved ones disappear, and a stale id would be re-sent.
  useEffect(() => {
    setSelectedIds((prev) => {
      const live = new Set(records.map((r) => r.id));
      const next = new Set([...prev].filter((id) => live.has(id)));
      return next.size === prev.size ? prev : next;
    });
  }, [records]);

  const allSelected = records.length > 0 && selectedIds.size === records.length;
  const someSelected = selectedIds.size > 0 && !allSelected;

  const toggleAll = () => {
    setSelectedIds(allSelected ? new Set() : new Set(records.map((r) => r.id)));
  };
  const toggleOne = (id: number) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleApprove = async (id: number) => {
    const res = await fetch(`/api/workforce/leave/applications/${id}/approve`, { method: 'POST' });
    if (!res.ok) {
      const err = await res.json();
      toast.error(err.error ?? 'Approve failed');
      return;
    }
    fetchData();
  };

  const runBulk = async (action: 'approve' | 'reject', rejectionReason?: string) => {
    setBulkBusy(true);
    setBulkResults(null);
    try {
      const res = await fetch(`/api/workforce/leave/applications/bulk-${action}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(
          action === 'reject'
            ? { ids: [...selectedIds], rejectionReason }
            : { ids: [...selectedIds] }
        ),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json.error ?? `Bulk ${action} failed`);

      setBulkResults(json.results ?? []);
      const done = action === 'approve' ? json.approved : json.rejected;
      if (json.skipped > 0) {
        toast.error(`${done} of ${json.total} processed — ${json.skipped} skipped, see details below`);
      } else {
        toast.success(`${done} of ${json.total} ${action === 'approve' ? 'approved' : 'rejected'}`);
      }
      setSelectedIds(new Set());
      fetchData();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : `Bulk ${action} failed`);
    } finally {
      setBulkBusy(false);
    }
  };

  const columns: Column<LeaveApplicationRow>[] = useMemo(
    () => [
      {
        key: 'select',
        className: 'w-10',
        label: (
          <input
            type="checkbox"
            checked={allSelected}
            ref={(el) => {
              if (el) el.indeterminate = someSelected;
            }}
            onChange={toggleAll}
            disabled={records.length === 0}
            aria-label="Select all"
            className="cursor-pointer"
          />
        ),
        render: (r) => (
          <input
            type="checkbox"
            checked={selectedIds.has(r.id)}
            onChange={() => toggleOne(r.id)}
            aria-label={`Select ${r.employee.employeeCode}`}
            className="cursor-pointer"
          />
        ),
      },
      { key: 'employee', label: 'Employee', render: (r) => `${r.employee.employeeCode} — ${r.employee.firstName} ${r.employee.lastName}` },
      { key: 'leaveMaster', label: 'Leave Type', render: (r) => r.leaveMaster.name },
      { key: 'fromDate', label: 'From', render: (r) => new Date(r.fromDate).toLocaleDateString() },
      { key: 'toDate', label: 'To', render: (r) => new Date(r.toDate).toLocaleDateString() },
      { key: 'numberOfDays', label: 'Days' },
      {
        key: 'status',
        label: 'Stage',
        // Both stages share this queue, and who can action which differs:
        // pending_manager needs the employee's reporting manager, pending_hr
        // needs workforce.leave.approve. Showing the stage stops a bulk
        // approve from silently skipping half the selection.
        render: (r) => (
          <span
            className="rounded-full px-2 py-0.5 text-xs font-medium"
            style={{
              backgroundColor: r.status === 'pending_hr' ? '#dbeafe' : '#fef9c3',
              color: r.status === 'pending_hr' ? '#1e40af' : '#854d0e',
            }}
          >
            {r.status === 'pending_hr' ? 'With HR' : r.status === 'pending_manager' ? 'With Manager' : (r.status ?? '—')}
          </span>
        ),
      },
      { key: 'reason', label: 'Reason', render: (r) => r.reason ?? '—' },
    ],
    // toggleAll/toggleOne are stable enough for this table's size; the
    // checkbox state is what actually needs to re-render.
    [records, selectedIds, allSelected, someSelected] // eslint-disable-line react-hooks/exhaustive-deps
  );

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h1 className="text-xl font-semibold" style={{ color: 'var(--foreground)' }}>
          Leave Approval
        </h1>
        <div className="flex items-center gap-2">
          {selectedIds.size > 0 && (
            <span className="text-xs" style={{ color: 'var(--foreground-muted)' }}>
              {selectedIds.size} selected
            </span>
          )}
          <button
            onClick={() => setBulkApproveOpen(true)}
            disabled={selectedIds.size === 0 || bulkBusy}
            className="rounded-lg px-4 py-2 text-sm font-semibold text-white transition hover:opacity-90 disabled:opacity-40"
            style={{ backgroundColor: '#166534' }}
          >
            {bulkBusy ? 'Working…' : `Approve Selected${selectedIds.size ? ` (${selectedIds.size})` : ''}`}
          </button>
          <button
            onClick={() => setBulkRejectOpen(true)}
            disabled={selectedIds.size === 0 || bulkBusy}
            className="rounded-lg border px-4 py-2 text-sm font-medium transition hover:opacity-90 disabled:opacity-40"
            style={{ borderColor: '#991b1b', color: '#991b1b' }}
          >
            Reject Selected{selectedIds.size ? ` (${selectedIds.size})` : ''}
          </button>
        </div>
      </div>

      <DataTable
        columns={columns}
        data={records}
        loading={loading}
        emptyMessage="No pending leave applications."
        renderRowActions={(row) => (
          <>
            <button onClick={() => setApproveId(row.id)} className="mr-3 text-xs font-medium hover:underline" style={{ color: '#166534' }}>
              Approve
            </button>
            <button onClick={() => setRejectId(row.id)} className="text-xs font-medium hover:underline" style={{ color: '#991b1b' }}>
              Reject
            </button>
          </>
        )}
      />

      {bulkResults && bulkResults.length > 0 && (
        <section className="rounded-xl border p-3" style={{ borderColor: 'var(--border)', backgroundColor: 'var(--surface)' }}>
          <div className="mb-2 flex items-center justify-between">
            <h2 className="text-sm font-semibold" style={{ color: 'var(--foreground)' }}>Last bulk action</h2>
            <button onClick={() => setBulkResults(null)} className="text-xs hover:underline" style={{ color: 'var(--foreground-muted)' }}>
              Dismiss
            </button>
          </div>
          <div className="overflow-x-auto rounded-lg border" style={{ borderColor: 'var(--border)' }}>
            <table className="w-full text-xs">
              <thead>
                <tr>
                  {['Employee', 'Stage', 'Result', 'Detail'].map((h) => (
                    <th key={h} className="px-2 py-1.5 text-left font-semibold" style={{ color: 'var(--foreground-muted)' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {/* Anything not fully applied first — that's what needs action. */}
                {[...bulkResults]
                  .sort((a, b) => (a.status === b.status ? 0 : a.status === 'ok' ? 1 : -1))
                  .map((r) => (
                    <tr key={r.id} className="border-t" style={{ borderColor: 'var(--border)' }}>
                      <td className="px-2 py-1.5" style={{ color: 'var(--foreground)' }}>{r.employeeCode ?? r.id}</td>
                      <td className="px-2 py-1.5" style={{ color: 'var(--foreground-muted)' }}>{r.stage ?? '—'}</td>
                      <td className="px-2 py-1.5">
                        <span
                          className="rounded-full px-2 py-0.5 text-[11px] font-medium"
                          style={{
                            backgroundColor: r.status === 'ok' ? '#dcfce7' : r.status === 'skipped' ? '#fef9c3' : '#fee2e2',
                            color: r.status === 'ok' ? '#166534' : r.status === 'skipped' ? '#854d0e' : '#991b1b',
                          }}
                        >
                          {r.status}
                        </span>
                      </td>
                      <td className="px-2 py-1.5" style={{ color: 'var(--foreground-muted)' }}>{r.message ?? ''}</td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      <ConfirmDialog
        title="Approve Leave"
        message="This will deduct the days from the employee's leave balance and mark those dates as Leave on their attendance. Continue?"
        confirmLabel="Approve"
        isOpen={approveId !== null}
        onConfirm={() => {
          if (approveId) handleApprove(approveId);
          setApproveId(null);
        }}
        onClose={() => setApproveId(null)}
      />

      <ConfirmDialog
        title={`Approve ${selectedIds.size} Leave Application(s)`}
        message={
          `Rows awaiting HR will deduct leave balances and mark those dates as Leave on attendance. ` +
          `Rows awaiting a manager will move to HR instead. Anything you cannot act on, or that fails a ` +
          `balance or frozen-month check, is skipped and listed afterwards. Continue?`
        }
        confirmLabel="Approve Selected"
        isOpen={bulkApproveOpen}
        onConfirm={() => {
          setBulkApproveOpen(false);
          void runBulk('approve');
        }}
        onClose={() => setBulkApproveOpen(false)}
      />

      <FormModal
        title="Reject Leave"
        fields={rejectFields}
        initialValues={{}}
        isOpen={rejectId !== null}
        onClose={() => setRejectId(null)}
        onSubmit={async (values) => {
          const res = await fetch(`/api/workforce/leave/applications/${rejectId}/reject`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ rejectionReason: values.rejectionReason }),
          });
          if (!res.ok) {
            const err = await res.json();
            throw new Error(err.error ?? 'Reject failed');
          }
          fetchData();
        }}
        submitLabel="Reject"
      />

      <FormModal
        title={`Reject ${selectedIds.size} Leave Application(s)`}
        fields={rejectFields}
        initialValues={{}}
        isOpen={bulkRejectOpen}
        onClose={() => setBulkRejectOpen(false)}
        onSubmit={async (values) => {
          setBulkRejectOpen(false);
          await runBulk('reject', String(values.rejectionReason));
        }}
        submitLabel="Reject Selected"
      />
    </div>
  );
}
