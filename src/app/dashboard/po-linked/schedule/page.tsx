"use client";

import { useState, useEffect, useCallback } from "react";
import { Plus, Trash, ShieldAlert, X } from "lucide-react";
import Sidebar from "@/app/dashboard/components/Sidebar";
import TopBar from "@/app/dashboard/components/TopBar";
import RoleGate from "@/app/dashboard/components/RoleGate";
import { TableSkeleton } from "@/app/dashboard/components/LoadingSkeleton";
import { apiGet, apiPost } from "@/lib/apiClient";
import { Button } from "@/components/ui/button";
import { toastSuccess, toastError } from "@/lib/appToast";
import { MasterSearchSelect } from "@/components/ui/MasterSearchSelect";

interface Supplier {
  supCode: string;
  supName: string;
  isApproved: boolean;
}

interface Tool {
  refNo: number;
  toolOrGaugeNo: string;
  name: string;
}

interface ScheduleLine {
  rowId: number;
  poTransNo: number;
  toolOrGaugeNo: string;
  qty: number;
  tool?: { name: string } | null;
}

interface PoScheduleHeader {
  rowId: number;
  poOrderNo: string;
  creatDt: string;
  lines: ScheduleLine[];
}

const statusConfig: Record<string, { bg: string; text: string }> = {
  Completed: { bg: "bg-[var(--color-success-bg)] border border-[var(--border-main)]", text: "text-[var(--color-success-text)]" },
  Partial: { bg: "bg-[var(--color-warning-bg)] border border-[var(--border-main)]", text: "text-[var(--color-warning-text)]" },
  Pending: { bg: "bg-[var(--primary-light)] border border-[var(--border-main)]", text: "text-[var(--primary)]" },
};

interface StagedScheduleLine {
  toolOrGaugeNo: string;
  qty: number;
}

export default function PoSchedulePage() {
  const [schedules, setSchedules] = useState<PoScheduleHeader[]>([]);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [loading, setLoading] = useState(true);

  // Slide-over Form State
  const [isOpen, setIsOpen] = useState(false);
  const [poOrderNo, setPoOrderNo] = useState("");
  const [stagedLines, setStagedLines] = useState<StagedScheduleLine[]>([]);

  // Validation Errors
  const [errors, setErrors] = useState<Record<string, string>>({});

  const loadData = useCallback(async () => {
    setLoading(true);
    const [schRes, supRes] = await Promise.all([
      apiGet<{ items: PoScheduleHeader[] }>("/api/po/schedule"),
      apiGet<{ items: Supplier[] }>("/api/suppliers"),
    ]);

    if (schRes.data?.items) setSchedules(schRes.data.items);
    if (supRes.data?.items) {
      setSuppliers(supRes.data.items);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const approvedSuppliers = suppliers.filter((s) => s.isApproved);

  const handleOpenAdd = () => {
    setPoOrderNo("");
    setStagedLines([{ toolOrGaugeNo: "", qty: 5 }]);
    setErrors({});
    setIsOpen(true);
  };

  const handleAddLine = () => {
    setStagedLines((prev) => [
      ...prev,
      {
        toolOrGaugeNo: "",
        qty: 5,
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

    if (!poOrderNo.trim()) tempErrors.poOrderNo = "PO Order number is required";
    if (stagedLines.length === 0) tempErrors.lines = "At least one milestone schedule line must be added";

    stagedLines.forEach((line, idx) => {
      if (!line.toolOrGaugeNo.trim()) {
        tempErrors[`tool-${idx}`] = "Tool is required";
      }
      if (line.qty <= 0) {
        tempErrors[`qty-${idx}`] = "Quantity must be > 0";
      }
    });

    if (Object.keys(tempErrors).length > 0) {
      setErrors(tempErrors);
      return;
    }

    const payload = {
      poOrderNo,
      lines: stagedLines.map((l) => ({
        toolOrGaugeNo: l.toolOrGaugeNo,
        qty: l.qty,
      })),
    };

    const res = await apiPost<{ schedule: PoScheduleHeader }>("/api/po/schedule", payload);

    if (res.error) {
      toastError(res.error.message);
      return;
    }

    const poNo = res.data?.schedule?.poOrderNo ?? poOrderNo;
    toastSuccess({
      title: "Schedule saved",
      message: "PO delivery schedule created successfully.",
      detail: poNo,
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
            <RoleGate module="purchase" action="CREATE">
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
                return (
                  <div key={sch.rowId} className="bg-[var(--bg-card)] rounded-2xl border border-[var(--border-main)] p-5">
                    <div className="flex items-center justify-between mb-3">
                      <div>
                        <p className="font-mono text-sm font-semibold text-[var(--text-primary)]">{sch.poOrderNo}</p>
                        <p className="text-xs text-[var(--text-muted)] mt-0.5">
                          Created {sch.creatDt ? sch.creatDt.split("T")[0] : "—"}
                        </p>
                      </div>
                    </div>
                    <div className="overflow-auto">
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="border-b border-[var(--border-main)] bg-[var(--bg-subtle)]">
                            {["Tool No", "Name", "Qty"].map(
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
                            return (
                              <tr key={line.rowId} className="hover:bg-[var(--bg-hover)] transition-colors">
                                <td className="py-2.5 px-3 font-mono text-xs text-[var(--text-secondary)] font-semibold">
                                  {line.toolOrGaugeNo}
                                </td>
                                <td className="py-2.5 px-3 font-medium text-[var(--text-primary)]">{line.tool?.name ?? line.toolOrGaugeNo}</td>
                                <td className="py-2.5 px-3 font-mono text-xs font-bold text-[var(--text-primary)]">{line.qty}</td>
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

            <form onSubmit={handleSaveSchedule} className="flex-1 overflow-y-auto p-5 space-y-5">
              <div>
                <label className="form-label">
                  PO Order Number *
                </label>
                <input
                  id="form-po"
                  value={poOrderNo}
                  onChange={(e) => setPoOrderNo(e.target.value.toUpperCase())}
                  placeholder="e.g. PO-MEQ-2026-001"
                  className="w-full text-sm border border-[var(--border-main)] rounded-lg px-3 py-2 outline-none focus:ring-2 focus:ring-[var(--primary-subtle)] bg-[var(--bg-subtle)] text-[var(--text-primary)] placeholder-[var(--text-muted)] font-mono font-semibold"
                />
                {errors.poOrderNo && <p className="text-[var(--color-danger-text)] text-xs mt-1 font-semibold">{errors.poOrderNo}</p>}
              </div>

              <div>
                <label className="form-label">
                  Supplier (optional)
                </label>
                <select
                  id="form-sup"
                  className="form-control outline-none focus:ring-2 focus:ring-[var(--primary-subtle)] font-semibold"
                  disabled
                >
                  <option value="">Select supplier (optional)</option>
                  {approvedSuppliers.map((s) => (
                    <option key={s.supCode} value={s.supCode}>
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
                        <MasterSearchSelect
                          kind="tool"
                          label="Select Tool"
                          value={line.toolOrGaugeNo}
                          selectedLabel={line.toolOrGaugeNo}
                          onChange={(value) => handleLineChange(idx, "toolOrGaugeNo", value)}
                          placeholder="Search tool number or name…"
                          required
                        />
                        {errors[`tool-${idx}`] && <p className="form-error">{errors[`tool-${idx}`]}</p>}
                      </div>

                      <div className="grid grid-cols-1 gap-2">
                        <div>
                          <label className="block text-[10px] font-bold text-[var(--text-muted)] uppercase tracking-wider mb-0.5">Expected Qty</label>
                          <input
                            type="number"
                            min={1}
                            value={line.qty}
                            onChange={(e) => handleLineChange(idx, "qty", Number(e.target.value))}
                            className="w-full text-xs border border-[var(--border-main)] rounded-lg px-2 py-1.5 bg-[var(--bg-card)] text-[var(--text-primary)] font-mono font-bold"
                          />
                          {errors[`qty-${idx}`] && <p className="text-[var(--color-danger-text)] text-[9px] mt-0.5 font-semibold">{errors[`qty-${idx}`]}</p>}
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
