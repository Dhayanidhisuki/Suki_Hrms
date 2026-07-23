"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { Plus, Trash, Search, ArrowUpRight, CheckCircle2, X, ShieldAlert } from "lucide-react";
import Sidebar from "@/app/dashboard/components/Sidebar";
import TopBar from "@/app/dashboard/components/TopBar";
import RoleGate from "@/app/dashboard/components/RoleGate";
import { TableSkeleton } from "@/app/dashboard/components/LoadingSkeleton";
import { apiGet, apiPost } from "@/lib/apiClient";

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
  OPEN: { bg: "bg-blue-50", text: "text-blue-700" },
  CLOSED: { bg: "bg-emerald-50", text: "text-emerald-700" },
  PARTIAL: { bg: "bg-amber-50", text: "text-amber-700" },
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

  // Click outside to close search dropdown
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setShowSearchDropdown(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Compute stock levels live taking staged lines into account
  const getAvailableStock = (toolNo: string) => {
    const matched = tools.find((t) => t.toolOrGaugeNo === toolNo);
    if (!matched) return 0;
    const stagedQty = stagedLines
      .filter((l) => l.toolOrGaugeNo === toolNo)
      .reduce((sum, l) => sum + l.qtyIssued, 0);
    return Math.max(0, matched.qtyIn - stagedQty);
  };

  const handleSelectTool = (toolNo: string, toolName: string, originalQtyIn: number) => {
    const currentAvailable = getAvailableStock(toolNo);
    if (currentAvailable <= 0) return;

    // Add to staged lines (or increment if already staged)
    const existingIdx = stagedLines.findIndex((l) => l.toolOrGaugeNo === toolNo);
    if (existingIdx > -1) {
      const list = [...stagedLines];
      if (list[existingIdx].qtyIssued < originalQtyIn) {
        list[existingIdx].qtyIssued += 1;
        setStagedLines(list);
      }
    } else {
      setStagedLines([
        ...stagedLines,
        {
          toolOrGaugeNo: toolNo,
          toolName,
          qtyIssued: 1,
          qtyAvailable: originalQtyIn,
        },
      ]);
    }
    setSearchVal("");
    setShowSearchDropdown(false);
  };

  const handleRemoveLine = (index: number) => {
    const list = [...stagedLines];
    list.splice(index, 1);
    setStagedLines(list);
  };

  const handleUpdateQty = (index: number, val: number) => {
    const list = [...stagedLines];
    const item = list[index];
    const clamped = Math.max(1, Math.min(val, item.qtyAvailable));
    list[index].qtyIssued = clamped;
    setStagedLines(list);
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

    if (!deptName.trim()) errors.deptName = "Department Name is required";
    if (!partyName.trim()) errors.partyName = "Party Name/Employee is required";
    if (!dueDate) {
      errors.dueDate = "Due Date is required";
    } else {
      const due = new Date(dueDate);
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      if (due < today) {
        errors.dueDate = "Due date must be today or in the future";
      }
    }

    if (stagedLines.length === 0) {
      errors.lines = "At least one tool line item is required";
    }

    if (Object.keys(errors).length > 0) {
      setFormErrors(errors);
      return;
    }

    const payload = {
      deptName,
      partyName,
      issueDate,
      dueDate,
      lines: stagedLines.map((l) => ({
        toolOrGaugeNo: l.toolOrGaugeNo,
        qtyIssued: l.qtyIssued,
      })),
    };

    setBannerMsg(null);
    const res = await apiPost<{ issue: ToolsIssueHeader }>("/api/issue", payload);
    if (res.error) {
      setBannerMsg({ type: "error", text: res.error.message });
      return;
    }

    setSuccessBanner(`Issue created successfully.`);
    setTimeout(() => setSuccessBanner(""), 4000);
    handleClearForm();
    setShowCreate(false);
    loadIssues();
    loadTools();
  };

  // Search options in popup list
  const searchResults = tools.filter((t) => {
    const matchesSearch =
      t.name.toLowerCase().includes(searchVal.toLowerCase()) ||
      t.toolOrGaugeNo.toLowerCase().includes(searchVal.toLowerCase());
    const hasInStock = t.qtyIn > 0;
    const isAvail = t.status === "Available" || t.status === "Issued";

    // Deduct staged lines to verify if truly still in stock
    const currentAvailable = getAvailableStock(t.toolOrGaugeNo);

    return matchesSearch && hasInStock && isAvail && currentAvailable > 0;
  });

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

          {/* ── Header ── */}
          <div className="flex items-center justify-between mb-6">
            <div>
              <h1 className="text-2xl font-bold text-slate-900 tracking-tight">
                Issue Tool
              </h1>
              <p className="text-sm text-slate-500 mt-0.5">
                Issue tools/gauges to department or employee (GAUGE_TOOLS_ISSUE)
              </p>
            </div>
            <RoleGate permission="canCreateIssue">
              {!showCreate && (
                <button
                  id="issue-create-btn"
                  onClick={() => setShowCreate(true)}
                  className="flex items-center gap-2 px-4 py-2.5 bg-blue-600 hover:bg-blue-700 active:bg-blue-800 text-white text-sm font-semibold rounded-xl shadow-sm hover:shadow-md transition-all duration-150 group"
                >
                  <Plus className="w-4 h-4 transition-transform group-hover:rotate-90 duration-200" />
                  New Issue (DC)
                </button>
              )}
            </RoleGate>
          </div>

          {!showCreate ? (
            /* ── VIEW PREVIOUS ISSUES LIST ── */
            <div className="flex flex-col gap-4 animate-fade-in">
              {loading ? (
                <TableSkeleton rows={3} />
              ) : issues.length === 0 ? (
                <div className="bg-white rounded-2xl border border-slate-200 p-8 text-center text-sm text-slate-400">
                  No issue records found. Create a new issue to get started.
                </div>
              ) : (
              issues.map((issue) => {
                const sc = statusConfig[issue.status] ?? statusConfig["OPEN"];
                return (
                  <div key={issue.id} className="bg-white rounded-2xl border border-slate-200 p-5">
                    <div className="flex items-center justify-between mb-3">
                      <div>
                        <p className="font-mono text-sm font-semibold text-slate-800">{issue.dcNo}</p>
                        <p className="text-xs text-slate-400 mt-0.5">
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
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="border-b border-slate-100">
                            {["Tool No", "Qty Issued", "Qty Returned", "Remaining", "Status"].map(
                              (col) => (
                                <th
                                  key={col}
                                  className="text-left text-[11px] font-semibold text-slate-400 uppercase tracking-wider pb-2.5 pr-4 last:pr-0"
                                >
                                  {col}
                                </th>
                              )
                            )}
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-50">
                          {issue.lines.map((line) => (
                            <tr key={line.id} className="hover:bg-slate-50/60 transition-colors">
                              <td className="py-3 pr-4 font-mono text-xs text-slate-500">
                                {line.toolOrGaugeNo}
                              </td>
                              <td className="py-3 pr-4 text-slate-600">{line.qtyIssued}</td>
                              <td className="py-3 pr-4 text-slate-600">{line.qtyReturned}</td>
                              <td className="py-3 pr-4 text-slate-600">{line.remainingQty}</td>
                              <td className="py-3">
                                <span
                                  className={`inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-semibold ${
                                    line.status === "Open"
                                      ? "bg-blue-50 text-blue-700"
                                      : "bg-emerald-50 text-emerald-700"
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
                <div className="bg-white rounded-2xl border border-slate-200 p-5 space-y-4">
                  <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                    <h2 className="text-sm font-bold text-slate-800 uppercase tracking-widest">Issue Slip Header</h2>
                    <span className="font-mono text-xs text-slate-400 font-bold bg-slate-100 px-2.5 py-1 rounded-md">
                      DC No: Auto-generated
                    </span>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">
                        Department Requesting *
                      </label>
                      <input
                        id="form-dept"
                        value={deptName}
                        onChange={(e) => setDeptName(e.target.value)}
                        placeholder="e.g. Machining / QC"
                        className="w-full text-sm border border-slate-200 rounded-lg px-3 py-2 outline-none focus:ring-2 focus:ring-blue-500/30 bg-slate-50 font-medium"
                      />
                      {formErrors.deptName && <p className="text-red-500 text-xs mt-1 font-semibold">{formErrors.deptName}</p>}
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">
                        Receiving Party / Employee *
                      </label>
                      <input
                        id="form-party"
                        value={partyName}
                        onChange={(e) => setPartyName(e.target.value)}
                        placeholder="Employee Name / Code"
                        className="w-full text-sm border border-slate-200 rounded-lg px-3 py-2 outline-none focus:ring-2 focus:ring-blue-500/30 bg-slate-50 font-medium"
                      />
                      {formErrors.partyName && <p className="text-red-500 text-xs mt-1 font-semibold">{formErrors.partyName}</p>}
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">
                        Issue Date
                      </label>
                      <input
                        type="date"
                        value={issueDate}
                        readOnly
                        className="w-full text-sm border border-slate-200 rounded-lg px-3 py-2 bg-slate-100 outline-none font-mono text-slate-500 cursor-not-allowed"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">
                        Return Due Date *
                      </label>
                      <input
                        id="form-duedate"
                        type="date"
                        value={dueDate}
                        onChange={(e) => setDueDate(e.target.value)}
                        className="w-full text-sm border border-slate-200 rounded-lg px-3 py-2 outline-none focus:ring-2 focus:ring-blue-500/30 bg-slate-50 font-mono font-medium"
                      />
                      {formErrors.dueDate && <p className="text-red-500 text-xs mt-1 font-semibold">{formErrors.dueDate}</p>}
                    </div>
                  </div>
                </div>

                {/* Line Items Card */}
                <div className="bg-white rounded-2xl border border-slate-200 p-5 space-y-4">
                  <div className="pb-3 border-b border-slate-100">
                    <h2 className="text-sm font-bold text-slate-800 uppercase tracking-widest">Tool Line Items</h2>
                  </div>

                  {/* Smart Tool Search Input */}
                  <div className="relative" ref={dropdownRef}>
                    <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                    <input
                      id="tool-select-search"
                      value={searchVal}
                      onChange={(e) => {
                        setSearchVal(e.target.value);
                        setShowSearchDropdown(true);
                      }}
                      onFocus={() => setShowSearchDropdown(true)}
                      placeholder="Type tool name or registry number to add line item…"
                      className="w-full text-sm border border-slate-200 rounded-lg pl-9 pr-3 py-2 outline-none focus:ring-2 focus:ring-blue-500/30 bg-slate-50"
                    />

                    {/* Popover results */}
                    {showSearchDropdown && searchVal.trim().length > 0 && (
                      <div className="absolute z-10 w-full bg-white border border-slate-200 shadow-lg rounded-xl mt-1 max-h-56 overflow-y-auto divide-y divide-slate-50">
                        {searchResults.map((t) => (
                          <div
                            key={t.id}
                            onClick={() => handleSelectTool(t.toolOrGaugeNo, t.name, t.qtyIn)}
                            className="p-3 hover:bg-blue-50/50 cursor-pointer transition-colors flex items-center justify-between text-sm"
                          >
                            <div>
                              <p className="font-semibold text-slate-800">{t.name}</p>
                              <p className="text-xs font-mono text-slate-400">{t.toolOrGaugeNo} · {t.grouping}</p>
                            </div>
                            <span className="text-xs font-bold text-emerald-600 font-mono bg-emerald-50 px-2 py-0.5 rounded-full">
                              {getAvailableStock(t.toolOrGaugeNo)} in-stock
                            </span>
                          </div>
                        ))}
                        {searchResults.length === 0 && (
                          <p className="p-4 text-center text-xs text-slate-400">
                            No available tools match your query.
                          </p>
                        )}
                      </div>
                    )}
                  </div>

                  {formErrors.lines && (
                    <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-xs text-red-800 font-semibold flex items-center gap-2">
                      <ShieldAlert className="w-4 h-4 text-red-500" />
                      <span>{formErrors.lines}</span>
                    </div>
                  )}

                  {/* Line list table */}
                  <div className="overflow-auto border border-slate-100 rounded-xl">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b border-slate-100 bg-slate-50/50">
                          {["Tool No", "Name", "Requested Qty", "Available Qty", ""].map((col) => (
                            <th key={col} className="text-left text-[11px] font-bold text-slate-400 uppercase tracking-wider py-2.5 px-4">
                              {col}
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-50">
                        {stagedLines.map((line, idx) => (
                          <tr key={idx}>
                            <td className="py-2.5 px-4 font-mono text-xs text-slate-500 font-semibold">{line.toolOrGaugeNo}</td>
                            <td className="py-2.5 px-4 font-medium text-slate-800">{line.toolName}</td>
                            <td className="py-2.5 px-4">
                              <input
                                type="number"
                                min={1}
                                max={line.qtyAvailable}
                                value={line.qtyIssued}
                                onChange={(e) => handleUpdateQty(idx, Number(e.target.value))}
                                className="w-20 text-center text-sm border border-slate-200 rounded-lg py-1 bg-slate-50 outline-none focus:ring-2 focus:ring-blue-500/30 font-mono font-semibold"
                              />
                            </td>
                            <td className="py-2.5 px-4 font-mono text-xs text-emerald-600 font-bold">{line.qtyAvailable}</td>
                            <td className="py-2.5 px-4 text-right">
                              <button
                                type="button"
                                onClick={() => handleRemoveLine(idx)}
                                className="p-1 hover:bg-red-50 rounded-lg text-slate-300 hover:text-red-500 transition-colors"
                              >
                                <Trash className="w-4 h-4" />
                              </button>
                            </td>
                          </tr>
                        ))}
                        {stagedLines.length === 0 && (
                          <tr>
                            <td colSpan={5} className="py-8 text-center text-xs text-slate-400 font-medium">
                              No staged tool lines yet. Search and select above to add.
                            </td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>

                {/* Form submit/reset buttons */}
                <div className="flex items-center justify-end gap-3 sticky bottom-0 bg-slate-50 py-4 border-t border-slate-100">
                  <button
                    type="button"
                    onClick={() => {
                      handleClearForm();
                      setShowCreate(false);
                    }}
                    className="px-5 py-2.5 text-sm font-semibold text-slate-500 hover:text-slate-800 rounded-xl hover:bg-slate-100 transition-all"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={handleClearForm}
                    className="px-5 py-2.5 text-sm font-semibold text-slate-500 hover:text-slate-800 rounded-xl hover:bg-slate-100 transition-all"
                  >
                    Clear Form
                  </button>
                  <button
                    type="submit"
                    id="submit-issue-btn"
                    className="flex items-center gap-2 px-6 py-2.5 bg-blue-600 hover:bg-blue-700 active:bg-blue-800 text-white text-sm font-semibold rounded-xl shadow-sm hover:shadow-md transition-all duration-150"
                  >
                    <ArrowUpRight className="w-4 h-4" /> Submit Issue
                  </button>
                </div>
              </form>

              {/* RIGHT STOCK QUICK-VIEW PANEL (40%) */}
              <div className="bg-white rounded-2xl border border-slate-200 p-5 space-y-4 sticky top-6">
                <div>
                  <h2 className="text-sm font-bold text-slate-800 uppercase tracking-widest">Current Stock View</h2>
                  <p className="text-xs text-slate-400 mt-0.5">Live staging impact summary</p>
                </div>

                <div className="border-y border-slate-100 py-3 space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-slate-500 font-medium">Tools Staged</span>
                    <span className="font-bold text-slate-800">{stagedLines.length}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500 font-medium">Total Quantity</span>
                    <span className="font-bold text-slate-800">
                      {stagedLines.reduce((sum, l) => sum + l.qtyIssued, 0)}
                    </span>
                  </div>
                </div>

                <div className="space-y-3">
                  <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Live Staged Impact</p>
                  <div className="space-y-2.5 max-h-64 overflow-y-auto">
                    {stagedLines.map((l, i) => (
                      <div key={i} className="flex items-center justify-between text-xs font-sans">
                        <div className="min-w-0 pr-3">
                          <p className="font-semibold text-slate-800 truncate">{l.toolName}</p>
                          <p className="text-[10px] font-mono text-slate-400">{l.toolOrGaugeNo}</p>
                        </div>
                        <div className="text-right shrink-0">
                          <span className="font-bold font-mono text-slate-800">{l.qtyIssued}</span>
                          <span className="text-slate-300"> / </span>
                          <span className="font-mono text-slate-400">{getAvailableStock(l.toolOrGaugeNo)} avail</span>
                        </div>
                      </div>
                    ))}
                    {stagedLines.length === 0 && (
                      <p className="text-center text-xs text-slate-300 py-4 font-medium">
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
