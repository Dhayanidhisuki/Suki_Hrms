"use client";

import { useCallback, useEffect, useState } from "react";
import { Plus, Save, ShieldCheck } from "lucide-react";
import Sidebar from "@/app/dashboard/components/Sidebar";
import TopBar from "@/app/dashboard/components/TopBar";
import RoleGate from "@/app/dashboard/components/RoleGate";
import { Button } from "@/components/ui/button";
import { OverlayModal } from "@/components/ui/OverlayModal";
import { FormModalSection } from "@/components/ui/form";
import { apiGet, apiPost, apiPut } from "@/lib/apiClient";
import { toastError, toastSuccess } from "@/lib/appToast";

interface Agency {
  id: number;
  agencyCode: string;
  agencyName: string;
  address: string | null;
  contactPerson: string | null;
  phone: string | null;
  email: string | null;
  accreditationNo: string | null;
  accreditationExpiry: string | null;
  capabilities: string | null;
  isAuthorized: boolean;
  isActive: boolean;
}

const emptyForm = {
  agencyCode: "",
  agencyName: "",
  address: "",
  contactPerson: "",
  phone: "",
  email: "",
  accreditationNo: "",
  accreditationExpiry: "",
  capabilities: "",
  isAuthorized: true,
  isActive: true,
};

export default function CalibrationAgenciesPage() {
  const [items, setItems] = useState<Agency[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<Agency | null>(null);
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState(emptyForm);

  const load = useCallback(async () => {
    setLoading(true);
    const res = await apiGet<{ items: Agency[] }>("/api/calibration/agencies");
    setItems(res.data?.items ?? []);
    setLoading(false);
  }, []);

  useEffect(() => {
    // Initial server synchronization for this client-side master grid.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void load();
  }, [load]);

  const openAdd = () => {
    setEditing(null);
    setForm(emptyForm);
    setOpen(true);
  };

  const openEdit = (agency: Agency) => {
    setEditing(agency);
    setForm({
      agencyCode: agency.agencyCode,
      agencyName: agency.agencyName,
      address: agency.address ?? "",
      contactPerson: agency.contactPerson ?? "",
      phone: agency.phone ?? "",
      email: agency.email ?? "",
      accreditationNo: agency.accreditationNo ?? "",
      accreditationExpiry: agency.accreditationExpiry?.split("T")[0] ?? "",
      capabilities: agency.capabilities ?? "",
      isAuthorized: agency.isAuthorized,
      isActive: agency.isActive,
    });
    setOpen(true);
  };

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setSaving(true);
    const payload = { ...form, ...(editing ? { id: editing.id } : {}) };
    const res = editing
      ? await apiPut<{ item: Agency }>("/api/calibration/agencies", payload)
      : await apiPost<{ item: Agency }>("/api/calibration/agencies", payload);
    setSaving(false);
    if (res.error) return toastError(res.error.message);
    toastSuccess(editing ? "Calibration agency updated." : "Calibration agency created.");
    setOpen(false);
    await load();
  };

  const field = (key: keyof typeof emptyForm, value: string | boolean) =>
    setForm((previous) => ({ ...previous, [key]: value }));

  return (
    <div className="flex h-screen bg-[var(--bg-app)]">
      <Sidebar />
      <div className="flex min-w-0 flex-1 flex-col overflow-hidden">
        <TopBar />
        <main className="flex-1 overflow-y-auto px-7 py-6">
          <div className="mb-6 flex items-center justify-between gap-3">
            <div>
              <h1 className="text-2xl font-bold">Authorized Calibration Agencies</h1>
              <p className="mt-1 text-sm text-[var(--text-muted)]">Only active, authorized and non-expired agencies can receive calibration work.</p>
            </div>
            <RoleGate permission="canManageCalibration">
              <Button type="button" variant="primary" onClick={openAdd}><Plus className="h-4 w-4" /> Add Agency</Button>
            </RoleGate>
          </div>

          <div className="overflow-hidden rounded-xl border border-[var(--border-main)] bg-[var(--bg-card)]">
            <table className="w-full text-sm">
              <thead className="bg-[var(--bg-subtle)] text-left text-xs uppercase text-[var(--text-muted)]">
                <tr>{["Code", "Agency", "Accreditation", "Expiry", "Capabilities", "Status", "Actions"].map((h) => <th key={h} className="px-4 py-3">{h}</th>)}</tr>
              </thead>
              <tbody className="divide-y divide-[var(--border-main)]">
                {items.map((agency) => {
                  const expired = agency.accreditationExpiry && new Date(agency.accreditationExpiry) < new Date();
                  const selectable = agency.isActive && agency.isAuthorized && !expired;
                  return <tr key={agency.id}>
                    <td className="px-4 py-3 font-mono">{agency.agencyCode}</td>
                    <td className="px-4 py-3 font-semibold">{agency.agencyName}</td>
                    <td className="px-4 py-3">{agency.accreditationNo || "—"}</td>
                    <td className="px-4 py-3">{agency.accreditationExpiry?.split("T")[0] || "No expiry"}</td>
                    <td className="max-w-xs truncate px-4 py-3">{agency.capabilities || "All configured types"}</td>
                    <td className="px-4 py-3"><span className={selectable ? "text-emerald-700" : "text-red-700"}>{selectable ? "Authorized" : expired ? "Expired" : "Blocked"}</span></td>
                    <td className="px-4 py-3"><Button type="button" size="sm" variant="outline" onClick={() => openEdit(agency)}>Edit</Button></td>
                  </tr>;
                })}
                {!loading && items.length === 0 && <tr><td colSpan={7} className="px-4 py-12 text-center text-[var(--text-muted)]">No authorized agencies configured.</td></tr>}
              </tbody>
            </table>
          </div>
        </main>
      </div>

      {open && <OverlayModal open title={editing ? "Edit Calibration Agency" : "Add Calibration Agency"} subtitle="Authorization and accreditation control" onClose={() => setOpen(false)} footer={<><button type="button" className="form-btn-cancel" onClick={() => setOpen(false)}>Cancel</button><button type="submit" form="agency-form" className="form-btn-save" disabled={saving}><Save className="h-4 w-4" /> {saving ? "Saving…" : "Save"}</button></>}>
        <form id="agency-form" onSubmit={submit}>
          <FormModalSection title="Agency details">
            <div className="form-grid">
              <div><label className="form-label">Agency Code *</label><input required maxLength={10} value={form.agencyCode} onChange={(e) => field("agencyCode", e.target.value.toUpperCase())} className="form-control font-mono" /></div>
              <div><label className="form-label">Agency Name *</label><input required maxLength={100} value={form.agencyName} onChange={(e) => field("agencyName", e.target.value)} className="form-control" /></div>
              <div className="md:col-span-2"><label className="form-label">Address</label><textarea maxLength={500} value={form.address} onChange={(e) => field("address", e.target.value)} className="form-control" /></div>
              <div><label className="form-label">Contact Person</label><input value={form.contactPerson} onChange={(e) => field("contactPerson", e.target.value)} className="form-control" /></div>
              <div><label className="form-label">Phone</label><input value={form.phone} onChange={(e) => field("phone", e.target.value)} className="form-control" /></div>
              <div><label className="form-label">Email</label><input type="email" value={form.email} onChange={(e) => field("email", e.target.value)} className="form-control" /></div>
              <div><label className="form-label">Accreditation No.</label><input value={form.accreditationNo} onChange={(e) => field("accreditationNo", e.target.value)} className="form-control" /></div>
              <div><label className="form-label">Accreditation Expiry</label><input type="date" value={form.accreditationExpiry} onChange={(e) => field("accreditationExpiry", e.target.value)} className="form-control" /></div>
              <div className="md:col-span-2"><label className="form-label">Approved Capabilities</label><textarea maxLength={1000} value={form.capabilities} onChange={(e) => field("capabilities", e.target.value)} className="form-control" placeholder="Gauge types / calibration capabilities" /></div>
              <label className="flex items-center gap-2"><input type="checkbox" checked={form.isAuthorized} onChange={(e) => field("isAuthorized", e.target.checked)} /><ShieldCheck className="h-4 w-4" /> Authorized</label>
              <label className="flex items-center gap-2"><input type="checkbox" checked={form.isActive} onChange={(e) => field("isActive", e.target.checked)} /> Active</label>
            </div>
          </FormModalSection>
        </form>
      </OverlayModal>}
    </div>
  );
}
