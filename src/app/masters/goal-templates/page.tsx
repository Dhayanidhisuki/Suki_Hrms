/**
 * Goal Template builder.
 *
 * A template is a reusable, named bundle of KRA + KPI with default targets
 * and weightages, so HR does not rebuild a goal set from scratch each cycle.
 * Department/designation on the header are a *suggestion filter* — which
 * templates surface first for an employee — not an auto-assignment rule;
 * templates are always applied explicitly.
 *
 * Weightage validation is Model A (BRD §17) via the shared WeightageBuilder,
 * and the API re-runs the identical check on save.
 */

'use client';

import { useCallback, useEffect, useState } from 'react';
import {
  Alert, Button, ConfirmDialog, EmptyState, PageHeader, SectionCard, StatusBadge, Spinner,
} from '@/components/ui';
import WeightageBuilder, { type BuilderKra, type MasterKpi, type MasterKra } from '@/components/performance/WeightageBuilder';

interface TemplateRow {
  id: number;
  code: string;
  name: string;
  description: string | null;
  departmentId: number | null;
  designationId: number | null;
  status: 'ACTIVE' | 'INACTIVE';
  kras: Array<{ id: number; kraId: number; weightage: string; kpis: Array<{ id: number; kpiId: number; target: string; weightage: string }> }>;
}

interface Option { id: number; code: string; name: string }

const inputCls = 'rounded-lg border px-3 py-2 text-sm focus:outline-none focus:ring-2 w-full';
const inputStyle = { backgroundColor: 'var(--background)', color: 'var(--foreground)', borderColor: 'var(--border)' } as const;

type TemplateHeader = {
  code: string;
  name: string;
  description: string;
  departmentId: string;
  designationId: string;
  status: 'ACTIVE' | 'INACTIVE';
};

const BLANK: TemplateHeader = { code: '', name: '', description: '', departmentId: '', designationId: '', status: 'ACTIVE' };

export default function GoalTemplatesPage() {
  const [templates, setTemplates] = useState<TemplateRow[]>([]);
  const [kras, setKras] = useState<MasterKra[]>([]);
  const [kpis, setKpis] = useState<MasterKpi[]>([]);
  const [departments, setDepartments] = useState<Option[]>([]);
  const [designations, setDesignations] = useState<Option[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const [editingId, setEditingId] = useState<number | null>(null);
  const [isBuilding, setIsBuilding] = useState(false);
  const [header, setHeader] = useState<TemplateHeader>(BLANK);
  const [lines, setLines] = useState<BuilderKra[]>([]);
  const [saving, setSaving] = useState(false);
  const [deleteId, setDeleteId] = useState<number | null>(null);

  const fetchTemplates = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/masters/goal-templates');
      if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error ?? 'Failed to load templates');
      setTemplates((await res.json()).data ?? []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  }, []);

  // This page loads its data in an effect, the pattern every list screen in
  // this app uses. react-hooks/set-state-in-effect flags any setState
  // reachable from an effect — including one that only runs after an await —
  // so it cannot be satisfied by reordering; only moving data loading out of
  // effects entirely would clear it, which is a repo-wide change.
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { void fetchTemplates(); }, [fetchTemplates]);

  useEffect(() => {
    void (async () => {
      const [k, p, d, g] = await Promise.all([
        fetch('/api/masters/kra?status=ACTIVE'),
        fetch('/api/masters/kpi?status=ACTIVE'),
        fetch('/api/masters/departments?limit=500'),
        fetch('/api/masters/designations?limit=500'),
      ]);
      if (k.ok) setKras((await k.json()).data ?? []);
      if (p.ok) setKpis((await p.json()).data ?? []);
      if (d.ok) setDepartments((await d.json()).data ?? []);
      if (g.ok) setDesignations((await g.json()).data ?? []);
    })();
  }, []);

  const startNew = () => {
    setEditingId(null);
    setHeader(BLANK);
    setLines([]);
    setIsBuilding(true);
    setError(null);
  };

  const startEdit = (t: TemplateRow) => {
    setEditingId(t.id);
    setHeader({
      code: t.code,
      name: t.name,
      description: t.description ?? '',
      departmentId: t.departmentId != null ? String(t.departmentId) : '',
      designationId: t.designationId != null ? String(t.designationId) : '',
      status: t.status,
    });
    setLines(
      t.kras.map((k) => ({
        kraId: k.kraId,
        weightage: Number(k.weightage),
        kpis: k.kpis.map((p) => ({ kpiId: p.kpiId, target: Number(p.target), weightage: Number(p.weightage) })),
      }))
    );
    setIsBuilding(true);
    setError(null);
  };

  const save = async () => {
    setSaving(true);
    setError(null);
    try {
      const payload = {
        ...header,
        description: header.description || null,
        departmentId: header.departmentId || null,
        designationId: header.designationId || null,
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
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error([body.error, ...(body.details ?? [])].filter(Boolean).join(' · '));
      }
      setNotice(editingId ? 'Template updated.' : 'Template created.');
      setIsBuilding(false);
      await fetchTemplates();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Save failed');
    } finally {
      setSaving(false);
    }
  };

  const scopeLabel = (t: TemplateRow) => {
    const parts = [
      departments.find((d) => d.id === t.departmentId)?.name,
      designations.find((d) => d.id === t.designationId)?.name,
    ].filter(Boolean);
    return parts.length ? parts.join(' · ') : 'Any employee';
  };

  return (
    <div className="space-y-4">
      <PageHeader
        eyebrow="Performance Masters"
        title="Goal Templates"
        description="Reusable KRA + KPI bundles with default targets and weightages, applied to an employee during goal setting."
        actions={
          isBuilding
            ? <Button variant="ghost" onClick={() => setIsBuilding(false)}>Cancel</Button>
            : <Button variant="primary" onClick={startNew} disabled={kras.length === 0}>+ New Template</Button>
        }
      />

      {notice && <Alert tone="success" onDismiss={() => setNotice(null)}>{notice}</Alert>}
      {error && <Alert tone="danger" onDismiss={() => setError(null)}>{error}</Alert>}
      {kras.length === 0 && !loading && (
        <Alert tone="warning">Define active KRAs and KPIs before building a template.</Alert>
      )}

      {isBuilding ? (
        <SectionCard title={editingId ? 'Edit template' : 'New template'}>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            <label className="text-xs">
              <span style={{ color: 'var(--foreground-muted)' }}>Code *</span>
              <input className={inputCls} style={inputStyle} value={header.code} maxLength={30}
                onChange={(e) => setHeader({ ...header, code: e.target.value })} />
            </label>
            <label className="text-xs">
              <span style={{ color: 'var(--foreground-muted)' }}>Name *</span>
              <input className={inputCls} style={inputStyle} value={header.name}
                onChange={(e) => setHeader({ ...header, name: e.target.value })} />
            </label>
            <label className="text-xs">
              <span style={{ color: 'var(--foreground-muted)' }}>Status</span>
              <select className={inputCls} style={inputStyle} value={header.status}
                onChange={(e) => setHeader({ ...header, status: e.target.value as TemplateHeader['status'] })}>
                <option value="ACTIVE">Active</option>
                <option value="INACTIVE">Inactive</option>
              </select>
            </label>
            <label className="text-xs">
              <span style={{ color: 'var(--foreground-muted)' }}>Suggested for department</span>
              <select className={inputCls} style={inputStyle} value={header.departmentId}
                onChange={(e) => setHeader({ ...header, departmentId: e.target.value })}>
                <option value="">Any department</option>
                {departments.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
              </select>
            </label>
            <label className="text-xs">
              <span style={{ color: 'var(--foreground-muted)' }}>Suggested for designation</span>
              <select className={inputCls} style={inputStyle} value={header.designationId}
                onChange={(e) => setHeader({ ...header, designationId: e.target.value })}>
                <option value="">Any designation</option>
                {designations.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
              </select>
            </label>
            <label className="text-xs sm:col-span-2 lg:col-span-3">
              <span style={{ color: 'var(--foreground-muted)' }}>Description</span>
              <textarea rows={2} className={inputCls} style={inputStyle} value={header.description}
                onChange={(e) => setHeader({ ...header, description: e.target.value })} />
            </label>
          </div>

          <div className="mt-4">
            <WeightageBuilder mode="template" masterKras={kras} masterKpis={kpis} value={lines} onChange={setLines} />
          </div>

          <div className="mt-4 flex gap-2">
            <Button variant="primary" onClick={save} disabled={saving}>
              {saving ? 'Saving…' : editingId ? 'Update template' : 'Create template'}
            </Button>
            <Button variant="ghost" onClick={() => setIsBuilding(false)}>Cancel</Button>
          </div>
        </SectionCard>
      ) : loading ? (
        <div className="flex justify-center p-8"><Spinner /></div>
      ) : templates.length === 0 ? (
        <EmptyState title="No templates yet" description="Build one to reuse a KRA/KPI set across employees each cycle." />
      ) : (
        <div className="grid gap-3 md:grid-cols-2">
          {templates.map((t) => (
            <SectionCard
              key={t.id}
              title={`${t.code} — ${t.name}`}
              description={scopeLabel(t)}
              actions={
                <div className="flex gap-1.5">
                  <Button variant="ghost" size="sm" onClick={() => startEdit(t)}>Edit</Button>
                  <Button variant="ghost" size="sm" onClick={() => setDeleteId(t.id)}>Delete</Button>
                </div>
              }
            >
              <div className="mb-2">
                <StatusBadge tone={t.status === 'ACTIVE' ? 'success' : 'danger'} dot>
                  {t.status === 'ACTIVE' ? 'Active' : 'Inactive'}
                </StatusBadge>
              </div>
              <ul className="space-y-1 text-sm">
                {t.kras.map((k) => {
                  const kra = kras.find((m) => m.id === k.kraId);
                  return (
                    <li key={k.id} className="flex justify-between gap-2">
                      <span className="truncate">{kra ? `${kra.code} — ${kra.name}` : `KRA #${k.kraId}`}</span>
                      <span className="shrink-0 tabular-nums" style={{ color: 'var(--foreground-muted)' }}>
                        {Number(k.weightage)}% · {k.kpis.length} KPI{k.kpis.length === 1 ? '' : 's'}
                      </span>
                    </li>
                  );
                })}
              </ul>
            </SectionCard>
          ))}
        </div>
      )}

      <ConfirmDialog
        isOpen={deleteId != null}
        title="Delete template"
        message="Goals already assigned from this template keep their own copy and are not affected."
        onConfirm={async () => {
          if (deleteId != null) {
            const res = await fetch(`/api/masters/goal-templates/${deleteId}`, { method: 'DELETE' });
            if (!res.ok) setError((await res.json().catch(() => ({}))).error ?? 'Delete failed');
            else await fetchTemplates();
          }
          setDeleteId(null);
        }}
        onClose={() => setDeleteId(null)}
      />
    </div>
  );
}
