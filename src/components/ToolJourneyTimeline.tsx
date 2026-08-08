"use client";

import { useEffect, useMemo, useState } from "react";
import {
  ArrowDownLeft,
  ArrowUpRight,
  CalendarClock,
  ChevronDown,
  ChevronRight,
  FileText,
  Gauge,
  Orbit,
  Package,
  ShoppingCart,
} from "lucide-react";
import { TableSkeleton } from "@/app/dashboard/components/LoadingSkeleton";
import { apiGet } from "@/lib/apiClient";
import type { JourneyEventType, ToolJourneyEvent, ToolJourneyResponse } from "@/lib/toolJourney";

const FILTERS: { type: JourneyEventType; label: string }[] = [
  { type: "purchase", label: "Purchase" },
  { type: "grn", label: "GRN" },
  { type: "issue", label: "Issue" },
  { type: "receive", label: "Receive" },
  { type: "calibration", label: "Calibration" },
  { type: "status", label: "Status" },
];

const TYPE_STYLE: Record<
  JourneyEventType,
  { icon: typeof Orbit; chip: string; rail: string }
> = {
  purchase: {
    icon: ShoppingCart,
    chip: "bg-violet-50 text-violet-700 dark:bg-violet-950/40 dark:text-violet-300",
    rail: "bg-violet-500",
  },
  grn: {
    icon: Package,
    chip: "bg-sky-50 text-sky-700 dark:bg-sky-950/40 dark:text-sky-300",
    rail: "bg-sky-500",
  },
  issue: {
    icon: ArrowUpRight,
    chip: "bg-blue-50 text-blue-700 dark:bg-blue-950/40 dark:text-blue-300",
    rail: "bg-[var(--primary)]",
  },
  receive: {
    icon: ArrowDownLeft,
    chip: "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300",
    rail: "bg-emerald-500",
  },
  calibration: {
    icon: CalendarClock,
    chip: "bg-amber-50 text-amber-800 dark:bg-amber-950/40 dark:text-amber-300",
    rail: "bg-amber-500",
  },
  status: {
    icon: Gauge,
    chip: "bg-[var(--bg-subtle)] text-[var(--text-secondary)]",
    rail: "bg-[var(--text-muted)]",
  },
};

function fmtDate(iso: string) {
  if (!iso) return "—";
  return iso.includes("T") ? iso.slice(0, 10) : iso.slice(0, 10);
}

function JourneyEventRow({ event }: { event: ToolJourneyEvent }) {
  const [open, setOpen] = useState(false);
  const style = TYPE_STYLE[event.type];
  const Icon = style.icon;
  const metaEntries = Object.entries(event.meta).filter(
    ([, v]) => v != null && v !== ""
  );

  return (
    <li className="relative pl-10 pb-5 last:pb-1">
      <span
        className="absolute left-[11px] top-7 bottom-0 w-px bg-[var(--border-main)]"
        aria-hidden
      />
      <span
        className={`absolute left-0 top-1.5 z-[1] flex h-6 w-6 items-center justify-center rounded-full ${style.rail} text-white shadow-sm`}
      >
        <Icon className="h-3 w-3" />
      </span>

      <div className="rounded-[12px] border-[0.5px] border-[var(--border-main)] bg-[var(--bg-subtle)]/50 hover:bg-[var(--bg-hover)] transition-colors">
        <button
          type="button"
          onClick={() => setOpen((o) => !o)}
          className="w-full text-left px-3.5 py-3 flex items-start gap-3"
        >
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2 mb-1">
              <span
                className={`inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-bold uppercase tracking-wider ${style.chip}`}
              >
                {event.type}
              </span>
              <span className="font-mono text-[11px] text-[var(--text-muted)] tabular-nums">
                {fmtDate(event.date)}
              </span>
              {event.serialNo && (
                <span className="font-mono text-[10px] text-[var(--text-muted)]">
                  S/N {event.serialNo}
                </span>
              )}
            </div>
            <p className="text-sm font-semibold text-[var(--text-primary)] leading-snug">
              {event.title}
            </p>
            {event.subtitle && (
              <p className="text-xs text-[var(--text-secondary)] mt-0.5 leading-snug">
                {event.subtitle}
              </p>
            )}
          </div>
          <span className="shrink-0 mt-0.5 text-[var(--text-muted)]" aria-hidden>
            {open ? (
              <ChevronDown className="h-4 w-4" />
            ) : (
              <ChevronRight className="h-4 w-4" />
            )}
          </span>
        </button>

        {open && metaEntries.length > 0 && (
          <div className="px-3.5 pb-3 pt-0 border-t-[0.5px] border-[var(--border-main)]">
            <dl className="mt-2.5 grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-1.5">
              {metaEntries.map(([k, v]) => (
                <div key={k} className="min-w-0 flex gap-2 text-xs">
                  <dt className="text-[var(--text-muted)] shrink-0 capitalize">
                    {k.replace(/([A-Z])/g, " $1")}
                  </dt>
                  <dd className="font-mono text-[var(--text-primary)] truncate">
                    {String(v)}
                  </dd>
                </div>
              ))}
            </dl>
          </div>
        )}
      </div>
    </li>
  );
}

export default function ToolJourneyTimeline({
  toolOrGaugeNo,
  refNo,
}: {
  toolOrGaugeNo: string;
  refNo?: number;
}) {
  const [data, setData] = useState<ToolJourneyResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [enabled, setEnabled] = useState<Record<JourneyEventType, boolean>>({
    purchase: true,
    grn: true,
    issue: true,
    receive: true,
    calibration: true,
    status: true,
  });
  const [serialFilter, setSerialFilter] = useState<string>("ALL");

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError("");
    setData(null);
    setSerialFilter("ALL");
    void (async () => {
      const qs = refNo != null ? `?refNo=${refNo}` : "";
      const res = await apiGet<ToolJourneyResponse>(
        `/api/tools-history/${encodeURIComponent(toolOrGaugeNo)}/journey${qs}`
      );
      if (cancelled) return;
      if (res.error) {
        setError(res.error.message);
        setLoading(false);
        return;
      }
      setData(res.data ?? null);
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [toolOrGaugeNo, refNo]);

  const filtered = useMemo(() => {
    const events = data?.events ?? [];
    return events.filter((e) => {
      if (!enabled[e.type]) return false;
      if (serialFilter === "ALL") return true;
      if (!e.serialNo) return true; // keep tool-level events when filtering a serial
      return String(e.serialNo) === serialFilter;
    });
  }, [data?.events, enabled, serialFilter]);

  const toggle = (type: JourneyEventType) => {
    setEnabled((prev) => ({ ...prev, [type]: !prev[type] }));
  };

  if (loading) {
    return (
      <div className="space-y-3">
        <div className="flex items-center gap-2 text-xs text-[var(--text-muted)]">
          <Orbit className="h-3.5 w-3.5 animate-spin" />
          Loading 360° journey…
        </div>
        <TableSkeleton rows={5} />
      </div>
    );
  }

  if (error) {
    return (
      <p className="text-xs font-semibold text-[var(--color-danger-text)] py-6 text-center">
        {error}
      </p>
    );
  }

  if (!data || data.events.length === 0) {
    return (
      <div className="py-12 text-center">
        <FileText className="w-9 h-9 text-[var(--text-muted)] mx-auto mb-3 opacity-50" />
        <p className="text-sm font-semibold text-[var(--text-primary)]">No journey events yet</p>
        <p className="text-xs text-[var(--text-muted)] mt-1 max-w-sm mx-auto">
          PO, GRN, issue, receive, calibration, and status history will appear here as transactions
          are recorded for this tool.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        {FILTERS.map(({ type, label }) => {
          const count = data.counts[type] ?? 0;
          // Always show Purchase + GRN so those flows stay discoverable even at 0
          const alwaysShow = type === "purchase" || type === "grn";
          if (!alwaysShow && count === 0) return null;
          const on = enabled[type];
          return (
            <label
              key={type}
              className={`inline-flex items-center gap-1.5 h-7 px-2.5 rounded-full border-[0.5px] text-[11px] font-semibold cursor-pointer select-none transition-colors ${
                on
                  ? "border-[var(--primary)] bg-[var(--primary-light)]/60 text-[var(--primary)]"
                  : "border-[var(--border-main)] bg-[var(--bg-subtle)] text-[var(--text-muted)]"
              }`}
            >
              <input
                type="checkbox"
                className="sr-only"
                checked={on}
                onChange={() => toggle(type)}
              />
              {label}
              <span className="font-mono tabular-nums opacity-80">{count}</span>
            </label>
          );
        })}

        {data.serials.length > 1 && (
          <select
            value={serialFilter}
            onChange={(e) => setSerialFilter(e.target.value)}
            className="h-7 text-[11px] font-semibold border-[0.5px] border-[var(--border-main)] rounded-full px-2.5 bg-[var(--bg-card)] text-[var(--text-secondary)] outline-none focus:ring-1 focus:ring-[var(--primary-subtle)]"
            title="Filter by physical unit serial"
          >
            <option value="ALL">All units</option>
            {data.serials.map((s) => (
              <option key={s} value={s}>
                S/N {s}
              </option>
            ))}
          </select>
        )}
      </div>

      {(data.counts.purchase === 0 || data.counts.grn === 0) && (
        <p className="text-[11px] text-[var(--text-muted)] rounded-[10px] border-[0.5px] border-dashed border-[var(--border-main)] bg-[var(--bg-subtle)]/80 px-3 py-2">
          {data.counts.purchase === 0 && data.counts.grn === 0
            ? "No Purchase Order or GRN lines linked to this tool yet (COMMON_PURCHASE_* / TOOLS_PO_RECEIVE). Check PO-linked Receive or GRN History for other tools."
            : data.counts.purchase === 0
              ? "No Purchase Order lines linked — GRN may still reference a PO number below."
              : "No GRN receipts linked — Purchase Order lines may still appear above."}
        </p>
      )}

      <p className="text-[11px] text-[var(--text-muted)]">
        Showing <span className="font-mono font-semibold text-[var(--text-secondary)]">{filtered.length}</span>{" "}
        of {data.events.length} events · newest first
      </p>

      {filtered.length === 0 ? (
        <p className="py-8 text-center text-xs text-[var(--text-muted)]">
          No events match the selected filters.
        </p>
      ) : (
        <ul className="relative max-h-[min(62vh,640px)] overflow-y-auto pr-1">
          {filtered.map((event) => (
            <JourneyEventRow key={event.sourceId} event={event} />
          ))}
        </ul>
      )}
    </div>
  );
}
