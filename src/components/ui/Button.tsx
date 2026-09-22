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
  xs: 'px-2.5 py-1 text-xs rounded-lg gap-1.5',
  sm: 'px-3 py-1.5 text-xs rounded-lg gap-1.5',
  md: 'px-4 py-2.5 text-sm rounded-xl gap-2',
};

/** Tailwind classes per variant — hover/active states the design system uses. */
const variantClass: Record<ButtonVariant, string> = {
  primary: 'shadow-sm hover:shadow-md hover:bg-[var(--primary-hover)] active:opacity-90',
  success: 'shadow-sm hover:shadow-md hover:opacity-90',
  danger: 'shadow-sm hover:shadow-md hover:opacity-90',
  ghost: 'hover:bg-[var(--bg-hover)]',
  secondary: 'hover:bg-[var(--bg-hover)]',
};

function variantStyle(variant: ButtonVariant): React.CSSProperties {
  switch (variant) {
    case 'primary':
      return { backgroundColor: 'var(--primary)', color: 'var(--primary-foreground, #fff)', border: '1px solid transparent' };
    case 'success':
      return { backgroundColor: 'var(--color-success)', color: '#fff', border: '1px solid transparent' };
    case 'danger':
      return { backgroundColor: 'var(--color-danger)', color: '#fff', border: '1px solid transparent' };
    case 'ghost':
      return { backgroundColor: 'transparent', color: 'var(--text-secondary)', border: '1px solid transparent' };
    case 'secondary':
    default:
      return { backgroundColor: 'var(--bg-subtle)', color: 'var(--text-primary)', border: '1px solid var(--border-main)' };
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
      className={`inline-flex cursor-pointer items-center justify-center whitespace-nowrap font-semibold transition-all duration-150 disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-50 ${sizeClass[size]} ${variantClass[variant]} ${className}`}
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
