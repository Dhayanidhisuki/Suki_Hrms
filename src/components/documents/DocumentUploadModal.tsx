'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { Button, Field } from '@/components/ui';
import { HR_MANAGER_ROLE_CODES } from '@/lib/platform/document/rules';
import { BUSINESS_CATEGORY_LABELS, type DocumentBusinessCategory } from '@/lib/platform/document/categories';
import { readApiError, type PlatformDocumentType } from './types';

type EmployeeOpt = { id: number; employeeCode: string; firstName: string; lastName: string };

interface Props {
  isOpen: boolean;
  onClose: () => void;
  onUploaded: () => void;
  businessCategory?: DocumentBusinessCategory | null;
  lockedOwner?: { ownerEntityType: 'EMPLOYEE' | 'CANDIDATE'; ownerEntityId: number; label: string } | null;
}

export default function DocumentUploadModal({ isOpen, onClose, onUploaded, businessCategory, lockedOwner }: Props) {
  const [isHr, setIsHr] = useState(false);
  const [types, setTypes] = useState<PlatformDocumentType[]>([]);
  const [documentTypeCode, setDocumentTypeCode] = useState('');
  const [empQuery, setEmpQuery] = useState('');
  const [empOptions, setEmpOptions] = useState<EmployeeOpt[]>([]);
  const [ownerEntityId, setOwnerEntityId] = useState<number | ''>('');
  const [file, setFile] = useState<File | null>(null);
  const [issueDate, setIssueDate] = useState('');
  const [expiryDate, setExpiryDate] = useState('');
  const [identifier, setIdentifier] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const selectedType = types.find((t) => t.code === documentTypeCode);

  useEffect(() => {
    if (!isOpen) return;
    setError(null);
    setFile(null);
    setDocumentTypeCode('');
    setIssueDate('');
    setExpiryDate('');
    setIdentifier('');
    if (!lockedOwner) {
      setOwnerEntityId('');
      setEmpQuery('');
    }
    fetch('/api/auth/me')
      .then((r) => r.json())
      .then((me) => {
        setIsHr(!!me.roleCode && HR_MANAGER_ROLE_CODES.includes(me.roleCode));
      })
      .catch(() => setIsHr(false));
  }, [isOpen, lockedOwner]);

  useEffect(() => {
    if (!isOpen) return;
    const params = new URLSearchParams();
    if (businessCategory) params.set('businessCategory', businessCategory);
    fetch(`/api/platform/document/types?${params}`)
      .then((r) => r.json())
      .then((json) => {
        const rows: PlatformDocumentType[] = json.data ?? [];
        setTypes(rows);
      })
      .catch(() => setTypes([]));
  }, [isOpen, businessCategory]);

  const visibleTypes = useMemo(() => {
    const entity = lockedOwner?.ownerEntityType ?? 'EMPLOYEE';
    const forOwner = types.filter((t) => t.appliesToEntity === entity);
    if (isHr) return forOwner;
    return forOwner.filter((t) => t.uploadMode !== 'HR_ONLY');
  }, [types, isHr, lockedOwner]);

  useEffect(() => {
    if (!isOpen || lockedOwner || !isHr) return;
    const q = empQuery.trim();
    const t = setTimeout(() => {
      const url = q ? `/api/employees?search=${encodeURIComponent(q)}&limit=15` : '/api/employees?limit=15';
      fetch(url)
        .then((r) => r.json())
        .then((json) => setEmpOptions(json.data ?? []))
        .catch(() => setEmpOptions([]));
    }, 250);
    return () => clearTimeout(t);
  }, [empQuery, isOpen, isHr, lockedOwner]);

  const handleSubmit = useCallback(async () => {
    setError(null);
    const ownerId = lockedOwner?.ownerEntityId ?? (typeof ownerEntityId === 'number' ? ownerEntityId : Number(ownerEntityId));
    if (!documentTypeCode) {
      setError('Select a document type');
      return;
    }
    if (!Number.isInteger(ownerId) || ownerId <= 0) {
      setError('Select an employee');
      return;
    }
    if (!file) {
      setError('Choose a file');
      return;
    }
    if (selectedType?.expiryRequired && !expiryDate) {
      setError(`${selectedType.name} requires an expiry date`);
      return;
    }
    const form = new FormData();
    form.append('file', file);
    form.append('documentTypeCode', documentTypeCode);
    form.append('ownerEntityType', lockedOwner?.ownerEntityType ?? 'EMPLOYEE');
    form.append('ownerEntityId', String(ownerId));
    if (issueDate) form.append('issueDate', issueDate);
    if (expiryDate) form.append('expiryDate', expiryDate);
    if (identifier.trim()) form.append('identifier', identifier.trim());
    setSubmitting(true);
    try {
      const res = await fetch('/api/platform/document', { method: 'POST', body: form });
      if (!res.ok) throw new Error(await readApiError(res));
      onUploaded();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Upload failed');
    } finally {
      setSubmitting(false);
    }
  }, [documentTypeCode, ownerEntityId, lockedOwner, file, expiryDate, issueDate, identifier, selectedType, onUploaded, onClose]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ backgroundColor: 'rgba(0,0,0,0.4)' }} onClick={onClose}>
      <div
        className="w-full max-w-lg rounded-xl shadow-2xl"
        style={{ backgroundColor: 'var(--surface)', border: '1px solid var(--border)' }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="px-5 py-4 border-b" style={{ borderColor: 'var(--border)' }}>
          <h2 className="text-base font-semibold" style={{ color: 'var(--foreground)' }}>
            Upload document
          </h2>
          <p className="mt-1 text-sm" style={{ color: 'var(--foreground-muted)' }}>
            {businessCategory ? BUSINESS_CATEGORY_LABELS[businessCategory] : 'Any category'}
            {lockedOwner ? ` · ${lockedOwner.label}` : ''}
          </p>
        </div>
        <div className="space-y-3 px-5 py-4">
          {!lockedOwner && isHr && (
            <div className="flex flex-col gap-1">
              <label className="text-sm font-medium" style={{ color: 'var(--foreground)' }}>Employee</label>
              <input
                value={empQuery}
                onChange={(e) => setEmpQuery(e.target.value)}
                placeholder="Search emp ID or name"
                className="w-full rounded-lg border px-3 py-2 text-sm"
                style={{ backgroundColor: 'var(--surface)', borderColor: 'var(--border)', color: 'var(--foreground)' }}
              />
              <select
                value={ownerEntityId}
                onChange={(e) => setOwnerEntityId(e.target.value ? Number(e.target.value) : '')}
                className="w-full rounded-lg border px-3 py-2 text-sm"
                style={{ backgroundColor: 'var(--surface)', borderColor: 'var(--border)', color: 'var(--foreground)' }}
              >
                <option value="">Select employee</option>
                {empOptions.map((e) => (
                  <option key={e.id} value={e.id}>
                    {e.employeeCode} — {e.firstName} {e.lastName}
                  </option>
                ))}
              </select>
            </div>
          )}
          <Field
            def={{
              name: 'documentTypeCode',
              label: 'Document type',
              type: 'select',
              required: true,
              options: visibleTypes.map((t) => ({
                value: t.code,
                label: `${t.name}${t.uploadMode === 'HR_ONLY' ? ' (HR only)' : ''}`,
              })),
            }}
            value={documentTypeCode}
            onChange={(v) => setDocumentTypeCode(String(v))}
          />
          {selectedType && (
            <p className="text-xs" style={{ color: 'var(--foreground-muted)' }}>
              Allowed: {selectedType.allowedFileTypes} · max {selectedType.maxFileSizeMb} MB
              {selectedType.expiryRequired ? ' · expiry required' : ''}
              {selectedType.verificationRequired ? ' · HR verification' : ' · auto-verified'}
            </p>
          )}
          <div className="flex flex-col gap-1">
            <label className="text-sm font-medium" style={{ color: 'var(--foreground)' }}>File</label>
            <input
              type="file"
              onChange={(e) => setFile(e.target.files?.[0] ?? null)}
              className="w-full text-sm"
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Field def={{ name: 'issueDate', label: 'Issue date', type: 'date' }} value={issueDate} onChange={(v) => setIssueDate(String(v))} />
            <Field def={{ name: 'expiryDate', label: 'Expiry date', type: 'date', required: selectedType?.expiryRequired }} value={expiryDate} onChange={(v) => setExpiryDate(String(v))} />
          </div>
          <Field def={{ name: 'identifier', label: 'ID number (optional, stored masked)', type: 'text', maxLength: 40 }} value={identifier} onChange={(v) => setIdentifier(String(v))} />
          {error && <p className="text-sm" style={{ color: 'var(--danger)' }}>{error}</p>}
        </div>
        <div className="flex justify-end gap-2 px-5 py-3 border-t" style={{ borderColor: 'var(--border)' }}>
          <Button type="button" variant="secondary" onClick={onClose}>Cancel</Button>
          <Button type="button" variant="primary" loading={submitting} onClick={handleSubmit}>Upload</Button>
        </div>
      </div>
    </div>
  );
}
