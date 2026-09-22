'use client';

import { useEffect, useState } from 'react';
import { Button, StatusBadge } from '@/components/ui';
import { formatDate } from '@/lib/format-date';
import { HR_MANAGER_ROLE_CODES } from '@/lib/platform/document/rules';
import { BUSINESS_CATEGORY_LABELS, type DocumentBusinessCategory } from '@/lib/platform/document/categories';
import { REJECTION_REASONS, STATUS_LABEL, STATUS_TONE, readApiError, type PlatformDocument } from './types';

interface Props {
  doc: PlatformDocument | null;
  onClose: () => void;
  onChanged: () => void;
  onViewHistory: (doc: PlatformDocument) => void;
}

export default function DocumentPreviewDrawer({ doc, onClose, onChanged, onViewHistory }: Props) {
  const [isHr, setIsHr] = useState(false);
  const [userId, setUserId] = useState<number | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [previewError, setPreviewError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [rejectOpen, setRejectOpen] = useState(false);
  const [resubmitOpen, setResubmitOpen] = useState(false);
  const [reasonCode, setReasonCode] = useState('ILLEGIBLE');
  const [remark, setRemark] = useState('');
  const [revokeOpen, setRevokeOpen] = useState(false);
  const [revokeReason, setRevokeReason] = useState('');
  const [employeeId, setEmployeeId] = useState<number | null>(null);

  useEffect(() => {
    fetch('/api/auth/me')
      .then((r) => r.json())
      .then((me) => {
        setIsHr(!!me.roleCode && HR_MANAGER_ROLE_CODES.includes(me.roleCode));
        setUserId(typeof me.userId === 'number' ? me.userId : null);
        setEmployeeId(typeof me.employeeId === 'number' ? me.employeeId : null);
      })
      .catch(() => undefined);
  }, []);

  useEffect(() => {
    if (!doc) {
      setPreviewUrl(null);
      return;
    }
    let objectUrl: string | null = null;
    setPreviewError(null);
    fetch(`/api/platform/document/${doc.id}/download`)
      .then(async (res) => {
        if (!res.ok) throw new Error(await readApiError(res));
        const blob = await res.blob();
        objectUrl = URL.createObjectURL(blob);
        setPreviewUrl(objectUrl);
      })
      .catch((err) => {
        setPreviewUrl(null);
        setPreviewError(err instanceof Error ? err.message : 'Could not load file');
      });
    return () => {
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [doc]);

  if (!doc) return null;

  const canVerify = isHr && userId !== doc.uploadedByUserId;
  const canWithdraw =
    doc.verificationStatus === 'Uploaded' &&
    (employeeId != null && doc.ownerEntityType === 'EMPLOYEE' && employeeId === doc.ownerEntityId);
  const canRevoke = isHr && doc.verificationStatus === 'Verified';
  const cat = doc.businessCategory as DocumentBusinessCategory;

  async function postAction(path: string, body?: unknown) {
    setBusy(true);
    setActionError(null);
    try {
      const res = await fetch(path, {
        method: 'POST',
        headers: body ? { 'Content-Type': 'application/json' } : undefined,
        body: body ? JSON.stringify(body) : undefined,
      });
      if (!res.ok) throw new Error(await readApiError(res));
      setRejectOpen(false);
      setResubmitOpen(false);
      onChanged();
      onClose();
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'Action failed');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex justify-end" style={{ backgroundColor: 'rgba(0,0,0,0.35)' }} onClick={onClose}>
      <aside
        className="flex h-full w-full max-w-xl flex-col shadow-2xl"
        style={{ backgroundColor: 'var(--surface)', borderLeft: '1px solid var(--border)' }}
        onClick={(e) => e.stopPropagation()}
      >
        <header className="flex items-start justify-between gap-3 border-b px-5 py-4" style={{ borderColor: 'var(--border)' }}>
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider" style={{ color: 'var(--accent)' }}>
              {BUSINESS_CATEGORY_LABELS[cat] ?? doc.businessCategory}
            </p>
            <h2 className="mt-1 text-lg font-semibold" style={{ color: 'var(--foreground)' }}>{doc.documentTypeName}</h2>
            <p className="mt-1 text-sm" style={{ color: 'var(--foreground-muted)' }}>
              {doc.documentRef} · v{doc.versionNo}
              {doc.ownerEmployee ? ` · ${doc.ownerEmployee.employeeCode} ${doc.ownerEmployee.name}` : ''}
            </p>
          </div>
          <button type="button" onClick={onClose} className="text-sm" style={{ color: 'var(--foreground-muted)' }}>Close</button>
        </header>

        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4">
          <div className="flex flex-wrap items-center gap-2">
            <StatusBadge tone={STATUS_TONE[doc.verificationStatus] ?? 'neutral'} dot>
              {STATUS_LABEL[doc.verificationStatus] ?? doc.verificationStatus}
            </StatusBadge>
            <span className="text-xs" style={{ color: 'var(--foreground-muted)' }}>
              Uploaded {formatDate(doc.uploadedAt)}
              {doc.expiryDate ? ` · Expires ${formatDate(doc.expiryDate)}` : ''}
            </span>
          </div>
          {doc.verificationRemark && (
            <p className="text-sm" style={{ color: 'var(--foreground-muted)' }}>{doc.verificationRemark}</p>
          )}

          <div className="overflow-hidden rounded-lg border" style={{ borderColor: 'var(--border)', minHeight: 280 }}>
            {previewError && <p className="p-4 text-sm" style={{ color: 'var(--danger)' }}>{previewError}</p>}
            {!previewError && !previewUrl && <p className="p-4 text-sm" style={{ color: 'var(--foreground-muted)' }}>Loading preview…</p>}
            {previewUrl && doc.mimeType.startsWith('image/') && (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={previewUrl} alt={doc.originalFileName} className="max-h-[420px] w-full object-contain" />
            )}
            {previewUrl && doc.mimeType === 'application/pdf' && (
              <iframe title={doc.originalFileName} src={previewUrl} className="h-[420px] w-full" />
            )}
            {previewUrl && !doc.mimeType.startsWith('image/') && doc.mimeType !== 'application/pdf' && (
              <p className="p-4 text-sm" style={{ color: 'var(--foreground-muted)' }}>Preview not available for this file type. Download instead.</p>
            )}
          </div>

          {actionError && <p className="text-sm" style={{ color: 'var(--danger)' }}>{actionError}</p>}

          {rejectOpen && (
            <div className="space-y-2 rounded-lg border p-3" style={{ borderColor: 'var(--border)' }}>
              <p className="text-sm font-medium">Reject document</p>
              <p className="text-xs" style={{ color: 'var(--foreground-muted)' }}>
                Records a rejection reason against this file. To ask for a better copy
                without rejecting it, use Request resubmission instead.
              </p>
              <select
                value={reasonCode}
                onChange={(e) => setReasonCode(e.target.value)}
                className="w-full rounded-lg border px-3 py-2 text-sm"
                style={{ backgroundColor: 'var(--surface)', borderColor: 'var(--border)', color: 'var(--foreground)' }}
              >
                {REJECTION_REASONS.map((r) => (
                  <option key={r.value} value={r.value}>{r.label}</option>
                ))}
              </select>
              <textarea
                value={remark}
                onChange={(e) => setRemark(e.target.value)}
                placeholder="Remark (at least 10 characters)"
                rows={3}
                className="w-full rounded-lg border px-3 py-2 text-sm"
                style={{ backgroundColor: 'var(--surface)', borderColor: 'var(--border)', color: 'var(--foreground)' }}
              />
              <div className="flex justify-end gap-2">
                <Button size="sm" variant="secondary" onClick={() => setRejectOpen(false)}>Cancel</Button>
                <Button size="sm" variant="danger" loading={busy} onClick={() => postAction(`/api/platform/document/${doc.id}/reject`, { reasonCode, remark })}>
                  Reject
                </Button>
              </div>
            </div>
          )}

          {resubmitOpen && (
            <div className="space-y-2 rounded-lg border p-3" style={{ borderColor: 'var(--border)' }}>
              <p className="text-sm font-medium">Request resubmission</p>
              <p className="text-xs" style={{ color: 'var(--foreground-muted)' }}>
                No rejection reason is recorded — the owner is simply asked to upload a
                fresh copy.
              </p>
              <textarea
                value={remark}
                onChange={(e) => setRemark(e.target.value)}
                placeholder="What should the owner send instead? (at least 10 characters)"
                rows={3}
                className="w-full rounded-lg border px-3 py-2 text-sm"
                style={{ backgroundColor: 'var(--surface)', borderColor: 'var(--border)', color: 'var(--foreground)' }}
              />
              <div className="flex justify-end gap-2">
                <Button size="sm" variant="secondary" onClick={() => setResubmitOpen(false)}>Cancel</Button>
                <Button
                  size="sm"
                  variant="primary"
                  loading={busy}
                  onClick={() => postAction(`/api/platform/document/${doc.id}/request-resubmission`, { remark })}
                >
                  Request resubmission
                </Button>
              </div>
            </div>
          )}

          {revokeOpen && (
            <div className="space-y-2 rounded-lg border p-3" style={{ borderColor: 'var(--border)' }}>
              <p className="text-sm font-medium">Revoke verification</p>
              <textarea
                value={revokeReason}
                onChange={(e) => setRevokeReason(e.target.value)}
                placeholder="Reason (required)"
                rows={3}
                className="w-full rounded-lg border px-3 py-2 text-sm"
                style={{ backgroundColor: 'var(--surface)', borderColor: 'var(--border)', color: 'var(--foreground)' }}
              />
              <div className="flex justify-end gap-2">
                <Button size="sm" variant="secondary" onClick={() => setRevokeOpen(false)}>Cancel</Button>
                <Button size="sm" variant="danger" loading={busy} onClick={() => postAction(`/api/platform/document/${doc.id}/revoke`, { reason: revokeReason })}>
                  Revoke
                </Button>
              </div>
            </div>
          )}
        </div>

        <footer className="flex flex-wrap gap-2 border-t px-5 py-3" style={{ borderColor: 'var(--border)' }}>
          <Button size="sm" variant="secondary" onClick={() => window.open(`/api/platform/document/${doc.id}/download`, '_blank')}>Download</Button>
          <Button size="sm" variant="secondary" onClick={() => onViewHistory(doc)}>Version history</Button>
          {canVerify && doc.verificationStatus === 'Uploaded' && (
            <Button size="sm" variant="primary" loading={busy} onClick={() => postAction(`/api/platform/document/${doc.id}/claim`)}>Claim for review</Button>
          )}
          {canVerify && doc.verificationStatus === 'UnderVerification' && (
            <>
              <Button size="sm" variant="success" loading={busy} onClick={() => postAction(`/api/platform/document/${doc.id}/verify`, { remark: 'Verified' })}>Verify</Button>
              <Button size="sm" variant="secondary" onClick={() => setResubmitOpen(true)}>Request resubmission</Button>
              <Button size="sm" variant="danger" onClick={() => setRejectOpen(true)}>Reject</Button>
            </>
          )}
          {canVerify && doc.verificationStatus === 'Rejected' && (
            <Button size="sm" variant="secondary" onClick={() => setResubmitOpen(true)}>Request resubmission</Button>
          )}
          {canWithdraw && (
            <Button size="sm" variant="secondary" loading={busy} onClick={() => postAction(`/api/platform/document/${doc.id}/withdraw`)}>Withdraw</Button>
          )}
          {canRevoke && (
            <Button size="sm" variant="danger" onClick={() => setRevokeOpen(true)}>Revoke</Button>
          )}
        </footer>
      </aside>
    </div>
  );
}
