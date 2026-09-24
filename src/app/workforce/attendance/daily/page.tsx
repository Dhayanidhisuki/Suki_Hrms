/**
 * Daily Attendance — mark/correct one employee's attendance for one date.
 * Pattern A-ish: DataTable + FormModal, but the "list" is scoped to a
 * selected date rather than paginated across all records.
 */

'use client';

import { useState, useEffect, useCallback } from 'react';
import { DataTable, FormModal, useToast, type Column, type FieldDef } from '@/components/ui';

interface EmployeeOption {
  id: number;
  employeeCode: string;
  firstName: string;
  lastName: string;
}

interface ShiftMasterOption {
  id: number;
  code: string;
  name: string;
  startTime: string;
  endTime: string;
  graceMinutes: number;
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
  lomMinutes: number;
  otPayableMinutes: number;
  remarks: string | null;
  inSource: string | null;
  outSource: string | null;
  employee: { id: number; employeeCode: string; firstName: string; lastName: string };
  shiftMaster: { id: number; code: string; name: string; startTime: string; endTime: string; graceMinutes: number } | null;
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

/**
 * inTime/outTime are stored via setUTCHours as a neutral wall-clock value
 * ("09:10" means 9:10am at the workplace, not a true UTC instant) — every
 * write path (biometric conversion, manual correction) uses this same
 * convention. Must read back with getUTCHours/getUTCMinutes, never
 * toLocaleTimeString/getHours, which would re-project through the viewer's
 * browser timezone and show the wrong clock time entirely.
 */
function formatWallClockTime(iso: string | null): string {
  if (!iso) return '—';
  const d = new Date(iso);
  const hour = d.getUTCHours();
  const minute = d.getUTCMinutes();
  const period = hour >= 12 ? 'PM' : 'AM';
  const hour12 = hour % 12 === 0 ? 12 : hour % 12;
  return `${hour12}:${String(minute).padStart(2, '0')} ${period}`;
}

/** Small "App"/"Bio" tag under a punch time when the merge recorded which feed supplied it. */
function SourceTag({ source }: { source: string | null }) {
  if (!source) return null;
  const label = source === 'app' ? 'App' : source === 'biometric' ? 'Bio' : source;
  return (
    <span
      className="mt-0.5 inline-block rounded px-1 text-[10px] font-medium"
      style={{ backgroundColor: 'var(--border)', color: 'var(--muted-foreground, var(--foreground))' }}
    >
      {label}
    </span>
  );
}

export default function DailyAttendancePage() {
  const toast = useToast();
  const [date, setDate] = useState(todayIso());

  // ?date=YYYY-MM-DD deep-links a specific day (the Attendance Overview page
  // links here per row). Read once on mount, client-side only.
  useEffect(() => {
    const q = new URLSearchParams(window.location.search).get('date');
    if (q && /^\d{4}-\d{2}-\d{2}$/.test(q)) setDate(q);
  }, []);
  const [records, setRecords] = useState<AttendanceRow[]>([]);
  const [employees, setEmployees] = useState<EmployeeOption[]>([]);
  const [shiftMasters, setShiftMasters] = useState<ShiftMasterOption[]>([]);
  const [loading, setLoading] = useState(true);

  const [modalOpen, setModalOpen] = useState(false);
  const [editingRow, setEditingRow] = useState<AttendanceRow | null>(null);
  const [initialValues, setInitialValues] = useState<Record<string, string | number | boolean | undefined>>({});

  useEffect(() => {
    fetch('/api/employees?limit=200')
      .then((r) => r.json())
      .then((json: { data: EmployeeOption[] }) => setEmployees(json.data ?? []))
      .catch(() => {});
    fetch('/api/masters/shift-masters?limit=100')
      .then((r) => r.json())
      .then((json: { data: ShiftMasterOption[] }) => setShiftMasters(json.data ?? []))
      .catch(() => {});
  }, []);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/workforce/attendance/daily?date=${date}`);
      if (!res.ok) throw new Error('Failed to fetch');
      const json: { data: AttendanceRow[] } = await res.json();
      setRecords(json.data);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  }, [date, toast]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const employeeOptions = employees.map((e) => ({
    label: `${e.employeeCode} — ${e.firstName} ${e.lastName}`,
    value: e.id,
  }));

  const shiftOptions = shiftMasters.map((s) => ({
    label: `${s.code} — ${s.name} (${s.startTime}–${s.endTime}, grace ${s.graceMinutes}m)`,
    value: s.id,
  }));

  const fields: FieldDef[] = [
    { name: 'employeeId', label: 'Employee', type: 'select', required: true, options: employeeOptions, disabled: !!editingRow },
    { name: 'shiftMasterId', label: 'Shift', type: 'select', options: shiftOptions, helpText: 'Used to auto-calculate late/early/OT/LOM' },
    { name: 'status', label: 'Status', type: 'select', required: true, options: STATUS_OPTIONS },
    { name: 'inTime', label: 'In Time', type: 'text', placeholder: 'e.g. 2026-09-05T08:30' },
    { name: 'outTime', label: 'Out Time', type: 'text', placeholder: 'e.g. 2026-09-05T17:30' },
    { name: 'workingMinutes', label: 'Working Minutes', type: 'number', helpText: 'Auto-calculated from in/out + shift' },
    { name: 'lateMinutes', label: 'Late Minutes', type: 'number', helpText: 'Auto-calculated from in/out + shift' },
    { name: 'earlyOutMinutes', label: 'Early-Out Minutes', type: 'number', helpText: 'Auto-calculated from in/out + shift' },
    { name: 'otMinutesCalculated', label: 'OT Minutes (raw)', type: 'number', helpText: 'Auto-calculated from in/out + shift' },
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
      shiftMasterId: row.shiftMaster?.id ?? '',
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
      shiftMasterId: values.shiftMasterId ? Number(values.shiftMasterId) : null,
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
    { key: 'shiftMaster', label: 'Shift', render: (r) => r.shiftMaster?.code ?? '—' },
    { key: 'status', label: 'Status' },
    {
      key: 'inTime',
      label: 'In',
      render: (r) => (
        <span className="inline-flex flex-col">
          {formatWallClockTime(r.inTime)}
          <SourceTag source={r.inTime ? r.inSource : null} />
        </span>
      ),
    },
    {
      key: 'outTime',
      label: 'Out',
      render: (r) => (
        <span className="inline-flex flex-col">
          {formatWallClockTime(r.outTime)}
          <SourceTag source={r.outTime ? r.outSource : null} />
        </span>
      ),
    },
    { key: 'workingMinutes', label: 'Work (min)' },
    { key: 'lateMinutes', label: 'Late (min)' },
    { key: 'earlyOutMinutes', label: 'Early (min)' },
    { key: 'otMinutesCalculated', label: 'OT Raw (min)' },
    { key: 'otPayableMinutes', label: 'OT Pay (min)' },
    { key: 'lomMinutes', label: 'LOM (min)' },
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
