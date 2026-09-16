/**
 * Employee Self Service — Documents. Self-service: employeeId is resolved
 * from the session by the platform document API itself (never sent by the
 * client). An employee may upload, view, download and withdraw their own
 * documents; verification is HR-only and happens elsewhere.
 */

'use client';

import { useState, useEffect, useCallback, useRef } from 'react';

interface DocType {
  code: string;
  name: string;
  category: string;
  mandatoryFlag: boolean;
  expiryRequired: boolean;
  allowedFileTypes: string;
  maxFileSizeMb: number;
  maxFileCount: number;
}

interface DocRow {
  id: number;
  documentTypeCode: string;
  documentTypeName: string;
  documentRef: string;
  versionNo: number;
  originalFileName: string;
  fileSizeBytes: number;
  expiryDate: string | null;
  verificationStatus: string;
  rejectionReasonCode: string | null;
  uploadedAt: string;
}

const STATUS_TONE: Record<string, { bg: string; fg: string }> = {
  Uploaded: { bg: '#fef9c3', fg: '#854d0e' },
  UnderVerification: { bg: '#dbeafe', fg: '#1e40af' },
  Verified: { bg: '#dcfce7', fg: '#166534' },
  Rejected: { bg: '#fee2e2', fg: '#991b1b' },
  ReuploadRequired: { bg: '#fee2e2', fg: '#991b1b' },
  Expired: { bg: '#fee2e2', fg: '#991b1b' },
  Superseded: { bg: '#f1f5f9', fg: '#475569' },
  Withdrawn: { bg: '#f1f5f9', fg: '#475569' },
  Revoked: { bg: '#f1f5f9', fg: '#475569' },
};

// EMPLOYEE_ID is the current employee — resolved server-side; the client
// only needs it to shape the list/upload query, never to assert identity.
const OWNER_ENTITY_TYPE = 'EMPLOYEE';

function fileSize(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  return `${(bytes / 1024).toFixed(0)} KB`;
}

export default function EssDocumentsPage() {
  const [ownEmployeeId, setOwnEmployeeId] = useState<number | null>(null);
  const [types, setTypes] = useState<DocType[]>([]);
  const [docs, setDocs] = useState<DocRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState<string | null>(null);

  const [selectedType, setSelectedType] = useState('');
  const [expiryDate, setExpiryDate] = useState('');
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // The platform document API takes ownerEntityId explicitly (HR also uses
  // it to act on other employees' documents), so the client needs its own
  // employee id to build the query — resolved via the small self-lookup at
  // /api/workforce/me rather than trusted from anywhere else client-side.
  const fetchAll = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const meRes = await fetch('/api/workforce/me').catch(() => null);
      let employeeId: number | null = null;
      if (meRes?.ok) {
        const me = await meRes.json();
        employeeId = me.employeeId ?? null;
      } else if (meRes) {
        const j = await meRes.json().catch(() => ({}));
        throw new Error(j.error ?? 'Failed to resolve your employee record');
      }
      setOwnEmployeeId(employeeId);
      if (!employeeId) throw new Error('This login has no linked employee record');

      const [typesRes, docsRes] = await Promise.all([
        fetch('/api/workforce/my-document-types'),
        employeeId ? fetch(`/api/platform/document?ownerEntityType=${OWNER_ENTITY_TYPE}&ownerEntityId=${employeeId}`) : Promise.resolve(null),
      ]);
      if (typesRes.ok) setTypes((await typesRes.json()).data ?? []);
      if (docsRes?.ok) setDocs((await docsRes.json()).data ?? []);
      else if (docsRes) {
        const j = await docsRes.json().catch(() => ({}));
        setError(j.error ?? 'Failed to load documents');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load documents');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void fetchAll();
  }, [fetchAll]);

  const selectedTypeDef = types.find((t) => t.code === selectedType);

  const handleUpload = async () => {
    const file = fileInputRef.current?.files?.[0];
    if (!file || !selectedType || !ownEmployeeId) return;
    setUploading(true);
    setError(null);
    setSaved(null);
    try {
      const form = new FormData();
      form.set('file', file);
      form.set('documentTypeCode', selectedType);
      form.set('ownerEntityType', OWNER_ENTITY_TYPE);
      form.set('ownerEntityId', String(ownEmployeeId));
      if (expiryDate) form.set('expiryDate', expiryDate);
      const res = await fetch('/api/platform/document', { method: 'POST', body: form });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        throw new Error(j.error ?? 'Upload failed');
      }
      setSaved('Document uploaded.');
      setSelectedType('');
      setExpiryDate('');
      if (fileInputRef.current) fileInputRef.current.value = '';
      await fetchAll();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Upload failed');
    } finally {
      setUploading(false);
    }
  };

  const handleWithdraw = async (id: number) => {
    setError(null);
    const res = await fetch(`/api/platform/document/${id}/withdraw`, { method: 'POST' });
    if (!res.ok) {
      const j = await res.json().catch(() => ({}));
      setError(j.error ?? 'Withdraw failed');
      return;
    }
    await fetchAll();
  };

  return (
    <div className="space-y-6">
      <h1 className="text-xl font-semibold" style={{ color: 'var(--foreground)' }}>My Documents</h1>

      {error && <div className="rounded-lg border border-red-300 bg-red-50 p-3 text-sm text-red-700">{error}</div>}
      {saved && <div className="rounded-lg border border-green-300 bg-green-50 p-3 text-sm text-green-700">{saved}</div>}

      <div className="rounded-lg border p-5" style={{ borderColor: 'var(--border)' }}>
        <h2 className="mb-3 text-sm font-semibold" style={{ color: 'var(--foreground)' }}>Upload a document</h2>
        <div className="grid grid-cols-3 gap-4">
          <div>
            <label className="mb-1 block text-sm font-medium" style={{ color: 'var(--foreground)' }}>Document Type</label>
            <select
              value={selectedType}
              onChange={(e) => setSelectedType(e.target.value)}
              className="w-full rounded-lg border px-3 py-2 text-sm"
              style={{ backgroundColor: 'var(--surface)', color: 'var(--foreground)', borderColor: 'var(--border)' }}
            >
              <option value="">Select…</option>
              {types.map((t) => (
                <option key={t.code} value={t.code}>{t.name}{t.mandatoryFlag ? ' *' : ''}</option>
              ))}
            </select>
            {selectedTypeDef && (
              <p className="mt-1 text-xs" style={{ color: 'var(--foreground-muted)' }}>
                {selectedTypeDef.allowedFileTypes.toUpperCase()} · max {selectedTypeDef.maxFileSizeMb}MB
              </p>
            )}
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium" style={{ color: 'var(--foreground)' }}>File</label>
            <input
              ref={fileInputRef}
              type="file"
              accept={selectedTypeDef ? selectedTypeDef.allowedFileTypes.split(',').map((e) => `.${e.trim()}`).join(',') : undefined}
              className="w-full rounded-lg border px-3 py-1.5 text-sm"
              style={{ backgroundColor: 'var(--surface)', color: 'var(--foreground)', borderColor: 'var(--border)' }}
            />
          </div>
          {selectedTypeDef?.expiryRequired && (
            <div>
              <label className="mb-1 block text-sm font-medium" style={{ color: 'var(--foreground)' }}>Expiry Date</label>
              <input
                type="date"
                value={expiryDate}
                onChange={(e) => setExpiryDate(e.target.value)}
                className="w-full rounded-lg border px-3 py-2 text-sm"
                style={{ backgroundColor: 'var(--surface)', color: 'var(--foreground)', borderColor: 'var(--border)' }}
              />
            </div>
          )}
        </div>
        <button
          onClick={handleUpload}
          disabled={uploading || !selectedType}
          className="mt-4 rounded-lg px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
          style={{ backgroundColor: 'var(--primary)' }}
        >
          {uploading ? 'Uploading…' : 'Upload'}
        </button>
      </div>

      {loading ? (
        <div className="text-sm" style={{ color: 'var(--foreground-muted)' }}>Loading…</div>
      ) : (
        <div className="rounded-lg border" style={{ borderColor: 'var(--border)' }}>
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b text-left text-xs uppercase" style={{ borderColor: 'var(--border)', color: 'var(--foreground-muted)' }}>
                <th className="px-4 py-2">Type</th>
                <th className="px-4 py-2">File</th>
                <th className="px-4 py-2">Uploaded</th>
                <th className="px-4 py-2">Expiry</th>
                <th className="px-4 py-2">Status</th>
                <th className="px-4 py-2" />
              </tr>
            </thead>
            <tbody>
              {docs.length === 0 && (
                <tr><td colSpan={6} className="px-4 py-6 text-center" style={{ color: 'var(--foreground-muted)' }}>No documents uploaded yet.</td></tr>
              )}
              {docs.map((d) => {
                const tone = STATUS_TONE[d.verificationStatus] ?? { bg: '#f1f5f9', fg: '#475569' };
                return (
                  <tr key={d.id} className="border-b" style={{ borderColor: 'var(--border)' }}>
                    <td className="px-4 py-2">{d.documentTypeName}</td>
                    <td className="px-4 py-2">{d.originalFileName} <span style={{ color: 'var(--foreground-muted)' }}>({fileSize(d.fileSizeBytes)})</span></td>
                    <td className="px-4 py-2">{new Date(d.uploadedAt).toLocaleDateString('en-IN')}</td>
                    <td className="px-4 py-2">{d.expiryDate ? new Date(d.expiryDate).toLocaleDateString('en-IN') : '—'}</td>
                    <td className="px-4 py-2">
                      <span className="rounded-full px-2 py-0.5 text-xs font-medium" style={{ backgroundColor: tone.bg, color: tone.fg }}>{d.verificationStatus}</span>
                      {d.rejectionReasonCode && <span className="ml-2 text-xs" style={{ color: '#991b1b' }}>({d.rejectionReasonCode})</span>}
                    </td>
                    <td className="px-4 py-2 text-right">
                      <a
                        href={`/api/platform/document/${d.id}/download`}
                        className="mr-3 text-xs font-medium"
                        style={{ color: 'var(--primary)' }}
                      >
                        Download
                      </a>
                      {d.verificationStatus === 'Uploaded' && (
                        <button onClick={() => handleWithdraw(d.id)} className="text-xs font-medium" style={{ color: '#991b1b' }}>
                          Withdraw
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
