"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Eye, Package, ExternalLink, FileText, Orbit } from "lucide-react";
import {
  HistoryCardShell,
  HistoryCardSearch,
  HistoryCardPanel,
  HISTORY_CARD_DETAIL_ACTIONS,
  fmtCell,
} from "@/components/HistoryCardShell";
import { TableSkeleton } from "@/app/dashboard/components/LoadingSkeleton";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { Button } from "@/components/ui/button";
import { ToolDocumentsPanel } from "@/components/ToolDocumentsPanel";
import ToolJourneyTimeline from "@/components/ToolJourneyTimeline";
import { apiGet, apiPost } from "@/lib/apiClient";
import { toastSuccess, toastError } from "@/lib/appToast";

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

/** Fixed column template — header + rows share the same tracks */
const CARD_LIST_COLS = "minmax(0, 2.2fr) minmax(0, 1.1fr) 4.5rem 5.5rem";

export default function ToolsHistoryCardPage() {
  const [tools, setTools] = useState<ToolHistoryItem[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState<ToolHistoryItem | null>(null);
  const [units, setUnits] = useState<UnitHistoryRow[]>([]);
  const [unitsLoading, setUnitsLoading] = useState(false);
  const [unitsError, setUnitsError] = useState("");
  const [docsOpen, setDocsOpen] = useState(false);
  const [docCount, setDocCount] = useState(0);
  /** units = Physical Units table · journey = 360° Tool Journey timeline */
  const [detailView, setDetailView] = useState<"units" | "journey">("units");
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
    setDocsOpen(false);
    setDocCount(0);
    setDetailView("units");
    setUnits([]);
    setUnitsError("");
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
    const res = await apiPost<{ nextPreDate?: string }>("/api/tools/preventive-complete", {
      unitRefNo,
    });
    if (res.error) {
      toastError(res.error.message);
      return;
    }
    toastSuccess(
      `Preventive MNT completed. Next due: ${res.data?.nextPreDate ?? "updated"}.`
    );
    if (selected) void selectTool(selected, false);
  };

  const inStore = units.filter((u) => !u.dcNo).length;
  const outHeld = units.filter((u) => !!u.dcNo).length;

  return (
    <HistoryCardShell
      title="History Card"
      subtitle="Lifecycle card for tools with HISTORY_CARD_REQ = Yes — physical units, calibration dates, and current holder"
      kpiVariant="simple"
      kpis={[
        {
          id: "hc-total",
          label: "History Card Tools",
          value: total,
          subtext: "HISTORY_CARD_REQ = Yes",
        },
        {
          id: "hc-page-stock",
          label: "In Stock",
          value: tools.reduce((a, t) => a + toNum(t.qtyIn), 0),
          subtext: "Master qty in on this page",
        },
        {
          id: "hc-page-out",
          label: "Issued Out",
          value: tools.reduce((a, t) => a + toNum(t.qtyOut), 0),
          subtext: "Master qty out on this page",
        },
        {
          id: "hc-units",
          label: "Units on Card",
          value: selected ? units.length : 0,
          subtext: selected ? selected.toolOrGaugeNo : "Select a tool",
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
          bodyClassName="p-0"
        >
          {loading ? (
            <div className="p-5">
              <TableSkeleton rows={8} />
            </div>
          ) : (
            <div className="overflow-auto max-h-[62vh]">
              <div
                className="sticky top-0 z-10 grid items-center gap-x-3 border-b-[0.5px] border-[var(--border-main)] bg-[var(--bg-card)] px-5 py-2.5"
                style={{ gridTemplateColumns: CARD_LIST_COLS }}
              >
                {["Tool No", "Group", "Stock", "Action"].map((c) => (
                  <div
                    key={c}
                    className="text-left text-[10px] font-bold text-[var(--text-muted)] uppercase tracking-wider"
                  >
                    {c}
                  </div>
                ))}
              </div>

              <div className="divide-y divide-[var(--border-main)]">
                {tools.map((t) => {
                  const active = selected?.refNo === t.refNo;
                  return (
                    <div
                      key={t.refNo}
                      role="button"
                      tabIndex={0}
                      onClick={() => void selectTool(t)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" || e.key === " ") {
                          e.preventDefault();
                          void selectTool(t);
                        }
                      }}
                      className={`grid items-center gap-x-3 px-5 py-2.5 cursor-pointer transition-colors ${
                        active
                          ? "bg-[var(--primary-light)]/60"
                          : "hover:bg-[var(--bg-hover)]"
                      }`}
                      style={{ gridTemplateColumns: CARD_LIST_COLS }}
                    >
                      <div className="min-w-0">
                        <p className="font-mono text-xs font-bold text-[var(--text-primary)] truncate">
                          {t.toolOrGaugeNo}
                        </p>
                        <p className="text-[11px] text-[var(--text-muted)] truncate">
                          {toolLabel(t)}
                        </p>
                      </div>
                      <div className="min-w-0 text-[11px] text-[var(--text-secondary)] truncate">
                        {t.grouping}
                      </div>
                      <div className="font-mono text-xs text-[var(--text-secondary)] tabular-nums">
                        {toNum(t.qtyIn)}/{toNum(t.totQty)}
                      </div>
                      <div className="flex justify-start">
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
                      </div>
                    </div>
                  );
                })}
                {tools.length === 0 && (
                  <div className="py-10 text-center text-sm text-[var(--text-muted)] px-5">
                    No history-card tools match. Try{" "}
                    <span className="font-mono">MP-QRG-174</span>.
                  </div>
                )}
              </div>
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
                {/* Qty metrics — one card, 2×2 grid */}
                <div className="rounded-[12px] border-[0.5px] border-[var(--border-main)] bg-[var(--bg-subtle)] p-4 mb-5">
                  <div className="grid grid-cols-2 gap-x-6 gap-y-4">
                    {[
                      { label: "Total Qty", value: toNum(selected.totQty) },
                      {
                        label: "In Stock",
                        value: toNum(selected.qtyIn),
                        tone: "text-emerald-600 dark:text-emerald-400",
                      },
                      {
                        label: "Issued Out",
                        value: toNum(selected.qtyOut),
                        tone: "text-[var(--primary)]",
                      },
                      {
                        label: "Calib Freq",
                        value: selected.calibrationFrqMonths
                          ? `${selected.calibrationFrqMonths} mo`
                          : "—",
                      },
                    ].map((m) => (
                      <div key={m.label} className="min-w-0">
                        <p className="text-[12px] font-medium text-[var(--text-muted)] leading-tight">
                          {m.label}
                        </p>
                        <p
                          className={`mt-1 text-[22px] font-medium font-mono leading-none tabular-nums ${m.tone ?? "text-[var(--text-primary)]"}`}
                        >
                          {m.value}
                        </p>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Status pills — one row, uniform height */}
                <div className="flex flex-wrap items-center gap-2 mb-5">
                  <span className="inline-flex h-7 items-center px-2.5 rounded-full text-[11px] font-semibold border-[0.5px] border-[var(--border-main)] bg-[var(--bg-subtle)] text-[var(--text-secondary)]">
                    Location: {selected.location || "Tool Crib"}
                  </span>
                  <span className="inline-flex h-7 items-center">
                    <StatusBadge status={selected.computedStatus || selected.status || "Tracked"} />
                  </span>
                  <span className="inline-flex h-7 items-center px-2.5 rounded-full text-[11px] font-semibold border-[0.5px] border-[var(--border-main)] bg-[var(--bg-subtle)] text-[var(--text-secondary)]">
                    Units in crib: {inStore}
                  </span>
                  <span className="inline-flex h-7 items-center px-2.5 rounded-full text-[11px] font-semibold border-[0.5px] border-[var(--border-main)] bg-[var(--bg-subtle)] text-[var(--text-secondary)]">
                    Units held out: {outHeld}
                  </span>
                </div>

                {/* Module actions — icon+label grid */}
                <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
                  <button
                    type="button"
                    title="Unified chronological timeline across PO, GRN, issue, receive, calib, status"
                    aria-pressed={detailView === "journey"}
                    onClick={() => {
                      setDetailView("journey");
                      setDocsOpen(false);
                    }}
                    className={`flex flex-col items-center justify-center gap-1.5 rounded-[12px] border-[0.5px] px-2 py-3 text-center transition-colors ${
                      detailView === "journey"
                        ? "border-[var(--primary)] bg-[var(--primary-light)]/50"
                        : "border-[var(--border-main)] bg-[var(--bg-subtle)] hover:border-[var(--primary)] hover:bg-[var(--bg-hover)]"
                    }`}
                  >
                    <Orbit className="w-4 h-4 text-[var(--text-secondary)]" />
                    <span className="text-[11px] font-semibold text-[var(--text-secondary)] leading-tight">
                      360° Journey
                    </span>
                  </button>
                  {HISTORY_CARD_DETAIL_ACTIONS.map((n) => {
                    const Icon = n.icon;
                    const href = `${n.href}?tool=${encodeURIComponent(selected.toolOrGaugeNo)}`;
                    return (
                      <Link
                        key={n.href}
                        href={href}
                        title={n.description}
                        onClick={() => setDetailView("units")}
                        className="flex flex-col items-center justify-center gap-1.5 rounded-[12px] border-[0.5px] border-[var(--border-main)] bg-[var(--bg-subtle)] px-2 py-3 text-center transition-colors hover:border-[var(--primary)] hover:bg-[var(--bg-hover)]"
                      >
                        <Icon className="w-4 h-4 text-[var(--text-secondary)]" />
                        <span className="text-[11px] font-semibold text-[var(--text-secondary)] leading-tight">
                          {n.short}
                        </span>
                      </Link>
                    );
                  })}
                  <button
                    type="button"
                    title="Upload / download certificates, manuals, and drawings"
                    aria-expanded={docsOpen}
                    onClick={() => {
                      setDocsOpen((o) => !o);
                      setDetailView("units");
                    }}
                    className={`flex flex-col items-center justify-center gap-1.5 rounded-[12px] border-[0.5px] px-2 py-3 text-center transition-colors ${
                      docsOpen
                        ? "border-[var(--primary)] bg-[var(--primary-light)]/50"
                        : "border-[var(--border-main)] bg-[var(--bg-subtle)] hover:border-[var(--primary)] hover:bg-[var(--bg-hover)]"
                    }`}
                  >
                    <span className="relative inline-flex">
                      <FileText className="w-4 h-4 text-[var(--text-secondary)]" />
                      {docCount > 0 && (
                        <span className="absolute -top-1.5 -right-2.5 min-w-[16px] h-4 px-1 flex items-center justify-center rounded-full bg-[var(--primary)] text-[9px] font-bold text-white font-mono leading-none">
                          {docCount > 99 ? "99+" : docCount}
                        </span>
                      )}
                    </span>
                    <span className="text-[11px] font-semibold text-[var(--text-secondary)] leading-tight">
                      Documents
                    </span>
                  </button>
                </div>

                <div
                  className={
                    docsOpen
                      ? "mt-3 rounded-[12px] border-[0.5px] border-[var(--border-main)] bg-[var(--bg-subtle)] p-4"
                      : undefined
                  }
                >
                  <ToolDocumentsPanel
                    key={selected.toolOrGaugeNo}
                    toolOrGaugeNo={selected.toolOrGaugeNo}
                    defaultDocType="CALIB_CERTIFICATE"
                    variant="form"
                    collapsed={!docsOpen}
                    onCountChange={setDocCount}
                    onClose={() => setDocsOpen(false)}
                  />
                </div>
              </HistoryCardPanel>

              {detailView === "journey" ? (
                <HistoryCardPanel
                  title="360° Tool Journey"
                  subtitle="PO · GRN · Issue · Receive · Calibration · Status — newest first"
                  actions={
                    <button
                      type="button"
                      onClick={() => setDetailView("units")}
                      className="text-[11px] font-semibold text-[var(--primary)] hover:underline"
                    >
                      Back to units
                    </button>
                  }
                >
                  <ToolJourneyTimeline
                    key={`${selected.toolOrGaugeNo}-${selected.refNo}`}
                    toolOrGaugeNo={selected.toolOrGaugeNo}
                    refNo={selected.refNo}
                  />
                </HistoryCardPanel>
              ) : (
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
                  {unitsLoading ? (
                    <TableSkeleton rows={4} />
                  ) : (
                    <div className="overflow-auto -mx-1">
                      <table className="w-full text-sm min-w-[720px]">
                        <thead>
                          <tr className="border-b-[0.5px] border-[var(--border-main)] bg-[var(--bg-subtle)]">
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
              )}
            </>
          )}
        </div>
      </div>
    </HistoryCardShell>
  );
}
