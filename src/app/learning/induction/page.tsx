'use client';

import { useState, useEffect } from 'react';
import { DataTable, FormModal, ConfirmDialog, KPICard, KPIGrid } from '@/components/ui';
import type { Column, FieldDef } from '@/components/ui';

interface Program {
  id: number;
  name: string;
  departmentId: number | null;
  designationId: number | null;
  durationDays: number | null;
  description: string | null;
  isActive: boolean;
}

interface Assignment {
  id: number;
  inductionProgramId: number;
  employeeId: number;
  assignedDate: string;
  targetDate: string | null;
  completedDate: string | null;
  status: string;
  program?: { name: string; durationDays: number | null };
}

interface Employee { id: number; firstName: string; lastName: string | null; employeeCode: string }
interface Department { id: number; name: string }
interface Designation { id: number; name: string }

export default function InductionPage() {
  const [programs, setPrograms] = useState<Program[]>([]);
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [designations, setDesignations] = useState<Designation[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [refresh, setRefresh] = useState(0);

  const [progModal, setProgModal] = useState(false);
  const [editProgId, setEditProgId] = useState<number | null>(null);
  const [progValues, setProgValues] = useState<Record<string, string | number | boolean | undefined>>({});
  const [deleteProgId, setDeleteProgId] = useState<number | null>(null);

  const [assignModal, setAssignModal] = useState(false);
  const [assignValues, setAssignValues] = useState<Record<string, string | number | boolean | undefined>>({});

  const empLabel = (e: Employee) => `${e.firstName} ${e.lastName ?? ''} (${e.employeeCode})`.trim();
  const empName = (id: number) => { const e = employees.find((x) => x.id === id); return e ? empLabel(e) : `#${id}`; };
  const deptName = (id: number | null) => departments.find((d) => d.id === id)?.name ?? 'All';
  const desigName = (id: number | null) => designations.find((d) => d.id === id)?.name ?? 'All';

  useEffect(() => {
    let mounted = true;
    const load = async () => {
      setLoading(true);
      setError(null);
      try {
        const [pRes, aRes, eRes, dRes, gRes] = await Promise.all([
          fetch('/api/induction-programs'),
          fetch('/api/induction-assignments'),
          fetch('/api/employees?limit=500'),
          fetch('/api/masters/departments?limit=200'),
          fetch('/api/masters/designations?limit=200'),
        ]);
        const [pJson, aJson, eJson, dJson, gJson] = await Promise.all([pRes.json(), aRes.json(), eRes.json(), dRes.json(), gRes.json()]);
        if (!mounted) return;
        setPrograms(Array.isArray(pJson) ? pJson : pJson.data ?? []);
        setAssignments(Array.isArray(aJson) ? aJson : aJson.data ?? []);
        setEmployees(Array.isArray(eJson) ? eJson : eJson.data ?? []);
        setDepartments(Array.isArray(dJson) ? dJson : dJson.data ?? []);
        setDesignations(Array.isArray(gJson) ? gJson : gJson.data ?? []);
      } catch (err) {
        if (mounted) setError(err instanceof Error ? err.message : 'Failed to load');
      } finally {
        if (mounted) setLoading(false);
      }
    };
    void load();
    return () => { mounted = false; };
  }, [refresh]);

  const progFields: FieldDef[] = [
    { name: 'name', label: 'Program Name', type: 'text', required: true },
    { name: 'departmentId', label: 'Department (blank = all)', type: 'select', options: departments.map((d) => ({ label: d.name, value: d.id })) },
    { name: 'designationId', label: 'Designation (blank = all)', type: 'select', options: designations.map((d) => ({ label: d.name, value: d.id })) },
    { name: 'durationDays', label: 'Duration (days)', type: 'number' },
    { name: 'description', label: 'Description', type: 'textarea' },
  ];

  const assignFields: FieldDef[] = [
    { name: 'inductionProgramId', label: 'Induction Program', type: 'select', required: true, options: programs.map((p) => ({ label: p.name, value: p.id })) },
    { name: 'employeeId', label: 'New Joinee', type: 'select', required: true, options: employees.map((e) => ({ label: empLabel(e), value: e.id })) },
    { name: 'targetDate', label: 'Target Completion Date', type: 'date' },
  ];

  const submitProgram = async (values: Record<string, string | number | boolean>) => {
    const url = editProgId ? `/api/induction-programs/${editProgId}` : '/api/induction-programs';
    const res = await fetch(url, {
      method: editProgId ? 'PUT' : 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(values),
    });
    if (!res.ok) throw new Error((await res.json()).error ?? 'Save failed');
    setRefresh((n) => n + 1);
  };

  const submitAssignment = async (values: Record<string, string | number | boolean>) => {
    const res = await fetch('/api/induction-assignments', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(values),
    });
    if (!res.ok) throw new Error((await res.json()).error ?? 'Assign failed');
    setRefresh((n) => n + 1);
  };

  const assignmentAction = async (id: number, action: 'COMPLETE' | 'CANCEL') => {
    const res = await fetch(`/api/induction-assignments/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action }),
    });
    if (!res.ok) {
      setError((await res.json()).error ?? 'Action failed');
      return;
    }
    setRefresh((n) => n + 1);
  };

  const progColumns: Column<Program>[] = [
    { key: 'name', label: 'Program', sortable: true },
    { key: 'departmentId', label: 'Department', render: (r) => deptName(r.departmentId) },
    { key: 'designationId', label: 'Designation', render: (r) => desigName(r.designationId) },
    { key: 'durationDays', label: 'Days', render: (r) => r.durationDays ?? '—' },
    { key: 'assigned', label: 'Assigned', render: (r) => assignments.filter((a) => a.inductionProgramId === r.id).length },
  ];

  const assignColumns: Column<Assignment>[] = [
    { key: 'employeeId', label: 'Employee', render: (r) => empName(r.employeeId) },
    { key: 'program', label: 'Program', render: (r) => r.program?.name ?? programs.find((p) => p.id === r.inductionProgramId)?.name ?? '—' },
    { key: 'assignedDate', label: 'Assigned', render: (r) => r.assignedDate?.slice(0, 10) ?? '—' },
    { key: 'targetDate', label: 'Target', render: (r) => r.targetDate?.slice(0, 10) ?? '—' },
    { key: 'status', label: 'Status' },
    {
      key: 'actions', label: 'Actions',
      render: (r) => r.status === 'PENDING' || r.status === 'IN_PROGRESS' ? (
        <div className="flex gap-2">
          <button onClick={() => assignmentAction(r.id, 'COMPLETE')} className="text-xs font-medium" style={{ color: '#15803d' }}>Complete</button>
          <button onClick={() => assignmentAction(r.id, 'CANCEL')} className="text-xs font-medium" style={{ color: '#dc2626' }}>Cancel</button>
        </div>
      ) : '—',
    },
  ];

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold" style={{ color: 'var(--foreground)' }}>Induction Programs</h1>
        <div className="flex gap-2">
          <button onClick={() => { setEditProgId(null); setProgValues({}); setProgModal(true); }}
            className="rounded-lg border px-4 py-2 text-sm font-medium transition hover:opacity-80"
            style={{ borderColor: 'var(--border)', color: 'var(--foreground)' }}>
            + Program
          </button>
          <button onClick={() => { setAssignValues({}); setAssignModal(true); }}
            className="rounded-lg px-4 py-2 text-sm font-medium text-white transition hover:opacity-90"
            style={{ backgroundColor: 'var(--accent)' }}>
            + Assign Joinee
          </button>
        </div>
      </div>

      <KPIGrid columns={4}>
        <KPICard label="Programs" value={programs.length} tone="info" />
        <KPICard label="Pending" value={assignments.filter((a) => a.status === 'PENDING').length} tone="warning" />
        <KPICard label="In Progress" value={assignments.filter((a) => a.status === 'IN_PROGRESS').length} tone="info" />
        <KPICard label="Completed" value={assignments.filter((a) => a.status === 'COMPLETED').length} tone="success" />
      </KPIGrid>

      {error && <div className="rounded-lg px-3 py-2 text-sm" style={{ backgroundColor: '#fef2f2', color: '#dc2626', border: '1px solid #fecaca' }}>{error}</div>}

      <section>
        <h2 className="mb-2 text-sm font-medium" style={{ color: 'var(--foreground-muted)' }}>Programs</h2>
        <DataTable columns={progColumns} data={programs} loading={loading}
          onEdit={(r) => {
            setEditProgId(r.id);
            setProgValues({ name: r.name, departmentId: r.departmentId ?? undefined, designationId: r.designationId ?? undefined, durationDays: r.durationDays ?? undefined, description: r.description ?? '' });
            setProgModal(true);
          }}
          onDelete={(r) => setDeleteProgId(r.id)} />
      </section>

      <section>
        <h2 className="mb-2 text-sm font-medium" style={{ color: 'var(--foreground-muted)' }}>Assignments</h2>
        <DataTable columns={assignColumns} data={assignments} loading={loading} />
      </section>

      <FormModal title={editProgId ? 'Edit Program' : 'Add Induction Program'} fields={progFields} initialValues={progValues}
        isOpen={progModal} onClose={() => setProgModal(false)} onSubmit={submitProgram}
        submitLabel={editProgId ? 'Update' : 'Create'} />

      <FormModal title="Assign Induction" fields={assignFields} initialValues={assignValues}
        isOpen={assignModal} onClose={() => setAssignModal(false)} onSubmit={submitAssignment} submitLabel="Assign" />

      <ConfirmDialog title="Delete Program" message="Delete this induction program? Existing assignments are kept."
        isOpen={deleteProgId !== null}
        onConfirm={async () => {
          if (!deleteProgId) return;
          const res = await fetch(`/api/induction-programs/${deleteProgId}`, { method: 'DELETE' });
          if (!res.ok) setError((await res.json()).error ?? 'Delete failed');
          setRefresh((n) => n + 1);
        }}
        onClose={() => setDeleteProgId(null)} />
    </div>
  );
}
