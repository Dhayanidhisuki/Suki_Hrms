"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { Plus, X, Trash2, Edit2, Check } from "lucide-react";
import Sidebar from "@/app/dashboard/components/Sidebar";
import TopBar from "@/app/dashboard/components/TopBar";
import RoleGate from "@/app/dashboard/components/RoleGate";
import { TableSkeleton } from "@/app/dashboard/components/LoadingSkeleton";
import { StatusPillTabs } from "@/components/ui/StatusPillTabs";
import { MasterSearchInput, MasterTableCard } from "@/components/ui/MasterTableCard";
import { apiGet, apiPost, apiPut, apiDelete } from "@/lib/apiClient";
import { Button } from "@/components/ui/button";
import { toastSuccess, toastError } from "@/lib/appToast";

type Tab = "Tool Types" | "Gauge Types" | "Tools Groups" | "Tools Subgroups" | "Calib Frequency";

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

interface CalibFrequency {
  id: number;
  prodToleranceMin: string | null;
  prodToleranceMax: number | null;
  calibFrequency: number | null;
}

const tabs: Tab[] = ["Tool Types", "Gauge Types", "Tools Groups", "Tools Subgroups", "Calib Frequency"];

export default function LookupsPage() {
  const [tab, setTab] = useState<Tab>("Tool Types");
  const [query, setQuery] = useState("");

  // Reactivity states
  const [toolTypes, setToolTypes] = useState<ToolType[]>([]);
  const [gaugeTypes, setGaugeTypes] = useState<GaugeType[]>([]);
  const [toolsGroups, setToolsGroups] = useState<ToolsGroup[]>([]);
  const [toolsSubgroups, setToolsSubgroups] = useState<ToolsSubgroup[]>([]);
  const [calibFreqs, setCalibFreqs] = useState<CalibFrequency[]>([]);
  const [loading, setLoading] = useState(true);

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
    const [tt, gt, gr, sg, cf] = await Promise.all([
      apiGet<{ items: any[] }>("/api/lookups/tool-types"),
      apiGet<{ items: any[] }>("/api/lookups/gauge-types"),
      apiGet<{ items: any[] }>("/api/lookups/groups"),
      apiGet<{ items: any[] }>("/api/lookups/subgroups"),
      apiGet<{ items: any[] }>("/api/lookups/calib-frequency"),
    ]);

    if (tt.data?.items) {
      setToolTypes(
        tt.data.items.map((item: any) => ({
          id: item.id ?? item.rowId ?? Math.random(),
          code: item.code ?? item.prefixItemNo ?? `TT-${item.rowId || item.id}`,
          name: item.name ?? item.typeOfTools ?? "Unnamed Tool Type",
          description: item.description ?? (item.isAutoGenCd ? `Auto Gen: ${item.isAutoGenCd}` : null),
        }))
      );
    }
    if (gt.data?.items) {
      setGaugeTypes(
        gt.data.items.map((item: any) => ({
          id: item.id ?? item.rowId ?? Math.random(),
          code: item.code ?? `GT-${item.rowId || item.id}`,
          name: item.name ?? item.typeOfGauge ?? "Unnamed Gauge Type",
          description: item.description ?? null,
        }))
      );
    }
    if (gr.data?.items) {
      setToolsGroups(
        gr.data.items.map((item: any) => ({
          id: item.id ?? item.rowId ?? Math.random(),
          code: item.code ?? item.prefixToolsNo ?? `GRP-${item.rowId || item.id}`,
          name: item.name ?? item.otherType ?? "Unnamed Group",
          prefixToolsNo: item.prefixToolsNo ?? item.code,
          poPrefix: item.poPrefix,
          grnPrefix: item.grnPrefix,
          indentPrefix: item.indentPrefix,
        }))
      );
    }
    if (sg.data?.items) {
      setToolsSubgroups(
        sg.data.items.map((item: any) => ({
          id: item.id ?? item.rowId ?? Math.random(),
          code: item.code ?? item.prefixToolsNo ?? `SUB-${item.rowId || item.id}`,
          name: item.name ?? item.qmsOtherTypeOfTools ?? "Unnamed Subgroup",
          refGroupId: item.refGroupId,
          group: item.group
            ? {
                id: item.group.id ?? item.group.rowId,
                code: item.group.code ?? item.group.prefixToolsNo,
                name: item.group.name ?? item.group.otherType,
              }
            : null,
        }))
      );
    }
    if (cf.data?.items) {
      setCalibFreqs(
        cf.data.items.map((item: any) => ({
          id: item.id ?? item.rowId ?? Math.random(),
          prodToleranceMin: item.prodToleranceMin,
          prodToleranceMax: item.prodToleranceMax,
          calibFrequency: item.calibFrequency,
        }))
      );
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    loadAll();
  }, [loadAll]);

  // Inline Row Handlers
  const handleSaveInline = async () => {
    setInlineError("");
    if (!inlineCode.trim() || !inlineName.trim()) {
      setInlineError("Code and Name are required");
      return;
    }

    const endpoint = tab === "Tool Types" ? "/api/lookups/tool-types" : "/api/lookups/gauge-types";
    const res = await apiPost(endpoint, {
      code: inlineCode,
      name: inlineName,
      description: inlineDesc,
    });

    if (res.error) {
      setInlineError(res.error.message);
      return;
    }

    toastSuccess({
      title: "Record saved",
      message: `${tab.slice(0, -1)} added successfully.`,
      detail: inlineName.trim() || inlineCode.trim() || undefined,
    });
    setIsInlineAdding(false);
    loadAll();
  };

  const handleDeleteInline = async (id: number) => {
    const endpoint = tab === "Tool Types" ? `/api/lookups/tool-types/${id}` : `/api/lookups/gauge-types/${id}`;
    const res = await apiDelete(endpoint);
    if (res.error) {
      toastError(res.error.message);
      return;
    }
    toastSuccess("Record deleted.");
    loadAll();
  };

  // Group Handlers
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

  const handleDeleteGroup = async (id: number) => {
    const res = await apiDelete(`/api/lookups/groups/${id}`);
    if (res.error) {
      toastError(res.error.message);
      return;
    }
    toastSuccess("Group deleted.");
    loadAll();
  };

  // Subgroup Handlers
  const handleOpenEditSubgroup = (sg: ToolsSubgroup) => {
    setSlideErrors({});
    setEditSubgroup(sg);
    setSubCode(sg.code);
    setSubName(sg.name);
    setSubParentId(sg.refGroupId);
    setIsSlideOpen(true);
  };

  const handleDeleteSubgroup = async (id: number) => {
    const res = await apiDelete(`/api/lookups/subgroups/${id}`);
    if (res.error) {
      toastError(res.error.message);
      return;
    }
    toastSuccess("Subgroup deleted.");
    loadAll();
  };

  // Calib Frequency state
  const [cfMin, setCfMin] = useState("");
  const [cfMax, setCfMax] = useState("");
  const [cfFreq, setCfFreq] = useState("");
  const [cfAdding, setCfAdding] = useState(false);
  const [cfError, setCfError] = useState("");

  const handleSaveCalibFreq = async () => {
    setCfError("");
    const payload: Record<string, string | number> = {};
    if (cfMin.trim()) payload.prodToleranceMin = cfMin.trim();
    if (cfMax.trim()) payload.prodToleranceMax = Number(cfMax);
    if (cfFreq.trim()) payload.calibFrequency = Number(cfFreq);

    if (Object.keys(payload).length === 0) {
      setCfError("At least one field is required");
      return;
    }

    const res = await apiPost("/api/lookups/calib-frequency", payload);
    if (res.error) {
      setCfError(res.error.message);
      return;
    }

    toastSuccess({
      title: "Record saved",
      message: "Calibration frequency added successfully.",
    });
    setCfAdding(false);
    setCfMin(""); setCfMax(""); setCfFreq("");
    loadAll();
  };

  const handleDeleteCalibFreq = async (id: number) => {
    const res = await apiDelete(`/api/lookups/calib-frequency/${id}`);
    if (res.error) {
      toastError(res.error.message);
      return;
    }
    toastSuccess("Calibration frequency deleted.");
    loadAll();
  };

  const handleSaveSlide = async (e: React.FormEvent) => {
    e.preventDefault();
    const errors: Record<string, string> = {};

    if (tab === "Tools Groups") {
      if (!groupCode.trim()) errors.groupCode = "Group Code is required";
      if (!groupName.trim()) errors.groupName = "Group Name is required";
      if (!groupPrefix.trim()) errors.groupPrefix = "Prefix Tools Number is required";

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

      const res = editGroup
        ? await apiPut<{ item: ToolsGroup }>(`/api/lookups/groups/${editGroup.id}`, payload)
        : await apiPost<{ item: ToolsGroup }>("/api/lookups/groups", payload);

      if (res.error) {
        toastError(res.error.message);
        return;
      }

      toastSuccess({
        title: "Record saved",
        message: editGroup ? "Tools group updated successfully." : "Tools group created successfully.",
        detail: groupName.trim() || groupCode.trim() || undefined,
      });
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

      const res = editSubgroup
        ? await apiPut<{ item: ToolsSubgroup }>(`/api/lookups/subgroups/${editSubgroup.id}`, payload)
        : await apiPost<{ item: ToolsSubgroup }>("/api/lookups/subgroups", payload);

      if (res.error) {
        toastError(res.error.message);
        return;
      }

      toastSuccess({
        title: "Record saved",
        message: editSubgroup
          ? "Tools subgroup updated successfully."
          : "Tools subgroup created successfully.",
        detail: subName.trim() || subCode.trim() || undefined,
      });
      setIsSlideOpen(false);
      loadAll();
    }
  };

  const q = query.trim().toLowerCase();
  const matchesQuery = (...parts: (string | null | undefined | number)[]) => {
    if (!q) return true;
    return parts.some((p) => p != null && String(p).toLowerCase().includes(q));
  };

  const filteredToolTypes = useMemo(
    () => toolTypes.filter((r) => matchesQuery(r.code, r.name, r.description)),
    [toolTypes, q]
  );
  const filteredGaugeTypes = useMemo(
    () => gaugeTypes.filter((r) => matchesQuery(r.code, r.name, r.description)),
    [gaugeTypes, q]
  );
  const filteredToolsGroups = useMemo(
    () =>
      toolsGroups.filter((g) =>
        matchesQuery(g.code, g.name, g.prefixToolsNo, g.poPrefix, g.grnPrefix, g.indentPrefix)
      ),
    [toolsGroups, q]
  );
  const filteredToolsSubgroups = useMemo(
    () =>
      toolsSubgroups.filter((sg) =>
        matchesQuery(sg.code, sg.name, sg.group?.name, sg.group?.code)
      ),
    [toolsSubgroups, q]
  );
  const filteredCalibFreqs = useMemo(
    () =>
      calibFreqs.filter((cf) =>
        matchesQuery(cf.prodToleranceMin, cf.prodToleranceMax, cf.calibFrequency)
      ),
    [calibFreqs, q]
  );

  const tabCounts: Record<Tab, number> = {
    "Tool Types": toolTypes.length,
    "Gauge Types": gaugeTypes.length,
    "Tools Groups": toolsGroups.length,
    "Tools Subgroups": toolsSubgroups.length,
    "Calib Frequency": calibFreqs.length,
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
                Lookup Masters
              </h1>
              <p className="text-sm text-[var(--text-muted)] mt-0.5">
                Tool types, gauge types, tool groups and subgroups
              </p>
            </div>
            <RoleGate permission="canEditMaster">
              {(tab === "Tools Groups" || tab === "Tools Subgroups") && (
                <Button
                  id="lookup-add-btn"
                  onClick={handleOpenAddSlide}
                  variant="primary"
                  className="group"
                >
                  <Plus className="w-4 h-4 transition-transform group-hover:rotate-90 duration-200" />
                  Add {tab === "Tools Groups" ? "Group" : "Subgroup"}
                </Button>
              )}
            </RoleGate>
          </div>

          <StatusPillTabs
            className="mb-3"
            idPrefix="lookup-tab"
            value={tab}
            onChange={(t) => {
              setTab(t);
              setIsInlineAdding(false);
              setQuery("");
            }}
            items={tabs.map((t) => ({
              value: t,
              label: t,
              count: tabCounts[t],
            }))}
          />

          <MasterTableCard
            toolbar={
              <MasterSearchInput
                id="lookup-search"
                value={query}
                onChange={setQuery}
                placeholder="Search"
                widthClass="w-44"
              />
            }
          >
            {tab === "Tool Types" && (
              <div>
                {loading ? (
                  <div className="p-4">
                    <TableSkeleton rows={4} />
                  </div>
                ) : (
                  <SimpleTypesTable rows={filteredToolTypes} onDelete={handleDeleteInline} />
                )}
              </div>
            )}

            {tab === "Gauge Types" && (
              <div>
                {loading ? (
                  <div className="p-4">
                    <TableSkeleton rows={4} />
                  </div>
                ) : (
                  <SimpleTypesTable rows={filteredGaugeTypes} onDelete={handleDeleteInline} />
                )}
              </div>
            )}

            {tab === "Tools Groups" &&
              (loading ? (
                <div className="p-4">
                  <TableSkeleton rows={4} />
                </div>
              ) : (
                <div className="overflow-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-[var(--border-main)] bg-[var(--bg-subtle)]">
                        {["Code", "Group Name", "Prefix Tools No", "PO Prefix", "GRN Prefix", "Indent Prefix", "Actions"].map((col) => (
                          <th key={col} className="text-left text-[11px] font-semibold text-[var(--text-muted)] uppercase tracking-wider py-2.5 px-3 last:pr-0">
                            {col}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[var(--border-main)]">
                      {filteredToolsGroups.map((g) => (
                        <tr key={g.id} className="hover:bg-[var(--bg-hover)] transition-colors">
                          <td className="py-3 px-3 font-mono text-xs text-[var(--text-secondary)]">{g.code}</td>
                          <td className="py-3 px-3 font-medium text-[var(--text-primary)]">{g.name}</td>
                          <td className="py-3 px-3 font-mono text-xs text-[var(--text-secondary)]">{g.prefixToolsNo}</td>
                          <td className="py-3 px-3 font-mono text-xs text-[var(--text-secondary)]">{g.poPrefix}</td>
                          <td className="py-3 px-3 font-mono text-xs text-[var(--text-secondary)]">{g.grnPrefix}</td>
                          <td className="py-3 px-3 font-mono text-xs text-[var(--text-secondary)]">{g.indentPrefix}</td>
                          <td className="py-3 px-3">
                            <RoleGate permission="canEditMaster">
                              <div className="flex items-center gap-1">
                                <button onClick={() => handleOpenEditGroup(g)} className="p-1.5 hover:bg-[var(--bg-hover)] rounded-lg text-[var(--text-muted)] hover:text-[var(--text-primary)] transition-colors">
                                  <Edit2 className="w-3.5 h-3.5" />
                                </button>
                                <button onClick={() => handleDeleteGroup(g.id)} className="p-1.5 hover:bg-[var(--color-danger-bg)] rounded-lg text-[var(--text-muted)] hover:text-[var(--color-danger-text)] transition-colors">
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              </div>
                            </RoleGate>
                          </td>
                        </tr>
                      ))}
                      {filteredToolsGroups.length === 0 && (
                        <tr>
                          <td colSpan={7} className="py-8 text-center text-sm text-[var(--text-muted)]">
                            No groups found.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              ))}

            {tab === "Calib Frequency" &&
              (loading ? (
                <div className="p-4">
                  <TableSkeleton rows={4} />
                </div>
              ) : (
                <div className="overflow-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-[var(--border-main)] bg-[var(--bg-subtle)]">
                        {["Prod Tolerance Min", "Prod Tolerance Max", "Calib Frequency (months)", "Actions"].map((col) => (
                          <th key={col} className="text-left text-[11px] font-semibold text-[var(--text-muted)] uppercase tracking-wider py-2.5 px-3 last:pr-0">
                            {col}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[var(--border-main)]">
                      {filteredCalibFreqs.map((cf) => (
                        <tr key={cf.id} className="hover:bg-[var(--bg-hover)] transition-colors">
                          <td className="py-3 px-3 font-mono text-xs text-[var(--text-secondary)]">{cf.prodToleranceMin ?? "-"}</td>
                          <td className="py-3 px-3 font-mono text-xs text-[var(--text-secondary)]">{cf.prodToleranceMax ?? "-"}</td>
                          <td className="py-3 px-3 font-medium text-[var(--text-primary)]">{cf.calibFrequency ?? "-"}</td>
                          <td className="py-3 px-3">
                            <RoleGate permission="canDeleteMaster">
                              <button onClick={() => handleDeleteCalibFreq(cf.id)} className="p-1.5 hover:bg-[var(--color-danger-bg)] rounded-lg text-[var(--text-muted)] hover:text-[var(--color-danger-text)] transition-colors">
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </RoleGate>
                          </td>
                        </tr>
                      ))}
                      {filteredCalibFreqs.length === 0 && (
                        <tr>
                          <td colSpan={4} className="py-8 text-center text-sm text-[var(--text-muted)]">
                            No calibration frequency rows found.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              ))}

            {tab === "Tools Subgroups" &&
              (loading ? (
                <div className="p-4">
                  <TableSkeleton rows={4} />
                </div>
              ) : (
                <div className="overflow-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-[var(--border-main)] bg-[var(--bg-subtle)]">
                        {["Code", "Subgroup Name", "Parent Group Name", "Actions"].map((col) => (
                          <th key={col} className="text-left text-[11px] font-semibold text-[var(--text-muted)] uppercase tracking-wider py-2.5 px-3 last:pr-0">
                            {col}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[var(--border-main)]">
                      {filteredToolsSubgroups.map((sg) => (
                        <tr key={sg.id} className="hover:bg-[var(--bg-hover)] transition-colors">
                          <td className="py-3 px-3 font-mono text-xs text-[var(--text-secondary)]">{sg.code}</td>
                          <td className="py-3 px-3 font-medium text-[var(--text-primary)]">{sg.name}</td>
                          <td className="py-3 px-3 text-[var(--text-secondary)]">{sg.group?.name ?? "-"}</td>
                          <td className="py-3 px-3">
                            <RoleGate permission="canEditMaster">
                              <div className="flex items-center gap-1">
                                <button onClick={() => handleOpenEditSubgroup(sg)} className="p-1.5 hover:bg-[var(--bg-hover)] rounded-lg text-[var(--text-muted)] hover:text-[var(--text-primary)] transition-colors">
                                  <Edit2 className="w-3.5 h-3.5" />
                                </button>
                                <button onClick={() => handleDeleteSubgroup(sg.id)} className="p-1.5 hover:bg-[var(--color-danger-bg)] rounded-lg text-[var(--text-muted)] hover:text-[var(--color-danger-text)] transition-colors">
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              </div>
                            </RoleGate>
                          </td>
                        </tr>
                      ))}
                      {filteredToolsSubgroups.length === 0 && (
                        <tr>
                          <td colSpan={4} className="py-8 text-center text-sm text-[var(--text-muted)]">
                            No subgroups found.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              ))}
          </MasterTableCard>

          {(tab === "Tool Types" || tab === "Gauge Types") && renderInlineEditor()}
          {tab === "Calib Frequency" && renderCalibFreqEditor()}
        </main>
      </div>

      {/* ── Slide-over Modal for Groups & Subgroups ── */}
      {isSlideOpen && (
        <div className="fixed inset-0 z-50 overflow-hidden bg-black/40 backdrop-blur-xs flex justify-end animate-fade-in">
          <div className="w-full max-w-md bg-[var(--bg-card)] text-[var(--text-primary)] shadow-2xl flex flex-col h-full border-l border-[var(--border-main)] animate-slide-in-right">
            <div className="px-5 py-4 border-b border-[var(--border-main)] flex items-center justify-between">
              <h2 className="text-base font-bold text-[var(--text-primary)]">
                {tab === "Tools Groups"
                  ? editGroup
                    ? "Edit Group"
                    : "Add New Group"
                  : editSubgroup
                  ? "Edit Subgroup"
                  : "Add New Subgroup"}
              </h2>
              <button
                onClick={() => setIsSlideOpen(false)}
                className="w-8 h-8 rounded-lg hover:bg-[var(--bg-hover)] text-[var(--text-muted)] hover:text-[var(--text-primary)] flex items-center justify-center transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSaveSlide} className="flex-1 overflow-y-auto p-5 space-y-5">
              {tab === "Tools Groups" ? (
                <>
                  <div>
                    <label className="form-label">
                      Group Code *
                    </label>
                    <input
                      id="form-group-code"
                      value={groupCode}
                      onChange={(e) => setGroupCode(e.target.value)}
                      placeholder="e.g. MEQ"
                      className="form-control placeholder-[var(--text-muted)] font-mono uppercase"
                    />
                    {slideErrors.groupCode && <p className="text-[var(--color-danger-text)] text-xs mt-1 font-medium">{slideErrors.groupCode}</p>}
                  </div>
                  <div>
                    <label className="form-label">
                      Group Name *
                    </label>
                    <input
                      id="form-group-name"
                      value={groupName}
                      onChange={(e) => setGroupName(e.target.value)}
                      placeholder="e.g. Measuring Equip"
                      className="form-control placeholder-[var(--text-muted)]"
                    />
                    {slideErrors.groupName && <p className="text-[var(--color-danger-text)] text-xs mt-1 font-medium">{slideErrors.groupName}</p>}
                  </div>
                  <div>
                    <label className="form-label">
                      Prefix Tools Number *
                    </label>
                    <input
                      id="form-group-prefix"
                      value={groupPrefix}
                      onChange={(e) => setGroupPrefix(e.target.value)}
                      placeholder="e.g. TL-MIC"
                      className="form-control placeholder-[var(--text-muted)] font-mono"
                    />
                    {slideErrors.groupPrefix && <p className="text-[var(--color-danger-text)] text-xs mt-1 font-medium">{slideErrors.groupPrefix}</p>}
                  </div>
                  <div>
                    <label className="form-label">
                      PO Prefix *
                    </label>
                    <input
                      id="form-group-poprefix"
                      value={groupPoPrefix}
                      onChange={(e) => setGroupPoPrefix(e.target.value)}
                      placeholder="e.g. PO-MEQ"
                      className="form-control placeholder-[var(--text-muted)] font-mono"
                    />
                    {slideErrors.groupPoPrefix && <p className="text-[var(--color-danger-text)] text-xs mt-1 font-medium">{slideErrors.groupPoPrefix}</p>}
                  </div>
                  <div>
                    <label className="form-label">
                      GRN Prefix *
                    </label>
                    <input
                      id="form-group-grnprefix"
                      value={groupGrnPrefix}
                      onChange={(e) => setGroupGrnPrefix(e.target.value)}
                      placeholder="e.g. GRN-MEQ"
                      className="form-control placeholder-[var(--text-muted)] font-mono"
                    />
                    {slideErrors.groupGrnPrefix && <p className="text-[var(--color-danger-text)] text-xs mt-1 font-medium">{slideErrors.groupGrnPrefix}</p>}
                  </div>
                  <div>
                    <label className="form-label">
                      Indent Prefix *
                    </label>
                    <input
                      id="form-group-indentprefix"
                      value={groupIndentPrefix}
                      onChange={(e) => setGroupIndentPrefix(e.target.value)}
                      placeholder="e.g. IND-MEQ"
                      className="form-control placeholder-[var(--text-muted)] font-mono"
                    />
                    {slideErrors.groupIndentPrefix && <p className="text-[var(--color-danger-text)] text-xs mt-1 font-medium">{slideErrors.groupIndentPrefix}</p>}
                  </div>
                </>
              ) : (
                <>
                  <div>
                    <label className="form-label">
                      Subgroup Code *
                    </label>
                    <input
                      id="form-subg-code"
                      value={subCode}
                      onChange={(e) => setSubCode(e.target.value)}
                      placeholder="e.g. MIC"
                      className="form-control placeholder-[var(--text-muted)] font-mono uppercase"
                    />
                    {slideErrors.subCode && <p className="text-[var(--color-danger-text)] text-xs mt-1 font-medium">{slideErrors.subCode}</p>}
                  </div>
                  <div>
                    <label className="form-label">
                      Subgroup Name *
                    </label>
                    <input
                      id="form-subg-name"
                      value={subName}
                      onChange={(e) => setSubName(e.target.value)}
                      placeholder="e.g. Micrometers"
                      className="form-control placeholder-[var(--text-muted)]"
                    />
                    {slideErrors.subName && <p className="text-[var(--color-danger-text)] text-xs mt-1 font-medium">{slideErrors.subName}</p>}
                  </div>
                  <div>
                    <label className="form-label">
                      Parent Group *
                    </label>
                    <select
                      id="form-subg-parent"
                      value={subParentId}
                      onChange={(e) => setSubParentId(Number(e.target.value))}
                      className="form-control"
                    >
                      {toolsGroups.map((g) => (
                        <option key={g.id} value={g.id}>
                          {g.name}
                        </option>
                      ))}
                    </select>
                    {slideErrors.subParentId && <p className="text-[var(--color-danger-text)] text-xs mt-1 font-medium">{slideErrors.subParentId}</p>}
                  </div>
                </>
              )}

              <div className="border-t border-[var(--border-main)] pt-4 flex items-center justify-end gap-3 sticky bottom-0 bg-[var(--bg-card)]">
                <button type="button" onClick={() => setIsSlideOpen(false)} className="px-4 py-2 text-sm font-semibold text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-hover)] rounded-xl transition-all">
                  Cancel
                </button>
                <Button type="submit" variant="primary">
                  Save
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );

  function renderInlineEditor() {
    return (
      <RoleGate permission="canEditMaster">
        <div className="border border-dashed border-[var(--border-main)] rounded-2xl p-4 bg-[var(--bg-subtle)] mt-4">
          {isInlineAdding ? (
            <div className="space-y-3">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <input
                    id="inline-form-code"
                    value={inlineCode}
                    onChange={(e) => setInlineCode(e.target.value)}
                    placeholder="Code (e.g. TT05)"
                    className="form-control placeholder-[var(--text-muted)] font-mono uppercase"
                  />
                </div>
                <div>
                  <input
                    id="inline-form-name"
                    value={inlineName}
                    onChange={(e) => setInlineName(e.target.value)}
                    placeholder="Name (e.g. Pneumatic Tool)"
                    className="form-control placeholder-[var(--text-muted)]"
                  />
                </div>
                <div>
                  <input
                    id="inline-form-desc"
                    value={inlineDesc}
                    onChange={(e) => setInlineDesc(e.target.value)}
                    placeholder="Description"
                    className="form-control placeholder-[var(--text-muted)]"
                  />
                </div>
              </div>
              {inlineError && <p className="text-[var(--color-danger-text)] text-xs font-semibold">{inlineError}</p>}
              <div className="flex items-center justify-end gap-2.5">
                <button
                  onClick={() => setIsInlineAdding(false)}
                  className="px-3 py-1.5 text-xs font-bold text-[var(--text-muted)] hover:text-[var(--text-primary)] transition-colors"
                >
                  Cancel
                </button>
                <Button
                  id="inline-save-btn"
                  onClick={handleSaveInline}
                  variant="primary"
                  size="sm"
                >
                  <Check className="w-3.5 h-3.5" /> Save Row
                </Button>
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
              className="flex items-center gap-1.5 text-[var(--primary)] hover:underline font-bold text-xs"
            >
              <Plus className="w-4 h-4" /> Add Row
            </button>
          )}
        </div>
      </RoleGate>
    );
  }

  function renderCalibFreqEditor() {
    return (
      <RoleGate permission="canEditMaster">
        <div className="border border-dashed border-[var(--border-main)] rounded-2xl p-4 bg-[var(--bg-subtle)] mt-4">
          {cfAdding ? (
            <div className="space-y-3">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <input
                    id="cf-form-min"
                    value={cfMin}
                    onChange={(e) => setCfMin(e.target.value)}
                    placeholder="Prod Tolerance Min"
                    className="form-control placeholder-[var(--text-muted)] font-mono"
                  />
                </div>
                <div>
                  <input
                    id="cf-form-max"
                    value={cfMax}
                    onChange={(e) => setCfMax(e.target.value)}
                    placeholder="Prod Tolerance Max"
                    type="number"
                    className="form-control placeholder-[var(--text-muted)] font-mono"
                  />
                </div>
                <div>
                  <input
                    id="cf-form-freq"
                    value={cfFreq}
                    onChange={(e) => setCfFreq(e.target.value)}
                    placeholder="Frequency (months)"
                    type="number"
                    className="form-control placeholder-[var(--text-muted)] font-mono"
                  />
                </div>
              </div>
              {cfError && <p className="text-[var(--color-danger-text)] text-xs font-semibold">{cfError}</p>}
              <div className="flex items-center justify-end gap-2.5">
                <button
                  onClick={() => setCfAdding(false)}
                  className="px-3 py-1.5 text-xs font-bold text-[var(--text-muted)] hover:text-[var(--text-primary)] transition-colors"
                >
                  Cancel
                </button>
                <Button
                  id="cf-save-btn"
                  onClick={handleSaveCalibFreq}
                  variant="primary"
                  size="sm"
                >
                  <Check className="w-3.5 h-3.5" /> Save Row
                </Button>
              </div>
            </div>
          ) : (
            <button
              id="cf-add-row-btn"
              onClick={() => {
                setCfMin(""); setCfMax(""); setCfFreq("");
                setCfError("");
                setCfAdding(true);
              }}
              className="flex items-center gap-1.5 text-[var(--primary)] hover:underline font-bold text-xs"
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
          <tr className="border-b border-[var(--border-main)] bg-[var(--bg-subtle)]">
            {["Code", "Name", "Description", "Actions"].map((col) => (
              <th key={col} className="text-left text-[11px] font-semibold text-[var(--text-muted)] uppercase tracking-wider py-2.5 px-3 last:pr-0">
                {col}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-[var(--border-main)]">
          {rows.map((row) => (
            <tr key={row.id} className="hover:bg-[var(--bg-hover)] transition-colors">
              <td className="py-3 px-3 font-mono text-xs text-[var(--text-secondary)]">{row.code}</td>
              <td className="py-3 px-3 font-medium text-[var(--text-primary)]">{row.name}</td>
              <td className="py-3 px-3 text-[var(--text-secondary)]">{row.description}</td>
              <td className="py-3 px-3">
                <RoleGate permission="canEditMaster">
                  <button onClick={() => onDelete(row.id)} className="p-1.5 hover:bg-[var(--color-danger-bg)] rounded-lg text-[var(--text-muted)] hover:text-[var(--color-danger-text)] transition-colors">
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
