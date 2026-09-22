/**
 * Shift Plan — shows the weekly/monthly shift schedule for all employees.
 * Displays current and upcoming shifts, with automatic rotation and manual
 * overrides. Admin can change individual shifts or bulk upload overrides.
 *
 * UI pass (2026-09): card grid with sticky employee column, today column
 * highlight, weekend shading, legend chips, KPI strip and a tidier override
 * modal. Endpoints and payloads unchanged.
 */

'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import Link from 'next/link';
import { PageHeader, SectionCard, Tabs, Button, EmptyState, KPICard, KPIGrid, useToast } from '@/components/ui';

interface ShiftPlanRow {
  employeeId: number;
  employeeCode: string;
  employeeName: string;
  date: string;
  shiftMasterId: number | null;
  shiftCode: string | null;
  shiftName: string | null;
  startTime: string | null;
  endTime: string | null;
  graceMinutes: number;
  nightAllowed: boolean;
  isOverride: boolean;
  overrideReason: string | null;
}

interface ShiftOption {
  id: number;
  code: string;
  name: string;
  startTime: string;
  endTime: string;
  nightAllowed: boolean;
}

function getWeekStart(date: Date): Date {
  const d = new Date(date);
  const day = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() - day + 1);
  return d;
}

function formatDate(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function addDays(d: Date, days: number): Date {
  const r = new Date(d);
  r.setUTCDate(r.getUTCDate() + days);
  return r;
}

/** Stable, distinct colour per shift code. Known codes get fixed hues; anything else is hashed. */
const KNOWN_SHIFT_HUES: Record<string, number> = { GEN: 205, GENERAL: 205, MORNING: 40, MOR: 40, EVENING: 320, EVE: 320, NIGHT: 245, NGT: 245 };
function shiftHue(code: string): number {
  if (KNOWN_SHIFT_HUES[code.toUpperCase()] !== undefined) return KNOWN_SHIFT_HUES[code.toUpperCase()];
  let h = 0;
  for (let i = 0; i < code.length; i++) h = (h * 31 + code.charCodeAt(i)) % 360;
  return h;
}
const shiftBg = (code: string) => `hsl(${shiftHue(code)} 85% 92%)`;
const shiftFg = (code: string) => `hsl(${shiftHue(code)} 60% 32%)`;
const shiftDot = (code: string) => `hsl(${shiftHue(code)} 70% 55%)`;

const MoonIcon = () => (
  <svg width="11" height="11" viewBox="0 0 24 24" fill="currentColor" aria-label="Night shift">
    <path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8Z" />
  </svg>
);

export default function ShiftPlanPage() {
  const toast = useToast();
  const [view, setView] = useState<'week' | 'month'>('week');
  const [weekStart, setWeekStart] = useState(getWeekStart(new Date()));
  const [monthDate, setMonthDate] = useState(new Date(new Date().getUTCFullYear(), new Date().getUTCMonth(), 1));
  const [plan, setPlan] = useState<ShiftPlanRow[]>([]);
  const [shifts, setShifts] = useState<ShiftOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingCell, setEditingCell] = useState<{ employeeId: number; date: string; employeeName?: string } | null>(null);
  const [selectedShiftId, setSelectedShiftId] = useState<number | null>(null);
  const [overrideReason, setOverrideReason] = useState('');
  const [search, setSearch] = useState('');

  const startDate = view === 'week' ? weekStart : monthDate;
  const endDate = view === 'week' ? addDays(weekStart, 6) : addDays(addDays(monthDate, 0), new Date(monthDate.getUTCFullYear(), monthDate.getUTCMonth() + 1, 0).getUTCDate() - 1);

  const fetchPlan = useCallback(async () => {
    setLoading(true);
    try {
      const [planRes, shiftsRes] = await Promise.all([
        fetch(`/api/workforce/shift-plan?startDate=${formatDate(startDate)}&endDate=${formatDate(endDate)}`),
        fetch('/api/masters/shift-masters?limit=50'),
      ]);
      if (!planRes.ok) throw new Error((await planRes.json()).error ?? 'Failed to fetch plan');
      if (!shiftsRes.ok) throw new Error((await shiftsRes.json()).error ?? 'Failed to fetch shifts');
      const planJson = await planRes.json();
      const shiftsJson = await shiftsRes.json();
      setPlan(planJson.data);
      setShifts(shiftsJson.data ?? []);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  }, [startDate, endDate, toast]);

  useEffect(() => {
    fetchPlan();
  }, [fetchPlan]);

  // Group by employee
  const empMap = useMemo(() => {
    const m = new Map<number, ShiftPlanRow[]>();
    for (const p of plan) {
      if (!m.has(p.employeeId)) m.set(p.employeeId, []);
      m.get(p.employeeId)!.push(p);
    }
    return m;
  }, [plan]);

  const employees = useMemo(() => {
    const ids = Array.from(empMap.keys());
    const q = search.trim().toLowerCase();
    if (!q) return ids;
    return ids.filter((id) => {
      const info = empMap.get(id)?.[0];
      return info && `${info.employeeCode} ${info.employeeName}`.toLowerCase().includes(q);
    });
  }, [empMap, search]);

  // Date columns
  const dates: Date[] = [];
  const cursor = new Date(startDate);
  while (cursor <= endDate) {
    dates.push(new Date(cursor));
    cursor.setUTCDate(cursor.getUTCDate() + 1);
  }
  const todayStr = formatDate(new Date());

  const stats = useMemo(() => {
    const overrides = plan.filter((p) => p.isOverride).length;
    const nights = plan.filter((p) => p.nightAllowed).length;
    return { employees: empMap.size, overrides, nights };
  }, [plan, empMap]);

  const handleSaveOverride = async () => {
    if (!editingCell || !selectedShiftId) return;
    try {
      const res = await fetch('/api/workforce/shift-plan', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          overrides: [{
            employeeId: editingCell.employeeId,
            date: editingCell.date,
            shiftMasterId: selectedShiftId,
            reason: overrideReason || undefined,
          }],
        }),
      });
      const json = await res.json();
      if (!res.ok) {
        toast.error(json.error ?? 'Failed to save override');
        return;
      }
      toast.success(`Override saved for ${editingCell.date}`);
      setEditingCell(null);
      setSelectedShiftId(null);
      setOverrideReason('');
      fetchPlan();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to save');
    }
  };

  const handleDeleteOverride = async (employeeId: number, date: string) => {
    try {
      const res = await fetch('/api/workforce/shift-plan', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ employeeId, date }),
      });
      const json = await res.json();
      if (!res.ok) {
        toast.error(json.error ?? 'Failed to delete override');
        return;
      }
      toast.success(`Override removed for ${date}`);
      fetchPlan();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to delete');
    }
  };

  const goPrev = () => {
    if (view === 'week') setWeekStart(addDays(weekStart, -7));
    else setMonthDate(new Date(monthDate.getUTCFullYear(), monthDate.getUTCMonth() - 1, 1));
  };
  const goNext = () => {
    if (view === 'week') setWeekStart(addDays(weekStart, 7));
    else setMonthDate(new Date(monthDate.getUTCFullYear(), monthDate.getUTCMonth() + 1, 1));
  };
  const goToday = () => {
    if (view === 'week') setWeekStart(getWeekStart(new Date()));
    else setMonthDate(new Date(new Date().getUTCFullYear(), new Date().getUTCMonth(), 1));
  };

  const periodLabel =
    view === 'week'
      ? `${weekStart.toLocaleDateString(undefined, { day: 'numeric', month: 'short' })} – ${addDays(weekStart, 6).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' })}`
      : monthDate.toLocaleDateString(undefined, { month: 'long', year: 'numeric' });

  const navBtn = 'inline-flex h-8 w-8 items-center justify-center rounded-md border text-sm transition hover:brightness-95';

  return (
    <div className="space-y-4">
      <PageHeader
        eyebrow="Time Office"
        title="Shift Plan"
        description="Weekly rotation resolved per employee. Click any cell to set a one-off manual override; outlined cells are overrides."
        actions={
          <>
            <Link href="/workforce/bulk-shift-upload" className="inline-flex items-center rounded-lg border px-3 py-2 text-sm font-medium transition hover:brightness-95" style={{ borderColor: 'var(--border)', color: 'var(--foreground)', backgroundColor: 'var(--surface)' }}>
              Bulk Upload
            </Link>
            <Tabs
              variant="segmented"
              tabs={[{ key: 'week', label: 'Week' }, { key: 'month', label: 'Month' }]}
              active={view}
              onChange={(k) => setView(k)}
            />
          </>
        }
      />

      <KPIGrid columns={3}>
        <KPICard label="Employees Scheduled" value={stats.employees} tone="info" />
        <KPICard label="Manual Overrides" value={stats.overrides} subtitle="in this period" tone={stats.overrides > 0 ? 'warning' : 'success'} />
        <KPICard label="Night Shift Days" value={stats.nights} subtitle="night allowance eligible" tone="info" />
      </KPIGrid>

      <SectionCard flush>
        {/* Toolbar: period nav + legend + search */}
        <div className="flex flex-wrap items-center justify-between gap-3 border-b px-4 py-3" style={{ borderColor: 'var(--border)' }}>
          <div className="flex items-center gap-2">
            <button onClick={goPrev} className={navBtn} style={{ borderColor: 'var(--border)', color: 'var(--foreground)' }} aria-label="Previous">‹</button>
            <span className="min-w-[200px] text-center text-sm font-semibold tabular-nums" style={{ color: 'var(--foreground)' }}>{periodLabel}</span>
            <button onClick={goNext} className={navBtn} style={{ borderColor: 'var(--border)', color: 'var(--foreground)' }} aria-label="Next">›</button>
            <Button size="sm" onClick={goToday}>Today</Button>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {shifts.map((s) => (
              <span key={s.id} className="inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-[11px] font-medium" style={{ backgroundColor: shiftBg(s.code), color: shiftFg(s.code) }}>
                <span className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: shiftDot(s.code) }} />
                {s.code} <span className="opacity-70">{s.startTime}–{s.endTime}</span>
                {s.nightAllowed && <MoonIcon />}
              </span>
            ))}
            <span className="inline-flex items-center gap-1.5 rounded-full border-2 px-2 py-0.5 text-[11px] font-medium" style={{ borderColor: 'var(--warning)', color: 'var(--foreground-muted)' }}>
              Override
            </span>
          </div>

          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Filter employee…"
            className="w-44 rounded-lg border px-3 py-1.5 text-xs focus:outline-none focus:ring-2"
            style={{ backgroundColor: 'var(--surface)', color: 'var(--foreground)', borderColor: 'var(--border)' }}
          />
        </div>

        {loading ? (
          <div className="px-4 py-10 text-center text-sm" style={{ color: 'var(--foreground-muted)' }}>Loading shift plan…</div>
        ) : employees.length === 0 ? (
          <EmptyState title="No employees to show" description={search ? 'No employee matches your filter.' : 'No active employees have a shift assignment in this period.'} />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-xs" style={{ borderCollapse: 'separate', borderSpacing: 0 }}>
              <thead>
                <tr>
                  <th
                    className="sticky left-0 z-20 px-3 py-2 text-left text-[11px] font-semibold uppercase tracking-wide"
                    style={{ backgroundColor: 'var(--surface-hover)', color: 'var(--foreground-muted)', borderBottom: '1px solid var(--border)', minWidth: 200 }}
                  >
                    Employee
                  </th>
                  {dates.map((d) => {
                    const ds = formatDate(d);
                    const isToday = ds === todayStr;
                    const isWeekend = d.getUTCDay() === 0 || d.getUTCDay() === 6;
                    return (
                      <th
                        key={ds}
                        className="px-1.5 py-2 text-center font-semibold"
                        style={{
                          backgroundColor: isToday ? 'var(--accent-soft)' : isWeekend ? 'var(--surface-muted)' : 'var(--surface-hover)',
                          color: isToday ? 'var(--accent)' : isWeekend ? 'var(--foreground-muted)' : 'var(--foreground)',
                          borderBottom: isToday ? '2px solid var(--accent)' : '1px solid var(--border)',
                          minWidth: view === 'week' ? 110 : 72,
                        }}
                      >
                        <div className="text-[10px] uppercase tracking-wide opacity-80">{d.toLocaleDateString(undefined, { weekday: 'short' })}</div>
                        <div className="text-sm tabular-nums">{d.getUTCDate()}</div>
                      </th>
                    );
                  })}
                </tr>
              </thead>
              <tbody>
                {employees.map((empId, rowIdx) => {
                  const empRows = empMap.get(empId) ?? [];
                  const empInfo = empRows[0];
                  const rowBg = rowIdx % 2 === 0 ? 'var(--surface)' : 'var(--surface-hover)';
                  return (
                    <tr key={empId}>
                      <td
                        className="sticky left-0 z-10 px-3 py-1.5"
                        style={{ backgroundColor: rowBg, borderBottom: '1px solid var(--border)', boxShadow: '2px 0 0 var(--border)' }}
                      >
                        <div className="font-medium leading-tight" style={{ color: 'var(--foreground)' }}>{empInfo.employeeName}</div>
                        <div className="text-[11px]" style={{ color: 'var(--foreground-muted)' }}>{empInfo.employeeCode}</div>
                      </td>
                      {dates.map((d) => {
                        const dateStr = formatDate(d);
                        const row = empRows.find((r) => r.date === dateStr);
                        const isToday = dateStr === todayStr;
                        if (!row || !row.shiftCode) {
                          return (
                            <td key={dateStr} className="px-1.5 py-1.5 text-center" style={{ backgroundColor: isToday ? 'var(--accent-soft)' : rowBg, borderBottom: '1px solid var(--border)', color: 'var(--foreground-muted)' }}>
                              —
                            </td>
                          );
                        }
                        return (
                          <td
                            key={dateStr}
                            className="p-1"
                            style={{ backgroundColor: isToday ? 'var(--accent-soft)' : rowBg, borderBottom: '1px solid var(--border)' }}
                          >
                            <button
                              type="button"
                              onClick={() => {
                                setEditingCell({ employeeId: empId, date: dateStr, employeeName: empInfo.employeeName });
                                setSelectedShiftId(row.shiftMasterId);
                                setOverrideReason(row.overrideReason ?? '');
                              }}
                              title={row.isOverride ? `Manual override: ${row.overrideReason ?? 'No reason'}` : `${row.shiftName ?? row.shiftCode} — automatic rotation. Click to override.`}
                              className="group relative flex w-full flex-col items-center rounded-md px-1.5 py-1.5 text-center transition hover:shadow-sm"
                              style={{
                                backgroundColor: shiftBg(row.shiftCode),
                                color: shiftFg(row.shiftCode),
                                outline: row.isOverride ? '2px solid var(--warning)' : '1px solid transparent',
                                outlineOffset: -1,
                              }}
                            >
                              <span className="flex items-center gap-1 font-semibold leading-none">
                                {row.shiftCode}
                                {row.nightAllowed && <MoonIcon />}
                              </span>
                              <span className="mt-0.5 text-[10px] tabular-nums opacity-80">{row.startTime}–{row.endTime}</span>
                              {row.isOverride && (
                                <span
                                  role="button"
                                  tabIndex={0}
                                  onClick={(e) => { e.stopPropagation(); handleDeleteOverride(empId, dateStr); }}
                                  onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); e.stopPropagation(); handleDeleteOverride(empId, dateStr); } }}
                                  className="absolute -right-1 -top-1 hidden h-4 w-4 items-center justify-center rounded-full text-[10px] font-bold text-white group-hover:flex"
                                  style={{ backgroundColor: 'var(--danger)' }}
                                  title="Remove override"
                                >
                                  ✕
                                </span>
                              )}
                            </button>
                          </td>
                        );
                      })}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </SectionCard>

      {/* Edit override modal */}
      {editingCell && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ backgroundColor: 'rgba(0,0,0,0.45)' }}>
          <div className="w-full max-w-md space-y-4 rounded-xl border p-5 shadow-xl" style={{ backgroundColor: 'var(--surface)', borderColor: 'var(--border)' }}>
            <div>
              <h2 className="text-base font-semibold" style={{ color: 'var(--foreground)' }}>Change Shift</h2>
              <p className="mt-0.5 text-sm" style={{ color: 'var(--foreground-muted)' }}>
                {editingCell.employeeName} · {new Date(editingCell.date).toLocaleDateString(undefined, { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
              </p>
            </div>

            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-medium" style={{ color: 'var(--foreground-muted)' }}>Shift</label>
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                {shifts.map((s) => {
                  const active = s.id === selectedShiftId;
                  return (
                    <button
                      key={s.id}
                      type="button"
                      onClick={() => setSelectedShiftId(s.id)}
                      className="flex items-center gap-2 rounded-lg border px-3 py-2 text-left transition"
                      style={{
                        borderColor: active ? 'var(--accent)' : 'var(--border)',
                        backgroundColor: active ? 'var(--accent-soft)' : 'var(--surface)',
                        boxShadow: active ? '0 0 0 1px var(--accent) inset' : 'none',
                      }}
                    >
                      <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ backgroundColor: shiftDot(s.code) }} />
                      <span className="min-w-0 flex-1 leading-tight">
                        <span className="flex items-center gap-1 text-sm font-medium" style={{ color: 'var(--foreground)' }}>
                          {s.code}
                          {s.nightAllowed && <span style={{ color: 'var(--foreground-muted)' }}><MoonIcon /></span>}
                        </span>
                        <span className="block truncate text-[11px] tabular-nums" style={{ color: 'var(--foreground-muted)' }}>{s.name} · {s.startTime}–{s.endTime}</span>
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-medium" style={{ color: 'var(--foreground-muted)' }}>Reason (optional)</label>
              <input
                type="text"
                value={overrideReason}
                onChange={(e) => setOverrideReason(e.target.value)}
                placeholder="Why is this shift being changed?"
                className="rounded-lg border px-3 py-2 text-sm focus:outline-none focus:ring-2"
                style={{ backgroundColor: 'var(--background)', color: 'var(--foreground)', borderColor: 'var(--border)' }}
              />
            </div>

            <div className="flex justify-end gap-2 pt-1">
              <Button onClick={() => { setEditingCell(null); setSelectedShiftId(null); setOverrideReason(''); }}>Cancel</Button>
              <Button variant="primary" disabled={!selectedShiftId} onClick={handleSaveOverride}>Save Override</Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
