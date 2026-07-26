"use client";

import { useState, useEffect, useCallback } from "react";
import { Plus, Search, Edit2, Trash2, X, Check, Minus } from "lucide-react";
import Sidebar from "@/app/dashboard/components/Sidebar";
import TopBar from "@/app/dashboard/components/TopBar";
import RoleGate from "@/app/dashboard/components/RoleGate";
import { TableSkeleton } from "@/app/dashboard/components/LoadingSkeleton";
import { apiGet, apiPost, apiPut, apiDelete } from "@/lib/apiClient";
import { Button } from "@/components/ui/button";

export interface Subcontractor {
  id: number;
  subCode: string;
  subName: string;
  natureOfWork: string;
  gstin: string | null;
  address: string | null;
  isStoreVendor: boolean;
  isInhouse: boolean;
  isIssueDC: boolean;
  status: "Active" | "Inactive";
  creatUserIdCd: string;
  creatDt: string;
}

export default function SubcontractorsPage() {
  const [subcontractors, setSubcontractors] = useState<Subcontractor[]>([]);
  const [loading, setLoading] = useState(true);
  const [bannerMsg, setBannerMsg] = useState<{ type: "success" | "error"; text: string } | null>(null);

  // Filters
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<"All" | "Active" | "Inactive">("All");

  // Slide-over Form State
  const [isOpen, setIsOpen] = useState(false);
  const [editSub, setEditSub] = useState<Subcontractor | null>(null);

  // Form Fields
  const [subCode, setSubCode] = useState("");
  const [subName, setSubName] = useState("");
  const [natureOfWork, setNatureOfWork] = useState("");
  const [gstin, setGstin] = useState("");
  const [address, setAddress] = useState("");
  const [isStoreVendor, setIsStoreVendor] = useState(false);
  const [isInhouse, setIsInhouse] = useState(false);
  const [isIssueDC, setIsIssueDC] = useState(true);
  const [status, setStatus] = useState<"Active" | "Inactive">("Active");

  // Errors
  const [errors, setErrors] = useState<Record<string, string>>({});

  const loadSubcontractors = useCallback(async () => {
    setLoading(true);
    const params = new URLSearchParams();
    if (query) params.set("search", query);
    if (statusFilter !== "All") params.set("status", statusFilter);

    const res = await apiGet<{ items: Subcontractor[] }>(`/api/subcontractors?${params}`);
    if (res.data?.items) setSubcontractors(res.data.items);
    setLoading(false);
  }, [query, statusFilter]);

  useEffect(() => {
    loadSubcontractors();
  }, [loadSubcontractors]);

  const handleOpenAdd = () => {
    setEditSub(null);
    setSubCode("");
    setSubName("");
    setNatureOfWork("");
    setGstin("");
    setAddress("");
    setIsStoreVendor(false);
    setIsInhouse(false);
    setIsIssueDC(true);
    setStatus("Active");
    setErrors({});
    setIsOpen(true);
  };

  const handleOpenEdit = (sub: Subcontractor) => {
    setEditSub(sub);
    setSubCode(sub.subCode);
    setSubName(sub.subName);
    setNatureOfWork(sub.natureOfWork);
    setGstin(sub.gstin ?? "");
    setAddress(sub.address ?? "");
    setIsStoreVendor(sub.isStoreVendor);
    setIsInhouse(sub.isInhouse);
    setIsIssueDC(sub.isIssueDC);
    setStatus(sub.status);
    setErrors({});
    setIsOpen(true);
  };

  const handleDelete = async (id: number) => {
    setBannerMsg(null);
    const res = await apiDelete(`/api/subcontractors/${id}`);
    if (res.error) {
      setBannerMsg({ type: "error", text: res.error.message });
      return;
    }
    setBannerMsg({ type: "success", text: "Subcontractor deleted." });
    loadSubcontractors();
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    const tempErrors: Record<string, string> = {};

    if (!subName.trim()) tempErrors.subName = "Subcontractor Name is required";
    if (!natureOfWork.trim()) tempErrors.natureOfWork = "Nature of Work is required";

    if (Object.keys(tempErrors).length > 0) {
      setErrors(tempErrors);
      return;
    }

    const payload = {
      subCode: subCode || undefined,
      subName,
      natureOfWork,
      gstin,
      address,
      isStoreVendor,
      isInhouse,
      isIssueDC,
      status,
    };

    setBannerMsg(null);
    const res = editSub
      ? await apiPut<{ item: Subcontractor }>(`/api/subcontractors/${editSub.id}`, payload)
      : await apiPost<{ item: Subcontractor }>("/api/subcontractors", payload);

    if (res.error) {
      setBannerMsg({ type: "error", text: res.error.message });
      return;
    }

    setBannerMsg({
      type: "success",
      text: editSub ? "Subcontractor updated successfully." : "Subcontractor created successfully.",
    });
    setIsOpen(false);
    loadSubcontractors();
  };

  const filtered = subcontractors.filter((s) => {
    const matchesSearch =
      s.subName.toLowerCase().includes(query.toLowerCase()) ||
      s.subCode.toLowerCase().includes(query.toLowerCase()) ||
      s.natureOfWork.toLowerCase().includes(query.toLowerCase());
    return matchesSearch;
  });

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
                Subcontractor Master
              </h1>
              <p className="text-sm text-[var(--text-muted)] mt-0.5">
                Manage calibration labs and repair vendors (SUBCONTRACTOR)
              </p>
            </div>
            <RoleGate permission="canEditMaster">
              <Button
                id="subcontractor-add-btn"
                onClick={handleOpenAdd}
                variant="primary"
                className="group"
              >
                <Plus className="w-4 h-4 transition-transform group-hover:rotate-90 duration-200" />
                Add Subcontractor
              </Button>
            </RoleGate>
          </div>

          {bannerMsg && (
            <div
              className={`mb-4 px-4 py-3 rounded-xl text-sm font-medium flex items-center gap-2 ${
                bannerMsg.type === "success"
                  ? "bg-[var(--color-success-bg)] text-[var(--color-success-text)] border border-[var(--border-main)]"
                  : "bg-[var(--color-danger-bg)] text-[var(--color-danger-text)] border border-[var(--border-main)]"
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

          {/* ── Filters Card ── */}
          <div className="bg-[var(--bg-card)] rounded-2xl border border-[var(--border-main)] p-5 mb-6">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div className="relative flex-1 max-w-sm">
                <Search className="w-4 h-4 text-[var(--text-muted)] absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  id="subcontractor-search-input"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Search subcontractor name or code…"
                  className="w-full text-sm border border-[var(--border-main)] rounded-lg pl-9 pr-3 py-2 outline-none focus:ring-2 focus:ring-[var(--primary-subtle)] focus:border-[var(--primary)] transition-all bg-[var(--bg-subtle)] text-[var(--text-primary)] placeholder-[var(--text-muted)]"
                />
              </div>

              <div className="flex items-center gap-1 bg-[var(--bg-subtle)] rounded-lg p-1">
                {(["All", "Active", "Inactive"] as const).map((f) => (
                  <button
                    key={f}
                    id={`subcontractor-status-filter-${f.toLowerCase()}`}
                    onClick={() => setStatusFilter(f)}
                    className={`px-2.5 py-1 rounded-md text-xs font-medium transition-all ${
                      statusFilter === f
                        ? "bg-[var(--bg-surface)] shadow-sm text-[var(--text-primary)]"
                        : "text-[var(--text-muted)] hover:text-[var(--text-primary)]"
                    }`}
                  >
                    {f}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* ── Table Card ── */}
          <div className="bg-[var(--bg-card)] rounded-2xl border border-[var(--border-main)] p-5">
            {loading ? (
              <TableSkeleton rows={5} />
            ) : (
            <div className="overflow-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-[var(--border-main)] bg-[var(--bg-subtle)]">
                    {[
                      "Code",
                      "Name",
                      "Nature of Work",
                      "In-House",
                      "Store Vendor",
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
                  {filtered.map((s) => (
                    <tr key={s.id} className="hover:bg-[var(--bg-hover)] transition-colors">
                      <td className="py-3 px-3 font-mono text-xs text-[var(--text-secondary)]">{s.subCode}</td>
                      <td className="py-3 px-3">
                        <p className="font-medium text-[var(--text-primary)]">{s.subName}</p>
                        <p className="text-[11px] text-[var(--text-muted)]">{s.address}</p>
                      </td>
                      <td className="py-3 px-3 text-[var(--text-secondary)]">{s.natureOfWork}</td>
                      <td className="py-3 px-3">
                        <BoolIndicator value={s.isInhouse} />
                      </td>
                      <td className="py-3 px-3">
                        <BoolIndicator value={s.isStoreVendor} />
                      </td>
                      <td className="py-3 px-3">
                        <span
                          className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold ${
                            s.status === "Active"
                              ? "bg-[var(--primary-light)] text-[var(--primary)] border border-[var(--border-main)]"
                              : "bg-[var(--bg-subtle)] text-[var(--text-muted)] border border-[var(--border-main)]"
                          }`}
                        >
                          {s.status}
                        </span>
                      </td>
                      <td className="py-3 px-3">
                        <RoleGate permission="canEditMaster">
                          <div className="flex items-center gap-2">
                            <button
                              id={`subcontractor-edit-btn-${s.id}`}
                              onClick={() => handleOpenEdit(s)}
                              className="p-1.5 hover:bg-[var(--bg-hover)] rounded-lg text-[var(--text-muted)] hover:text-[var(--text-primary)] transition-colors"
                              title="Edit Subcontractor"
                            >
                              <Edit2 className="w-4 h-4" />
                            </button>
                            <button
                              id={`subcontractor-delete-btn-${s.id}`}
                              onClick={() => handleDelete(s.id)}
                              className="p-1.5 hover:bg-[var(--color-danger-bg)] rounded-lg text-[var(--text-muted)] hover:text-[var(--color-danger-text)] transition-colors"
                              title="Delete Subcontractor"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        </RoleGate>
                      </td>
                    </tr>
                  ))}
                  {filtered.length === 0 && (
                    <tr>
                      <td colSpan={7} className="py-8 text-center text-sm text-[var(--text-muted)]">
                        No subcontractors found.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
            )}
            <div className="mt-4 pt-3 border-t border-[var(--border-main)]">
              <span className="text-xs text-[var(--text-muted)]">
                Showing {filtered.length} of {subcontractors.length} subcontractors
              </span>
            </div>
          </div>
        </main>
      </div>

      {/* ── Slide-over Form Panel ── */}
      {isOpen && (
        <div className="fixed inset-0 z-50 overflow-hidden bg-black/40 backdrop-blur-xs flex justify-end animate-fade-in">
          <div className="w-full max-w-md bg-[var(--bg-card)] text-[var(--text-primary)] shadow-2xl flex flex-col h-full border-l border-[var(--border-main)] animate-slide-in-right">
            {/* Header */}
            <div className="px-5 py-4 border-b border-[var(--border-main)] flex items-center justify-between">
              <h2 className="text-base font-bold text-[var(--text-primary)]">
                {editSub ? `Edit: ${editSub.subName}` : "Add New Subcontractor"}
              </h2>
              <button onClick={() => setIsOpen(false)} className="p-1.5 rounded-lg hover:bg-[var(--bg-hover)] text-[var(--text-muted)] hover:text-[var(--text-primary)] transition-colors">
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Form Content */}
            <form onSubmit={handleSave} className="flex-1 overflow-y-auto p-5 space-y-4">
              <div>
                <label className="block text-xs font-semibold text-[var(--text-muted)] uppercase tracking-wider mb-1">
                  Subcontractor Code
                </label>
                <input
                  id="form-sub-code"
                  value={subCode}
                  onChange={(e) => setSubCode(e.target.value)}
                  placeholder="e.g. SC001"
                  disabled={!!editSub}
                  className="w-full text-sm border border-[var(--border-main)] rounded-lg px-3 py-2 outline-none focus:ring-2 focus:ring-[var(--primary-subtle)] focus:border-[var(--primary)] transition-all bg-[var(--bg-subtle)] text-[var(--text-primary)] placeholder-[var(--text-muted)] disabled:bg-[var(--bg-hover)] disabled:text-[var(--text-muted)]"
                />
                {errors.subCode && <p className="text-[var(--color-danger-text)] text-xs mt-1 font-medium">{errors.subCode}</p>}
              </div>

              <div>
                <label className="block text-xs font-semibold text-[var(--text-muted)] uppercase tracking-wider mb-1">
                  Subcontractor Name *
                </label>
                <input
                  id="form-sub-name"
                  value={subName}
                  onChange={(e) => setSubName(e.target.value)}
                  placeholder="e.g. Reliable Calibration Lab"
                  className="w-full text-sm border border-[var(--border-main)] rounded-lg px-3 py-2 outline-none focus:ring-2 focus:ring-[var(--primary-subtle)] focus:border-[var(--primary)] transition-all bg-[var(--bg-subtle)] text-[var(--text-primary)] placeholder-[var(--text-muted)]"
                />
                {errors.subName && <p className="text-[var(--color-danger-text)] text-xs mt-1 font-medium">{errors.subName}</p>}
              </div>

              <div>
                <label className="block text-xs font-semibold text-[var(--text-muted)] uppercase tracking-wider mb-1">
                  Nature of Work *
                </label>
                <input
                  id="form-nature"
                  value={natureOfWork}
                  onChange={(e) => setNatureOfWork(e.target.value)}
                  placeholder="e.g. Calibration Services"
                  className="w-full text-sm border border-[var(--border-main)] rounded-lg px-3 py-2 outline-none focus:ring-2 focus:ring-[var(--primary-subtle)] focus:border-[var(--primary)] transition-all bg-[var(--bg-subtle)] text-[var(--text-primary)] placeholder-[var(--text-muted)]"
                />
                {errors.natureOfWork && <p className="text-[var(--color-danger-text)] text-xs mt-1 font-medium">{errors.natureOfWork}</p>}
              </div>

              <div>
                <label className="block text-xs font-semibold text-[var(--text-muted)] uppercase tracking-wider mb-1">
                  GSTIN
                </label>
                <input
                  id="form-gstin"
                  value={gstin}
                  onChange={(e) => setGstin(e.target.value)}
                  placeholder="Alphanumeric GSTIN"
                  className="w-full text-sm border border-[var(--border-main)] rounded-lg px-3 py-2 outline-none focus:ring-2 focus:ring-[var(--primary-subtle)] focus:border-[var(--primary)] transition-all bg-[var(--bg-subtle)] text-[var(--text-primary)] placeholder-[var(--text-muted)] font-mono uppercase"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-[var(--text-muted)] uppercase tracking-wider mb-1">
                  Address
                </label>
                <textarea
                  id="form-address"
                  rows={3}
                  value={address}
                  onChange={(e) => setAddress(e.target.value)}
                  placeholder="Street / Office Address"
                  className="w-full text-sm border border-[var(--border-main)] rounded-lg px-3 py-2 outline-none focus:ring-2 focus:ring-[var(--primary-subtle)] focus:border-[var(--primary)] transition-all bg-[var(--bg-subtle)] text-[var(--text-primary)] placeholder-[var(--text-muted)] resize-none"
                />
              </div>

              {/* Checkboxes */}
              <div className="border-t border-[var(--border-main)] pt-3 space-y-3">
                <div className="flex items-center gap-3">
                  <input
                    type="checkbox"
                    id="form-store-vendor"
                    checked={isStoreVendor}
                    onChange={(e) => setIsStoreVendor(e.target.checked)}
                    className="w-4.5 h-4.5 text-[var(--primary)] border-[var(--border-main)] rounded focus:ring-[var(--primary)]"
                  />
                  <label htmlFor="form-store-vendor" className="text-sm font-semibold text-[var(--text-primary)] cursor-pointer">
                    Is Store Vendor
                  </label>
                </div>

                <div className="flex items-center gap-3">
                  <input
                    type="checkbox"
                    id="form-inhouse"
                    checked={isInhouse}
                    onChange={(e) => setIsInhouse(e.target.checked)}
                    className="w-4.5 h-4.5 text-[var(--primary)] border-[var(--border-main)] rounded focus:ring-[var(--primary)]"
                  />
                  <label htmlFor="form-inhouse" className="text-sm font-semibold text-[var(--text-primary)] cursor-pointer">
                    Is In-House Unit
                  </label>
                </div>

                <div className="flex items-center gap-3">
                  <input
                    type="checkbox"
                    id="form-issue-dc"
                    checked={isIssueDC}
                    onChange={(e) => setIsIssueDC(e.target.checked)}
                    className="w-4.5 h-4.5 text-[var(--primary)] border-[var(--border-main)] rounded focus:ring-[var(--primary)]"
                  />
                  <label htmlFor="form-issue-dc" className="text-sm font-semibold text-[var(--text-primary)] cursor-pointer">
                    Issue Delivery Challan
                  </label>
                </div>
              </div>

              {/* Status selection */}
              <div className="border-t border-[var(--border-main)] pt-3">
                <label className="block text-xs font-semibold text-[var(--text-muted)] uppercase tracking-wider mb-1">
                  Status
                </label>
                <select
                  id="form-status"
                  value={status}
                  onChange={(e) => setStatus(e.target.value as "Active" | "Inactive")}
                  className="w-full text-sm border border-[var(--border-main)] rounded-lg px-3 py-2 outline-none focus:ring-2 focus:ring-[var(--primary-subtle)] focus:border-[var(--primary)] bg-[var(--bg-subtle)] text-[var(--text-primary)]"
                >
                  <option value="Active">Active</option>
                  <option value="Inactive">Inactive</option>
                </select>
              </div>

              {/* Footer Buttons */}
              <div className="border-t border-[var(--border-main)] pt-4 flex items-center justify-end gap-3 sticky bottom-0 bg-[var(--bg-card)]">
                <button
                  type="button"
                  onClick={() => setIsOpen(false)}
                  className="px-4 py-2 text-sm font-semibold text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-hover)] rounded-xl transition-all"
                >
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
}

function BoolIndicator({ value }: { value: boolean }) {
  return value ? (
    <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-[var(--color-success-bg)] text-[var(--color-success-text)] border border-[var(--border-main)]">
      <Check className="w-3.5 h-3.5" />
    </span>
  ) : (
    <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-[var(--bg-subtle)] text-[var(--text-muted)] border border-[var(--border-main)]">
      <Minus className="w-3.5 h-3.5" />
    </span>
  );
}
