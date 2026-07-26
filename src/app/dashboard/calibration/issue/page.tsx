"use client";

import { useState, useEffect, useCallback } from "react";
import { Plus, CheckCircle2, AlertTriangle, ShieldAlert } from "lucide-react";
import Sidebar from "@/app/dashboard/components/Sidebar";
import TopBar from "@/app/dashboard/components/TopBar";
import RoleGate from "@/app/dashboard/components/RoleGate";
import { TableSkeleton } from "@/app/dashboard/components/LoadingSkeleton";
import { apiGet, apiPost } from "@/lib/apiClient";
import { Button } from "@/components/ui/button";

interface Tool {
  id: number;
  toolOrGaugeNo: string;
  name: string;
  lastCalibrationDate: string | null;
  nextCalibrationDate: string | null;
  status: string;
  daysLeft?: number | null;
}

interface CalibrationIssueHeader {
  id: number;
  calibDcNo: string;
  issueType: string;
  labName: string | null;
  issueDate: string;
  expectedReturnDate: string | null;
  status: string;
}

const statusConfig: Record<string, { bg: string; text: string }> = {
  OPEN: { bg: "bg-[var(--primary-light)] border border-[var(--border-main)]", text: "text-[var(--primary)]" },
  CLOSED: { bg: "bg-[var(--color-success-bg)] border border-[var(--border-main)]", text: "text-[var(--color-success-text)]" },
  PARTIAL: { bg: "bg-[var(--color-warning-bg)] border border-[var(--border-main)]", text: "text-[var(--color-warning-text)]" },
};

function daysUntil(dateStr: string | null): number | null {
  if (!dateStr) return null;
  const today = new Date();
  const due = new Date(dateStr);
  return Math.ceil((due.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
}

export default function CalibrationIssuePage() {
  const [tools, setTools] = useState<Tool[]>([]);
  const [history, setHistory] = useState<CalibrationIssueHeader[]>([]);
  const [loading, setLoading] = useState(true);

  // Success Banner
  const [successBanner, setSuccessBanner] = useState("");
  const [bannerMsg, setBannerMsg] = useState<{ type: "success" | "error"; text: string } | null>(null);

  // Form State
  const [issueType, setIssueType] = useState<"External" | "In-House">("External");
  const [labName, setLabName] = useState("");
  const [issueDate, setIssueDate] = useState("");
  const [expectedReturnDate, setExpectedReturnDate] = useState("");
  const [selectedTools, setSelectedTools] = useState<string[]>([]);

  // Validation Error State
  const [errors, setErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    setIssueDate(new Date().toISOString().split("T")[0]);
  }, []);

  const loadData = useCallback(async () => {
    setLoading(true);
    const [tRes, hRes] = await Promise.all([
      apiGet<{ items: Tool[] }>("/api/tools/calibration-due"),
      apiGet<{ items: CalibrationIssueHeader[] }>("/api/calibration/issue"),
    ]);

    if (tRes.data?.items) setTools(tRes.data.items);
    if (hRes.data?.items) setHistory(hRes.data.items);
    setLoading(false);
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const dueToolsList = tools
    .map((t) => ({ ...t, daysLeft: daysUntil(t.nextCalibrationDate) }))
    .filter((t) => t.daysLeft !== null && t.daysLeft <= 30)
    .sort((a, b) => (a.daysLeft ?? 0) - (b.daysLeft ?? 0));

  const handleToggleToolSelection = (toolOrGaugeNo: string) => {
    setSelectedTools((prev) =>
      prev.includes(toolOrGaugeNo) ? prev.filter((no) => no !== toolOrGaugeNo) : [...prev, toolOrGaugeNo]
    );
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const tempErrors: Record<string, string> = {};

    if (!labName.trim()) tempErrors.labName = "Lab / Unit Name is required";
    if (!expectedReturnDate) tempErrors.expectedReturnDate = "Expected Return Date is required";
    if (selectedTools.length === 0) tempErrors.tools = "Select at least one tool due for calibration";

    if (Object.keys(tempErrors).length > 0) {
      setErrors(tempErrors);
      return;
    }

    const payload = {
      issueType,
      labName,
      expectedReturnDate,
      toolOrGaugeNos: selectedTools,
    };

    setBannerMsg(null);
    const res = await apiPost<{ item: CalibrationIssueHeader }>("/api/calibration/issue", payload);

    if (res.error) {
      setBannerMsg({ type: "error", text: res.error.message });
      return;
    }

    if (res.data?.item) {
      setSuccessBanner(`Calibration DC #${res.data.item.calibDcNo} created successfully!`);
      setLabName("");
      setExpectedReturnDate("");
      setSelectedTools([]);
      setErrors({});
      loadData();
      setTimeout(() => setSuccessBanner(""), 5000);
    }
  };

  return (
    <div className="flex h-screen bg-[var(--bg-app)] text-[var(--text-primary)] overflow-hidden">
      <Sidebar />
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        <TopBar />
        <main className="flex-1 overflow-y-auto px-7 py-6">
          {successBanner && (
            <div className="mb-4 p-4 bg-[var(--color-success-bg)] border border-[var(--border-main)] rounded-2xl flex items-center gap-2.5 text-[var(--color-success-text)] text-sm font-semibold shadow-sm">
              <CheckCircle2 className="w-5 h-5 text-emerald-500" />
              <span>{successBanner}</span>
            </div>
          )}

          {bannerMsg && (
            <div
              className={`mb-4 px-4 py-3 rounded-xl text-sm font-medium flex items-center gap-2 ${
                bannerMsg.type === "success"
                  ? "bg-[var(--color-success-bg)] text-[var(--color-success-text)] border border-[var(--border-main)]"
                  : "bg-[var(--color-danger-bg)] text-[var(--color-danger-text)] border border-[var(--border-main)]"
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
            <h1 className="text-2xl font-bold text-[var(--text-primary)] tracking-tight">
              Issue for Calibration
            </h1>
            <p className="text-sm text-[var(--text-muted)] mt-0.5">
              Send tools/gauges to labs or in-house calibration (TOOLS_ISSUE_FOR_CALIBRATION)
            </p>
          </div>

          <div className="grid grid-cols-1 xl:grid-cols-3 gap-6 items-start mb-6">
            {/* ── ACTIVE DC FORM ── */}
            <div className="xl:col-span-2">
              <RoleGate
                permission="canManageCalibration"
                fallback={
                  <div className="bg-[var(--bg-card)] rounded-2xl border border-[var(--border-main)] p-6 text-center py-10">
                    <ShieldAlert className="w-10 h-10 text-[var(--text-muted)] mx-auto mb-3" />
                    <p className="text-sm font-semibold text-[var(--text-primary)]">Access Denied</p>
                    <p className="text-xs text-[var(--text-muted)] mt-1">
                      Your role does not have permission to manage calibrations.
                    </p>
                  </div>
                }
              >
                <form onSubmit={handleSubmit} className="bg-[var(--bg-card)] rounded-2xl border border-[var(--border-main)] p-5 space-y-4">
                  <div className="flex items-center justify-between pb-3 border-b border-[var(--border-main)]">
                    <h2 className="text-sm font-bold text-[var(--text-primary)] uppercase tracking-widest">New Calibration DC</h2>
                    <span className="font-mono text-xs text-[var(--text-muted)] font-bold bg-[var(--bg-subtle)] px-2.5 py-1 rounded-md">
                      DC No: Auto-generated
                    </span>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-semibold text-[var(--text-muted)] uppercase tracking-wider mb-1.5">
                        Issue Type
                      </label>
                      <div className="flex items-center gap-4 bg-[var(--bg-subtle)] p-2 rounded-lg border border-[var(--border-main)] w-fit">
                        <label className="inline-flex items-center gap-1.5 text-xs font-semibold text-[var(--text-primary)] cursor-pointer">
                          <input
                            type="radio"
                            name="issueType"
                            checked={issueType === "External"}
                            onChange={() => setIssueType("External")}
                            className="w-4 h-4 text-[var(--primary)] border-[var(--border-main)]"
                          />
                          External Lab
                        </label>
                        <label className="inline-flex items-center gap-1.5 text-xs font-semibold text-[var(--text-primary)] cursor-pointer">
                          <input
                            type="radio"
                            name="issueType"
                            checked={issueType === "In-House"}
                            onChange={() => setIssueType("In-House")}
                            className="w-4 h-4 text-[var(--primary)] border-[var(--border-main)]"
                          />
                          In-House Unit
                        </label>
                      </div>
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-[var(--text-muted)] uppercase tracking-wider mb-1.5">
                        {issueType === "External" ? "Calibration Lab Name *" : "In-House Unit Name *"}
                      </label>
                      <input
                        id="form-lab-name"
                        value={labName}
                        onChange={(e) => setLabName(e.target.value)}
                        placeholder={issueType === "External" ? "e.g. Reliable Calibration Lab" : "e.g. Inhouse Repair Unit"}
                        className="w-full text-sm border border-[var(--border-main)] rounded-lg px-3 py-2 outline-none focus:ring-2 focus:ring-[var(--primary-subtle)] bg-[var(--bg-subtle)] text-[var(--text-primary)] placeholder-[var(--text-muted)] font-medium"
                      />
                      {errors.labName && <p className="text-[var(--color-danger-text)] text-xs mt-1 font-semibold">{errors.labName}</p>}
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-semibold text-[var(--text-muted)] uppercase tracking-wider mb-1">
                        Issue Date
                      </label>
                      <input
                        type="date"
                        value={issueDate}
                        readOnly
                        className="w-full text-sm border border-[var(--border-main)] rounded-lg px-3 py-2 bg-[var(--bg-hover)] font-mono text-[var(--text-muted)] cursor-not-allowed outline-none"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-[var(--text-muted)] uppercase tracking-wider mb-1">
                        Expected Return Date *
                      </label>
                      <input
                        id="form-expected"
                        type="date"
                        value={expectedReturnDate}
                        onChange={(e) => setExpectedReturnDate(e.target.value)}
                        className="w-full text-sm border border-[var(--border-main)] rounded-lg px-3 py-2 outline-none focus:ring-2 focus:ring-[var(--primary-subtle)] bg-[var(--bg-subtle)] text-[var(--text-primary)] font-mono font-medium"
                      />
                      {errors.expectedReturnDate && <p className="text-[var(--color-danger-text)] text-xs mt-1 font-semibold">{errors.expectedReturnDate}</p>}
                    </div>
                  </div>

                  {/* Smart Checklist */}
                  <div className="pt-2">
                    <p className="text-xs font-bold text-[var(--text-muted)] uppercase tracking-wider mb-2">
                      Tools Due for Calibration ({dueToolsList.length} Due)
                    </p>
                    {errors.tools && (
                      <div className="p-3 bg-[var(--color-danger-bg)] border border-[var(--border-main)] rounded-xl text-xs text-[var(--color-danger-text)] font-semibold mb-3 flex items-center gap-2">
                        <AlertTriangle className="w-4 h-4 text-red-500" />
                        <span>{errors.tools}</span>
                      </div>
                    )}

                    <div className="overflow-auto border border-[var(--border-main)] rounded-xl max-h-64">
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="border-b border-[var(--border-main)] bg-[var(--bg-subtle)]">
                            <th className="py-2.5 px-3 text-left w-10"></th>
                            {["Tool No", "Name", "Last Calib", "Next Due", "Days Until Due"].map((col) => (
                              <th key={col} className="text-left text-[11px] font-bold text-[var(--text-muted)] uppercase tracking-wider py-2.5 px-3">
                                {col}
                              </th>
                            ))}
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-[var(--border-main)]">
                          {dueToolsList.map((t) => {
                            const isOver = t.daysLeft !== null && t.daysLeft < 0;
                            return (
                              <tr key={t.id} className="hover:bg-[var(--bg-hover)] transition-colors">
                                <td className="py-2 px-3">
                                  <input
                                    type="checkbox"
                                    checked={selectedTools.includes(t.toolOrGaugeNo)}
                                    onChange={() => handleToggleToolSelection(t.toolOrGaugeNo)}
                                    className="w-4.5 h-4.5 text-[var(--primary)] border-[var(--border-main)] rounded focus:ring-[var(--primary)]"
                                  />
                                </td>
                                <td className="py-2 px-3 font-mono text-xs text-[var(--text-secondary)] font-semibold">{t.toolOrGaugeNo}</td>
                                <td className="py-2 px-3 font-semibold text-[var(--text-primary)]">{t.name}</td>
                                <td className="py-2 px-3 font-mono text-xs text-[var(--text-muted)]">{t.lastCalibrationDate || "—"}</td>
                                <td className={`py-2 px-3 font-mono text-xs font-semibold ${isOver ? "text-[var(--color-danger-text)]" : "text-[var(--text-secondary)]"}`}>
                                  {t.nextCalibrationDate}
                                </td>
                                <td className="py-2 px-3">
                                  {isOver ? (
                                    <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-[var(--color-danger-bg)] text-[var(--color-danger-text)] border border-[var(--border-main)]">
                                      <AlertTriangle className="w-3 h-3" /> OVERDUE {Math.abs(t.daysLeft ?? 0)} days
                                    </span>
                                  ) : (
                                    <span className="text-xs font-semibold text-[var(--text-muted)]">
                                      {t.daysLeft} days left
                                    </span>
                                  )}
                                </td>
                              </tr>
                            );
                          })}
                          {dueToolsList.length === 0 && (
                            <tr>
                              <td colSpan={6} className="py-8 text-center text-xs text-[var(--text-muted)] font-semibold">
                                No tools currently due or overdue for calibration!
                              </td>
                            </tr>
                          )}
                        </tbody>
                      </table>
                    </div>
                  </div>

                  {/* Form Submit */}
                  <div className="border-t border-[var(--border-main)] pt-4 flex items-center justify-end bg-[var(--bg-card)]">
                    <Button
                      type="submit"
                      id="calibration-issue-submit-btn"
                      variant="primary"
                      size="lg"
                    >
                      <Plus className="w-4 h-4" /> Issue Calibration DC
                    </Button>
                  </div>
                </form>
              </RoleGate>
            </div>

            {/* Quick Panel Summary */}
            <div className="bg-[var(--bg-card)] rounded-2xl border border-[var(--border-main)] p-5 space-y-4">
              <h2 className="text-sm font-bold text-[var(--text-primary)] uppercase tracking-widest">Staged DC Summary</h2>
              <div className="border-y border-[var(--border-main)] py-3 space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-[var(--text-muted)] font-medium">Staged Lab Name</span>
                  <span className="font-bold text-[var(--text-primary)]">{labName || "—"}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-[var(--text-muted)] font-medium">DC Type</span>
                  <span className="font-bold text-[var(--text-primary)]">{issueType}</span>
                </div>
                <div className="flex justify-between border-t border-[var(--border-main)] pt-2">
                  <span className="text-[var(--text-muted)] font-semibold">Selected Tools Count</span>
                  <span className="font-bold text-[var(--primary)] font-mono text-base">{selectedTools.length}</span>
                </div>
              </div>

              {selectedTools.length > 0 && (
                <div className="space-y-2.5">
                  <p className="text-[10px] font-bold text-[var(--text-muted)] uppercase tracking-wider">Included Tools Preview</p>
                  <div className="space-y-1.5 max-h-40 overflow-y-auto">
                    {selectedTools.map((no) => {
                      const t = tools.find((x) => x.toolOrGaugeNo === no);
                      return (
                        <p key={no} className="text-xs text-[var(--text-primary)] truncate bg-[var(--bg-subtle)] p-2 rounded-lg font-medium border border-[var(--border-main)]">
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
          <div className="bg-[var(--bg-card)] rounded-2xl border border-[var(--border-main)] p-5">
            <div className="pb-3 border-b border-[var(--border-main)] mb-4">
              <h2 className="text-sm font-bold text-[var(--text-primary)] uppercase tracking-widest">Calibration Issue History</h2>
            </div>

            <div className="overflow-auto">
              {loading ? (
                <TableSkeleton rows={3} />
              ) : history.length === 0 ? (
                <div className="text-center text-sm text-[var(--text-muted)] py-8">
                  No calibration issue records found.
                </div>
              ) : (
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-[var(--border-main)] bg-[var(--bg-subtle)]">
                    {["DC No", "Lab / Unit Name", "Type", "Issue Date", "Expected Return", "Status"].map((col) => (
                      <th key={col} className="text-left text-[11px] font-semibold text-[var(--text-muted)] uppercase tracking-wider py-2.5 px-3">
                        {col}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-[var(--border-main)]">
                  {history.map((ci) => {
                    const sc = statusConfig[ci.status] ?? statusConfig["OPEN"];
                    return (
                      <tr key={ci.id} className="hover:bg-[var(--bg-hover)] transition-colors">
                        <td className="py-3 px-3 font-mono text-xs text-[var(--text-secondary)] font-semibold">{ci.calibDcNo}</td>
                        <td className="py-3 px-3 font-medium text-[var(--text-primary)]">{ci.labName ?? "—"}</td>
                        <td className="py-3 px-3 text-[var(--text-secondary)]">{ci.issueType}</td>
                        <td className="py-3 px-3 font-mono text-xs text-[var(--text-muted)]">{ci.issueDate ? ci.issueDate.split("T")[0] : "—"}</td>
                        <td className="py-3 px-3 font-mono text-xs text-[var(--text-muted)]">{ci.expectedReturnDate ? ci.expectedReturnDate.split("T")[0] : "—"}</td>
                        <td className="py-3 px-3">
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
