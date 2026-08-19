"use client";

import { useState, useEffect, useCallback } from "react";
import { Check, X, ClipboardList, CheckCircle2, RefreshCw, Clock, FileSpreadsheet, FileText, Upload } from "lucide-react";
import Sidebar from "@/app/dashboard/components/Sidebar";
import TopBar from "@/app/dashboard/components/TopBar";
import RoleGate from "@/app/dashboard/components/RoleGate";
import { TableSkeleton } from "@/app/dashboard/components/LoadingSkeleton";
import { ModuleKpiRow } from "@/app/dashboard/components/ModuleKpiRow";
import { apiGet, apiPost } from "@/lib/apiClient";
import { Button } from "@/components/ui/button";
import { MasterSearchInput, MasterTableCard } from "@/components/ui/MasterTableCard";
import { SelectionFilter } from "@/components/ui/SelectionFilter";
import { StatusPillTabs } from "@/components/ui/StatusPillTabs";
import { ToolDocumentsPanel } from "@/components/ToolDocumentsPanel";
import { toastSuccess, toastError } from "@/lib/appToast";
import { MasterSearchSelect } from "@/components/ui/MasterSearchSelect";
import { StatusBadge } from "@/components/ui/StatusBadge";

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
  receiveName?: string | null;
  issueFor?: string | null;
  calibratedBy?: string | null;
  certificateNo?: string | null;
  referenceStandard?: string | null;
  errorNoticed?: string | null;
  comments?: string | null;
  gSpecUpperMin?: number | string | null;
  gSpecUpperMax?: number | string | null;
  wLimitLowerMax?: number | string | null;
  wLimitUpperMin?: number | string | null;
  wLimitUpperMax?: number | string | null;
  prodSpecLowerMax?: number | string | null;
  prodSpecUpperMin?: number | string | null;
  prodSpecUpperMax?: number | string | null;
}

const fmtDate = (v?: string | null) => (v ? String(v).split("T")[0] : "—");
const fmtNum = (v?: number | string | null) =>
  v == null || v === "" ? "—" : String(v);

/** YMD from calibrated date + frequency months (noon avoids TZ day-shift). */
function suggestNextCalibDate(calibratedYmd: string, freqMonths: number): string {
  const months = freqMonths > 0 ? freqMonths : 6;
  const d = new Date(`${calibratedYmd}T12:00:00`);
  if (Number.isNaN(d.getTime())) {
    const fallback = new Date();
    fallback.setMonth(fallback.getMonth() + months);
    return fallback.toISOString().split("T")[0];
  }
  d.setMonth(d.getMonth() + months);
  return d.toISOString().split("T")[0];
}

/**
 * Pending lines expose old calibDueDate/dueDate as nextCDate.
 * Only keep a fetched next when it is strictly after the calibrated date;
 * otherwise default to calibrated date + frequency.
 */
function resolveNextCalibDefault(
  fetchedNext: string | null | undefined,
  calibratedYmd: string,
  freqMonths: number
): string {
  const suggested = suggestNextCalibDate(calibratedYmd, freqMonths);
  const fetched = fetchedNext ? fmtDate(fetchedNext) : "";
  if (!fetched || fetched === "—") return suggested;
  const fetchedTime = new Date(`${fetched}T12:00:00`).getTime();
  const calibTime = new Date(`${calibratedYmd}T12:00:00`).getTime();
  if (!Number.isFinite(fetchedTime) || !Number.isFinite(calibTime) || fetchedTime <= calibTime) {
    return suggested;
  }
  return fetched;
}

const RESULT_OPTIONS = [
  { value: "AVAILABLE FOR USE", label: "AVAILABLE FOR USE" },
  { value: "PASSED", label: "PASSED (legacy Fit for use)" },
  { value: "RECALIBRATED", label: "RECALIBRATED" },
  { value: "FAILED", label: "FAILED (legacy)" },
  { value: "WORN OUT", label: "WORN OUT" },
  { value: "BROKEN", label: "BROKEN" },
  { value: "REJECTED", label: "REJECTED" },
  { value: "NOT IN USE", label: "NOT IN USE" },
  { value: "OUT OF SERVICE", label: "OUT OF SERVICE" },
] as const;

type ObservedSpecRow = {
  parameter: string;
  spec?: string;
  obsMin: string;
  obsMax: string;
  gaugeStatus: string;
  note: string;
};

export default function CalibrationResultsUpdatePage() {
  const [items, setItems] = useState<CalibrationRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("All");
  const [openClosed, setOpenClosed] = useState<"open" | "closed" | "all">("open");
  const [fromDue, setFromDue] = useState("");
  const [toDue, setToDue] = useState("");
  const [appliedFilters, setAppliedFilters] = useState({
    openClosed: "open" as "open" | "closed" | "all",
    fromDue: "",
    toDue: "",
    search: "",
  });
  const [exporting, setExporting] = useState<"xlsx" | "pdf" | null>(null);
  const [pageOpenedAt] = useState(() => Date.now());

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
  const [observedSpecs, setObservedSpecs] = useState<ObservedSpecRow[]>([]);
  const [specsLoading, setSpecsLoading] = useState(false);

  const handleExport = async (format: "xlsx" | "pdf") => {
    setExporting(format);
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
      toastSuccess(
        count
          ? `Downloaded ${filename} (${Number(count).toLocaleString()} rows).`
          : `Downloaded ${filename}.`
      );
    } catch (err) {
      toastError(err instanceof Error ? err.message : "Export failed");
    } finally {
      setExporting(null);
    }
  };

  const loadData = useCallback(async () => {
    setLoading(true);
    const params = new URLSearchParams();
    params.set("openClosed", appliedFilters.openClosed);
    if (appliedFilters.fromDue) params.set("fromDue", appliedFilters.fromDue);
    if (appliedFilters.toDue) params.set("toDue", appliedFilters.toDue);
    if (appliedFilters.search.trim()) params.set("search", appliedFilters.search.trim());
    const res = await apiGet<{ items: CalibrationRecord[] }>(`/api/calibration/results-update?${params}`);
    if (res.data?.items) setItems(res.data.items);
    else setItems([]);
    setLoading(false);
  }, [appliedFilters]);

  useEffect(() => {
    const timer = window.setTimeout(() => void loadData(), 0);
    return () => window.clearTimeout(timer);
  }, [loadData]);

  const loadObservedSpecs = async (toolOrGaugeNo: string) => {
    setSpecsLoading(true);
    setObservedSpecs([]);
    try {
      const list = await apiGet<{ items: { refNo: number; toolOrGaugeNo: string }[] }>(
        `/api/tools?searchField=toolorgaugeno&search=${encodeURIComponent(toolOrGaugeNo)}&pageSize=5`
      );
      const match = (list.data?.items ?? []).find(
        (t) => t.toolOrGaugeNo.toLowerCase() === toolOrGaugeNo.toLowerCase()
      ) ?? list.data?.items?.[0];
      if (!match?.refNo) {
        setSpecsLoading(false);
        return;
      }
      const detail = await apiGet<{
        tool?: {
          specifications?: {
            parameter: string | null;
            specification: string | null;
            minRange: string | null;
            maxRange: string | null;
          }[];
        };
        specifications?: {
          parameter: string | null;
          specification: string | null;
          minRange: string | null;
          maxRange: string | null;
        }[];
      }>(`/api/tools/${match.refNo}`);
      const specs =
        detail.data?.tool?.specifications ??
        detail.data?.specifications ??
        [];
      setObservedSpecs(
        specs
          .filter((s) => (s.parameter || "").trim())
          .map((s) => ({
            parameter: (s.parameter || "").trim().slice(0, 50),
            spec: s.specification || undefined,
            obsMin: s.minRange || "",
            obsMax: s.maxRange || "",
            gaugeStatus: "",
            note: "",
          }))
      );
    } finally {
      setSpecsLoading(false);
    }
  };

  const handleOpenUpdate = (rec: CalibrationRecord) => {
    setSelectedRecord(rec);
    setCalibResult("AVAILABLE FOR USE");
    setCertificateNo(rec.certificateNo || "");
    setReferenceStandard(rec.referenceStandard || "");
    setErrorNoticed(rec.errorNoticed || "");
    setComments(rec.comments || rec.remarks || "");
    setCalibratedBy(rec.calibratedBy || "");
    const today = new Date().toISOString().split("T")[0];
    const months =
      rec.calibrationFrqMonths && rec.calibrationFrqMonths > 0 ? rec.calibrationFrqMonths : 6;
    setCalibratedDate(today);
    setNextDate(resolveNextCalibDefault(rec.nextCDate, today, months));
    setLocation(rec.locationName || rec.location || "");
    void loadObservedSpecs(rec.toolOrGaugeNo);
  };

  const handleSaveResult = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedRecord) return;
    if (!calibratedDate) {
      toastError("Calibrated Date is required.");
      return;
    }

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
      observedSpecs:
        observedSpecs.length > 0
          ? observedSpecs.map((s) => ({
              parameter: s.parameter,
              specification: s.spec,
              obsMin: s.obsMin.trim() || undefined,
              obsMax: s.obsMax.trim() || undefined,
              gaugeStatus: s.gaugeStatus.trim() || calibResult,
              note: s.note.trim() || undefined,
            }))
          : undefined,
    });

    if (res.error) {
      toastError(res.error.message);
      return;
    }

    toastSuccess({
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
      !q ||
      item.toolOrGaugeNo.toLowerCase().includes(q) ||
      (item.name || "").toLowerCase().includes(q) ||
      (item.type || "").toLowerCase().includes(q) ||
      (item.remarks || "").toLowerCase().includes(q) ||
      String(item.dcNo ?? "").includes(q) ||
      (item.receiveName || "").toLowerCase().includes(q);

    const matchesStatus = statusFilter === "All" || item.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  return (
    <div className="flex h-screen bg-[var(--bg-app)] text-[var(--text-primary)] overflow-hidden">
      <Sidebar />
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        <TopBar />
        <main className="flex-1 overflow-y-auto px-7 py-6">
          <div className="flex items-center justify-between mb-6 gap-4 flex-wrap">
            <div>
              <h1 className="text-2xl font-bold text-[var(--text-primary)] tracking-tight">
                Calibration Results Update
              </h1>
              <p className="text-sm text-[var(--text-muted)] mt-0.5">
                Update inspection results, certificate details & next calibration due dates
              </p>
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
                    new Date(i.nextCDate) <= new Date(pageOpenedAt + 30 * 24 * 60 * 60 * 1000)
                ).length,
                subtext: "Upcoming calibration due date",
                icon: RefreshCw,
                iconBg: "bg-amber-50 dark:bg-amber-950/30",
                iconColor: "text-amber-600 dark:text-amber-400",
                badge: { label: "Upcoming", type: "warning" },
              },
            ]}
          />

          <StatusPillTabs
            className="mb-3"
            idPrefix="calib-results-open-closed"
            value={openClosed}
            onChange={(v) => setOpenClosed(v)}
            items={[
              { value: "open", label: "Open (pending)" },
              { value: "closed", label: "Closed" },
              { value: "all", label: "All" },
            ]}
          />

          <MasterTableCard
            toolbar={
              <div className="flex flex-wrap items-center justify-between gap-2.5 w-full">
                <MasterSearchInput
                  id="calib-results-search"
                  value={query}
                  onChange={setQuery}
                  placeholder="Search tool, DC, issued to…"
                  widthClass="w-60"
                />
                <div className="flex flex-wrap items-center gap-2">
                  <SelectionFilter
                    id="calib-results-status-filter"
                    label="Status"
                    value={statusFilter}
                    anyValue="All"
                    anyLabel="Any"
                    maxValueWidth="6rem"
                    onChange={setStatusFilter}
                    options={[
                      { value: "All", label: "Any" },
                      { value: "Under Calibration", label: "Under Calibration" },
                      { value: "Pending", label: "Pending" },
                      { value: "Received", label: "Received" },
                      { value: "Available", label: "Available" },
                    ]}
                  />
                  <div className="flex items-center gap-1 bg-[var(--bg-subtle)] px-2 py-1 rounded-lg border border-[var(--border-main)] text-xs text-[var(--text-muted)]">
                    <span className="text-[11px] font-medium mr-1">Due:</span>
                    <input
                      type="date"
                      aria-label="Due from"
                      className="bg-transparent text-[11px] text-[var(--text-primary)] outline-none cursor-pointer"
                      value={fromDue}
                      onChange={(e) => setFromDue(e.target.value)}
                      title="Due From"
                    />
                    <span>—</span>
                    <input
                      type="date"
                      aria-label="Due to"
                      className="bg-transparent text-[11px] text-[var(--text-primary)] outline-none cursor-pointer"
                      value={toDue}
                      onChange={(e) => setToDue(e.target.value)}
                      title="Due To"
                    />
                  </div>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="h-8 px-3 text-xs font-semibold"
                    onClick={() =>
                      setAppliedFilters({
                        openClosed,
                        fromDue,
                        toDue,
                        search: query,
                      })
                    }
                  >
                    Apply
                  </Button>
                  <div className="h-4 w-px bg-[var(--border-main)] mx-0.5" />
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="h-8 px-2.5 text-xs font-medium text-[var(--text-secondary)]"
                    disabled={exporting !== null || items.length === 0}
                    onClick={() => void handleExport("xlsx")}
                    title="Download Excel"
                  >
                    <FileSpreadsheet className="w-3.5 h-3.5 mr-1" />
                    Excel
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="h-8 px-2.5 text-xs font-medium text-[var(--text-secondary)]"
                    disabled={exporting !== null || items.length === 0}
                    onClick={() => void handleExport("pdf")}
                    title="Download PDF"
                  >
                    <FileText className="w-3.5 h-3.5 mr-1" />
                    PDF
                  </Button>
                </div>
              </div>
            }
          >
            {loading ? (
              <div className="p-5">
                <TableSkeleton rows={6} />
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="border-b border-[var(--border-main)] bg-[var(--bg-subtle)] text-[11px] font-semibold text-[var(--text-muted)] tracking-wider uppercase">
                      <th className="py-3 px-4 min-w-[140px]">Tool / Gauge No</th>
                      <th className="py-3 px-4 min-w-[180px]">Name & Group</th>
                      <th className="py-3 px-3 min-w-[90px]">Type</th>
                      <th className="py-3 px-3 min-w-[100px]">Freq</th>
                      <th className="py-3 px-3 min-w-[110px]">Last Calib</th>
                      <th className="py-3 px-3 min-w-[110px]">Next Due</th>
                      <th className="py-3 px-3 min-w-[120px]">Certificate No</th>
                      <th className="py-3 px-3 min-w-[110px]">Calibrated By</th>
                      <th className="py-3 px-3 min-w-[120px]">Remarks</th>
                      <th className="py-3 px-3 min-w-[90px] text-center">Status</th>
                      <th className="py-3 px-4 min-w-[160px] text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[var(--border-main)] text-xs">
                    {filtered.map((item) => (
                      <tr key={item.refNo} className="hover:bg-[var(--bg-hover)] transition-colors group">
                        <td className="py-3 px-4 align-middle">
                          <span className="font-mono font-bold text-[var(--text-primary)]">
                            {item.toolOrGaugeNo}
                          </span>
                          {item.serialNo != null && (
                            <span className="block font-mono text-[11px] text-[var(--text-muted)] mt-0.5">
                              S/N: {item.serialNo}
                            </span>
                          )}
                        </td>
                        <td className="py-3 px-4 align-middle">
                          <p className="font-medium text-[var(--text-primary)] truncate max-w-[200px]" title={item.name ?? ""}>
                            {item.name || "—"}
                          </p>
                          {item.grouping && (
                            <p className="text-[11px] text-[var(--text-muted)] truncate max-w-[200px]" title={item.grouping}>
                              {item.grouping}
                            </p>
                          )}
                        </td>
                        <td className="py-3 px-3 align-middle text-[var(--text-secondary)]">
                          <span className="inline-block px-2 py-0.5 rounded bg-[var(--bg-subtle)] border border-[var(--border-main)] text-[11px]">
                            {item.type || "—"}
                          </span>
                        </td>
                        <td className="py-3 px-3 align-middle font-mono text-[var(--text-muted)]">
                          {item.frequency || "—"}
                        </td>
                        <td className="py-3 px-3 align-middle font-mono text-[var(--text-muted)]">
                          {fmtDate(item.cDate)}
                        </td>
                        <td className="py-3 px-3 align-middle font-mono font-semibold text-amber-600 dark:text-amber-400">
                          {fmtDate(item.nextCDate)}
                        </td>
                        <td className="py-3 px-3 align-middle font-mono text-[var(--text-secondary)]">
                          {item.certificateNo || <span className="text-[var(--text-muted)]">—</span>}
                        </td>
                        <td className="py-3 px-3 align-middle text-[var(--text-secondary)]">
                          {item.calibratedBy || <span className="text-[var(--text-muted)]">—</span>}
                        </td>
                        <td className="py-3 px-3 align-middle text-[var(--text-muted)] max-w-[140px] truncate" title={item.remarks ?? ""}>
                          {item.remarks || "—"}
                        </td>
                        <td className="py-3 px-3 align-middle text-center">
                          <StatusBadge status={item.status} />
                        </td>
                        <td className="py-3 px-4 align-middle text-right">
                          <div className="flex items-center justify-end gap-1.5">
                            <RoleGate permission="canManageCalibration">
                              <button
                                type="button"
                                onClick={() => setUploadRecord(item)}
                                title="Upload certificate or image"
                                className="inline-flex items-center gap-1 h-7 px-2 text-[11px] font-medium rounded-md border border-[var(--border-main)] text-[var(--text-secondary)] hover:bg-[var(--bg-subtle)] hover:text-[var(--text-primary)] transition-colors"
                              >
                                <Upload className="w-3 h-3" />
                                <span>Upload</span>
                              </button>
                              <button
                                type="button"
                                onClick={() => handleOpenUpdate(item)}
                                className="inline-flex items-center gap-1 h-7 px-2.5 text-[11px] font-semibold rounded-md bg-[var(--primary)] text-white hover:opacity-90 transition-opacity shadow-xs"
                              >
                                <span>Update Result</span>
                              </button>
                            </RoleGate>
                          </div>
                        </td>
                      </tr>
                    ))}
                    {filtered.length === 0 && (
                      <tr>
                        <td colSpan={11} className="py-12 text-center text-sm text-[var(--text-muted)]">
                          No calibration pending records found.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            )}
          </MasterTableCard>
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
                  <MasterSearchSelect
                    kind="location"
                    label="Location"
                    value={location}
                    selectedLabel={location}
                    onChange={(value) => setLocation(value)}
                    placeholder="Search location…"
                  />
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

              <div className="border border-[var(--border-main)] rounded-xl p-4">
                <p className="text-[11px] font-semibold text-[var(--text-muted)] uppercase tracking-wider mb-3">
                  Observed specifications (TOOLS_SPECIFICATION)
                </p>
                {specsLoading ? (
                  <p className="text-xs text-[var(--text-muted)]">Loading parameters…</p>
                ) : observedSpecs.length === 0 ? (
                  <p className="text-xs text-[var(--text-muted)]">
                    No specification rows on this tool. Add parameters on Item/Asset Master to capture observations.
                  </p>
                ) : (
                  <div className="overflow-auto">
                    <table className="w-full text-xs">
                      <thead>
                        <tr className="border-b border-[var(--border-main)] bg-[var(--bg-subtle)]">
                          {["Parameter", "Spec", "Obs Min", "Obs Max", "Gauge Status", "Note"].map((h) => (
                            <th
                              key={h}
                              className="text-left text-[10px] font-semibold text-[var(--text-muted)] uppercase tracking-wider py-2 px-2"
                            >
                              {h}
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-[var(--border-main)]">
                        {observedSpecs.map((row, idx) => (
                          <tr key={`${row.parameter}-${idx}`}>
                            <td className="py-1.5 px-2 font-medium">{row.parameter}</td>
                            <td className="py-1.5 px-2 text-[var(--text-muted)]">{row.spec || "—"}</td>
                            <td className="py-1.5 px-2">
                              <select
                                className="form-control"
                                value={row.gaugeStatus}
                                onChange={(e) =>
                                  setObservedSpecs((prev) =>
                                    prev.map((r, i) =>
                                      i === idx ? { ...r, gaugeStatus: e.target.value } : r
                                    )
                                  )
                                }
                              >
                                <option value="">Use overall result</option>
                                {RESULT_OPTIONS.map((option) => (
                                  <option key={option.value} value={option.value}>{option.value}</option>
                                ))}
                              </select>
                            </td>
                            <td className="py-1.5 px-2">
                              <input
                                className="form-control font-mono"
                                value={row.obsMin}
                                onChange={(e) =>
                                  setObservedSpecs((prev) =>
                                    prev.map((r, i) =>
                                      i === idx ? { ...r, obsMin: e.target.value } : r
                                    )
                                  )
                                }
                              />
                            </td>
                            <td className="py-1.5 px-2">
                              <input
                                className="form-control font-mono"
                                value={row.obsMax}
                                onChange={(e) =>
                                  setObservedSpecs((prev) =>
                                    prev.map((r, i) =>
                                      i === idx ? { ...r, obsMax: e.target.value } : r
                                    )
                                  )
                                }
                              />
                            </td>
                            <td className="py-1.5 px-2">
                              <input
                                className="form-control"
                                value={row.note}
                                onChange={(e) =>
                                  setObservedSpecs((prev) =>
                                    prev.map((r, i) =>
                                      i === idx ? { ...r, note: e.target.value } : r
                                    )
                                  )
                                }
                              />
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
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
                    Error / Observation Code
                  </label>
                  <input
                    value={errorNoticed}
                    onChange={(e) => setErrorNoticed(e.target.value)}
                    placeholder="Enter error or observation code"
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
                    onChange={(e) => {
                      const ymd = e.target.value;
                      setCalibratedDate(ymd);
                      if (!selectedRecord || !ymd) return;
                      const months =
                        selectedRecord.calibrationFrqMonths &&
                        selectedRecord.calibrationFrqMonths > 0
                          ? selectedRecord.calibrationFrqMonths
                          : 6;
                      // Keep next aligned when it was blank or still on/before the new calib date
                      // (avoids leaving an old overdue due like 2020 after changing calib dt).
                      if (!nextDate || nextDate <= ymd) {
                        setNextDate(suggestNextCalibDate(ymd, months));
                      }
                    }}
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
                  <p className="mt-1 text-[10px] text-[var(--text-muted)]">
                    Defaults to calibrated date + frequency (ignores old overdue due dates).
                  </p>
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
                uploadButtonLabel="Upload Certificate"
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
                <h2 className="text-base font-bold text-[var(--text-primary)]">Calibration Certificates</h2>
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
                title="Certificates and Calibration Reports"
                uploadButtonLabel="Upload Another Certificate"
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
