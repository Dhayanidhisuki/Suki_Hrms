"use client";

import { useState, useEffect } from "react";
import { Plus, CheckCircle2, XCircle, Search, Edit2, Trash2, X, AlertTriangle } from "lucide-react";
import Sidebar from "@/app/dashboard/components/Sidebar";
import TopBar from "@/app/dashboard/components/TopBar";
import RoleGate from "@/app/dashboard/components/RoleGate";
import { TableSkeleton } from "@/app/dashboard/components/LoadingSkeleton";
import { apiGet, apiPost, apiPut, apiPatch, apiDelete } from "@/lib/apiClient";
import { useSession } from "@/lib/SessionContext";

export interface Supplier {
  id: number;
  supCode: string;
  supName: string;
  address: string | null;
  city: string | null;
  state: string | null;
  gstin: string | null;
  phone: string | null;
  email: string | null;
  bankName: string | null;
  accountNo: string | null;
  ifscCode: string | null;
  isApproved: boolean;
  status: "Active" | "Inactive";
  creatUserIdCd: string;
  creatDt: string;
}

export default function SuppliersPage() {
  const { can } = useSession();
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [loading, setLoading] = useState(true);
  const [bannerMsg, setBannerMsg] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<"All" | "Active" | "Inactive">("All");
  const [approvalFilter, setApprovalFilter] = useState<"All" | "Approved" | "Pending">("All");

  // Slide-over form state
  const [isOpen, setIsOpen] = useState(false);
  const [editSupplier, setEditSupplier] = useState<Supplier | null>(null);

  // Form Fields
  const [supCode, setSupCode] = useState("");
  const [supName, setSupName] = useState("");
  const [address, setAddress] = useState("");
  const [city, setCity] = useState("");
  const [state, setState] = useState("");
  const [gstin, setGstin] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [bankName, setBankName] = useState("");
  const [accountNo, setAccountNo] = useState("");
  const [ifscCode, setIfscCode] = useState("");
  const [status, setStatus] = useState<"Active" | "Inactive">("Active");
  const [isApproved, setIsApproved] = useState(false);

  // Validation Error State
  const [errors, setErrors] = useState<Record<string, string>>({});

  async function loadSuppliers() {
    setLoading(true);
    const params = new URLSearchParams();
    if (query) params.set("search", query);
    if (statusFilter !== "All") params.set("status", statusFilter);
    const res = await apiGet<{ items: Supplier[] }>(`/api/suppliers?${params}`);
    if (res.data?.items) setSuppliers(res.data.items);
    setLoading(false);
  }

  useEffect(() => {
    loadSuppliers();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query, statusFilter]);

  const handleOpenAdd = () => {
    setEditSupplier(null);
    setSupCode("");
    setSupName("");
    setAddress("");
    setCity("");
    setState("");
    setGstin("");
    setPhone("");
    setEmail("");
    setBankName("");
    setAccountNo("");
    setIfscCode("");
    setStatus("Active");
    setIsApproved(can("canApproveSupplier"));
    setErrors({});
    setIsOpen(true);
  };

  const handleOpenEdit = (s: Supplier) => {
    setEditSupplier(s);
    setSupCode(s.supCode);
    setSupName(s.supName);
    setAddress(s.address ?? "");
    setCity(s.city ?? "");
    setState(s.state ?? "");
    setGstin(s.gstin ?? "");
    setPhone(s.phone ?? "");
    setEmail(s.email ?? "");
    setBankName(s.bankName ?? "");
    setAccountNo(s.accountNo ?? "");
    setIfscCode(s.ifscCode ?? "");
    setStatus(s.status);
    setIsApproved(s.isApproved);
    setErrors({});
    setIsOpen(true);
  };

  const handleDelete = async (id: number) => {
    if (!confirm("Are you sure you want to delete this supplier?")) return;
    const res = await apiDelete(`/api/suppliers/${id}`);
    if (res.error) {
      setBannerMsg({ type: "error", text: res.error.message });
      return;
    }
    setBannerMsg({ type: "success", text: "Supplier deleted." });
    loadSuppliers();
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    const tempErrors: Record<string, string> = {};

    if (!supCode.trim()) tempErrors.supCode = "Supplier Code is required";
    if (!supName.trim()) tempErrors.supName = "Supplier Name is required";
    if (!address.trim()) tempErrors.address = "Address is required";
    if (!city.trim()) tempErrors.city = "City is required";
    if (!state.trim()) tempErrors.state = "State is required";

    // GSTIN 15-char alphanumeric check
    const gstinRegex = /^[A-Z0-9]{15}$/i;
    if (!gstin.trim()) {
      tempErrors.gstin = "GSTIN is required";
    } else if (!gstinRegex.test(gstin)) {
      tempErrors.gstin = "GSTIN must be exactly 15 alphanumeric characters";
    }

    if (!phone.trim()) tempErrors.phone = "Phone is required";
    if (!email.trim()) tempErrors.email = "Email is required";
    if (!bankName.trim()) tempErrors.bankName = "Bank Name is required";
    if (!accountNo.trim()) tempErrors.accountNo = "Account Number is required";
    if (!ifscCode.trim()) tempErrors.ifscCode = "IFSC Code is required";

    if (Object.keys(tempErrors).length > 0) {
      setErrors(tempErrors);
      return;
    }

    const payload = {
      supCode,
      supName,
      address,
      city,
      state,
      gstin: gstin.toUpperCase(),
      phone,
      email,
      bankName,
      accountNo,
      ifscCode: ifscCode.toUpperCase(),
      status,
      isApproved,
    };

    setBannerMsg(null);
    const res = editSupplier
      ? await apiPut<{ supplier: Supplier }>(`/api/suppliers/${editSupplier.id}`, payload)
      : await apiPost<{ supplier: Supplier }>("/api/suppliers", payload);

    if (res.error) {
      if (res.error.fieldErrors) {
        const flat: Record<string, string> = {};
        for (const [k, v] of Object.entries(res.error.fieldErrors)) {
          flat[k] = Array.isArray(v) ? v[0] : String(v);
        }
        setErrors(flat);
      }
      setBannerMsg({ type: "error", text: res.error.message });
      return;
    }

    setBannerMsg({ type: "success", text: editSupplier ? "Supplier updated." : "Supplier created." });
    setIsOpen(false);
    loadSuppliers();
  };

  const handleApprove = async (id: number) => {
    if (!can("canApproveSupplier")) return;
    const res = await apiPatch(`/api/suppliers/${id}`, {});
    if (res.error) {
      setBannerMsg({ type: "error", text: res.error.message });
      return;
    }
    loadSuppliers();
  };

  const filtered = suppliers.filter((s) => {
    const matchesApproval =
      approvalFilter === "All" ||
      (approvalFilter === "Approved" && s.isApproved) ||
      (approvalFilter === "Pending" && !s.isApproved);

    return matchesApproval;
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
                Supplier Master
              </h1>
              <p className="text-sm text-slate-500 mt-0.5">
                Manage approved tool suppliers
              </p>
            </div>
            <RoleGate permission="canEditMaster">
              <button
                id="supplier-add-btn"
                onClick={handleOpenAdd}
                className="flex items-center gap-2 px-4 py-2.5 bg-blue-600 hover:bg-blue-700 active:bg-blue-800 text-white text-sm font-semibold rounded-xl shadow-sm hover:shadow-md transition-all duration-150 group"
              >
                <Plus className="w-4 h-4 transition-transform group-hover:rotate-90 duration-200" />
                Add Supplier
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
                  id="supplier-search-input"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Search supplier name or code…"
                  className="w-full text-sm border border-slate-200 rounded-lg pl-9 pr-3 py-2 outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-400 transition-all bg-slate-50"
                />
              </div>

              <div className="flex flex-wrap items-center gap-4">
                {/* Status Filter */}
                <div className="flex items-center gap-1 bg-slate-50 rounded-lg p-1">
                  {(["All", "Active", "Inactive"] as const).map((f) => (
                    <button
                      key={f}
                      id={`supplier-status-filter-${f.toLowerCase()}`}
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

                {/* Approval Filter */}
                <div className="flex items-center gap-1 bg-slate-50 rounded-lg p-1">
                  {(["All", "Approved", "Pending"] as const).map((f) => (
                    <button
                      key={f}
                      id={`supplier-approval-filter-${f.toLowerCase()}`}
                      onClick={() => setApprovalFilter(f)}
                      className={`px-2.5 py-1 rounded-md text-xs font-medium transition-all ${
                        approvalFilter === f
                          ? "bg-white shadow-sm text-slate-800"
                          : "text-slate-400 hover:text-slate-600"
                      }`}
                    >
                      {f === "Approved" ? "Approved Only" : f === "Pending" ? "Pending Approval" : "All Approvals"}
                    </button>
                  ))}
                </div>
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
                    {["Code", "Supplier Name", "City", "GSTIN", "Status", "Approved", "Actions"].map((col) => (
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
                      <td className="py-3 pr-4 font-mono text-xs text-slate-500">{s.supCode}</td>
                      <td className="py-3 pr-4">
                        <p className="font-medium text-slate-800">{s.supName}</p>
                        <p className="text-[11px] text-slate-400">{s.email} · {s.phone}</p>
                      </td>
                      <td className="py-3 pr-4 text-slate-600">{s.city}</td>
                      <td className="py-3 pr-4 font-mono text-xs text-slate-500">{s.gstin}</td>
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
                      <td className="py-3 pr-4">
                        {s.isApproved ? (
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold bg-emerald-50 text-emerald-700">
                            <CheckCircle2 className="w-3 h-3" /> Approved
                          </span>
                        ) : (
                          <RoleGate
                            permission="canApproveSupplier"
                            fallback={
                              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold bg-amber-50 text-amber-700">
                                <XCircle className="w-3 h-3" /> Pending
                              </span>
                            }
                          >
                            <button
                              id={`supplier-approve-${s.id}`}
                              onClick={() => handleApprove(s.id)}
                              className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold bg-amber-100 text-amber-800 hover:bg-amber-200 transition-colors"
                            >
                              <XCircle className="w-3 h-3" /> Approve
                            </button>
                          </RoleGate>
                        )}
                      </td>
                      <td className="py-3">
                        <RoleGate permission="canEditMaster">
                          <div className="flex items-center gap-2">
                            <button
                              id={`supplier-edit-btn-${s.id}`}
                              onClick={() => handleOpenEdit(s)}
                              className="p-1.5 hover:bg-slate-100 rounded-lg text-slate-400 hover:text-slate-700 transition-colors"
                              title="Edit Supplier"
                            >
                              <Edit2 className="w-4 h-4" />
                            </button>
                            <button
                              id={`supplier-delete-btn-${s.id}`}
                              onClick={() => handleDelete(s.id)}
                              className="p-1.5 hover:bg-red-50 rounded-lg text-slate-400 hover:text-red-600 transition-colors"
                              title="Delete Supplier"
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
                        No suppliers found matching your query and filters.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
            )}

            <div className="mt-4 pt-3 border-t border-slate-100">
              <span className="text-xs text-slate-400">
                Showing {filtered.length} of {suppliers.length} suppliers
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
                  {editSupplier ? `Edit: ${editSupplier.supName}` : "Add New Supplier"}
                </h2>
                <button onClick={() => setIsOpen(false)} className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-400 hover:text-slate-700 transition-colors">
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Form Content */}
              <form onSubmit={handleSave} className="flex-1 overflow-y-auto p-5 space-y-4">
                {/* Special warnings for SUP-000035 */}
                {supCode === "SUP-000035" && (
                  <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl text-xs text-amber-800 flex gap-2.5 items-start">
                    <AlertTriangle className="w-4.5 h-4.5 text-amber-500 shrink-0 mt-0.5" />
                    <span>
                      <strong>Warning:</strong> This supplier is linked to tools records with no matching supplier. Review before changes.
                    </span>
                  </div>
                )}

                <div>
                  <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">
                    Supplier Code
                  </label>
                  <input
                    id="form-sup-code"
                    value={supCode}
                    onChange={(e) => setSupCode(e.target.value)}
                    placeholder="e.g. S004"
                    disabled={!!editSupplier}
                    className="w-full text-sm border border-slate-200 rounded-lg px-3 py-2 outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-400 transition-all bg-slate-50 disabled:bg-slate-100 disabled:text-slate-400"
                  />
                  {errors.supCode && <p className="text-red-500 text-xs mt-1 font-medium">{errors.supCode}</p>}
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">
                    Supplier Name *
                  </label>
                  <input
                    id="form-sup-name"
                    value={supName}
                    onChange={(e) => setSupName(e.target.value)}
                    placeholder="e.g. Acme Precision Tools"
                    className="w-full text-sm border border-slate-200 rounded-lg px-3 py-2 outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-400 transition-all bg-slate-50"
                  />
                  {errors.supName && <p className="text-red-500 text-xs mt-1 font-medium">{errors.supName}</p>}
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">
                    Address *
                  </label>
                  <textarea
                    id="form-address"
                    rows={3}
                    value={address}
                    onChange={(e) => setAddress(e.target.value)}
                    placeholder="Street, Industrial Area"
                    className="w-full text-sm border border-slate-200 rounded-lg px-3 py-2 outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-400 transition-all bg-slate-50 resize-none"
                  />
                  {errors.address && <p className="text-red-500 text-xs mt-1 font-medium">{errors.address}</p>}
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">
                      City *
                    </label>
                    <input
                      id="form-city"
                      value={city}
                      onChange={(e) => setCity(e.target.value)}
                      placeholder="e.g. Pune"
                      className="w-full text-sm border border-slate-200 rounded-lg px-3 py-2 outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-400 transition-all bg-slate-50"
                    />
                    {errors.city && <p className="text-red-500 text-xs mt-1 font-medium">{errors.city}</p>}
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">
                      State *
                    </label>
                    <input
                      id="form-state"
                      value={state}
                      onChange={(e) => setState(e.target.value)}
                      placeholder="e.g. Maharashtra"
                      className="w-full text-sm border border-slate-200 rounded-lg px-3 py-2 outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-400 transition-all bg-slate-50"
                    />
                    {errors.state && <p className="text-red-500 text-xs mt-1 font-medium">{errors.state}</p>}
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">
                    GSTIN *
                  </label>
                  <input
                    id="form-gstin"
                    value={gstin}
                    onChange={(e) => setGstin(e.target.value)}
                    placeholder="15-char Alphanumeric"
                    maxLength={15}
                    className="w-full text-sm border border-slate-200 rounded-lg px-3 py-2 outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-400 transition-all bg-slate-50 font-mono uppercase"
                  />
                  {errors.gstin && <p className="text-red-500 text-xs mt-1 font-medium">{errors.gstin}</p>}
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">
                      Phone *
                    </label>
                    <input
                      id="form-phone"
                      value={phone}
                      onChange={(e) => setPhone(e.target.value)}
                      placeholder="10-digit number"
                      className="w-full text-sm border border-slate-200 rounded-lg px-3 py-2 outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-400 transition-all bg-slate-50"
                    />
                    {errors.phone && <p className="text-red-500 text-xs mt-1 font-medium">{errors.phone}</p>}
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">
                      Email *
                    </label>
                    <input
                      id="form-email"
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="sales@supplier.com"
                      className="w-full text-sm border border-slate-200 rounded-lg px-3 py-2 outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-400 transition-all bg-slate-50"
                    />
                    {errors.email && <p className="text-red-500 text-xs mt-1 font-medium">{errors.email}</p>}
                  </div>
                </div>

                <div className="border-t border-slate-100 pt-3 space-y-4">
                  <h3 className="text-xs font-bold text-slate-400 uppercase tracking-widest">
                    Bank Details
                  </h3>
                  <div>
                    <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">
                      Bank Name *
                    </label>
                    <input
                      id="form-bank-name"
                      value={bankName}
                      onChange={(e) => setBankName(e.target.value)}
                      placeholder="e.g. HDFC Bank"
                      className="w-full text-sm border border-slate-200 rounded-lg px-3 py-2 outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-400 transition-all bg-slate-50"
                    />
                    {errors.bankName && <p className="text-red-500 text-xs mt-1 font-medium">{errors.bankName}</p>}
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">
                        Account Number *
                      </label>
                      <input
                        id="form-account-no"
                        value={accountNo}
                        onChange={(e) => setAccountNo(e.target.value)}
                        placeholder="Bank Account No"
                        className="w-full text-sm border border-slate-200 rounded-lg px-3 py-2 outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-400 transition-all bg-slate-50"
                      />
                      {errors.accountNo && <p className="text-red-500 text-xs mt-1 font-medium">{errors.accountNo}</p>}
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">
                        IFSC Code *
                      </label>
                      <input
                        id="form-ifsc-code"
                        value={ifscCode}
                        onChange={(e) => setIfscCode(e.target.value)}
                        placeholder="IFSC Code"
                        className="w-full text-sm border border-slate-200 rounded-lg px-3 py-2 outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-400 transition-all bg-slate-50 font-mono uppercase"
                      />
                      {errors.ifscCode && <p className="text-red-500 text-xs mt-1 font-medium">{errors.ifscCode}</p>}
                    </div>
                  </div>
                </div>

                <div className="border-t border-slate-100 pt-3 flex items-center justify-between gap-4">
                  <div>
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

                  <RoleGate permission="canApproveSupplier">
                    <div className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        id="form-is-approved"
                        checked={isApproved}
                        onChange={(e) => setIsApproved(e.target.checked)}
                        className="w-4.5 h-4.5 text-blue-600 border-slate-200 rounded focus:ring-blue-500"
                      />
                      <label htmlFor="form-is-approved" className="text-sm font-semibold text-slate-700 cursor-pointer">
                        Approved Supplier
                      </label>
                    </div>
                  </RoleGate>
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
