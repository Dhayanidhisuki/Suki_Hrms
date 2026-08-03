"use client";

import { useState, useEffect, useCallback } from "react";
import { Plus, Search, Edit2, Trash2, X, CheckCircle2, XCircle, AlertTriangle, Eye } from "lucide-react";
import Sidebar from "@/app/dashboard/components/Sidebar";
import TopBar from "@/app/dashboard/components/TopBar";
import RoleGate from "@/app/dashboard/components/RoleGate";
import { TableSkeleton } from "@/app/dashboard/components/LoadingSkeleton";
import { ModuleKpiRow } from "@/app/dashboard/components/ModuleKpiRow";
import { Users, ShieldCheck, Building } from "lucide-react";
import { apiGet, apiPost, apiPut, apiDelete, apiPatch } from "@/lib/apiClient";
import { Button } from "@/components/ui/button";
import { TablePager } from "@/components/TablePager";
import { useSuccessOverlay } from "@/components/SuccessOverlay";

export interface Supplier {
  id: string;
  supCode: string;
  supName: string;
  address: string | null;
  city: string | null;
  state: string | null;
  phone: string | null;
  email: string | null;
  gstin: string | null;
  status: "Active" | "Inactive";
  isApproved: boolean;
  creatUserIdCd: string;
  creatDt: string | null;
}

export default function SuppliersPage() {
  const { showSuccess } = useSuccessOverlay();
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const pageSize = 20;
  const [loading, setLoading] = useState(true);
  const [selectedDetail, setSelectedDetail] = useState<Supplier | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [bannerMsg, setBannerMsg] = useState<{ type: "success" | "error"; text: string } | null>(null);

  // Filters
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<"All" | "Active" | "Inactive">("All");
  const [approvalFilter, setApprovalFilter] = useState<"All" | "Approved" | "Pending">("All");

  // Slide-over Form State
  const [isOpen, setIsOpen] = useState(false);
  const [editSupplier, setEditSupplier] = useState<Supplier | null>(null);

  // Form Fields
  const [supCode, setSupCode] = useState("");
  const [supName, setSupName] = useState("");
  const [address, setAddress] = useState("");
  const [city, setCity] = useState("");
  const [state, setState] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [gstin, setGstin] = useState("");
  const [status, setStatus] = useState<"Active" | "Inactive">("Active");
  const [isApproved, setIsApproved] = useState(false);

  // Field Errors
  const [errors, setErrors] = useState<Record<string, string>>({});

  const loadSuppliers = useCallback(async () => {
    setLoading(true);
    const params = new URLSearchParams({
      page: String(page),
      pageSize: String(pageSize),
    });
    if (query.trim()) params.set("search", query.trim());
    if (statusFilter !== "All") params.set("status", statusFilter);
    if (approvalFilter === "Approved") params.set("approved", "Yes");
    if (approvalFilter === "Pending") params.set("approved", "No");

    const res = await apiGet<{ items: Supplier[]; total?: number }>(`/api/suppliers?${params}`);
    if (res.data?.items) setSuppliers(res.data.items);
    else setSuppliers([]);
    setTotal(res.data?.total ?? 0);
    setLoading(false);
  }, [query, statusFilter, approvalFilter, page, pageSize]);

  useEffect(() => {
    loadSuppliers();
  }, [loadSuppliers]);

  const handleOpenAdd = () => {
    setEditSupplier(null);
    setSupCode("");
    setSupName("");
    setAddress("");
    setCity("");
    setState("");
    setPhone("");
    setEmail("");
    setGstin("");
    setStatus("Active");
    setIsApproved(false);
    setErrors({});
    setIsOpen(true);
  };

  const handleOpenEdit = (sup: Supplier) => {
    setEditSupplier(sup);
    setSupCode(sup.supCode);
    setSupName(sup.supName);
    setAddress(sup.address ?? "");
    setCity(sup.city ?? "");
    setState(sup.state ?? "");
    setPhone(sup.phone ?? "");
    setEmail(sup.email ?? "");
    setGstin(sup.gstin ?? "");
    setStatus(sup.status);
    setIsApproved(sup.isApproved);
    setErrors({});
    setIsOpen(true);
  };

  const handleApprove = async (id: string) => {
    setBannerMsg(null);
    const res = await apiPatch<{ supplier: Supplier }>(`/api/suppliers/${encodeURIComponent(id)}`, {});
    if (res.error) {
      setBannerMsg({ type: "error", text: res.error.message });
      return;
    }
    setBannerMsg({ type: "success", text: "Supplier approval toggled." });
    loadSuppliers();
  };

  const handleDelete = async (id: string) => {
    setBannerMsg(null);
    const res = await apiDelete(`/api/suppliers/${encodeURIComponent(id)}`);
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

    if (!supName.trim()) tempErrors.supName = "Supplier Name is required";
    if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      tempErrors.email = "Invalid email format";
    }

    if (Object.keys(tempErrors).length > 0) {
      setErrors(tempErrors);
      return;
    }

    const payload = {
      supCode: supCode || undefined,
      supName,
      address,
      city,
      state,
      phone,
      email,
      gstin,
      status,
      isApproved,
    };

    setBannerMsg(null);
    const res = editSupplier
      ? await apiPut<{ supplier: Supplier }>(
          `/api/suppliers/${encodeURIComponent(editSupplier.supCode)}`,
          payload
        )
      : await apiPost<{ supplier: Supplier }>("/api/suppliers", payload);

    if (res.error) {
      setBannerMsg({ type: "error", text: res.error.message });
      return;
    }

    setBannerMsg({
      type: "success",
      text: editSupplier ? "Supplier updated successfully." : "Supplier created successfully.",
    });
    showSuccess({
      title: "Record saved",
      message: editSupplier ? "Supplier updated successfully." : "Supplier created successfully.",
      detail: supName.trim() || undefined,
    });
    setIsOpen(false);
    loadSuppliers();
  };

  // Server already filters by search / status / approval
  const filtered = suppliers;

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
                Supplier Master
              </h1>
              <p className="text-sm text-[var(--text-muted)] mt-0.5">
                Manage approved tool suppliers
              </p>
            </div>
            <RoleGate permission="canEditMaster">
              <Button
                id="supplier-add-btn"
                onClick={handleOpenAdd}
                variant="primary"
                className="group"
              >
                <Plus className="w-4 h-4 transition-transform group-hover:rotate-90 duration-200" />
                Add Supplier
              </Button>
            </RoleGate>
          </div>

          {/* ── Module KPI Cards ── */}
          <ModuleKpiRow
            items={[
              {
                id: "total-suppliers",
                label: "Total Suppliers",
                value: total,
                subtext:
                  total > pageSize
                    ? `Showing page ${page} · ${filtered.length} of ${total.toLocaleString()}`
                    : "Registered vendor partners",
                icon: Users,
                iconBg: "bg-[var(--primary-light)]",
                iconColor: "text-[var(--primary)]",
                badge: { label: "Vendors", type: "info" },
              },
              {
                id: "approved-suppliers",
                label: "Approved Suppliers",
                value: suppliers.filter((s) => s.isApproved || (s.status ?? "").toUpperCase() === "ACTIVE" || s.status === "Active").length,
                subtext: "On this page — verified purchase suppliers",
                icon: ShieldCheck,
                iconBg: "bg-emerald-50 dark:bg-emerald-950/30",
                iconColor: "text-emerald-600 dark:text-emerald-400",
                badge: { label: "Approved", type: "success" },
              },
              {
                id: "gstin-verified",
                label: "GSTIN Registered",
                value: suppliers.filter((s) => s.gstin).length,
                subtext: "On this page — tax registration present",
                icon: CheckCircle2,
                iconBg: "bg-blue-50 dark:bg-blue-950/30",
                iconColor: "text-blue-600 dark:text-blue-400",
                badge: { label: "Verified", type: "info" },
              },
              {
                id: "contact-configured",
                label: "Contact & Phone Set",
                value: suppliers.filter((s) => s.phone || s.email).length,
                subtext: "On this page — registered vendor contacts",
                icon: Building,
                iconBg: "bg-amber-50 dark:bg-amber-950/30",
                iconColor: "text-amber-600 dark:text-amber-400",
                badge: { label: "Contacts", type: "warning" },
              },
            ]}
          />

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
                  id="supplier-search-input"
                  value={query}
                  onChange={(e) => {
                    setQuery(e.target.value);
                    setPage(1);
                  }}
                  placeholder="Search supplier name, code, city, GSTIN…"
                  className="w-full text-sm border border-[var(--border-main)] rounded-lg pl-9 pr-3 py-2 outline-none focus:ring-2 focus:ring-[var(--primary-subtle)] focus:border-[var(--primary)] transition-all bg-[var(--bg-subtle)] text-[var(--text-primary)] placeholder-[var(--text-muted)]"
                />
              </div>

              <div className="flex flex-wrap items-center gap-4">
                {/* Status Filter */}
                <div className="flex items-center gap-1 bg-[var(--bg-subtle)] rounded-lg p-1">
                  {(["All", "Active", "Inactive"] as const).map((f) => (
                    <button
                      key={f}
                      id={`supplier-status-filter-${f.toLowerCase()}`}
                      onClick={() => {
                        setStatusFilter(f);
                        setPage(1);
                      }}
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

                {/* Approval Filter */}
                <div className="flex items-center gap-1 bg-[var(--bg-subtle)] rounded-lg p-1">
                  {(["All", "Approved", "Pending"] as const).map((f) => (
                    <button
                      key={f}
                      id={`supplier-approval-filter-${f.toLowerCase()}`}
                      onClick={() => {
                        setApprovalFilter(f);
                        setPage(1);
                      }}
                      className={`px-2.5 py-1 rounded-md text-xs font-medium transition-all ${
                        approvalFilter === f
                          ? "bg-[var(--bg-surface)] shadow-sm text-[var(--text-primary)]"
                          : "text-[var(--text-muted)] hover:text-[var(--text-primary)]"
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
          <div className="bg-[var(--bg-card)] rounded-2xl border border-[var(--border-main)] p-5">
            {loading ? (
              <TableSkeleton rows={5} />
            ) : (
            <div className="overflow-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-[var(--border-main)] bg-[var(--bg-subtle)]">
                    {["Code", "Supplier Name", "City", "GSTIN", "Status", "Approved", "Actions"].map((col) => (
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
                      <td className="py-3 px-3 font-mono text-xs text-[var(--text-secondary)]">{s.supCode}</td>
                      <td className="py-3 px-3">
                        <button
                          onClick={() => setSelectedDetail(s)}
                          className="text-left font-medium text-[var(--text-primary)] hover:text-[var(--primary)] hover:underline cursor-pointer"
                        >
                          <p className="font-semibold text-[var(--text-primary)] hover:text-[var(--primary)]">{s.supName}</p>
                          <p className="text-[11px] text-[var(--text-muted)]">{s.email || "No email"} · {s.phone || "No phone"}</p>
                        </button>
                      </td>
                      <td className="py-3 px-3 text-[var(--text-secondary)]">{s.city}</td>
                      <td className="py-3 px-3 font-mono text-xs text-[var(--text-secondary)]">{s.gstin}</td>
                      <td className="py-3 px-3">
                        <span
                          className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold ${
                            (s.status ?? "").toUpperCase() === "ACTIVE"
                              ? "bg-[var(--primary-light)] text-[var(--primary)] border border-[var(--border-main)]"
                              : "bg-[var(--bg-subtle)] text-[var(--text-muted)] border border-[var(--border-main)]"
                          }`}
                        >
                          {s.status}
                        </span>
                      </td>
                      <td className="py-3 px-3">
                        {s.isApproved ? (
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold bg-[var(--color-success-bg)] text-[var(--color-success-text)] border border-[var(--border-main)]">
                            <CheckCircle2 className="w-3 h-3" /> Approved
                          </span>
                        ) : (
                          <RoleGate
                            permission="canApproveSupplier"
                            fallback={
                              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold bg-[var(--color-warning-bg)] text-[var(--color-warning-text)] border border-[var(--border-main)]">
                                <XCircle className="w-3 h-3" /> Pending
                              </span>
                            }
                          >
                            <button
                              id={`supplier-approve-${s.id}`}
                              onClick={() => handleApprove(s.id)}
                              className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold bg-[var(--color-warning-bg)] text-[var(--color-warning-text)] hover:opacity-90 border border-[var(--border-main)] transition-colors"
                            >
                              <XCircle className="w-3 h-3" /> Approve
                            </button>
                          </RoleGate>
                        )}
                      </td>
                      <td className="py-3 px-3">
                        <div className="flex items-center gap-1.5">
                          <button
                            onClick={() => setSelectedDetail(s)}
                            title="View Details"
                            className="p-1.5 hover:bg-[var(--bg-hover)] rounded-lg text-[var(--text-muted)] hover:text-[var(--primary)] transition-colors cursor-pointer"
                          >
                            <Eye className="w-4 h-4" />
                          </button>
                          <RoleGate permission="canEditMaster">
                            <button
                              id={`supplier-edit-btn-${s.id}`}
                              onClick={() => handleOpenEdit(s)}
                              className="p-1.5 hover:bg-[var(--bg-hover)] rounded-lg text-[var(--text-muted)] hover:text-[var(--text-primary)] transition-colors cursor-pointer"
                              title="Edit Supplier"
                            >
                              <Edit2 className="w-4 h-4" />
                            </button>
                            <button
                              id={`supplier-delete-btn-${s.id}`}
                              onClick={() => handleDelete(s.id)}
                              className="p-1.5 hover:bg-[var(--color-danger-bg)] rounded-lg text-[var(--text-muted)] hover:text-[var(--color-danger-text)] transition-colors cursor-pointer"
                              title="Delete Supplier"
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
                        No suppliers found matching your query and filters.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
            )}

            <TablePager
              page={page}
              pageSize={pageSize}
              total={total}
              onPageChange={setPage}
              disabled={loading}
              idPrefix="supplier"
            />
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
                {editSupplier ? `Edit: ${editSupplier.supName}` : "Add New Supplier"}
              </h2>
              <button onClick={() => setIsOpen(false)} className="p-1.5 rounded-lg hover:bg-[var(--bg-hover)] text-[var(--text-muted)] hover:text-[var(--text-primary)] transition-colors">
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Form Content */}
            <form onSubmit={handleSave} className="flex-1 overflow-y-auto p-5 space-y-4">
              {/* Special warnings for SUP-000035 */}
              {supCode === "SUP-000035" && (
                <div className="p-3 bg-[var(--color-warning-bg)] border border-[var(--border-main)] rounded-xl text-xs text-[var(--color-warning-text)] flex gap-2.5 items-start">
                  <AlertTriangle className="w-4.5 h-4.5 text-amber-500 shrink-0 mt-0.5" />
                  <span>
                    <strong>Warning:</strong> This supplier is linked to tools records with no matching supplier. Review before changes.
                  </span>
                </div>
              )}

              <div>
                <label className="block text-xs font-semibold text-[var(--text-muted)] uppercase tracking-wider mb-1">
                  Supplier Code
                </label>
                <input
                  id="form-supcode"
                  value={supCode}
                  onChange={(e) => setSupCode(e.target.value)}
                  placeholder="Auto-generated if empty"
                  disabled={!!editSupplier}
                  className="w-full text-sm border border-[var(--border-main)] rounded-lg px-3 py-2 outline-none focus:ring-2 focus:ring-[var(--primary-subtle)] focus:border-[var(--primary)] bg-[var(--bg-subtle)] text-[var(--text-primary)] placeholder-[var(--text-muted)] font-mono uppercase disabled:bg-[var(--bg-hover)] disabled:text-[var(--text-muted)]"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-[var(--text-muted)] uppercase tracking-wider mb-1">
                  Supplier Name *
                </label>
                <input
                  id="form-supname"
                  value={supName}
                  onChange={(e) => setSupName(e.target.value)}
                  placeholder="e.g. Apex Precision Tools Ltd"
                  className="w-full text-sm border border-[var(--border-main)] rounded-lg px-3 py-2 outline-none focus:ring-2 focus:ring-[var(--primary-subtle)] focus:border-[var(--primary)] bg-[var(--bg-subtle)] text-[var(--text-primary)] placeholder-[var(--text-muted)]"
                />
                {errors.supName && <p className="text-[var(--color-danger-text)] text-xs mt-1 font-medium">{errors.supName}</p>}
              </div>

              <div>
                <label className="block text-xs font-semibold text-[var(--text-muted)] uppercase tracking-wider mb-1">
                  Address
                </label>
                <textarea
                  id="form-address"
                  rows={2}
                  value={address}
                  onChange={(e) => setAddress(e.target.value)}
                  placeholder="Street address, Industrial area"
                  className="w-full text-sm border border-[var(--border-main)] rounded-lg px-3 py-2 outline-none focus:ring-2 focus:ring-[var(--primary-subtle)] focus:border-[var(--primary)] bg-[var(--bg-subtle)] text-[var(--text-primary)] placeholder-[var(--text-muted)] resize-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-[var(--text-muted)] uppercase tracking-wider mb-1">
                    City
                  </label>
                  <input
                    id="form-city"
                    value={city}
                    onChange={(e) => setCity(e.target.value)}
                    placeholder="e.g. Bangalore"
                    className="w-full text-sm border border-[var(--border-main)] rounded-lg px-3 py-2 outline-none focus:ring-2 focus:ring-[var(--primary-subtle)] focus:border-[var(--primary)] bg-[var(--bg-subtle)] text-[var(--text-primary)] placeholder-[var(--text-muted)]"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-[var(--text-muted)] uppercase tracking-wider mb-1">
                    State
                  </label>
                  <input
                    id="form-state"
                    value={state}
                    onChange={(e) => setState(e.target.value)}
                    placeholder="e.g. Karnataka"
                    className="w-full text-sm border border-[var(--border-main)] rounded-lg px-3 py-2 outline-none focus:ring-2 focus:ring-[var(--primary-subtle)] focus:border-[var(--primary)] bg-[var(--bg-subtle)] text-[var(--text-primary)] placeholder-[var(--text-muted)]"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-[var(--text-muted)] uppercase tracking-wider mb-1">
                    Phone
                  </label>
                  <input
                    id="form-phone"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    placeholder="+91 98765 43210"
                    className="w-full text-sm border border-[var(--border-main)] rounded-lg px-3 py-2 outline-none focus:ring-2 focus:ring-[var(--primary-subtle)] focus:border-[var(--primary)] bg-[var(--bg-subtle)] text-[var(--text-primary)] placeholder-[var(--text-muted)] font-mono"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-[var(--text-muted)] uppercase tracking-wider mb-1">
                    Email
                  </label>
                  <input
                    id="form-email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="sales@vendor.com"
                    className="w-full text-sm border border-[var(--border-main)] rounded-lg px-3 py-2 outline-none focus:ring-2 focus:ring-[var(--primary-subtle)] focus:border-[var(--primary)] bg-[var(--bg-subtle)] text-[var(--text-primary)] placeholder-[var(--text-muted)] font-mono"
                  />
                  {errors.email && <p className="text-[var(--color-danger-text)] text-xs mt-1 font-medium">{errors.email}</p>}
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-[var(--text-muted)] uppercase tracking-wider mb-1">
                  GSTIN Number
                </label>
                <input
                  id="form-gstin"
                  value={gstin}
                  onChange={(e) => setGstin(e.target.value.toUpperCase())}
                  placeholder="29ABCDE1234F1Z5"
                  className="w-full text-sm border border-[var(--border-main)] rounded-lg px-3 py-2 outline-none focus:ring-2 focus:ring-[var(--primary-subtle)] focus:border-[var(--primary)] bg-[var(--bg-subtle)] text-[var(--text-primary)] placeholder-[var(--text-muted)] font-mono uppercase"
                />
              </div>

              <div className="grid grid-cols-2 gap-3 pt-2">
                <div>
                  <label className="block text-xs font-semibold text-[var(--text-muted)] uppercase tracking-wider mb-1">
                    Status
                  </label>
                  <select
                    id="form-status"
                    value={status}
                    onChange={(e) => setStatus(e.target.value as "Active" | "Inactive")}
                    className="w-full text-sm border border-[var(--border-main)] rounded-lg px-3 py-2 bg-[var(--bg-subtle)] text-[var(--text-primary)] outline-none focus:ring-2 focus:ring-[var(--primary-subtle)] focus:border-[var(--primary)]"
                  >
                    <option value="Active">Active</option>
                    <option value="Inactive">Inactive</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-[var(--text-muted)] uppercase tracking-wider mb-1">
                    Approval Status
                  </label>
                  <RoleGate
                    permission="canApproveSupplier"
                    fallback={
                      <div className="px-3 py-2 text-sm border border-[var(--border-main)] rounded-lg bg-[var(--bg-hover)] text-[var(--text-muted)] font-medium">
                        {isApproved ? "Approved" : "Pending"}
                      </div>
                    }
                  >
                    <label className="flex items-center gap-2 pt-2 cursor-pointer">
                      <input
                        type="checkbox"
                        id="form-isapproved"
                        checked={isApproved}
                        onChange={(e) => setIsApproved(e.target.checked)}
                        className="w-4 h-4 text-[var(--primary)] border-[var(--border-main)] rounded focus:ring-[var(--primary)]"
                      />
                      <span className="text-sm font-medium text-[var(--text-primary)]">Approved Vendor</span>
                    </label>
                  </RoleGate>
                </div>
              </div>

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
      {/* ── View Detail Modal ── */}
      {selectedDetail && (
        <div className="fixed inset-0 z-50 overflow-hidden bg-black/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="w-full max-w-xl bg-[var(--bg-card)] rounded-2xl border border-[var(--border-main)] shadow-2xl overflow-hidden animate-fade-in">
            <div className="px-6 py-4 border-b border-[var(--border-main)] flex items-center justify-between bg-[var(--bg-subtle)]">
              <div>
                <div className="flex items-center gap-2">
                  <span className="font-mono text-xs font-bold text-[var(--primary)] bg-[var(--primary-light)] px-2 py-0.5 rounded">
                    {selectedDetail.supCode}
                  </span>
                  {selectedDetail.isApproved && (
                    <span className="text-xs font-semibold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded">
                      Approved Vendor
                    </span>
                  )}
                </div>
                <h2 className="text-lg font-bold text-[var(--text-primary)] mt-1">
                  {selectedDetail.supName}
                </h2>
              </div>
              <button
                onClick={() => setSelectedDetail(null)}
                className="p-1.5 rounded-lg text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-hover)]"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 space-y-4 text-sm max-h-[75vh] overflow-y-auto">
              <div className="grid grid-cols-2 gap-4 bg-[var(--bg-subtle)] p-4 rounded-xl border border-[var(--border-main)]">
                <div>
                  <p className="text-xs text-[var(--text-muted)] font-semibold uppercase tracking-wider">Supplier Code</p>
                  <p className="font-mono font-bold text-[var(--text-primary)] mt-1">{selectedDetail.supCode}</p>
                </div>
                <div>
                  <p className="text-xs text-[var(--text-muted)] font-semibold uppercase tracking-wider">Supplier Name</p>
                  <p className="font-semibold text-[var(--text-primary)] mt-1">{selectedDetail.supName}</p>
                </div>
                <div>
                  <p className="text-xs text-[var(--text-muted)] font-semibold uppercase tracking-wider">Contact Email</p>
                  <p className="font-medium text-[var(--text-primary)] mt-1">{selectedDetail.email || "—"}</p>
                </div>
                <div>
                  <p className="text-xs text-[var(--text-muted)] font-semibold uppercase tracking-wider">Phone Number</p>
                  <p className="font-mono font-medium text-[var(--text-primary)] mt-1">{selectedDetail.phone || "—"}</p>
                </div>
              </div>

              <div className="space-y-3">
                <h3 className="text-xs font-bold text-[var(--text-muted)] uppercase tracking-wider">Address & Location</h3>
                <div className="p-4 border border-[var(--border-main)] rounded-xl space-y-2">
                  <p className="text-sm text-[var(--text-primary)]">{selectedDetail.address || "No address on file"}</p>
                  <div className="grid grid-cols-2 gap-2 pt-2 border-t border-[var(--border-main)] text-xs">
                    <div><span className="text-[var(--text-muted)]">City:</span> <span className="font-semibold">{selectedDetail.city || "—"}</span></div>
                    <div><span className="text-[var(--text-muted)]">State:</span> <span className="font-semibold">{selectedDetail.state || "—"}</span></div>
                  </div>
                </div>
              </div>

              <div className="space-y-3">
                <h3 className="text-xs font-bold text-[var(--text-muted)] uppercase tracking-wider">Tax & Vendor Registration</h3>
                <div className="grid grid-cols-2 gap-3">
                  <div className="p-3 border border-[var(--border-main)] rounded-xl">
                    <p className="text-xs text-[var(--text-muted)] font-semibold uppercase tracking-wider">GSTIN Number</p>
                    <p className="font-mono font-bold text-[var(--text-primary)] mt-1">{selectedDetail.gstin || "—"}</p>
                  </div>
                  <div className="p-3 border border-[var(--border-main)] rounded-xl">
                    <p className="text-xs text-[var(--text-muted)] font-semibold uppercase tracking-wider">Vendor Status</p>
                    <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-[var(--primary-light)] text-[var(--primary)] mt-1">
                      {selectedDetail.status}
                    </span>
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
                  <Edit2 className="w-4 h-4" /> Edit Supplier
                </Button>
              </RoleGate>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
