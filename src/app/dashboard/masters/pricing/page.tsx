"use client";

import { useEffect, useState } from "react";
import { SimpleMasterShell } from "@/components/SimpleMasterShell";
import { TableSkeleton } from "@/app/dashboard/components/LoadingSkeleton";
import { apiGet } from "@/lib/apiClient";

const COLUMNS = [
  { key: "rowId", label: "Row ID", mono: true },
  { key: "toolOrGaugeNo", label: "Tool No", mono: true },
  { key: "toolName", label: "Tool Name", mono: false },
  { key: "toolRefNo", label: "Tool Ref", mono: true },
  { key: "grouping", label: "Group", mono: false },
  { key: "supCode", label: "Supplier", mono: true },
  { key: "vendorType", label: "Vendor Type", mono: false },
  { key: "subCode", label: "Sub Code", mono: true },
  { key: "rate", label: "Rate", mono: true },
  { key: "currency", label: "Currency", mono: true },
  { key: "revNo", label: "Rev", mono: true },
  { key: "revDate", label: "Rev Date", mono: true },
  { key: "revStatus", label: "Rev Status", mono: false },
  { key: "approvalStatus", label: "Approval", mono: false },
  { key: "approvalDate", label: "Approval Date", mono: true },
  { key: "remarks", label: "Remarks", mono: false },
  { key: "toolMapRefNo", label: "Map Ref", mono: true },
  { key: "creatUserIdCd", label: "Created By", mono: true },
  { key: "creatDt", label: "Created", mono: true },
  { key: "lstUpdtUserIdCd", label: "Updated By", mono: true },
  { key: "lstUpdtTs", label: "Updated", mono: true },
  { key: "companyId", label: "Company", mono: true },
] as const;

type Row = Record<string, unknown>;

function cell(v: unknown) {
  if (v == null || v === "") return "—";
  if (typeof v === "number") return v.toLocaleString("en-IN");
  if (typeof v === "string" && v.includes("T") && !Number.isNaN(Date.parse(v))) return v.split("T")[0];
  return String(v);
}

export default function Page() {
  const [items, setItems] = useState<Row[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);

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
    return () => { cancelled = true; };
  }, []);

  return (
    <SimpleMasterShell
      title="Tool Pricing Master"
      subtitle={`TOOLS_PRICE_MASTER from ERPDb_ESSKAY export — ${total.toLocaleString("en-IN")} supplier rates`}
    >
      <div className="bg-[var(--bg-card)] rounded-2xl border border-[var(--border-main)] p-5">
        {loading ? (
          <TableSkeleton rows={5} />
        ) : (
          <div className="overflow-auto max-h-[70vh]">
            <table className="w-full text-sm">
              <thead className="sticky top-0 z-10">
                <tr className="border-b border-[var(--border-main)] bg-[var(--bg-subtle)]">
                  {COLUMNS.map((col) => (
                    <th key={col.key} className="text-left text-[11px] font-semibold text-[var(--text-muted)] uppercase tracking-wider py-2.5 px-3">
                      {col.label}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--border-main)]">
                {items.map((row, idx) => (
                  <tr key={String(row["id"] ?? idx)} className="hover:bg-[var(--bg-hover)]">
                    {COLUMNS.map((col) => (
                      <td key={col.key} className={`py-3 px-3 text-[var(--text-secondary)] ${col.mono ? "font-mono text-xs" : ""}`}>
                        {cell(row[col.key])}
                      </td>
                    ))}
                  </tr>
                ))}
                {items.length === 0 && (
                  <tr>
                    <td colSpan={COLUMNS.length} className="py-8 text-center text-sm text-[var(--text-muted)]">No records found.</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </SimpleMasterShell>
  );
}
