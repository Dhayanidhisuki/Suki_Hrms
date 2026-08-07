"use client";

import { useState, useEffect, useCallback } from "react";
import { Plus, Edit2, Trash2, X, Check, Minus, Eye, FileSpreadsheet } from "lucide-react";
import Sidebar from "@/app/dashboard/components/Sidebar";
import TopBar from "@/app/dashboard/components/TopBar";
import RoleGate from "@/app/dashboard/components/RoleGate";
import { TableSkeleton } from "@/app/dashboard/components/LoadingSkeleton";
import { ModuleKpiRow } from "@/app/dashboard/components/ModuleKpiRow";
import { Building2, Home, Store, FileText } from "lucide-react";
import { apiGet, apiPost, apiPut, apiDelete } from "@/lib/apiClient";
import { Button } from "@/components/ui/button";
import { TablePager } from "@/components/TablePager";
import { SelectionFilter } from "@/components/ui/SelectionFilter";
import { StatusPillTabs } from "@/components/ui/StatusPillTabs";
import { MasterSearchInput, MasterTableCard } from "@/components/ui/MasterTableCard";
import { toastSuccess, toastError } from "@/lib/appToast";
import { downloadExcel } from "@/lib/downloadExcel";

export interface Subcontractor {
  id: string;
  subCode: string;
  subName: string;
  natureOfWork: string;
  gstin: string | null;
  add1: string | null;
  add2: string | null;
  address: string | null;
  isStoreVendor: boolean;
  isInhouse: boolean;
  isIssueDC: boolean;
  isApproved: boolean;
  status: "Active" | "Inactive" | "Blocked";
  creatUserIdCd: string;
  creatDt: string | null;
}

export default function SubcontractorsPage() {
  const [subcontractors, setSubcontractors] = useState<Subcontractor[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const pageSize = 20;
  const [loading, setLoading] = useState(true);
  const [selectedDetail, setSelectedDetail] = useState<Subcontractor | null>(null);

  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<"All" | "Active" | "Inactive" | "Blocked">("All");
  const [approvalFilter, setApprovalFilter] = useState<"All" | "Approved" | "Pending">("All");

  const [isOpen, setIsOpen] = useState(false);
  const [editSub, setEditSub] = useState<Subcontractor | null>(null);

  const [subCode, setSubCode] = useState("");
  const [subName, setSubName] = useState("");
  const [natureOfWork, setNatureOfWork] = useState("");
  const [gstin, setGstin] = useState("");
  const [add1, setAdd1] = useState("");
  const [add2, setAdd2] = useState("");
  const [isStoreVendor, setIsStoreVendor] = useState(false);
  const [isInhouse, setIsInhouse] = useState(false);
  const [isIssueDC, setIsIssueDC] = useState(true);
  const [isApproved, setIsApproved] = useState(false);
  const [status, setStatus] = useState<"Active" | "Inactive" | "Blocked">("Active");
  const [errors, setErrors] = useState<Record<string, string>>({});

  const loadSubcontractors = useCallback(async () => {
    setLoading(true);
    const params = new URLSearchParams({
      page: String(page),
      pageSize: String(pageSize),
    });
    if (query.trim()) params.set("search", query.trim());
    if (statusFilter !== "All") params.set("status", statusFilter);
    if (approvalFilter === "Approved") params.set("approved", "Yes");
    if (approvalFilter === "Pending") params.set("approved", "No");

    const res = await apiGet<{ items: Subcontractor[]; total?: number; error?: string }>(
      `/api/subcontractors?${params}`
    );
    if (res.error) {
      setSubcontractors([]);
      setTotal(0);
      toastError(typeof res.error.message === "string" ? res.error.message : "Failed to load subcontractors");
    } else if (res.data?.items) {
      setSubcontractors(res.data.items);
      setTotal(res.data.total ?? res.data.items.length);
    }
    setLoading(false);
  }, [query, statusFilter, approvalFilter, page, pageSize]);

  useEffect(() => {
    void loadSubcontractors();
  }, [loadSubcontractors]);

  const handleOpenAdd = () => {
    setEditSub(null);
    setSubCode("");
    setSubName("");
    setNatureOfWork("");
    setGstin("");
    setAdd1("");
    setAdd2("");
    setIsStoreVendor(false);
    setIsInhouse(false);
    setIsIssueDC(true);
    setIsApproved(false);
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
    setAdd1(sub.add1 ?? "");
    setAdd2(sub.add2 ?? "");
    setIsStoreVendor(sub.isStoreVendor);
    setIsInhouse(sub.isInhouse);
    setIsIssueDC(sub.isIssueDC);
    setIsApproved(sub.isApproved);
    setStatus(sub.status);
    setErrors({});
    setIsOpen(true);
  };

  const handleDelete = async (id: string) => {
    const res = await apiDelete(`/api/subcontractors/${id}`);
    if (res.error) {
      toastError(res.error.message);
      return;
    }
    toastSuccess("Subcontractor deleted.");
    void loadSubcontractors();
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    const tempErrors: Record<string, string> = {};
    if (!subName.trim()) tempErrors.subName = "Subcontractor Name is required";
    if (!natureOfWork.trim()) tempErrors.natureOfWork = "Nature of Work is required";
    if (!editSub && !subCode.trim()) tempErrors.subCode = "Subcontractor Code is required";
    if (Object.keys(tempErrors).length > 0) {
      setErrors(tempErrors);
      return;
    }

    const payload = {
      subCode: subCode || undefined,
      subName,
      natureOfWork,
      gstin,
      add1: add1.trim() || undefined,
      add2: add2.trim() || undefined,
      isStoreVendor,
      isInhouse,
      isIssueDC,
      isApproved,
      status,
    };

    const res = editSub
      ? await apiPut<{ item: Subcontractor }>(`/api/subcontractors/${editSub.id}`, payload)
      : await apiPost<{ item: Subcontractor }>("/api/subcontractors", payload);

    if (res.error) {
      toastError(res.error.message);
      return;
    }

    toastSuccess({
      title: "Record saved",
      message: editSub ? "Subcontractor updated successfully." : "Subcontractor created successfully.",
      detail: subName.trim() || undefined,
    });
    setIsOpen(false);
    void loadSubcontractors();
  };

  const handleExportExcel = async () => {
    const params = new URLSearchParams({ page: "1", pageSize: "500" });
    if (query.trim()) params.set("search", query.trim());
    if (statusFilter !== "All") params.set("status", statusFilter);
    if (approvalFilter === "Approved") params.set("approved", "Yes");
    if (approvalFilter === "Pending") params.set("approved", "No");
    const res = await apiGet<{ items: Subcontractor[] }>(`/api/subcontractors?${params}`);
    const rows = res.data?.items ?? [];
    if (rows.length === 0) {
      toastError("Nothing to export.");
      return;
    }
    downloadExcel({
      filename: "subcontractors",
      sheetName: "Subcontractors",
      columns: [
        { key: "subCode", label: "Code" },
        { key: "subName", label: "Name" },
        { key: "natureOfWork", label: "Nature of Work" },
        { key: "gstin", label: "GSTIN" },
        { key: "add1", label: "Address 1" },
        { key: "add2", label: "Address 2" },
        { key: "isStoreVendor", label: "Store Vendor", value: (r) => (r.isStoreVendor ? "Yes" : "No") },
        { key: "isInhouse", label: "In-House", value: (r) => (r.isInhouse ? "Yes" : "No") },
        { key: "isIssueDC", label: "Issue DC", value: (r) => (r.isIssueDC ? "Yes" : "No") },
        { key: "isApproved", label: "Approved", value: (r) => (r.isApproved ? "Yes" : "No") },
        { key: "status", label: "Status" },
      ],
      rows,
    });
    toastSuccess(`Exported ${rows.length} subcontractors.`);
  };

  return (
    <div className="flex h-screen bg-[var(--bg-app)] text-[var(--text-primary)] overflow-hidden">
      <Sidebar />
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        <TopBar />
        <main className="flex-1 overflow-y-auto px-7 py-6">
          <div className="flex items-center justify-between mb-6 gap-3 flex-wrap">
            <div>
              <h1 className="text-2xl font-bold text-[var(--text-primary)] tracking-tight">
                Subcontractor Master
              </h1>
              <p className="text-sm text-[var(--text-muted)] mt-0.5">
                Calibration labs and repair vendors (SUBCONTRACTOR). ERP-only fields (Vendor Code, ASN, PAN…) not in Prisma.
              </p>
            </div>
            <div className="flex items-center gap-2">
              <RoleGate permission="canEditMaster">
                <Button id="subcontractor-add-btn" onClick={handleOpenAdd} variant="primary" className="group">
                  <Plus className="w-4 h-4 transition-transform group-hover:rotate-90 duration-200" />
                  Add Subcontractor
                </Button>
              </RoleGate>
            </div>
          </div>

          <ModuleKpiRow
            items={[
              {
                id: "total-subcontractors",
                label: "Total Subcontractors",
                value: total,
                subtext:
                  total > pageSize
                    ? `Page ${page} · ${subcontractors.length} of ${total.toLocaleString()}`
                    : "Registered partners",
                icon: Building2,
                iconBg: "bg-[var(--primary-light)]",
                iconColor: "text-[var(--primary)]",
                badge: { label: "Vendors", type: "info" },
              },
              {
                id: "inhouse",
                label: "In-House",
                value: subcontractors.filter((s) => s.isInhouse).length,
                subtext: "On this page",
                icon: Home,
                iconBg: "bg-emerald-50 dark:bg-emerald-950/30",
                iconColor: "text-emerald-600",
                badge: { label: "Internal", type: "success" },
              },
              {
                id: "store",
                label: "Store Vendors",
                value: subcontractors.filter((s) => s.isStoreVendor).length,
                subtext: "On this page",
                icon: Store,
                iconBg: "bg-blue-50 dark:bg-blue-950/30",
                iconColor: "text-blue-600",
                badge: { label: "Store", type: "info" },
              },
              {
                id: "approved",
                label: "Approved",
                value: subcontractors.filter((s) => s.isApproved).length,
                subtext: "On this page",
                icon: FileText,
                iconBg: "bg-amber-50 dark:bg-amber-950/30",
                iconColor: "text-amber-600",
                badge: { label: "Approved", type: "warning" },
              },
            ]}
          />

          <StatusPillTabs
            className="mb-3"
            idPrefix="subcontractor-status-pill"
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
                count: subcontractors.filter((s) => s.status === "Active").length,
              },
              {
                value: "Inactive",
                label: "Inactive",
                count: subcontractors.filter((s) => s.status === "Inactive").length,
              },
              {
                value: "Blocked",
                label: "Blocked",
                count: subcontractors.filter((s) => s.status === "Blocked").length,
              },
            ]}
          />

          <MasterTableCard
            toolbar={
              <>
                <MasterSearchInput
                  id="subcontractor-search-input"
                  value={query}
                  onChange={(v) => {
                    setQuery(v);
                    setPage(1);
                  }}
                  placeholder="Search"
                />
                <div className="flex items-center gap-1.5 shrink-0">
                  <SelectionFilter
                    id="subcontractor-approval-filter"
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
                idPrefix="subcontractor"
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
                      {[
                        "Code",
                        "Name",
                        "Nature of Work",
                        "Approved",
                        "In-House",
                        "Store Vendor",
                        "Status",
                        "Actions",
                      ].map((col) => (
                        <th
                          key={col}
                          className="text-left text-[11px] font-semibold text-[var(--text-muted)] uppercase tracking-wider py-2.5 px-3"
                        >
                          {col}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[var(--border-main)]">
                    {subcontractors.map((s) => (
                      <tr key={s.id} className="hover:bg-[var(--bg-hover)] transition-colors">
                        <td className="py-3 px-3 font-mono text-xs">{s.subCode}</td>
                        <td className="py-3 px-3">
                          <button type="button" onClick={() => setSelectedDetail(s)} className="text-left group cursor-pointer">
                            <p className="font-semibold group-hover:text-[var(--primary)]">{s.subName}</p>
                            <p className="text-[11px] text-[var(--text-muted)]">{s.address || "No address"}</p>
                          </button>
                        </td>
                        <td className="py-3 px-3 text-[var(--text-secondary)]">{s.natureOfWork}</td>
                        <td className="py-3 px-3">
                          <BoolIndicator value={s.isApproved} />
                        </td>
                        <td className="py-3 px-3">
                          <BoolIndicator value={s.isInhouse} />
                        </td>
                        <td className="py-3 px-3">
                          <BoolIndicator value={s.isStoreVendor} />
                        </td>
                        <td className="py-3 px-3">
                          <span
                            className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold border ${
                              s.status === "Active"
                                ? "bg-[var(--primary-light)] text-[var(--primary)] border-[var(--border-main)]"
                                : s.status === "Blocked"
                                  ? "bg-rose-50 text-rose-700 border-rose-200"
                                  : "bg-[var(--bg-subtle)] text-[var(--text-muted)] border-[var(--border-main)]"
                            }`}
                          >
                            {s.status}
                          </span>
                        </td>
                        <td className="py-3 px-3">
                          <div className="flex items-center gap-1.5">
                            <button
                              type="button"
                              onClick={() => setSelectedDetail(s)}
                              className="p-1.5 hover:bg-[var(--bg-hover)] rounded-lg text-[var(--text-muted)] hover:text-[var(--primary)]"
                            >
                              <Eye className="w-4 h-4" />
                            </button>
                            <RoleGate permission="canEditMaster">
                              <button
                                type="button"
                                id={`subcon-edit-btn-${s.id}`}
                                onClick={() => handleOpenEdit(s)}
                                className="p-1.5 hover:bg-[var(--bg-hover)] rounded-lg text-[var(--text-muted)]"
                              >
                                <Edit2 className="w-4 h-4" />
                              </button>
                              <button
                                type="button"
                                id={`subcon-delete-btn-${s.id}`}
                                onClick={() => void handleDelete(s.id)}
                                className="p-1.5 hover:bg-[var(--color-danger-bg)] rounded-lg text-[var(--text-muted)] hover:text-[var(--color-danger-text)]"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            </RoleGate>
                          </div>
                        </td>
                      </tr>
                    ))}
                    {subcontractors.length === 0 && (
                      <tr>
                        <td colSpan={8} className="py-8 text-center text-sm text-[var(--text-muted)]">
                          No subcontractors found.
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

      {isOpen && (
        <div className="fixed inset-0 z-50 overflow-hidden bg-black/40 backdrop-blur-xs flex justify-end animate-fade-in">
          <div className="w-full max-w-md bg-[var(--bg-card)] shadow-2xl flex flex-col h-full border-l border-[var(--border-main)] animate-slide-in-right">
            <div className="px-5 py-4 border-b border-[var(--border-main)] flex items-center justify-between">
              <h2 className="text-base font-bold">
                {editSub ? `Edit: ${editSub.subName}` : "Add New Subcontractor"}
              </h2>
              <button type="button" onClick={() => setIsOpen(false)} className="p-1.5 rounded-lg hover:bg-[var(--bg-hover)]">
                <X className="w-5 h-5" />
              </button>
            </div>
            <form onSubmit={(e) => void handleSave(e)} className="flex-1 overflow-y-auto p-5 space-y-4">
              <div>
                <label className="form-label">Subcontractor Code *</label>
                <input
                  id="form-sub-code"
                  value={subCode}
                  onChange={(e) => setSubCode(e.target.value)}
                  disabled={!!editSub}
                  className="form-control disabled:bg-[var(--bg-hover)]"
                />
                {errors.subCode && <p className="text-[var(--color-danger-text)] text-xs mt-1">{errors.subCode}</p>}
              </div>
              <div>
                <label className="form-label">Subcontractor Name *</label>
                <input
                  id="form-sub-name"
                  value={subName}
                  onChange={(e) => setSubName(e.target.value)}
                  className="form-control"
                />
                {errors.subName && <p className="text-[var(--color-danger-text)] text-xs mt-1">{errors.subName}</p>}
              </div>
              <div>
                <label className="form-label">Nature of Work *</label>
                <input
                  id="form-nature"
                  value={natureOfWork}
                  onChange={(e) => setNatureOfWork(e.target.value)}
                  className="form-control"
                />
                {errors.natureOfWork && (
                  <p className="text-[var(--color-danger-text)] text-xs mt-1">{errors.natureOfWork}</p>
                )}
              </div>
              <div>
                <label className="form-label">GSTIN</label>
                <input
                  id="form-gstin"
                  value={gstin}
                  onChange={(e) => setGstin(e.target.value)}
                  className="form-control font-mono uppercase"
                />
              </div>
              <div>
                <label className="form-label">Address line 1 (ADD1)</label>
                <textarea
                  id="form-add1"
                  rows={2}
                  value={add1}
                  onChange={(e) => setAdd1(e.target.value)}
                  className="form-control resize-none"
                  maxLength={75}
                />
              </div>
              <div>
                <label className="form-label">Address line 2 (ADD2)</label>
                <textarea
                  id="form-add2"
                  rows={2}
                  value={add2}
                  onChange={(e) => setAdd2(e.target.value)}
                  className="form-control resize-none"
                  maxLength={100}
                />
              </div>
              <div className="border-t border-[var(--border-main)] pt-3 space-y-3">
                {[
                  { id: "form-store-vendor", label: "Is Store Vendor", checked: isStoreVendor, set: setIsStoreVendor },
                  { id: "form-inhouse", label: "Is In-House Unit", checked: isInhouse, set: setIsInhouse },
                  { id: "form-issue-dc", label: "Issue Delivery Challan", checked: isIssueDC, set: setIsIssueDC },
                  { id: "form-approved", label: "Approved Subcontractor", checked: isApproved, set: setIsApproved },
                ].map((c) => (
                  <div key={c.id} className="flex items-center gap-3">
                    <input
                      type="checkbox"
                      id={c.id}
                      checked={c.checked}
                      onChange={(e) => c.set(e.target.checked)}
                      className="w-4 h-4 text-[var(--primary)] border-[var(--border-main)] rounded"
                    />
                    <label htmlFor={c.id} className="text-sm font-semibold cursor-pointer">
                      {c.label}
                    </label>
                  </div>
                ))}
              </div>
              <div>
                <label className="form-label">Status</label>
                <select
                  id="form-status"
                  value={status}
                  onChange={(e) => setStatus(e.target.value as "Active" | "Inactive" | "Blocked")}
                  className="form-control"
                >
                  <option value="Active">Active</option>
                  <option value="Inactive">Inactive</option>
                  <option value="Blocked">Blocked</option>
                </select>
              </div>
              <div className="border-t border-[var(--border-main)] pt-4 flex justify-end gap-3">
                <button type="button" onClick={() => setIsOpen(false)} className="px-4 py-2 text-sm font-semibold text-[var(--text-muted)]">
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

      {selectedDetail && (
        <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="w-full max-w-xl bg-[var(--bg-card)] rounded-2xl border border-[var(--border-main)] shadow-2xl overflow-hidden">
            <div className="px-6 py-4 border-b border-[var(--border-main)] flex items-center justify-between bg-[var(--bg-subtle)]">
              <div>
                <span className="font-mono text-xs font-bold text-[var(--primary)] bg-[var(--primary-light)] px-2 py-0.5 rounded">
                  {selectedDetail.subCode}
                </span>
                <h2 className="text-lg font-bold mt-1">{selectedDetail.subName}</h2>
              </div>
              <button type="button" onClick={() => setSelectedDetail(null)} className="p-1.5 rounded-lg hover:bg-[var(--bg-hover)]">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-6 space-y-4 text-sm max-h-[75vh] overflow-y-auto">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <p className="text-xs text-[var(--text-muted)] uppercase font-semibold">Nature of Work</p>
                  <p className="font-medium mt-1">{selectedDetail.natureOfWork || "—"}</p>
                </div>
                <div>
                  <p className="text-xs text-[var(--text-muted)] uppercase font-semibold">GSTIN</p>
                  <p className="font-mono mt-1">{selectedDetail.gstin || "—"}</p>
                </div>
                <div>
                  <p className="text-xs text-[var(--text-muted)] uppercase font-semibold">Address 1</p>
                  <p className="mt-1">{selectedDetail.add1 || "—"}</p>
                </div>
                <div>
                  <p className="text-xs text-[var(--text-muted)] uppercase font-semibold">Address 2</p>
                  <p className="mt-1">{selectedDetail.add2 || "—"}</p>
                </div>
                <div>
                  <p className="text-xs text-[var(--text-muted)] uppercase font-semibold">Status</p>
                  <p className="mt-1 font-semibold">{selectedDetail.status}</p>
                </div>
                <div>
                  <p className="text-xs text-[var(--text-muted)] uppercase font-semibold">Approved</p>
                  <p className="mt-1 font-semibold">{selectedDetail.isApproved ? "Yes" : "No"}</p>
                </div>
              </div>
            </div>
            <div className="px-6 py-4 border-t border-[var(--border-main)] flex justify-end gap-3">
              <button type="button" onClick={() => setSelectedDetail(null)} className="px-4 py-2 text-xs font-semibold text-[var(--text-muted)]">
                Close
              </button>
              <RoleGate permission="canEditMaster">
                <Button
                  size="sm"
                  variant="primary"
                  onClick={() => {
                    const item = selectedDetail;
                    setSelectedDetail(null);
                    handleOpenEdit(item);
                  }}
                >
                  <Edit2 className="w-4 h-4" /> Edit
                </Button>
              </RoleGate>
            </div>
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
