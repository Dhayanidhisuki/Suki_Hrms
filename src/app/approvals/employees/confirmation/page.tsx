/**
 * Confirmation Approval — two-stage probation confirmation process:
 * 1. Manager recommendation (recommend/extend/reject)
 * 2. HR approval (approve/extend/reject)
 */

'use client';

import { useState, useEffect, useCallback } from 'react';
import { DataTable, ConfirmDialog, FormModal, useToast, type Column, type FieldDef } from '@/components/ui';

interface PendingEmployee {
  id: number;
  employeeCode: string;
  firstName: string;
  lastName: string;
  department: { id: number; name: string } | null;
  designation: { id: number; name: string } | null;
  employeeType: { id: number; name: string } | null;
  joinDate: string;
  probationEndDate: string;
}

const recommendOptions = [
  { label: 'Recommend for Confirmation', value: 'recommend' },
  { label: 'Extend Probation', value: 'extend' },
  { label: 'Reject', value: 'reject' },
];

const recommendFields: FieldDef[] = [
  {
    name: 'recommendation',
    label: 'Recommendation',
    type: 'select',
    options: recommendOptions,
    required: true,
  },
  { name: 'remarks', label: 'Remarks', type: 'textarea', required: false },
];

const approveFields: FieldDef[] = [
  { name: 'remarks', label: 'Remarks / Decision Notes', type: 'textarea', required: false },
];

export default function ConfirmationApprovalPage() {
  const [employees, setEmployees] = useState<PendingEmployee[]>([]);
  const [loading, setLoading] = useState(true);
  const toast = useToast();
  const [recommendId, setRecommendId] = useState<number | null>(null);
  const [approveId, setApproveId] = useState<number | null>(null);
  const [recommending, setRecommending] = useState(false);
  const [approving, setApproving] = useState(false);
  const [userRole, setUserRole] = useState<'manager' | 'hr' | 'unknown'>('unknown');

  const fetchEmployees = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/employees/confirmation-pending');
      if (!res.ok) {
        if (res.status === 403) {
          toast.error('Insufficient permissions to view confirmation pending employees');
          return;
        }
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error ?? 'Failed to load pending employees');
      }
      const json = await res.json();
      setEmployees(json.data ?? []);
      // Infer role from ability to recommend
      const canRecommend = res.status !== 403;
      setUserRole(canRecommend ? 'manager' : 'hr');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to load pending employees');
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    fetchEmployees();
  }, [fetchEmployees]);

  const handleRecommend = async (id: number, values: Record<string, string | number | boolean>) => {
    setRecommending(true);
    try {
      const res = await fetch(`/api/employees/${id}/confirmation/manager-recommend`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          recommendation: values.recommendation,
          remarks: values.remarks || null,
        }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error ?? 'Failed to submit recommendation');
      }
      setRecommendId(null);
      fetchEmployees();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to submit recommendation');
    } finally {
      setRecommending(false);
    }
  };

  const handleApprove = async (id: number, values: Record<string, string | number | boolean>) => {
    setApproving(true);
    try {
      const res = await fetch(`/api/employees/${id}/confirmation/approve`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ remarks: values.remarks || null }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error ?? 'Failed to approve confirmation');
      }
      setApproveId(null);
      fetchEmployees();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to approve confirmation');
    } finally {
      setApproving(false);
    }
  };

  const columns: Column<PendingEmployee>[] = [
    {
      key: 'employee',
      label: 'Employee',
      render: (r) => (
        <div>
          <div className="font-medium">{r.firstName} {r.lastName}</div>
          <div className="text-xs" style={{ color: 'var(--foreground-muted)' }}>
            {r.employeeCode}
          </div>
        </div>
      ),
    },
    {
      key: 'designation',
      label: 'Designation',
      render: (r) => r.designation?.name || '—',
    },
    {
      key: 'department',
      label: 'Department',
      render: (r) => r.department?.name || '—',
    },
    {
      key: 'joinDate',
      label: 'Join Date',
      render: (r) => new Date(r.joinDate).toLocaleDateString('en-IN', { timeZone: 'UTC' }),
    },
    {
      key: 'probationEndDate',
      label: 'Probation End',
      render: (r) => new Date(r.probationEndDate).toLocaleDateString('en-IN', { timeZone: 'UTC' }),
    },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold" style={{ color: 'var(--foreground)' }}>
          Confirmation Approval
        </h1>
        <p className="text-sm" style={{ color: 'var(--foreground-muted)' }}>
          Probation confirmation — two-stage: Manager recommendation, then HR approval.
        </p>
      </div>

      <DataTable
        columns={columns}
        data={employees}
        loading={loading}
        emptyMessage="No pending confirmations."
        renderRowActions={(row) => (
          <>
            <button
              onClick={() => setRecommendId(row.id)}
              className="mr-3 text-xs font-medium hover:underline"
              style={{ color: '#2563eb' }}
            >
              Recommend
            </button>
            <button
              onClick={() => setApproveId(row.id)}
              className="text-xs font-medium hover:underline"
              style={{ color: '#166534' }}
            >
              Approve
            </button>
          </>
        )}
      />

      <FormModal
        title="Manager Recommendation"
        fields={recommendFields}
        initialValues={{ recommendation: 'recommend' }}
        isOpen={recommendId !== null}
        onClose={() => setRecommendId(null)}
        onSubmit={async (values) => {
          if (recommendId) await handleRecommend(recommendId, values);
        }}
      />

      <FormModal
        title="HR Confirmation Approval"
        fields={approveFields}
        initialValues={{}}
        isOpen={approveId !== null}
        onClose={() => setApproveId(null)}
        onSubmit={async (values) => {
          if (approveId) await handleApprove(approveId, values);
        }}
      />
    </div>
  );
}
