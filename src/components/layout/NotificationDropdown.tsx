'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import Icon from './NavIcons';

/** A row from /api/platform/notification/inbox (NotificationInApp). */
interface Notification {
  id: number;
  eventCode: string;
  title: string;
  body: string | null;
  linkPath: string | null;
  isRead: boolean;
  createdAt: string;
}

const PAGE_SIZE = 10;
/** How often the bell re-checks the inbox without a page reload. */
const POLL_MS = 60_000;

// Only the codes whose raw form reads badly. Anything unmapped falls back to
// a title-cased version of the code, so a newly added event still renders
// sensibly without a deploy.
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
  ANNOUNCEMENT_PUBLISHED: 'Announcement',
  LEAVE_CONFLICT: 'Punch on leave day',
  LEAVE_CONFLICT_RESOLVED: 'Leave day reviewed',
};

function eventLabel(code: string): string {
  return EVENT_LABELS[code] ?? code.toLowerCase().split('_').map((w) => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
}

/**
 * Where a notification takes the reader. The event's own linkPath (set by
 * the module that raised it) wins; otherwise the module is inferred from
 * the event code so an older row without a link still lands somewhere
 * useful: a SUBMITTED event goes to the approver's queue, an outcome event
 * to the employee's own page.
 */
const MODULE_ROUTES: Record<string, { queue: string; mine: string }> = {
  LEAVE: { queue: '/approvals/workforce/leave', mine: '/ess/leave' },
  PERMISSION: { queue: '/approvals/workforce/permission', mine: '/ess/permission' },
  MISPUNCH: { queue: '/approvals/workforce/mispunch', mine: '/ess/mis-punch' },
  OT: { queue: '/approvals/workforce/overtime', mine: '/ess/ot-request' },
  COMP_OFF: { queue: '/workforce/comp-off-request', mine: '/ess/comp-off' },
  SHIFT_CHANGE: { queue: '/workforce/shift-change-request', mine: '/ess/shift-change' },
  WFH: { queue: '/approvals/workforce/wfh', mine: '/ess/wfh' },
  ON_DUTY: { queue: '/approvals/workforce/on-duty', mine: '/ess/on-duty' },
  VISITOR_PASS: { queue: '/ess/visitor-approval', mine: '/ess/visitor-request' },
  VISITOR: { queue: '/ess/visitor-approval', mine: '/ess/visitor-request' },
  ANNOUNCEMENT: { queue: '/ess/announcements', mine: '/ess/announcements' },
  PAYSLIP: { queue: '/ess/payslip', mine: '/ess/payslip' },
};

export function routeFor(n: Pick<Notification, 'eventCode' | 'linkPath'>): string | null {
  if (n.linkPath) return n.linkPath;
  const match = Object.keys(MODULE_ROUTES)
    .sort((a, b) => b.length - a.length)
    .find((k) => n.eventCode.startsWith(`${k}_`));
  if (!match) return null;
  const action = n.eventCode.slice(match.length + 1);
  return action === 'SUBMITTED' || action === 'CONFLICT' ? MODULE_ROUTES[match].queue : MODULE_ROUTES[match].mine;
}

export default function NotificationDropdown() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const ref = useRef<HTMLDivElement>(null);

  const fetchNotifications = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    setError(null);
    try {
      // The platform inbox — every module's notifications (announcements,
      // approvals awaiting the reader, outcomes on their own requests).
      const res = await fetch(`/api/platform/notification/inbox?unread=true&limit=${PAGE_SIZE}`);
      if (!res.ok) {
        setNotifications([]);
        setTotal(0);
      } else {
        const json = await res.json();
        setNotifications(json.data ?? []);
        setTotal(json.unreadCount ?? 0);
      }
    } catch (err) {
      if (!silent) setError(err instanceof Error ? err.message : 'Failed to load');
    } finally {
      if (!silent) setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchNotifications();

    // Keep the bell live: a poll while the tab is visible, and a refresh the
    // moment the reader comes back to it.
    const timer = setInterval(() => {
      if (document.visibilityState === 'visible') fetchNotifications(true);
    }, POLL_MS);
    const onVisible = () => {
      if (document.visibilityState === 'visible') fetchNotifications(true);
    };
    document.addEventListener('visibilitychange', onVisible);

    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClick);
    return () => {
      clearInterval(timer);
      document.removeEventListener('visibilitychange', onVisible);
      document.removeEventListener('mousedown', handleClick);
    };
  }, [fetchNotifications]);

  const markRead = async (id: number) => {
    const res = await fetch(`/api/platform/notification/inbox/${id}/read`, { method: 'POST' });
    if (!res.ok) return;
    fetchNotifications(true);
  };

  const markAllRead = async () => {
    const res = await fetch('/api/platform/notification/inbox/read-all', { method: 'POST' });
    if (!res.ok) return;
    fetchNotifications(true);
  };

  /** Open the module the notification is about, marking it read on the way. */
  const openNotification = async (n: Notification) => {
    const target = routeFor(n);
    setOpen(false);
    if (!n.isRead) {
      // Optimistic: drop it from the list and the count now, confirm in the background.
      setNotifications((prev) => prev.filter((x) => x.id !== n.id));
      setTotal((t) => Math.max(0, t - 1));
      void fetch(`/api/platform/notification/inbox/${n.id}/read`, { method: 'POST' }).catch(() => {});
    }
    if (target) router.push(target);
  };

  const countText = total > 99 ? '99+' : total > 0 ? String(total) : null;
  const hasUnread = total > 0;

  return (
    <div ref={ref} className="relative hidden sm:block">
      <button
        type="button"
        aria-label={hasUnread ? `Notifications, ${total} unread` : 'Notifications'}
        onClick={() => setOpen((v) => !v)}
        className="relative grid h-11 w-11 place-items-center rounded-full border transition hover:bg-[color:var(--surface-hover)]"
        style={{ borderColor: hasUnread ? 'var(--danger)' : 'var(--border)', color: hasUnread ? 'var(--foreground)' : 'var(--foreground-muted)' }}
      >
        <span className={hasUnread ? 'bell-ringing inline-flex' : 'inline-flex'}>
          <Icon name="bell" size={18} />
        </span>
        {countText && (
          <span
            className="bell-badge-live absolute -right-0.5 -top-0.5 grid h-5 min-w-5 place-items-center rounded-full px-1.5 text-[10px] font-bold ring-2"
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
              notifications.map((n) => {
                const target = routeFor(n);
                return (
                  <div
                    key={n.id}
                    className="group flex items-start justify-between gap-2 border-b px-3 py-2 last:border-b-0"
                    style={{ borderColor: 'var(--border)' }}
                  >
                    <button
                      type="button"
                      onClick={() => openNotification(n)}
                      className="min-w-0 flex-1 rounded-md text-left transition hover:bg-[color:var(--surface-hover)]"
                      title={target ? `Open ${target}` : undefined}
                    >
                      <p className="truncate text-xs font-semibold" style={{ color: 'var(--foreground)' }}>
                        {eventLabel(n.eventCode)}
                        {target && <span className="ml-1 font-normal" style={{ color: 'var(--accent)' }}>›</span>}
                      </p>
                      <p className="truncate text-xs" style={{ color: 'var(--foreground-muted)' }}>
                        {n.title ?? n.body ?? ''}
                      </p>
                      <p className="mt-0.5 text-[10px]" style={{ color: 'var(--foreground-muted)' }}>
                        {new Date(n.createdAt).toLocaleString('en-IN')}
                      </p>
                    </button>
                    {!n.isRead && (
                      <button
                        onClick={() => markRead(n.id)}
                        className="shrink-0 text-[10px] font-medium opacity-0 group-hover:opacity-100"
                        style={{ color: 'var(--accent)' }}
                      >
                        Mark read
                      </button>
                    )}
                  </div>
                );
              })}
          </div>
        </div>
      )}
    </div>
  );
}
