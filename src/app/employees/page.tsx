/**
 * Employee Master — list page.
 * Real DB data, server-side pagination/search/filtering, themed via the
 * shared ui kit (DataTable) instead of hardcoded gray classes.
 */

'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { DataTable, type Column, KPICard, KPIGrid, useToast } from '@/components/ui';
import { useModuleStats } from '@/hooks/useModuleStats';

interface ExpirySummary {
  total: number;
  expired: number;
  expiringSoon: number;
  valid: number;
  noExpiry: number;
}

interface EmployeeListItem {
  id: number;
  employeeCode: string;
  oldEmployeeCode: string | null;
  firstName: string;
  middleName: string | null;
  lastName: string;
  status: string;
  isActive: boolean;
  company: { id: number; name: string } | null;
  jobInfos: Array<{
    department: { name: string };
    designation: { name: string };
    employeeType: { name: string };
    unit: { name: string } | null;
  }>;
  reportingManager: { firstName: string; lastName: string; employeeCode: string } | null;
  secondReportingManager: { firstName: string; lastName: string; employeeCode: string } | null;
  documentExpirySummary: ExpirySummary;
  createdAt: string;
}

interface ApiResponse {
  data: EmployeeListItem[];
  pagination: { page: number; limit: number; total: number; totalPages: number };
}

interface Option {
  id: number;
  name: string;
}

const PAGE_SIZE = 15;

const STATUS_OPTIONS = [
  { label: 'Active', value: 'active' },
  { label: 'On Leave', value: 'on-leave' },
  { label: 'Terminated', value: 'terminated' },
  { label: 'Resigned', value: 'resigned' },
];

const STATUS_TONE: Record<string, { bg: string; fg: string }> = {
  active: { bg: 'var(--success-soft)', fg: 'var(--success)' },
  'on-leave': { bg: 'var(--warning-soft)', fg: 'var(--warning)' },
  terminated: { bg: 'var(--danger-soft)', fg: 'var(--danger)' },
  resigned: { bg: 'var(--danger-soft)', fg: 'var(--danger)' },
};

/* ── Icons (inline; the project has no icon library) ─────────────────── */

const Icon = {
  Download: () => (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
      <path d="m7 10 5 5 5-5" />
      <path d="M12 15V3" />
    </svg>
  ),
  Plus: () => (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
      <path d="M12 5v14" />
      <path d="M5 12h14" />
    </svg>
  ),
  Eye: () => (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M2.06 12.35a1 1 0 0 1 0-.7 10.75 10.75 0 0 1 19.88 0 1 1 0 0 1 0 .7 10.75 10.75 0 0 1-19.88 0" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  ),
  ExternalLink: () => (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M15 3h6v6" />
      <path d="M10 14 21 3" />
      <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
    </svg>
  ),
  FileCheck: () => (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7Z" />
      <path d="M14 2v4a2 2 0 0 0 2 2h4" />
      <path d="m9 15 2 2 4-4" />
    </svg>
  ),
  ChevronDown: () => (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="m6 9 6 6 6-6" />
    </svg>
  ),
};

/* ── Filter select (native <select> styled to match the mockup) ──────── */

function FilterSelect({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: string;
  options: Array<{ label: string; value: string }>;
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
        className="w-full cursor-pointer select-bare appearance-none bg-transparent py-2 pl-3 pr-8 focus:outline-none"
        style={{ color: value ? 'var(--foreground)' : 'var(--foreground-muted)' }}
      >
        <option value="">{label}</option>
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
      <span className="pointer-events-none absolute right-2.5" style={{ color: 'var(--foreground-muted)' }}>
        <Icon.ChevronDown />
      </span>
    </label>
  );
}

/* ── Page ─────────────────────────────────────────────────────────────── */

export default function EmployeeListPage() {
  const toast = useToast();
  const [employees, setEmployees] = useState<EmployeeListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [pagination, setPagination] = useState({ page: 1, limit: PAGE_SIZE, total: 0, totalPages: 0 });

  const { stats } = useModuleStats('employees');

  const [departmentId, setDepartmentId] = useState('');
  const [designationId, setDesignationId] = useState('');
  const [employeeTypeId, setEmployeeTypeId] = useState('');
  const [status, setStatus] = useState('');

  const [departments, setDepartments] = useState<Option[]>([]);
  const [designations, setDesignations] = useState<Option[]>([]);
  const [employeeTypes, setEmployeeTypes] = useState<Option[]>([]);

  // Filter option lists — loaded once.
  useEffect(() => {
    const load = async (table: string, set: (o: Option[]) => void) => {
      try {
        const res = await fetch(`/api/org-options?table=${table}`);
        if (res.ok) set(await res.json());
      } catch {
        /* dropdown simply stays empty */
      }
    };
    load('Department', setDepartments);
    load('Designation', setDesignations);
    load('EmployeeType', setEmployeeTypes);
  }, []);

  const filterParams = useCallback(() => {
    const p = new URLSearchParams();
    if (search) p.set('search', search);
    if (departmentId) p.set('departmentId', departmentId);
    if (designationId) p.set('designationId', designationId);
    if (employeeTypeId) p.set('employeeTypeId', employeeTypeId);
    if (status) p.set('status', status);
    return p;
  }, [search, departmentId, designationId, employeeTypeId, status]);

  const fetchEmployees = useCallback(async () => {
    setLoading(true);
    try {
      const params = filterParams();
      params.set('page', String(page));
      params.set('limit', String(PAGE_SIZE));
      const res = await fetch(`/api/employees?${params}`);
      if (!res.ok) throw new Error('Failed to fetch employees');
      const json: ApiResponse = await res.json();
      setEmployees(json.data);
      setPagination(json.pagination);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  }, [page, filterParams, toast]);

  useEffect(() => {
    fetchEmployees();
  }, [fetchEmployees]);

  /** Any filter change resets to page 1. */
  const withReset =
    (set: (v: string) => void) =>
    (v: string) => {
      set(v);
      setPage(1);
    };

  const exportQuery = filterParams().toString();
  const exportHref = `/api/employees/export${exportQuery ? `?${exportQuery}` : ''}`;

  const columns: Column<EmployeeListItem>[] = [
    { key: 'oldEmployeeCode', label: 'Employee Code', className: 'font-medium', render: (row) => row.oldEmployeeCode ?? '—' },
    { key: 'employeeCode', label: 'Reference Code' },
    {
      key: 'name',
      label: 'Name',
      render: (row) => (
        <span className="inline-flex items-center gap-2">
          <Link href={`/employees/${row.id}`} className="font-medium hover:underline" style={{ color: 'var(--accent)' }}>
            {row.firstName} {row.middleName ?? ''} {row.lastName}
          </Link>
          {!row.isActive && (
            <span
              className="px-2 py-0.5 text-xs font-medium rounded-full"
              style={{ backgroundColor: 'var(--danger-soft)', color: 'var(--danger)' }}
            >
              Inactive
            </span>
          )}
        </span>
      ),
    },
    { key: 'company', label: 'Company/Unit', render: (row) => row.jobInfos[0]?.unit?.name ?? row.company?.name ?? '—' },
    { key: 'department', label: 'Department', render: (row) => row.jobInfos[0]?.department.name ?? '—' },
    { key: 'designation', label: 'Designation', render: (row) => row.jobInfos[0]?.designation.name ?? '—' },
    { key: 'employeeType', label: 'Type', render: (row) => row.jobInfos[0]?.employeeType.name ?? '—' },
    {
      key: 'reportingManager',
      label: 'Reporting Manager',
      render: (row) =>
        row.reportingManager ? `${row.reportingManager.firstName} ${row.reportingManager.lastName}` : '—',
    },
    {
      key: 'secondReportingManager',
      label: 'Second Manager',
      render: (row) =>
        row.secondReportingManager ? `${row.secondReportingManager.firstName} ${row.secondReportingManager.lastName}` : '—',
    },
    {
      key: 'status',
      label: 'Status',
      render: (row) => {
        const tone = STATUS_TONE[row.status] ?? { bg: 'var(--surface-muted)', fg: 'var(--foreground-muted)' };
        return (
          <span
            className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium"
            style={{ backgroundColor: tone.bg, color: tone.fg }}
          >
            <span className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: tone.fg }} />
            {row.status}
          </span>
        );
      },
    },
    {
      key: 'documents',
      label: 'Docs',
      render: (row) => {
        const s = row.documentExpirySummary;
        if (s.total === 0) return <span style={{ color: 'var(--foreground-muted)' }}>—</span>;
        const color = s.expired > 0 ? 'var(--danger)' : s.expiringSoon > 0 ? 'var(--warning)' : 'var(--success)';
        const title =
          s.expired > 0
            ? `${s.expired} expired`
            : s.expiringSoon > 0
              ? `${s.expiringSoon} expiring soon`
              : `${s.total} document${s.total !== 1 ? 's' : ''} valid`;
        return (
          <span className="inline-flex items-center gap-1 text-xs" style={{ color }} title={title}>
            <Icon.FileCheck />
            {s.total}
          </span>
        );
      },
    },
  ];

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold" style={{ color: 'var(--foreground)' }}>
            Employee Master
          </h1>
          <p className="text-sm" style={{ color: 'var(--foreground-muted)' }}>
            {pagination.total} employee{pagination.total !== 1 ? 's' : ''}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <a
            href={exportHref}
            className="inline-flex items-center gap-2 rounded-lg border px-4 py-2 text-sm font-medium transition hover:opacity-80"
            style={{ borderColor: 'var(--accent)', color: 'var(--accent)', backgroundColor: 'var(--surface)' }}
          >
            <Icon.Download />
            Export CSV
          </a>
          <Link
            href="/employees/bulk-upload"
            className="rounded-lg border px-4 py-2 text-sm font-medium transition hover:opacity-80"
            style={{ borderColor: 'var(--border)', color: 'var(--foreground)' }}
          >
            Bulk Upload
          </Link>
          <Link
            href="/employees/new"
            className="inline-flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium text-white transition hover:opacity-90"
            style={{ backgroundColor: 'var(--accent)' }}
          >
            <Icon.Plus />
            Add Employee
          </Link>
        </div>
      </div>

      {/* KPI Cards */}
      <KPIGrid columns={3}>
        <KPICard label="Total Employees" value={stats.total} tone="info" />
        <KPICard label="Active" value={stats.active ?? 0} tone="success" />
        <KPICard label="Inactive" value={stats.inactive ?? 0} tone="danger" />
      </KPIGrid>

      <DataTable
        variant="card"
        columns={columns}
        data={employees}
        pagination={pagination}
        loading={loading}
        searchValue={search}
        searchPlaceholder="Search by code or name..."
        onSearchChange={withReset(setSearch)}
        filters={
          <>
            <FilterSelect
              label="Department"
              value={departmentId}
              options={departments.map((d) => ({ label: d.name, value: String(d.id) }))}
              onChange={withReset(setDepartmentId)}
            />
            <FilterSelect
              label="Designation"
              value={designationId}
              options={designations.map((d) => ({ label: d.name, value: String(d.id) }))}
              onChange={withReset(setDesignationId)}
            />
            <FilterSelect
              label="Type"
              value={employeeTypeId}
              options={employeeTypes.map((t) => ({ label: t.name, value: String(t.id) }))}
              onChange={withReset(setEmployeeTypeId)}
            />
            <FilterSelect label="Status" value={status} options={STATUS_OPTIONS} onChange={withReset(setStatus)} />
          </>
        }
        onPageChange={setPage}
        renderRowActions={(row) => (
          <span className="inline-flex items-center gap-1">
            <Link
              href={`/employees/${row.id}`}
              title="View employee"
              aria-label="View employee"
              className="rounded-md p-1.5 transition hover:opacity-70"
              style={{ color: 'var(--foreground-muted)' }}
            >
              <Icon.Eye />
            </Link>
            <a
              href={`/employees/${row.id}`}
              target="_blank"
              rel="noopener noreferrer"
              title="Open in new tab"
              aria-label="Open in new tab"
              className="rounded-md p-1.5 transition hover:opacity-70"
              style={{ color: 'var(--accent)' }}
            >
              <Icon.ExternalLink />
            </a>
          </span>
        )}
        emptyMessage='No employees found. Click "Add Employee" to create one.'
      />
    </div>
  );
}
