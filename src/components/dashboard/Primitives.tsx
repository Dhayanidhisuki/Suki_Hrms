import Icon, { type IconName } from "@/components/layout/NavIcons";
import { avatarColor, initials, type Tone } from "./data";

export const toneVar: Record<Tone, { fg: string; bg: string }> = {
  success: { fg: "var(--success)", bg: "var(--success-soft)" },
  warning: { fg: "var(--warning)", bg: "var(--warning-soft)" },
  danger: { fg: "var(--danger)", bg: "var(--danger-soft)" },
  info: { fg: "var(--info)", bg: "var(--info-soft)" },
};

export function Avatar({ name, size = 40 }: { name: string; size?: number }) {
  return (
    <span
      className="grid shrink-0 place-items-center rounded-full font-bold text-white"
      style={{
        width: size,
        height: size,
        background: avatarColor(name),
        fontSize: Math.round(size * 0.34),
      }}
      aria-hidden
    >
      {initials(name)}
    </span>
  );
}

export function Badge({ children, tone }: { children: React.ReactNode; tone: Tone }) {
  return (
    <span
      className="inline-flex items-center rounded-full px-3 py-1 text-[11px] font-semibold"
      style={{ background: toneVar[tone].bg, color: toneVar[tone].fg }}
    >
      {children}
    </span>
  );
}

export function GhostButton({ children }: { children: React.ReactNode }) {
  return (
    <button
      type="button"
      className="rounded-full border px-3 py-1.5 text-[11px] font-semibold transition hover:bg-[color:var(--surface-hover)]"
      style={{ borderColor: "var(--border)", color: "var(--foreground-muted)" }}
    >
      {children}
    </button>
  );
}

export function PanelHeader({
  title,
  action,
  children,
}: {
  title: string;
  action?: React.ReactNode;
  children?: React.ReactNode;
}) {
  return (
    <div className="flex flex-wrap items-center gap-3 px-5 pt-5 pb-4">
      <h2 className="flex items-center gap-2 text-[17px] font-bold tracking-tight" style={{ color: "var(--foreground)" }}>
        {title}
        <Icon name="info" size={14} style={{ color: "var(--foreground-muted)" }} />
      </h2>
      {children}
      {action && <div className="ml-auto flex items-center gap-2">{action}</div>}
    </div>
  );
}

export function IconTile({ name, tone }: { name: IconName; tone: Tone }) {
  return (
    <span
      className="grid h-11 w-11 shrink-0 place-items-center rounded-xl"
      style={{ background: toneVar[tone].bg, color: toneVar[tone].fg }}
    >
      <Icon name={name} size={20} />
    </span>
  );
}
