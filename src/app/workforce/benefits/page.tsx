'use client';

import { useState, useEffect, useCallback } from 'react';
import { KPICard, KPIGrid } from '@/components/ui';

interface BenefitEmployee {
  id: number;
  employeeCode: string;
  oldEmployeeCode: string | null;
  name: string;
}

interface BenefitSummary {
  id: number;
  code: string;
  name: string;
  employeeType: string;
  amount: number;
  employeeCount: number;
  employees: BenefitEmployee[];
}

interface OverviewResponse {
  totalEmployees: number;
  totalBenefits: number;
  totalAssignments: number;
  benefits: BenefitSummary[];
}

export default function BenefitsOverviewPage() {
  const [data, setData] = useState<OverviewResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [selectedBenefit, setSelectedBenefit] = useState<BenefitSummary | null>(null);

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/workforce/benefits/overview');
      if (!res.ok) throw new Error('Failed to fetch');
      const json: OverviewResponse = await res.json();
      setData(json);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const filteredBenefits = (data?.benefits ?? []).filter((b) => {
    if (!search) return true;
    const term = search.toLowerCase();
    return b.name.toLowerCase().includes(term) || b.code.toLowerCase().includes(term) || b.employeeType.toLowerCase().includes(term);
  });

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold" style={{ color: 'var(--foreground)' }}>Benefits Overview</h1>
          <p className="text-sm" style={{ color: 'var(--foreground-muted)' }}>
            Counts of employees enrolled per benefit component. Click a benefit card to view enrolled employees.
          </p>
        </div>
      </div>

      {data && (
        <KPIGrid columns={3}>
          <KPICard label="Total Employees" value={data.totalEmployees} tone="info" />
          <KPICard label="Benefit Components" value={data.totalBenefits} tone="success" />
          <KPICard label="Total Assignments" value={data.totalAssignments} tone="warning" />
        </KPIGrid>
      )}

      {error && (
        <div className="rounded-lg px-3 py-2 text-sm" style={{ backgroundColor: '#fef2f2', color: '#dc2626', border: '1px solid #fecaca' }}>
          {error}
        </div>
      )}

      <div className="flex items-center gap-2">
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search benefit name, code, or employee type…"
          className="w-full max-w-md rounded-lg border px-3 py-2 text-sm"
          style={{ backgroundColor: 'var(--surface)', color: 'var(--foreground)', borderColor: 'var(--border)' }}
        />
      </div>

      {loading ? (
        <div className="py-8 text-center" style={{ color: 'var(--foreground-muted)' }}>Loading…</div>
      ) : filteredBenefits.length === 0 ? (
        <div className="py-8 text-center" style={{ color: 'var(--foreground-muted)' }}>No benefit components found.</div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
          {filteredBenefits.map((b) => (
            <button
              key={b.id}
              onClick={() => setSelectedBenefit(b)}
              className="text-left rounded-lg border p-4 transition hover:opacity-80"
              style={{ backgroundColor: 'var(--surface)', borderColor: selectedBenefit?.id === b.id ? 'var(--accent)' : 'var(--border)' }}
            >
              <div className="flex items-start justify-between">
                <div>
                  <div className="text-sm font-semibold" style={{ color: 'var(--foreground)' }}>{b.name}</div>
                  <div className="text-xs" style={{ color: 'var(--foreground-muted)' }}>{b.code} · {b.employeeType}</div>
                </div>
                <span
                  className="rounded-full px-2 py-0.5 text-xs font-medium"
                  style={{ backgroundColor: 'var(--accent-soft)', color: 'var(--accent)' }}
                >
                  {b.employeeCount} {b.employeeCount === 1 ? 'employee' : 'employees'}
                </span>
              </div>
              <div className="mt-2 text-xs" style={{ color: 'var(--foreground-muted)' }}>
                ₹{b.amount.toFixed(2)}/mo per eligible employee
              </div>
            </button>
          ))}
        </div>
      )}

      {/* Employee detail dialog */}
      {selectedBenefit && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={() => setSelectedBenefit(null)}>
          <div className="w-full max-w-2xl max-h-[80vh] overflow-y-auto rounded-lg border p-4 shadow-lg" style={{ backgroundColor: 'var(--surface)', borderColor: 'var(--border)' }} onClick={(e) => e.stopPropagation()}>
            <div className="mb-3 flex items-center justify-between">
              <div>
                <h3 className="text-sm font-semibold" style={{ color: 'var(--foreground)' }}>
                  {selectedBenefit.name} — Enrolled Employees
                </h3>
                <p className="text-xs" style={{ color: 'var(--foreground-muted)' }}>
                  {selectedBenefit.code} · {selectedBenefit.employeeType} · ₹{selectedBenefit.amount.toFixed(2)}/mo
                </p>
              </div>
              <button onClick={() => setSelectedBenefit(null)} className="text-lg leading-none hover:opacity-70" style={{ color: 'var(--foreground-muted)' }}>×</button>
            </div>

            {selectedBenefit.employees.length === 0 ? (
              <p className="py-6 text-center text-sm" style={{ color: 'var(--foreground-muted)' }}>No employees enrolled in this benefit.</p>
            ) : (
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b" style={{ borderColor: 'var(--border)' }}>
                    <th className="px-2 py-2 text-left font-medium" style={{ color: 'var(--foreground-muted)' }}>Employee Code</th>
                    <th className="px-2 py-2 text-left font-medium" style={{ color: 'var(--foreground-muted)' }}>Ref Code</th>
                    <th className="px-2 py-2 text-left font-medium" style={{ color: 'var(--foreground-muted)' }}>Name</th>
                  </tr>
                </thead>
                <tbody>
                  {selectedBenefit.employees.map((e) => (
                    <tr key={e.id} className="border-b" style={{ borderColor: 'var(--border)' }}>
                      <td className="px-2 py-1.5" style={{ color: 'var(--foreground)' }}>{e.oldEmployeeCode ?? e.employeeCode}</td>
                      <td className="px-2 py-1.5" style={{ color: 'var(--foreground-muted)' }}>{e.employeeCode}</td>
                      <td className="px-2 py-1.5" style={{ color: 'var(--foreground)' }}>{e.name}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
