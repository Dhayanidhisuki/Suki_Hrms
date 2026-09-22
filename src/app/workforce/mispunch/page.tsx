/**
 * Mispunch Correction — self-service page. Employees apply for punch
 * corrections; managers approve their reports; HR gives final approval.
 */

'use client';

import { useState, useEffect, useCallback } from 'react';
import { DataTable, FormModal, useToast, type Column, type FieldDef } from '@/components/ui';

interface MispunchRequest {
  id: number;
  date: string;
  requestedInTime: string | null;
  requestedOutTime: string | null;
  reason: string;
  status: string;
  managerRejectionReason: string | null;
  rejectionReason: string | null;
  employee?: { employeeCode: string; firstName: string; lastName: string };
  [key: string]: unknown;
}

const columns: Column<MispunchRequest>[] = [
  { key: 'date', label: 'Date', sortable: true },
  { key: 'requestedInTime', label: 'In Time' },
  { key: 'requestedOutTime', label: 'Out Time' },
  { key: 'reason', label: 'Reason' },
  { key: 'status', label: 'Status', sortable: true },
];

const fields: FieldDef[] = [
  { name: 'date', label: 'Date', type: 'date', required: true },
  { name: 'requestedInTime', label: 'Requested In Time (HH:MM)', type: 'text', placeholder: 'e.g. 09:30', helpText: 'Leave blank if only correcting out-time' },
  { name: 'requestedOutTime', label: 'Requested Out Time (HH:MM)', type: 'text', placeholder: 'e.g. 18:00', helpText: 'Leave blank if only correcting in-time' },
  { name: 'reason', label: 'Reason', type: 'textarea', required: true, placeholder: 'Why is this correction needed?' },
];

export default function MispunchPage() {
  const toast = useToast();
  const [records, setRecords] = useState<MispunchRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [scope, setScope] = useState<'mine' | 'manager' | 'hr'>('mine');
  const [modalOpen, setModalOpen] = useState(false);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/workforce/mispunch?scope=${scope}`);
      if (!res.ok) throw new Error('Failed to fetch');
      const json = await res.json();
      const mapped = (json.data ?? []).map((r: Record<string, unknown>) => ({
        ...r,
        date: r.date as string,
        requestedInTime: r.requestedInTime ? (r.requestedInTime as string).slice(11, 16) : '—',
        requestedOutTime: r.requestedOutTime ? (r.requestedOutTime as string).slice(11, 16) : '—',
        employeeCode: r.employee ? (r.employee as Record<string, unknown>).employeeCode as string : '',
        employeeName: r.employee ? `${(r.employee as Record<string, unknown>).firstName} ${(r.employee as Record<string, unknown>).lastName}`.trim() : '',
      })) as MispunchRequest[];
      setRecords(mapped);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  }, [scope, toast]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const handleSubmit = async (values: Record<string, string | number | boolean>) => {
    const res = await fetch('/api/workforce/mispunch', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(values),
    });
    if (res.ok) {
      setModalOpen(false);
      fetchData();
    } else {
      const json = await res.json().catch(() => ({}));
      toast.error(json.error ?? 'Failed to submit');
    }
  };

  const handleApprove = async (id: number) => {
    const res = await fetch(`/api/workforce/mispunch/${id}/approve`, { method: 'POST' });
    if (res.ok) fetchData();
    else toast.error('Failed to approve');
  };

  const handleReject = async (id: number) => {
    const reason = prompt('Rejection reason:');
    if (!reason) return;
    const res = await fetch(`/api/workforce/mispunch/${id}/reject`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ rejectionReason: reason }),
    });
    if (res.ok) fetchData();
    else toast.error('Failed to reject');
  };

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-xl font-semibold" style={{ color: 'var(--foreground)' }}>Mispunch Correction</h1>
          <p className="mt-1 text-sm" style={{ color: 'var(--foreground-muted)' }}>
            Apply for punch-time corrections. Managers approve their reports; HR gives final approval.
          </p>
        </div>
        {scope === 'mine' && (
          <button
            onClick={() => setModalOpen(true)}
            className="rounded-lg px-4 py-2 text-sm font-semibold text-white"
            style={{ backgroundColor: 'var(--primary)' }}
          >
            New Correction
          </button>
        )}
      </div>

      {/* Scope tabs */}
      <div className="flex gap-2">
        {(['mine', 'manager', 'hr'] as const).map((s) => (
          <button
            key={s}
            onClick={() => setScope(s)}
            className={`rounded-lg px-3 py-1.5 text-sm font-medium ${scope === s ? 'text-white' : ''}`}
            style={scope === s ? { backgroundColor: 'var(--primary)' } : { borderColor: 'var(--border)', backgroundColor: 'var(--surface)', color: 'var(--foreground)' }}
          >
            {s === 'mine' ? 'My Requests' : s === 'manager' ? 'Pending (Manager)' : 'Pending (HR)'}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="text-sm" style={{ color: 'var(--foreground-muted)' }}>Loading…</div>
      ) : (
        <DataTable
          data={records}
          columns={scope === 'mine' ? columns : [
            { key: 'employeeCode', label: 'Code', sortable: true, className: 'font-medium' },
            { key: 'employeeName', label: 'Name', sortable: true },
            ...columns.slice(0, -1),
            { key: 'status', label: 'Status', sortable: true },
          ]}
          emptyMessage="No mispunch requests"
          renderRowActions={(row) => (
            <div className="flex gap-2">
              {(row.status === 'pending_manager' && scope === 'manager') && (
                <>
                  <button onClick={() => handleApprove(row.id)} className="rounded px-2 py-1 text-xs font-medium text-white" style={{ backgroundColor: 'var(--success)' }}>Approve</button>
                  <button onClick={() => handleReject(row.id)} className="rounded px-2 py-1 text-xs font-medium text-white" style={{ backgroundColor: 'var(--danger)' }}>Reject</button>
                </>
              )}
              {(row.status === 'pending_hr' && scope === 'hr') && (
                <>
                  <button onClick={() => handleApprove(row.id)} className="rounded px-2 py-1 text-xs font-medium text-white" style={{ backgroundColor: 'var(--success)' }}>Approve</button>
                  <button onClick={() => handleReject(row.id)} className="rounded px-2 py-1 text-xs font-medium text-white" style={{ backgroundColor: 'var(--danger)' }}>Reject</button>
                </>
              )}
            </div>
          )}
        />
      )}

      <FormModal
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        title="New Mispunch Correction"
        fields={fields}
        onSubmit={handleSubmit}
      />
    </div>
  );
}
