"use client";

import { useState, useEffect, useCallback } from "react";
import Sidebar from "@/app/dashboard/components/Sidebar";
import TopBar from "@/app/dashboard/components/TopBar";
import RoleGate from "@/app/dashboard/components/RoleGate";
import { TableSkeleton } from "@/app/dashboard/components/LoadingSkeleton";
import { ModuleKpiRow } from "@/app/dashboard/components/ModuleKpiRow";
import { CheckCircle2, ShieldAlert, FileCheck2, RefreshCw, Upload, X, Search } from "lucide-react";
import { apiGet, apiPost } from "@/lib/apiClient";
import { Button } from "@/components/ui/button";
import { toastSuccess, toastError } from "@/lib/appToast";
import { ToolDocumentsPanel } from "@/components/ToolDocumentsPanel";
import { useSession } from "@/lib/SessionContext";

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
  partyDcNo?: string | null;
  receiverName?: string | null;
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
  inHouseLines?: {
    toolOrGaugeNo: string | null;
    status: string | null;
    issueQty: number | null;
    serialNo?: number | null;
    tool?: {
      name?: string | null;
      description?: string | null;
      price?: number | string | null;
      labRate?: number | string | null;
    } | null;
  }[];
}

type ReceiveLineDraft = {
  toolOrGaugeNo: string;
  description: string;
  serialNo: number | null;
  qty: number;
  maxQty: number;
  price: number;
  selected: boolean;
};

export default function CalibrationReceivePage() {
  const { user } = useSession();
  const [records, setRecords] = useState<CalibReceiveHeader[]>([]);
  const [openIssues, setOpenIssues] = useState<OpenCalibIssue[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedRcv, setExpandedRcv] = useState<number | null>(null);
  const [uploadTarget, setUploadTarget] = useState<{
    toolOrGaugeNo: string;
    dcNo: number;
  } | null>(null);
  const [selectedDc, setSelectedDc] = useState<number | null>(null);
  const [receiveDate, setReceiveDate] = useState(() => new Date().toISOString().split("T")[0]);
  const [partyDcNo, setPartyDcNo] = useState("");
  const [receiverName, setReceiverName] = useState("");
  const [lineDrafts, setLineDrafts] = useState<ReceiveLineDraft[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [openSearch, setOpenSearch] = useState("");
  const [historySearch, setHistorySearch] = useState("");

  const loadRecords = useCallback(async () => {
    setLoading(true);
    const [recvRes, issueRes] = await Promise.all([
      apiGet<{ items: CalibReceiveHeader[] }>("/api/calibration/receive"),
      // OPEN + PARTIAL DCs; lines already filtered to still-out tools
      apiGet<{ items: OpenCalibIssue[] }>("/api/calibration/issue?awaitingReceive=1"),
    ]);
    if (recvRes.data?.items) setRecords(recvRes.data.items);
    if (issueRes.data?.items) setOpenIssues(issueRes.data.items);
    setLoading(false);
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => void loadRecords(), 0);
    return () => window.clearTimeout(timer);
  }, [loadRecords]);

  const beginReceive = (iss: OpenCalibIssue) => {
    setSelectedDc(iss.dcNo);
    setReceiveDate(new Date().toISOString().split("T")[0]);
    setPartyDcNo("");
    // Prefill store receiver from logged-in user (editable)
    setReceiverName((user?.name || "").slice(0, 30));
    setLineDrafts(
      (iss.inHouseLines ?? [])
        .filter((l) => l.toolOrGaugeNo)
        .map((l) => {
          return {
            toolOrGaugeNo: l.toolOrGaugeNo as string,
            description: (l.tool?.description || l.tool?.name || "").slice(0, 50),
            serialNo: null,
            qty: 1,
            maxQty: 1,
            price: Number(l.tool?.labRate ?? l.tool?.price ?? 0),
            selected: true,
          };
        })
    );
  };

  const handleSubmitReceive = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedDc) return;
    const selected = lineDrafts.filter((l) => l.selected);
    if (selected.length === 0) {
      toastError("Select at least one tool line to receive.");
      return;
    }
    const lines = selected.map((l) => ({
      toolOrGaugeNo: l.toolOrGaugeNo,
      qty: 1,
      price: l.price,
      serialNo: null,
      description: l.description || null,
    }));
    setSubmitting(true);
    const res = await apiPost("/api/calibration/receive", {
      dcNo: selectedDc,
      receiveDate,
      partyDcNo: partyDcNo.trim() || undefined,
      receiverName: receiverName.trim() || undefined,
      lines,
    });
    setSubmitting(false);
    if (res.error) {
      toastError(res.error.message);
      return;
    }
    toastSuccess({
      title: "Calibration receive posted",
      message: `${lines.length} tool(s) received. Unchecked lines remain open on the DC.`,
      detail: `DC #${selectedDc}`,
    });
    setSelectedDc(null);
    setPartyDcNo("");
    setReceiverName("");
    setLineDrafts([]);
    void loadRecords();
  };

  // Flatten all lines across all receive headers for the KPI summaries
  const allLines = records.flatMap((r) => r.lines);
  const openLineCount = openIssues.reduce((n, i) => n + (i.inHouseLines?.length ?? 0), 0);
  const selectedIssue = openIssues.find((i) => i.dcNo === selectedDc) ?? null;

  const openQuery = openSearch.trim().toLowerCase();
  const filteredOpenIssues = openIssues.filter((iss) => {
    if (!openQuery) return true;
    const hay = [
      String(iss.dcNo),
      iss.receiveName,
      iss.subCode,
      iss.issueFor,
      iss.issueDate,
      iss.status,
      ...(iss.inHouseLines ?? []).map((l) => l.toolOrGaugeNo),
    ]
      .filter(Boolean)
      .join(" ")
      .toLowerCase();
    return hay.includes(openQuery);
  });

  const historyQuery = historySearch.trim().toLowerCase();
  const filteredRecords = records.filter((rcv) => {
    if (!historyQuery) return true;
    const hay = [
      String(rcv.recNo),
      String(rcv.dcNo),
      rcv.partyDcNo,
      rcv.receiverName,
      rcv.status,
      rcv.receiveDate,
      rcv.calibIssue?.receiveName,
      rcv.calibIssue?.issueFor,
      rcv.calibIssue?.subCode,
      ...rcv.lines.map((l) => l.toolOrGaugeNo),
      ...rcv.lines.map((l) => l.description),
      ...rcv.lines.map((l) => l.tool?.name),
    ]
      .filter(Boolean)
      .join(" ")
      .toLowerCase();
    return hay.includes(historyQuery);
  });

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
                  Tick only the tools returning now. Unchecked lines stay open on the DC for a later receive.
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
                    setPartyDcNo("");
                    setReceiverName("");
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
                  <div className="space-y-3">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                      <div className="relative flex-1 max-w-sm">
                        <Search className="w-4 h-4 text-[var(--text-muted)] absolute left-3 top-1/2 -translate-y-1/2" />
                        <input
                          id="calib-receive-open-search"
                          value={openSearch}
                          onChange={(e) => setOpenSearch(e.target.value)}
                          placeholder="Search DC No, lab/party, sub code, tool no…"
                          className="w-full text-sm border border-[var(--border-main)] rounded-lg pl-9 pr-3 py-2 outline-none focus:ring-2 focus:ring-[var(--primary-subtle)] focus:border-[var(--primary)] bg-[var(--bg-subtle)] text-[var(--text-primary)] placeholder-[var(--text-muted)]"
                        />
                      </div>
                      <span className="text-xs text-[var(--text-muted)] font-medium whitespace-nowrap">
                        Showing {filteredOpenIssues.length} of {openIssues.length} open DC
                        {openIssues.length === 1 ? "" : "s"}
                      </span>
                    </div>
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
                        {filteredOpenIssues.map((iss) => (
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
                        {filteredOpenIssues.length === 0 && (
                          <tr>
                            <td colSpan={8} className="py-8 text-center text-sm text-[var(--text-muted)]">
                              No open DCs match “{openSearch}”.
                            </td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                    </div>
                  </div>
                )
              ) : (
                <form onSubmit={handleSubmitReceive} className="space-y-4">
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                    <div>
                      <label className="text-[11px] font-semibold text-[var(--text-muted)] uppercase">
                        Our DC No
                      </label>
                      <p className="mt-1 font-mono text-sm font-bold">{selectedDc}</p>
                    </div>
                    <div>
                      <label className="text-[11px] font-semibold text-[var(--text-muted)] uppercase">
                        DC Date
                      </label>
                      <p className="mt-1 text-sm font-mono">
                        {selectedIssue?.issueDate ? selectedIssue.issueDate.split("T")[0] : "—"}
                      </p>
                    </div>
                    <div>
                      <label className="text-[11px] font-semibold text-[var(--text-muted)] uppercase">
                        GRN / Receive Date *
                      </label>
                      <input
                        type="date"
                        value={receiveDate}
                        onChange={(e) => setReceiveDate(e.target.value)}
                        required
                        className="mt-1 w-full text-sm border border-[var(--border-main)] rounded-lg px-3 py-2 bg-[var(--bg-subtle)]"
                      />
                    </div>
                    <div>
                      <label className="text-[11px] font-semibold text-[var(--text-muted)] uppercase">
                        Party Name
                      </label>
                      <p className="mt-1 text-sm font-semibold truncate">
                        {selectedIssue?.receiveName ?? "—"}
                      </p>
                      {selectedIssue?.subCode && (
                        <p className="text-[10px] text-[var(--text-muted)] font-mono">
                          Sub: {selectedIssue.subCode}
                        </p>
                      )}
                    </div>
                    <div>
                      <label className="text-[11px] font-semibold text-[var(--text-muted)] uppercase">
                        Party DC No
                      </label>
                      <input
                        value={partyDcNo}
                        onChange={(e) => setPartyDcNo(e.target.value)}
                        placeholder="Lab / party DC reference"
                        maxLength={20}
                        className="mt-1 w-full text-sm border border-[var(--border-main)] rounded-lg px-3 py-2 bg-[var(--bg-subtle)]"
                      />
                    </div>
                    <div>
                      <label className="text-[11px] font-semibold text-[var(--text-muted)] uppercase">
                        Receiver Name
                      </label>
                      <input
                        value={receiverName}
                        onChange={(e) => setReceiverName(e.target.value)}
                        placeholder="Who received the tools"
                        maxLength={30}
                        className="mt-1 w-full text-sm border border-[var(--border-main)] rounded-lg px-3 py-2 bg-[var(--bg-subtle)]"
                      />
                      <p className="text-[10px] text-[var(--text-muted)] mt-1">
                        Defaults to your login name — edit if someone else received.
                      </p>
                    </div>
                    <div>
                      <label className="text-[11px] font-semibold text-[var(--text-muted)] uppercase">
                        Issue For
                      </label>
                      <p className="mt-1 text-sm">{selectedIssue?.issueFor ?? "—"}</p>
                    </div>
                  </div>

                  <div className="overflow-auto border border-[var(--border-main)] rounded-xl">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b border-[var(--border-main)] bg-[var(--bg-subtle)]">
                          {["", "Instrument / Gauge No", "Description", "Calibration Price"].map(
                            (col) => (
                              <th
                                key={col || "chk"}
                                className="text-left text-[11px] font-semibold text-[var(--text-muted)] uppercase tracking-wider py-2.5 px-3"
                              >
                                {col}
                              </th>
                            )
                          )}
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
                                value={line.description}
                                disabled={!line.selected}
                                onChange={(e) => {
                                  const next = [...lineDrafts];
                                  next[idx] = { ...line, description: e.target.value.slice(0, 50) };
                                  setLineDrafts(next);
                                }}
                                className="w-full min-w-[140px] text-sm border border-[var(--border-main)] rounded-lg px-2 py-1.5 bg-[var(--bg-subtle)]"
                              />
                            </td>
                            <td className="py-2 px-3">
                              <div className="relative min-w-[140px]">
                                <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-xs text-[var(--text-muted)]">₹</span>
                                <input
                                  type="number"
                                  min="0"
                                  step="0.01"
                                  value={line.price}
                                  disabled={!line.selected}
                                  onChange={(e) => {
                                    const next = [...lineDrafts];
                                    next[idx] = { ...line, price: Math.max(0, Number(e.target.value) || 0) };
                                    setLineDrafts(next);
                                  }}
                                  className="w-full rounded-lg border border-[var(--border-main)] bg-[var(--bg-subtle)] py-1.5 pl-7 pr-2 text-right font-mono text-sm"
                                  aria-label={`Calibration price for ${line.toolOrGaugeNo}`}
                                />
                              </div>
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

                  <div className="flex items-center justify-end gap-3">
                    <span className="text-sm text-[var(--text-muted)]">
                      Total calibration price:{" "}
                      <strong className="font-mono text-[var(--text-primary)]">
                        ₹{lineDrafts.filter((line) => line.selected).reduce((sum, line) => sum + line.price, 0).toFixed(2)}
                      </strong>
                    </span>
                    <Button type="submit" disabled={submitting || lineDrafts.every((l) => !l.selected)}>
                      {submitting ? "Posting…" : "Post Calibration Receive"}
                    </Button>
                  </div>
                </form>
              )}
            </RoleGate>
          </div>

          <div className="bg-[var(--bg-card)] rounded-2xl border border-[var(--border-main)] p-5">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-3">
              <h2 className="text-sm font-semibold text-[var(--text-primary)]">
                Calibration receive history
              </h2>
              {records.length > 0 && (
                <div className="flex flex-col sm:flex-row sm:items-center gap-3 flex-1 sm:justify-end">
                  <div className="relative w-full sm:max-w-xs">
                    <Search className="w-4 h-4 text-[var(--text-muted)] absolute left-3 top-1/2 -translate-y-1/2" />
                    <input
                      id="calib-receive-history-search"
                      value={historySearch}
                      onChange={(e) => setHistorySearch(e.target.value)}
                      placeholder="Search receive #, DC, party, tool…"
                      className="w-full text-sm border border-[var(--border-main)] rounded-lg pl-9 pr-3 py-2 outline-none focus:ring-2 focus:ring-[var(--primary-subtle)] focus:border-[var(--primary)] bg-[var(--bg-subtle)] text-[var(--text-primary)] placeholder-[var(--text-muted)]"
                    />
                  </div>
                  <span className="text-xs text-[var(--text-muted)] font-medium whitespace-nowrap">
                    {filteredRecords.length} of {records.length}
                  </span>
                </div>
              )}
            </div>
            {loading ? (
              <TableSkeleton rows={4} />
            ) : records.length === 0 ? (
              <div className="text-center text-sm text-[var(--text-muted)] py-8">
                No rows in TOOLS_RECEIVE_FOR_CALIBRATION yet. Open issues above are ready to receive when a lab return is posted.
              </div>
            ) : filteredRecords.length === 0 ? (
              <div className="text-center text-sm text-[var(--text-muted)] py-8">
                No receive history matches “{historySearch}”.
              </div>
            ) : (
              <div className="space-y-4">
                {filteredRecords.map((rcv) => {
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
                            {rcv.partyDcNo ? ` · Party DC: ${rcv.partyDcNo}` : ""}
                            {rcv.receiverName ? ` · Receiver: ${rcv.receiverName}` : ""}
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
                                {["Instrument No", "Description", "Group", "Calib Frq", "Price", "Instrument Status", "Files"].map((col) => (
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
                                    <td className="py-2.5 px-3 text-[var(--text-muted)]">
                                      {line.tool?.calibrationFrqMonths ? `${line.tool.calibrationFrqMonths} mo` : "—"}
                                    </td>
                                    <td className="py-2.5 px-3 font-mono text-[var(--text-primary)]">
                                      ₹{Number(line.price ?? 0).toFixed(2)}
                                    </td>
                                    <td className="py-2.5 px-3">
                                      <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-semibold ${sb.bg} ${sb.text}`}>
                                        {toolStatus}
                                      </span>
                                    </td>
                                    <td className="py-2.5 px-3">
                                      {line.toolOrGaugeNo && (
                                        <RoleGate permission="canManageCalibration">
                                          <Button
                                            type="button"
                                            variant="outline"
                                            size="sm"
                                            onClick={() =>
                                              setUploadTarget({
                                                toolOrGaugeNo: line.toolOrGaugeNo as string,
                                                dcNo: rcv.dcNo,
                                              })
                                            }
                                          >
                                            <Upload className="w-3.5 h-3.5" />
                                            Upload
                                          </Button>
                                        </RoleGate>
                                      )}
                                    </td>
                                  </tr>
                                );
                              })}
                            </tbody>
                          </table>
                          <div className="mt-3">
                            <ToolDocumentsPanel
                              dcNo={String(rcv.dcNo)}
                              defaultDocType="CALIB_CERTIFICATE"
                              allowedTypes={["CALIB_CERTIFICATE", "CALIB_REPORT", "DC_ATTACHMENT", "OTHER"]}
                              title={`DC #${rcv.dcNo} attachments`}
                              uploadButtonLabel="Upload/Change Image"
                              compact
                            />
                          </div>
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

      {uploadTarget && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-black/40 backdrop-blur-xs flex items-start justify-center p-4 sm:p-8">
          <div className="w-full max-w-lg bg-[var(--bg-card)] rounded-2xl border border-[var(--border-main)] shadow-2xl overflow-hidden animate-fade-in my-auto">
            <div className="px-5 py-4 border-b border-[var(--border-main)] flex items-center justify-between">
              <div>
                <h2 className="text-base font-bold text-[var(--text-primary)]">Upload / Change Image</h2>
                <p className="text-xs text-[var(--text-muted)] mt-0.5 font-mono">
                  {uploadTarget.toolOrGaugeNo} · DC #{uploadTarget.dcNo}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setUploadTarget(null)}
                className="text-[var(--text-muted)] hover:text-[var(--text-primary)]"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-5">
              <ToolDocumentsPanel
                toolOrGaugeNo={uploadTarget.toolOrGaugeNo}
                dcNo={String(uploadTarget.dcNo)}
                defaultDocType="CALIB_CERTIFICATE"
                allowedTypes={["CALIB_CERTIFICATE", "CALIB_REPORT", "OTHER"]}
                title="Certificate / Image Files"
                uploadButtonLabel="Upload/Change Image"
              />
            </div>
            <div className="px-5 py-3 border-t border-[var(--border-main)] flex justify-end">
              <Button type="button" variant="outline" size="sm" onClick={() => setUploadTarget(null)}>
                Close
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
