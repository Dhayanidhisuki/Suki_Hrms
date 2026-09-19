/**
 * Applicant Pipeline tab — candidate grid with filters (BRD §5.2, §5.19).
 * Row click opens Candidate 360°.
 */

'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { DataTable, SearchableSelect, useToast, type Column } from '@/components/ui';

interface OrgOption { id: number; name: string; code: string; }
interface StatusOption { id: number; statusCode: string; statusName: string; color: string | null; }

interface CandidateRow {
  id: number;
  applicationNo: string;
  fullName: string;
  firstName: string;
  lastName: string;
  mobile: string;
  email: string;
  departmentId: number | null;
  designationId: number | null;
  currentStatusId: number | null;
  createdAt: string;
  department?: OrgOption;
  designation?: OrgOption;
  currentStatus?: StatusOption;
  jobPosting?: { id: number; title: string };
  sourceChannel?: { id: number; channelName: string };
}

interface ApiResponse {
  data: CandidateRow[];
  pagination: { page: number; limit: number; total: number; totalPages: number };
}

export default function PipelineTab() {
  const router = useRouter();
  const toast = useToast();
  const [records, setRecords] = useState<CandidateRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [pagination, setPagination] = useState({ page: 1, limit: 20, total: 0, totalPages: 0 });

  const [departments, setDepartments] = useState<OrgOption[]>([]);
  const [designations, setDesignations] = useState<OrgOption[]>([]);
  const [statuses, setStatuses] = useState<StatusOption[]>([]);

  const [filterDept, setFilterDept] = useState('');
  const [filterStatus, setFilterStatus] = useState('');

  useEffect(() => {
    Promise.all([
      fetch('/api/org-options?table=Department').then((r) => r.json()),
      fetch('/api/org-options?table=Designation').then((r) => r.json()),
      fetch('/api/masters/recruitment-status?limit=100').then((r) => r.json()),
    ]).then(([depts, desigs, stats]) => {
      setDepartments(Array.isArray(depts) ? depts : []);
      setDesignations(Array.isArray(desigs) ? desigs : []);
      setStatuses(stats?.data ?? []);
    });
  }, []);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ page: String(page), limit: '20' });
      if (search) params.set('search', search);
      if (filterDept) params.set('departmentId', filterDept);
      if (filterStatus) params.set('statusId', filterStatus);
      const res = await fetch(`/api/recruitment/candidates?${params}`);
      const json: ApiResponse = await res.json();
      setRecords(json.data ?? []);
      setPagination(json.pagination ?? { page: 1, limit: 20, total: 0, totalPages: 0 });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed to fetch');
    } finally {
      setLoading(false);
    }
  }, [page, search, filterDept, filterStatus, toast]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const deptOptions = useMemo(() => departments.map((d) => ({ label: `${d.code} — ${d.name}`, value: d.id })), [departments]);
  const statusOptions = useMemo(() => statuses.map((s) => ({ label: s.statusName, value: s.id })), [statuses]);

  const columns: Column<CandidateRow>[] = [
    { key: 'applicationNo', label: 'App No', sortable: true, className: 'font-medium' },
    { key: 'fullName', label: 'Name', sortable: true },
    { key: 'mobile', label: 'Mobile' },
    { key: 'email', label: 'Email' },
    { key: 'department', label: 'Department', render: (row) => row.department?.name ?? '—' },
    { key: 'designation', label: 'Designation', render: (row) => row.designation?.name ?? '—' },
    {
      key: 'currentStatus',
      label: 'Status',
      render: (row) => {
        const s = row.currentStatus;
        if (!s) return '—';
        return (
          <span className="px-2 py-0.5 text-xs font-medium rounded-full" style={{ backgroundColor: (s.color ?? '#6b7280') + '20', color: s.color ?? '#6b7280' }}>
            {s.statusName}
          </span>
        );
      },
    },
    { key: 'createdAt', label: 'Applied', render: (row) => new Date(row.createdAt).toLocaleDateString() },
  ];

  return (
    <div className="space-y-4">
      <DataTable
        columns={columns}
        data={records}
        pagination={pagination}
        loading={loading}
        searchValue={search}
        searchPlaceholder="Search application no, name, mobile, email..."
        onSearchChange={(v) => { setSearch(v); setPage(1); }}
        onPageChange={setPage}
        renderRowActions={(row) => (
          <button
            onClick={() => router.push(`/recruitment/applicants?tab=candidate-360&candidateId=${row.id}`)}
            className="text-xs font-medium hover:underline"
            style={{ color: 'var(--accent)' }}
          >
            View 360°
          </button>
        )}
        filters={
          <>
            <div className="min-w-[180px]">
              <SearchableSelect
                value={filterDept}
                options={deptOptions}
                onChange={(v) => { setFilterDept(String(v)); setPage(1); }}
                placeholder="Department"
              />
            </div>
            <div className="min-w-[180px]">
              <SearchableSelect
                value={filterStatus}
                options={statusOptions}
                onChange={(v) => { setFilterStatus(String(v)); setPage(1); }}
                placeholder="Status"
              />
            </div>
            {(filterDept || filterStatus) && (
              <button
                type="button"
                onClick={() => { setFilterDept(''); setFilterStatus(''); setPage(1); }}
                className="rounded-lg border px-4 py-2 text-sm font-medium transition hover:opacity-80"
                style={{ borderColor: 'var(--border)', color: 'var(--foreground)' }}
              >
                Clear
              </button>
            )}
          </>
        }
      />
    </div>
  );
}
