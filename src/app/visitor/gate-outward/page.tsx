'use client';

import { useState } from 'react';
import GatePassList from '@/components/visitor/GatePassList';
import GNRList from '@/components/visitor/GNRList';

function ViewToggle({ value, onChange, options }: { value: string; onChange: (v: string) => void; options: { key: string; label: string }[] }) {
  return (
    <div className="card inline-flex items-center gap-1 p-1" role="tablist">
      {options.map((o) => {
        const isActive = o.key === value;
        return (
          <button
            key={o.key}
            role="tab"
            aria-selected={isActive}
            onClick={() => onChange(o.key)}
            className="whitespace-nowrap rounded-full px-3 py-1.5 text-xs font-medium transition"
            style={{ backgroundColor: isActive ? 'var(--accent)' : 'transparent', color: isActive ? '#fff' : 'var(--foreground-muted)' }}
            onMouseEnter={(e) => { if (!isActive) e.currentTarget.style.backgroundColor = 'var(--surface-hover)'; }}
            onMouseLeave={(e) => { if (!isActive) e.currentTarget.style.backgroundColor = 'transparent'; }}
          >
            {o.label}
          </button>
        );
      })}
    </div>
  );
}

export default function GateOutwardPage() {
  const [tab, setTab] = useState<'visitor' | 'material'>('visitor');
  const toggle = (
    <ViewToggle
      value={tab}
      onChange={(v) => setTab(v as 'visitor' | 'material')}
      options={[{ key: 'visitor', label: 'Visitor' }, { key: 'material', label: 'Material Outward' }]}
    />
  );

  return (
    <div className="space-y-4">
      {tab === 'visitor' ? (
        <GatePassList
          title="Gate Outward"
          subtitle="Visitors currently on premises"
          defaultStatus="CHECKED_IN"
          primaryAction="check-out"
          showAdd={false}
          headerAction={toggle}
        />
      ) : (
        <GNRList
          title="Material Outward"
          subtitle="Authorize and record material gate outward"
          defaultMovementType="MATERIAL_OUTWARD"
          primaryAction="outward"
          showAdd={false}
          headerAction={toggle}
        />
      )}
    </div>
  );
}
