"use client";

import { useState, useEffect, useCallback } from "react";
import { Search, ShieldAlert, Check, X, Filter, ClipboardList, CheckCircle2, RefreshCw, Clock, FileSpreadsheet, FileText } from "lucide-react";
import Sidebar from "@/app/dashboard/components/Sidebar";
import TopBar from "@/app/dashboard/components/TopBar";
import RoleGate from "@/app/dashboard/components/RoleGate";
import { TableSkeleton } from "@/app/dashboard/components/LoadingSkeleton";
import { ModuleKpiRow } from "@/app/dashboard/components/ModuleKpiRow";
import { apiGet, apiPost } from "@/lib/apiClient";
import { Button } from "@/components/ui/button";
import { ToolDocumentsPanel } from "@/components/ToolDocumentsPanel";
import { useSuccessOverlay } from "@/components/SuccessOverlay";

interface CalibrationRecord {
  refNo: number;
  toolOrGaugeNo: string;
  name?: string | null;
  grouping?: string | null;
  type: string;
  status: string;
  frequency: string;
  cDate?: string | null;
  nextCDate?: string | null;
  remarks?: string | null;
  dcNo?: string | number | null;
}

const fmtDate = (v?: string | null) => (v ? v.split("T")[0] : "—");

export default function CalibrationResultsUpdatePage() {
  const { showSuccess } = useSuccessOverlay();
  const [items, setItems] = useState<CalibrationRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("All");
  const [bannerMsg, setBannerMsg] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const [exporting, setExporting] = useState<"xlsx" | "pdf" | null>(null);

  // Selected tool for updating result modal
  const [selectedRecord, setSelectedRecord] = useState<CalibrationRecord | null>(null);
  const [calibResult, setCalibResult] = useState<"PASSED" | "FAILED" | "RECALIBRATED">("PASSED");
  const [remarks, setRemarks] = useState("");
  const [nextDate, setNextDate] = useState("");

  const handleExport = async (format: "xlsx" | "pdf") => {
    setExporting(format);
    setBannerMsg(null);
    try {
      const res = await fetch(`/api/calibration/results-update/export?format=${format}`, {
        credentials: "include",
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(
          typeof body.error === "string" ? body.error : `Export failed (${res.status})`
        );
      }
      const blob = await res.blob();
      const disposition = res.headers.get("Content-Disposition") ?? "";
      const match = disposition.match(/filename="?([^"]+)"?/i);
      const filename =
        match?.[1] ?? `calibration_results_pending.${format === "xlsx" ? "xlsx" : "pdf"}`;
      const count = res.headers.get("X-Export-Count");
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
      setBannerMsg({
        type: "success",
        text: count
          ? `Downloaded ${filename} (${Number(count).toLocaleString()} rows).`
          : `Downloaded ${filename}.`,
      });
    } catch (err) {
      setBannerMsg({
        type: "error",
        text: err instanceof Error ? err.message : "Export failed",
      });
    } finally {
      setExporting(null);
    }
  };

  const loadData = useCallback(async () => {
    setLoading(true);
    const res = await apiGet<{ items: CalibrationRecord[] }>("/api/calibration/results-update");
    if (res.data?.items) {
      setItems(res.data.items);
    } else {
      setItems([]);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleOpenUpdate = (rec: CalibrationRecord) => {
    setSelectedRecord(rec);
    setCalibResult("PASSED");
    setRemarks(rec.remarks || "");
    const today = new Date();
    today.setMonth(today.getMonth() + 6);
    setNextDate(today.toISOString().split("T")[0]);
    setBannerMsg(null);
  };

  const handleSaveResult = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedRecord) return;

    setBannerMsg(null);
    const res = await apiPost("/api/calibration/results-update", {
      toolOrGaugeNo: selectedRecord.toolOrGaugeNo,
      result: calibResult,
      remarks,
      nextCDate: nextDate,
    });

    if (res.error) {
      setBannerMsg({ type: "error", text: res.error.message });
      return;
    }

    setBannerMsg({ type: "success", text: `Calibration result recorded for ${selectedRecord.toolOrGaugeNo} (${calibResult}).` });
    showSuccess({
      title: "Result saved",
      message: `Calibration result recorded (${calibResult}).`,
      detail: selectedRecord.toolOrGaugeNo,
    });
    setSelectedRecord(null);
    loadData();
  };

  const filtered = items.filter((item) => {
    const q = query.toLowerCase();
    const matchesSearch =
      item.toolOrGaugeNo.toLowerCase().includes(q) ||
      (item.name || "").toLowerCase().includes(q) ||
      (item.type || "").toLowerCase().includes(q) ||
      (item.remarks || "").toLowerCase().includes(q);

    const matchesStatus = statusFilter === "All" || item.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  return (
    <div className="flex h-screen bg-[var(--bg-app)] text-[var(--text-primary)] overflow-hidden">
      <Sidebar />
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        <TopBar />
        <main className="flex-1 overflow-y-auto px-7 py-6">
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

          {/* ── Header ── */}
          <div className="flex items-center justify-between mb-6 gap-4 flex-wrap">
            <div>
              <h1 className="text-2xl font-bold text-[var(--text-primary)] tracking-tight">
                Calibration Results Update
              </h1>
              <p className="text-sm text-[var(--text-muted)] mt-0.5">
                Update inspection results, certificate details & next calibration due dates
              </p>
            </div>
            <div className="flex items-center gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={exporting !== null || items.length === 0}
                onClick={() => void handleExport("xlsx")}
              >
                <FileSpreadsheet className="w-4 h-4" />
                {exporting === "xlsx" ? "Downloading…" : "Download Excel"}
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={exporting !== null || items.length === 0}
                onClick={() => void handleExport("pdf")}
              >
                <FileText className="w-4 h-4" />
                {exporting === "pdf" ? "Downloading…" : "Download PDF"}
              </Button>
            </div>
          </div>

          {/* ── Module KPI Cards ── */}
          <ModuleKpiRow
            items={[
              {
                id: "pending-verification",
                label: "Pending Update",
                value: items.length,
                subtext: "Records awaiting certificate update",
                icon: ClipboardList,
                iconBg: "bg-[var(--primary-light)]",
                iconColor: "text-[var(--primary)]",
                badge: { label: "Pending", type: "info" },
              },
              {
                id: "under-calibration",
                label: "In QC Calibration Lab",
                value: items.filter((i) => i.status === "Under Calibration").length,
                subtext: "Currently undergoing verification",
                icon: Clock,
                iconBg: "bg-blue-50 dark:bg-blue-950/30",
                iconColor: "text-blue-600 dark:text-blue-400",
                badge: { label: "In Lab", type: "info" },
              },
              {
                id: "passed-inspection",
                label: "Passed Verification",
                value: items.filter((i) => i.status === "Available" || i.status === "Passed").length,
                subtext: "Verified fit for use",
                icon: CheckCircle2,
                iconBg: "bg-emerald-50 dark:bg-emerald-950/30",
                iconColor: "text-emerald-600 dark:text-emerald-400",
                badge: { label: "Passed", type: "success" },
              },
              {
                id: "due-this-month",
                label: "Due Next 30 Days",
                value: items.filter((i) => i.nextCDate && new Date(i.nextCDate) <= new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)).length,
                subtext: "Upcoming calibration due date",
                icon: RefreshCw,
                iconBg: "bg-amber-50 dark:bg-amber-950/30",
                iconColor: "text-amber-600 dark:text-amber-400",
                badge: { label: "Upcoming", type: "warning" },
              },
            ]}
          />

          {/* ── Search & Filter Card ── */}
          <div className="bg-[var(--bg-card)] rounded-2xl border border-[var(--border-main)] p-5 mb-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="relative flex-1 max-w-sm">
              <Search className="w-4 h-4 text-[var(--text-muted)] absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search tool number, type, or remarks..."
                className="w-full text-sm border border-[var(--border-main)] rounded-lg pl-9 pr-3 py-2 outline-none focus:ring-2 focus:ring-[var(--primary-subtle)] focus:border-[var(--primary)] bg-[var(--bg-subtle)] text-[var(--text-primary)] placeholder-[var(--text-muted)]"
              />
            </div>
            <div className="flex items-center gap-3">
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="text-sm border border-[var(--border-main)] rounded-lg px-3 py-2 bg-[var(--bg-subtle)] outline-none focus:ring-2 focus:ring-[var(--primary-subtle)] font-medium text-[var(--text-primary)]"
              >
                <option value="All">All Statuses</option>
                <option value="Under Calibration">Under Calibration</option>
                <option value="Available">Available</option>
              </select>
            </div>
          </div>

          {/* ── Data Table Card ── */}
          <div className="bg-[var(--bg-card)] rounded-2xl border border-[var(--border-main)] p-5 animate-fade-in">
            {loading ? (
              <TableSkeleton rows={5} />
            ) : (
              <div className="overflow-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-[var(--border-main)] bg-[var(--bg-subtle)]">
                      {["Tool / Gauge No", "Name", "Type", "Calibration Freq", "Last Calib Date", "Next Calib Due", "Remarks", "Status", "Actions"].map((col) => (
                        <th key={col} className="text-left text-[11px] font-semibold text-[var(--text-muted)] uppercase tracking-wider py-2.5 px-3">
                          {col}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[var(--border-main)]">
                    {filtered.map((item) => (
                      <tr key={item.refNo} className="hover:bg-[var(--bg-hover)] transition-colors">
                        <td className="py-3.5 px-3 font-mono text-xs font-bold text-[var(--text-primary)]">{item.toolOrGaugeNo}</td>
                        <td className="py-3.5 px-3 max-w-[180px]">
                          <p className="font-medium text-[var(--text-primary)] truncate">{item.name ?? "—"}</p>
                          {item.grouping && <p className="text-[11px] text-[var(--text-muted)] truncate">{item.grouping}</p>}
                        </td>
                        <td className="py-3.5 px-3 font-medium text-[var(--text-secondary)]">{item.type ?? "—"}</td>
                        <td className="py-3.5 px-3 font-mono text-xs text-[var(--text-muted)]">{item.frequency ? `${item.frequency} mo` : "—"}</td>
                        <td className="py-3.5 px-3 font-mono text-xs text-[var(--text-muted)]">{fmtDate(item.cDate)}</td>
                        <td className="py-3.5 px-3 font-mono text-xs font-semibold text-amber-600 dark:text-amber-400">{fmtDate(item.nextCDate)}</td>
                        <td className="py-3.5 px-3 text-xs text-[var(--text-muted)] max-w-[160px] truncate">{item.remarks ?? "—"}</td>
                        <td className="py-3.5 px-3">
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold bg-amber-50 dark:bg-amber-950/30 text-amber-600 dark:text-amber-400 border border-amber-200">
                            <span className="w-1.5 h-1.5 rounded-full bg-amber-500" />
                            {item.status}
                          </span>
                        </td>
                        <td className="py-3.5 px-3">
                          <RoleGate permission="canEditMaster">
                            <Button onClick={() => handleOpenUpdate(item)} variant="primary" size="sm">
                              Update Result
                            </Button>
                          </RoleGate>
                        </td>
                      </tr>
                    ))}
                    {filtered.length === 0 && (
                      <tr>
                        <td colSpan={9} className="py-8 text-center text-sm text-[var(--text-muted)]">
                          No calibration pending records found.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </main>
      </div>

      {/* ── Result Update Modal ── */}
      {selectedRecord && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-black/40 backdrop-blur-xs flex items-start justify-center p-4 sm:p-8">
          <div className="w-full max-w-lg bg-[var(--bg-card)] rounded-2xl border border-[var(--border-main)] shadow-2xl overflow-hidden animate-fade-in my-auto max-h-[92vh] flex flex-col">
            <div className="px-5 py-4 border-b border-[var(--border-main)] flex items-center justify-between shrink-0">
              <h2 className="text-base font-bold text-[var(--text-primary)]">
                Update Calibration Result
              </h2>
              <button onClick={() => setSelectedRecord(null)} className="text-[var(--text-muted)] hover:text-[var(--text-primary)]">
                <X className="w-5 h-5" />
              </button>
            </div>
            <form onSubmit={handleSaveResult} className="p-5 space-y-4 overflow-y-auto">
              <div className="p-3 bg-[var(--bg-subtle)] rounded-xl border border-[var(--border-main)]">
                <p className="text-xs text-[var(--text-muted)] font-semibold uppercase">Tool Number</p>
                <p className="text-sm font-mono font-bold text-[var(--text-primary)]">{selectedRecord.toolOrGaugeNo}</p>
              </div>

              <div>
                <label className="block text-xs font-semibold text-[var(--text-muted)] uppercase tracking-wider mb-1">Inspection Result *</label>
                <select value={calibResult} onChange={(e) => setCalibResult(e.target.value as any)} className="w-full text-sm border border-[var(--border-main)] rounded-lg px-3 py-2 bg-[var(--bg-subtle)] text-[var(--text-primary)] font-medium">
                  <option value="PASSED">PASSED (Fit for use)</option>
                  <option value="FAILED">FAILED (Scrap / Out of Tol)</option>
                  <option value="RECALIBRATED">RECALIBRATED (Adjusted)</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-[var(--text-muted)] uppercase tracking-wider mb-1">Next Calibration Due Date</label>
                <input type="date" value={nextDate} onChange={(e) => setNextDate(e.target.value)} className="w-full text-sm border border-[var(--border-main)] rounded-lg px-3 py-2 bg-[var(--bg-subtle)] text-[var(--text-primary)] font-mono" />
              </div>

              <div>
                <label className="block text-xs font-semibold text-[var(--text-muted)] uppercase tracking-wider mb-1">Certificate / Remarks</label>
                <textarea rows={3} value={remarks} onChange={(e) => setRemarks(e.target.value)} placeholder="Enter calibration certificate number, lab details, tolerance values..." className="w-full text-sm border border-[var(--border-main)] rounded-lg px-3 py-2 bg-[var(--bg-subtle)] text-[var(--text-primary)] resize-none" />
              </div>

              <ToolDocumentsPanel
                toolOrGaugeNo={selectedRecord.toolOrGaugeNo}
                calibRowId={selectedRecord.refNo}
                dcNo={selectedRecord.dcNo != null ? String(selectedRecord.dcNo) : null}
                defaultDocType="CALIB_CERTIFICATE"
                allowedTypes={["CALIB_CERTIFICATE", "CALIB_REPORT", "OTHER"]}
                title="Certificate / Result Files"
                compact
              />

              <div className="pt-3 border-t border-[var(--border-main)] flex justify-end gap-2">
                <button type="button" onClick={() => setSelectedRecord(null)} className="px-4 py-2 text-xs font-semibold text-[var(--text-muted)] hover:text-[var(--text-primary)]">
                  Cancel
                </button>
                <Button type="submit" variant="primary" size="sm">
                  <Check className="w-4 h-4" /> Save Calibration Result
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
