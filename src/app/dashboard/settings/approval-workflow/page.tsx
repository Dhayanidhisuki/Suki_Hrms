"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  Search,
  CheckCircle2,
  Clock,
  XCircle,
  Layers,
  ExternalLink,
} from "lucide-react";
import Sidebar from "@/app/dashboard/components/Sidebar";
import TopBar from "@/app/dashboard/components/TopBar";
import { ModuleKpiRow } from "@/app/dashboard/components/ModuleKpiRow";
import { apiGet, apiPut } from "@/lib/apiClient";
import { Button } from "@/components/ui/button";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { useSession } from "@/lib/SessionContext";
import { toastError, toastSuccess } from "@/lib/appToast";

type ApprovalSource =
  | "supplier"
  | "subcontractor"
  | "tool_pricing"
  | "purchase_approval"
  | "purchase_order";

type ApprovalStatus = "Approved" | "Pending" | "Rejected" | "Unknown";

type ApprovalItem = {
  id: string;
  source: ApprovalSource;
  sourceLabel: string;
  ref: string;
  title: string;
  status: ApprovalStatus;
  statusRaw: string;
  date: string | null;
  detail?: string;
  href?: string;
  actionable?: boolean;
  rate?: number | null;
  proposedRate?: number | null;
  rejectedReason?: string | null;
};

const SOURCES: { id: "all" | ApprovalSource; label: string }[] = [
  { id: "all", label: "All sources" },
  { id: "supplier", label: "Supplier" },
  { id: "subcontractor", label: "Subcontractor" },
  { id: "tool_pricing", label: "Tool pricing" },
  { id: "purchase_approval", label: "Purchase approval" },
  { id: "purchase_order", label: "Purchase order" },
];

const STATUSES: { id: "all" | ApprovalStatus; label: string }[] = [
  { id: "all", label: "All statuses" },
  { id: "Approved", label: "Approved" },
  { id: "Pending", label: "Pending" },
  { id: "Rejected", label: "Rejected" },
  { id: "Unknown", label: "Unknown" },
];

export default function ApprovalCentrePage() {
  const { can } = useSession();
  const canApprovePricing = can("canApprovePricing");

  const [items, setItems] = useState<ApprovalItem[]>([]);
  const [counts, setCounts] = useState({
    total: 0,
    approved: 0,
    pending: 0,
    rejected: 0,
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [warn, setWarn] = useState<string[] | null>(null);
  const [source, setSource] = useState<"all" | ApprovalSource>("all");
  const [status, setStatus] = useState<"all" | ApprovalStatus>("all");
  const [search, setSearch] = useState("");
  const [actingId, setActingId] = useState<string | null>(null);
  const [rejectTarget, setRejectTarget] = useState<ApprovalItem | null>(null);
  const [rejectReason, setRejectReason] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    const params = new URLSearchParams();
    if (source !== "all") params.set("source", source);
    if (status !== "all") params.set("status", status);
    if (search.trim()) params.set("search", search.trim());

    const res = await apiGet<{
      items: ApprovalItem[];
      counts: { total: number; approved: number; pending: number; rejected: number };
      errors?: string[];
      note?: string;
    }>(`/api/approvals?${params}`);

    if (res.error) {
      setError(typeof res.error.message === "string" ? res.error.message : "Failed to load approvals");
      setItems([]);
    } else {
      setItems(res.data?.items ?? []);
      setCounts(
        res.data?.counts ?? { total: 0, approved: 0, pending: 0, rejected: 0 }
      );
      setWarn(res.data?.errors ?? null);
    }
    setLoading(false);
  }, [source, status, search]);

  useEffect(() => {
    void load();
  }, [source, status]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleApprove = async (row: ApprovalItem) => {
    if (row.source !== "tool_pricing") return;
    const rowId = Number(row.ref);
    if (!Number.isFinite(rowId)) return;
    if (!confirm(`Approve proposed rate for ${row.title}?`)) return;
    setActingId(row.id);
    const res = await apiPut(`/api/pricing/${rowId}/approve`, {});
    setActingId(null);
    if (res.error) {
      toastError(res.error.message);
      return;
    }
    toastSuccess("Pricing approved — live RATE updated.");
    void load();
  };

  const submitReject = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!rejectTarget) return;
    const rowId = Number(rejectTarget.ref);
    if (!Number.isFinite(rowId)) return;
    const reason = rejectReason.trim();
    if (!reason) {
      toastError("Rejection reason is required");
      return;
    }
    setActingId(rejectTarget.id);
    const res = await apiPut(`/api/pricing/${rowId}/reject`, { reason });
    setActingId(null);
    if (res.error) {
      toastError(res.error.message);
      return;
    }
    toastSuccess("Pricing rejected — live RATE unchanged.");
    setRejectTarget(null);
    setRejectReason("");
    void load();
  };

  const kpis = useMemo(
    () => [
      {
        id: "appr-total",
        label: "Fetched rows",
        value: counts.total,
        subtext: canApprovePricing
          ? "Pricing PENDING can be actioned"
          : "From ERP + Tools pricing",
        icon: Layers,
        iconBg: "bg-[var(--primary-light)]",
        iconColor: "text-[var(--primary)]",
        badge: {
          label: canApprovePricing ? "Pricing writable" : "Mostly read-only",
          type: "info" as const,
        },
      },
      {
        id: "appr-ok",
        label: "Approved",
        value: counts.approved,
        subtext: "Normalized status",
        icon: CheckCircle2,
        iconBg: "bg-emerald-50 dark:bg-emerald-950/40",
        iconColor: "text-emerald-600 dark:text-emerald-400",
        badge: { label: "OK", type: "success" as const },
      },
      {
        id: "appr-pend",
        label: "Pending",
        value: counts.pending,
        subtext: "Awaiting / blank flags",
        icon: Clock,
        iconBg: "bg-amber-50 dark:bg-amber-950/40",
        iconColor: "text-amber-600 dark:text-amber-400",
        badge: { label: "Pending", type: "warning" as const },
      },
      {
        id: "appr-rej",
        label: "Rejected",
        value: counts.rejected,
        subtext: "Rejected / No",
        icon: XCircle,
        iconBg: "bg-red-50 dark:bg-red-950/40",
        iconColor: "text-red-600 dark:text-red-400",
      },
    ],
    [counts, canApprovePricing]
  );

  return (
    <div className="flex h-screen bg-[var(--bg-app)] text-[var(--text-primary)] overflow-hidden">
      <Sidebar />
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        <TopBar />
        <main className="flex-1 overflow-y-auto px-7 py-6 space-y-5">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Approval Centre</h1>
            <p className="text-sm text-[var(--text-muted)] mt-0.5">
              Tool pricing PENDING rows can be approved/rejected here. Other sources remain ERP
              read-only.
            </p>
          </div>

          <ModuleKpiRow items={kpis} />

          <div className="bg-[var(--bg-card)] rounded-2xl border border-[var(--border-main)] p-5 space-y-4">
            <div className="flex flex-col lg:flex-row lg:items-end gap-3 flex-wrap">
              <div className="flex-1 min-w-[200px]">
                <label className="form-label">Search</label>
                <div className="relative">
                  <Search className="w-4 h-4 text-[var(--text-muted)] absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") void load();
                    }}
                    placeholder="Ref, title, source…"
                    className="form-control form-control-icon"
                  />
                </div>
              </div>
              <div className="min-w-[160px]">
                <label className="form-label">Source</label>
                <select
                  value={source}
                  onChange={(e) => setSource(e.target.value as typeof source)}
                  className="form-control"
                >
                  {SOURCES.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.label}
                    </option>
                  ))}
                </select>
              </div>
              <div className="min-w-[140px]">
                <label className="form-label">Status</label>
                <select
                  value={status}
                  onChange={(e) => setStatus(e.target.value as typeof status)}
                  className="form-control"
                >
                  {STATUSES.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.label}
                    </option>
                  ))}
                </select>
              </div>
              <Button type="button" variant="outline" onClick={() => void load()}>
                Apply
              </Button>
            </div>

            {error && (
              <p className="text-sm text-[var(--color-danger-text)] bg-[var(--color-danger-bg)] rounded-xl px-4 py-3">
                {error}
              </p>
            )}
            {warn && warn.length > 0 && (
              <p className="text-xs text-[var(--text-muted)] bg-[var(--bg-subtle)] rounded-xl px-4 py-3">
                Some sources failed: {warn.join(" · ")}
              </p>
            )}

            <div className="overflow-auto border border-[var(--border-main)] rounded-xl">
              <table className="w-full text-sm min-w-[960px]">
                <thead>
                  <tr className="border-b border-[var(--border-main)] bg-[var(--bg-subtle)]">
                    {["Source", "Ref", "Title", "Status", "ERP raw", "Date", "Actions"].map((h) => (
                      <th
                        key={h}
                        className="text-left text-[10px] font-bold text-[var(--text-muted)] uppercase tracking-wider py-2.5 px-3"
                      >
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-[var(--border-main)]">
                  {loading ? (
                    <tr>
                      <td colSpan={7} className="py-10 text-center text-sm text-[var(--text-muted)]">
                        Loading approvals…
                      </td>
                    </tr>
                  ) : items.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="py-10 text-center text-sm text-[var(--text-muted)]">
                        No approval rows matched.
                      </td>
                    </tr>
                  ) : (
                    items.map((row) => {
                      const showPricingActions =
                        canApprovePricing &&
                        row.source === "tool_pricing" &&
                        row.actionable &&
                        row.status === "Pending";
                      return (
                        <tr key={row.id} className="hover:bg-[var(--bg-hover)]">
                          <td className="py-2.5 px-3 text-xs font-semibold text-[var(--text-secondary)]">
                            {row.sourceLabel}
                          </td>
                          <td className="py-2.5 px-3 font-mono text-xs font-semibold">{row.ref}</td>
                          <td className="py-2.5 px-3">
                            <p className="text-[var(--text-primary)] font-medium">{row.title}</p>
                            {row.detail ? (
                              <p className="text-[11px] text-[var(--text-muted)] truncate max-w-sm">
                                {row.detail}
                              </p>
                            ) : null}
                          </td>
                          <td className="py-2.5 px-3">
                            <StatusBadge status={row.status} />
                          </td>
                          <td className="py-2.5 px-3 font-mono text-xs text-[var(--text-muted)]">
                            {row.statusRaw}
                          </td>
                          <td className="py-2.5 px-3 font-mono text-xs">{row.date || "—"}</td>
                          <td className="py-2.5 px-3">
                            <div className="flex items-center justify-end gap-2 flex-wrap">
                              {showPricingActions ? (
                                <>
                                  <Button
                                    type="button"
                                    variant="primary"
                                    size="sm"
                                    className="!h-7 !text-[11px]"
                                    disabled={actingId === row.id}
                                    onClick={() => void handleApprove(row)}
                                  >
                                    Approve
                                  </Button>
                                  <Button
                                    type="button"
                                    variant="outline"
                                    size="sm"
                                    className="!h-7 !text-[11px]"
                                    disabled={actingId === row.id}
                                    onClick={() => {
                                      setRejectTarget(row);
                                      setRejectReason("");
                                    }}
                                  >
                                    Reject
                                  </Button>
                                </>
                              ) : row.href ? (
                                <Link
                                  href={row.href}
                                  className="inline-flex items-center gap-1 text-xs font-semibold text-[var(--primary)] hover:underline"
                                >
                                  Open <ExternalLink className="w-3.5 h-3.5" />
                                </Link>
                              ) : (
                                <span className="text-xs text-[var(--text-muted)]">—</span>
                              )}
                            </div>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>

            <p className="text-[11px] text-[var(--text-muted)]">
              Pricing actions require <span className="font-mono">canApprovePricing</span>. Live{" "}
              <span className="font-mono">RATE</span> updates only on Approve; Reject clears{" "}
              <span className="font-mono">PROPOSED_RATE</span> only.
            </p>
          </div>
        </main>
      </div>

      {rejectTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <form
            onSubmit={submitReject}
            className="w-full max-w-md bg-[var(--bg-card)] border border-[var(--border-main)] rounded-2xl p-5 shadow-xl"
          >
            <h2 className="text-lg font-semibold text-[var(--text-primary)] mb-1">
              Reject pricing change
            </h2>
            <p className="text-xs text-[var(--text-muted)] mb-4">
              {rejectTarget.title}
              {rejectTarget.proposedRate != null
                ? ` · proposed ${rejectTarget.proposedRate}`
                : ""}
              {" · "}Live rate stays {rejectTarget.rate ?? "—"}
            </p>
            <label className="text-xs font-medium text-[var(--text-muted)]">
              Reason
            </label>
            <textarea
              required
              rows={3}
              maxLength={500}
              className="mt-1 w-full rounded-lg border border-[var(--border-main)] bg-[var(--bg-subtle)] px-3 py-2 text-sm"
              value={rejectReason}
              onChange={(e) => setRejectReason(e.target.value)}
              placeholder="Why is this rate rejected?"
            />
            <div className="mt-5 flex justify-end gap-2">
              <Button
                type="button"
                variant="outline"
                disabled={actingId === rejectTarget.id}
                onClick={() => setRejectTarget(null)}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                variant="primary"
                disabled={actingId === rejectTarget.id}
              >
                {actingId === rejectTarget.id ? "Rejecting…" : "Reject"}
              </Button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
