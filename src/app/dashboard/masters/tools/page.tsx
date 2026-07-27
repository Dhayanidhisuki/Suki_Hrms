"use client";

import { useState, useEffect, useCallback } from "react";
import { Plus, Search, Trash2, ArrowLeft, Trash, Save, HelpCircle, CheckCircle2 } from "lucide-react";
import Sidebar from "@/app/dashboard/components/Sidebar";
import TopBar from "@/app/dashboard/components/TopBar";
import RoleGate from "@/app/dashboard/components/RoleGate";
import { TableSkeleton } from "@/app/dashboard/components/LoadingSkeleton";
import { apiGet, apiPost, apiPut, apiDelete } from "@/lib/apiClient";
import { Button } from "@/components/ui/button";

type ToolStatus = "Available" | "Issued" | "Under Calibration" | "Under Repair" | "Scrapped";

interface GaugeAndTool {
  refNo: number;
  toolOrGaugeNo: string;
  name: string;
  description: string | null;
  size: string | null;
  shape: string | null;
  grouping: string;
  type: string | null;
  serialNoGenReq: string | null;
  totQty: number;
  qtyIn: number;
  qtyOut: number;
  qtyNew: number;
  location: string | null;
  status: string;
  calibrationFrqMonths: number | null;
  supCode: string | null;
  serialNumbers?: { refNo: number; serialNo: number; status: string | null }[];
}

interface ToolsGroup {
  rowId: number;
  code: string;
  name: string;
  prefixToolsNo: string | null;
}

interface ToolsSubgroup {
  rowId: number;
  code: string;
  name: string;
  refGroupId: number;
  group?: { name: string } | null;
}

const statusConfig: Record<string, { bg: string; text: string; dot: string }> = {
  Available: { bg: "bg-[var(--color-success-bg)] border border-[var(--border-main)]", text: "text-[var(--color-success-text)]", dot: "bg-emerald-500" },
  Issued: { bg: "bg-[var(--primary-light)] border border-[var(--border-main)]", text: "text-[var(--primary)]", dot: "bg-[var(--primary)]" },
  "Under Calibration": { bg: "bg-[var(--color-warning-bg)] border border-[var(--border-main)]", text: "text-[var(--color-warning-text)]", dot: "bg-amber-500" },
  "Under Repair": { bg: "bg-[var(--color-danger-bg)] border border-[var(--border-main)]", text: "text-[var(--color-danger-text)]", dot: "bg-red-500" },
  Scrapped: { bg: "bg-[var(--bg-subtle)] border border-[var(--border-main)]", text: "text-[var(--text-muted)]", dot: "bg-slate-400" },
};

interface ToolSpec {
  name: string;
  value: string;
  unit: string;
}

export default function ToolsMasterPage() {
  const [tools, setTools] = useState<GaugeAndTool[]>([]);
  const [toolsGroups, setToolsGroups] = useState<ToolsGroup[]>([]);
  const [toolsSubgroups, setToolsSubgroups] = useState<ToolsSubgroup[]>([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState("");
  const [groupFilter, setGroupFilter] = useState("All");
  const [statusFilter, setStatusFilter] = useState("All");

  // View state: "list" | "create" | "edit" | "view"
  const [viewState, setViewState] = useState<"list" | "create" | "edit">("list");
  const [selectedTool, setSelectedTool] = useState<GaugeAndTool | null>(null);

  // Success Banner
  const [successMessage, setSuccessBanner] = useState("");
  const [bannerMsg, setBannerMsg] = useState<{ type: "success" | "error"; text: string } | null>(null);

  const loadTools = useCallback(async () => {
    setLoading(true);
    const params = new URLSearchParams();
    if (query) params.set("search", query);
    if (groupFilter !== "All") params.set("grouping", groupFilter);
    if (statusFilter !== "All") params.set("status", statusFilter);
    const res = await apiGet<{ items: GaugeAndTool[] }>(`/api/tools?${params}`);
    if (res.data?.items) setTools(res.data.items);
    setLoading(false);
  }, [query, groupFilter, statusFilter]);

  const loadLookups = useCallback(async () => {
    const [gr, sg] = await Promise.all([
      apiGet<{ items: ToolsGroup[] }>("/api/lookups/groups"),
      apiGet<{ items: ToolsSubgroup[] }>("/api/lookups/subgroups"),
    ]);
    if (gr.data?.items) setToolsGroups(gr.data.items);
    if (sg.data?.items) setToolsSubgroups(sg.data.items);
  }, []);

  useEffect(() => {
    loadTools();
  }, [loadTools]);

  useEffect(() => {
    loadLookups();
  }, [loadLookups]);

  // Tabs for Detail View
  const [activeTab, setActiveTab] = useState<"general" | "stock" | "calibration" | "specs" | "price">("general");

  // Form Fields
  const [toolOrGaugeNo, setToolOrGaugeNo] = useState("");
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [size, setSize] = useState("");
  const [shape, setShape] = useState("");
  const [grouping, setGrouping] = useState("");
  const [type, setType] = useState("");
  const [serialNoGenReq, setSerialNoGenReq] = useState(false);
  const [totQty, setTotQty] = useState(1);
  const [qtyIn, setQtyIn] = useState(1);
  const [qtyOut, setQtyOut] = useState(0);
  const [qtyNew, setQtyNew] = useState(0);
  const [location, setLocation] = useState("");
  const [status, setStatus] = useState<ToolStatus>("Available");
  const [calibrationFrqMonths, setCalibrationFrqMonths] = useState(12);

  // Sub-table specifications list
  const [specs, setSpecs] = useState<ToolSpec[]>([]);

  // Serial list preview
  const [serialPreview, setSerialPreview] = useState<string[]>([]);
  const [showSerialPreview, setShowSerialPreview] = useState(false);

  // Field validation errors
  const [errors, setErrors] = useState<Record<string, string>>({});

  // Prefix auto-generation on Grouping selection
  useEffect(() => {
    if (viewState === "create" && grouping) {
      const matchedGroup = toolsGroups.find((g) => g.name === grouping);
      if (matchedGroup) {
        setToolOrGaugeNo(`${matchedGroup.prefixToolsNo ?? ""}-`);
      }
    }
  }, [grouping, viewState, toolsGroups]);

  const handleRowClick = (tool: GaugeAndTool) => {
    setSelectedTool(tool);
    setToolOrGaugeNo(tool.toolOrGaugeNo);
    setName(tool.name);
    setDescription(tool.description ?? "");
    setSize(tool.size ?? "");
    setShape(tool.shape ?? "");
    setGrouping(tool.grouping);
    setType(tool.type ?? "");
    setSerialNoGenReq(tool.serialNoGenReq === "Y");
    setTotQty(tool.totQty);
    setQtyIn(tool.qtyIn);
    setQtyOut(tool.qtyOut);
    setQtyNew(tool.qtyNew);
    setLocation(tool.location ?? "");
    setStatus(tool.status as ToolStatus);
    setCalibrationFrqMonths(tool.calibrationFrqMonths ?? 12);
    setSpecs([
      { name: "Accuracy", value: "0.01", unit: "mm" },
      { name: "Measuring Range", value: tool.size ?? "", unit: "" },
    ]);
    setShowSerialPreview(false);
    setErrors({});
    setActiveTab("general");
    setViewState("edit");
  };

  const handleOpenAdd = () => {
    setSelectedTool(null);
    setToolOrGaugeNo("");
    setName("");
    setDescription("");
    setSize("");
    setShape("");
    setGrouping(toolsGroups[0]?.name ?? "");
    setType(toolsSubgroups[0]?.name ?? "");
    setSerialNoGenReq(false);
    setTotQty(1);
    setQtyIn(1);
    setQtyOut(0);
    setQtyNew(0);
    setLocation("");
    setStatus("Available");
    setCalibrationFrqMonths(12);
    setSpecs([
      { name: "Accuracy", value: "0.01", unit: "mm" },
    ]);
    setShowSerialPreview(false);
    setErrors({});
    setActiveTab("general");
    setViewState("create");
  };

  const handlePreviewSerials = () => {
    if (!toolOrGaugeNo.trim()) return;
    const list = [];
    for (let i = 1; i <= totQty; i++) {
      list.push(`${toolOrGaugeNo}-${String(i).padStart(3, "0")}`);
    }
    setSerialPreview(list);
    setShowSerialPreview(true);
  };

  const handleAddSpec = () => {
    setSpecs([...specs, { name: "", value: "", unit: "" }]);
  };

  const handleDeleteSpec = (index: number) => {
    const list = [...specs];
    list.splice(index, 1);
    setSpecs(list);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    const fErrors: Record<string, string> = {};

    if (!toolOrGaugeNo.trim()) fErrors.toolOrGaugeNo = "Tool Number is required";
    if (!name.trim()) fErrors.name = "Name is required";
    if (totQty <= 0) fErrors.totQty = "Quantity must be greater than 0";

    if (Object.keys(fErrors).length > 0) {
      setErrors(fErrors);
      return;
    }

    const payload: Record<string, unknown> = {
      toolOrGaugeNo,
      name,
      description: description || undefined,
      size: size || undefined,
      shape: shape || undefined,
      grouping,
      type: type || undefined,
      serialNoGenReq,
      totQty,
      qtyIn: viewState === "create" ? totQty : qtyIn,
      location: location || undefined,
      status,
      calibrationFrqMonths,
      specifications: specs.map((s) => ({
        specName: s.name,
        specValue: s.value || undefined,
        unit: s.unit || undefined,
      })),
    };

    setBannerMsg(null);
    const res = selectedTool
      ? await apiPut<{ tool: GaugeAndTool }>(`/api/tools/${selectedTool.refNo}`, payload)
      : await apiPost<{ tool: GaugeAndTool }>("/api/tools", payload);

    if (res.error) {
      setBannerMsg({ type: "error", text: res.error.message });
      return;
    }

    setSuccessBanner("Tool saved successfully.");
    setTimeout(() => setSuccessBanner(""), 3000);
    setViewState("list");
    loadTools();
  };

  const handleDeleteTool = async (refNo: number) => {
    if (!confirm("Are you sure you want to delete this tool from GAUGEANDTOOLS?")) return;
    const res = await apiDelete(`/api/tools/${refNo}`);
    if (res.error) {
      setBannerMsg({ type: "error", text: res.error.message });
      return;
    }
    setBannerMsg({ type: "success", text: "Tool deleted." });
    loadTools();
  };

  // Filter tools
  const filtered = tools.filter((t) => {
    const matchesQuery =
      t.name.toLowerCase().includes(query.toLowerCase()) ||
      t.toolOrGaugeNo.toLowerCase().includes(query.toLowerCase()) ||
      t.grouping.toLowerCase().includes(query.toLowerCase());

    const matchesGroup = groupFilter === "All" || t.grouping === groupFilter;
    const matchesStatus = statusFilter === "All" || t.status === statusFilter;

    return matchesQuery && matchesGroup && matchesStatus;
  });

  return (
    <div className="flex h-screen bg-[var(--bg-app)] text-[var(--text-primary)] overflow-hidden">
      <Sidebar />
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        <TopBar />
        <main className="flex-1 overflow-y-auto px-7 py-6">
          {successMessage && (
            <div className="mb-4 p-4 bg-emerald-50 border border-emerald-200 rounded-2xl flex items-center gap-2.5 text-emerald-800 text-sm font-semibold shadow-sm animate-fade-in">
              <CheckCircle2 className="w-5 h-5 text-emerald-500" />
              <span>{successMessage}</span>
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

          {viewState === "list" ? (
            <>
              {/* ── Header ── */}
              <div className="flex items-center justify-between mb-6">
                <div>
                  <h1 className="text-2xl font-bold text-[var(--text-primary)] tracking-tight">
                    Tools Master
                  </h1>
                  <p className="text-sm text-[var(--text-muted)] mt-0.5">
                    Register and manage tools/gauges (GAUGEANDTOOLS)
                  </p>
                </div>
                <RoleGate permission="canEditMaster">
                  <Button
                    id="tools-add-btn"
                    onClick={handleOpenAdd}
                    variant="primary"
                    className="group"
                  >
                    <Plus className="w-4 h-4 transition-transform group-hover:rotate-90 duration-200" />
                    Add Tool
                  </Button>
                </RoleGate>
              </div>

              {/* ── Filters Card ── */}
              <div className="bg-[var(--bg-card)] rounded-2xl border border-[var(--border-main)] p-5 mb-6">
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                  <div className="relative flex-1 max-w-sm">
                    <Search className="w-4 h-4 text-[var(--text-muted)] absolute left-3 top-1/2 -translate-y-1/2" />
                    <input
                      id="tools-search-input"
                      value={query}
                      onChange={(e) => setQuery(e.target.value)}
                      placeholder="Search tool name, number, or group…"
                      className="w-full text-sm border border-[var(--border-main)] rounded-lg pl-9 pr-3 py-2 outline-none focus:ring-2 focus:ring-[var(--primary-subtle)] focus:border-[var(--primary)] transition-all bg-[var(--bg-subtle)] text-[var(--text-primary)] placeholder-[var(--text-muted)]"
                    />
                  </div>

                  <div className="flex flex-wrap items-center gap-3">
                    {/* Grouping Select Filter */}
                    <div>
                      <select
                        id="tools-group-filter"
                        value={groupFilter}
                        onChange={(e) => setGroupFilter(e.target.value)}
                        className="text-sm border border-[var(--border-main)] rounded-lg px-3 py-2 bg-[var(--bg-subtle)] outline-none focus:ring-2 focus:ring-[var(--primary-subtle)] focus:border-[var(--primary)] font-medium text-[var(--text-primary)]"
                      >
                        <option value="All">All Groups</option>
                        {toolsGroups.map((g) => (
                          <option key={g.rowId} value={g.name}>
                            {g.name}
                          </option>
                        ))}
                      </select>
                    </div>

                    {/* Status Select Filter */}
                    <div>
                      <select
                        id="tools-status-filter"
                        value={statusFilter}
                        onChange={(e) => setStatusFilter(e.target.value)}
                        className="text-sm border border-[var(--border-main)] rounded-lg px-3 py-2 bg-[var(--bg-subtle)] outline-none focus:ring-2 focus:ring-[var(--primary-subtle)] focus:border-[var(--primary)] font-medium text-[var(--text-primary)]"
                      >
                        <option value="All">All Statuses</option>
                        <option value="Available">Available</option>
                        <option value="Issued">Issued</option>
                        <option value="Under Calibration">Under Calibration</option>
                        <option value="Under Repair">Under Repair</option>
                        <option value="Scrapped">Scrapped</option>
                      </select>
                    </div>
                  </div>
                </div>
              </div>

              {/* ── Table Card ── */}
              <div className="bg-[var(--bg-card)] rounded-2xl border border-[var(--border-main)] p-5 animate-fade-in">
                {loading ? (
                  <TableSkeleton rows={6} />
                ) : (
                <div className="overflow-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-[var(--border-main)] bg-[var(--bg-subtle)]">
                        {[
                          "Tool/Gauge No",
                          "Name",
                          "Group / Type",
                          "Qty In / Out",
                          "Status",
                          "Actions",
                        ].map((col) => (
                          <th
                            key={col}
                            className="text-left text-[11px] font-semibold text-[var(--text-muted)] uppercase tracking-wider py-2.5 px-3 last:pr-0"
                          >
                            {col}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[var(--border-main)]">
                      {filtered.map((t) => {
                        const sc = statusConfig[t.status] ?? statusConfig["Available"];
                        return (
                          <tr
                            key={t.refNo}
                            onClick={() => handleRowClick(t)}
                            className="hover:bg-[var(--bg-hover)] cursor-pointer transition-colors group"
                          >
                            <td className="py-3.5 px-3 font-mono text-xs text-[var(--text-secondary)] font-semibold">
                              {t.toolOrGaugeNo}
                            </td>
                            <td className="py-3.5 px-3">
                              <p className="font-semibold text-[var(--text-primary)] group-hover:text-[var(--primary)] transition-colors">
                                {t.name}
                              </p>
                              <p className="text-[11px] text-[var(--text-muted)] line-clamp-1">{t.description}</p>
                            </td>
                            <td className="py-3.5 px-3 text-[var(--text-secondary)]">
                              {t.grouping} <span className="text-[var(--text-muted)]">/</span> {t.type}
                            </td>
                            <td className="py-3.5 px-3 font-mono text-xs text-[var(--text-secondary)]">
                              {t.qtyIn} / {t.qtyOut} <span className="text-[var(--text-muted)]">({t.totQty})</span>
                            </td>
                            <td className="py-3.5 px-3">
                              <span
                                className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold ${sc.bg} ${sc.text}`}
                              >
                                <span className={`w-1.5 h-1.5 rounded-full ${sc.dot}`} />
                                {t.status}
                              </span>
                            </td>
                            <td className="py-3.5 px-3" onClick={(e) => e.stopPropagation()}>
                              <RoleGate permission="canEditMaster">
                                <button
                                  onClick={() => handleDeleteTool(t.refNo)}
                                  className="p-1.5 hover:bg-[var(--color-danger-bg)] rounded-lg text-[var(--text-muted)] hover:text-[var(--color-danger-text)] transition-colors"
                                  title="Delete Tool"
                                >
                                  <Trash2 className="w-4 h-4" />
                                </button>
                              </RoleGate>
                            </td>
                          </tr>
                        );
                      })}
                      {filtered.length === 0 && (
                        <tr>
                          <td colSpan={6} className="py-8 text-center text-sm text-[var(--text-muted)]">
                            No tools found in registry.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
                )}
                <div className="mt-4 pt-3 border-t border-[var(--border-main)]">
                  <span className="text-xs text-[var(--text-muted)] font-medium">
                    Showing {filtered.length} of {tools.length} tool records
                  </span>
                </div>
              </div>
            </>
          ) : (
            /* ── DETAIL VIEW ── */
            <div className="animate-fade-in max-w-4xl">
              {/* Breadcrumb back */}
              <button
                onClick={() => setViewState("list")}
                className="inline-flex items-center gap-1 text-xs font-bold text-[var(--text-muted)] hover:text-[var(--text-primary)] uppercase tracking-widest mb-4 transition-colors"
              >
                <ArrowLeft className="w-4 h-4" /> Back to registry list
              </button>

              <div className="flex items-center justify-between mb-5">
                <div>
                  <h1 className="text-2xl font-bold text-[var(--text-primary)] tracking-tight">
                    {viewState === "create" ? "New Tool" : name}
                  </h1>
                  <p className="text-sm text-[var(--text-muted)] mt-0.5">
                    {viewState === "create"
                      ? "Register a new tool or gauge record"
                      : `Editing registry details of ${toolOrGaugeNo}`}
                  </p>
                </div>
              </div>

              {/* 5 Tab Navigation bar */}
              <div className="flex items-center border-b border-[var(--border-main)] mb-6 overflow-x-auto gap-2">
                {[
                  { id: "general", label: "General Info" },
                  { id: "stock", label: "Stock & Quantities" },
                  { id: "calibration", label: "Calibration" },
                  { id: "specs", label: "Specifications" },
                  { id: "price", label: "Price History" },
                ].map((tb) => (
                  <button
                    key={tb.id}
                    onClick={() => setActiveTab(tb.id as any)}
                    className={`pb-3 px-4 text-sm font-semibold transition-all border-b-2 -mb-[2px] whitespace-nowrap ${
                      activeTab === tb.id
                        ? "border-[var(--primary)] text-[var(--primary)]"
                        : "border-transparent text-[var(--text-muted)] hover:text-[var(--text-primary)]"
                    }`}
                  >
                    {tb.label}
                  </button>
                ))}
              </div>

              {/* Tab Form Wrapper */}
              <form onSubmit={handleSave} className="space-y-6">
                {/* ── TAB 1: General Info ── */}
                {activeTab === "general" && (
                  <div className="bg-[var(--bg-card)] rounded-2xl border border-[var(--border-main)] p-6 space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-xs font-semibold text-[var(--text-muted)] uppercase tracking-wider mb-1">
                          Tool / Gauge Number *
                        </label>
                        <input
                          id="form-tool-no"
                          value={toolOrGaugeNo}
                          onChange={(e) => setToolOrGaugeNo(e.target.value.toUpperCase())}
                          placeholder="e.g. TL-MIC-001"
                          disabled={viewState === "edit"}
                          className="w-full text-sm border border-[var(--border-main)] rounded-lg px-3 py-2 outline-none focus:ring-2 focus:ring-[var(--primary-subtle)] focus:border-[var(--primary)] bg-[var(--bg-subtle)] font-mono uppercase font-semibold text-[var(--text-primary)] placeholder-[var(--text-muted)] disabled:bg-[var(--bg-hover)] disabled:text-[var(--text-muted)]"
                        />
                        {errors.toolOrGaugeNo && <p className="text-[var(--color-danger-text)] text-xs mt-1 font-semibold">{errors.toolOrGaugeNo}</p>}
                      </div>
                      <div>
                        <label className="block text-xs font-semibold text-[var(--text-muted)] uppercase tracking-wider mb-1">
                          Name *
                        </label>
                        <input
                          id="form-name"
                          value={name}
                          onChange={(e) => setName(e.target.value)}
                          placeholder="e.g. Outside Micrometer 0-25mm"
                          className="w-full text-sm border border-[var(--border-main)] rounded-lg px-3 py-2 outline-none focus:ring-2 focus:ring-[var(--primary-subtle)] focus:border-[var(--primary)] bg-[var(--bg-subtle)] text-[var(--text-primary)] placeholder-[var(--text-muted)] font-medium"
                        />
                        {errors.name && <p className="text-[var(--color-danger-text)] text-xs mt-1 font-semibold">{errors.name}</p>}
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-xs font-semibold text-[var(--text-muted)] uppercase tracking-wider mb-1">
                          Group
                        </label>
                        <select
                          id="form-grouping"
                          value={grouping}
                          onChange={(e) => setGrouping(e.target.value)}
                          className="w-full text-sm border border-[var(--border-main)] rounded-lg px-3 py-2 bg-[var(--bg-subtle)] outline-none focus:ring-2 focus:ring-[var(--primary-subtle)] focus:border-[var(--primary)] font-medium text-[var(--text-primary)]"
                        >
                          {toolsGroups.map((g) => (
                            <option key={g.rowId} value={g.name}>
                              {g.name}
                            </option>
                          ))}
                        </select>
                      </div>
                      <div>
                        <label className="block text-xs font-semibold text-[var(--text-muted)] uppercase tracking-wider mb-1">
                          Type / Subgroup
                        </label>
                        <select
                          id="form-type"
                          value={type}
                          onChange={(e) => setType(e.target.value)}
                          className="w-full text-sm border border-[var(--border-main)] rounded-lg px-3 py-2 bg-[var(--bg-subtle)] outline-none focus:ring-2 focus:ring-[var(--primary-subtle)] focus:border-[var(--primary)] font-medium text-[var(--text-primary)]"
                        >
                          {toolsSubgroups.map((sg) => (
                            <option key={sg.rowId} value={sg.name}>
                              {sg.name}
                            </option>
                          ))}
                        </select>
                      </div>
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-[var(--text-muted)] uppercase tracking-wider mb-1">
                        Description
                      </label>
                      <textarea
                        id="form-desc"
                        rows={3}
                        value={description}
                        onChange={(e) => setDescription(e.target.value)}
                        placeholder="Details about standard usage, accuracy specs, etc."
                        className="w-full text-sm border border-[var(--border-main)] rounded-lg px-3 py-2 bg-[var(--bg-subtle)] text-[var(--text-primary)] placeholder-[var(--text-muted)] outline-none focus:ring-2 focus:ring-[var(--primary-subtle)] focus:border-[var(--primary)] resize-none"
                      />
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-xs font-semibold text-[var(--text-muted)] uppercase tracking-wider mb-1">
                          Size / Measuring Range
                        </label>
                        <input
                          id="form-size"
                          value={size}
                          onChange={(e) => setSize(e.target.value)}
                          placeholder="e.g. 0-25mm"
                          className="w-full text-sm border border-[var(--border-main)] rounded-lg px-3 py-2 bg-[var(--bg-subtle)] text-[var(--text-primary)] placeholder-[var(--text-muted)] outline-none focus:ring-2 focus:ring-[var(--primary-subtle)]"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-semibold text-[var(--text-muted)] uppercase tracking-wider mb-1">
                          Shape
                        </label>
                        <input
                          id="form-shape"
                          value={shape}
                          onChange={(e) => setShape(e.target.value)}
                          placeholder="e.g. Cylindrical"
                          className="w-full text-sm border border-[var(--border-main)] rounded-lg px-3 py-2 bg-[var(--bg-subtle)] text-[var(--text-primary)] placeholder-[var(--text-muted)] outline-none focus:ring-2 focus:ring-[var(--primary-subtle)]"
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4 border-t border-[var(--border-main)] pt-4">
                      <div>
                        <label className="block text-xs font-semibold text-[var(--text-muted)] uppercase tracking-wider mb-1">
                          Storage Location Bin
                        </label>
                        <input
                          id="form-location"
                          value={location}
                          onChange={(e) => setLocation(e.target.value)}
                          placeholder="e.g. Tool Crib A"
                          className="w-full text-sm border border-[var(--border-main)] rounded-lg px-3 py-2 bg-[var(--bg-subtle)] text-[var(--text-primary)] placeholder-[var(--text-muted)] outline-none focus:ring-2 focus:ring-[var(--primary-subtle)]"
                        />
                      </div>
                    </div>
                  </div>
                )}

                {/* ── TAB 2: Stock & Quantities ── */}
                {activeTab === "stock" && (
                  <div className="bg-[var(--bg-card)] rounded-2xl border border-[var(--border-main)] p-6 space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-xs font-semibold text-[var(--text-muted)] uppercase tracking-wider mb-1">
                          Total Registered Qty *
                        </label>
                        <input
                          id="form-tot-qty"
                          type="number"
                          min={1}
                          value={totQty}
                          onChange={(e) => {
                            const val = Number(e.target.value);
                            setTotQty(val);
                            if (viewState === "create") {
                              setQtyIn(val);
                            }
                          }}
                          className="w-full text-sm border border-[var(--border-main)] rounded-lg px-3 py-2 bg-[var(--bg-subtle)] text-[var(--text-primary)] outline-none focus:ring-2 focus:ring-[var(--primary-subtle)] focus:border-[var(--primary)] font-mono font-semibold"
                        />
                        {errors.totQty && <p className="text-[var(--color-danger-text)] text-xs mt-1 font-semibold">{errors.totQty}</p>}
                      </div>
                      <div>
                        <label className="block text-xs font-semibold text-[var(--text-muted)] uppercase tracking-wider mb-1">
                          Tool Status
                        </label>
                        <select
                          id="form-status"
                          value={status}
                          onChange={(e) => setStatus(e.target.value as ToolStatus)}
                          className="w-full text-sm border border-[var(--border-main)] rounded-lg px-3 py-2 bg-[var(--bg-subtle)] outline-none focus:ring-2 focus:ring-[var(--primary-subtle)] font-medium text-[var(--text-primary)]"
                        >
                          <option value="Available">Available</option>
                          <option value="Issued">Issued</option>
                          <option value="Under Calibration">Under Calibration</option>
                          <option value="Under Repair">Under Repair</option>
                          <option value="Scrapped">Scrapped</option>
                        </select>
                      </div>
                    </div>

                    <div className="grid grid-cols-3 gap-4 border-t border-[var(--border-main)] pt-4 bg-[var(--bg-subtle)] p-4 rounded-xl">
                      <div>
                        <label className="block text-xs font-semibold text-[var(--text-muted)] uppercase tracking-wider mb-0.5">
                          Quantity In Store
                        </label>
                        <p className="text-lg font-bold text-[var(--text-primary)] font-mono">{qtyIn}</p>
                      </div>
                      <div>
                        <label className="block text-xs font-semibold text-[var(--text-muted)] uppercase tracking-wider mb-0.5">
                          Quantity Issued Out
                        </label>
                        <p className="text-lg font-bold text-[var(--text-primary)] font-mono">{qtyOut}</p>
                      </div>
                      <div>
                        <label className="block text-xs font-semibold text-[var(--text-muted)] uppercase tracking-wider mb-0.5">
                          New Stock (GRN)
                        </label>
                        <p className="text-lg font-bold text-[var(--text-primary)] font-mono">{qtyNew}</p>
                      </div>
                    </div>

                    <p className="text-xs text-[var(--text-muted)] flex items-center gap-1.5 leading-relaxed">
                      <HelpCircle className="w-4 h-4 text-[var(--text-muted)]" />
                      <span>
                        <strong>Note:</strong> QTY_IN, QTY_OUT and QTY_NEW are updated automatically on Issue, Receive, and GRN transactions.
                      </span>
                    </p>

                    {/* Serial Generation Option */}
                    <div className="border-t border-[var(--border-main)] pt-4 space-y-4">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="text-sm font-semibold text-[var(--text-primary)]">Generate Unique Serials</p>
                          <p className="text-xs text-[var(--text-muted)] mt-0.5">Auto-generates rows in GAUGE_SERIAL_NO for item tracking</p>
                        </div>
                        <input
                          type="checkbox"
                          id="form-serial-req"
                          checked={serialNoGenReq}
                          onChange={(e) => setSerialNoGenReq(e.target.checked)}
                          className="w-5 h-5 text-[var(--primary)] border-[var(--border-main)] rounded focus:ring-[var(--primary)]"
                        />
                      </div>

                      {serialNoGenReq && (
                        <div className="space-y-3">
                          <div className="p-3 bg-[var(--color-warning-bg)] border border-[var(--border-main)] rounded-xl text-xs text-[var(--color-warning-text)]">
                            <strong>System Notice:</strong> The ERP will automatically register <strong>{totQty}</strong> unique serials in GAUGE_SERIAL_NO on saving.
                          </div>
                          <button
                            type="button"
                            onClick={handlePreviewSerials}
                            className="text-xs font-bold text-[var(--primary)] hover:underline flex items-center gap-1"
                          >
                            Preview Serial Numbers →
                          </button>

                          {showSerialPreview && (
                            <div className="p-3 bg-[var(--bg-subtle)] border border-[var(--border-main)] rounded-xl max-h-36 overflow-y-auto font-mono text-xs text-[var(--text-secondary)] space-y-1">
                              {serialPreview.map((s, i) => (
                                <p key={i}>{s}</p>
                              ))}
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {/* ── TAB 3: Calibration ── */}
                {activeTab === "calibration" && (
                  <div className="bg-[var(--bg-card)] rounded-2xl border border-[var(--border-main)] p-6 space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-xs font-semibold text-[var(--text-muted)] uppercase tracking-wider mb-1">
                          Calibration Frequency (Months)
                        </label>
                        <input
                          id="form-frequency"
                          type="number"
                          min={1}
                          value={calibrationFrqMonths}
                          onChange={(e) => setCalibrationFrqMonths(Number(e.target.value))}
                          className="w-full text-sm border border-[var(--border-main)] rounded-lg px-3 py-2 bg-[var(--bg-subtle)] text-[var(--text-primary)] outline-none focus:ring-2 focus:ring-[var(--primary-subtle)] font-mono"
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4 border-t border-[var(--border-main)] pt-4">
                      <div>
                        <label className="block text-xs font-semibold text-[var(--text-muted)] uppercase tracking-wider mb-1">
                          Calibration Frequency (Months)
                        </label>
                        <p className="text-sm text-[var(--text-muted)]">
                          Calibration tracking is managed through the Calibration module.
                        </p>
                      </div>
                    </div>
                  </div>
                )}

                {/* ── TAB 4: Specifications ── */}
                {activeTab === "specs" && (
                  <div className="bg-[var(--bg-card)] rounded-2xl border border-[var(--border-main)] p-6 space-y-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm font-semibold text-[var(--text-primary)] font-sans">Measurement Parameters</p>
                        <p className="text-xs text-[var(--text-muted)] mt-0.5">Parameters stored under TOOLS_SPECIFICATION</p>
                      </div>
                      <button
                        type="button"
                        id="add-spec-row-btn"
                        onClick={handleAddSpec}
                        className="text-xs font-bold text-[var(--primary)] flex items-center gap-1 hover:underline"
                      >
                        <Plus className="w-4 h-4" /> Add Parameter
                      </button>
                    </div>

                    <div className="overflow-auto border border-[var(--border-main)] rounded-xl">
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="border-b border-[var(--border-main)] bg-[var(--bg-subtle)]">
                            {["Specification Parameter Name", "Standard Value", "Unit of Measure", ""].map((col) => (
                              <th key={col} className="text-left text-[11px] font-bold text-[var(--text-muted)] uppercase tracking-wider py-2.5 px-4">
                                {col}
                              </th>
                            ))}
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-[var(--border-main)]">
                          {specs.map((item, index) => (
                            <tr key={index}>
                              <td className="py-2.5 px-3">
                                <input
                                  value={item.name}
                                  onChange={(e) => {
                                    const list = [...specs];
                                    list[index].name = e.target.value;
                                    setSpecs(list);
                                  }}
                                  placeholder="e.g. Accuracy / Range"
                                  className="w-full text-sm border border-[var(--border-main)] rounded-lg px-3 py-1.5 bg-[var(--bg-subtle)] text-[var(--text-primary)] placeholder-[var(--text-muted)] outline-none focus:ring-2 focus:ring-[var(--primary-subtle)]"
                                />
                              </td>
                              <td className="py-2.5 px-3">
                                <input
                                  value={item.value}
                                  onChange={(e) => {
                                    const list = [...specs];
                                    list[index].value = e.target.value;
                                    setSpecs(list);
                                  }}
                                  placeholder="Value"
                                  className="w-full text-sm border border-[var(--border-main)] rounded-lg px-3 py-1.5 bg-[var(--bg-subtle)] text-[var(--text-primary)] placeholder-[var(--text-muted)] outline-none focus:ring-2 focus:ring-[var(--primary-subtle)]"
                                />
                              </td>
                              <td className="py-2.5 px-3">
                                <input
                                  value={item.unit}
                                  onChange={(e) => {
                                    const list = [...specs];
                                    list[index].unit = e.target.value;
                                    setSpecs(list);
                                  }}
                                  placeholder="UoM"
                                  className="w-full text-sm border border-[var(--border-main)] rounded-lg px-3 py-1.5 bg-[var(--bg-subtle)] text-[var(--text-primary)] placeholder-[var(--text-muted)] outline-none focus:ring-2 focus:ring-[var(--primary-subtle)]"
                                />
                              </td>
                              <td className="py-2.5 px-3">
                                <button
                                  type="button"
                                  onClick={() => handleDeleteSpec(index)}
                                  className="p-1 hover:bg-[var(--color-danger-bg)] rounded-lg text-[var(--text-muted)] hover:text-[var(--color-danger-text)] transition-colors"
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
                )}

                {/* ── TAB 5: Price History ── */}
                {activeTab === "price" && (
                  <div className="bg-[var(--bg-card)] rounded-2xl border border-[var(--border-main)] p-6 space-y-4">
                    <div>
                      <p className="text-sm font-semibold text-[var(--text-primary)] font-sans">PO Sourcing Log</p>
                      <p className="text-xs text-[var(--text-muted)] mt-0.5">Historically tracked rates captured from TOOLS_PRICE_MASTER & GRNs</p>
                    </div>

                    <div className="overflow-auto border border-[var(--border-main)] rounded-xl">
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="border-b border-[var(--border-main)] bg-[var(--bg-subtle)]">
                            {["Date", "Sourced Supplier", "GRN / Source Doc", "Sourcing Unit Rate (₹)"].map((col) => (
                              <th key={col} className="text-left text-[11px] font-bold text-[var(--text-muted)] uppercase tracking-wider py-2.5 px-4">
                                {col}
                              </th>
                            ))}
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-[var(--border-main)]">
                          <tr>
                            <td colSpan={4} className="py-8 text-center text-xs text-[var(--text-muted)] font-medium">
                              No purchase or receipt transaction history found for this tool record.
                            </td>
                          </tr>
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}

                {/* Footer submit and cancel buttons */}
                <div className="flex items-center justify-end gap-3 sticky bottom-0 bg-[var(--bg-app)] py-4 border-t border-[var(--border-main)]">
                  <button
                    type="button"
                    onClick={() => setViewState("list")}
                    className="px-5 py-2.5 text-sm font-semibold text-[var(--text-muted)] hover:text-[var(--text-primary)] rounded-xl hover:bg-[var(--bg-hover)] transition-all"
                  >
                    Cancel
                  </button>
                  <Button
                    type="submit"
                    id="tool-save-btn"
                    variant="primary"
                    size="lg"
                  >
                    <Save className="w-4 h-4" /> Save Record
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
