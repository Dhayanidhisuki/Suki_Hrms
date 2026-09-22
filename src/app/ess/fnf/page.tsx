'use client';

import { useCallback, useEffect, useState } from 'react';
import { PageHeader } from '@/components/ui';
import FnFOverview, { type FnFOverviewSettlement } from '@/components/fnf/FnFOverview';

export default function EssFnfPage() {
  const [rows, setRows] = useState<FnFOverviewSettlement[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/ess/fnf');
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        throw new Error(j.error ?? 'Could not load F&F');
      }
      const json = await res.json();
      setRows(json.data ?? []);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not load F&F');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  return (
    <div className="space-y-4">
      <PageHeader
        eyebrow="Self Service"
        title="Full & Final settlement"
        description="View your exit settlement. Payroll calculates the statement; you can download the PDF."
      />
      {error && <p className="text-sm" style={{ color: 'var(--danger)' }}>{error}</p>}
      {loading && <p className="text-sm">Loading…</p>}
      {!loading && rows.length === 0 && !error && (
        <p className="text-sm" style={{ color: 'var(--foreground-muted)' }}>No F&F settlement is on file for you.</p>
      )}
      {rows.map((s) => (
        <div key={s.id ?? s.employee.employeeCode} className="rounded-xl border p-4" style={{ borderColor: 'var(--border)', backgroundColor: 'var(--surface)' }}>
          <FnFOverview settlement={s} lines={s.lines ?? []} readOnly maskAccount />
          {s.id && ['calculated', 'submitted', 'approved', 'finance_verified', 'paid', 'completed'].includes(s.status) && (
            <a
              href={`/api/ess/fnf/pdf?id=${s.id}`}
              className="mt-3 inline-block text-sm font-medium hover:underline"
              style={{ color: 'var(--accent)' }}
            >
              Download statement
            </a>
          )}
        </div>
      ))}
    </div>
  );
}
