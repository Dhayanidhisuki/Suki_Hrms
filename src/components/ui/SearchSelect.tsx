"use client";

import {
  useEffect,
  useId,
  useRef,
  useState,
  type KeyboardEvent,
  type ReactNode,
} from "react";
import { ChevronDown, Search, X } from "lucide-react";

export type SearchSelectItem = {
  id: string;
  primary: string;
  secondary?: string;
  right?: ReactNode;
  disabled?: boolean;
};

export type SearchSelectProps = {
  label?: string;
  placeholder?: string;
  /** Controlled search text */
  query: string;
  onQueryChange: (value: string) => void;
  items: SearchSelectItem[];
  onSelect: (item: SearchSelectItem) => void;
  /** When set, shows a selected chip with Change instead of the search field */
  selected?: { primary: string; secondary?: string } | null;
  onClear?: () => void;
  loading?: boolean;
  error?: string;
  emptyText?: string;
  disabled?: boolean;
  /** Hide results until query length reaches this (default 0 = show on open) */
  minQueryLength?: number;
  id?: string;
  className?: string;
};

/**
 * Searchable combobox: label above, type-ahead input, chevron to open,
 * click-to-select results. Matches the Tool ↔ Supplier mapping picker UX.
 */
export function SearchSelect({
  label,
  placeholder = "Search…",
  query,
  onQueryChange,
  items,
  onSelect,
  selected = null,
  onClear,
  loading = false,
  error,
  emptyText = "No matches found",
  disabled = false,
  minQueryLength = 0,
  id,
  className = "",
}: SearchSelectProps) {
  const autoId = useId();
  const inputId = id ?? autoId;
  const rootRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const [open, setOpen] = useState(false);
  const [activeIdx, setActiveIdx] = useState(0);

  const canShowList = open && !disabled && !selected && query.trim().length >= minQueryLength;
  const visible = canShowList;

  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [open]);

  useEffect(() => {
    setActiveIdx(0);
  }, [query, items.length, open]);

  const enabledItems = items.filter((i) => !i.disabled);

  const pick = (item: SearchSelectItem) => {
    if (item.disabled) return;
    onSelect(item);
    setOpen(false);
  };

  const onKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (!visible || items.length === 0) {
      if (e.key === "ArrowDown" || e.key === "Enter") setOpen(true);
      return;
    }
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActiveIdx((i) => Math.min(i + 1, Math.max(0, enabledItems.length - 1)));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActiveIdx((i) => Math.max(i - 1, 0));
    } else if (e.key === "Enter") {
      e.preventDefault();
      const item = enabledItems[activeIdx];
      if (item) pick(item);
    } else if (e.key === "Escape") {
      setOpen(false);
    }
  };

  return (
    <div ref={rootRef} className={`min-w-0 ${className}`}>
      {label ? (
        <label htmlFor={inputId} className="form-label">
          {label}
        </label>
      ) : null}

      {selected ? (
        <div className="flex items-center justify-between gap-2 rounded-lg border border-[var(--border-main)] px-3 py-2 bg-[var(--bg-card)] shadow-[inset_0_1px_2px_rgba(15,23,42,0.04)]">
          <div className="min-w-0">
            <p className="font-mono text-sm font-semibold text-[var(--text-primary)] truncate">
              {selected.primary}
            </p>
            {selected.secondary ? (
              <p className="text-xs text-[var(--text-muted)] truncate">{selected.secondary}</p>
            ) : null}
          </div>
          {onClear && !disabled ? (
            <button
              type="button"
              className="text-xs font-semibold text-[var(--primary)] shrink-0 hover:underline"
              onClick={() => {
                onClear();
                setOpen(true);
                requestAnimationFrame(() => inputRef.current?.focus());
              }}
            >
              Change
            </button>
          ) : null}
        </div>
      ) : (
        <div className="relative">
          <Search className="w-4 h-4 text-[var(--text-muted)] absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
          <input
            ref={inputRef}
            id={inputId}
            type="text"
            disabled={disabled}
            value={query}
            onChange={(e) => {
              onQueryChange(e.target.value);
              setOpen(true);
            }}
            onFocus={() => setOpen(true)}
            onKeyDown={onKeyDown}
            placeholder={placeholder}
            autoComplete="off"
            className="form-control form-control-icon form-control-icon-end"
            aria-expanded={visible}
            aria-controls={`${inputId}-listbox`}
            aria-autocomplete="list"
            role="combobox"
          />
          <div className="absolute right-1.5 top-1/2 -translate-y-1/2 flex items-center gap-0.5">
            {query ? (
              <button
                type="button"
                tabIndex={-1}
                disabled={disabled}
                className="p-1.5 rounded-md text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-hover)]"
                onClick={() => {
                  onQueryChange("");
                  inputRef.current?.focus();
                  setOpen(true);
                }}
                aria-label="Clear search"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            ) : null}
            <button
              type="button"
              tabIndex={-1}
              disabled={disabled}
              className="p-1.5 rounded-md text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-hover)]"
              onClick={() => {
                setOpen((o) => !o);
                inputRef.current?.focus();
              }}
              aria-label={open ? "Close options" : "Open options"}
            >
              <ChevronDown
                className={`w-4 h-4 transition-transform ${open ? "rotate-180" : ""}`}
              />
            </button>
          </div>

          {visible && (
            <div
              id={`${inputId}-listbox`}
              role="listbox"
              className="absolute z-20 w-full mt-1 max-h-52 overflow-auto rounded-xl border border-[var(--border-main)] bg-[var(--bg-surface)] shadow-lg divide-y divide-[var(--border-main)]"
            >
              {loading ? (
                <p className="px-3 py-3 text-xs text-[var(--text-muted)]">Searching…</p>
              ) : items.length === 0 ? (
                <p className="px-3 py-3 text-xs text-[var(--text-muted)] text-center">{emptyText}</p>
              ) : (
                items.map((item) => {
                  const enabledIndex = enabledItems.findIndex((e) => e.id === item.id);
                  const isActive = !item.disabled && enabledIndex === activeIdx;
                  return (
                    <button
                      key={item.id}
                      type="button"
                      role="option"
                      aria-selected={isActive}
                      disabled={item.disabled}
                      className={`w-full text-left px-3 py-2.5 text-sm flex items-center justify-between gap-3 transition-colors ${
                        item.disabled
                          ? "opacity-55 cursor-not-allowed bg-[var(--bg-subtle)]"
                          : isActive
                            ? "bg-[var(--bg-hover)]"
                            : "hover:bg-[var(--bg-hover)]"
                      }`}
                      onMouseEnter={() => {
                        if (!item.disabled && enabledIndex >= 0) setActiveIdx(enabledIndex);
                      }}
                      onClick={() => pick(item)}
                    >
                      <div className="min-w-0">
                        <p className="font-mono font-semibold text-[var(--text-primary)] truncate">
                          {item.primary}
                        </p>
                        {item.secondary ? (
                          <p className="text-xs text-[var(--text-muted)] truncate">{item.secondary}</p>
                        ) : null}
                      </div>
                      {item.right ? <div className="shrink-0">{item.right}</div> : null}
                    </button>
                  );
                })
              )}
            </div>
          )}
        </div>
      )}

      {error ? <p className="form-error">{error}</p> : null}
    </div>
  );
}
