'use client';

/**
 * Audit Trail viewer (BRD §45) — read-only per-record history for all
 * Learning entities, backed by /api/platform/audit (platform.audit.view).
 */

import { useState } from 'react';
import { DataTable } from '@/components/ui';
import type { Column } from '@/components/ui';

interface AuditRow {
  id: number;
  entityType: string;
  entityId: number | null;
  entityRef: string | null;
  action: string;
  actorUserId: number | null;
  actorEmpId: number | null;
  actorSource: string;
  changedFields: string | null;
  remark: string | null;
  ipAddress: string | null;
  beforeJson: string | null;
  afterJson: string | null;
  createdAt: string;
}

const ENTITY_TYPES = [
  'TrainingProgram', 'TrainingPlan', 'TrainingPlanLine', 'MonthlyTrainingPlan', 'TrainingSchedule',
  'TrainingNeedRequest', 'TrainingNomination', 'TrainingAttendance', 'TrainingFeedback',
  'Assessment', 'AssessmentAttempt', 'QuestionBank', 'TrainingEffectiveness', 'TrainingCertificate',
  'TrainingBudget', 'TrainingCostItem', 'ExternalTraining', 'InductionAssignment', 'OjtAssignment',
  'TrainingChecklist', 'TrainingPolicy', 'TrainingDocument', 'IndividualDevelopmentPlan',
  'EmployeeCompetency', 'EmployeeSkillLevel', 'TrainingMentor', 'TrainingResource',
  'TrainingProvider', 'CertificationMaster',
];

const ACTION_TONE: Record<string, string> = {
  CREATE: '#059669', UPDATE: '#2563eb', DELETE: '#dc2626', SUBMIT: '#7c3aed',
  APPROVE: '#059669', REJECT: '#dc2626', RETURN: '#d97706', CANCEL: '#64748b',
  GRADE: '#0891b2', PROMOTE: '#059669', RESOLVE: '#059669', VIEW: '#64748b',
};

export default function AuditTrailPage() {
  const [rows, setRows] = useState<AuditRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [entityType, setEntityType] = useState('TrainingSchedule');
  const [entityId, setEntityId] = useState('');
  const [expanded, setExpanded] = useState<number | null>(null);

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({ entityType, limit: '100' });
      if (entityId) params.set('entityId', entityId);
      const res = await fetch(`/api/platform/audit?${params}`);
      if (!res.ok) throw new Error((await res.json()).error ?? 'Failed to fetch');
      const json = await res.json();
      setRows(json.data ?? []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load');
    } finally {
      setLoading(false);
    }
  };

  const columns: Column<AuditRow>[] = [
    { key: 'createdAt', label: 'When', render: (r) => new Date(r.createdAt).toLocaleString() },
    { key: 'entityId', label: 'Record', render: (r) => `#${r.entityId ?? '—'}${r.entityRef ? ` (${r.entityRef})` : ''}` },
    {
      key: 'action', label: 'Action', render: (r) => (
        <span className="rounded-full px-2 py-0.5 text-xs font-semibold text-white" style={{ backgroundColor: ACTION_TONE[r.action] ?? '#64748b' }}>
          {r.action}
        </span>
      ),
    },
    { key: 'actor', label: 'Actor', render: (r) => r.actorUserId ? `User #${r.actorUserId}` : r.actorSource },
    { key: 'changedFields', label: 'Changed Fields', render: (r) => r.changedFields ?? '—' },
    { key: 'remark', label: 'Remark', render: (r) => r.remark ?? '—' },
    {
      key: 'diff', label: 'Diff', render: (r) => (
        <button onClick={() => setExpanded(expanded === r.id ? null : r.id)} className="rounded px-2 py-0.5 text-xs text-white" style={{ backgroundColor: 'var(--accent)' }}>
          {expanded === r.id ? 'Hide' : 'View'}
        </button>
      ),
    },
  ];

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold" style={{ color: 'var(--foreground)' }}>Audit Trail</h1>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <select value={entityType} onChange={(e) => setEntityType(e.target.value)} className="rounded-lg border bg-transparent px-3 py-2 text-sm" style={{ borderColor: 'var(--border)', color: 'var(--foreground)' }}>
          {ENTITY_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
        </select>
        <input value={entityId} onChange={(e) => setEntityId(e.target.value)} placeholder="Record ID (optional)" type="number" className="w-44 rounded-lg border bg-transparent px-3 py-2 text-sm" style={{ borderColor: 'var(--border)', color: 'var(--foreground)' }} />
        <button onClick={() => void load()} className="rounded-lg px-4 py-2 text-sm font-medium text-white" style={{ backgroundColor: 'var(--accent)' }}>
          Search
        </button>
      </div>

      {error && <div className="rounded-lg px-3 py-2 text-sm" style={{ backgroundColor: '#fef2f2', color: '#dc2626', border: '1px solid #fecaca' }}>{error}</div>}

      <DataTable columns={columns} data={rows} loading={loading} emptyMessage="No audit entries — pick an entity and search." />

      {expanded !== null && (() => {
        const r = rows.find((x) => x.id === expanded);
        if (!r) return null;
        return (
          <div className="rounded-xl border p-4" style={{ borderColor: 'var(--border)' }}>
            <h2 className="mb-2 text-sm font-semibold" style={{ color: 'var(--foreground)' }}>Entry #{r.id} — before/after</h2>
            <DiffView row={r} />
          </div>
        );
      })()}
    </div>
  );
}

function DiffView({ row }: { row: AuditRow }) {
  let before: Record<string, unknown> = {};
  let after: Record<string, unknown> = {};
  try { before = row.beforeJson ? JSON.parse(row.beforeJson) : {}; } catch { /* ignore */ }
  try { after = row.afterJson ? JSON.parse(row.afterJson) : {}; } catch { /* ignore */ }
  const keys = [...new Set([...Object.keys(before), ...Object.keys(after)])].filter((k) => !['updatedAt'].includes(k));
  if (keys.length === 0) return <p className="text-xs" style={{ color: 'var(--foreground-muted)' }}>No field-level detail recorded.</p>;
  return (
    <table className="w-full text-left text-xs">
      <thead>
        <tr style={{ color: 'var(--foreground-muted)' }}>
          <th className="py-1 font-medium">Field</th>
          <th className="py-1 font-medium">Before</th>
          <th className="py-1 font-medium">After</th>
        </tr>
      </thead>
      <tbody>
        {keys.map((k) => {
          const b = before[k] == null ? '—' : typeof before[k] === 'object' ? JSON.stringify(before[k]) : String(before[k]);
          const a = after[k] == null ? '—' : typeof after[k] === 'object' ? JSON.stringify(after[k]) : String(after[k]);
          const changed = b !== a;
          return (
            <tr key={k} className="border-t" style={{ borderColor: 'var(--border)', color: changed ? 'var(--foreground)' : 'var(--foreground-muted)', fontWeight: changed ? 600 : 400 }}>
              <td className="py-1 pr-2">{k}</td>
              <td className="py-1 pr-2 max-w-64 truncate">{b}</td>
              <td className="py-1 max-w-64 truncate">{a}</td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}
