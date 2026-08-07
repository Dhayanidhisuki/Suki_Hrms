"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  ClipboardList,
  Clock,
  FileText,
  ShieldAlert,
} from "lucide-react";
import { SimpleMasterShell } from "@/components/SimpleMasterShell";
import { ModuleKpiRow } from "@/app/dashboard/components/ModuleKpiRow";
import { TableSkeleton } from "@/app/dashboard/components/LoadingSkeleton";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { Button } from "@/components/ui/button";
import { TablePager } from "@/components/TablePager";
import { MasterSearchInput, MasterTableCard } from "@/components/ui/MasterTableCard";
import { StatusPillTabs } from "@/components/ui/StatusPillTabs";
import { apiGet } from "@/lib/apiClient";

interface ReqLine {
  rowId: number;
  reqNo: string | null;
  reqDate: string | null;
  deptId: number | null;
  empCd: number | null;
  headerStatus: string | null;
  matType: string | null;
  fromWhere: string | null;
  toolOrGaugeNo: string | null;
  toolName: string | null;
  grouping: string | null;
  description: string | null;
  machine: string | null;
  reqQty: number;
  issueQty: number;
  balanceQty: number;
  uom: string | null;
  lineStatus: string | null;
  remarks: string | null;
  creatUserIdCd: string;
  pending: boolean;
}

function fmtDate(v: string | null) {
  if (!v) return "—";
  return v.includes("T") ? v.split("T")[0] : v;
}

export default function RequisitionPendingPage() {
  const [items, setItems] = useState<ReqLine[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<"pending" | "fulfilled" | "all">(
    "pending"
  );
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [pendingCount, setPendingCount] = useState(0);
  const [fulfilledCount, setFulfilledCount] = useState(0);
  const [uniquePendingReqs, setUniquePendingReqs] = useState(0);
  const [toolLineCount, setToolLineCount] = useState(0);
  const [error, setError] = useState("");
  const pageSize = 50;
  const searchTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const load = useCallback(
    async (p = page, q = search, status = statusFilter) => {
      setLoading(true);
      setError("");
      const params = new URLSearchParams({
        page: String(p),
        pageSize: String(pageSize),
        status,
      });
      if (q.trim()) params.set("search", q.trim());
      const res = await apiGet<{
        items: ReqLine[];
        total: number;
        pendingCount: number;
        fulfilledCount: number;
        uniquePendingReqs: number;
        toolLineCount: number;
        error?: string;
      }>(`/api/requisition-pending?${params}`);
      if (res.error) {
        setError(res.error.message);
        setItems([]);
        setTotal(0);
      } else {
        setItems(res.data?.items ?? []);
        setTotal(res.data?.total ?? 0);
        setPendingCount(res.data?.pendingCount ?? 0);
        setFulfilledCount(res.data?.fulfilledCount ?? 0);
        setUniquePendingReqs(res.data?.uniquePendingReqs ?? 0);
        setToolLineCount(res.data?.toolLineCount ?? 0);
        if (res.data?.error) setError(res.data.error);
      }
      setLoading(false);
    },
    [page, search, statusFilter]
  );

  useEffect(() => {
    void load(1, "", "pending");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const onSearch = (val: string) => {
    setSearch(val);
    if (searchTimer.current) clearTimeout(searchTimer.current);
    searchTimer.current = setTimeout(() => {
      setPage(1);
      void load(1, val, statusFilter);
    }, 350);
  };

  const onStatusChange = (val: "pending" | "fulfilled" | "all") => {
    setStatusFilter(val);
    setPage(1);
    void load(1, search, val);
  };

  return (
    <SimpleMasterShell
      title="Requisition Pending"
      subtitle="Tool lines from MATERIAL_REQUISITION_* awaiting issue / fulfillment"
    >
      <ModuleKpiRow
        items={[
          {
            id: "pending-lines",
            label: "Pending Lines",
            value: pendingCount,
            subtext: "Open / unfulfilled tool lines",
            icon: ClipboardList,
            iconBg: "bg-amber-50 dark:bg-amber-950/30",
            iconColor: "text-amber-600 dark:text-amber-400",
            badge: { label: "Pending", type: "warning" },
          },
          {
            id: "pending-reqs",
            label: "Pending Requisitions",
            value: uniquePendingReqs,
            subtext: "Distinct REQ_NO still open",
            icon: FileText,
            iconBg: "bg-[var(--primary-light)]",
            iconColor: "text-[var(--primary)]",
            badge: { label: "Headers", type: "info" },
          },
          {
            id: "tool-lines",
            label: "Tool Lines (all)",
            value: toolLineCount,
            subtext: "Rows with TOOL_GAUGE_NO set",
            icon: Clock,
            iconBg: "bg-blue-50 dark:bg-blue-950/30",
            iconColor: "text-blue-600 dark:text-blue-400",
            badge: { label: "Tools", type: "info" },
          },
          {
            id: "fulfilled",
            label: "Fulfilled Lines",
            value: fulfilledCount,
            subtext: "Issued qty covers request",
            icon: ShieldAlert,
            iconBg: "bg-emerald-50 dark:bg-emerald-950/30",
            iconColor: "text-emerald-600 dark:text-emerald-400",
            badge: { label: "Done", type: "success" },
          },
        ]}
      />

      <StatusPillTabs
        className="mb-3"
        idPrefix="req-pending-status"
        value={statusFilter}
        onChange={onStatusChange}
        items={[
          { value: "pending", label: "Pending", count: pendingCount },
          { value: "fulfilled", label: "Fulfilled", count: fulfilledCount },
          { value: "all", label: "All tool lines", count: toolLineCount },
        ]}
      />

      <MasterTableCard
        toolbar={
          <>
            <MasterSearchInput
              id="req-pending-search"
              value={search}
              onChange={onSearch}
              placeholder="Search req no, tool no, description…"
              widthClass="w-56"
            />
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="h-7 !rounded-md !px-2 !text-[11px] shrink-0"
              onClick={() => void load(page, search, statusFilter)}
            >
              Refresh
            </Button>
          </>
        }
        footer={
          <TablePager
            page={page}
            pageSize={pageSize}
            total={total}
            onPageChange={(n) => {
              setPage(n);
              void load(n, search, statusFilter);
            }}
            disabled={loading}
            idPrefix="req-pending"
          />
        }
      >
        {error && (
          <p className="px-3 py-2 text-xs font-semibold text-[var(--color-danger-text)] border-b border-[var(--border-main)]">
            {error}
          </p>
        )}

        {loading ? (
          <div className="p-4">
            <TableSkeleton rows={6} />
          </div>
        ) : items.length === 0 ? (
          <div className="py-12 text-center space-y-2 px-4">
            <ClipboardList className="w-8 h-8 text-[var(--text-muted)] mx-auto opacity-50" />
            <p className="text-sm font-semibold text-[var(--text-primary)]">
              No {statusFilter === "pending" ? "pending " : ""}tool requisitions found
            </p>
            <p className="text-xs text-[var(--text-muted)] max-w-lg mx-auto leading-relaxed">
              Source: <span className="font-mono">MATERIAL_REQUISITION_MASTER</span> /{" "}
              <span className="font-mono">MATERIAL_REQUISITION_TRANS</span> where{" "}
              <span className="font-mono">TOOL_GAUGE_NO</span> is set. This table is tools-capable
              but may still be unused in ERP — rows will appear here once shopfloor raises tool
              requisitions.
            </p>
          </div>
        ) : (
          <div className="overflow-auto">
            <table className="w-full text-sm min-w-[960px]">
                <thead>
                  <tr className="border-b-[0.5px] border-[var(--border-main)] bg-[var(--bg-subtle)]">
                    {[
                      "Req No",
                      "Date",
                      "Tool No",
                      "Name / Description",
                      "Req Qty",
                      "Issued",
                      "Balance",
                      "Status",
                      "Machine",
                      "Dept",
                    ].map((col) => (
                      <th
                        key={col}
                        className="text-left text-[11px] font-semibold text-[var(--text-muted)] uppercase tracking-wider py-2.5 px-3 whitespace-nowrap"
                      >
                        {col}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-[var(--border-main)]">
                  {items.map((row) => (
                    <tr key={row.rowId} className="hover:bg-[var(--bg-hover)]">
                      <td className="py-2.5 px-3 font-mono text-xs font-semibold">
                        {row.reqNo ?? "—"}
                      </td>
                      <td className="py-2.5 px-3 font-mono text-[11px]">
                        {fmtDate(row.reqDate)}
                      </td>
                      <td className="py-2.5 px-3 font-mono text-xs">
                        {row.toolOrGaugeNo ?? "—"}
                      </td>
                      <td className="py-2.5 px-3 text-xs max-w-[220px]">
                        <p className="font-medium text-[var(--text-primary)] truncate">
                          {row.toolName || row.description || "—"}
                        </p>
                        {row.toolName && row.description ? (
                          <p className="text-[10px] text-[var(--text-muted)] truncate">
                            {row.description}
                          </p>
                        ) : null}
                      </td>
                      <td className="py-2.5 px-3 font-mono text-xs tabular-nums">
                        {row.reqQty}
                        {row.uom ? ` ${row.uom}` : ""}
                      </td>
                      <td className="py-2.5 px-3 font-mono text-xs tabular-nums">
                        {row.issueQty}
                      </td>
                      <td className="py-2.5 px-3 font-mono text-xs tabular-nums font-semibold">
                        {row.balanceQty}
                      </td>
                      <td className="py-2.5 px-3">
                        <StatusBadge status={row.lineStatus || row.headerStatus || "—"} />
                      </td>
                      <td className="py-2.5 px-3 text-xs text-[var(--text-secondary)]">
                        {row.machine || "—"}
                      </td>
                      <td className="py-2.5 px-3 font-mono text-xs">
                        {row.deptId ?? "—"}
                      </td>
                    </tr>
                  ))}
                </tbody>
            </table>
          </div>
        )}
      </MasterTableCard>
    </SimpleMasterShell>
  );
}
