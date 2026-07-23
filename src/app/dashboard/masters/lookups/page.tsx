"use client";

import { useState, useEffect, useCallback } from "react";
import { Plus, X, Trash2, Edit2, Check } from "lucide-react";
import Sidebar from "@/app/dashboard/components/Sidebar";
import TopBar from "@/app/dashboard/components/TopBar";
import RoleGate from "@/app/dashboard/components/RoleGate";
import { TableSkeleton } from "@/app/dashboard/components/LoadingSkeleton";
import { apiGet, apiPost, apiPut, apiDelete } from "@/lib/apiClient";

type Tab = "Tool Types" | "Gauge Types" | "Tools Groups" | "Tools Subgroups";

interface ToolType {
  id: number;
  code: string;
  name: string;
  description: string | null;
}

interface GaugeType {
  id: number;
  code: string;
  name: string;
  description: string | null;
}

interface ToolsGroup {
  id: number;
  code: string;
  name: string;
  prefixToolsNo: string | null;
  poPrefix: string | null;
  grnPrefix: string | null;
  indentPrefix: string | null;
}

interface ToolsSubgroup {
  id: number;
  code: string;
  name: string;
  refGroupId: number;
  group?: { id: number; code: string; name: string } | null;
}

const tabs: Tab[] = ["Tool Types", "Gauge Types", "Tools Groups", "Tools Subgroups"];

export default function LookupsPage() {
  const [tab, setTab] = useState<Tab>("Tool Types");

  // Reactivity states
  const [toolTypes, setToolTypes] = useState<ToolType[]>([]);
  const [gaugeTypes, setGaugeTypes] = useState<GaugeType[]>([]);
  const [toolsGroups, setToolsGroups] = useState<ToolsGroup[]>([]);
  const [toolsSubgroups, setToolsSubgroups] = useState<ToolsSubgroup[]>([]);
  const [loading, setLoading] = useState(true);
  const [bannerMsg, setBannerMsg] = useState<{ type: "success" | "error"; text: string } | null>(null);

  // Inline Row Editor States (for Tool & Gauge Types)
  const [isInlineAdding, setIsInlineAdding] = useState(false);
  const [inlineCode, setInlineCode] = useState("");
  const [inlineName, setInlineName] = useState("");
  const [inlineDesc, setInlineDesc] = useState("");
  const [inlineError, setInlineError] = useState("");

  // Slide-over states for Groups & Subgroups
  const [isSlideOpen, setIsSlideOpen] = useState(false);
  const [editGroup, setEditGroup] = useState<ToolsGroup | null>(null);
  const [editSubgroup, setEditSubgroup] = useState<ToolsSubgroup | null>(null);

  // Slide-over fields: Groups
  const [groupCode, setGroupCode] = useState("");
  const [groupName, setGroupName] = useState("");
  const [groupPrefix, setGroupPrefix] = useState("");
  const [groupPoPrefix, setGroupPoPrefix] = useState("");
  const [groupGrnPrefix, setGroupGrnPrefix] = useState("");
  const [groupIndentPrefix, setGroupIndentPrefix] = useState("");

  // Slide-over fields: Subgroups
  const [subCode, setSubCode] = useState("");
  const [subName, setSubName] = useState("");
  const [subParentId, setSubParentId] = useState<number | "">("");

  const [slideErrors, setSlideErrors] = useState<Record<string, string>>({});

  const loadAll = useCallback(async () => {
    setLoading(true);
    const [tt, gt, gr, sg] = await Promise.all([
      apiGet<{ items: ToolType[] }>("/api/lookups/tool-types"),
      apiGet<{ items: GaugeType[] }>("/api/lookups/gauge-types"),
      apiGet<{ items: ToolsGroup[] }>("/api/lookups/groups"),
      apiGet<{ items: ToolsSubgroup[] }>("/api/lookups/subgroups"),
    ]);
    if (tt.data?.items) setToolTypes(tt.data.items);
    if (gt.data?.items) setGaugeTypes(gt.data.items);
    if (gr.data?.items) setToolsGroups(gr.data.items);
    if (sg.data?.items) setToolsSubgroups(sg.data.items);
    setLoading(false);
  }, []);

  useEffect(() => {
    loadAll();
  }, [loadAll]);

  const handleOpenAddSlide = () => {
    setSlideErrors({});
    if (tab === "Tools Groups") {
      setEditGroup(null);
      setGroupCode("");
      setGroupName("");
      setGroupPrefix("");
      setGroupPoPrefix("");
      setGroupGrnPrefix("");
      setGroupIndentPrefix("");
    } else {
      setEditSubgroup(null);
      setSubCode("");
      setSubName("");
      setSubParentId(toolsGroups[0]?.id ?? "");
    }
    setIsSlideOpen(true);
  };

  const handleOpenEditGroup = (g: ToolsGroup) => {
    setSlideErrors({});
    setEditGroup(g);
    setGroupCode(g.code);
    setGroupName(g.name);
    setGroupPrefix(g.prefixToolsNo ?? "");
    setGroupPoPrefix(g.poPrefix ?? "");
    setGroupGrnPrefix(g.grnPrefix ?? "");
    setGroupIndentPrefix(g.indentPrefix ?? "");
    setIsSlideOpen(true);
  };

  const handleOpenEditSubgroup = (sg: ToolsSubgroup) => {
    setSlideErrors({});
    setEditSubgroup(sg);
    setSubCode(sg.code);
    setSubName(sg.name);
    setSubParentId(sg.refGroupId);
    setIsSlideOpen(true);
  };

  const handleSaveInline = async () => {
    setInlineError("");
    if (!inlineCode.trim() || !inlineName.trim()) {
      setInlineError("Code and Name are required");
      return;
    }

    const payload = {
      code: inlineCode,
      name: inlineName,
      description: inlineDesc || undefined,
    };

    const url =
      tab === "Tool Types"
        ? "/api/lookups/tool-types"
        : "/api/lookups/gauge-types";

    const res = await apiPost<{ item: ToolType | GaugeType }>(url, payload);
    if (res.error) {
      setInlineError(res.error.message);
      return;
    }

    setBannerMsg({ type: "success", text: `${tab.slice(0, -1)} created.` });
    setIsInlineAdding(false);
    setInlineCode("");
    setInlineName("");
    setInlineDesc("");
    loadAll();
  };

  const handleDeleteInline = async (id: number) => {
    if (!confirm("Are you sure?")) return;
    const url =
      tab === "Tool Types"
        ? `/api/lookups/tool-types/${id}`
        : `/api/lookups/gauge-types/${id}`;
    const res = await apiDelete(url);
    if (res.error) {
      setBannerMsg({ type: "error", text: res.error.message });
      return;
    }
    setBannerMsg({ type: "success", text: "Item deleted." });
    loadAll();
  };

  const handleDeleteGroup = async (id: number) => {
    if (!confirm("Are you sure?")) return;
    const res = await apiDelete(`/api/lookups/groups/${id}`);
    if (res.error) {
      setBannerMsg({ type: "error", text: res.error.message });
      return;
    }
    setBannerMsg({ type: "success", text: "Group deleted." });
    loadAll();
  };

  const handleDeleteSubgroup = async (id: number) => {
    if (!confirm("Are you sure?")) return;
    const res = await apiDelete(`/api/lookups/subgroups/${id}`);
    if (res.error) {
      setBannerMsg({ type: "error", text: res.error.message });
      return;
    }
    setBannerMsg({ type: "success", text: "Subgroup deleted." });
    loadAll();
  };

  const handleSaveSlide = async (e: React.FormEvent) => {
    e.preventDefault();
    const errors: Record<string, string> = {};

    if (tab === "Tools Groups") {
      if (!groupCode.trim()) errors.groupCode = "Group Code is required";
      if (!groupName.trim()) errors.groupName = "Group Name is required";
      if (!groupPrefix.trim()) errors.groupPrefix = "Prefix tools number is required";
      if (!groupPoPrefix.trim()) errors.groupPoPrefix = "PO Prefix is required";
      if (!groupGrnPrefix.trim()) errors.groupGrnPrefix = "GRN Prefix is required";
      if (!groupIndentPrefix.trim()) errors.groupIndentPrefix = "Indent Prefix is required";

      if (Object.keys(errors).length > 0) {
        setSlideErrors(errors);
        return;
      }

      const payload = {
        code: groupCode,
        name: groupName,
        prefixToolsNo: groupPrefix,
        poPrefix: groupPoPrefix,
        grnPrefix: groupGrnPrefix,
        indentPrefix: groupIndentPrefix,
      };

      setBannerMsg(null);
      const res = editGroup
        ? await apiPut<{ item: ToolsGroup }>(`/api/lookups/groups/${editGroup.id}`, payload)
        : await apiPost<{ item: ToolsGroup }>("/api/lookups/groups", payload);

      if (res.error) {
        setBannerMsg({ type: "error", text: res.error.message });
        return;
      }

      setBannerMsg({ type: "success", text: editGroup ? "Group updated." : "Group created." });
      setIsSlideOpen(false);
      loadAll();
    } else {
      // Subgroups
      if (!subCode.trim()) errors.subCode = "Subgroup Code is required";
      if (!subName.trim()) errors.subName = "Subgroup Name is required";
      if (subParentId === "") errors.subParentId = "Parent Group is required";

      if (Object.keys(errors).length > 0) {
        setSlideErrors(errors);
        return;
      }

      const payload = {
        code: subCode,
        name: subName,
        refGroupId: Number(subParentId),
      };

      setBannerMsg(null);
      const res = editSubgroup
        ? await apiPut<{ item: ToolsSubgroup }>(`/api/lookups/subgroups/${editSubgroup.id}`, payload)
        : await apiPost<{ item: ToolsSubgroup }>("/api/lookups/subgroups", payload);

      if (res.error) {
        setBannerMsg({ type: "error", text: res.error.message });
        return;
      }

      setBannerMsg({ type: "success", text: editSubgroup ? "Subgroup updated." : "Subgroup created." });
      setIsSlideOpen(false);
      loadAll();
    }
  };

  return (
    <div className="flex h-screen bg-slate-50 overflow-hidden">
      <Sidebar />
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        <TopBar />
        <main className="flex-1 overflow-y-auto px-7 py-6">
          {/* ── Header ── */}
          <div className="flex items-center justify-between mb-6">
            <div>
              <h1 className="text-2xl font-bold text-slate-900 tracking-tight">
                Lookup Masters
              </h1>
              <p className="text-sm text-slate-500 mt-0.5">
                Tool types, gauge types, tool groups and subgroups
              </p>
            </div>
            <RoleGate permission="canEditMaster">
              {(tab === "Tools Groups" || tab === "Tools Subgroups") && (
                <button
                  id="lookup-add-btn"
                  onClick={handleOpenAddSlide}
                  className="flex items-center gap-2 px-4 py-2.5 bg-blue-600 hover:bg-blue-700 active:bg-blue-800 text-white text-sm font-semibold rounded-xl shadow-sm hover:shadow-md transition-all duration-150 group"
                >
                  <Plus className="w-4 h-4 transition-transform group-hover:rotate-90 duration-200" />
                  Add {tab === "Tools Groups" ? "Group" : "Subgroup"}
                </button>
              )}
            </RoleGate>
          </div>

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

          {/* ── Tabs & Card ── */}
          <div className="bg-white rounded-2xl border border-slate-200 p-5">
            <div className="flex items-center gap-1 bg-slate-50 rounded-lg p-1 mb-6 w-fit">
              {tabs.map((t) => (
                <button
                  key={t}
                  id={`lookup-tab-${t.toLowerCase().replace(/\s/g, "-")}`}
                  onClick={() => {
                    setTab(t);
                    setIsInlineAdding(false);
                  }}
                  className={`px-3.5 py-2 rounded-md text-xs font-semibold transition-all ${
                    tab === t
                      ? "bg-white shadow-sm text-slate-800"
                      : "text-slate-400 hover:text-slate-600"
                  }`}
                >
                  {t}
                </button>
              ))}
            </div>

            {/* Tab Content 1: Tool Types */}
            {tab === "Tool Types" && (
              <div className="space-y-4">
                {loading ? (
                  <TableSkeleton rows={4} />
                ) : (
                  <SimpleTypesTable
                    rows={toolTypes}
                    onDelete={handleDeleteInline}
                  />
                )}
                {renderInlineEditor()}
              </div>
            )}

            {/* Tab Content 2: Gauge Types */}
            {tab === "Gauge Types" && (
              <div className="space-y-4">
                {loading ? (
                  <TableSkeleton rows={4} />
                ) : (
                  <SimpleTypesTable
                    rows={gaugeTypes}
                    onDelete={handleDeleteInline}
                  />
                )}
                {renderInlineEditor()}
              </div>
            )}

            {/* Tab Content 3: Tools Groups */}
            {tab === "Tools Groups" && (
              loading ? (
                <TableSkeleton rows={4} />
              ) : (
              <div className="overflow-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-slate-100">
                      {["Code", "Group Name", "Prefix Tools No", "PO Prefix", "GRN Prefix", "Indent Prefix", "Actions"].map((col) => (
                        <th key={col} className="text-left text-[11px] font-semibold text-slate-400 uppercase tracking-wider pb-2.5 pr-4 last:pr-0">
                          {col}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-50">
                    {toolsGroups.map((g) => (
                      <tr key={g.id} className="hover:bg-slate-50/60 transition-colors">
                        <td className="py-3 pr-4 font-mono text-xs text-slate-500">{g.code}</td>
                        <td className="py-3 pr-4 font-medium text-slate-800">{g.name}</td>
                        <td className="py-3 pr-4 font-mono text-xs text-slate-600">{g.prefixToolsNo}</td>
                        <td className="py-3 pr-4 font-mono text-xs text-slate-600">{g.poPrefix}</td>
                        <td className="py-3 pr-4 font-mono text-xs text-slate-600">{g.grnPrefix}</td>
                        <td className="py-3 pr-4 font-mono text-xs text-slate-600">{g.indentPrefix}</td>
                        <td className="py-3">
                          <RoleGate permission="canEditMaster">
                            <div className="flex items-center gap-1">
                              <button onClick={() => handleOpenEditGroup(g)} className="p-1.5 hover:bg-slate-50 rounded-lg text-slate-400 hover:text-slate-700 transition-colors">
                                <Edit2 className="w-3.5 h-3.5" />
                              </button>
                              <button onClick={() => handleDeleteGroup(g.id)} className="p-1.5 hover:bg-red-50 rounded-lg text-slate-400 hover:text-red-600 transition-colors">
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </RoleGate>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              )
            )}

            {/* Tab Content 4: Tools Subgroups */}
            {tab === "Tools Subgroups" && (
              loading ? (
                <TableSkeleton rows={4} />
              ) : (
              <div className="overflow-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-slate-100">
                      {["Code", "Subgroup Name", "Parent Group Name", "Actions"].map((col) => (
                        <th key={col} className="text-left text-[11px] font-semibold text-slate-400 uppercase tracking-wider pb-2.5 pr-4 last:pr-0">
                          {col}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-50">
                    {toolsSubgroups.map((sg) => (
                      <tr key={sg.id} className="hover:bg-slate-50/60 transition-colors">
                        <td className="py-3 pr-4 font-mono text-xs text-slate-500">{sg.code}</td>
                        <td className="py-3 pr-4 font-medium text-slate-800">{sg.name}</td>
                        <td className="py-3 pr-4 text-slate-600 flex items-center gap-2">
                          {sg.group?.name ?? "—"}
                        </td>
                        <td className="py-3">
                          <RoleGate permission="canEditMaster">
                            <div className="flex items-center gap-1">
                              <button onClick={() => handleOpenEditSubgroup(sg)} className="p-1.5 hover:bg-slate-50 rounded-lg text-slate-400 hover:text-slate-700 transition-colors">
                                <Edit2 className="w-3.5 h-3.5" />
                              </button>
                              <button onClick={() => handleDeleteSubgroup(sg.id)} className="p-1.5 hover:bg-red-50 rounded-lg text-slate-400 hover:text-red-600 transition-colors">
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </RoleGate>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              )
            )}
          </div>
        </main>
      </div>

      {/* ── Slide-over Form Panel (Tab 3 & 4) ── */}
      {isSlideOpen && (
        <div className="fixed inset-0 z-50 overflow-hidden">
          <div className="absolute inset-0 bg-slate-900/40 backdrop-blur-xs transition-opacity" onClick={() => setIsSlideOpen(false)} />
          <div className="absolute inset-y-0 right-0 max-w-full flex pl-10">
            <div className="w-screen max-w-md bg-white shadow-xl flex flex-col h-full border-l border-slate-200">
              <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between">
                <h2 className="text-base font-bold text-slate-800">
                  {tab === "Tools Groups"
                    ? editGroup
                      ? `Edit Group: ${editGroup.name}`
                      : "Add Tools Group"
                    : editSubgroup
                    ? `Edit Subgroup: ${editSubgroup.name}`
                    : "Add Tools Subgroup"}
                </h2>
                <button onClick={() => setIsSlideOpen(false)} className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-400 hover:text-slate-700 transition-colors">
                  <X className="w-5 h-5" />
                </button>
              </div>

              <form onSubmit={handleSaveSlide} className="flex-1 overflow-y-auto p-5 space-y-4">
                {tab === "Tools Groups" ? (
                  <>
                    <div>
                      <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">
                        Group Code *
                      </label>
                      <input
                        id="form-group-code"
                        value={groupCode}
                        onChange={(e) => setGroupCode(e.target.value)}
                        placeholder="e.g. MEQ"
                        className="w-full text-sm border border-slate-200 rounded-lg px-3 py-2 outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-400 bg-slate-50 font-mono uppercase"
                      />
                      {slideErrors.groupCode && <p className="text-red-500 text-xs mt-1 font-medium">{slideErrors.groupCode}</p>}
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">
                        Group Name *
                      </label>
                      <input
                        id="form-group-name"
                        value={groupName}
                        onChange={(e) => setGroupName(e.target.value)}
                        placeholder="e.g. Measuring Equip"
                        className="w-full text-sm border border-slate-200 rounded-lg px-3 py-2 outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-400 bg-slate-50"
                      />
                      {slideErrors.groupName && <p className="text-red-500 text-xs mt-1 font-medium">{slideErrors.groupName}</p>}
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">
                        Prefix Tools Number *
                      </label>
                      <input
                        id="form-group-prefix"
                        value={groupPrefix}
                        onChange={(e) => setGroupPrefix(e.target.value)}
                        placeholder="e.g. TL-MIC"
                        className="w-full text-sm border border-slate-200 rounded-lg px-3 py-2 outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-400 bg-slate-50 font-mono"
                      />
                      {slideErrors.groupPrefix && <p className="text-red-500 text-xs mt-1 font-medium">{slideErrors.groupPrefix}</p>}
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">
                        PO Prefix *
                      </label>
                      <input
                        id="form-group-poprefix"
                        value={groupPoPrefix}
                        onChange={(e) => setGroupPoPrefix(e.target.value)}
                        placeholder="e.g. PO-MEQ"
                        className="w-full text-sm border border-slate-200 rounded-lg px-3 py-2 outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-400 bg-slate-50 font-mono"
                      />
                      {slideErrors.groupPoPrefix && <p className="text-red-500 text-xs mt-1 font-medium">{slideErrors.groupPoPrefix}</p>}
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">
                        GRN Prefix *
                      </label>
                      <input
                        id="form-group-grnprefix"
                        value={groupGrnPrefix}
                        onChange={(e) => setGroupGrnPrefix(e.target.value)}
                        placeholder="e.g. GRN-MEQ"
                        className="w-full text-sm border border-slate-200 rounded-lg px-3 py-2 outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-400 bg-slate-50 font-mono"
                      />
                      {slideErrors.groupGrnPrefix && <p className="text-red-500 text-xs mt-1 font-medium">{slideErrors.groupGrnPrefix}</p>}
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">
                        Indent Prefix *
                      </label>
                      <input
                        id="form-group-indentprefix"
                        value={groupIndentPrefix}
                        onChange={(e) => setGroupIndentPrefix(e.target.value)}
                        placeholder="e.g. IND-MEQ"
                        className="w-full text-sm border border-slate-200 rounded-lg px-3 py-2 outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-400 bg-slate-50 font-mono"
                      />
                      {slideErrors.groupIndentPrefix && <p className="text-red-500 text-xs mt-1 font-medium">{slideErrors.groupIndentPrefix}</p>}
                    </div>
                  </>
                ) : (
                  <>
                    <div>
                      <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">
                        Subgroup Code *
                      </label>
                      <input
                        id="form-subg-code"
                        value={subCode}
                        onChange={(e) => setSubCode(e.target.value)}
                        placeholder="e.g. MIC"
                        className="w-full text-sm border border-slate-200 rounded-lg px-3 py-2 outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-400 bg-slate-50 font-mono uppercase"
                      />
                      {slideErrors.subCode && <p className="text-red-500 text-xs mt-1 font-medium">{slideErrors.subCode}</p>}
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">
                        Subgroup Name *
                      </label>
                      <input
                        id="form-subg-name"
                        value={subName}
                        onChange={(e) => setSubName(e.target.value)}
                        placeholder="e.g. Micrometers"
                        className="w-full text-sm border border-slate-200 rounded-lg px-3 py-2 outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-400 bg-slate-50"
                      />
                      {slideErrors.subName && <p className="text-red-500 text-xs mt-1 font-medium">{slideErrors.subName}</p>}
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">
                        Parent Group *
                      </label>
                      <select
                        id="form-subg-parent"
                        value={subParentId}
                        onChange={(e) => setSubParentId(Number(e.target.value))}
                        className="w-full text-sm border border-slate-200 rounded-lg px-3 py-2 outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-400 bg-slate-50"
                      >
                        {toolsGroups.map((g) => (
                          <option key={g.id} value={g.id}>
                            {g.name}
                          </option>
                        ))}
                      </select>
                      {slideErrors.subParentId && <p className="text-red-500 text-xs mt-1 font-medium">{slideErrors.subParentId}</p>}
                    </div>
                  </>
                )}

                <div className="border-t border-slate-100 pt-4 flex items-center justify-end gap-3 sticky bottom-0 bg-white">
                  <button type="button" onClick={() => setIsSlideOpen(false)} className="px-4 py-2 text-sm font-semibold text-slate-500 hover:text-slate-800 hover:bg-slate-50 rounded-xl transition-all">
                    Cancel
                  </button>
                  <button type="submit" className="px-5 py-2 text-sm font-semibold text-white bg-blue-600 hover:bg-blue-700 active:bg-blue-800 rounded-xl shadow-sm transition-all">
                    Save
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}
    </div>
  );

  function renderInlineEditor() {
    return (
      <RoleGate permission="canEditMaster">
        <div className="border border-dashed border-slate-200 rounded-2xl p-4 bg-slate-50/50 mt-4">
          {isInlineAdding ? (
            <div className="space-y-3">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <input
                    id="inline-form-code"
                    value={inlineCode}
                    onChange={(e) => setInlineCode(e.target.value)}
                    placeholder="Code (e.g. TT05)"
                    className="w-full text-sm border border-slate-200 rounded-lg px-3 py-2 outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-400 bg-white font-mono uppercase"
                  />
                </div>
                <div>
                  <input
                    id="inline-form-name"
                    value={inlineName}
                    onChange={(e) => setInlineName(e.target.value)}
                    placeholder="Name (e.g. Pneumatic Tool)"
                    className="w-full text-sm border border-slate-200 rounded-lg px-3 py-2 outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-400 bg-white"
                  />
                </div>
                <div>
                  <input
                    id="inline-form-desc"
                    value={inlineDesc}
                    onChange={(e) => setInlineDesc(e.target.value)}
                    placeholder="Description"
                    className="w-full text-sm border border-slate-200 rounded-lg px-3 py-2 outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-400 bg-white"
                  />
                </div>
              </div>
              {inlineError && <p className="text-red-500 text-xs font-semibold">{inlineError}</p>}
              <div className="flex items-center justify-end gap-2.5">
                <button
                  onClick={() => setIsInlineAdding(false)}
                  className="px-3 py-1.5 text-xs font-bold text-slate-500 hover:text-slate-800 transition-colors"
                >
                  Cancel
                </button>
                <button
                  id="inline-save-btn"
                  onClick={handleSaveInline}
                  className="flex items-center gap-1 px-4 py-1.5 bg-blue-600 hover:bg-blue-700 active:bg-blue-800 text-white text-xs font-bold rounded-lg shadow-sm transition-all"
                >
                  <Check className="w-3.5 h-3.5" /> Save Row
                </button>
              </div>
            </div>
          ) : (
            <button
              id="inline-add-row-btn"
              onClick={() => {
                setInlineCode("");
                setInlineName("");
                setInlineDesc("");
                setInlineError("");
                setIsInlineAdding(true);
              }}
              className="flex items-center gap-1.5 text-blue-600 hover:text-blue-700 font-bold text-xs"
            >
              <Plus className="w-4 h-4" /> Add Row
            </button>
          )}
        </div>
      </RoleGate>
    );
  }
}

function SimpleTypesTable({
  rows,
  onDelete,
}: {
  rows: (ToolType | GaugeType)[];
  onDelete: (id: number) => void;
}) {
  return (
    <div className="overflow-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-slate-100">
            {["Code", "Name", "Description", "Actions"].map((col) => (
              <th key={col} className="text-left text-[11px] font-semibold text-slate-400 uppercase tracking-wider pb-2.5 pr-4 last:pr-0">
                {col}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-50">
          {rows.map((row) => (
            <tr key={row.id} className="hover:bg-slate-50/60 transition-colors">
              <td className="py-3 pr-4 font-mono text-xs text-slate-500">{row.code}</td>
              <td className="py-3 pr-4 font-medium text-slate-800">{row.name}</td>
              <td className="py-3 pr-4 text-slate-600">{row.description}</td>
              <td className="py-3">
                <RoleGate permission="canEditMaster">
                  <button onClick={() => onDelete(row.id)} className="p-1.5 hover:bg-red-50 rounded-lg text-slate-400 hover:text-red-600 transition-colors">
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </RoleGate>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
