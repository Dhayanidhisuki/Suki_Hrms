'use client';

import { useEffect, useState } from 'react';
import { useToast } from '@/components/ui';
import DataTable, { type Column, type Pagination } from '@/components/ui/DataTable';

interface Notification {
  id: number;
  event: string;
  subject: string | null;
  body: string | null;
  status: string;
  createdAt: string;
}

const PAGE_SIZE = 15;

const EVENT_LABELS: Record<string, string> = {
  VISITOR_SUBMITTED: 'Visitor Submitted',
  VISITOR_APPROVED: 'Visitor Approved',
  VISITOR_REJECTED: 'Visitor Rejected',
  VISITOR_CHECKED_IN: 'Checked In',
  VISITOR_CHECKED_OUT: 'Checked Out',
  VISITOR_OVERDUE: 'Visitor Overdue',
  GNR_CREATED: 'GNR Created',
  GNR_AUTHORIZED: 'GNR Authorized',
  GNR_INWARD: 'GNR Inward',
  GNR_OUTWARD: 'GNR Outward',
};

export default function VisitorNotifications() {
  const toast = useToast();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);
  const [pagination, setPagination] = useState<Pagination>({ page: 1, limit: PAGE_SIZE, total: 0, totalPages: 0 });
  const [statusFilter, setStatusFilter] = useState('');

  const fetchNotifications = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      params.set('page', String(pagination.page));
      params.set('limit', String(PAGE_SIZE));
      if (statusFilter) params.set('status', statusFilter);
      const res = await fetch(`/api/visitor/notifications?${params}`);
      if (!res.ok) throw new Error('Failed to fetch');
      const json = await res.json();
      setNotifications(json.data);
      setPagination(json.pagination);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchNotifications(); }, [pagination.page, statusFilter]);

  const markRead = async (ids: number[]) => {
    const res = await fetch('/api/visitor/notifications', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ids }),
    });
    if (!res.ok) return;
    fetchNotifications();
  };

  const columns: Column<Notification>[] = [
    { key: 'event', label: 'Event', render: (row) => EVENT_LABELS[row.event] ?? row.event },
    { key: 'subject', label: 'Subject', className: 'font-medium' },
    { key: 'body', label: 'Body' },
    {
      key: 'status',
      label: 'Status',
      render: (row) => (
        <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${row.status === 'READ' ? 'bg-gray-100 text-gray-600' : 'bg-blue-100 text-blue-600'}`}>
          {row.status}
        </span>
      ),
    },
    { key: 'createdAt', label: 'Received', render: (row) => new Date(row.createdAt).toLocaleString('en-IN') },
  ];

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-semibold" style={{ color: 'var(--foreground)' }}>Notifications</h1>
        <p className="text-sm" style={{ color: 'var(--foreground-muted)' }}>Visitor and gate event notifications</p>
      </div>

      <DataTable
        variant="card"
        columns={columns}
        data={notifications}
        pagination={pagination}
        loading={loading}
        onPageChange={(p) => setPagination((pg) => ({ ...pg, page: p }))}
        filters={
          <select value={statusFilter} onChange={(e) => { setStatusFilter(e.target.value); setPagination((p) => ({ ...p, page: 1 })); }} className="rounded-lg border px-3 py-2 text-sm" style={{ borderColor: 'var(--border)', backgroundColor: 'var(--surface)', color: 'var(--foreground)' }}>
            <option value="">All</option>
            <option value="PENDING">Pending</option>
            <option value="READ">Read</option>
          </select>
        }
        renderRowActions={(row) =>
          row.status !== 'READ' ? (
            <button onClick={() => markRead([row.id])} className="rounded-md px-2 py-1 text-xs font-medium" style={{ color: 'var(--accent)' }}>Mark read</button>
          ) : null
        }
        emptyMessage="No notifications."
      />
    </div>
  );
}
