'use client';

import { useState, useEffect, useCallback } from 'react';

interface OTRecord {
  id: number;
  date: string;
  hoursWorked: number;
  otHours: number;
  otType: string; // REGULAR, HOLIDAY, WEEKEND
  status: string; // APPROVED, PENDING, REJECTED
  rate: number;
  amount: string;
  remarks: string | null;
}

function monthLabel(year: number, month: number) {
  return `${new Date(2000, month - 1, 1).toLocaleString('default', { month: 'long' })} ${year}`;
}

export default function OTSlipPage() {
  const [records, setRecords] = useState<OTRecord[]>([]);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [selectedRecord, setSelectedRecord] = useState<OTRecord | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [month, setMonth] = useState(new Date().getMonth() + 1);
  const [year, setYear] = useState(new Date().getFullYear());

  const fetchOTRecords = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/workforce/my-ot-slips?month=${month}&year=${year}`);
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        throw new Error(j.error ?? 'Failed to load OT slips');
      }
      const json = await res.json();
      setRecords(json.data ?? []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load OT slips');
      setRecords([]);
    } finally {
      setLoading(false);
    }
  }, [month, year]);

  useEffect(() => {
    void fetchOTRecords();
  }, [fetchOTRecords]);

  useEffect(() => {
    if (selectedId && records.length > 0) {
      const record = records.find(r => r.id === selectedId);
      setSelectedRecord(record ?? null);
    }
  }, [selectedId, records]);

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'APPROVED':
        return '#10b981'; // green
      case 'PENDING':
        return '#f59e0b'; // amber
      case 'REJECTED':
        return '#ef4444'; // red
      default:
        return '#6b7280'; // gray
    }
  };

  const getOTTypeLabel = (type: string) => {
    switch (type) {
      case 'REGULAR':
        return '📅 Regular OT';
      case 'HOLIDAY':
        return '🎉 Holiday OT';
      case 'WEEKEND':
        return '🏖️ Weekend OT';
      default:
        return type;
    }
  };

  if (selectedId && selectedRecord) {
    return (
      <div className="space-y-4">
        <button
          onClick={() => setSelectedId(null)}
          className="text-sm font-medium"
          style={{ color: 'var(--primary)' }}
        >
          ← Back to OT Slips
        </button>

        <div className="rounded-lg border p-6" style={{ borderColor: 'var(--border)' }}>
          <h2 className="text-xl font-semibold mb-4" style={{ color: 'var(--foreground)' }}>
            OT Slip Details
          </h2>

          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
            <div>
              <div className="text-xs uppercase" style={{ color: 'var(--foreground-muted)' }}>
                Date
              </div>
              <div className="mt-1 font-semibold" style={{ color: 'var(--foreground)' }}>
                {new Date(selectedRecord.date).toLocaleDateString('en-IN')}
              </div>
            </div>
            <div>
              <div className="text-xs uppercase" style={{ color: 'var(--foreground-muted)' }}>
                OT Type
              </div>
              <div className="mt-1 font-semibold" style={{ color: 'var(--foreground)' }}>
                {getOTTypeLabel(selectedRecord.otType)}
              </div>
            </div>
            <div>
              <div className="text-xs uppercase" style={{ color: 'var(--foreground-muted)' }}>
                Status
              </div>
              <div className="mt-1 font-semibold" style={{ color: getStatusColor(selectedRecord.status) }}>
                {selectedRecord.status}
              </div>
            </div>
            <div>
              <div className="text-xs uppercase" style={{ color: 'var(--foreground-muted)' }}>
                Hours Worked
              </div>
              <div className="mt-1 font-semibold" style={{ color: 'var(--foreground)' }}>
                {selectedRecord.hoursWorked}h
              </div>
            </div>
            <div>
              <div className="text-xs uppercase" style={{ color: 'var(--foreground-muted)' }}>
                OT Hours
              </div>
              <div className="mt-1 font-semibold" style={{ color: 'var(--primary)' }}>
                {selectedRecord.otHours}h
              </div>
            </div>
            <div>
              <div className="text-xs uppercase" style={{ color: 'var(--foreground-muted)' }}>
                Amount
              </div>
              <div className="mt-1 font-semibold" style={{ color: 'var(--foreground)' }}>
                ₹{selectedRecord.amount}
              </div>
            </div>
          </div>

          {selectedRecord.remarks && (
            <div className="mt-4 p-3 rounded-lg" style={{ backgroundColor: 'var(--surface)' }}>
              <div className="text-xs uppercase" style={{ color: 'var(--foreground-muted)' }}>
                Remarks
              </div>
              <div className="mt-1" style={{ color: 'var(--foreground)' }}>
                {selectedRecord.remarks}
              </div>
            </div>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <h1 className="text-xl font-semibold" style={{ color: 'var(--foreground)' }}>My OT Slips</h1>

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

      {error && <div className="rounded-lg border border-red-300 bg-red-50 p-3 text-sm text-red-700">{error}</div>}

      {loading ? (
        <div className="text-sm" style={{ color: 'var(--foreground-muted)' }}>Loading…</div>
      ) : records.length === 0 ? (
        <div className="rounded-lg border p-6 text-center text-sm" style={{ borderColor: 'var(--border)', color: 'var(--foreground-muted)' }}>
          No OT records for {monthLabel(year, month)}.
        </div>
      ) : (
        <div className="rounded-lg border overflow-hidden" style={{ borderColor: 'var(--border)' }}>
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b text-left text-xs uppercase" style={{ borderColor: 'var(--border)', color: 'var(--foreground-muted)' }}>
                <th className="px-4 py-2">Date</th>
                <th className="px-4 py-2">Type</th>
                <th className="px-4 py-2 text-right">Hours</th>
                <th className="px-4 py-2 text-right">Amount</th>
                <th className="px-4 py-2">Status</th>
                <th className="px-4 py-2" />
              </tr>
            </thead>
            <tbody>
              {records.map((row) => (
                <tr key={row.id} className="border-b" style={{ borderColor: 'var(--border)' }}>
                  <td className="px-4 py-2">{new Date(row.date).toLocaleDateString('en-IN')}</td>
                  <td className="px-4 py-2">{getOTTypeLabel(row.otType)}</td>
                  <td className="px-4 py-2 text-right font-medium">{row.otHours}h</td>
                  <td className="px-4 py-2 text-right font-medium">₹{row.amount}</td>
                  <td className="px-4 py-2">
                    <span
                      className="inline-block px-2 py-1 rounded text-xs font-medium text-white"
                      style={{ backgroundColor: getStatusColor(row.status) }}
                    >
                      {row.status}
                    </span>
                  </td>
                  <td className="px-4 py-2 text-right">
                    <button
                      onClick={() => setSelectedId(row.id)}
                      className="rounded-lg border px-3 py-1 text-xs font-medium"
                      style={{ borderColor: 'var(--border)', color: 'var(--foreground)' }}
                    >
                      View
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
