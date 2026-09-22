/**
 * Call Interview tab — select a candidate and log a call outcome (BRD §5.4, §5.5).
 */

'use client';

import { useCallback, useEffect, useState } from 'react';
import { useToast } from '@/components/ui';
import SearchableSelect from '@/components/ui/SearchableSelect';

interface CandidateOption { id: number; applicationNo: string; firstName: string; lastName: string; mobile: string; }

const inputClass = 'w-full rounded-lg border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--accent)]';
const inputStyle = { backgroundColor: 'var(--surface)', color: 'var(--foreground)', borderColor: 'var(--border)' } as const;
const labelClass = 'block text-sm font-medium mb-1';

const OUTCOMES = [
  'Connected-Interested',
  'Connected-Not Interested',
  'Call Back',
  'No Response',
  'Not Reachable',
  'Rejected',
  'Proceed',
];

export default function CallInterviewTab() {
  const toast = useToast();
  const [candidates, setCandidates] = useState<CandidateOption[]>([]);
  const [selectedCandidate, setSelectedCandidate] = useState('');
  const [form, setForm] = useState({
    callDate: new Date().toISOString().slice(0, 10),
    callTime: '',
    callOutcome: '',
    candidateInterested: false,
    expectedSalary: '',
    noticePeriod: '',
    availableJoiningDate: '',
    remarks: '',
    nextAction: '',
  });
  const [submitting, setSubmitting] = useState(false);

  const fetchCandidates = useCallback(async (search: string) => {
    const params = new URLSearchParams({ limit: '20' });
    if (search) params.set('search', search);
    const res = await fetch(`/api/recruitment/candidates?${params}`);
    const json = await res.json();
    setCandidates(json.data ?? []);
  }, []);

  useEffect(() => { fetchCandidates(''); }, [fetchCandidates]);

  const candidateOptions = candidates.map((c) => ({
    label: `${c.applicationNo} — ${c.firstName} ${c.lastName} (${c.mobile})`,
    value: c.id,
  }));

  const submit = async () => {
    if (!selectedCandidate) { toast.error('Select a candidate'); return; }
    if (!form.callOutcome) { toast.error('Call outcome is required'); return; }
    setSubmitting(true);
    try {
      const payload: Record<string, unknown> = {
        candidateId: Number(selectedCandidate),
        callDate: form.callDate,
        callOutcome: form.callOutcome,
        candidateInterested: form.candidateInterested,
      };
      if (form.callTime) payload.callTime = form.callTime;
      if (form.expectedSalary) payload.expectedSalary = Number(form.expectedSalary);
      if (form.noticePeriod) payload.noticePeriod = form.noticePeriod;
      if (form.availableJoiningDate) payload.availableJoiningDate = form.availableJoiningDate;
      if (form.remarks) payload.remarks = form.remarks;
      if (form.nextAction) payload.nextAction = form.nextAction;

      const res = await fetch('/api/recruitment/call-interviews', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? 'Failed to log call');
      toast.success(`Call logged for ${json.candidate?.firstName} ${json.candidate?.lastName}`);
      setForm({ callDate: new Date().toISOString().slice(0, 10), callTime: '', callOutcome: '', candidateInterested: false, expectedSalary: '', noticePeriod: '', availableJoiningDate: '', remarks: '', nextAction: '' });
      setSelectedCandidate('');
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed to log call');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="max-w-2xl space-y-4">
      <div className="card space-y-4 p-5">
        <h2 className="text-base font-semibold" style={{ color: 'var(--foreground)' }}>Select Candidate</h2>
        <div>
          <label className={labelClass} style={{ color: 'var(--foreground)' }}>Candidate *</label>
          <SearchableSelect
            value={selectedCandidate}
            options={candidateOptions}
            onChange={(v) => setSelectedCandidate(String(v))}
            placeholder="Search by application no, name, or mobile..."
          />
        </div>
      </div>

      <div className="card space-y-4 p-5">
        <h2 className="text-base font-semibold" style={{ color: 'var(--foreground)' }}>Call Details</h2>
        <div className="grid grid-cols-3 gap-3">
          <div>
            <label className={labelClass} style={{ color: 'var(--foreground)' }}>Call Date *</label>
            <input type="date" className={inputClass} style={inputStyle} value={form.callDate} onChange={(e) => setForm({ ...form, callDate: e.target.value })} />
          </div>
          <div>
            <label className={labelClass} style={{ color: 'var(--foreground)' }}>Call Time</label>
            <input type="time" className={inputClass} style={inputStyle} value={form.callTime} onChange={(e) => setForm({ ...form, callTime: e.target.value })} />
          </div>
          <div>
            <label className={labelClass} style={{ color: 'var(--foreground)' }}>Outcome *</label>
            <select className={inputClass} style={inputStyle} value={form.callOutcome} onChange={(e) => setForm({ ...form, callOutcome: e.target.value })}>
              <option value="">Select...</option>
              {OUTCOMES.map((o) => <option key={o} value={o}>{o}</option>)}
            </select>
          </div>
        </div>
        <div className="grid grid-cols-3 gap-3">
          <div>
            <label className={labelClass} style={{ color: 'var(--foreground)' }}>Expected Salary</label>
            <input type="number" className={inputClass} style={inputStyle} value={form.expectedSalary} onChange={(e) => setForm({ ...form, expectedSalary: e.target.value })} placeholder="Annual CTC" />
          </div>
          <div>
            <label className={labelClass} style={{ color: 'var(--foreground)' }}>Notice Period</label>
            <input className={inputClass} style={inputStyle} value={form.noticePeriod} onChange={(e) => setForm({ ...form, noticePeriod: e.target.value })} placeholder="e.g. 30 days" />
          </div>
          <div>
            <label className={labelClass} style={{ color: 'var(--foreground)' }}>Available Joining Date</label>
            <input type="date" className={inputClass} style={inputStyle} value={form.availableJoiningDate} onChange={(e) => setForm({ ...form, availableJoiningDate: e.target.value })} />
          </div>
        </div>
        <label className="flex items-center gap-2 text-sm" style={{ color: 'var(--foreground)' }}>
          <input type="checkbox" checked={form.candidateInterested} onChange={(e) => setForm({ ...form, candidateInterested: e.target.checked })} />
          Candidate is interested
        </label>
        <div>
          <label className={labelClass} style={{ color: 'var(--foreground)' }}>Remarks</label>
          <textarea className={inputClass} style={inputStyle} rows={2} value={form.remarks} onChange={(e) => setForm({ ...form, remarks: e.target.value })} />
        </div>
        <div>
          <label className={labelClass} style={{ color: 'var(--foreground)' }}>Next Action</label>
          <input className={inputClass} style={inputStyle} value={form.nextAction} onChange={(e) => setForm({ ...form, nextAction: e.target.value })} placeholder="e.g. Schedule technical interview" />
        </div>
      </div>

      <div className="flex justify-end">
        <button
          onClick={submit}
          disabled={submitting}
          className="rounded-lg px-6 py-2 text-sm font-medium text-white"
          style={{ backgroundColor: 'var(--accent)', opacity: submitting ? 0.6 : 1 }}
        >
          {submitting ? 'Logging...' : 'Log Call'}
        </button>
      </div>
    </div>
  );
}
