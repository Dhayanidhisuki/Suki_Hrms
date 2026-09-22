/**
 * Panel chrome shared by every tile on the overview dashboard: the card, its
 * title/caption row, and the empty state a panel falls back to when its slice
 * of /api/dashboard/overview came back with nothing in it.
 *
 * The empty state is deliberate — panels show "no data yet" rather than
 * sample figures, so a demo never puts numbers on screen the database can't
 * back up.
 */

export function Panel({
  title,
  caption,
  children,
  className = '',
}: {
  title: string;
  caption?: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <section className={`card flex flex-col p-5 ${className}`}>
      <div className="mb-4 flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="text-[15px] font-bold tracking-tight" style={{ color: 'var(--foreground)' }}>
          {title}
        </h2>
        {caption && (
          <span className="text-[11.5px]" style={{ color: 'var(--foreground-muted)' }}>
            {caption}
          </span>
        )}
      </div>
      {children}
    </section>
  );
}

export function PanelEmpty({ message }: { message: string }) {
  return (
    <div
      className="flex flex-1 items-center justify-center rounded-xl border border-dashed px-4 py-10 text-center text-[12.5px]"
      style={{ borderColor: 'var(--border)', color: 'var(--foreground-muted)' }}
    >
      {message}
    </div>
  );
}

export function Row({
  label,
  value,
  muted = false,
}: {
  label: React.ReactNode;
  value: React.ReactNode;
  muted?: boolean;
}) {
  return (
    <div
      className="flex items-center justify-between gap-3 border-b py-2.5 text-[12.5px] last:border-b-0"
      style={{ borderColor: 'var(--border)' }}
    >
      <span style={{ color: muted ? 'var(--foreground-muted)' : 'var(--foreground-muted)' }}>{label}</span>
      <span className="font-semibold tabular-nums" style={{ color: 'var(--foreground)' }}>
        {value}
      </span>
    </div>
  );
}
