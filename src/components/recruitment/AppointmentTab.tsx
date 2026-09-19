/**
 * Appointment Order tab — generate and track appointment orders (BRD §6.1).
 */

'use client';

import { useCallback, useEffect, useState } from 'react';
import { DataTable, SearchableSelect, useToast, type Column } from '@/components/ui';

interface CandidateOption { id: number; applicationNo: string; firstName: string; lastName: string; }
interface OfferOption { id: number; offerNo: string; candidate: { firstName: string; lastName: string } }

interface ApptRow {
  id: number;
  apptNo: string;
  status: string;
  candidate: { id: number; firstName: string; lastName: string; };
  offerLetter: { id: number; offerNo: string } | null;
  sentAt: string | null;
  acceptedAt: string | null;
  declinedAt: string | null;
  createdAt: string;
}

export default function AppointmentTab() {
  const toast = useToast();
  const [records, setRecords] = useState<ApptRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [candidates, setCandidates] = useState<CandidateOption[]>([]);
  const [offers, setOffers] = useState<OfferOption[]>([]);
  const [formOpen, setFormOpen] = useState(false);
  const [form, setForm] = useState({ candidateId: '', offerLetterId: '' });
  const [submitting, setSubmitting] = useState(false);

  const fetchRecords = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/recruitment/appointment-orders?limit=50');
      const json = await res.json();
      setRecords(json.data ?? []);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed to fetch');
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    fetchRecords();
    fetch('/api/recruitment/candidates?limit=50').then((r) => r.json()).then((j) => setCandidates(j.data ?? []));
    fetch('/api/recruitment/offer-letters?limit=50').then((r) => r.json()).then((j) => setOffers(j.data ?? []));
  }, [fetchRecords]);

  const candidateOptions = candidates.map((c) => ({ label: `${c.applicationNo} — ${c.firstName} ${c.lastName}`, value: c.id }));
  const offerOptions = offers.filter((o) => o.candidate).map((o) => ({ label: `${o.offerNo} — ${o.candidate.firstName} ${o.candidate.lastName}`, value: o.id }));

  const submit = async () => {
    if (!form.candidateId) { toast.error('Candidate is required'); return; }
    setSubmitting(true);
    try {
      const payload: Record<string, unknown> = { candidateId: Number(form.candidateId) };
      if (form.offerLetterId) payload.offerLetterId = Number(form.offerLetterId);
      const res = await fetch('/api/recruitment/appointment-orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? 'Failed to generate');
      setFormOpen(false);
      setForm({ candidateId: '', offerLetterId: '' });
      fetchRecords();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed to generate');
    } finally {
      setSubmitting(false);
    }
  };

  const updateStatus = async (id: number, status: string) => {
    try {
      const res = await fetch(`/api/recruitment/appointment-orders/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status }),
      });
      if (!res.ok) throw new Error('Failed to update');
      fetchRecords();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed to update');
    }
  };

  const columns: Column<ApptRow>[] = [
    { key: 'apptNo', label: 'Appt No', className: 'font-medium' },
    { key: 'candidate', label: 'Candidate', render: (row) => `${row.candidate?.firstName} ${row.candidate?.lastName}` },
    { key: 'offerLetter', label: 'Offer', render: (row) => row.offerLetter?.offerNo ?? '—' },
    {
      key: 'status', label: 'Status',
      render: (row) => {
        const colors: Record<string, string> = { Draft: '#f3f4f6', Generated: '#dbeafe', Sent: '#fef3c7', Accepted: '#dcfce7', Declined: '#fee2e2', Expired: '#fee2e2' };
        const textColors: Record<string, string> = { Draft: '#6b7280', Generated: '#1e40af', Sent: '#92400e', Accepted: '#166534', Declined: '#991b1b', Expired: '#991b1b' };
        return <span className="px-2 py-0.5 text-xs font-medium rounded-full" style={{ backgroundColor: colors[row.status] ?? '#f3f4f6', color: textColors[row.status] ?? '#6b7280' }}>{row.status}</span>;
      },
    },
    { key: 'createdAt', label: 'Created', render: (row) => new Date(row.createdAt).toLocaleDateString() },
  ];

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-base font-semibold" style={{ color: 'var(--foreground)' }}>Appointment Orders</h2>
        <button onClick={() => setFormOpen(true)} className="rounded-lg px-4 py-2 text-sm font-medium text-white" style={{ backgroundColor: 'var(--accent)' }}>+ Generate Appointment</button>
      </div>

      <DataTable
        columns={columns}
        data={records}
        loading={loading}
        renderRowActions={(row) => (
          <div className="flex gap-1">
            {row.status === 'Draft' && (
              <button onClick={() => updateStatus(row.id, 'Sent')} className="text-xs font-medium px-2 py-1 rounded" style={{ backgroundColor: '#fef3c7', color: '#92400e' }}>Send</button>
            )}
            {row.status === 'Sent' && (
              <>
                <button onClick={() => updateStatus(row.id, 'Accepted')} className="text-xs font-medium px-2 py-1 rounded" style={{ backgroundColor: '#dcfce7', color: '#166534' }}>Accept</button>
                <button onClick={() => updateStatus(row.id, 'Declined')} className="text-xs font-medium px-2 py-1 rounded" style={{ backgroundColor: '#fee2e2', color: '#991b1b' }}>Decline</button>
              </>
            )}
          </div>
        )}
      />

      {formOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ backgroundColor: 'rgba(0,0,0,0.4)' }} onClick={() => setFormOpen(false)}>
          <div className="w-full max-w-md rounded-xl shadow-2xl" style={{ backgroundColor: 'var(--surface)', border: '1px solid var(--border)' }} onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between px-5 py-4 border-b" style={{ borderColor: 'var(--border)' }}>
              <h2 className="text-base font-semibold" style={{ color: 'var(--foreground)' }}>Generate Appointment Order</h2>
              <button onClick={() => setFormOpen(false)} className="text-lg" style={{ color: 'var(--foreground-muted)' }}>×</button>
            </div>
            <div className="space-y-4 p-5">
              <div>
                <label className="block text-sm font-medium mb-1" style={{ color: 'var(--foreground)' }}>Candidate *</label>
                <SearchableSelect value={form.candidateId} options={candidateOptions} onChange={(v) => setForm({ ...form, candidateId: String(v) })} placeholder="Search candidate..." />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1" style={{ color: 'var(--foreground)' }}>Linked Offer Letter</label>
                <SearchableSelect value={form.offerLetterId} options={offerOptions} onChange={(v) => setForm({ ...form, offerLetterId: String(v) })} placeholder="Select offer (optional)" />
              </div>
            </div>
            <div className="flex justify-end gap-2 px-5 py-4 border-t" style={{ borderColor: 'var(--border)' }}>
              <button onClick={() => setFormOpen(false)} className="rounded-lg border px-4 py-2 text-sm" style={{ borderColor: 'var(--border)', color: 'var(--foreground)' }}>Cancel</button>
              <button onClick={submit} disabled={submitting} className="rounded-lg px-4 py-2 text-sm font-medium text-white" style={{ backgroundColor: 'var(--accent)', opacity: submitting ? 0.6 : 1 }}>
                {submitting ? 'Generating...' : 'Generate'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
