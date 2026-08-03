"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { ChevronDown, Columns3, Search, X } from "lucide-react";
import { SimpleMasterShell } from "@/components/SimpleMasterShell";
import { TableSkeleton } from "@/app/dashboard/components/LoadingSkeleton";
import { TablePager } from "@/components/TablePager";
import { apiGet } from "@/lib/apiClient";

type Row = Record<string, unknown>;

type ColumnDef = {
  key: string;
  label: string;
  defaultVisible: boolean;
  align?: "left" | "right";
  emphasis?: "toolNo" | "mono" | "muted";
};

/** Default-visible first; optional columns behind the Columns toggle. */
const ALL_COLUMNS: ColumnDef[] = [
  { key: "toolOrGaugeNo", label: "Tool No", defaultVisible: true, emphasis: "toolNo" },
  { key: "toolName", label: "Tool Name", defaultVisible: true },
  { key: "toolRefNo", label: "Ref", defaultVisible: true, align: "right", emphasis: "mono" },
  { key: "supCode", label: "Supplier", defaultVisible: true, emphasis: "mono" },
  { key: "rate", label: "Price / Rate", defaultVisible: true, align: "right", emphasis: "mono" },
  { key: "currency", label: "Currency", defaultVisible: false, emphasis: "mono" },
  { key: "rowId", label: "Row ID", defaultVisible: false, emphasis: "mono" },
  { key: "vendorType", label: "Vendor Type", defaultVisible: false },
  { key: "subCode", label: "Sub Code", defaultVisible: false, emphasis: "mono" },
  { key: "revNo", label: "Rev", defaultVisible: false, emphasis: "mono" },
  { key: "revDate", label: "Rev Date", defaultVisible: false, emphasis: "mono" },
  { key: "revStatus", label: "Rev Status", defaultVisible: false },
  { key: "approvalStatus", label: "Approval", defaultVisible: false },
  { key: "approvalDate", label: "Approval Date", defaultVisible: false, emphasis: "mono" },
  { key: "remarks", label: "Remarks", defaultVisible: false },
  { key: "toolMapRefNo", label: "Map Ref", defaultVisible: false, emphasis: "mono" },
  { key: "creatUserIdCd", label: "Created By", defaultVisible: false, emphasis: "mono" },
  { key: "creatDt", label: "Created", defaultVisible: false, emphasis: "mono" },
  { key: "lstUpdtUserIdCd", label: "Updated By", defaultVisible: false, emphasis: "mono" },
  { key: "lstUpdtTs", label: "Updated", defaultVisible: false, emphasis: "mono" },
  { key: "companyId", label: "Company", defaultVisible: false, emphasis: "mono" },
];

const PAGE_SIZE = 50;
const UNGROUPED = "Ungrouped";

function cell(v: unknown): string {
  if (v == null || v === "") return "—";
  if (typeof v === "number") return v.toLocaleString("en-IN");
  if (typeof v === "string" && v.includes("T") && !Number.isNaN(Date.parse(v))) return v.split("T")[0];
  return String(v);
}

function groupKey(row: Row): string {
  const g = row.grouping;
  if (g == null || String(g).trim() === "") return UNGROUPED;
  return String(g).trim();
}

function supplierKey(row: Row): string {
  const s = row.supCode;
  if (s == null || String(s).trim() === "") return "";
  return String(s).trim();
}

export default function Page() {
  const [items, setItems] = useState<Row[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);

  const [search, setSearch] = useState("");
  const [groupFilter, setGroupFilter] = useState("All");
  const [supplierFilter, setSupplierFilter] = useState("All");
  const [page, setPage] = useState(1);
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());
  const [visibleKeys, setVisibleKeys] = useState<Set<string>>(
    () => new Set(ALL_COLUMNS.filter((c) => c.defaultVisible).map((c) => c.key))
  );
  const [columnsOpen, setColumnsOpen] = useState(false);
  const columnsRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      const res = await apiGet<{ items?: Row[]; total?: number }>("/api/pricing");
      if (!cancelled) {
        setItems(res.data?.items ?? []);
        setTotal(res.data?.total ?? res.data?.items?.length ?? 0);
        setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    function onDocClick(e: MouseEvent) {
      if (columnsRef.current && !columnsRef.current.contains(e.target as Node)) {
        setColumnsOpen(false);
      }
    }
    document.addEventListener("mousedown", onDocClick);
    return () => document.removeEventListener("mousedown", onDocClick);
  }, []);

  const groupOptions = useMemo(() => {
    const set = new Set<string>();
    for (const row of items) {
      const g = groupKey(row);
      if (g !== UNGROUPED) set.add(g);
    }
    return Array.from(set).sort((a, b) => a.localeCompare(b));
  }, [items]);

  const supplierOptions = useMemo(() => {
    const set = new Set<string>();
    for (const row of items) {
      const s = supplierKey(row);
      if (s) set.add(s);
    }
    return Array.from(set).sort((a, b) => a.localeCompare(b));
  }, [items]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return items
      .filter((row) => {
        if (groupFilter !== "All" && groupKey(row) !== groupFilter) return false;
        if (supplierFilter !== "All" && supplierKey(row) !== supplierFilter) return false;
        if (!q) return true;
        const toolNo = String(row.toolOrGaugeNo ?? "").toLowerCase();
        const toolName = String(row.toolName ?? "").toLowerCase();
        return toolNo.includes(q) || toolName.includes(q);
      })
      .sort((a, b) => {
        const ga = groupKey(a).localeCompare(groupKey(b));
        if (ga !== 0) return ga;
        return String(a.toolOrGaugeNo ?? "").localeCompare(String(b.toolOrGaugeNo ?? ""));
      });
  }, [items, search, groupFilter, supplierFilter]);

  const groupCounts = useMemo(() => {
    const map = new Map<string, number>();
    for (const row of filtered) {
      const g = groupKey(row);
      map.set(g, (map.get(g) ?? 0) + 1);
    }
    return map;
  }, [filtered]);

  /** Collapsed groups are excluded from the paginated row stream. */
  const visibleRows = useMemo(
    () => filtered.filter((row) => !collapsed.has(groupKey(row))),
    [filtered, collapsed]
  );

  const totalFiltered = visibleRows.length;
  const totalPages = Math.max(1, Math.ceil(totalFiltered / PAGE_SIZE));
  const safePage = Math.min(page, totalPages);

  const pageRows = useMemo(() => {
    const start = (safePage - 1) * PAGE_SIZE;
    return visibleRows.slice(start, start + PAGE_SIZE);
  }, [visibleRows, safePage]);

  const visibleColumns = ALL_COLUMNS.filter((c) => visibleKeys.has(c.key));

  useEffect(() => {
    setPage(1);
  }, [search, groupFilter, supplierFilter, collapsed]);

  const toggleCollapsed = (group: string) => {
    setCollapsed((prev) => {
      const next = new Set(prev);
      if (next.has(group)) next.delete(group);
      else next.add(group);
      return next;
    });
  };

  const toggleColumn = (key: string) => {
    setVisibleKeys((prev) => {
      const next = new Set(prev);
      if (next.has(key)) {
        if (next.size <= 1) return prev;
        next.delete(key);
      } else {
        next.add(key);
      }
      return next;
    });
  };

  const clearFilters = () => {
    setSearch("");
    setGroupFilter("All");
    setSupplierFilter("All");
  };

  const hasActiveFilters =
    search.trim() !== "" || groupFilter !== "All" || supplierFilter !== "All";

  /** Build page render blocks: group header + rows (headers when group changes or collapsed-only). */
  const renderBlocks = useMemo(() => {
    type Block =
      | { type: "header"; group: string; count: number; isCollapsed: boolean }
      | { type: "row"; row: Row; stripe: boolean };

    const blocks: Block[] = [];
    let lastGroup: string | null = null;
    let stripe = false;

    // Collapsed groups that have no rows on this page still need a header
    // if they appear in filtered results and user collapsed them — show above table as chips instead.
    for (const row of pageRows) {
      const g = groupKey(row);
      if (g !== lastGroup) {
        blocks.push({
          type: "header",
          group: g,
          count: groupCounts.get(g) ?? 0,
          isCollapsed: false,
        });
        lastGroup = g;
        stripe = false;
      }
      blocks.push({ type: "row", row, stripe });
      stripe = !stripe;
    }
    return blocks;
  }, [pageRows, groupCounts]);

  const collapsedGroupsList = useMemo(
    () =>
      Array.from(collapsed)
        .filter((g) => (groupCounts.get(g) ?? 0) > 0)
        .sort((a, b) => a.localeCompare(b)),
    [collapsed, groupCounts]
  );

  const colSpan = Math.max(visibleColumns.length, 1);

  return (
    <SimpleMasterShell
      title="Tool Pricing Master"
      subtitle={`TOOLS_PRICE_MASTER from ERPDb_ESSKAY export — ${total.toLocaleString("en-IN")} supplier rates`}
    >
      <div className="bg-[var(--bg-card)] rounded-2xl border border-[var(--border-main)] p-5 space-y-4">
        {/* Filter bar */}
        <div className="flex flex-col lg:flex-row lg:items-center gap-3 flex-wrap">
          <div className="relative flex-1 min-w-[200px] max-w-md">
            <Search className="w-4 h-4 text-[var(--text-muted)] absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search Tool No or Tool Name…"
              className="w-full text-sm border border-[var(--border-main)] rounded-lg pl-9 pr-3 py-2 outline-none focus:ring-2 focus:ring-[var(--primary-subtle)] focus:border-[var(--primary)] bg-[var(--bg-subtle)] text-[var(--text-primary)] placeholder-[var(--text-muted)]"
            />
          </div>

          <select
            value={groupFilter}
            onChange={(e) => setGroupFilter(e.target.value)}
            className="text-sm border border-[var(--border-main)] rounded-lg px-3 py-2 bg-[var(--bg-subtle)] text-[var(--text-primary)] font-medium outline-none focus:ring-2 focus:ring-[var(--primary-subtle)] min-w-[160px]"
          >
            <option value="All">All Groups</option>
            {groupOptions.map((g) => (
              <option key={g} value={g}>
                {g}
              </option>
            ))}
          </select>

          <select
            value={supplierFilter}
            onChange={(e) => setSupplierFilter(e.target.value)}
            className="text-sm border border-[var(--border-main)] rounded-lg px-3 py-2 bg-[var(--bg-subtle)] text-[var(--text-primary)] font-medium outline-none focus:ring-2 focus:ring-[var(--primary-subtle)] min-w-[140px]"
          >
            <option value="All">All Suppliers</option>
            {supplierOptions.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>

          <div className="relative" ref={columnsRef}>
            <button
              type="button"
              onClick={() => setColumnsOpen((o) => !o)}
              className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-semibold rounded-lg border border-[var(--border-main)] bg-[var(--bg-subtle)] text-[var(--text-primary)] hover:bg-[var(--bg-hover)]"
            >
              <Columns3 className="w-3.5 h-3.5" />
              Columns
            </button>
            {columnsOpen && (
              <div className="absolute right-0 z-30 mt-1 w-56 max-h-72 overflow-auto rounded-xl border border-[var(--border-main)] bg-[var(--bg-surface)] shadow-lg p-2">
                {ALL_COLUMNS.map((col) => (
                  <label
                    key={col.key}
                    className="flex items-center gap-2 px-2 py-1.5 rounded-lg text-xs text-[var(--text-primary)] hover:bg-[var(--bg-hover)] cursor-pointer"
                  >
                    <input
                      type="checkbox"
                      checked={visibleKeys.has(col.key)}
                      onChange={() => toggleColumn(col.key)}
                      className="rounded border-[var(--border-main)]"
                    />
                    {col.label}
                    {col.defaultVisible ? (
                      <span className="ml-auto text-[10px] text-[var(--text-muted)]">default</span>
                    ) : null}
                  </label>
                ))}
              </div>
            )}
          </div>

          {hasActiveFilters && (
            <button
              type="button"
              onClick={clearFilters}
              className="inline-flex items-center gap-1 px-2.5 py-2 text-xs font-semibold text-[var(--text-muted)] hover:text-[var(--text-primary)]"
            >
              <X className="w-3.5 h-3.5" />
              Clear filters
            </button>
          )}

          <span className="text-xs text-[var(--text-muted)] lg:ml-auto whitespace-nowrap">
            {loading
              ? "Loading…"
              : `${filtered.length.toLocaleString("en-IN")} match${filtered.length === 1 ? "" : "es"} · ${totalFiltered.toLocaleString("en-IN")} visible`}
          </span>
        </div>

        {collapsedGroupsList.length > 0 && (
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-[10px] font-semibold uppercase tracking-wider text-[var(--text-muted)]">
              Collapsed:
            </span>
            {collapsedGroupsList.map((g) => (
              <button
                key={g}
                type="button"
                onClick={() => toggleCollapsed(g)}
                className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold bg-[var(--bg-subtle)] border border-[var(--border-main)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:border-[var(--primary)]"
              >
                {g} ({groupCounts.get(g) ?? 0})
                <ChevronDown className="w-3 h-3 -rotate-90" />
              </button>
            ))}
          </div>
        )}

        {loading ? (
          <TableSkeleton rows={8} />
        ) : (
          <>
            <div className="overflow-auto max-h-[65vh] rounded-xl border border-[var(--border-main)]">
              <table className="w-full text-sm border-collapse">
                <thead className="sticky top-0 z-20">
                  <tr className="border-b border-[var(--border-main)] bg-[var(--bg-subtle)]">
                    {visibleColumns.map((col) => {
                      const isToolNo = col.key === "toolOrGaugeNo";
                      return (
                        <th
                          key={col.key}
                          className={`text-[11px] font-semibold text-[var(--text-muted)] uppercase tracking-wider py-2.5 px-3 whitespace-nowrap ${
                            col.align === "right" ? "text-right" : "text-left"
                          } ${
                            isToolNo
                              ? "sticky left-0 z-30 bg-[var(--bg-subtle)] shadow-[2px_0_0_0_var(--border-main)]"
                              : ""
                          }`}
                        >
                          {col.label}
                        </th>
                      );
                    })}
                  </tr>
                </thead>
                <tbody>
                  {renderBlocks.map((block, idx) => {
                    if (block.type === "header") {
                      return (
                        <tr key={`h-${block.group}-${idx}`} className="bg-[var(--bg-subtle)]">
                          <td
                            colSpan={colSpan}
                            className="sticky left-0 py-2 px-3 border-y border-[var(--border-main)]"
                          >
                            <button
                              type="button"
                              onClick={() => toggleCollapsed(block.group)}
                              className="inline-flex items-center gap-2 text-xs font-bold text-[var(--text-primary)] uppercase tracking-wider hover:text-[var(--primary)]"
                            >
                              <ChevronDown
                                className={`w-4 h-4 text-[var(--text-muted)] transition-transform ${
                                  block.isCollapsed ? "-rotate-90" : ""
                                }`}
                              />
                              {block.group}
                              <span className="font-mono text-[10px] font-semibold text-[var(--primary)] bg-[var(--primary-light)] px-2 py-0.5 rounded-full normal-case tracking-normal">
                                {block.count}
                              </span>
                            </button>
                          </td>
                        </tr>
                      );
                    }

                    const { row, stripe } = block;
                    const rowKey = String(row.id ?? row.rowId ?? `${row.toolOrGaugeNo}-${row.supCode}-${idx}`);
                    return (
                      <tr
                        key={rowKey}
                        className={`border-b border-[var(--border-main)] hover:bg-[var(--bg-hover)] ${
                          stripe ? "bg-[var(--bg-subtle)]/50" : "bg-[var(--bg-card)]"
                        }`}
                      >
                        {visibleColumns.map((col) => {
                          const raw = row[col.key];
                          const display = cell(raw);
                          const empty = display === "—";
                          const isToolNo = col.key === "toolOrGaugeNo";
                          return (
                            <td
                              key={col.key}
                              className={`py-2.5 px-3 whitespace-nowrap ${
                                col.align === "right" ? "text-right" : "text-left"
                              } ${
                                isToolNo
                                  ? "sticky left-0 z-10 font-bold text-[var(--text-primary)] font-mono text-xs shadow-[2px_0_0_0_var(--border-main)] " +
                                    (stripe ? "bg-[var(--bg-subtle)]" : "bg-[var(--bg-card)]")
                                  : empty
                                    ? "text-[var(--text-muted)]"
                                    : col.emphasis === "mono"
                                      ? "font-mono text-xs tabular-nums text-[var(--text-secondary)]"
                                      : "text-[var(--text-secondary)]"
                              }`}
                            >
                              {display}
                            </td>
                          );
                        })}
                      </tr>
                    );
                  })}

                  {pageRows.length === 0 && (
                    <tr>
                      <td
                        colSpan={colSpan}
                        className="py-10 text-center text-sm text-[var(--text-muted)]"
                      >
                        {filtered.length === 0
                          ? hasActiveFilters
                            ? "No pricing rows match your filters."
                            : "No records found."
                          : "All matching groups are collapsed — expand a group above to view rows."}
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            <TablePager
              page={safePage}
              pageSize={PAGE_SIZE}
              total={totalFiltered}
              onPageChange={setPage}
              idPrefix="pricing"
            />
          </>
        )}
      </div>
    </SimpleMasterShell>
  );
}
