"use client";

import { useCallback, useEffect, useRef, useState } from "react";

interface UnreadAnnouncement {
  id: number;
  title: string;
  body: string;
  category: string;
  priority: string;
  publishedAt: string | null;
  expiresAt: string | null;
}

/**
 * Scroll-with-checkmark illustration matching the announcement-card style:
 * a parchment scroll peeking out of a rounded tray, a tick badge on the top
 * corner, and a sprinkle of sparkles around it. Inline SVG keeps it theme-
 * independent and needs no asset pipeline.
 */
function ScrollIllustration() {
  return (
    <svg viewBox="0 0 200 160" className="mx-auto h-32 w-40" aria-hidden="true">
      {/* sparkles */}
      <g fill="#f5c243">
        <path d="M30 24l3 7 7 3-7 3-3 7-3-7-7-3 7-3z" />
        <path d="M170 30l2.4 5.6L178 38l-5.6 2.4L170 46l-2.4-5.6L162 38l5.6-2.4z" />
        <path d="M178 96l2 4.6 4.6 2-4.6 2-2 4.6-2-4.6-4.6-2 4.6-2z" />
        <path d="M20 118l2 4.6 4.6 2-4.6 2-2 4.6-2-4.6-4.6-2 4.6-2z" />
      </g>
      <g fill="#fbd9c0">
        <circle cx="52" cy="40" r="4" />
        <circle cx="188" cy="60" r="4" />
        <circle cx="12" cy="64" r="3" />
      </g>

      {/* scroll body */}
      <rect x="58" y="28" width="92" height="86" rx="6" fill="#f9dfb2" />
      <rect x="58" y="28" width="92" height="86" rx="6" fill="none" stroke="#eec98d" strokeWidth="2" />
      {/* rolled edge */}
      <path d="M150 28c10 0 14 6 14 12s-4 12-14 12z" fill="#f3cf97" stroke="#eec98d" strokeWidth="2" />
      {/* text lines */}
      <g stroke="#b99a67" strokeWidth="3" strokeLinecap="round">
        <line x1="72" y1="46" x2="128" y2="46" />
        <line x1="72" y1="58" x2="136" y2="58" />
        <line x1="72" y1="70" x2="136" y2="70" />
        <line x1="72" y1="82" x2="124" y2="82" />
        <line x1="72" y1="94" x2="110" y2="94" />
      </g>

      {/* tray */}
      <path d="M62 104h76a8 8 0 018 8v8a14 14 0 01-14 14H68a14 14 0 01-14-14v-8a8 8 0 018-8z" fill="#ffcf8f" stroke="#f0b56e" strokeWidth="2" />
      {/* tray face */}
      <circle cx="92" cy="122" r="3" fill="#4b3a2a" />
      <circle cx="108" cy="122" r="3" fill="#4b3a2a" />
      <path d="M94 128q6 5 12 0" fill="none" stroke="#4b3a2a" strokeWidth="2.5" strokeLinecap="round" />
      <path d="M78 121q-4 2-4 5" stroke="#f2a97e" strokeWidth="2.5" fill="none" strokeLinecap="round" />
      <path d="M122 121q4 2 4 5" stroke="#f2a97e" strokeWidth="2.5" fill="none" strokeLinecap="round" />

      {/* check badge */}
      <circle cx="90" cy="26" r="16" fill="#f5b01f" stroke="#fff" strokeWidth="3" />
      <path d="M82 26.5l5.5 5.5L98.5 21" fill="none" stroke="#fff" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

/**
 * AnnouncementPopup — celebratory unread-announcement card shown on the ESS
 * dashboard. Fetches the employee's announcements, surfaces the unread ones
 * one card at a time, and posts a read receipt when the employee confirms.
 * Nothing renders when there is nothing unread, so the dashboard is
 * untouched for a caught-up employee.
 */
export function AnnouncementPopup() {
  const [queue, setQueue] = useState<UnreadAnnouncement[]>([]);
  const [index, setIndex] = useState(0);
  const [busy, setBusy] = useState(false);
  const startedRef = useRef(false);

  useEffect(() => {
    if (startedRef.current) return;
    startedRef.current = true;
    void (async () => {
      try {
        const res = await fetch("/api/workforce/my-announcements");
        if (!res.ok) return;
        const json = await res.json();
        const unread = (json.data ?? []).filter(
          (a: UnreadAnnouncement & { readAt: string | null }) => a.readAt === null
        );
        if (json.canMarkRead !== false && unread.length > 0) setQueue(unread);
      } catch {
        // A silent miss is fine — the announcements page still shows the list.
      }
    })();
  }, []);

  const current = queue[index];

  const confirm = useCallback(async () => {
    if (!current || busy) return;
    setBusy(true);
    try {
      await fetch(`/api/workforce/my-announcements/${current.id}/read`, { method: "POST" });
    } finally {
      setBusy(false);
      setIndex((i) => i + 1);
    }
  }, [current, busy]);

  if (!current) return null;

  const isLast = index === queue.length - 1;

  return (
    <div
      className="fixed inset-0 z-[80] flex items-center justify-center p-4 backdrop-blur-sm"
      style={{ background: "rgba(120, 72, 10, 0.42)" }}
      role="dialog"
      aria-modal="true"
      aria-label={`Announcement: ${current.title}`}
    >
      <div
        className="w-full max-w-sm rounded-[28px] bg-white px-8 pb-9 pt-10 text-center shadow-[0_30px_60px_-15px_rgba(120,60,0,0.45)]"
        style={{ animation: "announcement-pop .35s ease-out" }}
      >
        <ScrollIllustration />

        <h2 className="mt-5 text-3xl font-extrabold tracking-tight" style={{ color: "#e79a1d" }}>
          {current.title}
        </h2>

        <p className="mt-3 whitespace-pre-wrap text-[15px] leading-relaxed text-slate-700">
          {current.body}
        </p>

        {queue.length > 1 && (
          <p className="mt-3 text-xs font-medium text-slate-400">
            {index + 1} of {queue.length}
          </p>
        )}

        <button
          type="button"
          onClick={confirm}
          disabled={busy}
          className="mt-7 w-full rounded-full py-3.5 text-base font-bold text-white transition-transform active:scale-[0.98] disabled:opacity-70"
          style={{ background: "linear-gradient(180deg, #f6b04e 0%, #eda03a 100%)", boxShadow: "0 10px 22px -8px rgba(237,160,58,0.8)" }}
        >
          {busy ? "…" : isLast ? "Confirm" : "Next"}
        </button>
      </div>

      <style jsx global>{`
        @keyframes announcement-pop {
          from { opacity: 0; transform: scale(0.92) translateY(12px); }
          to { opacity: 1; transform: scale(1) translateY(0); }
        }
      `}</style>
    </div>
  );
}
