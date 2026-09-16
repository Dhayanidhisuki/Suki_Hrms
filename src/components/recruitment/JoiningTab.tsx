/**
 * Joining tab — checklist management + joining approval + push to employee (BRD §5.16, §7, §8, §5.17).
 */

'use client';

import { Suspense, useCallback, useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import SearchableSelect from '@/components/ui/SearchableSelect';

interface CandidateOption { id: number; applicationNo: string; firstName: string; lastName: string; }
interface ChecklistItem {
  id: number;
  status: string;
  checklistMaster: { id: number; itemName: string; itemCode: string };
}
interface JoiningRow {
  id: number;
  joiningDate: string | null;
  actualJoiningDate: string | null;
  joiningStatus: string;
  approvalStatus: string;
  candidate: { id: number; applicationNo: string; firstName: string; lastName: string; };
  offerLetter: { id: number; offerNo: string } | null;
}

const inputClass = 'w-full rounded-lg border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--accent)]';
const inputStyle = { backgroundColor: 'var(--surface)', color: 'var(--foreground)', borderColor: 'var(--border)' } as const;
const labelClass = 'block text-sm font-medium mb-1';

export default function JoiningTab() {
  return (
    <Suspense fallback={<div className="p-4 text-sm" style={{ color: 'var(--foreground-muted)' }}>Loading...</div>}>
      <JoiningInner />
    </Suspense>
  );
}

function JoiningInner() {
  const searchParams = useSearchParams();
  const [candidates, setCandidates] = useState<CandidateOption[]>([]);
  const [selectedCandidate, setSelectedCandidate] = useState(searchParams.get('candidateId') ?? '');
  const [joinings, setJoinings] = useState<JoiningRow[]>([]);
  const [checklist, setChecklist] = useState<ChecklistItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [joinForm, setJoinForm] = useState({ joiningDate: '', remarks: '' });
  const [submitting, setSubmitting] = useState(false);
  const [pushOpen, setPushOpen] = useState(false);
  const [companyId, setCompanyId] = useState('1');
  const [employeeCode, setEmployeeCode] = useState('');
  const [pushing, setPushing] = useState(false);

  useEffect(() => {
    fetch('/api/recruitment/candidates?limit=50').then((r) => r.json()).then((j) => setCandidates(j.data ?? []));
  }, []);

  const candidateOptions = candidates.map((c) => ({ label: `${c.applicationNo} — ${c.firstName} ${c.lastName}`, value: c.id }));

  const fetchJoinings = useCallback(async () => {
    if (!selectedCandidate) { setJoinings([]); setChecklist([]); return; }
    setLoading(true);
    try {
      const [joinRes, checkRes] = await Promise.all([
        fetch(`/api/recruitment/candidate-joinings?candidateId=${selectedCandidate}`),
        fetch(`/api/recruitment/candidates/${selectedCandidate}/checklist`),
      ]);
      const joinJson = await joinRes.json();
      const checkJson = await checkRes.json();
      setJoinings(joinJson.data ?? []);
      setChecklist(checkJson.data ?? []);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to fetch');
    } finally {
      setLoading(false);
    }
  }, [selectedCandidate]);

  useEffect(() => { fetchJoinings(); }, [fetchJoinings]);

  const createJoining = async () => {
    if (!selectedCandidate) return;
    setSubmitting(true);
    setError(null);
    try {
      const payload: Record<string, unknown> = { candidateId: Number(selectedCandidate) };
      if (joinForm.joiningDate) payload.joiningDate = joinForm.joiningDate;
      if (joinForm.remarks) payload.remarks = joinForm.remarks;
      const res = await fetch('/api/recruitment/candidate-joinings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? 'Failed to create joining');
      setFormOpen(false);
      setJoinForm({ joiningDate: '', remarks: '' });
      fetchJoinings();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to create joining');
    } finally {
      setSubmitting(false);
    }
  };

  const updateChecklistItem = async (itemId: number, status: string) => {
    try {
      const res = await fetch(`/api/recruitment/candidates/${selectedCandidate}/checklist/${itemId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status }),
      });
      if (!res.ok) throw new Error('Failed to update');
      fetchJoinings();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to update');
    }
  };

  const approveJoining = async (joiningId: number, action: string) => {
    try {
      const res = await fetch(`/api/recruitment/candidate-joinings/${joiningId}/approval`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? 'Failed');
      setSuccess(`Joining ${action}`);
      fetchJoinings();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed');
    }
  };

  const pushToEmployee = async () => {
    const joining = joinings[0];
    if (!joining) return;
    setPushing(true);
    setError(null);
    setSuccess(null);
    try {
      const payload: Record<string, unknown> = {
        candidateId: Number(selectedCandidate),
        joiningId: joining.id,
        companyId: Number(companyId),
      };
      if (employeeCode) payload.employeeCode = employeeCode;
      const res = await fetch('/api/recruitment/push-to-employee', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? 'Failed');
      setSuccess(`Converted to Employee — ${json.employeeCode}`);
      setPushOpen(false);
      setEmployeeCode('');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed');
    } finally {
      setPushing(false);
    }
  };

  return (
    <div className="space-y-4">
      {error && (
        <div className="rounded-lg px-3 py-2 text-sm" style={{ backgroundColor: '#fef2f2', color: '#dc2626', border: '1px solid #fecaca' }}>
          {error}
          <button className="ml-2 underline" onClick={() => setError(null)}>dismiss</button>
        </div>
      )}
      {success && (
        <div className="rounded-lg px-3 py-2 text-sm" style={{ backgroundColor: '#ecfdf5', color: '#047857', border: '1px solid #a7f3d0' }}>{success}</div>
      )}

      <div className="max-w-md">
        <label className={labelClass} style={{ color: 'var(--foreground)' }}>Select Candidate</label>
        <SearchableSelect value={selectedCandidate} options={candidateOptions} onChange={(v) => setSelectedCandidate(String(v))} placeholder="Search candidate..." />
      </div>

      {selectedCandidate && (
        <>
          {/* Joining records */}
          <div className="card p-5">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-semibold" style={{ color: 'var(--foreground)' }}>Joining Records</h3>
              {joinings.length === 0 && (
                <button onClick={() => setFormOpen(true)} className="rounded-lg px-3 py-1.5 text-xs font-medium text-white" style={{ backgroundColor: 'var(--accent)' }}>+ Initiate Joining</button>
              )}
            </div>
            {loading ? (
              <p className="text-sm" style={{ color: 'var(--foreground-muted)' }}>Loading...</p>
            ) : joinings.length === 0 ? (
              <p className="text-sm" style={{ color: 'var(--foreground-muted)' }}>No joining initiated yet.</p>
            ) : (
              <div className="space-y-2">
                {joinings.map((j) => (
                  <div key={j.id} className="rounded-lg border p-3" style={{ borderColor: 'var(--border)' }}>
                    <div className="flex justify-between items-center">
                      <div>
                        <span className="text-sm font-medium" style={{ color: 'var(--foreground)' }}>Status: {j.joiningStatus}</span>
                        <p className="text-xs" style={{ color: 'var(--foreground-muted)' }}>
                          Joining Date: {j.joiningDate ? new Date(j.joiningDate).toLocaleDateString() : 'TBD'}
                          {j.actualJoiningDate ? ` · Actual: ${new Date(j.actualJoiningDate).toLocaleDateString()}` : ''}
                        </p>
                        <p className="text-xs" style={{ color: 'var(--foreground-muted)' }}>Approval: {j.approvalStatus}</p>
                      </div>
                      <div className="flex gap-1">
                        {j.approvalStatus === 'Pending' && (
                          <>
                            <button onClick={() => approveJoining(j.id, 'Approved')} className="text-xs font-medium px-2 py-1 rounded" style={{ backgroundColor: '#dcfce7', color: '#166534' }}>Approve</button>
                            <button onClick={() => approveJoining(j.id, 'Rejected')} className="text-xs font-medium px-2 py-1 rounded" style={{ backgroundColor: '#fee2e2', color: '#991b1b' }}>Reject</button>
                          </>
                        )}
                        {j.approvalStatus === 'Approved' && j.joiningStatus !== 'Joined' && (
                          <button onClick={() => setPushOpen(true)} className="text-xs font-medium px-2 py-1 rounded" style={{ backgroundColor: 'var(--accent)', color: 'white' }}>Push to Employee</button>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Checklist */}
          {checklist.length > 0 && (
            <div className="card p-5">
              <h3 className="text-sm font-semibold mb-3" style={{ color: 'var(--foreground)' }}>Joining Checklist ({checklist.length})</h3>
              <div className="space-y-2">
                {checklist.map((item) => {
                  const colors: Record<string, string> = { 'Received': '#dcfce7', 'Not Received': '#fef3c7', 'Not Required': '#fee2e2' };
                  const textColors: Record<string, string> = { 'Received': '#166534', 'Not Received': '#92400e', 'Not Required': '#991b1b' };
                  return (
                    <div key={item.id} className="flex items-center justify-between rounded-lg border p-3" style={{ borderColor: 'var(--border)' }}>
                      <div>
                        <span className="text-sm font-medium" style={{ color: 'var(--foreground)' }}>{item.checklistMaster?.itemName ?? 'Unknown'}</span>
                        <span className="ml-2 text-xs px-2 py-0.5 rounded-full" style={{ backgroundColor: colors[item.status] ?? '#f3f4f6', color: textColors[item.status] ?? '#6b7280' }}>{item.status}</span>
                      </div>
                      <div className="flex gap-1">
                        <button onClick={() => updateChecklistItem(item.id, 'Received')} className="text-xs font-medium px-2 py-1 rounded" style={{ backgroundColor: '#dcfce7', color: '#166534' }}>Received</button>
                        <button onClick={() => updateChecklistItem(item.id, 'Not Received')} className="text-xs font-medium px-2 py-1 rounded" style={{ backgroundColor: '#fef3c7', color: '#92400e' }}>Not Received</button>
                        <button onClick={() => updateChecklistItem(item.id, 'Not Required')} className="text-xs font-medium px-2 py-1 rounded" style={{ backgroundColor: '#fee2e2', color: '#991b1b' }}>Not Required</button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </>
      )}

      {/* Initiate joining modal */}
      {formOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ backgroundColor: 'rgba(0,0,0,0.4)' }} onClick={() => setFormOpen(false)}>
          <div className="w-full max-w-md rounded-xl shadow-2xl" style={{ backgroundColor: 'var(--surface)', border: '1px solid var(--border)' }} onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between px-5 py-4 border-b" style={{ borderColor: 'var(--border)' }}>
              <h2 className="text-base font-semibold" style={{ color: 'var(--foreground)' }}>Initiate Joining</h2>
              <button onClick={() => setFormOpen(false)} className="text-lg" style={{ color: 'var(--foreground-muted)' }}>×</button>
            </div>
            <div className="space-y-4 p-5">
              <div>
                <label className={labelClass} style={{ color: 'var(--foreground)' }}>Planned Joining Date</label>
                <input type="date" className={inputClass} style={inputStyle} value={joinForm.joiningDate} onChange={(e) => setJoinForm({ ...joinForm, joiningDate: e.target.value })} />
              </div>
              <div>
                <label className={labelClass} style={{ color: 'var(--foreground)' }}>Remarks</label>
                <textarea className={inputClass} style={inputStyle} rows={2} value={joinForm.remarks} onChange={(e) => setJoinForm({ ...joinForm, remarks: e.target.value })} />
              </div>
            </div>
            <div className="flex justify-end gap-2 px-5 py-4 border-t" style={{ borderColor: 'var(--border)' }}>
              <button onClick={() => setFormOpen(false)} className="rounded-lg border px-4 py-2 text-sm" style={{ borderColor: 'var(--border)', color: 'var(--foreground)' }}>Cancel</button>
              <button onClick={createJoining} disabled={submitting} className="rounded-lg px-4 py-2 text-sm font-medium text-white" style={{ backgroundColor: 'var(--accent)', opacity: submitting ? 0.6 : 1 }}>
                {submitting ? 'Creating...' : 'Initiate'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Push to Employee modal */}
      {pushOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ backgroundColor: 'rgba(0,0,0,0.4)' }} onClick={() => setPushOpen(false)}>
          <div className="w-full max-w-md rounded-xl shadow-2xl" style={{ backgroundColor: 'var(--surface)', border: '1px solid var(--border)' }} onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between px-5 py-4 border-b" style={{ borderColor: 'var(--border)' }}>
              <h2 className="text-base font-semibold" style={{ color: 'var(--foreground)' }}>Push to Employee Master</h2>
              <button onClick={() => setPushOpen(false)} className="text-lg" style={{ color: 'var(--foreground-muted)' }}>×</button>
            </div>
            <div className="space-y-4 p-5">
              <p className="text-sm" style={{ color: 'var(--foreground-muted)' }}>
                This will convert the candidate to an Employee Master record. The Employee ID will be auto-generated based on the company configuration.
              </p>
              <div>
                <label className={labelClass} style={{ color: 'var(--foreground)' }}>Company ID *</label>
                <input type="number" className={inputClass} style={inputStyle} value={companyId} onChange={(e) => setCompanyId(e.target.value)} />
              </div>
              <div>
                <label className={labelClass} style={{ color: 'var(--foreground)' }}>Employee Code (leave blank for auto)</label>
                <input className={inputClass} style={inputStyle} value={employeeCode} onChange={(e) => setEmployeeCode(e.target.value)} placeholder="Auto-generated" />
              </div>
            </div>
            <div className="flex justify-end gap-2 px-5 py-4 border-t" style={{ borderColor: 'var(--border)' }}>
              <button onClick={() => setPushOpen(false)} className="rounded-lg border px-4 py-2 text-sm" style={{ borderColor: 'var(--border)', color: 'var(--foreground)' }}>Cancel</button>
              <button onClick={pushToEmployee} disabled={pushing} className="rounded-lg px-4 py-2 text-sm font-medium text-white" style={{ backgroundColor: 'var(--accent)', opacity: pushing ? 0.6 : 1 }}>
                {pushing ? 'Converting...' : 'Convert to Employee'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
