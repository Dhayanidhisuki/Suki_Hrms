/**
 * PMS Incentive — Reporting Managers submit their monthly % for a direct
 * report (company's 50% is fixed, added automatically), HR approves before
 * payroll. Single page, two sections shown based on what the logged-in
 * user can do (manager submissions / HR queue), same "hide on 403" pattern
 * as Mispunch/OT Approval. Approving here does NOT push a rupee amount to
 * payroll — see PmsIncentive's schema comment for why — HR applies the
 * actual incentive via Salary Processing's Bulk Upload Benefits once they
 * know the base amount, using the approved totalPercent as reference.
 */

'use client';

import { useState, useEffect, useCallback } from 'react';
import { DataTable, ConfirmDialog, FormModal, type Column, type FieldDef } from '@/components/ui';

interface PmsRow {
  id: number;
  year: number;
  month: number;
  companyPercent: number;
  managerPercent: number;
  totalPercent: number;
  status: string;
  rejectionReason: string | null;
  employee: { employeeCode: string; firstName: string; lastName: string };
}
interface DirectReport {
  id: number;
  employeeCode: string;
  firstName: string;
  lastName: string;
}

const MONTHS = Array.from({ length: 12 }, (_, i) => new Date(2000, i, 1).toLocaleString('default', { month: 'long' }));
const rejectFields: FieldDef[] = [{ name: 'rejectionReason', label: 'Rejection Reason', type: 'textarea', required: true }];

function MySubmissions() {
  const [rows, setRows] = useState<PmsRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [visible, setVisible] = useState(true);
  const [directReports, setDirectReports] = useState<DirectReport[]>([]);
  const [modalOpen, setModalOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const now = new Date();

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/payroll/pms?scope=mine');
      if (res.status === 403) {
        setVisible(false);
        return;
      }
      if (!res.ok) throw new Error((await res.json()).error ?? 'Failed to fetch');
      const json: { data: PmsRow[] } = await res.json();
      setRows(json.data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
    fetch('/api/payroll/pms/direct-reports')
      .then((r) => (r.ok ? r.json() : { data: [] }))
      .then((json: { data: DirectReport[] }) => setDirectReports(json.data ?? []))
      .catch(() => {});
  }, [fetchData]);

  if (!visible) return null;

  const fields: FieldDef[] = [
    {
      name: 'employeeId',
      label: 'Employee',
      type: 'select',
      required: true,
      options: directReports.map((e) => ({ label: `${e.employeeCode} — ${e.firstName} ${e.lastName}`, value: e.id })),
    },
    { name: 'year', label: 'Year', type: 'number', required: true, defaultValue: now.getFullYear() },
    {
      name: 'month',
      label: 'Month',
      type: 'select',
      required: true,
      options: MONTHS.map((m, i) => ({ label: m, value: i + 1 })),
      defaultValue: now.getMonth() + 1,
    },
    { name: 'managerPercent', label: 'Your % (0-50)', type: 'number', required: true },
  ];

  const columns: Column<PmsRow>[] = [
    { key: 'employee', label: 'Employee', render: (r) => `${r.employee.employeeCode} — ${r.employee.firstName} ${r.employee.lastName}` },
    { key: 'period', label: 'Period', render: (r) => `${MONTHS[r.month - 1]} ${r.year}` },
    { key: 'companyPercent', label: 'Company %', render: (r) => Number(r.companyPercent).toFixed(0) },
    { key: 'managerPercent', label: 'Your %', render: (r) => Number(r.managerPercent).toFixed(0) },
    { key: 'totalPercent', label: 'Total %', render: (r) => Number(r.totalPercent).toFixed(0) },
    { key: 'status', label: 'Status' },
    { key: 'rejectionReason', label: 'Rejection Reason', render: (r) => r.rejectionReason ?? '—' },
  ];

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-sm font-semibold" style={{ color: 'var(--foreground)' }}>
            My Submissions (Reporting Manager)
          </h2>
          <p className="text-xs" style={{ color: 'var(--foreground-muted)' }}>
            Your % contribution for a direct report — the company&apos;s 50% is added automatically.
          </p>
        </div>
        <button onClick={() => setModalOpen(true)} className="rounded-lg px-4 py-2 text-sm font-medium text-white" style={{ backgroundColor: 'var(--accent)' }}>
          + Submit
        </button>
      </div>
      {error && (
        <div className="rounded-lg px-3 py-2 text-sm" style={{ backgroundColor: '#fef2f2', color: '#dc2626' }}>
          {error}
        </div>
      )}
      <DataTable columns={columns} data={rows} loading={loading} emptyMessage="No submissions yet." />
      <FormModal
        title="Submit PMS Incentive %"
        fields={fields}
        initialValues={{ year: now.getFullYear(), month: now.getMonth() + 1 }}
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        onSubmit={async (values) => {
          const res = await fetch('/api/payroll/pms', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              employeeId: Number(values.employeeId),
              year: Number(values.year),
              month: Number(values.month),
              managerPercent: Number(values.managerPercent),
            }),
          });
          if (!res.ok) {
            const err = await res.json();
            throw new Error(err.error ?? 'Save failed');
          }
          fetchData();
        }}
        submitLabel="Submit"
      />
    </div>
  );
}

function HrQueue() {
  const [rows, setRows] = useState<PmsRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [visible, setVisible] = useState(true);
  const [approveId, setApproveId] = useState<number | null>(null);
  const [rejectId, setRejectId] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/payroll/pms?scope=hr');
      if (res.status === 403) {
        setVisible(false);
        return;
      }
      if (!res.ok) throw new Error((await res.json()).error ?? 'Failed to fetch');
      const json: { data: PmsRow[] } = await res.json();
      setRows(json.data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  if (!visible) return null;

  const handleApprove = async (id: number) => {
    const res = await fetch(`/api/payroll/pms/${id}/approve`, { method: 'POST' });
    if (!res.ok) {
      const err = await res.json();
      setError(err.error ?? 'Approve failed');
      return;
    }
    fetchData();
  };

  const columns: Column<PmsRow>[] = [
    { key: 'employee', label: 'Employee', render: (r) => `${r.employee.employeeCode} — ${r.employee.firstName} ${r.employee.lastName}` },
    { key: 'period', label: 'Period', render: (r) => `${MONTHS[r.month - 1]} ${r.year}` },
    { key: 'companyPercent', label: 'Company %', render: (r) => Number(r.companyPercent).toFixed(0) },
    { key: 'managerPercent', label: 'Manager %', render: (r) => Number(r.managerPercent).toFixed(0) },
    { key: 'totalPercent', label: 'Total %', render: (r) => Number(r.totalPercent).toFixed(0) },
  ];

  return (
    <div className="space-y-2">
      <h2 className="text-sm font-semibold" style={{ color: 'var(--foreground)' }}>
        Pending HR Approval
      </h2>
      {error && (
        <div className="rounded-lg px-3 py-2 text-sm" style={{ backgroundColor: '#fef2f2', color: '#dc2626' }}>
          {error}
        </div>
      )}
      <DataTable
        columns={columns}
        data={rows}
        loading={loading}
        emptyMessage="Nothing pending here."
        renderRowActions={(row) => (
          <>
            <button onClick={() => setApproveId(row.id)} className="mr-3 text-xs font-medium hover:underline" style={{ color: '#166534' }}>
              Approve
            </button>
            <button onClick={() => setRejectId(row.id)} className="text-xs font-medium hover:underline" style={{ color: '#991b1b' }}>
              Reject
            </button>
          </>
        )}
      />
      <ConfirmDialog
        title="Approve PMS Incentive"
        message="This confirms the % agreement before payroll — the rupee amount is still applied separately once you know the base. Continue?"
        confirmLabel="Approve"
        isOpen={approveId !== null}
        onConfirm={() => {
          if (approveId) handleApprove(approveId);
          setApproveId(null);
        }}
        onClose={() => setApproveId(null)}
      />
      <FormModal
        title="Reject PMS Incentive"
        fields={rejectFields}
        initialValues={{}}
        isOpen={rejectId !== null}
        onClose={() => setRejectId(null)}
        onSubmit={async (values) => {
          const res = await fetch(`/api/payroll/pms/${rejectId}/reject`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ rejectionReason: values.rejectionReason }),
          });
          if (!res.ok) {
            const err = await res.json();
            throw new Error(err.error ?? 'Reject failed');
          }
          fetchData();
        }}
        submitLabel="Reject"
      />
    </div>
  );
}

export default function PmsIncentivePage() {
  return (
    <div className="space-y-6">
      <h1 className="text-xl font-semibold" style={{ color: 'var(--foreground)' }}>
        PMS Incentive
      </h1>
      <MySubmissions />
      <HrQueue />
    </div>
  );
}
