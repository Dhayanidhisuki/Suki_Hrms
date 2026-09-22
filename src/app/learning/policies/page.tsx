'use client';

import { useState, useEffect } from 'react';
import { DataTable, FormModal, ConfirmDialog, KPICard, KPIGrid } from '@/components/ui';
import type { Column, FieldDef } from '@/components/ui';

interface Policy {
  id: number;
  name: string;
  minAttendancePercent: number | null;
  assessmentRequired: boolean;
  feedbackRequired: boolean;
  nominationCutoffDays: number | null;
  externalBudgetCap: string | number | null;
  mandatoryTrainingGraceDays: number | null;
  effectiveFrom: string | null;
  effectiveTo: string | null;
  remarks: string | null;
  reimbursementRules: string | null;
  cancellationRules: string | null;
  minTrainingHoursPerYear: number | null;
  employeeObligations: string | null;
  isActive: boolean;
}

const fields: FieldDef[] = [
  { name: 'name', label: 'Policy Name', type: 'text', required: true },
  { name: 'minAttendancePercent', label: 'Min Attendance % to Complete', type: 'number', min: 0, max: 100 },
  { name: 'assessmentRequired', label: 'Assessment Required', type: 'checkbox', helpText: 'Training cannot close without an assessment' },
  { name: 'feedbackRequired', label: 'Feedback Required', type: 'checkbox', helpText: 'Feedback form mandatory after training' },
  { name: 'nominationCutoffDays', label: 'Nomination Cutoff (days before)', type: 'number' },
  { name: 'externalBudgetCap', label: 'External Training Budget Cap (₹)', type: 'number', helpText: 'Costs above this require escalation' },
  { name: 'mandatoryTrainingGraceDays', label: 'Mandatory Training Grace Days', type: 'number' },
  { name: 'minTrainingHoursPerYear', label: 'Min Training Hours / Year', type: 'number', helpText: 'Minimum hours each employee must complete annually' },
  { name: 'reimbursementRules', label: 'Reimbursement Rules', type: 'textarea', helpText: 'e.g. 80% on pass, travel at actuals' },
  { name: 'cancellationRules', label: 'Cancellation Rules', type: 'textarea', helpText: 'Penalties / notice period for no-shows' },
  { name: 'employeeObligations', label: 'Employee Obligations', type: 'textarea', helpText: 'Bond / service agreement terms' },
  { name: 'effectiveFrom', label: 'Effective From', type: 'date' },
  { name: 'effectiveTo', label: 'Effective To', type: 'date' },
  { name: 'remarks', label: 'Remarks', type: 'textarea' },
];

export default function PoliciesPage() {
  const [records, setRecords] = useState<Policy[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [refresh, setRefresh] = useState(0);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [initialValues, setInitialValues] = useState<Record<string, string | number | boolean | undefined>>({});
  const [deleteId, setDeleteId] = useState<number | null>(null);

  useEffect(() => {
    let mounted = true;
    const load = async () => {
      setLoading(true);
      setError(null);
      try {
        const res = await fetch('/api/training-policies');
        if (!res.ok) throw new Error('Failed to fetch');
        const json = await res.json();
        if (mounted) setRecords(Array.isArray(json) ? json : json.data ?? []);
      } catch (err) {
        if (mounted) setError(err instanceof Error ? err.message : 'Unknown error');
      } finally {
        if (mounted) setLoading(false);
      }
    };
    void load();
    return () => { mounted = false; };
  }, [refresh]);

  const handleSubmit = async (values: Record<string, string | number | boolean>) => {
    const url = editingId ? `/api/training-policies/${editingId}` : '/api/training-policies';
    const res = await fetch(url, {
      method: editingId ? 'PUT' : 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(values),
    });
    if (!res.ok) throw new Error((await res.json()).error ?? 'Save failed');
    setRefresh((n) => n + 1);
  };

  const handleDelete = async (id: number) => {
    const res = await fetch(`/api/training-policies/${id}`, { method: 'DELETE' });
    if (!res.ok) {
      setError((await res.json()).error ?? 'Delete failed');
      return;
    }
    setRefresh((n) => n + 1);
  };

  const columns: Column<Policy>[] = [
    { key: 'name', label: 'Policy', sortable: true },
    { key: 'minAttendancePercent', label: 'Min Attendance', render: (r) => (r.minAttendancePercent != null ? `${r.minAttendancePercent}%` : '—') },
    { key: 'assessmentRequired', label: 'Assessment', render: (r) => (r.assessmentRequired ? 'Required' : 'Optional') },
    { key: 'feedbackRequired', label: 'Feedback', render: (r) => (r.feedbackRequired ? 'Required' : 'Optional') },
    { key: 'nominationCutoffDays', label: 'Nomination Cutoff', render: (r) => (r.nominationCutoffDays != null ? `${r.nominationCutoffDays}d` : '—') },
    { key: 'externalBudgetCap', label: 'Budget Cap', render: (r) => (r.externalBudgetCap != null ? `₹${Number(r.externalBudgetCap).toLocaleString('en-IN')}` : '—') },
    { key: 'effectiveFrom', label: 'Effective', render: (r) => (r.effectiveFrom ? `${r.effectiveFrom.slice(0, 10)} → ${r.effectiveTo ? r.effectiveTo.slice(0, 10) : 'open'}` : '—') },
  ];

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold" style={{ color: 'var(--foreground)' }}>Training Policies</h1>
        <button
          onClick={() => { setEditingId(null); setInitialValues({ feedbackRequired: true }); setModalOpen(true); }}
          className="rounded-lg px-4 py-2 text-sm font-medium text-white transition hover:opacity-90"
          style={{ backgroundColor: 'var(--accent)' }}
        >
          + Add Policy
        </button>
      </div>

      <KPIGrid columns={3}>
        <KPICard label="Policies" value={records.length} tone="info" />
        <KPICard label="Active" value={records.filter((r) => r.isActive).length} tone="success" />
        <KPICard label="Assessment-Mandatory" value={records.filter((r) => r.assessmentRequired).length} tone="warning" />
      </KPIGrid>

      {error && <div className="rounded-lg px-3 py-2 text-sm" style={{ backgroundColor: '#fef2f2', color: '#dc2626', border: '1px solid #fecaca' }}>{error}</div>}

      <DataTable
        columns={columns}
        data={records}
        loading={loading}
        onEdit={(r) => {
          setEditingId(r.id);
          setInitialValues({
            name: r.name,
            minAttendancePercent: r.minAttendancePercent ?? undefined,
            assessmentRequired: r.assessmentRequired,
            feedbackRequired: r.feedbackRequired,
            nominationCutoffDays: r.nominationCutoffDays ?? undefined,
            externalBudgetCap: r.externalBudgetCap != null ? Number(r.externalBudgetCap) : undefined,
            mandatoryTrainingGraceDays: r.mandatoryTrainingGraceDays ?? undefined,
            minTrainingHoursPerYear: r.minTrainingHoursPerYear ?? undefined,
            reimbursementRules: r.reimbursementRules ?? '',
            cancellationRules: r.cancellationRules ?? '',
            employeeObligations: r.employeeObligations ?? '',
            effectiveFrom: r.effectiveFrom ? r.effectiveFrom.slice(0, 10) : '',
            effectiveTo: r.effectiveTo ? r.effectiveTo.slice(0, 10) : '',
            remarks: r.remarks ?? '',
          });
          setModalOpen(true);
        }}
        onDelete={(r) => setDeleteId(r.id)}
      />

      <FormModal title={editingId ? 'Edit Policy' : 'Add Policy'} fields={fields} initialValues={initialValues}
        isOpen={modalOpen} onClose={() => setModalOpen(false)} onSubmit={handleSubmit}
        submitLabel={editingId ? 'Update' : 'Create'} />

      <ConfirmDialog title="Delete Policy" message="Delete this training policy?"
        isOpen={deleteId !== null} onConfirm={() => deleteId && handleDelete(deleteId)} onClose={() => setDeleteId(null)} />
    </div>
  );
}
