/**
 * Employee Self Service — Holiday Calendar. Read-only, company-wide,
 * non-sensitive: any authenticated employee may view it.
 */

'use client';

import { useState, useEffect, useCallback } from 'react';
import { useToast } from '@/components/ui';

interface Holiday {
  id: number;
  date: string;
  name: string;
  holidayType: string;
  description: string | null;
}

interface YearlyLeaveEntry {
  id: number;
  date: string;
  name: string;
  description: string | null;
}

const TYPE_TONE: Record<string, { bg: string; fg: string }> = {
  COMPANY: { bg: '#dbeafe', fg: '#1e40af' },
  FESTIVAL: { bg: '#fef3c7', fg: '#92400e' },
  GOVERNMENT: { bg: '#dcfce7', fg: '#166534' },
  OTHER: { bg: '#f1f5f9', fg: '#475569' },
};

function weekday(iso: string) {
  return new Date(iso).toLocaleDateString('en-IN', { weekday: 'long', timeZone: 'UTC' });
}

function fullDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-IN', { day: '2-digit', month: 'long', year: 'numeric', timeZone: 'UTC' });
}

export default function EssHolidayCalendarPage() {
  const [year, setYear] = useState(new Date().getFullYear());
  const [holidays, setHolidays] = useState<Holiday[]>([]);
  const [yearlyLeave, setYearlyLeave] = useState<YearlyLeaveEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const toast = useToast();

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/workforce/my-holidays?year=${year}`);
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        throw new Error(j.error ?? 'Failed to load holidays');
      }
      const json = await res.json();
      setHolidays(json.holidays ?? []);
      setYearlyLeave(json.yearlyLeave ?? []);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to load holidays');
    } finally {
      setLoading(false);
    }
  }, [year, toast]);

  useEffect(() => {
    void fetchData();
  }, [fetchData]);

  const upcomingCount = holidays.filter((h) => new Date(h.date) >= new Date(new Date().toISOString().slice(0, 10))).length;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold" style={{ color: 'var(--foreground)' }}>Holiday Calendar</h1>
        <input
          type="number"
          value={year}
          onChange={(e) => setYear(Number(e.target.value))}
          className="w-24 rounded-lg border px-3 py-2 text-sm"
          style={{ backgroundColor: 'var(--surface)', color: 'var(--foreground)', borderColor: 'var(--border)' }}
        />
      </div>

      {loading ? (
        <div className="text-sm" style={{ color: 'var(--foreground-muted)' }}>Loading…</div>
      ) : (
        <>
          <div className="grid grid-cols-2 gap-4">
            <div className="rounded-lg border p-4" style={{ borderColor: 'var(--border)' }}>
              <div className="text-sm" style={{ color: 'var(--foreground-muted)' }}>Total Holidays ({year})</div>
              <div className="text-2xl font-bold" style={{ color: 'var(--foreground)' }}>{holidays.length}</div>
            </div>
            <div className="rounded-lg border p-4" style={{ borderColor: 'var(--border)' }}>
              <div className="text-sm" style={{ color: 'var(--foreground-muted)' }}>Upcoming</div>
              <div className="text-2xl font-bold" style={{ color: 'var(--foreground)' }}>{upcomingCount}</div>
            </div>
          </div>

          <div className="rounded-lg border" style={{ borderColor: 'var(--border)' }}>
            <div className="border-b px-4 py-2 text-sm font-semibold" style={{ borderColor: 'var(--border)', color: 'var(--foreground)' }}>Declared Holidays</div>
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-left text-xs uppercase" style={{ borderColor: 'var(--border)', color: 'var(--foreground-muted)' }}>
                  <th className="px-4 py-2">Date</th>
                  <th className="px-4 py-2">Day</th>
                  <th className="px-4 py-2">Occasion</th>
                  <th className="px-4 py-2">Type</th>
                </tr>
              </thead>
              <tbody>
                {holidays.length === 0 && (
                  <tr><td colSpan={4} className="px-4 py-6 text-center" style={{ color: 'var(--foreground-muted)' }}>No holidays declared for {year}.</td></tr>
                )}
                {holidays.map((h) => {
                  const tone = TYPE_TONE[h.holidayType] ?? TYPE_TONE.OTHER;
                  return (
                    <tr key={h.id} className="border-b" style={{ borderColor: 'var(--border)' }}>
                      <td className="px-4 py-2 font-medium">{fullDate(h.date)}</td>
                      <td className="px-4 py-2" style={{ color: 'var(--foreground-muted)' }}>{weekday(h.date)}</td>
                      <td className="px-4 py-2">{h.name}</td>
                      <td className="px-4 py-2">
                        <span className="rounded-full px-2 py-0.5 text-xs font-medium" style={{ backgroundColor: tone.bg, color: tone.fg }}>{h.holidayType}</span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {yearlyLeave.length > 0 && (
            <div className="rounded-lg border" style={{ borderColor: 'var(--border)' }}>
              <div className="border-b px-4 py-2 text-sm font-semibold" style={{ borderColor: 'var(--border)', color: 'var(--foreground)' }}>Yearly Leave Calendar</div>
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-left text-xs uppercase" style={{ borderColor: 'var(--border)', color: 'var(--foreground-muted)' }}>
                    <th className="px-4 py-2">Date</th>
                    <th className="px-4 py-2">Day</th>
                    <th className="px-4 py-2">Leave</th>
                  </tr>
                </thead>
                <tbody>
                  {yearlyLeave.map((y) => (
                    <tr key={y.id} className="border-b" style={{ borderColor: 'var(--border)' }}>
                      <td className="px-4 py-2 font-medium">{fullDate(y.date)}</td>
                      <td className="px-4 py-2" style={{ color: 'var(--foreground-muted)' }}>{weekday(y.date)}</td>
                      <td className="px-4 py-2">{y.name}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}
    </div>
  );
}
