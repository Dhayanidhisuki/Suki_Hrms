'use client';

import { useEffect, useState } from 'react';
import { StatusBadge } from '@/components/ui';
import { formatDate } from '@/lib/format-date';
import { STATUS_LABEL, STATUS_TONE, type PlatformDocument } from './types';

interface Props {
  doc: PlatformDocument | null;
  onClose: () => void;
  onOpen: (doc: PlatformDocument) => void;
}

export default function DocumentVersionHistory({ doc, onClose, onOpen }: Props) {
  const [rows, setRows] = useState<PlatformDocument[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!doc) return;
    setLoading(true);
    setError(null);
    fetch(`/api/platform/document/${doc.id}/versions`)
      .then(async (res) => {
        const json = await res.json();
        if (!res.ok) throw new Error(json.error ?? 'Failed to load history');
        setRows(json.data ?? []);
      })
      .catch((err) => setError(err instanceof Error ? err.message : 'Failed to load history'))
      .finally(() => setLoading(false));
  }, [doc]);

  if (!doc) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ backgroundColor: 'rgba(0,0,0,0.4)' }} onClick={onClose}>
      <div
        className="w-full max-w-lg rounded-xl shadow-2xl"
        style={{ backgroundColor: 'var(--surface)', border: '1px solid var(--border)' }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="px-5 py-4 border-b" style={{ borderColor: 'var(--border)' }}>
          <h2 className="text-base font-semibold">Version history</h2>
          <p className="mt-1 text-sm" style={{ color: 'var(--foreground-muted)' }}>
            {doc.documentTypeName} · old versions are kept
          </p>
        </div>
        <div className="max-h-[60vh] overflow-y-auto px-5 py-3">
          {loading && <p className="text-sm" style={{ color: 'var(--foreground-muted)' }}>Loading…</p>}
          {error && <p className="text-sm" style={{ color: 'var(--danger)' }}>{error}</p>}
          <ol className="space-y-3">
            {rows.map((row, idx) => (
              <li key={row.id} className="rounded-lg border p-3" style={{ borderColor: 'var(--border)' }}>
                <div className="flex items-center justify-between gap-2">
                  <span className="text-sm font-medium">v{row.versionNo} {idx === 0 ? '· latest' : ''}</span>
                  <StatusBadge tone={STATUS_TONE[row.verificationStatus] ?? 'neutral'}>
                    {STATUS_LABEL[row.verificationStatus] ?? row.verificationStatus}
                  </StatusBadge>
                </div>
                <p className="mt-1 text-xs" style={{ color: 'var(--foreground-muted)' }}>
                  {row.documentRef} · {formatDate(row.uploadedAt)} · {row.originalFileName}
                </p>
                <button
                  type="button"
                  className="mt-2 text-xs font-medium"
                  style={{ color: 'var(--accent)' }}
                  onClick={() => onOpen(row)}
                >
                  Open
                </button>
              </li>
            ))}
          </ol>
        </div>
        <div className="flex justify-end px-5 py-3 border-t" style={{ borderColor: 'var(--border)' }}>
          <button type="button" className="text-sm" onClick={onClose}>Close</button>
        </div>
      </div>
    </div>
  );
}
