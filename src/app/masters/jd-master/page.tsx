/**
 * JD Master — HR Masters. List/filter/search, add/edit with dependent
 * designation dropdown, tags, file upload, version history, bulk upload,
 * export of the current filtered list, and usageCount-aware archive/delete.
 */

'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { ConfirmDialog, DataTable, KPICard, KPIGrid, SearchableSelect, type Column } from '@/components/ui';
import { useModuleStats } from '@/hooks/useModuleStats';
import { formatDate } from '@/lib/format-date';

interface OrgOption {
  id: number;
  name: string;
  code: string;
}

interface JobDescriptionRow {
  id: number;
  jdCode: string;
  departmentId: number;
  designationId: number;
  title: string;
  description: string;
  jdFileUrl: string | null;
  jdFileExt?: string | null;
  minExperienceYears: number | null;
  maxExperienceYears: number | null;
  salaryPackage: string | null;
  status: 'Draft' | 'Active' | 'Archived' | string;
  tags: string[];
  createdAt: string;
  updatedAt: string;
  usageCount: number;
  department: { id: number; name: string; code: string };
  designation: { id: number; name: string; code: string };
  createdBy: { id: number; email: string } | null;
  versions?: {
    id: number;
    title: string;
    description: string;
    jdFileUrl: string | null;
    jdFileExt?: string | null;
    minExperienceYears?: number | null;
    maxExperienceYears?: number | null;
    salaryPackage?: string | null;
    editedAt: string;
    editedBy: { id: number; email: string } | null;
  }[];
  jobPostings?: { id: number; title: string; status: string; createdAt: string }[];
}

type JdVersion = NonNullable<JobDescriptionRow['versions']>[number];

interface ApiResponse {
  data: JobDescriptionRow[];
  pagination: { page: number; limit: number; total: number; totalPages: number };
}

function experienceLabel(min: number | null | undefined, max: number | null | undefined) {
  if (min == null && max == null) return '—';
  if (min != null && max != null) return `${min}–${max} yrs`;
  if (min != null) return `${min}+ yrs`;
  return `Up to ${max} yrs`;
}

function FilePicker({
  accept,
  fileName,
  hint,
  onChange,
}: {
  accept: string;
  fileName?: string | null;
  hint: string;
  onChange: (file: File | null) => void;
}) {
  return (
    <label
      className="relative flex cursor-pointer flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed px-4 py-6 text-center transition hover:opacity-90"
      style={{
        borderColor: 'var(--accent)',
        backgroundColor: 'color-mix(in srgb, var(--accent) 12%, var(--surface))',
      }}
    >
      <span
        className="rounded-lg px-5 py-2 text-sm font-semibold text-white shadow-sm"
        style={{ backgroundColor: 'var(--accent)' }}
      >
        Choose file
      </span>
      <span className="text-xs font-medium" style={{ color: 'var(--foreground)' }}>
        {fileName || 'No file selected'}
      </span>
      <span className="text-xs font-normal" style={{ color: 'var(--foreground-muted)' }}>
        {hint}
      </span>
      <input
        type="file"
        className="absolute inset-0 h-full w-full cursor-pointer opacity-0"
        accept={accept}
        onChange={(e) => onChange(e.target.files?.[0] ?? null)}
      />
    </label>
  );
}

const inputClass =
  'w-full rounded-lg border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--accent)]';
const inputStyle = {
  backgroundColor: 'var(--surface)',
  color: 'var(--foreground)',
  borderColor: 'var(--border)',
} as const;

export default function JdMasterPage() {
  const { stats } = useModuleStats('jd-master');
  const [records, setRecords] = useState<JobDescriptionRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [page, setPage] = useState(1);
  const [pagination, setPagination] = useState({ page: 1, limit: 20, total: 0, totalPages: 0 });
  const [draftDepartmentId, setDraftDepartmentId] = useState<string | number | ''>('');
  const [draftDesignationId, setDraftDesignationId] = useState<string | number | ''>('');
  const [departmentId, setDepartmentId] = useState<string | number | ''>('');
  const [designationId, setDesignationId] = useState<string | number | ''>('');

  const [departments, setDepartments] = useState<OrgOption[]>([]);
  const [designations, setDesignations] = useState<OrgOption[]>([]);

  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<JobDescriptionRow | null>(null);
  const [viewing, setViewing] = useState<JobDescriptionRow | null>(null);
  const [viewTab, setViewTab] = useState<'details' | 'versions'>('details');
  const [snapshot, setSnapshot] = useState<JdVersion | null>(null);

  const [deleteRow, setDeleteRow] = useState<JobDescriptionRow | null>(null);
  const [bulkOpen, setBulkOpen] = useState(false);

  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search), 400);
    return () => clearTimeout(t);
  }, [search]);

  useEffect(() => {
    Promise.all([
      fetch('/api/org-options?table=Department').then((r) => r.json()),
      fetch('/api/org-options?table=Designation').then((r) => r.json()),
    ]).then(([depts, desigs]) => {
      setDepartments(Array.isArray(depts) ? depts : []);
      setDesignations(Array.isArray(desigs) ? desigs : []);
    });
  }, []);

  const queryParams = useCallback(() => {
    const params = new URLSearchParams({ page: String(page), limit: '20' });
    if (debouncedSearch) params.set('search', debouncedSearch);
    if (departmentId) params.set('departmentId', String(departmentId));
    if (designationId) params.set('designationId', String(designationId));
    return params;
  }, [page, debouncedSearch, departmentId, designationId]);

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/masters/jd-master?${queryParams()}`);
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json.error ?? 'Failed to fetch JD list');
      setRecords(Array.isArray(json.data) ? json.data : []);
      setPagination(json.pagination ?? { page: 1, limit: 20, total: 0, totalPages: 0 });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  }, [queryParams]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const deptOptions = useMemo(
    () => departments.map((d) => ({ label: `${d.code} — ${d.name}`, value: d.id })),
    [departments]
  );
  const designationOptions = useMemo(
    () => designations.map((d) => ({ label: `${d.code} — ${d.name}`, value: d.id })),
    [designations]
  );

  const applyFilters = () => {
    setDepartmentId(draftDepartmentId);
    setDesignationId(draftDepartmentId ? draftDesignationId : '');
    setPage(1);
  };

  const clearFilters = () => {
    setDraftDepartmentId('');
    setDraftDesignationId('');
    setDepartmentId('');
    setDesignationId('');
    setSearch('');
    setDebouncedSearch('');
    setPage(1);
  };

  const openAdd = () => {
    setEditing(null);
    setFormOpen(true);
  };
  const openEdit = (row: JobDescriptionRow) => {
    setEditing(row);
    setFormOpen(true);
  };
  const openView = async (row: JobDescriptionRow) => {
    setViewTab('details');
    setSnapshot(null);
    const res = await fetch(`/api/masters/jd-master/${row.id}`);
    if (res.ok) setViewing(await res.json());
    else setViewing(row);
  };

  const handleExport = async () => {
    const params = queryParams();
    params.delete('page');
    params.delete('limit');
    const res = await fetch(`/api/masters/jd-master/export?${params}`);
    if (!res.ok) {
      setError('Export failed');
      return;
    }
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'jd-master.xlsx';
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleDelete = async (row: JobDescriptionRow) => {
    const res = await fetch(`/api/masters/jd-master/${row.id}`, { method: 'DELETE' });
    const json = await res.json().catch(() => ({}));
    if (!res.ok) {
      setError(json.error ?? 'Delete failed');
      return;
    }
    fetchData();
  };

  const columns: Column<JobDescriptionRow>[] = [
    { key: 'jdCode', label: 'JD Code', className: 'font-medium' },
    { key: 'department', label: 'Department', render: (row) => row.department?.name ?? '—' },
    { key: 'designation', label: 'Designation', render: (row) => row.designation?.name ?? '—' },
    { key: 'title', label: 'Title' },
    {
      key: 'experience',
      label: 'Experience',
      render: (row) => experienceLabel(row.minExperienceYears, row.maxExperienceYears),
    },
    { key: 'salaryPackage', label: 'Salary Package', render: (row) => row.salaryPackage || '—' },
    {
      key: 'file',
      label: 'File',
      render: (row) =>
        row.jdFileUrl ? (
          <a
            href={row.jdFileUrl}
            className="text-xs font-semibold hover:underline"
            style={{ color: 'var(--accent)' }}
            target="_blank"
            rel="noreferrer"
          >
            Download
          </a>
        ) : (
          <span style={{ color: 'var(--foreground-muted)' }}>—</span>
        ),
    },
    { key: 'createdAt', label: 'Created Date', render: (row) => formatDate(row.createdAt) },
  ];

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-xl font-semibold" style={{ color: 'var(--foreground)' }}>
          JD Master
        </h1>
        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={handleExport}
            className="rounded-lg border px-4 py-2 text-sm font-medium transition hover:opacity-80"
            style={{ borderColor: 'var(--border)', color: 'var(--foreground)' }}
          >
            Export
          </button>
          <button
            onClick={() => setBulkOpen(true)}
            className="rounded-lg border px-4 py-2 text-sm font-medium transition hover:opacity-80"
            style={{ borderColor: 'var(--border)', color: 'var(--foreground)' }}
          >
            Bulk Upload
          </button>
          <button
            onClick={openAdd}
            className="rounded-lg px-4 py-2 text-sm font-medium text-white transition hover:opacity-90"
            style={{ backgroundColor: 'var(--accent)' }}
          >
            + Add JD
          </button>
        </div>
      </div>

      <KPIGrid columns={2}>
        <KPICard label="Total JDs" value={stats.total} tone="info" />
        <KPICard label="With file" value={stats.active ?? 0} tone="success" />
      </KPIGrid>

      {error && (
        <div className="rounded-lg px-3 py-2 text-sm" style={{ backgroundColor: '#fef2f2', color: '#dc2626', border: '1px solid #fecaca' }}>
          {error}
          <button className="ml-2 underline" onClick={() => setError(null)}>
            dismiss
          </button>
        </div>
      )}
      {success && (
        <div className="rounded-lg px-3 py-2 text-sm" style={{ backgroundColor: '#ecfdf5', color: '#047857', border: '1px solid #a7f3d0' }}>
          {success}
          <button className="ml-2 underline" onClick={() => setSuccess(null)}>
            dismiss
          </button>
        </div>
      )}

      <DataTable
        columns={columns}
        data={records}
        pagination={pagination}
        loading={loading}
        searchValue={search}
        searchPlaceholder="Search JD code or title..."
        onSearchChange={(v) => {
          setSearch(v);
          setPage(1);
        }}
        onPageChange={setPage}
        onEdit={openEdit}
        renderRowActions={(row) => (
          <button onClick={() => openView(row)} className="text-xs font-medium hover:underline" style={{ color: 'var(--accent)' }}>
            View
          </button>
        )}
        filters={
          <>
            <div className="min-w-[180px]">
              <SearchableSelect
                value={draftDepartmentId}
                options={deptOptions}
                onChange={(v) => {
                  setDraftDepartmentId(v);
                  setDraftDesignationId('');
                }}
                placeholder="Department"
              />
            </div>
            <div className="min-w-[180px]">
              <SearchableSelect
                value={draftDesignationId}
                options={designationOptions}
                onChange={setDraftDesignationId}
                placeholder="Designation"
                disabled={!draftDepartmentId}
              />
            </div>
            <button
              type="button"
              onClick={applyFilters}
              className="rounded-lg px-4 py-2 text-sm font-medium text-white"
              style={{ backgroundColor: 'var(--accent)' }}
            >
              Apply
            </button>
            <button
              type="button"
              onClick={clearFilters}
              className="rounded-lg border px-4 py-2 text-sm font-medium transition hover:opacity-80"
              style={{ borderColor: 'var(--border)', color: 'var(--foreground)' }}
            >
              Clear
            </button>
          </>
        }
      />

      {formOpen && (
        <JdForm
          editing={editing}
          departments={departments}
          designations={designations}
          onClose={() => setFormOpen(false)}
          onSaved={(msg) => {
            setFormOpen(false);
            setSuccess(msg);
            fetchData();
          }}
        />
      )}

      {viewing && (
        <ViewDrawer
          record={viewing}
          tab={viewTab}
          snapshot={snapshot}
          onTab={setViewTab}
          onSnapshot={setSnapshot}
          onClose={() => {
            setViewing(null);
            setSnapshot(null);
          }}
          onDelete={() => setDeleteRow(viewing)}
        />
      )}

      {bulkOpen && (
        <BulkUploadModal
          departments={departments}
          designations={designations}
          onClose={() => setBulkOpen(false)}
          onDone={() => {
            setBulkOpen(false);
            fetchData();
          }}
        />
      )}

      <ConfirmDialog
        title="Delete JD"
        message={
          deleteRow && deleteRow.usageCount > 0
            ? `This JD is linked to ${deleteRow.usageCount} active postings/employees — cannot delete`
            : 'Permanently hide this JD from the list? This cannot be undone from the UI.'
        }
        confirmLabel="Delete"
        isOpen={deleteRow !== null}
        onConfirm={() => deleteRow && handleDelete(deleteRow)}
        onClose={() => setDeleteRow(null)}
      />
    </div>
  );
}

function JdForm({
  editing,
  departments,
  designations,
  onClose,
  onSaved,
}: {
  editing: JobDescriptionRow | null;
  departments: OrgOption[];
  designations: OrgOption[];
  onClose: () => void;
  onSaved: (message: string) => void;
}) {
  const [departmentId, setDepartmentId] = useState<string | number | ''>(editing?.departmentId ?? '');
  const [designationId, setDesignationId] = useState<string | number | ''>(editing?.designationId ?? '');
  const [title, setTitle] = useState(editing?.title ?? '');
  const [description, setDescription] = useState(editing?.description ?? '');
  const [minExperienceYears, setMinExperienceYears] = useState(
    editing?.minExperienceYears != null ? String(editing.minExperienceYears) : ''
  );
  const [maxExperienceYears, setMaxExperienceYears] = useState(
    editing?.maxExperienceYears != null ? String(editing.maxExperienceYears) : ''
  );
  const [salaryPackage, setSalaryPackage] = useState(editing?.salaryPackage ?? '');
  const [file, setFile] = useState<File | null>(null);
  const [fileSkipped, setFileSkipped] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [pendingDuplicate, setPendingDuplicate] = useState<string | null>(null);

  const deptOptions = departments.map((d) => ({ label: `${d.code} — ${d.name}`, value: d.id }));
  const designationOptions = designations.map((d) => ({ label: `${d.code} — ${d.name}`, value: d.id }));

  const submit = async (acknowledgeDuplicate = false) => {
    const nextErrors: Record<string, string> = {};
    if (!departmentId) nextErrors.departmentId = 'Department is required';
    if (!designationId) nextErrors.designationId = 'Designation is required';
    if (!title.trim()) nextErrors.title = 'Title is required';
    if (!description.trim()) nextErrors.description = 'Description is required';
    const minExp = minExperienceYears === '' ? null : Number(minExperienceYears);
    const maxExp = maxExperienceYears === '' ? null : Number(maxExperienceYears);
    if (minExp != null && Number.isNaN(minExp)) nextErrors.minExperienceYears = 'Enter a valid number';
    if (maxExp != null && Number.isNaN(maxExp)) nextErrors.maxExperienceYears = 'Enter a valid number';
    if (minExp != null && maxExp != null && minExp > maxExp) {
      nextErrors.minExperienceYears = 'Min experience cannot exceed max experience';
    }
    if (Object.keys(nextErrors).length) {
      setErrors(nextErrors);
      return;
    }
    if (!file && !editing?.jdFileUrl) setFileSkipped(true);

    setSubmitting(true);
    setSubmitError(null);
    try {
      const form = new FormData();
      form.set('departmentId', String(departmentId));
      form.set('designationId', String(designationId));
      form.set('title', title.trim());
      form.set('description', description.trim());
      form.set('minExperienceYears', minExperienceYears);
      form.set('maxExperienceYears', maxExperienceYears);
      form.set('salaryPackage', salaryPackage.trim());
      if (acknowledgeDuplicate) form.set('acknowledgeDuplicate', 'true');
      if (file) form.set('file', file);

      const url = editing ? `/api/masters/jd-master/${editing.id}` : '/api/masters/jd-master';
      const res = await fetch(url, { method: editing ? 'PATCH' : 'POST', body: form });
      const json = await res.json();
      if (res.status === 409 && json.duplicateWarning) {
        setPendingDuplicate(json.message ?? 'A JD already exists for this Department + Designation — continue anyway?');
        return;
      }
      if (!res.ok) throw new Error(json.error ?? 'Save failed');
      onSaved(editing ? `Updated ${json.jdCode}` : `Created ${json.jdCode}`);
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : 'Save failed');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ backgroundColor: 'rgba(0,0,0,0.4)' }} onClick={onClose}>
      <div
        className="w-full max-w-lg rounded-xl shadow-2xl max-h-[90vh] overflow-y-auto"
        style={{ backgroundColor: 'var(--surface)', border: '1px solid var(--border)' }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-5 py-4 border-b" style={{ borderColor: 'var(--border)' }}>
          <h2 className="text-base font-semibold" style={{ color: 'var(--foreground)' }}>
            {editing ? 'Edit JD' : 'Add JD'}
          </h2>
          <button onClick={onClose} className="text-lg leading-none" style={{ color: 'var(--foreground-muted)' }}>
            ×
          </button>
        </div>
        <form
          className="px-5 py-4 space-y-4"
          onSubmit={(e) => {
            e.preventDefault();
            submit(false);
          }}
        >
          <label className="flex flex-col gap-1 text-sm font-medium" style={{ color: 'var(--foreground)' }}>
            Department <span className="text-red-500">*</span>
            <SearchableSelect
              value={departmentId}
              options={deptOptions}
              onChange={(v) => {
                setDepartmentId(v);
                setDesignationId('');
              }}
              error={Boolean(errors.departmentId)}
            />
            {errors.departmentId && <span className="text-xs text-red-500 font-normal">{errors.departmentId}</span>}
          </label>
          <label className="flex flex-col gap-1 text-sm font-medium" style={{ color: 'var(--foreground)' }}>
            Designation <span className="text-red-500">*</span>
            <SearchableSelect
              value={designationId}
              options={designationOptions}
              onChange={setDesignationId}
              disabled={!departmentId}
              error={Boolean(errors.designationId)}
              placeholder={departmentId ? '—' : 'Select a department first'}
            />
            {errors.designationId && <span className="text-xs text-red-500 font-normal">{errors.designationId}</span>}
          </label>
          <label className="flex flex-col gap-1 text-sm font-medium" style={{ color: 'var(--foreground)' }}>
            Title <span className="text-red-500">*</span>
            <input className={inputClass} style={inputStyle} value={title} onChange={(e) => setTitle(e.target.value)} />
            {errors.title && <span className="text-xs text-red-500 font-normal">{errors.title}</span>}
          </label>
          <label className="flex flex-col gap-1 text-sm font-medium" style={{ color: 'var(--foreground)' }}>
            Description <span className="text-red-500">*</span>
            <textarea className={inputClass} style={inputStyle} rows={5} value={description} onChange={(e) => setDescription(e.target.value)} />
            {errors.description && <span className="text-xs text-red-500 font-normal">{errors.description}</span>}
          </label>
          <div className="grid grid-cols-2 gap-3">
            <label className="flex flex-col gap-1 text-sm font-medium" style={{ color: 'var(--foreground)' }}>
              Min experience (years)
              <input
                type="number"
                min={0}
                max={60}
                step="0.5"
                className={inputClass}
                style={inputStyle}
                value={minExperienceYears}
                onChange={(e) => setMinExperienceYears(e.target.value)}
                placeholder="e.g. 2"
              />
              {errors.minExperienceYears && (
                <span className="text-xs text-red-500 font-normal">{errors.minExperienceYears}</span>
              )}
            </label>
            <label className="flex flex-col gap-1 text-sm font-medium" style={{ color: 'var(--foreground)' }}>
              Max experience (years)
              <input
                type="number"
                min={0}
                max={60}
                step="0.5"
                className={inputClass}
                style={inputStyle}
                value={maxExperienceYears}
                onChange={(e) => setMaxExperienceYears(e.target.value)}
                placeholder="e.g. 5"
              />
              {errors.maxExperienceYears && (
                <span className="text-xs text-red-500 font-normal">{errors.maxExperienceYears}</span>
              )}
            </label>
          </div>
          <label className="flex flex-col gap-1 text-sm font-medium" style={{ color: 'var(--foreground)' }}>
            Salary package
            <input
              className={inputClass}
              style={inputStyle}
              value={salaryPackage}
              onChange={(e) => setSalaryPackage(e.target.value)}
              placeholder="e.g. 4–6 LPA"
            />
          </label>
          <div className="flex flex-col gap-2">
            <span className="text-sm font-medium" style={{ color: 'var(--foreground)' }}>
              JD document (PDF / Word)
            </span>
            <p className="text-xs font-normal" style={{ color: 'var(--foreground-muted)' }}>
              Upload the full job description: title, description, roles, work, and skills. Download a blank PDF if you need a template.
            </p>
            <a
              href="/api/masters/jd-master/sample-pdf"
              className="text-xs font-semibold hover:underline w-fit"
              style={{ color: 'var(--accent)' }}
            >
              Download JD document template (PDF)
            </a>
            <FilePicker
              accept=".pdf,.doc,.docx,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
              fileName={file?.name ?? (editing?.jdFileUrl ? 'A file is already attached' : null)}
              hint="PDF, .doc or .docx — max 10 MB"
              onChange={(next) => {
                setFile(next);
                setFileSkipped(false);
              }}
            />
            {fileSkipped && !file && (
              <span className="text-xs font-normal" style={{ color: 'var(--warning)' }}>
                No file attached — recommended, but you can save without one.
              </span>
            )}
          </div>
          {submitError && (
            <div className="rounded-lg px-3 py-2 text-sm" style={{ backgroundColor: '#fef2f2', color: '#dc2626', border: '1px solid #fecaca' }}>
              {submitError}
            </div>
          )}
          {pendingDuplicate && (
            <div className="rounded-lg px-3 py-2 text-sm" style={{ backgroundColor: '#fffbeb', color: '#92400e', border: '1px solid #fde68a' }}>
              <p>{pendingDuplicate}</p>
              <button
                type="button"
                className="mt-2 rounded-lg px-3 py-1 text-xs font-medium text-white"
                style={{ backgroundColor: 'var(--accent)' }}
                onClick={() => {
                  setPendingDuplicate(null);
                  submit(true);
                }}
              >
                Continue anyway
              </button>
            </div>
          )}
          <div className="flex justify-end gap-2 pt-2">
            <button type="button" onClick={onClose} className="rounded-lg border px-4 py-2 text-sm font-medium" style={{ borderColor: 'var(--border)' }}>
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="rounded-lg px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
              style={{ backgroundColor: 'var(--accent)' }}
            >
              {submitting ? 'Saving...' : editing ? 'Update' : 'Create'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function ViewDrawer({
  record,
  tab,
  snapshot,
  onTab,
  onSnapshot,
  onClose,
  onDelete,
}: {
  record: JobDescriptionRow;
  tab: 'details' | 'versions';
  snapshot: JdVersion | null;
  onTab: (t: 'details' | 'versions') => void;
  onSnapshot: (v: JdVersion | null) => void;
  onClose: () => void;
  onDelete: () => void;
}) {
  const shown = snapshot
    ? {
        title: snapshot.title,
        description: snapshot.description,
        jdFileUrl: snapshot.jdFileUrl,
        jdFileExt: snapshot.jdFileExt ?? null,
      }
    : {
        title: record.title,
        description: record.description,
        jdFileUrl: record.jdFileUrl,
        jdFileExt: record.jdFileExt ?? null,
      };

  return (
    <div className="fixed inset-0 z-50 flex justify-end" style={{ backgroundColor: 'rgba(0,0,0,0.4)' }} onClick={onClose}>
      <aside
        className="h-full w-full max-w-3xl overflow-y-auto shadow-2xl"
        style={{ backgroundColor: 'var(--surface)', borderLeft: '1px solid var(--border)' }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-5 py-4 border-b" style={{ borderColor: 'var(--border)' }}>
          <div>
            <h2 className="text-base font-semibold" style={{ color: 'var(--foreground)' }}>
              {record.jdCode}
            </h2>
            <p className="text-xs" style={{ color: 'var(--foreground-muted)' }}>
              {record.department?.name} · {record.designation?.name}
            </p>
          </div>
          <button onClick={onClose} className="text-lg" style={{ color: 'var(--foreground-muted)' }}>
            ×
          </button>
        </div>
        <div className="flex gap-2 px-5 pt-3">
          {(['details', 'versions'] as const).map((t) => (
            <button
              key={t}
              onClick={() => {
                onTab(t);
                if (t === 'details') onSnapshot(null);
              }}
              className="rounded-lg px-3 py-1.5 text-xs font-medium capitalize"
              style={
                tab === t
                  ? { backgroundColor: 'var(--accent)', color: '#fff' }
                  : { backgroundColor: 'var(--surface-muted)', color: 'var(--foreground)' }
              }
            >
              {t === 'versions' ? 'Version History' : 'Details'}
            </button>
          ))}
        </div>
        {tab === 'details' ? (
          <div className="px-5 py-4 space-y-3 text-sm">
            <Row label="JD Code" value={record.jdCode} />
            <Row label="Department" value={record.department?.name} />
            <Row label="Designation" value={record.designation?.name} />
            <Row label="Title" value={shown.title} />
            <JdDocumentPreview url={shown.jdFileUrl} ext={shown.jdFileExt} />
            <div>
              <div className="text-xs font-medium mb-1" style={{ color: 'var(--foreground-muted)' }}>
                Description
              </div>
              <p className="whitespace-pre-wrap" style={{ color: 'var(--foreground)' }}>
                {shown.description}
              </p>
            </div>
            <Row
              label="Experience required"
              value={experienceLabel(
                snapshot?.minExperienceYears ?? record.minExperienceYears,
                snapshot?.maxExperienceYears ?? record.maxExperienceYears
              )}
            />
            <Row label="Salary package" value={snapshot?.salaryPackage ?? record.salaryPackage} />
            <Row label="Created By" value={record.createdBy?.email ?? '—'} />
            <Row label="Created Date" value={formatDate(record.createdAt)} />
            <div>
              <div className="text-xs font-medium mb-2" style={{ color: 'var(--foreground-muted)' }}>
                Used in {record.jobPostings?.length ?? 0} job posting{(record.jobPostings?.length ?? 0) === 1 ? '' : 's'}
              </div>
              {(record.jobPostings?.length ?? 0) === 0 ? (
                <p style={{ color: 'var(--foreground-muted)' }}>Not attached to any job posting yet.</p>
              ) : (
                <ul className="space-y-1">
                  {record.jobPostings!.map((p) => (
                    <li key={p.id}>
                      <Link href={`/recruitment/job-postings`} className="hover:underline" style={{ color: 'var(--accent)' }}>
                        {p.title}
                      </Link>
                      <span className="ml-2 text-xs" style={{ color: 'var(--foreground-muted)' }}>
                        {p.status} · {formatDate(p.createdAt)}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
            <button
              onClick={onDelete}
              className="mt-4 rounded-lg border px-3 py-1.5 text-xs font-medium text-red-600"
              style={{ borderColor: '#fecaca' }}
            >
              Delete
            </button>
          </div>
        ) : (
          <div className="px-5 py-4 space-y-2">
            {(record.versions?.length ?? 0) === 0 ? (
              <p className="text-sm" style={{ color: 'var(--foreground-muted)' }}>
                No previous versions yet. Snapshots are saved on every edit.
              </p>
            ) : (
              record.versions!.map((v) => (
                <button
                  key={v.id}
                  type="button"
                  onClick={() => {
                    onSnapshot(v);
                    onTab('details');
                  }}
                  className="w-full rounded-lg border px-3 py-2 text-left text-sm"
                  style={{ borderColor: 'var(--border)' }}
                >
                  <div className="font-medium" style={{ color: 'var(--foreground)' }}>
                    {v.title}
                  </div>
                  <div className="text-xs" style={{ color: 'var(--foreground-muted)' }}>
                    {v.editedBy?.email ?? 'Unknown'} · {formatDate(v.editedAt)}
                  </div>
                </button>
              ))
            )}
          </div>
        )}
      </aside>
    </div>
  );
}

function JdDocumentPreview({ url, ext }: { url: string | null; ext?: string | null }) {
  if (!url) {
    return (
      <div>
        <div className="text-xs font-medium mb-1" style={{ color: 'var(--foreground-muted)' }}>
          JD document
        </div>
        <p style={{ color: 'var(--foreground-muted)' }}>No file attached</p>
      </div>
    );
  }
  const kind = (ext ?? '').toLowerCase();
  const src = kind === '.docx' || kind === '.doc' ? `${url}?preview=1` : url;
  return (
    <div>
      <div className="flex items-center justify-between gap-2 mb-2">
        <div className="text-xs font-medium" style={{ color: 'var(--foreground-muted)' }}>
          JD document
        </div>
        <a href={url} className="text-xs font-semibold hover:underline" style={{ color: 'var(--accent)' }}>
          Download
        </a>
      </div>
      <iframe
        title="Job description document"
        src={src}
        className="w-full rounded-lg"
        style={{ height: '70vh', border: '1px solid var(--border)', backgroundColor: '#fff' }}
      />
    </div>
  );
}

function Row({ label, value }: { label: string; value?: string | null }) {
  return (
    <div>
      <div className="text-xs font-medium" style={{ color: 'var(--foreground-muted)' }}>
        {label}
      </div>
      <div style={{ color: 'var(--foreground)' }}>{value || '—'}</div>
    </div>
  );
}

function BulkUploadModal({
  departments,
  designations,
  onClose,
  onDone,
}: {
  departments: OrgOption[];
  designations: OrgOption[];
  onClose: () => void;
  onDone: () => void;
}) {
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [downloading, setDownloading] = useState<'csv' | 'pdf' | 'zip' | null>(null);
  const [summary, setSummary] = useState<{
    successCount: number;
    attachedFileCount?: number;
    failedRows: { row: number; reason: string }[];
  } | null>(null);
  const [error, setError] = useState<string | null>(null);

  const downloadBlob = async (url: string, filename: string) => {
    const res = await fetch(url);
    if (!res.ok) throw new Error('Could not download file');
    const blob = await res.blob();
    const href = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = href;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(href);
  };

  const downloadSampleCsv = async () => {
    setDownloading('csv');
    setError(null);
    try {
      await downloadBlob('/templates/jd-master-sample.csv', 'jd-master-sample.csv');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Download failed');
    } finally {
      setDownloading(null);
    }
  };

  const downloadSampleZip = async () => {
    setDownloading('zip');
    setError(null);
    try {
      await downloadBlob('/templates/jd-master-test-pack.zip', 'jd-master-test-pack.zip');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Download failed');
    } finally {
      setDownloading(null);
    }
  };

  const downloadSamplePdf = async () => {
    setDownloading('pdf');
    setError(null);
    try {
      await downloadBlob('/api/masters/jd-master/sample-pdf', 'jd-document-template.pdf');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Download failed');
    } finally {
      setDownloading(null);
    }
  };

  const upload = async () => {
    if (!file) {
      setError('Choose a CSV, Excel, or ZIP (CSV + JD PDFs) first');
      return;
    }
    setUploading(true);
    setError(null);
    try {
      const form = new FormData();
      form.set('file', file);
      const res = await fetch('/api/masters/jd-master/bulk-upload', { method: 'POST', body: form });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? 'Upload failed');
      setSummary(json);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Upload failed');
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ backgroundColor: 'rgba(0,0,0,0.4)' }} onClick={onClose}>
      <div
        className="w-full max-w-lg rounded-xl shadow-2xl max-h-[90vh] overflow-y-auto"
        style={{ backgroundColor: 'var(--surface)', border: '1px solid var(--border)' }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-5 py-4 border-b" style={{ borderColor: 'var(--border)' }}>
          <h2 className="text-base font-semibold" style={{ color: 'var(--foreground)' }}>
            Bulk Upload JDs
          </h2>
          <button type="button" onClick={onClose} className="text-lg leading-none" style={{ color: 'var(--foreground-muted)' }}>
            ×
          </button>
        </div>
        <div className="px-5 py-4 space-y-4 text-sm">
          <ol className="space-y-3" style={{ color: 'var(--foreground-muted)' }}>
            <li>
              <span className="font-medium" style={{ color: 'var(--foreground)' }}>
                1. Download templates
              </span>
              <p className="mt-1">
                CSV maps Department, Designation, Title, and a <em>JD File</em> column. Sample PDFs are bundled, so
                uploading the sample CSV (or the ZIP pack) attaches the document to each JD.
              </p>
              <div className="mt-2 flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={downloadSampleCsv}
                  disabled={downloading !== null}
                  className="rounded-lg px-3 py-1.5 text-xs font-medium text-white disabled:opacity-50"
                  style={{ backgroundColor: 'var(--accent)' }}
                >
                  {downloading === 'csv' ? 'Downloading…' : 'Download sample CSV'}
                </button>
                <button
                  type="button"
                  onClick={downloadSampleZip}
                  disabled={downloading !== null}
                  className="rounded-lg border px-3 py-1.5 text-xs font-semibold disabled:opacity-50"
                  style={{ borderColor: 'var(--accent)', color: 'var(--accent)' }}
                >
                  {downloading === 'zip' ? 'Downloading…' : 'Download CSV + PDFs (ZIP)'}
                </button>
                <button
                  type="button"
                  onClick={downloadSamplePdf}
                  disabled={downloading !== null}
                  className="rounded-lg border px-3 py-1.5 text-xs font-semibold disabled:opacity-50"
                  style={{ borderColor: 'var(--accent)', color: 'var(--accent)' }}
                >
                  {downloading === 'pdf' ? 'Downloading…' : 'Blank JD PDF template'}
                </button>
              </div>
            </li>
            <li>
              <span className="font-medium" style={{ color: 'var(--foreground)' }}>
                2. Choose file
              </span>
              <p className="mt-1">
                Upload the sample CSV, an Excel file, or a ZIP that contains the CSV plus PDF/Word JD files. Use department/designation <em>name</em> exactly as in masters.
              </p>
              <div className="mt-2">
                <FilePicker
                  accept=".xlsx,.xls,.csv,.zip"
                  fileName={file?.name}
                  hint="CSV, Excel, or ZIP of CSV + JD PDFs"
                  onChange={(next) => {
                    setFile(next);
                    setSummary(null);
                  }}
                />
              </div>
            </li>
            <li>
              <span className="font-medium" style={{ color: 'var(--foreground)' }}>
                3. Upload
              </span>
              <p className="mt-1">Each valid row gets a new JD code. Unknown department/designation rows are reported, not imported.</p>
            </li>
          </ol>
          {(departments.length > 0 || designations.length > 0) && (
            <p className="text-xs" style={{ color: 'var(--foreground-muted)' }}>
              Masters loaded: {departments.length} departments, {designations.length} designations.
            </p>
          )}
          {error && <p className="text-xs text-red-500">{error}</p>}
          {summary && (
            <div className="rounded-lg border px-3 py-2" style={{ borderColor: 'var(--border)' }}>
              <p>
                Created {summary.successCount} JD{summary.successCount === 1 ? '' : 's'}
                {typeof summary.attachedFileCount === 'number'
                  ? `, attached ${summary.attachedFileCount} file${summary.attachedFileCount === 1 ? '' : 's'}`
                  : ''}
                . Failed {summary.failedRows.length} row
                {summary.failedRows.length === 1 ? '' : 's'}.
              </p>
              {summary.failedRows.length > 0 && (
                <ul className="mt-2 max-h-40 overflow-y-auto text-xs" style={{ color: 'var(--foreground-muted)' }}>
                  {summary.failedRows.map((f) => (
                    <li key={`${f.row}-${f.reason}`}>
                      Row {f.row}: {f.reason}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}
          <div className="flex justify-end gap-2 pt-1">
            <button type="button" onClick={summary ? onDone : onClose} className="rounded-lg border px-4 py-2 text-sm" style={{ borderColor: 'var(--border)' }}>
              {summary ? 'Close' : 'Cancel'}
            </button>
            {!summary && (
              <button
                type="button"
                onClick={upload}
                disabled={uploading}
                className="rounded-lg px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
                style={{ backgroundColor: 'var(--accent)' }}
              >
                {uploading ? 'Uploading...' : 'Upload'}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
