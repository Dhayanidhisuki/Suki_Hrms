"use client";

import { useState, useEffect, useCallback } from "react";
import { Plus, X, Trash, ShieldAlert, CheckCircle2 } from "lucide-react";
import Sidebar from "@/app/dashboard/components/Sidebar";
import TopBar from "@/app/dashboard/components/TopBar";
import RoleGate from "@/app/dashboard/components/RoleGate";
import { TableSkeleton } from "@/app/dashboard/components/LoadingSkeleton";
import { apiGet, apiPost } from "@/lib/apiClient";

interface POScheduleLine {
  id: number;
  scheduleNo: string;
  toolOrGaugeNo: string;
  expectedDate: string;
  expectedQty: number;
  receivedQty: number;
  status: string;
  tool?: { name: string } | null;
}

interface POScheduleHeader {
  id: number;
  scheduleNo: string;
  poRef: string;
  supCode: string;
  createdDate: string;
  overallStatus: string;
  creatUserIdCd: string;
  lines: POScheduleLine[];
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
  Pending: { bg: "bg-slate-100", text: "text-slate-500" },
  "Partially Received": { bg: "bg-amber-50", text: "text-amber-700" },
  Completed: { bg: "bg-emerald-50", text: "text-emerald-700" },
};

interface StagedScheduleLine {
  toolOrGaugeNo: string;
  expectedDate: string;
  expectedQty: number;
}

export default function POSchedulePage() {
  const [schedules, setSchedules] = useState<POScheduleHeader[]>([]);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [tools, setTools] = useState<Tool[]>([]);
  const [loading, setLoading] = useState(true);

  // Slide-over Form State
  const [isOpen, setIsOpen] = useState(false);
  const [poRef, setPoRef] = useState("");
  const [supCode, setSupCode] = useState("");

  const [stagedLines, setStagedLines] = useState<StagedScheduleLine[]>([]);

  // Validation
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [successBanner, setSuccessBanner] = useState("");
  const [bannerMsg, setBannerMsg] = useState<{ type: "success" | "error"; text: string } | null>(null);

  // Filter approved suppliers
  const approvedSuppliers = suppliers.filter((s) => s.isApproved && s.status === "Active");

  const loadSchedules = useCallback(async () => {
    setLoading(true);
    const res = await apiGet<{ items: POScheduleHeader[] }>("/api/po/schedule");
    if (res.data?.items) setSchedules(res.data.items);
    setLoading(false);
  }, []);

  const loadSuppliers = useCallback(async () => {
    const res = await apiGet<{ items: Supplier[] }>("/api/suppliers");
    if (res.data?.items) {
      setSuppliers(res.data.items);
      const active = res.data.items.filter((s) => s.isApproved && s.status === "Active");
      if (active.length > 0) setSupCode(active[0].supCode);
    }
  }, []);

  const loadTools = useCallback(async () => {
    const res = await apiGet<{ items: Tool[] }>("/api/tools");
    if (res.data?.items) setTools(res.data.items);
  }, []);

  useEffect(() => {
    loadSchedules();
    loadSuppliers();
    loadTools();
  }, [loadSchedules, loadSuppliers, loadTools]);

  useEffect(() => {
    if (isOpen && approvedSuppliers.length > 0) {
      setSupCode(approvedSuppliers[0].supCode);
    }
  }, [isOpen]);

  const handleAddLine = () => {
    const firstTool = tools[0]?.toolOrGaugeNo || "";
    setStagedLines([
      ...stagedLines,
      {
        toolOrGaugeNo: firstTool,
        expectedDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().split("T")[0],
        expectedQty: 5,
      },
    ]);
  };

  const handleRemoveLine = (idx: number) => {
    const list = [...stagedLines];
    list.splice(idx, 1);
    setStagedLines(list);
  };

  const handleLineChange = (idx: number, field: keyof StagedScheduleLine, value: any) => {
    const list = [...stagedLines];
    list[idx] = {
      ...list[idx],
      [field]: value,
    };
    setStagedLines(list);
  };

  const handleSaveSchedule = async (e: React.FormEvent) => {
    e.preventDefault();
    const tempErrors: Record<string, string> = {};

    if (!poRef.trim()) tempErrors.poRef = "PO Reference is required";
    if (stagedLines.length === 0) tempErrors.lines = "At least one delivery milestone line is required";

    stagedLines.forEach((line, i) => {
      if (line.expectedQty <= 0) tempErrors[`qty-${i}`] = "Quantity must be > 0";
      if (!line.expectedDate) tempErrors[`date-${i}`] = "Expected Date is required";
    });

    if (Object.keys(tempErrors).length > 0) {
      setErrors(tempErrors);
      return;
    }

    const payload = {
      poRef,
      supCode,
      lines: stagedLines.map((l) => ({
        toolOrGaugeNo: l.toolOrGaugeNo,
        expectedDate: l.expectedDate,
        expectedQty: l.expectedQty,
      })),
    };

    setBannerMsg(null);
    const res = await apiPost<{ schedule: POScheduleHeader }>("/api/po/schedule", payload);
    if (res.error) {
      setBannerMsg({ type: "error", text: res.error.message });
      return;
    }

    setSuccessBanner("Schedule created successfully.");
    setTimeout(() => setSuccessBanner(""), 4000);
    handleClearForm();
    setIsOpen(false);
    loadSchedules();
  };

  const handleClearForm = () => {
    setPoRef("");
    setStagedLines([]);
    setErrors({});
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
                PO Delivery Schedule
              </h1>
              <p className="text-sm text-slate-500 mt-0.5">
                Track expected delivery milestones against POs (TOOLS_PO_SCH_MASTER)
              </p>
            </div>
            <RoleGate permission="canRaisePO">
              <button
                id="po-schedule-add-btn"
                onClick={() => {
                  handleClearForm();
                  setIsOpen(true);
                }}
                className="flex items-center gap-2 px-4 py-2.5 bg-blue-600 hover:bg-blue-700 active:bg-blue-800 text-white text-sm font-semibold rounded-xl shadow-sm hover:shadow-md transition-all duration-150 group"
              >
                <Plus className="w-4 h-4 transition-transform group-hover:rotate-90 duration-200" />
                New Schedule
              </button>
            </RoleGate>
          </div>

          {/* ── List view (left 60%) + detail summary ── */}
          <div className="grid grid-cols-1 xl:grid-cols-3 gap-6 items-start">
            <div className="xl:col-span-2 space-y-4">
              {loading ? (
                <TableSkeleton rows={3} />
              ) : schedules.length === 0 ? (
                <div className="bg-white rounded-2xl border border-slate-200 p-8 text-center text-sm text-slate-400">
                  No delivery schedules found. Create a new schedule to get started.
                </div>
              ) : (
                schedules.map((sch) => {
                const sc = statusConfig[sch.overallStatus] ?? statusConfig["Pending"];
                return (
                  <div key={sch.id} className="bg-white rounded-2xl border border-slate-200 p-5">
                    <div className="flex items-center justify-between mb-3">
                      <div>
                        <p className="font-mono text-sm font-semibold text-slate-800">{sch.scheduleNo}</p>
                        <p className="text-xs text-slate-400 mt-0.5">
                          PO Ref: <span className="font-semibold text-slate-700 font-mono">{sch.poRef}</span> · {sch.supplier?.supName ?? sch.supCode} · Created {sch.createdDate ? sch.createdDate.split("T")[0] : "—"}
                        </p>
                      </div>
                      <span
                        className={`inline-flex items-center px-2.5 py-1 rounded-full text-[11px] font-semibold ${sc.bg} ${sc.text}`}
                      >
                        {sch.overallStatus}
                      </span>
                    </div>
                    <div className="overflow-auto">
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="border-b border-slate-100 bg-slate-50/20">
                            {["Tool No", "Name", "Expected Date", "Expected Qty", "Received", "Status"].map(
                              (col) => (
                                <th
                                  key={col}
                                  className="text-left text-[11px] font-bold text-slate-400 uppercase tracking-wider py-2 px-3 last:pr-0"
                                >
                                  {col}
                                </th>
                              )
                            )}
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-50">
                          {sch.lines.map((line) => {
                            const lineSc = statusConfig[line.status] ?? statusConfig["Pending"];
                            return (
                              <tr key={line.id} className="hover:bg-slate-50/60 transition-colors">
                                <td className="py-2.5 px-3 font-mono text-xs text-slate-500 font-semibold">
                                  {line.toolOrGaugeNo}
                                </td>
                                <td className="py-2.5 px-3 font-medium text-slate-800">{line.tool?.name ?? line.toolOrGaugeNo}</td>
                                <td className="py-2.5 px-3 font-mono text-xs text-slate-600">
                                  {line.expectedDate ? line.expectedDate.split("T")[0] : "—"}
                                </td>
                                <td className="py-2.5 px-3 font-mono text-xs font-bold text-slate-800">{line.expectedQty}</td>
                                <td className="py-2.5 px-3 font-mono text-xs font-bold text-emerald-600">{line.receivedQty}</td>
                                <td className="py-2.5 px-3">
                                  <span
                                    className={`inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-semibold ${lineSc.bg} ${lineSc.text}`}
                                  >
                                    {line.status}
                                  </span>
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  </div>
                );
              })
              )}
            </div>

            {/* Quick Helper Panel */}
            <div className="bg-white rounded-2xl border border-slate-200 p-5 space-y-4">
              <h2 className="text-sm font-bold text-slate-800 uppercase tracking-widest">Schedule Tracker Guide</h2>
              <p className="text-xs text-slate-400 leading-relaxed">
                PO delivery schedules help track physical supply arrivals from tools suppliers. When a <strong>Goods Receipt Note (GRN)</strong> is posted in the sourcing ledger, matching schedule line milestones are updated automatically in real-time.
              </p>
              <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl text-xs text-amber-800 flex gap-2 items-start">
                <ShieldAlert className="w-4 h-4 text-amber-500 shrink-0 mt-0.5" />
                <span>
                  Only suppliers marked as <strong>Approved Suppliers</strong> in the Suppliers Master can be linked to active purchase delivery schedules.
                </span>
              </div>
            </div>
          </div>
        </main>
      </div>

      {/* ── Slide-over Form Panel ── */}
      {isOpen && (
        <div className="fixed inset-0 z-50 overflow-hidden">
          <div className="absolute inset-0 bg-slate-900/40 backdrop-blur-xs transition-opacity" onClick={() => setIsOpen(false)} />
          <div className="absolute inset-y-0 right-0 max-w-full flex pl-10">
            <div className="w-screen max-w-md bg-white shadow-xl flex flex-col h-full border-l border-slate-200">
              <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between">
                <h2 className="text-base font-bold text-slate-800">
                  New PO Delivery Schedule
                </h2>
                <button onClick={() => setIsOpen(false)} className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-400 hover:text-slate-700 transition-colors">
                  <X className="w-5 h-5" />
                </button>
              </div>

              <form onSubmit={handleSaveSchedule} className="flex-1 overflow-y-auto p-5 space-y-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">
                    PO Reference Number *
                  </label>
                  <input
                    id="form-po"
                    value={poRef}
                    onChange={(e) => setPoRef(e.target.value.toUpperCase())}
                    placeholder="e.g. PO-MEQ-2026-001"
                    className="w-full text-sm border border-slate-200 rounded-lg px-3 py-2 outline-none focus:ring-2 focus:ring-blue-500/30 bg-slate-50 font-mono font-semibold"
                  />
                  {errors.poRef && <p className="text-red-500 text-xs mt-1 font-semibold">{errors.poRef}</p>}
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">
                    Sourcing Supplier *
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

                {/* Milestones lines */}
                <div className="space-y-3 pt-2">
                  <div className="flex items-center justify-between">
                    <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">Milestone Lines</p>
                    <button
                      type="button"
                      onClick={handleAddLine}
                      className="text-xs font-bold text-blue-600 hover:text-blue-700 flex items-center gap-1 hover:underline"
                    >
                      <Plus className="w-3.5 h-3.5" /> Add Milestone
                    </button>
                  </div>

                  {errors.lines && (
                    <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-xs text-red-800 font-semibold">
                      {errors.lines}
                    </div>
                  )}

                  <div className="space-y-3">
                    {stagedLines.map((line, idx) => (
                      <div key={idx} className="p-3 border border-slate-100 bg-slate-50/50 rounded-xl space-y-2.5 relative">
                        <button
                          type="button"
                          onClick={() => handleRemoveLine(idx)}
                          className="absolute right-2 top-2 p-1 text-slate-300 hover:text-red-500 hover:bg-white rounded-lg transition-all"
                        >
                          <Trash className="w-3.5 h-3.5" />
                        </button>

                        <div>
                          <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-0.5">Select Tool</label>
                          <select
                            value={line.toolOrGaugeNo}
                            onChange={(e) => handleLineChange(idx, "toolOrGaugeNo", e.target.value)}
                            className="w-full text-xs border border-slate-200 rounded-lg px-2 py-1.5 bg-white outline-none"
                          >
                            {tools.map((t) => (
                              <option key={t.id} value={t.toolOrGaugeNo}>
                                {t.toolOrGaugeNo} · {t.name}
                              </option>
                            ))}
                          </select>
                        </div>

                        <div className="grid grid-cols-2 gap-2">
                          <div>
                            <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-0.5">Expected Qty</label>
                            <input
                              type="number"
                              min={1}
                              value={line.expectedQty}
                              onChange={(e) => handleLineChange(idx, "expectedQty", Number(e.target.value))}
                              className="w-full text-xs border border-slate-200 rounded-lg px-2 py-1.5 bg-white font-mono font-bold text-slate-700"
                            />
                            {errors[`qty-${idx}`] && <p className="text-red-500 text-[9px] mt-0.5 font-semibold">{errors[`qty-${idx}`]}</p>}
                          </div>
                          <div>
                            <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-0.5">Expected Date</label>
                            <input
                              type="date"
                              value={line.expectedDate}
                              onChange={(e) => handleLineChange(idx, "expectedDate", e.target.value)}
                              className="w-full text-xs border border-slate-200 rounded-lg px-2 py-1.5 bg-white font-mono text-slate-600"
                            />
                            {errors[`date-${idx}`] && <p className="text-red-500 text-[9px] mt-0.5 font-semibold">{errors[`date-${idx}`]}</p>}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="border-t border-slate-100 pt-4 flex items-center justify-end gap-3 sticky bottom-0 bg-white">
                  <button type="button" onClick={() => setIsOpen(false)} className="px-4 py-2 text-sm font-semibold text-slate-500 hover:text-slate-800 hover:bg-slate-50 rounded-xl transition-all">
                    Cancel
                  </button>
                  <button type="submit" id="schedule-submit-btn" className="px-5 py-2 text-sm font-semibold text-white bg-blue-600 hover:bg-blue-700 active:bg-blue-800 rounded-xl shadow-sm transition-all">
                    Save Schedule
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
