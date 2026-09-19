/**
 * Shift Change Notifications — employees see notifications when their
 * shift changes (via manual override, shift change request approval, or
 * bulk upload). Unread notifications are highlighted.
 *
 * UI pass (2026-09): unread/all filter, grouped by date, "from → to" shift
 * chips, relative timestamps. Endpoints unchanged.
 */

'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { PageHeader, StatusBadge, SectionCard, Tabs, Button, EmptyState, KPICard, KPIGrid, useToast } from '@/components/ui';

interface ShiftChangeNotification {
  id: number;
  date: string;
  reason: string | null;
  isRead: boolean;
  createdAt: string;
  oldShiftMaster: { id: number; code: string; startTime: string; endTime: string } | null;
  newShiftMaster: { id: number; code: string; startTime: string; endTime: string };
}

type Filter = 'unread' | 'all';

function relativeTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.round(diff / 60000);
  if (m < 1) return 'just now';
  if (m < 60) return `${m}m ago`;
  const h = Math.round(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.round(h / 24);
  if (d < 7) return `${d}d ago`;
  return new Date(iso).toLocaleDateString();
}

const BellIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
    <path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9" />
    <path d="M10.3 21a1.94 1.94 0 0 0 3.4 0" />
  </svg>
);

export default function ShiftChangeNotificationsPage() {
  const toast = useToast();
  const [notifications, setNotifications] = useState<ShiftChangeNotification[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<Filter>('unread');

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/workforce/shift-change-notifications');
      if (!res.ok) throw new Error('Failed to fetch');
      const json = await res.json();
      setNotifications(json.data ?? []);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const markAllRead = async () => {
    try {
      await fetch('/api/workforce/shift-change-notifications', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ all: true }),
      });
      fetchData();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed');
    }
  };

  const markRead = async (id: number) => {
    try {
      await fetch('/api/workforce/shift-change-notifications', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ids: [id] }),
      });
      fetchData();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed');
    }
  };

  const unreadCount = useMemo(() => notifications.filter((n) => !n.isRead).length, [notifications]);
  const upcoming = useMemo(() => notifications.filter((n) => new Date(n.date) >= new Date(new Date().toISOString().slice(0, 10))).length, [notifications]);
  const visible = useMemo(() => (filter === 'unread' ? notifications.filter((n) => !n.isRead) : notifications), [notifications, filter]);

  // Group by the shift date (not the created time) so the list reads like a schedule.
  const groups = useMemo(() => {
    const m = new Map<string, ShiftChangeNotification[]>();
    for (const n of visible) {
      const k = n.date.slice(0, 10);
      if (!m.has(k)) m.set(k, []);
      m.get(k)!.push(n);
    }
    return Array.from(m.entries()).sort((a, b) => (a[0] < b[0] ? 1 : -1));
  }, [visible]);

  return (
    <div className="space-y-4">
      <PageHeader
        eyebrow="Time Office"
        title="Shift Change Notifications"
        description="You’ll be notified here whenever your shift is changed — via manual override, shift change request approval, or bulk shift upload."
        actions={unreadCount > 0 ? <Button onClick={markAllRead}>Mark all as read</Button> : undefined}
      />

      <KPIGrid columns={3}>
        <KPICard label="Unread" value={unreadCount} tone={unreadCount > 0 ? 'danger' : 'success'} icon={<BellIcon />} />
        <KPICard label="Upcoming Changes" value={upcoming} subtitle="shift dates from today" tone="info" />
        <KPICard label="Total Notifications" value={notifications.length} tone="info" />
      </KPIGrid>

      <SectionCard
        title="Notifications"
        count={loading ? undefined : visible.length}
        actions={
          <Tabs<Filter>
            variant="segmented"
            tabs={[{ key: 'unread', label: 'Unread', count: unreadCount }, { key: 'all', label: 'All', count: notifications.length }]}
            active={filter}
            onChange={setFilter}
          />
        }
        flush
      >
        {loading ? (
          <div className="px-4 py-10 text-center text-sm" style={{ color: 'var(--foreground-muted)' }}>Loading…</div>
        ) : visible.length === 0 ? (
          <EmptyState
            icon={<BellIcon />}
            title={filter === 'unread' ? 'You’re all caught up' : 'No shift change notifications'}
            description={filter === 'unread' && notifications.length > 0 ? 'Switch to “All” to see earlier notifications.' : undefined}
          />
        ) : (
          <div className="divide-y" style={{ borderColor: 'var(--border)' }}>
            {groups.map(([dateKey, items]) => {
              const d = new Date(dateKey);
              return (
                <div key={dateKey} className="px-4 py-3" style={{ borderColor: 'var(--border)' }}>
                  <div className="mb-2 flex items-center gap-2 text-xs font-semibold" style={{ color: 'var(--foreground-muted)' }}>
                    <span className="uppercase tracking-wide">{d.toLocaleDateString(undefined, { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}</span>
                    <span className="h-px flex-1" style={{ backgroundColor: 'var(--border)' }} />
                  </div>
                  <ul className="space-y-2">
                    {items.map((n) => (
                      <li
                        key={n.id}
                        role={n.isRead ? undefined : 'button'}
                        tabIndex={n.isRead ? -1 : 0}
                        onClick={() => !n.isRead && markRead(n.id)}
                        onKeyDown={(e) => { if (!n.isRead && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); markRead(n.id); } }}
                        className={`flex flex-col gap-2 rounded-lg border px-3 py-2.5 transition sm:flex-row sm:items-center sm:justify-between ${n.isRead ? '' : 'cursor-pointer hover:shadow-sm'}`}
                        style={{
                          borderColor: n.isRead ? 'var(--border)' : 'var(--info)',
                          backgroundColor: n.isRead ? 'var(--surface)' : 'var(--info-soft)',
                        }}
                      >
                        <div className="flex min-w-0 items-center gap-3">
                          <span className="h-2 w-2 shrink-0 rounded-full" style={{ backgroundColor: n.isRead ? 'transparent' : 'var(--info)' }} aria-hidden />
                          <div className="flex flex-wrap items-center gap-2">
                            {n.oldShiftMaster ? (
                              <StatusBadge tone="neutral" title={`${n.oldShiftMaster.startTime}–${n.oldShiftMaster.endTime}`}>{n.oldShiftMaster.code}</StatusBadge>
                            ) : (
                              <StatusBadge tone="neutral">Rotation</StatusBadge>
                            )}
                            <span style={{ color: 'var(--foreground-muted)' }} aria-hidden>
                              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12h14M13 6l6 6-6 6" /></svg>
                            </span>
                            <StatusBadge tone="accent" size="sm">
                              {n.newShiftMaster.code}
                              <span className="opacity-70 tabular-nums">{n.newShiftMaster.startTime}–{n.newShiftMaster.endTime}</span>
                            </StatusBadge>
                            {n.reason && <span className="text-xs" style={{ color: 'var(--foreground-muted)' }}>· {n.reason}</span>}
                          </div>
                        </div>
                        <div className="flex items-center gap-2 pl-5 sm:pl-0">
                          <span className="text-[11px]" title={new Date(n.createdAt).toLocaleString()} style={{ color: 'var(--foreground-muted)' }}>{relativeTime(n.createdAt)}</span>
                          {!n.isRead && <StatusBadge tone="info">New</StatusBadge>}
                        </div>
                      </li>
                    ))}
                  </ul>
                </div>
              );
            })}
          </div>
        )}
      </SectionCard>
    </div>
  );
}
