'use client';

import { ButtonHTMLAttributes, ReactNode } from 'react';

export type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'success' | 'danger';
export type ButtonSize = 'xs' | 'sm' | 'md';

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  loading?: boolean;
  leftIcon?: ReactNode;
}

const sizeClass: Record<ButtonSize, string> = {
  xs: 'px-2.5 py-1 text-xs',
  sm: 'px-3 py-1.5 text-xs',
  md: 'px-4 py-2 text-sm',
};

function variantStyle(variant: ButtonVariant): React.CSSProperties {
  switch (variant) {
    case 'primary':
      return { backgroundColor: 'var(--accent)', color: '#fff', border: '1px solid transparent' };
    case 'success':
      return { backgroundColor: 'var(--success)', color: '#fff', border: '1px solid transparent' };
    case 'danger':
      return { backgroundColor: 'var(--danger)', color: '#fff', border: '1px solid transparent' };
    case 'ghost':
      return { backgroundColor: 'transparent', color: 'var(--foreground)', border: '1px solid transparent' };
    case 'secondary':
    default:
      return { backgroundColor: 'var(--surface)', color: 'var(--foreground)', border: '1px solid var(--border)' };
  }
}

/**
 * Consistent button. Existing pages hand-roll `rounded-lg px-4 py-2 …` with
 * inline colours; this centralises that so hover/disabled/loading states
 * look the same everywhere. Flow is untouched — it is just a styled <button>.
 */
export default function Button({ variant = 'secondary', size = 'md', loading, leftIcon, children, className = '', disabled, style, ...rest }: ButtonProps) {
  return (
    <button
      {...rest}
      disabled={disabled || loading}
      className={`inline-flex items-center justify-center gap-1.5 whitespace-nowrap rounded-lg font-medium transition hover:brightness-95 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-50 ${sizeClass[size]} ${className}`}
      style={{ ...variantStyle(variant), ...style }}
    >
      {loading ? (
        <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-current border-t-transparent" aria-hidden />
      ) : (
        leftIcon
      )}
      {children}
    </button>
  );
}
