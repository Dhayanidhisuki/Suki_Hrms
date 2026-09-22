'use client';

import { useState, useEffect } from 'react';
import { DataTable, FormModal, KPICard, KPIGrid } from '@/components/ui';
import type { Column, FieldDef } from '@/components/ui';
import { exportCsv } from '@/lib/exportCsv';
import { exportXlsx } from '@/lib/exportXlsx';
import { printTable } from '@/lib/printTable';

interface SkillLevel {
  id: number;
  levelNumber: number;
  name: string;
  color: string | null;
}

interface MatrixRow {
  id: number;
  employeeId: number;
  employeeCode: string;
  employeeName: string;
  departmentName: string;
  designationName: string;
  gradeName: string;
  itemType?: 'COMPETENCY' | 'SKILL';
  competencyId: number;
  competencyCode: string | null;
  competencyName: string;
  category: string;
  requiredLevelNumber: number;
  requiredLevelName: string;
  requiredColor: string | null;
  currentLevelId: number | null;
  currentLevelNumber: number;
  currentLevelName: string;
  currentColor: string | null;
  targetLevelId: number | null;
  targetLevelName: string | null;
  gap: number;
  gapStatus: 'met' | 'open' | 'critical';
}

interface MatrixResponse {
  data: MatrixRow[];
  kpis: {
    employeesAssessed: number;
    skillsTracked: number;
    openGaps: number;
    criticalGaps: number;
  };
}

const views = [
  { label: 'Employee-wise', value: 'employee' },
  { label: 'Department-wise', value: 'department' },
  { label: 'Role-wise', value: 'role' },
  { label: 'Skill-wise', value: 'skill' },
];

const gapStatuses = [
  { label: 'All', value: '' },
  { label: 'Met', value: 'met' },
  { label: 'Open', value: 'open' },
  { label: 'Critical', value: 'critical' },
];

export default function SkillMatrixPage() {
  const [records, setRecords] = useState<MatrixRow[]>([]);
  const [kpis, setKpis] = useState<MatrixResponse['kpis']>({ employeesAssessed: 0, skillsTracked: 0, openGaps: 0, criticalGaps: 0 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [view, setView] = useState('employee');
  const [gapStatus, setGapStatus] = useState('');
  const [search, setSearch] = useState('');
  const [departmentId, setDepartmentId] = useState('');
  const [designationId, setDesignationId] = useState('');
  const [locationId, setLocationId] = useState('');
  const [myTeam, setMyTeam] = useState(false);
  const [departments, setDepartments] = useState<{ id: number; name: string }[]>([]);
  const [designations, setDesignations] = useState<{ id: number; name: string }[]>([]);
  const [locations, setLocations] = useState<{ id: number; name: string }[]>([]);
  const [skillLevels, setSkillLevels] = useState<SkillLevel[]>([]);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingRow, setEditingRow] = useState<MatrixRow | null>(null);

  useEffect(() => {
    const loadLevels = async () => {
      try {
        const res = await fetch('/api/skill-levels?limit=100&isActive=true');
        if (res.ok) {
          const json = await res.json();
          setSkillLevels(json.data);
        }
      } catch {
        // ignore
      }
      // Filter option sources (BRD §31 — dept/role/location views).
      const pull = async (url: string, set: (v: { id: number; name: string }[]) => void) => {
        try {
          const res = await fetch(url);
          if (!res.ok) return;
          const json = await res.json();
          const rows = (Array.isArray(json) ? json : json.data ?? []).map((r: { id: number; name?: string; departmentName?: string; designationName?: string; locationName?: string }) => ({
            id: r.id,
            name: r.name ?? r.departmentName ?? r.designationName ?? r.locationName ?? `#${r.id}`,
          }));
          set(rows);
        } catch { /* ignore */ }
      };
      void pull('/api/masters/departments?limit=200', setDepartments);
      void pull('/api/masters/designations?limit=200', setDesignations);
      void pull('/api/masters/locations?limit=200', setLocations);
    };
    void loadLevels();
  }, []);

  useEffect(() => {
    let mounted = true;
    const load = async () => {
      setLoading(true);
      setError(null);
      try {
        const params = new URLSearchParams({ view });
        if (gapStatus) params.set('gapStatus', gapStatus);
        if (search) params.set('search', search);
        if (departmentId) params.set('departmentId', departmentId);
        if (designationId) params.set('designationId', designationId);
        if (locationId) params.set('locationId', locationId);
        if (myTeam) params.set('myTeam', '1');
        const res = await fetch(`/api/skill-matrix?${params}`);
        if (!res.ok) throw new Error('Failed to fetch');
        const json: MatrixResponse = await res.json();
        if (!mounted) return;
        setRecords(json.data);
        setKpis(json.kpis);
      } catch (err) {
        if (!mounted) return;
        setError(err instanceof Error ? err.message : 'Unknown error');
      } finally {
        if (!mounted) return;
        setLoading(false);
      }
    };
    void load();
    return () => { mounted = false; };
  }, [view, gapStatus, search, departmentId, designationId, locationId, myTeam]);

  const handleEdit = (row: MatrixRow) => {
    setEditingRow(row);
    setModalOpen(true);
  };

  const handleSubmit = async (values: Record<string, string | number | boolean>) => {
    if (!editingRow) return;
    const payload = {
      employeeId: editingRow.employeeId,
      competencyId: editingRow.competencyId,
      itemType: editingRow.itemType ?? 'COMPETENCY',
      currentLevelId: Number(values.currentLevelId),
      targetLevelId: values.targetLevelId ? Number(values.targetLevelId) : null,
    };

    const res = await fetch('/api/skill-matrix', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });

    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error ?? 'Save failed');
    }

    // optimistic reload
    const idx = records.findIndex(
      (r) =>
        r.employeeId === editingRow.employeeId &&
        r.competencyId === editingRow.competencyId &&
        (r.itemType ?? 'COMPETENCY') === (editingRow.itemType ?? 'COMPETENCY')
    );
    if (idx >= 0) {
      const current = skillLevels.find((l) => l.id === payload.currentLevelId);
      const target = skillLevels.find((l) => l.id === (payload.targetLevelId as number | null));
      const updated = [...records];
      updated[idx] = {
        ...updated[idx],
        currentLevelId: payload.currentLevelId,
        currentLevelNumber: current?.levelNumber ?? 0,
        currentLevelName: current?.name ?? '—',
        currentColor: current?.color ?? null,
        targetLevelId: (payload.targetLevelId as number | null) ?? null,
        targetLevelName: target?.name ?? null,
        gap: updated[idx].requiredLevelNumber - (current?.levelNumber ?? 0),
        gapStatus: (updated[idx].requiredLevelNumber - (current?.levelNumber ?? 0)) <= 0 ? 'met' : (updated[idx].requiredLevelNumber - (current?.levelNumber ?? 0)) === 1 ? 'open' : 'critical',
      };
      setRecords(updated);
    }
    setModalOpen(false);
  };

  const levelBadge = (name: string, color: string | null) => (
    <span
      className="rounded px-2 py-0.5 text-xs font-medium"
      style={{ backgroundColor: color ?? '#e5e7eb', color: '#111827' }}
    >
      {name}
    </span>
  );

  const gapBadge = (gap: number, status: 'met' | 'open' | 'critical') => {
    const color = status === 'met' ? '#22c55e' : status === 'open' ? '#eab308' : '#ef4444';
    return (
      <span
        className="rounded px-2 py-0.5 text-xs font-semibold text-white"
        style={{ backgroundColor: color }}
      >
        {gap > 0 ? `-${gap}` : gap}
      </span>
    );
  };

  const columns: Column<MatrixRow>[] = [
    { key: 'employeeCode', label: 'Employee Code' },
    { key: 'employeeName', label: 'Employee', sortable: true, className: 'font-medium' },
    { key: 'departmentName', label: 'Department' },
    { key: 'competencyName', label: 'Skill / Competency', sortable: true },
    { key: 'itemType', label: 'Type', render: (row) => <span className="capitalize">{(row.itemType ?? 'COMPETENCY').toLowerCase()}</span> },
    { key: 'category', label: 'Category' },
    { key: 'requiredLevelName', label: 'Required', render: (row) => levelBadge(row.requiredLevelName, row.requiredColor) },
    { key: 'currentLevelName', label: 'Current', render: (row) => levelBadge(row.currentLevelName, row.currentColor) },
    { key: 'targetLevelName', label: 'Target', render: (row) => (row.targetLevelName ? levelBadge(row.targetLevelName, null) : '—') },
    { key: 'gap', label: 'Gap', render: (row) => gapBadge(row.gap, row.gapStatus) },
    { key: 'gapStatus', label: 'Status', render: (row) => <span className="capitalize">{row.gapStatus}</span> },
  ];

  const fields: FieldDef[] = [
    {
      name: 'currentLevelId',
      label: 'Current Level',
      type: 'select',
      required: true,
      options: skillLevels.map((l) => ({ label: `${l.levelNumber} — ${l.name}`, value: l.id })),
    },
    {
      name: 'targetLevelId',
      label: 'Target Level',
      type: 'select',
      options: [{ label: '— None —', value: 0 }, ...skillLevels.map((l) => ({ label: `${l.levelNumber} — ${l.name}`, value: l.id }))],
    },
  ];

  const initialValues = editingRow
    ? {
        currentLevelId: editingRow.currentLevelId ?? skillLevels[0]?.id ?? 0,
        targetLevelId: editingRow.targetLevelId ?? 0,
      }
    : {};

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold" style={{ color: 'var(--foreground)' }}>Skill Matrix</h1>
        <div className="flex gap-2">
          <button
            onClick={() => exportCsv('skill-matrix.csv', records.map((r) => ({
              Code: r.employeeCode, Employee: r.employeeName, Department: r.departmentName, Role: r.designationName,
              Grade: r.gradeName, Type: r.itemType ?? 'COMPETENCY', Item: r.competencyName, Category: r.category,
              Required: r.requiredLevelName, Current: r.currentLevelName, Target: r.targetLevelName ?? '',
              Gap: r.gap, Status: r.gapStatus,
            })))}
            className="rounded-lg px-4 py-2 text-sm font-medium text-white" style={{ backgroundColor: 'var(--accent)' }}
          >
            Export CSV
          </button>
          <button
            onClick={() => exportXlsx('skill-matrix.xlsx', records.map((r) => ({
              Code: r.employeeCode, Employee: r.employeeName, Department: r.departmentName, Role: r.designationName,
              Grade: r.gradeName, Type: r.itemType ?? 'COMPETENCY', Item: r.competencyName, Category: r.category,
              Required: r.requiredLevelName, Current: r.currentLevelName, Target: r.targetLevelName ?? '',
              Gap: r.gap, Status: r.gapStatus,
            })), 'Skill Matrix')}
            className="rounded-lg px-4 py-2 text-sm font-medium" style={{ border: '1px solid var(--border)', color: 'var(--foreground)' }}
          >
            Export Excel
          </button>
          <button
            onClick={() => printTable('Skill Matrix', [
              { label: 'Code', value: (r: { employeeCode: string }) => r.employeeCode },
              { label: 'Employee', value: (r: { employeeName: string }) => r.employeeName },
              { label: 'Department', value: (r: { departmentName: string | null }) => r.departmentName },
              { label: 'Item', value: (r: { competencyName: string }) => r.competencyName },
              { label: 'Required', value: (r: { requiredLevelName: string | null }) => r.requiredLevelName },
              { label: 'Current', value: (r: { currentLevelName: string | null }) => r.currentLevelName },
              { label: 'Gap', value: (r: { gap: number }) => r.gap },
              { label: 'Status', value: (r: { gapStatus: string }) => r.gapStatus },
            ], records)}
            className="rounded-lg px-4 py-2 text-sm font-medium" style={{ border: '1px solid var(--border)', color: 'var(--foreground)' }}
            title="Print or save as PDF via the browser print dialog"
          >
            Print / PDF
          </button>
        </div>
      </div>

      <KPIGrid columns={4}>
        <KPICard label="Employees Assessed" value={kpis.employeesAssessed} tone="info" />
        <KPICard label="Skills Tracked" value={kpis.skillsTracked} tone="info" />
        <KPICard label="Open Gaps" value={kpis.openGaps} tone="warning" />
        <KPICard label="Critical Gaps" value={kpis.criticalGaps} tone="danger" />
      </KPIGrid>

      {error && (
        <div
          className="rounded-lg px-3 py-2 text-sm"
          style={{ backgroundColor: '#fef2f2', color: '#dc2626', border: '1px solid #fecaca' }}
        >
          {error}
        </div>
      )}

      <div className="flex flex-wrap items-center gap-3">
        <select
          value={view}
          onChange={(e) => setView(e.target.value)}
          className="rounded border bg-transparent px-3 py-2 text-sm"
        >
          {views.map((v) => <option key={v.value} value={v.value}>{v.label}</option>)}
        </select>
        <select
          value={gapStatus}
          onChange={(e) => setGapStatus(e.target.value)}
          className="rounded border bg-transparent px-3 py-2 text-sm"
        >
          {gapStatuses.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
        </select>
        <select value={departmentId} onChange={(e) => setDepartmentId(e.target.value)} className="rounded border bg-transparent px-3 py-2 text-sm">
          <option value="">All Departments</option>
          {departments.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
        </select>
        <select value={designationId} onChange={(e) => setDesignationId(e.target.value)} className="rounded border bg-transparent px-3 py-2 text-sm">
          <option value="">All Roles</option>
          {designations.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
        </select>
        <select value={locationId} onChange={(e) => setLocationId(e.target.value)} className="rounded border bg-transparent px-3 py-2 text-sm">
          <option value="">All Locations</option>
          {locations.map((l) => <option key={l.id} value={l.id}>{l.name}</option>)}
        </select>
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search employee or skill..."
          className="rounded border bg-transparent px-3 py-2 text-sm"
        />
        <label className="flex items-center gap-1.5 rounded border bg-transparent px-3 py-2 text-sm">
          <input type="checkbox" checked={myTeam} onChange={(e) => setMyTeam(e.target.checked)} />
          My Team
        </label>
      </div>

      <DataTable
        columns={columns}
        data={records}
        loading={loading}
        onEdit={handleEdit}
      />

      <FormModal
        title={editingRow ? `Update Level — ${editingRow.employeeName} · ${editingRow.competencyName}` : 'Update Level'}
        fields={fields}
        initialValues={initialValues}
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        onSubmit={handleSubmit}
        submitLabel="Save"
      />
    </div>
  );
}
