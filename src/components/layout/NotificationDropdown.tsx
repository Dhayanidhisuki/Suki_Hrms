'use client';

import { useEffect, useRef, useState } from 'react';
import Icon from './NavIcons';

interface Notification {
  id: number;
  event: string;
  subject: string | null;
  body: string | null;
  status: string;
  createdAt: string;
}

const PAGE_SIZE = 10;

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

export default function NotificationDropdown() {
  const [open, setOpen] = useState(false);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const ref = useRef<HTMLDivElement>(null);

  const fetchNotifications = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/visitor/notifications?status=PENDING&limit=${PAGE_SIZE}`);
      if (!res.ok) {
        setNotifications([]);
        setTotal(0);
      } else {
        const json = await res.json();
        setNotifications(json.data ?? []);
        setTotal(json.pagination?.total ?? 0);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchNotifications();

    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  const markRead = async (ids: number[]) => {
    const res = await fetch('/api/visitor/notifications', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ids }),
    });
    if (!res.ok) return;
    fetchNotifications();
  };

  const markAllRead = () => {
    const ids = notifications.filter((n) => n.status !== 'READ').map((n) => n.id);
    if (ids.length > 0) markRead(ids);
  };

  const countText = total > 99 ? '99+' : total > 0 ? String(total) : null;

  return (
    <div ref={ref} className="relative hidden sm:block">
      <button
        type="button"
        aria-label="Notifications"
        onClick={() => setOpen((v) => !v)}
        className="relative grid h-11 w-11 place-items-center rounded-full border transition hover:bg-[color:var(--surface-hover)]"
        style={{ borderColor: 'var(--border)', color: 'var(--foreground-muted)' }}
      >
        <Icon name="bell" size={18} />
        {countText && (
          <span
            className="absolute -right-0.5 -top-0.5 grid h-5 min-w-5 place-items-center rounded-full px-1.5 text-[10px] font-bold ring-2"
            style={{ background: 'var(--danger)', color: '#fff', ['--tw-ring-color' as string]: 'var(--surface)' }}
          >
            {countText}
          </span>
        )}
      </button>

      {open && (
        <div
          className="absolute right-0 top-[calc(100%+0.5rem)] z-50 w-80 rounded-xl border p-2 shadow-lg"
          style={{ backgroundColor: 'var(--surface)', borderColor: 'var(--border)' }}
        >
          <div className="flex items-center justify-between border-b px-3 py-2" style={{ borderColor: 'var(--border)' }}>
            <h3 className="text-sm font-semibold" style={{ color: 'var(--foreground)' }}>Notifications</h3>
            {notifications.length > 0 && (
              <button
                onClick={markAllRead}
                className="text-xs font-medium"
                style={{ color: 'var(--accent)' }}
              >
                Mark all read
              </button>
            )}
          </div>

          <div className="max-h-80 overflow-y-auto">
            {loading && (
              <div className="px-3 py-4 text-sm" style={{ color: 'var(--foreground-muted)' }}>Loading...</div>
            )}
            {!loading && error && (
              <div className="px-3 py-4 text-sm" style={{ color: 'var(--danger)' }}>{error}</div>
            )}
            {!loading && !error && notifications.length === 0 && (
              <div className="px-3 py-4 text-sm" style={{ color: 'var(--foreground-muted)' }}>No new notifications.</div>
            )}
            {!loading &&
              notifications.map((n) => (
                <div
                  key={n.id}
                  className="group flex items-start justify-between gap-2 border-b px-3 py-2 last:border-b-0"
                  style={{ borderColor: 'var(--border)' }}
                >
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-xs font-semibold" style={{ color: 'var(--foreground)' }}>
                      {EVENT_LABELS[n.event] ?? n.event}
                    </p>
                    <p className="truncate text-xs" style={{ color: 'var(--foreground-muted)' }}>
                      {n.subject ?? n.body ?? ''}
                    </p>
                    <p className="mt-0.5 text-[10px]" style={{ color: 'var(--foreground-muted)' }}>
                      {new Date(n.createdAt).toLocaleString('en-IN')}
                    </p>
                  </div>
                  {n.status !== 'READ' && (
                    <button
                      onClick={() => markRead([n.id])}
                      className="shrink-0 text-[10px] font-medium opacity-0 group-hover:opacity-100"
                      style={{ color: 'var(--accent)' }}
                    >
                      Mark read
                    </button>
                  )}
                </div>
              ))}
          </div>
        </div>
      )}
    </div>
  );
}
