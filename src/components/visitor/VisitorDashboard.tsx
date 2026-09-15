'use client';

import { useEffect, useState } from 'react';

interface DashboardData {
  visitor: {
    expectedToday: number;
    inside: number;
    pendingApprovals: number;
    overdue: number;
    todaysCheckins: number;
    todaysCheckouts: number;
    statusBreakdown: Record<string, number>;
  };
  material: {
    todaysGnr: number;
    statusBreakdown: Record<string, number>;
  };
}

function Card({ title, value, href, tone = 'default' }: { title: string; value: number; href?: string; tone?: 'default' | 'success' | 'warning' | 'danger' }) {
  const toneStyles = {
    default: { bg: 'var(--surface)', border: 'var(--border)', text: 'var(--foreground)' },
    success: { bg: 'var(--success-soft)', border: 'var(--success)', text: 'var(--success)' },
    warning: { bg: 'var(--warning-soft)', border: 'var(--warning)', text: 'var(--warning)' },
    danger: { bg: 'var(--danger-soft)', border: 'var(--danger)', text: 'var(--danger)' },
  };
  const s = toneStyles[tone];
  const content = (
    <div className="rounded-xl p-4 border" style={{ backgroundColor: s.bg, borderColor: s.border, color: s.text }}>
      <div className="text-sm font-medium" style={{ color: 'var(--foreground-muted)' }}>{title}</div>
      <div className="mt-2 text-3xl font-semibold">{value}</div>
    </div>
  );
  if (href) {
    return <a href={href} className="block transition hover:opacity-80">{content}</a>;
  }
  return content;
}

function StatusList({ title, data }: { title: string; data: Record<string, number> }) {
  return (
    <div className="rounded-xl border p-4" style={{ borderColor: 'var(--border)', backgroundColor: 'var(--surface)' }}>
      <h3 className="text-sm font-semibold mb-3" style={{ color: 'var(--foreground)' }}>{title}</h3>
      <div className="space-y-2">
        {Object.entries(data).length === 0 && <div className="text-sm" style={{ color: 'var(--foreground-muted)' }}>No records</div>}
        {Object.entries(data).map(([status, count]) => (
          <div key={status} className="flex justify-between text-sm">
            <span style={{ color: 'var(--foreground-muted)' }}>{status.replace(/_/g, ' ')}</span>
            <span className="font-medium" style={{ color: 'var(--foreground)' }}>{count}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

export default function VisitorDashboard() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch('/api/visitor/dashboard')
      .then((res) => res.json())
      .then((json) => {
        setData(json);
        setLoading(false);
      })
      .catch((err) => {
        setError(err instanceof Error ? err.message : 'Failed to load dashboard');
        setLoading(false);
      });
  }, []);

  if (loading) return <div className="text-sm" style={{ color: 'var(--foreground-muted)' }}>Loading dashboard...</div>;
  if (error) return <div className="rounded-lg px-3 py-2 text-sm" style={{ backgroundColor: 'var(--danger-soft)', color: 'var(--danger)' }}>{error}</div>;
  if (!data) return null;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold" style={{ color: 'var(--foreground)' }}>Security Dashboard</h1>
        <p className="text-sm" style={{ color: 'var(--foreground-muted)' }}>Visitor and material gate overview</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        <Card title="Expected Visitors Today" value={data.visitor.expectedToday} href="/reports/visitor/visitor-register" tone="default" />
        <Card title="Visitors Inside" value={data.visitor.inside} href="/reports/visitor/current-inside" tone="success" />
        <Card title="Pending Approvals" value={data.visitor.pendingApprovals} href="/approvals/visitor/pass" tone="warning" />
        <Card title="Overdue Visitors" value={data.visitor.overdue} href="/visitor/pass" tone="danger" />
        <Card title="Today's Check-Ins" value={data.visitor.todaysCheckins} tone="success" />
        <Card title="Today's Check-Outs" value={data.visitor.todaysCheckouts} tone="default" />
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card title="Today's GNR" value={data.material.todaysGnr} href="/visitor/gnr" tone="default" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <StatusList title="Visitor Status Breakdown" data={data.visitor.statusBreakdown} />
        <StatusList title="GNR Status Breakdown" data={data.material.statusBreakdown} />
      </div>
    </div>
  );
}
