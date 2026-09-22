'use client';

import { useCallback, useEffect, useState } from 'react';
import { PageHeader } from '@/components/ui';
import { StatusBadge } from '@/components/ui';
import FnFOverview, { type FnFOverviewSettlement } from '@/components/fnf/FnFOverview';
import { ESS_VISIBLE_WITH_AMOUNTS, FNF_STATUS_TONE } from '@/lib/fnf/workflow';

/** Settlements the server returned without figures — see essVisibility(). */
type EssRow = FnFOverviewSettlement & { amountsWithheld?: boolean; holdReason?: string | null; rejectionReason?: string | null };

const titleCase = (v: string) => v.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());

export default function EssFnfPage() {
  const [rows, setRows] = useState<EssRow[]>([]);
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
          {s.amountsWithheld ? (
            // Payroll is revising the figures. Saying so beats either showing a
            // number that will change or pretending the settlement isn't there.
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <StatusBadge tone={FNF_STATUS_TONE[s.status] ?? 'neutral'} dot>{titleCase(s.status)}</StatusBadge>
                <span className="text-sm" style={{ color: 'var(--foreground-muted)' }}>
                  Last working day {String(s.lastWorkingDay).slice(0, 10)}
                </span>
              </div>
              <p className="text-sm" style={{ color: 'var(--foreground-muted)' }}>
                Your settlement is being revised by payroll, so the amounts are not shown yet.
                You will be notified once it is approved.
              </p>
              {(s.holdReason || s.rejectionReason) && (
                <p className="text-sm">
                  <span style={{ color: 'var(--foreground-muted)' }}>Reason: </span>
                  {s.holdReason ?? s.rejectionReason}
                </p>
              )}
            </div>
          ) : (
            <FnFOverview settlement={s} lines={s.lines ?? []} readOnly maskAccount />
          )}
          {s.id && ESS_VISIBLE_WITH_AMOUNTS.has(s.status) && (
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
