'use client';

/**
 * Training Recommendations (BRD §32–33) — for every open competency/skill
 * gap, lists the active programs that address it (matched via
 * program.competencyId / program.skillId), ranked by gap size.
 */

import { useState, useEffect } from 'react';
import { DataTable, KPICard, KPIGrid } from '@/components/ui';
import type { Column } from '@/components/ui';
import { exportCsv } from '@/lib/exportCsv';
import { exportXlsx } from '@/lib/exportXlsx';
import { printTable } from '@/lib/printTable';

interface Rec {
  id: number;
  employeeId: number;
  employeeCode: string;
  employeeName: string;
  itemType: 'COMPETENCY' | 'SKILL' | 'CERT_EXPIRY' | 'RETRAINING' | 'MANDATORY';
  source?: 'GAP' | 'CERT_EXPIRY' | 'RETRAINING' | 'MANDATORY';
  itemId: number;
  itemName: string;
  requiredLevel: number;
  currentLevel: number;
  gap: number;
  programs: { id: number; name: string; method: string | null; duration: number | null; estimatedCost: number | null }[];
}

export default function RecommendationsPage() {
  const [rows, setRows] = useState<Rec[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [employeeId, setEmployeeId] = useState('');

  useEffect(() => {
    let mounted = true;
    const load = async () => {
      setLoading(true);
      try {
        const res = await fetch(`/api/training-recommendations${employeeId ? `?employeeId=${employeeId}` : ''}`);
        if (!res.ok) throw new Error('Failed to load');
        const json = await res.json();
        if (mounted) setRows((json.data as Omit<Rec, 'id'>[]).map((r, i) => ({ ...r, id: i + 1 })));
      } catch (err) {
        if (mounted) setError(err instanceof Error ? err.message : 'Failed');
      } finally {
        if (mounted) setLoading(false);
      }
    };
    void load();
    return () => { mounted = false; };
  }, [employeeId]);

  const columns: Column<Rec>[] = [
    { key: 'employeeCode', label: 'Code' },
    { key: 'employeeName', label: 'Employee', sortable: true },
    {
      key: 'itemType', label: 'Type', render: (r) => {
        const src = r.source ?? r.itemType;
        const tone: Record<string, { bg: string; fg: string }> = {
          GAP: { bg: '#ede9fe', fg: '#5b21b6' },
          SKILL: { bg: '#dbeafe', fg: '#1e40af' },
          COMPETENCY: { bg: '#ede9fe', fg: '#5b21b6' },
          CERT_EXPIRY: { bg: '#fef9c3', fg: '#854d0e' },
          RETRAINING: { bg: '#ffedd5', fg: '#9a3412' },
          MANDATORY: { bg: '#fee2e2', fg: '#991b1b' },
        };
        const t = tone[src] ?? tone.GAP;
        return <span className="rounded px-2 py-0.5 text-xs font-medium" style={{ backgroundColor: t.bg, color: t.fg }}>{src.replace(/_/g, ' ')}</span>;
      },
    },
    { key: 'itemName', label: 'Gap Item' },
    { key: 'gap', label: 'Gap', render: (r) => `${r.currentLevel} → ${r.requiredLevel} (−${r.gap})` },
    {
      key: 'programs', label: 'Recommended Programs',
      render: (r) => r.programs.length
        ? r.programs.map((p) => `${p.name}${p.method ? ` (${p.method})` : ''}`).join(', ')
        : <span className="text-xs" style={{ color: '#dc2626' }}>No matching program — create one</span>,
    },
  ];

  const unmatched = rows.filter((r) => r.programs.length === 0).length;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold" style={{ color: 'var(--foreground)' }}>Training Recommendations</h1>
        <div className="flex gap-2">
          <input value={employeeId} onChange={(e) => setEmployeeId(e.target.value)} placeholder="Employee ID" type="number" className="w-32 rounded border bg-transparent px-3 py-2 text-sm" style={{ borderColor: 'var(--border)' }} />
          <button
            onClick={() => exportCsv('training-recommendations.csv', rows.map((r) => ({ Code: r.employeeCode, Employee: r.employeeName, Type: r.itemType, Item: r.itemName, Current: r.currentLevel, Required: r.requiredLevel, Gap: r.gap, Programs: r.programs.map((p) => p.name).join('; ') })))}
            className="rounded-lg px-4 py-2 text-sm font-medium" style={{ border: '1px solid var(--border)', color: 'var(--foreground)' }}
          >
            Export CSV
          </button>
          <button
            onClick={() => exportXlsx('training-recommendations.xlsx', rows.map((r) => ({ Code: r.employeeCode, Employee: r.employeeName, Type: r.itemType, Item: r.itemName, Current: r.currentLevel, Required: r.requiredLevel, Gap: r.gap, Programs: r.programs.map((p) => p.name).join('; ') })), 'Recommendations')}
            className="rounded-lg px-4 py-2 text-sm font-medium" style={{ border: '1px solid var(--border)', color: 'var(--foreground)' }}
          >
            Export Excel
          </button>
          <button
            onClick={() => printTable('Training Recommendations', [
              { label: 'Code', value: (r: { employeeCode: string }) => r.employeeCode },
              { label: 'Employee', value: (r: { employeeName: string }) => r.employeeName },
              { label: 'Type', value: (r: { itemType: string }) => r.itemType },
              { label: 'Item', value: (r: { itemName: string }) => r.itemName },
              { label: 'Current', value: (r: { currentLevel: number }) => r.currentLevel },
              { label: 'Required', value: (r: { requiredLevel: number }) => r.requiredLevel },
              { label: 'Gap', value: (r: { gap: number }) => r.gap },
              { label: 'Programs', value: (r: { programs: { name: string }[] }) => r.programs.map((p) => p.name).join('; ') },
            ], rows)}
            className="rounded-lg px-4 py-2 text-sm font-medium" style={{ border: '1px solid var(--border)', color: 'var(--foreground)' }}
            title="Print or save as PDF via the browser print dialog"
          >
            Print / PDF
          </button>
        </div>
      </div>

      <KPIGrid columns={3}>
        <KPICard label="Open Gaps" value={rows.length} tone="warning" />
        <KPICard label="With Matching Program" value={rows.length - unmatched} tone="success" />
        <KPICard label="Needs a Program" value={unmatched} tone="danger" />
      </KPIGrid>

      {error && <div className="rounded-lg px-3 py-2 text-sm" style={{ backgroundColor: '#fef2f2', color: '#dc2626', border: '1px solid #fecaca' }}>{error}</div>}

      <DataTable columns={columns} data={rows} loading={loading} emptyMessage="No open gaps — everyone is at required level." />
    </div>
  );
}
