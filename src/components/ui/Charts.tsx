'use client';

/**
 * Dependency-free SVG charts for dashboards — keeps the project lean (no
 * chart lib). Two primitives: MiniBarChart (grouped bars over a shared
 * baseline) and DonutChart (proportional ring + legend).
 */

interface BarDatum {
  label: string;
  values: number[]; // one entry per series
}

interface DonutDatum {
  name: string;
  value: number;
}

const PALETTE = ['#6366f1', '#22c55e', '#f59e0b', '#ef4444', '#0ea5e9', '#a855f7', '#64748b'];

export function MiniBarChart({
  data,
  series,
  height = 180,
}: {
  data: BarDatum[];
  series: { name: string; color?: string }[];
  height?: number;
}) {
  if (data.length === 0) return <p className="text-xs" style={{ color: 'var(--foreground-muted)' }}>No data.</p>;
  const max = Math.max(1, ...data.flatMap((d) => d.values));
  const slot = 100 / data.length;
  const barW = Math.min(10, (slot * 0.7) / series.length);

  return (
    <div>
      <svg viewBox={`0 0 100 ${height / 3}`} className="w-full" style={{ height }} preserveAspectRatio="none">
        {data.map((d, i) => (
          <g key={d.label}>
            {d.values.map((v, si) => {
              const h = (v / max) * (height / 3 - 8);
              return (
                <rect
                  key={si}
                  x={i * slot + (slot - barW * series.length) / 2 + si * barW}
                  y={height / 3 - h - 4}
                  width={barW * 0.85}
                  height={Math.max(h, 0.5)}
                  rx={0.8}
                  fill={series[si]?.color ?? PALETTE[si % PALETTE.length]}
                >
                  <title>{`${d.label} — ${series[si]?.name}: ${v}`}</title>
                </rect>
              );
            })}
          </g>
        ))}
      </svg>
      <div className="mt-1 flex justify-between text-[10px]" style={{ color: 'var(--foreground-muted)' }}>
        {data.map((d) => <span key={d.label}>{d.label}</span>)}
      </div>
      <div className="mt-2 flex flex-wrap gap-3 text-xs" style={{ color: 'var(--foreground-muted)' }}>
        {series.map((s, i) => (
          <span key={s.name} className="flex items-center gap-1">
            <span className="inline-block h-2.5 w-2.5 rounded-sm" style={{ backgroundColor: s.color ?? PALETTE[i % PALETTE.length] }} />
            {s.name}
          </span>
        ))}
      </div>
    </div>
  );
}

export function DonutChart({ data, size = 120 }: { data: DonutDatum[]; size?: number }) {
  const total = data.reduce((s, d) => s + d.value, 0);
  if (total === 0) return <p className="text-xs" style={{ color: 'var(--foreground-muted)' }}>No data.</p>;

  const r = 15.9;
  const cx = 21;
  // Pre-compute each segment's offset so render stays pure.
  const offsets: number[] = [];
  data.reduce((acc, d) => { offsets.push(acc); return acc - (d.value / total) * 100; }, 25);

  return (
    <div className="flex items-center gap-4">
      <svg viewBox="0 0 42 42" style={{ width: size, height: size }}>
        <circle cx={cx} cy={cx} r={r} fill="none" stroke="var(--surface-muted)" strokeWidth={6} />
        {data.map((d, i) => {
          const pct = (d.value / total) * 100;
          return (
            <circle
              key={d.name}
              cx={cx} cy={cx} r={r} fill="none"
              stroke={PALETTE[i % PALETTE.length]}
              strokeWidth={6}
              strokeDasharray={`${pct} ${100 - pct}`}
              strokeDashoffset={offsets[i]}
            >
              <title>{`${d.name}: ${d.value}`}</title>
            </circle>
          );
        })}
        <text x={cx} y={cx} textAnchor="middle" dominantBaseline="middle" fontSize={7} fill="var(--foreground)" fontWeight={600}>
          {total}
        </text>
      </svg>
      <div className="space-y-1 text-xs" style={{ color: 'var(--foreground-muted)' }}>
        {data.map((d, i) => (
          <div key={d.name} className="flex items-center gap-1.5">
            <span className="inline-block h-2.5 w-2.5 rounded-sm" style={{ backgroundColor: PALETTE[i % PALETTE.length] }} />
            {d.name} — {d.value}
          </div>
        ))}
      </div>
    </div>
  );
}
