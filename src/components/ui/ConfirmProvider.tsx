"use client";

/**
 * App-wide replacement for window.confirm / window.prompt.
 *
 * The native dialogs are unstyled, sit outside the theme, block the whole
 * browser tab, and on some platforms can be suppressed entirely — so a
 * destructive action could silently proceed or silently fail. This renders the
 * same question as a themed overlay.
 *
 * The API stays promise-based on purpose: a call site keeps its shape,
 *
 *     if (!(await confirm({ message: 'Delete this?' }))) return;
 *
 * rather than being rewritten into open/closed state plus a deferred handler.
 */

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
import { AlertTriangle, HelpCircle } from "lucide-react";

export interface ConfirmOptions {
  title?: string;
  message: ReactNode;
  confirmLabel?: string;
  cancelLabel?: string;
  /** `danger` for destructive actions — red button, warning icon. */
  tone?: "primary" | "danger";
}

export interface PromptOptions {
  title?: string;
  message: ReactNode;
  placeholder?: string;
  defaultValue?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  /** Block confirming until something is typed. */
  required?: boolean;
  multiline?: boolean;
}

interface ConfirmApi {
  confirm: (options: ConfirmOptions) => Promise<boolean>;
  prompt: (options: PromptOptions) => Promise<string | null>;
}

const Ctx = createContext<ConfirmApi | null>(null);

type Pending =
  | { kind: "confirm"; options: ConfirmOptions; resolve: (v: boolean) => void }
  | { kind: "prompt"; options: PromptOptions; resolve: (v: string | null) => void };

export function ConfirmProvider({ children }: { children: ReactNode }) {
  const [pending, setPending] = useState<Pending | null>(null);
  const [value, setValue] = useState("");
  const inputRef = useRef<HTMLInputElement | HTMLTextAreaElement | null>(null);

  const confirm = useCallback(
    (options: ConfirmOptions) =>
      new Promise<boolean>((resolve) => {
        setPending({ kind: "confirm", options, resolve });
      }),
    []
  );

  const prompt = useCallback(
    (options: PromptOptions) =>
      new Promise<string | null>((resolve) => {
        setValue(options.defaultValue ?? "");
        setPending({ kind: "prompt", options, resolve });
      }),
    []
  );

  const close = useCallback(
    (result: boolean | string | null) => {
      if (!pending) return;
      if (pending.kind === "confirm") pending.resolve(result === true);
      else pending.resolve(typeof result === "string" ? result : null);
      setPending(null);
      setValue("");
    },
    [pending]
  );

  // Esc cancels, Enter confirms — the same reflexes the native dialog had.
  useEffect(() => {
    if (!pending) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        close(pending.kind === "confirm" ? false : null);
      }
      if (e.key === "Enter" && !(e.target instanceof HTMLTextAreaElement)) {
        e.preventDefault();
        if (pending.kind === "confirm") close(true);
        else if (!(pending.options.required && !value.trim())) close(value);
      }
    };
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", onKey);
    const focusTimer = setTimeout(() => inputRef.current?.focus(), 30);
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = prevOverflow;
      clearTimeout(focusTimer);
    };
  }, [pending, value, close]);

  const api = useMemo(() => ({ confirm, prompt }), [confirm, prompt]);

  const isPrompt = pending?.kind === "prompt";
  const options = pending?.options;
  const tone = pending?.kind === "confirm" ? pending.options.tone ?? "primary" : "primary";
  const danger = tone === "danger";
  const blocked = Boolean(isPrompt && (options as PromptOptions)?.required && !value.trim());

  return (
    <Ctx.Provider value={api}>
      {children}

      {pending && options && (
        <div
          className="fixed inset-0 z-[10000] flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm"
          role="presentation"
        >
          <button
            type="button"
            aria-label="Dismiss"
            className="absolute inset-0 cursor-default"
            onClick={() => close(pending.kind === "confirm" ? false : null)}
          />

          <div
            role="alertdialog"
            aria-modal="true"
            aria-labelledby="confirm-dialog-title"
            className="animate-fade-in relative w-full max-w-md overflow-hidden rounded-2xl border border-[var(--border-main)] bg-[var(--bg-card)] shadow-2xl"
          >
            <div className="flex items-start gap-3.5 px-6 pt-6">
              <span
                className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full"
                style={{
                  backgroundColor: danger ? 'var(--color-danger-bg)' : 'var(--primary-light)',
                  color: danger ? 'var(--color-danger)' : 'var(--primary)',
                }}
              >
                {danger ? <AlertTriangle className="h-5 w-5" /> : <HelpCircle className="h-5 w-5" />}
              </span>
              <div className="min-w-0 flex-1">
                <h2
                  id="confirm-dialog-title"
                  className="text-base font-bold text-[var(--text-primary)]"
                >
                  {options.title ?? (isPrompt ? 'Enter a value' : 'Are you sure?')}
                </h2>
                <div className="mt-1.5 text-sm leading-relaxed text-[var(--text-secondary)]">
                  {options.message}
                </div>
              </div>
            </div>

            {isPrompt && (
              <div className="px-6 pt-4">
                {(options as PromptOptions).multiline ? (
                  <textarea
                    ref={(el) => { inputRef.current = el; }}
                    value={value}
                    onChange={(e) => setValue(e.target.value)}
                    placeholder={(options as PromptOptions).placeholder}
                    className="form-control"
                    rows={3}
                  />
                ) : (
                  <input
                    ref={(el) => { inputRef.current = el; }}
                    type="text"
                    value={value}
                    onChange={(e) => setValue(e.target.value)}
                    placeholder={(options as PromptOptions).placeholder}
                    className="form-control"
                  />
                )}
              </div>
            )}

            <div className="mt-6 flex items-center justify-end gap-3 border-t border-[var(--border-main)] bg-[var(--bg-subtle)]/60 px-6 py-4">
              <button
                type="button"
                onClick={() => close(pending.kind === 'confirm' ? false : null)}
                className="form-btn-cancel cursor-pointer"
              >
                {options.cancelLabel ?? 'Cancel'}
              </button>
              <button
                type="button"
                disabled={blocked}
                onClick={() => close(isPrompt ? value : true)}
                className="inline-flex min-h-10 cursor-pointer items-center justify-center rounded-xl px-5 py-2 text-sm font-semibold text-white shadow-sm transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
                style={{ backgroundColor: danger ? 'var(--color-danger)' : 'var(--primary)' }}
              >
                {options.confirmLabel ?? (danger ? 'Delete' : 'Confirm')}
              </button>
            </div>
          </div>
        </div>
      )}
    </Ctx.Provider>
  );
}

export function useConfirm(): ConfirmApi {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error('useConfirm must be used within a ConfirmProvider');
  return ctx;
}
