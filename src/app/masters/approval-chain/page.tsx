/**
 * Approval Chain Config — admin configures who approvals go to for each
 * module (SHIFT_CHANGE, LOM, OT, etc.). Each stage has an order and an
 * approver type (REPORTING_MANAGER, HR, ROLE, SPECIFIC_USER).
 */

'use client';

import { useState, useEffect, useCallback } from 'react';
import { DataTable, FormModal, ConfirmDialog, useToast, type Column, type FieldDef } from '@/components/ui';

interface ApprovalChainRow {
  id: number;
  module: string;
  stageName: string;
  stageOrder: number;
  approverType: string;
  approverRoleId: number | null;
  approverUserId: number | null;
  isActive: boolean;
}

const moduleOptions = [
  { value: 'SHIFT_CHANGE', label: 'Shift Change' },
  { value: 'LOM', label: 'LOM (Loss of Minutes)' },
  { value: 'OT', label: 'Overtime' },
  { value: 'LEAVE', label: 'Leave' },
];

const approverTypeOptions = [
  { value: 'REPORTING_MANAGER', label: 'Reporting Manager (L1)' },
  { value: 'HR', label: 'HR (permission-based)' },
  { value: 'ROLE', label: 'Specific Role' },
  { value: 'SPECIFIC_USER', label: 'Specific User' },
];

const fields: FieldDef[] = [
  { name: 'module', label: 'Module', type: 'select', required: true, options: moduleOptions },
  { name: 'stageName', label: 'Stage Name (e.g. L1, HR)', type: 'text', required: true },
  { name: 'stageOrder', label: 'Stage Order (1, 2, 3...)', type: 'number', required: true },
  { name: 'approverType', label: 'Approver Type', type: 'select', required: true, options: approverTypeOptions },
  { name: 'approverUserId', label: 'Approver User ID (for SPECIFIC_USER)', type: 'number' },
];

export default function ApprovalChainConfigPage() {
  const toast = useToast();
  const [records, setRecords] = useState<ApprovalChainRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [createOpen, setCreateOpen] = useState(false);
  const [deleteId, setDeleteId] = useState<number | null>(null);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/masters/approval-chain');
      if (!res.ok) throw new Error((await res.json()).error ?? 'Failed to fetch');
      const json = await res.json();
      setRecords(json.data);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const handleCreate = async (values: Record<string, string | number | boolean>) => {
    const res = await fetch('/api/masters/approval-chain', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        module: values.module,
        stageName: values.stageName,
        stageOrder: Number(values.stageOrder),
        approverType: values.approverType,
        approverUserId: values.approverUserId ? Number(values.approverUserId) : undefined,
      }),
    });
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error ?? 'Failed to save');
    }
    toast.success('Approval chain stage saved');
    fetchData();
  };

  const handleDelete = async () => {
    if (!deleteId) return;
    const res = await fetch('/api/masters/approval-chain', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: deleteId }),
    });
    if (!res.ok) {
      const err = await res.json();
      toast.error(err.error ?? 'Delete failed');
      return;
    }
    toast.success('Stage deleted');
    setDeleteId(null);
    fetchData();
  };

  const columns: Column<ApprovalChainRow>[] = [
    { key: 'module', label: 'Module', render: (r) => moduleOptions.find((m) => m.value === r.module)?.label ?? r.module },
    { key: 'stageOrder', label: 'Order', render: (r) => String(r.stageOrder) },
    { key: 'stageName', label: 'Stage Name' },
    { key: 'approverType', label: 'Approver Type', render: (r) => approverTypeOptions.find((a) => a.value === r.approverType)?.label ?? r.approverType },
    { key: 'isActive', label: 'Active', render: (r) => r.isActive ? 'Yes' : 'No' },
  ];

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold" style={{ color: 'var(--foreground)' }}>
          Approval Chain Configuration
        </h1>
        <button
          onClick={() => setCreateOpen(true)}
          className="rounded-lg px-4 py-2 text-sm font-medium text-white"
          style={{ backgroundColor: 'var(--accent)' }}
        >
          Add Stage
        </button>
      </div>

      <p className="text-sm" style={{ color: 'var(--foreground-muted)' }}>
        Configure who approves each type of request. Stages are executed in order — stage 1 first, then stage 2, etc.
        A request is fully approved only when all stages approve it.
      </p>

      <DataTable
        columns={columns}
        data={records}
        loading={loading}
        emptyMessage="No approval chain stages configured. Add one to get started."
        renderRowActions={(row) => (
          <button
            onClick={() => setDeleteId(row.id)}
            className="text-xs font-medium hover:underline"
            style={{ color: '#991b1b' }}
          >
            Delete
          </button>
        )}
      />

      <FormModal
        title="Add Approval Chain Stage"
        fields={fields}
        initialValues={{}}
        isOpen={createOpen}
        onClose={() => setCreateOpen(false)}
        onSubmit={handleCreate}
        submitLabel="Save Stage"
      />

      <ConfirmDialog
        title="Delete Approval Stage"
        message="Are you sure you want to delete this approval chain stage?"
        confirmLabel="Delete"
        isOpen={deleteId !== null}
        onConfirm={handleDelete}
        onClose={() => setDeleteId(null)}
      />
    </div>
  );
}
