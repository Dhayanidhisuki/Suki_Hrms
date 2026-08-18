"use client";

import { useEffect, useMemo, useState } from "react";
import { SearchSelect, type SearchSelectItem } from "@/components/ui/SearchSelect";

export type MasterSearchKind = "supplier" | "subcontractor" | "tool" | "location" | "ledger";

type MasterSearchSelectProps = {
  kind: MasterSearchKind;
  value: string;
  selectedLabel?: string;
  onChange: (value: string, label: string) => void;
  label?: string;
  placeholder?: string;
  disabled?: boolean;
  required?: boolean;
  className?: string;
  id?: string;
};

type UnknownRow = Record<string, unknown>;

function text(row: UnknownRow, ...keys: string[]): string {
  for (const key of keys) {
    const value = row[key];
    if (typeof value === "string" && value.trim()) return value.trim();
    if (typeof value === "number") return String(value);
  }
  return "";
}

function endpoint(kind: MasterSearchKind, query: string): string {
  const q = encodeURIComponent(query.trim());
  if (kind === "supplier") return `/api/suppliers?search=${q}&pageSize=25`;
  if (kind === "subcontractor") return `/api/subcontractors?search=${q}&pageSize=25`;
  if (kind === "tool") return `/api/tools?search=${q}&pageSize=25`;
  if (kind === "ledger") return `/api/gl-codes?search=${q}&pageSize=25`;
  return "/api/lookups/locations";
}

function toItem(kind: MasterSearchKind, row: UnknownRow): SearchSelectItem | null {
  if (kind === "supplier") {
    const code = text(row, "supCode", "code");
    if (!code) return null;
    return { id: code, primary: code, secondary: text(row, "supName", "name") || undefined };
  }
  if (kind === "subcontractor") {
    const code = text(row, "subCode", "subConId", "code");
    if (!code) return null;
    return { id: code, primary: code, secondary: text(row, "subName", "name") || undefined };
  }
  if (kind === "tool") {
    const code = text(row, "toolOrGaugeNo", "itemCode");
    if (!code) return null;
    return { id: code, primary: code, secondary: text(row, "name", "description", "des") || undefined };
  }
  if (kind === "ledger") {
    const code = text(row, "code");
    if (!code) return null;
    return { id: code, primary: code, secondary: text(row, "ledgerName") || undefined };
  }
  const name = text(row, "locationName", "name");
  if (!name) return null;
  const detail = [text(row, "locationType"), text(row, "area"), text(row, "rack")]
    .filter(Boolean)
    .join(" · ");
  return { id: name, primary: name, secondary: detail || undefined };
}

export function MasterSearchSelect({
  kind,
  value,
  selectedLabel,
  onChange,
  label,
  placeholder,
  disabled,
  required,
  className,
  id,
}: MasterSearchSelectProps) {
  const [query, setQuery] = useState("");
  const [items, setItems] = useState<SearchSelectItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [chosenLabel, setChosenLabel] = useState("");

  useEffect(() => {
    if (value || disabled) return;
    const controller = new AbortController();
    const timer = window.setTimeout(async () => {
      setLoading(true);
      setError("");
      try {
        const response = await fetch(endpoint(kind, query), {
          credentials: "include",
          signal: controller.signal,
        });
        const payload = (await response.json()) as { items?: UnknownRow[]; error?: string };
        if (!response.ok) throw new Error(payload.error || "Failed to load options");
        let next = (payload.items ?? []).map((row) => toItem(kind, row)).filter(Boolean) as SearchSelectItem[];
        if (kind === "location" && query.trim()) {
          const needle = query.trim().toLowerCase();
          next = next.filter((item) =>
            `${item.primary} ${item.secondary ?? ""}`.toLowerCase().includes(needle)
          );
        }
        setItems(next.slice(0, 30));
      } catch (cause) {
        if ((cause as Error).name !== "AbortError") {
          setItems([]);
          setError(cause instanceof Error ? cause.message : "Failed to load options");
        }
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    }, query ? 250 : 0);

    return () => {
      window.clearTimeout(timer);
      controller.abort();
    };
  }, [disabled, kind, query, value]);

  const selected = useMemo(
    () => (value ? { primary: chosenLabel || selectedLabel || value } : null),
    [chosenLabel, selectedLabel, value]
  );

  return (
    <div className={className}>
      <SearchSelect
        id={id}
        label={label}
        placeholder={placeholder ?? `Search ${kind}…`}
        query={query}
        onQueryChange={setQuery}
        items={items}
        loading={loading}
        error={error}
        disabled={disabled}
        selected={selected}
        onClear={() => {
          onChange("", "");
          setQuery("");
          setChosenLabel("");
        }}
        onSelect={(item) => {
          const display = item.secondary ? `${item.primary} · ${item.secondary}` : item.primary;
          setChosenLabel(display);
          onChange(item.id, display);
          setQuery("");
        }}
        emptyText={`No matching ${kind} found`}
      />
      {required && !value ? <p className="sr-only" aria-live="polite">Selection required</p> : null}
    </div>
  );
}
