"use client";

import { useEffect, useId, useRef, useState } from "react";
import { Check, ChevronDown } from "lucide-react";

export type SelectionFilterOption<T extends string = string> = {
  value: T;
  label: string;
};

export type SelectionFilterProps<T extends string = string> = {
  /** Left label shown as `Label: value` on the trigger */
  label: string;
  value: T;
  options: SelectionFilterOption<T>[];
  onChange: (value: T) => void;
  /**
   * Value that means “no filter” (e.g. All / Any).
   * When selected, trigger uses muted border; otherwise primary accent.
   */
  anyValue?: T;
  /** Display text when value === anyValue (default “Any”) */
  anyLabel?: string;
  /** Max width of the value portion before ellipsis */
  maxValueWidth?: string;
  id?: string;
  className?: string;
  disabled?: boolean;
  align?: "left" | "right";
  size?: "sm" | "md";
};

/**
 * Stripe/Shopify-style selection filter: trigger shows `Label: Value`,
 * accent border when a non-default value is selected, checkmark in the menu.
 */
export function SelectionFilter<T extends string = string>({
  label,
  value,
  options,
  onChange,
  anyValue,
  anyLabel = "Any",
  maxValueWidth = "5.5rem",
  id,
  className = "",
  disabled = false,
  align = "left",
  size = "sm",
}: SelectionFilterProps<T>) {
  const autoId = useId();
  const rootId = id ?? autoId;
  const rootRef = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const compact = size === "sm";

  const defaultValue = (anyValue ?? options[0]?.value) as T | undefined;
  const isDefault = defaultValue !== undefined && value === defaultValue;
  const selected = options.find((o) => o.value === value);
  const displayValue =
    isDefault && anyLabel
      ? anyLabel
      : selected?.label ?? String(value);

  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onDoc);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDoc);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <div ref={rootRef} className={`relative inline-flex shrink-0 ${open ? "z-50" : "z-10"} ${className}`}>
      <button
        type="button"
        id={rootId}
        disabled={disabled}
        aria-haspopup="listbox"
        aria-expanded={open}
        onClick={() => !disabled && setOpen((v) => !v)}
        className={`inline-flex items-center max-w-full rounded-md border bg-[var(--bg-card)] transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed ${
          compact ? "h-7 gap-1 px-2 text-[11px]" : "h-9 gap-1.5 px-3 text-sm rounded-lg"
        } ${
          open || !isDefault
            ? "border-[var(--primary)] text-[var(--text-primary)]"
            : "border-[var(--border-main)] text-[var(--text-primary)] hover:bg-[var(--bg-hover)]"
        }`}
      >
        <span className="text-[var(--text-secondary)] font-medium shrink-0">{label}:</span>
        <span
          className={`font-medium truncate ${
            isDefault ? "text-[var(--text-primary)]" : "text-[var(--primary)]"
          }`}
          style={{ maxWidth: maxValueWidth }}
          title={displayValue}
        >
          {displayValue}
        </span>
        <ChevronDown
          className={`shrink-0 ${compact ? "w-3 h-3" : "w-3.5 h-3.5"} ${
            open || !isDefault ? "text-[var(--primary)]" : "text-[var(--text-muted)]"
          }`}
        />
      </button>

      {open && (
        <div
          role="listbox"
          aria-labelledby={rootId}
          className={`absolute z-50 top-[calc(100%+4px)] min-w-[11rem] w-max max-w-[16rem] rounded-md border border-[var(--border-main)] bg-[var(--bg-card)] shadow-lg py-0.5 animate-fade-in ${
            align === "right" ? "right-0" : "left-0"
          }`}
        >
          {options.map((opt) => {
            const active = opt.value === value;
            const showLabel =
              defaultValue !== undefined && opt.value === defaultValue && anyLabel
                ? anyLabel
                : opt.label;
            return (
              <button
                key={opt.value}
                type="button"
                role="option"
                aria-selected={active}
                onClick={() => {
                  onChange(opt.value);
                  setOpen(false);
                }}
                className={`w-full flex items-center justify-between gap-2 px-2.5 py-1.5 text-[11px] text-left transition-colors cursor-pointer ${
                  active
                    ? "text-[var(--primary)] font-medium bg-[var(--primary-light)]/40"
                    : "text-[var(--text-primary)] hover:bg-[var(--bg-hover)]"
                }`}
              >
                <span className="truncate">{showLabel}</span>
                {active ? <Check className="w-3.5 h-3.5 shrink-0 text-[var(--primary)]" strokeWidth={2.5} /> : null}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
