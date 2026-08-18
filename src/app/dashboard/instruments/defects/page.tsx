"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { Plus, Save, Wrench } from "lucide-react";
import Sidebar from "@/app/dashboard/components/Sidebar";
import TopBar from "@/app/dashboard/components/TopBar";
import { Button } from "@/components/ui/button";
import { OverlayModal } from "@/components/ui/OverlayModal";
import { FormModalSection } from "@/components/ui/form";
import { apiGet, apiPost, apiPut } from "@/lib/apiClient";
import { toastError, toastSuccess } from "@/lib/appToast";

interface Defect {
  id: number; toolOrGaugeNo: string; unitCode: string | null; reportedDate: string;
  defectDetails: string; errorDeviation: string | null; status: string;
  tool: { description: string | null; grouping: string; type: string | null };
  serviceRecords: Array<{ id: number; status: string; serviceAgency: string | null; serviceDcNo: string | null; sentDate: string | null; expectedReturnDate: string | null; receivedDate: string | null; repairDetails: string | null; cost: number | string | null; verificationResult: string | null; finalStatus: string | null }>;
}

const today = () => new Date().toISOString().slice(0, 10);

export default function DefectiveInstrumentsPage() {
  const [items, setItems] = useState<Defect[]>([]);
  const [search, setSearch] = useState("");
  const [open, setOpen] = useState<"defect" | "service" | "verify" | null>(null);
  const [selected, setSelected] = useState<Defect | null>(null);
  const [form, setForm] = useState({ toolOrGaugeNo: "", unitCode: "", reportedDate: today(), defectDetails: "", errorDeviation: "" });
  const [service, setService] = useState({ serviceAgency: "", serviceDcNo: "", sentDate: today(), expectedReturnDate: "", repairDetails: "", status: "Sent for Repair" });
  const [verification, setVerification] = useState({ receivedDate: today(), repairDetails: "", cost: "", verificationResult: "", status: "Under Verification", finalStatus: "Returned to Use" });

  const load = useCallback(async () => {
    const params = new URLSearchParams(); if (search.trim()) params.set("search", search.trim());
    const res = await apiGet<{ items: Defect[] }>(`/api/instruments/defects?${params}`);
    setItems(res.data?.items ?? []);
  }, [search]);
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void load();
  }, [load]);

  const report = async (e: React.FormEvent) => {
    e.preventDefault(); const res = await apiPost("/api/instruments/defects", form);
    if (res.error) return toastError(res.error.message);
    toastSuccess("Instrument defect reported and status changed to Needs Attention."); setOpen(null); await load();
  };
  const sendService = async (e: React.FormEvent) => {
    e.preventDefault(); if (!selected) return;
    const res = await apiPost("/api/instruments/service", { ...service, defectId: selected.id, toolOrGaugeNo: selected.toolOrGaugeNo });
    if (res.error) return toastError(res.error.message);
    toastSuccess("Service record created."); setOpen(null); await load();
  };
  const verifyService = async (e: React.FormEvent) => {
    e.preventDefault(); const current = selected?.serviceRecords[0]; if (!selected || !current) return;
    const res = await apiPut("/api/instruments/service", {
      id: current.id, defectId: selected.id, toolOrGaugeNo: selected.toolOrGaugeNo,
      serviceAgency: current.serviceAgency || undefined, serviceDcNo: current.serviceDcNo || undefined,
      sentDate: current.sentDate?.split("T")[0] || undefined,
      expectedReturnDate: current.expectedReturnDate?.split("T")[0] || undefined,
      receivedDate: verification.receivedDate, repairDetails: verification.repairDetails || current.repairDetails || undefined,
      cost: verification.cost ? Number(verification.cost) : undefined,
      verificationResult: verification.verificationResult, status: verification.status, finalStatus: verification.finalStatus,
    });
    if (res.error) return toastError(res.error.message);
    toastSuccess(verification.finalStatus === "Returned to Use" ? "Service verified and instrument returned to use." : "Service verification updated.");
    setOpen(null); await load();
  };

  return <div className="flex h-screen bg-[var(--bg-app)]"><Sidebar /><div className="flex min-w-0 flex-1 flex-col overflow-hidden"><TopBar /><main className="flex-1 overflow-y-auto px-7 py-6">
    <div className="mb-5 flex items-center justify-between"><div><h1 className="text-2xl font-bold">Defective Instruments</h1><p className="text-sm text-[var(--text-muted)]">Defects, errors and repair/service status for instruments and gauges.</p></div><Button variant="primary" onClick={() => { setForm({ toolOrGaugeNo: "", unitCode: "", reportedDate: today(), defectDetails: "", errorDeviation: "" }); setOpen("defect"); }}><Plus className="h-4 w-4" /> Report Defect</Button></div>
    <div className="mb-3"><input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search identification no., unit or defect…" className="form-control max-w-md" /></div>
    <div className="overflow-hidden rounded-xl border border-[var(--border-main)] bg-[var(--bg-card)]"><table className="w-full text-sm"><thead className="bg-[var(--bg-subtle)] text-left text-xs uppercase text-[var(--text-muted)]"><tr>{["Identification No.", "Description", "Unit", "Reported", "Defect / Deviation", "Status", "Actions"].map((h) => <th className="px-4 py-3" key={h}>{h}</th>)}</tr></thead><tbody className="divide-y divide-[var(--border-main)]">{items.map((item) => <tr key={item.id}><td className="px-4 py-3 font-mono font-semibold"><Link className="text-[var(--primary)] hover:underline" href={`/dashboard/instruments/${encodeURIComponent(item.toolOrGaugeNo)}/history`}>{item.toolOrGaugeNo}</Link></td><td className="px-4 py-3">{item.tool.description || item.tool.type || "—"}</td><td className="px-4 py-3">{item.unitCode || "—"}</td><td className="px-4 py-3">{item.reportedDate.split("T")[0]}</td><td className="max-w-sm px-4 py-3"><p>{item.defectDetails}</p>{item.errorDeviation && <p className="text-xs text-red-700">{item.errorDeviation}</p>}</td><td className="px-4 py-3"><span className="text-amber-700">{item.serviceRecords[0]?.finalStatus || item.serviceRecords[0]?.status || item.status}</span></td><td className="px-4 py-3"><div className="flex gap-2">{item.serviceRecords[0] && !["Returned to Use", "Rejected", "Scrapped"].includes(item.serviceRecords[0].finalStatus || "") ? <Button size="sm" variant="outline" onClick={() => { setSelected(item); setVerification({ receivedDate: today(), repairDetails: item.serviceRecords[0].repairDetails || "", cost: item.serviceRecords[0].cost != null ? String(item.serviceRecords[0].cost) : "", verificationResult: "", status: "Under Verification", finalStatus: "Returned to Use" }); setOpen("verify"); }}><Wrench className="h-3.5 w-3.5" /> Receive / Verify</Button> : <Button size="sm" variant="outline" onClick={() => { setSelected(item); setOpen("service"); }}><Wrench className="h-3.5 w-3.5" /> Send for Service</Button>}</div></td></tr>)}{items.length === 0 && <tr><td colSpan={7} className="px-4 py-12 text-center text-[var(--text-muted)]">No defective instruments found.</td></tr>}</tbody></table></div>
  </main></div>
  {open === "defect" && <OverlayModal open title="Report Instrument Defect" subtitle="The instrument will be marked Needs Attention" onClose={() => setOpen(null)} footer={<><button className="form-btn-cancel" onClick={() => setOpen(null)} type="button">Cancel</button><button className="form-btn-save" form="defect-form" type="submit"><Save className="h-4 w-4" /> Save</button></>}><form id="defect-form" onSubmit={report}><FormModalSection title="Defect details"><div className="form-grid"><div><label className="form-label">Identification No. *</label><input required value={form.toolOrGaugeNo} onChange={(e) => setForm({ ...form, toolOrGaugeNo: e.target.value })} className="form-control font-mono" /></div><div><label className="form-label">Unit</label><input value={form.unitCode} onChange={(e) => setForm({ ...form, unitCode: e.target.value })} className="form-control" /></div><div><label className="form-label">Reported Date *</label><input required type="date" value={form.reportedDate} onChange={(e) => setForm({ ...form, reportedDate: e.target.value })} className="form-control" /></div><div className="md:col-span-2"><label className="form-label">Defect Details *</label><textarea required value={form.defectDetails} onChange={(e) => setForm({ ...form, defectDetails: e.target.value })} className="form-control" /></div><div className="md:col-span-2"><label className="form-label">Error / Deviation</label><textarea value={form.errorDeviation} onChange={(e) => setForm({ ...form, errorDeviation: e.target.value })} className="form-control" /></div></div></FormModalSection></form></OverlayModal>}
  {open === "service" && selected && <OverlayModal open title="Send for Repair / Service" subtitle={selected.toolOrGaugeNo} onClose={() => setOpen(null)} footer={<><button className="form-btn-cancel" onClick={() => setOpen(null)} type="button">Cancel</button><button className="form-btn-save" form="service-form" type="submit"><Save className="h-4 w-4" /> Create Service Record</button></>}><form id="service-form" onSubmit={sendService}><FormModalSection title="Service details"><div className="form-grid"><div><label className="form-label">Service Agency</label><input value={service.serviceAgency} onChange={(e) => setService({ ...service, serviceAgency: e.target.value })} className="form-control" /></div><div><label className="form-label">Service DC No.</label><input value={service.serviceDcNo} onChange={(e) => setService({ ...service, serviceDcNo: e.target.value })} className="form-control" /></div><div><label className="form-label">Sent Date</label><input type="date" value={service.sentDate} onChange={(e) => setService({ ...service, sentDate: e.target.value })} className="form-control" /></div><div><label className="form-label">Expected Return</label><input type="date" value={service.expectedReturnDate} onChange={(e) => setService({ ...service, expectedReturnDate: e.target.value })} className="form-control" /></div><div className="md:col-span-2"><label className="form-label">Repair Details</label><textarea value={service.repairDetails} onChange={(e) => setService({ ...service, repairDetails: e.target.value })} className="form-control" /></div></div></FormModalSection></form></OverlayModal>}
  {open === "verify" && selected && <OverlayModal open title="Receive and Verify Service" subtitle={selected.toolOrGaugeNo} onClose={() => setOpen(null)} footer={<><button className="form-btn-cancel" onClick={() => setOpen(null)} type="button">Cancel</button><button className="form-btn-save" form="verify-service-form" type="submit"><Save className="h-4 w-4" /> Complete Verification</button></>}><form id="verify-service-form" onSubmit={verifyService}><FormModalSection title="Receipt and verification"><div className="form-grid"><div><label className="form-label">Received Date *</label><input required type="date" value={verification.receivedDate} onChange={(e) => setVerification({ ...verification, receivedDate: e.target.value })} className="form-control" /></div><div><label className="form-label">Repair Cost</label><input min={0} step="0.01" type="number" value={verification.cost} onChange={(e) => setVerification({ ...verification, cost: e.target.value })} className="form-control" /></div><div className="md:col-span-2"><label className="form-label">Repair Details</label><textarea value={verification.repairDetails} onChange={(e) => setVerification({ ...verification, repairDetails: e.target.value })} className="form-control" /></div><div className="md:col-span-2"><label className="form-label">Verification Result *</label><textarea required value={verification.verificationResult} onChange={(e) => setVerification({ ...verification, verificationResult: e.target.value })} className="form-control" /></div><div><label className="form-label">Final Status *</label><select value={verification.finalStatus} onChange={(e) => setVerification({ ...verification, finalStatus: e.target.value })} className="form-control"><option>Returned to Use</option><option>Rejected</option><option>Scrapped</option><option>Under Verification</option></select></div></div></FormModalSection></form></OverlayModal>}
  </div>;
}
