/**
 * Employee Self Service — My Benefits. Self-service: always the logged-in
 * user's own benefit enrolments, resolved server-side. Read-only — HR owns
 * enrolment, and the company-wide view lives on /workforce/benefits.
 */

'use client';

import { useState, useEffect } from 'react';
import { useToast } from '@/components/ui';

interface MyBenefit {
  id: number;
  code: string;
  name: string;
  amount: number;
  employeeType: string | null;
  salaryComponent: string | null;
  enrolledOn: string;
}

const money = (v: number) =>
  v.toLocaleString('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 });

export default function EssBenefitsPage() {
  const [benefits, setBenefits] = useState<MyBenefit[]>([]);
  const [loading, setLoading] = useState(true);
  const toast = useToast();

  useEffect(() => {
    const fetchBenefits = async () => {
      setLoading(true);
      try {
        const res = await fetch('/api/workforce/my-benefits');
        if (!res.ok) {
          const data = await res.json().catch(() => ({}));
          throw new Error(data.error ?? 'Failed to load benefits');
        }
        const json: { data: MyBenefit[] } = await res.json();
        setBenefits(json.data ?? []);
      } catch (err) {
        toast.error(err instanceof Error ? err.message : 'Failed to load benefits');
      } finally {
        setLoading(false);
      }
    };
    fetchBenefits();
  }, [toast]);

  const total = benefits.reduce((sum, b) => sum + b.amount, 0);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold" style={{ color: 'var(--foreground)' }}>My Benefits</h1>
        <p className="text-sm" style={{ color: 'var(--foreground-muted)' }}>
          The benefit components you are currently enrolled in. Enrolment is managed by HR.
        </p>
      </div>

      {loading ? (
        <div className="text-sm" style={{ color: 'var(--foreground-muted)' }}>Loading benefits…</div>
      ) : benefits.length === 0 ? (
        <div
          className="rounded-lg border p-6 text-center text-sm"
          style={{ borderColor: 'var(--border)', color: 'var(--foreground-muted)' }}
        >
          You are not enrolled in any benefits yet. Contact HR if you think this is wrong.
        </div>
      ) : (
        <>
          <div className="grid grid-cols-2 gap-4">
            <div className="rounded-lg border p-4" style={{ borderColor: 'var(--border)' }}>
              <div className="text-xs uppercase" style={{ color: 'var(--foreground-muted)' }}>Enrolled Benefits</div>
              <div className="mt-1 text-2xl font-bold" style={{ color: 'var(--foreground)' }}>{benefits.length}</div>
            </div>
            <div className="rounded-lg border p-4" style={{ borderColor: 'var(--border)' }}>
              <div className="text-xs uppercase" style={{ color: 'var(--foreground-muted)' }}>Total Value</div>
              <div className="mt-1 text-2xl font-bold" style={{ color: 'var(--foreground)' }}>{money(total)}</div>
            </div>
          </div>

          <div className="grid gap-4">
            {benefits.map((b) => (
              <div key={b.id} className="rounded-lg border p-5" style={{ borderColor: 'var(--border)' }}>
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1">
                    <h3 className="font-semibold" style={{ color: 'var(--foreground)' }}>{b.name}</h3>
                    <p className="mt-1 text-sm" style={{ color: 'var(--foreground-muted)' }}>{b.code}</p>
                  </div>
                  <div className="text-right">
                    <div className="text-lg font-semibold" style={{ color: 'var(--primary)' }}>{money(b.amount)}</div>
                  </div>
                </div>

                <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3">
                  <div>
                    <div className="text-xs uppercase" style={{ color: 'var(--foreground-muted)' }}>Applies To</div>
                    <div className="mt-1 text-sm font-medium" style={{ color: 'var(--foreground)' }}>
                      {b.employeeType ?? 'All employees'}
                    </div>
                  </div>
                  <div>
                    <div className="text-xs uppercase" style={{ color: 'var(--foreground-muted)' }}>Paid Via</div>
                    <div className="mt-1 text-sm font-medium" style={{ color: 'var(--foreground)' }}>
                      {b.salaryComponent ?? '—'}
                    </div>
                  </div>
                  <div>
                    <div className="text-xs uppercase" style={{ color: 'var(--foreground-muted)' }}>Enrolled On</div>
                    <div className="mt-1 text-sm font-medium" style={{ color: 'var(--foreground)' }}>
                      {new Date(b.enrolledOn).toLocaleDateString('en-IN', { timeZone: 'UTC' })}
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
