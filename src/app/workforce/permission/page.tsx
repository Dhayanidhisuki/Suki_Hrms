/**
 * Permission (Short Leave) — self-service page. Employees apply for
 * short-leave-in-hours; managers see pending approvals; HR sees all.
 */

'use client';

import { useState, useEffect, useCallback } from 'react';
import { DataTable, FormModal, type Column, type FieldDef } from '@/components/ui';

interface PermissionRequest {
  id: number;
  date: string;
  fromTime: string;
  toTime: string;
  hours: string;
  reason: string | null;
  status: string;
  exceedsAllowance: boolean;
  excessHours: string;
  managerRejectionReason: string | null;
  rejectionReason: string | null;
  employee?: { employeeCode: string; firstName: string; lastName: string };
  [key: string]: unknown;
}

const columns: Column<PermissionRequest>[] = [
  { key: 'date', label: 'Date', sortable: true },
  { key: 'fromTime', label: 'From' },
  { key: 'toTime', label: 'To' },
  { key: 'hours', label: 'Hours', sortable: true },
  { key: 'reason', label: 'Reason' },
  { key: 'status', label: 'Status', sortable: true },
  { key: 'excess', label: 'Excess' },
];

const fields: FieldDef[] = [
  { name: 'date', label: 'Date', type: 'date', required: true },
  { name: 'fromTime', label: 'From Time (HH:MM)', type: 'text', required: true, placeholder: 'e.g. 14:00', helpText: 'Time when permission starts' },
  { name: 'toTime', label: 'To Time (HH:MM)', type: 'text', required: true, placeholder: 'e.g. 16:00', helpText: 'Time when permission ends' },
  { name: 'reason', label: 'Reason', type: 'textarea', placeholder: 'Brief reason for permission' },
];

export default function PermissionPage() {
  const [records, setRecords] = useState<PermissionRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [scope, setScope] = useState<'mine' | 'manager' | 'hr'>('mine');
  const [modalOpen, setModalOpen] = useState(false);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/workforce/permission?scope=${scope}`);
      if (!res.ok) throw new Error('Failed to fetch');
      const json = await res.json();
      const mapped = (json.data ?? []).map((r: Record<string, unknown>) => ({
        ...r,
        date: r.date as string,
        fromTime: (r.fromTime as string)?.slice(11, 16) ?? '',
        toTime: (r.toTime as string)?.slice(11, 16) ?? '',
        excess: r.exceedsAllowance ? `${r.excessHours} hrs` : '—',
        employeeCode: r.employee ? (r.employee as Record<string, unknown>).employeeCode as string : '',
        employeeName: r.employee ? `${(r.employee as Record<string, unknown>).firstName} ${(r.employee as Record<string, unknown>).lastName}`.trim() : '',
      })) as PermissionRequest[];
      setRecords(mapped);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  }, [scope]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const handleSubmit = async (values: Record<string, string | number | boolean>) => {
    const res = await fetch('/api/workforce/permission', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(values),
    });
    if (res.ok) {
      setModalOpen(false);
      fetchData();
    } else {
      const json = await res.json().catch(() => ({}));
      alert(json.error ?? 'Failed to submit');
    }
  };

  const handleApprove = async (id: number) => {
    const res = await fetch(`/api/workforce/permission/${id}/approve`, { method: 'POST' });
    if (res.ok) fetchData();
    else alert('Failed to approve');
  };

  const handleReject = async (id: number) => {
    const reason = prompt('Rejection reason:');
    if (!reason) return;
    const res = await fetch(`/api/workforce/permission/${id}/reject`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ rejectionReason: reason }),
    });
    if (res.ok) fetchData();
    else alert('Failed to reject');
  };

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-xl font-semibold" style={{ color: 'var(--foreground)' }}>Permission (Short Leave)</h1>
          <p className="mt-1 text-sm" style={{ color: 'var(--foreground-muted)' }}>
            Apply for short-leave-in-hours. Managers approve their reports; HR approves all.
          </p>
        </div>
        {scope === 'mine' && (
          <button
            onClick={() => setModalOpen(true)}
            className="rounded-lg px-4 py-2 text-sm font-semibold text-white"
            style={{ backgroundColor: 'var(--primary)' }}
          >
            Apply for Permission
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

      {error && <div className="rounded-lg border border-red-300 bg-red-50 p-3 text-sm text-red-700">{error}</div>}

      {loading ? (
        <div className="text-sm" style={{ color: 'var(--foreground-muted)' }}>Loading…</div>
      ) : (
        <DataTable
          data={records}
          columns={scope === 'mine' ? columns : [
            { key: 'employeeCode', label: 'Code', sortable: true, className: 'font-medium' },
            { key: 'employeeName', label: 'Name', sortable: true },
            ...columns.slice(0, -1),
            { key: 'excess', label: 'Excess' },
          ]}
          emptyMessage="No permission requests"
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
              {row.exceedsAllowance && row.status === 'approved' && (
                <span className="text-xs" style={{ color: 'var(--warning)' }}>Excess → LOP</span>
              )}
            </div>
          )}
        />
      )}

      <FormModal
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        title="Apply for Permission"
        fields={fields}
        onSubmit={handleSubmit}
      />
    </div>
  );
}
