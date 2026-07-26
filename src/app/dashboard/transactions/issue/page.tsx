"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { Plus, Trash, Search, ArrowUpRight, CheckCircle2, X, ShieldAlert } from "lucide-react";
import Sidebar from "@/app/dashboard/components/Sidebar";
import TopBar from "@/app/dashboard/components/TopBar";
import RoleGate from "@/app/dashboard/components/RoleGate";
import { TableSkeleton } from "@/app/dashboard/components/LoadingSkeleton";
import { apiGet, apiPost } from "@/lib/apiClient";
import { Button } from "@/components/ui/button";

type IssueStatus = "OPEN" | "CLOSED" | "PARTIAL";

interface ToolsIssueLine {
  id: number;
  dcNo: string;
  toolOrGaugeNo: string;
  qtyIssued: number;
  qtyReturned: number;
  remainingQty: number;
  status: string;
}

interface ToolsIssueHeader {
  id: number;
  dcNo: string;
  deptName: string;
  partyName: string;
  issueDate: string;
  dueDate: string;
  status: IssueStatus;
  creatUserIdCd: string;
  creatDt: string;
  lines: ToolsIssueLine[];
}

interface Tool {
  id: number;
  toolOrGaugeNo: string;
  name: string;
  grouping: string;
  qtyIn: number;
  status: string;
}

const statusConfig: Record<string, { bg: string; text: string }> = {
  OPEN: { bg: "bg-[var(--primary-light)] border border-[var(--border-main)]", text: "text-[var(--primary)]" },
  CLOSED: { bg: "bg-[var(--color-success-bg)] border border-[var(--border-main)]", text: "text-[var(--color-success-text)]" },
  PARTIAL: { bg: "bg-[var(--color-warning-bg)] border border-[var(--border-main)]", text: "text-[var(--color-warning-text)]" },
};

interface StagedLine {
  toolOrGaugeNo: string;
  toolName: string;
  qtyIssued: number;
  qtyAvailable: number;
}

export default function IssueToolPage() {
  const [issues, setIssues] = useState<ToolsIssueHeader[]>([]);
  const [tools, setTools] = useState<Tool[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);

  // Success Banner
  const [successBanner, setSuccessBanner] = useState("");
  const [bannerMsg, setBannerMsg] = useState<{ type: "success" | "error"; text: string } | null>(null);

  // Form Header State
  const [deptName, setDeptName] = useState("");
  const [partyName, setPartyName] = useState("");
  const [issueDate, setIssueDate] = useState("");
  const [dueDate, setDueDate] = useState("");

  // Staged lines
  const [stagedLines, setStagedLines] = useState<StagedLine[]>([]);

  // Search/Dropdown selection state
  const [searchVal, setSearchVal] = useState("");
  const [showSearchDropdown, setShowSearchDropdown] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Validation Error State
  const [formErrors, setFormErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    // Default dates
    setIssueDate(new Date().toISOString().split("T")[0]);
    setDueDate("");
  }, [showCreate]);

  const loadIssues = useCallback(async () => {
    setLoading(true);
    const res = await apiGet<{ items: ToolsIssueHeader[] }>("/api/issue");
    if (res.data?.items) setIssues(res.data.items);
    setLoading(false);
  }, []);

  const loadTools = useCallback(async () => {
    const res = await apiGet<{ items: Tool[] }>("/api/tools");
    if (res.data?.items) setTools(res.data.items);
  }, []);

  useEffect(() => {
    loadIssues();
    loadTools();
  }, [loadIssues, loadTools]);

  // Click outside listener to close search dropdown
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setShowSearchDropdown(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Filter tools for dropdown
  const searchResults = tools.filter((t) => {
    const query = searchVal.toLowerCase();
    const matchesQuery = t.name.toLowerCase().includes(query) || t.toolOrGaugeNo.toLowerCase().includes(query);
    const isAvailable = t.qtyIn > 0 && t.status === "Available";
    return matchesQuery && isAvailable;
  });

  const getAvailableStock = (toolNo: string) => {
    const found = tools.find((t) => t.toolOrGaugeNo === toolNo);
    const inStock = found ? found.qtyIn : 0;
    const alreadyStaged = stagedLines
      .filter((l) => l.toolOrGaugeNo === toolNo)
      .reduce((sum, l) => sum + l.qtyIssued, 0);
    return Math.max(0, inStock - alreadyStaged);
  };

  const handleSelectTool = (toolNo: string, name: string, stock: number) => {
    const currentAvail = getAvailableStock(toolNo);
    if (currentAvail <= 0) return;

    const existingIdx = stagedLines.findIndex((l) => l.toolOrGaugeNo === toolNo);
    if (existingIdx >= 0) {
      const updated = [...stagedLines];
      updated[existingIdx].qtyIssued += 1;
      setStagedLines(updated);
    } else {
      setStagedLines((prev) => [
        ...prev,
        { toolOrGaugeNo: toolNo, toolName: name, qtyIssued: 1, qtyAvailable: stock },
      ]);
    }
    setSearchVal("");
    setShowSearchDropdown(false);
    setFormErrors((prev) => ({ ...prev, lines: "" }));
  };

  const handleUpdateQty = (index: number, newQty: number) => {
    const updated = [...stagedLines];
    const maxVal = updated[index].qtyAvailable;
    updated[index].qtyIssued = Math.min(Math.max(1, newQty), maxVal);
    setStagedLines(updated);
  };

  const handleRemoveLine = (index: number) => {
    setStagedLines((prev) => prev.filter((_, i) => i !== index));
  };

  const handleClearForm = () => {
    setDeptName("");
    setPartyName("");
    setDueDate("");
    setStagedLines([]);
    setFormErrors({});
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const errors: Record<string, string> = {};

    if (!deptName.trim()) errors.deptName = "Department is required";
    if (!partyName.trim()) errors.partyName = "Receiving party/employee is required";
    if (!dueDate) errors.dueDate = "Return due date is required";
    if (stagedLines.length === 0) errors.lines = "At least one tool line item must be added to issue slip";

    if (Object.keys(errors).length > 0) {
      setFormErrors(errors);
      return;
    }

    const payload = {
      deptName,
      partyName,
      dueDate,
      lines: stagedLines.map((l) => ({
        toolOrGaugeNo: l.toolOrGaugeNo,
        qtyIssued: l.qtyIssued,
      })),
    };

    setBannerMsg(null);
    const res = await apiPost<{ item: ToolsIssueHeader }>("/api/issue", payload);

    if (res.error) {
      setBannerMsg({ type: "error", text: res.error.message });
      return;
    }

    if (res.data?.item) {
      setSuccessBanner(`DC #${res.data.item.dcNo} issued successfully to ${partyName}!`);
      handleClearForm();
      setShowCreate(false);
      loadIssues();
      loadTools();
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

          {/* ── Header ── */}
          <div className="flex items-center justify-between mb-6">
            <div>
              <h1 className="text-2xl font-bold text-[var(--text-primary)] tracking-tight">
                Issue Tool
              </h1>
              <p className="text-sm text-[var(--text-muted)] mt-0.5">
                Issue tools/gauges to department or employee (GAUGE_TOOLS_ISSUE)
              </p>
            </div>
            <RoleGate permission="canCreateIssue">
              {!showCreate && (
                <Button
                  id="issue-create-btn"
                  onClick={() => setShowCreate(true)}
                  variant="primary"
                  className="group"
                >
                  <Plus className="w-4 h-4 transition-transform group-hover:rotate-90 duration-200" />
                  New Issue (DC)
                </Button>
              )}
            </RoleGate>
          </div>

          {!showCreate ? (
            /* ── VIEW PREVIOUS ISSUES LIST ── */
            <div className="flex flex-col gap-4 animate-fade-in">
              {loading ? (
                <TableSkeleton rows={3} />
              ) : issues.length === 0 ? (
                <div className="bg-[var(--bg-card)] rounded-2xl border border-[var(--border-main)] p-8 text-center text-sm text-[var(--text-muted)]">
                  No issue records found. Create a new issue to get started.
                </div>
              ) : (
              issues.map((issue) => {
                const sc = statusConfig[issue.status] ?? statusConfig["OPEN"];
                return (
                  <div key={issue.id} className="bg-[var(--bg-card)] rounded-2xl border border-[var(--border-main)] p-5">
                    <div className="flex items-center justify-between mb-3">
                      <div>
                        <p className="font-mono text-sm font-semibold text-[var(--text-primary)]">{issue.dcNo}</p>
                        <p className="text-xs text-[var(--text-muted)] mt-0.5">
                          {issue.deptName} · {issue.partyName} · Issued {issue.issueDate ? issue.issueDate.split("T")[0] : "—"} · Due {issue.dueDate ? issue.dueDate.split("T")[0] : "—"}
                        </p>
                      </div>
                      <span
                        className={`inline-flex items-center px-2.5 py-1 rounded-full text-[11px] font-semibold ${sc.bg} ${sc.text}`}
                      >
                        {issue.status}
                      </span>
                    </div>
                    <div className="overflow-auto">
                      <table className="w-full text-sm border-collapse">
                        <thead>
                          <tr className="border-b border-[var(--border-main)] bg-[var(--bg-subtle)]">
                            {["Tool No", "Qty Issued", "Qty Returned", "Remaining", "Status"].map(
                              (col) => (
                                <th
                                  key={col}
                                  className="text-left text-[11px] font-semibold text-[var(--text-muted)] uppercase tracking-wider py-2.5 px-4"
                                >
                                  {col}
                                </th>
                              )
                            )}
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-[var(--border-main)]">
                          {issue.lines.map((line) => (
                            <tr key={line.id} className="hover:bg-[var(--bg-hover)] transition-colors">
                              <td className="py-3 px-4 align-middle font-mono text-xs text-[var(--text-secondary)] font-medium">
                                {line.toolOrGaugeNo}
                              </td>
                              <td className="py-3 px-4 align-middle text-[var(--text-secondary)] font-mono text-xs">{line.qtyIssued}</td>
                              <td className="py-3 px-4 align-middle text-[var(--text-secondary)] font-mono text-xs">{line.qtyReturned}</td>
                              <td className="py-3 px-4 align-middle text-[var(--text-primary)] font-mono text-xs font-semibold">{line.remainingQty}</td>
                              <td className="py-3 px-4 align-middle">
                                <span
                                  className={`inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-semibold ${
                                    line.status === "Open"
                                      ? "bg-[var(--primary-light)] text-[var(--primary)] border border-[var(--border-main)]"
                                      : "bg-[var(--color-success-bg)] text-[var(--color-success-text)] border border-[var(--border-main)]"
                                  }`}
                                >
                                  {line.status}
                                </span>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                );
              })
              )}
            </div>
          ) : (
            /* ── ACTIVE CREATE ISSUE MODE (60% / 40% side by side) ── */
            <div className="grid grid-cols-1 lg:grid-cols-[1fr_360px] gap-6 items-start animate-fade-in">
              {/* LEFT FORM PANEL (60%) */}
              <form onSubmit={handleSubmit} className="space-y-6">
                {/* Header Info Card */}
                <div className="bg-[var(--bg-card)] rounded-2xl border border-[var(--border-main)] p-5 space-y-4">
                  <div className="flex items-center justify-between pb-3 border-b border-[var(--border-main)]">
                    <h2 className="text-sm font-bold text-[var(--text-primary)] uppercase tracking-widest">Issue Slip Header</h2>
                    <span className="font-mono text-xs text-[var(--text-muted)] font-bold bg-[var(--bg-subtle)] px-2.5 py-1 rounded-md">
                      DC No: Auto-generated
                    </span>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-semibold text-[var(--text-muted)] uppercase tracking-wider mb-1">
                        Department Requesting *
                      </label>
                      <input
                        id="form-dept"
                        value={deptName}
                        onChange={(e) => setDeptName(e.target.value)}
                        placeholder="e.g. Machining / QC"
                        className="w-full text-sm border border-[var(--border-main)] rounded-lg px-3 py-2 outline-none focus:ring-2 focus:ring-[var(--primary-subtle)] bg-[var(--bg-subtle)] text-[var(--text-primary)] placeholder-[var(--text-muted)] font-medium"
                      />
                      {formErrors.deptName && <p className="text-[var(--color-danger-text)] text-xs mt-1 font-semibold">{formErrors.deptName}</p>}
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-[var(--text-muted)] uppercase tracking-wider mb-1">
                        Receiving Party / Employee *
                      </label>
                      <input
                        id="form-party"
                        value={partyName}
                        onChange={(e) => setPartyName(e.target.value)}
                        placeholder="Employee Name / Code"
                        className="w-full text-sm border border-[var(--border-main)] rounded-lg px-3 py-2 outline-none focus:ring-2 focus:ring-[var(--primary-subtle)] bg-[var(--bg-subtle)] text-[var(--text-primary)] placeholder-[var(--text-muted)] font-medium"
                      />
                      {formErrors.partyName && <p className="text-[var(--color-danger-text)] text-xs mt-1 font-semibold">{formErrors.partyName}</p>}
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-semibold text-[var(--text-muted)] uppercase tracking-wider mb-1">
                        Issue Date
                      </label>
                      <input
                        type="date"
                        value={issueDate}
                        readOnly
                        className="w-full text-sm border border-[var(--border-main)] rounded-lg px-3 py-2 bg-[var(--bg-hover)] outline-none font-mono text-[var(--text-muted)] cursor-not-allowed"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-[var(--text-muted)] uppercase tracking-wider mb-1">
                        Return Due Date *
                      </label>
                      <input
                        id="form-duedate"
                        type="date"
                        value={dueDate}
                        onChange={(e) => setDueDate(e.target.value)}
                        className="w-full text-sm border border-[var(--border-main)] rounded-lg px-3 py-2 outline-none focus:ring-2 focus:ring-[var(--primary-subtle)] bg-[var(--bg-subtle)] text-[var(--text-primary)] font-mono font-medium"
                      />
                      {formErrors.dueDate && <p className="text-[var(--color-danger-text)] text-xs mt-1 font-semibold">{formErrors.dueDate}</p>}
                    </div>
                  </div>
                </div>

                {/* Line Items Card */}
                <div className="bg-[var(--bg-card)] rounded-2xl border border-[var(--border-main)] p-5 space-y-4">
                  <div className="pb-3 border-b border-[var(--border-main)]">
                    <h2 className="text-sm font-bold text-[var(--text-primary)] uppercase tracking-widest">Tool Line Items</h2>
                  </div>

                  {/* Smart Tool Search Input */}
                  <div className="relative" ref={dropdownRef}>
                    <Search className="w-4 h-4 text-[var(--text-muted)] absolute left-3 top-1/2 -translate-y-1/2" />
                    <input
                      id="tool-select-search"
                      value={searchVal}
                      onChange={(e) => {
                        setSearchVal(e.target.value);
                        setShowSearchDropdown(true);
                      }}
                      onFocus={() => setShowSearchDropdown(true)}
                      placeholder="Type tool name or registry number to add line item…"
                      className="w-full text-sm border border-[var(--border-main)] rounded-lg pl-9 pr-3 py-2 outline-none focus:ring-2 focus:ring-[var(--primary-subtle)] bg-[var(--bg-subtle)] text-[var(--text-primary)] placeholder-[var(--text-muted)]"
                    />

                    {/* Popover results */}
                    {showSearchDropdown && searchVal.trim().length > 0 && (
                      <div className="absolute z-10 w-full bg-[var(--bg-surface)] border border-[var(--border-main)] shadow-lg rounded-xl mt-1 max-h-56 overflow-y-auto divide-y divide-[var(--border-main)]">
                        {searchResults.map((t) => (
                          <div
                            key={t.id}
                            onClick={() => handleSelectTool(t.toolOrGaugeNo, t.name, t.qtyIn)}
                            className="p-3 hover:bg-[var(--bg-hover)] cursor-pointer transition-colors flex items-center justify-between text-sm"
                          >
                            <div>
                              <p className="font-semibold text-[var(--text-primary)]">{t.name}</p>
                              <p className="text-xs font-mono text-[var(--text-muted)]">{t.toolOrGaugeNo} · {t.grouping}</p>
                            </div>
                            <span className="text-xs font-bold text-[var(--color-success-text)] font-mono bg-[var(--color-success-bg)] px-2 py-0.5 rounded-full border border-[var(--border-main)]">
                              {getAvailableStock(t.toolOrGaugeNo)} in-stock
                            </span>
                          </div>
                        ))}
                        {searchResults.length === 0 && (
                          <p className="p-4 text-center text-xs text-[var(--text-muted)]">
                            No available tools match your query.
                          </p>
                        )}
                      </div>
                    )}
                  </div>

                  {formErrors.lines && (
                    <div className="p-3 bg-[var(--color-danger-bg)] border border-[var(--border-main)] rounded-xl text-xs text-[var(--color-danger-text)] font-semibold flex items-center gap-2">
                      <ShieldAlert className="w-4 h-4 text-red-500" />
                      <span>{formErrors.lines}</span>
                    </div>
                  )}

                  {/* Line list table */}
                  <div className="overflow-auto border border-[var(--border-main)] rounded-xl">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b border-[var(--border-main)] bg-[var(--bg-subtle)]">
                          {["Tool No", "Name", "Requested Qty", "Available Qty", ""].map((col) => (
                            <th key={col} className="text-left text-[11px] font-bold text-[var(--text-muted)] uppercase tracking-wider py-2.5 px-4">
                              {col}
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-[var(--border-main)]">
                        {stagedLines.map((line, idx) => (
                          <tr key={idx}>
                            <td className="py-2.5 px-4 font-mono text-xs text-[var(--text-secondary)] font-semibold">{line.toolOrGaugeNo}</td>
                            <td className="py-2.5 px-4 font-medium text-[var(--text-primary)]">{line.toolName}</td>
                            <td className="py-2.5 px-4">
                              <input
                                type="number"
                                min={1}
                                max={line.qtyAvailable}
                                value={line.qtyIssued}
                                onChange={(e) => handleUpdateQty(idx, Number(e.target.value))}
                                className="w-20 text-center text-sm border border-[var(--border-main)] rounded-lg py-1 bg-[var(--bg-subtle)] text-[var(--text-primary)] outline-none focus:ring-2 focus:ring-[var(--primary-subtle)] font-mono font-semibold"
                              />
                            </td>
                            <td className="py-2.5 px-4 font-mono text-xs text-[var(--color-success-text)] font-bold">{line.qtyAvailable}</td>
                            <td className="py-2.5 px-4 text-right">
                              <button
                                type="button"
                                onClick={() => handleRemoveLine(idx)}
                                className="p-1 hover:bg-[var(--color-danger-bg)] rounded-lg text-[var(--text-muted)] hover:text-[var(--color-danger-text)] transition-colors"
                              >
                                <Trash className="w-4 h-4" />
                              </button>
                            </td>
                          </tr>
                        ))}
                        {stagedLines.length === 0 && (
                          <tr>
                            <td colSpan={5} className="py-8 text-center text-xs text-[var(--text-muted)] font-medium">
                              No staged tool lines yet. Search and select above to add.
                            </td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>

                {/* Form submit/reset buttons */}
                <div className="flex items-center justify-end gap-3 sticky bottom-0 bg-[var(--bg-app)] py-4 border-t border-[var(--border-main)]">
                  <button
                    type="button"
                    onClick={() => {
                      handleClearForm();
                      setShowCreate(false);
                    }}
                    className="px-5 py-2.5 text-sm font-semibold text-[var(--text-muted)] hover:text-[var(--text-primary)] rounded-xl hover:bg-[var(--bg-hover)] transition-all"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={handleClearForm}
                    className="px-5 py-2.5 text-sm font-semibold text-[var(--text-muted)] hover:text-[var(--text-primary)] rounded-xl hover:bg-[var(--bg-hover)] transition-all"
                  >
                    Clear Form
                  </button>
                  <Button
                    type="submit"
                    id="submit-issue-btn"
                    variant="primary"
                    size="lg"
                  >
                    <ArrowUpRight className="w-4 h-4" /> Submit Issue
                  </Button>
                </div>
              </form>

              {/* RIGHT STOCK QUICK-VIEW PANEL (40%) */}
              <div className="bg-[var(--bg-card)] rounded-2xl border border-[var(--border-main)] p-5 space-y-4 sticky top-6">
                <div>
                  <h2 className="text-sm font-bold text-[var(--text-primary)] uppercase tracking-widest">Current Stock View</h2>
                  <p className="text-xs text-[var(--text-muted)] mt-0.5">Live staging impact summary</p>
                </div>

                <div className="border-y border-[var(--border-main)] py-3 space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-[var(--text-muted)] font-medium">Tools Staged</span>
                    <span className="font-bold text-[var(--text-primary)]">{stagedLines.length}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-[var(--text-muted)] font-medium">Total Quantity</span>
                    <span className="font-bold text-[var(--text-primary)]">
                      {stagedLines.reduce((sum, l) => sum + l.qtyIssued, 0)}
                    </span>
                  </div>
                </div>

                <div className="space-y-3">
                  <p className="text-[11px] font-bold text-[var(--text-muted)] uppercase tracking-wider">Live Staged Impact</p>
                  <div className="space-y-2.5 max-h-64 overflow-y-auto">
                    {stagedLines.map((l, i) => (
                      <div key={i} className="flex items-center justify-between text-xs font-sans">
                        <div className="min-w-0 pr-3">
                          <p className="font-semibold text-[var(--text-primary)] truncate">{l.toolName}</p>
                          <p className="text-[10px] font-mono text-[var(--text-muted)]">{l.toolOrGaugeNo}</p>
                        </div>
                        <div className="text-right shrink-0">
                          <span className="font-bold font-mono text-[var(--text-primary)]">{l.qtyIssued}</span>
                          <span className="text-[var(--text-muted)]"> / </span>
                          <span className="font-mono text-[var(--text-muted)]">{getAvailableStock(l.toolOrGaugeNo)} avail</span>
                        </div>
                      </div>
                    ))}
                    {stagedLines.length === 0 && (
                      <p className="text-center text-xs text-[var(--text-muted)] py-4 font-medium">
                        No staged lines to summarize.
                      </p>
                    )}
                  </div>
                </div>
              </div>
            </div>
          )}
        </main>
      </div>
    </div>
  );
}
