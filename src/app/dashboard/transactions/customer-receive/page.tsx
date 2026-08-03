"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { SimpleMasterShell } from "@/components/SimpleMasterShell";
import { TableSkeleton } from "@/app/dashboard/components/LoadingSkeleton";
import { ModuleKpiRow } from "@/app/dashboard/components/ModuleKpiRow";
import { apiGet } from "@/lib/apiClient";
import { ArrowDownLeft, Building2, FileText } from "lucide-react";

interface IssueLine {
  rowId: number;
  toolOrGaugeNo: string | null;
  name?: string | null;
  description?: string | null;
  issueQty: number | string;
}

interface IssueHeader {
  dcNo: string;
  receiveName: string | null;
  issueDate: string | null;
  dueDate: string | null;
  status: string | null;
  custCode?: string | null;
  issuePurpose?: string | null;
  lines?: IssueLine[];
}

export default function CustomerReceivePage() {
  const [items, setItems] = useState<IssueHeader[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const res = await apiGet<{ items: IssueHeader[] }>("/api/issue?customerOnly=1&pageSize=50");
      setItems(res.data?.items ?? []);
      setLoading(false);
    })();
  }, []);

  return (
    <SimpleMasterShell
      title="Tool Receive From Customer"
      subtitle="Filtered view of GAUGE_TOOLS_ISSUE where CUST_CODE is present — not a separate table"
      actions={
        <Link href="/dashboard/transactions/issue" className="text-xs font-semibold text-[var(--primary)] hover:underline">
          Open full Tool Issue →
        </Link>
      }
    >
      <ModuleKpiRow
        items={[
          {
            id: "cust-dcs",
            label: "Customer DCs (page)",
            value: items.length,
            subtext: "Loaded records with CUST_CODE",
            icon: Building2,
            iconBg: "bg-[var(--primary-light)]",
            iconColor: "text-[var(--primary)]",
            badge: { label: "Filter", type: "info" },
          },
          {
            id: "active",
            label: "Active",
            value: items.filter((i) => i.status === "Active" || i.status === "OPEN").length,
            subtext: "Still open customer returns",
            icon: ArrowDownLeft,
            iconBg: "bg-emerald-50 dark:bg-emerald-950/30",
            iconColor: "text-emerald-600",
            badge: { label: "Open", type: "success" },
          },
          {
            id: "lines",
            label: "Line Items",
            value: items.reduce((acc, i) => acc + (i.lines?.length ?? 0), 0),
            subtext: "Tools on customer DCs",
            icon: FileText,
            iconBg: "bg-blue-50 dark:bg-blue-950/30",
            iconColor: "text-blue-600",
            badge: { label: "Lines", type: "info" },
          },
        ]}
      />

      <div className="bg-[var(--bg-card)] rounded-2xl border border-[var(--border-main)] p-5">
        {loading ? (
          <TableSkeleton rows={4} />
        ) : items.length === 0 ? (
          <div className="py-10 text-center space-y-2">
            <p className="text-sm text-[var(--text-muted)]">
              No customer-linked DCs in the current issue page load.
            </p>
            <p className="text-xs text-[var(--text-muted)]">
              ERP has records where CUST_CODE is set (e.g. customer gauge returns). Ensure the Issue API exposes CUST_CODE so this filtered view can populate.
            </p>
          </div>
        ) : (
          <div className="overflow-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-[var(--border-main)] bg-[var(--bg-subtle)]">
                  {["DC No", "Customer Code", "Receive Name", "Purpose", "Issue Date", "Status", "Lines"].map((col) => (
                    <th key={col} className="text-left text-[11px] font-semibold text-[var(--text-muted)] uppercase tracking-wider py-2.5 px-3">
                      {col}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--border-main)]">
                {items.map((issue) => (
                  <tr key={issue.dcNo} className="hover:bg-[var(--bg-hover)]">
                    <td className="py-3 px-3 font-mono text-xs">{issue.dcNo}</td>
                    <td className="py-3 px-3 font-mono text-xs">{issue.custCode ?? "—"}</td>
                    <td className="py-3 px-3">{issue.receiveName ?? "—"}</td>
                    <td className="py-3 px-3 text-[var(--text-muted)] max-w-xs truncate">{issue.issuePurpose ?? "—"}</td>
                    <td className="py-3 px-3 font-mono text-xs">{issue.issueDate ? issue.issueDate.split("T")[0] : "—"}</td>
                    <td className="py-3 px-3">{issue.status ?? "—"}</td>
                    <td className="py-3 px-3 font-mono text-xs">{issue.lines?.length ?? 0}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </SimpleMasterShell>
  );
}
