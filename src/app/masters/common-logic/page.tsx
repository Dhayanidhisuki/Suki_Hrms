/**
 * Masters > Common Logic — Gross % Split (KUN BRD review, 2026-09-10).
 *
 * One row per active `earning` component in this company's Salary
 * Components catalog, each with a fixed "% of Gross" and an Active toggle.
 * Edited inline and saved as one batch (PUT /api/masters/gross-split-rules)
 * rather than per-row modals — this is a small settings table, not a
 * repeatable master list.
 *
 * Read-only reference for now: nothing in payroll consumes these rules yet.
 * Wiring this into Salary Revision's component auto-fill is a later session.
 */

'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import Link from 'next/link';
import { useToast } from '@/components/ui';

interface Row {
  salaryComponentId: number;
  code: string;
  name: string;
  percentOfGross: string | null; // Decimal serializes as a string
  isActive: boolean;
  ruleId: number | null;
}

interface ApiResponse {
  data: Row[];
  totalPercent: number;
}

export default function CommonLogicPage() {
  const toast = useToast();
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // Local edit state — keyed by salaryComponentId so unsaved edits survive a
  // re-render without needing to touch `rows` until Save succeeds.
  const [percents, setPercents] = useState<Record<number, string>>({});
  const [actives, setActives] = useState<Record<number, boolean>>({});

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/masters/gross-split-rules');
      if (!res.ok) throw new Error('Failed to fetch');
      const json: ApiResponse = await res.json();
      setRows(json.data);
      setPercents(Object.fromEntries(json.data.map((r) => [r.salaryComponentId, r.percentOfGross ?? ''])));
      setActives(Object.fromEntries(json.data.map((r) => [r.salaryComponentId, r.isActive])));
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const totalPercent = useMemo(
    () =>
      Math.round(
        rows.reduce((sum, r) => sum + (actives[r.salaryComponentId] ? Number(percents[r.salaryComponentId] || 0) : 0), 0) * 100
      ) / 100,
    [rows, percents, actives]
  );

  const handleSave = async () => {
    setSaving(true);
    try {
      const res = await fetch('/api/masters/gross-split-rules', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          rules: rows.map((r) => ({
            salaryComponentId: r.salaryComponentId,
            percentOfGross: percents[r.salaryComponentId] === '' ? 0 : Number(percents[r.salaryComponentId]),
            isActive: actives[r.salaryComponentId] ?? true,
          })),
        }),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error ?? 'Save failed');
      }
      toast.success('Saved.');
      fetchData();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Save failed');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-semibold" style={{ color: 'var(--foreground)' }}>
          Common Logic
        </h1>
        <p className="text-sm" style={{ color: 'var(--foreground-muted)' }}>
          Gross % Split — the fixed percentage of Gross Salary each earning component is entitled to (e.g. Basic 40%, HRA 20%).
        </p>
      </div>

      {loading ? (
        <div className="card p-6 text-sm" style={{ color: 'var(--foreground-muted)' }}>
          Loading...
        </div>
      ) : rows.length === 0 ? (
        <div className="card p-6 text-sm" style={{ color: 'var(--foreground-muted)' }}>
          No active earning components found in{' '}
          <Link href="/masters/salary-components" className="hover:underline" style={{ color: 'var(--accent)' }}>
            Salary Components
          </Link>
          . Add earning components there first, then come back here to set their Gross % split.
        </div>
      ) : (
        <div className="card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead>
                <tr style={{ backgroundColor: 'var(--surface-hover)' }}>
                  {['Code', 'Component', '% of Gross', 'Active'].map((h) => (
                    <th key={h} className="px-4 py-3 text-left text-xs font-medium" style={{ color: 'var(--foreground-muted)' }}>
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.salaryComponentId} style={{ borderTop: '1px solid var(--border)' }}>
                    <td className="px-4 py-3 font-medium" style={{ color: 'var(--foreground)' }}>
                      {r.code}
                    </td>
                    <td className="px-4 py-3" style={{ color: 'var(--foreground)' }}>
                      {r.name}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1">
                        <input
                          type="number"
                          min={0}
                          max={100}
                          step="0.01"
                          value={percents[r.salaryComponentId] ?? ''}
                          onChange={(e) => setPercents((p) => ({ ...p, [r.salaryComponentId]: e.target.value }))}
                          disabled={actives[r.salaryComponentId] === false}
                          className="w-24 rounded-lg border px-2 py-1.5 text-sm disabled:opacity-50"
                          style={{ backgroundColor: 'var(--surface)', color: 'var(--foreground)', borderColor: 'var(--border)' }}
                        />
                        <span style={{ color: 'var(--foreground-muted)' }}>%</span>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <input
                        type="checkbox"
                        checked={actives[r.salaryComponentId] ?? true}
                        onChange={(e) => setActives((a) => ({ ...a, [r.salaryComponentId]: e.target.checked }))}
                        className="h-4 w-4 rounded"
                        style={{ accentColor: 'var(--accent)' }}
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr style={{ borderTop: '2px solid var(--border)', backgroundColor: 'var(--surface-hover)' }}>
                  <td className="px-4 py-3 font-semibold" colSpan={2} style={{ color: 'var(--foreground)' }}>
                    Total
                  </td>
                  <td className="px-4 py-3 font-semibold" colSpan={2}>
                    <span
                      className="rounded-full px-2.5 py-1 text-xs font-medium"
                      style={{
                        backgroundColor: totalPercent === 100 ? 'var(--success-soft)' : 'var(--warning-soft)',
                        color: totalPercent === 100 ? 'var(--success)' : 'var(--warning)',
                      }}
                    >
                      {totalPercent}% {totalPercent === 100 ? '' : '(active components should usually add up to 100%)'}
                    </span>
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>
          <div className="flex justify-end border-t p-4" style={{ borderColor: 'var(--border)' }}>
            <button
              onClick={handleSave}
              disabled={saving}
              className="rounded-lg px-4 py-2 text-sm font-medium text-white transition hover:opacity-90 disabled:opacity-50"
              style={{ backgroundColor: 'var(--accent)' }}
            >
              {saving ? 'Saving...' : 'Save'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
