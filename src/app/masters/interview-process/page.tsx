/**
 * Interview Process Master — custom page with child level management.
 * BRD §13 — central 6-step stepper config (dept+designation → process).
 */

'use client';

import { useCallback, useEffect, useState } from 'react';
import { ConfirmDialog, DataTable, useToast, type Column } from '@/components/ui';

interface OrgOption { id: number; name: string; code: string; }
interface InterviewTypeOpt { id: number; typeCode: string; typeName: string; }
interface InterviewLevelOpt { id: number; levelCode: string; levelName: string; }

interface ProcessLevel {
  id?: number;
  interviewLevelId: number;
  interviewTypeId: number;
  sequence: number;
  mandatory: boolean;
  passScore?: number | null;
  interviewLevel?: InterviewLevelOpt;
  interviewType?: InterviewTypeOpt;
}

interface ProcessRow {
  id: number;
  processName: string;
  departmentId: number;
  designationId: number;
  employmentType: string | null;
  status: string;
  isActive: boolean;
  deletedAt: string | null;
  createdAt: string;
  updatedAt: string;
  department?: OrgOption;
  designation?: OrgOption;
  levels?: ProcessLevel[];
}

interface ApiResponse {
  data: ProcessRow[];
  pagination: { page: number; limit: number; total: number; totalPages: number };
}

const inputClass = 'w-full rounded-lg border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--accent)]';
const inputStyle = { backgroundColor: 'var(--surface)', color: 'var(--foreground)', borderColor: 'var(--border)' } as const;

export default function InterviewProcessPage() {
  const toast = useToast();
  const [records, setRecords] = useState<ProcessRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [pagination, setPagination] = useState({ page: 1, limit: 20, total: 0, totalPages: 0 });
  const [departments, setDepartments] = useState<OrgOption[]>([]);
  const [designations, setDesignations] = useState<OrgOption[]>([]);
  const [interviewTypes, setInterviewTypes] = useState<InterviewTypeOpt[]>([]);
  const [interviewLevels, setInterviewLevels] = useState<InterviewLevelOpt[]>([]);
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<ProcessRow | null>(null);
  const [deleteId, setDeleteId] = useState<number | null>(null);

  // form state
  const [processName, setProcessName] = useState('');
  const [departmentId, setDepartmentId] = useState('');
  const [designationId, setDesignationId] = useState('');
  const [employmentType, setEmploymentType] = useState('');
  const [levels, setLevels] = useState<ProcessLevel[]>([]);

  useEffect(() => {
    Promise.all([
      fetch('/api/org-options?table=Department').then((r) => r.json()),
      fetch('/api/org-options?table=Designation').then((r) => r.json()),
      fetch('/api/masters/interview-types?limit=100').then((r) => r.json()),
      fetch('/api/masters/interview-levels?limit=100').then((r) => r.json()),
    ]).then(([depts, desigs, types, levs]) => {
      setDepartments(Array.isArray(depts) ? depts : []);
      setDesignations(Array.isArray(desigs) ? desigs : []);
      setInterviewTypes(types?.data ?? []);
      setInterviewLevels(levs?.data ?? []);
    });
  }, []);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ page: String(page), limit: '20', ...(search ? { search } : {}) });
      const res = await fetch(`/api/masters/interview-processes?${params}`);
      const json: ApiResponse = await res.json();
      setRecords(json.data ?? []);
      setPagination(json.pagination ?? { page: 1, limit: 20, total: 0, totalPages: 0 });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed to fetch');
    } finally {
      setLoading(false);
    }
  }, [page, search, toast]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const openAdd = () => {
    setEditing(null);
    setProcessName('');
    setDepartmentId('');
    setDesignationId('');
    setEmploymentType('');
    setLevels([]);
    setFormOpen(true);
  };

  const openEdit = (row: ProcessRow) => {
    setEditing(row);
    setProcessName(row.processName);
    setDepartmentId(String(row.departmentId));
    setDesignationId(String(row.designationId));
    setEmploymentType(row.employmentType ?? '');
    setLevels(row.levels ?? []);
    setFormOpen(true);
  };

  const addLevel = () => {
    setLevels([...levels, { interviewLevelId: 0, interviewTypeId: 0, sequence: levels.length + 1, mandatory: true, passScore: null }]);
  };

  const updateLevel = (idx: number, field: keyof ProcessLevel, value: any) => {
    const next = [...levels];
    (next[idx] as any)[field] = value;
    setLevels(next);
  };

  const removeLevel = (idx: number) => {
    setLevels(levels.filter((_, i) => i !== idx));
  };

  const submit = async () => {
    if (!processName.trim() || !departmentId || !designationId) {
      toast.error('Process name, department, and designation are required');
      return;
    }
    const payload = {
      processName: processName.trim(),
      departmentId: Number(departmentId),
      designationId: Number(designationId),
      employmentType: employmentType || null,
      levels: levels.filter((l) => l.interviewLevelId && l.interviewTypeId),
    };
    const url = editing ? `/api/masters/interview-processes/${editing.id}` : '/api/masters/interview-processes';
    const method = editing ? 'PUT' : 'POST';
    const res = await fetch(url, { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
    if (!res.ok) {
      const err = await res.json();
      toast.error(err.error ?? 'Save failed');
      return;
    }
    setFormOpen(false);
    fetchData();
  };

  const handleDelete = async (id: number) => {
    const res = await fetch(`/api/masters/interview-processes/${id}`, { method: 'DELETE' });
    if (!res.ok) { toast.error('Delete failed'); return; }
    fetchData();
  };

  const columns: Column<ProcessRow>[] = [
    { key: 'processName', label: 'Process Name', className: 'font-medium' },
    { key: 'department', label: 'Department', render: (row) => row.department?.name ?? '—' },
    { key: 'designation', label: 'Designation', render: (row) => row.designation?.name ?? '—' },
    { key: 'employmentType', label: 'Emp Type', render: (row) => row.employmentType ?? '—' },
    { key: 'levels', label: 'Levels', render: (row) => row.levels?.length ?? 0 },
    { key: 'status', label: 'Status', render: (row) => (
      <span className="px-2 py-0.5 text-xs font-medium rounded-full" style={{ backgroundColor: row.isActive ? '#dcfce7' : '#fee2e2', color: row.isActive ? '#166534' : '#991b1b' }}>
        {row.status}
      </span>
    )},
  ];

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold" style={{ color: 'var(--foreground)' }}>Interview Process</h1>
        <button onClick={openAdd} className="rounded-lg px-4 py-2 text-sm font-medium text-white" style={{ backgroundColor: 'var(--accent)' }}>
          + Add Process
        </button>
      </div>

      <DataTable
        columns={columns}
        data={records}
        pagination={pagination}
        loading={loading}
        searchValue={search}
        onSearchChange={(v) => { setSearch(v); setPage(1); }}
        onPageChange={setPage}
        onEdit={openEdit}
        onDelete={(row) => setDeleteId(row.id)}
      />

      {formOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ backgroundColor: 'rgba(0,0,0,0.4)' }} onClick={() => setFormOpen(false)}>
          <div className="w-full max-w-2xl rounded-xl shadow-2xl max-h-[90vh] overflow-y-auto" style={{ backgroundColor: 'var(--surface)', border: '1px solid var(--border)' }} onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between px-5 py-4 border-b" style={{ borderColor: 'var(--border)' }}>
              <h2 className="text-base font-semibold" style={{ color: 'var(--foreground)' }}>{editing ? 'Edit Process' : 'Add Process'}</h2>
              <button onClick={() => setFormOpen(false)} className="text-lg" style={{ color: 'var(--foreground-muted)' }}>×</button>
            </div>
            <div className="space-y-4 p-5">
              <div>
                <label className="block text-sm font-medium mb-1" style={{ color: 'var(--foreground)' }}>Process Name *</label>
                <input className={inputClass} style={inputStyle} value={processName} onChange={(e) => setProcessName(e.target.value)} placeholder="e.g. Senior Developer Hiring Process" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium mb-1" style={{ color: 'var(--foreground)' }}>Department *</label>
                  <select className={inputClass} style={inputStyle} value={departmentId} onChange={(e) => { setDesignationId(''); setDepartmentId(e.target.value); }}>
                    <option value="">Select...</option>
                    {departments.map((d) => <option key={d.id} value={d.id}>{d.code} — {d.name}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1" style={{ color: 'var(--foreground)' }}>Designation *</label>
                  <select className={inputClass} style={inputStyle} value={designationId} onChange={(e) => setDesignationId(e.target.value)}>
                    <option value="">Select...</option>
                    {designations.map((d) => <option key={d.id} value={d.id}>{d.code} — {d.name}</option>)}
                  </select>
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium mb-1" style={{ color: 'var(--foreground)' }}>Employment Type</label>
                <input className={inputClass} style={inputStyle} value={employmentType} onChange={(e) => setEmploymentType(e.target.value)} placeholder="e.g. Full-time, Contract" />
              </div>

              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="text-sm font-medium" style={{ color: 'var(--foreground)' }}>Interview Levels</label>
                  <button onClick={addLevel} className="text-xs font-medium px-2 py-1 rounded" style={{ backgroundColor: 'var(--accent)', color: 'white' }}>+ Add Level</button>
                </div>
                {levels.length === 0 && <p className="text-xs" style={{ color: 'var(--foreground-muted)' }}>No levels added yet.</p>}
                {levels.map((lvl, idx) => (
                  <div key={idx} className="grid grid-cols-5 gap-2 mb-2 items-end">
                    <div>
                      <label className="block text-xs mb-1" style={{ color: 'var(--foreground-muted)' }}>Level</label>
                      <select className={inputClass} style={inputStyle} value={lvl.interviewLevelId} onChange={(e) => updateLevel(idx, 'interviewLevelId', Number(e.target.value))}>
                        <option value={0}>Select...</option>
                        {interviewLevels.map((l) => <option key={l.id} value={l.id}>{l.levelName}</option>)}
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs mb-1" style={{ color: 'var(--foreground-muted)' }}>Type</label>
                      <select className={inputClass} style={inputStyle} value={lvl.interviewTypeId} onChange={(e) => updateLevel(idx, 'interviewTypeId', Number(e.target.value))}>
                        <option value={0}>Select...</option>
                        {interviewTypes.map((t) => <option key={t.id} value={t.id}>{t.typeName}</option>)}
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs mb-1" style={{ color: 'var(--foreground-muted)' }}>Seq</label>
                      <input type="number" className={inputClass} style={inputStyle} value={lvl.sequence} onChange={(e) => updateLevel(idx, 'sequence', Number(e.target.value))} />
                    </div>
                    <div>
                      <label className="block text-xs mb-1" style={{ color: 'var(--foreground-muted)' }}>Pass %</label>
                      <input type="number" className={inputClass} style={inputStyle} value={lvl.passScore ?? ''} onChange={(e) => updateLevel(idx, 'passScore', e.target.value ? Number(e.target.value) : null)} />
                    </div>
                    <button onClick={() => removeLevel(idx)} className="text-xs text-red-600 px-2 py-2">Remove</button>
                  </div>
                ))}
              </div>
            </div>
            <div className="flex justify-end gap-2 px-5 py-4 border-t" style={{ borderColor: 'var(--border)' }}>
              <button onClick={() => setFormOpen(false)} className="rounded-lg border px-4 py-2 text-sm" style={{ borderColor: 'var(--border)', color: 'var(--foreground)' }}>Cancel</button>
              <button onClick={submit} className="rounded-lg px-4 py-2 text-sm font-medium text-white" style={{ backgroundColor: 'var(--accent)' }}>{editing ? 'Update' : 'Create'}</button>
            </div>
          </div>
        </div>
      )}

      <ConfirmDialog
        title="Delete Process"
        message="Are you sure you want to soft-delete this interview process?"
        isOpen={deleteId !== null}
        onConfirm={() => deleteId && handleDelete(deleteId)}
        onClose={() => setDeleteId(null)}
      />
    </div>
  );
}
