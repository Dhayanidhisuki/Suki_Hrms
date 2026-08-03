"use client";

import { HistoryCardShell, HistoryCardPanel, HISTORY_CARD_NAV } from "@/components/HistoryCardShell";
import Link from "next/link";
import { FileText, ExternalLink } from "lucide-react";

export default function Page() {
  return (
    <HistoryCardShell
      title="Purchase Orders"
      subtitle="PO documents live in shared ERP Purchasing — this module links history context only"
    >
      <HistoryCardPanel title="Scope Note">
        <div className="flex items-start gap-3 max-w-2xl">
          <div className="w-10 h-10 rounded-xl bg-[var(--bg-subtle)] flex items-center justify-center shrink-0">
            <FileText className="w-5 h-5 text-[var(--primary)]" />
          </div>
          <div className="space-y-3">
            <p className="text-sm font-semibold text-[var(--text-primary)]">
              Purchase Order screens are owned by ERP Purchasing, not Tools Management.
            </p>
            <p className="text-sm text-[var(--text-secondary)] leading-relaxed">
              Use <strong>GRN History</strong> in this module to verify tools receipts against PO
              numbers. Full PO create/edit remains outside this app by design.
            </p>
            <div className="flex flex-wrap gap-2 pt-1">
              <Link
                href="/dashboard/tools-history-card/grn"
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-[var(--primary)] text-white"
              >
                Open GRN History
              </Link>
              <Link
                href="/dashboard/po-linked/receive"
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold border border-[var(--border-main)] text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
              >
                PO-linked Receive <ExternalLink className="w-3 h-3" />
              </Link>
              <Link
                href="/dashboard/tools-history-card"
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold border border-[var(--border-main)] text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
              >
                Back to History Card
              </Link>
            </div>
            <p className="text-xs text-[var(--text-muted)] pt-2">
              Module destinations:{" "}
              {HISTORY_CARD_NAV.filter((n) => !n.href.endsWith("purchase-orders"))
                .map((n) => n.label)
                .join(" · ")}
            </p>
          </div>
        </div>
      </HistoryCardPanel>
    </HistoryCardShell>
  );
}
