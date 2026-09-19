/**
 * My Interviews tab — interviewer's personal queue (BRD §5.10).
 * Shows interviews assigned to the current user, with status filter.
 */

'use client';

import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { DataTable, SearchableSelect, useToast, type Column } from '@/components/ui';

interface InterviewerOption { id: number; firstName: string; lastName: string; employeeCode: string; }

interface ScheduleRow {
  id: number;
  scheduledDate: string;
  startTime: string;
  mode: string;
  locationOrLink: string | null;
  status: string;
  candidate: { id: number; applicationNo: string; firstName: string; lastName: string; mobile: string; email: string; };
  interviewLevel: { id: number; levelName: string; };
  interviewType: { id: number; typeName: string; };
  evaluationSummary: { result: string; weightedScore: number } | null;
}

const STATUS_FILTERS = ['Pending', 'Scheduled', 'Completed', 'Cancelled'];

export default function MyInterviewsTab() {
  const router = useRouter();
  const toast = useToast();
  const [interviewers, setInterviewers] = useState<InterviewerOption[]>([]);
  const [selectedInterviewer, setSelectedInterviewer] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [records, setRecords] = useState<ScheduleRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [page, setPage] = useState(1);
  const [pagination, setPagination] = useState({ page: 1, limit: 20, total: 0, totalPages: 0 });

  useEffect(() => {
    fetch('/api/employees?limit=100').then((r) => r.json()).then((emps) => {
      setInterviewers(emps?.data ?? []);
    });
  }, []);

  const fetchData = useCallback(async () => {
    if (!selectedInterviewer) { setRecords([]); return; }
    setLoading(true);
    try {
      const params = new URLSearchParams({ interviewerId: selectedInterviewer, page: String(page), limit: '20' });
      if (statusFilter) params.set('status', statusFilter);
      const res = await fetch(`/api/recruitment/interview-schedules?${params}`);
      const json = await res.json();
      setRecords(json.data ?? []);
      setPagination(json.pagination ?? { page: 1, limit: 20, total: 0, totalPages: 0 });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed to fetch');
    } finally {
      setLoading(false);
    }
  }, [selectedInterviewer, statusFilter, page, toast]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const interviewerOptions = interviewers.map((e) => ({ label: `${e.employeeCode} — ${e.firstName} ${e.lastName}`, value: e.id }));

  const columns: Column<ScheduleRow>[] = [
    { key: 'candidate', label: 'Candidate', render: (row) => `${row.candidate?.firstName} ${row.candidate?.lastName}` },
    { key: 'interviewLevel', label: 'Level', render: (row) => row.interviewLevel?.levelName ?? '—' },
    { key: 'interviewType', label: 'Type', render: (row) => row.interviewType?.typeName ?? '—' },
    { key: 'scheduledDate', label: 'Date', render: (row) => new Date(row.scheduledDate).toLocaleDateString() },
    { key: 'startTime', label: 'Time', render: (row) => row.startTime },
    { key: 'mode', label: 'Mode' },
    {
      key: 'status', label: 'Status',
      render: (row) => {
        const colors: Record<string, string> = { Completed: '#dcfce7', Scheduled: '#dbeafe', Pending: '#fef3c7', Cancelled: '#fee2e2' };
        const textColors: Record<string, string> = { Completed: '#166534', Scheduled: '#1e40af', Pending: '#92400e', Cancelled: '#991b1b' };
        return <span className="px-2 py-0.5 text-xs font-medium rounded-full" style={{ backgroundColor: colors[row.status] ?? '#f3f4f6', color: textColors[row.status] ?? '#6b7280' }}>{row.status}</span>;
      },
    },
    {
      key: 'result', label: 'Result',
      render: (row) => row.evaluationSummary ? `${row.evaluationSummary.result} (${Number(row.evaluationSummary.weightedScore).toFixed(1)}%)` : '—',
    },
  ];

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <div className="min-w-[240px]">
          <SearchableSelect value={selectedInterviewer} options={interviewerOptions} onChange={(v) => { setSelectedInterviewer(String(v)); setPage(1); }} placeholder="Select interviewer (you)..." />
        </div>
        <select
          className="rounded-lg border px-3 py-2 text-sm"
          style={{ backgroundColor: 'var(--surface)', color: 'var(--foreground)', borderColor: 'var(--border)' }}
          value={statusFilter}
          onChange={(e) => { setStatusFilter(e.target.value); setPage(1); }}
        >
          <option value="">All statuses</option>
          {STATUS_FILTERS.map((s) => <option key={s} value={s}>{s}</option>)}
        </select>
      </div>

      {!selectedInterviewer ? (
        <div className="card p-8 text-center">
          <p className="text-sm" style={{ color: 'var(--foreground-muted)' }}>Select an interviewer to view their queue.</p>
        </div>
      ) : (
        <DataTable
          columns={columns}
          data={records}
          pagination={pagination}
          loading={loading}
          onPageChange={setPage}
          renderRowActions={(row) => (
            row.status === 'Scheduled' ? (
              <button
                onClick={() => router.push(`/recruitment/interviews?tab=evaluation&scheduleId=${row.id}`)}
                className="text-xs font-medium hover:underline"
                style={{ color: 'var(--accent)' }}
              >
                Evaluate
              </button>
            ) : row.status === 'Completed' ? (
              <button
                onClick={() => router.push(`/recruitment/interviews?tab=evaluation&scheduleId=${row.id}`)}
                className="text-xs font-medium hover:underline"
                style={{ color: 'var(--accent)' }}
              >
                View
              </button>
            ) : null
          )}
        />
      )}
    </div>
  );
}
