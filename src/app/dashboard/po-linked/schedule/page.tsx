"use client";

import { useState, useEffect, useCallback } from "react";
import { Plus, Trash, ShieldAlert, X } from "lucide-react";
import Sidebar from "@/app/dashboard/components/Sidebar";
import TopBar from "@/app/dashboard/components/TopBar";
import RoleGate from "@/app/dashboard/components/RoleGate";
import { TableSkeleton } from "@/app/dashboard/components/LoadingSkeleton";
import { apiGet, apiPost } from "@/lib/apiClient";
import { Button } from "@/components/ui/button";

interface Supplier {
  id: number;
  supCode: string;
  supName: string;
  isApproved: boolean;
}

interface Tool {
  id: number;
  toolOrGaugeNo: string;
  name: string;
}

interface ScheduleLine {
  id: number;
  scheduleNo: string;
  toolOrGaugeNo: string;
  expectedDate: string;
  expectedQty: number;
  receivedQty: number;
  status: string;
  tool?: { name: string } | null;
}

interface PoScheduleHeader {
  id: number;
  scheduleNo: string;
  poRef: string;
  supCode: string;
  createdDate: string;
  overallStatus: string;
  supplier?: { supName: string } | null;
  lines: ScheduleLine[];
}

const statusConfig: Record<string, { bg: string; text: string }> = {
  Completed: { bg: "bg-[var(--color-success-bg)] border border-[var(--border-main)]", text: "text-[var(--color-success-text)]" },
  Partial: { bg: "bg-[var(--color-warning-bg)] border border-[var(--border-main)]", text: "text-[var(--color-warning-text)]" },
  Pending: { bg: "bg-[var(--primary-light)] border border-[var(--border-main)]", text: "text-[var(--primary)]" },
};

interface StagedScheduleLine {
  toolOrGaugeNo: string;
  expectedDate: string;
  expectedQty: number;
}

export default function PoSchedulePage() {
  const [schedules, setSchedules] = useState<PoScheduleHeader[]>([]);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [tools, setTools] = useState<Tool[]>([]);
  const [loading, setLoading] = useState(true);

  // Success Banner
  const [bannerMsg, setBannerMsg] = useState<{ type: "success" | "error"; text: string } | null>(null);

  // Slide-over Form State
  const [isOpen, setIsOpen] = useState(false);
  const [poRef, setPoRef] = useState("");
  const [supCode, setSupCode] = useState("");
  const [stagedLines, setStagedLines] = useState<StagedScheduleLine[]>([]);

  // Validation Errors
  const [errors, setErrors] = useState<Record<string, string>>({});

  const loadData = useCallback(async () => {
    setLoading(true);
    const [schRes, supRes, tRes] = await Promise.all([
      apiGet<{ items: PoScheduleHeader[] }>("/api/po-linked/schedule"),
      apiGet<{ items: Supplier[] }>("/api/suppliers"),
      apiGet<{ items: Tool[] }>("/api/tools"),
    ]);

    if (schRes.data?.items) setSchedules(schRes.data.items);
    if (supRes.data?.items) {
      setSuppliers(supRes.data.items);
      const firstApproved = supRes.data.items.find((s) => s.isApproved);
      if (firstApproved) setSupCode(firstApproved.supCode);
    }
    if (tRes.data?.items) {
      setTools(tRes.data.items);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const approvedSuppliers = suppliers.filter((s) => s.isApproved);

  const handleOpenAdd = () => {
    setPoRef("");
    if (approvedSuppliers.length > 0) {
      setSupCode(approvedSuppliers[0].supCode);
    }
    if (tools.length > 0) {
      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 7);
      setStagedLines([
        {
          toolOrGaugeNo: tools[0].toolOrGaugeNo,
          expectedQty: 5,
          expectedDate: tomorrow.toISOString().split("T")[0],
        },
      ]);
    }
    setErrors({});
    setIsOpen(true);
  };

  const handleAddLine = () => {
    if (tools.length === 0) return;
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 7);
    setStagedLines((prev) => [
      ...prev,
      {
        toolOrGaugeNo: tools[0].toolOrGaugeNo,
        expectedQty: 5,
        expectedDate: tomorrow.toISOString().split("T")[0],
      },
    ]);
  };

  const handleLineChange = (
    index: number,
    field: keyof StagedScheduleLine,
    value: string | number
  ) => {
    const updated = [...stagedLines];
    updated[index] = { ...updated[index], [field]: value };
    setStagedLines(updated);
  };

  const handleRemoveLine = (index: number) => {
    setStagedLines((prev) => prev.filter((_, i) => i !== index));
  };

  const handleSaveSchedule = async (e: React.FormEvent) => {
    e.preventDefault();
    const tempErrors: Record<string, string> = {};

    if (!poRef.trim()) tempErrors.poRef = "PO Reference number is required";
    if (!supCode) tempErrors.supCode = "Approved supplier selection is required";
    if (stagedLines.length === 0) tempErrors.lines = "At least one milestone schedule line must be added";

    stagedLines.forEach((line, idx) => {
      if (line.expectedQty <= 0) {
        tempErrors[`qty-${idx}`] = "Quantity must be > 0";
      }
      if (!line.expectedDate) {
        tempErrors[`date-${idx}`] = "Expected date is required";
      }
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
        expectedQty: l.expectedQty,
        expectedDate: l.expectedDate,
      })),
    };

    setBannerMsg(null);
    const res = await apiPost<{ item: PoScheduleHeader }>("/api/po-linked/schedule", payload);

    if (res.error) {
      setBannerMsg({ type: "error", text: res.error.message });
      return;
    }

    setBannerMsg({
      type: "success",
      text: `PO Delivery Schedule #${res.data?.item.scheduleNo} created successfully.`,
    });
    setIsOpen(false);
    loadData();
  };

  return (
    <div className="flex h-screen bg-[var(--bg-app)] text-[var(--text-primary)] overflow-hidden">
      <Sidebar />
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        <TopBar />
        <main className="flex-1 overflow-y-auto px-7 py-6">
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
                PO Schedule Tracker
              </h1>
              <p className="text-sm text-[var(--text-muted)] mt-0.5">
                Purchase Order expected delivery schedules (TOOLS_PO_DELV_SCHEDULE)
              </p>
            </div>
            <RoleGate permission="canRaisePO">
              <Button
                id="po-schedule-add-btn"
                onClick={handleOpenAdd}
                variant="primary"
                className="group"
              >
                <Plus className="w-4 h-4 transition-transform group-hover:rotate-90 duration-200" />
                New Schedule
              </Button>
            </RoleGate>
          </div>

          {/* ── List view (left 60%) + detail summary ── */}
          <div className="grid grid-cols-1 xl:grid-cols-3 gap-6 items-start">
            <div className="xl:col-span-2 space-y-4">
              {loading ? (
                <TableSkeleton rows={3} />
              ) : schedules.length === 0 ? (
                <div className="bg-[var(--bg-card)] rounded-2xl border border-[var(--border-main)] p-8 text-center text-sm text-[var(--text-muted)]">
                  No delivery schedules found. Create a new schedule to get started.
                </div>
              ) : (
                schedules.map((sch) => {
                const sc = statusConfig[sch.overallStatus] ?? statusConfig["Pending"];
                return (
                  <div key={sch.id} className="bg-[var(--bg-card)] rounded-2xl border border-[var(--border-main)] p-5">
                    <div className="flex items-center justify-between mb-3">
                      <div>
                        <p className="font-mono text-sm font-semibold text-[var(--text-primary)]">{sch.scheduleNo}</p>
                        <p className="text-xs text-[var(--text-muted)] mt-0.5">
                          PO Ref: <span className="font-semibold text-[var(--text-primary)] font-mono">{sch.poRef}</span> · {sch.supplier?.supName ?? sch.supCode} · Created {sch.createdDate ? sch.createdDate.split("T")[0] : "—"}
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
                          <tr className="border-b border-[var(--border-main)] bg-[var(--bg-subtle)]">
                            {["Tool No", "Name", "Expected Date", "Expected Qty", "Received", "Status"].map(
                              (col) => (
                                <th
                                  key={col}
                                  className="text-left text-[11px] font-bold text-[var(--text-muted)] uppercase tracking-wider py-2 px-3 last:pr-0"
                                >
                                  {col}
                                </th>
                              )
                            )}
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-[var(--border-main)]">
                          {sch.lines.map((line) => {
                            const lineSc = statusConfig[line.status] ?? statusConfig["Pending"];
                            return (
                              <tr key={line.id} className="hover:bg-[var(--bg-hover)] transition-colors">
                                <td className="py-2.5 px-3 font-mono text-xs text-[var(--text-secondary)] font-semibold">
                                  {line.toolOrGaugeNo}
                                </td>
                                <td className="py-2.5 px-3 font-medium text-[var(--text-primary)]">{line.tool?.name ?? line.toolOrGaugeNo}</td>
                                <td className="py-2.5 px-3 font-mono text-xs text-[var(--text-muted)]">
                                  {line.expectedDate ? line.expectedDate.split("T")[0] : "—"}
                                </td>
                                <td className="py-2.5 px-3 font-mono text-xs font-bold text-[var(--text-primary)]">{line.expectedQty}</td>
                                <td className="py-2.5 px-3 font-mono text-xs font-bold text-[var(--color-success-text)]">{line.receivedQty}</td>
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
            <div className="bg-[var(--bg-card)] rounded-2xl border border-[var(--border-main)] p-5 space-y-4">
              <h2 className="text-sm font-bold text-[var(--text-primary)] uppercase tracking-widest">Schedule Tracker Guide</h2>
              <p className="text-xs text-[var(--text-muted)] leading-relaxed">
                PO delivery schedules help track physical supply arrivals from tools suppliers. When a <strong>Goods Receipt Note (GRN)</strong> is posted in the sourcing ledger, matching schedule line milestones are updated automatically in real-time.
              </p>
              <div className="p-3 bg-[var(--color-warning-bg)] border border-[var(--border-main)] rounded-xl text-xs text-[var(--color-warning-text)] flex gap-2 items-start">
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
        <div className="fixed inset-0 z-50 overflow-hidden bg-black/40 backdrop-blur-xs flex justify-end animate-fade-in">
          <div className="w-full max-w-md bg-[var(--bg-card)] text-[var(--text-primary)] shadow-2xl flex flex-col h-full border-l border-[var(--border-main)] animate-slide-in-right">
            <div className="px-5 py-4 border-b border-[var(--border-main)] flex items-center justify-between">
              <h2 className="text-base font-bold text-[var(--text-primary)]">
                New PO Delivery Schedule
              </h2>
              <button onClick={() => setIsOpen(false)} className="p-1.5 rounded-lg hover:bg-[var(--bg-hover)] text-[var(--text-muted)] hover:text-[var(--text-primary)] transition-colors">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveSchedule} className="flex-1 overflow-y-auto p-5 space-y-4">
              <div>
                <label className="block text-xs font-semibold text-[var(--text-muted)] uppercase tracking-wider mb-1">
                  PO Reference Number *
                </label>
                <input
                  id="form-po"
                  value={poRef}
                  onChange={(e) => setPoRef(e.target.value.toUpperCase())}
                  placeholder="e.g. PO-MEQ-2026-001"
                  className="w-full text-sm border border-[var(--border-main)] rounded-lg px-3 py-2 outline-none focus:ring-2 focus:ring-[var(--primary-subtle)] bg-[var(--bg-subtle)] text-[var(--text-primary)] placeholder-[var(--text-muted)] font-mono font-semibold"
                />
                {errors.poRef && <p className="text-[var(--color-danger-text)] text-xs mt-1 font-semibold">{errors.poRef}</p>}
              </div>

              <div>
                <label className="block text-xs font-semibold text-[var(--text-muted)] uppercase tracking-wider mb-1">
                  Sourcing Supplier *
                </label>
                <select
                  id="form-sup"
                  value={supCode}
                  onChange={(e) => setSupCode(e.target.value)}
                  className="w-full text-sm border border-[var(--border-main)] rounded-lg px-3 py-2 bg-[var(--bg-subtle)] text-[var(--text-primary)] outline-none focus:ring-2 focus:ring-[var(--primary-subtle)] font-semibold"
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
                  <p className="text-xs font-bold text-[var(--text-muted)] uppercase tracking-wider">Milestone Lines</p>
                  <button
                    type="button"
                    onClick={handleAddLine}
                    className="text-xs font-bold text-[var(--primary)] flex items-center gap-1 hover:underline"
                  >
                    <Plus className="w-3.5 h-3.5" /> Add Milestone
                  </button>
                </div>

                {errors.lines && (
                  <div className="p-3 bg-[var(--color-danger-bg)] border border-[var(--border-main)] rounded-xl text-xs text-[var(--color-danger-text)] font-semibold">
                    {errors.lines}
                  </div>
                )}

                <div className="space-y-3">
                  {stagedLines.map((line, idx) => (
                    <div key={idx} className="p-3 border border-[var(--border-main)] bg-[var(--bg-subtle)] rounded-xl space-y-2.5 relative">
                      <button
                        type="button"
                        onClick={() => handleRemoveLine(idx)}
                        className="absolute right-2 top-2 p-1 text-[var(--text-muted)] hover:text-[var(--color-danger-text)] hover:bg-[var(--bg-hover)] rounded-lg transition-all"
                      >
                        <Trash className="w-3.5 h-3.5" />
                      </button>

                      <div>
                        <label className="block text-[10px] font-bold text-[var(--text-muted)] uppercase tracking-wider mb-0.5">Select Tool</label>
                        <select
                          value={line.toolOrGaugeNo}
                          onChange={(e) => handleLineChange(idx, "toolOrGaugeNo", e.target.value)}
                          className="w-full text-xs border border-[var(--border-main)] rounded-lg px-2 py-1.5 bg-[var(--bg-card)] text-[var(--text-primary)] outline-none"
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
                          <label className="block text-[10px] font-bold text-[var(--text-muted)] uppercase tracking-wider mb-0.5">Expected Qty</label>
                          <input
                            type="number"
                            min={1}
                            value={line.expectedQty}
                            onChange={(e) => handleLineChange(idx, "expectedQty", Number(e.target.value))}
                            className="w-full text-xs border border-[var(--border-main)] rounded-lg px-2 py-1.5 bg-[var(--bg-card)] text-[var(--text-primary)] font-mono font-bold"
                          />
                          {errors[`qty-${idx}`] && <p className="text-[var(--color-danger-text)] text-[9px] mt-0.5 font-semibold">{errors[`qty-${idx}`]}</p>}
                        </div>
                        <div>
                          <label className="block text-[10px] font-bold text-[var(--text-muted)] uppercase tracking-wider mb-0.5">Expected Date</label>
                          <input
                            type="date"
                            value={line.expectedDate}
                            onChange={(e) => handleLineChange(idx, "expectedDate", e.target.value)}
                            className="w-full text-xs border border-[var(--border-main)] rounded-lg px-2 py-1.5 bg-[var(--bg-card)] text-[var(--text-primary)] font-mono"
                          />
                          {errors[`date-${idx}`] && <p className="text-[var(--color-danger-text)] text-[9px] mt-0.5 font-semibold">{errors[`date-${idx}`]}</p>}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="border-t border-[var(--border-main)] pt-4 flex items-center justify-end gap-3 sticky bottom-0 bg-[var(--bg-card)]">
                <button type="button" onClick={() => setIsOpen(false)} className="px-4 py-2 text-sm font-semibold text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-hover)] rounded-xl transition-all">
                  Cancel
                </button>
                <Button type="submit" id="schedule-submit-btn" variant="primary">
                  Save Schedule
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
