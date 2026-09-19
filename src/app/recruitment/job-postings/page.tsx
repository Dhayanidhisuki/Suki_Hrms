/**
 * Job Postings — minimal recruitment list so a JD can be attached
 * (jdId) and show up in JD Master usage / reverse links.
 */

'use client';

import { useCallback, useEffect, useState } from 'react';
import { ConfirmDialog, DataTable, SearchableSelect, useToast, type Column } from '@/components/ui';
import { formatDate } from '@/lib/format-date';

interface JdOption {
  id: number;
  jdCode: string;
  title: string;
  department?: { name: string };
  designation?: { name: string };
}

interface JobPosting {
  id: number;
  title: string;
  status: string;
  createdAt: string;
  jobDescription: { id: number; jdCode: string; title: string } | null;
}

export default function JobPostingsPage() {
  const toast = useToast();
  const [records, setRecords] = useState<JobPosting[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [pagination, setPagination] = useState({ page: 1, limit: 20, total: 0, totalPages: 0 });
  const [modalOpen, setModalOpen] = useState(false);
  const [deleteId, setDeleteId] = useState<number | null>(null);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ page: String(page), limit: '20', ...(search ? { search } : {}) });
      const res = await fetch(`/api/recruitment/job-postings?${params}`);
      if (!res.ok) throw new Error('Failed to fetch job postings');
      const json = await res.json();
      setRecords(json.data);
      setPagination(json.pagination);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  }, [page, search, toast]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const columns: Column<JobPosting>[] = [
    { key: 'title', label: 'Title', className: 'font-medium' },
    {
      key: 'jd',
      label: 'Attached JD',
      render: (row) => (row.jobDescription ? `${row.jobDescription.jdCode} — ${row.jobDescription.title}` : '—'),
    },
    { key: 'status', label: 'Status' },
    { key: 'createdAt', label: 'Created', render: (row) => formatDate(row.createdAt) },
  ];

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold" style={{ color: 'var(--foreground)' }}>
          Job Postings
        </h1>
        <button
          onClick={() => setModalOpen(true)}
          className="rounded-lg px-4 py-2 text-sm font-medium text-white"
          style={{ backgroundColor: 'var(--accent)' }}
        >
          + Add Job Posting
        </button>
      </div>
      <DataTable
        columns={columns}
        data={records}
        pagination={pagination}
        loading={loading}
        searchValue={search}
        onSearchChange={(v) => {
          setSearch(v);
          setPage(1);
        }}
        onPageChange={setPage}
        onDelete={(row) => setDeleteId(row.id)}
      />
      {modalOpen && (
        <CreatePostingModal
          onClose={() => setModalOpen(false)}
          onSaved={() => {
            setModalOpen(false);
            fetchData();
          }}
        />
      )}
      <ConfirmDialog
        title="Delete Job Posting"
        message="Remove this posting? The attached JD is not deleted."
        isOpen={deleteId !== null}
        onConfirm={async () => {
          if (!deleteId) return;
          await fetch(`/api/recruitment/job-postings/${deleteId}`, { method: 'DELETE' });
          fetchData();
        }}
        onClose={() => setDeleteId(null)}
      />
    </div>
  );
}

function CreatePostingModal({ onClose, onSaved }: { onClose: () => void; onSaved: () => void }) {
  const [title, setTitle] = useState('');
  const [jdId, setJdId] = useState<string | number | ''>('');
  const [jds, setJds] = useState<JdOption[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const toast = useToast();

  useEffect(() => {
    fetch('/api/masters/jd-master?status=Active&limit=100')
      .then((r) => r.json())
      .then((json: { data?: JdOption[] }) => setJds(json.data ?? []));
  }, []);

  const submit = async () => {
    if (!title.trim()) {
      toast.error('Title is required');
      return;
    }
    setSubmitting(true);
    try {
      const res = await fetch('/api/recruitment/job-postings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: title.trim(), ...(jdId ? { jdId: Number(jdId) } : {}) }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? 'Save failed');
      onSaved();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Save failed');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ backgroundColor: 'rgba(0,0,0,0.4)' }} onClick={onClose}>
      <div
        className="w-full max-w-md rounded-xl p-5 space-y-4"
        style={{ backgroundColor: 'var(--surface)', border: '1px solid var(--border)' }}
        onClick={(e) => e.stopPropagation()}
      >
        <h2 className="text-base font-semibold" style={{ color: 'var(--foreground)' }}>
          Add Job Posting
        </h2>
        <label className="flex flex-col gap-1 text-sm font-medium">
          Title
          <input
            className="rounded-lg border px-3 py-2 text-sm"
            style={{ borderColor: 'var(--border)', backgroundColor: 'var(--surface)', color: 'var(--foreground)' }}
            value={title}
            onChange={(e) => setTitle(e.target.value)}
          />
        </label>
        <label className="flex flex-col gap-1 text-sm font-medium">
          Attach JD (Active only)
          <SearchableSelect
            value={jdId}
            options={[
              { label: 'None', value: '' },
              ...jds.map((j) => ({
                label: `${j.jdCode} — ${j.title}${j.department ? ` (${j.department.name})` : ''}`,
                value: j.id,
              })),
            ]}
            onChange={setJdId}
            placeholder="Search Active JDs"
          />
        </label>
        <div className="flex justify-end gap-2">
          <button type="button" onClick={onClose} className="rounded-lg border px-4 py-2 text-sm" style={{ borderColor: 'var(--border)' }}>
            Cancel
          </button>
          <button
            type="button"
            onClick={submit}
            disabled={submitting}
            className="rounded-lg px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
            style={{ backgroundColor: 'var(--accent)' }}
          >
            {submitting ? 'Saving...' : 'Create'}
          </button>
        </div>
      </div>
    </div>
  );
}
