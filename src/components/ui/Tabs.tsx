'use client';

export interface TabDef<K extends string = string> {
  key: K;
  label: string;
  /** Optional count badge. */
  count?: number;
}

interface TabsProps<K extends string> {
  tabs: TabDef<K>[];
  active: K;
  onChange: (key: K) => void;
  /** `underline` — classic bottom-border tabs. `segmented` — pill toggle group. */
  variant?: 'underline' | 'segmented';
}

/** Presentational tab strip; the page owns which tab is active. */
export default function Tabs<K extends string>({ tabs, active, onChange, variant = 'underline' }: TabsProps<K>) {
  if (variant === 'segmented') {
    return (
      <div className="inline-flex rounded-xl border p-0.5" style={{ borderColor: 'var(--border-main)', backgroundColor: 'var(--bg-subtle)' }} role="tablist">
        {tabs.map((t) => {
          const isActive = t.key === active;
          return (
            <button
              key={t.key}
              type="button"
              role="tab"
              aria-selected={isActive}
              onClick={() => onChange(t.key)}
              className="flex cursor-pointer items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold transition"
              style={{
                backgroundColor: isActive ? 'var(--surface)' : 'transparent',
                color: isActive ? 'var(--foreground)' : 'var(--foreground-muted)',
                boxShadow: isActive ? '0 1px 2px rgba(0,0,0,0.08)' : 'none',
              }}
            >
              {t.label}
              {t.count !== undefined && (
                <span className="rounded-full px-1.5 text-[10px]" style={{ backgroundColor: isActive ? 'var(--accent-soft)' : 'var(--surface)', color: isActive ? 'var(--accent)' : 'var(--foreground-muted)' }}>
                  {t.count}
                </span>
              )}
            </button>
          );
        })}
      </div>
    );
  }

  return (
    <div className="flex gap-1 border-b" style={{ borderColor: 'var(--border)' }} role="tablist">
      {tabs.map((t) => {
        const isActive = t.key === active;
        return (
          <button
            key={t.key}
            type="button"
            role="tab"
            aria-selected={isActive}
            onClick={() => onChange(t.key)}
            className="-mb-px flex cursor-pointer items-center gap-2 px-4 py-2.5 text-sm font-semibold transition"
            style={{
              color: isActive ? 'var(--accent)' : 'var(--foreground-muted)',
              borderBottom: `2px solid ${isActive ? 'var(--accent)' : 'transparent'}`,
            }}
          >
            {t.label}
            {t.count !== undefined && (
              <span
                className="inline-flex h-5 min-w-5 items-center justify-center rounded-full px-1.5 text-[11px] font-semibold"
                style={{ backgroundColor: isActive ? 'var(--accent-soft)' : 'var(--surface-muted)', color: isActive ? 'var(--accent)' : 'var(--foreground-muted)' }}
              >
                {t.count}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}
