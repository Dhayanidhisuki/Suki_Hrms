"use client";

import { useState, useEffect, useCallback } from "react";
import { Plus, Search, Trash2, Edit2, Check, X, Eye, Tag, Layers, FolderTree, Hash } from "lucide-react";
import Sidebar from "@/app/dashboard/components/Sidebar";
import TopBar from "@/app/dashboard/components/TopBar";
import RoleGate from "@/app/dashboard/components/RoleGate";
import { TableSkeleton } from "@/app/dashboard/components/LoadingSkeleton";
import { ModuleKpiRow } from "@/app/dashboard/components/ModuleKpiRow";
import { apiGet, apiPost, apiPut, apiDelete } from "@/lib/apiClient";
import { Button } from "@/components/ui/button";
import { useSuccessOverlay } from "@/components/SuccessOverlay";

interface ToolsGroup {
  id: number;
  code: string;
  name: string;
  prefixToolsNo?: string | null;
}

interface ToolsSubgroup {
  id: number;
  rowId: number;
  code: string;
  name: string;
  refGroupId: number | null;
  prefixToolsNo?: string | null;
  isAutoGenCd?: string | null;
  prefixBased?: string | null;
  creatUserIdCd?: string | null;
  creatDt?: string | null;
  lstUpdtUserIdCd?: string | null;
  lstUpdtTs?: string | null;
  group?: { id: number; code: string; name: string; prefixToolsNo?: string | null } | null;
}

function formatDate(value: string | null | undefined) {
  if (!value) return "—";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleDateString("en-IN");
}

export default function ToolsSubgroupPage() {
  const { showSuccess } = useSuccessOverlay();
  const [subgroups, setSubgroups] = useState<ToolsSubgroup[]>([]);
  const [groups, setGroups] = useState<ToolsGroup[]>([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState("");
  const [bannerMsg, setBannerMsg] = useState<{ type: "success" | "error"; text: string } | null>(null);

  // Modal / Form state
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedDetail, setSelectedDetail] = useState<ToolsSubgroup | null>(null);
  const [editSubgroup, setEditSubgroup] = useState<ToolsSubgroup | null>(null);

  const [name, setName] = useState("");
  const [refGroupId, setRefGroupId] = useState<number | "">("");
  const [prefixToolsNo, setPrefixToolsNo] = useState("");
  const [isAutoGenCd, setIsAutoGenCd] = useState("No");
  const [prefixBased, setPrefixBased] = useState("");
  const [formErrors, setFormErrors] = useState<Record<string, string>>({});

  const loadData = useCallback(async () => {
    setLoading(true);
    const [sgRes, grRes] = await Promise.all([
      apiGet<{ items: ToolsSubgroup[] }>("/api/lookups/subgroups"),
      apiGet<{ items: ToolsGroup[] }>("/api/lookups/groups"),
    ]);
    if (sgRes.data?.items) setSubgroups(sgRes.data.items);
    if (grRes.data?.items) setGroups(grRes.data.items);
    setLoading(false);
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    loadData();
  }, [loadData]);

  const handleOpenAdd = () => {
    setEditSubgroup(null);
    setName("");
    setRefGroupId(groups[0]?.id ?? "");
    setPrefixToolsNo("");
    setIsAutoGenCd("No");
    setPrefixBased("");
    setFormErrors({});
    setIsModalOpen(true);
  };

  const handleOpenEdit = (sg: ToolsSubgroup) => {
    setEditSubgroup(sg);
    setName(sg.name);
    setRefGroupId(sg.refGroupId ?? "");
    setPrefixToolsNo(sg.prefixToolsNo ?? "");
    setIsAutoGenCd(sg.isAutoGenCd === "Yes" ? "Yes" : "No");
    setPrefixBased(sg.prefixBased ?? "");
    setFormErrors({});
    setIsModalOpen(true);
  };

  const handleDelete = async (id: number) => {
    if (!confirm("Are you sure you want to delete this subgroup?")) return;
    const res = await apiDelete(`/api/lookups/subgroups/${id}`);
    if (res.error) {
      setBannerMsg({ type: "error", text: res.error.message });
      return;
    }
    setBannerMsg({ type: "success", text: "Subgroup deleted successfully." });
    loadData();
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    const errors: Record<string, string> = {};

    if (!name.trim()) errors.name = "Subgroup Name is required";
    if (refGroupId === "") errors.refGroupId = "Parent Group is required";

    if (Object.keys(errors).length > 0) {
      setFormErrors(errors);
      return;
    }

    const payload = {
      name: name.trim(),
      qmsOtherTypeOfTools: name.trim(),
      refGroupId: Number(refGroupId),
      prefixToolsNo: prefixToolsNo.trim() || undefined,
      isAutoGenCd,
      prefixBased: prefixBased.trim() || undefined,
    };

    setBannerMsg(null);
    const res = editSubgroup
      ? await apiPut(`/api/lookups/subgroups/${editSubgroup.id}`, payload)
      : await apiPost("/api/lookups/subgroups", payload);

    if (res.error) {
      setBannerMsg({ type: "error", text: res.error.message });
      return;
    }

    setBannerMsg({ type: "success", text: editSubgroup ? "Subgroup updated." : "Subgroup created." });
    showSuccess({
      title: "Record saved",
      message: editSubgroup
        ? "Tools subgroup updated successfully."
        : "Tools subgroup created successfully.",
      detail: name.trim() || undefined,
    });
    setIsModalOpen(false);
    loadData();
  };

  const filtered = subgroups.filter((sg) => {
    const q = query.toLowerCase();
    const parentName = sg.group?.name || "";
    return (
      sg.name.toLowerCase().includes(q) ||
      (sg.prefixToolsNo || "").toLowerCase().includes(q) ||
      parentName.toLowerCase().includes(q)
    );
  });

  const selectedGroup = groups.find((g) => g.id === refGroupId);
  const selectedGroupPrefix = selectedGroup?.prefixToolsNo || "";

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
                  ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                  : "bg-red-50 text-red-700 border border-red-200"
              }`}
            >
              {bannerMsg.text}
              <button onClick={() => setBannerMsg(null)} className="ml-auto text-xs opacity-60 hover:opacity-100">
                ✕
              </button>
            </div>
          )}

          {/* ── Header ── */}
          <div className="flex items-center justify-between mb-6">
            <div>
              <h1 className="text-2xl font-bold text-[var(--text-primary)] tracking-tight">
                Tool Subgroup
              </h1>
              <p className="text-sm text-[var(--text-muted)] mt-0.5">
                Manage tool subgroups linked to each parent tools group
              </p>
            </div>
            <RoleGate permission="canEditMaster">
              <Button onClick={handleOpenAdd} variant="primary" className="group">
                <Plus className="w-4 h-4 transition-transform group-hover:rotate-90 duration-200" />
                Add Subgroup
              </Button>
            </RoleGate>
          </div>

          {/* ── Module KPI Cards ── */}
          <ModuleKpiRow
            items={[
              {
                id: "total-subgroups",
                label: "Total Subgroups",
                value: subgroups.length,
                subtext: "Registered tool subgroups",
                icon: FolderTree,
                iconBg: "bg-[var(--primary-light)]",
                iconColor: "text-[var(--primary)]",
                badge: { label: "Subgroups", type: "info" },
              },
              {
                id: "parent-groups",
                label: "Parent Groups",
                value: groups.length,
                subtext: "Main tool group classifications",
                icon: Layers,
                iconBg: "bg-emerald-50 dark:bg-emerald-950/30",
                iconColor: "text-emerald-600 dark:text-emerald-400",
                badge: { label: "Parents", type: "success" },
              },
              {
                id: "auto-gen",
                label: "Auto-Gen Numbering",
                value: subgroups.filter((sg) => sg.isAutoGenCd === "Yes").length,
                subtext: "Subgroups with auto code generation",
                icon: Tag,
                iconBg: "bg-blue-50 dark:bg-blue-950/30",
                iconColor: "text-blue-600 dark:text-blue-400",
                badge: { label: "Auto", type: "info" },
              },
              {
                id: "with-prefix",
                label: "With Tool No Prefix",
                value: subgroups.filter((sg) => (sg.prefixToolsNo ?? "").trim() !== "").length,
                subtext: "Subgroups defining a tools no prefix",
                icon: Hash,
                iconBg: "bg-amber-50 dark:bg-amber-950/30",
                iconColor: "text-amber-600 dark:text-amber-400",
                badge: { label: "Prefix", type: "warning" },
              },
            ]}
          />

          {/* ── Filter & Search Card ── */}
          <div className="bg-[var(--bg-card)] rounded-2xl border border-[var(--border-main)] p-5 mb-6">
            <div className="relative max-w-sm">
              <Search className="w-4 h-4 text-[var(--text-muted)] absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search subgroup name, prefix, parent group..."
                className="w-full text-sm border border-[var(--border-main)] rounded-lg pl-9 pr-3 py-2 outline-none focus:ring-2 focus:ring-[var(--primary-subtle)] focus:border-[var(--primary)] bg-[var(--bg-subtle)] text-[var(--text-primary)] placeholder-[var(--text-muted)]"
              />
            </div>
          </div>

          {/* ── Data Table Card ── */}
          <div className="bg-[var(--bg-card)] rounded-2xl border border-[var(--border-main)] p-5 animate-fade-in">
            {loading ? (
              <TableSkeleton rows={5} />
            ) : (
              <div className="overflow-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-[var(--border-main)] bg-[var(--bg-subtle)]">
                      {["Subgroup Name", "Parent Group", "Prefix Tools No", "Created By", "Created Date", "Actions"].map((col) => (
                        <th key={col} className="text-left text-[11px] font-semibold text-[var(--text-muted)] uppercase tracking-wider py-2.5 px-3">
                          {col}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[var(--border-main)]">
                    {filtered.map((sg) => (
                      <tr key={sg.id} className="hover:bg-[var(--bg-hover)] transition-colors group">
                        <td className="py-3.5 px-3 font-semibold text-[var(--text-primary)]">
                          <button
                            onClick={() => setSelectedDetail(sg)}
                            className="text-left font-semibold hover:text-[var(--primary)] hover:underline flex items-center gap-1.5 cursor-pointer"
                          >
                            {sg.name}
                          </button>
                        </td>
                        <td className="py-3.5 px-3 text-[var(--text-secondary)] font-medium">{sg.group?.name || "—"}</td>
                        <td className="py-3.5 px-3 font-mono text-xs text-[var(--text-secondary)]">
                          {(sg.prefixToolsNo ?? "").trim() || "—"}
                        </td>
                        <td className="py-3.5 px-3 text-[var(--text-secondary)]">{sg.creatUserIdCd || "—"}</td>
                        <td className="py-3.5 px-3 text-[var(--text-secondary)]">{formatDate(sg.creatDt)}</td>
                        <td className="py-3.5 px-3">
                          <div className="flex items-center gap-1">
                            <button
                              onClick={() => setSelectedDetail(sg)}
                              title="View Details"
                              className="p-1.5 hover:bg-[var(--bg-hover)] rounded-lg text-[var(--text-muted)] hover:text-[var(--primary)] transition-colors cursor-pointer"
                            >
                              <Eye className="w-4 h-4" />
                            </button>
                            <RoleGate permission="canEditMaster">
                              <button onClick={() => handleOpenEdit(sg)} title="Edit" className="p-1.5 hover:bg-[var(--bg-hover)] rounded-lg text-[var(--text-muted)] hover:text-[var(--text-primary)] transition-colors cursor-pointer">
                                <Edit2 className="w-4 h-4" />
                              </button>
                              <button onClick={() => handleDelete(sg.id)} title="Delete" className="p-1.5 hover:bg-red-50 rounded-lg text-[var(--text-muted)] hover:text-red-600 transition-colors cursor-pointer">
                                <Trash2 className="w-4 h-4" />
                              </button>
                            </RoleGate>
                          </div>
                        </td>
                      </tr>
                    ))}
                    {filtered.length === 0 && (
                      <tr>
                        <td colSpan={6} className="py-8 text-center text-sm text-[var(--text-muted)]">
                          No subgroups found.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </main>
      </div>

      {/* ── Add / Edit Modal ── */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 overflow-hidden bg-black/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="w-full max-w-md bg-[var(--bg-card)] rounded-2xl border border-[var(--border-main)] shadow-2xl overflow-hidden animate-fade-in">
            <div className="px-5 py-4 border-b border-[var(--border-main)] flex items-center justify-between">
              <h2 className="text-base font-bold text-[var(--text-primary)]">
                {editSubgroup ? "Edit Subgroup" : "Add Subgroup"}
              </h2>
              <button onClick={() => setIsModalOpen(false)} className="text-[var(--text-muted)] hover:text-[var(--text-primary)]">
                <X className="w-5 h-5" />
              </button>
            </div>
            <form onSubmit={handleSave} className="p-5 space-y-4">
              <div>
                <label className="block text-xs font-semibold text-[var(--text-muted)] uppercase tracking-wider mb-1">Subgroup Name *</label>
                <input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. ANALOG AIR GAUGE" className="w-full text-sm border border-[var(--border-main)] rounded-lg px-3 py-2 bg-[var(--bg-subtle)] text-[var(--text-primary)]" />
                {formErrors.name && <p className="text-red-500 text-xs mt-1">{formErrors.name}</p>}
              </div>
              <div>
                <label className="block text-xs font-semibold text-[var(--text-muted)] uppercase tracking-wider mb-1">Parent Group *</label>
                <select value={refGroupId} onChange={(e) => setRefGroupId(Number(e.target.value))} className="w-full text-sm border border-[var(--border-main)] rounded-lg px-3 py-2 bg-[var(--bg-subtle)] text-[var(--text-primary)] font-medium">
                  {groups.map((g) => (
                    <option key={g.id} value={g.id}>
                      {g.name}
                    </option>
                  ))}
                </select>
                {formErrors.refGroupId && <p className="text-red-500 text-xs mt-1">{formErrors.refGroupId}</p>}
                {selectedGroupPrefix && (
                  <p className="text-[11px] text-[var(--text-muted)] mt-1">
                    Group Prefix: <span className="font-mono">{selectedGroupPrefix}</span>
                  </p>
                )}
              </div>
              <div>
                <label className="block text-xs font-semibold text-[var(--text-muted)] uppercase tracking-wider mb-1">Prefix Tools No</label>
                <input value={prefixToolsNo} onChange={(e) => setPrefixToolsNo(e.target.value)} maxLength={12} placeholder="e.g. MIC" className="w-full text-sm border border-[var(--border-main)] rounded-lg px-3 py-2 bg-[var(--bg-subtle)] text-[var(--text-primary)] font-mono" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-[var(--text-muted)] uppercase tracking-wider mb-1">Is Auto Generate Code?</label>
                  <select value={isAutoGenCd} onChange={(e) => setIsAutoGenCd(e.target.value)} className="w-full text-sm border border-[var(--border-main)] rounded-lg px-3 py-2 bg-[var(--bg-subtle)] text-[var(--text-primary)] font-medium">
                    <option value="Yes">Yes</option>
                    <option value="No">No</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-[var(--text-muted)] uppercase tracking-wider mb-1">Prefix Based</label>
                  <input value={prefixBased} onChange={(e) => setPrefixBased(e.target.value)} maxLength={10} placeholder="e.g. Group" className="w-full text-sm border border-[var(--border-main)] rounded-lg px-3 py-2 bg-[var(--bg-subtle)] text-[var(--text-primary)]" />
                </div>
              </div>
              <div className="pt-3 border-t border-[var(--border-main)] flex justify-end gap-2">
                <button type="button" onClick={() => setIsModalOpen(false)} className="px-4 py-2 text-xs font-semibold text-[var(--text-muted)] hover:text-[var(--text-primary)]">
                  Cancel
                </button>
                <Button type="submit" variant="primary" size="sm">
                  <Check className="w-4 h-4" /> Save Subgroup
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
      {/* ── View Detail Modal ── */}
      {selectedDetail && (
        <div className="fixed inset-0 z-50 overflow-hidden bg-black/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="w-full max-w-lg bg-[var(--bg-card)] rounded-2xl border border-[var(--border-main)] shadow-2xl overflow-hidden animate-fade-in">
            <div className="px-6 py-4 border-b border-[var(--border-main)] flex items-center justify-between bg-[var(--bg-subtle)]">
              <div>
                <span className="font-mono text-xs font-bold text-[var(--primary)] bg-[var(--primary-light)] px-2 py-0.5 rounded">
                  {selectedDetail.code}
                </span>
                <h2 className="text-lg font-bold text-[var(--text-primary)] mt-1">
                  {selectedDetail.name}
                </h2>
              </div>
              <button
                onClick={() => setSelectedDetail(null)}
                className="p-1.5 rounded-lg text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-hover)]"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 space-y-4 text-sm">
              <div className="grid grid-cols-2 gap-4 bg-[var(--bg-subtle)] p-4 rounded-xl border border-[var(--border-main)]">
                <div>
                  <p className="text-xs text-[var(--text-muted)] font-semibold uppercase tracking-wider">Subgroup Name</p>
                  <p className="font-semibold text-[var(--text-primary)] mt-1">{selectedDetail.name}</p>
                </div>
                <div>
                  <p className="text-xs text-[var(--text-muted)] font-semibold uppercase tracking-wider">Parent Group</p>
                  <p className="font-medium text-[var(--text-primary)] mt-1">{selectedDetail.group?.name || "—"}</p>
                </div>
                <div>
                  <p className="text-xs text-[var(--text-muted)] font-semibold uppercase tracking-wider">Prefix Tools No</p>
                  <p className="font-mono text-[var(--text-primary)] mt-1">{(selectedDetail.prefixToolsNo ?? "").trim() || "—"}</p>
                </div>
                <div>
                  <p className="text-xs text-[var(--text-muted)] font-semibold uppercase tracking-wider">Group Prefix</p>
                  <p className="font-mono text-[var(--text-primary)] mt-1">{(selectedDetail.group?.prefixToolsNo ?? "").trim() || "—"}</p>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4 pt-1">
                <div className="p-3 border border-[var(--border-main)] rounded-xl">
                  <p className="text-xs text-[var(--text-muted)] font-semibold uppercase tracking-wider">Auto Generate Code</p>
                  <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-[var(--primary-light)] text-[var(--primary)] mt-1">
                    {selectedDetail.isAutoGenCd || "—"}
                  </span>
                </div>
                <div className="p-3 border border-[var(--border-main)] rounded-xl">
                  <p className="text-xs text-[var(--text-muted)] font-semibold uppercase tracking-wider">Prefix Based</p>
                  <p className="font-medium text-[var(--text-primary)] mt-1">{selectedDetail.prefixBased || "—"}</p>
                </div>
              </div>

              {/* Audit fields — display only */}
              <div className="grid grid-cols-2 gap-4 pt-1">
                <div className="p-3 border border-[var(--border-main)] rounded-xl">
                  <p className="text-xs text-[var(--text-muted)] font-semibold uppercase tracking-wider">Created By</p>
                  <p className="font-medium text-[var(--text-primary)] mt-1">
                    {selectedDetail.creatUserIdCd || "—"}
                    <span className="text-[var(--text-muted)] font-normal"> · {formatDate(selectedDetail.creatDt)}</span>
                  </p>
                </div>
                <div className="p-3 border border-[var(--border-main)] rounded-xl">
                  <p className="text-xs text-[var(--text-muted)] font-semibold uppercase tracking-wider">Last Updated By</p>
                  <p className="font-medium text-[var(--text-primary)] mt-1">
                    {selectedDetail.lstUpdtUserIdCd || "—"}
                    <span className="text-[var(--text-muted)] font-normal"> · {formatDate(selectedDetail.lstUpdtTs)}</span>
                  </p>
                </div>
              </div>
            </div>

            <div className="px-6 py-4 border-t border-[var(--border-main)] bg-[var(--bg-subtle)] flex items-center justify-end gap-3">
              <button
                onClick={() => setSelectedDetail(null)}
                className="px-4 py-2 text-xs font-semibold text-[var(--text-muted)] hover:text-[var(--text-primary)]"
              >
                Close
              </button>
              <RoleGate permission="canEditMaster">
                <Button
                  onClick={() => {
                    const item = selectedDetail;
                    setSelectedDetail(null);
                    handleOpenEdit(item);
                  }}
                  variant="primary"
                  size="sm"
                >
                  <Edit2 className="w-4 h-4" /> Edit Subgroup
                </Button>
              </RoleGate>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
