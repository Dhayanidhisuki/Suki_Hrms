'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { Button, DataTable, KPICard, KPIGrid, PageHeader, StatusBadge, type Column } from '@/components/ui';
import { formatDate } from '@/lib/format-date';
import {
  BUSINESS_CATEGORY_LABELS,
  DOCUMENT_BUSINESS_CATEGORIES,
  SLUG_BY_BUSINESS_CATEGORY,
  type DocumentBusinessCategory,
} from '@/lib/platform/document/categories';
import DocumentUploadModal from './DocumentUploadModal';
import DocumentPreviewDrawer from './DocumentPreviewDrawer';
import DocumentVersionHistory from './DocumentVersionHistory';
import { STATUS_LABEL, STATUS_TONE, type PlatformDocument } from './types';

const STATUS_FILTERS = [
  { value: '', label: 'All statuses' },
  { value: 'Uploaded', label: 'Pending verification' },
  { value: 'UnderVerification', label: 'Under verification' },
  { value: 'Verified', label: 'Verified' },
  { value: 'ReuploadRequired', label: 'Resubmission required' },
  { value: 'Expired', label: 'Expired' },
  { value: 'soon', label: 'Expiring within 30 days' },
  { value: 'Superseded', label: 'Previous versions' },
];

interface SearchResponse {
  data: PlatformDocument[];
  pagination: { page: number; limit: number; total: number; totalPages: number };
  counts: { total: number; pending: number; verified: number; expired: number; reupload: number };
}

export default function DocumentRepositoryPage({
  lockedCategory,
}: {
  lockedCategory?: DocumentBusinessCategory | null;
}) {
  const [q, setQ] = useState('');
  const [searchInput, setSearchInput] = useState('');
  const [status, setStatus] = useState('');
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<SearchResponse | null>(null);
  const [uploadOpen, setUploadOpen] = useState(false);
  const [preview, setPreview] = useState<PlatformDocument | null>(null);
  const [historyOf, setHistoryOf] = useState<PlatformDocument | null>(null);

  const category = lockedCategory ?? null;

  useEffect(() => {
    const t = setTimeout(() => {
      setPage(1);
      setQ(searchInput);
    }, 300);
    return () => clearTimeout(t);
  }, [searchInput]);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    const params = new URLSearchParams();
    params.set('page', String(page));
    params.set('limit', '15');
    if (q.trim()) params.set('q', q.trim());
    if (category) params.set('businessCategory', category);
    if (status === 'Superseded') {
      params.set('verificationStatus', 'Superseded');
      params.set('includeSuperseded', '1');
    } else if (status === 'soon') {
      params.set('expiry', 'soon');
    } else if (status) {
      params.set('verificationStatus', status);
    }
    try {
      const res = await fetch(`/api/platform/document/search?${params}`);
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? 'Failed to load documents');
      setResult(json);
    } catch (err) {
      setResult(null);
      setError(err instanceof Error ? err.message : 'Failed to load documents');
    } finally {
      setLoading(false);
    }
  }, [page, q, category, status]);

  useEffect(() => {
    void load();
  }, [load]);

  const columns: Column<PlatformDocument>[] = useMemo(
    () => [
      {
        key: 'employee',
        label: 'Employee',
        render: (r) =>
          r.ownerEmployee ? (
            <Link href={`/employees/${r.ownerEmployee.id}?tab=documents`} className="hover:underline" style={{ color: 'var(--accent)' }}>
              {r.ownerEmployee.employeeCode}
              <span className="block text-xs" style={{ color: 'var(--foreground-muted)' }}>{r.ownerEmployee.name}</span>
            </Link>
          ) : (
            <span>{r.ownerEntityType} #{r.ownerEntityId}</span>
          ),
      },
      { key: 'documentTypeName', label: 'Document' },
      {
        key: 'businessCategory',
        label: 'Category',
        render: (r) => BUSINESS_CATEGORY_LABELS[r.businessCategory as DocumentBusinessCategory] ?? r.businessCategory,
      },
      {
        key: 'verificationStatus',
        label: 'Status',
        render: (r) => (
          <StatusBadge tone={STATUS_TONE[r.verificationStatus] ?? 'neutral'} dot>
            {STATUS_LABEL[r.verificationStatus] ?? r.verificationStatus}
          </StatusBadge>
        ),
      },
      { key: 'versionNo', label: 'Ver.', render: (r) => `v${r.versionNo}` },
      { key: 'uploadedAt', label: 'Uploaded', render: (r) => formatDate(r.uploadedAt) },
      { key: 'expiryDate', label: 'Expiry', render: (r) => (r.expiryDate ? formatDate(r.expiryDate) : '—') },
    ],
    [],
  );

  const title = category ? BUSINESS_CATEGORY_LABELS[category] : 'Document repository';
  const counts = result?.counts ?? { total: 0, pending: 0, verified: 0, expired: 0, reupload: 0 };

  return (
    <div className="space-y-4">
      <PageHeader
        eyebrow="Document Management"
        title={title}
        description="Search by employee ID or name. Files are versioned and never hard-deleted."
        actions={
          <div className="flex gap-2">
            <Link href="/documents/types" className="inline-flex items-center rounded-lg border px-3 py-2 text-sm font-medium" style={{ borderColor: 'var(--border)', color: 'var(--foreground)' }}>
              Types
            </Link>
            <Button variant="primary" onClick={() => setUploadOpen(true)}>Upload</Button>
          </div>
        }
      />

      <nav className="flex flex-wrap gap-2">
        <Link
          href="/documents"
          className="rounded-full px-3 py-1.5 text-xs font-medium"
          style={{
            backgroundColor: !category ? 'var(--accent)' : 'var(--surface-muted)',
            color: !category ? '#fff' : 'var(--foreground-muted)',
          }}
        >
          All
        </Link>
        {DOCUMENT_BUSINESS_CATEGORIES.map((code) => {
          const slug = SLUG_BY_BUSINESS_CATEGORY[code];
          const active = category === code;
          return (
            <Link
              key={code}
              href={`/documents/${slug}`}
              className="rounded-full px-3 py-1.5 text-xs font-medium"
              style={{
                backgroundColor: active ? 'var(--accent)' : 'var(--surface-muted)',
                color: active ? '#fff' : 'var(--foreground-muted)',
              }}
            >
              {BUSINESS_CATEGORY_LABELS[code]}
            </Link>
          );
        })}
      </nav>

      <KPIGrid columns={4}>
        <KPICard label="In repository" value={counts.total} tone="info" />
        <KPICard label="Pending verification" value={counts.pending} tone="warning" />
        <KPICard label="Verified" value={counts.verified} tone="success" />
        <KPICard label="Expired / resubmit" value={counts.expired + counts.reupload} tone="danger" />
      </KPIGrid>

      {error && <p className="text-sm" style={{ color: 'var(--danger)' }}>{error}</p>}

      <DataTable
        variant="card"
        columns={columns}
        data={result?.data ?? []}
        loading={loading}
        pagination={result?.pagination}
        onPageChange={setPage}
        searchValue={searchInput}
        searchPlaceholder="Search emp ID or name"
        onSearchChange={(value) => {
          setSearchInput(value);
        }}
        filters={
          <select
            value={status}
            onChange={(e) => {
              setStatus(e.target.value);
              setPage(1);
            }}
            className="rounded-lg border px-3 py-2 text-sm"
            style={{ backgroundColor: 'var(--surface)', borderColor: 'var(--border)', color: 'var(--foreground)' }}
          >
            {STATUS_FILTERS.map((s) => (
              <option key={s.value || 'all'} value={s.value}>{s.label}</option>
            ))}
          </select>
        }
        emptyMessage="No documents match these filters."
        renderRowActions={(row) => (
          <button type="button" className="text-xs font-medium" style={{ color: 'var(--accent)' }} onClick={() => setPreview(row)}>
            Open
          </button>
        )}
        rowKey={(r) => r.id}
      />

      <DocumentUploadModal
        isOpen={uploadOpen}
        onClose={() => setUploadOpen(false)}
        onUploaded={() => void load()}
        businessCategory={category}
      />
      <DocumentPreviewDrawer
        doc={preview}
        onClose={() => setPreview(null)}
        onChanged={() => void load()}
        onViewHistory={(d) => {
          setPreview(null);
          setHistoryOf(d);
        }}
      />
      <DocumentVersionHistory
        doc={historyOf}
        onClose={() => setHistoryOf(null)}
        onOpen={(d) => {
          setHistoryOf(null);
          setPreview(d);
        }}
      />
    </div>
  );
}
