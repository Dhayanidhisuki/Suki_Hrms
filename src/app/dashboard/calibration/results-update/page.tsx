"use client";

import { useState, useEffect, useCallback } from "react";
import { Search, Check, X, ClipboardList, CheckCircle2, RefreshCw, Clock, FileSpreadsheet, FileText, Upload } from "lucide-react";
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
  description?: string | null;
  grouping?: string | null;
  type: string;
  status: string;
  frequency: string;
  calibrationFrqMonths?: number | null;
  serialNo?: number | null;
  location?: string | null;
  locationName?: string | null;
  calibDueDate?: string | null;
  cDate?: string | null;
  nextCDate?: string | null;
  remarks?: string | null;
  dcNo?: string | number | null;
  calibratedBy?: string | null;
  gSpecUpperMin?: number | string | null;
  gSpecUpperMax?: number | string | null;
  wLimitLowerMax?: number | string | null;
  wLimitUpperMin?: number | string | null;
  wLimitUpperMax?: number | string | null;
  prodSpecLowerMax?: number | string | null;
  prodSpecUpperMin?: number | string | null;
  prodSpecUpperMax?: number | string | null;
}

type LocationOption = { locationName: string; area?: string | null; rack?: string | null };

const fmtDate = (v?: string | null) => (v ? String(v).split("T")[0] : "—");
const fmtNum = (v?: number | string | null) =>
  v == null || v === "" ? "—" : String(v);

const RESULT_OPTIONS = [
  { value: "AVAILABLE FOR USE", label: "AVAILABLE FOR USE" },
  { value: "PASSED", label: "PASSED (Fit for use)" },
  { value: "RECALIBRATED", label: "RECALIBRATED (Adjusted)" },
  { value: "FAILED", label: "FAILED (Scrap / Out of Tol)" },
  { value: "OUT OF SERVICE", label: "OUT OF SERVICE" },
] as const;

export default function CalibrationResultsUpdatePage() {
  const { showSuccess } = useSuccessOverlay();
  const [items, setItems] = useState<CalibrationRecord[]>([]);
  const [locations, setLocations] = useState<LocationOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("All");
  const [bannerMsg, setBannerMsg] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const [exporting, setExporting] = useState<"xlsx" | "pdf" | null>(null);

  const [selectedRecord, setSelectedRecord] = useState<CalibrationRecord | null>(null);
  const [uploadRecord, setUploadRecord] = useState<CalibrationRecord | null>(null);
  const [calibResult, setCalibResult] = useState<string>("AVAILABLE FOR USE");
  const [certificateNo, setCertificateNo] = useState("");
  const [referenceStandard, setReferenceStandard] = useState("");
  const [errorNoticed, setErrorNoticed] = useState("");
  const [comments, setComments] = useState("");
  const [calibratedBy, setCalibratedBy] = useState("");
  const [calibratedDate, setCalibratedDate] = useState("");
  const [nextDate, setNextDate] = useState("");
  const [location, setLocation] = useState("");

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
    const [res, locRes] = await Promise.all([
      apiGet<{ items: CalibrationRecord[] }>("/api/calibration/results-update"),
      apiGet<{ items: LocationOption[] }>("/api/lookups/locations"),
    ]);
    if (res.data?.items) setItems(res.data.items);
    else setItems([]);
    if (locRes.data?.items) setLocations(locRes.data.items);
    setLoading(false);
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleOpenUpdate = (rec: CalibrationRecord) => {
    setSelectedRecord(rec);
    setCalibResult("AVAILABLE FOR USE");
    setCertificateNo("");
    setReferenceStandard("");
    setErrorNoticed("");
    setComments(rec.remarks || "");
    setCalibratedBy(rec.calibratedBy || "");
    setCalibratedDate(new Date().toISOString().split("T")[0]);
    const months = rec.calibrationFrqMonths && rec.calibrationFrqMonths > 0 ? rec.calibrationFrqMonths : 6;
    const next = new Date();
    next.setMonth(next.getMonth() + months);
    setNextDate(rec.nextCDate ? fmtDate(rec.nextCDate) : next.toISOString().split("T")[0]);
    setLocation(rec.locationName || rec.location || "");
    setBannerMsg(null);
  };

  const handleSaveResult = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedRecord) return;
    if (!calibratedDate) {
      setBannerMsg({ type: "error", text: "Calibrated Date is required." });
      return;
    }

    setBannerMsg(null);
    const res = await apiPost("/api/calibration/results-update", {
      toolOrGaugeNo: selectedRecord.toolOrGaugeNo,
      result: calibResult,
      certificateNo: certificateNo.trim() || undefined,
      referenceStandard: referenceStandard.trim() || undefined,
      errorNoticed: errorNoticed.trim() || undefined,
      comments: comments.trim() || undefined,
      remarks: comments.trim() || certificateNo.trim() || undefined,
      calibratedBy: calibratedBy.trim() || undefined,
      calibratedDate,
      nextCDate: nextDate,
      location: location.trim() || undefined,
      locationName: location.trim() || undefined,
    });

    if (res.error) {
      setBannerMsg({ type: "error", text: res.error.message });
      return;
    }

    setBannerMsg({
      type: "success",
      text: `Calibration result recorded for ${selectedRecord.toolOrGaugeNo} (${calibResult}).`,
    });
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
                value: items.filter((i) => i.status === "Under Calibration" || i.status === "Pending").length,
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
                value: items.filter(
                  (i) =>
                    i.nextCDate &&
                    new Date(i.nextCDate) <= new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)
                ).length,
                subtext: "Upcoming calibration due date",
                icon: RefreshCw,
                iconBg: "bg-amber-50 dark:bg-amber-950/30",
                iconColor: "text-amber-600 dark:text-amber-400",
                badge: { label: "Upcoming", type: "warning" },
              },
            ]}
          />

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
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="text-sm border border-[var(--border-main)] rounded-lg px-3 py-2 bg-[var(--bg-subtle)] outline-none focus:ring-2 focus:ring-[var(--primary-subtle)] font-medium text-[var(--text-primary)]"
            >
              <option value="All">All Statuses</option>
              <option value="Under Calibration">Under Calibration</option>
              <option value="Pending">Pending</option>
              <option value="Received">Received</option>
              <option value="Available">Available</option>
            </select>
          </div>

          <div className="bg-[var(--bg-card)] rounded-2xl border border-[var(--border-main)] p-5 animate-fade-in">
            {loading ? (
              <TableSkeleton rows={5} />
            ) : (
              <div className="overflow-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-[var(--border-main)] bg-[var(--bg-subtle)]">
                      {[
                        "Tool / Gauge No",
                        "Name",
                        "Type",
                        "Calibration Freq",
                        "Last Calib Date",
                        "Next Calib Due",
                        "Remarks",
                        "Status",
                        "Actions",
                      ].map((col) => (
                        <th
                          key={col}
                          className="text-left text-[11px] font-semibold text-[var(--text-muted)] uppercase tracking-wider py-2.5 px-3"
                        >
                          {col}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[var(--border-main)]">
                    {filtered.map((item) => (
                      <tr key={item.refNo} className="hover:bg-[var(--bg-hover)] transition-colors">
                        <td className="py-3.5 px-3 font-mono text-xs font-bold text-[var(--text-primary)]">
                          {item.toolOrGaugeNo}
                        </td>
                        <td className="py-3.5 px-3 max-w-[180px]">
                          <p className="font-medium text-[var(--text-primary)] truncate">{item.name ?? "—"}</p>
                          {item.grouping && (
                            <p className="text-[11px] text-[var(--text-muted)] truncate">{item.grouping}</p>
                          )}
                        </td>
                        <td className="py-3.5 px-3 font-medium text-[var(--text-secondary)]">
                          {item.type ?? "—"}
                        </td>
                        <td className="py-3.5 px-3 font-mono text-xs text-[var(--text-muted)]">
                          {item.frequency || "—"}
                        </td>
                        <td className="py-3.5 px-3 font-mono text-xs text-[var(--text-muted)]">
                          {fmtDate(item.cDate)}
                        </td>
                        <td className="py-3.5 px-3 font-mono text-xs font-semibold text-amber-600 dark:text-amber-400">
                          {fmtDate(item.nextCDate)}
                        </td>
                        <td className="py-3.5 px-3 text-xs text-[var(--text-muted)] max-w-[160px] truncate">
                          {item.remarks ?? "—"}
                        </td>
                        <td className="py-3.5 px-3">
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold bg-amber-50 dark:bg-amber-950/30 text-amber-600 dark:text-amber-400 border border-amber-200">
                            <span className="w-1.5 h-1.5 rounded-full bg-amber-500" />
                            {item.status}
                          </span>
                        </td>
                        <td className="py-3.5 px-3">
                          <div className="flex items-center gap-2 flex-wrap">
                            <RoleGate permission="canManageCalibration">
                              <Button
                                type="button"
                                variant="outline"
                                size="sm"
                                onClick={() => setUploadRecord(item)}
                                title="Upload / change certificate or image"
                              >
                                <Upload className="w-3.5 h-3.5" />
                                Upload
                              </Button>
                              <Button onClick={() => handleOpenUpdate(item)} variant="primary" size="sm">
                                Update Result
                              </Button>
                            </RoleGate>
                          </div>
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

      {selectedRecord && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-black/40 backdrop-blur-xs flex items-start justify-center p-4 sm:p-8">
          <div className="w-full max-w-4xl bg-[var(--bg-card)] rounded-2xl border border-[var(--border-main)] shadow-2xl overflow-hidden animate-fade-in my-auto max-h-[94vh] flex flex-col">
            <div className="px-5 py-4 border-b border-[var(--border-main)] flex items-center justify-between shrink-0">
              <h2 className="text-base font-bold text-[var(--text-primary)]">Update Calibration Results</h2>
              <button
                onClick={() => setSelectedRecord(null)}
                className="text-[var(--text-muted)] hover:text-[var(--text-primary)]"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveResult} className="p-5 space-y-5 overflow-y-auto">
              {/* Tool identity — ERP header */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                <ReadField label="Gauge/Tool No" value={selectedRecord.toolOrGaugeNo} mono />
                <ReadField label="Sl. No" value={selectedRecord.serialNo != null ? String(selectedRecord.serialNo) : "—"} mono />
                <ReadField label="Group" value={selectedRecord.grouping || "—"} />
                <ReadField label="Type" value={selectedRecord.type || "—"} />
                <ReadField label="Name" value={selectedRecord.name || "—"} />
                <ReadField label="Description" value={selectedRecord.description || "—"} />
                <ReadField label="Calib. Due Dt." value={fmtDate(selectedRecord.calibDueDate)} mono />
                <ReadField label="Current Status" value={selectedRecord.status || "—"} />
                <div>
                  <label className="block text-[11px] font-semibold text-[var(--text-muted)] uppercase tracking-wider mb-1">
                    Location
                  </label>
                  <select
                    value={location}
                    onChange={(e) => setLocation(e.target.value)}
                    className="w-full text-sm border border-[var(--border-main)] rounded-lg px-3 py-2 bg-[var(--bg-subtle)] text-[var(--text-primary)]"
                  >
                    <option value="">-Select-</option>
                    {location && !locations.some((l) => l.locationName === location) && (
                      <option value={location}>{location}</option>
                    )}
                    {locations.map((l) => (
                      <option key={l.locationName} value={l.locationName}>
                        {l.locationName}
                      </option>
                    ))}
                  </select>
                </div>
                <ReadField
                  label="Calib. Freq (Months)"
                  value={
                    selectedRecord.calibrationFrqMonths != null
                      ? String(selectedRecord.calibrationFrqMonths)
                      : selectedRecord.frequency || "—"
                  }
                  mono
                />
              </div>

              {/* Spec snapshot */}
              <div className="border border-[var(--border-main)] rounded-xl p-4 bg-[var(--bg-subtle)]">
                <p className="text-[11px] font-semibold text-[var(--text-muted)] uppercase tracking-wider mb-3">
                  Technical Specifications (from tool master)
                </p>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
                  <ReadField label="Gauge Spec Upper Min" value={fmtNum(selectedRecord.gSpecUpperMin)} mono />
                  <ReadField label="Gauge Spec Upper Max" value={fmtNum(selectedRecord.gSpecUpperMax)} mono />
                  <ReadField label="Wear Limit Lower Max" value={fmtNum(selectedRecord.wLimitLowerMax)} mono />
                  <ReadField label="Wear Limit Upper Min" value={fmtNum(selectedRecord.wLimitUpperMin)} mono />
                  <ReadField label="Wear Limit Upper Max" value={fmtNum(selectedRecord.wLimitUpperMax)} mono />
                  <ReadField label="Prod Spec Lower Max" value={fmtNum(selectedRecord.prodSpecLowerMax)} mono />
                  <ReadField label="Prod Spec Upper Min" value={fmtNum(selectedRecord.prodSpecUpperMin)} mono />
                  <ReadField label="Prod Spec Upper Max" value={fmtNum(selectedRecord.prodSpecUpperMax)} mono />
                </div>
              </div>

              {/* Result entry */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="sm:col-span-2">
                  <label className="block text-[11px] font-semibold text-[var(--text-muted)] uppercase tracking-wider mb-1">
                    Reference Standard
                  </label>
                  <input
                    value={referenceStandard}
                    onChange={(e) => setReferenceStandard(e.target.value)}
                    className="w-full text-sm border border-[var(--border-main)] rounded-lg px-3 py-2 bg-[var(--bg-subtle)]"
                  />
                </div>
                <div className="sm:col-span-2">
                  <label className="block text-[11px] font-semibold text-[var(--text-muted)] uppercase tracking-wider mb-1">
                    Error Noticed
                  </label>
                  <input
                    value={errorNoticed}
                    onChange={(e) => setErrorNoticed(e.target.value)}
                    className="w-full text-sm border border-[var(--border-main)] rounded-lg px-3 py-2 bg-[var(--bg-subtle)]"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-semibold text-[var(--text-muted)] uppercase tracking-wider mb-1">
                    Certificate No
                  </label>
                  <input
                    value={certificateNo}
                    onChange={(e) => setCertificateNo(e.target.value)}
                    className="w-full text-sm border border-[var(--border-main)] rounded-lg px-3 py-2 bg-[var(--bg-subtle)] font-mono"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-semibold text-[var(--text-muted)] uppercase tracking-wider mb-1">
                    Calibrated Dt. *
                  </label>
                  <input
                    type="date"
                    required
                    value={calibratedDate}
                    onChange={(e) => setCalibratedDate(e.target.value)}
                    className="w-full text-sm border border-[var(--border-main)] rounded-lg px-3 py-2 bg-[var(--bg-subtle)] font-mono"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-semibold text-[var(--text-muted)] uppercase tracking-wider mb-1">
                    Next Calib. Dt. *
                  </label>
                  <input
                    type="date"
                    required
                    value={nextDate}
                    onChange={(e) => setNextDate(e.target.value)}
                    className="w-full text-sm border border-[var(--border-main)] rounded-lg px-3 py-2 bg-[var(--bg-subtle)] font-mono"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-semibold text-[var(--text-muted)] uppercase tracking-wider mb-1">
                    Result Status *
                  </label>
                  <select
                    value={calibResult}
                    onChange={(e) => setCalibResult(e.target.value)}
                    className="w-full text-sm border border-[var(--border-main)] rounded-lg px-3 py-2 bg-[var(--bg-subtle)] font-medium"
                  >
                    {RESULT_OPTIONS.map((o) => (
                      <option key={o.value} value={o.value}>
                        {o.label}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-[11px] font-semibold text-[var(--text-muted)] uppercase tracking-wider mb-1">
                    Calibrated By
                  </label>
                  <input
                    value={calibratedBy}
                    onChange={(e) => setCalibratedBy(e.target.value)}
                    placeholder="Technician / lab name"
                    maxLength={25}
                    className="w-full text-sm border border-[var(--border-main)] rounded-lg px-3 py-2 bg-[var(--bg-subtle)]"
                  />
                </div>
                <div className="sm:col-span-2">
                  <label className="block text-[11px] font-semibold text-[var(--text-muted)] uppercase tracking-wider mb-1">
                    Comments
                  </label>
                  <textarea
                    rows={2}
                    value={comments}
                    onChange={(e) => setComments(e.target.value)}
                    className="w-full text-sm border border-[var(--border-main)] rounded-lg px-3 py-2 bg-[var(--bg-subtle)] resize-none"
                  />
                </div>
              </div>

              <ToolDocumentsPanel
                toolOrGaugeNo={selectedRecord.toolOrGaugeNo}
                calibRowId={selectedRecord.refNo}
                dcNo={selectedRecord.dcNo != null ? String(selectedRecord.dcNo) : null}
                defaultDocType="CALIB_CERTIFICATE"
                allowedTypes={["CALIB_CERTIFICATE", "CALIB_REPORT", "OTHER"]}
                title="Upload / Change Image & Certificate"
                uploadButtonLabel="Upload/Change Image"
                compact
              />

              <div className="pt-3 border-t border-[var(--border-main)] flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setSelectedRecord(null)}
                  className="px-4 py-2 text-xs font-semibold text-[var(--text-muted)] hover:text-[var(--text-primary)]"
                >
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

      {/* Upload-only modal — available on every pending record */}
      {uploadRecord && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-black/40 backdrop-blur-xs flex items-start justify-center p-4 sm:p-8">
          <div className="w-full max-w-lg bg-[var(--bg-card)] rounded-2xl border border-[var(--border-main)] shadow-2xl overflow-hidden animate-fade-in my-auto">
            <div className="px-5 py-4 border-b border-[var(--border-main)] flex items-center justify-between">
              <div>
                <h2 className="text-base font-bold text-[var(--text-primary)]">Upload / Change Image</h2>
                <p className="text-xs text-[var(--text-muted)] mt-0.5 font-mono">
                  {uploadRecord.toolOrGaugeNo}
                  {uploadRecord.dcNo != null ? ` · DC #${uploadRecord.dcNo}` : ""}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setUploadRecord(null)}
                className="text-[var(--text-muted)] hover:text-[var(--text-primary)]"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-5">
              <ToolDocumentsPanel
                toolOrGaugeNo={uploadRecord.toolOrGaugeNo}
                calibRowId={uploadRecord.refNo}
                dcNo={uploadRecord.dcNo != null ? String(uploadRecord.dcNo) : null}
                defaultDocType="CALIB_CERTIFICATE"
                allowedTypes={["CALIB_CERTIFICATE", "CALIB_REPORT", "OTHER"]}
                title="Certificate / Image Files"
                uploadButtonLabel="Upload/Change Image"
              />
            </div>
            <div className="px-5 py-3 border-t border-[var(--border-main)] flex justify-end">
              <Button type="button" variant="outline" size="sm" onClick={() => setUploadRecord(null)}>
                Close
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function ReadField({
  label,
  value,
  mono,
}: {
  label: string;
  value: string;
  mono?: boolean;
}) {
  return (
    <div>
      <p className="text-[11px] font-semibold text-[var(--text-muted)] uppercase tracking-wider">{label}</p>
      <p className={`mt-1 text-sm text-[var(--text-primary)] ${mono ? "font-mono" : "font-medium"} truncate`}>
        {value}
      </p>
    </div>
  );
}
