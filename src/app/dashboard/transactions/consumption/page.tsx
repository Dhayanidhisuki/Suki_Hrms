"use client";

import { useState, useEffect, useCallback } from "react";
import { Check, ShieldAlert, ArrowUpRight } from "lucide-react";
import Sidebar from "@/app/dashboard/components/Sidebar";
import TopBar from "@/app/dashboard/components/TopBar";
import RoleGate from "@/app/dashboard/components/RoleGate";
import { TableSkeleton } from "@/app/dashboard/components/LoadingSkeleton";
import { apiGet, apiPost } from "@/lib/apiClient";
import { Button } from "@/components/ui/button";
import { MasterSearchInput, MasterTableCard } from "@/components/ui/MasterTableCard";
import { toastSuccess, toastError } from "@/lib/appToast";

interface ToolConsumption {
  rowId: number;
  dcNo: string;
  toolOrGaugeNo: string;
  worksheetRef: string;
  qtyConsumed: number;
  consumptionDate: string;
  verifiedBySupervisor: boolean;
  verifiedBy: string | null;
  creatUserIdCd: string;
  tool?: { name: string } | null;
}

interface ToolsIssueLine {
  rowId: number;
  dcNo: string;
  toolOrGaugeNo: string;
  issueQty: number;
  partNo: string | null;
}

interface ToolsIssueHeader {
  dcNo: string;
  receiveName: string | null;
  subCode: string | null;
  empId: string | null;
  issueDate: string | null;
  dueDate: string | null;
  status: string;
  lines: ToolsIssueLine[];
}

export default function ConsumptionPage() {
  const [consumptionList, setConsumptionList] = useState<ToolConsumption[]>([]);
  const [issues, setIssues] = useState<ToolsIssueHeader[]>([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState("");

  // Form Fields
  const [dcNo, setDcNo] = useState("");
  const [toolOrGaugeNo, setToolOrGaugeNo] = useState("");
  const [worksheetRef, setWorksheetRef] = useState("");
  const [qtyConsumed, setQtyConsumed] = useState(1);
  const [verifiedBySupervisor, setVerifiedBySupervisor] = useState(false);

  // Error/Success
  const [errors, setErrors] = useState<Record<string, string>>({});

  const loadConsumption = useCallback(async () => {
    setLoading(true);
    const res = await apiGet<{ items: ToolConsumption[] }>("/api/consumption");
    if (res.data?.items) setConsumptionList(res.data.items);
    setLoading(false);
  }, []);

  const loadIssues = useCallback(async () => {
    const res = await apiGet<{ items: ToolsIssueHeader[] }>("/api/receive");
    if (res.data?.items) setIssues(res.data.items);
  }, []);

  useEffect(() => {
    loadConsumption();
    loadIssues();
  }, [loadConsumption, loadIssues]);

  // Get active issues for DC selection
  const openIssues = issues.filter((issue) => issue.status === "OPEN" || issue.status === "PARTIAL");

  // Get lines of selected DC
  const selectedIssueObj = issues.find((x) => x.dcNo === dcNo);
  const selectableLines = selectedIssueObj ? selectedIssueObj.lines : [];

  // Get currently selected line details
  const selectedLineObj = selectableLines.find((l) => l.toolOrGaugeNo === toolOrGaugeNo);
  const maxAvailable = selectedLineObj ? selectedLineObj.issueQty : 1;

  const handleDcChange = (val: string) => {
    setDcNo(val);
    const issue = issues.find((x) => x.dcNo === val);
    const firstLine = issue?.lines[0];
    setToolOrGaugeNo(firstLine ? firstLine.toolOrGaugeNo : "");
    setQtyConsumed(1);
  };

  const handleToolChange = (val: string) => {
    setToolOrGaugeNo(val);
    setQtyConsumed(1);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const tempErrors: Record<string, string> = {};

    if (!dcNo) tempErrors.dcNo = "Please select an Issue DC";
    if (!toolOrGaugeNo) tempErrors.toolOrGaugeNo = "Please select a Tool";
    if (!worksheetRef.trim()) tempErrors.worksheetRef = "Worksheet Reference is required";

    if (qtyConsumed <= 0) {
      tempErrors.qtyConsumed = "Quantity must be greater than 0";
    } else if (qtyConsumed > maxAvailable) {
      tempErrors.qtyConsumed = `Cannot exceed remaining qty (${maxAvailable})`;
    }

    if (Object.keys(tempErrors).length > 0) {
      setErrors(tempErrors);
      return;
    }

    const payload = {
      dcNo,
      toolOrGaugeNo,
      worksheetRef,
      qtyConsumed,
      consumptionDate: new Date().toISOString().split("T")[0],
      verifiedBySupervisor,
    };

    const res = await apiPost<{ record: ToolConsumption }>("/api/consumption", payload);
    if (res.error) {
      toastError(res.error.message);
      return;
    }

    toastSuccess({
      title: "Record saved",
      message: "Consumption logged successfully.",
      detail: toolOrGaugeNo || `DC #${dcNo}`,
    });

    setDcNo("");
    setToolOrGaugeNo("");
    setWorksheetRef("");
    setQtyConsumed(1);
    setVerifiedBySupervisor(false);
    setErrors({});
    loadConsumption();
  };

  const filtered = consumptionList.filter((c) => {
    const toolName = c.tool?.name ?? "";
    const matchesSearch =
      c.worksheetRef.toLowerCase().includes(query.toLowerCase()) ||
      c.toolOrGaugeNo.toLowerCase().includes(query.toLowerCase()) ||
      toolName.toLowerCase().includes(query.toLowerCase());
    return matchesSearch;
  });

  return (
    <div className="flex h-screen bg-[var(--bg-app)] text-[var(--text-primary)] overflow-hidden">
      <Sidebar />
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        <TopBar />
        <main className="flex-1 overflow-y-auto px-7 py-6">
          {/* ── Header ── */}
          <div className="mb-6">
            <h1 className="text-2xl font-bold text-[var(--text-primary)] tracking-tight">
              Tools Consumption
            </h1>
            <p className="text-sm text-[var(--text-muted)] mt-0.5">
              Log consumed/used quantities against worksheets (TOOLS_CONSUMPTION_TRANS_ISSUE)
            </p>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-[380px_1fr] gap-6 items-start">
            {/* LEFT FORM PANEL */}
            <RoleGate
              permission="canLogConsumption"
              fallback={
                <div className="bg-[var(--bg-card)] rounded-2xl border border-[var(--border-main)] p-5 text-center py-10">
                  <ShieldAlert className="w-10 h-10 text-[var(--text-muted)] mx-auto mb-3" />
                  <p className="text-sm font-semibold text-[var(--text-primary)]">Access Denied</p>
                  <p className="text-xs text-[var(--text-muted)] mt-1">Your role does not have permissions to log consumption.</p>
                </div>
              }
            >
              <form onSubmit={handleSubmit} className="bg-[var(--bg-card)] rounded-2xl border border-[var(--border-main)] p-5 space-y-4">
                <div className="pb-3 border-b border-[var(--border-main)]">
                  <h2 className="text-sm font-bold text-[var(--text-primary)] uppercase tracking-widest">Log Consumption</h2>
                </div>

                <div>
                  <label className="form-label">
                    Select Issue DC *
                  </label>
                  <select
                    id="form-dc"
                    value={dcNo}
                    onChange={(e) => handleDcChange(e.target.value)}
                    className="form-control outline-none focus:ring-2 focus:ring-[var(--primary-subtle)] font-medium"
                  >
                    <option value="">-- Choose DC --</option>
                    {openIssues.map((issue) => (
                      <option key={issue.dcNo} value={issue.dcNo}>
                        {issue.dcNo} · {issue.receiveName ?? "—"}
                      </option>
                    ))}
                  </select>
                  {errors.dcNo && <p className="text-[var(--color-danger-text)] text-xs mt-1 font-semibold">{errors.dcNo}</p>}
                </div>

                {dcNo && (
                  <div>
                    <label className="form-label">
                      Select Issued Tool *
                    </label>
                    <select
                      id="form-tool"
                      value={toolOrGaugeNo}
                      onChange={(e) => handleToolChange(e.target.value)}
                      className="form-control outline-none focus:ring-2 focus:ring-[var(--primary-subtle)] font-medium"
                    >
                      <option value="">-- Choose Tool --</option>
                      {selectableLines.map((l) => (
                        <option key={l.rowId} value={l.toolOrGaugeNo}>
                          {l.toolOrGaugeNo} ({l.issueQty} issued)
                        </option>
                      ))}
                    </select>
                    {errors.toolOrGaugeNo && <p className="text-[var(--color-danger-text)] text-xs mt-1 font-semibold">{errors.toolOrGaugeNo}</p>}
                  </div>
                )}

                <div>
                  <label className="form-label">
                    Worksheet Reference *
                  </label>
                  <input
                    id="form-worksheet"
                    value={worksheetRef}
                    onChange={(e) => setWorksheetRef(e.target.value)}
                    placeholder="e.g. WS-2026-101"
                    className="w-full text-sm border border-[var(--border-main)] rounded-lg px-3 py-2 outline-none focus:ring-2 focus:ring-[var(--primary-subtle)] bg-[var(--bg-subtle)] text-[var(--text-primary)] placeholder-[var(--text-muted)] font-mono font-medium"
                  />
                  {errors.worksheetRef && <p className="text-[var(--color-danger-text)] text-xs mt-1 font-semibold">{errors.worksheetRef}</p>}
                </div>

                <div>
                  <label className="form-label">
                    Quantity Consumed *
                  </label>
                  <input
                    id="form-qty"
                    type="number"
                    min={1}
                    max={maxAvailable}
                    value={qtyConsumed}
                    onChange={(e) => setQtyConsumed(Number(e.target.value))}
                    className="w-full text-sm border border-[var(--border-main)] rounded-lg px-3 py-2 outline-none focus:ring-2 focus:ring-[var(--primary-subtle)] bg-[var(--bg-subtle)] font-mono font-bold text-[var(--text-primary)]"
                  />
                  {dcNo && toolOrGaugeNo && (
                    <p className="text-[10px] text-[var(--text-muted)] font-medium mt-1">
                      Max available from this issue slip: <span className="font-bold text-[var(--color-warning-text)]">{maxAvailable}</span>.
                    </p>
                  )}
                  {errors.qtyConsumed && <p className="text-[var(--color-danger-text)] text-xs mt-1 font-semibold">{errors.qtyConsumed}</p>}
                </div>

                <div className="border-t border-[var(--border-main)] pt-3 flex items-center justify-between">
                  <span className="text-xs font-semibold text-[var(--text-muted)] uppercase tracking-wider">Supervisor Verified</span>
                  <RoleGate
                    permission="canApproveSupplier"
                    fallback={
                      <span className="text-xs text-[var(--text-muted)] font-medium italic">Requires Admin Role</span>
                    }
                  >
                    <input
                      type="checkbox"
                      id="form-verified"
                      checked={verifiedBySupervisor}
                      onChange={(e) => setVerifiedBySupervisor(e.target.checked)}
                      className="w-5 h-5 text-[var(--primary)] border-[var(--border-main)] rounded focus:ring-[var(--primary)]"
                    />
                  </RoleGate>
                </div>

                <Button
                  type="submit"
                  id="submit-consumption-btn"
                  variant="primary"
                  className="w-full"
                >
                  <ArrowUpRight className="w-4 h-4" /> Submit Consumption
                </Button>
              </form>
            </RoleGate>

            {/* RIGHT RECENT LOG PANEL */}
            <MasterTableCard
              toolbar={
                <>
                  <span className="text-[11px] font-semibold text-[var(--text-muted)] uppercase tracking-wider shrink-0">
                    Recent Consumption Logs
                  </span>
                  <MasterSearchInput
                    id="consumption-log-search"
                    value={query}
                    onChange={setQuery}
                    placeholder="Filter worksheet/tool…"
                    widthClass="w-44"
                  />
                </>
              }
            >
              {loading ? (
                <div className="p-4">
                  <TableSkeleton rows={4} />
                </div>
              ) : (
                <div className="overflow-auto">
                  <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-[var(--border-main)] bg-[var(--bg-subtle)]">
                      {["Date", "Tool No & Name", "Worksheet", "Qty", "Verified", "DC Ref"].map((col) => (
                        <th key={col} className="text-left text-[11px] font-bold text-[var(--text-muted)] uppercase tracking-wider py-2.5 px-4">
                          {col}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[var(--border-main)]">
                    {filtered.map((c) => (
                      <tr key={c.rowId} className="hover:bg-[var(--bg-hover)] transition-colors">
                        <td className="py-3 px-4 font-mono text-xs text-[var(--text-secondary)]">{c.consumptionDate ? c.consumptionDate.split("T")[0] : "—"}</td>
                        <td className="py-3 px-4">
                          <p className="font-semibold text-[var(--text-primary)]">{c.tool?.name ?? c.toolOrGaugeNo}</p>
                          <p className="text-[10px] font-mono text-[var(--text-muted)]">{c.toolOrGaugeNo}</p>
                        </td>
                        <td className="py-3 px-4 font-mono text-xs text-[var(--text-primary)]">{c.worksheetRef}</td>
                        <td className="py-3 px-4 font-mono text-xs font-bold text-[var(--text-primary)]">{c.qtyConsumed}</td>
                        <td className="py-3 px-4">
                          {c.verifiedBySupervisor ? (
                            <span className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-[var(--color-success-bg)] text-[var(--color-success-text)] border border-[var(--border-main)]">
                              <Check className="w-3.5 h-3.5" />
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-[var(--color-warning-bg)] text-[var(--color-warning-text)] border border-[var(--border-main)]">
                              Pending
                            </span>
                          )}
                        </td>
                        <td className="py-3 px-4 font-mono text-xs text-[var(--text-secondary)]">{c.dcNo}</td>
                      </tr>
                    ))}
                    {filtered.length === 0 && (
                      <tr>
                        <td colSpan={6} className="py-8 text-center text-xs text-[var(--text-muted)]">
                          No logged consumption matching filter.
                        </td>
                      </tr>
                    )}
                  </tbody>
                  </table>
                </div>
              )}
            </MasterTableCard>
          </div>
        </main>
      </div>
    </div>
  );
}
