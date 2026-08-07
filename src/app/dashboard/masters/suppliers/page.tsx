"use client";

import { useState, useEffect, useCallback } from "react";
import { Plus, Edit2, Trash2, X, CheckCircle2, XCircle, AlertTriangle, Eye, FileSpreadsheet } from "lucide-react";
import Sidebar from "@/app/dashboard/components/Sidebar";
import TopBar from "@/app/dashboard/components/TopBar";
import RoleGate from "@/app/dashboard/components/RoleGate";
import { TableSkeleton } from "@/app/dashboard/components/LoadingSkeleton";
import { ModuleKpiRow } from "@/app/dashboard/components/ModuleKpiRow";
import { Users, ShieldCheck, Building } from "lucide-react";
import { apiGet, apiPost, apiPut, apiDelete, apiPatch } from "@/lib/apiClient";
import { Button } from "@/components/ui/button";
import { TablePager } from "@/components/TablePager";
import { SelectionFilter } from "@/components/ui/SelectionFilter";
import { StatusPillTabs } from "@/components/ui/StatusPillTabs";
import { MasterSearchInput, MasterTableCard } from "@/components/ui/MasterTableCard";
import { toastSuccess, toastError } from "@/lib/appToast";
import { downloadExcel } from "@/lib/downloadExcel";

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
  bankName: string | null;
  accountNumber: string | null;
  ifscCode: string | null;
  status: "Active" | "Inactive" | "Blocked";
  isApproved: boolean;
  creatUserIdCd: string;
  creatDt: string | null;
}

export default function SuppliersPage() {
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const pageSize = 20;
  const [loading, setLoading] = useState(true);
  const [selectedDetail, setSelectedDetail] = useState<Supplier | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);

  // Filters
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<"All" | "Active" | "Inactive" | "Blocked">("All");
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
  const [bankName, setBankName] = useState("");
  const [accountNumber, setAccountNumber] = useState("");
  const [ifscCode, setIfscCode] = useState("");
  const [status, setStatus] = useState<"Active" | "Inactive" | "Blocked">("Active");
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
    setBankName("");
    setAccountNumber("");
    setIfscCode("");
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
    setBankName(sup.bankName ?? "");
    setAccountNumber(sup.accountNumber ?? "");
    setIfscCode(sup.ifscCode ?? "");
    setStatus(sup.status);
    setIsApproved(sup.isApproved);
    setErrors({});
    setIsOpen(true);
  };

  const handleApprove = async (id: string) => {
    const res = await apiPatch<{ supplier: Supplier }>(`/api/suppliers/${encodeURIComponent(id)}`, {});
    if (res.error) {
      toastError(res.error.message);
      return;
    }
    toastSuccess("Supplier approval toggled.");
    loadSuppliers();
  };

  const handleDelete = async (id: string) => {
    const res = await apiDelete(`/api/suppliers/${encodeURIComponent(id)}`);
    if (res.error) {
      toastError(res.error.message);
      return;
    }
    toastSuccess("Supplier deleted.");
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
      bankName: bankName.trim() || undefined,
      accountNumber: accountNumber.trim() || undefined,
      ifscCode: ifscCode.trim() || undefined,
      status,
      isApproved,
    };

    const res = editSupplier
      ? await apiPut<{ supplier: Supplier }>(
          `/api/suppliers/${encodeURIComponent(editSupplier.supCode)}`,
          payload
        )
      : await apiPost<{ supplier: Supplier }>("/api/suppliers", payload);

    if (res.error) {
      toastError(res.error.message);
      return;
    }

    toastSuccess({
      title: "Record saved",
      message: editSupplier ? "Supplier updated successfully." : "Supplier created successfully.",
      detail: supName.trim() || undefined,
    });
    setIsOpen(false);
    loadSuppliers();
  };

  // Server already filters by search / status / approval
  const filtered = suppliers;

  const handleExportExcel = async () => {
    const params = new URLSearchParams({ page: "1", pageSize: "500" });
    if (query.trim()) params.set("search", query.trim());
    if (statusFilter !== "All") params.set("status", statusFilter);
    if (approvalFilter === "Approved") params.set("approved", "Yes");
    if (approvalFilter === "Pending") params.set("approved", "No");
    const res = await apiGet<{ items: Supplier[] }>(`/api/suppliers?${params}`);
    const rows = res.data?.items ?? [];
    if (rows.length === 0) {
      toastError("Nothing to export.");
      return;
    }
    downloadExcel({
      filename: "suppliers",
      sheetName: "Suppliers",
      columns: [
        { key: "supCode", label: "Code" },
        { key: "supName", label: "Name" },
        { key: "address", label: "Address" },
        { key: "city", label: "City" },
        { key: "state", label: "State" },
        { key: "phone", label: "Phone" },
        { key: "email", label: "Email" },
        { key: "gstin", label: "GSTIN" },
        { key: "bankName", label: "Bank Name" },
        { key: "accountNumber", label: "Account No" },
        { key: "ifscCode", label: "IFSC" },
        { key: "status", label: "Status" },
        { key: "isApproved", label: "Approved", value: (r) => (r.isApproved ? "Yes" : "No") },
      ],
      rows,
    });
    toastSuccess(`Exported ${rows.length} suppliers.`);
  };

  return (
    <div className="flex h-screen bg-[var(--bg-app)] text-[var(--text-primary)] overflow-hidden">
      <Sidebar />
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        <TopBar />
        <main className="flex-1 overflow-y-auto px-7 py-6">
          {/* ── Header ── */}
          <div className="flex items-center justify-between mb-6 gap-3 flex-wrap">
            <div>
              <h1 className="text-2xl font-bold text-[var(--text-primary)] tracking-tight">
                Supplier Master
              </h1>
              <p className="text-sm text-[var(--text-muted)] mt-0.5">
                Manage approved tool suppliers (SUPPLIER). Bank / IFSC fields from Prisma; ERP-only columns (Vendor Code, ASN, PAN…) not mapped.
              </p>
            </div>
            <div className="flex items-center gap-2">
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

          <StatusPillTabs
            className="mb-3"
            idPrefix="supplier-status-pill"
            value={statusFilter}
            onChange={(v) => {
              setStatusFilter(v);
              setPage(1);
            }}
            items={[
              { value: "All", label: "All", count: total },
              {
                value: "Active",
                label: "Active",
                count: suppliers.filter((s) => s.status === "Active").length,
              },
              {
                value: "Inactive",
                label: "Inactive",
                count: suppliers.filter((s) => s.status === "Inactive").length,
              },
              {
                value: "Blocked",
                label: "Blocked",
                count: suppliers.filter((s) => s.status === "Blocked").length,
              },
            ]}
          />

          <MasterTableCard
            toolbar={
              <>
                <MasterSearchInput
                  id="supplier-search-input"
                  value={query}
                  onChange={(v) => {
                    setQuery(v);
                    setPage(1);
                  }}
                  placeholder="Search"
                />
                <div className="flex items-center gap-1.5 shrink-0">
                  <SelectionFilter
                    id="supplier-approval-filter"
                    label="Approval"
                    value={approvalFilter}
                    anyValue="All"
                    anyLabel="Any"
                    maxValueWidth="4rem"
                    onChange={(v) => {
                      setApprovalFilter(v);
                      setPage(1);
                    }}
                    options={[
                      { value: "All", label: "Any" },
                      { value: "Approved", label: "Approved" },
                      { value: "Pending", label: "Pending" },
                    ]}
                  />
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="h-7 !rounded-md !px-2 !text-[11px]"
                    title="Export Excel"
                    onClick={() => void handleExportExcel()}
                  >
                    <FileSpreadsheet className="w-3 h-3" />
                    Excel
                  </Button>
                </div>
              </>
            }
            footer={
              <TablePager
                page={page}
                pageSize={pageSize}
                total={total}
                onPageChange={setPage}
                disabled={loading}
                idPrefix="supplier"
              />
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
                    {["Code", "Supplier Name", "City", "GSTIN", "Bank", "Status", "Approved", "Actions"].map((col) => (
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
                      <td className="py-3 px-3 text-xs text-[var(--text-secondary)] max-w-[8rem] truncate" title={s.bankName || ""}>
                        {s.bankName || "—"}
                      </td>
                      <td className="py-3 px-3">
                        <span
                          className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold ${
                            s.status === "Active"
                              ? "bg-[var(--primary-light)] text-[var(--primary)] border border-[var(--border-main)]"
                              : s.status === "Blocked"
                                ? "bg-rose-50 text-rose-700 border border-rose-200 dark:bg-rose-950/30 dark:text-rose-300"
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
                      <td colSpan={8} className="py-8 text-center text-sm text-[var(--text-muted)]">
                        No suppliers found matching your query and filters.
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
            <form onSubmit={handleSave} className="flex-1 overflow-y-auto p-5 space-y-5">
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
                <label className="form-label">
                  Supplier Code
                </label>
                <input
                  id="form-supcode"
                  value={supCode}
                  onChange={(e) => setSupCode(e.target.value)}
                  placeholder="Auto-generated if empty"
                  disabled={!!editSupplier}
                  className="form-control placeholder-[var(--text-muted)] font-mono uppercase disabled:bg-[var(--bg-hover)] disabled:text-[var(--text-muted)]"
                />
              </div>

              <div>
                <label className="form-label">
                  Supplier Name *
                </label>
                <input
                  id="form-supname"
                  value={supName}
                  onChange={(e) => setSupName(e.target.value)}
                  placeholder="e.g. Apex Precision Tools Ltd"
                  className="form-control placeholder-[var(--text-muted)]"
                />
                {errors.supName && <p className="text-[var(--color-danger-text)] text-xs mt-1 font-medium">{errors.supName}</p>}
              </div>

              <div>
                <label className="form-label">
                  Address
                </label>
                <textarea
                  id="form-address"
                  rows={2}
                  value={address}
                  onChange={(e) => setAddress(e.target.value)}
                  placeholder="Street address, Industrial area"
                  className="form-control placeholder-[var(--text-muted)] resize-none"
                />
              </div>

              <div className="form-grid">
                <div>
                  <label className="form-label">
                    City
                  </label>
                  <input
                    id="form-city"
                    value={city}
                    onChange={(e) => setCity(e.target.value)}
                    placeholder="e.g. Bangalore"
                    className="form-control placeholder-[var(--text-muted)]"
                  />
                </div>
                <div>
                  <label className="form-label">
                    State
                  </label>
                  <input
                    id="form-state"
                    value={state}
                    onChange={(e) => setState(e.target.value)}
                    placeholder="e.g. Karnataka"
                    className="form-control placeholder-[var(--text-muted)]"
                  />
                </div>
              </div>

              <div className="form-grid">
                <div>
                  <label className="form-label">
                    Phone
                  </label>
                  <input
                    id="form-phone"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    placeholder="+91 98765 43210"
                    className="form-control placeholder-[var(--text-muted)] font-mono"
                  />
                </div>
                <div>
                  <label className="form-label">
                    Email
                  </label>
                  <input
                    id="form-email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="sales@vendor.com"
                    className="form-control placeholder-[var(--text-muted)] font-mono"
                  />
                  {errors.email && <p className="text-[var(--color-danger-text)] text-xs mt-1 font-medium">{errors.email}</p>}
                </div>
              </div>

              <div>
                <label className="form-label">
                  GSTIN Number
                </label>
                <input
                  id="form-gstin"
                  value={gstin}
                  onChange={(e) => setGstin(e.target.value.toUpperCase())}
                  placeholder="29ABCDE1234F1Z5"
                  className="form-control placeholder-[var(--text-muted)] font-mono uppercase"
                />
              </div>

              <div className="border-t border-[var(--border-main)] pt-3 space-y-3">
                <p className="text-[11px] font-bold text-[var(--text-muted)] uppercase tracking-wider">Bank details</p>
                <div>
                  <label className="form-label">Bank Name</label>
                  <input
                    id="form-bank-name"
                    value={bankName}
                    onChange={(e) => setBankName(e.target.value)}
                    className="form-control"
                    maxLength={50}
                  />
                </div>
                <div className="form-grid">
                  <div>
                    <label className="form-label">Account Number</label>
                    <input
                      id="form-account"
                      value={accountNumber}
                      onChange={(e) => setAccountNumber(e.target.value)}
                      className="form-control font-mono"
                      maxLength={30}
                    />
                  </div>
                  <div>
                    <label className="form-label">IFSC</label>
                    <input
                      id="form-ifsc"
                      value={ifscCode}
                      onChange={(e) => setIfscCode(e.target.value.toUpperCase())}
                      className="form-control font-mono uppercase"
                      maxLength={30}
                    />
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3 pt-2">
                <div>
                  <label className="form-label">
                    Status
                  </label>
                  <select
                    id="form-status"
                    value={status}
                    onChange={(e) => setStatus(e.target.value as "Active" | "Inactive" | "Blocked")}
                    className="form-control outline-none focus:ring-2 focus:ring-[var(--primary-subtle)] focus:border-[var(--primary)]"
                  >
                    <option value="Active">Active</option>
                    <option value="Inactive">Inactive</option>
                    <option value="Blocked">Blocked</option>
                  </select>
                </div>
                <div>
                  <label className="form-label">
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
                <div className="form-grid">
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

              <div className="space-y-3">
                <h3 className="text-xs font-bold text-[var(--text-muted)] uppercase tracking-wider">Bank</h3>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div className="p-3 border border-[var(--border-main)] rounded-xl">
                    <p className="text-xs text-[var(--text-muted)] font-semibold uppercase tracking-wider">Bank Name</p>
                    <p className="font-medium mt-1">{selectedDetail.bankName || "—"}</p>
                  </div>
                  <div className="p-3 border border-[var(--border-main)] rounded-xl">
                    <p className="text-xs text-[var(--text-muted)] font-semibold uppercase tracking-wider">Account No</p>
                    <p className="font-mono mt-1">{selectedDetail.accountNumber || "—"}</p>
                  </div>
                  <div className="p-3 border border-[var(--border-main)] rounded-xl">
                    <p className="text-xs text-[var(--text-muted)] font-semibold uppercase tracking-wider">IFSC</p>
                    <p className="font-mono mt-1">{selectedDetail.ifscCode || "—"}</p>
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
