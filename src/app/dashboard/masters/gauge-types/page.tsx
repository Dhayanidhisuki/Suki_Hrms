"use client";

import { useCallback, useEffect, useState } from "react";
import { Plus, Trash2, Edit2, Check, X, FileSpreadsheet, Ruler } from "lucide-react";
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

interface GaugeType {
  id: number;
  rowId: number;
  code: string;
  name: string;
  typeOfGauge: string;
  creatUserIdCd?: string | null;
  creatDt?: string | null;
}

function formatDate(value: string | null | undefined) {
  if (!value) return "—";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleDateString("en-IN");
}

export default function GaugeTypesPage() {
  const [items, setItems] = useState<GaugeType[]>([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState("");

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editItem, setEditItem] = useState<GaugeType | null>(null);
  const [typeOfGauge, setTypeOfGauge] = useState("");
  const [formErrors, setFormErrors] = useState<Record<string, string>>({});

  const loadData = useCallback(async () => {
    setLoading(true);
    const res = await apiGet<{ items: GaugeType[] }>("/api/lookups/gauge-types");
    if (res.data?.items) setItems(res.data.items);
    else if (res.error) toastError(res.error.message);
    setLoading(false);
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    loadData();
  }, [loadData]);

  const handleOpenAdd = () => {
    setEditItem(null);
    setTypeOfGauge("");
    setFormErrors({});
    setIsModalOpen(true);
  };

  const handleOpenEdit = (row: GaugeType) => {
    setEditItem(row);
    setTypeOfGauge(row.typeOfGauge || row.name || "");
    setFormErrors({});
    setIsModalOpen(true);
  };

  const handleDelete = async (id: number) => {
    if (!confirm("Delete this gauge type?")) return;
    const res = await apiDelete(`/api/lookups/gauge-types/${id}`);
    if (res.error) {
      toastError(res.error.message);
      return;
    }
    toastSuccess("Gauge type deleted.");
    loadData();
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    const errors: Record<string, string> = {};
    if (!typeOfGauge.trim()) errors.typeOfGauge = "Type of Gauge is required";
    if (typeOfGauge.trim().length > 25) errors.typeOfGauge = "Max 25 characters";
    if (Object.keys(errors).length > 0) {
      setFormErrors(errors);
      return;
    }

    const payload = { typeOfGauge: typeOfGauge.trim() };
    const res = editItem
      ? await apiPut(`/api/lookups/gauge-types/${editItem.id}`, payload)
      : await apiPost("/api/lookups/gauge-types", payload);

    if (res.error) {
      toastError(res.error.message);
      return;
    }

    toastSuccess({
      title: "Record saved",
      message: editItem ? "Gauge type updated." : "Gauge type created.",
      detail: typeOfGauge.trim(),
    });
    setIsModalOpen(false);
    loadData();
  };

  const filtered = items.filter((row) => {
    const q = query.toLowerCase();
    if (!q) return true;
    return (
      row.name.toLowerCase().includes(q) ||
      row.code.toLowerCase().includes(q) ||
      (row.typeOfGauge || "").toLowerCase().includes(q) ||
      String(row.rowId).includes(q)
    );
  });

  const handleExportExcel = () => {
    downloadExcel({
      filename: "gauge_types",
      sheetName: "Gauge Types",
      columns: [
        { key: "rowId", label: "Ref No" },
        { key: "code", label: "Code" },
        { key: "typeOfGauge", label: "Type of Gauge", value: (r) => r.typeOfGauge || r.name },
        { key: "creatUserIdCd", label: "Created By" },
        { key: "creatDt", label: "Created Date", value: (r) => formatDate(r.creatDt) },
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
                Gauge Type
              </h1>
              <p className="text-sm text-[var(--text-muted)] mt-0.5">
                GAUGE_TYPE — gauge classification master
              </p>
            </div>
            <div className="flex items-center gap-2">
              <RoleGate permission="canEditMaster">
                <Button onClick={handleOpenAdd} variant="primary" className="group">
                  <Plus className="w-4 h-4 transition-transform group-hover:rotate-90 duration-200" />
                  Add Gauge Type
                </Button>
              </RoleGate>
            </div>
          </div>

          <ModuleKpiRow
            items={[
              {
                id: "total-gauge-types",
                label: "Total Gauge Types",
                value: items.length,
                subtext: "Registered classifications",
                icon: Ruler,
                iconBg: "bg-[var(--primary-light)]",
                iconColor: "text-[var(--primary)]",
                badge: { label: "Master", type: "info" },
              },
            ]}
          />

          <MasterTableCard
            toolbar={
              <>
                <MasterSearchInput
                  id="gauge-types-search-input"
                  value={query}
                  onChange={setQuery}
                  placeholder="Search gauge type..."
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
                      {["Ref No", "Code", "Type of Gauge", "Created By", "Created Date", "Actions"].map((col) => (
                        <th key={col} className="text-left text-[11px] font-semibold text-[var(--text-muted)] uppercase tracking-wider py-2.5 px-3">
                          {col}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[var(--border-main)]">
                    {filtered.map((row) => (
                      <tr key={row.id} className="hover:bg-[var(--bg-hover)] transition-colors">
                        <td className="py-3.5 px-3 font-mono text-xs text-[var(--text-muted)]">{row.rowId}</td>
                        <td className="py-3.5 px-3 font-mono text-xs text-[var(--text-secondary)]">{row.code}</td>
                        <td className="py-3.5 px-3 font-semibold text-[var(--text-primary)]">{row.typeOfGauge || row.name}</td>
                        <td className="py-3.5 px-3 text-[var(--text-secondary)]">{row.creatUserIdCd || "—"}</td>
                        <td className="py-3.5 px-3 text-[var(--text-secondary)]">{formatDate(row.creatDt)}</td>
                        <td className="py-3.5 px-3">
                          <div className="flex items-center gap-1">
                            <RoleGate permission="canEditMaster">
                              <button onClick={() => handleOpenEdit(row)} title="Edit" className="p-1.5 hover:bg-[var(--bg-hover)] rounded-lg text-[var(--text-muted)] hover:text-[var(--primary)] transition-colors cursor-pointer">
                                <Edit2 className="w-4 h-4" />
                              </button>
                              <button onClick={() => handleDelete(row.id)} title="Delete" className="p-1.5 hover:bg-red-50 rounded-lg text-[var(--text-muted)] hover:text-red-600 transition-colors cursor-pointer">
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
                          No gauge types found.
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
                {editItem ? "Edit Gauge Type" : "Add Gauge Type"}
              </h2>
              <button onClick={() => setIsModalOpen(false)} className="text-[var(--text-muted)] hover:text-[var(--text-primary)]">
                <X className="w-5 h-5" />
              </button>
            </div>
            <form onSubmit={handleSave} className="p-5 space-y-5">
              <div>
                <label className="form-label">Type of Gauge *</label>
                <input
                  value={typeOfGauge}
                  onChange={(e) => setTypeOfGauge(e.target.value)}
                  maxLength={25}
                  placeholder="e.g. Plug Gauge"
                  className="form-control"
                />
                {formErrors.typeOfGauge && <p className="text-red-500 text-xs mt-1">{formErrors.typeOfGauge}</p>}
              </div>
              <div className="pt-3 border-t border-[var(--border-main)] flex justify-end gap-2">
                <button type="button" onClick={() => setIsModalOpen(false)} className="px-4 py-2 text-xs font-semibold text-[var(--text-muted)] hover:text-[var(--text-primary)]">
                  Cancel
                </button>
                <Button type="submit" variant="primary" size="sm">
                  <Check className="w-4 h-4" /> Save
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
