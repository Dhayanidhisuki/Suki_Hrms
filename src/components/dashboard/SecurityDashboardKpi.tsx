'use client';

import { useEffect, useState } from 'react';
import Icon from '@/components/layout/NavIcons';

interface DashboardData {
  visitor: {
    expectedToday: number;
    inside: number;
    pendingApprovals: number;
    overdue: number;
    todaysCheckins: number;
    todaysCheckouts: number;
  };
  material: {
    todaysGnr: number;
  };
}

function MiniStat({ label, value, tone = 'default' }: { label: string; value: number; tone?: 'default' | 'warning' | 'danger' | 'success' }) {
  const toneClasses = {
    default: 'bg-[var(--surface)] text-[var(--foreground)] border-[var(--border)]',
    success: 'bg-[var(--success-soft)] text-[var(--success)] border-[var(--success)]',
    warning: 'bg-[var(--warning-soft)] text-[var(--warning)] border-[var(--warning)]',
    danger: 'bg-[var(--danger-soft)] text-[var(--danger)] border-[var(--danger)]',
  };

  return (
    <div className={`rounded-lg border p-3 ${toneClasses[tone]}`}>
      <div className="text-xs font-medium opacity-80 truncate">{label}</div>
      <div className="mt-1 text-2xl font-semibold">{value}</div>
    </div>
  );
}

export default function SecurityDashboardKpi() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch('/api/visitor/dashboard')
      .then((res) => (res.ok ? res.json() : null))
      .then((json) => {
        setData(json);
        setLoading(false);
      })
      .catch((err) => {
        setError(err instanceof Error ? err.message : 'Failed to load');
        setLoading(false);
      });
  }, []);

  if (loading) return (
    <div className="card p-5" style={{ backgroundColor: 'var(--surface)' }}>
      <div className="text-sm" style={{ color: 'var(--foreground-muted)' }}>Loading security dashboard...</div>
    </div>
  );

  if (error || !data) return (
    <a href="/dashboard/security" className="card block p-5 transition hover:opacity-80" style={{ backgroundColor: 'var(--surface)' }}>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="grid h-11 w-11 place-items-center rounded-full" style={{ backgroundColor: 'var(--accent-soft)', color: 'var(--accent)' }}>
            <Icon name="visitor" size={20} />
          </div>
          <div>
            <h3 className="font-semibold" style={{ color: 'var(--foreground)' }}>Security Dashboard</h3>
            <p className="text-xs" style={{ color: 'var(--foreground-muted)' }}>View visitor and material gate overview</p>
          </div>
        </div>
        <span className="text-sm font-medium" style={{ color: 'var(--accent)' }}>View Details →</span>
      </div>
    </a>
  );

  return (
    <a href="/dashboard/security" className="card block p-5 transition hover:opacity-80" style={{ backgroundColor: 'var(--surface)' }}>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="grid h-11 w-11 place-items-center rounded-full" style={{ backgroundColor: 'var(--accent-soft)', color: 'var(--accent)' }}>
            <Icon name="visitor" size={20} />
          </div>
          <div>
            <h3 className="font-semibold" style={{ color: 'var(--foreground)' }}>Security Dashboard</h3>
            <p className="text-xs" style={{ color: 'var(--foreground-muted)' }}>Live visitor and material gate overview</p>
          </div>
        </div>
        <span className="text-sm font-medium" style={{ color: 'var(--accent)' }}>View Details →</span>
      </div>

      <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        <MiniStat label="Expected" value={data.visitor.expectedToday} />
        <MiniStat label="Inside" value={data.visitor.inside} tone="success" />
        <MiniStat label="Pending" value={data.visitor.pendingApprovals} tone="warning" />
        <MiniStat label="Overdue" value={data.visitor.overdue} tone="danger" />
        <MiniStat label="Check-ins" value={data.visitor.todaysCheckins} tone="success" />
        <MiniStat label="Check-outs" value={data.visitor.todaysCheckouts} />
      </div>
    </a>
  );
}
