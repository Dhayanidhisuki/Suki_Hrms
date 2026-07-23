"use client";

import { useState, useEffect, useCallback } from "react";
import { Plus, ChevronDown, ChevronUp, CheckCircle2, ShieldAlert, Trash } from "lucide-react";
import Sidebar from "@/app/dashboard/components/Sidebar";
import TopBar from "@/app/dashboard/components/TopBar";
import RoleGate from "@/app/dashboard/components/RoleGate";
import { TableSkeleton } from "@/app/dashboard/components/LoadingSkeleton";
import { apiGet, apiPost } from "@/lib/apiClient";

interface POReceiveLine {
  id: number;
  grnNo: string;
  toolOrGaugeNo: string;
  poQty: number;
  receivedQty: number;
  pendingQty: number;
  unitRate: number;
  tool?: { name: string } | null;
}

interface POReceiveHeader {
  id: number;
  grnNo: string;
  poRef: string;
  supCode: string;
  grnDate: string;
  status: string;
  creatUserIdCd: string;
  creatDt: string;
  lines: POReceiveLine[];
  supplier?: { supName: string } | null;
}

interface Supplier {
  id: number;
  supCode: string;
  supName: string;
  isApproved: boolean;
  status: string;
}

interface Tool {
  id: number;
  toolOrGaugeNo: string;
  name: string;
}

const statusConfig: Record<string, { bg: string; text: string }> = {
  Draft: { bg: "bg-slate-100", text: "text-slate-500" },
  Posted: { bg: "bg-emerald-50", text: "text-emerald-700" },
  Cancelled: { bg: "bg-red-50", text: "text-red-700" },
};

interface StagedGRNLine {
  toolOrGaugeNo: string;
  poQty: number;
  receivedQty: number;
  unitRate: number;
}

export default function POReceivePage() {
  const [grns, setGrns] = useState<POReceiveHeader[]>([]);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [tools, setTools] = useState<Tool[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedGrn, setExpandedGrn] = useState<number | null>(null);

  // Form State
  const [showForm, setShowForm] = useState(false);
  const [poRef, setPoRef] = useState("");
  const [supCode, setSupCode] = useState("");
  const [grnDate, setGrnDate] = useState("");

  const [stagedLines, setStagedLines] = useState<StagedGRNLine[]>([]);

  // Validation
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [successBanner, setSuccessBanner] = useState("");
  const [bannerMsg, setBannerMsg] = useState<{ type: "success" | "error"; text: string } | null>(null);

  // Filter approved suppliers
  const approvedSuppliers = suppliers.filter((s) => s.isApproved && s.status === "Active");

  const loadGrns = useCallback(async () => {
    setLoading(true);
    const res = await apiGet<{ items: POReceiveHeader[] }>("/api/po/grn");
    if (res.data?.items) setGrns(res.data.items);
    setLoading(false);
  }, []);

  const loadSuppliers = useCallback(async () => {
    const res = await apiGet<{ items: Supplier[] }>("/api/suppliers");
    if (res.data?.items) {
      const active = res.data.items.filter((s) => s.isApproved && s.status === "Active");
      setSuppliers(res.data.items);
      if (active.length > 0) setSupCode(active[0].supCode);
    }
  }, []);

  const loadTools = useCallback(async () => {
    const res = await apiGet<{ items: Tool[] }>("/api/tools");
    if (res.data?.items) setTools(res.data.items);
  }, []);

  useEffect(() => {
    loadGrns();
    loadSuppliers();
    loadTools();
  }, [loadGrns, loadSuppliers, loadTools]);

  useEffect(() => {
    setGrnDate(new Date().toISOString().split("T")[0]);
  }, [showForm]);

  const handleAddLine = () => {
    const firstTool = tools[0]?.toolOrGaugeNo || "";
    setStagedLines([
      ...stagedLines,
      {
        toolOrGaugeNo: firstTool,
        poQty: 10,
        receivedQty: 10,
        unitRate: 1500,
      },
    ]);
  };

  const handleRemoveLine = (idx: number) => {
    const list = [...stagedLines];
    list.splice(idx, 1);
    setStagedLines(list);
  };

  const handleLineChange = (idx: number, field: keyof StagedGRNLine, value: any) => {
    const list = [...stagedLines];
    list[idx] = {
      ...list[idx],
      [field]: value,
    };
    setStagedLines(list);
  };

  const handlePostGRN = async (e: React.FormEvent) => {
    e.preventDefault();
    const tempErrors: Record<string, string> = {};

    if (!poRef.trim()) tempErrors.poRef = "Purchase Order Reference (PO_REF) is required";
    if (stagedLines.length === 0) tempErrors.lines = "At least one item line is required";

    stagedLines.forEach((line, i) => {
      if (line.receivedQty <= 0) tempErrors[`qty-${i}`] = "Received Qty must be > 0";
      if (line.receivedQty > line.poQty) tempErrors[`qty-${i}`] = "Cannot exceed PO Qty";
      if (line.unitRate <= 0) tempErrors[`rate-${i}`] = "Unit Rate must be > 0";
    });

    if (Object.keys(tempErrors).length > 0) {
      setErrors(tempErrors);
      return;
    }

    const payload = {
      poRef,
      supCode,
      grnDate,
      lines: stagedLines.map((l) => ({
        toolOrGaugeNo: l.toolOrGaugeNo,
        poQty: l.poQty,
        receivedQty: l.receivedQty,
        unitRate: l.unitRate,
      })),
    };

    setBannerMsg(null);
    const res = await apiPost<{ grn: POReceiveHeader }>("/api/po/grn", payload);
    if (res.error) {
      setBannerMsg({ type: "error", text: res.error.message });
      return;
    }

    setSuccessBanner(`GRN posted successfully.`);
    setTimeout(() => setSuccessBanner(""), 4000);
    handleClearForm();
    setShowForm(false);
    loadGrns();
    loadTools();
  };

  const handleClearForm = () => {
    setPoRef("");
    setStagedLines([]);
    setErrors({});
  };

  const renderGrnList = () => {
    if (loading) return <TableSkeleton rows={3} />;
    if (grns.length === 0)
      return (
        <div className="text-center text-sm text-slate-400 py-8">
          No GRN records found. Create a new GRN to get started.
        </div>
      );
    return grns.map((grn) => {
      const sc = statusConfig[grn.status] ?? statusConfig["Draft"];
      const isExpanded = expandedGrn === grn.id;
      return (
        <div key={grn.id} className="border border-slate-100 rounded-xl p-4 space-y-3">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <div>
              <p className="font-mono text-sm font-bold text-slate-800">{grn.grnNo}</p>
              <p className="text-xs text-slate-400 mt-0.5">
                PO Ref: <span className="font-semibold text-slate-700 font-mono">{grn.poRef}</span> · {grn.supplier?.supName ?? grn.supCode} · Date: {grn.grnDate ? grn.grnDate.split("T")[0] : "—"}
              </p>
            </div>

            <div className="flex items-center gap-3">
              <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-semibold ${sc.bg} ${sc.text}`}>
                {grn.status}
              </span>
              <button
                onClick={() => setExpandedGrn(isExpanded ? null : grn.id)}
                className="p-1.5 hover:bg-slate-50 rounded-lg text-slate-400 hover:text-slate-600 transition-colors flex items-center gap-1 text-xs font-semibold"
              >
                {isExpanded ? "Hide details" : "View lines"}
                {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
              </button>
            </div>
          </div>

          {isExpanded && (
            <div className="overflow-auto border-t border-slate-50 pt-3 animate-fade-in">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-slate-400 font-bold text-[10px] uppercase bg-slate-50/50">
                    {["Tool No", "Name", "PO Qty", "Received", "Pending", "Unit Rate"].map((col) => (
                      <th key={col} className="text-left py-2 px-3">
                        {col}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                  {grn.lines.map((line) => (
                    <tr key={line.id} className="text-slate-600 text-xs">
                      <td className="py-2.5 px-3 font-mono font-semibold text-slate-500">{line.toolOrGaugeNo}</td>
                      <td className="py-2.5 px-3 font-semibold text-slate-800">{line.tool?.name ?? line.toolOrGaugeNo}</td>
                      <td className="py-2.5 px-3 font-mono">{line.poQty}</td>
                      <td className="py-2.5 px-3 font-mono font-bold text-emerald-600">{line.receivedQty}</td>
                      <td className={`py-2.5 px-3 font-mono font-bold ${line.pendingQty > 0 ? "text-amber-600" : "text-slate-400"}`}>
                        {line.pendingQty}
                      </td>
                      <td className="py-2.5 px-3 font-mono font-semibold">₹{Number(line.unitRate).toFixed(2)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      );
    });
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

          {/* ── Header ── */}
          <div className="flex items-center justify-between mb-6">
            <div>
              <h1 className="text-2xl font-bold text-slate-900 tracking-tight">
                PO Receive (GRN)
              </h1>
              <p className="text-sm text-slate-500 mt-0.5">
                Goods receipt against purchase orders (TOOLS_PO_RECEIVE)
              </p>
            </div>
            <RoleGate permission="canRaisePO">
              {!showForm && (
                <button
                  id="po-receive-add-btn"
                  onClick={() => setShowForm(true)}
                  className="flex items-center gap-2 px-4 py-2.5 bg-blue-600 hover:bg-blue-700 active:bg-blue-800 text-white text-sm font-semibold rounded-xl shadow-sm hover:shadow-md transition-all duration-150 group"
                >
                  <Plus className="w-4 h-4 transition-transform group-hover:rotate-90 duration-200" />
                  New GRN
                </button>
              )}
            </RoleGate>
          </div>

          {/* ── ACTIVE GRN FORM (TOP) ── */}
          {showForm && (
            <form onSubmit={handlePostGRN} className="bg-white rounded-2xl border border-slate-200 p-5 space-y-5 mb-6 animate-fade-in">
              <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                <h2 className="text-sm font-bold text-slate-800 uppercase tracking-widest">Active GRN Form</h2>
                <span className="font-mono text-xs text-slate-400 font-bold bg-slate-100 px-2.5 py-1 rounded-md">
                  GRN No: Auto-generated
                </span>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">
                    PO Reference Number *
                  </label>
                  <input
                    id="form-po-ref"
                    value={poRef}
                    onChange={(e) => setPoRef(e.target.value.toUpperCase())}
                    placeholder="e.g. PO-MEQ-2026-001"
                    className="w-full text-sm border border-slate-200 rounded-lg px-3 py-2 outline-none focus:ring-2 focus:ring-blue-500/30 bg-slate-50 font-mono font-semibold"
                  />
                  {errors.poRef && <p className="text-red-500 text-xs mt-1 font-semibold">{errors.poRef}</p>}
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">
                    Supplier *
                  </label>
                  <select
                    id="form-sup"
                    value={supCode}
                    onChange={(e) => setSupCode(e.target.value)}
                    className="w-full text-sm border border-slate-200 rounded-lg px-3 py-2 bg-slate-50 outline-none focus:ring-2 focus:ring-blue-500/30 font-semibold text-slate-700"
                  >
                    {approvedSuppliers.map((s) => (
                      <option key={s.id} value={s.supCode}>
                        {s.supCode} · {s.supName}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">
                    GRN Date
                  </label>
                  <input
                    type="date"
                    value={grnDate}
                    onChange={(e) => setGrnDate(e.target.value)}
                    className="w-full text-sm border border-slate-200 rounded-lg px-3 py-2 bg-slate-50 outline-none focus:ring-2 focus:ring-blue-500/30 font-mono font-medium text-slate-700"
                  />
                </div>
              </div>

              {/* Line items details */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">Receipt Line Items</p>
                  <button
                    type="button"
                    onClick={handleAddLine}
                    className="text-xs font-bold text-blue-600 hover:text-blue-700 flex items-center gap-1 hover:underline"
                  >
                    <Plus className="w-4 h-4" /> Add Item Line
                  </button>
                </div>

                {errors.lines && (
                  <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-xs text-red-800 font-semibold flex items-center gap-2">
                    <ShieldAlert className="w-4 h-4 text-red-500" />
                    <span>{errors.lines}</span>
                  </div>
                )}

                <div className="overflow-auto border border-slate-100 rounded-xl">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-slate-100 bg-slate-50/50">
                        {["Select Tool", "PO Qty", "Received Qty", "Unit Rate (₹)", ""].map((col) => (
                          <th key={col} className="text-left text-[11px] font-bold text-slate-400 uppercase tracking-wider py-2.5 px-4">
                            {col}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-50">
                      {stagedLines.map((line, idx) => (
                        <tr key={idx}>
                          <td className="py-2 px-3">
                            <select
                              value={line.toolOrGaugeNo}
                              onChange={(e) => handleLineChange(idx, "toolOrGaugeNo", e.target.value)}
                              className="w-full text-sm border border-slate-200 rounded-lg px-2 py-1.5 bg-slate-50 outline-none"
                            >
                              {tools.map((t) => (
                                <option key={t.id} value={t.toolOrGaugeNo}>
                                  {t.toolOrGaugeNo} · {t.name}
                                </option>
                              ))}
                            </select>
                          </td>
                          <td className="py-2 px-3">
                            <input
                              type="number"
                              min={1}
                              value={line.poQty}
                              onChange={(e) => handleLineChange(idx, "poQty", Number(e.target.value))}
                              className="w-24 text-center text-sm border border-slate-200 rounded-lg py-1.5 bg-slate-50 font-mono font-medium"
                            />
                          </td>
                          <td className="py-2 px-3">
                            <input
                              type="number"
                              min={1}
                              max={line.poQty}
                              value={line.receivedQty}
                              onChange={(e) => handleLineChange(idx, "receivedQty", Number(e.target.value))}
                              className="w-24 text-center text-sm border border-slate-200 rounded-lg py-1.5 bg-slate-50 font-mono font-bold text-slate-700"
                            />
                            {errors[`qty-${idx}`] && <p className="text-red-500 text-[10px] mt-1 font-semibold">{errors[`qty-${idx}`]}</p>}
                          </td>
                          <td className="py-2 px-3">
                            <input
                              type="number"
                              min={1}
                              value={line.unitRate}
                              onChange={(e) => handleLineChange(idx, "unitRate", Number(e.target.value))}
                              className="w-32 text-center text-sm border border-slate-200 rounded-lg py-1.5 bg-slate-50 font-mono font-medium"
                            />
                            {errors[`rate-${idx}`] && <p className="text-red-500 text-[10px] mt-1 font-semibold">{errors[`rate-${idx}`]}</p>}
                          </td>
                          <td className="py-2 px-3 text-right">
                            <button
                              type="button"
                              onClick={() => handleRemoveLine(idx)}
                              className="p-1.5 hover:bg-red-50 rounded-lg text-slate-300 hover:text-red-500 transition-colors"
                            >
                              <Trash className="w-4 h-4" />
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Form Buttons */}
              <div className="border-t border-slate-100 pt-4 flex items-center justify-end gap-3 bg-white">
                <button
                  type="button"
                  onClick={() => {
                    handleClearForm();
                    setShowForm(false);
                  }}
                  className="px-4 py-2 text-sm font-semibold text-slate-500 hover:text-slate-800 hover:bg-slate-50 rounded-xl transition-all"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  id="grn-submit-btn"
                  className="px-5 py-2 text-sm font-semibold text-white bg-blue-600 hover:bg-blue-700 active:bg-blue-800 rounded-xl shadow-sm transition-all"
                >
                  Post GRN (Posted)
                </button>
              </div>
            </form>
          )}

          {/* ── EXISTING GRNS LIST (BELOW) ── */}
          <div className="bg-white rounded-2xl border border-slate-200 p-5">
            <div className="pb-3 border-b border-slate-100 mb-4">
              <h2 className="text-sm font-bold text-slate-800 uppercase tracking-widest">Posted Goods Receipt Notes</h2>
            </div>

            <div className="flex flex-col gap-4">
              {renderGrnList()}
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}
