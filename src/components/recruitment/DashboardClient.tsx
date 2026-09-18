/**
 * Recruitment Dashboard — real data from /api/recruitment/dashboard-stats.
 * BRD §5.1, §10.5.
 */

'use client';

import { useEffect, useState } from 'react';
import { KPICard, KPIGrid } from '@/components/ui';

interface DashboardData {
  pipeline: {
    totalApplicants: number;
    newApplicants: number;
    callPending: number;
    interviewScheduled: number;
    evaluationPending: number;
    docVerification: number;
    selected: number;
    offerReleased: number;
    joined: number;
    rejected: number;
    openPostings: number;
  };
  byStatus: Array<{ statusCode: string; statusName: string; stageCategory: string; color: string | null; count: number }>;
  velocity: { timeToHireDays: number; offerAcceptanceRate: number; pipelineAging: number; slaBreachCount: number };
}

export default function DashboardClient() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch('/api/recruitment/dashboard-stats')
      .then((r) => r.json())
      .then((d) => setData(d))
      .catch(() => setError('Failed to load dashboard'))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <div className="p-4 text-sm" style={{ color: 'var(--foreground-muted)' }}>Loading dashboard...</div>;
  if (error) return <div className="p-4 text-sm text-red-600">{error}</div>;
  if (!data) return null;

  const p = data.pipeline;

  const PIPELINE_CARDS = [
    { label: 'Total Applicants', value: p.totalApplicants, tone: undefined },
    { label: 'New Applicants', value: p.newApplicants, tone: undefined },
    { label: 'Call Interview Pending', value: p.callPending, tone: 'warning' as const },
    { label: 'Interview Scheduled', value: p.interviewScheduled, tone: undefined },
    { label: 'Evaluation Pending', value: p.evaluationPending, tone: 'warning' as const },
    { label: 'Document Verification', value: p.docVerification, tone: 'warning' as const },
    { label: 'Selected', value: p.selected, tone: 'success' as const },
    { label: 'Offer Released', value: p.offerReleased, tone: undefined },
    { label: 'Joined', value: p.joined, tone: 'success' as const },
    { label: 'Rejected', value: p.rejected, tone: 'danger' as const },
  ];

  const METRIC_CARDS = [
    { label: 'Time-to-Hire (Avg)', value: `${data.velocity.timeToHireDays}d`, subtitle: 'Application → Joined' },
    { label: 'Offer Acceptance Rate', value: `${data.velocity.offerAcceptanceRate}%`, subtitle: 'Accepted / offers sent' },
    { label: 'Open Postings', value: p.openPostings, subtitle: 'Active job postings' },
    { label: 'SLA Breach Count', value: data.velocity.slaBreachCount, subtitle: 'Stages past deadline' },
  ];

  // Group by stage category
  const categories = ['Screening', 'Interview', 'Verification', 'Selection', 'Offer', 'Joining'];
  const byCategory = categories.map((cat) => ({
    category: cat,
    items: data.byStatus.filter((s) => s.stageCategory === cat && s.count > 0),
  }));

  return (
    <div className="space-y-6">
      <KPIGrid columns={4}>
        {PIPELINE_CARDS.map((c) => (
          <KPICard key={c.label} label={c.label} value={c.value} tone={c.tone} />
        ))}
      </KPIGrid>

      <div>
        <h2 className="text-sm font-semibold uppercase tracking-wider" style={{ color: 'var(--foreground-muted)' }}>
          Velocity metrics
        </h2>
        <div className="mt-2">
          <KPIGrid columns={4}>
            {METRIC_CARDS.map((c) => (
              <KPICard key={c.label} label={c.label} value={c.value} subtitle={c.subtitle} />
            ))}
          </KPIGrid>
        </div>
      </div>

      {byCategory.some((c) => c.items.length > 0) && (
        <div>
          <h2 className="text-sm font-semibold uppercase tracking-wider" style={{ color: 'var(--foreground-muted)' }}>
            Candidates by stage
          </h2>
          <div className="mt-2 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
            {byCategory.map((cat) => (
              <div key={cat.category} className="card p-3">
                <h3 className="text-xs font-semibold uppercase" style={{ color: 'var(--foreground-muted)' }}>{cat.category}</h3>
                <div className="mt-2 space-y-1">
                  {cat.items.length === 0 ? (
                    <span className="text-xs" style={{ color: 'var(--foreground-muted)' }}>—</span>
                  ) : (
                    cat.items.map((s) => (
                      <div key={s.statusCode} className="flex items-center justify-between text-xs">
                        <span style={{ color: 'var(--foreground)' }}>{s.statusName}</span>
                        <span className="font-semibold" style={{ color: s.color ?? 'var(--accent)' }}>{s.count}</span>
                      </div>
                    ))
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
