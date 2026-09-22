"use client";

import { useEffect, useMemo, useState } from "react";
import { SearchSelect, type SearchSelectItem } from "./SearchSelect";

export type MasterSearchKind = "supplier" | "subcontractor" | "tool" | "location" | "ledger" | "purchaseOrder" | "grn" | "employee";

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
  /** Extra query params appended to the lookup request, e.g. { approved: "Yes" }. */
  filterParams?: Record<string, string>;
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

function endpoint(kind: MasterSearchKind, query: string, filterParams?: Record<string, string>): string {
  const q = encodeURIComponent(query.trim());
  const base =
    kind === "supplier" ? `/api/suppliers?search=${q}&pageSize=25`
    : kind === "subcontractor" ? `/api/subcontractors?search=${q}&pageSize=25`
    : kind === "tool" ? `/api/tools?search=${q}&pageSize=25`
    : kind === "ledger" ? `/api/gl-codes?search=${q}&pageSize=25`
    : kind === "purchaseOrder" ? `/api/po?search=${q}&pageSize=25`
    : kind === "grn" ? `/api/po/grn?search=${q}&pageSize=25`
    : kind === "employee" ? `/api/employees?search=${q}&pageSize=25`
    : "/api/lookups/locations";
  const extra = filterParams
    ? Object.entries(filterParams)
        .map(([key, value]) => `${encodeURIComponent(key)}=${encodeURIComponent(value)}`)
        .join("&")
    : "";
  if (!extra) return base;
  return base + (base.includes("?") ? "&" : "?") + extra;
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
  if (kind === "purchaseOrder") {
    const code = text(row, "poOrderNo");
    if (!code) return null;
    const supplier = row.supplier as UnknownRow | null | undefined;
    const secondary = [text(supplier ?? {}, "supName"), text(row, "statusLabel")].filter(Boolean).join(" · ");
    return { id: code, primary: code, secondary: secondary || undefined };
  }
  if (kind === "grn") {
    const girNo = text(row, "girNo");
    if (!girNo) return null;
    const supplier = row.supplier as UnknownRow | null | undefined;
    const secondary = [text(row, "poOrderNo"), text(supplier ?? {}, "supName")].filter(Boolean).join(" · ");
    return { id: girNo, primary: text(row, "girNoNew") || girNo, secondary: secondary || undefined };
  }
  if (kind === "employee") {
    const code = text(row, "empCd", "empId");
    if (!code) return null;
    const name = [text(row, "firstName"), text(row, "lastName")].filter(Boolean).join(" ");
    return { id: code, primary: code, secondary: name || undefined };
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
  filterParams,
}: MasterSearchSelectProps) {
  const [query, setQuery] = useState("");
  const [items, setItems] = useState<SearchSelectItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [chosenLabel, setChosenLabel] = useState("");
  // Keyed on content, not reference — an inline `filterParams={{...}}` literal
  // gets a new identity every render, which would otherwise re-trigger this
  // effect (and its fetch) on every unrelated parent re-render.
  const filterParamsKey = filterParams ? JSON.stringify(filterParams) : "";

  useEffect(() => {
    if (value || disabled) return;
    const controller = new AbortController();
    const timer = window.setTimeout(async () => {
      setLoading(true);
      setError("");
      try {
        const response = await fetch(endpoint(kind, query, filterParams), {
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
    // filterParamsKey stands in for filterParams (see its declaration above).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [disabled, kind, query, value, filterParamsKey]);

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
