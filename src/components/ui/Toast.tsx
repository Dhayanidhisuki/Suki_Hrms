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
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.75" strokeLinecap="round" strokeLinejoin="round">
        <path d="M20 6 9 17l-5-5" />
      </svg>
    ),
  },
  warning: {
    bg: 'var(--warning-soft)',
    fg: 'var(--warning)',
    icon: (
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.75" strokeLinecap="round" strokeLinejoin="round">
        <path d="M12 9v4M12 17h.01" />
        <path d="M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0Z" />
      </svg>
    ),
  },
  danger: {
    bg: 'var(--danger-soft)',
    fg: 'var(--danger)',
    icon: (
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.75" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="12" cy="12" r="10" />
        <path d="m15 9-6 6M9 9l6 6" />
      </svg>
    ),
  },
  info: {
    bg: 'var(--info-soft)',
    fg: 'var(--info)',
    icon: (
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.75" strokeLinecap="round" strokeLinejoin="round">
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
        className="pointer-events-none fixed top-4 right-4 z-[100] flex w-96 max-w-[calc(100vw-2rem)] flex-col gap-2.5"
      >
        <style>{`@keyframes toast-in { from { opacity: 0; transform: translateX(16px) scale(0.98); } to { opacity: 1; transform: translateX(0) scale(1); } }`}</style>
        {items.map((t) => {
          const tone = tones[t.tone];
          return (
            <div
              key={t.id}
              role={t.tone === 'danger' ? 'alert' : 'status'}
              className="pointer-events-auto flex items-center gap-3 rounded-2xl px-4 py-3.5 shadow-lg"
              style={{
                backgroundColor: tone.bg,
                animation: 'toast-in 0.2s ease-out',
              }}
            >
              <span
                className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full"
                style={{ backgroundColor: tone.fg }}
              >
                {tone.icon}
              </span>
              <div className="min-w-0 flex-1 text-[15px] font-semibold" style={{ color: tone.fg }}>
                {t.message}
              </div>
              <button
                type="button"
                onClick={() => dismiss(t.id)}
                aria-label="Dismiss"
                className="shrink-0 rounded-full p-1 transition hover:opacity-70"
                style={{ color: tone.fg }}
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                  <path d="M18 6 6 18M6 6l12 12" />
                </svg>
              </button>
            </div>
          );
        })}
      </div>
    </ToastContext.Provider>
  );
}
