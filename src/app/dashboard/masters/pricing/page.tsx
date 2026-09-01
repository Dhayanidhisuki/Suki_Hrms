"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ChevronDown, Columns3, Edit2, FileSpreadsheet, Upload, X } from "lucide-react";
import { SimpleMasterShell } from "@/components/SimpleMasterShell";
import { TableSkeleton } from "@/app/dashboard/components/LoadingSkeleton";
import { TablePager } from "@/components/TablePager";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { SelectionFilter } from "@/components/ui/SelectionFilter";
import { MasterSearchInput, MasterTableCard } from "@/components/ui/MasterTableCard";
import { Button } from "@/components/ui/button";
import { apiGet, apiPost } from "@/lib/apiClient";
import { toastError, toastSuccess } from "@/lib/appToast";
import { useSession } from "@/lib/SessionContext";
import { downloadExcel } from "@/lib/downloadExcel";

type Row = Record<string, unknown>;

type ColumnDef = {
  key: string;
  label: string;
  defaultVisible: boolean;
  align?: "left" | "right";
  emphasis?: "toolNo" | "mono" | "muted" | "rate" | "badge";
  minWidth?: string;
};

/** Default-visible first; optional columns behind the Columns toggle. */
const ALL_COLUMNS: ColumnDef[] = [
  { key: "toolOrGaugeNo", label: "Tool No", defaultVisible: true, emphasis: "toolNo", minWidth: "9rem" },
  { key: "supCode", label: "Supplier", defaultVisible: true, emphasis: "mono", minWidth: "7.5rem" },
  { key: "standardPrice", label: "Standard Price", defaultVisible: true, align: "right", emphasis: "rate", minWidth: "8.5rem" },
  { key: "rate", label: "Purchase / Revision Rate", defaultVisible: true, align: "right", emphasis: "rate", minWidth: "10rem" },
  { key: "proposedRate", label: "Proposed", defaultVisible: true, align: "right", emphasis: "rate", minWidth: "8rem" },
  { key: "revNo", label: "Rev", defaultVisible: true, emphasis: "mono", minWidth: "3.5rem" },
  { key: "revDate", label: "Rev Date", defaultVisible: true, emphasis: "mono", minWidth: "6.5rem" },
  { key: "approvalStatus", label: "Approval", defaultVisible: true, emphasis: "badge", minWidth: "7rem" },
  { key: "toolName", label: "Tool Name", defaultVisible: false },
  { key: "toolRefNo", label: "Ref", defaultVisible: false, align: "right", emphasis: "mono" },
  { key: "currency", label: "Currency", defaultVisible: false, emphasis: "mono" },
  { key: "rowId", label: "Row ID", defaultVisible: false, emphasis: "mono" },
  { key: "vendorType", label: "Vendor Type", defaultVisible: false },
  { key: "subCode", label: "Sub Code", defaultVisible: false, emphasis: "mono" },
  { key: "revStatus", label: "Rev Status", defaultVisible: false, emphasis: "badge" },
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

const rateFormatter = new Intl.NumberFormat("en-IN", {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

function isBlankGroupLabel(raw: string): boolean {
  const t = raw.trim();
  if (!t) return true;
  const upper = t.toUpperCase();
  return (
    upper === "-SELECT-" ||
    upper === "--SELECT--" ||
    upper === "SELECT" ||
    upper === "N/A" ||
    upper === "NA" ||
    upper === "NULL"
  );
}

function groupKey(row: Row): string {
  const g = row.grouping;
  if (g == null) return UNGROUPED;
  const t = String(g);
  if (isBlankGroupLabel(t)) return UNGROUPED;
  return t.trim();
}

function supplierKey(row: Row): string {
  const s = row.supCode;
  if (s == null || String(s).trim() === "") return "";
  return String(s).trim();
}

function toolNoKey(row: Row): string {
  return String(row.toolOrGaugeNo ?? "").trim().toLowerCase();
}

function formatDate(v: unknown): string {
  if (v == null || v === "") return "—";
  if (typeof v === "string" && v.includes("T") && !Number.isNaN(Date.parse(v))) {
    return v.split("T")[0];
  }
  return String(v);
}

function formatRate(v: unknown): string {
  if (v == null || v === "") return "—";
  const n = typeof v === "number" ? v : Number(v);
  if (!Number.isFinite(n)) return String(v);
  return rateFormatter.format(n);
}

function cell(v: unknown): string {
  if (v == null || v === "") return "—";
  if (typeof v === "number") return v.toLocaleString("en-IN");
  if (typeof v === "string" && v.includes("T") && !Number.isNaN(Date.parse(v))) {
    return v.split("T")[0];
  }
  return String(v);
}

export default function Page() {
  const { canModuleAction } = useSession();
  const canPropose = canModuleAction("tool_pricing", "CREATE") || canModuleAction("tool_pricing", "EDIT");
  const [items, setItems] = useState<Row[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [pricingSource, setPricingSource] = useState<string>("");
  const [pricingNote, setPricingNote] = useState("");
  const [readOnly, setReadOnly] = useState(true);

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

  const [editRow, setEditRow] = useState<Row | null>(null);
  const [proposedRateInput, setProposedRateInput] = useState("");
  const [remarksInput, setRemarksInput] = useState("");
  const [saving, setSaving] = useState(false);
  const [bulkBusy, setBulkBusy] = useState(false);
  const pricingFileRef = useRef<HTMLInputElement | null>(null);

  const loadData = useCallback(async () => {
    setLoading(true);
    const res = await apiGet<{
      items?: Row[];
      total?: number;
      source?: string;
      note?: string;
      readOnly?: boolean;
    }>("/api/pricing");
    setItems(res.data?.items ?? []);
    setTotal(res.data?.total ?? res.data?.items?.length ?? 0);
    setPricingSource(res.data?.source ?? "");
    setPricingNote(res.data?.note ?? "");
    setReadOnly(res.data?.readOnly !== false);
    if (res.error) toastError(res.error.message);
    setLoading(false);
  }, []);

  const downloadPricingTemplate = async () => {
    await downloadExcel<Record<string, never>>({
      filename: "pricing_update_template.xlsx",
      sheetName: "Price Updates",
      rows: [],
      columns: [
        { key: "INSTRUMENT_NO", label: "Instrument No" },
        { key: "SUPPLIER_CODE", label: "Supplier Code" },
        { key: "PROPOSED_STANDARD_PRICE", label: "Proposed Standard Price" },
        { key: "EFFECTIVE_DATE", label: "Effective Date (YYYY-MM-DD)" },
        { key: "REASON", label: "Reason" },
      ],
    });
    toastSuccess("Pricing update template downloaded.");
  };

  const importPricingFile = async (file: File | null) => {
    if (!file) return;
    setBulkBusy(true);
    try {
      const XLSX = await import("xlsx");
      const workbook = XLSX.read(await file.arrayBuffer(), { type: "array", cellDates: true });
      const sheet = workbook.Sheets[workbook.SheetNames[0]];
      if (!sheet) throw new Error("Workbook has no worksheet.");
      const raw = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, { defval: "", raw: false });
      const rows = raw.map((row) => ({
        toolOrGaugeNo: String(row["Instrument No"] ?? "").trim(),
        supCode: String(row["Supplier Code"] ?? "").trim() || null,
        proposedRate: Number(row["Proposed Standard Price"]),
        effectiveDate: String(row["Effective Date (YYYY-MM-DD)"] ?? "").trim() || null,
        remarks: String(row["Reason"] ?? "").trim() || null,
      }));
      if (!rows.length) throw new Error("The pricing workbook has no data rows.");
      const res = await apiPost<{ submitted: number; rejected: Array<{ row: number; reason: string }> }>(
        "/api/pricing/import",
        { rows }
      );
      if (res.error) throw new Error(res.error.message);
      const submitted = res.data?.submitted ?? 0;
      const rejected = res.data?.rejected.length ?? 0;
      toastSuccess(`Submitted ${submitted} price update(s) for approval${rejected ? `; ${rejected} row(s) rejected` : ""}.`);
      await loadData();
    } catch (error) {
      toastError(error instanceof Error ? error.message : "Pricing import failed.");
    } finally {
      setBulkBusy(false);
      if (pricingFileRef.current) pricingFileRef.current.value = "";
    }
  };

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void loadData();
  }, [loadData]);

  const openEdit = (row: Row) => {
    setEditRow(row);
    const pending = row.proposedRate != null ? Number(row.proposedRate) : null;
    const live = row.rate != null ? Number(row.rate) : null;
    setProposedRateInput(
      pending != null && Number.isFinite(pending)
        ? String(pending)
        : live != null && Number.isFinite(live)
          ? String(live)
          : ""
    );
    setRemarksInput(row.remarks != null ? String(row.remarks) : "");
  };

  const submitProposal = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editRow?.rowId) return;
    const n = Number(proposedRateInput);
    if (!Number.isFinite(n) || n < 0) {
      toastError("Enter a valid proposed rate");
      return;
    }
    setSaving(true);
    const res = await apiPost("/api/pricing", {
      rowId: Number(editRow.rowId),
      proposedRate: n,
      remarks: remarksInput.trim() || null,
    });
    setSaving(false);
    if (res.error) {
      toastError(res.error.message);
      return;
    }
    toastSuccess("Rate submitted for approval.");
    setEditRow(null);
    void loadData();
  };

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

  /** Tool numbers that appear more than once in the full dataset. */
  const duplicateToolNos = useMemo(() => {
    const counts = new Map<string, number>();
    for (const row of items) {
      const k = toolNoKey(row);
      if (!k) continue;
      counts.set(k, (counts.get(k) ?? 0) + 1);
    }
    const dups = new Set<string>();
    for (const [k, n] of counts) {
      if (n > 1) dups.add(k);
    }
    return dups;
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
        const sup = String(row.supCode ?? "").toLowerCase();
        return toolNo.includes(q) || toolName.includes(q) || sup.includes(q);
      })
      .sort((a, b) => {
        const ga = groupKey(a).localeCompare(groupKey(b));
        if (ga !== 0) return ga;
        const ta = String(a.toolOrGaugeNo ?? "").localeCompare(String(b.toolOrGaugeNo ?? ""));
        if (ta !== 0) return ta;
        // Same tool: newest rev date first, then supplier
        const da = String(a.revDate ?? "");
        const db = String(b.revDate ?? "");
        if (da !== db) return db.localeCompare(da);
        return String(a.supCode ?? "").localeCompare(String(b.supCode ?? ""));
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
    // eslint-disable-next-line react-hooks/set-state-in-effect
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

  const renderBlocks = useMemo(() => {
    type Block =
      | { type: "header"; group: string; count: number }
      | { type: "row"; row: Row; stripe: boolean };

    const blocks: Block[] = [];
    let lastGroup: string | null = null;
    let stripe = false;

    for (const row of pageRows) {
      const g = groupKey(row);
      if (g !== lastGroup) {
        blocks.push({
          type: "header",
          group: g,
          count: groupCounts.get(g) ?? 0,
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

  const colSpan = Math.max(visibleColumns.length, 1) + (!readOnly && canPropose ? 1 : 0);

  const isPendingStatus = (raw: unknown) => {
    const s = String(raw ?? "").trim().toUpperCase();
    return s === "PENDING" || s.includes("PEND");
  };

  return (
    <SimpleMasterShell
      title="Tool Pricing Master"
      subtitle={
        pricingSource === "db"
          ? `Live TOOLS_PRICE_MASTER — ${total.toLocaleString("en-IN")} rate rows`
          : `TOOLS_PRICE_MASTER — ${total.toLocaleString("en-IN")} rates · source: ${pricingSource || "json"}`
      }
    >
      {(pricingNote || pricingSource) && (
        <div className="mb-4 rounded-xl border border-[var(--border-main)] bg-[var(--bg-subtle)] px-4 py-3 text-sm text-[var(--text-secondary)]">
          {readOnly ? (
            <>
              <span className="font-semibold text-[var(--text-primary)]">Read-only.</span>{" "}
            </>
          ) : (
            <>
              <span className="font-semibold text-[var(--text-primary)]">Propose edits.</span>{" "}
              Live RATE is unchanged until Approval Centre approves. GRN still writes RATE directly.
              {" "}
            </>
          )}
          {pricingNote}
          {pricingSource ? (
            <span className="text-[var(--text-muted)]"> · Source: {pricingSource}</span>
          ) : null}
        </div>
      )}
      <MasterTableCard
        toolbar={
          <>
            <MasterSearchInput
              id="pricing-search"
              value={search}
              onChange={setSearch}
              placeholder="Search tool, supplier…"
              widthClass="w-52"
            />
            <SelectionFilter
              id="pricing-group-filter"
              label="Group"
              value={groupFilter}
              anyValue="All"
              anyLabel="All"
              maxValueWidth="6rem"
              onChange={setGroupFilter}
              options={[
                { value: "All", label: "All Groups" },
                ...groupOptions.map((g) => ({ value: g, label: g })),
              ]}
            />
            <SelectionFilter
              id="pricing-supplier-filter"
              label="Supplier"
              value={supplierFilter}
              anyValue="All"
              anyLabel="All"
              maxValueWidth="5rem"
              onChange={setSupplierFilter}
              options={[
                { value: "All", label: "All Suppliers" },
                ...supplierOptions.map((s) => ({ value: s, label: s })),
              ]}
            />
            <div className="relative shrink-0" ref={columnsRef}>
              <button
                type="button"
                onClick={() => setColumnsOpen((o) => !o)}
                className="inline-flex h-7 items-center gap-1 rounded-md border border-[var(--border-main)] bg-[var(--bg-card)] px-2 text-[11px] font-semibold hover:bg-[var(--bg-hover)]"
              >
                <Columns3 className="w-3 h-3" />
                Columns
              </button>
              {columnsOpen && (
                <div className="absolute right-0 z-30 mt-1.5 w-56 max-h-72 overflow-auto rounded-md border border-[var(--border-main)] bg-[var(--bg-surface-elevated)] shadow-lg p-2">
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
            {!readOnly && canPropose ? (
              <>
                <Button type="button" size="sm" variant="outline" className="h-7 !px-2 !text-[11px]" onClick={() => void downloadPricingTemplate()} disabled={bulkBusy}>
                  <FileSpreadsheet className="w-3.5 h-3.5" /> Template
                </Button>
                <Button type="button" size="sm" variant="outline" className="h-7 !px-2 !text-[11px]" onClick={() => pricingFileRef.current?.click()} disabled={bulkBusy}>
                  <Upload className="w-3.5 h-3.5" /> {bulkBusy ? "Importing…" : "Import Prices"}
                </Button>
                <input ref={pricingFileRef} type="file" accept=".xlsx" className="hidden" onChange={(event) => void importPricingFile(event.target.files?.[0] ?? null)} />
              </>
            ) : null}
            {hasActiveFilters && (
              <button
                type="button"
                onClick={clearFilters}
                className="inline-flex h-7 items-center gap-1 px-2 text-[11px] font-semibold text-[var(--text-muted)] hover:text-[var(--text-primary)] shrink-0"
              >
                <X className="w-3 h-3" />
                Clear
              </button>
            )}
            <span className="text-[11px] text-[var(--text-muted)] ml-auto whitespace-nowrap tabular-nums shrink-0">
              {loading
                ? "Loading…"
                : `${filtered.length.toLocaleString("en-IN")} match${filtered.length === 1 ? "" : "es"} · ${totalFiltered.toLocaleString("en-IN")} visible`}
            </span>
          </>
        }
        footer={
          !loading ? (
            <TablePager
              page={safePage}
              pageSize={PAGE_SIZE}
              total={totalFiltered}
              onPageChange={setPage}
              idPrefix="pricing"
            />
          ) : undefined
        }
      >
        {collapsedGroupsList.length > 0 && (
          <div className="px-3 py-2 border-b border-[var(--border-main)] flex flex-wrap items-center gap-2">
            <span className="text-[10px] font-semibold uppercase tracking-wider text-[var(--text-muted)]">
              Collapsed
            </span>
            {collapsedGroupsList.map((g) => (
              <button
                key={g}
                type="button"
                onClick={() => toggleCollapsed(g)}
                className="inline-flex items-center gap-1.5 h-7 px-2.5 rounded-md text-[11px] font-semibold bg-[var(--bg-subtle)] border border-[var(--border-main)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:border-[var(--primary)]"
              >
                {g}
                <span className="font-mono text-[10px] text-[var(--primary)]">
                  {groupCounts.get(g) ?? 0}
                </span>
                <ChevronDown className="w-3 h-3 -rotate-90 text-[var(--text-muted)]" />
              </button>
            ))}
          </div>
        )}

        {loading ? (
          <div className="p-4">
            <TableSkeleton rows={8} />
          </div>
        ) : (
          <div className="overflow-auto max-h-[65vh]">
            <table className="w-full text-sm border-collapse">
                <thead className="sticky top-0 z-20">
                  <tr className="border-b border-[var(--border-main)] bg-[var(--bg-surface-elevated)]">
                    {visibleColumns.map((col) => {
                      const isToolNo = col.key === "toolOrGaugeNo";
                      return (
                        <th
                          key={col.key}
                          style={col.minWidth ? { minWidth: col.minWidth } : undefined}
                          className={`text-[10px] font-bold text-[var(--text-muted)] uppercase tracking-wider py-2.5 px-3 whitespace-nowrap ${
                            col.align === "right" ? "text-right" : "text-left"
                          } ${
                            isToolNo
                              ? "sticky left-0 z-30 bg-[var(--bg-surface-elevated)] shadow-[2px_0_0_0_var(--border-main)]"
                              : ""
                          }`}
                        >
                          {col.label}
                        </th>
                      );
                    })}
                    {!readOnly && canPropose ? (
                      <th className="text-[10px] font-bold text-[var(--text-muted)] uppercase tracking-wider py-2.5 px-3 text-right whitespace-nowrap">
                        Actions
                      </th>
                    ) : null}
                  </tr>
                </thead>
                <tbody>
                  {renderBlocks.map((block, idx) => {
                    if (block.type === "header") {
                      return (
                        <tr
                          key={`h-${block.group}-${idx}`}
                          className="bg-[var(--bg-surface-elevated)]"
                        >
                          <td
                            colSpan={colSpan}
                            className="sticky left-0 py-0 px-0 border-y border-[var(--border-main)]"
                          >
                            <button
                              type="button"
                              onClick={() => toggleCollapsed(block.group)}
                              className="w-full flex items-center gap-2.5 text-left py-2.5 px-3 hover:bg-[var(--bg-hover)] transition-colors"
                            >
                              <ChevronDown className="w-4 h-4 shrink-0 text-[var(--text-muted)]" />
                              <span className="text-xs font-bold text-[var(--text-primary)] uppercase tracking-wider leading-none">
                                {block.group}
                              </span>
                              <span className="inline-flex items-center justify-center min-w-[1.5rem] h-5 px-1.5 rounded-md font-mono text-[10px] font-semibold text-[var(--primary)] bg-[var(--primary-light)] leading-none">
                                {block.count}
                              </span>
                            </button>
                          </td>
                        </tr>
                      );
                    }

                    const { row, stripe } = block;
                    const rowKey = String(
                      row.id ?? row.rowId ?? `${row.toolOrGaugeNo}-${row.supCode}-${row.revNo}-${idx}`
                    );
                    const isDup = duplicateToolNos.has(toolNoKey(row));
                    const rowBg = stripe ? "bg-[var(--bg-subtle)]" : "bg-[var(--bg-card)]";

                    return (
                      <tr
                        key={rowKey}
                        className={`border-b border-[var(--border-main)] hover:bg-[var(--bg-hover)] ${rowBg}`}
                        title={
                          isDup
                            ? "Same tool appears with multiple supplier rates / revisions"
                            : undefined
                        }
                      >
                        {visibleColumns.map((col) => {
                          const raw = row[col.key];
                          const isToolNo = col.key === "toolOrGaugeNo";
                          const isRate = col.key === "rate" || col.key === "standardPrice" || col.key === "proposedRate";
                          const isDate = col.key === "revDate" || col.key === "approvalDate" || col.key === "creatDt" || col.key === "lstUpdtTs";
                          const isBadge = col.emphasis === "badge";
                          const pending = isPendingStatus(row.approvalStatus);

                          let display = "—";
                          if (isRate) display = formatRate(raw);
                          else if (isDate) display = formatDate(raw);
                          else display = cell(raw);

                          const empty = display === "—";

                          return (
                            <td
                              key={col.key}
                              style={col.minWidth ? { minWidth: col.minWidth } : undefined}
                              className={`py-2.5 px-3 align-middle ${
                                col.align === "right" ? "text-right" : "text-left"
                              } ${
                                isToolNo
                                  ? `sticky left-0 z-10 shadow-[2px_0_0_0_var(--border-main)] ${rowBg}`
                                  : ""
                              }`}
                            >
                              {isToolNo ? (
                                <div className="flex flex-col gap-0.5 min-w-0">
                                  <span className="font-mono text-xs font-bold text-[var(--text-primary)]">
                                    {display}
                                  </span>
                                  {pending ? (
                                    <span className="text-[10px] font-semibold text-amber-700 dark:text-amber-400">
                                      Pending approval
                                    </span>
                                  ) : null}
                                  {isDup ? (
                                    <span className="text-[10px] text-[var(--text-muted)] leading-tight">
                                      {[
                                        supplierKey(row) || null,
                                        row.revNo != null && String(row.revNo).trim()
                                          ? `Rev ${String(row.revNo).trim()}`
                                          : null,
                                      ]
                                        .filter(Boolean)
                                        .join(" · ") || "Multiple rates"}
                                    </span>
                                  ) : null}
                                </div>
                              ) : col.key === "approvalStatus" && !empty ? (
                                <StatusBadge status={raw} />
                              ) : isBadge && !empty ? (
                                <StatusBadge status={raw} />
                              ) : empty ? (
                                <span className="text-[var(--text-subtle)] text-xs">—</span>
                              ) : col.key === "rate" || col.key === "standardPrice" ? (
                                <span className="font-mono text-xs tabular-nums text-[var(--text-primary)] font-medium">
                                  {display}
                                </span>
                              ) : col.key === "proposedRate" ? (
                                <span
                                  className={`font-mono text-xs tabular-nums font-medium ${
                                    pending
                                      ? "text-amber-700 dark:text-amber-400"
                                      : "text-[var(--text-secondary)]"
                                  }`}
                                >
                                  {display}
                                </span>
                              ) : col.emphasis === "mono" ? (
                                <span className="font-mono text-xs tabular-nums text-[var(--text-secondary)]">
                                  {display}
                                </span>
                              ) : (
                                <span className="text-[var(--text-secondary)] text-sm">{display}</span>
                              )}
                            </td>
                          );
                        })}
                        {!readOnly && canPropose ? (
                          <td className="py-2.5 px-3 text-right align-middle">
                            <button
                              type="button"
                              title="Propose rate"
                              onClick={() => openEdit(row)}
                              className="p-1.5 hover:bg-[var(--bg-hover)] rounded-lg text-[var(--text-muted)] hover:text-[var(--primary)] transition-colors cursor-pointer"
                            >
                              <Edit2 className="w-4 h-4" />
                            </button>
                          </td>
                        ) : null}
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
        )}
      </MasterTableCard>

      {editRow && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <form
            onSubmit={submitProposal}
            className="w-full max-w-md bg-[var(--bg-card)] border border-[var(--border-main)] rounded-2xl p-5 shadow-xl"
          >
            <h2 className="text-lg font-semibold text-[var(--text-primary)] mb-1">
              Propose rate change
            </h2>
            <p className="text-xs text-[var(--text-muted)] mb-4">
              {String(editRow.toolOrGaugeNo ?? "—")} · {String(editRow.supCode ?? "—")}
              {" · "}Standard price {formatRate(editRow.standardPrice)} (unchanged until approved)
            </p>
            <div className="space-y-3">
              <div>
                <label className="text-xs font-medium text-[var(--text-muted)]">
                  Proposed rate
                </label>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  required
                  className="mt-1 w-full rounded-lg border border-[var(--border-main)] bg-[var(--bg-subtle)] px-3 py-2 text-sm font-mono"
                  value={proposedRateInput}
                  onChange={(e) => setProposedRateInput(e.target.value)}
                />
              </div>
              <div>
                <label className="text-xs font-medium text-[var(--text-muted)]">
                  Remarks (optional)
                </label>
                <input
                  className="mt-1 w-full rounded-lg border border-[var(--border-main)] bg-[var(--bg-subtle)] px-3 py-2 text-sm"
                  value={remarksInput}
                  maxLength={200}
                  onChange={(e) => setRemarksInput(e.target.value)}
                />
              </div>
            </div>
            <div className="mt-5 flex justify-end gap-2">
              <Button
                type="button"
                variant="outline"
                disabled={saving}
                onClick={() => setEditRow(null)}
              >
                Cancel
              </Button>
              <Button type="submit" variant="primary" disabled={saving}>
                {saving ? "Submitting…" : "Submit for approval"}
              </Button>
            </div>
          </form>
        </div>
      )}
    </SimpleMasterShell>
  );
}
