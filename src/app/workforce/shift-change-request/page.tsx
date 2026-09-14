/**
 * Shift Change Request — employees can request a shift change for a specific
 * date, and approvers can approve/reject through the dynamic approval chain.
 *
 * UI pass (2026-09): section cards with counts, "from → to" shift column,
 * status badge with stage indicator, KPI strip. Endpoints/fields unchanged.
 */

'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { DataTable, FormModal, PageHeader, Alert, StatusBadge, statusTone, SectionCard, Button, KPICard, KPIGrid, type Column, type FieldDef } from '@/components/ui';

interface ShiftChangeRequestRow {
  id: number;
  requestedDate: string;
  reason: string | null;
  status: string;
  currentStageOrder: number;
  rejectionReason: string | null;
  employee: { employeeCode: string; firstName: string; lastName: string };
  currentShiftMaster: { code: string; name: string } | null;
  requestedShiftMaster: { code: string; name: string; startTime: string; endTime: string };
}

interface ShiftOption {
  id: number;
  code: string;
  name: string;
  startTime: string;
  endTime: string;
}

const requestFields: FieldDef[] = [
  { name: 'requestedDate', label: 'Requested Date', type: 'date', required: true },
  { name: 'requestedShiftMasterId', label: 'Requested Shift', type: 'select', required: true, options: [] },
  { name: 'reason', label: 'Reason', type: 'textarea' },
];

const rejectFields: FieldDef[] = [{ name: 'rejectionReason', label: 'Rejection Reason', type: 'textarea', required: true }];

function useQueue(scope: 'my' | 'pending') {
  const [records, setRecords] = useState<ShiftChangeRequestRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/workforce/shift-change-request?scope=${scope}`);
      if (!res.ok) throw new Error((await res.json()).error ?? 'Failed to fetch');
      const json = await res.json();
      setRecords(json.data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  }, [scope]);

  useEffect(() => { fetchData(); }, [fetchData]);
  return { records, loading, error, refetch: fetchData };
}

const ArrowRight = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
    <path d="M5 12h14M13 6l6 6-6 6" />
  </svg>
);

export default function ShiftChangeRequestPage() {
  const myQueue = useQueue('my');
  const pendingQueue = useQueue('pending');
  const [shifts, setShifts] = useState<ShiftOption[]>([]);
  const [requestOpen, setRequestOpen] = useState(false);
  const [rejectId, setRejectId] = useState<number | null>(null);
  const [result, setResult] = useState<string | null>(null);

  useEffect(() => {
    fetch('/api/masters/shift-masters?limit=50')
      .then((r) => r.json())
      .then((json) => setShifts(json.data ?? []))
      .catch(() => {});
  }, []);

  const fieldsWithShifts: FieldDef[] = requestFields.map((f) =>
    f.name === 'requestedShiftMasterId'
      ? { ...f, options: shifts.map((s) => ({ value: String(s.id), label: `${s.code} — ${s.name} (${s.startTime}-${s.endTime})` })) }
      : f
  );

  const handleCreate = async (values: Record<string, string | number | boolean>) => {
    const res = await fetch('/api/workforce/shift-change-request', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        requestedDate: values.requestedDate,
        requestedShiftMasterId: Number(values.requestedShiftMasterId),
        reason: values.reason || undefined,
      }),
    });
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error ?? 'Failed to create request');
    }
    setResult('Shift change request created');
    myQueue.refetch();
  };

  const handleApprove = async (id: number) => {
    const res = await fetch(`/api/workforce/shift-change-request/${id}/approve`, { method: 'POST' });
    const json = await res.json();
    if (!res.ok) {
      alert(json.error ?? 'Approve failed');
      return;
    }
    setResult(json.message ?? 'Approved');
    pendingQueue.refetch();
    myQueue.refetch();
  };

  const handleReject = async (values: Record<string, string | number | boolean>) => {
    if (!rejectId) return;
    const res = await fetch(`/api/workforce/shift-change-request/${rejectId}/reject`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ rejectionReason: String(values.rejectionReason) }),
    });
    const json = await res.json();
    if (!res.ok) {
      throw new Error(json.error ?? 'Reject failed');
    }
    setResult('Request rejected');
    setRejectId(null);
    pendingQueue.refetch();
    myQueue.refetch();
  };

  const kpi = useMemo(() => {
    const mine = myQueue.records;
    return {
      mine: mine.length,
      minePending: mine.filter((r) => r.status === 'pending').length,
      mineApproved: mine.filter((r) => r.status === 'approved').length,
      toApprove: pendingQueue.records.filter((r) => r.status === 'pending').length,
    };
  }, [myQueue.records, pendingQueue.records]);

  const columns: Column<ShiftChangeRequestRow>[] = [
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
      key: 'requestedDate',
      label: 'Date',
      render: (r) => {
        const d = new Date(r.requestedDate);
        return (
          <span className="tabular-nums">
            {d.toLocaleDateString(undefined, { day: '2-digit', month: 'short', year: 'numeric' })}
            <span className="ml-1.5 text-[11px]" style={{ color: 'var(--foreground-muted)' }}>{d.toLocaleDateString(undefined, { weekday: 'short' })}</span>
          </span>
        );
      },
    },
    {
      key: 'requestedShiftMaster',
      label: 'Shift Change',
      render: (r) => (
        <div className="flex items-center gap-2">
          <StatusBadge tone="neutral">{r.currentShiftMaster?.code ?? '—'}</StatusBadge>
          <span style={{ color: 'var(--foreground-muted)' }}><ArrowRight /></span>
          <StatusBadge tone="accent" title={`${r.requestedShiftMaster.name} (${r.requestedShiftMaster.startTime}-${r.requestedShiftMaster.endTime})`}>
            {r.requestedShiftMaster.code}
            <span className="opacity-70">{r.requestedShiftMaster.startTime}–{r.requestedShiftMaster.endTime}</span>
          </StatusBadge>
        </div>
      ),
    },
    {
      key: 'reason',
      label: 'Reason',
      render: (r) => (
        <span className="block max-w-[260px] truncate" title={r.reason ?? undefined} style={{ color: r.reason ? 'var(--foreground)' : 'var(--foreground-muted)' }}>
          {r.reason ?? '—'}
        </span>
      ),
    },
    {
      key: 'status',
      label: 'Status',
      render: (r) => (
        <div className="flex flex-col items-start gap-0.5">
          <StatusBadge tone={statusTone(r.status)} dot>
            {r.status}
            {r.status === 'pending' && <span className="opacity-70">· stage {r.currentStageOrder}</span>}
          </StatusBadge>
          {r.status === 'rejected' && r.rejectionReason && (
            <span className="max-w-[220px] truncate text-[11px]" title={r.rejectionReason} style={{ color: 'var(--danger)' }}>{r.rejectionReason}</span>
          )}
        </div>
      ),
    },
  ];

  return (
    <div className="space-y-4">
      <PageHeader
        eyebrow="Time Office"
        title="Shift Change Requests"
        description="Request a different shift for a specific date. Requests move through the configured approval chain and, once approved, create a shift override automatically."
        actions={<Button variant="primary" onClick={() => setRequestOpen(true)}>+ New Request</Button>}
      />

      <KPIGrid columns={4}>
        <KPICard label="My Requests" value={kpi.mine} tone="info" />
        <KPICard label="Awaiting Approval" value={kpi.minePending} tone={kpi.minePending > 0 ? 'warning' : 'success'} />
        <KPICard label="Approved" value={kpi.mineApproved} tone="success" />
        <KPICard label="Pending My Action" value={kpi.toApprove} tone={kpi.toApprove > 0 ? 'danger' : 'success'} />
      </KPIGrid>

      {result && <Alert tone="success" onDismiss={() => setResult(null)}>{result}</Alert>}

      <SectionCard title="Pending My Approval" description="Requests where you are the current-stage approver." count={pendingQueue.loading ? undefined : kpi.toApprove} flush>
        {pendingQueue.error && <div className="p-3"><Alert tone="danger">{pendingQueue.error}</Alert></div>}
        <DataTable
          variant="card"
          columns={columns}
          data={pendingQueue.records}
          loading={pendingQueue.loading}
          emptyMessage="No requests pending your approval."
          renderRowActions={(row) => (
            row.status === 'pending' ? (
              <div className="inline-flex items-center gap-1.5">
                <Button variant="success" size="xs" onClick={() => handleApprove(row.id)}>Approve</Button>
                <Button variant="danger" size="xs" onClick={() => setRejectId(row.id)}>Reject</Button>
              </div>
            ) : null
          )}
        />
      </SectionCard>

      <SectionCard title="My Requests" description="Requests you have raised, with their current approval stage." count={myQueue.loading ? undefined : myQueue.records.length} flush>
        {myQueue.error && <div className="p-3"><Alert tone="danger">{myQueue.error}</Alert></div>}
        <DataTable
          variant="card"
          columns={columns}
          data={myQueue.records}
          loading={myQueue.loading}
          emptyMessage="You haven't raised any shift change requests."
        />
      </SectionCard>

      <FormModal
        title="New Shift Change Request"
        fields={fieldsWithShifts}
        initialValues={{}}
        isOpen={requestOpen}
        onClose={() => setRequestOpen(false)}
        onSubmit={handleCreate}
        submitLabel="Submit Request"
      />

      <FormModal
        title="Reject Shift Change Request"
        fields={rejectFields}
        initialValues={{}}
        isOpen={rejectId !== null}
        onClose={() => setRejectId(null)}
        onSubmit={handleReject}
        submitLabel="Reject"
      />
    </div>
  );
}
