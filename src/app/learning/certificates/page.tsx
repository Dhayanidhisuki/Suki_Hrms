'use client';

import { useState, useEffect } from 'react';
import { DataTable, FormModal, ConfirmDialog, KPICard, KPIGrid } from '@/components/ui';
import type { Column, FieldDef } from '@/components/ui';

interface Certificate {
  id: number;
  employeeId: number;
  trainingScheduleId: number | null;
  trainingProgramId: number | null;
  certificateNumber: string;
  issueDate: string | null;
  expiryDate: string | null;
  filePath: string | null;
  daysToExpiry: number | null;
}

interface Employee { id: number; firstName: string; lastName: string | null; employeeCode: string }
interface Program { id: number; name: string }
interface Schedule { id: number; title: string | null; scheduledDate: string | null; trainingProgram?: { name: string } | null }

export default function CertificatesPage() {
  const [records, setRecords] = useState<Certificate[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [programs, setPrograms] = useState<Program[]>([]);
  const [schedules, setSchedules] = useState<Schedule[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [refresh, setRefresh] = useState(0);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [initialValues, setInitialValues] = useState<Record<string, string | number | boolean | undefined>>({});
  const [deleteId, setDeleteId] = useState<number | null>(null);

  const empLabel = (e: Employee) => `${e.firstName} ${e.lastName ?? ''} (${e.employeeCode})`.trim();
  const empName = (id: number) => { const e = employees.find((x) => x.id === id); return e ? empLabel(e) : `#${id}`; };
  const programName = (id: number | null) => programs.find((p) => p.id === id)?.name ?? '—';
  const schedName = (id: number | null) => {
    const s = schedules.find((x) => x.id === id);
    return s ? `${s.trainingProgram?.name ?? s.title ?? `#${s.id}`} (${s.scheduledDate ? s.scheduledDate.slice(0, 10) : '—'})` : '—';
  };

  useEffect(() => {
    let mounted = true;
    const load = async () => {
      setLoading(true);
      setError(null);
      try {
        const [cRes, empRes, pRes, sRes] = await Promise.all([
          fetch('/api/training-certificates'),
          fetch('/api/employees?limit=500'),
          fetch('/api/training-programs'),
          fetch('/api/training-schedules?limit=200'),
        ]);
        const [cJson, empJson, pJson, sJson] = await Promise.all([cRes.json(), empRes.json(), pRes.json(), sRes.json()]);
        if (!mounted) return;
        const now = Date.now();
        const list: Certificate[] = Array.isArray(cJson) ? cJson : cJson.data ?? [];
        setRecords(list.map((r) => ({
          ...r,
          daysToExpiry: r.expiryDate ? Math.floor((new Date(r.expiryDate).getTime() - now) / 86400000) : null,
        })));
        setEmployees(Array.isArray(empJson) ? empJson : empJson.data ?? []);
        setPrograms(Array.isArray(pJson) ? pJson : pJson.data ?? []);
        setSchedules(Array.isArray(sJson) ? sJson : sJson.data ?? []);
      } catch (err) {
        if (mounted) setError(err instanceof Error ? err.message : 'Failed to load');
      } finally {
        if (mounted) setLoading(false);
      }
    };
    void load();
    return () => { mounted = false; };
  }, [refresh]);

  const fields: FieldDef[] = [
    { name: 'employeeId', label: 'Employee', type: 'select', required: true, options: employees.map((e) => ({ label: empLabel(e), value: e.id })) },
    {
      name: 'trainingProgramId', label: 'Training Program', type: 'select',
      options: programs.map((p) => ({ label: p.name, value: p.id })),
    },
    {
      name: 'trainingScheduleId', label: 'Training Schedule', type: 'select',
      options: schedules.map((s) => ({
        label: `${s.trainingProgram?.name ?? s.title ?? `Schedule #${s.id}`} — ${s.scheduledDate ? s.scheduledDate.slice(0, 10) : 'unscheduled'}`,
        value: s.id,
      })),
    },
    { name: 'certificateNumber', label: 'Certificate No.', type: 'text', helpText: 'Leave blank to auto-generate (CERT####).' },
    { name: 'issueDate', label: 'Issue Date', type: 'date' },
    { name: 'expiryDate', label: 'Expiry Date', type: 'date' },
    { name: 'filePath', label: 'Certificate File Path / URL', type: 'text' },
  ];

  const handleSubmit = async (values: Record<string, string | number | boolean>) => {
    const url = editingId ? `/api/training-certificates/${editingId}` : '/api/training-certificates';
    const res = await fetch(url, {
      method: editingId ? 'PUT' : 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(values),
    });
    if (!res.ok) throw new Error((await res.json()).error ?? 'Save failed');
    setRefresh((n) => n + 1);
  };

  const handleDelete = async (id: number) => {
    const res = await fetch(`/api/training-certificates/${id}`, { method: 'DELETE' });
    if (!res.ok) {
      setError((await res.json()).error ?? 'Delete failed');
      return;
    }
    setRefresh((n) => n + 1);
  };

  const expiringSoon = records.filter((r) => r.daysToExpiry != null && r.daysToExpiry >= 0 && r.daysToExpiry <= 30);

  const columns: Column<Certificate>[] = [
    { key: 'certificateNumber', label: 'Cert No.', sortable: true },
    { key: 'employeeId', label: 'Employee', render: (r) => empName(r.employeeId) },
    { key: 'trainingProgramId', label: 'Program', render: (r) => programName(r.trainingProgramId) },
    { key: 'trainingScheduleId', label: 'Schedule', render: (r) => schedName(r.trainingScheduleId) },
    { key: 'issueDate', label: 'Issued', render: (r) => (r.issueDate ? r.issueDate.slice(0, 10) : '—') },
    {
      key: 'expiryDate', label: 'Expiry',
      render: (r) => {
        if (!r.expiryDate) return '—';
        const overdue = r.daysToExpiry != null && r.daysToExpiry < 0;
        const soon = r.daysToExpiry != null && r.daysToExpiry <= 30;
        return (
          <span style={{ color: overdue ? '#dc2626' : soon ? '#d97706' : 'var(--foreground)' }}>
            {r.expiryDate.slice(0, 10)}{overdue ? ' (expired)' : soon ? ' (soon)' : ''}
          </span>
        );
      },
    },
    { key: 'filePath', label: 'File', render: (r) => (r.filePath ? 'Attached' : '—') },
  ];

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold" style={{ color: 'var(--foreground)' }}>Training Certificates</h1>
        <button
          onClick={() => { setEditingId(null); setInitialValues({}); setModalOpen(true); }}
          className="rounded-lg px-4 py-2 text-sm font-medium text-white transition hover:opacity-90"
          style={{ backgroundColor: 'var(--accent)' }}
        >
          + Issue Certificate
        </button>
      </div>

      <KPIGrid columns={3}>
        <KPICard label="Certificates Issued" value={records.length} tone="info" />
        <KPICard label="Expiring ≤ 30 days" value={expiringSoon.length} tone="warning" />
        <KPICard label="Expired" value={records.filter((r) => r.daysToExpiry != null && r.daysToExpiry < 0).length} tone="danger" />
      </KPIGrid>

      {error && <div className="rounded-lg px-3 py-2 text-sm" style={{ backgroundColor: '#fef2f2', color: '#dc2626', border: '1px solid #fecaca' }}>{error}</div>}

      <DataTable
        columns={columns}
        data={records}
        loading={loading}
        onEdit={(r) => {
          setEditingId(r.id);
          setInitialValues({
            employeeId: r.employeeId,
            trainingProgramId: r.trainingProgramId ?? undefined,
            trainingScheduleId: r.trainingScheduleId ?? undefined,
            certificateNumber: r.certificateNumber,
            issueDate: r.issueDate ? r.issueDate.slice(0, 10) : '',
            expiryDate: r.expiryDate ? r.expiryDate.slice(0, 10) : '',
            filePath: r.filePath ?? '',
          });
          setModalOpen(true);
        }}
        onDelete={(r) => setDeleteId(r.id)}
      />

      <FormModal title={editingId ? 'Edit Certificate' : 'Issue Certificate'} fields={fields} initialValues={initialValues}
        isOpen={modalOpen} onClose={() => setModalOpen(false)} onSubmit={handleSubmit}
        submitLabel={editingId ? 'Update' : 'Issue'} />

      <ConfirmDialog title="Delete Certificate" message="Delete this certificate record?"
        isOpen={deleteId !== null} onConfirm={() => deleteId && handleDelete(deleteId)} onClose={() => setDeleteId(null)} />
    </div>
  );
}
