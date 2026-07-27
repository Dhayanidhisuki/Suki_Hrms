"use client";

import { useState, useEffect, useCallback } from "react";
import { Plus, Trash, CheckCircle2, ChevronDown, ChevronUp, ShieldAlert } from "lucide-react";
import Sidebar from "@/app/dashboard/components/Sidebar";
import TopBar from "@/app/dashboard/components/TopBar";
import RoleGate from "@/app/dashboard/components/RoleGate";
import { TableSkeleton } from "@/app/dashboard/components/LoadingSkeleton";
import { apiGet, apiPost } from "@/lib/apiClient";
import { Button } from "@/components/ui/button";

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

interface PoGrnLine {
  rowId: number;
  girNo: number;
  itemCode: string;
  invQty: number;
  recQty: number;
  price: number;
  tool?: { name: string } | null;
}

interface PoGrnHeader {
  girNo: number;
  poOrderNo: string;
  girDate: string;
  girStatus: string;
  lines: PoGrnLine[];
}

const statusConfig: Record<string, { bg: string; text: string }> = {
  Posted: { bg: "bg-[var(--color-success-bg)] border border-[var(--border-main)]", text: "text-[var(--color-success-text)]" },
  Draft: { bg: "bg-[var(--color-warning-bg)] border border-[var(--border-main)]", text: "text-[var(--color-warning-text)]" },
};

interface StagedGrnLine {
  toolOrGaugeNo: string;
  invQty: number;
  recQty: number;
  price: number;
}

export default function PoReceivePage() {
  const [grns, setGrns] = useState<PoGrnHeader[]>([]);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [tools, setTools] = useState<Tool[]>([]);
  const [loading, setLoading] = useState(true);

  // Success Banner
  const [successBanner, setSuccessBanner] = useState("");
  const [bannerMsg, setBannerMsg] = useState<{ type: "success" | "error"; text: string } | null>(null);

  // Mode state
  const [showForm, setShowForm] = useState(false);
  const [expandedGrn, setExpandedGrn] = useState<number | null>(null);

  // Form Fields
  const [poOrderNo, setPoOrderNo] = useState("");
  const [girDate, setGirDate] = useState("");
  const [stagedLines, setStagedLines] = useState<StagedGrnLine[]>([]);

  // Validation Errors
  const [errors, setErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    setGirDate(new Date().toISOString().split("T")[0]);
  }, [showForm]);

  const loadData = useCallback(async () => {
    setLoading(true);
    const [gRes, sRes, tRes] = await Promise.all([
      apiGet<{ items: PoGrnHeader[] }>("/api/po-linked/receive"),
      apiGet<{ items: Supplier[] }>("/api/suppliers"),
      apiGet<{ items: Tool[] }>("/api/tools"),
    ]);

    if (gRes.data?.items) setGrns(gRes.data.items);
    if (sRes.data?.items) {
      setSuppliers(sRes.data.items);
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

  const handleAddLine = () => {
    if (tools.length === 0) return;
    const defaultTool = tools[0].toolOrGaugeNo;
    setStagedLines((prev) => [
      ...prev,
      { toolOrGaugeNo: defaultTool, invQty: 10, recQty: 10, price: 500 },
    ]);
  };

  const handleLineChange = (
    index: number,
    field: keyof StagedGrnLine,
    value: string | number
  ) => {
    const updated = [...stagedLines];
    updated[index] = { ...updated[index], [field]: value };
    setStagedLines(updated);
  };

  const handleRemoveLine = (index: number) => {
    setStagedLines((prev) => prev.filter((_, i) => i !== index));
  };

  const handleClearForm = () => {
    setPoOrderNo("");
    setStagedLines([]);
    setErrors({});
  };

  const handlePostGRN = async (e: React.FormEvent) => {
    e.preventDefault();
    const tempErrors: Record<string, string> = {};

    if (!poOrderNo.trim()) tempErrors.poOrderNo = "PO Order number is required";
    if (stagedLines.length === 0) tempErrors.lines = "At least one GRN line item must be added";

    stagedLines.forEach((line, idx) => {
      if (line.recQty > line.invQty) {
        tempErrors[`qty-${idx}`] = `Received qty cannot exceed invoice qty (${line.invQty})`;
      }
      if (line.price <= 0) {
        tempErrors[`rate-${idx}`] = "Unit price must be greater than 0";
      }
    });

    if (Object.keys(tempErrors).length > 0) {
      setErrors(tempErrors);
      return;
    }

    const payload = {
      poOrderNo,
      girDate,
      lines: stagedLines.map((l) => ({
        toolOrGaugeNo: l.toolOrGaugeNo,
        invQty: l.invQty,
        recQty: l.recQty,
        price: l.price,
      })),
    };

    setBannerMsg(null);
    const res = await apiPost<{ item: PoGrnHeader }>("/api/po-linked/receive", payload);

    if (res.error) {
      setBannerMsg({ type: "error", text: res.error.message });
      return;
    }

    if (res.data?.item) {
      setSuccessBanner(`GRN #${res.data.item.girNo} posted successfully! Inventory stock increased.`);
      handleClearForm();
      setShowForm(false);
      loadData();
      setTimeout(() => setSuccessBanner(""), 5000);
    }
  };

  const renderGrnList = () => {
    if (loading) return <TableSkeleton rows={4} />;
    if (grns.length === 0)
      return (
        <div className="text-center text-sm text-[var(--text-muted)] py-8">
          No GRN records found. Create a new GRN to get started.
        </div>
      );
    return grns.map((grn) => {
      const sc = statusConfig[grn.girStatus] ?? statusConfig["Draft"];
      const isExpanded = expandedGrn === grn.girNo;
      return (
        <div key={grn.girNo} className="border border-[var(--border-main)] rounded-xl p-4 space-y-3 bg-[var(--bg-subtle)]">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <div>
              <p className="font-mono text-sm font-bold text-[var(--text-primary)]">{grn.girNo}</p>
              <p className="text-xs text-[var(--text-muted)] mt-0.5">
                PO: <span className="font-semibold text-[var(--text-primary)] font-mono">{grn.poOrderNo}</span> · Date: {grn.girDate ? grn.girDate.split("T")[0] : "—"}
              </p>
            </div>

            <div className="flex items-center gap-3">
              <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-semibold ${sc.bg} ${sc.text}`}>
                {grn.girStatus}
              </span>
              <button
                onClick={() => setExpandedGrn(isExpanded ? null : grn.girNo)}
                className="p-1.5 hover:bg-[var(--bg-hover)] rounded-lg text-[var(--text-muted)] hover:text-[var(--text-primary)] transition-colors flex items-center gap-1 text-xs font-semibold"
              >
                {isExpanded ? "Hide details" : "View lines"}
                {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
              </button>
            </div>
          </div>

          {isExpanded && (
            <div className="overflow-auto border-t border-[var(--border-main)] pt-3 animate-fade-in">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-[var(--text-muted)] font-bold text-[10px] uppercase bg-[var(--bg-card)]">
                    {["Tool No", "Name", "Inv Qty", "Received", "Unit Price"].map((col) => (
                      <th key={col} className="text-left py-2 px-3">
                        {col}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-[var(--border-main)]">
                  {grn.lines.map((line) => (
                    <tr key={line.rowId} className="text-[var(--text-secondary)] text-xs hover:bg-[var(--bg-hover)]">
                      <td className="py-2.5 px-3 font-mono font-semibold text-[var(--text-secondary)]">{line.itemCode}</td>
                      <td className="py-2.5 px-3 font-semibold text-[var(--text-primary)]">{line.tool?.name ?? line.itemCode}</td>
                      <td className="py-2.5 px-3 font-mono text-[var(--text-muted)]">{line.invQty}</td>
                      <td className="py-2.5 px-3 font-mono font-bold text-[var(--color-success-text)]">{line.recQty}</td>
                      <td className="py-2.5 px-3 font-mono font-semibold text-[var(--text-primary)]">₹{Number(line.price).toFixed(2)}</td>
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
                PO Receive (GRN)
              </h1>
              <p className="text-sm text-[var(--text-muted)] mt-0.5">
                Goods receipt against purchase orders (TOOLS_PO_RECEIVE)
              </p>
            </div>
            <RoleGate permission="canRaisePO">
              {!showForm && (
                <Button
                  id="po-receive-add-btn"
                  onClick={() => setShowForm(true)}
                  variant="primary"
                  className="group"
                >
                  <Plus className="w-4 h-4 transition-transform group-hover:rotate-90 duration-200" />
                  New GRN
                </Button>
              )}
            </RoleGate>
          </div>

          {/* ── ACTIVE GRN FORM (TOP) ── */}
          {showForm && (
            <form onSubmit={handlePostGRN} className="bg-[var(--bg-card)] rounded-2xl border border-[var(--border-main)] p-5 space-y-5 mb-6 animate-fade-in">
              <div className="flex items-center justify-between pb-3 border-b border-[var(--border-main)]">
                <h2 className="text-sm font-bold text-[var(--text-primary)] uppercase tracking-widest">Active GRN Form</h2>
                <span className="font-mono text-xs text-[var(--text-muted)] font-bold bg-[var(--bg-subtle)] px-2.5 py-1 rounded-md">
                  GRN No: Auto-generated
                </span>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-[var(--text-muted)] uppercase tracking-wider mb-1">
                    PO Order Number *
                  </label>
                  <input
                    id="form-po-ref"
                    value={poOrderNo}
                    onChange={(e) => setPoOrderNo(e.target.value.toUpperCase())}
                    placeholder="e.g. PO-MEQ-2026-001"
                    className="w-full text-sm border border-[var(--border-main)] rounded-lg px-3 py-2 outline-none focus:ring-2 focus:ring-[var(--primary-subtle)] bg-[var(--bg-subtle)] text-[var(--text-primary)] placeholder-[var(--text-muted)] font-mono font-semibold"
                  />
                  {errors.poOrderNo && <p className="text-[var(--color-danger-text)] text-xs mt-1 font-semibold">{errors.poOrderNo}</p>}
                </div>

                <div>
                  <label className="block text-xs font-semibold text-[var(--text-muted)] uppercase tracking-wider mb-1">
                    GRN Date
                  </label>
                  <input
                    type="date"
                    value={girDate}
                    onChange={(e) => setGirDate(e.target.value)}
                    className="w-full text-sm border border-[var(--border-main)] rounded-lg px-3 py-2 bg-[var(--bg-subtle)] outline-none focus:ring-2 focus:ring-[var(--primary-subtle)] font-mono font-medium text-[var(--text-primary)]"
                  />
                </div>
              </div>

              {/* Line items details */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <p className="text-xs font-bold text-[var(--text-muted)] uppercase tracking-wider">Receipt Line Items</p>
                  <button
                    type="button"
                    onClick={handleAddLine}
                    className="text-xs font-bold text-[var(--primary)] flex items-center gap-1 hover:underline"
                  >
                    <Plus className="w-4 h-4" /> Add Item Line
                  </button>
                </div>

                {errors.lines && (
                  <div className="p-3 bg-[var(--color-danger-bg)] border border-[var(--border-main)] rounded-xl text-xs text-[var(--color-danger-text)] font-semibold flex items-center gap-2">
                    <ShieldAlert className="w-4 h-4 text-red-500" />
                    <span>{errors.lines}</span>
                  </div>
                )}

                <div className="overflow-auto border border-[var(--border-main)] rounded-xl">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-[var(--border-main)] bg-[var(--bg-subtle)]">
                        {["Select Tool", "Inv Qty", "Received Qty", "Unit Price (₹)", ""].map((col) => (
                          <th key={col} className="text-left text-[11px] font-bold text-[var(--text-muted)] uppercase tracking-wider py-2.5 px-4">
                            {col}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[var(--border-main)]">
                      {stagedLines.map((line, idx) => (
                        <tr key={idx}>
                          <td className="py-2 px-3">
                            <select
                              value={line.toolOrGaugeNo}
                              onChange={(e) => handleLineChange(idx, "toolOrGaugeNo", e.target.value)}
                              className="w-full text-sm border border-[var(--border-main)] rounded-lg px-2 py-1.5 bg-[var(--bg-subtle)] text-[var(--text-primary)] outline-none"
                            >
                              {tools.map((t) => (
                                <option key={t.refNo} value={t.toolOrGaugeNo}>
                                  {t.toolOrGaugeNo} · {t.name}
                                </option>
                              ))}
                            </select>
                          </td>
                          <td className="py-2 px-3">
                            <input
                              type="number"
                              min={1}
                              value={line.invQty}
                              onChange={(e) => handleLineChange(idx, "invQty", Number(e.target.value))}
                              className="w-24 text-center text-sm border border-[var(--border-main)] rounded-lg py-1.5 bg-[var(--bg-subtle)] text-[var(--text-primary)] font-mono font-medium"
                            />
                          </td>
                          <td className="py-2 px-3">
                            <input
                              type="number"
                              min={1}
                              max={line.invQty}
                              value={line.recQty}
                              onChange={(e) => handleLineChange(idx, "recQty", Number(e.target.value))}
                              className="w-24 text-center text-sm border border-[var(--border-main)] rounded-lg py-1.5 bg-[var(--bg-subtle)] font-mono font-bold text-[var(--text-primary)]"
                            />
                            {errors[`qty-${idx}`] && <p className="text-[var(--color-danger-text)] text-[10px] mt-1 font-semibold">{errors[`qty-${idx}`]}</p>}
                          </td>
                          <td className="py-2 px-3">
                            <input
                              type="number"
                              min={1}
                              value={line.price}
                              onChange={(e) => handleLineChange(idx, "price", Number(e.target.value))}
                              className="w-32 text-center text-sm border border-[var(--border-main)] rounded-lg py-1.5 bg-[var(--bg-subtle)] text-[var(--text-primary)] font-mono font-medium"
                            />
                            {errors[`rate-${idx}`] && <p className="text-[var(--color-danger-text)] text-[10px] mt-1 font-semibold">{errors[`rate-${idx}`]}</p>}
                          </td>
                          <td className="py-2 px-3 text-right">
                            <button
                              type="button"
                              onClick={() => handleRemoveLine(idx)}
                              className="p-1.5 hover:bg-[var(--color-danger-bg)] rounded-lg text-[var(--text-muted)] hover:text-[var(--color-danger-text)] transition-colors"
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
              <div className="border-t border-[var(--border-main)] pt-4 flex items-center justify-end gap-3 bg-[var(--bg-card)]">
                <button
                  type="button"
                  onClick={() => {
                    handleClearForm();
                    setShowForm(false);
                  }}
                  className="px-4 py-2 text-sm font-semibold text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-hover)] rounded-xl transition-all"
                >
                  Cancel
                </button>
                <Button
                  type="submit"
                  id="grn-submit-btn"
                  variant="primary"
                >
                  Post GRN (Posted)
                </Button>
              </div>
            </form>
          )}

          {/* ── EXISTING GRNS LIST (BELOW) ── */}
          <div className="bg-[var(--bg-card)] rounded-2xl border border-[var(--border-main)] p-5">
            <div className="pb-3 border-b border-[var(--border-main)] mb-4">
              <h2 className="text-sm font-bold text-[var(--text-primary)] uppercase tracking-widest">Posted Goods Receipt Notes</h2>
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
