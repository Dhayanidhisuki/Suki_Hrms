"use client";

import { useState, useEffect, useCallback } from "react";
import { Plus, CheckCircle2, ShieldAlert, AlertTriangle } from "lucide-react";
import Sidebar from "@/app/dashboard/components/Sidebar";
import TopBar from "@/app/dashboard/components/TopBar";
import RoleGate from "@/app/dashboard/components/RoleGate";
import { TableSkeleton } from "@/app/dashboard/components/LoadingSkeleton";
import { apiGet, apiPost } from "@/lib/apiClient";

interface CalibrationIssueLine {
  id: number;
  calibDcNo: string;
  toolOrGaugeNo: string;
  lastCalibDate: string | null;
  dueDate: string | null;
  tool?: { name: string } | null;
}

interface CalibrationIssueHeader {
  id: number;
  calibDcNo: string;
  issueType: string;
  labName: string | null;
  issueDate: string;
  expectedReturnDate: string;
  status: string;
  creatUserIdCd: string;
  inHouseLines?: CalibrationIssueLine[];
}

interface Tool {
  id: number;
  toolOrGaugeNo: string;
  name: string;
  status: string;
  lastCalibrationDate: string | null;
  nextCalibrationDate: string | null;
}

const statusConfig: Record<string, { bg: string; text: string }> = {
  OPEN: { bg: "bg-blue-50", text: "text-blue-700" },
  RECEIVED: { bg: "bg-emerald-50", text: "text-emerald-700" },
  CLOSED: { bg: "bg-slate-100", text: "text-slate-500" },
};

function getDaysUntilDue(dueDateStr: string | null): number | null {
  if (!dueDateStr) return null;
  const today = new Date();
  const due = new Date(dueDateStr);
  const diffTime = due.getTime() - today.getTime();
  return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
}

export default function CalibrationIssuePage() {
  const [history, setHistory] = useState<CalibrationIssueHeader[]>([]);
  const [tools, setTools] = useState<Tool[]>([]);
  const [loading, setLoading] = useState(true);

  // Success Banner
  const [successBanner, setSuccessBanner] = useState("");
  const [bannerMsg, setBannerMsg] = useState<{ type: "success" | "error"; text: string } | null>(null);

  // Form Fields
  const [issueType, setIssueType] = useState<"In-House" | "External">("External");
  const [labName, setLabName] = useState("");
  const [issueDate, setIssueDate] = useState("");
  const [expectedReturnDate, setExpectedReturnDate] = useState("");

  // Selected tool IDs from the due list
  const [selectedTools, setSelectedTools] = useState<string[]>([]);

  // Validation Errors
  const [errors, setErrors] = useState<Record<string, string>>({});

  const loadHistory = useCallback(async () => {
    setLoading(true);
    const res = await apiGet<{ items: CalibrationIssueHeader[] }>("/api/calibration/issue");
    if (res.data?.items) setHistory(res.data.items);
    setLoading(false);
  }, []);

  const loadTools = useCallback(async () => {
    const res = await apiGet<{ items: Tool[] }>("/api/tools");
    if (res.data?.items) setTools(res.data.items);
  }, []);

  useEffect(() => {
    loadHistory();
    loadTools();
  }, [loadHistory, loadTools]);

  useEffect(() => {
    setIssueDate(new Date().toISOString().split("T")[0]);
    setExpectedReturnDate("");
    setSelectedTools([]);
    setLabName("");
    setErrors({});
  }, [successBanner]);

  // "Tools Due for Calibration" smart list: due within next 30 days or overdue
  const todayVal = new Date();
  const dueCutoff = new Date();
  dueCutoff.setDate(dueCutoff.getDate() + 30);

  const dueToolsList = tools
    .map((t) => {
      const daysLeft = getDaysUntilDue(t.nextCalibrationDate);
      return { ...t, daysLeft };
    })
    .filter((t) => {
      if (t.status === "Under Calibration" || t.status === "Scrapped") return false;
      if (!t.nextCalibrationDate) return false;
      const nextCal = new Date(t.nextCalibrationDate);
      return nextCal <= dueCutoff;
    });

  const handleToggleToolSelection = (toolOrGaugeNo: string) => {
    if (selectedTools.includes(toolOrGaugeNo)) {
      setSelectedTools(selectedTools.filter((x) => x !== toolOrGaugeNo));
    } else {
      setSelectedTools([...selectedTools, toolOrGaugeNo]);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const tempErrors: Record<string, string> = {};

    if (!labName.trim()) tempErrors.labName = "Lab / Unit Name is required";
    if (!expectedReturnDate) {
      tempErrors.expectedReturnDate = "Expected Return Date is required";
    } else {
      const expDate = new Date(expectedReturnDate);
      const issDate = new Date(issueDate);
      if (expDate < issDate) {
        tempErrors.expectedReturnDate = "Expected return date cannot be before issue date";
      }
    }

    if (selectedTools.length === 0) {
      tempErrors.tools = "At least one tool must be selected for calibration issue";
    }

    if (Object.keys(tempErrors).length > 0) {
      setErrors(tempErrors);
      return;
    }

    const payload = {
      issueType,
      labName,
      issueDate,
      expectedReturnDate,
      toolOrGaugeNos: selectedTools,
    };

    setBannerMsg(null);
    const res = await apiPost<{ header: CalibrationIssueHeader }>("/api/calibration/issue", payload);
    if (res.error) {
      setBannerMsg({ type: "error", text: res.error.message });
      return;
    }

    setSuccessBanner(`Calibration DC issued for ${selectedTools.length} tools.`);
    setTimeout(() => setSuccessBanner(""), 4000);
    loadHistory();
    loadTools();
  };

  return (
    <div className="flex h-screen bg-slate-50 overflow-hidden">
      <Sidebar />
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        <TopBar />
        <main className="flex-1 overflow-y-auto px-7 py-6">
          {successBanner && (
            <div className="mb-4 p-4 bg-emerald-50 border border-emerald-200 rounded-2xl flex items-center gap-2.5 text-emerald-800 text-sm font-semibold shadow-sm">
              <CheckCircle2 className="w-5 h-5 text-emerald-500" />
              <span>{successBanner}</span>
            </div>
          )}

          {bannerMsg && (
            <div
              className={`mb-4 px-4 py-3 rounded-xl text-sm font-medium flex items-center gap-2 ${
                bannerMsg.type === "success"
                  ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                  : "bg-red-50 text-red-700 border border-red-200"
              }`}
            >
              {bannerMsg.text}
              <button
                onClick={() => setBannerMsg(null)}
                className="ml-auto text-xs opacity-60 hover:opacity-100"
              >
                ✕
              </button>
            </div>
          )}

          {/* ── Page Header ── */}
          <div className="mb-6">
            <h1 className="text-2xl font-bold text-slate-900 tracking-tight">
              Issue for Calibration
            </h1>
            <p className="text-sm text-slate-500 mt-0.5">
              Send tools/gauges to labs or in-house calibration (TOOLS_ISSUE_FOR_CALIBRATION)
            </p>
          </div>

          <div className="grid grid-cols-1 xl:grid-cols-3 gap-6 items-start mb-6">
            {/* ── ACTIVE DC FORM ── */}
            <div className="xl:col-span-2">
              <RoleGate
                permission="canManageCalibration"
                fallback={
                  <div className="bg-white rounded-2xl border border-slate-200 p-6 text-center py-10">
                    <ShieldAlert className="w-10 h-10 text-slate-300 mx-auto mb-3" />
                    <p className="text-sm font-semibold text-slate-800">Access Denied</p>
                    <p className="text-xs text-slate-400 mt-1">
                      Your role does not have permission to manage calibrations.
                    </p>
                  </div>
                }
              >
                <form onSubmit={handleSubmit} className="bg-white rounded-2xl border border-slate-200 p-5 space-y-4">
                  <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                    <h2 className="text-sm font-bold text-slate-800 uppercase tracking-widest">New Calibration DC</h2>
                    <span className="font-mono text-xs text-slate-400 font-bold bg-slate-100 px-2.5 py-1 rounded-md">
                      DC No: Auto-generated
                    </span>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1.5">
                        Issue Type
                      </label>
                      <div className="flex items-center gap-4 bg-slate-50 p-2 rounded-lg border border-slate-200 w-fit">
                        <label className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-700 cursor-pointer">
                          <input
                            type="radio"
                            name="issueType"
                            checked={issueType === "External"}
                            onChange={() => setIssueType("External")}
                            className="w-4 h-4 text-blue-600 border-slate-200"
                          />
                          External Lab
                        </label>
                        <label className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-700 cursor-pointer">
                          <input
                            type="radio"
                            name="issueType"
                            checked={issueType === "In-House"}
                            onChange={() => setIssueType("In-House")}
                            className="w-4 h-4 text-blue-600 border-slate-200"
                          />
                          In-House Unit
                        </label>
                      </div>
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1.5">
                        {issueType === "External" ? "Calibration Lab Name *" : "In-House Unit Name *"}
                      </label>
                      <input
                        id="form-lab-name"
                        value={labName}
                        onChange={(e) => setLabName(e.target.value)}
                        placeholder={issueType === "External" ? "e.g. Reliable Calibration Lab" : "e.g. Inhouse Repair Unit"}
                        className="w-full text-sm border border-slate-200 rounded-lg px-3 py-2 outline-none focus:ring-2 focus:ring-blue-500/30 bg-slate-50 font-medium"
                      />
                      {errors.labName && <p className="text-red-500 text-xs mt-1 font-semibold">{errors.labName}</p>}
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">
                        Issue Date
                      </label>
                      <input
                        type="date"
                        value={issueDate}
                        readOnly
                        className="w-full text-sm border border-slate-200 rounded-lg px-3 py-2 bg-slate-100 font-mono text-slate-500 cursor-not-allowed outline-none"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">
                        Expected Return Date *
                      </label>
                      <input
                        id="form-expected"
                        type="date"
                        value={expectedReturnDate}
                        onChange={(e) => setExpectedReturnDate(e.target.value)}
                        className="w-full text-sm border border-slate-200 rounded-lg px-3 py-2 outline-none focus:ring-2 focus:ring-blue-500/30 bg-slate-50 font-mono font-medium"
                      />
                      {errors.expectedReturnDate && <p className="text-red-500 text-xs mt-1 font-semibold">{errors.expectedReturnDate}</p>}
                    </div>
                  </div>

                  {/* Smart Checklist */}
                  <div className="pt-2">
                    <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">
                      Tools Due for Calibration ({dueToolsList.length} Due)
                    </p>
                    {errors.tools && (
                      <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-xs text-red-800 font-semibold mb-3 flex items-center gap-2">
                        <AlertTriangle className="w-4 h-4 text-red-500" />
                        <span>{errors.tools}</span>
                      </div>
                    )}

                    <div className="overflow-auto border border-slate-100 rounded-xl max-h-64">
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="border-b border-slate-100 bg-slate-50/50">
                            <th className="py-2.5 px-3 text-left w-10"></th>
                            {["Tool No", "Name", "Last Calib", "Next Due", "Days Until Due"].map((col) => (
                              <th key={col} className="text-left text-[11px] font-bold text-slate-400 uppercase tracking-wider py-2.5 px-3">
                                {col}
                              </th>
                            ))}
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-50">
                          {dueToolsList.map((t) => {
                            const isOver = t.daysLeft !== null && t.daysLeft < 0;
                            return (
                              <tr key={t.id} className="hover:bg-slate-50/50 transition-colors">
                                <td className="py-2 px-3">
                                  <input
                                    type="checkbox"
                                    checked={selectedTools.includes(t.toolOrGaugeNo)}
                                    onChange={() => handleToggleToolSelection(t.toolOrGaugeNo)}
                                    className="w-4.5 h-4.5 text-blue-600 border-slate-200 rounded focus:ring-blue-500"
                                  />
                                </td>
                                <td className="py-2 px-3 font-mono text-xs text-slate-500 font-semibold">{t.toolOrGaugeNo}</td>
                                <td className="py-2 px-3 font-semibold text-slate-800">{t.name}</td>
                                <td className="py-2 px-3 font-mono text-xs text-slate-600">{t.lastCalibrationDate || "—"}</td>
                                <td className={`py-2 px-3 font-mono text-xs font-semibold ${isOver ? "text-red-600" : "text-slate-600"}`}>
                                  {t.nextCalibrationDate}
                                </td>
                                <td className="py-2 px-3">
                                  {isOver ? (
                                    <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-red-50 text-red-700">
                                      <AlertTriangle className="w-3 h-3" /> OVERDUE {Math.abs(t.daysLeft ?? 0)} days
                                    </span>
                                  ) : (
                                    <span className="text-xs font-semibold text-slate-500">
                                      {t.daysLeft} days left
                                    </span>
                                  )}
                                </td>
                              </tr>
                            );
                          })}
                          {dueToolsList.length === 0 && (
                            <tr>
                              <td colSpan={6} className="py-8 text-center text-xs text-slate-400 font-semibold">
                                No tools currently due or overdue for calibration!
                              </td>
                            </tr>
                          )}
                        </tbody>
                      </table>
                    </div>
                  </div>

                  {/* Form Submit */}
                  <div className="border-t border-slate-100 pt-4 flex items-center justify-end bg-white">
                    <button
                      type="submit"
                      id="calibration-issue-submit-btn"
                      className="flex items-center gap-2 px-6 py-2.5 bg-blue-600 hover:bg-blue-700 active:bg-blue-800 text-white text-sm font-semibold rounded-xl shadow-sm hover:shadow-md transition-all duration-150"
                    >
                      <Plus className="w-4 h-4" /> Issue Calibration DC
                    </button>
                  </div>
                </form>
              </RoleGate>
            </div>

            {/* Quick Panel Summary */}
            <div className="bg-white rounded-2xl border border-slate-200 p-5 space-y-4">
              <h2 className="text-sm font-bold text-slate-800 uppercase tracking-widest">Staged DC Summary</h2>
              <div className="border-y border-slate-100 py-3 space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-slate-500 font-medium">Staged Lab Name</span>
                  <span className="font-bold text-slate-800">{labName || "—"}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500 font-medium">DC Type</span>
                  <span className="font-bold text-slate-800">{issueType}</span>
                </div>
                <div className="flex justify-between border-t border-slate-50 pt-2">
                  <span className="text-slate-500 font-semibold">Selected Tools Count</span>
                  <span className="font-bold text-blue-600 font-mono text-base">{selectedTools.length}</span>
                </div>
              </div>

              {selectedTools.length > 0 && (
                <div className="space-y-2.5">
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Included Tools Preview</p>
                  <div className="space-y-1.5 max-h-40 overflow-y-auto">
                    {selectedTools.map((no) => {
                      const t = tools.find((x) => x.toolOrGaugeNo === no);
                      return (
                        <p key={no} className="text-xs text-slate-600 truncate bg-slate-50 p-2 rounded-lg font-medium border border-slate-100">
                          {no} · {t?.name}
                        </p>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* ── HISTORY TABLE (BELOW) ── */}
          <div className="bg-white rounded-2xl border border-slate-200 p-5">
            <div className="pb-3 border-b border-slate-100 mb-4">
              <h2 className="text-sm font-bold text-slate-800 uppercase tracking-widest">Calibration Issue History</h2>
            </div>

            <div className="overflow-auto">
              {loading ? (
                <TableSkeleton rows={3} />
              ) : history.length === 0 ? (
                <div className="text-center text-sm text-slate-400 py-8">
                  No calibration issue records found.
                </div>
              ) : (
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-100">
                    {["DC No", "Lab / Unit Name", "Type", "Issue Date", "Expected Return", "Status"].map((col) => (
                      <th key={col} className="text-left text-[11px] font-semibold text-slate-400 uppercase tracking-wider pb-2.5 pr-4 last:pr-0">
                        {col}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                  {history.map((ci) => {
                    const sc = statusConfig[ci.status] ?? statusConfig["OPEN"];
                    return (
                      <tr key={ci.id} className="hover:bg-slate-50/60 transition-colors">
                        <td className="py-3 pr-4 font-mono text-xs text-slate-500 font-semibold">{ci.calibDcNo}</td>
                        <td className="py-3 pr-4 font-medium text-slate-800">{ci.labName ?? "—"}</td>
                        <td className="py-3 pr-4 text-slate-600">{ci.issueType}</td>
                        <td className="py-3 pr-4 font-mono text-xs text-slate-600">{ci.issueDate ? ci.issueDate.split("T")[0] : "—"}</td>
                        <td className="py-3 pr-4 font-mono text-xs text-slate-600">{ci.expectedReturnDate ? ci.expectedReturnDate.split("T")[0] : "—"}</td>
                        <td className="py-3">
                          <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-semibold ${sc.bg} ${sc.text}`}>
                            {ci.status}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
              )}
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}
