export function TableSkeleton({ rows = 5 }: { rows?: number }) {
  return (
    <div className="animate-pulse space-y-3">
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="h-10 bg-slate-100 rounded-xl" />
      ))}
    </div>
  );
}

export function CardSkeleton() {
  return <div className="h-32 bg-slate-100 rounded-2xl animate-pulse" />;
}

export function FormSkeleton() {
  return (
    <div className="animate-pulse space-y-4">
      {Array.from({ length: 4 }).map((_, i) => (
        <div key={i}>
          <div className="h-3 bg-slate-100 rounded w-24 mb-2" />
          <div className="h-9 bg-slate-100 rounded-xl" />
        </div>
      ))}
    </div>
  );
}
