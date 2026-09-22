/**
 * Employee Self Service — Announcements & Circulars.
 *
 * KUN MoM 23/June/2025: policy updates and internal circulars on the employee
 * portal. Opening an item records a read receipt, which is what lets HR show
 * who has actually seen a policy update.
 */

'use client';

import { Suspense, useState, useEffect, useCallback } from 'react';
import { useSearchParams } from 'next/navigation';
import { useToast } from '@/components/ui';

interface Announcement {
  id: number;
  title: string;
  body: string;
  category: string;
  priority: string;
  publishedAt: string | null;
  expiresAt: string | null;
  readAt: string | null;
}

const CATEGORY_TONE: Record<string, { bg: string; fg: string }> = {
  POLICY: { bg: '#dbeafe', fg: '#1e40af' },
  CIRCULAR: { bg: '#fef3c7', fg: '#92400e' },
  GENERAL: { bg: '#f1f5f9', fg: '#475569' },
};

function fullDate(iso: string | null) {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
}

function AnnouncementsList() {
  const toast = useToast();
  const searchParams = useSearchParams();
  // Deep link from the notification bell: /ess/announcements?id=12
  const linkedId = Number(searchParams.get('id')) || null;

  const [items, setItems] = useState<Announcement[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  // False for a login with no Employee row (HR/admin) — they read, but there is
  // nobody to attribute a read receipt to.
  const [canMarkRead, setCanMarkRead] = useState(true);
  const [openId, setOpenId] = useState<number | null>(linkedId);
  const [loading, setLoading] = useState(true);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/workforce/my-announcements');
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        throw new Error(j.error ?? 'Failed to load announcements');
      }
      const json = await res.json();
      setItems(json.data ?? []);
      setUnreadCount(json.unreadCount ?? 0);
      setCanMarkRead(json.canMarkRead !== false);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to load announcements');
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    void fetchData();
  }, [fetchData]);

  /**
   * Opening an unread item posts the receipt and updates this row locally —
   * no full refetch, so the list does not jump under the reader's cursor.
   */
  const open = useCallback(async (item: Announcement) => {
    const next = openId === item.id ? null : item.id;
    setOpenId(next);
    if (next === null || item.readAt || !canMarkRead) return;

    const res = await fetch(`/api/workforce/my-announcements/${item.id}/read`, { method: 'POST' });
    if (!res.ok) return;
    const json = await res.json();
    setItems((prev) => prev.map((a) => (a.id === item.id ? { ...a, readAt: json.readAt } : a)));
    setUnreadCount((n) => Math.max(0, n - 1));
  }, [openId, canMarkRead]);

  // A deep-linked item should count as read even though the user never clicked
  // its header — they arrived on it directly from the bell.
  useEffect(() => {
    if (!linkedId || loading) return;
    const target = items.find((a) => a.id === linkedId);
    if (target && !target.readAt) void open(target);
    // Intentionally runs only once per load of a deep link.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [linkedId, loading]);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h1 className="text-xl font-semibold" style={{ color: 'var(--foreground)' }}>
          Announcements &amp; Circulars
        </h1>
        {unreadCount > 0 && (
          <span
            className="rounded-full px-3 py-1 text-xs font-semibold"
            style={{ background: 'var(--info-soft)', color: 'var(--info)' }}
          >
            {unreadCount} unread
          </span>
        )}
      </div>

      {!loading && !canMarkRead && (
        <div
          className="rounded-lg border p-3 text-sm"
          style={{ borderColor: 'var(--border)', color: 'var(--foreground-muted)' }}
        >
          This login has no employee record, so your reading is not recorded against the read receipts.
        </div>
      )}

      {loading ? (
        <div className="text-sm" style={{ color: 'var(--foreground-muted)' }}>Loading…</div>
      ) : items.length === 0 ? (
        <div
          className="rounded-lg border p-6 text-center text-sm"
          style={{ borderColor: 'var(--border)', color: 'var(--foreground-muted)' }}
        >
          No announcements have been published yet.
        </div>
      ) : (
        <div className="space-y-3">
          {items.map((a) => {
            const tone = CATEGORY_TONE[a.category] ?? CATEGORY_TONE.GENERAL;
            const isOpen = openId === a.id;
            return (
              <div
                key={a.id}
                className="rounded-lg border"
                style={{
                  borderColor: a.priority === 'IMPORTANT' ? 'var(--warning, #d97706)' : 'var(--border)',
                }}
              >
                <button
                  type="button"
                  onClick={() => void open(a)}
                  className="flex w-full flex-wrap items-center gap-2 px-4 py-3 text-left"
                >
                  {/* Unread marker — the dot is the only cue on a narrow screen,
                      so it comes first rather than trailing the row. */}
                  <span
                    className="h-2 w-2 shrink-0 rounded-full"
                    style={{ background: !canMarkRead || a.readAt ? 'transparent' : 'var(--info)' }}
                  />
                  <span
                    className="text-sm font-semibold"
                    style={{ color: 'var(--foreground)' }}
                  >
                    {a.title}
                  </span>
                  <span
                    className="rounded-full px-2 py-0.5 text-[11px] font-medium"
                    style={{ backgroundColor: tone.bg, color: tone.fg }}
                  >
                    {a.category}
                  </span>
                  {a.priority === 'IMPORTANT' && (
                    <span
                      className="rounded-full px-2 py-0.5 text-[11px] font-semibold"
                      style={{ backgroundColor: '#fee2e2', color: '#b91c1c' }}
                    >
                      IMPORTANT
                    </span>
                  )}
                  <span className="ml-auto text-xs" style={{ color: 'var(--foreground-muted)' }}>
                    {fullDate(a.publishedAt)}
                  </span>
                </button>

                {isOpen && (
                  <div className="border-t px-4 py-3" style={{ borderColor: 'var(--border)' }}>
                    <p
                      className="whitespace-pre-wrap text-sm"
                      style={{ color: 'var(--foreground)' }}
                    >
                      {a.body}
                    </p>
                    {a.expiresAt && (
                      <p className="mt-3 text-xs" style={{ color: 'var(--foreground-muted)' }}>
                        Valid until {fullDate(a.expiresAt)}
                      </p>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

/**
 * useSearchParams forces client-side rendering up to the nearest Suspense
 * boundary, and a production build of a static page fails outright without
 * one — dev renders on demand, so the error only shows up at build time.
 */
export default function EssAnnouncementsPage() {
  return (
    <Suspense
      fallback={<div className="text-sm" style={{ color: 'var(--foreground-muted)' }}>Loading…</div>}
    >
      <AnnouncementsList />
    </Suspense>
  );
}
