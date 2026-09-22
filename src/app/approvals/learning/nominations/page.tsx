'use client';

import { useState, useEffect } from 'react';
import { DataTable, KPICard, KPIGrid } from '@/components/ui';
import type { Column } from '@/components/ui';

interface Nomination {
  id: number;
  trainingScheduleId: number;
  employeeId: number;
  reason: string | null;
  priority: string;
  status: string;
  createdAt: string;
}

interface Employee { id: number; firstName: string; lastName: string | null; employeeCode: string }
interface Schedule { id: number; title: string | null; scheduledDate: string | null; trainingProgram?: { name: string } | null }

export default function NominationApprovalsPage() {
  const [records, setRecords] = useState<Nomination[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [schedules, setSchedules] = useState<Schedule[]>([]);
  const [loading, setLoading] = useState(true);
  const [acting, setActing] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [refresh, setRefresh] = useState(0);
  const [statusFilter, setStatusFilter] = useState('PENDING');

  const empName = (id: number) => {
    const e = employees.find((x) => x.id === id);
    return e ? `${e.firstName} ${e.lastName ?? ''} (${e.employeeCode})`.trim() : `#${id}`;
  };
  const schedName = (id: number) => {
    const s = schedules.find((x) => x.id === id);
    return s ? `${s.trainingProgram?.name ?? s.title ?? `#${s.id}`} — ${s.scheduledDate ? s.scheduledDate.slice(0, 10) : 'unscheduled'}` : `#${id}`;
  };

  useEffect(() => {
    let mounted = true;
    const load = async () => {
      setLoading(true);
      setError(null);
      try {
        const [nRes, eRes, sRes] = await Promise.all([
          fetch(`/api/training-nominations?limit=200${statusFilter ? `&status=${statusFilter}` : ''}`),
          fetch('/api/employees?limit=500'),
          fetch('/api/training-schedules?limit=200'),
        ]);
        const [nJson, eJson, sJson] = await Promise.all([nRes.json(), eRes.json(), sRes.json()]);
        if (!mounted) return;
        setRecords(Array.isArray(nJson) ? nJson : nJson.data ?? []);
        setEmployees(Array.isArray(eJson) ? eJson : eJson.data ?? []);
        setSchedules(Array.isArray(sJson) ? sJson : sJson.data ?? []);
      } catch (err) {
        if (mounted) setError(err instanceof Error ? err.message : 'Failed to load');
      } finally {
        if (mounted) setLoading(false);
      }
    };
    void load();
    return () => { mounted = false; };
  }, [refresh, statusFilter]);

  const act = async (id: number, action: 'APPROVE' | 'REJECT' | 'RETURN' | 'RESUBMIT') => {
    setActing(id);
    setError(null);
    try {
      const res = await fetch(`/api/training-nominations/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action }),
      });
      if (!res.ok) throw new Error((await res.json()).error ?? 'Action failed');
      setRefresh((n) => n + 1);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Action failed');
    } finally {
      setActing(null);
    }
  };

  const columns: Column<Nomination>[] = [
    { key: 'employeeId', label: 'Employee', render: (r) => empName(r.employeeId) },
    { key: 'trainingScheduleId', label: 'Training', render: (r) => schedName(r.trainingScheduleId) },
    { key: 'reason', label: 'Reason', render: (r) => r.reason ?? '—' },
    { key: 'priority', label: 'Priority' },
    { key: 'createdAt', label: 'Requested', render: (r) => r.createdAt?.slice(0, 10) ?? '—' },
    { key: 'status', label: 'Status' },
    {
      key: 'actions', label: 'Action',
      render: (r) => r.status === 'PENDING' ? (
        <div className="flex gap-2">
          <button
            onClick={() => act(r.id, 'APPROVE')}
            disabled={acting === r.id}
            className="rounded px-2 py-1 text-xs font-medium text-white disabled:opacity-50"
            style={{ backgroundColor: '#16a34a' }}
          >
            Approve
          </button>
          <button
            onClick={() => act(r.id, 'RETURN')}
            disabled={acting === r.id}
            className="rounded px-2 py-1 text-xs font-medium text-white disabled:opacity-50"
            style={{ backgroundColor: '#d97706' }}
          >
            Return
          </button>
          <button
            onClick={() => act(r.id, 'REJECT')}
            disabled={acting === r.id}
            className="rounded px-2 py-1 text-xs font-medium text-white disabled:opacity-50"
            style={{ backgroundColor: '#dc2626' }}
          >
            Reject
          </button>
        </div>
      ) : r.status === 'RETURNED' ? (
        <button
          onClick={() => act(r.id, 'RESUBMIT')}
          disabled={acting === r.id}
          className="rounded px-2 py-1 text-xs font-medium text-white disabled:opacity-50"
          style={{ backgroundColor: 'var(--accent)' }}
        >
          Resubmit
        </button>
      ) : '—',
    },
  ];

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold" style={{ color: 'var(--foreground)' }}>Training Nomination Approvals</h1>
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="rounded-lg border px-3 py-2 text-sm"
          style={{ backgroundColor: 'var(--surface)', color: 'var(--foreground)', borderColor: 'var(--border)' }}
        >
          <option value="PENDING">Pending</option>
          <option value="APPROVED">Approved</option>
          <option value="REJECTED">Rejected</option>
          <option value="RETURNED">Returned</option>
          <option value="">All</option>
        </select>
      </div>

      <KPIGrid columns={3}>
        <KPICard label="Pending" value={records.filter((r) => r.status === 'PENDING').length} tone="warning" />
        <KPICard label="Approved" value={records.filter((r) => r.status === 'APPROVED').length} tone="success" />
        <KPICard label="Rejected" value={records.filter((r) => r.status === 'REJECTED').length} tone="danger" />
      </KPIGrid>

      {error && <div className="rounded-lg px-3 py-2 text-sm" style={{ backgroundColor: '#fef2f2', color: '#dc2626', border: '1px solid #fecaca' }}>{error}</div>}

      <DataTable columns={columns} data={records} loading={loading} emptyMessage="No nominations in this queue." />
    </div>
  );
}
