/**
 * Leave Conflicts — punches that landed on approved leave days.
 *
 * The biometric sync / import never applies a punch to an approved leave
 * day; it records the punch on the day row and this queue asks HR to
 * decide (client rule 2026-09-25: never auto-decided):
 *   Present    — the employee worked; that date leaves the leave, the
 *                balance is credited back, the punches are applied.
 *   Keep leave — the leave stands; the punch is kept for audit only.
 * RBAC-gated on workforce.leave.approve (a 403 hides the page content).
 */

'use client';

import { useState, useEffect, useCallback } from 'react';
import { DataTable, ConfirmDialog, FormModal, useToast, type Column, type FieldDef } from '@/components/ui';

interface ConflictRow {
  id: number;
  date: string;
  status: string;
  leaveDayKind: string | null;
  leaveConflictInTime: string | null;
  leaveConflictOutTime: string | null;
  leaveConflictSource: string | null;
  leaveConflictDecision: string | null;
  leaveConflictDecidedAt: string | null;
  employee: { id: number; employeeCode: string; firstName: string; lastName: string };
  leaveApplication: {
    id: number;
    fromDate: string;
    toDate: string;
    numberOfDays: string | number;
    daysReversed: string | number;
    status: string;
    isHalfDay: boolean;
    leaveMaster: { code: string; name: string; isPaid: boolean };
  } | null;
}

const DECISION_LABEL: Record<string, string> = { present: 'Counted as present', keep_leave: 'Leave kept' };
const DECISION_TONE: Record<string, { bg: string; fg: string }> = {
  present: { bg: '#dcfce7', fg: '#166534' },
  keep_leave: { bg: '#dbeafe', fg: '#1e40af' },
};

const noteFields: FieldDef[] = [{ name: 'note', label: 'Note (optional)', type: 'textarea' }];

function fmtTime(iso: string | null): string {
  if (!iso) return '—';
  const d = new Date(iso);
  return `${String(d.getUTCHours()).padStart(2, '0')}:${String(d.getUTCMinutes()).padStart(2, '0')}`;
}
function fmtDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-IN', { weekday: 'short', day: '2-digit', month: 'short', year: 'numeric', timeZone: 'UTC' });
}

function useConflicts(scope: 'pending' | 'decided') {
  const [records, setRecords] = useState<ConflictRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [visible, setVisible] = useState(true);
  const toast = useToast();

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/workforce/leave/conflicts${scope === 'decided' ? '?scope=decided' : ''}`);
      if (res.status === 403) {
        setVisible(false);
        return;
      }
      if (!res.ok) throw new Error((await res.json()).error ?? 'Failed to fetch');
      const json: { data: ConflictRow[] } = await res.json();
      setRecords(json.data);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  }, [scope, toast]);

  useEffect(() => {
    // The fetch flips `loading` on entry, which is what drives the spinner.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    fetchData();
  }, [fetchData]);

  return { records, loading, visible, refetch: fetchData };
}

function employeeCell(r: ConflictRow) {
  return `${r.employee.employeeCode} — ${r.employee.firstName} ${r.employee.lastName}`;
}
function leaveCell(r: ConflictRow) {
  const a = r.leaveApplication;
  if (!a) return '—';
  const kind = r.leaveDayKind === 'HALF' ? 'half day' : r.leaveDayKind === 'SANDWICH' ? 'sandwiched weekly off' : 'full day';
  return `${a.leaveMaster.name} #${a.id} (${kind}, ${new Date(a.fromDate).toLocaleDateString()} – ${new Date(a.toDate).toLocaleDateString()})`;
}

function PendingSection() {
  const { records, loading, visible } = useConflicts('pending');
  const toast = useToast();
  const [presentId, setPresentId] = useState<number | null>(null);
  const [keepId, setKeepId] = useState<number | null>(null);
  const [actioned, setActioned] = useState<Record<number, string>>({});

  if (!visible) return null;

  const resolve = async (id: number, decision: 'present' | 'keep_leave', note?: string) => {
    const res = await fetch(`/api/workforce/leave/conflicts/${id}/resolve`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ decision, note: note || null }),
    });
    const body = await res.json().catch(() => null);
    if (!res.ok) throw new Error(body?.error ?? 'Could not record the decision');
    setActioned((prev) => ({ ...prev, [id]: decision }));
    toast.success(
      decision === 'present'
        ? `Counted as present — ${body?.daysReturned ?? 0} day(s) returned to the balance.`
        : 'Leave kept; the punch stays on record.'
    );
  };

  const columns: Column<ConflictRow>[] = [
    { key: 'employee', label: 'Employee', render: employeeCell },
    { key: 'date', label: 'Leave day', render: (r) => fmtDate(r.date) },
    { key: 'leave', label: 'Leave', render: leaveCell },
    { key: 'punch', label: 'Punched', render: (r) => `${fmtTime(r.leaveConflictInTime)} – ${fmtTime(r.leaveConflictOutTime)} (${r.leaveConflictSource ?? '—'})` },
    {
      key: 'outcome',
      label: 'Decision',
      render: (r) => {
        const d = actioned[r.id];
        if (!d) return <span className="text-xs" style={{ color: 'var(--foreground-muted)' }}>Awaiting HR</span>;
        const tone = DECISION_TONE[d];
        return (
          <span className="rounded-full px-2 py-0.5 text-xs font-medium" style={{ backgroundColor: tone.bg, color: tone.fg }}>
            {DECISION_LABEL[d]}
          </span>
        );
      },
    },
  ];

  return (
    <div className="space-y-2">
      <div>
        <h2 className="text-sm font-semibold" style={{ color: 'var(--foreground)' }}>Pending HR decision</h2>
        <p className="text-xs" style={{ color: 'var(--foreground-muted)' }}>
          The device recorded a punch on a day covered by approved leave. Nothing has been changed yet — choose whether the day counts as worked
          (leave returned to balance) or the leave stands.
        </p>
      </div>

      <DataTable
        columns={columns}
        data={records}
        loading={loading}
        emptyMessage="No punches on leave days awaiting a decision."
        renderRowActions={(row) =>
          actioned[row.id] ? (
            <span className="text-xs" style={{ color: 'var(--foreground-muted)' }}>Done</span>
          ) : (
            <>
              <button onClick={() => setPresentId(row.id)} className="mr-3 text-xs font-medium hover:underline" style={{ color: '#166534' }}>
                Employee worked — count as present
              </button>
              <button onClick={() => setKeepId(row.id)} className="text-xs font-medium hover:underline" style={{ color: '#1e40af' }}>
                Keep leave
              </button>
            </>
          )
        }
      />

      <FormModal
        title="Count this day as worked"
        fields={noteFields}
        initialValues={{}}
        isOpen={presentId !== null}
        onClose={() => setPresentId(null)}
        onSubmit={async (values) => {
          if (presentId !== null) await resolve(presentId, 'present', String(values.note ?? ''));
        }}
        submitLabel="Count as present"
      >
        <p className="text-xs" style={{ color: 'var(--foreground-muted)' }}>
          This date is removed from the leave, the day(s) are returned to the employee&apos;s balance, and the punched times are applied.
        </p>
      </FormModal>

      <ConfirmDialog
        title="Keep the leave"
        message="The leave stands for this date. The punch is kept on record and will not be raised again."
        confirmLabel="Keep leave"
        isOpen={keepId !== null}
        onConfirm={async () => {
          const id = keepId;
          setKeepId(null);
          if (id !== null) {
            try {
              await resolve(id, 'keep_leave');
            } catch (err) {
              toast.error(err instanceof Error ? err.message : 'Failed');
            }
          }
        }}
        onClose={() => setKeepId(null)}
      />
    </div>
  );
}

function DecidedSection() {
  const { records, loading, visible } = useConflicts('decided');
  if (!visible) return null;

  const columns: Column<ConflictRow>[] = [
    { key: 'employee', label: 'Employee', render: employeeCell },
    { key: 'date', label: 'Leave day', render: (r) => fmtDate(r.date) },
    { key: 'leave', label: 'Leave', render: leaveCell },
    { key: 'punch', label: 'Punched', render: (r) => `${fmtTime(r.leaveConflictInTime)} – ${fmtTime(r.leaveConflictOutTime)}` },
    {
      key: 'decision',
      label: 'Decision',
      render: (r) => {
        const d = r.leaveConflictDecision ?? '';
        const tone = DECISION_TONE[d] ?? { bg: '#f1f5f9', fg: '#475569' };
        return (
          <span className="rounded-full px-2 py-0.5 text-xs font-medium" style={{ backgroundColor: tone.bg, color: tone.fg }}>
            {DECISION_LABEL[d] ?? d}
          </span>
        );
      },
    },
    { key: 'decidedAt', label: 'Decided', render: (r) => (r.leaveConflictDecidedAt ? new Date(r.leaveConflictDecidedAt).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' }) : '—') },
    { key: 'now', label: 'Day now', render: (r) => r.status },
  ];

  return (
    <div className="space-y-2">
      <div>
        <h2 className="text-sm font-semibold" style={{ color: 'var(--foreground)' }}>Decided</h2>
        <p className="text-xs" style={{ color: 'var(--foreground-muted)' }}>Newest first. Read-only.</p>
      </div>
      <DataTable columns={columns} data={records} loading={loading} emptyMessage="Nothing decided yet." />
    </div>
  );
}

export default function LeaveConflictsPage() {
  return (
    <div className="space-y-6">
      <h1 className="text-xl font-semibold" style={{ color: 'var(--foreground)' }}>
        Leave Conflicts
      </h1>
      <PendingSection />
      <DecidedSection />
    </div>
  );
}
