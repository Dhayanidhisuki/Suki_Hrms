"use client";

import { useState, useEffect, useCallback } from "react";
import Sidebar from "@/app/dashboard/components/Sidebar";
import TopBar from "@/app/dashboard/components/TopBar";
import RoleGate from "@/app/dashboard/components/RoleGate";
import { TableSkeleton } from "@/app/dashboard/components/LoadingSkeleton";
import { ModuleKpiRow } from "@/app/dashboard/components/ModuleKpiRow";
import { CheckCircle2, ShieldAlert, FileCheck2, RefreshCw } from "lucide-react";
import { apiGet, apiPost } from "@/lib/apiClient";
import { Button } from "@/components/ui/button";
import { useSuccessOverlay } from "@/components/SuccessOverlay";

interface CalibReceiveLine {
  rowId: number;
  toolOrGaugeNo: string | null;
  description: string | null;
  serialNo: number | null;
  qty: number | string | null;
  price: number | string | null;
  creatDt: string | null;
  tool?: {
    name: string | null;
    description: string | null;
    status: string | null;
    grouping: string | null;
    calibrationFrqMonths: number | null;
  } | null;
}

interface CalibReceiveHeader {
  recNo: number;
  dcNo: number;
  receiveDate: string | null;
  status: string | null;
  creatUserIdCd: string | null;
  lines: CalibReceiveLine[];
  calibIssue?: {
    receiveName: string | null;
    subCode: string | null;
    issueDate: string | null;
    issueFor: string | null;
    status: string | null;
  } | null;
}

const toNum = (v: number | string | null | undefined) => {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
};

const statusBadge: Record<string, { bg: string; text: string }> = {
  Available: { bg: "bg-[var(--color-success-bg)] border border-[var(--border-main)]", text: "text-[var(--color-success-text)]" },
  "Under Calibration": { bg: "bg-[var(--color-warning-bg)] border border-[var(--border-main)]", text: "text-[var(--color-warning-text)]" },
  Scrapped: { bg: "bg-[var(--color-danger-bg)] border border-[var(--border-main)]", text: "text-[var(--color-danger-text)]" },
};

interface OpenCalibIssue {
  dcNo: number;
  receiveName: string | null;
  subCode: string | null;
  issueDate: string | null;
  issueFor: string | null;
  status: string | null;
  inHouseLines?: { toolOrGaugeNo: string | null; status: string | null; issueQty: number | null }[];
}

type ReceiveLineDraft = {
  toolOrGaugeNo: string;
  qty: number;
  price: number;
  selected: boolean;
};

export default function CalibrationReceivePage() {
  const { showSuccess } = useSuccessOverlay();
  const [records, setRecords] = useState<CalibReceiveHeader[]>([]);
  const [openIssues, setOpenIssues] = useState<OpenCalibIssue[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedRcv, setExpandedRcv] = useState<number | null>(null);
  const [selectedDc, setSelectedDc] = useState<number | null>(null);
  const [receiveDate, setReceiveDate] = useState(() => new Date().toISOString().split("T")[0]);
  const [lineDrafts, setLineDrafts] = useState<ReceiveLineDraft[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [bannerMsg, setBannerMsg] = useState<{ type: "success" | "error"; text: string } | null>(null);

  const loadRecords = useCallback(async () => {
    setLoading(true);
    const [recvRes, issueRes] = await Promise.all([
      apiGet<{ items: CalibReceiveHeader[] }>("/api/calibration/receive"),
      apiGet<{ items: OpenCalibIssue[] }>("/api/calibration/issue?status=OPEN"),
    ]);
    if (recvRes.data?.items) setRecords(recvRes.data.items);
    if (issueRes.data?.items) setOpenIssues(issueRes.data.items);
    setLoading(false);
  }, []);

  useEffect(() => {
    loadRecords();
  }, [loadRecords]);

  const beginReceive = (iss: OpenCalibIssue) => {
    setSelectedDc(iss.dcNo);
    setReceiveDate(new Date().toISOString().split("T")[0]);
    setBannerMsg(null);
    setLineDrafts(
      (iss.inHouseLines ?? [])
        .filter((l) => l.toolOrGaugeNo)
        .map((l) => ({
          toolOrGaugeNo: l.toolOrGaugeNo as string,
          qty: l.issueQty && l.issueQty > 0 ? l.issueQty : 1,
          price: 0,
          selected: true,
        }))
    );
  };

  const handleSubmitReceive = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedDc) return;
    const lines = lineDrafts
      .filter((l) => l.selected)
      .map((l) => ({ toolOrGaugeNo: l.toolOrGaugeNo, qty: l.qty, price: l.price }));
    if (lines.length === 0) {
      setBannerMsg({ type: "error", text: "Select at least one tool line to receive." });
      return;
    }
    setSubmitting(true);
    setBannerMsg(null);
    const res = await apiPost("/api/calibration/receive", {
      dcNo: selectedDc,
      receiveDate,
      lines,
    });
    setSubmitting(false);
    if (res.error) {
      setBannerMsg({ type: "error", text: res.error.message });
      return;
    }
    setBannerMsg({
      type: "success",
      text: `Calibration receive posted for DC #${selectedDc}. Continue to Results Update for certificates.`,
    });
    showSuccess({
      title: "Calibration receive posted",
      message: "Continue to Results Update for certificates.",
      detail: `DC #${selectedDc}`,
    });
    setSelectedDc(null);
    setLineDrafts([]);
    void loadRecords();
  };

  // Flatten all lines across all receive headers for the KPI summaries
  const allLines = records.flatMap((r) => r.lines);
  const openLineCount = openIssues.reduce((n, i) => n + (i.inHouseLines?.length ?? 0), 0);
  const selectedIssue = openIssues.find((i) => i.dcNo === selectedDc) ?? null;

  return (
    <div className="flex h-screen bg-[var(--bg-app)] text-[var(--text-primary)] overflow-hidden">
      <Sidebar />
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        <TopBar />
        <main className="flex-1 overflow-y-auto px-7 py-6">
          <div className="mb-6">
            <h1 className="text-2xl font-bold text-[var(--text-primary)] tracking-tight">
              Calibration Receive
            </h1>
            <p className="text-sm text-[var(--text-muted)] mt-0.5">
              Receive tools back from the calibration lab, then update certificates on Results Update
            </p>
          </div>

          {bannerMsg && (
            <div
              className={`mb-4 px-4 py-3 rounded-xl text-sm font-medium flex items-center gap-2 ${
                bannerMsg.type === "success"
                  ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                  : "bg-red-50 text-red-700 border border-red-200"
              }`}
            >
              {bannerMsg.text}
              <button onClick={() => setBannerMsg(null)} className="ml-auto text-xs opacity-60 hover:opacity-100">
                ✕
              </button>
            </div>
          )}

          {/* ── Module KPI Cards ── */}
          <ModuleKpiRow
            items={[
              {
                id: "total-receive",
                label: "Total Calib Receives",
                value: records.length,
                subtext: "GRN receipts recorded",
                icon: FileCheck2,
                iconBg: "bg-[var(--primary-light)]",
                iconColor: "text-[var(--primary)]",
                badge: { label: "GRN Slips", type: "info" },
              },
              {
                id: "tools-received",
                label: "Tools Received Back",
                value: allLines.length,
                subtext: "Line items returned from calibration",
                icon: RefreshCw,
                iconBg: "bg-blue-50 dark:bg-blue-950/30",
                iconColor: "text-blue-600 dark:text-blue-400",
                badge: { label: "Lines", type: "info" },
              },
              {
                id: "back-in-service",
                label: "Back in Service",
                value: allLines.filter((l) => l.tool?.status === "Available").length,
                subtext: "Fit for production use",
                icon: CheckCircle2,
                iconBg: "bg-emerald-50 dark:bg-emerald-950/30",
                iconColor: "text-emerald-600 dark:text-emerald-400",
                badge: { label: "Available", type: "success" },
              },
              {
                id: "open-issues",
                label: "Awaiting Receive",
                value: openIssues.length,
                subtext: `${openLineCount} tools still out for calib`,
                icon: ShieldAlert,
                iconBg: "bg-amber-50 dark:bg-amber-950/30",
                iconColor: "text-amber-600 dark:text-amber-400",
                badge: { label: "Open DC", type: "warning" },
              },
            ]}
          />

          <div className="bg-[var(--bg-card)] rounded-2xl border border-[var(--border-main)] p-5 mb-6 space-y-4">
            <div className="flex items-center justify-between gap-3 flex-wrap">
              <div>
                <h2 className="text-sm font-semibold text-[var(--text-primary)]">
                  Receive from open calibration DC
                </h2>
                <p className="text-xs text-[var(--text-muted)] mt-0.5">
                  Select an open DC, confirm lines, then post the lab return
                </p>
              </div>
              {selectedDc && (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setSelectedDc(null);
                    setLineDrafts([]);
                  }}
                >
                  Cancel
                </Button>
              )}
            </div>

            <RoleGate
              permission="canManageCalibration"
              fallback={
                openIssues.length === 0 ? (
                  <p className="text-sm text-[var(--text-muted)] py-4 text-center">
                    No open calibration issues awaiting receive.
                  </p>
                ) : (
                  <p className="text-sm text-[var(--text-muted)]">
                    {openIssues.length} open DC(s) awaiting receive — you need calibration manage permission to post.
                  </p>
                )
              }
            >
              {!selectedDc ? (
                openIssues.length === 0 ? (
                  <p className="text-sm text-[var(--text-muted)] py-4 text-center">
                    No open calibration issues awaiting receive. Create one under Calibration Issue first.
                  </p>
                ) : (
                  <div className="overflow-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b border-[var(--border-main)] bg-[var(--bg-subtle)]">
                          {["DC No", "Lab / Party", "Sub Code", "Issue Date", "Issue For", "Lines", "Status", ""].map(
                            (col) => (
                              <th
                                key={col || "action"}
                                className="text-left text-[11px] font-semibold text-[var(--text-muted)] uppercase tracking-wider py-2.5 px-3"
                              >
                                {col}
                              </th>
                            )
                          )}
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-[var(--border-main)]">
                        {openIssues.map((iss) => (
                          <tr key={iss.dcNo} className="hover:bg-[var(--bg-hover)]">
                            <td className="py-2.5 px-3 font-mono text-xs">{iss.dcNo}</td>
                            <td className="py-2.5 px-3 text-xs">{iss.receiveName ?? "—"}</td>
                            <td className="py-2.5 px-3 font-mono text-xs text-[var(--text-muted)]">
                              {iss.subCode ?? "—"}
                            </td>
                            <td className="py-2.5 px-3 text-xs text-[var(--text-muted)]">
                              {iss.issueDate ? iss.issueDate.split("T")[0] : "—"}
                            </td>
                            <td className="py-2.5 px-3 text-xs">{iss.issueFor ?? "—"}</td>
                            <td className="py-2.5 px-3 text-xs tabular-nums">{iss.inHouseLines?.length ?? 0}</td>
                            <td className="py-2.5 px-3 text-xs font-semibold text-[var(--primary)]">
                              {iss.status ?? "OPEN"}
                            </td>
                            <td className="py-2.5 px-3 text-right">
                              <Button type="button" size="sm" onClick={() => beginReceive(iss)}>
                                Receive
                              </Button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )
              ) : (
                <form onSubmit={handleSubmitReceive} className="space-y-4">
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <div>
                      <label className="text-[11px] font-semibold text-[var(--text-muted)] uppercase">DC No</label>
                      <p className="mt-1 font-mono text-sm font-bold">{selectedDc}</p>
                      {selectedIssue && (
                        <p className="text-xs text-[var(--text-muted)] mt-0.5">
                          {selectedIssue.receiveName ?? "—"} · {selectedIssue.issueFor ?? "—"}
                        </p>
                      )}
                    </div>
                    <div>
                      <label className="text-[11px] font-semibold text-[var(--text-muted)] uppercase">
                        Receive Date
                      </label>
                      <input
                        type="date"
                        value={receiveDate}
                        onChange={(e) => setReceiveDate(e.target.value)}
                        required
                        className="mt-1 w-full text-sm border border-[var(--border-main)] rounded-lg px-3 py-2 bg-[var(--bg-subtle)]"
                      />
                    </div>
                  </div>

                  <div className="overflow-auto border border-[var(--border-main)] rounded-xl">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b border-[var(--border-main)] bg-[var(--bg-subtle)]">
                          {["", "Tool No", "Qty", "Price"].map((col) => (
                            <th
                              key={col || "chk"}
                              className="text-left text-[11px] font-semibold text-[var(--text-muted)] uppercase tracking-wider py-2.5 px-3"
                            >
                              {col}
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-[var(--border-main)]">
                        {lineDrafts.map((line, idx) => (
                          <tr key={line.toolOrGaugeNo}>
                            <td className="py-2 px-3">
                              <input
                                type="checkbox"
                                checked={line.selected}
                                onChange={(e) => {
                                  const next = [...lineDrafts];
                                  next[idx] = { ...line, selected: e.target.checked };
                                  setLineDrafts(next);
                                }}
                              />
                            </td>
                            <td className="py-2 px-3 font-mono text-xs font-semibold">{line.toolOrGaugeNo}</td>
                            <td className="py-2 px-3">
                              <input
                                type="number"
                                min={0}
                                step={1}
                                value={line.qty}
                                disabled={!line.selected}
                                onChange={(e) => {
                                  const next = [...lineDrafts];
                                  next[idx] = { ...line, qty: Number(e.target.value) || 0 };
                                  setLineDrafts(next);
                                }}
                                className="w-20 text-sm border border-[var(--border-main)] rounded-lg px-2 py-1.5 font-mono bg-[var(--bg-subtle)]"
                              />
                            </td>
                            <td className="py-2 px-3">
                              <input
                                type="number"
                                min={0}
                                step={0.01}
                                value={line.price}
                                disabled={!line.selected}
                                onChange={(e) => {
                                  const next = [...lineDrafts];
                                  next[idx] = { ...line, price: Number(e.target.value) || 0 };
                                  setLineDrafts(next);
                                }}
                                className="w-28 text-sm border border-[var(--border-main)] rounded-lg px-2 py-1.5 font-mono bg-[var(--bg-subtle)]"
                              />
                            </td>
                          </tr>
                        ))}
                        {lineDrafts.length === 0 && (
                          <tr>
                            <td colSpan={4} className="py-6 text-center text-xs text-[var(--text-muted)]">
                              This DC has no tool lines to receive.
                            </td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>

                  <div className="flex justify-end gap-2">
                    <Button type="submit" disabled={submitting || lineDrafts.every((l) => !l.selected)}>
                      {submitting ? "Posting…" : "Post Calibration Receive"}
                    </Button>
                  </div>
                </form>
              )}
            </RoleGate>
          </div>

          <div className="bg-[var(--bg-card)] rounded-2xl border border-[var(--border-main)] p-5">
            <h2 className="text-sm font-semibold text-[var(--text-primary)] mb-3">
              Calibration receive history
            </h2>
            {loading ? (
              <TableSkeleton rows={4} />
            ) : records.length === 0 ? (
              <div className="text-center text-sm text-[var(--text-muted)] py-8">
                No rows in TOOLS_RECEIVE_FOR_CALIBRATION yet. Open issues above are ready to receive when a lab return is posted.
              </div>
            ) : (
              <div className="space-y-4">
                {records.map((rcv) => {
                  const isExpanded = expandedRcv === rcv.recNo;
                  return (
                    <div key={rcv.recNo} className="border border-[var(--border-main)] rounded-xl p-4 space-y-3 bg-[var(--bg-subtle)]">
                      <div className="flex items-center justify-between flex-wrap gap-2">
                        <div>
                          <p className="font-mono text-sm font-bold text-[var(--text-primary)]">Receive #{rcv.recNo}</p>
                          <p className="text-xs text-[var(--text-muted)] mt-0.5">
                            DC Ref: <span className="font-semibold text-[var(--text-primary)] font-mono">{rcv.dcNo}</span>
                            {" · "}From: {rcv.calibIssue?.receiveName ?? "—"}
                            {rcv.calibIssue?.issueFor ? ` · For: ${rcv.calibIssue.issueFor}` : ""}
                            {" · "}Received: {rcv.receiveDate ? rcv.receiveDate.split("T")[0] : "—"}
                            {rcv.status ? ` · Status: ${rcv.status}` : ""}
                          </p>
                        </div>
                        <button
                          onClick={() => setExpandedRcv(isExpanded ? null : rcv.recNo)}
                          className="text-xs font-semibold text-[var(--primary)] hover:underline transition-colors"
                        >
                          {isExpanded ? "Hide lines" : `View ${rcv.lines.length} line(s)`}
                        </button>
                      </div>

                      {isExpanded && (
                        <div className="overflow-auto border-t border-[var(--border-main)] pt-3">
                          <table className="w-full text-sm">
                            <thead>
                              <tr className="text-[var(--text-muted)] font-bold text-[10px] uppercase bg-[var(--bg-card)]">
                                {["Tool No", "Name & Description", "Group", "S.No", "Qty", "Price", "Calib Frq", "Tool Status"].map((col) => (
                                  <th key={col} className="text-left py-2 px-3">{col}</th>
                                ))}
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-[var(--border-main)]">
                              {rcv.lines.map((line) => {
                                const toolStatus = line.tool?.status ?? "—";
                                const sb = statusBadge[toolStatus] ?? { bg: "bg-[var(--bg-hover)]", text: "text-[var(--text-muted)]" };
                                const lineName = line.tool?.name || "";
                                const lineDesc = line.description || line.tool?.description || "";
                                return (
                                  <tr key={line.rowId} className="text-[var(--text-secondary)] text-xs hover:bg-[var(--bg-hover)]">
                                    <td className="py-2.5 px-3 font-mono font-semibold text-[var(--text-secondary)]">{line.toolOrGaugeNo ?? "—"}</td>
                                    <td className="py-2.5 px-3 max-w-xs">
                                      <p className="font-semibold text-[var(--text-primary)] truncate">{lineName || lineDesc || "—"}</p>
                                      {lineName && lineDesc && (
                                        <p className="text-[11px] text-[var(--text-muted)] truncate">{lineDesc}</p>
                                      )}
                                    </td>
                                    <td className="py-2.5 px-3 text-[var(--text-muted)]">{line.tool?.grouping ?? "—"}</td>
                                    <td className="py-2.5 px-3 font-mono text-[var(--text-muted)]">{line.serialNo ?? "—"}</td>
                                    <td className="py-2.5 px-3 font-mono">{line.qty != null ? toNum(line.qty) : "—"}</td>
                                    <td className="py-2.5 px-3 font-mono">{line.price != null ? toNum(line.price).toFixed(2) : "—"}</td>
                                    <td className="py-2.5 px-3 text-[var(--text-muted)]">
                                      {line.tool?.calibrationFrqMonths ? `${line.tool.calibrationFrqMonths} mo` : "—"}
                                    </td>
                                    <td className="py-2.5 px-3">
                                      <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-semibold ${sb.bg} ${sb.text}`}>
                                        {toolStatus}
                                      </span>
                                    </td>
                                  </tr>
                                );
                              })}
                            </tbody>
                          </table>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
            {!loading && records.length > 0 && (
              <div className="mt-4 pt-3 border-t border-[var(--border-main)]">
                <span className="text-xs text-[var(--text-muted)]">
                  {allLines.length} calibration record(s) across {records.length} receive(s)
                </span>
              </div>
            )}
          </div>
        </main>
      </div>
    </div>
  );
}
