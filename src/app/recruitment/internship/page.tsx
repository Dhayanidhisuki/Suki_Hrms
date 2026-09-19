'use client';

import { useCallback, useEffect, useState } from 'react';
import { ConfirmDialog, DataTable, SearchableSelect, useToast, type Column } from '@/components/ui';
import { formatDate } from '@/lib/format-date';

interface InternshipRow {
  id: number;
  internId: string;
  candidate: { id: number; applicationNo: string; firstName: string; lastName: string };
  college: string | null;
  regNo: string | null;
  course: string | null;
  department: { id: number; name: string } | null;
  mentor: { id: number; firstName: string; lastName: string; employeeCode: string } | null;
  trainingStart: string;
  trainingEnd: string;
  stipend: number | null;
  policy: { id: number; policyName: string } | null;
  status: string;
  createdAt: string;
}

interface CandidateOption {
  id: number;
  applicationNo: string;
  firstName: string;
  lastName: string;
}

interface EmployeeOption {
  id: number;
  firstName: string;
  lastName: string;
  employeeCode: string;
}

interface DepartmentOption {
  id: number;
  name: string;
}

interface PolicyOption {
  id: number;
  policyCode: string;
  policyName: string;
}

const STATUS_COLORS: Record<string, string> = {
  Applied: '#3b82f6',
  Accepted: '#8b5cf6',
  Active: '#16a34a',
  Completed: '#059669',
  Terminated: '#dc2626',
  Converted: '#ea580c',
  Closed: '#6b7280',
};

const STATUS_OPTIONS = ['Applied', 'Accepted', 'Active', 'Completed', 'Terminated', 'Converted', 'Closed'];

export default function InternshipPage() {
  const toast = useToast();
  const [records, setRecords] = useState<InternshipRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [modalOpen, setModalOpen] = useState(false);
  const [statusEdit, setStatusEdit] = useState<{ id: number; status: string } | null>(null);
  const [statusRemarks, setStatusRemarks] = useState('');
  const [deleteId, setDeleteId] = useState<number | null>(null);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/recruitment/internships');
      if (!res.ok) throw new Error('Failed to fetch internships');
      const json = await res.json();
      let rows: InternshipRow[] = json.data ?? [];
      if (search.trim()) {
        const q = search.trim().toLowerCase();
        rows = rows.filter(
          (r) =>
            r.internId.toLowerCase().includes(q) ||
            `${r.candidate.firstName} ${r.candidate.lastName}`.toLowerCase().includes(q) ||
            r.candidate.applicationNo.toLowerCase().includes(q) ||
            (r.college ?? '').toLowerCase().includes(q)
        );
      }
      setRecords(rows);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  }, [search, toast]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const columns: Column<InternshipRow>[] = [
    { key: 'internId', label: 'Intern ID', className: 'font-medium font-mono' },
    {
      key: 'candidate',
      label: 'Candidate',
      render: (row) => `${row.candidate.firstName} ${row.candidate.lastName}`,
    },
    { key: 'applicationNo', label: 'App No', render: (row) => row.candidate.applicationNo },
    { key: 'college', label: 'College' },
    { key: 'course', label: 'Course' },
    { key: 'department', label: 'Department', render: (row) => row.department?.name ?? '—' },
    {
      key: 'mentor',
      label: 'Mentor',
      render: (row) => row.mentor ? `${row.mentor.firstName} ${row.mentor.lastName}` : '—',
    },
    {
      key: 'period',
      label: 'Period',
      render: (row) => `${formatDate(row.trainingStart)} → ${formatDate(row.trainingEnd)}`,
    },
    {
      key: 'stipend',
      label: 'Stipend',
      render: (row) => (row.stipend ? `₹${row.stipend.toLocaleString()}` : '—'),
    },
    {
      key: 'status',
      label: 'Status',
      render: (row) => (
        <span
          className="rounded-full px-2.5 py-0.5 text-xs font-medium"
          style={{
            backgroundColor: `${STATUS_COLORS[row.status] ?? '#6b7280'}18`,
            color: STATUS_COLORS[row.status] ?? '#6b7280',
          }}
        >
          {row.status}
        </span>
      ),
    },
    {
      key: 'actions',
      label: 'Actions',
      render: (row) => (
        <div className="flex gap-1">
          <button
            type="button"
            onClick={() => { setStatusEdit({ id: row.id, status: row.status }); setStatusRemarks(''); }}
            className="rounded-md px-2 py-1 text-xs font-medium transition hover:opacity-80"
            style={{ backgroundColor: 'var(--accent-soft)', color: 'var(--accent)' }}
          >
            Status
          </button>
        </div>
      ),
    },
  ];

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold" style={{ color: 'var(--foreground)' }}>
            Internship
          </h1>
          <p className="text-sm" style={{ color: 'var(--foreground-muted)' }}>
            Intern lifecycle — acceptance letter, completion certificate, conversion to employee (BRD §6.2).
          </p>
        </div>
        <button
          onClick={() => setModalOpen(true)}
          className="rounded-lg px-4 py-2 text-sm font-medium text-white"
          style={{ backgroundColor: 'var(--accent)' }}
        >
          + New Internship
        </button>
      </div>
      <DataTable
        columns={columns}
        data={records}
        loading={loading}
        searchValue={search}
        onSearchChange={(v) => setSearch(v)}
        onDelete={(row) => setDeleteId(row.id)}
      />
      {modalOpen && (
        <CreateInternshipModal
          onClose={() => setModalOpen(false)}
          onSaved={() => { setModalOpen(false); fetchData(); }}
        />
      )}
      {/* Status change modal */}
      {statusEdit && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ backgroundColor: 'rgba(0,0,0,0.4)' }} onClick={() => setStatusEdit(null)}>
          <div
            className="w-full max-w-sm rounded-xl p-5 space-y-4"
            style={{ backgroundColor: 'var(--surface)', border: '1px solid var(--border)' }}
            onClick={(e) => e.stopPropagation()}
          >
            <h2 className="text-base font-semibold" style={{ color: 'var(--foreground)' }}>
              Update Status
            </h2>
            <label className="flex flex-col gap-1 text-sm font-medium">
              Status
              <SearchableSelect
                value={statusEdit.status}
                options={STATUS_OPTIONS.map((s) => ({ label: s, value: s }))}
                onChange={(v) => setStatusEdit({ ...statusEdit, status: String(v) })}
                placeholder="Select status"
              />
            </label>
            <label className="flex flex-col gap-1 text-sm font-medium">
              Remarks
              <textarea
                className="rounded-lg border px-3 py-2 text-sm"
                style={{ borderColor: 'var(--border)', backgroundColor: 'var(--surface)', color: 'var(--foreground)' }}
                rows={2}
                value={statusRemarks}
                onChange={(e) => setStatusRemarks(e.target.value)}
              />
            </label>
            <div className="flex justify-end gap-2">
              <button type="button" onClick={() => setStatusEdit(null)} className="rounded-lg border px-4 py-2 text-sm" style={{ borderColor: 'var(--border)' }}>
                Cancel
              </button>
              <button
                type="button"
                disabled={!statusEdit.status}
                className="rounded-lg px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
                style={{ backgroundColor: 'var(--accent)' }}
                onClick={async () => {
                  await fetch(`/api/recruitment/internships/${statusEdit.id}`, {
                    method: 'PATCH',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ status: statusEdit.status, remarks: statusRemarks }),
                  });
                  setStatusEdit(null);
                  fetchData();
                }}
              >
                Update
              </button>
            </div>
          </div>
        </div>
      )}
      <ConfirmDialog
        title="Delete Internship"
        message="Remove this internship record? This cannot be undone."
        isOpen={deleteId !== null}
        onConfirm={async () => {
          if (!deleteId) return;
          await fetch(`/api/recruitment/internships/${deleteId}`, { method: 'DELETE' });
          fetchData();
        }}
        onClose={() => setDeleteId(null)}
      />
    </div>
  );
}

function CreateInternshipModal({ onClose, onSaved }: { onClose: () => void; onSaved: () => void }) {
  const [candidateId, setCandidateId] = useState<string | number | ''>('');
  const [college, setCollege] = useState('');
  const [regNo, setRegNo] = useState('');
  const [course, setCourse] = useState('');
  const [departmentId, setDepartmentId] = useState<string | number | ''>('');
  const [mentorId, setMentorId] = useState<string | number | ''>('');
  const [trainingStart, setTrainingStart] = useState('');
  const [trainingEnd, setTrainingEnd] = useState('');
  const [stipend, setStipend] = useState('');
  const [policyId, setPolicyId] = useState<string | number | ''>('');
  const [submitting, setSubmitting] = useState(false);
  const toast = useToast();

  const [candidates, setCandidates] = useState<CandidateOption[]>([]);
  const [employees, setEmployees] = useState<EmployeeOption[]>([]);
  const [departments, setDepartments] = useState<DepartmentOption[]>([]);
  const [policies, setPolicies] = useState<PolicyOption[]>([]);

  useEffect(() => {
    Promise.all([
      fetch('/api/recruitment/candidates?limit=100').then((r) => r.json()).then((j) => setCandidates(j.data ?? [])),
      fetch('/api/employees?limit=100').then((r) => r.json()).then((j) => setEmployees(j.data ?? [])),
      fetch('/api/org-options?table=Department').then((r) => r.json()).then((j) => setDepartments(j.data ?? [])),
      fetch('/api/masters/internship-policies?limit=50').then((r) => r.json()).then((j) => setPolicies(j.data ?? [])),
    ]);
  }, []);

  const submit = async () => {
    if (!candidateId) { toast.error('Candidate is required'); return; }
    if (!trainingStart || !trainingEnd) { toast.error('Training start and end dates are required'); return; }
    if (new Date(trainingEnd) <= new Date(trainingStart)) { toast.error('End date must be after start date'); return; }
    setSubmitting(true);
    try {
      const res = await fetch('/api/recruitment/internships', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          candidateId: Number(candidateId),
          college: college || undefined,
          regNo: regNo || undefined,
          course: course || undefined,
          departmentId: departmentId ? Number(departmentId) : undefined,
          mentorId: mentorId ? Number(mentorId) : undefined,
          trainingStart,
          trainingEnd,
          stipend: stipend ? Number(stipend) : undefined,
          policyId: policyId ? Number(policyId) : undefined,
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? 'Save failed');
      onSaved();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Save failed');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ backgroundColor: 'rgba(0,0,0,0.4)' }} onClick={onClose}>
      <div
        className="w-full max-w-lg max-h-[90vh] overflow-y-auto rounded-xl p-5 space-y-4"
        style={{ backgroundColor: 'var(--surface)', border: '1px solid var(--border)' }}
        onClick={(e) => e.stopPropagation()}
      >
        <h2 className="text-base font-semibold" style={{ color: 'var(--foreground)' }}>
          New Internship
        </h2>

        <label className="flex flex-col gap-1 text-sm font-medium">
          Candidate *
          <SearchableSelect
            value={candidateId}
            options={candidates.map((c) => ({ label: `${c.applicationNo} — ${c.firstName} ${c.lastName}`, value: c.id }))}
            onChange={setCandidateId}
            placeholder="Select candidate"
          />
        </label>

        <div className="grid grid-cols-2 gap-3">
          <label className="flex flex-col gap-1 text-sm font-medium">
            College
            <input className="rounded-lg border px-3 py-2 text-sm" style={{ borderColor: 'var(--border)', backgroundColor: 'var(--surface)', color: 'var(--foreground)' }} value={college} onChange={(e) => setCollege(e.target.value)} />
          </label>
          <label className="flex flex-col gap-1 text-sm font-medium">
            Reg No
            <input className="rounded-lg border px-3 py-2 text-sm" style={{ borderColor: 'var(--border)', backgroundColor: 'var(--surface)', color: 'var(--foreground)' }} value={regNo} onChange={(e) => setRegNo(e.target.value)} />
          </label>
        </div>

        <label className="flex flex-col gap-1 text-sm font-medium">
          Course
          <input className="rounded-lg border px-3 py-2 text-sm" style={{ borderColor: 'var(--border)', backgroundColor: 'var(--surface)', color: 'var(--foreground)' }} value={course} onChange={(e) => setCourse(e.target.value)} />
        </label>

        <div className="grid grid-cols-2 gap-3">
          <label className="flex flex-col gap-1 text-sm font-medium">
            Department
            <SearchableSelect
              value={departmentId}
              options={[{ label: 'None', value: '' }, ...departments.map((d) => ({ label: d.name, value: d.id }))]}
              onChange={setDepartmentId}
              placeholder="Select department"
            />
          </label>
          <label className="flex flex-col gap-1 text-sm font-medium">
            Mentor
            <SearchableSelect
              value={mentorId}
              options={[{ label: 'None', value: '' }, ...employees.map((e) => ({ label: `${e.firstName} ${e.lastName} (${e.employeeCode})`, value: e.id }))]}
              onChange={setMentorId}
              placeholder="Select mentor"
            />
          </label>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <label className="flex flex-col gap-1 text-sm font-medium">
            Training Start *
            <input type="date" className="rounded-lg border px-3 py-2 text-sm" style={{ borderColor: 'var(--border)', backgroundColor: 'var(--surface)', color: 'var(--foreground)' }} value={trainingStart} onChange={(e) => setTrainingStart(e.target.value)} />
          </label>
          <label className="flex flex-col gap-1 text-sm font-medium">
            Training End *
            <input type="date" className="rounded-lg border px-3 py-2 text-sm" style={{ borderColor: 'var(--border)', backgroundColor: 'var(--surface)', color: 'var(--foreground)' }} value={trainingEnd} onChange={(e) => setTrainingEnd(e.target.value)} />
          </label>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <label className="flex flex-col gap-1 text-sm font-medium">
            Stipend (₹)
            <input type="number" className="rounded-lg border px-3 py-2 text-sm" style={{ borderColor: 'var(--border)', backgroundColor: 'var(--surface)', color: 'var(--foreground)' }} value={stipend} onChange={(e) => setStipend(e.target.value)} />
          </label>
          <label className="flex flex-col gap-1 text-sm font-medium">
            Policy
            <SearchableSelect
              value={policyId}
              options={[{ label: 'None', value: '' }, ...policies.map((p) => ({ label: p.policyName, value: p.id }))]}
              onChange={setPolicyId}
              placeholder="Select policy"
            />
          </label>
        </div>

        <div className="flex justify-end gap-2">
          <button type="button" onClick={onClose} className="rounded-lg border px-4 py-2 text-sm" style={{ borderColor: 'var(--border)' }}>
            Cancel
          </button>
          <button type="button" onClick={submit} disabled={submitting} className="rounded-lg px-4 py-2 text-sm font-medium text-white disabled:opacity-50" style={{ backgroundColor: 'var(--accent)' }}>
            {submitting ? 'Saving...' : 'Create'}
          </button>
        </div>
      </div>
    </div>
  );
}
