'use client';

import { useState, useEffect } from 'react';

interface Benefit {
  id: number;
  componentName: string;
  componentCode: string;
  description: string;
  frequency: string;
  amount: number | null;
  enrolledCount: number;
  totalEligible: number;
  enrollmentPercentage?: number;
  [key: string]: any;
}

export default function BenefitsPage() {
  const [benefits, setBenefits] = useState<Benefit[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchBenefits = async () => {
      try {
        setLoading(true);
        setError(null);
        const res = await fetch('/api/workforce/benefits/overview');
        if (!res.ok) {
          const data = await res.json().catch(() => ({}));
          throw new Error(data.error ?? 'Failed to load benefits');
        }
        const data = await res.json();
        setBenefits(data.benefits ?? []);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load benefits');
      } finally {
        setLoading(false);
      }
    };

    fetchBenefits();
  }, []);

  return (
    <div className="space-y-6">
      <h1 className="text-xl font-semibold" style={{ color: 'var(--foreground)' }}>
        My Benefits Overview
      </h1>

      {error && (
        <div className="rounded-lg border border-red-300 bg-red-50 p-3 text-sm text-red-700">
          {error}
        </div>
      )}

      {loading ? (
        <div className="text-sm" style={{ color: 'var(--foreground-muted)' }}>
          Loading benefits...
        </div>
      ) : benefits.length === 0 ? (
        <div
          className="rounded-lg border p-6 text-center text-sm"
          style={{ borderColor: 'var(--border)', color: 'var(--foreground-muted)' }}
        >
          No benefits enrolled.
        </div>
      ) : (
        <div className="grid gap-4">
          {benefits.map((benefit) => (
            <div key={benefit.id} className="rounded-lg border p-5" style={{ borderColor: 'var(--border)' }}>
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <h3 className="font-semibold" style={{ color: 'var(--foreground)' }}>
                    {benefit.componentName}
                  </h3>
                  <p className="mt-1 text-sm" style={{ color: 'var(--foreground-muted)' }}>
                    {benefit.description || benefit.componentCode}
                  </p>
                </div>
                {benefit.amount && (
                  <div className="text-right ml-4">
                    <div className="text-lg font-semibold" style={{ color: 'var(--primary)' }}>
                      ₹{benefit.amount.toLocaleString('en-IN')}
                    </div>
                    <div className="text-xs" style={{ color: 'var(--foreground-muted)' }}>
                      {benefit.frequency}
                    </div>
                  </div>
                )}
              </div>

              <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3">
                <div>
                  <div className="text-xs uppercase" style={{ color: 'var(--foreground-muted)' }}>
                    Enrolled
                  </div>
                  <div className="mt-1 text-sm font-semibold" style={{ color: 'var(--foreground)' }}>
                    {benefit.enrolledCount}
                  </div>
                </div>
                <div>
                  <div className="text-xs uppercase" style={{ color: 'var(--foreground-muted)' }}>
                    Eligible
                  </div>
                  <div className="mt-1 text-sm font-semibold" style={{ color: 'var(--foreground)' }}>
                    {benefit.totalEligible}
                  </div>
                </div>
                <div>
                  <div className="text-xs uppercase" style={{ color: 'var(--foreground-muted)' }}>
                    Enrollment %
                  </div>
                  <div className="mt-1 text-sm font-semibold" style={{ color: 'var(--primary)' }}>
                    {benefit.enrollmentPercentage !== undefined ? `${benefit.enrollmentPercentage.toFixed(1)}%` : 'N/A'}
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
