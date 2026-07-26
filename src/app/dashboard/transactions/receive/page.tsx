"use client";

import { useState, useEffect, useCallback } from "react";
import { Search, CheckCircle2, ArrowLeft, ArrowDownLeft, ShieldAlert } from "lucide-react";
import Sidebar from "@/app/dashboard/components/Sidebar";
import TopBar from "@/app/dashboard/components/TopBar";
import RoleGate from "@/app/dashboard/components/RoleGate";
import { TableSkeleton } from "@/app/dashboard/components/LoadingSkeleton";
import { apiGet, apiPost } from "@/lib/apiClient";
import { Button } from "@/components/ui/button";

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
        }
        if (qty > line.remainingQty) {
          tempErrors[String(line.id)] = `Cannot exceed remaining ${line.remainingQty}`;
        }
      }
    });

    if (totalReturning === 0) {
      tempErrors["general"] = "Please specify a return quantity for at least one line item";
    }

    if (Object.keys(tempErrors).length > 0) {
      setErrors(tempErrors);
      return;
    }

    const payload = {
      issueId: selectedIssue.id,
      receiveDate,
      remarks,
      lines: selectedIssue.lines
        .filter((l) => l.status === "Open" && (returnQtys[l.id] || 0) > 0)
        .map((l) => ({
          lineId: l.id,
          qtyReturnedNow: returnQtys[l.id],
        })),
    };

    setBannerMsg(null);
    const res = await apiPost<{ ok: boolean }>("/api/receive", payload);

    if (res.error) {
      setBannerMsg({ type: "error", text: res.error.message });
      return;
    }

    setSuccessMessage(`Tool return against DC #${selectedIssue.dcNo} logged successfully!`);
    setMode("search");
    setSelectedIssue(null);
    loadIssues();
    setTimeout(() => setSuccessMessage(""), 5000);
  };

  const isOverdue = (dueDateStr: string | null) => {
    if (!dueDateStr) return false;
    return new Date(dueDateStr) < new Date();
  };

  const filteredIssues = issues.filter((issue) => {
    const isPending = issue.status === "OPEN" || issue.status === "PARTIAL";
    const matchesSearch =
      issue.dcNo.toLowerCase().includes(searchQuery.toLowerCase()) ||
      issue.partyName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      issue.deptName.toLowerCase().includes(searchQuery.toLowerCase());

    return isPending && matchesSearch;
  });

  return (
    <div className="flex h-screen bg-[var(--bg-app)] text-[var(--text-primary)] overflow-hidden">
      <Sidebar />
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        <TopBar />
        <main className="flex-1 overflow-y-auto px-7 py-6">
          {successMessage && (
            <div className="mb-4 p-4 bg-[var(--color-success-bg)] border border-[var(--border-main)] rounded-2xl flex items-center gap-2.5 text-[var(--color-success-text)] text-sm font-semibold shadow-sm">
              <CheckCircle2 className="w-5 h-5 text-emerald-500" />
              <span>{successMessage}</span>
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

          {mode === "search" ? (
            /* ── SEARCH MODE ── */
            <>
              <div className="mb-6">
                <h1 className="text-2xl font-bold text-[var(--text-primary)] tracking-tight">
                  Receive Tool
                </h1>
                <p className="text-sm text-[var(--text-muted)] mt-0.5">
                  Record tool return from department or employee (GAUGE_TOOLS_ISSUE lines)
                </p>
              </div>

              <div className="bg-[var(--bg-card)] rounded-2xl border border-[var(--border-main)] p-5">
                {/* Search Bar */}
                <div className="relative max-w-sm mb-5">
                  <Search className="w-4 h-4 text-[var(--text-muted)] absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    id="receive-search-input"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Search by DC No or Employee name…"
                    className="w-full text-sm border border-[var(--border-main)] rounded-lg pl-9 pr-3 py-2 outline-none focus:ring-2 focus:ring-[var(--primary-subtle)] focus:border-[var(--primary)] transition-all bg-[var(--bg-subtle)] text-[var(--text-primary)] placeholder-[var(--text-muted)]"
                  />
                </div>

                <div className="overflow-auto">
                  {loading ? (
                    <TableSkeleton rows={4} />
                  ) : (
                  <table className="w-full text-sm border-collapse">
                    <thead>
                      <tr className="border-b border-[var(--border-main)] bg-[var(--bg-subtle)]">
                        {["DC No", "Department / Party Display", "Issue Date", "Due Date", "Status", "Open Lines", "Action"].map(
                          (col) => (
                            <th
                              key={col}
                              className="text-left text-[11px] font-semibold text-[var(--text-muted)] uppercase tracking-wider py-3 px-4"
                            >
                              {col}
                            </th>
                          )
                        )}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[var(--border-main)]">
                      {filteredIssues.map((issue) => {
                        const isOver = isOverdue(issue.dueDate);
                        const openCount = issue.lines.filter((l) => l.status === "Open").length;
                        const hasPartyName = issue.partyName && issue.partyName !== "-";
                        return (
                          <tr
                            key={issue.id}
                            className="hover:bg-[var(--bg-hover)] transition-colors"
                          >
                            <td className="py-3.5 px-4 align-middle font-mono text-xs text-[var(--text-secondary)] font-semibold">{issue.dcNo}</td>
                            <td className="py-3.5 px-4 align-middle">
                              <div className="flex flex-col justify-center min-h-[36px]">
                                <p className="font-semibold text-[var(--text-primary)] text-sm leading-snug">
                                  {hasPartyName ? issue.partyName : (issue.deptName || "—")}
                                </p>
                                {hasPartyName && issue.deptName && (
                                  <p className="text-[11px] text-[var(--text-muted)] font-medium leading-snug mt-0.5">{issue.deptName}</p>
                                )}
                              </div>
                            </td>
                            <td className="py-3.5 px-4 align-middle font-mono text-xs text-[var(--text-muted)]">
                              {issue.issueDate ? issue.issueDate.split("T")[0] : "—"}
                            </td>
                            <td className="py-3.5 px-4 align-middle">
                              <div className="flex flex-col justify-center min-h-[36px]">
                                <span
                                  className={`font-mono text-xs font-semibold ${
                                    isOver ? "text-[var(--color-danger-text)] font-bold" : "text-[var(--text-secondary)]"
                                  }`}
                                >
                                  {issue.dueDate ? issue.dueDate.split("T")[0] : "—"}
                                </span>
                                {isOver && (
                                  <span className="inline-flex items-center w-fit px-1.5 py-0.5 rounded text-[9px] font-bold bg-[var(--color-danger-bg)] text-[var(--color-danger-text)] border border-[var(--border-main)] uppercase tracking-wide mt-1">
                                    Overdue
                                  </span>
                                )}
                              </div>
                            </td>
                            <td className="py-3.5 px-4 align-middle">
                              <span
                                className={`inline-flex items-center px-2.5 py-1 rounded-full text-[11px] font-semibold ${
                                  issue.status === "OPEN"
                                    ? "bg-[var(--primary-light)] text-[var(--primary)] border border-[var(--border-main)]"
                                    : "bg-[var(--color-warning-bg)] text-[var(--color-warning-text)] border border-[var(--border-main)]"
                                }`}
                              >
                                {issue.status}
                              </span>
                            </td>
                            <td className="py-3.5 px-4 align-middle font-mono text-xs font-bold text-[var(--text-primary)]">{openCount}</td>
                            <td className="py-3.5 px-4 align-middle">
                              <RoleGate
                                permission="canReceiveTool"
                                fallback={<span className="text-xs text-[var(--text-muted)]">View only</span>}
                              >
                                <button
                                  id={`receive-btn-${issue.id}`}
                                  onClick={() => handleSelectIssue(issue)}
                                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-[var(--color-success-bg)] text-[var(--color-success-text)] hover:opacity-90 border border-[var(--border-main)] shadow-xs transition-colors cursor-pointer"
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
                          <td colSpan={7} className="py-8 text-center text-sm text-[var(--text-muted)]">
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
                className="inline-flex items-center gap-1 text-xs font-bold text-[var(--text-muted)] hover:text-[var(--text-primary)] uppercase tracking-widest mb-4 transition-colors"
              >
                <ArrowLeft className="w-4 h-4" /> Cancel and return to search
              </button>

              <form onSubmit={handleConfirmReceive} className="space-y-6">
                {/* Header Displays */}
                <div className="bg-[var(--bg-card)] rounded-2xl border border-[var(--border-main)] p-5 space-y-4">
                  <div className="flex items-center justify-between pb-3 border-b border-[var(--border-main)]">
                    <h2 className="text-sm font-bold text-[var(--text-primary)] uppercase tracking-widest">Receive Information</h2>
                    <span className="font-mono text-xs text-[var(--text-primary)] font-bold bg-[var(--bg-subtle)] px-2.5 py-1 rounded-md">
                      Slip: {selectedIssue?.dcNo}
                    </span>
                  </div>

                  <div className="grid grid-cols-2 gap-4 text-sm bg-[var(--bg-subtle)] p-4 rounded-xl">
                    <div>
                      <p className="text-xs text-[var(--text-muted)] font-medium uppercase tracking-wider">Party / Employee</p>
                      <p className="font-semibold text-[var(--text-primary)] mt-1">{selectedIssue?.partyName}</p>
                      <p className="text-xs text-[var(--text-muted)] mt-0.5">{selectedIssue?.deptName}</p>
                    </div>
                    <div>
                      <p className="text-xs text-[var(--text-muted)] font-medium uppercase tracking-wider">Dates Logged</p>
                      <p className="text-[var(--text-secondary)] mt-1">Issued: <span className="font-mono text-xs font-semibold">{selectedIssue?.issueDate ? selectedIssue.issueDate.split("T")[0] : "—"}</span></p>
                      <p className="text-[var(--text-secondary)] mt-0.5">Due Return: <span className="font-mono text-xs font-semibold">{selectedIssue?.dueDate ? selectedIssue.dueDate.split("T")[0] : "—"}</span></p>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4 pt-2">
                    <div>
                      <label className="block text-xs font-semibold text-[var(--text-muted)] uppercase tracking-wider mb-1">
                        Receive Date
                      </label>
                      <input
                        type="date"
                        value={receiveDate}
                        onChange={(e) => setReceiveDate(e.target.value)}
                        className="w-full text-sm border border-[var(--border-main)] rounded-lg px-3 py-2 outline-none focus:ring-2 focus:ring-[var(--primary-subtle)] bg-[var(--bg-subtle)] text-[var(--text-primary)] font-mono font-medium"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-[var(--text-muted)] uppercase tracking-wider mb-1">
                        Remarks / Observation notes
                      </label>
                      <input
                        id="form-remarks"
                        value={remarks}
                        onChange={(e) => setRemarks(e.target.value)}
                        placeholder="e.g. Scratches observed / standard return"
                        className="w-full text-sm border border-[var(--border-main)] rounded-lg px-3 py-2 outline-none focus:ring-2 focus:ring-[var(--primary-subtle)] bg-[var(--bg-subtle)] text-[var(--text-primary)] placeholder-[var(--text-muted)] font-medium"
                      />
                    </div>
                  </div>
                </div>

                {/* Line items returning list */}
                <div className="bg-[var(--bg-card)] rounded-2xl border border-[var(--border-main)] p-5 space-y-4">
                  <div className="pb-3 border-b border-[var(--border-main)]">
                    <h2 className="text-sm font-bold text-[var(--text-primary)] uppercase tracking-widest">Staged Line Receipts</h2>
                  </div>

                  {errors.general && (
                    <div className="p-3 bg-[var(--color-danger-bg)] border border-[var(--border-main)] rounded-xl text-xs text-[var(--color-danger-text)] font-semibold flex items-center gap-2">
                      <ShieldAlert className="w-4 h-4 text-red-500" />
                      <span>{errors.general}</span>
                    </div>
                  )}

                    <div className="overflow-auto border border-[var(--border-main)] rounded-xl">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b border-[var(--border-main)] bg-[var(--bg-subtle)]">
                          {["Tool No", "Qty Issued", "Already Returned", "Remaining Qty", "Qty Returning"].map((col) => (
                            <th key={col} className="text-left text-[11px] font-bold text-[var(--text-muted)] uppercase tracking-wider py-2.5 px-4">
                              {col}
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-[var(--border-main)]">
                        {selectedIssue?.lines
                          .filter((l) => l.status === "Open")
                          .map((line) => (
                            <tr key={line.id}>
                              <td className="py-2.5 px-4 font-mono text-xs text-[var(--text-secondary)] font-semibold">{line.toolOrGaugeNo}</td>
                              <td className="py-2.5 px-4 text-[var(--text-secondary)]">{line.qtyIssued}</td>
                              <td className="py-2.5 px-4 text-[var(--text-secondary)]">{line.qtyReturned}</td>
                              <td className="py-2.5 px-4 font-mono text-xs text-[var(--color-warning-text)] font-bold">{line.remainingQty}</td>
                              <td className="py-2.5 px-4">
                                <input
                                  type="number"
                                  min={0}
                                  max={line.remainingQty}
                                  value={returnQtys[line.id] ?? 0}
                                  onChange={(e) => handleQtyChange(line.id, line.remainingQty, Number(e.target.value))}
                                  className="w-24 text-center text-sm border border-[var(--border-main)] rounded-lg py-1 bg-[var(--bg-subtle)] text-[var(--text-primary)] outline-none focus:ring-2 focus:ring-[var(--primary-subtle)] font-mono font-semibold"
                                />
                                {errors[String(line.id)] && <p className="text-[var(--color-danger-text)] text-[10px] mt-1 font-semibold">{errors[String(line.id)]}</p>}
                              </td>
                            </tr>
                          ))}
                      </tbody>
                    </table>
                  </div>
                </div>

                {/* Footer Buttons */}
                <div className="flex items-center justify-end gap-3 sticky bottom-0 bg-[var(--bg-app)] py-4 border-t border-[var(--border-main)]">
                  <button
                    type="button"
                    onClick={() => setMode("search")}
                    className="px-5 py-2.5 text-sm font-semibold text-[var(--text-muted)] hover:text-[var(--text-primary)] rounded-xl hover:bg-[var(--bg-hover)] transition-all"
                  >
                    Cancel
                  </button>
                  <Button
                    type="submit"
                    id="receive-confirm-btn"
                    variant="primary"
                    size="lg"
                  >
                    <CheckCircle2 className="w-4 h-4" /> Confirm Receive
                  </Button>
                </div>
              </form>
            </div>
          )}
        </main>
      </div>
    </div>
  );
}
