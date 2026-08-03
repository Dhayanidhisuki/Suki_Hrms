"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { Check } from "lucide-react";

export type SuccessOverlayPayload = {
  title?: string;
  message: string;
  detail?: string;
  durationMs?: number;
};

type SuccessOverlayContextValue = {
  showSuccess: (payload: string | SuccessOverlayPayload) => void;
  hideSuccess: () => void;
};

const SuccessOverlayContext = createContext<SuccessOverlayContextValue | null>(null);

const DEFAULT_DURATION_MS = 2400;

function normalizePayload(payload: string | SuccessOverlayPayload): Required<
  Pick<SuccessOverlayPayload, "title" | "message" | "durationMs">
> &
  Pick<SuccessOverlayPayload, "detail"> {
  if (typeof payload === "string") {
    return {
      title: "Success",
      message: payload,
      durationMs: DEFAULT_DURATION_MS,
    };
  }
  return {
    title: payload.title?.trim() || "Success",
    message: payload.message,
    detail: payload.detail,
    durationMs: payload.durationMs ?? DEFAULT_DURATION_MS,
  };
}

export function SuccessOverlayProvider({ children }: { children: ReactNode }) {
  const [open, setOpen] = useState(false);
  const [payload, setPayload] = useState<ReturnType<typeof normalizePayload> | null>(null);
  const [leaving, setLeaving] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const leaveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const clearTimers = useCallback(() => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
    if (leaveTimerRef.current) {
      clearTimeout(leaveTimerRef.current);
      leaveTimerRef.current = null;
    }
  }, []);

  const hideSuccess = useCallback(() => {
    setLeaving(true);
    leaveTimerRef.current = setTimeout(() => {
      setOpen(false);
      setPayload(null);
      setLeaving(false);
    }, 220);
  }, []);

  const showSuccess = useCallback(
    (input: string | SuccessOverlayPayload) => {
      clearTimers();
      const next = normalizePayload(input);
      setPayload(next);
      setLeaving(false);
      setOpen(true);
      timerRef.current = setTimeout(() => {
        hideSuccess();
      }, next.durationMs);
    },
    [clearTimers, hideSuccess]
  );

  useEffect(() => () => clearTimers(), [clearTimers]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" || e.key === "Enter") hideSuccess();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, hideSuccess]);

  const value = useMemo(
    () => ({ showSuccess, hideSuccess }),
    [showSuccess, hideSuccess]
  );

  return (
    <SuccessOverlayContext.Provider value={value}>
      {children}
      {open && payload && (
        <div
          role="status"
          aria-live="polite"
          className={`success-overlay-root fixed inset-0 z-[100] flex items-center justify-center p-4 ${
            leaving ? "success-overlay-leave" : "success-overlay-enter"
          }`}
          onClick={hideSuccess}
        >
          <div className="absolute inset-0 bg-black/45 backdrop-blur-[2px]" />
          <div
            className="success-overlay-card relative w-full max-w-sm rounded-2xl border border-[var(--border-main)] bg-[var(--bg-card)] px-7 py-8 text-center shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="success-overlay-ring mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-full bg-emerald-500/15">
              <div className="success-overlay-check flex h-12 w-12 items-center justify-center rounded-full bg-emerald-500 text-white shadow-lg shadow-emerald-500/30">
                <Check className="h-7 w-7" strokeWidth={2.75} />
              </div>
            </div>
            <h3 className="text-lg font-semibold tracking-tight text-[var(--text-primary)]">
              {payload.title}
            </h3>
            <p className="mt-2 text-sm leading-relaxed text-[var(--text-secondary)]">
              {payload.message}
            </p>
            {payload.detail ? (
              <p className="mt-3 font-mono text-xs font-semibold text-emerald-600 dark:text-emerald-400">
                {payload.detail}
              </p>
            ) : null}
            <button
              type="button"
              onClick={hideSuccess}
              className="mt-6 inline-flex items-center justify-center rounded-xl bg-emerald-500 px-5 py-2 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-emerald-600"
            >
              Continue
            </button>
          </div>
        </div>
      )}
    </SuccessOverlayContext.Provider>
  );
}

export function useSuccessOverlay() {
  const ctx = useContext(SuccessOverlayContext);
  if (!ctx) {
    throw new Error("useSuccessOverlay must be used within SuccessOverlayProvider");
  }
  return ctx;
}
