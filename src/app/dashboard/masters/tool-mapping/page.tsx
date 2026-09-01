"use client";

import { useCallback, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { Plus, Search, Trash2, X, Link2, FileSpreadsheet } from "lucide-react";
import { SimpleMasterShell } from "@/components/SimpleMasterShell";
import { TableSkeleton } from "@/app/dashboard/components/LoadingSkeleton";
import { ModuleKpiRow } from "@/app/dashboard/components/ModuleKpiRow";
import RoleGate from "@/app/dashboard/components/RoleGate";
import { TablePager } from "@/components/TablePager";
import { MasterSearchInput, MasterTableCard } from "@/components/ui/MasterTableCard";
import { apiGet, apiPost, apiDelete } from "@/lib/apiClient";
import { Button } from "@/components/ui/button";
import { toastSuccess, toastError } from "@/lib/appToast";
import { downloadExcel } from "@/lib/downloadExcel";

type MappingRow = {
  rowId: number;
  toolRefNo: number | null;
  toolOrGaugeNo: string | null;
  toolName: string | null;
  grouping: string | null;
  type: string | null;
  toolStatus: string | null;
  vendorType?: string | null;
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

type VendorOption = {
  id: string;
  code: string;
  name: string;
};

const pageSize = 20;

export default function ToolMappingPage() {
  const searchParams = useSearchParams();
  const toolFromUrl = (searchParams.get("tool") ?? "").trim();

  const [items, setItems] = useState<MappingRow[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [query, setQuery] = useState(toolFromUrl);
  const [vendorFilter, setVendorFilter] = useState("");
  const [loading, setLoading] = useState(true);

  const [showAdd, setShowAdd] = useState(Boolean(toolFromUrl));
  const [vendorType, setVendorType] = useState<"Supplier" | "SubContractor">("Supplier");
  const [toolSearch, setToolSearch] = useState(toolFromUrl);
  const [toolOptions, setToolOptions] = useState<ToolOption[]>([]);
  const [selectedTool, setSelectedTool] = useState<ToolOption | null>(null);
  const [vendorSearch, setVendorSearch] = useState("");
  const [vendorOptions, setVendorOptions] = useState<VendorOption[]>([]);
  const [selectedVendor, setSelectedVendor] = useState<VendorOption | null>(null);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    const params = new URLSearchParams({
      page: String(page),
      pageSize: String(pageSize),
    });
    if (query.trim()) params.set("search", query.trim());
    if (vendorFilter.trim()) params.set("vendorCode", vendorFilter.trim());
    const res = await apiGet<{ items: MappingRow[]; total?: number }>(
      `/api/tools-mapping?${params}`
    );
    setItems(res.data?.items ?? []);
    setTotal(res.data?.total ?? 0);
    setLoading(false);
  }, [page, query, vendorFilter]);

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
      const opts = res.data?.items ?? [];
      setToolOptions(opts);
      if (toolFromUrl && !selectedTool) {
        const match = opts.find(
          (o) => o.toolOrGaugeNo.toUpperCase() === toolFromUrl.toUpperCase()
        );
        if (match) setSelectedTool(match);
      }
    }, 250);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- only re-run on toolSearch / deep-link tool
  }, [toolSearch, toolFromUrl]);

  useEffect(() => {
    if (!vendorSearch.trim() || vendorSearch.trim().length < 2) {
      setVendorOptions([]);
      return;
    }
    const t = setTimeout(async () => {
      if (vendorType === "SubContractor") {
        const res = await apiGet<{
          items: Array<{ subCode: string; subName: string; id: string }>;
        }>(`/api/subcontractors?search=${encodeURIComponent(vendorSearch.trim())}`);
        setVendorOptions(
          (res.data?.items ?? []).slice(0, 12).map((s) => ({
            id: s.subCode || s.id,
            code: s.subCode || s.id,
            name: s.subName,
          }))
        );
      } else {
        const res = await apiGet<{ items: Array<{ id: string; supCode: string; supName: string }> }>(
          `/api/suppliers?search=${encodeURIComponent(vendorSearch.trim())}&pageSize=12`
        );
        setVendorOptions(
          (res.data?.items ?? []).map((s) => ({
            id: s.supCode || s.id,
            code: s.supCode || s.id,
            name: s.supName,
          }))
        );
      }
    }, 250);
    return () => clearTimeout(t);
  }, [vendorSearch, vendorType]);

  const handleDelete = async (rowId: number) => {
    const res = await apiDelete(`/api/tools-mapping/${rowId}`);
    if (res.error) {
      toastError(res.error.message);
      return;
    }
    toastSuccess("Mapping removed.");
    void load();
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedTool || !selectedVendor) {
      toastError("Select both a tool and a vendor.");
      return;
    }
    setSaving(true);
    const res = await apiPost("/api/tools-mapping", {
      toolRefNo: selectedTool.refNo,
      supCode: selectedVendor.code,
      vendorType,
    });
    setSaving(false);
    if (res.error) {
      toastError(res.error.message);
      return;
    }
    toastSuccess({
      title: "Mapping saved",
      message: `Tool–${vendorType} mapping created successfully.`,
      detail: `${selectedTool.toolOrGaugeNo} → ${selectedVendor.code}`,
    });
    setShowAdd(false);
    setSelectedTool(null);
    setSelectedVendor(null);
    setToolSearch("");
    setVendorSearch("");
    setPage(1);
    void load();
  };

  const handleExportExcel = () => {
    downloadExcel({
      filename: "tool_mapping",
      sheetName: "Tool Mapping",
      columns: [
        { key: "toolOrGaugeNo", label: "Tool No" },
        { key: "toolName", label: "Tool Name" },
        { key: "grouping", label: "Group" },
        { key: "vendorType", label: "Vendor Type" },
        { key: "supCode", label: "Vendor Code" },
        { key: "supplierName", label: "Vendor Name" },
        { key: "city", label: "City" },
        { key: "gstin", label: "GSTIN" },
        { key: "approvedSupplier", label: "Approved?" },
        {
          key: "creatDt",
          label: "Mapped On",
          value: (r) => (r.creatDt ? String(r.creatDt).split("T")[0] : ""),
        },
      ],
      rows: items,
    });
    toastSuccess("Excel downloaded (current page).");
  };

  const approvedCount = items.filter(
    (i) => (i.approvedSupplier ?? "").toUpperCase() === "YES" || i.approvedSupplier === "Y"
  ).length;

  return (
    <SimpleMasterShell
      title="Tool Mapping"
      subtitle="Tool ↔ Supplier / SubContractor links (TOOLS_MAPPING.SUP_CODE)"
      actions={
        <div className="flex items-center gap-2">
          <Button
            type="button"
            variant="outline"
            onClick={handleExportExcel}
            disabled={loading || items.length === 0}
          >
            <FileSpreadsheet className="w-4 h-4" />
            Excel
          </Button>
          <RoleGate module="tool_mapping" action="CREATE">
            <Button type="button" onClick={() => setShowAdd(true)} className="group">
              <Plus className="w-4 h-4 transition-transform group-hover:rotate-90 duration-200" />
              Add Mapping
            </Button>
          </RoleGate>
        </div>
      }
    >
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

      <MasterTableCard
        toolbar={
          <>
            <MasterSearchInput
              id="tool-map-search"
              value={query}
              onChange={(v) => {
                setQuery(v);
                setPage(1);
              }}
              placeholder="Search tool, vendor…"
              widthClass="w-52"
            />
            <input
              id="tool-map-vendor-filter"
              value={vendorFilter}
              onChange={(e) => {
                setVendorFilter(e.target.value);
                setPage(1);
              }}
              placeholder="Vendor code"
              aria-label="Vendor code filter"
              className="h-7 w-32 shrink-0 text-[11px] font-mono border border-[var(--border-main)] rounded-md px-2 outline-none focus:ring-1 focus:ring-[var(--primary-subtle)] focus:border-[var(--primary)] bg-[var(--bg-card)] text-[var(--text-primary)] placeholder-[var(--text-muted)]"
            />
          </>
        }
        footer={
          <TablePager
            page={page}
            pageSize={pageSize}
            total={total}
            onPageChange={setPage}
            disabled={loading}
            idPrefix="tool-map"
          />
        }
      >
        {loading ? (
          <div className="p-4">
            <TableSkeleton rows={8} />
          </div>
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
                    "Vendor Type",
                    "Vendor Code",
                    "Vendor Name",
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
                    <td className="py-2.5 px-3 text-xs">{row.vendorType || "—"}</td>
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
                        : row.vendorType === "SubContractor"
                          ? "—"
                          : "No"}
                    </td>
                    <td className="py-2.5 px-3 font-mono text-[11px] text-[var(--text-muted)]">
                      {row.creatDt ? String(row.creatDt).split("T")[0] : "—"}
                    </td>
                    <td className="py-2.5 px-3 text-right">
                      <RoleGate module="tool_mapping" action="DELETE">
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
                    <td colSpan={12} className="py-10 text-center text-sm text-[var(--text-muted)]">
                      No tool ↔ vendor mappings found.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </MasterTableCard>

      {showAdd && (
        <div className="fixed inset-0 z-50 bg-black/40 flex justify-end">
          <div className="w-full max-w-md h-full bg-[var(--bg-card)] border-l border-[var(--border-main)] flex flex-col">
            <div className="px-5 py-4 border-b border-[var(--border-main)] flex items-center justify-between">
              <h2 className="text-base font-bold">Add Tool ↔ Vendor Mapping</h2>
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
                  Vendor Type
                </label>
                <select
                  value={vendorType}
                  onChange={(e) => {
                    setVendorType(e.target.value as "Supplier" | "SubContractor");
                    setSelectedVendor(null);
                    setVendorSearch("");
                    setVendorOptions([]);
                  }}
                  className="mt-1 form-control font-medium"
                >
                  <option value="Supplier">Supplier</option>
                  <option value="SubContractor">SubContractor</option>
                </select>
                <p className="text-[11px] text-[var(--text-muted)] mt-1">
                  Both store the vendor id in SUP_CODE (ERP schema has no separate vendor-type column).
                </p>
              </div>

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
                  {vendorType}
                </label>
                {selectedVendor ? (
                  <div className="mt-1 flex items-center justify-between gap-2 rounded-lg border border-[var(--border-main)] px-3 py-2 bg-[var(--bg-subtle)]">
                    <div>
                      <p className="font-mono text-sm font-semibold">{selectedVendor.code}</p>
                      <p className="text-xs text-[var(--text-muted)]">{selectedVendor.name}</p>
                    </div>
                    <button
                      type="button"
                      className="text-xs text-[var(--primary)]"
                      onClick={() => setSelectedVendor(null)}
                    >
                      Change
                    </button>
                  </div>
                ) : (
                  <div className="mt-1 relative">
                    <input
                      value={vendorSearch}
                      onChange={(e) => setVendorSearch(e.target.value)}
                      placeholder={`Search ${vendorType.toLowerCase()} code / name…`}
                      className="w-full text-sm border border-[var(--border-main)] rounded-lg px-3 py-2 bg-[var(--bg-subtle)]"
                    />
                    {vendorOptions.length > 0 && (
                      <div className="absolute z-10 w-full mt-1 max-h-40 overflow-auto rounded-lg border border-[var(--border-main)] bg-[var(--bg-surface)] shadow-lg divide-y divide-[var(--border-main)]">
                        {vendorOptions.map((s) => (
                          <button
                            key={s.code}
                            type="button"
                            className="w-full text-left px-3 py-2 text-sm hover:bg-[var(--bg-hover)]"
                            onClick={() => {
                              setSelectedVendor(s);
                              setVendorSearch("");
                              setVendorOptions([]);
                            }}
                          >
                            <span className="font-mono font-semibold">{s.code}</span>
                            <span className="text-xs text-[var(--text-muted)] block">{s.name}</span>
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>

              <Button type="submit" disabled={saving || !selectedTool || !selectedVendor} className="w-full">
                {saving ? "Saving…" : "Save Mapping"}
              </Button>
            </form>
          </div>
        </div>
      )}
    </SimpleMasterShell>
  );
}
