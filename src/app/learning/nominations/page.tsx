'use client';

import { useState, useEffect } from 'react';
import { DataTable, FormModal, ConfirmDialog, KPICard, KPIGrid } from '@/components/ui';
import type { Column, FieldDef } from '@/components/ui';
import { exportCsv } from '@/lib/exportCsv';
import { exportXlsx } from '@/lib/exportXlsx';
import { printTable } from '@/lib/printTable';

interface Nomination {
  id: number;
  trainingScheduleId: number;
  employeeId: number;
  reason: string | null;
  priority: string;
  status: string;
  nominationDate: string;
  createdAt: string;
}

interface ApiResponse {
  data: Nomination[];
  pagination: { page: number; limit: number; total: number; totalPages: number };
}

const fields: FieldDef[] = [
  { name: 'trainingScheduleId', label: 'Training Schedule ID', type: 'number', required: true, placeholder: 'e.g. 1' },
  { name: 'employeeId', label: 'Employee ID', type: 'number', required: true, placeholder: 'e.g. 101' },
  { name: 'reason', label: 'Reason', type: 'select', options: [
    { value: 'TNA', label: 'TNA' },
    { value: 'SKILL_GAP', label: 'Skill Gap' },
    { value: 'MANDATORY', label: 'Mandatory' },
    { value: 'MANAGER', label: 'Manager Recommendation' },
    { value: 'PLAN', label: 'Training Plan' },
    { value: 'PROMOTION', label: 'Promotion' },
    { value: 'NEW_JOINING', label: 'New Joining' },
  ] },
  { name: 'priority', label: 'Priority', type: 'select', options: [
    { value: 'LOW', label: 'Low' },
    { value: 'MEDIUM', label: 'Medium' },
    { value: 'HIGH', label: 'High' },
  ], defaultValue: 'MEDIUM' },
];

export default function NominationsPage() {
  const [records, setRecords] = useState<Nomination[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState('');
  const [myTeam, setMyTeam] = useState(false);
  const [page, setPage] = useState(1);
  const [pagination, setPagination] = useState({ page: 1, limit: 20, total: 0, totalPages: 0 });
  const [refresh, setRefresh] = useState(0);

  const [modalOpen, setModalOpen] = useState(false);
  const [initialValues, setInitialValues] = useState<Record<string, string | number | boolean | undefined>>({});
  const [deleteId, setDeleteId] = useState<number | null>(null);

  useEffect(() => {
    let mounted = true;
    const load = async () => {
      setLoading(true);
      setError(null);
      try {
        const params = new URLSearchParams({ page: String(page), limit: '20', ...(statusFilter ? { status: statusFilter } : {}), ...(myTeam ? { myTeam: '1' } : {}) });
        const res = await fetch(`/api/training-nominations?${params}`);
        if (!res.ok) throw new Error('Failed to fetch');
        const json: ApiResponse = await res.json();
        if (!mounted) return;
        setRecords(json.data);
        setPagination(json.pagination);
      } catch (err) {
        if (!mounted) return;
        setError(err instanceof Error ? err.message : 'Unknown error');
      } finally {
        if (!mounted) return;
        setLoading(false);
      }
    };
    void load();
    return () => { mounted = false; };
  }, [page, statusFilter, myTeam, refresh]);

  const handleAdd = () => {
    setInitialValues({ priority: 'MEDIUM', status: 'PENDING' });
    setModalOpen(true);
  };

  const handleSubmit = async (values: Record<string, string | number | boolean>) => {
    const payload = { ...values, reason: values.reason || null };
    const res = await fetch('/api/training-nominations', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error ?? 'Save failed');
    }
    setRefresh((n) => n + 1);
  };

  const handleDelete = async (id: number) => {
    const res = await fetch(`/api/training-nominations/${id}`, { method: 'DELETE' });
    if (!res.ok) {
      const err = await res.json();
      setError(err.error ?? 'Cancel failed');
      return;
    }
    setRefresh((n) => n + 1);
  };

  const handleApprove = async (id: number, action: 'APPROVE' | 'REJECT' | 'RETURN' | 'RESUBMIT') => {
    const res = await fetch(`/api/training-nominations/${id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action }) });
    if (!res.ok) {
      const err = await res.json();
      setError(err.error ?? 'Action failed');
      return;
    }
    setRefresh((n) => n + 1);
  };

  const columns: Column<Nomination>[] = [
    { key: 'trainingScheduleId', label: 'Schedule', sortable: true },
    { key: 'employeeId', label: 'Employee', sortable: true },
    { key: 'reason', label: 'Reason', render: (row) => row.reason ?? '—' },
    { key: 'priority', label: 'Priority' },
    {
      key: 'status',
      label: 'Status',
      render: (row) => (
        <span className="rounded-full px-2 py-0.5 text-xs font-medium"
          style={{
            backgroundColor: row.status === 'APPROVED' ? '#dcfce7' : row.status === 'REJECTED' ? '#fee2e2' : row.status === 'CANCELLED' ? '#f1f5f9' : row.status === 'RETURNED' ? '#ffedd5' : '#fef9c3',
            color: row.status === 'APPROVED' ? '#166534' : row.status === 'REJECTED' ? '#991b1b' : row.status === 'CANCELLED' ? '#475569' : row.status === 'RETURNED' ? '#9a3412' : '#854d0e',
          }}>
          {row.status}
        </span>
      ),
    },
    {
      key: 'actions',
      label: 'Approve',
      render: (row) =>
        row.status === 'PENDING' || row.status === 'NOMINATED' ? (
          <div className="flex gap-1">
            <button onClick={() => handleApprove(row.id, 'APPROVE')} className="rounded px-2 py-0.5 text-xs text-white" style={{ backgroundColor: '#16a34a' }}>Approve</button>
            <button onClick={() => handleApprove(row.id, 'RETURN')} className="rounded px-2 py-0.5 text-xs text-white" style={{ backgroundColor: '#d97706' }}>Return</button>
            <button onClick={() => handleApprove(row.id, 'REJECT')} className="rounded px-2 py-0.5 text-xs text-white" style={{ backgroundColor: '#dc2626' }}>Reject</button>
          </div>
        ) : row.status === 'RETURNED' ? (
          <button onClick={() => handleApprove(row.id, 'RESUBMIT')} className="rounded px-2 py-0.5 text-xs text-white" style={{ backgroundColor: 'var(--accent)' }}>Resubmit</button>
        ) : '—',
    },
  ];

  const pending = records.filter((r) => r.status === 'PENDING').length;
  const approved = records.filter((r) => r.status === 'APPROVED').length;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold" style={{ color: 'var(--foreground)' }}>Training Nominations</h1>
        <div className="flex gap-2">
          <button
            onClick={() => exportCsv('nominations.csv', records.map((r) => ({
              Id: r.id, Schedule: r.trainingScheduleId, Employee: r.employeeId, Reason: r.reason ?? '',
              Priority: r.priority, Status: r.status, Date: r.nominationDate?.slice(0, 10) ?? '',
            })))}
            className="rounded-lg px-4 py-2 text-sm font-medium transition" style={{ border: '1px solid var(--border)', color: 'var(--foreground)' }}
          >
            Export CSV
          </button>
          <button
            onClick={() => exportXlsx('nominations.xlsx', records.map((r) => ({
              Id: r.id, Schedule: r.trainingScheduleId, Employee: r.employeeId, Reason: r.reason ?? '',
              Priority: r.priority, Status: r.status, Date: r.nominationDate?.slice(0, 10) ?? '',
            })), 'Nominations')}
            className="rounded-lg px-4 py-2 text-sm font-medium transition" style={{ border: '1px solid var(--border)', color: 'var(--foreground)' }}
          >
            Export Excel
          </button>
          <button
            onClick={() => printTable('Training Nominations', [
              { label: 'ID', value: (r: { id: number }) => r.id },
              { label: 'Schedule', value: (r: { trainingScheduleId: number }) => r.trainingScheduleId },
              { label: 'Employee', value: (r: { employeeId: number }) => r.employeeId },
              { label: 'Reason', value: (r: { reason: string | null }) => r.reason },
              { label: 'Priority', value: (r: { priority: string }) => r.priority },
              { label: 'Status', value: (r: { status: string }) => r.status },
              { label: 'Date', value: (r: { nominationDate: string | null }) => r.nominationDate?.slice(0, 10) },
            ], records)}
            className="rounded-lg px-4 py-2 text-sm font-medium transition" style={{ border: '1px solid var(--border)', color: 'var(--foreground)' }}
            title="Print or save as PDF via the browser print dialog"
          >
            Print / PDF
          </button>
          <button onClick={handleAdd} className="rounded-lg px-4 py-2 text-sm font-medium text-white transition hover:opacity-90" style={{ backgroundColor: 'var(--accent)' }}>
            + Nominate Employee
          </button>
        </div>
      </div>

      <KPIGrid columns={3}>
        <KPICard label="Total Nominations" value={pagination.total} tone="info" />
        <KPICard label="Pending Approval" value={pending} tone="warning" />
        <KPICard label="Approved" value={approved} tone="success" />
      </KPIGrid>

      <div className="flex gap-2">
        <select value={statusFilter} onChange={(e) => { setStatusFilter(e.target.value); setPage(1); }} className="rounded-lg border px-3 py-2 text-sm" style={{ borderColor: 'var(--border)', backgroundColor: 'var(--surface)' }}>
          <option value="">All Status</option>
          <option value="PENDING">Pending</option>
          <option value="APPROVED">Approved</option>
          <option value="REJECTED">Rejected</option>
          <option value="CANCELLED">Cancelled</option>
          <option value="RETURNED">Returned</option>
          <option value="NOMINATED">Nominated</option>
        </select>
        <label className="flex items-center gap-1.5 rounded-lg border px-3 py-2 text-sm" style={{ borderColor: 'var(--border)', backgroundColor: 'var(--surface)', color: 'var(--foreground)' }}>
          <input type="checkbox" checked={myTeam} onChange={(e) => { setMyTeam(e.target.checked); setPage(1); }} />
          My Team
        </label>
      </div>

      {error && <div className="rounded-lg px-3 py-2 text-sm" style={{ backgroundColor: '#fef2f2', color: '#dc2626', border: '1px solid #fecaca' }}>{error}</div>}

      <DataTable
        columns={columns}
        data={records}
        pagination={pagination}
        loading={loading}
        onPageChange={setPage}
        onDelete={(row) => setDeleteId(row.id)}
      />

      <FormModal
        title="Nominate Employee"
        fields={fields}
        initialValues={initialValues}
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        onSubmit={handleSubmit}
        submitLabel="Create"
      />

      <ConfirmDialog
        title="Cancel Nomination"
        message="Are you sure you want to cancel this nomination?"
        isOpen={deleteId !== null}
        onConfirm={() => deleteId && handleDelete(deleteId)}
        onClose={() => setDeleteId(null)}
      />
    </div>
  );
}
