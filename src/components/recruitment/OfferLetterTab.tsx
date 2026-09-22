/**
 * Offer Letter tab — generate from template, track status (BRD §5.15).
 */

'use client';

import { useCallback, useEffect, useState } from 'react';
import { DataTable, SearchableSelect, useToast, type Column } from '@/components/ui';

interface CandidateOption { id: number; applicationNo: string; firstName: string; lastName: string; }
interface TemplateOption { id: number; templateName: string; }

interface OfferRow {
  id: number;
  offerNo: string;
  status: string;
  proposedSalary: number;
  joiningDate: string | null;
  employmentType: string | null;
  candidate: { id: number; firstName: string; lastName: string; };
  offerTemplate: { id: number; templateName: string } | null;
  sentAt: string | null;
  acceptedAt: string | null;
  createdAt: string;
}

const inputClass = 'w-full rounded-lg border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--accent)]';
const inputStyle = { backgroundColor: 'var(--surface)', color: 'var(--foreground)', borderColor: 'var(--border)' } as const;
const labelClass = 'block text-sm font-medium mb-1';

export default function OfferLetterTab() {
  const toast = useToast();
  const [offers, setOffers] = useState<OfferRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [candidates, setCandidates] = useState<CandidateOption[]>([]);
  const [templates, setTemplates] = useState<TemplateOption[]>([]);
  const [formOpen, setFormOpen] = useState(false);
  const [form, setForm] = useState({
    candidateId: '', offerTemplateId: '', proposedSalary: '', joiningDate: '',
    employmentType: 'Full-time', probationMonths: '6', remarks: '',
  });
  const [submitting, setSubmitting] = useState(false);

  const fetchOffers = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/recruitment/offer-letters?limit=50');
      const json = await res.json();
      setOffers(json.data ?? []);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed to fetch');
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    fetchOffers();
    Promise.all([
      fetch('/api/recruitment/candidates?limit=50').then((r) => r.json()),
      fetch('/api/masters/offer-templates?limit=50').then((r) => r.json()),
    ]).then(([cands, tpls]) => {
      setCandidates(cands?.data ?? []);
      setTemplates(tpls?.data ?? []);
    });
  }, [fetchOffers]);

  const candidateOptions = candidates.map((c) => ({ label: `${c.applicationNo} — ${c.firstName} ${c.lastName}`, value: c.id }));
  const templateOptions = templates.map((t) => ({ label: t.templateName, value: t.id }));

  const submit = async () => {
    if (!form.candidateId || !form.proposedSalary || !form.joiningDate) {
      toast.error('Candidate, salary, and joining date are required');
      return;
    }
    setSubmitting(true);
    try {
      const payload: Record<string, unknown> = {
        candidateId: Number(form.candidateId),
        proposedSalary: Number(form.proposedSalary),
        joiningDate: form.joiningDate,
        employmentType: form.employmentType,
        probationMonths: Number(form.probationMonths),
      };
      if (form.offerTemplateId) payload.offerTemplateId = Number(form.offerTemplateId);
      if (form.remarks) payload.remarks = form.remarks;

      const res = await fetch('/api/recruitment/offer-letters', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? 'Failed to generate');
      setFormOpen(false);
      setForm({ candidateId: '', offerTemplateId: '', proposedSalary: '', joiningDate: '', employmentType: 'Full-time', probationMonths: '6', remarks: '' });
      fetchOffers();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed to generate');
    } finally {
      setSubmitting(false);
    }
  };

  const updateStatus = async (id: number, status: string) => {
    try {
      const res = await fetch(`/api/recruitment/offer-letters/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status }),
      });
      if (!res.ok) throw new Error('Failed to update');
      fetchOffers();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed to update');
    }
  };

  const columns: Column<OfferRow>[] = [
    { key: 'offerNo', label: 'Offer No', className: 'font-medium' },
    { key: 'candidate', label: 'Candidate', render: (row) => `${row.candidate?.firstName} ${row.candidate?.lastName}` },
    { key: 'proposedSalary', label: 'Salary', render: (row) => row.proposedSalary ? Number(row.proposedSalary).toLocaleString() : '—' },
    { key: 'employmentType', label: 'Type', render: (row) => row.employmentType ?? '—' },
    { key: 'joiningDate', label: 'Joining', render: (row) => row.joiningDate ? new Date(row.joiningDate).toLocaleDateString() : '—' },
    {
      key: 'status', label: 'Status',
      render: (row) => {
        const colors: Record<string, string> = { Draft: '#f3f4f6', Generated: '#dbeafe', Sent: '#fef3c7', Accepted: '#dcfce7', Rejected: '#fee2e2', Expired: '#fee2e2' };
        const textColors: Record<string, string> = { Draft: '#6b7280', Generated: '#1e40af', Sent: '#92400e', Accepted: '#166534', Rejected: '#991b1b', Expired: '#991b1b' };
        return <span className="px-2 py-0.5 text-xs font-medium rounded-full" style={{ backgroundColor: colors[row.status] ?? '#f3f4f6', color: textColors[row.status] ?? '#6b7280' }}>{row.status}</span>;
      },
    },
  ];

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-base font-semibold" style={{ color: 'var(--foreground)' }}>Offer Letters</h2>
        <button onClick={() => setFormOpen(true)} className="rounded-lg px-4 py-2 text-sm font-medium text-white" style={{ backgroundColor: 'var(--accent)' }}>+ Generate Offer</button>
      </div>

      <DataTable
        columns={columns}
        data={offers}
        loading={loading}
        renderRowActions={(row) => (
          <div className="flex gap-1">
            {row.status === 'Generated' && (
              <button onClick={() => updateStatus(row.id, 'Sent')} className="text-xs font-medium px-2 py-1 rounded" style={{ backgroundColor: '#fef3c7', color: '#92400e' }}>Send</button>
            )}
            {row.status === 'Sent' && (
              <>
                <button onClick={() => updateStatus(row.id, 'Accepted')} className="text-xs font-medium px-2 py-1 rounded" style={{ backgroundColor: '#dcfce7', color: '#166534' }}>Accept</button>
                <button onClick={() => updateStatus(row.id, 'Rejected')} className="text-xs font-medium px-2 py-1 rounded" style={{ backgroundColor: '#fee2e2', color: '#991b1b' }}>Reject</button>
              </>
            )}
          </div>
        )}
      />

      {formOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ backgroundColor: 'rgba(0,0,0,0.4)' }} onClick={() => setFormOpen(false)}>
          <div className="w-full max-w-lg rounded-xl shadow-2xl max-h-[90vh] overflow-y-auto" style={{ backgroundColor: 'var(--surface)', border: '1px solid var(--border)' }} onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between px-5 py-4 border-b" style={{ borderColor: 'var(--border)' }}>
              <h2 className="text-base font-semibold" style={{ color: 'var(--foreground)' }}>Generate Offer Letter</h2>
              <button onClick={() => setFormOpen(false)} className="text-lg" style={{ color: 'var(--foreground-muted)' }}>×</button>
            </div>
            <div className="space-y-4 p-5">
              <div>
                <label className={labelClass} style={{ color: 'var(--foreground)' }}>Candidate *</label>
                <SearchableSelect value={form.candidateId} options={candidateOptions} onChange={(v) => setForm({ ...form, candidateId: String(v) })} placeholder="Search candidate..." />
              </div>
              <div>
                <label className={labelClass} style={{ color: 'var(--foreground)' }}>Offer Template</label>
                <SearchableSelect value={form.offerTemplateId} options={templateOptions} onChange={(v) => setForm({ ...form, offerTemplateId: String(v) })} placeholder="Select template (optional)" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className={labelClass} style={{ color: 'var(--foreground)' }}>Proposed Salary (CTC) *</label>
                  <input type="number" className={inputClass} style={inputStyle} value={form.proposedSalary} onChange={(e) => setForm({ ...form, proposedSalary: e.target.value })} />
                </div>
                <div>
                  <label className={labelClass} style={{ color: 'var(--foreground)' }}>Joining Date *</label>
                  <input type="date" className={inputClass} style={inputStyle} value={form.joiningDate} onChange={(e) => setForm({ ...form, joiningDate: e.target.value })} />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className={labelClass} style={{ color: 'var(--foreground)' }}>Employment Type</label>
                  <select className={inputClass} style={inputStyle} value={form.employmentType} onChange={(e) => setForm({ ...form, employmentType: e.target.value })}>
                    <option value="Full-time">Full-time</option>
                    <option value="Part-time">Part-time</option>
                    <option value="Contract">Contract</option>
                  </select>
                </div>
                <div>
                  <label className={labelClass} style={{ color: 'var(--foreground)' }}>Probation (months)</label>
                  <input type="number" className={inputClass} style={inputStyle} value={form.probationMonths} onChange={(e) => setForm({ ...form, probationMonths: e.target.value })} />
                </div>
              </div>
              <div>
                <label className={labelClass} style={{ color: 'var(--foreground)' }}>Remarks</label>
                <textarea className={inputClass} style={inputStyle} rows={2} value={form.remarks} onChange={(e) => setForm({ ...form, remarks: e.target.value })} />
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
