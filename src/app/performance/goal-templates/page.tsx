/**
 * Goal Templates — catalogue of reusable KRA+KPI bundles (Performance).
 *
 * Weightage is Model A, live in WeightageBuilder and re-checked on save.
 * In-place edit is refused once the template has pending/accepted assignments;
 * Clone creates a new Draft instead.
 */

'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Alert, Button, ConfirmDialog, DataTable, PageHeader, SectionCard, Spinner, StatusBadge,
  type Column, type BadgeTone,
} from '@/components/ui';
import WeightageBuilder, { type BuilderKra, type MasterKpi, type MasterKra } from '@/components/performance/WeightageBuilder';

interface TemplateKpi {
  id: number;
  kpiId: number;
  target: string;
  weightage: string;
  minThreshold: string | null;
  maxTarget: string | null;
  measurementType?: string;
  unit?: string;
  kpi?: { id: number; code: string; name: string };
}
interface TemplateKra {
  id: number;
  kraId: number;
  weightage: string;
  kpis: TemplateKpi[];
  kra?: { id: number; code: string; name: string };
}
interface TemplateRow {
  id: number;
  code: string;
  name: string;
  description: string | null;
  departmentId: number | null;
  designationId: number | null;
  jobRole: string | null;
  status: 'DRAFT' | 'ACTIVE' | 'INACTIVE';
  lockedByAssignments?: number;
  kras: TemplateKra[];
  _count?: { kras: number };
}

interface Option { id: number; code: string; name: string }

const inputCls = 'rounded-lg border px-3 py-2 text-sm focus:outline-none focus:ring-2 w-full';
const inputStyle = { backgroundColor: 'var(--background)', color: 'var(--foreground)', borderColor: 'var(--border)' } as const;

const STATUS_TONE: Record<TemplateRow['status'], BadgeTone> = {
  DRAFT: 'neutral',
  ACTIVE: 'success',
  INACTIVE: 'danger',
};

type Header = {
  name: string;
  description: string;
  departmentId: string;
  designationId: string;
  jobRole: string;
  status: TemplateRow['status'];
};

const BLANK: Header = { name: '', description: '', departmentId: '', designationId: '', jobRole: '', status: 'DRAFT' };

type Mode = 'list' | 'create' | 'edit' | 'view';

export default function GoalTemplatesPage() {
  const [templates, setTemplates] = useState<TemplateRow[]>([]);
  const [kras, setKras] = useState<MasterKra[]>([]);
  const [kpis, setKpis] = useState<MasterKpi[]>([]);
  const [departments, setDepartments] = useState<Option[]>([]);
  const [designations, setDesignations] = useState<Option[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const [search, setSearch] = useState('');
  const [filterDept, setFilterDept] = useState('');
  const [filterDesig, setFilterDesig] = useState('');
  const [filterStatus, setFilterStatus] = useState('');

  const [mode, setMode] = useState<Mode>('list');
  const [editingId, setEditingId] = useState<number | null>(null);
  const [header, setHeader] = useState<Header>(BLANK);
  const [lines, setLines] = useState<BuilderKra[]>([]);
  const [saving, setSaving] = useState(false);
  const [deactivateId, setDeactivateId] = useState<number | null>(null);

  const fetchTemplates = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        ...(search ? { search } : {}),
        ...(filterDept ? { departmentId: filterDept } : {}),
        ...(filterDesig ? { designationId: filterDesig } : {}),
        ...(filterStatus ? { status: filterStatus } : {}),
      });
      const res = await fetch(`/api/masters/goal-templates?${params}`);
      if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error ?? 'Failed to load templates');
      setTemplates((await res.json()).data ?? []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  }, [search, filterDept, filterDesig, filterStatus]);

  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { void fetchTemplates(); }, [fetchTemplates]);

  useEffect(() => {
    void (async () => {
      const [k, p, d, g] = await Promise.all([
        // Only KRAs effective today — the save would be rejected otherwise
        // (BRD §8), so don't offer them in the picker.
        fetch(`/api/masters/kra?status=ACTIVE&all=true&effectiveOn=${new Date().toISOString().slice(0, 10)}`),
        fetch('/api/masters/kpi?status=ACTIVE&all=true'),
        fetch('/api/masters/departments?limit=500'),
        fetch('/api/masters/designations?limit=500'),
      ]);
      if (k.ok) setKras((await k.json()).data ?? []);
      if (p.ok) setKpis((await p.json()).data ?? []);
      if (d.ok) setDepartments((await d.json()).data ?? []);
      if (g.ok) setDesignations((await g.json()).data ?? []);
    })();
  }, []);

  const toLines = (t: TemplateRow): BuilderKra[] =>
    t.kras.map((k) => ({
      kraId: k.kraId,
      weightage: Number(k.weightage),
      kpis: k.kpis.map((p) => ({
        kpiId: p.kpiId,
        target: Number(p.target),
        weightage: Number(p.weightage),
        minThreshold: p.minThreshold != null ? Number(p.minThreshold) : undefined,
        maxTarget: p.maxTarget != null ? Number(p.maxTarget) : undefined,
      })),
    }));

  const startNew = () => {
    setEditingId(null);
    setHeader(BLANK);
    setLines([]);
    setMode('create');
    setError(null);
  };

  const open = async (t: TemplateRow, next: 'edit' | 'view') => {
    setError(null);
    const res = await fetch(`/api/masters/goal-templates/${t.id}`);
    const body = res.ok ? await res.json() : t;
    setEditingId(t.id);
    setHeader({
      name: body.name,
      description: body.description ?? '',
      departmentId: body.departmentId != null ? String(body.departmentId) : '',
      designationId: body.designationId != null ? String(body.designationId) : '',
      jobRole: body.jobRole ?? '',
      status: body.status,
    });
    setLines(toLines(body));
    if (next === 'edit' && Number(body.lockedByAssignments) > 0) {
      setError('This template has active assignments. Clone it to revise; in-place edit is blocked.');
      setMode('view');
      return;
    }
    setMode(next);
  };

  const save = async () => {
    setSaving(true);
    setError(null);
    try {
      const payload = {
        name: header.name,
        description: header.description || null,
        departmentId: header.departmentId || null,
        designationId: header.designationId || null,
        jobRole: header.jobRole || null,
        status: header.status,
        kras: lines.map((k) => ({
          kraId: k.kraId,
          weightage: Number(k.weightage),
          kpis: k.kpis.map((p) => ({ kpiId: p.kpiId, target: Number(p.target), weightage: Number(p.weightage) })),
        })),
      };
      const res = await fetch(editingId ? `/api/masters/goal-templates/${editingId}` : '/api/masters/goal-templates', {
        method: editingId ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error([body.error, ...(body.details ?? [])].filter(Boolean).join(' · '));
      setNotice(editingId ? 'Template updated.' : `Template ${body.code} created.`);
      setMode('list');
      await fetchTemplates();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Save failed');
    } finally {
      setSaving(false);
    }
  };

  const clone = async (t: TemplateRow) => {
    const res = await fetch(`/api/masters/goal-templates/${t.id}/clone`, { method: 'POST' });
    const body = await res.json().catch(() => ({}));
    if (!res.ok) {
      setError(body.error ?? 'Clone failed');
      return;
    }
    setNotice(`Cloned as ${body.code} (Draft).`);
    await fetchTemplates();
    await open(body, 'edit');
  };

  const scopeLabel = (t: TemplateRow) => {
    const parts = [
      departments.find((d) => d.id === t.departmentId)?.name,
      designations.find((d) => d.id === t.designationId)?.name,
      t.jobRole,
    ].filter(Boolean);
    return parts.length ? parts.join(' · ') : 'Any';
  };

  const columns: Column<TemplateRow>[] = useMemo(() => [
    { key: 'code', label: 'Template Code', render: (r) => <span className="font-medium tabular-nums">{r.code}</span> },
    { key: 'name', label: 'Name' },
    { key: 'scope', label: 'Department / Designation', render: (r) => scopeLabel(r) },
    { key: 'kraCount', label: 'KRA count', render: (r) => r._count?.kras ?? r.kras.length },
    {
      key: 'status',
      label: 'Status',
      render: (r) => <StatusBadge tone={STATUS_TONE[r.status]} dot>{r.status.charAt(0) + r.status.slice(1).toLowerCase()}</StatusBadge>,
    },
  ], [departments, designations]);

  const building = mode !== 'list';
  const readOnly = mode === 'view';

  return (
    <div className="space-y-4">
      <PageHeader
        eyebrow="Performance"
        title="Goal Templates"
        description="Reusable KRA + KPI bundles. Codes are assigned automatically (GT-0001). Clone a template to revise one that is already assigned."
        actions={
          building
            ? <Button variant="ghost" onClick={() => setMode('list')}>Back to list</Button>
            : <Button variant="primary" onClick={startNew} disabled={kras.length === 0}>Add Template</Button>
        }
      />

      {notice && <Alert tone="success" onDismiss={() => setNotice(null)}>{notice}</Alert>}
      {error && <Alert tone="danger" onDismiss={() => setError(null)}>{error}</Alert>}
      {kras.length === 0 && !loading && (
        <Alert tone="warning">Define active KRAs and KPIs before building a template.</Alert>
      )}

      {building ? (
        <SectionCard title={mode === 'create' ? 'New template' : mode === 'view' ? `View ${header.name}` : `Edit ${header.name}`}>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            <label className="text-xs sm:col-span-2">
              <span style={{ color: 'var(--foreground-muted)' }}>Name *</span>
              <input className={inputCls} style={inputStyle} value={header.name} disabled={readOnly}
                onChange={(e) => setHeader({ ...header, name: e.target.value })} />
            </label>
            <label className="text-xs">
              <span style={{ color: 'var(--foreground-muted)' }}>Status</span>
              <select className={inputCls} style={inputStyle} value={header.status} disabled={readOnly}
                onChange={(e) => setHeader({ ...header, status: e.target.value as Header['status'] })}>
                <option value="DRAFT">Draft</option>
                <option value="ACTIVE">Active</option>
                <option value="INACTIVE">Inactive</option>
              </select>
            </label>
            <label className="text-xs">
              <span style={{ color: 'var(--foreground-muted)' }}>Department (optional default)</span>
              <select className={inputCls} style={inputStyle} value={header.departmentId} disabled={readOnly}
                onChange={(e) => setHeader({ ...header, departmentId: e.target.value })}>
                <option value="">Any department</option>
                {departments.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
              </select>
            </label>
            <label className="text-xs">
              <span style={{ color: 'var(--foreground-muted)' }}>Designation (optional default)</span>
              <select className={inputCls} style={inputStyle} value={header.designationId} disabled={readOnly}
                onChange={(e) => setHeader({ ...header, designationId: e.target.value })}>
                <option value="">Any designation</option>
                {designations.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
              </select>
            </label>
            <label className="text-xs">
              <span style={{ color: 'var(--foreground-muted)' }}>Job role (optional)</span>
              <input className={inputCls} style={inputStyle} value={header.jobRole} disabled={readOnly} maxLength={100}
                onChange={(e) => setHeader({ ...header, jobRole: e.target.value })} />
            </label>
            <label className="text-xs sm:col-span-2 lg:col-span-3">
              <span style={{ color: 'var(--foreground-muted)' }}>Description</span>
              <textarea rows={2} className={inputCls} style={inputStyle} value={header.description} disabled={readOnly}
                onChange={(e) => setHeader({ ...header, description: e.target.value })} />
            </label>
          </div>
          {mode === 'create' && (
            <p className="mt-2 text-xs" style={{ color: 'var(--foreground-muted)' }}>
              Template code is generated on save (GT-0001, GT-0002, …).
            </p>
          )}

          <div className="mt-4">
            <WeightageBuilder mode="template" masterKras={kras} masterKpis={kpis} value={lines} onChange={setLines} readOnly={readOnly} />
          </div>

          {!readOnly && (
            <div className="mt-4 flex gap-2">
              <Button variant="primary" onClick={save} disabled={saving || !header.name.trim()}>
                {saving ? 'Saving…' : editingId ? 'Update template' : 'Create template'}
              </Button>
              <Button variant="ghost" onClick={() => setMode('list')}>Cancel</Button>
            </div>
          )}
        </SectionCard>
      ) : loading ? (
        <div className="flex justify-center p-8"><Spinner /></div>
      ) : (
        <DataTable
          variant="card"
          columns={columns}
          data={templates}
          loading={loading}
          searchValue={search}
          searchPlaceholder="Search code or name"
          onSearchChange={setSearch}
          emptyMessage="No templates yet. Add one to reuse a KRA/KPI set across employees."
          filters={
            <>
              <select className={inputCls} style={{ ...inputStyle, width: '11rem' }} value={filterDept} onChange={(e) => setFilterDept(e.target.value)}>
                <option value="">All departments</option>
                {departments.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
              </select>
              <select className={inputCls} style={{ ...inputStyle, width: '11rem' }} value={filterDesig} onChange={(e) => setFilterDesig(e.target.value)}>
                <option value="">All designations</option>
                {designations.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
              </select>
              <select className={inputCls} style={{ ...inputStyle, width: '9rem' }} value={filterStatus} onChange={(e) => setFilterStatus(e.target.value)}>
                <option value="">All statuses</option>
                <option value="DRAFT">Draft</option>
                <option value="ACTIVE">Active</option>
                <option value="INACTIVE">Inactive</option>
              </select>
            </>
          }
          renderRowActions={(row) => (
            <div className="flex flex-wrap gap-1">
              <Button variant="ghost" size="xs" onClick={() => void open(row, 'view')}>View</Button>
              <Button variant="ghost" size="xs" onClick={() => void open(row, 'edit')}>Edit</Button>
              <Button variant="ghost" size="xs" onClick={() => void clone(row)}>Clone</Button>
              {row.status !== 'INACTIVE' && (
                <Button variant="ghost" size="xs" onClick={() => setDeactivateId(row.id)}>Deactivate</Button>
              )}
            </div>
          )}
        />
      )}

      <ConfirmDialog
        isOpen={deactivateId != null}
        title="Deactivate template"
        message="Assigned goal sets keep their own snapshot. The template will no longer appear in the assignment picker."
        onConfirm={async () => {
          if (deactivateId != null) {
            const res = await fetch(`/api/masters/goal-templates/${deactivateId}/status`, {
              method: 'PATCH',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ status: 'INACTIVE' }),
            });
            if (!res.ok) setError((await res.json().catch(() => ({}))).error ?? 'Deactivate failed');
            else await fetchTemplates();
          }
          setDeactivateId(null);
        }}
        onClose={() => setDeactivateId(null)}
      />
    </div>
  );
}
