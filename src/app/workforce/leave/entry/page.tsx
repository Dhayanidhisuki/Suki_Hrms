/**
 * Leave Entry — apply for leave on behalf of an employee (BRD §10).
 * numberOfDays is computed client-side from fromDate/toDate (or 0.5 for a
 * half day) before submitting.
 */

'use client';

import { useState, useEffect, useCallback } from 'react';
import { DataTable, FormModal, type Column, type FieldDef } from '@/components/ui';

interface EmployeeOption {
  id: number;
  employeeCode: string;
  firstName: string;
  lastName: string;
}
interface LeaveMasterOption {
  id: number;
  code: string;
  name: string;
}
interface LeaveApplicationRow {
  id: number;
  fromDate: string;
  toDate: string;
  numberOfDays: string;
  isHalfDay: boolean;
  reason: string | null;
  status: string;
  employee: { employeeCode: string; firstName: string; lastName: string };
  leaveMaster: { code: string; name: string };
}

function daysBetweenInclusive(from: string, to: string) {
  const a = new Date(from);
  const b = new Date(to);
  return Math.round((b.getTime() - a.getTime()) / (1000 * 60 * 60 * 24)) + 1;
}

export default function LeaveEntryPage() {
  const [records, setRecords] = useState<LeaveApplicationRow[]>([]);
  const [employees, setEmployees] = useState<EmployeeOption[]>([]);
  const [leaveMasters, setLeaveMasters] = useState<LeaveMasterOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [modalOpen, setModalOpen] = useState(false);

  useEffect(() => {
    fetch('/api/employees?limit=200')
      .then((r) => r.json())
      .then((json: { data: EmployeeOption[] }) => setEmployees(json.data ?? []))
      .catch(() => {});
    fetch('/api/masters/leave-masters?limit=100')
      .then((r) => r.json())
      .then((json: { data: LeaveMasterOption[] }) => setLeaveMasters(json.data ?? []))
      .catch(() => {});
  }, []);

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/workforce/leave/applications');
      if (!res.ok) throw new Error('Failed to fetch');
      const json: { data: LeaveApplicationRow[] } = await res.json();
      setRecords(json.data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const fields: FieldDef[] = [
    { name: 'employeeId', label: 'Employee', type: 'select', required: true, options: employees.map((e) => ({ label: `${e.employeeCode} — ${e.firstName} ${e.lastName}`, value: e.id })) },
    { name: 'leaveMasterId', label: 'Leave Type', type: 'select', required: true, options: leaveMasters.map((l) => ({ label: `${l.name} (${l.code})`, value: l.id })) },
    { name: 'fromDate', label: 'From Date', type: 'date', required: true },
    { name: 'toDate', label: 'To Date', type: 'date', required: true },
    { name: 'isHalfDay', label: 'Half Day', type: 'checkbox' },
    { name: 'reason', label: 'Reason', type: 'textarea' },
  ];

  const handleSubmit = async (values: Record<string, string | number | boolean>) => {
    const fromDate = String(values.fromDate);
    const toDate = String(values.toDate);
    const isHalfDay = Boolean(values.isHalfDay);
    const numberOfDays = isHalfDay ? 0.5 : daysBetweenInclusive(fromDate, toDate);

    const res = await fetch('/api/workforce/leave/applications', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        employeeId: Number(values.employeeId),
        leaveMasterId: Number(values.leaveMasterId),
        fromDate,
        toDate,
        isHalfDay,
        numberOfDays,
        reason: values.reason || null,
      }),
    });
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error ?? 'Save failed');
    }
    fetchData();
  };

  const columns: Column<LeaveApplicationRow>[] = [
    { key: 'employee', label: 'Employee', render: (r) => `${r.employee.employeeCode} — ${r.employee.firstName} ${r.employee.lastName}` },
    { key: 'leaveMaster', label: 'Leave Type', render: (r) => r.leaveMaster.name },
    { key: 'fromDate', label: 'From', render: (r) => new Date(r.fromDate).toLocaleDateString() },
    { key: 'toDate', label: 'To', render: (r) => new Date(r.toDate).toLocaleDateString() },
    { key: 'numberOfDays', label: 'Days' },
    {
      key: 'status',
      label: 'Status',
      render: (r) => (
        <span
          className="rounded-full px-2 py-0.5 text-xs font-medium"
          style={{
            backgroundColor: r.status === 'approved' ? '#dcfce7' : r.status === 'rejected' ? '#fee2e2' : r.status === 'cancelled' ? '#f3f4f6' : '#fef9c3',
            color: r.status === 'approved' ? '#166534' : r.status === 'rejected' ? '#991b1b' : r.status === 'cancelled' ? '#4b5563' : '#854d0e',
          }}
        >
          {r.status}
        </span>
      ),
    },
  ];

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold" style={{ color: 'var(--foreground)' }}>
          Leave Entry
        </h1>
        <button
          onClick={() => setModalOpen(true)}
          className="rounded-lg px-4 py-2 text-sm font-medium text-white transition hover:opacity-90"
          style={{ backgroundColor: 'var(--accent)' }}
        >
          + Apply for Leave
        </button>
      </div>

      {error && (
        <div className="rounded-lg px-3 py-2 text-sm" style={{ backgroundColor: '#fef2f2', color: '#dc2626', border: '1px solid #fecaca' }}>
          {error}
        </div>
      )}

      <DataTable columns={columns} data={records} loading={loading} emptyMessage="No leave applications yet." />

      <FormModal
        title="Apply for Leave"
        fields={fields}
        initialValues={{ isHalfDay: false }}
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        onSubmit={handleSubmit}
        submitLabel="Apply"
      />
    </div>
  );
}
