'use client';

import { useCallback, useEffect, useState } from 'react';
import { Button, DataTable, Field, PageHeader, StatusBadge, type Column } from '@/components/ui';
import { DOCUMENT_CATEGORIES, DOCUMENT_CLASSES, OWNER_ENTITY_TYPES } from '@/lib/platform/document/rules';
import {
  BUSINESS_CATEGORY_LABELS,
  DOCUMENT_BUSINESS_CATEGORIES,
  DOCUMENT_UPLOAD_MODES,
  describeCompanyUploadPolicy,
} from '@/lib/platform/document/categories';
import { readApiError } from '@/components/documents/types';

interface DocType {
  id: number;
  code: string;
  name: string;
  category: string;
  businessCategory: string;
  uploadMode: string;
  appliesToEntity: string;
  documentClass: string;
  verificationRequired: boolean;
  verifierRole: string | null;
  expiryRequired: boolean;
  allowedFileTypes: string;
  maxFileSizeMb: number;
  isActive: boolean;
}

const emptyForm = {
  code: '',
  name: '',
  category: 'IDENTITY',
  businessCategory: 'EMPLOYEE',
  uploadMode: 'EMPLOYEE_WITH_HR_VERIFICATION',
  appliesToEntity: 'EMPLOYEE',
  documentClass: 'INTERNAL',
  verificationRequired: true,
  verifierRole: 'hr-admin',
  expiryRequired: false,
  allowedFileTypes: 'pdf,jpg,png',
  maxFileSizeMb: 5,
  isActive: true,
};

export default function DocumentTypesPage() {
  const [rows, setRows] = useState<DocType[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<DocType | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/platform/document/types?includeInactive=1');
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? 'Failed to load types');
      setRows(json.data ?? []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load types');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  function openCreate() {
    setEditing(null);
    setForm(emptyForm);
    setOpen(true);
  }

  function openEdit(row: DocType) {
    setEditing(row);
    setForm({
      code: row.code,
      name: row.name,
      category: row.category,
      businessCategory: row.businessCategory,
      uploadMode: row.uploadMode,
      appliesToEntity: row.appliesToEntity,
      documentClass: row.documentClass,
      verificationRequired: row.verificationRequired,
      verifierRole: row.verifierRole ?? 'hr-admin',
      expiryRequired: row.expiryRequired,
      allowedFileTypes: row.allowedFileTypes,
      maxFileSizeMb: row.maxFileSizeMb,
      isActive: row.isActive,
    });
    setOpen(true);
  }

  async function save() {
    setSaving(true);
    setError(null);
    try {
      const body = {
        ...form,
        maxFileSizeMb: Number(form.maxFileSizeMb),
        verifierRole: form.verificationRequired ? form.verifierRole : null,
      };
      const res = editing
        ? await fetch(`/api/platform/document/types/${editing.id}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(body),
          })
        : await fetch('/api/platform/document/types', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(body),
          });
      if (!res.ok) throw new Error(await readApiError(res));
      setOpen(false);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Save failed');
    } finally {
      setSaving(false);
    }
  }

  const columns: Column<DocType>[] = [
    { key: 'code', label: 'Code' },
    { key: 'name', label: 'Name' },
    {
      key: 'businessCategory',
      label: 'Bucket',
      render: (r) => BUSINESS_CATEGORY_LABELS[r.businessCategory as keyof typeof BUSINESS_CATEGORY_LABELS] ?? r.businessCategory,
    },
    { key: 'uploadMode', label: 'Who uploads', render: (r) => (r.uploadMode === 'HR_ONLY' ? 'HR only' : 'Employee + HR verify') },
    { key: 'appliesToEntity', label: 'Owner' },
    {
      key: 'isActive',
      label: 'Active',
      render: (r) => <StatusBadge tone={r.isActive ? 'success' : 'neutral'}>{r.isActive ? 'Yes' : 'No'}</StatusBadge>,
    },
  ];

  return (
    <div className="space-y-4">
      <PageHeader
        eyebrow="Document Management"
        title="Document types"
        description="Each type belongs to a repository bucket and an upload mode. Employees never see HR-only types."
        actions={<Button variant="primary" onClick={openCreate}>Add type</Button>}
      />
      {/*
        The BRD's three upload modes: the first two are set per type below, and
        "Hybrid" is what a company gets by using both — so show which one the
        current configuration adds up to rather than asking HR to set it twice.
      */}
      {rows.length > 0 && (
        <div className="rounded-lg border p-3 text-sm" style={{ borderColor: 'var(--border)' }}>
          <span style={{ color: 'var(--foreground-muted)' }}>Company upload policy: </span>
          <span className="font-medium">
            {describeCompanyUploadPolicy(rows.filter((r) => r.isActive).map((r) => r.uploadMode)).label}
          </span>
        </div>
      )}
      {error && <p className="text-sm" style={{ color: 'var(--danger)' }}>{error}</p>}
      <DataTable
        variant="card"
        columns={columns}
        data={rows}
        loading={loading}
        emptyMessage="No document types. Seed types or add one."
        renderRowActions={(row) => (
          <button type="button" className="text-xs font-medium" style={{ color: 'var(--accent)' }} onClick={() => openEdit(row)}>
            Edit
          </button>
        )}
        rowKey={(r) => r.id}
      />

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ backgroundColor: 'rgba(0,0,0,0.4)' }} onClick={() => setOpen(false)}>
          <div className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-xl p-5 shadow-2xl" style={{ backgroundColor: 'var(--surface)', border: '1px solid var(--border)' }} onClick={(e) => e.stopPropagation()}>
            <h2 className="mb-4 text-base font-semibold">{editing ? 'Edit type' : 'Add type'}</h2>
            <div className="grid grid-cols-2 gap-3">
              <Field def={{ name: 'code', label: 'Code', type: 'text', required: true, disabled: !!editing }} value={form.code} onChange={(v) => setForm((f) => ({ ...f, code: String(v).toUpperCase() }))} />
              <Field def={{ name: 'name', label: 'Name', type: 'text', required: true }} value={form.name} onChange={(v) => setForm((f) => ({ ...f, name: String(v) }))} />
              <Field
                def={{ name: 'businessCategory', label: 'Repository bucket', type: 'select', options: DOCUMENT_BUSINESS_CATEGORIES.map((c) => ({ value: c, label: BUSINESS_CATEGORY_LABELS[c] })) }}
                value={form.businessCategory}
                onChange={(v) => setForm((f) => ({ ...f, businessCategory: String(v) }))}
              />
              <Field
                def={{ name: 'uploadMode', label: 'Who uploads', type: 'select', options: DOCUMENT_UPLOAD_MODES.map((m) => ({ value: m, label: m === 'HR_ONLY' ? 'HR only' : 'Employee + HR verify' })) }}
                value={form.uploadMode}
                onChange={(v) => setForm((f) => ({ ...f, uploadMode: String(v) }))}
              />
              <Field
                def={{ name: 'category', label: 'Technical category', type: 'select', options: DOCUMENT_CATEGORIES.map((c) => ({ value: c, label: c })) }}
                value={form.category}
                onChange={(v) => setForm((f) => ({ ...f, category: String(v) }))}
              />
              <Field
                def={{ name: 'appliesToEntity', label: 'Applies to', type: 'select', options: OWNER_ENTITY_TYPES.map((c) => ({ value: c, label: c })) }}
                value={form.appliesToEntity}
                onChange={(v) => setForm((f) => ({ ...f, appliesToEntity: String(v) }))}
              />
              <Field
                def={{ name: 'documentClass', label: 'Class', type: 'select', options: DOCUMENT_CLASSES.map((c) => ({ value: c, label: c })) }}
                value={form.documentClass}
                onChange={(v) => setForm((f) => ({ ...f, documentClass: String(v) }))}
              />
              <Field def={{ name: 'allowedFileTypes', label: 'Allowed extensions', type: 'text' }} value={form.allowedFileTypes} onChange={(v) => setForm((f) => ({ ...f, allowedFileTypes: String(v) }))} />
              <Field def={{ name: 'maxFileSizeMb', label: 'Max MB', type: 'number', min: 1, max: 25 }} value={form.maxFileSizeMb} onChange={(v) => setForm((f) => ({ ...f, maxFileSizeMb: Number(v) }))} />
              <Field def={{ name: 'verificationRequired', label: 'HR must verify', type: 'checkbox' }} value={form.verificationRequired} onChange={(v) => setForm((f) => ({ ...f, verificationRequired: Boolean(v) }))} />
              <Field def={{ name: 'expiryRequired', label: 'Expiry date required', type: 'checkbox' }} value={form.expiryRequired} onChange={(v) => setForm((f) => ({ ...f, expiryRequired: Boolean(v) }))} />
              <Field def={{ name: 'isActive', label: 'Active', type: 'checkbox' }} value={form.isActive} onChange={(v) => setForm((f) => ({ ...f, isActive: Boolean(v) }))} />
              {form.verificationRequired && (
                <Field def={{ name: 'verifierRole', label: 'Verifier role code', type: 'text' }} value={form.verifierRole} onChange={(v) => setForm((f) => ({ ...f, verifierRole: String(v) }))} />
              )}
            </div>
            <div className="mt-4 flex justify-end gap-2">
              <Button variant="secondary" onClick={() => setOpen(false)}>Cancel</Button>
              <Button variant="primary" loading={saving} onClick={() => void save()}>Save</Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
