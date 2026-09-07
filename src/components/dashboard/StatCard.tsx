import Icon, { type IconName } from "@/components/layout/NavIcons";
import { GhostButton, IconTile, toneVar } from "./Primitives";
import type { Tone } from "./data";

type Visual = "spark" | "bars" | "ticks" | "meter";

function MiniVisual({ visual, tone }: { visual: Visual; tone: Tone }) {
  const color = toneVar[tone].fg;
  const track = "var(--chart-track)";

  if (visual === "spark") {
    return (
      <svg viewBox="0 0 120 34" className="h-9 w-[120px]" fill="none" aria-hidden>
        <path
          d="M2 26 L14 22 L22 27 L32 14 L40 20 L50 9 L60 17 L70 13 L82 15 L92 6 L104 9 L118 5"
          stroke={color}
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    );
  }

  if (visual === "bars") {
    const heights = [10, 16, 12, 30, 14, 22, 12, 18];
    return (
      <div className="flex h-9 items-end gap-1.5" aria-hidden>
        {heights.map((height, index) => (
          <span
            key={index}
            className="w-2 rounded-sm"
            style={{ height, background: index === 3 ? color : track }}
          />
        ))}
      </div>
    );
  }

  if (visual === "ticks") {
    return (
      <div className="flex h-9 items-end gap-[3px]" aria-hidden>
        {Array.from({ length: 22 }).map((_, index) => (
          <span
            key={index}
            className="w-[3px] rounded-full"
            style={{ height: 10 + ((index * 7) % 18), background: color, opacity: index % 2 ? 0.55 : 1 }}
          />
        ))}
      </div>
    );
  }

  return (
    <div className="flex h-9 items-center" aria-hidden>
      <div className="h-3.5 w-full overflow-hidden rounded-full" style={{ background: toneVar[tone].bg }}>
        <div className="h-full rounded-full" style={{ width: "42%", background: color }} />
      </div>
    </div>
  );
}

export default function StatCard({
  label,
  value,
  delta,
  trend,
  tone,
  icon,
  visual,
  description,
}: {
  label: string;
  value: string;
  delta: string;
  trend: "up" | "down";
  tone: Tone;
  icon: IconName;
  visual: Visual;
  description: string;
}) {
  return (
    <article className="card flex flex-col gap-4 p-5">
      <div className="flex items-center gap-2">
        <h3 className="flex items-center gap-1.5 text-[13px] font-semibold" style={{ color: "var(--foreground)" }}>
          {label}
          <Icon name="info" size={13} style={{ color: "var(--foreground-muted)" }} />
        </h3>
        <span className="ml-auto">
          <GhostButton>See Details</GhostButton>
        </span>
      </div>

      <div className="flex items-center gap-3">
        <IconTile name={icon} tone={tone} />
        <p className="text-[34px] font-bold leading-none tracking-tight" style={{ color: "var(--foreground)" }}>
          {value}
        </p>
        <span
          className="inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-semibold"
          style={{ background: toneVar[tone].bg, color: toneVar[tone].fg }}
        >
          <Icon name={trend === "up" ? "trend-up" : "trend-down"} size={12} strokeWidth={2.2} />
          {delta}
        </span>
      </div>

      <div className="flex items-end gap-4">
        <MiniVisual visual={visual} tone={tone} />
        <p className="flex-1 text-[11px] leading-relaxed" style={{ color: "var(--foreground-muted)" }}>
          {description}
        </p>
      </div>
    </article>
  );
}
