"use client";

import { useState, useEffect, useCallback } from "react";
import { Search, CheckCircle2, ArrowLeft, ArrowDownLeft, ShieldAlert } from "lucide-react";
import Sidebar from "@/app/dashboard/components/Sidebar";
import TopBar from "@/app/dashboard/components/TopBar";
import RoleGate from "@/app/dashboard/components/RoleGate";
import { TableSkeleton } from "@/app/dashboard/components/LoadingSkeleton";
import { apiGet, apiPost } from "@/lib/apiClient";

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
  status: string;
  lines: ToolsIssueLine[];
}

export default function ReceiveToolPage() {
  const [issues, setIssues] = useState<ToolsIssueHeader[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");

  // Mode: "search" | "receive"
  const [mode, setMode] = useState<"search" | "receive">("search");
  const [selectedIssue, setSelectedIssue] = useState<ToolsIssueHeader | null>(null);

  // Form Fields
  const [receiveDate, setReceiveDate] = useState("");
  const [remarks, setRemarks] = useState("");
  // Mapping of Line ID to quantity currently returning
  const [returnQtys, setReturnQtys] = useState<Record<number, number>>({});

  const [errors, setErrors] = useState<Record<string, string>>({});
  const [successMessage, setSuccessMessage] = useState("");
  const [bannerMsg, setBannerMsg] = useState<{ type: "success" | "error"; text: string } | null>(null);

  const loadIssues = useCallback(async () => {
    setLoading(true);
    const res = await apiGet<{ items: ToolsIssueHeader[] }>("/api/receive");
    if (res.data?.items) setIssues(res.data.items);
    setLoading(false);
  }, []);

  useEffect(() => {
    loadIssues();
  }, [loadIssues]);

  const handleSelectIssue = (issue: ToolsIssueHeader) => {
    setSelectedIssue(issue);
    setReceiveDate(new Date().toISOString().split("T")[0]);
    setRemarks("");

    // Pre-fill return quantities with remaining quantities
    const qtys: Record<number, number> = {};
    issue.lines.forEach((l) => {
      if (l.status === "Open") {
        qtys[l.id] = l.remainingQty;
      }
    });
    setReturnQtys(qtys);
    setErrors({});
    setMode("receive");
  };

  const handleQtyChange = (lineId: number, maxVal: number, val: number) => {
    const clamped = Math.max(0, Math.min(val, maxVal));
    setReturnQtys({
      ...returnQtys,
      [lineId]: clamped,
    });
  };

  const handleConfirmReceive = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedIssue) return;

    // Validate quantities
    const tempErrors: Record<string, string> = {};
    let totalReturning = 0;

    selectedIssue.lines.forEach((line) => {
      if (line.status === "Open") {
        const qty = returnQtys[line.id] || 0;
        totalReturning += qty;
        if (qty < 0) {
          tempErrors[String(line.id)] = "Quantity cannot be negative";
        } else if (qty > line.remainingQty) {
          tempErrors[String(line.id)] = `Cannot exceed remaining qty (${line.remainingQty})`;
        }
      }
    });

    if (totalReturning === 0) {
      tempErrors.general = "Please record at least 1 tool returning";
    }

    if (Object.keys(tempErrors).length > 0) {
      setErrors(tempErrors);
      return;
    }

    const payload = {
      dcNo: selectedIssue.dcNo,
      receiveDate,
      remarks: remarks || undefined,
      lines: selectedIssue.lines
        .filter((l) => l.status === "Open" && (returnQtys[l.id] || 0) > 0)
        .map((l) => ({
          toolOrGaugeNo: l.toolOrGaugeNo,
          qtyReturned: returnQtys[l.id] || 0,
        })),
    };

    setBannerMsg(null);
    const res = await apiPost<{ header: { receiveNo: string } }>("/api/receive", payload);
    if (res.error) {
      setBannerMsg({ type: "error", text: res.error.message });
      return;
    }

    setSuccessMessage(`Receipt recorded successfully for ${selectedIssue.dcNo}.`);
    setTimeout(() => setSuccessMessage(""), 4000);
    setMode("search");
    setSelectedIssue(null);
    loadIssues();
  };

  const isOverdue = (dueDateStr: string) => {
    const today = new Date("2026-07-22");
    const due = new Date(dueDateStr);
    return due < today;
  };

  // Filter issues for selection
  const filteredIssues = issues.filter((issue) => {
    const isPending = issue.status === "OPEN" || issue.status === "PARTIAL";
    const matchesSearch =
      issue.dcNo.toLowerCase().includes(searchQuery.toLowerCase()) ||
      issue.partyName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      issue.deptName.toLowerCase().includes(searchQuery.toLowerCase());

    return isPending && matchesSearch;
  });

  return (
    <div className="flex h-screen bg-slate-50 overflow-hidden">
      <Sidebar />
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        <TopBar />
        <main className="flex-1 overflow-y-auto px-7 py-6">
          {successMessage && (
            <div className="mb-4 p-4 bg-emerald-50 border border-emerald-200 rounded-2xl flex items-center gap-2.5 text-emerald-800 text-sm font-semibold shadow-sm">
              <CheckCircle2 className="w-5 h-5 text-emerald-500" />
              <span>{successMessage}</span>
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

          {mode === "search" ? (
            /* ── SEARCH MODE ── */
            <>
              <div className="mb-6">
                <h1 className="text-2xl font-bold text-slate-900 tracking-tight">
                  Receive Tool
                </h1>
                <p className="text-sm text-slate-500 mt-0.5">
                  Record tool return from department or employee (GAUGE_TOOLS_ISSUE lines)
                </p>
              </div>

              <div className="bg-white rounded-2xl border border-slate-200 p-5">
                {/* Search Bar */}
                <div className="relative max-w-sm mb-5">
                  <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    id="receive-search-input"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Search by DC No or Employee name…"
                    className="w-full text-sm border border-slate-200 rounded-lg pl-9 pr-3 py-2 outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-400 transition-all bg-slate-50"
                  />
                </div>

                <div className="overflow-auto">
                  {loading ? (
                    <TableSkeleton rows={4} />
                  ) : (
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-slate-100">
                        {["DC No", "Department / Party Display", "Issue Date", "Due Date", "Status", "Open Lines", "Action"].map(
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
                      {filteredIssues.map((issue) => {
                        const isOver = isOverdue(issue.dueDate);
                        const openCount = issue.lines.filter((l) => l.status === "Open").length;
                        return (
                          <tr
                            key={issue.id}
                            className={`hover:bg-slate-50/60 transition-colors ${
                              isOver ? "border-l-4 border-red-500" : ""
                            }`}
                          >
                            <td className="py-3.5 pr-4 font-mono text-xs text-slate-500 font-semibold">{issue.dcNo}</td>
                            <td className="py-3.5 pr-4">
                              <p className="font-semibold text-slate-800">{issue.partyName}</p>
                              <p className="text-[11px] text-slate-400 font-medium">{issue.deptName}</p>
                            </td>
                            <td className="py-3.5 pr-4 font-mono text-xs text-slate-600">{issue.issueDate ? issue.issueDate.split("T")[0] : "—"}</td>
                            <td
                              className={`py-3.5 pr-4 font-mono text-xs font-semibold ${
                                isOver ? "text-red-600 font-bold" : "text-slate-600"
                              }`}
                            >
                              {issue.dueDate ? issue.dueDate.split("T")[0] : "—"}
                              {isOver && (
                                <span className="block text-[9px] text-red-500 font-sans tracking-wide uppercase mt-0.5">
                                  Overdue
                                </span>
                              )}
                            </td>
                            <td className="py-3.5 pr-4">
                              <span
                                className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-semibold ${
                                  issue.status === "OPEN" ? "bg-blue-50 text-blue-700" : "bg-amber-50 text-amber-700"
                                }`}
                              >
                                {issue.status}
                              </span>
                            </td>
                            <td className="py-3.5 pr-4 font-mono text-xs font-bold text-slate-700">{openCount}</td>
                            <td className="py-3.5">
                              <RoleGate
                                permission="canReceiveTool"
                                fallback={<span className="text-xs text-slate-400">View only</span>}
                              >
                                <button
                                  id={`receive-btn-${issue.id}`}
                                  onClick={() => handleSelectIssue(issue)}
                                  className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-semibold bg-emerald-50 text-emerald-700 hover:bg-emerald-100 transition-colors"
                                >
                                  <ArrowDownLeft className="w-3.5 h-3.5" />
                                  Receive
                                </button>
                              </RoleGate>
                            </td>
                          </tr>
                        );
                      })}
                      {filteredIssues.length === 0 && (
                        <tr>
                          <td colSpan={7} className="py-8 text-center text-sm text-slate-400">
                            No open or partially returned issue slips.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                  )}
                </div>
              </div>
            </>
          ) : (
            /* ── RECEIVE ACTIVE SLIP MODE ── */
            <div className="max-w-3xl animate-fade-in">
              {/* Back to search */}
              <button
                onClick={() => setMode("search")}
                className="inline-flex items-center gap-1 text-xs font-bold text-slate-400 hover:text-slate-700 uppercase tracking-widest mb-4 transition-colors"
              >
                <ArrowLeft className="w-4 h-4" /> Cancel and return to search
              </button>

              <form onSubmit={handleConfirmReceive} className="space-y-6">
                {/* Header Displays */}
                <div className="bg-white rounded-2xl border border-slate-200 p-5 space-y-4">
                  <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                    <h2 className="text-sm font-bold text-slate-800 uppercase tracking-widest">Receive Information</h2>
                    <span className="font-mono text-xs text-slate-600 font-bold bg-slate-100 px-2.5 py-1 rounded-md">
                      Slip: {selectedIssue?.dcNo}
                    </span>
                  </div>

                  <div className="grid grid-cols-2 gap-4 text-sm bg-slate-50 p-4 rounded-xl">
                    <div>
                      <p className="text-xs text-slate-400 font-medium uppercase tracking-wider">Party / Employee</p>
                      <p className="font-semibold text-slate-800 mt-1">{selectedIssue?.partyName}</p>
                      <p className="text-xs text-slate-400 mt-0.5">{selectedIssue?.deptName}</p>
                    </div>
                    <div>
                      <p className="text-xs text-slate-400 font-medium uppercase tracking-wider">Dates Logged</p>
                      <p className="text-slate-700 mt-1">Issued: <span className="font-mono text-xs font-semibold">{selectedIssue?.issueDate ? selectedIssue.issueDate.split("T")[0] : "—"}</span></p>
                      <p className="text-slate-700 mt-0.5">Due Return: <span className="font-mono text-xs font-semibold">{selectedIssue?.dueDate ? selectedIssue.dueDate.split("T")[0] : "—"}</span></p>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4 pt-2">
                    <div>
                      <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">
                        Receive Date
                      </label>
                      <input
                        type="date"
                        value={receiveDate}
                        onChange={(e) => setReceiveDate(e.target.value)}
                        className="w-full text-sm border border-slate-200 rounded-lg px-3 py-2 outline-none focus:ring-2 focus:ring-blue-500/30 bg-slate-50 font-mono font-medium"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">
                        Remarks / Observation notes
                      </label>
                      <input
                        id="form-remarks"
                        value={remarks}
                        onChange={(e) => setRemarks(e.target.value)}
                        placeholder="e.g. Scratches observed / standard return"
                        className="w-full text-sm border border-slate-200 rounded-lg px-3 py-2 outline-none focus:ring-2 focus:ring-blue-500/30 bg-slate-50 font-medium"
                      />
                    </div>
                  </div>
                </div>

                {/* Line items returning list */}
                <div className="bg-white rounded-2xl border border-slate-200 p-5 space-y-4">
                  <div className="pb-3 border-b border-slate-100">
                    <h2 className="text-sm font-bold text-slate-800 uppercase tracking-widest">Staged Line Receipts</h2>
                  </div>

                  {errors.general && (
                    <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-xs text-red-800 font-semibold flex items-center gap-2">
                      <ShieldAlert className="w-4 h-4 text-red-500" />
                      <span>{errors.general}</span>
                    </div>
                  )}

                    <div className="overflow-auto border border-slate-100 rounded-xl">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b border-slate-100 bg-slate-50/50">
                          {["Tool No", "Qty Issued", "Already Returned", "Remaining Qty", "Qty Returning"].map((col) => (
                            <th key={col} className="text-left text-[11px] font-bold text-slate-400 uppercase tracking-wider py-2.5 px-4">
                              {col}
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-50">
                        {selectedIssue?.lines
                          .filter((l) => l.status === "Open")
                          .map((line) => (
                            <tr key={line.id}>
                              <td className="py-2.5 px-4 font-mono text-xs text-slate-500 font-semibold">{line.toolOrGaugeNo}</td>
                              <td className="py-2.5 px-4 text-slate-600">{line.qtyIssued}</td>
                              <td className="py-2.5 px-4 text-slate-600">{line.qtyReturned}</td>
                              <td className="py-2.5 px-4 font-mono text-xs text-amber-600 font-bold">{line.remainingQty}</td>
                              <td className="py-2.5 px-4">
                                <input
                                  type="number"
                                  min={0}
                                  max={line.remainingQty}
                                  value={returnQtys[line.id] ?? 0}
                                  onChange={(e) => handleQtyChange(line.id, line.remainingQty, Number(e.target.value))}
                                  className="w-24 text-center text-sm border border-slate-200 rounded-lg py-1 bg-slate-50 outline-none focus:ring-2 focus:ring-blue-500/30 font-mono font-semibold"
                                />
                                {errors[String(line.id)] && <p className="text-red-500 text-[10px] mt-1 font-semibold">{errors[String(line.id)]}</p>}
                              </td>
                            </tr>
                          ))}
                      </tbody>
                    </table>
                  </div>
                </div>

                {/* Footer Buttons */}
                <div className="flex items-center justify-end gap-3 sticky bottom-0 bg-slate-50 py-4 border-t border-slate-100">
                  <button
                    type="button"
                    onClick={() => setMode("search")}
                    className="px-5 py-2.5 text-sm font-semibold text-slate-500 hover:text-slate-800 rounded-xl hover:bg-slate-100 transition-all"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    id="receive-confirm-btn"
                    className="flex items-center gap-2 px-6 py-2.5 bg-blue-600 hover:bg-blue-700 active:bg-blue-800 text-white text-sm font-semibold rounded-xl shadow-sm hover:shadow-md transition-all duration-150"
                  >
                    <CheckCircle2 className="w-4 h-4" /> Confirm Receive
                  </button>
                </div>
              </form>
            </div>
          )}
        </main>
      </div>
    </div>
  );
}
