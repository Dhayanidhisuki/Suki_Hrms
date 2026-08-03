"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import {
  Eye,
  History,
  Package,
  CheckCircle2,
  ArrowUpRight,
  Layers,
  ExternalLink,
} from "lucide-react";
import {
  HistoryCardShell,
  HistoryCardSearch,
  HistoryCardPanel,
  HISTORY_CARD_NAV,
  fmtCell,
} from "@/components/HistoryCardShell";
import { TableSkeleton } from "@/app/dashboard/components/LoadingSkeleton";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { Button } from "@/components/ui/button";
import { ToolDocumentsPanel } from "@/components/ToolDocumentsPanel";
import { apiGet, apiPost } from "@/lib/apiClient";

interface ToolHistoryItem {
  refNo: number;
  toolOrGaugeNo: string;
  name: string | null;
  grouping: string;
  totQty: number | string;
  qtyIn: number | string;
  qtyOut: number | string;
  status: string | null;
  location: string | null;
  calibrationFrqMonths: number | null;
  creatDt: string | null;
  computedStatus?: string | null;
}

interface UnitHistoryRow {
  key: string;
  refNo: number;
  serialNo: string;
  status: string;
  make: string;
  purchaseDt: string | null;
  lastCaliDt: string | null;
  nextCaliDt: string | null;
  lastPreMntDt: string | null;
  nextPreMntDt: string | null;
  issueTo: string | null;
  dcNo: string | null;
  dcDate: string | null;
}

const toNum = (v: unknown, fallback = 0) => {
  if (v === null || v === undefined || v === "") return fallback;
  const n = typeof v === "number" ? v : Number(v);
  return Number.isFinite(n) ? n : fallback;
};

function toolLabel(t: ToolHistoryItem) {
  const n = (t.name ?? "").trim();
  return !n || n.toUpperCase() === "N/A" ? t.toolOrGaugeNo : n;
}

export default function ToolsHistoryCardPage() {
  const [tools, setTools] = useState<ToolHistoryItem[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState<ToolHistoryItem | null>(null);
  const [units, setUnits] = useState<UnitHistoryRow[]>([]);
  const [unitsLoading, setUnitsLoading] = useState(false);
  const [unitsError, setUnitsError] = useState("");
  const [pmMsg, setPmMsg] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const searchTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const loadTools = useCallback(async (q = "") => {
    setLoading(true);
    const params = new URLSearchParams({ pageSize: "50", historyCardOnly: "1" });
    if (q.trim()) params.set("search", q.trim());
    const res = await apiGet<{ items: ToolHistoryItem[]; total: number }>(
      `/api/tools?${params}`
    );
    const items = res.data?.items ?? [];
    setTools(items);
    setTotal(res.data?.total ?? items.length);
    setLoading(false);
    return items;
  }, []);

  useEffect(() => {
    loadTools("").then((items) => {
      if (items[0]) void selectTool(items[0], false);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loadTools]);

  const selectTool = async (tool: ToolHistoryItem, scroll = true) => {
    setSelected(tool);
    setUnits([]);
    setUnitsError("");
    setPmMsg(null);
    setUnitsLoading(true);
    const res = await apiGet<{ unitHistory?: UnitHistoryRow[]; serials?: UnitHistoryRow[] }>(
      `/api/tools/${tool.refNo}/serials`
    );
    if (res.error) {
      setUnitsError(res.error.message);
      setUnitsLoading(false);
      return;
    }
    setUnits(res.data?.unitHistory ?? res.data?.serials ?? []);
    setUnitsLoading(false);
    if (scroll) {
      document.getElementById("history-card-detail")?.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  };

  const handleSearch = (val: string) => {
    setQuery(val);
    if (searchTimer.current) clearTimeout(searchTimer.current);
    searchTimer.current = setTimeout(async () => {
      const items = await loadTools(val);
      if (items[0]) void selectTool(items[0], false);
      else setSelected(null);
    }, 350);
  };

  const handleCompletePm = async (unitRefNo: number) => {
    setPmMsg(null);
    const res = await apiPost<{ nextPreDate?: string }>("/api/tools/preventive-complete", {
      unitRefNo,
    });
    if (res.error) {
      setPmMsg({ type: "error", text: res.error.message });
      return;
    }
    setPmMsg({
      type: "success",
      text: `Preventive MNT completed. Next due: ${res.data?.nextPreDate ?? "updated"}.`,
    });
    if (selected) void selectTool(selected, false);
  };

  const inStore = units.filter((u) => !u.dcNo).length;
  const outHeld = units.filter((u) => !!u.dcNo).length;

  return (
    <HistoryCardShell
      title="History Card"
      subtitle="Lifecycle card for tools with HISTORY_CARD_REQ = Yes — physical units, calibration dates, and current holder"
      kpis={[
        {
          id: "hc-total",
          label: "History Card Tools",
          value: total,
          subtext: "HISTORY_CARD_REQ = Yes",
          icon: History,
          iconBg: "bg-[var(--primary-light)]",
          iconColor: "text-[var(--primary)]",
          badge: { label: "Cards", type: "info" },
        },
        {
          id: "hc-page-stock",
          label: "In Stock (page)",
          value: tools.reduce((a, t) => a + toNum(t.qtyIn), 0),
          subtext: "Master qty in on this page",
          icon: CheckCircle2,
          iconBg: "bg-emerald-50 dark:bg-emerald-950/30",
          iconColor: "text-emerald-600 dark:text-emerald-400",
          badge: { label: "Crib", type: "success" },
        },
        {
          id: "hc-page-out",
          label: "Issued Out (page)",
          value: tools.reduce((a, t) => a + toNum(t.qtyOut), 0),
          subtext: "Master qty out on this page",
          icon: ArrowUpRight,
          iconBg: "bg-blue-50 dark:bg-blue-950/30",
          iconColor: "text-blue-600 dark:text-blue-400",
          badge: { label: "Issued", type: "info" },
        },
        {
          id: "hc-units",
          label: "Units On Card",
          value: selected ? units.length : 0,
          subtext: selected ? selected.toolOrGaugeNo : "Select a tool",
          icon: Layers,
          iconBg: "bg-amber-50 dark:bg-amber-950/30",
          iconColor: "text-amber-600 dark:text-amber-400",
          badge: { label: "Units", type: "warning" },
        },
      ]}
      toolbar={
        <HistoryCardSearch
          value={query}
          onChange={handleSearch}
          placeholder="Search history-card tool number or name…"
          hint="Only masters with History Card = Yes. Consumables like OTH_J00326 (History Card = No) are excluded."
        />
      }
    >
      <div className="grid grid-cols-1 xl:grid-cols-12 gap-5">
        {/* Tool list */}
        <HistoryCardPanel
          title="Registered Cards"
          subtitle={`Showing ${tools.length} of ${total.toLocaleString()}`}
          className="xl:col-span-5"
        >
          {loading ? (
            <TableSkeleton rows={8} />
          ) : (
            <div className="overflow-auto max-h-[62vh] -mx-1">
              <table className="w-full text-sm">
                <thead className="sticky top-0 bg-[var(--bg-card)] z-10">
                  <tr className="border-b border-[var(--border-main)]">
                    {["Tool No", "Group", "Stock", ""].map((c) => (
                      <th
                        key={c || "a"}
                        className="text-left text-[10px] font-bold text-[var(--text-muted)] uppercase tracking-wider py-2 px-2"
                      >
                        {c}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-[var(--border-main)]">
                  {tools.map((t) => {
                    const active = selected?.refNo === t.refNo;
                    return (
                      <tr
                        key={t.refNo}
                        onClick={() => void selectTool(t)}
                        className={`cursor-pointer transition-colors ${
                          active
                            ? "bg-[var(--primary-light)]/60"
                            : "hover:bg-[var(--bg-hover)]"
                        }`}
                      >
                        <td className="py-2.5 px-2">
                          <p className="font-mono text-xs font-bold text-[var(--text-primary)]">
                            {t.toolOrGaugeNo}
                          </p>
                          <p className="text-[11px] text-[var(--text-muted)] truncate max-w-[160px]">
                            {toolLabel(t)}
                          </p>
                        </td>
                        <td className="py-2.5 px-2 text-[11px] text-[var(--text-secondary)]">
                          {t.grouping}
                        </td>
                        <td className="py-2.5 px-2 font-mono text-xs text-[var(--text-secondary)] whitespace-nowrap">
                          {toNum(t.qtyIn)}/{toNum(t.totQty)}
                        </td>
                        <td className="py-2.5 px-2 text-right">
                          <Button
                            type="button"
                            variant={active ? "primary" : "outline"}
                            size="sm"
                            onClick={(e) => {
                              e.stopPropagation();
                              void selectTool(t);
                            }}
                          >
                            <Eye className="w-3.5 h-3.5" />
                            {active ? "Open" : "View"}
                          </Button>
                        </td>
                      </tr>
                    );
                  })}
                  {tools.length === 0 && (
                    <tr>
                      <td colSpan={4} className="py-10 text-center text-sm text-[var(--text-muted)]">
                        No history-card tools match. Try <span className="font-mono">MP-QRG-174</span>.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          )}
        </HistoryCardPanel>

        {/* Detail card */}
        <div id="history-card-detail" className="xl:col-span-7 space-y-5">
          {!selected ? (
            <HistoryCardPanel title="History Card Detail">
              <div className="py-16 text-center">
                <Package className="w-10 h-10 text-[var(--text-muted)] mx-auto mb-3 opacity-50" />
                <p className="text-sm font-semibold text-[var(--text-primary)]">Select a tool</p>
                <p className="text-xs text-[var(--text-muted)] mt-1">
                  Choose a history-card tool from the list to open its unit lifecycle card.
                </p>
              </div>
            </HistoryCardPanel>
          ) : (
            <>
              <HistoryCardPanel
                title={`Card · ${selected.toolOrGaugeNo}`}
                subtitle={`${toolLabel(selected)} · ${selected.grouping}`}
                actions={
                  <Link
                    href={`/dashboard/masters/tools?search=${encodeURIComponent(selected.toolOrGaugeNo)}`}
                    className="inline-flex items-center gap-1 text-xs font-semibold text-[var(--primary)] hover:underline"
                  >
                    Open in Tools Master <ExternalLink className="w-3 h-3" />
                  </Link>
                }
              >
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-5">
                  {[
                    { label: "Total Qty", value: toNum(selected.totQty) },
                    { label: "In Stock", value: toNum(selected.qtyIn), tone: "text-emerald-600 dark:text-emerald-400" },
                    { label: "Issued Out", value: toNum(selected.qtyOut), tone: "text-[var(--primary)]" },
                    {
                      label: "Calib Freq",
                      value: selected.calibrationFrqMonths
                        ? `${selected.calibrationFrqMonths} mo`
                        : "—",
                    },
                  ].map((m) => (
                    <div
                      key={m.label}
                      className="rounded-xl border border-[var(--border-main)] bg-[var(--bg-subtle)] px-3 py-2.5"
                    >
                      <p className="text-[10px] font-bold uppercase tracking-wider text-[var(--text-muted)]">
                        {m.label}
                      </p>
                      <p className={`text-sm font-bold font-mono mt-0.5 ${m.tone ?? "text-[var(--text-primary)]"}`}>
                        {m.value}
                      </p>
                    </div>
                  ))}
                </div>

                <div className="flex flex-wrap gap-2 mb-5">
                  <span className="text-[11px] text-[var(--text-muted)] self-center mr-1">
                    Location: {selected.location || "Tool Crib"}
                  </span>
                  <StatusBadge status={selected.computedStatus || selected.status || "Tracked"} />
                  <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-semibold border bg-[var(--bg-subtle)] text-[var(--text-secondary)] border-[var(--border-main)]">
                    Units in crib: {inStore}
                  </span>
                  <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-semibold border bg-blue-50 dark:bg-blue-950/30 text-blue-700 dark:text-blue-300 border-blue-200">
                    Units held out: {outHeld}
                  </span>
                </div>

                <div className="flex flex-wrap gap-2">
                  {HISTORY_CARD_NAV.filter((n) => n.href !== "/dashboard/tools-history-card").map(
                    (n) => {
                      const Icon = n.icon;
                      const href = `${n.href}?tool=${encodeURIComponent(selected.toolOrGaugeNo)}`;
                      return (
                        <Link
                          key={n.href}
                          href={href}
                          className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-[11px] font-semibold border border-[var(--border-main)] bg-[var(--bg-subtle)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:border-[var(--primary)] transition-colors"
                        >
                          <Icon className="w-3 h-3" />
                          {n.short}
                        </Link>
                      );
                    }
                  )}
                </div>
              </HistoryCardPanel>

              <HistoryCardPanel
                title="Tool Documents"
                subtitle="Upload / download certificates, manuals, and drawings for this tool"
              >
                <ToolDocumentsPanel
                  toolOrGaugeNo={selected.toolOrGaugeNo}
                  defaultDocType="CALIB_CERTIFICATE"
                  title="Files"
                />
              </HistoryCardPanel>

              <HistoryCardPanel
                title="Physical Units & Calibration History"
                subtitle="GAUGE_SERIAL_NO enriched with calib dates and open issue holder"
                actions={
                  <span className="font-mono text-[11px] font-semibold bg-[var(--primary-light)] text-[var(--primary)] px-2.5 py-0.5 rounded-full">
                    {unitsLoading ? "…" : `${units.length} units`}
                  </span>
                }
              >
                {unitsError && (
                  <p className="mb-3 text-xs font-semibold text-[var(--color-danger-text)]">
                    {unitsError}
                  </p>
                )}
                {pmMsg && (
                  <p
                    className={`mb-3 text-xs font-semibold ${
                      pmMsg.type === "success"
                        ? "text-[var(--color-success-text)]"
                        : "text-[var(--color-danger-text)]"
                    }`}
                  >
                    {pmMsg.text}
                  </p>
                )}
                {unitsLoading ? (
                  <TableSkeleton rows={4} />
                ) : (
                  <div className="overflow-auto -mx-1">
                    <table className="w-full text-sm min-w-[720px]">
                      <thead>
                        <tr className="border-b border-[var(--border-main)] bg-[var(--bg-subtle)]">
                          {[
                            "S.No",
                            "Status",
                            "Make",
                            "Purchase",
                            "Last Cali",
                            "Next Cali",
                            "PreMNT",
                            "Issue To / DC",
                            "PM",
                          ].map((c) => (
                            <th
                              key={c}
                              className="text-left text-[10px] font-bold text-[var(--text-muted)] uppercase tracking-wider py-2 px-2.5 whitespace-nowrap"
                            >
                              {c}
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-[var(--border-main)]">
                        {units.map((u) => (
                          <tr key={u.key} className="hover:bg-[var(--bg-hover)]">
                            <td className="py-2.5 px-2.5 font-mono text-xs font-semibold">
                              {fmtCell(u.serialNo)}
                            </td>
                            <td className="py-2.5 px-2.5">
                              <StatusBadge status={u.status || "—"} />
                            </td>
                            <td className="py-2.5 px-2.5 text-xs">{fmtCell(u.make)}</td>
                            <td className="py-2.5 px-2.5 font-mono text-[11px]">
                              {fmtCell(u.purchaseDt)}
                            </td>
                            <td className="py-2.5 px-2.5 font-mono text-[11px]">
                              {fmtCell(u.lastCaliDt)}
                            </td>
                            <td className="py-2.5 px-2.5 font-mono text-[11px]">
                              {fmtCell(u.nextCaliDt)}
                            </td>
                            <td className="py-2.5 px-2.5 font-mono text-[11px]">
                              {fmtCell(u.nextPreMntDt || u.lastPreMntDt)}
                            </td>
                            <td className="py-2.5 px-2.5 text-xs">
                              {u.dcNo ? (
                                <div>
                                  <p className="font-semibold text-[var(--text-primary)]">
                                    {u.issueTo || "—"}
                                  </p>
                                  <p className="font-mono text-[10px] text-[var(--text-muted)]">
                                    {u.dcNo}
                                    {u.dcDate ? ` · ${fmtCell(u.dcDate)}` : ""}
                                  </p>
                                </div>
                              ) : (
                                <span className="text-[var(--text-muted)]">In store</span>
                              )}
                            </td>
                            <td className="py-2.5 px-2.5">
                              <button
                                type="button"
                                onClick={() => void handleCompletePm(u.refNo)}
                                className="text-[11px] font-semibold text-[var(--primary)] hover:underline whitespace-nowrap"
                              >
                                Complete PM
                              </button>
                            </td>
                          </tr>
                        ))}
                        {units.length === 0 && (
                          <tr>
                            <td
                              colSpan={9}
                              className="py-10 text-center text-sm text-[var(--text-muted)]"
                            >
                              No physical units on this history card yet.
                            </td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                )}
              </HistoryCardPanel>
            </>
          )}
        </div>
      </div>
    </HistoryCardShell>
  );
}
