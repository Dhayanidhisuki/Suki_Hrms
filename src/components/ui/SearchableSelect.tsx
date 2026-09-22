'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import type { FieldOption } from './Field';

interface SearchableSelectProps {
  value: string | number | undefined;
  options: FieldOption[];
  onChange: (value: string | number | '') => void;
  placeholder?: string;
  disabled?: boolean;
  error?: boolean;
  id?: string;
}

/**
 * Drop-in replacement for a native <select> that adds a search box —
 * built for lists like Designation (100 options) or Department (32) where
 * scrolling a plain <select> is painful. Same value/onChange contract as
 * the select it replaces: onChange receives the option's original value
 * (not coerced to a DOM string), and '' clears the selection.
 *
 * No external combobox library exists in this project, so this is
 * hand-rolled with the same CSS-variable theme every other input uses.
 */
export default function SearchableSelect({
  value,
  options,
  onChange,
  placeholder = '—',
  disabled,
  error,
  id,
}: SearchableSelectProps) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [highlightIndex, setHighlightIndex] = useState(0);
  // Flips the panel above the trigger when there isn't enough room below —
  // e.g. the last field in a card, where opening downward would spill onto
  // (or get clipped by) whatever sits after the card.
  const [dropUp, setDropUp] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);

  const PANEL_MAX_HEIGHT = 280; // search box (~48px) + list (max-h-56 = 224px), roughly

  const selected = options.find((opt) => String(opt.value) === String(value));

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return options;
    return options.filter((opt) => opt.label.toLowerCase().includes(q));
  }, [options, query]);

  useEffect(() => {
    if (!open) return;
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
        setQuery('');
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [open]);

  // Focus the search box whenever the panel opens — a real external-system
  // side effect (imperative DOM focus), not state sync, so it stays here.
  useEffect(() => {
    if (open) {
      searchRef.current?.focus();
    }
  }, [open]);

  // highlightIndex resets to 0 at the point the panel opens/closes (the
  // click/keyboard handlers below), not in an effect — avoids a
  // setState-during-effect cascade for what's really just event handling.

  const commit = (opt: FieldOption) => {
    onChange(opt.value);
    setOpen(false);
    setQuery('');
  };

  const clear = () => {
    onChange('');
    setOpen(false);
    setQuery('');
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setHighlightIndex((i) => Math.min(i + 1, filtered.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setHighlightIndex((i) => Math.max(i - 1, 0));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      const opt = filtered[highlightIndex];
      if (opt) commit(opt);
    } else if (e.key === 'Escape') {
      e.preventDefault();
      setOpen(false);
      setQuery('');
    }
  };

  const triggerClass = `form-control flex cursor-pointer items-center justify-between gap-2 text-left ${
    error ? 'border-[var(--color-danger)] focus:border-[var(--color-danger)]' : ''
  }`;

  return (
    <div ref={containerRef} className="relative">
      <button
        type="button"
        id={id}
        disabled={disabled}
        onClick={(e) => {
          setHighlightIndex(0);
          if (!open) {
            const rect = e.currentTarget.getBoundingClientRect();
            const spaceBelow = window.innerHeight - rect.bottom;
            setDropUp(spaceBelow < PANEL_MAX_HEIGHT && rect.top > spaceBelow);
          }
          setOpen((o) => !o);
        }}
        aria-haspopup="listbox"
        aria-expanded={open}
        className={triggerClass}
        style={{
          backgroundColor: disabled ? 'var(--surface-muted)' : 'var(--surface)',
          color: selected ? 'var(--foreground)' : 'var(--foreground-muted)',
          borderColor: error ? '#f87171' : 'var(--border)',
          opacity: disabled ? 0.7 : 1,
        }}
      >
        <span className="truncate">{selected ? selected.label : placeholder}</span>
        <span className="shrink-0 text-xs" style={{ color: 'var(--foreground-muted)' }} aria-hidden>
          ▾
        </span>
      </button>

      {open && !disabled && (
        <div
          className={`absolute z-20 w-full overflow-hidden rounded-xl border shadow-xl ${dropUp ? 'bottom-full mb-1' : 'top-full mt-1'}`}
          style={{ backgroundColor: 'var(--bg-card)', borderColor: 'var(--border-main)' }}
          onKeyDown={handleKeyDown}
        >
          <div className="border-b p-2" style={{ borderColor: 'var(--border)' }}>
            <input
              ref={searchRef}
              type="text"
              value={query}
              onChange={(e) => {
                setQuery(e.target.value);
                setHighlightIndex(0);
              }}
              placeholder="Search..."
              className="w-full rounded-lg border px-2 py-1.5 text-sm focus:border-[var(--primary)] focus:outline-none focus:ring-1 focus:ring-[var(--primary)]"
              style={{ backgroundColor: 'var(--bg-subtle)', color: 'var(--text-primary)', borderColor: 'var(--border-main)' }}
            />
          </div>
          <ul role="listbox" className="max-h-56 overflow-auto py-1">
            <li>
              <button type="button" onClick={clear} className="w-full px-3 py-1.5 text-left text-sm transition hover:opacity-80" style={{ color: 'var(--foreground-muted)' }}>
                {placeholder}
              </button>
            </li>
            {filtered.length === 0 ? (
              <li className="px-3 py-2 text-sm" style={{ color: 'var(--foreground-muted)' }}>
                No matches
              </li>
            ) : (
              filtered.map((opt, i) => {
                const isSelected = String(opt.value) === String(value);
                return (
                  <li key={opt.value}>
                    <button
                      type="button"
                      onClick={() => commit(opt)}
                      onMouseEnter={() => setHighlightIndex(i)}
                      className="w-full truncate px-3 py-1.5 text-left text-sm"
                      style={{
                        backgroundColor: i === highlightIndex ? 'var(--surface-hover)' : 'transparent',
                        color: isSelected ? 'var(--accent)' : 'var(--foreground)',
                        fontWeight: isSelected ? 600 : 400,
                      }}
                    >
                      {opt.label}
                    </button>
                  </li>
                );
              })
            )}
          </ul>
        </div>
      )}
    </div>
  );
}
