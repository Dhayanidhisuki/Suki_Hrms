'use client';

import { useState, useEffect } from 'react';
import { DataTable, FormModal, ConfirmDialog, KPICard, KPIGrid } from '@/components/ui';
import type { Column, FieldDef } from '@/components/ui';

interface TrainingNeed {
  id: number;
  employeeId: number;
  competencyId: number | null;
  trainingProgramId: number | null;
  source: string;
  reason: string | null;
  priority: string;
  status: string;
  tnaReference: string | null;
  tnaYear: number | null;
  category: string | null;
  skillId: number | null;
  currentLevelId: number | null;
  requiredLevelId: number | null;
  gapLevel: string | null;
  businessImpact: string | null;
  isMandatory: boolean;
  proposedMethod: string | null;
  proposedTrainer: string | null;
  targetDate: string | null;
  estimatedCost: number | string | null;
  managerRemarks: string | null;
  createdAt: string;
}

interface ApiResponse {
  data: TrainingNeed[];
  pagination: { page: number; limit: number; total: number; totalPages: number };
}

const fields: FieldDef[] = [
  { name: 'employeeId', label: 'Employee ID', type: 'number', required: true, placeholder: 'e.g. 101' },
  { name: 'competencyId', label: 'Competency ID', type: 'number', placeholder: 'Optional' },
  { name: 'trainingProgramId', label: 'Training Program ID', type: 'number', placeholder: 'Optional' },
  // §8: source options mirror TNA_SOURCES in @/lib/validations/learning.
  { name: 'source', label: 'Source', type: 'select', options: [
    { value: 'SKILL_GAP', label: 'Skill Gap' },
    { value: 'COMPETENCY_GAP', label: 'Competency Gap' },
    { value: 'PERFORMANCE', label: 'Performance' },
    { value: 'MANAGER_RECOMMENDATION', label: 'Manager Recommendation' },
    { value: 'EMPLOYEE_REQUEST', label: 'Employee Request' },
    { value: 'MANDATORY', label: 'Mandatory' },
    { value: 'NEW_JOINING', label: 'New Joining' },
    { value: 'PROMOTION', label: 'Promotion' },
    { value: 'TRANSFER', label: 'Transfer' },
    { value: 'BUSINESS_REQUIREMENT', label: 'Business Requirement' },
    { value: 'CAREER_DEVELOPMENT', label: 'Career Development' },
    { value: 'AUDIT_FINDING', label: 'Audit Finding' },
    { value: 'CUSTOMER_REQUIREMENT', label: 'Customer Requirement' },
    { value: 'LEGAL_REGULATORY', label: 'Legal / Regulatory' },
    { value: 'SUCCESSION_PLANNING', label: 'Succession Planning' },
    { value: 'REFRESHER', label: 'Refresher' },
    // legacy values still accepted by the API
    { value: 'EMPLOYEE', label: 'Employee (legacy)' },
    { value: 'GAP', label: 'Gap (legacy)' },
    { value: 'MANAGER', label: 'Manager (legacy)' },
    { value: 'SYSTEM', label: 'System (legacy)' },
    { value: 'OTHER', label: 'Other' },
  ], defaultValue: 'SKILL_GAP' },
  { name: 'priority', label: 'Priority', type: 'select', options: [
    { value: 'LOW', label: 'Low' },
    { value: 'MEDIUM', label: 'Medium' },
    { value: 'HIGH', label: 'High' },
  ], defaultValue: 'MEDIUM' },
  { name: 'reason', label: 'Reason', type: 'textarea', placeholder: 'Why is this training needed?' },
  // §7.2 extended TNA attributes (all optional).
  { name: 'tnaYear', label: 'TNA Year', type: 'number', placeholder: 'e.g. 2026' },
  { name: 'category', label: 'Category', type: 'text', placeholder: 'e.g. Technical' },
  { name: 'skillId', label: 'Skill ID', type: 'number', placeholder: 'Optional' },
  { name: 'currentLevelId', label: 'Current Level ID', type: 'number', placeholder: 'Proficiency now' },
  { name: 'requiredLevelId', label: 'Required Level ID', type: 'number', placeholder: 'Proficiency needed' },
  { name: 'gapLevel', label: 'Gap Level', type: 'select', options: [
    { value: 'LOW', label: 'Low' },
    { value: 'MEDIUM', label: 'Medium' },
    { value: 'HIGH', label: 'High' },
    { value: 'CRITICAL', label: 'Critical' },
  ] },
  { name: 'isMandatory', label: 'Mandatory', type: 'checkbox' },
  { name: 'businessImpact', label: 'Business Impact', type: 'textarea' },
  { name: 'proposedMethod', label: 'Proposed Method', type: 'text', placeholder: 'e.g. Classroom / Online' },
  { name: 'proposedTrainer', label: 'Proposed Trainer', type: 'text' },
  { name: 'targetDate', label: 'Target Date', type: 'date' },
  { name: 'estimatedCost', label: 'Estimated Cost', type: 'number' },
  { name: 'managerRemarks', label: 'Manager Remarks', type: 'textarea' },
];

export default function TrainingNeedsPage() {
  const [records, setRecords] = useState<TrainingNeed[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [page, setPage] = useState(1);
  const [pagination, setPagination] = useState({ page: 1, limit: 20, total: 0, totalPages: 0 });
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
        const params = new URLSearchParams({ page: String(page), limit: '20', ...(search ? { search } : {}), ...(statusFilter ? { status: statusFilter } : {}) });
        const res = await fetch(`/api/training-needs?${params}`);
        if (!res.ok) throw new Error('Failed to fetch');
        const json: ApiResponse = await res.json();
        if (!mounted) return;
        setRecords(json.data);
        setPagination(json.pagination);
      } catch (err) {
        if (!mounted) return;
        setError(err instanceof Error ? err.message : 'Unknown error');
      } finally {
        if (!mounted) return;
        setLoading(false);
      }
    };
    void load();
    return () => { mounted = false; };
  }, [page, search, statusFilter, refresh]);

  const handleAdd = () => {
    setEditingId(null);
    setInitialValues({ source: 'SKILL_GAP', priority: 'MEDIUM' });
    setModalOpen(true);
  };

  const handleEdit = (row: TrainingNeed) => {
    setEditingId(row.id);
    setInitialValues({
      employeeId: row.employeeId,
      competencyId: row.competencyId ?? '',
      trainingProgramId: row.trainingProgramId ?? '',
      source: row.source,
      priority: row.priority,
      reason: row.reason ?? '',
      tnaYear: row.tnaYear ?? '',
      category: row.category ?? '',
      skillId: row.skillId ?? '',
      currentLevelId: row.currentLevelId ?? '',
      requiredLevelId: row.requiredLevelId ?? '',
      gapLevel: row.gapLevel ?? '',
      isMandatory: row.isMandatory ?? false,
      businessImpact: row.businessImpact ?? '',
      proposedMethod: row.proposedMethod ?? '',
      proposedTrainer: row.proposedTrainer ?? '',
      targetDate: row.targetDate ? String(row.targetDate).slice(0, 10) : '',
      estimatedCost: row.estimatedCost ?? '',
      managerRemarks: row.managerRemarks ?? '',
    });
    setModalOpen(true);
  };

  const handleSubmit = async (values: Record<string, string | number | boolean>) => {
    const payload = {
      ...values,
      competencyId: values.competencyId || null,
      trainingProgramId: values.trainingProgramId || null,
      reason: values.reason || null,
    };
    const url = editingId ? `/api/training-needs/${editingId}` : '/api/training-needs';
    const method = editingId ? 'PUT' : 'POST';
    const res = await fetch(url, { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error ?? 'Save failed');
    }
    setRefresh((n) => n + 1);
  };

  const handleDelete = async (id: number) => {
    const res = await fetch(`/api/training-needs/${id}`, { method: 'DELETE' });
    if (!res.ok) {
      const err = await res.json();
      setError(err.error ?? 'Delete failed');
      return;
    }
    setRefresh((n) => n + 1);
  };

  const handleApprove = async (id: number, action: 'APPROVE' | 'REJECT' | 'RETURN' | 'RESUBMIT') => {
    const res = await fetch(`/api/training-needs/${id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action }) });
    if (!res.ok) {
      const err = await res.json();
      setError(err.error ?? 'Action failed');
      return;
    }
    setRefresh((n) => n + 1);
  };

  const columns: Column<TrainingNeed>[] = [
    { key: 'employeeId', label: 'Employee', sortable: true },
    { key: 'source', label: 'Source' },
    { key: 'priority', label: 'Priority' },
    { key: 'reason', label: 'Reason', render: (row) => row.reason ?? '—' },
    {
      key: 'status',
      label: 'Status',
      render: (row) => (
        <span className="rounded-full px-2 py-0.5 text-xs font-medium"
          style={{
            backgroundColor: row.status === 'APPROVED' || row.status === 'RESOLVED' ? '#dcfce7' : row.status === 'REJECTED' ? '#fee2e2' : row.status === 'RETURNED' ? '#ffedd5' : '#fef9c3',
            color: row.status === 'APPROVED' || row.status === 'RESOLVED' ? '#166534' : row.status === 'REJECTED' ? '#991b1b' : row.status === 'RETURNED' ? '#9a3412' : '#854d0e',
          }}>
          {row.status}
        </span>
      ),
    },
    {
      key: 'actions',
      label: 'Approve',
      render: (row) =>
        row.status === 'SUBMITTED' || row.status === 'DRAFT' || row.status === 'PENDING' ? (
          <div className="flex gap-1">
            <button onClick={() => handleApprove(row.id, 'APPROVE')} className="rounded px-2 py-0.5 text-xs text-white" style={{ backgroundColor: '#16a34a' }}>Approve</button>
            <button onClick={() => handleApprove(row.id, 'RETURN')} className="rounded px-2 py-0.5 text-xs text-white" style={{ backgroundColor: '#d97706' }}>Return</button>
            <button onClick={() => handleApprove(row.id, 'REJECT')} className="rounded px-2 py-0.5 text-xs text-white" style={{ backgroundColor: '#dc2626' }}>Reject</button>
          </div>
        ) : row.status === 'RETURNED' ? (
          <button onClick={() => handleApprove(row.id, 'RESUBMIT')} className="rounded px-2 py-0.5 text-xs text-white" style={{ backgroundColor: 'var(--accent)' }}>Resubmit</button>
        ) : '—',
    },
  ];

  const pending = records.filter((r) => r.status === 'DRAFT' || r.status === 'SUBMITTED').length;
  const approved = records.filter((r) => r.status === 'APPROVED').length;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold" style={{ color: 'var(--foreground)' }}>Training Need Analysis (TNA)</h1>
        <button onClick={handleAdd} className="rounded-lg px-4 py-2 text-sm font-medium text-white transition hover:opacity-90" style={{ backgroundColor: 'var(--accent)' }}>
          + Raise Training Need
        </button>
      </div>

      <KPIGrid columns={3}>
        <KPICard label="Total Needs" value={pagination.total} tone="info" />
        <KPICard label="Pending Approval" value={pending} tone="warning" />
        <KPICard label="Approved" value={approved} tone="success" />
      </KPIGrid>

      <div className="flex gap-2">
        <input value={search} onChange={(e) => { setSearch(e.target.value); setPage(1); }} placeholder="Search reason..." className="flex-1 rounded-lg border px-3 py-2 text-sm" style={{ borderColor: 'var(--border)', backgroundColor: 'var(--surface)' }} />
        <select value={statusFilter} onChange={(e) => { setStatusFilter(e.target.value); setPage(1); }} className="rounded-lg border px-3 py-2 text-sm" style={{ borderColor: 'var(--border)', backgroundColor: 'var(--surface)' }}>
          <option value="">All Status</option>
          <option value="DRAFT">Draft</option>
          <option value="SUBMITTED">Submitted</option>
          <option value="APPROVED">Approved</option>
          <option value="REJECTED">Rejected</option>
          <option value="PLANNED">Planned</option>
          <option value="RESOLVED">Resolved</option>
        </select>
      </div>

      {error && <div className="rounded-lg px-3 py-2 text-sm" style={{ backgroundColor: '#fef2f2', color: '#dc2626', border: '1px solid #fecaca' }}>{error}</div>}

      <DataTable
        columns={columns}
        data={records}
        pagination={pagination}
        loading={loading}
        onPageChange={setPage}
        onEdit={handleEdit}
        onDelete={(row) => setDeleteId(row.id)}
      />

      <FormModal
        title={editingId ? 'Edit Training Need' : 'Raise Training Need'}
        fields={fields}
        initialValues={initialValues}
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        onSubmit={handleSubmit}
        submitLabel={editingId ? 'Update' : 'Create'}
      />

      <ConfirmDialog
        title="Delete Training Need"
        message="Are you sure you want to delete this training need request?"
        isOpen={deleteId !== null}
        onConfirm={() => deleteId && handleDelete(deleteId)}
        onClose={() => setDeleteId(null)}
      />
    </div>
  );
}
