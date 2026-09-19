/**
 * Interview Scheduling tab — schedule an interview for a candidate (BRD §5.7, §5.9).
 * Level-based, driven by Interview Process master. Snapshots config on schedule.
 */

'use client';

import { useCallback, useEffect, useState } from 'react';
import { DataTable, SearchableSelect, useToast, type Column } from '@/components/ui';

interface CandidateOption { id: number; applicationNo: string; firstName: string; lastName: string; }
interface LevelOption { id: number; levelName: string; levelCode: string; }
interface TypeOption { id: number; typeName: string; typeCode: string; }
interface InterviewerOption { id: number; firstName: string; lastName: string; employeeCode: string; }

interface ScheduleRow {
  id: number;
  scheduledDate: string;
  startTime: string;
  endTime: string | null;
  mode: string;
  locationOrLink: string | null;
  status: string;
  candidate: { id: number; applicationNo: string; firstName: string; lastName: string; };
  interviewLevel: { id: number; levelName: string; };
  interviewType: { id: number; typeName: string; };
  interviewer: { id: number; firstName: string; lastName: string; };
  evaluationSummary: { result: string; weightedScore: number; recommendation: string } | null;
}

const inputClass = 'w-full rounded-lg border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--accent)]';
const inputStyle = { backgroundColor: 'var(--surface)', color: 'var(--foreground)', borderColor: 'var(--border)' } as const;
const labelClass = 'block text-sm font-medium mb-1';

export default function SchedulingTab() {
  const toast = useToast();
  const [schedules, setSchedules] = useState<ScheduleRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [pagination, setPagination] = useState({ page: 1, limit: 20, total: 0, totalPages: 0 });

  const [candidates, setCandidates] = useState<CandidateOption[]>([]);
  const [levels, setLevels] = useState<LevelOption[]>([]);
  const [types, setTypes] = useState<TypeOption[]>([]);
  const [interviewers, setInterviewers] = useState<InterviewerOption[]>([]);

  const [formOpen, setFormOpen] = useState(false);
  const [form, setForm] = useState({
    candidateId: '', interviewLevelId: '', interviewTypeId: '', interviewerId: '',
    scheduledDate: new Date().toISOString().slice(0, 10), startTime: '10:00', endTime: '',
    mode: 'Online', locationOrLink: '',
  });
  const [submitting, setSubmitting] = useState(false);

  const fetchSchedules = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ page: String(page), limit: '20' });
      const res = await fetch(`/api/recruitment/interview-schedules?${params}`);
      const json = await res.json();
      setSchedules(json.data ?? []);
      setPagination(json.pagination ?? { page: 1, limit: 20, total: 0, totalPages: 0 });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed to fetch');
    } finally {
      setLoading(false);
    }
  }, [page, toast]);

  useEffect(() => {
    fetchSchedules();
    Promise.all([
      fetch('/api/recruitment/candidates?limit=50').then((r) => r.json()),
      fetch('/api/masters/interview-levels?limit=50').then((r) => r.json()),
      fetch('/api/masters/interview-types?limit=50').then((r) => r.json()),
      fetch('/api/employees?limit=100').then((r) => r.json()),
    ]).then(([cands, levs, typs, emps]) => {
      setCandidates(cands?.data ?? []);
      setLevels(levs?.data ?? []);
      setTypes(typs?.data ?? []);
      setInterviewers(emps?.data ?? []);
    });
  }, [fetchSchedules]);

  const candidateOptions = candidates.map((c) => ({ label: `${c.applicationNo} — ${c.firstName} ${c.lastName}`, value: c.id }));
  const levelOptions = levels.map((l) => ({ label: l.levelName, value: l.id }));
  const typeOptions = types.map((t) => ({ label: t.typeName, value: t.id }));
  const interviewerOptions = interviewers.map((e) => ({ label: `${e.employeeCode} — ${e.firstName} ${e.lastName}`, value: e.id }));

  const submit = async () => {
    if (!form.candidateId || !form.interviewLevelId || !form.interviewTypeId || !form.interviewerId) {
      toast.error('All fields are required');
      return;
    }
    setSubmitting(true);
    try {
      const payload: Record<string, unknown> = {
        candidateId: Number(form.candidateId),
        interviewLevelId: Number(form.interviewLevelId),
        interviewTypeId: Number(form.interviewTypeId),
        interviewerId: Number(form.interviewerId),
        scheduledDate: form.scheduledDate,
        startTime: form.startTime,
        mode: form.mode,
      };
      if (form.endTime) payload.endTime = form.endTime;
      if (form.locationOrLink) payload.locationOrLink = form.locationOrLink;

      const res = await fetch('/api/recruitment/interview-schedules', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? 'Failed to schedule');
      setFormOpen(false);
      setForm({ candidateId: '', interviewLevelId: '', interviewTypeId: '', interviewerId: '', scheduledDate: new Date().toISOString().slice(0, 10), startTime: '10:00', endTime: '', mode: 'Online', locationOrLink: '' });
      fetchSchedules();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed to schedule');
    } finally {
      setSubmitting(false);
    }
  };

  const columns: Column<ScheduleRow>[] = [
    { key: 'candidate', label: 'Candidate', render: (row) => `${row.candidate?.firstName} ${row.candidate?.lastName}` },
    { key: 'interviewLevel', label: 'Level', render: (row) => row.interviewLevel?.levelName ?? '—' },
    { key: 'interviewType', label: 'Type', render: (row) => row.interviewType?.typeName ?? '—' },
    { key: 'interviewer', label: 'Interviewer', render: (row) => row.interviewer ? `${row.interviewer.firstName} ${row.interviewer.lastName}` : '—' },
    { key: 'scheduledDate', label: 'Date', render: (row) => new Date(row.scheduledDate).toLocaleDateString() },
    { key: 'startTime', label: 'Time', render: (row) => `${row.startTime}${row.endTime ? `-${row.endTime}` : ''}` },
    { key: 'mode', label: 'Mode' },
    {
      key: 'status', label: 'Status',
      render: (row) => {
        const colors: Record<string, string> = { Completed: '#dcfce7', Scheduled: '#dbeafe', Pending: '#fef3c7', Cancelled: '#fee2e2' };
        const textColors: Record<string, string> = { Completed: '#166534', Scheduled: '#1e40af', Pending: '#92400e', Cancelled: '#991b1b' };
        return (
          <span className="px-2 py-0.5 text-xs font-medium rounded-full" style={{ backgroundColor: colors[row.status] ?? '#f3f4f6', color: textColors[row.status] ?? '#6b7280' }}>
            {row.status}
          </span>
        );
      },
    },
    {
      key: 'result', label: 'Result',
      render: (row) => row.evaluationSummary ? `${row.evaluationSummary.result} (${Number(row.evaluationSummary.weightedScore).toFixed(1)}%)` : '—',
    },
  ];

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-base font-semibold" style={{ color: 'var(--foreground)' }}>Scheduled Interviews</h2>
        <button onClick={() => setFormOpen(true)} className="rounded-lg px-4 py-2 text-sm font-medium text-white" style={{ backgroundColor: 'var(--accent)' }}>
          + Schedule Interview
        </button>
      </div>

      <DataTable
        columns={columns}
        data={schedules}
        pagination={pagination}
        loading={loading}
        onPageChange={setPage}
      />

      {formOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ backgroundColor: 'rgba(0,0,0,0.4)' }} onClick={() => setFormOpen(false)}>
          <div className="w-full max-w-lg rounded-xl shadow-2xl max-h-[90vh] overflow-y-auto" style={{ backgroundColor: 'var(--surface)', border: '1px solid var(--border)' }} onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between px-5 py-4 border-b" style={{ borderColor: 'var(--border)' }}>
              <h2 className="text-base font-semibold" style={{ color: 'var(--foreground)' }}>Schedule Interview</h2>
              <button onClick={() => setFormOpen(false)} className="text-lg" style={{ color: 'var(--foreground-muted)' }}>×</button>
            </div>
            <div className="space-y-4 p-5">
              <div>
                <label className={labelClass} style={{ color: 'var(--foreground)' }}>Candidate *</label>
                <SearchableSelect value={form.candidateId} options={candidateOptions} onChange={(v) => setForm({ ...form, candidateId: String(v) })} placeholder="Search candidate..." />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className={labelClass} style={{ color: 'var(--foreground)' }}>Interview Level *</label>
                  <SearchableSelect value={form.interviewLevelId} options={levelOptions} onChange={(v) => setForm({ ...form, interviewLevelId: String(v) })} placeholder="Select level" />
                </div>
                <div>
                  <label className={labelClass} style={{ color: 'var(--foreground)' }}>Interview Type *</label>
                  <SearchableSelect value={form.interviewTypeId} options={typeOptions} onChange={(v) => setForm({ ...form, interviewTypeId: String(v) })} placeholder="Select type" />
                </div>
              </div>
              <div>
                <label className={labelClass} style={{ color: 'var(--foreground)' }}>Interviewer *</label>
                <SearchableSelect value={form.interviewerId} options={interviewerOptions} onChange={(v) => setForm({ ...form, interviewerId: String(v) })} placeholder="Select interviewer" />
              </div>
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className={labelClass} style={{ color: 'var(--foreground)' }}>Date *</label>
                  <input type="date" className={inputClass} style={inputStyle} value={form.scheduledDate} onChange={(e) => setForm({ ...form, scheduledDate: e.target.value })} />
                </div>
                <div>
                  <label className={labelClass} style={{ color: 'var(--foreground)' }}>Start *</label>
                  <input type="time" className={inputClass} style={inputStyle} value={form.startTime} onChange={(e) => setForm({ ...form, startTime: e.target.value })} />
                </div>
                <div>
                  <label className={labelClass} style={{ color: 'var(--foreground)' }}>End</label>
                  <input type="time" className={inputClass} style={inputStyle} value={form.endTime} onChange={(e) => setForm({ ...form, endTime: e.target.value })} />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className={labelClass} style={{ color: 'var(--foreground)' }}>Mode *</label>
                  <select className={inputClass} style={inputStyle} value={form.mode} onChange={(e) => setForm({ ...form, mode: e.target.value })}>
                    <option value="Online">Online</option>
                    <option value="In-person">In-person</option>
                    <option value="Phone">Phone</option>
                  </select>
                </div>
                <div>
                  <label className={labelClass} style={{ color: 'var(--foreground)' }}>Location / Link</label>
                  <input className={inputClass} style={inputStyle} value={form.locationOrLink} onChange={(e) => setForm({ ...form, locationOrLink: e.target.value })} placeholder="Meeting link or room" />
                </div>
              </div>
            </div>
            <div className="flex justify-end gap-2 px-5 py-4 border-t" style={{ borderColor: 'var(--border)' }}>
              <button onClick={() => setFormOpen(false)} className="rounded-lg border px-4 py-2 text-sm" style={{ borderColor: 'var(--border)', color: 'var(--foreground)' }}>Cancel</button>
              <button onClick={submit} disabled={submitting} className="rounded-lg px-4 py-2 text-sm font-medium text-white" style={{ backgroundColor: 'var(--accent)', opacity: submitting ? 0.6 : 1 }}>
                {submitting ? 'Scheduling...' : 'Schedule'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
