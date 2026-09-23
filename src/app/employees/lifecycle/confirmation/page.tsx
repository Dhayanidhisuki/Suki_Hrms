/**
 * Employees > Lifecycle > Confirmation — the "Pending Confirmations" queue:
 * employees whose probation has ended but haven't been confirmed yet.
 * Admin can Approve (sets Confirmation Date + offers the letter download),
 * Extend (picks a new probation end date), or Reject (marks resigned).
 *
 * The queue is small by nature, so search / filters / date-range /
 * pagination / CSV export all run client-side over the fetched list.
 */

'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import Link from 'next/link';
import { DataTable, FormModal, useToast, type Column, type FieldDef } from '@/components/ui';
import ConfirmationActionDialog, { type ConfirmationTarget } from '@/components/employees/ConfirmationActionDialog';
import { formatDateNumeric, formatMonthYear } from '@/lib/format-date';

interface PendingConfirmation extends ConfirmationTarget {
  employeeType: { name: string } | null;
}

const PAGE_SIZE = 15;

function daysOverdue(probationEndDate: string): number {
  const end = new Date(probationEndDate);
  const today = new Date();
  const diffMs = today.setHours(0, 0, 0, 0) - end.setHours(0, 0, 0, 0);
  return Math.max(0, Math.round(diffMs / (1000 * 60 * 60 * 24)));
}

/** Only future dates make sense for an extended probation end date — the
 * native date picker hides today and everything earlier via `min`. */
function buildExtendFields(): FieldDef[] {
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  const minDate = tomorrow.toISOString().slice(0, 10);
  return [
    { name: 'newProbationEndDate', label: 'New Probation End Date', type: 'date', required: true, min: minDate },
    { name: 'remarks', label: 'Remarks', type: 'textarea', placeholder: 'Reason for extending (optional)' },
  ];
}

const Icon = {
  Download: () => (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
      <path d="m7 10 5 5 5-5" />
      <path d="M12 15V3" />
    </svg>
  ),
  Calendar: () => (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M8 2v4" />
      <path d="M16 2v4" />
      <rect width="18" height="18" x="3" y="4" rx="2" />
      <path d="M3 10h18" />
    </svg>
  ),
  Clock: () => (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="10" />
      <path d="M12 6v6l4 2" />
    </svg>
  ),
  ChevronDown: () => (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="m6 9 6 6 6-6" />
    </svg>
  ),
};

function FilterSelect({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: string;
  options: string[];
  onChange: (v: string) => void;
}) {
  return (
    <label
      className="relative inline-flex min-w-[150px] items-center rounded-lg border text-sm"
      style={{ borderColor: 'var(--border)', backgroundColor: 'var(--surface)' }}
    >
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        aria-label={label}
        className="w-full cursor-pointer appearance-none bg-transparent py-2 pl-3 pr-8 focus:outline-none"
        style={{ color: value ? 'var(--foreground)' : 'var(--foreground-muted)' }}
      >
        <option value="">{label}</option>
        {options.map((o) => (
          <option key={o} value={o}>
            {o}
          </option>
        ))}
      </select>
      <span className="pointer-events-none absolute right-2.5" style={{ color: 'var(--foreground-muted)' }}>
        <Icon.ChevronDown />
      </span>
    </label>
  );
}

/** Month-range picker over probation end dates: "Apr 2026 – Sep 2026". */
function DateRangePicker({
  from,
  to,
  onChange,
}: {
  from: string;
  to: string;
  onChange: (from: string, to: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const label =
    from || to ? `${from ? formatMonthYear(`${from}-01`) : '…'} – ${to ? formatMonthYear(`${to}-01`) : '…'}` : 'All dates';
  const inputStyle = { borderColor: 'var(--border)', backgroundColor: 'var(--surface)', color: 'var(--foreground)' };

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="inline-flex items-center gap-3 rounded-lg border px-4 py-2 text-sm font-medium"
        style={{ borderColor: 'var(--border)', backgroundColor: 'var(--surface)', color: 'var(--foreground)' }}
      >
        {label}
        <span style={{ color: 'var(--accent)' }}>
          <Icon.Calendar />
        </span>
      </button>
      {open && (
        <div
          className="absolute right-0 z-20 mt-2 w-64 space-y-3 rounded-xl border p-3 shadow-lg"
          style={{ borderColor: 'var(--border)', backgroundColor: 'var(--surface)' }}
        >
          <div className="text-xs font-medium" style={{ color: 'var(--foreground-muted)' }}>
            Probation end date between
          </div>
          <label className="block text-xs" style={{ color: 'var(--foreground)' }}>
            From
            <input type="month" value={from} onChange={(e) => onChange(e.target.value, to)} className="mt-1 w-full rounded-lg border px-2 py-1.5 text-sm" style={inputStyle} />
          </label>
          <label className="block text-xs" style={{ color: 'var(--foreground)' }}>
            To
            <input type="month" value={to} onChange={(e) => onChange(from, e.target.value)} className="mt-1 w-full rounded-lg border px-2 py-1.5 text-sm" style={inputStyle} />
          </label>
          <div className="flex justify-between">
            <button type="button" onClick={() => onChange('', '')} className="text-xs hover:underline" style={{ color: 'var(--foreground-muted)' }}>
              Clear
            </button>
            <button type="button" onClick={() => setOpen(false)} className="text-xs font-medium hover:underline" style={{ color: 'var(--accent)' }}>
              Done
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function ActionButton({ label, color, onClick }: { label: string; color: string; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="rounded-md px-3 py-1 text-xs font-medium text-white transition hover:opacity-90"
      style={{ backgroundColor: color }}
    >
      {label}
    </button>
  );
}

export default function ConfirmationPendingPage() {
  const toast = useToast();
  const [items, setItems] = useState<PendingConfirmation[]>([]);
  const [loading, setLoading] = useState(true);

  const [search, setSearch] = useState('');
  const [department, setDepartment] = useState('');
  const [designation, setDesignation] = useState('');
  const [employeeType, setEmployeeType] = useState('');
  const [rangeFrom, setRangeFrom] = useState('');
  const [rangeTo, setRangeTo] = useState('');
  const [page, setPage] = useState(1);

  const [approveTarget, setApproveTarget] = useState<PendingConfirmation | null>(null);
  const [extendTarget, setExtendTarget] = useState<PendingConfirmation | null>(null);
  const [rejectTarget, setRejectTarget] = useState<PendingConfirmation | null>(null);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/employees/confirmation-pending');
      if (!res.ok) throw new Error('Failed to fetch pending confirmations');
      const json = await res.json();
      setItems(json.data);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Dropdown options come from the data itself (the queue is small).
  const { departments, designations, employeeTypes } = useMemo(() => {
    const uniq = (pick: (r: PendingConfirmation) => string | undefined) =>
      Array.from(new Set(items.map(pick).filter((v): v is string => Boolean(v)))).sort();
    return {
      departments: uniq((r) => r.department?.name),
      designations: uniq((r) => r.designation?.name),
      employeeTypes: uniq((r) => r.employeeType?.name),
    };
  }, [items]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return items.filter((r) => {
      if (q) {
        const hay = `${r.oldEmployeeCode ?? ''} ${r.employeeCode} ${r.firstName} ${r.lastName}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      if (department && r.department?.name !== department) return false;
      if (designation && r.designation?.name !== designation) return false;
      if (employeeType && r.employeeType?.name !== employeeType) return false;
      const ym = r.probationEndDate?.slice(0, 7) ?? '';
      if (rangeFrom && ym < rangeFrom) return false;
      if (rangeTo && ym > rangeTo) return false;
      return true;
    });
  }, [items, search, department, designation, employeeType, rangeFrom, rangeTo]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const safePage = Math.min(page, totalPages);
  const pageRows = filtered.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE);

  const withReset =
    (set: (v: string) => void) =>
    (v: string) => {
      set(v);
      setPage(1);
    };

  const handleExport = () => {
    const header = ['S.No', 'Employee Code', 'Reference Code', 'Employee Name', 'Department', 'Designation', 'Type', 'Date of Joining', 'Probation End Date', 'Days Overdue'];
    const esc = (v: unknown) => {
      const s = v == null ? '' : String(v);
      return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
    };
    const rows = filtered.map((r, i) => [
      i + 1, r.oldEmployeeCode ?? '', r.employeeCode, `${r.firstName} ${r.lastName}`, r.department?.name ?? '', r.designation?.name ?? '',
      r.employeeType?.name ?? '', formatDateNumeric(r.joinDate, ''), formatDateNumeric(r.probationEndDate, ''), daysOverdue(r.probationEndDate),
    ]);
    const csv = [header, ...rows].map((row) => row.map(esc).join(',')).join('\r\n');
    const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
    const a = document.createElement('a');
    a.href = url;
    a.download = `pending-confirmations-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleApprove = async ({ remarks }: { remarks: string }) => {
    if (!approveTarget) return;
    const res = await fetch(`/api/employees/${approveTarget.id}/confirmation/approve`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ remarks: remarks || undefined }),
    });
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error ?? 'Approve failed');
    }
    toast.success(`${approveTarget.firstName} ${approveTarget.lastName} confirmed.`);
    fetchData();
  };

  const handleExtend = async (values: Record<string, string | number | boolean>) => {
    if (!extendTarget) return;
    const res = await fetch(`/api/employees/${extendTarget.id}/confirmation/extend`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(values),
    });
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error ?? 'Extend failed');
    }
    toast.success(`Probation extended for ${extendTarget.firstName} ${extendTarget.lastName}.`);
    fetchData();
  };

  const handleReject = async ({ remarks, reason }: { remarks: string; reason?: string }) => {
    if (!rejectTarget) return;
    // The API stores a single remarks string — fold the picked reason into it.
    const combined = [reason, remarks].filter(Boolean).join(' — ');
    const res = await fetch(`/api/employees/${rejectTarget.id}/confirmation/reject`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ remarks: combined || undefined }),
    });
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error ?? 'Reject failed');
    }
    toast.success(`${rejectTarget.firstName} ${rejectTarget.lastName} marked resigned.`);
    fetchData();
  };

  const columns: Column<PendingConfirmation>[] = [
    { key: 'sno', label: 'S.No', render: (r) => filtered.indexOf(r) + 1 },
    { key: 'oldEmployeeCode', label: 'Employee Code', className: 'font-medium', render: (r) => r.oldEmployeeCode ?? '—' },
    {
      key: 'name',
      label: 'Employee Name',
      render: (row) => (
        <Link href={`/employees/${row.id}`} className="font-medium underline underline-offset-2 hover:opacity-80" style={{ color: 'var(--accent)' }}>
          {row.firstName} {row.lastName}
        </Link>
      ),
    },
    { key: 'department', label: 'Department', render: (row) => row.department?.name ?? '—' },
    { key: 'designation', label: 'Designation', render: (row) => row.designation?.name ?? '—' },
    { key: 'joinDate', label: 'Date of Joining', render: (row) => formatDateNumeric(row.joinDate) },
    { key: 'probationEndDate', label: 'Probation End Date', render: (row) => formatDateNumeric(row.probationEndDate) },
    {
      key: 'overdue',
      label: 'Days Overdue',
      render: (row) => {
        const days = daysOverdue(row.probationEndDate);
        const color = days > 90 ? 'var(--danger)' : days > 0 ? 'var(--warning)' : 'var(--foreground-muted)';
        return (
          <span className="inline-flex items-center gap-1 font-medium" style={{ color }}>
            <Icon.Clock />
            {days > 0 ? `${days}d` : 'Due today'}
          </span>
        );
      },
    },
    {
      key: 'actions',
      label: 'Actions',
      render: (row) => (
        <div className="flex gap-2 whitespace-nowrap">
          <ActionButton label="Approve" color="var(--success)" onClick={() => setApproveTarget(row)} />
          <ActionButton label="Extend" color="#d98b1a" onClick={() => setExtendTarget(row)} />
          <ActionButton label="Reject" color="#d92d20" onClick={() => setRejectTarget(row)} />
        </div>
      ),
    },
  ];

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold" style={{ color: 'var(--foreground)' }}>
            Pending Confirmations
          </h1>
          <p className="text-sm" style={{ color: 'var(--foreground-muted)' }}>
            Employees whose probation period has ended and are awaiting a confirmation decision.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <DateRangePicker
            from={rangeFrom}
            to={rangeTo}
            onChange={(f, t) => {
              setRangeFrom(f);
              setRangeTo(t);
              setPage(1);
            }}
          />
          <button
            type="button"
            onClick={handleExport}
            disabled={filtered.length === 0}
            className="inline-flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium text-white transition hover:opacity-90 disabled:opacity-50"
            style={{ backgroundColor: 'var(--accent)' }}
          >
            <Icon.Download />
            Export
          </button>
        </div>
      </div>

      <DataTable
        variant="card"
        columns={columns}
        data={pageRows}
        loading={loading}
        searchValue={search}
        searchPlaceholder="Search by code or name..."
        onSearchChange={withReset(setSearch)}
        filters={
          <>
            <FilterSelect label="Department" value={department} options={departments} onChange={withReset(setDepartment)} />
            <FilterSelect label="Designation" value={designation} options={designations} onChange={withReset(setDesignation)} />
            <FilterSelect label="Type" value={employeeType} options={employeeTypes} onChange={withReset(setEmployeeType)} />
          </>
        }
        pagination={{ page: safePage, limit: PAGE_SIZE, total: filtered.length, totalPages }}
        onPageChange={setPage}
        emptyMessage={
          items.length === 0
            ? 'No pending confirmations — everyone with a completed probation has been reviewed.'
            : 'No pending confirmations match the current filters.'
        }
      />

      <ConfirmationActionDialog
        key={`approve-${approveTarget?.id ?? 'none'}`}
        mode="approve"
        target={approveTarget}
        daysOverdue={approveTarget ? daysOverdue(approveTarget.probationEndDate) : 0}
        onClose={() => setApproveTarget(null)}
        onSubmit={handleApprove}
      />

      <FormModal
        title={extendTarget ? `Extend Probation — ${extendTarget.firstName} ${extendTarget.lastName}` : 'Extend Probation'}
        fields={buildExtendFields()}
        initialValues={{}}
        isOpen={extendTarget !== null}
        onClose={() => setExtendTarget(null)}
        onSubmit={handleExtend}
        submitLabel="Extend"
      />

      <ConfirmationActionDialog
        key={`reject-${rejectTarget?.id ?? 'none'}`}
        mode="reject"
        target={rejectTarget}
        daysOverdue={rejectTarget ? daysOverdue(rejectTarget.probationEndDate) : 0}
        onClose={() => setRejectTarget(null)}
        onSubmit={handleReject}
      />
    </div>
  );
}
