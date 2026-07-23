"use client";

import { useState, useEffect, useCallback } from "react";
import { Plus, Search, Trash2, ShieldAlert, ArrowLeft, Trash, Save, HelpCircle, CheckCircle2 } from "lucide-react";
import Sidebar from "@/app/dashboard/components/Sidebar";
import TopBar from "@/app/dashboard/components/TopBar";
import RoleGate from "@/app/dashboard/components/RoleGate";
import { TableSkeleton } from "@/app/dashboard/components/LoadingSkeleton";
import { apiGet, apiPost, apiPut, apiDelete } from "@/lib/apiClient";

type ToolStatus = "Available" | "Issued" | "Under Calibration" | "Under Repair" | "Scrapped";

interface GaugeAndTool {
  id: number;
  toolOrGaugeNo: string;
  name: string;
  description: string | null;
  size: string | null;
  shape: string | null;
  grouping: string;
  type: string | null;
  serialNoGenReq: boolean;
  totQty: number;
  qtyIn: number;
  qtyOut: number;
  qtyNew: number;
  location: string | null;
  deptName: string | null;
  status: string;
  calibrationFrqMonths: number | null;
  caliPlannedWho: string | null;
  lastCalibrationDate: string | null;
  nextCalibrationDate: string | null;
  supCode: string | null;
  serialNumbers?: { id: number; serialNo: string; status: string }[];
}

interface ToolsGroup {
  id: number;
  code: string;
  name: string;
  prefixToolsNo: string | null;
}

interface ToolsSubgroup {
  id: number;
  code: string;
  name: string;
  refGroupId: number;
  group?: { name: string } | null;
}

const statusConfig: Record<string, { bg: string; text: string; dot: string }> = {
  Available: { bg: "bg-emerald-50", text: "text-emerald-700", dot: "bg-emerald-500" },
  Issued: { bg: "bg-blue-50", text: "text-blue-700", dot: "bg-blue-500" },
  "Under Calibration": { bg: "bg-amber-50", text: "text-amber-700", dot: "bg-amber-500" },
  "Under Repair": { bg: "bg-red-50", text: "text-red-700", dot: "bg-red-500" },
  Scrapped: { bg: "bg-slate-100", text: "text-slate-500", dot: "bg-slate-400" },
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
  const [deptName, setDeptName] = useState("");
  const [status, setStatus] = useState<ToolStatus>("Available");
  const [calibrationFrqMonths, setCalibrationFrqMonths] = useState(12);
  const [caliPlannedWho, setCaliPlannedWho] = useState("");
  const [lastCalibrationDate, setLastCalibrationDate] = useState("");
  const [nextCalibrationDate, setNextCalibrationDate] = useState("");

  // Sub-table specifications list
  const [specs, setSpecs] = useState<ToolSpec[]>([]);

  // Serial list preview
  const [serialPreview, setSerialPreview] = useState<string[]>([]);
  const [showSerialPreview, setShowSerialPreview] = useState(false);

  // Field validation errors
  const [errors, setErrors] = useState<Record<string, string>>({});

  // Auto-calculation of next calibration date
  useEffect(() => {
    if (lastCalibrationDate) {
      const last = new Date(lastCalibrationDate);
      last.setMonth(last.getMonth() + Number(calibrationFrqMonths));
      setNextCalibrationDate(last.toISOString().split("T")[0]);
    } else {
      setNextCalibrationDate("");
    }
  }, [lastCalibrationDate, calibrationFrqMonths]);

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
    setSerialNoGenReq(tool.serialNoGenReq);
    setTotQty(tool.totQty);
    setQtyIn(tool.qtyIn);
    setQtyOut(tool.qtyOut);
    setQtyNew(tool.qtyNew);
    setLocation(tool.location ?? "");
    setDeptName(tool.deptName ?? "");
    setStatus(tool.status as ToolStatus);
    setCalibrationFrqMonths(tool.calibrationFrqMonths ?? 12);
    setCaliPlannedWho(tool.caliPlannedWho ?? "");
    setLastCalibrationDate(tool.lastCalibrationDate ? tool.lastCalibrationDate.split("T")[0] : "");
    setNextCalibrationDate(tool.nextCalibrationDate ? tool.nextCalibrationDate.split("T")[0] : "");
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
    setDeptName("");
    setStatus("Available");
    setCalibrationFrqMonths(12);
    setCaliPlannedWho("");
    setLastCalibrationDate("");
    setNextCalibrationDate("");
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
      deptName: deptName || undefined,
      status,
      calibrationFrqMonths,
      caliPlannedWho: caliPlannedWho || undefined,
      specifications: specs.map((s) => ({
        specName: s.name,
        specValue: s.value || undefined,
        unit: s.unit || undefined,
      })),
    };

    setBannerMsg(null);
    const res = selectedTool
      ? await apiPut<{ tool: GaugeAndTool }>(`/api/tools/${selectedTool.id}`, payload)
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

  const handleDeleteTool = async (id: number) => {
    if (!confirm("Are you sure you want to delete this tool from GAUGEANDTOOLS?")) return;
    const res = await apiDelete(`/api/tools/${id}`);
    if (res.error) {
      setBannerMsg({ type: "error", text: res.error.message });
      return;
    }
    setBannerMsg({ type: "success", text: "Tool deleted." });
    loadTools();
  };

  const isCalibrationOverdue = (nextCalStr: string | null) => {
    if (!nextCalStr) return false;
    const nextCal = new Date(nextCalStr);
    const today = new Date("2026-07-22");
    return nextCal < today;
  };

  const getOverdueDays = (nextCalStr: string | null) => {
    if (!nextCalStr) return 0;
    const nextCal = new Date(nextCalStr);
    const today = new Date("2026-07-22");
    const diff = today.getTime() - nextCal.getTime();
    return Math.floor(diff / (1000 * 60 * 60 * 24));
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
    <div className="flex h-screen bg-slate-50 overflow-hidden">
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
                  <h1 className="text-2xl font-bold text-slate-900 tracking-tight">
                    Tools Master
                  </h1>
                  <p className="text-sm text-slate-500 mt-0.5">
                    Register and manage tools/gauges (GAUGEANDTOOLS)
                  </p>
                </div>
                <RoleGate permission="canEditMaster">
                  <button
                    id="tools-add-btn"
                    onClick={handleOpenAdd}
                    className="flex items-center gap-2 px-4 py-2.5 bg-blue-600 hover:bg-blue-700 active:bg-blue-800 text-white text-sm font-semibold rounded-xl shadow-sm hover:shadow-md transition-all duration-150 group"
                  >
                    <Plus className="w-4 h-4 transition-transform group-hover:rotate-90 duration-200" />
                    Add Tool
                  </button>
                </RoleGate>
              </div>

              {/* ── Filters Card ── */}
              <div className="bg-white rounded-2xl border border-slate-200 p-5 mb-6">
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                  <div className="relative flex-1 max-w-sm">
                    <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                    <input
                      id="tools-search-input"
                      value={query}
                      onChange={(e) => setQuery(e.target.value)}
                      placeholder="Search tool name, number, or group…"
                      className="w-full text-sm border border-slate-200 rounded-lg pl-9 pr-3 py-2 outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-400 transition-all bg-slate-50"
                    />
                  </div>

                  <div className="flex flex-wrap items-center gap-3">
                    {/* Grouping Select Filter */}
                    <div>
                      <select
                        id="tools-group-filter"
                        value={groupFilter}
                        onChange={(e) => setGroupFilter(e.target.value)}
                        className="text-sm border border-slate-200 rounded-lg px-3 py-2 bg-slate-50 outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-400 font-medium text-slate-700"
                      >
                        <option value="All">All Groups</option>
                        {toolsGroups.map((g) => (
                          <option key={g.id} value={g.name}>
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
                        className="text-sm border border-slate-200 rounded-lg px-3 py-2 bg-slate-50 outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-400 font-medium text-slate-700"
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
              <div className="bg-white rounded-2xl border border-slate-200 p-5 animate-fade-in">
                {loading ? (
                  <TableSkeleton rows={6} />
                ) : (
                <div className="overflow-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-slate-100">
                        {[
                          "Tool/Gauge No",
                          "Name",
                          "Group / Type",
                          "Qty In / Out",
                          "Next Calibration",
                          "Status",
                          "Actions",
                        ].map((col) => (
                          <th
                            key={col}
                            className="text-left text-[11px] font-semibold text-slate-400 uppercase tracking-wider pb-2.5 pr-4 last:pr-0"
                          >
                            {col}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-50">
                      {filtered.map((t) => {
                        const sc = statusConfig[t.status] ?? statusConfig["Available"];
                        const calOverdue = isCalibrationOverdue(t.nextCalibrationDate);
                        return (
                          <tr
                            key={t.id}
                            onClick={() => handleRowClick(t)}
                            className="hover:bg-slate-50/60 cursor-pointer transition-colors group"
                          >
                            <td className="py-3.5 pr-4 font-mono text-xs text-slate-500 font-semibold">
                              {t.toolOrGaugeNo}
                            </td>
                            <td className="py-3.5 pr-4">
                              <p className="font-semibold text-slate-800 group-hover:text-blue-600 transition-colors">
                                {t.name}
                              </p>
                              <p className="text-[11px] text-slate-400 line-clamp-1">{t.description}</p>
                            </td>
                            <td className="py-3.5 pr-4 text-slate-600">
                              {t.grouping} <span className="text-slate-300">/</span> {t.type}
                            </td>
                            <td className="py-3.5 pr-4 font-mono text-xs text-slate-600">
                              {t.qtyIn} / {t.qtyOut} <span className="text-slate-300">({t.totQty})</span>
                            </td>
                            <td
                              className={`py-3.5 pr-4 font-mono text-xs font-semibold ${
                                calOverdue ? "text-red-600 font-bold" : "text-slate-600"
                              }`}
                            >
                              {t.nextCalibrationDate ? t.nextCalibrationDate.split("T")[0] : "—"}
                              {calOverdue && (
                                <span className="block text-[9px] text-red-500 font-sans tracking-wide uppercase mt-0.5">
                                  Overdue
                                </span>
                              )}
                            </td>
                            <td className="py-3.5 pr-4">
                              <span
                                className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold ${sc.bg} ${sc.text}`}
                              >
                                <span className={`w-1.5 h-1.5 rounded-full ${sc.dot}`} />
                                {t.status}
                              </span>
                            </td>
                            <td className="py-3.5" onClick={(e) => e.stopPropagation()}>
                              <RoleGate permission="canEditMaster">
                                <button
                                  onClick={() => handleDeleteTool(t.id)}
                                  className="p-1.5 hover:bg-red-50 rounded-lg text-slate-400 hover:text-red-600 transition-colors"
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
                          <td colSpan={7} className="py-8 text-center text-sm text-slate-400">
                            No tools found in registry.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
                )}
                <div className="mt-4 pt-3 border-t border-slate-100">
                  <span className="text-xs text-slate-400 font-medium">
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
                className="inline-flex items-center gap-1 text-xs font-bold text-slate-400 hover:text-slate-700 uppercase tracking-widest mb-4 transition-colors"
              >
                <ArrowLeft className="w-4 h-4" /> Back to registry list
              </button>

              <div className="flex items-center justify-between mb-5">
                <div>
                  <h1 className="text-2xl font-bold text-slate-900 tracking-tight">
                    {viewState === "create" ? "New Tool" : name}
                  </h1>
                  <p className="text-sm text-slate-500 mt-0.5">
                    {viewState === "create"
                      ? "Register a new tool or gauge record"
                      : `Editing registry details of ${toolOrGaugeNo}`}
                  </p>
                </div>
              </div>

              {/* Overdue Alert banner in edit mode */}
              {viewState === "edit" && isCalibrationOverdue(nextCalibrationDate) && (
                <div className="mb-5 p-4 bg-red-50 border border-red-200 rounded-2xl flex items-start gap-3 text-red-800 text-sm">
                  <ShieldAlert className="w-5 h-5 text-red-500 shrink-0 mt-0.5" />
                  <div>
                    <span className="font-bold">Calibration Overdue:</span> This precision tool is{" "}
                    <span className="font-mono font-bold">{getOverdueDays(nextCalibrationDate)}</span> days
                    overdue for calibration. Recalibrate immediately before issue to maintain manufacturing quality tolerance.
                  </div>
                </div>
              )}

              {/* 5 Tab Navigation bar */}
              <div className="flex items-center border-b border-slate-200 mb-6 overflow-x-auto gap-2">
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
                        ? "border-blue-600 text-blue-600"
                        : "border-transparent text-slate-400 hover:text-slate-600"
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
                  <div className="bg-white rounded-2xl border border-slate-200 p-6 space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">
                          Tool / Gauge Number *
                        </label>
                        <input
                          id="form-tool-no"
                          value={toolOrGaugeNo}
                          onChange={(e) => setToolOrGaugeNo(e.target.value.toUpperCase())}
                          placeholder="e.g. TL-MIC-001"
                          disabled={viewState === "edit"}
                          className="w-full text-sm border border-slate-200 rounded-lg px-3 py-2 outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-400 bg-slate-50 font-mono uppercase font-semibold disabled:bg-slate-100 disabled:text-slate-400"
                        />
                        {errors.toolOrGaugeNo && <p className="text-red-500 text-xs mt-1 font-semibold">{errors.toolOrGaugeNo}</p>}
                      </div>
                      <div>
                        <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">
                          Name *
                        </label>
                        <input
                          id="form-name"
                          value={name}
                          onChange={(e) => setName(e.target.value)}
                          placeholder="e.g. Outside Micrometer 0-25mm"
                          className="w-full text-sm border border-slate-200 rounded-lg px-3 py-2 outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-400 bg-slate-50 font-medium"
                        />
                        {errors.name && <p className="text-red-500 text-xs mt-1 font-semibold">{errors.name}</p>}
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">
                          Group
                        </label>
                        <select
                          id="form-grouping"
                          value={grouping}
                          onChange={(e) => setGrouping(e.target.value)}
                          className="w-full text-sm border border-slate-200 rounded-lg px-3 py-2 bg-slate-50 outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-400 font-medium text-slate-700"
                        >
                          {toolsGroups.map((g) => (
                            <option key={g.id} value={g.name}>
                              {g.name}
                            </option>
                          ))}
                        </select>
                      </div>
                      <div>
                        <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">
                          Type / Subgroup
                        </label>
                        <select
                          id="form-type"
                          value={type}
                          onChange={(e) => setType(e.target.value)}
                          className="w-full text-sm border border-slate-200 rounded-lg px-3 py-2 bg-slate-50 outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-400 font-medium text-slate-700"
                        >
                          {toolsSubgroups.map((sg) => (
                            <option key={sg.id} value={sg.name}>
                              {sg.name}
                            </option>
                          ))}
                        </select>
                      </div>
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">
                        Description
                      </label>
                      <textarea
                        id="form-desc"
                        rows={3}
                        value={description}
                        onChange={(e) => setDescription(e.target.value)}
                        placeholder="Details about standard usage, accuracy specs, etc."
                        className="w-full text-sm border border-slate-200 rounded-lg px-3 py-2 bg-slate-50 outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-400 resize-none"
                      />
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">
                          Size / Measuring Range
                        </label>
                        <input
                          id="form-size"
                          value={size}
                          onChange={(e) => setSize(e.target.value)}
                          placeholder="e.g. 0-25mm"
                          className="w-full text-sm border border-slate-200 rounded-lg px-3 py-2 bg-slate-50 outline-none focus:ring-2 focus:ring-blue-500/30"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">
                          Shape
                        </label>
                        <input
                          id="form-shape"
                          value={shape}
                          onChange={(e) => setShape(e.target.value)}
                          placeholder="e.g. Cylindrical"
                          className="w-full text-sm border border-slate-200 rounded-lg px-3 py-2 bg-slate-50 outline-none focus:ring-2 focus:ring-blue-500/30"
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4 border-t border-slate-100 pt-4">
                      <div>
                        <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">
                          Department Location
                        </label>
                        <input
                          id="form-dept"
                          value={deptName}
                          onChange={(e) => setDeptName(e.target.value)}
                          placeholder="e.g. QC"
                          className="w-full text-sm border border-slate-200 rounded-lg px-3 py-2 bg-slate-50 outline-none focus:ring-2 focus:ring-blue-500/30"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">
                          Storage Location Bin
                        </label>
                        <input
                          id="form-location"
                          value={location}
                          onChange={(e) => setLocation(e.target.value)}
                          placeholder="e.g. Tool Crib A"
                          className="w-full text-sm border border-slate-200 rounded-lg px-3 py-2 bg-slate-50 outline-none focus:ring-2 focus:ring-blue-500/30"
                        />
                      </div>
                    </div>
                  </div>
                )}

                {/* ── TAB 2: Stock & Quantities ── */}
                {activeTab === "stock" && (
                  <div className="bg-white rounded-2xl border border-slate-200 p-6 space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">
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
                          className="w-full text-sm border border-slate-200 rounded-lg px-3 py-2 bg-slate-50 outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-400 font-mono font-semibold"
                        />
                        {errors.totQty && <p className="text-red-500 text-xs mt-1 font-semibold">{errors.totQty}</p>}
                      </div>
                      <div>
                        <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">
                          Tool Status
                        </label>
                        <select
                          id="form-status"
                          value={status}
                          onChange={(e) => setStatus(e.target.value as ToolStatus)}
                          className="w-full text-sm border border-slate-200 rounded-lg px-3 py-2 bg-slate-50 outline-none focus:ring-2 focus:ring-blue-500/30 font-medium text-slate-700"
                        >
                          <option value="Available">Available</option>
                          <option value="Issued">Issued</option>
                          <option value="Under Calibration">Under Calibration</option>
                          <option value="Under Repair">Under Repair</option>
                          <option value="Scrapped">Scrapped</option>
                        </select>
                      </div>
                    </div>

                    <div className="grid grid-cols-3 gap-4 border-t border-slate-100 pt-4 bg-slate-50/40 p-4 rounded-xl">
                      <div>
                        <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-0.5">
                          Quantity In Store
                        </label>
                        <p className="text-lg font-bold text-slate-800 font-mono">{qtyIn}</p>
                      </div>
                      <div>
                        <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-0.5">
                          Quantity Issued Out
                        </label>
                        <p className="text-lg font-bold text-slate-800 font-mono">{qtyOut}</p>
                      </div>
                      <div>
                        <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-0.5">
                          New Stock (GRN)
                        </label>
                        <p className="text-lg font-bold text-slate-800 font-mono">{qtyNew}</p>
                      </div>
                    </div>

                    <p className="text-xs text-slate-400 flex items-center gap-1.5 leading-relaxed">
                      <HelpCircle className="w-4 h-4 text-slate-300" />
                      <span>
                        <strong>Note:</strong> QTY_IN, QTY_OUT and QTY_NEW are updated automatically on Issue, Receive, and GRN transactions.
                      </span>
                    </p>

                    {/* Serial Generation Option */}
                    <div className="border-t border-slate-100 pt-4 space-y-4">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="text-sm font-semibold text-slate-800">Generate Unique Serials</p>
                          <p className="text-xs text-slate-400 mt-0.5">Auto-generates rows in GAUGE_SERIAL_NO for item tracking</p>
                        </div>
                        <input
                          type="checkbox"
                          id="form-serial-req"
                          checked={serialNoGenReq}
                          onChange={(e) => setSerialNoGenReq(e.target.checked)}
                          className="w-5 h-5 text-blue-600 border-slate-200 rounded focus:ring-blue-500"
                        />
                      </div>

                      {serialNoGenReq && (
                        <div className="space-y-3">
                          <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl text-xs text-amber-800">
                            <strong>System Notice:</strong> The ERP will automatically register <strong>{totQty}</strong> unique serials in GAUGE_SERIAL_NO on saving.
                          </div>
                          <button
                            type="button"
                            onClick={handlePreviewSerials}
                            className="text-xs font-bold text-blue-600 hover:text-blue-700 hover:underline flex items-center gap-1"
                          >
                            Preview Serial Numbers →
                          </button>

                          {showSerialPreview && (
                            <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl max-h-36 overflow-y-auto font-mono text-xs text-slate-500 space-y-1">
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
                  <div className="bg-white rounded-2xl border border-slate-200 p-6 space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">
                          Calibration Frequency (Months)
                        </label>
                        <input
                          id="form-frequency"
                          type="number"
                          min={1}
                          value={calibrationFrqMonths}
                          onChange={(e) => setCalibrationFrqMonths(Number(e.target.value))}
                          className="w-full text-sm border border-slate-200 rounded-lg px-3 py-2 bg-slate-50 outline-none focus:ring-2 focus:ring-blue-500/30 font-mono"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">
                          Planned Lab / Agency Name
                        </label>
                        <input
                          id="form-planned-who"
                          value={caliPlannedWho}
                          onChange={(e) => setCaliPlannedWho(e.target.value)}
                          placeholder="e.g. Reliable Calibration Lab"
                          className="w-full text-sm border border-slate-200 rounded-lg px-3 py-2 bg-slate-50 outline-none focus:ring-2 focus:ring-blue-500/30"
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4 border-t border-slate-100 pt-4">
                      <div>
                        <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">
                          Last Calibration Date
                        </label>
                        <input
                          id="form-last-cal"
                          type="date"
                          value={lastCalibrationDate}
                          onChange={(e) => setLastCalibrationDate(e.target.value)}
                          className="w-full text-sm border border-slate-200 rounded-lg px-3 py-2 bg-slate-50 outline-none focus:ring-2 focus:ring-blue-500/30 font-mono"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">
                          Next Scheduled Calibration
                        </label>
                        <input
                          id="form-next-cal"
                          type="date"
                          value={nextCalibrationDate}
                          readOnly
                          className="w-full text-sm border border-slate-200 rounded-lg px-3 py-2 bg-slate-100 font-mono font-bold text-slate-700 outline-none cursor-not-allowed"
                        />
                        <p className="text-[10px] text-slate-400 font-medium mt-1">
                          Calculated automatically: Last Date + {calibrationFrqMonths} Months frequency.
                        </p>
                      </div>
                    </div>
                  </div>
                )}

                {/* ── TAB 4: Specifications ── */}
                {activeTab === "specs" && (
                  <div className="bg-white rounded-2xl border border-slate-200 p-6 space-y-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm font-semibold text-slate-800 font-sans">Measurement Parameters</p>
                        <p className="text-xs text-slate-400 mt-0.5">Parameters stored under TOOLS_SPECIFICATION</p>
                      </div>
                      <button
                        type="button"
                        id="add-spec-row-btn"
                        onClick={handleAddSpec}
                        className="text-xs font-bold text-blue-600 hover:text-blue-700 flex items-center gap-1 hover:underline"
                      >
                        <Plus className="w-4 h-4" /> Add Parameter
                      </button>
                    </div>

                    <div className="overflow-auto border border-slate-100 rounded-xl">
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="border-b border-slate-100 bg-slate-50/50">
                            {["Specification Parameter Name", "Standard Value", "Unit of Measure", ""].map((col) => (
                              <th key={col} className="text-left text-[11px] font-bold text-slate-400 uppercase tracking-wider py-2.5 px-4">
                                {col}
                              </th>
                            ))}
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-50">
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
                                  className="w-full text-sm border border-slate-200 rounded-lg px-3 py-1.5 bg-slate-50 outline-none focus:ring-2 focus:ring-blue-500/30"
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
                                  className="w-full text-sm border border-slate-200 rounded-lg px-3 py-1.5 bg-slate-50 outline-none focus:ring-2 focus:ring-blue-500/30"
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
                                  className="w-full text-sm border border-slate-200 rounded-lg px-3 py-1.5 bg-slate-50 outline-none focus:ring-2 focus:ring-blue-500/30"
                                />
                              </td>
                              <td className="py-2.5 px-3">
                                <button
                                  type="button"
                                  onClick={() => handleDeleteSpec(index)}
                                  className="p-1 hover:bg-red-50 rounded-lg text-slate-300 hover:text-red-500 transition-colors"
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
                  <div className="bg-white rounded-2xl border border-slate-200 p-6 space-y-4">
                    <div>
                      <p className="text-sm font-semibold text-slate-800 font-sans">PO Sourcing Log</p>
                      <p className="text-xs text-slate-400 mt-0.5">Historically tracked rates captured from TOOLS_PRICE_MASTER & GRNs</p>
                    </div>

                    <div className="overflow-auto border border-slate-100 rounded-xl">
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="border-b border-slate-100 bg-slate-50/50">
                            {["Date", "Sourced Supplier", "GRN / Source Doc", "Sourcing Unit Rate (₹)"].map((col) => (
                              <th key={col} className="text-left text-[11px] font-bold text-slate-400 uppercase tracking-wider py-2.5 px-4">
                                {col}
                              </th>
                            ))}
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-50">
                          <tr>
                            <td colSpan={4} className="py-8 text-center text-xs text-slate-400 font-medium">
                              No purchase or receipt transaction history found for this tool record.
                            </td>
                          </tr>
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}

                {/* Footer submit and cancel buttons */}
                <div className="flex items-center justify-end gap-3 sticky bottom-0 bg-slate-50 py-4 border-t border-slate-100">
                  <button
                    type="button"
                    onClick={() => setViewState("list")}
                    className="px-5 py-2.5 text-sm font-semibold text-slate-500 hover:text-slate-800 rounded-xl hover:bg-slate-100 transition-all"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    id="tool-save-btn"
                    className="flex items-center gap-2 px-6 py-2.5 bg-blue-600 hover:bg-blue-700 active:bg-blue-800 text-white text-sm font-semibold rounded-xl shadow-sm hover:shadow-md transition-all duration-150"
                  >
                    <Save className="w-4 h-4" /> Save Record
                  </button>
                </div>
              </form>
            </div>
          )}
        </main>
      </div>
    </div>
  );
}
