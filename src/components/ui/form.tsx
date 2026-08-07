"use client";

import {
  useEffect,
  useRef,
  useState,
  type InputHTMLAttributes,
  type ReactNode,
  type SelectHTMLAttributes,
  type TextareaHTMLAttributes,
} from "react";

/** Shared class tokens — modal-style 2-col forms (labels above, white inputs) */
export const formLabelClass =
  "form-label block text-[13px] font-semibold text-[var(--text-primary)] mb-1.5 leading-tight";

export const formControlClass =
  "form-control w-full h-10 text-sm border border-[var(--border-main)] rounded-lg px-3 bg-[var(--bg-card)] text-[var(--text-primary)] outline-none shadow-[inset_0_1px_2px_rgba(15,23,42,0.04)] transition-[border-color,box-shadow] placeholder:text-[var(--text-muted)] focus:border-[var(--primary)] focus:ring-2 focus:ring-[var(--ring-color)] disabled:bg-[var(--bg-subtle)] disabled:text-[var(--text-muted)] disabled:cursor-not-allowed";

export const formSelectClass = `${formControlClass} font-medium appearance-none bg-[length:12px] bg-[right_0.75rem_center] bg-no-repeat pr-9`;

export const formTextareaClass =
  "form-control w-full min-h-[88px] text-sm border border-[var(--border-main)] rounded-lg px-3 py-2.5 bg-[var(--bg-card)] text-[var(--text-primary)] outline-none shadow-[inset_0_1px_2px_rgba(15,23,42,0.04)] transition-[border-color,box-shadow] placeholder:text-[var(--text-muted)] focus:border-[var(--primary)] focus:ring-2 focus:ring-[var(--ring-color)] disabled:bg-[var(--bg-subtle)] disabled:text-[var(--text-muted)]";

export const formHintClass = "form-hint mt-1.5 text-[11px] text-[var(--text-muted)] leading-snug";

export const formErrorClass = "form-error mt-1.5 text-[11px] font-semibold text-[var(--color-danger-text)] leading-snug";

export const formGridClass = "form-grid grid grid-cols-1 md:grid-cols-2 gap-x-5 gap-y-4";

export const formCardClass =
  "form-card bg-[var(--bg-card)] rounded-2xl border border-[var(--border-main)] p-5 sm:p-6";

export const formSectionTitleClass =
  "form-section-title text-[15px] font-semibold text-[var(--text-secondary)]";

/** Modal section headings (Tool details, Stock & flags, …) — stronger visual weight */
export const formModalSectionTitleClass =
  "form-section-title form-modal-section-title";

function cx(...parts: Array<string | false | null | undefined>) {
  return parts.filter(Boolean).join(" ");
}

export function FormCard({
  children,
  className,
  title,
  action,
}: {
  children: ReactNode;
  className?: string;
  title?: string;
  action?: ReactNode;
}) {
  return (
    <div className={cx(formCardClass, className)}>
      {(title || action) && (
        <div className="flex items-center justify-between gap-3 mb-5">
          {title ? <h3 className="text-base font-semibold text-[var(--text-primary)]">{title}</h3> : <span />}
          {action}
        </div>
      )}
      {children}
    </div>
  );
}

export function FormSection({
  title,
  children,
  className,
}: {
  title?: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section className={cx("space-y-4", className)}>
      {title ? <h4 className={formSectionTitleClass}>{title}</h4> : null}
      {children}
    </section>
  );
}

/**
 * Modal form block: section title + optional right action + hairline,
 * then a 2-column field grid (matches Add Participants–style overlays).
 * Set `collapsible` for ▼/▲ toggle; `sticky` keeps the heading pinned in the scroll area.
 */
export function FormModalSection({
  title,
  action,
  children,
  className,
  id,
  collapsible = false,
  defaultOpen = true,
  open: openProp,
  onOpenChange,
  sticky = false,
}: {
  title: string;
  action?: ReactNode;
  children: ReactNode;
  className?: string;
  id?: string;
  collapsible?: boolean;
  defaultOpen?: boolean;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  /** Pin section heading while this section is in the scroll viewport */
  sticky?: boolean;
}) {
  const [uncontrolledOpen, setUncontrolledOpen] = useState(defaultOpen);
  const open = openProp ?? uncontrolledOpen;
  const setOpen = (next: boolean) => {
    if (openProp === undefined) setUncontrolledOpen(next);
    onOpenChange?.(next);
  };

  const head = (
    <div
      className={cx(
        "form-modal-section-head",
        sticky && "form-modal-section-head--sticky",
        collapsible && "form-modal-section-head--collapsible",
        collapsible && !open && "form-modal-section-head--collapsed"
      )}
    >
      {collapsible ? (
        <button
          type="button"
          className="form-modal-section-toggle"
          aria-expanded={open}
          onClick={() => setOpen(!open)}
        >
          <h3 className={formModalSectionTitleClass}>{title}</h3>
          <span className="form-modal-section-chevron" aria-hidden="true">
            {open ? "▲" : "▼"}
          </span>
        </button>
      ) : (
        <h3 className={formModalSectionTitleClass}>{title}</h3>
      )}
      {action ? <div className="form-modal-section-action shrink-0">{action}</div> : null}
    </div>
  );

  return (
    <section
      id={id}
      className={cx(
        "form-modal-section py-2 space-y-4",
        collapsible && !open && "form-modal-section--collapsed",
        className
      )}
    >
      {head}
      {(!collapsible || open) ? <div className="space-y-5">{children}</div> : null}
    </section>
  );
}

/** Neat 2-column field grid (stacks to 1 col on mobile). */
export function FormGrid({
  children,
  className,
  cols = 2,
}: {
  children: ReactNode;
  className?: string;
  cols?: 1 | 2 | 3 | 4;
}) {
  const colCls =
    cols === 1
      ? "grid-cols-1"
      : cols === 3
        ? "grid-cols-1 md:grid-cols-3"
        : cols === 4
          ? "grid-cols-1 sm:grid-cols-2 lg:grid-cols-4"
          : "grid-cols-1 md:grid-cols-2";
  return <div className={cx("grid gap-x-6 gap-y-5", colCls, className)}>{children}</div>;
}

export function FormField({
  label,
  htmlFor,
  required,
  hint,
  error,
  children,
  className,
  fullWidth,
}: {
  label?: ReactNode;
  htmlFor?: string;
  required?: boolean;
  hint?: ReactNode;
  error?: ReactNode;
  children: ReactNode;
  className?: string;
  /** Span both columns in a 2-col FormGrid */
  fullWidth?: boolean;
}) {
  return (
    <div className={cx("min-w-0", fullWidth && "md:col-span-2", className)}>
      {label != null && label !== "" ? (
        <label htmlFor={htmlFor} className={formLabelClass}>
          {label}
          {required ? <span className="text-[var(--color-danger-text)] ml-0.5">*</span> : null}
        </label>
      ) : null}
      {children}
      {error ? <p className={formErrorClass}>{error}</p> : null}
      {!error && hint ? <p className={formHintClass}>{hint}</p> : null}
    </div>
  );
}

export function FormLabel({
  children,
  htmlFor,
  required,
  className,
}: {
  children: ReactNode;
  htmlFor?: string;
  required?: boolean;
  className?: string;
}) {
  return (
    <label htmlFor={htmlFor} className={cx(formLabelClass, className)}>
      {children}
      {required ? <span className="text-[var(--color-danger-text)] ml-0.5">*</span> : null}
    </label>
  );
}

export function FormInput({ className, type, ...props }: InputHTMLAttributes<HTMLInputElement>) {
  // Hide browser stepper arrows — they fight controlled values (leading zeros / mid-edit "0").
  const numberCls =
    type === "number"
      ? "[appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
      : undefined;
  return <input type={type} {...props} className={cx(formControlClass, numberCls, className)} />;
}

type FormNumberInputProps = Omit<
  InputHTMLAttributes<HTMLInputElement>,
  "type" | "value" | "onChange" | "inputMode"
> & {
  value: number;
  onValueChange: (value: number) => void;
  /** Prefer whole numbers (qty, months). Default allows decimals. */
  integer?: boolean;
};

/**
 * Text-mode numeric field: no spinner, select-all on focus, draft while typing
 * so leading zeros / clearing "0" are not immediately coerced.
 */
export function FormNumberInput({
  value,
  onValueChange,
  integer,
  min,
  max,
  className,
  onFocus,
  onBlur,
  ...props
}: FormNumberInputProps) {
  const focused = useRef(false);
  const [text, setText] = useState(() => String(value ?? 0));

  useEffect(() => {
    if (!focused.current) setText(String(value ?? 0));
  }, [value]);

  const clamp = (n: number) => {
    let out = n;
    if (min != null && min !== "" && !Number.isNaN(Number(min))) out = Math.max(Number(min), out);
    if (max != null && max !== "" && !Number.isNaN(Number(max))) out = Math.min(Number(max), out);
    return integer ? Math.trunc(out) : out;
  };

  const commit = (raw: string) => {
    if (raw.trim() === "" || raw === "-" || raw === "." || raw === "-.") {
      const fallback = min != null && min !== "" ? Number(min) : 0;
      const n = clamp(Number.isFinite(fallback) ? fallback : 0);
      setText(String(n));
      onValueChange(n);
      return;
    }
    const n = Number(raw);
    if (Number.isNaN(n)) {
      setText(String(value ?? 0));
      return;
    }
    const next = clamp(n);
    setText(String(next));
    onValueChange(next);
  };

  return (
    <input
      {...props}
      type="text"
      inputMode={integer ? "numeric" : "decimal"}
      min={min}
      max={max}
      value={text}
      className={cx(formControlClass, "font-mono", className)}
      onFocus={(e) => {
        focused.current = true;
        e.target.select();
        onFocus?.(e);
      }}
      onBlur={(e) => {
        focused.current = false;
        commit(e.target.value);
        onBlur?.(e);
      }}
      onChange={(e) => {
        const raw = e.target.value;
        const ok = integer ? /^-?\d*$/.test(raw) : /^-?\d*\.?\d*$/.test(raw);
        if (!ok) return;
        setText(raw);
        if (raw === "" || raw === "-" || raw === "." || raw === "-.") return;
        const n = Number(raw);
        if (!Number.isNaN(n)) onValueChange(clamp(n));
      }}
    />
  );
}

export function FormSelect({ className, children, ...props }: SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select
      {...props}
      className={cx(formSelectClass, className)}
      style={{
        backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='%2364748b' stroke-width='2.5' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpath d='m6 9 6 6 6-6'/%3E%3C/svg%3E")`,
        ...props.style,
      }}
    >
      {children}
    </select>
  );
}

export function FormTextarea({ className, ...props }: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea {...props} className={cx(formTextareaClass, className)} />;
}
