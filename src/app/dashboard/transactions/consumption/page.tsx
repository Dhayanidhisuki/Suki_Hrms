"use client";

import { useState, useEffect, useCallback } from "react";
import { CheckCircle2, Check, Search, ShieldAlert, ArrowUpRight } from "lucide-react";
import Sidebar from "@/app/dashboard/components/Sidebar";
import TopBar from "@/app/dashboard/components/TopBar";
import RoleGate from "@/app/dashboard/components/RoleGate";
import { TableSkeleton } from "@/app/dashboard/components/LoadingSkeleton";
import { apiGet, apiPost } from "@/lib/apiClient";

interface ToolConsumption {
  id: number;
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
  const [successBanner, setSuccessBanner] = useState("");
  const [bannerMsg, setBannerMsg] = useState<{ type: "success" | "error"; text: string } | null>(null);

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
  const selectableLines = selectedIssueObj ? selectedIssueObj.lines.filter((l) => l.status === "Open") : [];

  // Get currently selected line details
  const selectedLineObj = selectableLines.find((l) => l.toolOrGaugeNo === toolOrGaugeNo);
  const maxAvailable = selectedLineObj ? selectedLineObj.remainingQty : 1;

  const handleDcChange = (val: string) => {
    setDcNo(val);
    const issue = issues.find((x) => x.dcNo === val);
    const firstLine = issue?.lines.find((l) => l.status === "Open");
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

    setBannerMsg(null);
    const res = await apiPost<{ record: ToolConsumption }>("/api/consumption", payload);
    if (res.error) {
      setBannerMsg({ type: "error", text: res.error.message });
      return;
    }

    setSuccessBanner("Consumption logged successfully.");
    setTimeout(() => setSuccessBanner(""), 3000);

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
          <div className="mb-6">
            <h1 className="text-2xl font-bold text-slate-900 tracking-tight">
              Tools Consumption
            </h1>
            <p className="text-sm text-slate-500 mt-0.5">
              Log consumed/used quantities against worksheets (TOOLS_CONSUMPTION_TRANS_ISSUE)
            </p>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-[380px_1fr] gap-6 items-start">
            {/* LEFT FORM PANEL */}
            <RoleGate
              permission="canLogConsumption"
              fallback={
                <div className="bg-white rounded-2xl border border-slate-200 p-5 text-center py-10">
                  <ShieldAlert className="w-10 h-10 text-slate-300 mx-auto mb-3" />
                  <p className="text-sm font-semibold text-slate-800">Access Denied</p>
                  <p className="text-xs text-slate-400 mt-1">Your role does not have permissions to log consumption.</p>
                </div>
              }
            >
              <form onSubmit={handleSubmit} className="bg-white rounded-2xl border border-slate-200 p-5 space-y-4">
                <div className="pb-3 border-b border-slate-100">
                  <h2 className="text-sm font-bold text-slate-800 uppercase tracking-widest">Log Consumption</h2>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">
                    Select Issue DC *
                  </label>
                  <select
                    id="form-dc"
                    value={dcNo}
                    onChange={(e) => handleDcChange(e.target.value)}
                    className="w-full text-sm border border-slate-200 rounded-lg px-3 py-2 bg-slate-50 outline-none focus:ring-2 focus:ring-blue-500/30 font-medium text-slate-700"
                  >
                    <option value="">-- Choose DC --</option>
                    {openIssues.map((issue) => (
                      <option key={issue.id} value={issue.dcNo}>
                        {issue.dcNo} · {issue.partyName}
                      </option>
                    ))}
                  </select>
                  {errors.dcNo && <p className="text-red-500 text-xs mt-1 font-semibold">{errors.dcNo}</p>}
                </div>

                {dcNo && (
                  <div>
                    <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">
                      Select Issued Tool *
                    </label>
                    <select
                      id="form-tool"
                      value={toolOrGaugeNo}
                      onChange={(e) => handleToolChange(e.target.value)}
                      className="w-full text-sm border border-slate-200 rounded-lg px-3 py-2 bg-slate-50 outline-none focus:ring-2 focus:ring-blue-500/30 font-medium text-slate-700"
                    >
                      <option value="">-- Choose Tool --</option>
                      {selectableLines.map((l) => (
                        <option key={l.id} value={l.toolOrGaugeNo}>
                          {l.toolOrGaugeNo} ({l.remainingQty} left)
                        </option>
                      ))}
                    </select>
                    {errors.toolOrGaugeNo && <p className="text-red-500 text-xs mt-1 font-semibold">{errors.toolOrGaugeNo}</p>}
                  </div>
                )}

                <div>
                  <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">
                    Worksheet Reference *
                  </label>
                  <input
                    id="form-worksheet"
                    value={worksheetRef}
                    onChange={(e) => setWorksheetRef(e.target.value)}
                    placeholder="e.g. WS-2026-101"
                    className="w-full text-sm border border-slate-200 rounded-lg px-3 py-2 outline-none focus:ring-2 focus:ring-blue-500/30 bg-slate-50 font-mono font-medium"
                  />
                  {errors.worksheetRef && <p className="text-red-500 text-xs mt-1 font-semibold">{errors.worksheetRef}</p>}
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">
                    Quantity Consumed *
                  </label>
                  <input
                    id="form-qty"
                    type="number"
                    min={1}
                    max={maxAvailable}
                    value={qtyConsumed}
                    onChange={(e) => setQtyConsumed(Number(e.target.value))}
                    className="w-full text-sm border border-slate-200 rounded-lg px-3 py-2 outline-none focus:ring-2 focus:ring-blue-500/30 bg-slate-50 font-mono font-bold text-slate-700"
                  />
                  {dcNo && toolOrGaugeNo && (
                    <p className="text-[10px] text-slate-400 font-medium mt-1">
                      Max available from this issue slip: <span className="font-bold text-amber-600">{maxAvailable}</span>.
                    </p>
                  )}
                  {errors.qtyConsumed && <p className="text-red-500 text-xs mt-1 font-semibold">{errors.qtyConsumed}</p>}
                </div>

                <div className="border-t border-slate-100 pt-3 flex items-center justify-between">
                  <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Supervisor Verified</span>
                  <RoleGate
                    permission="canApproveSupplier"
                    fallback={
                      <span className="text-xs text-slate-300 font-medium italic">Requires Admin Role</span>
                    }
                  >
                    <input
                      type="checkbox"
                      id="form-verified"
                      checked={verifiedBySupervisor}
                      onChange={(e) => setVerifiedBySupervisor(e.target.checked)}
                      className="w-5 h-5 text-blue-600 border-slate-200 rounded focus:ring-blue-500"
                    />
                  </RoleGate>
                </div>

                <button
                  type="submit"
                  id="submit-consumption-btn"
                  className="flex items-center justify-center gap-2 w-full px-4 py-2.5 bg-blue-600 hover:bg-blue-700 active:bg-blue-800 text-white text-sm font-semibold rounded-xl shadow-sm hover:shadow-md transition-all duration-150"
                >
                  <ArrowUpRight className="w-4 h-4" /> Submit Consumption
                </button>
              </form>
            </RoleGate>

            {/* RIGHT RECENT LOG PANEL */}
            <div className="bg-white rounded-2xl border border-slate-200 p-5 flex flex-col min-w-0">
              <div className="flex items-center justify-between mb-4 gap-3 flex-wrap">
                <div>
                  <h2 className="text-sm font-bold text-slate-800 uppercase tracking-widest">Recent Consumption Logs</h2>
                  <p className="text-xs text-slate-400 mt-0.5">Historical transations log</p>
                </div>

                <div className="relative max-w-xs">
                  <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
                  <input
                    id="log-search"
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    placeholder="Filter worksheet/tool…"
                    className="text-xs border border-slate-200 rounded-lg pl-8 pr-2 py-1.5 outline-none focus:ring-2 focus:ring-blue-500/30 bg-slate-50"
                  />
                </div>
              </div>

              <div className="overflow-auto border border-slate-100 rounded-xl">
                {loading ? (
                  <TableSkeleton rows={4} />
                ) : (
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-slate-100 bg-slate-50/50">
                      {["Date", "Tool No & Name", "Worksheet", "Qty", "Verified", "DC Ref"].map((col) => (
                        <th key={col} className="text-left text-[11px] font-bold text-slate-400 uppercase tracking-wider py-2.5 px-4">
                          {col}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-50">
                    {filtered.map((c) => (
                      <tr key={c.id} className="hover:bg-slate-50/60 transition-colors">
                        <td className="py-3 px-4 font-mono text-xs text-slate-500">{c.consumptionDate ? c.consumptionDate.split("T")[0] : "—"}</td>
                        <td className="py-3 px-4">
                          <p className="font-semibold text-slate-800">{c.tool?.name ?? c.toolOrGaugeNo}</p>
                          <p className="text-[10px] font-mono text-slate-400">{c.toolOrGaugeNo}</p>
                        </td>
                        <td className="py-3 px-4 font-mono text-xs text-slate-700">{c.worksheetRef}</td>
                        <td className="py-3 px-4 font-mono text-xs font-bold text-slate-800">{c.qtyConsumed}</td>
                        <td className="py-3 px-4">
                          {c.verifiedBySupervisor ? (
                            <span className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-emerald-50 text-emerald-600">
                              <Check className="w-3.5 h-3.5" />
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-amber-50 text-amber-700">
                              Pending
                            </span>
                          )}
                        </td>
                        <td className="py-3 px-4 font-mono text-xs text-slate-500">{c.dcNo}</td>
                      </tr>
                    ))}
                    {filtered.length === 0 && (
                      <tr>
                        <td colSpan={6} className="py-8 text-center text-xs text-slate-400">
                          No logged consumption matching filter.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
                )}
              </div>
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}
