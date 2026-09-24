'use client';

/**
 * Colourful "Remaining <Leave Type>" card with a circular progress ring —
 * the reporting-manager-facing counterpart to the solid-colour KPI cards on
 * the employee's own My Requests page. Used on My Team (aggregated across
 * the team) and a team member's attendance detail page (that one person's
 * balance).
 */

const PALETTE = ['#16a34a', '#2563eb', '#7c3aed', '#ea580c', '#0891b2', '#db2777'];

export function leaveCardColor(index: number): string {
  return PALETTE[index % PALETTE.length];
}

export default function LeaveTypeKpiCard({
  name,
  available,
  total,
  color,
}: {
  name: string;
  available: number;
  total: number;
  color: string;
}) {
  const r = 30;
  const c = 2 * Math.PI * r;
  const pct = total > 0 ? Math.min(1, Math.max(0, available / total)) : available > 0 ? 1 : 0;

  return (
    <div
      className="flex items-center justify-between gap-3 rounded-2xl p-5 text-white shadow-sm"
      style={{ backgroundColor: color }}
    >
      <div className="min-w-0">
        <div className="text-xs font-medium opacity-90">Remaining</div>
        <div className="truncate text-lg font-bold capitalize">{name}</div>
      </div>
      <svg width="76" height="76" viewBox="0 0 76 76" className="shrink-0">
        <circle cx="38" cy="38" r={r} fill="none" stroke="rgba(255,255,255,0.3)" strokeWidth="7" />
        <circle
          cx="38" cy="38" r={r} fill="none"
          stroke="#fff" strokeWidth="7" strokeLinecap="round"
          strokeDasharray={`${pct * c} ${c}`}
          transform="rotate(-90 38 38)"
        />
        <text x="38" y="41" textAnchor="middle" fontSize="15" fontWeight="700" fill="#fff">
          {available}/{total}
        </text>
      </svg>
    </div>
  );
}
