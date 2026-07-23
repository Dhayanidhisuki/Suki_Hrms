"use client";

import { useState, useEffect } from "react";
import { Plus, Search, Edit2, Trash2, X, Check, Minus } from "lucide-react";
import Sidebar from "@/app/dashboard/components/Sidebar";
import TopBar from "@/app/dashboard/components/TopBar";
import RoleGate from "@/app/dashboard/components/RoleGate";
import { TableSkeleton } from "@/app/dashboard/components/LoadingSkeleton";
import { apiGet, apiPost, apiPut, apiDelete } from "@/lib/apiClient";

export interface Subcontractor {
  id: number;
  subCode: string;
  subName: string;
  natureOfWork: string | null;
  isStoreVendor: boolean;
  isInhouse: boolean;
  isIssueDc: boolean;
  address: string | null;
  gstin: string | null;
  status: "Active" | "Inactive";
  creatUserIdCd: string;
  creatDt: string;
}

export default function SubcontractorsPage() {
  const [subcontractors, setSubcontractors] = useState<Subcontractor[]>([]);
  const [loading, setLoading] = useState(true);
  const [bannerMsg, setBannerMsg] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<"All" | "Active" | "Inactive">("All");

  // Slide-over state
  const [isOpen, setIsOpen] = useState(false);
  const [editSub, setEditSub] = useState<Subcontractor | null>(null);

  // Form Fields
  const [subCode, setSubCode] = useState("");
  const [subName, setSubName] = useState("");
  const [natureOfWork, setNatureOfWork] = useState("");
  const [isStoreVendor, setIsStoreVendor] = useState(false);
  const [isInhouse, setIsInhouse] = useState(false);
  const [isIssueDC, setIsIssueDC] = useState(false);
  const [address, setAddress] = useState("");
  const [gstin, setGstin] = useState("");
  const [status, setStatus] = useState<"Active" | "Inactive">("Active");

  // Errors
  const [errors, setErrors] = useState<Record<string, string>>({});

  async function loadSubcontractors() {
    setLoading(true);
    const params = new URLSearchParams();
    if (query) params.set("search", query);
    const res = await apiGet<{ items: Subcontractor[] }>(`/api/subcontractors?${params}`);
    if (res.data?.items) setSubcontractors(res.data.items);
    setLoading(false);
  }

  useEffect(() => {
    loadSubcontractors();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query]);

  const handleOpenAdd = () => {
    setEditSub(null);
    setSubCode("");
    setSubName("");
    setNatureOfWork("");
    setIsStoreVendor(false);
    setIsInhouse(false);
    setIsIssueDC(false);
    setAddress("");
    setGstin("");
    setStatus("Active");
    setErrors({});
    setIsOpen(true);
  };

  const handleOpenEdit = (s: Subcontractor) => {
    setEditSub(s);
    setSubCode(s.subCode);
    setSubName(s.subName);
    setNatureOfWork(s.natureOfWork ?? "");
    setIsStoreVendor(s.isStoreVendor);
    setIsInhouse(s.isInhouse);
    setIsIssueDC(s.isIssueDc);
    setAddress(s.address ?? "");
    setGstin(s.gstin ?? "");
    setStatus(s.status);
    setErrors({});
    setIsOpen(true);
  };

  const handleDelete = async (id: number) => {
    if (!confirm("Are you sure you want to delete this subcontractor?")) return;
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

    if (!subCode.trim()) tempErrors.subCode = "Subcontractor Code is required";
    if (!subName.trim()) tempErrors.subName = "Subcontractor Name is required";
    if (!natureOfWork.trim()) tempErrors.natureOfWork = "Nature of Work is required";

    if (Object.keys(tempErrors).length > 0) {
      setErrors(tempErrors);
      return;
    }

    const payload = {
      subCode,
      subName,
      natureOfWork,
      isStoreVendor,
      isInhouse,
      isIssueDc: isIssueDC,
      address,
      gstin,
      status,
    };

    setBannerMsg(null);
    const res = editSub
      ? await apiPut<{ subcontractor: Subcontractor }>(`/api/subcontractors/${editSub.id}`, payload)
      : await apiPost<{ subcontractor: Subcontractor }>("/api/subcontractors", payload);

    if (res.error) {
      setBannerMsg({ type: "error", text: res.error.message });
      return;
    }

    setBannerMsg({ type: "success", text: editSub ? "Subcontractor updated." : "Subcontractor created." });
    setIsOpen(false);
    loadSubcontractors();
  };

  const filtered = subcontractors.filter((s) => {
    const matchesStatus = statusFilter === "All" || s.status === statusFilter;
    return matchesStatus;
  });

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
                Subcontractor Master
              </h1>
              <p className="text-sm text-slate-500 mt-0.5">
                Manage calibration labs and repair vendors (SUBCONTRACTOR)
              </p>
            </div>
            <RoleGate permission="canEditMaster">
              <button
                id="subcontractor-add-btn"
                onClick={handleOpenAdd}
                className="flex items-center gap-2 px-4 py-2.5 bg-blue-600 hover:bg-blue-700 active:bg-blue-800 text-white text-sm font-semibold rounded-xl shadow-sm hover:shadow-md transition-all duration-150 group"
              >
                <Plus className="w-4 h-4 transition-transform group-hover:rotate-90 duration-200" />
                Add Subcontractor
              </button>
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

          {/* ── Filters Card ── */}
          <div className="bg-white rounded-2xl border border-slate-200 p-5 mb-6">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div className="relative flex-1 max-w-sm">
                <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  id="subcontractor-search-input"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Search subcontractor name or code…"
                  className="w-full text-sm border border-slate-200 rounded-lg pl-9 pr-3 py-2 outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-400 transition-all bg-slate-50"
                />
              </div>

              <div className="flex items-center gap-1 bg-slate-50 rounded-lg p-1">
                {(["All", "Active", "Inactive"] as const).map((f) => (
                  <button
                    key={f}
                    id={`subcontractor-status-filter-${f.toLowerCase()}`}
                    onClick={() => setStatusFilter(f)}
                    className={`px-2.5 py-1 rounded-md text-xs font-medium transition-all ${
                      statusFilter === f
                        ? "bg-white shadow-sm text-slate-800"
                        : "text-slate-400 hover:text-slate-600"
                    }`}
                  >
                    {f}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* ── Table Card ── */}
          <div className="bg-white rounded-2xl border border-slate-200 p-5">
            {loading ? (
              <TableSkeleton rows={5} />
            ) : (
            <div className="overflow-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-100">
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
                        className="text-left text-[11px] font-semibold text-slate-400 uppercase tracking-wider pb-2.5 pr-4 last:pr-0"
                      >
                        {col}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                  {filtered.map((s) => (
                    <tr key={s.id} className="hover:bg-slate-50/60 transition-colors">
                      <td className="py-3 pr-4 font-mono text-xs text-slate-500">{s.subCode}</td>
                      <td className="py-3 pr-4">
                        <p className="font-medium text-slate-800">{s.subName}</p>
                        <p className="text-[11px] text-slate-400">{s.address}</p>
                      </td>
                      <td className="py-3 pr-4 text-slate-600">{s.natureOfWork}</td>
                      <td className="py-3 pr-4">
                        <BoolIndicator value={s.isInhouse} />
                      </td>
                      <td className="py-3 pr-4">
                        <BoolIndicator value={s.isStoreVendor} />
                      </td>
                      <td className="py-3 pr-4">
                        <span
                          className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold ${
                            s.status === "Active"
                              ? "bg-blue-50 text-blue-700"
                              : "bg-slate-100 text-slate-500"
                          }`}
                        >
                          {s.status}
                        </span>
                      </td>
                      <td className="py-3">
                        <RoleGate permission="canEditMaster">
                          <div className="flex items-center gap-2">
                            <button
                              id={`subcontractor-edit-btn-${s.id}`}
                              onClick={() => handleOpenEdit(s)}
                              className="p-1.5 hover:bg-slate-100 rounded-lg text-slate-400 hover:text-slate-700 transition-colors"
                              title="Edit Subcontractor"
                            >
                              <Edit2 className="w-4 h-4" />
                            </button>
                            <button
                              id={`subcontractor-delete-btn-${s.id}`}
                              onClick={() => handleDelete(s.id)}
                              className="p-1.5 hover:bg-red-50 rounded-lg text-slate-400 hover:text-red-600 transition-colors"
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
                      <td colSpan={7} className="py-8 text-center text-sm text-slate-400">
                        No subcontractors found.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
            )}
            <div className="mt-4 pt-3 border-t border-slate-100">
              <span className="text-xs text-slate-400">
                Showing {filtered.length} of {subcontractors.length} subcontractors
              </span>
            </div>
          </div>
        </main>
      </div>

      {/* ── Slide-over Form Panel ── */}
      {isOpen && (
        <div className="fixed inset-0 z-50 overflow-hidden">
          {/* Backdrop */}
          <div className="absolute inset-0 bg-slate-900/40 backdrop-blur-xs transition-opacity" onClick={() => setIsOpen(false)} />

          <div className="absolute inset-y-0 right-0 max-w-full flex pl-10">
            <div className="w-screen max-w-md bg-white shadow-xl flex flex-col h-full border-l border-slate-200">
              {/* Header */}
              <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between">
                <h2 className="text-base font-bold text-slate-800">
                  {editSub ? `Edit: ${editSub.subName}` : "Add New Subcontractor"}
                </h2>
                <button onClick={() => setIsOpen(false)} className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-400 hover:text-slate-700 transition-colors">
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Form Content */}
              <form onSubmit={handleSave} className="flex-1 overflow-y-auto p-5 space-y-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">
                    Subcontractor Code
                  </label>
                  <input
                    id="form-sub-code"
                    value={subCode}
                    onChange={(e) => setSubCode(e.target.value)}
                    placeholder="e.g. SC001"
                    disabled={!!editSub}
                    className="w-full text-sm border border-slate-200 rounded-lg px-3 py-2 outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-400 transition-all bg-slate-50 disabled:bg-slate-100 disabled:text-slate-400"
                  />
                  {errors.subCode && <p className="text-red-500 text-xs mt-1 font-medium">{errors.subCode}</p>}
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">
                    Subcontractor Name *
                  </label>
                  <input
                    id="form-sub-name"
                    value={subName}
                    onChange={(e) => setSubName(e.target.value)}
                    placeholder="e.g. Reliable Calibration Lab"
                    className="w-full text-sm border border-slate-200 rounded-lg px-3 py-2 outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-400 transition-all bg-slate-50"
                  />
                  {errors.subName && <p className="text-red-500 text-xs mt-1 font-medium">{errors.subName}</p>}
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">
                    Nature of Work *
                  </label>
                  <input
                    id="form-nature"
                    value={natureOfWork}
                    onChange={(e) => setNatureOfWork(e.target.value)}
                    placeholder="e.g. Calibration Services"
                    className="w-full text-sm border border-slate-200 rounded-lg px-3 py-2 outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-400 transition-all bg-slate-50"
                  />
                  {errors.natureOfWork && <p className="text-red-500 text-xs mt-1 font-medium">{errors.natureOfWork}</p>}
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">
                    GSTIN
                  </label>
                  <input
                    id="form-gstin"
                    value={gstin}
                    onChange={(e) => setGstin(e.target.value)}
                    placeholder="Alphanumeric GSTIN"
                    className="w-full text-sm border border-slate-200 rounded-lg px-3 py-2 outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-400 transition-all bg-slate-50 font-mono uppercase"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">
                    Address
                  </label>
                  <textarea
                    id="form-address"
                    rows={3}
                    value={address}
                    onChange={(e) => setAddress(e.target.value)}
                    placeholder="Street / Office Address"
                    className="w-full text-sm border border-slate-200 rounded-lg px-3 py-2 outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-400 transition-all bg-slate-50 resize-none"
                  />
                </div>

                {/* Checkboxes */}
                <div className="border-t border-slate-100 pt-3 space-y-3">
                  <div className="flex items-center gap-3">
                    <input
                      type="checkbox"
                      id="form-store-vendor"
                      checked={isStoreVendor}
                      onChange={(e) => setIsStoreVendor(e.target.checked)}
                      className="w-4.5 h-4.5 text-blue-600 border-slate-200 rounded focus:ring-blue-500"
                    />
                    <label htmlFor="form-store-vendor" className="text-sm font-semibold text-slate-700 cursor-pointer">
                      Is Store Vendor
                    </label>
                  </div>

                  <div className="flex items-center gap-3">
                    <input
                      type="checkbox"
                      id="form-inhouse"
                      checked={isInhouse}
                      onChange={(e) => setIsInhouse(e.target.checked)}
                      className="w-4.5 h-4.5 text-blue-600 border-slate-200 rounded focus:ring-blue-500"
                    />
                    <label htmlFor="form-inhouse" className="text-sm font-semibold text-slate-700 cursor-pointer">
                      Is In-House Unit
                    </label>
                  </div>

                  <div className="flex items-center gap-3">
                    <input
                      type="checkbox"
                      id="form-issue-dc"
                      checked={isIssueDC}
                      onChange={(e) => setIsIssueDC(e.target.checked)}
                      className="w-4.5 h-4.5 text-blue-600 border-slate-200 rounded focus:ring-blue-500"
                    />
                    <label htmlFor="form-issue-dc" className="text-sm font-semibold text-slate-700 cursor-pointer">
                      Issue Delivery Challan
                    </label>
                  </div>
                </div>

                {/* Status selection */}
                <div className="border-t border-slate-100 pt-3">
                  <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">
                    Status
                  </label>
                  <select
                    id="form-status"
                    value={status}
                    onChange={(e) => setStatus(e.target.value as "Active" | "Inactive")}
                    className="text-sm border border-slate-200 rounded-lg px-3 py-2 outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-400 bg-slate-50"
                  >
                    <option value="Active">Active</option>
                    <option value="Inactive">Inactive</option>
                  </select>
                </div>

                {/* Footer Buttons */}
                <div className="border-t border-slate-100 pt-4 flex items-center justify-end gap-3 sticky bottom-0 bg-white">
                  <button
                    type="button"
                    onClick={() => setIsOpen(false)}
                    className="px-4 py-2 text-sm font-semibold text-slate-500 hover:text-slate-800 hover:bg-slate-50 rounded-xl transition-all"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="px-5 py-2 text-sm font-semibold text-white bg-blue-600 hover:bg-blue-700 active:bg-blue-800 rounded-xl shadow-sm transition-all"
                  >
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
}

function BoolIndicator({ value }: { value: boolean }) {
  return value ? (
    <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-emerald-50 text-emerald-600">
      <Check className="w-3.5 h-3.5" />
    </span>
  ) : (
    <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-slate-100 text-slate-300">
      <Minus className="w-3.5 h-3.5" />
    </span>
  );
}
