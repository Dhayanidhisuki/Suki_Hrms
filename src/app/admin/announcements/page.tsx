/**
 * Administration — Announcements & Circulars authoring.
 *
 * Drafts are editable; published items are frozen and can only be archived,
 * because staff have already been told what they said. The read count next to
 * a published item is what makes a policy circular auditable.
 */

'use client';

import { useState, useEffect, useCallback } from 'react';
import { useToast, useConfirm } from '@/components/ui';

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
}

const CATEGORIES = ['GENERAL', 'POLICY', 'CIRCULAR'] as const;
const PRIORITIES = ['NORMAL', 'IMPORTANT'] as const;

const STATUS_TONE: Record<string, { bg: string; fg: string }> = {
  DRAFT: { bg: '#f1f5f9', fg: '#475569' },
  PUBLISHED: { bg: '#dcfce7', fg: '#166534' },
  ARCHIVED: { bg: '#fee2e2', fg: '#b91c1c' },
};

const EMPTY_FORM = { title: '', body: '', category: 'GENERAL', priority: 'NORMAL', expiresAt: '' };

function fullDate(iso: string | null) {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
}

export default function AdminAnnouncementsPage() {
  const { confirm } = useConfirm();
  const toast = useToast();
  const [items, setItems] = useState<Announcement[]>([]);
  const [audienceSize, setAudienceSize] = useState(0);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [form, setForm] = useState({ ...EMPTY_FORM });

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/platform/announcement');
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        throw new Error(j.error ?? 'Failed to load announcements');
      }
      const json = await res.json();
      setItems(json.data ?? []);
      setAudienceSize(json.audienceSize ?? 0);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to load announcements');
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    void fetchData();
  }, [fetchData]);

  const resetForm = () => {
    setForm({ ...EMPTY_FORM });
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
        message: `"${a.title}" goes out to all ${audienceSize} employees. It cannot be edited afterwards.`,
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
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed');
    } finally {
      setBusy(false);
    }
  };

  const startEdit = (a: Announcement) => {
    setEditingId(a.id);
    setForm({
      title: a.title,
      body: a.body,
      category: a.category,
      priority: a.priority,
      expiresAt: a.expiresAt ? a.expiresAt.slice(0, 10) : '',
    });
    setShowForm(true);
  };

  const inputStyle = {
    backgroundColor: 'var(--surface)',
    color: 'var(--foreground)',
    borderColor: 'var(--border)',
  };

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
          <button
            type="button"
            disabled={busy || form.title.trim().length < 3 || !form.body.trim()}
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

      {loading ? (
        <div className="text-sm" style={{ color: 'var(--foreground-muted)' }}>Loading…</div>
      ) : items.length === 0 ? (
        <div
          className="rounded-lg border p-6 text-center text-sm"
          style={{ borderColor: 'var(--border)', color: 'var(--foreground-muted)' }}
        >
          No announcements yet.
        </div>
      ) : (
        <div className="overflow-x-auto rounded-lg border" style={{ borderColor: 'var(--border)' }}>
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b text-left text-xs uppercase" style={{ borderColor: 'var(--border)', color: 'var(--foreground-muted)' }}>
                <th className="px-4 py-2">Title</th>
                <th className="px-4 py-2">Category</th>
                <th className="px-4 py-2">Status</th>
                <th className="px-4 py-2">Published</th>
                <th className="px-4 py-2">Read</th>
                <th className="px-4 py-2">Actions</th>
              </tr>
            </thead>
            <tbody>
              {items.map((a) => {
                const tone = STATUS_TONE[a.status] ?? STATUS_TONE.DRAFT;
                return (
                  <tr key={a.id} className="border-b" style={{ borderColor: 'var(--border)' }}>
                    <td className="px-4 py-2 font-medium" style={{ color: 'var(--foreground)' }}>
                      {a.title}
                      {a.priority === 'IMPORTANT' && (
                        <span className="ml-2 rounded-full px-2 py-0.5 text-[11px] font-semibold" style={{ backgroundColor: '#fee2e2', color: '#b91c1c' }}>
                          IMPORTANT
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-2" style={{ color: 'var(--foreground-muted)' }}>{a.category}</td>
                    <td className="px-4 py-2">
                      <span className="rounded-full px-2 py-0.5 text-xs font-medium" style={{ backgroundColor: tone.bg, color: tone.fg }}>
                        {a.status}
                      </span>
                    </td>
                    <td className="px-4 py-2" style={{ color: 'var(--foreground-muted)' }}>{fullDate(a.publishedAt)}</td>
                    <td className="px-4 py-2" style={{ color: 'var(--foreground-muted)' }}>
                      {a.status === 'DRAFT' ? '—' : `${a.readCount} of ${audienceSize}`}
                    </td>
                    <td className="space-x-3 px-4 py-2 whitespace-nowrap">
                      {a.status === 'DRAFT' && (
                        <>
                          <button type="button" disabled={busy} onClick={() => startEdit(a)} className="text-xs font-semibold" style={{ color: 'var(--info)' }}>
                            Edit
                          </button>
                          <button type="button" disabled={busy} onClick={() => void publish(a)} className="text-xs font-semibold" style={{ color: 'var(--success)' }}>
                            Publish
                          </button>
                        </>
                      )}
                      {a.status !== 'ARCHIVED' && (
                        <button type="button" disabled={busy} onClick={() => void remove(a)} className="text-xs font-semibold text-red-600">
                          {a.status === 'DRAFT' ? 'Delete' : 'Archive'}
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
