"use client";

import { useState, useEffect, useCallback } from "react";
import { Plus, Trash2, Edit2, Check, X, Eye, Tag, Layers, FolderTree, CheckCircle2, FileSpreadsheet } from "lucide-react";
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
}

interface ToolsTypeOption {
  id: number;
  code: string;
  name: string;
  refGroupId: number | null;
  group?: { id: number; name: string } | null;
}

interface ToolsName {
  id: number;
  rowId: number;
  name: string;
  typeOfTools: string;
  itemGroupId: number | null;
  itemTypeId: number | null;
  groupName: string;
  typeName: string;
  isAutoGenCd: string | null;
  prefixItemNo: string | null;
  creatUserIdCd: string;
  creatDt: string | null;
}

export default function ToolsNameForTypePage() {
  const [items, setItems] = useState<ToolsName[]>([]);
  const [groups, setGroups] = useState<ToolsGroup[]>([]);
  const [types, setTypes] = useState<ToolsTypeOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState("");

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedDetail, setSelectedDetail] = useState<ToolsName | null>(null);
  const [editItem, setEditItem] = useState<ToolsName | null>(null);
  const [name, setName] = useState("");
  const [itemGroupId, setItemGroupId] = useState<number | "">("");
  const [itemTypeId, setItemTypeId] = useState<number | "">("");
  const [isAutoGenCd, setIsAutoGenCd] = useState("Yes");
  const [prefixItemNo, setPrefixItemNo] = useState("");
  const [formErrors, setFormErrors] = useState<Record<string, string>>({});

  const loadData = useCallback(async () => {
    setLoading(true);
    const [nameRes, groupRes, typeRes] = await Promise.all([
      apiGet<{ items: ToolsName[] }>("/api/lookups/tool-types"),
      apiGet<{ items: ToolsGroup[] }>("/api/lookups/groups"),
      apiGet<{ items: ToolsTypeOption[] }>("/api/lookups/subgroups"),
    ]);
    if (nameRes.data?.items) setItems(nameRes.data.items);
    if (groupRes.data?.items) setGroups(groupRes.data.items);
    if (typeRes.data?.items) setTypes(typeRes.data.items);
    setLoading(false);
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    loadData();
  }, [loadData]);

  const filteredTypes = types.filter((t) => {
    if (itemGroupId === "") return true;
    return t.refGroupId === itemGroupId;
  });

  const handleOpenAdd = () => {
    setEditItem(null);
    setName("");
    setItemGroupId(groups[0]?.id ?? "");
    setItemTypeId("");
    setIsAutoGenCd("Yes");
    setPrefixItemNo("");
    setFormErrors({});
    setIsModalOpen(true);
  };

  const handleOpenEdit = (item: ToolsName) => {
    setEditItem(item);
    setName(item.name || item.typeOfTools || "");
    setItemGroupId(item.itemGroupId ?? "");
    setItemTypeId(item.itemTypeId ?? "");
    setIsAutoGenCd(item.isAutoGenCd || "Yes");
    setPrefixItemNo(item.prefixItemNo || "");
    setFormErrors({});
    setIsModalOpen(true);
  };

  const handleDelete = async (id: number) => {
    if (!confirm("Are you sure you want to delete this tools name?")) return;
    const res = await apiDelete(`/api/lookups/tool-types/${id}`);
    if (res.error) {
      toastError(String(res.error.message));
      return;
    }
    toastSuccess("Tools name deleted successfully.");
    loadData();
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    const errors: Record<string, string> = {};
    if (!name.trim()) errors.name = "Tools Name is required";
    if (itemGroupId === "") errors.itemGroupId = "Tools Group is required";
    if (itemTypeId === "") errors.itemTypeId = "Tools Type is required";
    if (Object.keys(errors).length > 0) {
      setFormErrors(errors);
      return;
    }

    const payload = {
      name: name.trim(),
      typeOfTools: name.trim(),
      itemGroupId: Number(itemGroupId),
      itemTypeId: Number(itemTypeId),
      isAutoGenCd,
      prefixItemNo: prefixItemNo || undefined,
    };

    const res = editItem
      ? await apiPut(`/api/lookups/tool-types/${editItem.id}`, payload)
      : await apiPost("/api/lookups/tool-types", payload);

    if (res.error) {
      toastError(String(res.error.message));
      return;
    }

    toastSuccess({
      title: "Record saved",
      message: editItem ? "Tools name updated successfully." : "Tools name created successfully.",
      detail: name.trim() || undefined,
    });
    setIsModalOpen(false);
    loadData();
  };

  const filtered = items.filter((item) => {
    const q = query.toLowerCase();
    return (
      (item.name || "").toLowerCase().includes(q) ||
      (item.typeName || "").toLowerCase().includes(q) ||
      (item.groupName || "").toLowerCase().includes(q) ||
      (item.prefixItemNo || "").toLowerCase().includes(q)
    );
  });

  const handleExportExcel = () => {
    downloadExcel({
      filename: "tools_name_for_type",
      sheetName: "Tools Names",
      columns: [
        { key: "rowId", label: "Ref No" },
        { key: "groupName", label: "Tools Group" },
        { key: "typeName", label: "Tools Type" },
        { key: "name", label: "Tools Name" },
        { key: "isAutoGenCd", label: "Is Auto Gen" },
        { key: "prefixItemNo", label: "Item Prefix" },
        { key: "creatUserIdCd", label: "Created By" },
        { key: "creatDt", label: "Created Date", value: (r) => (r.creatDt ? String(r.creatDt).split("T")[0] : "") },
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
          <div className="flex items-center justify-between mb-6">
            <div>
              <h1 className="text-2xl font-bold text-[var(--text-primary)] tracking-tight">
                Tools Name for Type
              </h1>
              <p className="text-sm text-[var(--text-muted)] mt-0.5">
                TOOLS_TYPE — reusable item/tool names linked to Tools Group and Tools Type (ERP Item Name for Type)
              </p>
            </div>
            <div className="flex items-center gap-2">
              <RoleGate module="tools_name_type" action="CREATE">
                <Button onClick={handleOpenAdd} variant="primary" className="group">
                  <Plus className="w-4 h-4 transition-transform group-hover:rotate-90 duration-200" />
                  Add Tools Name
                </Button>
              </RoleGate>
            </div>
          </div>

          <ModuleKpiRow
            items={[
              {
                id: "total-names",
                label: "Total Tools Names",
                value: items.length,
                subtext: "Reusable name master records",
                icon: Tag,
                iconBg: "bg-[var(--primary-light)]",
                iconColor: "text-[var(--primary)]",
                badge: { label: "Names", type: "info" },
              },
              {
                id: "linked-groups",
                label: "Linked Groups",
                value: new Set(items.map((i) => i.itemGroupId).filter(Boolean)).size,
                subtext: "Distinct tools groups used",
                icon: Layers,
                iconBg: "bg-emerald-50 dark:bg-emerald-950/30",
                iconColor: "text-emerald-600 dark:text-emerald-400",
                badge: { label: "Groups", type: "success" },
              },
              {
                id: "linked-types",
                label: "Linked Types",
                value: new Set(items.map((i) => i.itemTypeId).filter(Boolean)).size,
                subtext: "Distinct tools types used",
                icon: FolderTree,
                iconBg: "bg-blue-50 dark:bg-blue-950/30",
                iconColor: "text-blue-600 dark:text-blue-400",
                badge: { label: "Types", type: "info" },
              },
              {
                id: "auto-gen",
                label: "Auto Code Enabled",
                value: items.filter((i) => (i.isAutoGenCd || "").toLowerCase().startsWith("y")).length,
                subtext: "Names with auto prefix generation",
                icon: CheckCircle2,
                iconBg: "bg-amber-50 dark:bg-amber-950/30",
                iconColor: "text-amber-600 dark:text-amber-400",
                badge: { label: "Auto", type: "warning" },
              },
            ]}
          />

          <MasterTableCard
            toolbar={
              <>
                <MasterSearchInput
                  id="tool-types-search-input"
                  value={query}
                  onChange={setQuery}
                  placeholder="Search name, type, group, prefix..."
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
                <TableSkeleton rows={6} />
              </div>
            ) : (
              <div className="overflow-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-[var(--border-main)] bg-[var(--bg-subtle)]">
                      {["Tools Name", "Tools Type", "Tools Group", "Prefix", "Auto Gen", "Created", "Actions"].map(
                        (col) => (
                          <th
                            key={col}
                            className="text-left text-[11px] font-semibold text-[var(--text-muted)] uppercase tracking-wider py-2.5 px-3"
                          >
                            {col}
                          </th>
                        )
                      )}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[var(--border-main)]">
                    {filtered.map((item) => (
                      <tr key={item.id} className="hover:bg-[var(--bg-hover)] transition-colors group">
                        <td className="py-3.5 px-3 font-semibold text-[var(--text-primary)]">
                          <button
                            onClick={() => setSelectedDetail(item)}
                            className="text-left font-semibold hover:text-[var(--primary)] hover:underline flex items-center gap-1.5 cursor-pointer"
                          >
                            {item.name || item.typeOfTools || "—"}
                          </button>
                        </td>
                        <td className="py-3.5 px-3 text-[var(--text-secondary)]">{item.typeName}</td>
                        <td className="py-3.5 px-3 text-[var(--text-secondary)]">{item.groupName}</td>
                        <td className="py-3.5 px-3 font-mono text-xs text-[var(--text-muted)]">
                          {item.prefixItemNo || "—"}
                        </td>
                        <td className="py-3.5 px-3 text-[var(--text-secondary)]">{item.isAutoGenCd || "—"}</td>
                        <td className="py-3.5 px-3 text-xs text-[var(--text-muted)]">
                          {item.creatDt ? new Date(item.creatDt).toLocaleDateString() : "—"}
                        </td>
                        <td className="py-3.5 px-3">
                          <div className="flex items-center gap-1">
                            <button
                              onClick={() => setSelectedDetail(item)}
                              title="View Details"
                              className="p-1.5 hover:bg-[var(--bg-hover)] rounded-lg text-[var(--text-muted)] hover:text-[var(--primary)] transition-colors cursor-pointer"
                            >
                              <Eye className="w-4 h-4" />
                            </button>
                            <RoleGate module="tools_name_type" action="EDIT">
                              <button
                                onClick={() => handleOpenEdit(item)}
                                title="Edit"
                                className="p-1.5 hover:bg-[var(--bg-hover)] rounded-lg text-[var(--text-muted)] hover:text-[var(--text-primary)] transition-colors cursor-pointer"
                              >
                                <Edit2 className="w-4 h-4" />
                              </button>
                              <button
                                onClick={() => handleDelete(item.id)}
                                title="Delete"
                                className="p-1.5 hover:bg-red-50 rounded-lg text-[var(--text-muted)] hover:text-red-600 transition-colors cursor-pointer"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            </RoleGate>
                          </div>
                        </td>
                      </tr>
                    ))}
                    {filtered.length === 0 && (
                      <tr>
                        <td colSpan={7} className="py-8 text-center text-sm text-[var(--text-muted)]">
                          No tools names found.
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

      {isModalOpen && (
        <div className="fixed inset-0 z-50 overflow-hidden bg-black/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="w-full max-w-md bg-[var(--bg-card)] rounded-2xl border border-[var(--border-main)] shadow-2xl overflow-hidden animate-fade-in">
            <div className="px-5 py-4 border-b border-[var(--border-main)] flex items-center justify-between">
              <h2 className="text-base font-bold text-[var(--text-primary)]">
                {editItem ? "Edit Tools Name" : "Add Tools Name"}
              </h2>
              <button onClick={() => setIsModalOpen(false)} className="text-[var(--text-muted)] hover:text-[var(--text-primary)]">
                <X className="w-5 h-5" />
              </button>
            </div>
            <form onSubmit={handleSave} className="p-5 space-y-5">
              <div>
                <label className="form-label">
                  Tools Group *
                </label>
                <select
                  value={itemGroupId}
                  onChange={(e) => {
                    setItemGroupId(Number(e.target.value));
                    setItemTypeId("");
                  }}
                  className="form-control font-medium"
                >
                  <option value="">Select group</option>
                  {groups.map((g) => (
                    <option key={g.id} value={g.id}>
                      {g.name}
                    </option>
                  ))}
                </select>
                {formErrors.itemGroupId && <p className="text-red-500 text-xs mt-1">{formErrors.itemGroupId}</p>}
              </div>

              <div>
                <label className="form-label">
                  Tools Type *
                </label>
                <select
                  value={itemTypeId}
                  onChange={(e) => setItemTypeId(Number(e.target.value))}
                  className="form-control font-medium"
                >
                  <option value="">Select type</option>
                  {filteredTypes.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.name}
                    </option>
                  ))}
                </select>
                {formErrors.itemTypeId && <p className="text-red-500 text-xs mt-1">{formErrors.itemTypeId}</p>}
              </div>

              <div>
                <label className="form-label">
                  Tools Name *
                </label>
                <input
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g. SURFACE TABLE / MICRO METER"
                  className="form-control"
                />
                {formErrors.name && <p className="text-red-500 text-xs mt-1">{formErrors.name}</p>}
              </div>

              <div className="form-grid">
                <div>
                  <label className="form-label">
                    Is Auto Generate Code?
                  </label>
                  <select
                    value={isAutoGenCd}
                    onChange={(e) => setIsAutoGenCd(e.target.value)}
                    className="form-control font-medium"
                  >
                    <option>Yes</option>
                    <option>No</option>
                  </select>
                </div>
                <div>
                  <label className="form-label">
                    Item Prefix
                  </label>
                  <input
                    value={prefixItemNo}
                    onChange={(e) => setPrefixItemNo(e.target.value)}
                    placeholder="e.g. ST / MM"
                    className="form-control font-mono"
                  />
                </div>
              </div>

              <div className="pt-3 border-t border-[var(--border-main)] flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 text-xs font-semibold text-[var(--text-muted)] hover:text-[var(--text-primary)]"
                >
                  Cancel
                </button>
                <Button type="submit" variant="primary" size="sm">
                  <Check className="w-4 h-4" /> Save Name
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
                  ID: #{selectedDetail.id || selectedDetail.rowId}
                </span>
                <h2 className="text-lg font-bold text-[var(--text-primary)] mt-1">
                  {selectedDetail.name || selectedDetail.typeOfTools}
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
                  <p className="text-xs text-[var(--text-muted)] font-semibold uppercase tracking-wider">Tools Name</p>
                  <p className="font-bold text-[var(--text-primary)] mt-1">{selectedDetail.name || selectedDetail.typeOfTools}</p>
                </div>
                <div>
                  <p className="text-xs text-[var(--text-muted)] font-semibold uppercase tracking-wider">Item Prefix</p>
                  <p className="font-mono font-bold text-[var(--text-primary)] mt-1">{selectedDetail.prefixItemNo || "—"}</p>
                </div>
                <div>
                  <p className="text-xs text-[var(--text-muted)] font-semibold uppercase tracking-wider">Parent Tools Group</p>
                  <p className="font-medium text-[var(--text-primary)] mt-1">{selectedDetail.groupName || "—"}</p>
                </div>
                <div>
                  <p className="text-xs text-[var(--text-muted)] font-semibold uppercase tracking-wider">Parent Tools Type</p>
                  <p className="font-medium text-[var(--text-primary)] mt-1">{selectedDetail.typeName || "—"}</p>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4 pt-1">
                <div className="p-3 border border-[var(--border-main)] rounded-xl">
                  <p className="text-xs text-[var(--text-muted)] font-semibold uppercase tracking-wider">Auto Generate Code</p>
                  <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-[var(--primary-light)] text-[var(--primary)] mt-1">
                    {selectedDetail.isAutoGenCd || "Yes"}
                  </span>
                </div>
                <div className="p-3 border border-[var(--border-main)] rounded-xl">
                  <p className="text-xs text-[var(--text-muted)] font-semibold uppercase tracking-wider">Created By</p>
                  <p className="font-mono text-xs font-medium text-[var(--text-primary)] mt-1">{selectedDetail.creatUserIdCd || "System"}</p>
                </div>
                {selectedDetail.creatDt && (
                  <div className="p-3 border border-[var(--border-main)] rounded-xl col-span-2">
                    <p className="text-xs text-[var(--text-muted)] font-semibold uppercase tracking-wider">Created Date</p>
                    <p className="font-mono text-xs text-[var(--text-primary)] mt-1">{new Date(selectedDetail.creatDt).toLocaleString()}</p>
                  </div>
                )}
              </div>
            </div>

            <div className="px-6 py-4 border-t border-[var(--border-main)] bg-[var(--bg-subtle)] flex items-center justify-end gap-3">
              <button
                onClick={() => setSelectedDetail(null)}
                className="px-4 py-2 text-xs font-semibold text-[var(--text-muted)] hover:text-[var(--text-primary)]"
              >
                Close
              </button>
              <RoleGate module="tools_name_type" action="EDIT">
                <Button
                  onClick={() => {
                    const item = selectedDetail;
                    setSelectedDetail(null);
                    handleOpenEdit(item);
                  }}
                  variant="primary"
                  size="sm"
                >
                  <Edit2 className="w-4 h-4" /> Edit Tools Name
                </Button>
              </RoleGate>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
