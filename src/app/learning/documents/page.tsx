'use client';

/**
 * Training Documents (BRD §38) — upload + browse the document library.
 * Materials, attendance sheets, invoices, policies linked to schedules /
 * programs / employees.
 */

import { useState, useEffect, useRef } from 'react';
import { DataTable, ConfirmDialog, KPICard, KPIGrid } from '@/components/ui';
import type { Column } from '@/components/ui';
import { exportCsv } from '@/lib/exportCsv';
import { exportXlsx } from '@/lib/exportXlsx';
import { printTable } from '@/lib/printTable';

interface Doc {
  id: number;
  title: string;
  docType: string;
  fileSize: number | null;
  trainingScheduleId: number | null;
  trainingProgramId: number | null;
  employeeId: number | null;
  remarks: string | null;
  accessRoles: string | null;
  createdAt: string;
}

const DOC_TYPES = ['MATERIAL', 'ATTENDANCE_SHEET', 'CERTIFICATE', 'INVOICE', 'PO', 'POLICY', 'OTHER'];

export default function DocumentsPage() {
  const [rows, setRows] = useState<Doc[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [docType, setDocType] = useState('');
  const [search, setSearch] = useState('');
  const [refresh, setRefresh] = useState(0);
  const [deleteId, setDeleteId] = useState<number | null>(null);
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const titleRef = useRef<HTMLInputElement>(null);
  const typeRef = useRef<HTMLSelectElement>(null);
  const schedRef = useRef<HTMLInputElement>(null);
  const progRef = useRef<HTMLInputElement>(null);
  const rolesRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    let mounted = true;
    const load = async () => {
      setLoading(true);
      try {
        const params = new URLSearchParams();
        if (docType) params.set('docType', docType);
        if (search) params.set('search', search);
        const res = await fetch(`/api/training-documents?${params}`);
        if (!res.ok) throw new Error('Failed to load');
        const json = await res.json();
        if (mounted) setRows(json.data);
      } catch (err) {
        if (mounted) setError(err instanceof Error ? err.message : 'Failed');
      } finally {
        if (mounted) setLoading(false);
      }
    };
    void load();
    return () => { mounted = false; };
  }, [docType, search, refresh]);

  const upload = async () => {
    const file = fileRef.current?.files?.[0];
    if (!file || !titleRef.current?.value.trim()) {
      setError('Title and file are required');
      return;
    }
    setUploading(true);
    setError(null);
    try {
      const fd = new FormData();
      fd.append('file', file);
      fd.append('title', titleRef.current.value.trim());
      fd.append('docType', typeRef.current?.value ?? 'MATERIAL');
      if (schedRef.current?.value) fd.append('trainingScheduleId', schedRef.current.value);
      if (progRef.current?.value) fd.append('trainingProgramId', progRef.current.value);
      if (rolesRef.current?.value.trim()) fd.append('accessRoles', rolesRef.current.value.trim());
      const res = await fetch('/api/training-documents', { method: 'POST', body: fd });
      if (!res.ok) throw new Error((await res.json()).error ?? 'Upload failed');
      if (fileRef.current) fileRef.current.value = '';
      if (titleRef.current) titleRef.current.value = '';
      if (rolesRef.current) rolesRef.current.value = '';
      setRefresh((n) => n + 1);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Upload failed');
    } finally {
      setUploading(false);
    }
  };

  const handleDelete = async (id: number) => {
    const res = await fetch(`/api/training-documents/${id}`, { method: 'DELETE' });
    if (!res.ok) { setError((await res.json()).error ?? 'Delete failed'); return; }
    setRefresh((n) => n + 1);
  };

  const columns: Column<Doc>[] = [
    { key: 'title', label: 'Title', sortable: true },
    { key: 'docType', label: 'Type' },
    { key: 'fileSize', label: 'Size', render: (r) => (r.fileSize ? `${Math.round(r.fileSize / 1024)} KB` : '—') },
    { key: 'trainingScheduleId', label: 'Schedule', render: (r) => r.trainingScheduleId ?? '—' },
    { key: 'trainingProgramId', label: 'Program', render: (r) => r.trainingProgramId ?? '—' },
    { key: 'accessRoles', label: 'Access', render: (r) => (r.accessRoles ? `Roles: ${r.accessRoles}` : 'All') },
    { key: 'createdAt', label: 'Uploaded', render: (r) => r.createdAt?.slice(0, 10) },
    {
      key: 'actions', label: 'File',
      render: (r) => (
        <a href={`/api/training-documents/${r.id}?download=1`} className="text-xs font-medium underline" style={{ color: 'var(--accent)' }}>
          Download
        </a>
      ),
    },
  ];

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold" style={{ color: 'var(--foreground)' }}>Training Documents</h1>
        <div className="flex gap-2">
          <button
            onClick={() => exportCsv('training-documents.csv', rows.map((r) => ({ Title: r.title, Type: r.docType, Schedule: r.trainingScheduleId ?? '', Program: r.trainingProgramId ?? '', Uploaded: r.createdAt?.slice(0, 10) })))}
            className="rounded-lg px-4 py-2 text-sm font-medium" style={{ border: '1px solid var(--border)', color: 'var(--foreground)' }}
          >
            Export CSV
          </button>
          <button
            onClick={() => exportXlsx('training-documents.xlsx', rows.map((r) => ({ Title: r.title, Type: r.docType, Schedule: r.trainingScheduleId ?? '', Program: r.trainingProgramId ?? '', Uploaded: r.createdAt?.slice(0, 10) })), 'Documents')}
            className="rounded-lg px-4 py-2 text-sm font-medium" style={{ border: '1px solid var(--border)', color: 'var(--foreground)' }}
          >
            Export Excel
          </button>
          <button
            onClick={() => printTable('Training Documents', [
              { label: 'Title', value: (r: { title: string }) => r.title },
              { label: 'Type', value: (r: { docType: string }) => r.docType },
              { label: 'Schedule', value: (r: { trainingScheduleId: number | null }) => r.trainingScheduleId },
              { label: 'Program', value: (r: { trainingProgramId: number | null }) => r.trainingProgramId },
              { label: 'Uploaded', value: (r: { createdAt: string }) => r.createdAt?.slice(0, 10) },
            ], rows)}
            className="rounded-lg px-4 py-2 text-sm font-medium" style={{ border: '1px solid var(--border)', color: 'var(--foreground)' }}
            title="Print or save as PDF via the browser print dialog"
          >
            Print / PDF
          </button>
        </div>
      </div>

      <KPIGrid columns={3}>
        <KPICard label="Documents" value={rows.length} tone="info" />
        <KPICard label="Materials" value={rows.filter((r) => r.docType === 'MATERIAL').length} tone="info" />
        <KPICard label="Certificates" value={rows.filter((r) => r.docType === 'CERTIFICATE').length} tone="success" />
      </KPIGrid>

      {/* Upload bar */}
      <div className="flex flex-wrap items-end gap-2 rounded-xl border p-3" style={{ borderColor: 'var(--border)', backgroundColor: 'var(--surface)' }}>
        <input ref={titleRef} placeholder="Title *" className="rounded border bg-transparent px-3 py-2 text-sm" style={{ borderColor: 'var(--border)' }} />
        <select ref={typeRef} className="rounded border bg-transparent px-3 py-2 text-sm" style={{ borderColor: 'var(--border)' }}>
          {DOC_TYPES.map((t) => <option key={t} value={t}>{t.replace('_', ' ')}</option>)}
        </select>
        <input ref={schedRef} placeholder="Schedule ID" type="number" className="w-28 rounded border bg-transparent px-3 py-2 text-sm" style={{ borderColor: 'var(--border)' }} />
        <input ref={progRef} placeholder="Program ID" type="number" className="w-28 rounded border bg-transparent px-3 py-2 text-sm" style={{ borderColor: 'var(--border)' }} />
        <input ref={rolesRef} placeholder="Restrict to roles (CSV, blank = all)" title="e.g. HR Manager,Employee — only these roles can view/download" className="w-56 rounded border bg-transparent px-3 py-2 text-sm" style={{ borderColor: 'var(--border)' }} />
        <input ref={fileRef} type="file" accept=".pdf,.doc,.docx,.ppt,.pptx,.xls,.xlsx,.csv,.txt,.jpg,.jpeg,.png,.webp,.mp4,.mov,.webm,.zip" className="text-sm" style={{ color: 'var(--foreground-muted)' }} />
        <button onClick={upload} disabled={uploading} className="rounded-lg px-4 py-2 text-sm font-medium text-white disabled:opacity-50" style={{ backgroundColor: 'var(--accent)' }}>
          {uploading ? 'Uploading…' : 'Upload'}
        </button>
      </div>

      <div className="flex gap-2">
        <select value={docType} onChange={(e) => setDocType(e.target.value)} className="rounded border bg-transparent px-3 py-2 text-sm" style={{ borderColor: 'var(--border)' }}>
          <option value="">All Types</option>
          {DOC_TYPES.map((t) => <option key={t} value={t}>{t.replace('_', ' ')}</option>)}
        </select>
        <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search title…" className="rounded border bg-transparent px-3 py-2 text-sm" style={{ borderColor: 'var(--border)' }} />
      </div>

      {error && <div className="rounded-lg px-3 py-2 text-sm" style={{ backgroundColor: '#fef2f2', color: '#dc2626', border: '1px solid #fecaca' }}>{error}</div>}

      <DataTable columns={columns} data={rows} loading={loading} onDelete={(r) => setDeleteId(r.id)} emptyMessage="No documents uploaded yet." />

      <ConfirmDialog
        title="Delete Document"
        message="Remove this document from the library?"
        isOpen={deleteId !== null}
        onConfirm={() => { if (deleteId) void handleDelete(deleteId); setDeleteId(null); }}
        onClose={() => setDeleteId(null)}
      />
    </div>
  );
}
