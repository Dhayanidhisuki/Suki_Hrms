import { PanelHeader } from "./Primitives";
import { attendanceSeries } from "./data";

const MAX = 120;
const AXIS = [120, 100, 75, 50, 25, 0];

const legend = [
  { label: "Present 04%", color: "var(--success)" },
  { label: "Absent 13%", color: "var(--warning)" },
  { label: "Leave 9%", color: "var(--danger)" },
];

function Column({ item }: { item: (typeof attendanceSeries)[number] }) {
  const overlay =
    item.present > 0
      ? { value: item.present, color: "var(--success)", soft: "var(--success-soft)" }
      : item.absent > 0
        ? { value: item.absent, color: "var(--warning)", soft: "var(--warning-soft)" }
        : item.leave > 0
          ? { value: item.leave, color: "var(--danger)", soft: "var(--danger-soft)" }
          : null;

  const pct = (value: number) => `${(value / MAX) * 100}%`;

  return (
    <div className="flex min-w-0 flex-1 flex-col items-center gap-2">
      <div className="relative flex h-[240px] w-full items-end justify-center">
        <div
          className="w-[62%] max-w-[46px] rounded-t-md"
          style={{
            height: pct(item.track),
            background: overlay ? overlay.soft : "var(--chart-track)",
          }}
        />
        {overlay && (
          <div
            className="absolute bottom-0 w-[62%] max-w-[46px] rounded-t-md"
            style={{ height: pct(overlay.value), background: overlay.color }}
          />
        )}
      </div>
      <span className="w-full truncate text-center text-[11px]" style={{ color: "var(--foreground-muted)" }}>
        {item.label}
      </span>
    </div>
  );
}

export default function AttendanceChart() {
  return (
    <section className="card">
      <PanelHeader
        title="Daily Attendance Statistic"
        action={
          <select
            defaultValue="Daily"
            className="rounded-full border px-3 py-1.5 text-[11px] font-semibold outline-none"
            style={{ borderColor: "var(--border)", color: "var(--foreground-muted)", background: "var(--surface)" }}
            aria-label="Chart range"
          >
            <option>Daily</option>
            <option>Weekly</option>
            <option>Monthly</option>
          </select>
        }
      >
        <div className="ml-auto flex flex-wrap items-center gap-4">
          {legend.map((entry) => (
            <span key={entry.label} className="flex items-center gap-1.5 text-[11px] font-medium" style={{ color: "var(--foreground-muted)" }}>
              <span className="h-2.5 w-2.5 rounded-full" style={{ background: entry.color }} />
              {entry.label}
            </span>
          ))}
        </div>
      </PanelHeader>

      <div className="flex items-start gap-3 px-5 pb-5">
        <div className="flex h-[240px] w-9 flex-col justify-between pb-0 text-right text-[10px]" style={{ color: "var(--foreground-muted)" }}>
          {AXIS.map((tick) => (
            <span key={tick}>{tick}%</span>
          ))}
        </div>
        <div className="flex min-w-0 flex-1 items-end gap-1.5 sm:gap-3">
          {attendanceSeries.map((item) => (
            <Column key={item.label} item={item} />
          ))}
        </div>
      </div>
    </section>
  );
}
