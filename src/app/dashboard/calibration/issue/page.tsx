"use client";

import { Suspense, useState, useEffect, useCallback, useRef } from "react";
import { useSearchParams } from "next/navigation";
import {
  Plus,
  CheckCircle2,
  AlertTriangle,
  ShieldAlert,
  Search,
  Trash,
  ArrowLeft,
  Download,
  FileText,
  Eye,
  CalendarClock,
  Building2,
  Clock,
  AlertCircle,
} from "lucide-react";
import Sidebar from "@/app/dashboard/components/Sidebar";
import TopBar from "@/app/dashboard/components/TopBar";
import RoleGate from "@/app/dashboard/components/RoleGate";
import { TableSkeleton } from "@/app/dashboard/components/LoadingSkeleton";
import { ModuleKpiRow } from "@/app/dashboard/components/ModuleKpiRow";
import { apiGet, apiPost } from "@/lib/apiClient";
import { Button } from "@/components/ui/button";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { PageLoader } from "@/components/PageLoader";
import { useSuccessOverlay } from "@/components/SuccessOverlay";
import { ToolDocumentsPanel } from "@/components/ToolDocumentsPanel";

interface Tool {
  refNo: number | null;
  toolOrGaugeNo: string;
  name: string | null;
  status: string | null;
  grouping: string | null;
  type?: string | null;
  location?: string | null;
  frequency?: string | null;
  nextCalibrationDate: string | null;
  serialNo?: number | null;
}

interface CalibrationIssueLine {
  rowId: number;
  toolOrGaugeNo: string | null;
  grouping: string | null;
  issueQty: number | null;
  serialNo: number | null;
  status: string | null;
  calibrationStatus: string | null;
  resultStatus: string | null;
  calibratedBy: string | null;
  dueDate: string | null;
  tool?: { name: string | null; description: string | null } | null;
}

interface CalibrationIssueHeader {
  dcNo: number;
  receiveName: string | null;
  subCode: string | null;
  issueDate: string | null;
  issueFor: string | null;
  toolsPoNo?: string | null;
  status: string | null;
  inHouseLines?: CalibrationIssueLine[];
}

interface SubOption {
  id: string;
  subCode: string;
  subName: string;
}

interface StagedCalibLine {
  toolOrGaugeNo: string;
  name: string;
  grouping: string;
  type: string;
  serialNo: string;
  location: string;
  calibDueDate: string;
  status: string;
}

const ISSUE_FOR_OPTIONS = ["Calibration", "Preventive MNT"] as const;

const headerInputCls =
  "w-full h-8 text-xs border border-[var(--border-main)] rounded-md px-2 outline-none focus:ring-1 focus:ring-[var(--primary-subtle)] bg-[var(--bg-subtle)] text-[var(--text-primary)]";
const headerLabelCls =
  "block text-[10px] font-semibold text-[var(--text-muted)] uppercase tracking-wide mb-0.5 leading-none";

function daysUntil(dateStr: string | null): number | null {
  if (!dateStr) return null;
  const today = new Date();
  const due = new Date(dateStr);
  return Math.ceil((due.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
}

function formatDate(dateStr: string | null): string {
  if (!dateStr) return "—";
  if (dateStr.includes("T")) return dateStr.split("T")[0];
  return dateStr;
}

function localToday() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function CalibrationIssuePage() {
  const { showSuccess } = useSuccessOverlay();
  const searchParams = useSearchParams();
  const preselectTool = (searchParams.get("tool") ?? "").trim();
  const preselectApplied = useRef(false);

  const [mode, setMode] = useState<"list" | "create" | "detail">("list");
  const [tools, setTools] = useState<Tool[]>([]);
  const [history, setHistory] = useState<CalibrationIssueHeader[]>([]);
  const [subs, setSubs] = useState<SubOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [alertDays, setAlertDays] = useState(90);
  const [dueSoonCount, setDueSoonCount] = useState(0);
  const [overdueCount, setOverdueCount] = useState(0);
  const [underCalibrationCount, setUnderCalibrationCount] = useState(0);
  const [submitting, setSubmitting] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [historySearch, setHistorySearch] = useState("");
  const [selectedDc, setSelectedDc] = useState<CalibrationIssueHeader | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [pdfBusyDc, setPdfBusyDc] = useState<number | null>(null);
  const [lastIssuedDc, setLastIssuedDc] = useState<number | null>(null);
  const [groupFilter, setGroupFilter] = useState("ALL");
  const [typeFilter, setTypeFilter] = useState("ALL");
  const [issueForFilter, setIssueForFilter] = useState<string>("Calibration");
  const mainRef = useRef<HTMLElement | null>(null);
  const successBannerRef = useRef<HTMLDivElement | null>(null);

  const [successBanner, setSuccessBanner] = useState("");
  const [bannerMsg, setBannerMsg] = useState<{ type: "success" | "error"; text: string } | null>(null);

  const [receiveName, setReceiveName] = useState("");
  const [subCode, setSubCode] = useState("");
  const [issueDate, setIssueDate] = useState(localToday);
  const [issueFor, setIssueFor] = useState("Calibration");
  const [toolsPoNo, setToolsPoNo] = useState("Any");
  const [selectedKeys, setSelectedKeys] = useState<Set<string>>(new Set());
  const [staged, setStaged] = useState<StagedCalibLine[]>([]);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const loadData = useCallback(async () => {
    setLoading(true);
    setBannerMsg(null);
    const [tRes, hRes, sRes] = await Promise.all([
      apiGet<{
        items: Tool[];
        alertDays?: number;
        dueSoonCount?: number;
        overdueCount?: number;
        underCalibrationCount?: number;
      }>("/api/tools/calibration-due"),
      apiGet<{ items: CalibrationIssueHeader[]; total?: number }>("/api/calibration/issue"),
      apiGet<{ items?: SubOption[] }>("/api/subcontractors?pageSize=200"),
    ]);

    if (tRes.data?.items) {
      const items = tRes.data.items;
      setTools(items);
      const days = tRes.data.alertDays ?? 90;
      setAlertDays(days);

      // Prefer server-side KPI splits; fall back to client daysLeft if older API
      const startOfToday = new Date();
      startOfToday.setHours(0, 0, 0, 0);
      const clientDueSoon = items.filter((t) => {
        if (!t.nextCalibrationDate) return false;
        return new Date(t.nextCalibrationDate) >= startOfToday;
      }).length;
      const clientOverdue = items.filter((t) => {
        if (!t.nextCalibrationDate) return false;
        return new Date(t.nextCalibrationDate) < startOfToday;
      }).length;

      setDueSoonCount(tRes.data.dueSoonCount ?? clientDueSoon);
      setOverdueCount(tRes.data.overdueCount ?? clientOverdue);
      setUnderCalibrationCount(tRes.data.underCalibrationCount ?? 0);
    } else {
      setTools([]);
      setDueSoonCount(0);
      setOverdueCount(0);
      setUnderCalibrationCount(0);
    }
    if (hRes.error) {
      setHistory([]);
      setBannerMsg({
        type: "error",
        text: typeof hRes.error.message === "string" ? hRes.error.message : "Failed to load calibration issues",
      });
    } else if (hRes.data?.items) {
      setHistory(hRes.data.items);
    }
    setSubs(sRes.data?.items ?? []);
    setLoading(false);
  }, []);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  useEffect(() => {
    if (!preselectTool || preselectApplied.current || tools.length === 0) return;
    const match = tools.find(
      (t) => t.toolOrGaugeNo.toLowerCase() === preselectTool.toLowerCase()
    );
    if (match) {
      setMode("create");
      setIssueFor("Calibration");
      setIssueForFilter("Calibration");
      setSelectedKeys(new Set([match.toolOrGaugeNo]));
      setSearchQuery(match.toolOrGaugeNo);
      preselectApplied.current = true;
    }
  }, [preselectTool, tools]);

  const groups = Array.from(new Set(tools.map((t) => t.grouping).filter(Boolean))) as string[];
  const types = Array.from(new Set(tools.map((t) => t.type).filter(Boolean))) as string[];

  const filteredHistory = history.filter((ci) => {
    const q = historySearch.trim().toLowerCase();
    if (!q) return true;
    const lines = ci.inHouseLines ?? [];
    const toolBlob = lines
      .map((l) => `${l.toolOrGaugeNo ?? ""} ${l.tool?.name ?? ""} ${l.serialNo ?? ""}`)
      .join(" ")
      .toLowerCase();
    return (
      String(ci.dcNo).includes(q) ||
      (ci.receiveName || "").toLowerCase().includes(q) ||
      (ci.issueFor || "").toLowerCase().includes(q) ||
      (ci.subCode || "").toLowerCase().includes(q) ||
      (ci.toolsPoNo || "").toLowerCase().includes(q) ||
      (ci.status || "").toLowerCase().includes(q) ||
      formatDate(ci.issueDate).toLowerCase().includes(q) ||
      toolBlob.includes(q)
    );
  });

  const downloadDcPdf = async (dcNo: number) => {
    setPdfBusyDc(dcNo);
    setBannerMsg(null);
    try {
      const res = await fetch(`/api/calibration/issue/${dcNo}/pdf`, {
        credentials: "include",
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(
          typeof data.error === "string" ? data.error : "Failed to download DC PDF"
        );
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `Calibration_DC_${dcNo}.pdf`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch (e) {
      setBannerMsg({
        type: "error",
        text: e instanceof Error ? e.message : "Failed to download DC PDF",
      });
    } finally {
      setPdfBusyDc(null);
    }
  };

  const openDcDetail = async (dcNo: number) => {
    setMode("detail");
    setDetailLoading(true);
    setBannerMsg(null);
    const fromList = history.find((h) => h.dcNo === dcNo) ?? null;
    setSelectedDc(fromList);
    const res = await apiGet<{ issue: CalibrationIssueHeader }>(
      `/api/calibration/issue/${dcNo}`
    );
    if (res.error) {
      setBannerMsg({ type: "error", text: res.error.message });
      if (!fromList) setMode("list");
    } else if (res.data?.issue) {
      setSelectedDc(res.data.issue);
    }
    setDetailLoading(false);
    mainRef.current?.scrollTo({ top: 0, behavior: "smooth" });
  };

  const dueToolsList = tools
    .map((t) => ({ ...t, daysLeft: daysUntil(t.nextCalibrationDate) }))
    .filter((t) => {
      if (t.daysLeft === null) return false;
      if (preselectTool && t.toolOrGaugeNo.toLowerCase() === preselectTool.toLowerCase()) return true;
      return t.daysLeft <= 90;
    })
    .filter((t) => {
      if (groupFilter !== "ALL" && t.grouping !== groupFilter) return false;
      if (typeFilter !== "ALL" && t.type !== typeFilter) return false;
      if (!searchQuery.trim()) return true;
      const q = searchQuery.toLowerCase();
      return (
        t.toolOrGaugeNo.toLowerCase().includes(q) ||
        (t.name || "").toLowerCase().includes(q) ||
        (t.status || "").toLowerCase().includes(q)
      );
    })
    .sort((a, b) => (a.daysLeft ?? 0) - (b.daysLeft ?? 0));

  const toggleSelect = (toolNo: string) => {
    setSelectedKeys((prev) => {
      const next = new Set(prev);
      if (next.has(toolNo)) next.delete(toolNo);
      else next.add(toolNo);
      return next;
    });
  };

  const handleSelectAll = () => {
    if (selectedKeys.size === dueToolsList.length) {
      setSelectedKeys(new Set());
    } else {
      setSelectedKeys(new Set(dueToolsList.map((t) => t.toolOrGaugeNo)));
    }
  };

  const addToIssueList = () => {
    const toAdd: StagedCalibLine[] = [];
    for (const t of dueToolsList) {
      if (!selectedKeys.has(t.toolOrGaugeNo)) continue;
      if (staged.some((s) => s.toolOrGaugeNo === t.toolOrGaugeNo)) continue;
      toAdd.push({
        toolOrGaugeNo: t.toolOrGaugeNo,
        name: t.name || "—",
        grouping: t.grouping || "—",
        type: t.type || "—",
        serialNo: t.serialNo != null ? String(t.serialNo) : "",
        location: t.location || "—",
        calibDueDate: formatDate(t.nextCalibrationDate),
        status: "ISSUE FOR CALIBRATION",
      });
    }
    if (!toAdd.length) {
      setBannerMsg({ type: "error", text: "Select one or more tools first." });
      return;
    }
    setStaged((prev) => [...prev, ...toAdd]);
    setSelectedKeys(new Set());
    setBannerMsg(null);
    setErrors((prev) => ({ ...prev, tools: "" }));
  };

  const openCreate = () => {
    setMode("create");
    setIssueDate(localToday());
    setIssueFor(issueForFilter || "Calibration");
    setReceiveName("");
    setSubCode("");
    setToolsPoNo("Any");
    setStaged([]);
    setSelectedKeys(new Set());
    setErrors({});
    setBannerMsg(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (submitting) return;

    const tempErrors: Record<string, string> = {};
    if (!receiveName.trim()) tempErrors.receiveName = "Receiver Name is required";
    if (!issueFor.trim()) tempErrors.issueFor = "Issue For is required";
    if (staged.length === 0) tempErrors.tools = "Add at least one tool to the issue list";

    if (Object.keys(tempErrors).length > 0) {
      setErrors(tempErrors);
      return;
    }

    const payload = {
      receiveName,
      subCode: subCode || undefined,
      issueDate,
      issueFor,
      toolsPoNo: toolsPoNo === "Any" ? undefined : toolsPoNo,
      lines: staged.map((l) => ({
        toolOrGaugeNo: l.toolOrGaugeNo,
        issueQty: 1,
        serialNo: l.serialNo.trim() ? Number(l.serialNo) : undefined,
        calibDueDate: l.calibDueDate !== "—" ? l.calibDueDate : undefined,
      })),
    };

    setSubmitting(true);
    setBannerMsg(null);
    setSuccessBanner("");
    try {
      const res = await apiPost<{
        ok?: boolean;
        item?: CalibrationIssueHeader;
        header?: { dcNo?: number };
      }>("/api/calibration/issue", payload);

      if (res.error) {
        setBannerMsg({ type: "error", text: res.error.message });
        return;
      }

      const dcNo = res.data?.item?.dcNo ?? res.data?.header?.dcNo;
      const msg =
        dcNo != null
          ? `Calibration DC #${dcNo} created successfully.`
          : "Calibration DC created successfully.";

      setMode("list");
      setStaged([]);
      setSelectedKeys(new Set());
      setErrors({});
      setLastIssuedDc(dcNo ?? null);
      await loadData();
      setSuccessBanner(msg);
      showSuccess({
        title: "Calibration DC issued",
        message: "Tool(s) moved to Under Calibration. Download the Delivery Challan PDF or open the DC to attach documents.",
        detail: dcNo != null ? `DC #${dcNo}` : undefined,
      });
      mainRef.current?.scrollTo({ top: 0, behavior: "smooth" });
      window.setTimeout(() => setSuccessBanner(""), 12000);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="flex h-screen bg-[var(--bg-app)] text-[var(--text-primary)] overflow-hidden">
      <Sidebar />
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        <TopBar />
        <main ref={mainRef} className="flex-1 overflow-y-auto px-7 py-6 space-y-4">
          {(successBanner || (bannerMsg && bannerMsg.type === "error")) && (
            <div ref={successBannerRef} className="space-y-3 sticky top-0 z-20">
              {successBanner && (
                <div className="p-3 bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-300 dark:border-emerald-700 rounded-xl flex items-center gap-2.5 text-emerald-800 dark:text-emerald-200 text-sm font-semibold shadow-md flex-wrap">
                  <CheckCircle2 className="w-5 h-5 text-emerald-500 shrink-0" />
                  <span className="flex-1 min-w-[12rem]">{successBanner}</span>
                  {lastIssuedDc != null && (
                    <div className="flex items-center gap-2">
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        disabled={pdfBusyDc === lastIssuedDc}
                        onClick={() => void downloadDcPdf(lastIssuedDc)}
                      >
                        <Download className="w-3.5 h-3.5" />
                        {pdfBusyDc === lastIssuedDc ? "Preparing…" : "Download DC PDF"}
                      </Button>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => void openDcDetail(lastIssuedDc)}
                      >
                        <FileText className="w-3.5 h-3.5" />
                        Open DC / Upload
                      </Button>
                    </div>
                  )}
                  <button type="button" onClick={() => setSuccessBanner("")} className="ml-auto text-xs opacity-60 hover:opacity-100">✕</button>
                </div>
              )}
              {bannerMsg && bannerMsg.type === "error" && (
                <div className="px-4 py-3 rounded-xl text-sm font-medium flex items-center gap-2 bg-[var(--color-danger-bg)] text-[var(--color-danger-text)] border border-[var(--border-main)]">
                  {bannerMsg.text}
                  <button onClick={() => setBannerMsg(null)} className="ml-auto text-xs opacity-60 hover:opacity-100">✕</button>
                </div>
              )}
            </div>
          )}

          {mode === "list" ? (
            <>
              <div className="flex items-start justify-between gap-4 flex-wrap">
                <div>
                  <h1 className="text-2xl font-bold text-[var(--text-primary)] tracking-tight">
                    Calibration Issue
                  </h1>
                  <p className="text-sm text-[var(--text-muted)] mt-0.5">
                    Issue for Calibration / Preventive MNT · search DCs, download Delivery Challan PDF, attach documents
                  </p>
                </div>
                <RoleGate permission="canManageCalibration">
                  <Button type="button" variant="primary" onClick={openCreate}>
                    <Plus className="w-4 h-4" /> New Issue
                  </Button>
                </RoleGate>
              </div>

              <ModuleKpiRow
                items={[
                  {
                    id: "due-calibration",
                    label: "Tools Due Calibration",
                    value: dueSoonCount,
                    subtext: `Next ${alertDays} days · not overdue`,
                    title: `Count of tools with next calibration date from today through +${alertDays} days (excludes already-overdue and tools already Under Calibration).`,
                    icon: CalendarClock,
                    iconBg: "bg-[var(--primary-light)]",
                    iconColor: "text-[var(--primary)]",
                    badge: { label: `≤${alertDays}d`, type: "info" },
                  },
                  {
                    id: "in-lab",
                    label: "Under Calibration",
                    value: underCalibrationCount,
                    subtext: "Live in-lab status",
                    title: "Live count of tools whose master status is Under Calibration / UNDER CALIBRATION (not derived from the due-list picker).",
                    icon: Clock,
                    iconBg: "bg-blue-50 dark:bg-blue-950/30",
                    iconColor: "text-blue-600 dark:text-blue-400",
                    badge: { label: "In Lab", type: "info" },
                  },
                  {
                    id: "vendor-labs",
                    label: "Calibration DC Slips",
                    value: history.length,
                    subtext: "Same as history table",
                    title: "Count of calibration issue headers loaded for the history table (TOOLS_ISSUE_FOR_CALIBRATION, newest 200).",
                    icon: Building2,
                    iconBg: "bg-emerald-50 dark:bg-emerald-950/30",
                    iconColor: "text-emerald-600 dark:text-emerald-400",
                    badge: { label: "DC Slips", type: "success" },
                  },
                  {
                    id: "overdue-calib",
                    label: "Overdue Calibrations",
                    value: overdueCount,
                    subtext: "Past due · not yet issued",
                    title: "Count of tools with nextCalibrationDate < start of today that are still eligible to issue (excludes Under Calibration / open issue lines). Distinct from Due Soon.",
                    icon: AlertCircle,
                    iconBg: "bg-amber-50 dark:bg-amber-950/30",
                    iconColor: "text-amber-600 dark:text-amber-400",
                    badge: { label: "Past due", type: "warning" },
                  },
                ]}
              />

              <div className="bg-[var(--bg-card)] rounded-xl border border-[var(--border-main)] px-4 py-3">
                <div className="flex items-center justify-between gap-3 flex-wrap mb-3 pb-2 border-b border-[var(--border-main)]">
                  <h2 className="text-xs font-bold text-[var(--text-primary)] uppercase tracking-widest">
                    Calibration Issue History
                  </h2>
                  <div className="relative min-w-[16rem] flex-1 max-w-md">
                    <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-[var(--text-muted)]" />
                    <input
                      value={historySearch}
                      onChange={(e) => setHistorySearch(e.target.value)}
                      placeholder="Search DC No, receiver, tool, date…"
                      className="w-full h-8 text-xs border border-[var(--border-main)] rounded-md pl-8 pr-2 outline-none focus:ring-1 focus:ring-[var(--primary-subtle)] bg-[var(--bg-subtle)] text-[var(--text-primary)]"
                    />
                  </div>
                </div>
                <div className="overflow-auto">
                  {loading ? (
                    <TableSkeleton rows={4} />
                  ) : filteredHistory.length === 0 ? (
                    <div className="text-center text-sm text-[var(--text-muted)] py-8">
                      {history.length === 0
                        ? "No calibration issue records found."
                        : "No DCs match your search."}
                    </div>
                  ) : (
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b border-[var(--border-main)] bg-[var(--bg-subtle)]">
                          {["DC No", "Receive Name", "Issue For", "Issue Date", "Tools on DC", "Status", "Actions"].map((col) => (
                            <th key={col} className="text-left text-[10px] font-semibold text-[var(--text-muted)] uppercase tracking-wider py-2 px-3">
                              {col}
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-[var(--border-main)]">
                        {filteredHistory.map((ci) => {
                          const lines = ci.inHouseLines ?? [];
                          const preview = lines
                            .map((l) => l.toolOrGaugeNo || l.tool?.name || "")
                            .filter(Boolean)
                            .slice(0, 3)
                            .join(", ");
                          return (
                            <tr key={ci.dcNo} className="hover:bg-[var(--bg-hover)]">
                              <td className="py-2.5 px-3 font-mono text-xs font-bold">#{ci.dcNo}</td>
                              <td className="py-2.5 px-3 text-xs font-semibold">{ci.receiveName ?? "—"}</td>
                              <td className="py-2.5 px-3 text-xs">{ci.issueFor ?? "—"}</td>
                              <td className="py-2.5 px-3 font-mono text-xs">{formatDate(ci.issueDate)}</td>
                              <td className="py-2.5 px-3 text-xs">
                                {lines.length > 0 ? (
                                  <span className="font-mono">{preview}{lines.length > 3 ? "…" : ""} · {lines.length}</span>
                                ) : "—"}
                              </td>
                              <td className="py-2.5 px-3"><StatusBadge status={ci.status} /></td>
                              <td className="py-2.5 px-3">
                                <div className="flex items-center gap-1">
                                  <button
                                    type="button"
                                    title="Open DC"
                                    onClick={() => void openDcDetail(ci.dcNo)}
                                    className="inline-flex p-1.5 rounded-lg text-[var(--primary)] hover:bg-[var(--primary-light)]"
                                  >
                                    <Eye className="w-3.5 h-3.5" />
                                  </button>
                                  <button
                                    type="button"
                                    title="Download Delivery Challan PDF"
                                    disabled={pdfBusyDc === ci.dcNo}
                                    onClick={() => void downloadDcPdf(ci.dcNo)}
                                    className="inline-flex p-1.5 rounded-lg text-[var(--primary)] hover:bg-[var(--primary-light)] disabled:opacity-50"
                                  >
                                    <Download className="w-3.5 h-3.5" />
                                  </button>
                                </div>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  )}
                </div>
              </div>
            </>
          ) : mode === "detail" ? (
            <div className="space-y-3">
              <div className="flex items-center justify-between gap-3 flex-wrap">
                <button
                  type="button"
                  onClick={() => {
                    setMode("list");
                    setSelectedDc(null);
                  }}
                  className="inline-flex items-center gap-1 text-xs font-bold text-[var(--text-muted)] hover:text-[var(--text-primary)] uppercase tracking-widest"
                >
                  <ArrowLeft className="w-4 h-4" /> Back to history
                </button>
                <h1 className="text-lg font-bold text-[var(--text-primary)]">
                  Calibration DC {selectedDc ? `#${selectedDc.dcNo}` : ""}
                </h1>
                {selectedDc && (
                  <Button
                    type="button"
                    variant="primary"
                    size="sm"
                    disabled={pdfBusyDc === selectedDc.dcNo}
                    onClick={() => void downloadDcPdf(selectedDc.dcNo)}
                  >
                    <Download className="w-3.5 h-3.5" />
                    {pdfBusyDc === selectedDc.dcNo ? "Preparing…" : "Download DC PDF"}
                  </Button>
                )}
              </div>

              {detailLoading || !selectedDc ? (
                <TableSkeleton rows={3} />
              ) : (
                <>
                  <div className="bg-[var(--bg-card)] rounded-xl border border-[var(--border-main)] px-4 py-3">
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-xs">
                      <div>
                        <p className={headerLabelCls}>Receive Name</p>
                        <p className="font-semibold">{selectedDc.receiveName ?? "—"}</p>
                      </div>
                      <div>
                        <p className={headerLabelCls}>Issue For</p>
                        <p className="font-semibold">{selectedDc.issueFor ?? "—"}</p>
                      </div>
                      <div>
                        <p className={headerLabelCls}>Issue Date</p>
                        <p className="font-mono font-semibold">{formatDate(selectedDc.issueDate)}</p>
                      </div>
                      <div>
                        <p className={headerLabelCls}>Status</p>
                        <StatusBadge status={selectedDc.status} />
                      </div>
                      <div>
                        <p className={headerLabelCls}>Sub Code</p>
                        <p className="font-mono">{selectedDc.subCode ?? "—"}</p>
                      </div>
                      <div>
                        <p className={headerLabelCls}>Tools PO</p>
                        <p className="font-mono">{selectedDc.toolsPoNo ?? "—"}</p>
                      </div>
                    </div>
                  </div>

                  <div className="bg-[var(--bg-card)] rounded-xl border border-[var(--border-main)] px-4 py-3">
                    <h2 className="text-xs font-bold text-[var(--text-primary)] uppercase tracking-widest mb-3 pb-2 border-b border-[var(--border-main)]">
                      Tools on DC
                    </h2>
                    <div className="overflow-auto">
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="border-b border-[var(--border-main)] bg-[var(--bg-subtle)]">
                            {["Tool No", "Name", "Group", "Qty", "Serial", "Due", "Status"].map((col) => (
                              <th key={col} className="text-left text-[10px] font-semibold text-[var(--text-muted)] uppercase tracking-wider py-2 px-3">
                                {col}
                              </th>
                            ))}
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-[var(--border-main)]">
                          {(selectedDc.inHouseLines ?? []).map((l) => (
                            <tr key={l.rowId} className="hover:bg-[var(--bg-hover)]">
                              <td className="py-2 px-3 font-mono text-xs font-bold">{l.toolOrGaugeNo ?? "—"}</td>
                              <td className="py-2 px-3 text-xs">{l.tool?.name ?? "—"}</td>
                              <td className="py-2 px-3 text-xs">{l.grouping ?? "—"}</td>
                              <td className="py-2 px-3 font-mono text-xs">{l.issueQty ?? 1}</td>
                              <td className="py-2 px-3 font-mono text-xs">{l.serialNo ?? "—"}</td>
                              <td className="py-2 px-3 font-mono text-xs">{formatDate(l.dueDate)}</td>
                              <td className="py-2 px-3 text-xs">{l.status ?? "—"}</td>
                            </tr>
                          ))}
                          {(selectedDc.inHouseLines ?? []).length === 0 && (
                            <tr>
                              <td colSpan={7} className="py-6 text-center text-sm text-[var(--text-muted)]">
                                No lines on this DC.
                              </td>
                            </tr>
                          )}
                        </tbody>
                      </table>
                    </div>
                  </div>

                  <ToolDocumentsPanel
                    dcNo={String(selectedDc.dcNo)}
                    defaultDocType="DC_ATTACHMENT"
                    allowedTypes={["DC_ATTACHMENT", "CALIB_CERTIFICATE", "CALIB_REPORT", "OTHER"]}
                    title={`Documents for DC #${selectedDc.dcNo}`}
                  />
                </>
              )}
            </div>
          ) : (
            <RoleGate
              permission="canManageCalibration"
              fallback={
                <div className="bg-[var(--bg-card)] rounded-xl border border-[var(--border-main)] p-6 text-center">
                  <ShieldAlert className="w-10 h-10 text-[var(--text-muted)] mx-auto mb-3" />
                  <p className="text-sm font-semibold">Access Denied</p>
                </div>
              }
            >
              <form onSubmit={handleSubmit} className="space-y-3">
                <div className="flex items-center justify-between gap-3 flex-wrap">
                  <button
                    type="button"
                    onClick={() => setMode("list")}
                    className="inline-flex items-center gap-1 text-xs font-bold text-[var(--text-muted)] hover:text-[var(--text-primary)] uppercase tracking-widest"
                  >
                    <ArrowLeft className="w-4 h-4" /> Back
                  </button>
                  <h1 className="text-lg font-bold text-[var(--text-primary)]">
                    Issue for Calibration / Preventive MNT
                  </h1>
                  <div className="flex items-center gap-3 text-xs">
                    <span className="font-mono bg-[var(--bg-subtle)] px-2 py-1 rounded border border-[var(--border-main)]">
                      DC Number: Auto
                    </span>
                    <span className="font-mono text-[var(--text-muted)]">Date of Issue: {issueDate}</span>
                  </div>
                </div>

                {/* Filters + source table */}
                <div className="bg-[var(--bg-card)] rounded-xl border border-[var(--border-main)] px-4 py-3 space-y-3">
                  <div className="grid grid-cols-2 md:grid-cols-6 gap-2">
                    <div>
                      <label className={headerLabelCls}>Issue for</label>
                      <select
                        value={issueFor}
                        onChange={(e) => {
                          setIssueFor(e.target.value);
                          setIssueForFilter(e.target.value);
                        }}
                        className={headerInputCls}
                      >
                        {ISSUE_FOR_OPTIONS.map((o) => (
                          <option key={o} value={o}>{o}</option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className={headerLabelCls}>Type of Item</label>
                      <select value={typeFilter} onChange={(e) => setTypeFilter(e.target.value)} className={headerInputCls}>
                        <option value="ALL">ALL</option>
                        {types.map((t) => (
                          <option key={t} value={t}>{t}</option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className={headerLabelCls}>Group / Name</label>
                      <select value={groupFilter} onChange={(e) => setGroupFilter(e.target.value)} className={headerInputCls}>
                        <option value="ALL">ALL</option>
                        {groups.map((g) => (
                          <option key={g} value={g}>{g}</option>
                        ))}
                      </select>
                    </div>
                    <div className="md:col-span-2">
                      <label className={headerLabelCls}>Search</label>
                      <div className="relative">
                        <Search className="w-3.5 h-3.5 text-[var(--text-muted)] absolute left-2 top-1/2 -translate-y-1/2" />
                        <input
                          value={searchQuery}
                          onChange={(e) => setSearchQuery(e.target.value)}
                          placeholder="Gauge / Tool No…"
                          className={`${headerInputCls} pl-7`}
                        />
                      </div>
                    </div>
                    <div className="flex items-end">
                      <Button type="button" variant="outline" className="h-8 w-full text-xs" onClick={handleSelectAll}>
                        {selectedKeys.size === dueToolsList.length && dueToolsList.length > 0 ? "Deselect All" : "Select All"}
                      </Button>
                    </div>
                  </div>

                  <div className="overflow-auto max-h-64 border border-[var(--border-main)] rounded-lg">
                    {loading ? (
                      <TableSkeleton rows={5} />
                    ) : (
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="border-b border-[var(--border-main)] bg-[var(--bg-subtle)]">
                            {["", "Gauge/Tool No", "Group", "Type", "Sl.No", "Description", "Location", "Cali. Plan", "Cali.Due.Dt.", "Cur.Status"].map((c) => (
                              <th key={c} className="text-left text-[10px] font-bold text-[var(--text-muted)] uppercase tracking-wider py-1.5 px-2">{c}</th>
                            ))}
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-[var(--border-main)]">
                          {dueToolsList.map((t) => {
                            const checked = selectedKeys.has(t.toolOrGaugeNo);
                            const isOver = t.daysLeft !== null && t.daysLeft < 0;
                            return (
                              <tr
                                key={t.refNo ?? t.toolOrGaugeNo}
                                className={checked ? "bg-emerald-50 dark:bg-emerald-950/20" : "hover:bg-[var(--bg-hover)]"}
                              >
                                <td className="py-1.5 px-2">
                                  <input type="checkbox" checked={checked} onChange={() => toggleSelect(t.toolOrGaugeNo)} />
                                </td>
                                <td className="py-1.5 px-2 font-mono text-xs font-semibold">{t.toolOrGaugeNo}</td>
                                <td className="py-1.5 px-2 text-xs">{t.grouping || "—"}</td>
                                <td className="py-1.5 px-2 text-xs">{t.type || "—"}</td>
                                <td className="py-1.5 px-2 font-mono text-xs">{t.serialNo ?? "—"}</td>
                                <td className="py-1.5 px-2 text-xs">{t.name || "—"}</td>
                                <td className="py-1.5 px-2 text-xs">{t.location || "—"}</td>
                                <td className="py-1.5 px-2 text-xs">{t.frequency || "—"}</td>
                                <td className={`py-1.5 px-2 font-mono text-xs ${isOver ? "text-[var(--color-danger-text)] font-bold" : ""}`}>
                                  {formatDate(t.nextCalibrationDate)}
                                </td>
                                <td className="py-1.5 px-2 text-xs">{t.status || "—"}</td>
                              </tr>
                            );
                          })}
                          {dueToolsList.length === 0 && (
                            <tr>
                              <td colSpan={10} className="py-6 text-center text-xs text-[var(--text-muted)]">No records found.</td>
                            </tr>
                          )}
                        </tbody>
                      </table>
                    )}
                  </div>

                  <div className="flex justify-center">
                    <Button type="button" variant="primary" onClick={addToIssueList}>
                      Add to Issue List
                    </Button>
                  </div>
                </div>

                {/* Issue list */}
                <div className="bg-[var(--bg-card)] rounded-xl border border-[var(--border-main)] px-4 py-3 space-y-3">
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                    <div>
                      <label className={headerLabelCls}>Party Name</label>
                      <select value={subCode} onChange={(e) => setSubCode(e.target.value)} className={headerInputCls}>
                        <option value="">--SELECT--</option>
                        {subs.map((s) => (
                          <option key={s.subCode} value={s.subCode}>{s.subCode} — {s.subName}</option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className={headerLabelCls}>Receiver Name *</label>
                      <input
                        id="form-receive-name"
                        value={receiveName}
                        onChange={(e) => setReceiveName(e.target.value)}
                        className={headerInputCls}
                        maxLength={25}
                      />
                      {errors.receiveName && <p className="text-[10px] text-[var(--color-danger-text)] mt-0.5">{errors.receiveName}</p>}
                    </div>
                    <div>
                      <label className={headerLabelCls}>TOOLS PO</label>
                      <select value={toolsPoNo} onChange={(e) => setToolsPoNo(e.target.value)} className={headerInputCls}>
                        <option value="Any">Any</option>
                      </select>
                    </div>
                    <div>
                      <label className={headerLabelCls}>Issue For</label>
                      <input value={issueFor} readOnly className={`${headerInputCls} opacity-80`} />
                    </div>
                  </div>

                  {errors.tools && (
                    <div className="p-2 bg-[var(--color-danger-bg)] border border-[var(--border-main)] rounded-lg text-xs text-[var(--color-danger-text)] font-semibold flex items-center gap-2">
                      <AlertTriangle className="w-4 h-4 shrink-0" />
                      {errors.tools}
                    </div>
                  )}

                  <div className="overflow-auto border border-[var(--border-main)] rounded-lg">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b border-[var(--border-main)] bg-[var(--bg-subtle)]">
                          {["Gauge/Tool No", "Group", "Type", "Sl.No", "Description", "Location", "Cali.Due.Dt.", "Status", ""].map((c) => (
                            <th key={c} className="text-left text-[10px] font-bold text-[var(--text-muted)] uppercase tracking-wider py-1.5 px-2">{c}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-[var(--border-main)]">
                        {staged.map((line) => (
                          <tr key={line.toolOrGaugeNo}>
                            <td className="py-1.5 px-2 font-mono text-xs font-semibold">{line.toolOrGaugeNo}</td>
                            <td className="py-1.5 px-2 text-xs">{line.grouping}</td>
                            <td className="py-1.5 px-2 text-xs">{line.type}</td>
                            <td className="py-1.5 px-2 font-mono text-xs">{line.serialNo || "—"}</td>
                            <td className="py-1.5 px-2 text-xs">{line.name}</td>
                            <td className="py-1.5 px-2 text-xs">{line.location}</td>
                            <td className="py-1.5 px-2 font-mono text-xs">{line.calibDueDate}</td>
                            <td className="py-1.5 px-2 text-xs">{line.status}</td>
                            <td className="py-1.5 px-2 text-right">
                              <button
                                type="button"
                                onClick={() => setStaged((prev) => prev.filter((s) => s.toolOrGaugeNo !== line.toolOrGaugeNo))}
                                className="p-1 text-[var(--text-muted)] hover:text-red-600"
                              >
                                <Trash className="w-3.5 h-3.5" />
                              </button>
                            </td>
                          </tr>
                        ))}
                        {staged.length === 0 && (
                          <tr>
                            <td colSpan={9} className="py-6 text-center text-xs text-[var(--text-muted)]">
                              No records found. Select tools above and click Add to Issue List.
                            </td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>

                  <div className="flex justify-end gap-2 pt-1">
                    <Button type="button" variant="outline" onClick={() => setMode("list")}>Cancel</Button>
                    <Button type="submit" id="calibration-issue-submit-btn" variant="primary" disabled={submitting || staged.length === 0}>
                      <Plus className="w-4 h-4" />
                      {submitting ? "Issuing…" : "Issue Calibration DC"}
                    </Button>
                  </div>
                </div>
              </form>
            </RoleGate>
          )}
        </main>
      </div>
    </div>
  );
}

export default function CalibrationIssuePageSuspense() {
  return (
    <Suspense fallback={<PageLoader />}>
      <CalibrationIssuePage />
    </Suspense>
  );
}
