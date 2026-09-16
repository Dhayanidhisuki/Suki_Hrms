/**
 * HR/Manager Attendance Dashboard — team attendance overview with charts and trends
 */

'use client';

import { useState, useEffect } from 'react';

export default function AttendanceDashboardPage() {
  const [year, setYear] = useState(new Date().getFullYear());
  const [month, setMonth] = useState(new Date().getMonth() + 1);
  const [loading, setLoading] = useState(true);

  const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

  useEffect(() => {
    setLoading(false);
  }, [year, month]);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold" style={{ color: 'var(--foreground)' }}>Attendance Summary</h1>
          <p className="text-sm" style={{ color: 'var(--foreground-muted)' }}>
            Team attendance overview and trends
          </p>
        </div>
        <div className="flex items-center gap-3">
          <select
            value={month}
            onChange={(e) => setMonth(Number(e.target.value))}
            className="rounded-lg border px-3 py-2 text-sm"
            style={{ backgroundColor: 'var(--surface)', color: 'var(--foreground)', borderColor: 'var(--border)' }}
          >
            {monthNames.map((m, i) => (
              <option key={i} value={i + 1}>
                {m}
              </option>
            ))}
          </select>
          <input
            type="number"
            value={year}
            onChange={(e) => setYear(Number(e.target.value))}
            className="w-24 rounded-lg border px-3 py-2 text-sm"
            style={{ backgroundColor: 'var(--surface)', color: 'var(--foreground)', borderColor: 'var(--border)' }}
          />
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-5">
        <div className="rounded-lg border p-4" style={{ borderColor: 'var(--border)', backgroundColor: 'var(--surface)' }}>
          <div className="text-xs uppercase" style={{ color: 'var(--foreground-muted)' }}>Present</div>
          <div className="mt-2 text-2xl font-bold" style={{ color: '#3b82f6' }}>—</div>
        </div>
        <div className="rounded-lg border p-4" style={{ borderColor: 'var(--border)', backgroundColor: 'var(--surface)' }}>
          <div className="text-xs uppercase" style={{ color: 'var(--foreground-muted)' }}>Absent</div>
          <div className="mt-2 text-2xl font-bold" style={{ color: '#ef4444' }}>—</div>
        </div>
        <div className="rounded-lg border p-4" style={{ borderColor: 'var(--border)', backgroundColor: 'var(--surface)' }}>
          <div className="text-xs uppercase" style={{ color: 'var(--foreground-muted)' }}>Late</div>
          <div className="mt-2 text-2xl font-bold" style={{ color: '#f59e0b' }}>—</div>
        </div>
        <div className="rounded-lg border p-4" style={{ borderColor: 'var(--border)', backgroundColor: 'var(--surface)' }}>
          <div className="text-xs uppercase" style={{ color: 'var(--foreground-muted)' }}>Half Day</div>
          <div className="mt-2 text-2xl font-bold" style={{ color: '#8b5cf6' }}>—</div>
        </div>
        <div className="rounded-lg border p-4" style={{ borderColor: 'var(--border)', backgroundColor: 'var(--surface)' }}>
          <div className="text-xs uppercase" style={{ color: 'var(--foreground-muted)' }}>Working Days</div>
          <div className="mt-2 text-2xl font-bold">—</div>
        </div>
      </div>

      {/* Charts Placeholder */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <div className="rounded-lg border p-6" style={{ borderColor: 'var(--border)', backgroundColor: 'var(--surface)' }}>
          <h3 className="mb-4 text-lg font-semibold" style={{ color: 'var(--foreground)' }}>Daily Attendance Trend</h3>
          <div style={{ height: '300px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--foreground-muted)' }}>
            Chart will load here
          </div>
        </div>

        <div className="rounded-lg border p-6" style={{ borderColor: 'var(--border)', backgroundColor: 'var(--surface)' }}>
          <h3 className="mb-4 text-lg font-semibold" style={{ color: 'var(--foreground)' }}>Attendance Distribution</h3>
          <div style={{ height: '300px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--foreground-muted)' }}>
            Chart will load here
          </div>
        </div>
      </div>

      {/* Detailed Table */}
      <div className="rounded-lg border" style={{ borderColor: 'var(--border)', backgroundColor: 'var(--surface)' }}>
        <div className="border-b px-6 py-4" style={{ borderColor: 'var(--border)' }}>
          <h3 className="text-lg font-semibold" style={{ color: 'var(--foreground)' }}>Day-by-Day Breakdown</h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b text-left text-xs uppercase" style={{ borderColor: 'var(--border)', color: 'var(--foreground-muted)' }}>
                <th className="px-6 py-3">Date</th>
                <th className="px-6 py-3">Present</th>
                <th className="px-6 py-3">Absent</th>
                <th className="px-6 py-3">Late</th>
                <th className="px-6 py-3">Early Out</th>
                <th className="px-6 py-3">Half Day</th>
                <th className="px-6 py-3">Leave</th>
                <th className="px-6 py-3">Sch Days</th>
                <th className="px-6 py-3">Missing</th>
              </tr>
            </thead>
            <tbody>
              <tr style={{ borderColor: 'var(--border)' }} className="border-b">
                <td colSpan={9} className="px-6 py-4 text-center" style={{ color: 'var(--foreground-muted)' }}>
                  No data available for this period
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
