'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { Button, DataTable, StatusBadge, type Column } from '@/components/ui';
import { SectionCard, SectionIcon } from '@/components/employees/SectionCard';
import { formatDate } from '@/lib/format-date';
import { BUSINESS_CATEGORY_LABELS, DOCUMENT_BUSINESS_CATEGORIES, type DocumentBusinessCategory } from '@/lib/platform/document/categories';
import DocumentUploadModal from '@/components/documents/DocumentUploadModal';
import DocumentPreviewDrawer from '@/components/documents/DocumentPreviewDrawer';
import DocumentVersionHistory from '@/components/documents/DocumentVersionHistory';
import { STATUS_LABEL, STATUS_TONE, type PlatformDocument } from '@/components/documents/types';

interface Completeness {
  complete: boolean;
  missing: string[];
  pending: string[];
  expired: string[];
}

export default function EmployeeDocumentsTab({
  employeeId,
  employeeLabel,
}: {
  employeeId: string;
  employeeLabel: string;
}) {
  const [rows, setRows] = useState<PlatformDocument[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [completeness, setCompleteness] = useState<Completeness | null>(null);
  const [uploadOpen, setUploadOpen] = useState(false);
  const [preview, setPreview] = useState<PlatformDocument | null>(null);
  const [historyOf, setHistoryOf] = useState<PlatformDocument | null>(null);
  const [group, setGroup] = useState<DocumentBusinessCategory | 'ALL'>('ALL');

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [listRes, compRes] = await Promise.all([
        fetch(`/api/platform/document?ownerEntityType=EMPLOYEE&ownerEntityId=${employeeId}`),
        fetch(`/api/platform/document/completeness?ownerEntityType=EMPLOYEE&ownerEntityId=${employeeId}&stage=JOINING`),
      ]);
      const listJson = await listRes.json();
      const compJson = await compRes.json();
      if (!listRes.ok) throw new Error(listJson.error ?? 'Failed to load documents');
      setRows(listJson.data ?? []);
      if (compRes.ok) setCompleteness(compJson);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load documents');
    } finally {
      setLoading(false);
    }
  }, [employeeId]);

  useEffect(() => {
    void load();
  }, [load]);

  const filtered = useMemo(
    () => (group === 'ALL' ? rows : rows.filter((r) => r.businessCategory === group)),
    [rows, group],
  );

  const columns: Column<PlatformDocument>[] = [
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
    { key: 'uploadedAt', label: 'Last updated', render: (r) => formatDate(r.uploadedAt) },
    { key: 'expiryDate', label: 'Expiry', render: (r) => (r.expiryDate ? formatDate(r.expiryDate) : '—') },
  ];

  return (
    <SectionCard
      title="Documents"
      icon={<SectionIcon.IdCard />}
      action={<Button size="sm" variant="primary" onClick={() => setUploadOpen(true)}>Upload</Button>}
    >
      {completeness && (
        <div className="mb-4 rounded-lg border p-3 text-sm" style={{ borderColor: 'var(--border)', color: 'var(--foreground-muted)' }}>
          {completeness.complete
            ? 'Mandatory joining documents are complete.'
            : `Missing: ${completeness.missing.join(', ') || '—'} · Pending: ${completeness.pending.join(', ') || '—'}${completeness.expired.length ? ` · Expired: ${completeness.expired.join(', ')}` : ''}`}
        </div>
      )}
      <div className="mb-3 flex flex-wrap gap-2">
        <button
          type="button"
          className="rounded-full px-3 py-1 text-xs font-medium"
          style={{ backgroundColor: group === 'ALL' ? 'var(--accent)' : 'var(--surface-muted)', color: group === 'ALL' ? '#fff' : 'var(--foreground-muted)' }}
          onClick={() => setGroup('ALL')}
        >
          All
        </button>
        {DOCUMENT_BUSINESS_CATEGORIES.map((code) => (
          <button
            key={code}
            type="button"
            className="rounded-full px-3 py-1 text-xs font-medium"
            style={{ backgroundColor: group === code ? 'var(--accent)' : 'var(--surface-muted)', color: group === code ? '#fff' : 'var(--foreground-muted)' }}
            onClick={() => setGroup(code)}
          >
            {BUSINESS_CATEGORY_LABELS[code]}
          </button>
        ))}
      </div>
      {error && <p className="mb-2 text-sm" style={{ color: 'var(--danger)' }}>{error}</p>}
      <DataTable
        columns={columns}
        data={filtered}
        loading={loading}
        emptyMessage="No documents on file for this employee yet."
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
        businessCategory={group === 'ALL' ? null : group}
        lockedOwner={{ ownerEntityType: 'EMPLOYEE', ownerEntityId: Number(employeeId), label: employeeLabel }}
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
    </SectionCard>
  );
}
