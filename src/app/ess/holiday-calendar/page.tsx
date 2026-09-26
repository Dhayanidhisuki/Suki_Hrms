/**
 * Employee Self Service — Holiday Calendar. Read-only, company-wide,
 * non-sensitive: any authenticated employee may view it. The Yearly Leave
 * Calendar section mirrors the admin Holiday Master's calendar-grid design
 * (Masters > Holidays > Yearly Leave Calendar) but with no add/edit/delete —
 * viewing only what HR has declared.
 */

'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { SectionCard, StatusBadge, EmptyState, useToast } from '@/components/ui';

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
  leaveTypeMaster: { id: number; code: string; name: string; color: string };
}

const TYPE_TONE: Record<string, { bg: string; fg: string }> = {
  COMPANY: { bg: '#dbeafe', fg: '#1e40af' },
  FESTIVAL: { bg: '#fef3c7', fg: '#92400e' },
  GOVERNMENT: { bg: '#dcfce7', fg: '#166534' },
  OTHER: { bg: '#f1f5f9', fg: '#475569' },
};

const DAYS_OF_WEEK = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const MONTH_NAMES = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

function weekday(iso: string) {
  return new Date(iso).toLocaleDateString('en-IN', { weekday: 'long', timeZone: 'UTC' });
}

function fullDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-IN', { day: '2-digit', month: 'long', year: 'numeric', timeZone: 'UTC' });
}

export default function EssHolidayCalendarPage() {
  const [year, setYear] = useState(new Date().getFullYear());
  const [month, setMonth] = useState(new Date().getMonth());
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

  // Declared Holidays merges HolidayMaster with Yearly Leave Calendar entries
  // — same as the admin Masters > Holidays > Declared Holidays tab — since a
  // company may declare its holidays entirely through the yearly calendar
  // and never touch HolidayMaster directly.
  interface DeclaredRow {
    key: string;
    date: string;
    name: string;
    typeLabel: string;
    tone: { bg: string; fg: string };
  }
  const declaredRows: DeclaredRow[] = useMemo(() => {
    const fromHolidays: DeclaredRow[] = holidays.map((h) => ({
      key: `h-${h.id}`,
      date: h.date,
      name: h.name,
      typeLabel: h.holidayType,
      tone: TYPE_TONE[h.holidayType] ?? TYPE_TONE.OTHER,
    }));
    const fromYearly: DeclaredRow[] = yearlyLeave.map((e) => ({
      key: `y-${e.id}`,
      date: e.date,
      name: e.name,
      typeLabel: e.leaveTypeMaster.name,
      tone: { bg: `${e.leaveTypeMaster.color}22`, fg: e.leaveTypeMaster.color },
    }));
    return [...fromHolidays, ...fromYearly].sort((a, b) => a.date.localeCompare(b.date));
  }, [holidays, yearlyLeave]);

  const today = new Date().toISOString().slice(0, 10);
  const upcomingCount = declaredRows.filter((r) => r.date.slice(0, 10) >= today).length;

  // ── Calendar grid (mirrors the admin Yearly Leave Calendar tab) ──────────
  const entryMap = useMemo(() => {
    const m = new Map<string, YearlyLeaveEntry>();
    yearlyLeave.forEach((e) => m.set(e.date.slice(0, 10), e));
    return m;
  }, [yearlyLeave]);

  const leaveTypes = useMemo(() => {
    const m = new Map<number, { id: number; code: string; name: string; color: string }>();
    yearlyLeave.forEach((e) => m.set(e.leaveTypeMaster.id, e.leaveTypeMaster));
    return [...m.values()];
  }, [yearlyLeave]);

  const countByType = useMemo(() => {
    const m = new Map<number, number>();
    yearlyLeave.forEach((e) => m.set(e.leaveTypeMaster.id, (m.get(e.leaveTypeMaster.id) ?? 0) + 1));
    return m;
  }, [yearlyLeave]);

  const daysInMonth = new Date(Date.UTC(year, month + 1, 0)).getUTCDate();
  const firstDayOfMonth = new Date(Date.UTC(year, month, 1)).getUTCDay();
  const calendarDays: (number | null)[] = [
    ...Array(firstDayOfMonth).fill(null),
    ...Array.from({ length: daysInMonth }, (_, i) => i + 1),
  ];
  while (calendarDays.length % 7 !== 0) calendarDays.push(null);
  const todayStr = new Date().toISOString().slice(0, 10);

  const monthEntries = useMemo(
    () => yearlyLeave.filter((e) => { const d = new Date(e.date); return d.getUTCFullYear() === year && d.getUTCMonth() === month; }),
    [yearlyLeave, year, month],
  );

  const goPrevMonth = () => { if (month === 0) { setMonth(11); setYear(year - 1); } else setMonth(month - 1); };
  const goNextMonth = () => { if (month === 11) { setMonth(0); setYear(year + 1); } else setMonth(month + 1); };
  const navBtn = 'inline-flex h-8 w-8 items-center justify-center rounded-md border text-sm transition hover:brightness-95';

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold" style={{ color: 'var(--foreground)' }}>Holiday Calendar</h1>
        <input
          type="number"
          value={year}
          onChange={(e) => { setYear(Number(e.target.value)); setMonth(0); }}
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
              <div className="text-2xl font-bold" style={{ color: 'var(--foreground)' }}>{declaredRows.length}</div>
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
                {declaredRows.length === 0 && (
                  <tr><td colSpan={4} className="px-4 py-6 text-center" style={{ color: 'var(--foreground-muted)' }}>No holidays declared for {year}.</td></tr>
                )}
                {declaredRows.map((r) => (
                  <tr key={r.key} className="border-b" style={{ borderColor: 'var(--border)' }}>
                    <td className="px-4 py-2 font-medium">{fullDate(r.date)}</td>
                    <td className="px-4 py-2" style={{ color: 'var(--foreground-muted)' }}>{weekday(r.date)}</td>
                    <td className="px-4 py-2">{r.name}</td>
                    <td className="px-4 py-2">
                      <span className="rounded-full px-2 py-0.5 text-xs font-medium" style={{ backgroundColor: r.tone.bg, color: r.tone.fg }}>{r.typeLabel}</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Yearly Leave Calendar — read-only calendar grid + legend, mirroring Masters > Holidays */}
          <div>
            <h2 className="mb-3 text-sm font-semibold" style={{ color: 'var(--foreground)' }}>Yearly Leave Calendar</h2>
            <div className="grid grid-cols-1 gap-4 xl:grid-cols-[1fr_320px]">
              <SectionCard flush>
                <div className="flex flex-wrap items-center justify-between gap-3 border-b px-4 py-3" style={{ borderColor: 'var(--border)' }}>
                  <div className="flex items-center gap-2">
                    <button onClick={() => setYear(year - 1)} className={navBtn} style={{ borderColor: 'var(--border)', color: 'var(--foreground)' }} aria-label="Previous year">«</button>
                    <button onClick={goPrevMonth} className={navBtn} style={{ borderColor: 'var(--border)', color: 'var(--foreground)' }} aria-label="Previous month">‹</button>
                    <span className="min-w-[170px] text-center text-sm font-semibold" style={{ color: 'var(--foreground)' }}>{MONTH_NAMES[month]} {year}</span>
                    <button onClick={goNextMonth} className={navBtn} style={{ borderColor: 'var(--border)', color: 'var(--foreground)' }} aria-label="Next month">›</button>
                    <button onClick={() => setYear(year + 1)} className={navBtn} style={{ borderColor: 'var(--border)', color: 'var(--foreground)' }} aria-label="Next year">»</button>
                  </div>
                  <StatusBadge tone="accent">{yearlyLeave.length} leave days in {year}</StatusBadge>
                </div>

                <div className="p-3">
                  <div className="grid grid-cols-7 gap-1.5">
                    {DAYS_OF_WEEK.map((d, i) => (
                      <div key={d} className="py-1 text-center text-[11px] font-semibold uppercase tracking-wide" style={{ color: i === 0 || i === 6 ? 'var(--danger)' : 'var(--foreground-muted)' }}>{d}</div>
                    ))}
                    {calendarDays.map((day, idx) => {
                      if (day === null) return <div key={`e${idx}`} className="h-20 rounded-lg" style={{ backgroundColor: 'var(--surface-muted)', opacity: 0.5 }} />;
                      const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
                      const entry = entryMap.get(dateStr);
                      const isToday = dateStr === todayStr;
                      const dow = idx % 7;
                      const isWeekend = dow === 0 || dow === 6;
                      const color = entry?.leaveTypeMaster.color;
                      return (
                        <div
                          key={dateStr}
                          title={entry ? `${entry.name} · ${entry.leaveTypeMaster.name}` : undefined}
                          className="relative flex h-20 flex-col rounded-lg border p-1.5 text-left"
                          style={{
                            backgroundColor: color ? `${color}1f` : isWeekend ? 'var(--surface-muted)' : 'var(--surface)',
                            borderColor: isToday ? 'var(--accent)' : color ? `${color}66` : 'var(--border)',
                            boxShadow: isToday ? '0 0 0 1px var(--accent) inset' : undefined,
                          }}
                        >
                          <span
                            className="inline-flex h-6 w-6 items-center justify-center rounded-full text-xs font-semibold tabular-nums"
                            style={{
                              backgroundColor: isToday ? 'var(--accent)' : 'transparent',
                              color: isToday ? '#fff' : isWeekend && !color ? 'var(--danger)' : 'var(--foreground)',
                            }}
                          >
                            {day}
                          </span>
                          {entry && (
                            <span className="mt-auto flex items-center gap-1 overflow-hidden rounded-md px-1.5 py-0.5 text-[11px] font-semibold leading-tight" style={{ backgroundColor: color, color: '#fff' }}>
                              <span className="truncate">{entry.name}</span>
                            </span>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              </SectionCard>

              <div className="space-y-4">
                <SectionCard title="Leave Types" description="Each type has its own colour on the calendar." count={leaveTypes.length}>
                  {leaveTypes.length === 0 ? (
                    <EmptyState compact title="No leave types yet" description="HR hasn't marked any yearly leave days yet." />
                  ) : (
                    <ul className="space-y-2">
                      {leaveTypes.map((lt) => (
                        <li key={lt.id} className="flex items-center justify-between gap-2 rounded-lg border px-3 py-2" style={{ borderColor: 'var(--border)' }}>
                          <div className="flex min-w-0 items-center gap-2.5">
                            <span className="h-3.5 w-3.5 shrink-0 rounded-sm" style={{ backgroundColor: lt.color }} />
                            <div className="min-w-0 leading-tight">
                              <div className="truncate text-sm font-medium" style={{ color: 'var(--foreground)' }}>{lt.name}</div>
                              <div className="text-[11px]" style={{ color: 'var(--foreground-muted)' }}>{lt.code}</div>
                            </div>
                          </div>
                          <StatusBadge color={lt.color}>{countByType.get(lt.id) ?? 0} days</StatusBadge>
                        </li>
                      ))}
                    </ul>
                  )}
                </SectionCard>

                <SectionCard title={`${MONTH_NAMES[month]} ${year}`} description="Leave entries in the selected month." count={monthEntries.length} flush>
                  {monthEntries.length === 0 ? (
                    <EmptyState compact title="No leave this month" description="Nothing declared for this month yet." />
                  ) : (
                    <ul className="divide-y" style={{ borderColor: 'var(--border)' }}>
                      {monthEntries.map((e) => {
                        const d = new Date(e.date);
                        return (
                          <li key={e.id} className="flex items-center gap-2.5 px-4 py-2.5">
                            <div className="flex h-9 w-9 shrink-0 flex-col items-center justify-center rounded-md text-white leading-none" style={{ backgroundColor: e.leaveTypeMaster.color }}>
                              <span className="text-[9px] font-semibold uppercase opacity-90">{d.toLocaleDateString(undefined, { weekday: 'short' })}</span>
                              <span className="text-sm font-bold tabular-nums">{d.getUTCDate()}</span>
                            </div>
                            <div className="min-w-0 leading-tight">
                              <div className="truncate text-sm font-medium" style={{ color: 'var(--foreground)' }}>{e.name}</div>
                              <div className="text-[11px]" style={{ color: 'var(--foreground-muted)' }}>{e.leaveTypeMaster.name}</div>
                            </div>
                          </li>
                        );
                      })}
                    </ul>
                  )}
                </SectionCard>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
