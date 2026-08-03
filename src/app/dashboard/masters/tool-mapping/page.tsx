"use client";

import { useCallback, useEffect, useState } from "react";
import { Plus, Search, Trash2, X, Link2 } from "lucide-react";
import { SimpleMasterShell } from "@/components/SimpleMasterShell";
import { TableSkeleton } from "@/app/dashboard/components/LoadingSkeleton";
import { ModuleKpiRow } from "@/app/dashboard/components/ModuleKpiRow";
import RoleGate from "@/app/dashboard/components/RoleGate";
import { TablePager } from "@/components/TablePager";
import { apiGet, apiPost, apiDelete } from "@/lib/apiClient";
import { Button } from "@/components/ui/button";
import { useSuccessOverlay } from "@/components/SuccessOverlay";

type MappingRow = {
  rowId: number;
  toolRefNo: number | null;
  toolOrGaugeNo: string | null;
  toolName: string | null;
  grouping: string | null;
  type: string | null;
  toolStatus: string | null;
  supCode: string | null;
  supplierName: string | null;
  city: string | null;
  gstin: string | null;
  supplierStatus: string | null;
  approvedSupplier: string | null;
  phone: string | null;
  creatDt: string | null;
};

type ToolOption = {
  refNo: number;
  toolOrGaugeNo: string;
  name: string | null;
  grouping: string;
};

type SupplierOption = {
  id: string;
  supCode: string;
  supName: string;
};

const pageSize = 20;

export default function ToolMappingPage() {
  const { showSuccess } = useSuccessOverlay();
  const [items, setItems] = useState<MappingRow[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(true);
  const [bannerMsg, setBannerMsg] = useState<{ type: "success" | "error"; text: string } | null>(
    null
  );

  const [showAdd, setShowAdd] = useState(false);
  const [toolSearch, setToolSearch] = useState("");
  const [toolOptions, setToolOptions] = useState<ToolOption[]>([]);
  const [selectedTool, setSelectedTool] = useState<ToolOption | null>(null);
  const [supSearch, setSupSearch] = useState("");
  const [supOptions, setSupOptions] = useState<SupplierOption[]>([]);
  const [selectedSup, setSelectedSup] = useState<SupplierOption | null>(null);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    const params = new URLSearchParams({
      page: String(page),
      pageSize: String(pageSize),
    });
    if (query.trim()) params.set("search", query.trim());
    const res = await apiGet<{ items: MappingRow[]; total?: number }>(
      `/api/tools-mapping?${params}`
    );
    setItems(res.data?.items ?? []);
    setTotal(res.data?.total ?? 0);
    setLoading(false);
  }, [page, query]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    if (!toolSearch.trim() || toolSearch.trim().length < 2) {
      setToolOptions([]);
      return;
    }
    const t = setTimeout(async () => {
      const res = await apiGet<{ items: ToolOption[] }>(
        `/api/tools?search=${encodeURIComponent(toolSearch.trim())}&pageSize=12`
      );
      setToolOptions(res.data?.items ?? []);
    }, 250);
    return () => clearTimeout(t);
  }, [toolSearch]);

  useEffect(() => {
    if (!supSearch.trim() || supSearch.trim().length < 2) {
      setSupOptions([]);
      return;
    }
    const t = setTimeout(async () => {
      const res = await apiGet<{ items: SupplierOption[] }>(
        `/api/suppliers?search=${encodeURIComponent(supSearch.trim())}&pageSize=12`
      );
      setSupOptions(res.data?.items ?? []);
    }, 250);
    return () => clearTimeout(t);
  }, [supSearch]);

  const handleDelete = async (rowId: number) => {
    setBannerMsg(null);
    const res = await apiDelete(`/api/tools-mapping/${rowId}`);
    if (res.error) {
      setBannerMsg({ type: "error", text: res.error.message });
      return;
    }
    setBannerMsg({ type: "success", text: "Mapping removed." });
    void load();
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedTool || !selectedSup) {
      setBannerMsg({ type: "error", text: "Select both a tool and a supplier." });
      return;
    }
    setSaving(true);
    setBannerMsg(null);
    const res = await apiPost("/api/tools-mapping", {
      toolRefNo: selectedTool.refNo,
      supCode: selectedSup.supCode,
    });
    setSaving(false);
    if (res.error) {
      setBannerMsg({ type: "error", text: res.error.message });
      return;
    }
    setBannerMsg({
      type: "success",
      text: `Mapped ${selectedTool.toolOrGaugeNo} → ${selectedSup.supCode}`,
    });
    showSuccess({
      title: "Mapping saved",
      message: "Tool–supplier mapping created successfully.",
      detail: `${selectedTool.toolOrGaugeNo} → ${selectedSup.supCode}`,
    });
    setShowAdd(false);
    setSelectedTool(null);
    setSelectedSup(null);
    setToolSearch("");
    setSupSearch("");
    setPage(1);
    void load();
  };

  const approvedCount = items.filter(
    (i) => (i.approvedSupplier ?? "").toUpperCase() === "YES" || i.approvedSupplier === "Y"
  ).length;

  return (
    <SimpleMasterShell
      title="Tool Mapping"
      subtitle="Approved tool ↔ supplier links (TOOLS_MAPPING) — same data ERP uses for purchase"
      actions={
        <RoleGate permission="canEditMaster">
          <Button type="button" onClick={() => setShowAdd(true)} className="group">
            <Plus className="w-4 h-4 transition-transform group-hover:rotate-90 duration-200" />
            Add Mapping
          </Button>
        </RoleGate>
      }
    >
      {bannerMsg && (
        <div
          className={`mb-4 px-4 py-3 rounded-xl text-sm font-medium flex items-center gap-2 ${
            bannerMsg.type === "success"
              ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
              : "bg-red-50 text-red-700 border border-red-200"
          }`}
        >
          {bannerMsg.text}
          <button onClick={() => setBannerMsg(null)} className="ml-auto text-xs opacity-60">
            ✕
          </button>
        </div>
      )}

      <ModuleKpiRow
        items={[
          {
            id: "map-total",
            label: "Total Mappings",
            value: total,
            subtext: "TOOLS_MAPPING rows",
            icon: Link2,
            iconBg: "bg-[var(--primary-light)]",
            iconColor: "text-[var(--primary)]",
            badge: { label: "Links", type: "info" },
          },
          {
            id: "map-page",
            label: "On This Page",
            value: items.length,
            subtext: `Page ${page}`,
            icon: Search,
            iconBg: "bg-blue-50 dark:bg-blue-950/30",
            iconColor: "text-blue-600",
            badge: { label: "Page", type: "info" },
          },
          {
            id: "map-approved",
            label: "Approved Suppliers (page)",
            value: approvedCount,
            subtext: "APPROVED_SUPPLIER = Yes",
            icon: Link2,
            iconBg: "bg-emerald-50 dark:bg-emerald-950/30",
            iconColor: "text-emerald-600",
            badge: { label: "Approved", type: "success" },
          },
        ]}
      />

      <div className="bg-[var(--bg-card)] rounded-2xl border border-[var(--border-main)] p-5 mb-6">
        <div className="relative max-w-md">
          <Search className="w-4 h-4 text-[var(--text-muted)] absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setPage(1);
            }}
            placeholder="Search tool no, tool name, supplier code / name…"
            className="w-full text-sm border border-[var(--border-main)] rounded-lg pl-9 pr-3 py-2 bg-[var(--bg-subtle)] outline-none focus:ring-2 focus:ring-[var(--primary-subtle)]"
          />
        </div>
      </div>

      <div className="bg-[var(--bg-card)] rounded-2xl border border-[var(--border-main)] p-5">
        {loading ? (
          <TableSkeleton rows={8} />
        ) : (
          <div className="overflow-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-[var(--border-main)] bg-[var(--bg-subtle)]">
                  {[
                    "#",
                    "Tool No",
                    "Tool Name",
                    "Group",
                    "Supplier Code",
                    "Supplier Name",
                    "City",
                    "GSTIN",
                    "Approved?",
                    "Mapped On",
                    "",
                  ].map((col) => (
                    <th
                      key={col || "act"}
                      className="text-left text-[11px] font-semibold text-[var(--text-muted)] uppercase tracking-wider py-2.5 px-3"
                    >
                      {col}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--border-main)]">
                {items.map((row, idx) => (
                  <tr key={row.rowId} className="hover:bg-[var(--bg-hover)]">
                    <td className="py-2.5 px-3 text-xs text-[var(--text-muted)] tabular-nums">
                      {(page - 1) * pageSize + idx + 1}
                    </td>
                    <td className="py-2.5 px-3 font-mono text-xs font-semibold text-[var(--primary)]">
                      {row.toolOrGaugeNo ?? "—"}
                    </td>
                    <td className="py-2.5 px-3 text-xs max-w-[12rem] truncate">
                      {row.toolName || "—"}
                    </td>
                    <td className="py-2.5 px-3 text-xs text-[var(--text-muted)]">
                      {row.grouping ?? "—"}
                    </td>
                    <td className="py-2.5 px-3 font-mono text-xs font-semibold">
                      {row.supCode ?? "—"}
                    </td>
                    <td className="py-2.5 px-3 text-xs">{row.supplierName || "—"}</td>
                    <td className="py-2.5 px-3 text-xs text-[var(--text-muted)]">
                      {row.city || "—"}
                    </td>
                    <td className="py-2.5 px-3 font-mono text-[11px] text-[var(--text-muted)]">
                      {row.gstin || "—"}
                    </td>
                    <td className="py-2.5 px-3 text-xs">
                      {(row.approvedSupplier ?? "").toUpperCase() === "YES" ||
                      row.approvedSupplier === "Y"
                        ? "Yes"
                        : "No"}
                    </td>
                    <td className="py-2.5 px-3 font-mono text-[11px] text-[var(--text-muted)]">
                      {row.creatDt ? String(row.creatDt).split("T")[0] : "—"}
                    </td>
                    <td className="py-2.5 px-3 text-right">
                      <RoleGate permission="canEditMaster">
                        <button
                          type="button"
                          onClick={() => void handleDelete(row.rowId)}
                          className="p-1.5 rounded-lg text-[var(--text-muted)] hover:text-[var(--color-danger-text)] hover:bg-[var(--color-danger-bg)]"
                          title="Remove mapping"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </RoleGate>
                    </td>
                  </tr>
                ))}
                {items.length === 0 && (
                  <tr>
                    <td colSpan={11} className="py-10 text-center text-sm text-[var(--text-muted)]">
                      No tool ↔ supplier mappings found.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}

        <TablePager
          page={page}
          pageSize={pageSize}
          total={total}
          onPageChange={setPage}
          disabled={loading}
          idPrefix="tool-map"
        />
      </div>

      {showAdd && (
        <div className="fixed inset-0 z-50 bg-black/40 flex justify-end">
          <div className="w-full max-w-md h-full bg-[var(--bg-card)] border-l border-[var(--border-main)] flex flex-col">
            <div className="px-5 py-4 border-b border-[var(--border-main)] flex items-center justify-between">
              <h2 className="text-base font-bold">Add Tool ↔ Supplier Mapping</h2>
              <button
                type="button"
                onClick={() => setShowAdd(false)}
                className="p-1.5 rounded-lg hover:bg-[var(--bg-hover)] text-[var(--text-muted)]"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <form onSubmit={handleCreate} className="flex-1 overflow-y-auto p-5 space-y-5">
              <div>
                <label className="text-[11px] font-semibold uppercase text-[var(--text-muted)]">
                  Tool
                </label>
                {selectedTool ? (
                  <div className="mt-1 flex items-center justify-between gap-2 rounded-lg border border-[var(--border-main)] px-3 py-2 bg-[var(--bg-subtle)]">
                    <div>
                      <p className="font-mono text-sm font-semibold">{selectedTool.toolOrGaugeNo}</p>
                      <p className="text-xs text-[var(--text-muted)]">
                        {selectedTool.name || selectedTool.grouping}
                      </p>
                    </div>
                    <button
                      type="button"
                      className="text-xs text-[var(--primary)]"
                      onClick={() => setSelectedTool(null)}
                    >
                      Change
                    </button>
                  </div>
                ) : (
                  <div className="mt-1 relative">
                    <input
                      value={toolSearch}
                      onChange={(e) => setToolSearch(e.target.value)}
                      placeholder="Search tool number…"
                      className="w-full text-sm border border-[var(--border-main)] rounded-lg px-3 py-2 bg-[var(--bg-subtle)]"
                    />
                    {toolOptions.length > 0 && (
                      <div className="absolute z-10 w-full mt-1 max-h-40 overflow-auto rounded-lg border border-[var(--border-main)] bg-[var(--bg-surface)] shadow-lg divide-y divide-[var(--border-main)]">
                        {toolOptions.map((t) => (
                          <button
                            key={t.refNo}
                            type="button"
                            className="w-full text-left px-3 py-2 text-sm hover:bg-[var(--bg-hover)]"
                            onClick={() => {
                              setSelectedTool(t);
                              setToolSearch("");
                              setToolOptions([]);
                            }}
                          >
                            <span className="font-mono font-semibold">{t.toolOrGaugeNo}</span>
                            <span className="text-xs text-[var(--text-muted)] block">
                              {t.name || t.grouping}
                            </span>
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>

              <div>
                <label className="text-[11px] font-semibold uppercase text-[var(--text-muted)]">
                  Supplier
                </label>
                {selectedSup ? (
                  <div className="mt-1 flex items-center justify-between gap-2 rounded-lg border border-[var(--border-main)] px-3 py-2 bg-[var(--bg-subtle)]">
                    <div>
                      <p className="font-mono text-sm font-semibold">{selectedSup.supCode}</p>
                      <p className="text-xs text-[var(--text-muted)]">{selectedSup.supName}</p>
                    </div>
                    <button
                      type="button"
                      className="text-xs text-[var(--primary)]"
                      onClick={() => setSelectedSup(null)}
                    >
                      Change
                    </button>
                  </div>
                ) : (
                  <div className="mt-1 relative">
                    <input
                      value={supSearch}
                      onChange={(e) => setSupSearch(e.target.value)}
                      placeholder="Search supplier code / name…"
                      className="w-full text-sm border border-[var(--border-main)] rounded-lg px-3 py-2 bg-[var(--bg-subtle)]"
                    />
                    {supOptions.length > 0 && (
                      <div className="absolute z-10 w-full mt-1 max-h-40 overflow-auto rounded-lg border border-[var(--border-main)] bg-[var(--bg-surface)] shadow-lg divide-y divide-[var(--border-main)]">
                        {supOptions.map((s) => (
                          <button
                            key={s.supCode}
                            type="button"
                            className="w-full text-left px-3 py-2 text-sm hover:bg-[var(--bg-hover)]"
                            onClick={() => {
                              setSelectedSup(s);
                              setSupSearch("");
                              setSupOptions([]);
                            }}
                          >
                            <span className="font-mono font-semibold">{s.supCode}</span>
                            <span className="text-xs text-[var(--text-muted)] block">{s.supName}</span>
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>

              <Button type="submit" disabled={saving || !selectedTool || !selectedSup} className="w-full">
                {saving ? "Saving…" : "Save Mapping"}
              </Button>
            </form>
          </div>
        </div>
      )}
    </SimpleMasterShell>
  );
}
