'use client';

import { useState, useEffect, useCallback } from 'react';

interface CanteenEntry {
  id: number;
  date: string;
  tokensUsed: number;
  ratePerToken: number;
  employeeContribution: number;
  mealDescription?: string;
}

function monthLabel(year: number, month: number) {
  return `${new Date(2000, month - 1, 1).toLocaleString('default', { month: 'long' })} ${year}`;
}

export default function CanteenPage() {
  const [records, setRecords] = useState<CanteenEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [month, setMonth] = useState(new Date().getMonth() + 1);
  const [year, setYear] = useState(new Date().getFullYear());

  const fetchRecords = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/workforce/my-canteen?month=${month}&year=${year}`);
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        throw new Error(j.error ?? 'Failed to load canteen records');
      }
      const json = await res.json();
      setRecords(json.data ?? []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load canteen records');
      setRecords([]);
    } finally {
      setLoading(false);
    }
  }, [month, year]);

  useEffect(() => {
    void fetchRecords();
  }, [fetchRecords]);

  const totalTokens = records.reduce((sum, r) => sum + r.tokensUsed, 0);
  const totalContribution = records.reduce((sum, r) => sum + r.employeeContribution, 0);

  return (
    <div className="space-y-6">
      <h1 className="text-xl font-semibold" style={{ color: 'var(--foreground)' }}>
        My Canteen Deductions
      </h1>

      {/* Month/Year Filter */}
      <div className="flex gap-3">
        <select
          value={month}
          onChange={(e) => setMonth(Number(e.target.value))}
          className="rounded-lg border px-3 py-2 text-sm"
          style={{ borderColor: 'var(--border)', backgroundColor: 'var(--surface)', color: 'var(--foreground)' }}
        >
          {Array.from({ length: 12 }, (_, i) => i + 1).map(m => (
            <option key={m} value={m}>
              {new Date(2000, m - 1, 1).toLocaleString('default', { month: 'long' })}
            </option>
          ))}
        </select>
        <select
          value={year}
          onChange={(e) => setYear(Number(e.target.value))}
          className="rounded-lg border px-3 py-2 text-sm"
          style={{ borderColor: 'var(--border)', backgroundColor: 'var(--surface)', color: 'var(--foreground)' }}
        >
          {Array.from({ length: 5 }, (_, i) => new Date().getFullYear() - 2 + i).map(y => (
            <option key={y} value={y}>{y}</option>
          ))}
        </select>
      </div>

      {error && (
        <div className="rounded-lg border border-red-300 bg-red-50 p-3 text-sm text-red-700">
          {error}
        </div>
      )}

      {loading ? (
        <div className="text-sm" style={{ color: 'var(--foreground-muted)' }}>
          Loading…
        </div>
      ) : records.length === 0 ? (
        <div className="rounded-lg border p-6 text-center text-sm" style={{ borderColor: 'var(--border)', color: 'var(--foreground-muted)' }}>
          No canteen records for {monthLabel(year, month)}.
        </div>
      ) : (
        <>
          {/* Summary Cards */}
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
            <div className="rounded-lg border p-4" style={{ borderColor: 'var(--border)' }}>
              <div className="text-xs uppercase" style={{ color: 'var(--foreground-muted)' }}>
                Total Meals
              </div>
              <div className="mt-1 text-lg font-semibold" style={{ color: 'var(--foreground)' }}>
                {totalTokens}
              </div>
            </div>
            <div className="rounded-lg border p-4" style={{ borderColor: 'var(--border)' }}>
              <div className="text-xs uppercase" style={{ color: 'var(--foreground-muted)' }}>
                Rate/Meal
              </div>
              <div className="mt-1 text-lg font-semibold" style={{ color: 'var(--foreground)' }}>
                ₹{records.length > 0 ? records[0].ratePerToken : 0}
              </div>
            </div>
            <div className="rounded-lg border p-4" style={{ borderColor: 'var(--border)' }}>
              <div className="text-xs uppercase" style={{ color: 'var(--foreground-muted)' }}>
                Total Deduction
              </div>
              <div className="mt-1 text-lg font-semibold" style={{ color: 'var(--primary)' }}>
                ₹{totalContribution.toLocaleString('en-IN')}
              </div>
            </div>
          </div>

          {/* Records Table */}
          <div className="rounded-lg border overflow-hidden" style={{ borderColor: 'var(--border)' }}>
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-left text-xs uppercase" style={{ borderColor: 'var(--border)', color: 'var(--foreground-muted)' }}>
                  <th className="px-4 py-2">Date</th>
                  <th className="px-4 py-2 text-center">Meals</th>
                  <th className="px-4 py-2 text-right">Rate</th>
                  <th className="px-4 py-2 text-right">Amount</th>
                </tr>
              </thead>
              <tbody>
                {records.map((row) => (
                  <tr key={row.id} className="border-b" style={{ borderColor: 'var(--border)' }}>
                    <td className="px-4 py-2">{new Date(row.date).toLocaleDateString('en-IN')}</td>
                    <td className="px-4 py-2 text-center font-medium">{row.tokensUsed}</td>
                    <td className="px-4 py-2 text-right">₹{row.ratePerToken}</td>
                    <td className="px-4 py-2 text-right font-medium">₹{row.employeeContribution.toLocaleString('en-IN')}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}
