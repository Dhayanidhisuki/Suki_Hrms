/**
 * OT Approval — two queues, same shape as Mispunch Approval
 * (src/app/approvals/workforce/mispunch/page.tsx): "Pending My Approval
 * (Reporting Manager)" is hierarchy-gated, "Pending HR Approval" is
 * RBAC-gated (workforce.ot.approve). HR's Approve action additionally asks
 * how to settle it when the day is a Sunday or a declared holiday
 * (HolidayMaster) — Paid OT or Comp-Off (BRD: "Either based on approval") —
 * the API silently forces "OT" for any other day regardless of what's
 * picked here.
 */

'use client';

import { useState, useEffect, useCallback } from 'react';
import { DataTable, ConfirmDialog, FormModal, type Column, type FieldDef } from '@/components/ui';

interface OtRow {
  id: number;
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

function useOtQueue(scope: 'manager' | 'hr') {
  const [records, setRecords] = useState<OtRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [visible, setVisible] = useState(true);
  const [error, setError] = useState<string | null>(null);

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
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  }, [scope]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  return { records, loading, visible, error, refetch: fetchData };
}

function OtQueueSection({ title, scope, description, holidaySet }: { title: string; scope: 'manager' | 'hr'; description: string; holidaySet: Set<string> }) {
  const { records, loading, visible, error, refetch } = useOtQueue(scope);
  const [approveRow, setApproveRow] = useState<OtRow | null>(null);
  const [settlementType, setSettlementType] = useState<'OT' | 'COMP_OFF'>('OT');
  const [rejectId, setRejectId] = useState<number | null>(null);

  if (!visible) return null;

  const handleApprove = async () => {
    if (!approveRow) return;
    const res = await fetch(`/api/workforce/attendance/ot/${approveRow.id}/approve`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: scope === 'hr' ? JSON.stringify({ settlementType }) : undefined,
    });
    if (!res.ok) {
      const err = await res.json();
      alert(err.error ?? 'Approve failed');
      return;
    }
    setApproveRow(null);
    refetch();
  };

  const columns: Column<OtRow>[] = [
    { key: 'employee', label: 'Employee', render: (r) => `${r.employee.employeeCode} — ${r.employee.firstName} ${r.employee.lastName}` },
    {
      key: 'date',
      label: 'Date',
      render: (r) => {
        const iso = r.date.slice(0, 10);
        const tag = new Date(r.date).getUTCDay() === 0 ? ' (Sunday)' : holidaySet.has(iso) ? ' (Holiday)' : '';
        return `${new Date(r.date).toLocaleDateString()}${tag}`;
      },
    },
    { key: 'otMinutesCalculated', label: 'OT Worked', render: (r) => formatHoursMinutes(r.otMinutesCalculated) },
  ];

  return (
    <div className="space-y-2">
      <div>
        <h2 className="text-sm font-semibold" style={{ color: 'var(--foreground)' }}>
          {title}
        </h2>
        <p className="text-xs" style={{ color: 'var(--foreground-muted)' }}>
          {description}
        </p>
      </div>

      {error && (
        <div className="rounded-lg px-3 py-2 text-sm" style={{ backgroundColor: '#fef2f2', color: '#dc2626', border: '1px solid #fecaca' }}>
          {error}
        </div>
      )}

      <DataTable
        columns={columns}
        data={records}
        loading={loading}
        emptyMessage="Nothing pending here."
        renderRowActions={(row) => (
          <>
            <button
              onClick={() => {
                setApproveRow(row);
                setSettlementType('OT');
              }}
              className="mr-3 text-xs font-medium hover:underline"
              style={{ color: '#166534' }}
            >
              Approve
            </button>
            <button onClick={() => setRejectId(row.id)} className="text-xs font-medium hover:underline" style={{ color: '#991b1b' }}>
              Reject
            </button>
          </>
        )}
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
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ backgroundColor: 'rgba(0,0,0,0.4)' }}>
            <div className="w-full max-w-sm rounded-lg border p-5 space-y-4" style={{ backgroundColor: 'var(--surface)', borderColor: 'var(--border)' }}>
              <h2 className="text-base font-semibold" style={{ color: 'var(--foreground)' }}>
                Approve Overtime
              </h2>
              <p className="text-sm" style={{ color: 'var(--foreground-muted)' }}>
                {approveRow.employee.firstName} {approveRow.employee.lastName} — {formatHoursMinutes(approveRow.otMinutesCalculated)} on{' '}
                {new Date(approveRow.date).toLocaleDateString()}
              </p>

              {isSundayOrHoliday(approveRow.date, holidaySet) ? (
                <div className="flex flex-col gap-1">
                  <label className="text-xs font-medium" style={{ color: 'var(--foreground-muted)' }}>
                    Settle this Sunday/Holiday&apos;s OT as
                  </label>
                  <select
                    value={settlementType}
                    onChange={(e) => setSettlementType(e.target.value as 'OT' | 'COMP_OFF')}
                    className="rounded-lg border px-3 py-2 text-sm"
                    style={{ backgroundColor: 'var(--background)', color: 'var(--foreground)', borderColor: 'var(--border)' }}
                  >
                    <option value="OT">Paid Overtime</option>
                    <option value="COMP_OFF">Compensatory Off (1 day)</option>
                  </select>
                </div>
              ) : (
                <p className="text-xs" style={{ color: 'var(--foreground-muted)' }}>Settled as Paid Overtime (only Sunday/Holiday work can be Comp-Off).</p>
              )}

              <div className="flex justify-end gap-2 pt-2">
                <button
                  onClick={() => setApproveRow(null)}
                  className="rounded-lg border px-4 py-2 text-sm font-medium"
                  style={{ borderColor: 'var(--border)', color: 'var(--foreground)' }}
                >
                  Cancel
                </button>
                <button onClick={handleApprove} className="rounded-lg px-4 py-2 text-sm font-medium text-white" style={{ backgroundColor: 'var(--accent)' }}>
                  Approve
                </button>
              </div>
            </div>
          </div>
        )
      )}

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
    </div>
  );
}

export default function OvertimeApprovalPage() {
  const holidaySet = useHolidaySet();

  return (
    <div className="space-y-6">
      <h1 className="text-xl font-semibold" style={{ color: 'var(--foreground)' }}>
        OT Approval
      </h1>

      <OtQueueSection
        title="Pending My Approval (Reporting Manager)"
        scope="manager"
        description="Overtime worked by your direct reports, awaiting your review."
        holidaySet={holidaySet}
      />

      <OtQueueSection
        title="Pending HR Approval"
        scope="hr"
        description="Overtime already reviewed by the Reporting Manager, awaiting final HR approval and settlement."
        holidaySet={holidaySet}
      />
    </div>
  );
}
