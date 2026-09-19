'use client';

import { createContext, useCallback, useContext, useMemo, useRef, useState, ReactNode } from 'react';

export type ToastTone = 'success' | 'warning' | 'danger' | 'info';

interface ToastItem {
  id: number;
  tone: ToastTone;
  message: string;
}

export interface ToastApi {
  success: (message: string) => void;
  error: (message: string) => void;
  warning: (message: string) => void;
  info: (message: string) => void;
}

const ToastContext = createContext<ToastApi | null>(null);

const DEFAULT_DURATION = 4500;
const ERROR_DURATION = 6000;

const tones: Record<ToastTone, { bg: string; fg: string; icon: ReactNode }> = {
  success: {
    bg: 'var(--success-soft)',
    fg: 'var(--success)',
    icon: (
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
        <path d="M20 6 9 17l-5-5" />
      </svg>
    ),
  },
  warning: {
    bg: 'var(--warning-soft)',
    fg: 'var(--warning)',
    icon: (
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
        <path d="M12 9v4M12 17h.01" />
        <path d="M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0Z" />
      </svg>
    ),
  },
  danger: {
    bg: 'var(--danger-soft)',
    fg: 'var(--danger)',
    icon: (
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="12" cy="12" r="10" />
        <path d="m15 9-6 6M9 9l6 6" />
      </svg>
    ),
  },
  info: {
    bg: 'var(--info-soft)',
    fg: 'var(--info)',
    icon: (
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="12" cy="12" r="10" />
        <path d="M12 16v-4M12 8h.01" />
      </svg>
    ),
  },
};

/** Toast API for the nearest ToastProvider. Throws if used outside one. */
export function useToast(): ToastApi {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error('useToast must be used within a ToastProvider');
  return ctx;
}

interface ToastProviderProps {
  children: ReactNode;
}

/** Theme-aware toast stack (top-right). Wrap a subtree to give it useToast(). */
export default function ToastProvider({ children }: ToastProviderProps) {
  const [items, setItems] = useState<ToastItem[]>([]);
  const nextId = useRef(0);

  const dismiss = useCallback((id: number) => {
    setItems((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const push = useCallback(
    (tone: ToastTone, message: string) => {
      const id = ++nextId.current;
      setItems((prev) => [...prev, { id, tone, message }]);
      const duration = tone === 'danger' ? ERROR_DURATION : DEFAULT_DURATION;
      setTimeout(() => dismiss(id), duration);
    },
    [dismiss],
  );

  const api = useMemo<ToastApi>(
    () => ({
      success: (m) => push('success', m),
      error: (m) => push('danger', m),
      warning: (m) => push('warning', m),
      info: (m) => push('info', m),
    }),
    [push],
  );

  return (
    <ToastContext.Provider value={api}>
      {children}
      <div
        aria-live="polite"
        className="pointer-events-none fixed top-4 right-4 z-[100] flex w-80 max-w-[calc(100vw-2rem)] flex-col gap-2"
      >
        <style>{`@keyframes toast-in { from { opacity: 0; transform: translateX(16px); } to { opacity: 1; transform: translateX(0); } }`}</style>
        {items.map((t) => {
          const tone = tones[t.tone];
          return (
            <div
              key={t.id}
              role={t.tone === 'danger' ? 'alert' : 'status'}
              className="pointer-events-auto flex items-start gap-2.5 rounded-lg px-3 py-2.5 text-sm shadow-lg"
              style={{
                backgroundColor: 'var(--surface)',
                color: 'var(--foreground)',
                border: `1px solid ${tone.fg}55`,
                borderLeft: `4px solid ${tone.fg}`,
                animation: 'toast-in 0.18s ease-out',
              }}
            >
              <span className="mt-0.5 shrink-0" style={{ color: tone.fg }}>
                {tone.icon}
              </span>
              <div className="min-w-0 flex-1">{t.message}</div>
              <button
                type="button"
                onClick={() => dismiss(t.id)}
                aria-label="Dismiss"
                className="shrink-0 rounded px-1 text-xs font-medium opacity-70 transition hover:opacity-100"
                style={{ color: tone.fg }}
              >
                ✕
              </button>
            </div>
          );
        })}
      </div>
    </ToastContext.Provider>
  );
}
