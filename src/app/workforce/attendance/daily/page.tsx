/**
 * Daily Attendance — mark/correct one employee's attendance for one date.
 * Pattern A-ish: DataTable + FormModal, but the "list" is scoped to a
 * selected date rather than paginated across all records.
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

interface AttendanceRow {
  id: number;
  employeeId: number;
  date: string;
  status: string;
  inTime: string | null;
  outTime: string | null;
  workingMinutes: number;
  lateMinutes: number;
  earlyOutMinutes: number;
  otMinutesCalculated: number;
  remarks: string | null;
  employee: { id: number; employeeCode: string; firstName: string; lastName: string };
}

const STATUS_OPTIONS = [
  'Present',
  'Absent',
  'HalfDay',
  'WeeklyOff',
  'Holiday',
  'Leave',
  'Permission',
  'OnDuty',
  'MissingPunch',
  'LOP',
].map((s) => ({ label: s, value: s }));

function todayIso() {
  return new Date().toISOString().slice(0, 10);
}

export default function DailyAttendancePage() {
  const [date, setDate] = useState(todayIso());
  const [records, setRecords] = useState<AttendanceRow[]>([]);
  const [employees, setEmployees] = useState<EmployeeOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [modalOpen, setModalOpen] = useState(false);
  const [editingRow, setEditingRow] = useState<AttendanceRow | null>(null);
  const [initialValues, setInitialValues] = useState<Record<string, string | number | boolean | undefined>>({});

  useEffect(() => {
    fetch('/api/employees?limit=200')
      .then((r) => r.json())
      .then((json: { data: EmployeeOption[] }) => setEmployees(json.data ?? []))
      .catch(() => {});
  }, []);

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/workforce/attendance/daily?date=${date}`);
      if (!res.ok) throw new Error('Failed to fetch');
      const json: { data: AttendanceRow[] } = await res.json();
      setRecords(json.data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  }, [date]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const employeeOptions = employees.map((e) => ({
    label: `${e.employeeCode} — ${e.firstName} ${e.lastName}`,
    value: e.id,
  }));

  const fields: FieldDef[] = [
    { name: 'employeeId', label: 'Employee', type: 'select', required: true, options: employeeOptions, disabled: !!editingRow },
    { name: 'status', label: 'Status', type: 'select', required: true, options: STATUS_OPTIONS },
    { name: 'inTime', label: 'In Time', type: 'text', placeholder: 'e.g. 2026-09-05T08:30' },
    { name: 'outTime', label: 'Out Time', type: 'text', placeholder: 'e.g. 2026-09-05T17:30' },
    { name: 'workingMinutes', label: 'Working Minutes', type: 'number' },
    { name: 'lateMinutes', label: 'Late Minutes', type: 'number' },
    { name: 'earlyOutMinutes', label: 'Early-Out Minutes', type: 'number' },
    { name: 'otMinutesCalculated', label: 'OT Minutes', type: 'number' },
    { name: 'remarks', label: 'Remarks', type: 'textarea', required: !!editingRow, helpText: editingRow ? 'Required when correcting a record' : undefined },
  ];

  const handleAdd = () => {
    setEditingRow(null);
    setInitialValues({ date, status: 'Present', workingMinutes: 0, lateMinutes: 0, earlyOutMinutes: 0, otMinutesCalculated: 0 });
    setModalOpen(true);
  };

  const handleEdit = (row: AttendanceRow) => {
    setEditingRow(row);
    setInitialValues({
      employeeId: row.employeeId,
      status: row.status,
      inTime: row.inTime ?? '',
      outTime: row.outTime ?? '',
      workingMinutes: row.workingMinutes,
      lateMinutes: row.lateMinutes,
      earlyOutMinutes: row.earlyOutMinutes,
      otMinutesCalculated: row.otMinutesCalculated,
      remarks: row.remarks ?? '',
    });
    setModalOpen(true);
  };

  const handleSubmit = async (values: Record<string, string | number | boolean>) => {
    const payload = {
      employeeId: Number(values.employeeId),
      date,
      status: values.status,
      inTime: values.inTime || null,
      outTime: values.outTime || null,
      workingMinutes: Number(values.workingMinutes) || 0,
      lateMinutes: Number(values.lateMinutes) || 0,
      earlyOutMinutes: Number(values.earlyOutMinutes) || 0,
      otMinutesCalculated: Number(values.otMinutesCalculated) || 0,
      remarks: values.remarks || null,
    };

    const url = editingRow ? `/api/workforce/attendance/daily/${editingRow.id}` : '/api/workforce/attendance/daily';
    const method = editingRow ? 'PUT' : 'POST';

    const res = await fetch(url, {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error ?? 'Save failed');
    }
    fetchData();
  };

  const columns: Column<AttendanceRow>[] = [
    { key: 'employee', label: 'Employee', render: (r) => `${r.employee.employeeCode} — ${r.employee.firstName} ${r.employee.lastName}` },
    { key: 'status', label: 'Status' },
    { key: 'inTime', label: 'In', render: (r) => (r.inTime ? new Date(r.inTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '—') },
    { key: 'outTime', label: 'Out', render: (r) => (r.outTime ? new Date(r.outTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '—') },
    { key: 'workingMinutes', label: 'Working (min)' },
    { key: 'lateMinutes', label: 'Late (min)' },
    { key: 'otMinutesCalculated', label: 'OT (min)' },
    { key: 'remarks', label: 'Remarks', render: (r) => r.remarks ?? '—' },
  ];

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-xl font-semibold" style={{ color: 'var(--foreground)' }}>
          Daily Attendance
        </h1>
        <div className="flex items-center gap-3">
          <input
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            className="rounded-lg border px-3 py-2 text-sm"
            style={{ backgroundColor: 'var(--surface)', color: 'var(--foreground)', borderColor: 'var(--border)' }}
          />
          <button
            onClick={handleAdd}
            className="rounded-lg px-4 py-2 text-sm font-medium text-white transition hover:opacity-90"
            style={{ backgroundColor: 'var(--accent)' }}
          >
            + Mark Attendance
          </button>
        </div>
      </div>

      {error && (
        <div className="rounded-lg px-3 py-2 text-sm" style={{ backgroundColor: '#fef2f2', color: '#dc2626', border: '1px solid #fecaca' }}>
          {error}
        </div>
      )}

      <DataTable columns={columns} data={records} loading={loading} onEdit={handleEdit} emptyMessage={`No attendance marked for ${date} yet.`} />

      <FormModal
        title={editingRow ? 'Correct Attendance' : 'Mark Attendance'}
        fields={fields}
        initialValues={initialValues}
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        onSubmit={handleSubmit}
        submitLabel={editingRow ? 'Save Correction' : 'Mark'}
      />
    </div>
  );
}
