"use client";

import { useState, useEffect, useCallback } from "react";
import { Plus, Trash2, Edit2, Check, X, Eye, Layers, Package, FileText, CheckCircle2, FileSpreadsheet } from "lucide-react";
import Sidebar from "@/app/dashboard/components/Sidebar";
import TopBar from "@/app/dashboard/components/TopBar";
import RoleGate from "@/app/dashboard/components/RoleGate";
import { TableSkeleton } from "@/app/dashboard/components/LoadingSkeleton";
import { ModuleKpiRow } from "@/app/dashboard/components/ModuleKpiRow";
import { apiGet, apiPost, apiPut, apiDelete } from "@/lib/apiClient";
import { Button } from "@/components/ui/button";
import { MasterSearchInput, MasterTableCard } from "@/components/ui/MasterTableCard";
import { toastSuccess, toastError } from "@/lib/appToast";
import { downloadExcel } from "@/lib/downloadExcel";

interface ToolsGroup {
  id: number;
  code: string;
  name: string;
  prefixToolsNo: string | null;
  poPrefix: string | null;
  grnPrefix: string | null;
  indentPrefix: string | null;
  itemNoPrefixMod: string | null;
  prefixGateEntry: string | null;
  createdDate?: string | null;
  updateBy?: string | null;
}

export default function ToolsGroupPage() {
  const [groups, setGroups] = useState<ToolsGroup[]>([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState("");

  // Modal / Form state
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedDetail, setSelectedDetail] = useState<ToolsGroup | null>(null);
  const [editGroup, setEditGroup] = useState<ToolsGroup | null>(null);

  const [name, setName] = useState("");
  const [prefixToolsNo, setPrefixToolsNo] = useState("");
  const [poPrefix, setPoPrefix] = useState("");
  const [grnPrefix, setGrnPrefix] = useState("");
  const [indentPrefix, setIndentPrefix] = useState("");
  const [itemNoPrefixMod, setItemNoPrefixMod] = useState("Yes");
  const [prefixGateEntry, setPrefixGateEntry] = useState("");
  const [formErrors, setFormErrors] = useState<Record<string, string>>({});

  const loadGroups = useCallback(async () => {
    setLoading(true);
    const res = await apiGet<{ items: ToolsGroup[] }>("/api/lookups/groups");
    if (res.data?.items) setGroups(res.data.items);
    setLoading(false);
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    loadGroups();
  }, [loadGroups]);

  const handleOpenAdd = () => {
    setEditGroup(null);
    setName("");
    setPrefixToolsNo("");
    setPoPrefix("");
    setGrnPrefix("");
    setIndentPrefix("");
    setItemNoPrefixMod("Yes");
    setPrefixGateEntry("");
    setFormErrors({});
    setIsModalOpen(true);
  };

  const handleOpenEdit = (g: ToolsGroup) => {
    setEditGroup(g);
    setName(g.name);
    setPrefixToolsNo(g.prefixToolsNo ?? "");
    setPoPrefix(g.poPrefix ?? "");
    setGrnPrefix(g.grnPrefix ?? "");
    setIndentPrefix(g.indentPrefix ?? "");
    setItemNoPrefixMod(g.itemNoPrefixMod || "Yes");
    setPrefixGateEntry(g.prefixGateEntry ?? "");
    setFormErrors({});
    setIsModalOpen(true);
  };

  const handleDelete = async (id: number) => {
    if (!confirm("Are you sure you want to delete this group?")) return;
    const res = await apiDelete(`/api/lookups/groups/${id}`);
    if (res.error) {
      toastError(res.error.message);
      return;
    }
    toastSuccess("Group deleted successfully.");
    loadGroups();
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    const errors: Record<string, string> = {};

    if (!name.trim()) errors.name = "Group Name is required";

    if (Object.keys(errors).length > 0) {
      setFormErrors(errors);
      return;
    }

    const payload = {
      name: name.trim(),
      otherType: name.trim(),
      prefixToolsNo: prefixToolsNo.trim() || undefined,
      poPrefix,
      grnPrefix,
      indentPrefix,
      itemNoPrefixMod,
      prefixGateEntry,
    };

    const res = editGroup
      ? await apiPut(`/api/lookups/groups/${editGroup.id}`, payload)
      : await apiPost("/api/lookups/groups", payload);

    if (res.error) {
      toastError(res.error.message);
      return;
    }

    toastSuccess({
      title: "Record saved",
      message: editGroup ? "Tools group updated successfully." : "Tools group created successfully.",
      detail: name.trim() || undefined,
    });
    setIsModalOpen(false);
    loadGroups();
  };

  const filtered = groups.filter((g) => {
    const q = query.toLowerCase();
    return (
      g.name.toLowerCase().includes(q) ||
      g.code.toLowerCase().includes(q) ||
      (g.prefixToolsNo || "").toLowerCase().includes(q)
    );
  });

  const handleExportExcel = () => {
    downloadExcel({
      filename: "tools_groups",
      sheetName: "Tool Groups",
      columns: [
        { key: "name", label: "Item/Asset Group" },
        { key: "createdDate", label: "Created Date", value: (g) => (g.createdDate ? String(g.createdDate).split("T")[0] : "") },
        { key: "poPrefix", label: "PO Prefix" },
        { key: "indentPrefix", label: "Indent Prefix" },
        { key: "grnPrefix", label: "GRN Prefix" },
        { key: "prefixToolsNo", label: "Item No.Prefix" },
        { key: "prefixGateEntry", label: "Gate Entry Prefix" },
        { key: "itemNoPrefixMod", label: "Item No. Prefix modification" },
        { key: "updateBy", label: "Update By" },
      ],
      rows: filtered,
    });
    toastSuccess("Excel downloaded.");
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
                Tools Group
              </h1>
              <p className="text-sm text-[var(--text-muted)] mt-0.5">
                Manage top-level tools groups and numbering prefixes
              </p>
            </div>
            <div className="flex items-center gap-2">
              <RoleGate module="tool_group" action="CREATE">
                <Button onClick={handleOpenAdd} variant="primary" className="group">
                  <Plus className="w-4 h-4 transition-transform group-hover:rotate-90 duration-200" />
                  Add Group
                </Button>
              </RoleGate>
            </div>
          </div>

          {/* ── Module KPI Cards ── */}
          <ModuleKpiRow
            items={[
              {
                id: "total-groups",
                label: "Total Tools Groups",
                value: groups.length,
                subtext: "Main classification categories",
                icon: Layers,
                iconBg: "bg-[var(--primary-light)]",
                iconColor: "text-[var(--primary)]",
                badge: { label: "Active", type: "info" },
              },
              {
                id: "prefix-configured",
                label: "Tools Prefixes Set",
                value: groups.filter((g) => g.prefixToolsNo).length,
                subtext: "Auto-numbering rules active",
                icon: Package,
                iconBg: "bg-emerald-50 dark:bg-emerald-950/30",
                iconColor: "text-emerald-600 dark:text-emerald-400",
                badge: { label: "Configured", type: "success" },
              },
              {
                id: "po-prefixes",
                label: "PO / GRN Prefixes",
                value: groups.filter((g) => g.poPrefix || g.grnPrefix).length,
                subtext: "Document sequence prefixes",
                icon: FileText,
                iconBg: "bg-blue-50 dark:bg-blue-950/30",
                iconColor: "text-blue-600 dark:text-blue-400",
                badge: { label: "Documents", type: "info" },
              },
              {
                id: "indent-prefixes",
                label: "Indent Sequences",
                value: groups.filter((g) => g.indentPrefix).length,
                subtext: "Purchase indent rules",
                icon: CheckCircle2,
                iconBg: "bg-amber-50 dark:bg-amber-950/30",
                iconColor: "text-amber-600 dark:text-amber-400",
                badge: { label: "Purchase", type: "warning" },
              },
            ]}
          />

          <MasterTableCard
            toolbar={
              <>
                <MasterSearchInput
                  id="tools-group-search-input"
                  value={query}
                  onChange={setQuery}
                  placeholder="Search group name or Item No.Prefix..."
                />
                <div className="flex items-center gap-1.5 shrink-0">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="h-7 !rounded-md !px-2 !text-[11px]"
                    title="Export Excel"
                    onClick={handleExportExcel}
                    disabled={loading || filtered.length === 0}
                  >
                    <FileSpreadsheet className="w-3 h-3" />
                    Excel
                  </Button>
                </div>
              </>
            }
          >
            {loading ? (
              <div className="p-4">
                <TableSkeleton rows={5} />
              </div>
            ) : (
              <div className="overflow-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-[var(--border-main)] bg-[var(--bg-subtle)]">
                      {["Description (Item/Asset Group)", "Tool Group Prefix", "Created Date", "Gate Entry", "Prefix Mod", "PO Prefix", "GRN Prefix", "Indent Prefix", "Update By", "Actions"].map((col) => (
                        <th key={col} className="text-left text-[11px] font-semibold text-[var(--text-muted)] uppercase tracking-wider py-2.5 px-3">
                          {col}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[var(--border-main)]">
                    {filtered.map((g) => (
                      <tr key={g.id} className="hover:bg-[var(--bg-hover)] transition-colors group">
                        <td className="py-3.5 px-3 font-semibold text-[var(--text-primary)]">
                          <button
                            onClick={() => setSelectedDetail(g)}
                            className="text-left font-semibold hover:text-[var(--primary)] hover:underline flex items-center gap-1.5 cursor-pointer"
                          >
                            {g.name}
                          </button>
                        </td>
                        <td className="py-3.5 px-3 font-mono text-xs text-[var(--text-muted)]">{g.prefixToolsNo || "—"}</td>
                        <td className="py-3.5 px-3 font-mono text-xs text-[var(--text-muted)]">
                          {g.createdDate ? g.createdDate.split("T")[0] : "—"}
                        </td>
                        <td className="py-3.5 px-3 font-mono text-xs text-[var(--text-muted)]">{g.prefixGateEntry || "—"}</td>
                        <td className="py-3.5 px-3 text-[var(--text-secondary)]">{g.itemNoPrefixMod || "—"}</td>
                        <td className="py-3.5 px-3 font-mono text-xs text-[var(--text-muted)]">{g.poPrefix || "—"}</td>
                        <td className="py-3.5 px-3 font-mono text-xs text-[var(--text-muted)]">{g.grnPrefix || "—"}</td>
                        <td className="py-3.5 px-3 font-mono text-xs text-[var(--text-muted)]">{g.indentPrefix || "—"}</td>
                        <td className="py-3.5 px-3 text-xs text-[var(--text-secondary)]">{g.updateBy || "—"}</td>
                        <td className="py-3.5 px-3">
                          <div className="flex items-center gap-1">
                            <button
                              onClick={() => setSelectedDetail(g)}
                              title="View Details"
                              className="p-1.5 hover:bg-[var(--bg-hover)] rounded-lg text-[var(--text-muted)] hover:text-[var(--primary)] transition-colors cursor-pointer"
                            >
                              <Eye className="w-4 h-4" />
                            </button>
                            <RoleGate module="tool_group" action="DELETE">
                              <button onClick={() => handleOpenEdit(g)} title="Edit" className="p-1.5 hover:bg-[var(--bg-hover)] rounded-lg text-[var(--text-muted)] hover:text-[var(--text-primary)] transition-colors cursor-pointer">
                                <Edit2 className="w-4 h-4" />
                              </button>
                              <button onClick={() => handleDelete(g.id)} title="Delete" className="p-1.5 hover:bg-red-50 rounded-lg text-[var(--text-muted)] hover:text-red-600 transition-colors cursor-pointer">
                                <Trash2 className="w-4 h-4" />
                              </button>
                            </RoleGate>
                          </div>
                        </td>
                      </tr>
                    ))}
                    {filtered.length === 0 && (
                      <tr>
                        <td colSpan={10} className="py-8 text-center text-sm text-[var(--text-muted)]">
                          No tools groups found.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            )}
          </MasterTableCard>
        </main>
      </div>

      {/* ── Add / Edit Modal ── */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 overflow-hidden bg-black/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="w-full max-w-md bg-[var(--bg-card)] rounded-2xl border border-[var(--border-main)] shadow-2xl overflow-hidden animate-fade-in">
            <div className="px-5 py-4 border-b border-[var(--border-main)] flex items-center justify-between">
              <h2 className="text-base font-bold text-[var(--text-primary)]">
                {editGroup ? "Edit Group" : "Add Group"}
              </h2>
              <button onClick={() => setIsModalOpen(false)} className="text-[var(--text-muted)] hover:text-[var(--text-primary)]">
                <X className="w-5 h-5" />
              </button>
            </div>
            <form onSubmit={handleSave} className="p-5 space-y-5">
              <div>
                <label className="form-label">Description (Item/Asset Group) *</label>
                <input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Measuring Equipment" className="form-control" />
                {formErrors.name && <p className="text-red-500 text-xs mt-1">{formErrors.name}</p>}
                <p className="text-[10px] text-[var(--text-muted)] mt-1">
                  Listed first — same order as Item/Asset Master (Description → Group → Type).
                </p>
              </div>
              <div>
                <label className="form-label">Tool Group Prefix (Item No.Prefix)</label>
                <input value={prefixToolsNo} onChange={(e) => setPrefixToolsNo(e.target.value)} placeholder="e.g. TL-MIC" className="form-control font-mono" />
              </div>
              <div className="form-grid">
                <div>
                  <label className="form-label">Gate Entry Prefix</label>
                  <input value={prefixGateEntry} onChange={(e) => setPrefixGateEntry(e.target.value)} placeholder="e.g. GE-MEQ" className="form-control font-mono" />
                </div>
                <div>
                  <label className="form-label">Item No. Prefix Modification</label>
                  <select value={itemNoPrefixMod} onChange={(e) => setItemNoPrefixMod(e.target.value)} className="form-control font-medium">
                    <option value="Yes">Yes</option>
                    <option value="No">No</option>
                  </select>
                </div>
              </div>
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block text-[10px] font-semibold text-[var(--text-muted)] uppercase mb-1">PO Prefix</label>
                  <input value={poPrefix} onChange={(e) => setPoPrefix(e.target.value)} placeholder="PO-MEQ" className="w-full text-xs border border-[var(--border-main)] rounded-lg px-2.5 py-1.5 bg-[var(--bg-subtle)] text-[var(--text-primary)] font-mono" />
                </div>
                <div>
                  <label className="block text-[10px] font-semibold text-[var(--text-muted)] uppercase mb-1">GRN Prefix</label>
                  <input value={grnPrefix} onChange={(e) => setGrnPrefix(e.target.value)} placeholder="GRN-MEQ" className="w-full text-xs border border-[var(--border-main)] rounded-lg px-2.5 py-1.5 bg-[var(--bg-subtle)] text-[var(--text-primary)] font-mono" />
                </div>
                <div>
                  <label className="block text-[10px] font-semibold text-[var(--text-muted)] uppercase mb-1">Indent Prefix</label>
                  <input value={indentPrefix} onChange={(e) => setIndentPrefix(e.target.value)} placeholder="IND-MEQ" className="w-full text-xs border border-[var(--border-main)] rounded-lg px-2.5 py-1.5 bg-[var(--bg-subtle)] text-[var(--text-primary)] font-mono" />
                </div>
              </div>
              <div className="pt-3 border-t border-[var(--border-main)] flex justify-end gap-2">
                <button type="button" onClick={() => setIsModalOpen(false)} className="px-4 py-2 text-xs font-semibold text-[var(--text-muted)] hover:text-[var(--text-primary)]">
                  Cancel
                </button>
                <Button type="submit" variant="primary" size="sm">
                  <Check className="w-4 h-4" /> Save Group
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
                {selectedDetail.prefixToolsNo ? (
                  <span className="font-mono text-xs font-bold text-[var(--primary)] bg-[var(--primary-light)] px-2 py-0.5 rounded">
                    {selectedDetail.prefixToolsNo}
                  </span>
                ) : null}
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
                  <p className="text-xs text-[var(--text-muted)] font-semibold uppercase tracking-wider">Description (Item/Asset Group)</p>
                  <p className="font-semibold text-[var(--text-primary)] mt-1">{selectedDetail.name}</p>
                </div>
                <div>
                  <p className="text-xs text-[var(--text-muted)] font-semibold uppercase tracking-wider">Tool Group Prefix</p>
                  <p className="font-mono font-bold text-[var(--text-primary)] mt-1">{selectedDetail.prefixToolsNo || "—"}</p>
                </div>
              </div>

              <div className="space-y-3">
                <h3 className="text-xs font-bold text-[var(--text-muted)] uppercase tracking-wider">Prefix & Sequence Rules</h3>
                <div className="form-grid">
                  <div className="p-3 border border-[var(--border-main)] rounded-xl">
                    <p className="text-xs text-[var(--text-muted)] font-semibold uppercase tracking-wider">Item No.Prefix</p>
                    <p className="font-mono font-bold text-[var(--text-primary)] mt-1">{selectedDetail.prefixToolsNo || "—"}</p>
                  </div>
                  <div className="p-3 border border-[var(--border-main)] rounded-xl">
                    <p className="text-xs text-[var(--text-muted)] font-semibold uppercase tracking-wider">Gate Entry Prefix</p>
                    <p className="font-mono font-bold text-[var(--text-primary)] mt-1">{selectedDetail.prefixGateEntry || "—"}</p>
                  </div>
                  <div className="p-3 border border-[var(--border-main)] rounded-xl">
                    <p className="text-xs text-[var(--text-muted)] font-semibold uppercase tracking-wider">PO Prefix</p>
                    <p className="font-mono font-bold text-[var(--text-primary)] mt-1">{selectedDetail.poPrefix || "—"}</p>
                  </div>
                  <div className="p-3 border border-[var(--border-main)] rounded-xl">
                    <p className="text-xs text-[var(--text-muted)] font-semibold uppercase tracking-wider">GRN Prefix</p>
                    <p className="font-mono font-bold text-[var(--text-primary)] mt-1">{selectedDetail.grnPrefix || "—"}</p>
                  </div>
                  <div className="p-3 border border-[var(--border-main)] rounded-xl">
                    <p className="text-xs text-[var(--text-muted)] font-semibold uppercase tracking-wider">Indent Prefix</p>
                    <p className="font-mono font-bold text-[var(--text-primary)] mt-1">{selectedDetail.indentPrefix || "—"}</p>
                  </div>
                  <div className="p-3 border border-[var(--border-main)] rounded-xl">
                    <p className="text-xs text-[var(--text-muted)] font-semibold uppercase tracking-wider">Prefix Mod</p>
                    <p className="font-medium text-[var(--text-primary)] mt-1">{selectedDetail.itemNoPrefixMod || "Yes"}</p>
                  </div>
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
              <RoleGate module="tool_group" action="EDIT">
                <Button
                  onClick={() => {
                    const item = selectedDetail;
                    setSelectedDetail(null);
                    handleOpenEdit(item);
                  }}
                  variant="primary"
                  size="sm"
                >
                  <Edit2 className="w-4 h-4" /> Edit Group
                </Button>
              </RoleGate>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
