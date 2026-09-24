'use client';

/**
 * My Team — a reporting manager's direct reports, with this year's leave
 * broken down per leave type (Available/Used), exportable to Excel/PDF.
 * Clicking a name opens that report's month-wise check-in/check-out
 * attendance (src/app/ess/team/[id]/page.tsx), the ESS-side equivalent of
 * the HR Monthly Attendance page but gated by the reporting-manager
 * relationship instead of RBAC.
 */

import { Fragment, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { handleExport } from '@/lib/export-utils';
import LeaveTypeKpiCard, { leaveCardColor } from '@/components/ess/LeaveTypeKpiCard';

interface LeaveTypeBalance {
  leaveMasterId: number;
  code: string;
  name: string;
  available: number;
  used: number;
}

interface TeamMember {
  id: number;
  employeeCode: string | null;
  name: string;
  photoPath: string | null;
  designation: string | null;
  department: string | null;
  leaveAvailable: number;
  leaveUsed: number;
  leaveByType: LeaveTypeBalance[];
}

function Avatar({ name, photoPath }: { name: string; photoPath: string | null }) {
  if (photoPath) {
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={photoPath} alt={name} className="h-10 w-10 rounded-full object-cover" />;
  }
  const initials = name.split(' ').filter(Boolean).slice(0, 2).map((s) => s[0]).join('').toUpperCase();
  return (
    <div
      className="flex h-10 w-10 items-center justify-center rounded-full text-sm font-semibold text-white"
      style={{ backgroundColor: 'var(--info)' }}
    >
      {initials || '?'}
    </div>
  );
}

export default function MyTeamPage() {
  const router = useRouter();
  const [members, setMembers] = useState<TeamMember[]>([]);
  const [year, setYear] = useState(new Date().getUTCFullYear());
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    fetch(`/api/workforce/my-team?year=${year}`)
      .then(async (res) => {
        const json = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(json.error ?? 'Failed to load team');
        return json;
      })
      .then((json) => { if (!cancelled) { setMembers(json.data ?? []); setError(null); } })
      .catch((err) => { if (!cancelled) setError(err instanceof Error ? err.message : 'Failed to load team'); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [year]);

  // Union of every leave type that appears for anyone on the team, so a
  // report with no balance row for a given type still gets a 0/0 column
  // instead of the whole column disappearing.
  const leaveTypes = useMemo(() => {
    const byId = new Map<number, { leaveMasterId: number; name: string }>();
    for (const m of members) {
      for (const lt of m.leaveByType) {
        if (!byId.has(lt.leaveMasterId)) byId.set(lt.leaveMasterId, { leaveMasterId: lt.leaveMasterId, name: lt.name });
      }
    }
    return [...byId.values()].sort((a, b) => a.name.localeCompare(b.name));
  }, [members]);

  const balanceFor = (m: TeamMember, leaveMasterId: number) =>
    m.leaveByType.find((lt) => lt.leaveMasterId === leaveMasterId);

  // Team-wide total per leave type, for the KPI cards above the table.
  const teamTotalsByType = useMemo(
    () =>
      leaveTypes.map((lt) => {
        const available = members.reduce((sum, m) => sum + (balanceFor(m, lt.leaveMasterId)?.available ?? 0), 0);
        const used = members.reduce((sum, m) => sum + (balanceFor(m, lt.leaveMasterId)?.used ?? 0), 0);
        return { ...lt, available, used };
      }),
    [leaveTypes, members]
  );

  const exportRows = () =>
    members.map((m) => {
      const row: Record<string, unknown> = {
        'Employee Code': m.employeeCode ?? '',
        'Employee Name': m.name,
        Designation: m.designation ?? '',
        Department: m.department ?? '',
      };
      for (const lt of leaveTypes) {
        const b = balanceFor(m, lt.leaveMasterId);
        row[`${lt.name} - Available`] = b?.available ?? 0;
        row[`${lt.name} - Used`] = b?.used ?? 0;
      }
      row['Total Available'] = m.leaveAvailable;
      row['Total Used'] = m.leaveUsed;
      return row;
    });

  const doExport = (format: 'excel' | 'pdf') => {
    if (members.length === 0) return;
    handleExport({
      filename: `my-team-leave-balance-${year}`,
      title: `My Team — Leave Balance ${year}`,
      data: exportRows(),
      format,
    });
  };

  const fg = { color: 'var(--foreground)' };
  const muted = { color: 'var(--foreground-muted)' };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold" style={fg}>My Team</h1>
          <p className="text-sm" style={muted}>Your direct reports — leave balance by type this year. Click a name for their monthly attendance.</p>
        </div>
        <div className="flex items-center gap-2">
          <select
            value={year}
            onChange={(e) => setYear(Number(e.target.value))}
            className="rounded-lg border bg-transparent px-3 py-2 text-sm outline-none"
            style={{ borderColor: 'var(--border)', ...fg }}
          >
            {[year, year - 1].filter((v, i, arr) => arr.indexOf(v) === i).map((y) => (
              <option key={y} value={y}>{y}</option>
            ))}
          </select>
          <button
            type="button"
            onClick={() => doExport('excel')}
            disabled={members.length === 0}
            className="rounded-lg border px-3 py-2 text-xs font-semibold disabled:opacity-50"
            style={{ borderColor: 'var(--border)', ...fg }}
          >
            Export Excel
          </button>
          <button
            type="button"
            onClick={() => doExport('pdf')}
            disabled={members.length === 0}
            className="rounded-lg border px-3 py-2 text-xs font-semibold disabled:opacity-50"
            style={{ borderColor: 'var(--border)', ...fg }}
          >
            Export PDF
          </button>
        </div>
      </div>

      {teamTotalsByType.length > 0 && (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {teamTotalsByType.map((lt, i) => (
            <LeaveTypeKpiCard
              key={lt.leaveMasterId}
              name={lt.name}
              available={lt.available}
              total={lt.available + lt.used}
              color={leaveCardColor(i)}
            />
          ))}
        </div>
      )}

      <div className="card overflow-x-auto">
        {loading ? (
          <p className="p-6 text-sm" style={muted}>Loading…</p>
        ) : error ? (
          <p className="p-6 text-sm" style={{ color: 'var(--danger)' }}>{error}</p>
        ) : members.length === 0 ? (
          <p className="p-6 text-sm" style={muted}>No one reports to you.</p>
        ) : (
          <table className="w-full min-w-[720px] text-sm">
            <thead>
              <tr className="border-b text-left text-xs font-medium uppercase tracking-wide" style={{ borderColor: 'var(--border)', ...muted }}>
                <th className="px-4 py-3" rowSpan={2}>Employee</th>
                <th className="px-4 py-3" rowSpan={2}>Designation</th>
                {leaveTypes.map((lt) => (
                  <th key={lt.leaveMasterId} className="px-4 py-2 text-center" colSpan={2}>{lt.name}</th>
                ))}
                <th className="px-4 py-2 text-center" colSpan={2}>Total</th>
              </tr>
              <tr className="border-b text-center text-[11px] font-medium uppercase tracking-wide" style={{ borderColor: 'var(--border)', ...muted }}>
                {leaveTypes.map((lt) => (
                  <Fragment key={lt.leaveMasterId}>
                    <th className="px-2 py-1.5">Avail.</th>
                    <th className="px-2 py-1.5">Used</th>
                  </Fragment>
                ))}
                <th className="px-2 py-1.5">Avail.</th>
                <th className="px-2 py-1.5">Used</th>
              </tr>
            </thead>
            <tbody>
              {members.map((m) => (
                <tr
                  key={m.id}
                  onClick={() => router.push(`/ess/team/${m.id}`)}
                  className="cursor-pointer border-b transition-colors last:border-0 hover:bg-[var(--surface-hover,rgba(0,0,0,0.03))]"
                  style={{ borderColor: 'var(--border)' }}
                >
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-3">
                      <Avatar name={m.name} photoPath={m.photoPath} />
                      <div>
                        <div className="font-medium" style={fg}>{m.name}</div>
                        <div className="text-xs" style={muted}>{m.employeeCode ?? '—'}</div>
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3" style={fg}>{m.designation ?? '—'}</td>
                  {leaveTypes.map((lt) => {
                    const b = balanceFor(m, lt.leaveMasterId);
                    return (
                      <Fragment key={lt.leaveMasterId}>
                        <td className="px-2 py-3 text-center" style={{ color: 'var(--success)' }}>
                          {b?.available ?? 0}
                        </td>
                        <td className="px-2 py-3 text-center" style={{ color: 'var(--danger)' }}>
                          {b?.used ?? 0}
                        </td>
                      </Fragment>
                    );
                  })}
                  <td className="px-2 py-3 text-center font-semibold" style={{ color: 'var(--success)' }}>{m.leaveAvailable}</td>
                  <td className="px-2 py-3 text-center font-semibold" style={{ color: 'var(--danger)' }}>{m.leaveUsed}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
