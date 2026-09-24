'use client';

import { ChevronDown } from 'lucide-react';
import type { CSSProperties } from 'react';

export interface InlineSelectOption<T extends string = string> {
  value: T;
  label: string;
  /** Optional per-option hint shown as the control's title when it is selected. */
  title?: string;
}

export interface InlineSelectProps<T extends string = string> {
  value: T;
  options: readonly InlineSelectOption<T>[];
  onChange: (value: T) => void;
  /** 'sm' suits table cells; 'md' suits toolbars and filter bars. */
  size?: 'sm' | 'md';
  disabled?: boolean;
  /** Accent colour for the pill — pass a CSS colour to tint a meaningful value. */
  tone?: string;
  /** Dims the control without disabling it (e.g. a value that is not in play). */
  muted?: boolean;
  placeholder?: string;
  /** Stretch to the container's width instead of sizing to the widest option. */
  fullWidth?: boolean;
  ariaLabel?: string;
  title?: string;
  className?: string;
}

/**
 * A native <select> wearing the app's own chrome instead of the OS stepper pill.
 * The element keeps its native dropdown (and its keyboard behaviour); only the
 * closed state is restyled, so this stays a drop-in for a plain <select>.
 */
export default function InlineSelect<T extends string = string>({
  value,
  options,
  onChange,
  size = 'sm',
  disabled = false,
  tone,
  muted = false,
  placeholder,
  fullWidth = false,
  ariaLabel,
  title,
  className = '',
}: InlineSelectProps<T>) {
  const selected = options.find((o) => o.value === value);
  const sm = size === 'sm';

  const wrapStyle: CSSProperties = {
    borderColor: tone ?? 'var(--border)',
    backgroundColor: tone ? `color-mix(in srgb, ${tone} 12%, var(--surface))` : 'var(--surface)',
    color: tone ?? 'var(--foreground)',
    opacity: disabled || muted ? 0.45 : 1,
  };

  return (
    <label
      className={`relative ${fullWidth ? 'flex w-full' : 'inline-flex'} items-center rounded-lg border transition focus-within:ring-2 ${
        disabled ? 'cursor-not-allowed' : 'cursor-pointer hover:brightness-[0.97]'
      } ${sm ? 'text-xs' : 'text-sm'} ${className}`}
      style={wrapStyle}
      title={title ?? selected?.title}
    >
      <select
        value={value}
        disabled={disabled}
        aria-label={ariaLabel}
        onChange={(e) => onChange(e.target.value as T)}
        className={`${fullWidth ? 'w-full' : ''} min-w-0 select-bare appearance-none bg-transparent font-medium focus:outline-none ${
          disabled ? 'cursor-not-allowed' : 'cursor-pointer'
        } ${sm ? 'py-1 pl-2 pr-6' : 'py-2 pl-3 pr-7'}`}
        style={{ color: 'inherit' }}
      >
        {placeholder && <option value="">{placeholder}</option>}
        {options.map((o) => (
          <option key={o.value} value={o.value} style={{ color: 'var(--foreground)' }}>
            {o.label}
          </option>
        ))}
      </select>
      <ChevronDown
        aria-hidden="true"
        className={`pointer-events-none absolute opacity-60 ${sm ? 'right-1.5 h-3 w-3' : 'right-2 h-4 w-4'}`}
      />
    </label>
  );
}
