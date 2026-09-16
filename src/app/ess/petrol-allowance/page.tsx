'use client';

import { useState, useEffect, useCallback } from 'react';

interface PetrolEntry {
  id: number;
  travelDate: string;
  km: number;
  ratePerKm: number;
  eligibleAmount: number;
  approvedAmount: number;
  status?: string;
  remarks?: string;
}

function monthLabel(year: number, month: number) {
  return `${new Date(2000, month - 1, 1).toLocaleString('default', { month: 'long' })} ${year}`;
}

export default function PetrolAllowancePage() {
  const [records, setRecords] = useState<PetrolEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [month, setMonth] = useState(new Date().getMonth() + 1);
  const [year, setYear] = useState(new Date().getFullYear());

  const fetchRecords = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/workforce/my-petrol?month=${month}&year=${year}`);
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        throw new Error(j.error ?? 'Failed to load petrol allowance records');
      }
      const json = await res.json();
      setRecords(json.data ?? []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load petrol allowance');
      setRecords([]);
    } finally {
      setLoading(false);
    }
  }, [month, year]);

  useEffect(() => {
    void fetchRecords();
  }, [fetchRecords]);

  const totalEligible = records.reduce((sum, r) => sum + r.eligibleAmount, 0);
  const totalApproved = records.reduce((sum, r) => sum + r.approvedAmount, 0);

  return (
    <div className="space-y-6">
      <h1 className="text-xl font-semibold" style={{ color: 'var(--foreground)' }}>
        My Petrol Allowance
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
          No petrol allowance records for {monthLabel(year, month)}.
        </div>
      ) : (
        <>
          {/* Summary Cards */}
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
            <div className="rounded-lg border p-4" style={{ borderColor: 'var(--border)' }}>
              <div className="text-xs uppercase" style={{ color: 'var(--foreground-muted)' }}>
                Total Distance (km)
              </div>
              <div className="mt-1 text-lg font-semibold" style={{ color: 'var(--foreground)' }}>
                {records.reduce((sum, r) => sum + r.km, 0)}
              </div>
            </div>
            <div className="rounded-lg border p-4" style={{ borderColor: 'var(--border)' }}>
              <div className="text-xs uppercase" style={{ color: 'var(--foreground-muted)' }}>
                Eligible Amount
              </div>
              <div className="mt-1 text-lg font-semibold" style={{ color: 'var(--foreground)' }}>
                ₹{totalEligible.toLocaleString('en-IN')}
              </div>
            </div>
            <div className="rounded-lg border p-4" style={{ borderColor: 'var(--border)' }}>
              <div className="text-xs uppercase" style={{ color: 'var(--foreground-muted)' }}>
                Approved Amount
              </div>
              <div className="mt-1 text-lg font-semibold" style={{ color: 'var(--primary)' }}>
                ₹{totalApproved.toLocaleString('en-IN')}
              </div>
            </div>
          </div>

          {/* Records Table */}
          <div className="rounded-lg border overflow-hidden" style={{ borderColor: 'var(--border)' }}>
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-left text-xs uppercase" style={{ borderColor: 'var(--border)', color: 'var(--foreground-muted)' }}>
                  <th className="px-4 py-2">Date</th>
                  <th className="px-4 py-2 text-right">KM</th>
                  <th className="px-4 py-2 text-right">Rate/km</th>
                  <th className="px-4 py-2 text-right">Amount</th>
                </tr>
              </thead>
              <tbody>
                {records.map((row) => (
                  <tr key={row.id} className="border-b" style={{ borderColor: 'var(--border)' }}>
                    <td className="px-4 py-2">{new Date(row.travelDate).toLocaleDateString('en-IN')}</td>
                    <td className="px-4 py-2 text-right font-medium">{row.km}</td>
                    <td className="px-4 py-2 text-right">₹{row.ratePerKm}</td>
                    <td className="px-4 py-2 text-right font-medium">₹{row.approvedAmount.toLocaleString('en-IN')}</td>
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
