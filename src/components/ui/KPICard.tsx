'use client';

import { useState, useEffect } from 'react';

export type KPITone = 'success' | 'warning' | 'danger' | 'info';

const toneStyles: Record<KPITone, { bg: string; fg: string; icon: string }> = {
  success: { bg: 'var(--success-soft)', fg: 'var(--success)', icon: 'var(--success)' },
  warning: { bg: 'var(--warning-soft)', fg: 'var(--warning)', icon: 'var(--warning)' },
  danger: { bg: 'var(--danger-soft)', fg: 'var(--danger)', icon: 'var(--danger)' },
  info: { bg: 'var(--info-soft)', fg: 'var(--info)', icon: 'var(--info)' },
};

interface KPICardProps {
  label: string;
  value: string | number;
  subtitle?: string;
  tone?: KPITone;
  icon?: React.ReactNode;
  animationDuration?: number; // milliseconds
}

function AnimatedCounter({ value, duration = 600 }: { value: number; duration?: number }) {
  const [displayValue, setDisplayValue] = useState(0);

  useEffect(() => {
    if (typeof value !== 'number' || value <= 0) {
      setDisplayValue(value);
      return;
    }

    let startTime: number | null = null;
    let animationFrameId: number;

    const animate = (timestamp: number) => {
      if (!startTime) startTime = timestamp;
      const elapsed = timestamp - startTime;
      const progress = Math.min(elapsed / duration, 1);

      // Easing function (easeOutQuad)
      const easeProgress = 1 - Math.pow(1 - progress, 2);
      const currentValue = Math.floor(easeProgress * value);

      setDisplayValue(currentValue);

      if (progress < 1) {
        animationFrameId = requestAnimationFrame(animate);
      }
    };

    animationFrameId = requestAnimationFrame(animate);

    return () => cancelAnimationFrame(animationFrameId);
  }, [value, duration]);

  return <span>{displayValue.toLocaleString()}</span>;
}

export default function KPICard({ label, value, subtitle, tone = 'info', icon, animationDuration = 600 }: KPICardProps) {
  const style = toneStyles[tone];
  const isNumeric = typeof value === 'number';

  return (
    <div
      className="rounded-lg border p-4 flex flex-col gap-3 transition-all duration-300 hover:shadow-lg"
      style={{ backgroundColor: 'var(--surface)', borderColor: 'var(--border)' }}
    >
      <div className="flex items-start justify-between">
        <div className="flex-1">
          <p className="text-xs font-medium" style={{ color: 'var(--foreground-muted)' }}>
            {label}
          </p>
          <p className="mt-1 text-2xl font-bold" style={{ color: 'var(--foreground)' }}>
            {isNumeric ? <AnimatedCounter value={value} duration={animationDuration} /> : value}
          </p>
          {subtitle && (
            <p className="mt-1 text-xs" style={{ color: 'var(--foreground-muted)' }}>
              {subtitle}
            </p>
          )}
        </div>
        {icon && (
          <div
            className="h-10 w-10 rounded-lg flex items-center justify-center shrink-0 transition-transform duration-300"
            style={{ backgroundColor: style.bg, color: style.icon }}
          >
            {icon}
          </div>
        )}
      </div>
    </div>
  );
}
