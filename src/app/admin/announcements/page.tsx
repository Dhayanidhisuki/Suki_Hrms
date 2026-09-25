/**
 * Administration — Announcements & Circulars authoring.
 *
 * Drafts are editable; published items are frozen and can only be archived
 * (or cloned into a fresh draft), because staff have already been told what
 * they said. The read count next to a published item is what makes a policy
 * circular auditable — the "Reads" action drills into who has/hasn't.
 */

'use client';

import { useState, useEffect, useCallback } from 'react';
import { DataTable, StatusPillTabs, OverlayModal, useToast, useConfirm, type Column } from '@/components/ui';

interface Announcement {
  id: number;
  title: string;
  body: string;
  category: string;
  priority: string;
  status: string;
  publishedAt: string | null;
  expiresAt: string | null;
  createdAt: string;
  readCount: number;
  audienceSize: number;
  audienceScopeType: string | null;
  audienceScopeValues: string | null;
}

interface ApiResponse {
  data: Announcement[];
  pagination: { page: number; limit: number; total: number; totalPages: number };
}

interface ReadReceipt { employeeId: number; employeeCode: string; name: string; readAt?: string }
interface AnnouncementDetail { reads: ReadReceipt[]; notRead: ReadReceipt[] }

const CATEGORIES = ['GENERAL', 'POLICY', 'CIRCULAR'] as const;
const PRIORITIES = ['NORMAL', 'IMPORTANT'] as const;

const AUDIENCE_SCOPES: Array<{ value: string; label: string; endpoint: string }> = [
  { value: 'DEPARTMENT', label: 'Department', endpoint: '/api/masters/departments' },
  { value: 'SUB_DEPARTMENT', label: 'Sub-department', endpoint: '/api/masters/sub-departments' },
  { value: 'DESIGNATION', label: 'Designation', endpoint: '/api/masters/designations' },
  { value: 'EMPLOYEE_TYPE', label: 'Employee type', endpoint: '/api/masters/employee-types' },
  { value: 'UNIT', label: 'Unit', endpoint: '/api/masters/units' },
];
const AUDIENCE_LABEL: Record<string, string> = Object.fromEntries(AUDIENCE_SCOPES.map((s) => [s.value, s.label]));

const STATUS_TONE: Record<string, { bg: string; fg: string }> = {
  DRAFT: { bg: '#f1f5f9', fg: '#475569' },
  PUBLISHED: { bg: '#dcfce7', fg: '#166534' },
  ARCHIVED: { bg: '#fee2e2', fg: '#b91c1c' },
};

const EMPTY_FORM = {
  title: '',
  body: '',
  category: 'GENERAL',
  priority: 'NORMAL',
  expiresAt: '',
  audienceScopeType: '',
  audienceScopeValues: [] as string[],
};

function fullDate(iso: string | null) {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
}

export default function AdminAnnouncementsPage() {
  const { confirm } = useConfirm();
  const toast = useToast();
  const [items, setItems] = useState<Announcement[]>([]);
  const [pagination, setPagination] = useState({ page: 1, limit: 20, total: 0, totalPages: 0 });
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [form, setForm] = useState({ ...EMPTY_FORM });

  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('');
  const [category, setCategory] = useState('');
  const [page, setPage] = useState(1);

  // Options for whichever audience scope type is currently selected in the form.
  const [audienceOptions, setAudienceOptions] = useState<Array<{ code: string; name: string }>>([]);
  const [audienceOptionsLoading, setAudienceOptionsLoading] = useState(false);

  const [readsFor, setReadsFor] = useState<Announcement | null>(null);
  const [readsDetail, setReadsDetail] = useState<AnnouncementDetail | null>(null);
  const [readsLoading, setReadsLoading] = useState(false);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        page: String(page),
        limit: '20',
        ...(search ? { search } : {}),
        ...(status ? { status } : {}),
        ...(category ? { category } : {}),
      });
      const res = await fetch(`/api/platform/announcement?${params}`);
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        throw new Error(j.error ?? 'Failed to load announcements');
      }
      const json: ApiResponse = await res.json();
      setItems(json.data ?? []);
      setPagination(json.pagination);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to load announcements');
    } finally {
      setLoading(false);
    }
  }, [page, search, status, category, toast]);

  useEffect(() => {
    void fetchData();
  }, [fetchData]);

  const loadAudienceOptions = async (scopeType: string) => {
    if (!scopeType) {
      setAudienceOptions([]);
      return;
    }
    const scope = AUDIENCE_SCOPES.find((s) => s.value === scopeType);
    if (!scope) return;
    setAudienceOptionsLoading(true);
    try {
      const res = await fetch(`${scope.endpoint}?status=active&limit=200`);
      const json = await res.json().catch(() => ({}));
      setAudienceOptions((json.data ?? []).map((r: { code: string; name: string }) => ({ code: r.code, name: r.name })));
    } catch {
      setAudienceOptions([]);
    } finally {
      setAudienceOptionsLoading(false);
    }
  };

  const resetForm = () => {
    setForm({ ...EMPTY_FORM });
    setAudienceOptions([]);
    setEditingId(null);
    setShowForm(false);
  };

  const save = async () => {
    setBusy(true);
    try {
      const payload = {
        title: form.title,
        body: form.body,
        category: form.category,
        priority: form.priority,
        // A blank date field means "no expiry", which the API models as null.
        expiresAt: form.expiresAt ? new Date(form.expiresAt).toISOString() : null,
        audienceScopeType: form.audienceScopeType || null,
        audienceScopeValues: form.audienceScopeType ? form.audienceScopeValues : [],
      };
      const res = await fetch(
        editingId ? `/api/platform/announcement/${editingId}` : '/api/platform/announcement',
        {
          method: editingId ? 'PUT' : 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        }
      );
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        throw new Error(j.error ?? 'Save failed');
      }
      resetForm();
      await fetchData();
      toast.success(editingId ? 'Announcement updated successfully.' : 'Draft created successfully.');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Save failed');
    } finally {
      setBusy(false);
    }
  };

  const publish = async (a: Announcement) => {
    if (
      !(await confirm({
        title: 'Publish announcement?',
        message: `"${a.title}" goes out to ${a.audienceScopeType ? `${a.audienceSize} employees in the selected ${AUDIENCE_LABEL[a.audienceScopeType]?.toLowerCase()}` : `all ${a.audienceSize} employees`}. It cannot be edited afterwards.`,
        confirmLabel: 'Publish',
      }))
    )
      return;
    setBusy(true);
    try {
      const res = await fetch(`/api/platform/announcement/${a.id}/publish`, { method: 'POST' });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        throw new Error(j.error ?? 'Publish failed');
      }
      await fetchData();
      toast.success('Announcement published successfully.');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Publish failed');
    } finally {
      setBusy(false);
    }
  };

  const remove = async (a: Announcement) => {
    const isDraft = a.status === 'DRAFT';
    if (
      !(await confirm({
        title: isDraft ? 'Delete draft?' : 'Archive announcement?',
        message: isDraft
          ? `"${a.title}" will be deleted.`
          : `"${a.title}" will be archived and employees will stop seeing it.`,
        confirmLabel: isDraft ? 'Delete' : 'Archive',
        tone: 'danger',
      }))
    )
      return;
    setBusy(true);
    try {
      const res = await fetch(`/api/platform/announcement/${a.id}`, { method: 'DELETE' });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        throw new Error(j.error ?? 'Failed');
      }
      await fetchData();
      toast.success(isDraft ? 'Draft deleted successfully.' : 'Announcement archived successfully.');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed');
    } finally {
      setBusy(false);
    }
  };

  const clone = async (a: Announcement) => {
    setBusy(true);
    try {
      const res = await fetch(`/api/platform/announcement/${a.id}/clone`, { method: 'POST' });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        throw new Error(j.error ?? 'Clone failed');
      }
      const created: Announcement = await res.json();
      await fetchData();
      await startEdit(created);
      toast.success('Announcement cloned as a new draft.');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Clone failed');
    } finally {
      setBusy(false);
    }
  };

  const openReads = async (a: Announcement) => {
    setReadsFor(a);
    setReadsDetail(null);
    setReadsLoading(true);
    try {
      const res = await fetch(`/api/platform/announcement/${a.id}`);
      if (!res.ok) throw new Error('Failed to load read receipts');
      const json = await res.json();
      setReadsDetail({ reads: json.reads ?? [], notRead: json.notRead ?? [] });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to load read receipts');
      setReadsFor(null);
    } finally {
      setReadsLoading(false);
    }
  };

  const startEdit = async (a: Announcement) => {
    setEditingId(a.id);
    setForm({
      title: a.title,
      body: a.body,
      category: a.category,
      priority: a.priority,
      expiresAt: a.expiresAt ? a.expiresAt.slice(0, 10) : '',
      audienceScopeType: a.audienceScopeType ?? '',
      audienceScopeValues: a.audienceScopeValues ? a.audienceScopeValues.split(',').filter(Boolean) : [],
    });
    setShowForm(true);
    if (a.audienceScopeType) await loadAudienceOptions(a.audienceScopeType);
  };

  const inputStyle = {
    backgroundColor: 'var(--surface)',
    color: 'var(--foreground)',
    borderColor: 'var(--border)',
  };

  const columns: Column<Announcement>[] = [
    {
      key: 'title',
      label: 'Title',
      render: (a) => (
        <span className="font-medium" style={{ color: 'var(--foreground)' }}>
          {a.title}
          {a.priority === 'IMPORTANT' && (
            <span className="ml-2 rounded-full px-2 py-0.5 text-[11px] font-semibold" style={{ backgroundColor: '#fee2e2', color: '#b91c1c' }}>
              IMPORTANT
            </span>
          )}
        </span>
      ),
    },
    { key: 'category', label: 'Category' },
    {
      key: 'audience',
      label: 'Audience',
      render: (a) => (a.audienceScopeType ? `${AUDIENCE_LABEL[a.audienceScopeType] ?? a.audienceScopeType} (${a.audienceSize})` : 'All employees'),
    },
    {
      key: 'status',
      label: 'Status',
      render: (a) => {
        const tone = STATUS_TONE[a.status] ?? STATUS_TONE.DRAFT;
        return (
          <span className="rounded-full px-2 py-0.5 text-xs font-medium" style={{ backgroundColor: tone.bg, color: tone.fg }}>
            {a.status}
          </span>
        );
      },
    },
    { key: 'publishedAt', label: 'Published', render: (a) => fullDate(a.publishedAt) },
    {
      key: 'read',
      label: 'Read',
      render: (a) =>
        a.status === 'DRAFT' ? (
          '—'
        ) : (
          <button type="button" onClick={() => void openReads(a)} className="hover:underline" style={{ color: 'var(--accent)' }}>
            {a.readCount} of {a.audienceSize}
          </button>
        ),
    },
  ];

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h1 className="text-xl font-semibold" style={{ color: 'var(--foreground)' }}>
          Announcements &amp; Circulars
        </h1>
        <button
          type="button"
          onClick={() => (showForm ? resetForm() : setShowForm(true))}
          className="rounded-lg px-4 py-2 text-sm font-semibold text-white"
          style={{ background: 'var(--accent)' }}
        >
          {showForm ? 'Cancel' : '+ New Announcement'}
        </button>
      </div>

      {showForm && (
        <div className="space-y-3 rounded-lg border p-4" style={{ borderColor: 'var(--border)' }}>
          <input
            value={form.title}
            onChange={(e) => setForm({ ...form, title: e.target.value })}
            placeholder="Title"
            className="w-full rounded-lg border px-3 py-2 text-sm"
            style={inputStyle}
          />
          <textarea
            value={form.body}
            onChange={(e) => setForm({ ...form, body: e.target.value })}
            placeholder="Announcement text…"
            rows={6}
            className="w-full rounded-lg border px-3 py-2 text-sm"
            style={inputStyle}
          />
          <div className="flex flex-wrap gap-3">
            <label className="text-xs" style={{ color: 'var(--foreground-muted)' }}>
              Category
              <select
                value={form.category}
                onChange={(e) => setForm({ ...form, category: e.target.value })}
                className="mt-1 block rounded-lg border px-3 py-2 text-sm"
                style={inputStyle}
              >
                {CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
              </select>
            </label>
            <label className="text-xs" style={{ color: 'var(--foreground-muted)' }}>
              Priority
              <select
                value={form.priority}
                onChange={(e) => setForm({ ...form, priority: e.target.value })}
                className="mt-1 block rounded-lg border px-3 py-2 text-sm"
                style={inputStyle}
              >
                {PRIORITIES.map((c) => <option key={c} value={c}>{c}</option>)}
              </select>
            </label>
            <label className="text-xs" style={{ color: 'var(--foreground-muted)' }}>
              Valid until (optional)
              <input
                type="date"
                value={form.expiresAt}
                onChange={(e) => setForm({ ...form, expiresAt: e.target.value })}
                className="mt-1 block rounded-lg border px-3 py-2 text-sm"
                style={inputStyle}
              />
            </label>
          </div>

          <div className="rounded-lg border p-3" style={{ borderColor: 'var(--border)' }}>
            <label className="text-xs font-medium" style={{ color: 'var(--foreground-muted)' }}>
              Send to
              <select
                value={form.audienceScopeType}
                onChange={(e) => {
                  const scopeType = e.target.value;
                  setForm({ ...form, audienceScopeType: scopeType, audienceScopeValues: [] });
                  void loadAudienceOptions(scopeType);
                }}
                className="mt-1 block rounded-lg border px-3 py-2 text-sm"
                style={inputStyle}
              >
                <option value="">All employees</option>
                {AUDIENCE_SCOPES.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
              </select>
            </label>

            {form.audienceScopeType && (
              <div className="mt-2">
                <p className="mb-1 text-xs" style={{ color: 'var(--foreground-muted)' }}>
                  {audienceOptionsLoading ? 'Loading options…' : `Select one or more ${AUDIENCE_LABEL[form.audienceScopeType]?.toLowerCase()}(s)`}
                </p>
                <select
                  multiple
                  value={form.audienceScopeValues}
                  onChange={(e) => setForm({ ...form, audienceScopeValues: Array.from(e.target.selectedOptions).map((o) => o.value) })}
                  className="block w-full rounded-lg border px-3 py-2 text-sm"
                  style={{ ...inputStyle, minHeight: '7rem' }}
                >
                  {audienceOptions.map((o) => (
                    <option key={o.code} value={o.code}>{o.name}</option>
                  ))}
                </select>
              </div>
            )}
          </div>

          <button
            type="button"
            disabled={
              busy ||
              form.title.trim().length < 3 ||
              !form.body.trim() ||
              (Boolean(form.audienceScopeType) && form.audienceScopeValues.length === 0)
            }
            onClick={() => void save()}
            className="rounded-lg px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
            style={{ background: 'var(--accent)' }}
          >
            {editingId ? 'Save Draft' : 'Create Draft'}
          </button>
          <p className="text-xs" style={{ color: 'var(--foreground-muted)' }}>
            Saved as a draft. Nothing reaches employees until you publish it.
          </p>
        </div>
      )}

      <DataTable
        columns={columns}
        data={items}
        pagination={pagination}
        loading={loading}
        filtersLead
        filters={
          <>
            <StatusPillTabs
              items={[
                { value: '', label: 'All' },
                { value: 'DRAFT', label: 'Draft', tone: 'neutral' },
                { value: 'PUBLISHED', label: 'Published', tone: 'success' },
                { value: 'ARCHIVED', label: 'Archived', tone: 'danger' },
              ]}
              value={status}
              onChange={(v) => { setStatus(v); setPage(1); }}
              idPrefix="announcements-status"
            />
            <select
              value={category}
              onChange={(e) => { setCategory(e.target.value); setPage(1); }}
              className="rounded-lg border px-2.5 py-1 text-xs"
              style={inputStyle}
            >
              <option value="">All categories</option>
              {CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
          </>
        }
        searchValue={search}
        searchPlaceholder="Search by title…"
        onSearchChange={(v) => { setSearch(v); setPage(1); }}
        onPageChange={setPage}
        emptyMessage="No announcements yet."
        renderRowActions={(a) => (
          <div className="flex items-center justify-end gap-3 whitespace-nowrap">
            {a.status === 'DRAFT' && (
              <>
                <button type="button" disabled={busy} onClick={() => void startEdit(a)} className="text-xs font-semibold" style={{ color: 'var(--info)' }}>
                  Edit
                </button>
                <button type="button" disabled={busy} onClick={() => void publish(a)} className="text-xs font-semibold" style={{ color: 'var(--success)' }}>
                  Publish
                </button>
              </>
            )}
            <button type="button" disabled={busy} onClick={() => void clone(a)} className="text-xs font-semibold" style={{ color: 'var(--foreground-muted)' }}>
              Clone
            </button>
            {a.status !== 'ARCHIVED' && (
              <button type="button" disabled={busy} onClick={() => void remove(a)} className="text-xs font-semibold text-red-600">
                {a.status === 'DRAFT' ? 'Delete' : 'Archive'}
              </button>
            )}
          </div>
        )}
      />

      <OverlayModal
        open={readsFor !== null}
        title={`Read receipts — ${readsFor?.title ?? ''}`}
        subtitle={readsDetail ? `${readsDetail.reads.length} read · ${readsDetail.notRead.length} not yet read` : undefined}
        onClose={() => { setReadsFor(null); setReadsDetail(null); }}
        size="md"
      >
        {readsLoading || !readsDetail ? (
          <div className="py-6 text-center text-sm" style={{ color: 'var(--foreground-muted)' }}>Loading…</div>
        ) : (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <h3 className="mb-2 text-xs font-semibold uppercase" style={{ color: 'var(--success)' }}>
                Read ({readsDetail.reads.length})
              </h3>
              <ul className="max-h-72 space-y-1 overflow-y-auto text-sm">
                {readsDetail.reads.length === 0 && <li style={{ color: 'var(--foreground-muted)' }}>No one yet.</li>}
                {readsDetail.reads.map((r) => (
                  <li key={r.employeeId} className="flex justify-between gap-2">
                    <span>{r.name} <span style={{ color: 'var(--foreground-muted)' }}>({r.employeeCode})</span></span>
                  </li>
                ))}
              </ul>
            </div>
            <div>
              <h3 className="mb-2 text-xs font-semibold uppercase" style={{ color: 'var(--danger)' }}>
                Not yet read ({readsDetail.notRead.length})
              </h3>
              <ul className="max-h-72 space-y-1 overflow-y-auto text-sm">
                {readsDetail.notRead.length === 0 && <li style={{ color: 'var(--foreground-muted)' }}>Everyone has read this.</li>}
                {readsDetail.notRead.map((r) => (
                  <li key={r.employeeId} className="flex justify-between gap-2">
                    <span>{r.name} <span style={{ color: 'var(--foreground-muted)' }}>({r.employeeCode})</span></span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        )}
      </OverlayModal>
    </div>
  );
}
