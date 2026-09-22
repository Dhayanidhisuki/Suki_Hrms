'use client';

/**
 * External Training (BRD §35) — provider-managed trainings with commercial
 * tracking: PO → invoice → payment → certificate.
 */

import { useState, useEffect } from 'react';
import { DataTable, FormModal, ConfirmDialog, KPICard, KPIGrid } from '@/components/ui';
import type { Column, FieldDef } from '@/components/ui';
import { exportCsv } from '@/lib/exportCsv';
import { exportXlsx } from '@/lib/exportXlsx';
import { printTable } from '@/lib/printTable';

interface ExtTraining {
  id: number;
  title: string;
  providerName: string;
  providerId: number | null;
  providerContact: string | null;
  trainerName: string | null;
  startDate: string | null;
  endDate: string | null;
  poNumber: string | null;
  poAmount: number | null;
  invoiceNumber: string | null;
  invoiceAmount: number | null;
  paymentStatus: string;
  paidAmount: number | null;
  certificateIssued: boolean;
  status: string;
  participants?: Participant[];
}

interface Participant {
  id: number;
  employeeId: number;
  status: string;
  certificateId: number | null;
  feedbackRating: number | null;
  feedbackComments: string | null;
  effectivenessRating: string | null;
}

interface Provider { id: number; name: string }
interface Employee { id: number; firstName: string; lastName: string | null; employeeCode: string }
interface Certificate { id: number; certificateNumber: string | null; employeeId: number }

const baseFields: FieldDef[] = [
  { name: 'title', label: 'Title', type: 'text', required: true },
  { name: 'providerName', label: 'Provider (free text or pick master below)', type: 'text' },
  { name: 'providerContact', label: 'Provider Contact', type: 'text' },
  { name: 'trainerName', label: 'External Trainer Name', type: 'text' },
  { name: 'startDate', label: 'Start Date', type: 'date' },
  { name: 'endDate', label: 'End Date', type: 'date' },
  { name: 'poNumber', label: 'PO Number', type: 'text' },
  { name: 'poAmount', label: 'PO Amount', type: 'number' },
  { name: 'invoiceNumber', label: 'Invoice Number', type: 'text' },
  { name: 'invoiceAmount', label: 'Invoice Amount', type: 'number' },
  { name: 'paidAmount', label: 'Paid Amount', type: 'number' },
  { name: 'paymentStatus', label: 'Payment', type: 'select', options: ['UNPAID', 'PARTIAL', 'PAID'].map((v) => ({ value: v, label: v })), defaultValue: 'UNPAID' },
  { name: 'status', label: 'Status', type: 'select', options: ['PLANNED', 'APPROVED', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED'].map((v) => ({ value: v, label: v })), defaultValue: 'PLANNED' },
];

const STATUS_TONE: Record<string, { bg: string; fg: string }> = {
  PLANNED: { bg: '#dbeafe', fg: '#1e40af' },
  SUBMITTED: { bg: '#fef9c3', fg: '#854d0e' },
  UNDER_REVIEW: { bg: '#fef9c3', fg: '#854d0e' },
  RETURNED: { bg: '#ffedd5', fg: '#9a3412' },
  APPROVED: { bg: '#dcfce7', fg: '#166534' },
  IN_PROGRESS: { bg: '#fef9c3', fg: '#854d0e' },
  COMPLETED: { bg: '#dcfce7', fg: '#166534' },
  CANCELLED: { bg: '#f1f5f9', fg: '#475569' },
  REJECTED: { bg: '#fee2e2', fg: '#991b1b' },
  PAID: { bg: '#dcfce7', fg: '#166534' },
  PARTIAL: { bg: '#fef9c3', fg: '#854d0e' },
  UNPAID: { bg: '#fee2e2', fg: '#991b1b' },
};

// §21 workflow actions offered per status.
const ACTIONS: Record<string, { action: string; label: string; color: string }[]> = {
  PLANNED: [{ action: 'SUBMIT', label: 'Submit', color: 'var(--accent)' }],
  RETURNED: [{ action: 'RESUBMIT', label: 'Resubmit', color: 'var(--accent)' }],
  SUBMITTED: [
    { action: 'APPROVE', label: 'Approve', color: '#16a34a' },
    { action: 'RETURN', label: 'Return', color: '#d97706' },
    { action: 'REJECT', label: 'Reject', color: '#dc2626' },
  ],
  UNDER_REVIEW: [
    { action: 'APPROVE', label: 'Approve', color: '#16a34a' },
    { action: 'RETURN', label: 'Return', color: '#d97706' },
    { action: 'REJECT', label: 'Reject', color: '#dc2626' },
  ],
  APPROVED: [
    { action: 'START', label: 'Start', color: 'var(--accent)' },
    { action: 'COMPLETE', label: 'Complete', color: '#16a34a' },
    { action: 'CANCEL', label: 'Cancel', color: '#dc2626' },
  ],
  IN_PROGRESS: [{ action: 'COMPLETE', label: 'Complete', color: '#16a34a' }],
};

export default function ExternalTrainingsPage() {
  const [rows, setRows] = useState<ExtTraining[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<ExtTraining | null>(null);
  const [deleteId, setDeleteId] = useState<number | null>(null);
  const [refresh, setRefresh] = useState(0);
  const [providers, setProviders] = useState<Provider[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [certificates, setCertificates] = useState<Certificate[]>([]);
  const [partForId, setPartForId] = useState<number | null>(null);
  const [partEmployeeId, setPartEmployeeId] = useState('');

  const empLabel = (e: Employee) => `${e.firstName} ${e.lastName ?? ''} (${e.employeeCode})`.trim();
  const empName = (id: number) => { const e = employees.find((x) => x.id === id); return e ? empLabel(e) : `#${id}`; };

  useEffect(() => {
    let mounted = true;
    Promise.all([
      fetch('/api/external-trainings').then((r) => r.json()),
      fetch('/api/training-providers').then((r) => r.json()).catch(() => ({ data: [] })),
      fetch('/api/employees?limit=500').then((r) => r.json()).catch(() => ({ data: [] })),
      fetch('/api/training-certificates').then((r) => r.json()).catch(() => ({ data: [] })),
    ]).then(([ext, prov, emp, cert]) => {
      if (!mounted) return;
      setRows(ext.data ?? []);
      setProviders(Array.isArray(prov) ? prov : prov.data ?? []);
      setEmployees(Array.isArray(emp) ? emp : emp.data ?? []);
      setCertificates(Array.isArray(cert) ? cert : cert.data ?? []);
    }).catch((e) => { if (mounted) setError(e.message); })
      .finally(() => { if (mounted) setLoading(false); });
    return () => { mounted = false; };
  }, [refresh]);

  // §35: providerId select comes from the TrainingProvider master; the API
  // resolves providerName/providerContact from it when free text is blank.
  const fields: FieldDef[] = [
    baseFields[0], // title
    { name: 'providerId', label: 'Provider Master', type: 'select', options: providers.map((p) => ({ label: p.name, value: p.id })) },
    ...baseFields.slice(1),
  ];

  const handleSubmit = async (values: Record<string, string | number | boolean>) => {
    const res = await fetch(editing ? `/api/external-trainings/${editing.id}` : '/api/external-trainings', {
      method: editing ? 'PUT' : 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(values),
    });
    if (!res.ok) throw new Error((await res.json()).error ?? 'Save failed');
    setEditing(null);
    setRefresh((n) => n + 1);
  };

  const badge = (v: string) => {
    const t = STATUS_TONE[v] ?? STATUS_TONE.PLANNED;
    return <span className="rounded-full px-2 py-0.5 text-xs font-medium" style={{ backgroundColor: t.bg, color: t.fg }}>{v.replace('_', ' ')}</span>;
  };

  const handleAction = async (id: number, action: string) => {
    const reason = ['REJECT', 'RETURN', 'CANCEL'].includes(action) ? window.prompt(`${action} reason (optional)`) ?? null : null;
    const res = await fetch(`/api/external-trainings/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action, reason }),
    });
    if (!res.ok) {
      setError((await res.json()).error ?? `${action} failed`);
      return;
    }
    setRefresh((n) => n + 1);
  };

  const columns: Column<ExtTraining>[] = [
    { key: 'title', label: 'Training', sortable: true },
    { key: 'providerName', label: 'Provider' },
    { key: 'trainerName', label: 'Trainer', render: (r) => r.trainerName ?? '—' },
    { key: 'startDate', label: 'Dates', render: (r) => (r.startDate ? `${r.startDate.slice(0, 10)} → ${r.endDate?.slice(0, 10) ?? '—'}` : '—') },
    { key: 'poNumber', label: 'PO', render: (r) => (r.poNumber ? `${r.poNumber} (${r.poAmount ?? '—'})` : '—') },
    { key: 'invoiceNumber', label: 'Invoice', render: (r) => (r.invoiceNumber ? `${r.invoiceNumber} (${r.invoiceAmount ?? '—'})` : '—') },
    { key: 'paymentStatus', label: 'Payment', render: (r) => badge(r.paymentStatus) },
    { key: 'status', label: 'Status', render: (r) => badge(r.status) },
    { key: 'participants', label: 'Participants', render: (r) => (
      <button onClick={() => setPartForId(r.id)} className="rounded px-2 py-0.5 text-xs font-medium" style={{ border: '1px solid var(--border)', color: 'var(--foreground)' }}>
        {r.participants?.length ?? 0} people
      </button>
    ) },
    { key: 'id', label: 'Workflow', render: (r) => (
      <div className="flex flex-wrap gap-1">
        {(ACTIONS[r.status] ?? []).map((a) => (
          <button key={a.action} onClick={() => void handleAction(r.id, a.action)} className="rounded px-2 py-0.5 text-xs font-medium text-white" style={{ backgroundColor: a.color }}>
            {a.label}
          </button>
        ))}
      </div>
    ) },
  ];

  const partFor = rows.find((r) => r.id === partForId) ?? null;

  const addParticipant = async () => {
    if (!partForId || !partEmployeeId) return;
    const res = await fetch(`/api/external-trainings/${partForId}/participants`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ employeeId: Number(partEmployeeId) }),
    });
    if (!res.ok) { setError((await res.json()).error ?? 'Add failed'); return; }
    setPartEmployeeId('');
    setRefresh((n) => n + 1);
  };

  const updateParticipant = async (participantId: number, patch: Record<string, unknown>) => {
    if (!partForId) return;
    const res = await fetch(`/api/external-trainings/${partForId}/participants`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ participantId, ...patch }),
    });
    if (!res.ok) { setError((await res.json()).error ?? 'Update failed'); return; }
    setRefresh((n) => n + 1);
  };

  const removeParticipant = async (participantId: number) => {
    if (!partForId) return;
    const res = await fetch(`/api/external-trainings/${partForId}/participants?participantId=${participantId}`, { method: 'DELETE' });
    if (!res.ok) { setError((await res.json()).error ?? 'Remove failed'); return; }
    setRefresh((n) => n + 1);
  };

  const totalCost = rows.reduce((s, r) => s + Number(r.invoiceAmount ?? r.poAmount ?? 0), 0);
  const totalPaid = rows.reduce((s, r) => s + Number(r.paidAmount ?? 0), 0);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold" style={{ color: 'var(--foreground)' }}>External Trainings</h1>
        <div className="flex gap-2">
          <button
            onClick={() => exportCsv('external-trainings.csv', rows.map((r) => ({ Title: r.title, Provider: r.providerName, Trainer: r.trainerName ?? '', PO: r.poNumber ?? '', Invoice: r.invoiceNumber ?? '', Amount: r.invoiceAmount ?? r.poAmount ?? '', Paid: r.paidAmount ?? '', Payment: r.paymentStatus, Status: r.status })))}
            className="rounded-lg px-4 py-2 text-sm font-medium" style={{ border: '1px solid var(--border)', color: 'var(--foreground)' }}
          >
            Export CSV
          </button>
          <button
            onClick={() => exportXlsx('external-trainings.xlsx', rows.map((r) => ({ Title: r.title, Provider: r.providerName, Trainer: r.trainerName ?? '', PO: r.poNumber ?? '', Invoice: r.invoiceNumber ?? '', Amount: r.invoiceAmount ?? r.poAmount ?? '', Paid: r.paidAmount ?? '', Payment: r.paymentStatus, Status: r.status })), 'External Trainings')}
            className="rounded-lg px-4 py-2 text-sm font-medium" style={{ border: '1px solid var(--border)', color: 'var(--foreground)' }}
          >
            Export Excel
          </button>
          <button
            onClick={() => printTable('External Trainings', [
              { label: 'Title', value: (r: ExtTraining) => r.title },
              { label: 'Provider', value: (r) => r.providerName },
              { label: 'Dates', value: (r) => (r.startDate ? `${r.startDate.slice(0, 10)} → ${r.endDate?.slice(0, 10) ?? ''}` : '') },
              { label: 'PO', value: (r) => r.poNumber },
              { label: 'Invoice', value: (r) => r.invoiceNumber },
              { label: 'Amount', value: (r) => r.invoiceAmount ?? r.poAmount },
              { label: 'Paid', value: (r) => r.paidAmount },
              { label: 'Payment', value: (r) => r.paymentStatus },
              { label: 'Status', value: (r) => r.status },
            ], rows)}
            className="rounded-lg px-4 py-2 text-sm font-medium" style={{ border: '1px solid var(--border)', color: 'var(--foreground)' }}
            title="Print or save as PDF via the browser print dialog"
          >
            Print / PDF
          </button>
          <button onClick={() => { setEditing(null); setModalOpen(true); }} className="rounded-lg px-4 py-2 text-sm font-medium text-white" style={{ backgroundColor: 'var(--accent)' }}>
            + External Training
          </button>
        </div>
      </div>

      <KPIGrid columns={4}>
        <KPICard label="Trainings" value={rows.length} tone="info" />
        <KPICard label="Total Cost" value={totalCost} tone="info" />
        <KPICard label="Paid" value={totalPaid} tone="success" />
        <KPICard label="Unpaid" value={rows.filter((r) => r.paymentStatus !== 'PAID').length} tone="warning" />
      </KPIGrid>

      {error && <div className="rounded-lg px-3 py-2 text-sm" style={{ backgroundColor: '#fef2f2', color: '#dc2626', border: '1px solid #fecaca' }}>{error}</div>}

      <DataTable
        columns={columns}
        data={rows}
        loading={loading}
        onEdit={(r) => { setEditing(r); setModalOpen(true); }}
        onDelete={(r) => setDeleteId(r.id)}
        emptyMessage="No external trainings yet."
      />

      <FormModal
        title={editing ? 'Edit External Training' : 'New External Training'}
        fields={fields}
        initialValues={editing ? {
          ...editing,
          participants: undefined,
          startDate: editing.startDate?.slice(0, 10), endDate: editing.endDate?.slice(0, 10),
        } as unknown as Record<string, string | number | boolean> : {}}
        isOpen={modalOpen}
        onClose={() => { setModalOpen(false); setEditing(null); }}
        onSubmit={handleSubmit}
        submitLabel={editing ? 'Update' : 'Create'}
      />

      <ConfirmDialog
        title="Delete External Training"
        message="Delete this external training record?"
        isOpen={deleteId !== null}
        onConfirm={async () => {
          if (deleteId) {
            const res = await fetch(`/api/external-trainings/${deleteId}`, { method: 'DELETE' });
            if (!res.ok) setError((await res.json()).error ?? 'Delete failed');
          }
          setDeleteId(null);
          setRefresh((n) => n + 1);
        }}
        onClose={() => setDeleteId(null)}
      />

      {/* §35 Participants modal — real records with status/certificate/feedback/effectiveness. */}
      {partFor && (
        <div className="fixed inset-0 z-50 flex items-center justify-center" style={{ backgroundColor: 'rgba(0,0,0,0.4)' }}>
          <div className="max-h-[85vh] w-full max-w-3xl overflow-y-auto rounded-xl p-6 shadow-xl" style={{ backgroundColor: 'var(--card)' }}>
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-lg font-semibold" style={{ color: 'var(--foreground)' }}>Participants — {partFor.title}</h2>
              <button onClick={() => setPartForId(null)} className="text-sm" style={{ color: 'var(--foreground)' }}>✕</button>
            </div>

            <div className="mb-4 flex items-end gap-2">
              <div className="flex-1">
                <label className="mb-1 block text-xs" style={{ color: 'var(--foreground)' }}>Add employee</label>
                <select value={partEmployeeId} onChange={(e) => setPartEmployeeId(e.target.value)} className="w-full rounded-lg px-3 py-2 text-sm" style={{ border: '1px solid var(--border)', backgroundColor: 'var(--background)', color: 'var(--foreground)' }}>
                  <option value="">Select employee…</option>
                  {employees.filter((e) => !(partFor.participants ?? []).some((p) => p.employeeId === e.id)).map((e) => (
                    <option key={e.id} value={e.id}>{empLabel(e)}</option>
                  ))}
                </select>
              </div>
              <button onClick={() => void addParticipant()} disabled={!partEmployeeId} className="rounded-lg px-4 py-2 text-sm font-medium text-white" style={{ backgroundColor: 'var(--accent)' }}>Add</button>
            </div>

            <table className="w-full text-sm" style={{ color: 'var(--foreground)' }}>
              <thead>
                <tr className="text-left text-xs" style={{ color: 'var(--foreground)', opacity: 0.7 }}>
                  <th className="pb-2">Employee</th><th className="pb-2">Status</th><th className="pb-2">Certificate</th>
                  <th className="pb-2">Feedback (1-5)</th><th className="pb-2">Effectiveness</th><th className="pb-2"></th>
                </tr>
              </thead>
              <tbody>
                {(partFor.participants ?? []).map((p) => (
                  <tr key={p.id} style={{ borderTop: '1px solid var(--border)' }}>
                    <td className="py-2">{empName(p.employeeId)}</td>
                    <td className="py-2">
                      <select value={p.status} onChange={(e) => void updateParticipant(p.id, { status: e.target.value })} className="rounded px-1 py-0.5 text-xs" style={{ border: '1px solid var(--border)', backgroundColor: 'var(--background)', color: 'var(--foreground)' }}>
                        {['NOMINATED', 'COMPLETED', 'CANCELLED'].map((s) => <option key={s} value={s}>{s}</option>)}
                      </select>
                    </td>
                    <td className="py-2">
                      <select value={p.certificateId ?? ''} onChange={(e) => void updateParticipant(p.id, { certificateId: e.target.value ? Number(e.target.value) : null })} className="max-w-[140px] rounded px-1 py-0.5 text-xs" style={{ border: '1px solid var(--border)', backgroundColor: 'var(--background)', color: 'var(--foreground)' }}>
                        <option value="">—</option>
                        {certificates.filter((c) => c.employeeId === p.employeeId).map((c) => <option key={c.id} value={c.id}>{c.certificateNumber ?? `#${c.id}`}</option>)}
                      </select>
                    </td>
                    <td className="py-2">
                      <select value={p.feedbackRating ?? ''} onChange={(e) => void updateParticipant(p.id, { feedbackRating: e.target.value ? Number(e.target.value) : null })} className="rounded px-1 py-0.5 text-xs" style={{ border: '1px solid var(--border)', backgroundColor: 'var(--background)', color: 'var(--foreground)' }}>
                        <option value="">—</option>
                        {[1, 2, 3, 4, 5].map((n) => <option key={n} value={n}>{n}</option>)}
                      </select>
                    </td>
                    <td className="py-2">
                      <select value={p.effectivenessRating ?? ''} onChange={(e) => void updateParticipant(p.id, { effectivenessRating: e.target.value || null })} className="rounded px-1 py-0.5 text-xs" style={{ border: '1px solid var(--border)', backgroundColor: 'var(--background)', color: 'var(--foreground)' }}>
                        <option value="">—</option>
                        {['EXCELLENT', 'GOOD', 'AVERAGE', 'POOR'].map((s) => <option key={s} value={s}>{s}</option>)}
                      </select>
                    </td>
                    <td className="py-2 text-right">
                      <button onClick={() => void removeParticipant(p.id)} className="text-xs" style={{ color: '#dc2626' }}>Remove</button>
                    </td>
                  </tr>
                ))}
                {(partFor.participants ?? []).length === 0 && (
                  <tr><td colSpan={6} className="py-4 text-center text-xs" style={{ opacity: 0.6 }}>No participants yet.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
