export function TableSkeleton({ rows = 5 }: { rows?: number }) {
  return (
    <div className="animate-pulse space-y-3">
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="h-10 bg-[var(--bg-subtle)] border border-[var(--border-main)] rounded-xl" />
      ))}
    </div>
  );
}

export function CardSkeleton() {
  return <div className="h-32 bg-[var(--bg-subtle)] border border-[var(--border-main)] rounded-2xl animate-pulse" />;
}

export function FormSkeleton() {
  return (
    <div className="animate-pulse space-y-4">
      {Array.from({ length: 4 }).map((_, i) => (
        <div key={i}>
          <div className="h-3 bg-[var(--bg-subtle)] rounded w-24 mb-2" />
          <div className="h-9 bg-[var(--bg-subtle)] border border-[var(--border-main)] rounded-xl" />
        </div>
      ))}
    </div>
  );
}
