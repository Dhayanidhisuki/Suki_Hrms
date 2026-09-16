/**
 * Final Selection tab — propose salary, joining date, employment type (BRD §5.14).
 * Routes through Recruitment Approval Matrix.
 */

'use client';

import { useEffect, useState } from 'react';
import SearchableSelect from '@/components/ui/SearchableSelect';

interface CandidateOption { id: number; applicationNo: string; firstName: string; lastName: string; }
interface ManagerOption { id: number; firstName: string; lastName: string; employeeCode: string; }

const inputClass = 'w-full rounded-lg border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--accent)]';
const inputStyle = { backgroundColor: 'var(--surface)', color: 'var(--foreground)', borderColor: 'var(--border)' } as const;
const labelClass = 'block text-sm font-medium mb-1';

export default function FinalSelectionTab() {
  const [candidates, setCandidates] = useState<CandidateOption[]>([]);
  const [managers, setManagers] = useState<ManagerOption[]>([]);
  const [form, setForm] = useState({
    candidateId: '', proposedSalary: '', joiningDate: '', employmentType: 'Full-time',
    reportingManagerId: '', remarks: '',
  });
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [proposals, setProposals] = useState<Record<string, unknown>[]>([]);

  useEffect(() => {
    Promise.all([
      fetch('/api/recruitment/candidates?limit=50').then((r) => r.json()),
      fetch('/api/employees?limit=100').then((r) => r.json()),
    ]).then(([cands, emps]) => {
      setCandidates(cands?.data ?? []);
      setManagers(emps?.data ?? []);
    });
  }, []);

  const candidateOptions = candidates.map((c) => ({ label: `${c.applicationNo} — ${c.firstName} ${c.lastName}`, value: c.id }));
  const managerOptions = managers.map((e) => ({ label: `${e.employeeCode} — ${e.firstName} ${e.lastName}`, value: e.id }));

  const submit = async () => {
    if (!form.candidateId || !form.proposedSalary || !form.joiningDate) {
      setError('Candidate, salary, and joining date are required');
      return;
    }
    setSubmitting(true);
    setError(null);
    setSuccess(null);
    try {
      const payload: Record<string, unknown> = {
        candidateId: Number(form.candidateId),
        proposedSalary: Number(form.proposedSalary),
        joiningDate: form.joiningDate,
        employmentType: form.employmentType,
      };
      if (form.reportingManagerId) payload.reportingManagerId = Number(form.reportingManagerId);
      if (form.remarks) payload.remarks = form.remarks;

      const res = await fetch('/api/recruitment/final-selections', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? 'Failed to propose');
      setSuccess(`Final selection proposed — ${json.offerNo}. Approval: ${json.approvalMatrix ? json.approvalMatrix.process : 'Auto-Approved'}`);
      setForm({ candidateId: '', proposedSalary: '', joiningDate: '', employmentType: 'Full-time', reportingManagerId: '', remarks: '' });
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to propose');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="max-w-2xl space-y-4">
      {error && (
        <div className="rounded-lg px-3 py-2 text-sm" style={{ backgroundColor: '#fef2f2', color: '#dc2626', border: '1px solid #fecaca' }}>{error}</div>
      )}
      {success && (
        <div className="rounded-lg px-3 py-2 text-sm" style={{ backgroundColor: '#ecfdf5', color: '#047857', border: '1px solid #a7f3d0' }}>{success}</div>
      )}

      <div className="card space-y-4 p-5">
        <h2 className="text-base font-semibold" style={{ color: 'var(--foreground)' }}>Final Selection Proposal</h2>
        <div>
          <label className={labelClass} style={{ color: 'var(--foreground)' }}>Candidate *</label>
          <SearchableSelect value={form.candidateId} options={candidateOptions} onChange={(v) => setForm({ ...form, candidateId: String(v) })} placeholder="Search candidate..." />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className={labelClass} style={{ color: 'var(--foreground)' }}>Proposed Salary (CTC) *</label>
            <input type="number" className={inputClass} style={inputStyle} value={form.proposedSalary} onChange={(e) => setForm({ ...form, proposedSalary: e.target.value })} placeholder="Annual CTC" />
          </div>
          <div>
            <label className={labelClass} style={{ color: 'var(--foreground)' }}>Joining Date *</label>
            <input type="date" className={inputClass} style={inputStyle} value={form.joiningDate} onChange={(e) => setForm({ ...form, joiningDate: e.target.value })} />
          </div>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className={labelClass} style={{ color: 'var(--foreground)' }}>Employment Type *</label>
            <select className={inputClass} style={inputStyle} value={form.employmentType} onChange={(e) => setForm({ ...form, employmentType: e.target.value })}>
              <option value="Full-time">Full-time</option>
              <option value="Part-time">Part-time</option>
              <option value="Contract">Contract</option>
              <option value="Internship">Internship</option>
            </select>
          </div>
          <div>
            <label className={labelClass} style={{ color: 'var(--foreground)' }}>Reporting Manager</label>
            <SearchableSelect value={form.reportingManagerId} options={managerOptions} onChange={(v) => setForm({ ...form, reportingManagerId: String(v) })} placeholder="Select manager" />
          </div>
        </div>
        <div>
          <label className={labelClass} style={{ color: 'var(--foreground)' }}>Remarks</label>
          <textarea className={inputClass} style={inputStyle} rows={2} value={form.remarks} onChange={(e) => setForm({ ...form, remarks: e.target.value })} />
        </div>
        <div className="flex justify-end">
          <button onClick={submit} disabled={submitting} className="rounded-lg px-6 py-2 text-sm font-medium text-white" style={{ backgroundColor: 'var(--accent)', opacity: submitting ? 0.6 : 1 }}>
            {submitting ? 'Proposing...' : 'Propose Selection'}
          </button>
        </div>
      </div>
    </div>
  );
}
