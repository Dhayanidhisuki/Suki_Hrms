"use client";

import Link from "next/link";
import { ReactNode, useState } from "react";
import { LucideIcon, ArrowRight, FileSpreadsheet, FileText } from "lucide-react";
import { SimpleMasterShell } from "@/components/SimpleMasterShell";
import { ModuleKpiRow, ModuleKpiItem } from "@/app/dashboard/components/ModuleKpiRow";
import { TableSkeleton } from "@/app/dashboard/components/LoadingSkeleton";
import { Button } from "@/components/ui/button";
import { StatusBadge } from "@/components/ui/StatusBadge";

export interface ReportLink {
  href: string;
  title: string;
  description: string;
  icon: LucideIcon;
  metric?: string | number | null;
  metricLabel?: string;
  badge?: string;
}

export interface PreviewColumn {
  key: string;
  label: string;
  mono?: boolean;
}

export type ReportExportCategory =
  | "tools"
  | "calibration"
  | "suppliers"
  | "subcontractors"
  | "tools-history";

interface ReportHubProps {
  title: string;
  subtitle: string;
  kpis?: ModuleKpiItem[];
  /** Analytics chart rendered below KPIs, above link cards */
  chart?: ReactNode;
  links: ReportLink[];
  previewTitle?: string;
  previewColumns?: PreviewColumn[];
  previewRows?: Record<string, unknown>[];
  previewLoading?: boolean;
  previewEmpty?: string;
  footerNote?: string;
  /** Server export category — downloads ALL records for this report */
  exportCategory?: ReportExportCategory;
  children?: ReactNode;
}

function cell(v: unknown) {
  if (v == null || v === "") return "—";
  if (typeof v === "string" && /^\d{4}-\d{2}-\d{2}/.test(v)) return v.split("T")[0];
  if (typeof v === "number") return v.toLocaleString();
  return String(v);
}

async function downloadFullReport(category: ReportExportCategory, format: "xlsx" | "pdf") {
  const res = await fetch(`/api/reports/${category}?format=${format}`, {
    credentials: "include",
  });

  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(
      typeof body.error === "string" ? body.error : `Export failed (${res.status})`
    );
  }

  const blob = await res.blob();
  const disposition = res.headers.get("Content-Disposition") ?? "";
  const match = disposition.match(/filename="?([^"]+)"?/i);
  const filename = match?.[1] ?? `${category}_report.${format === "xlsx" ? "xlsx" : "pdf"}`;
  const count = res.headers.get("X-Export-Count");

  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);

  return { filename, count: count ? Number(count) : null };
}

export function ReportHub({
  title,
  subtitle,
  kpis,
  chart,
  links,
  previewTitle,
  previewColumns,
  previewRows,
  previewLoading,
  previewEmpty = "No preview rows available.",
  footerNote,
  exportCategory,
  children,
}: ReportHubProps) {
  const rows = previewRows ?? [];
  const [busy, setBusy] = useState<"xlsx" | "pdf" | null>(null);
  const [exportMsg, setExportMsg] = useState<{ type: "success" | "error"; text: string } | null>(
    null
  );

  const runExport = async (format: "xlsx" | "pdf") => {
    if (!exportCategory) return;
    setExportMsg(null);
    setBusy(format);
    try {
      const result = await downloadFullReport(exportCategory, format);
      setExportMsg({
        type: "success",
        text: result.count
          ? `Downloaded full ${format.toUpperCase()} — ${result.count.toLocaleString()} records (${result.filename})`
          : `Downloaded full ${format.toUpperCase()}: ${result.filename}`,
      });
    } catch (err) {
      setExportMsg({
        type: "error",
        text: err instanceof Error ? err.message : "Export failed",
      });
    } finally {
      setBusy(null);
    }
  };

  return (
    <SimpleMasterShell title={title} subtitle={subtitle}>
      {kpis && kpis.length > 0 && <ModuleKpiRow items={kpis} />}

      {chart}

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4 mb-6">
        {links.map((link) => {
          const Icon = link.icon;
          return (
            <Link
              key={link.href}
              href={link.href}
              className="group relative flex flex-col bg-[var(--bg-card)] border border-[var(--border-main)] rounded-2xl p-5 hover:border-[var(--primary)]/50 hover:shadow-sm transition-all duration-200"
            >
              <div className="flex items-start justify-between gap-3 mb-4">
                <div className="w-11 h-11 rounded-xl bg-[var(--primary-light)] flex items-center justify-center shrink-0">
                  <Icon className="w-5 h-5 text-[var(--primary)]" />
                </div>
                {link.badge && (
                  <span className="text-[10px] font-semibold uppercase tracking-wider px-2 py-0.5 rounded-full bg-[var(--bg-subtle)] text-[var(--text-muted)] border border-[var(--border-main)]">
                    {link.badge}
                  </span>
                )}
              </div>

              <h3 className="text-sm font-semibold text-[var(--text-primary)] group-hover:text-[var(--primary)] transition-colors">
                {link.title}
              </h3>
              <p className="text-xs text-[var(--text-muted)] mt-1.5 leading-relaxed flex-1">
                {link.description}
              </p>

              <div className="mt-4 pt-3 border-t border-[var(--border-main)] flex items-end justify-between gap-3">
                <div>
                  {link.metric != null && link.metric !== "" ? (
                    <>
                      <p className="text-xl font-medium tabular-nums text-[var(--text-primary)] tracking-tight">
                        {typeof link.metric === "number" ? link.metric.toLocaleString() : link.metric}
                      </p>
                      {link.metricLabel && (
                        <p className="text-[11px] text-[var(--text-muted)] mt-0.5">{link.metricLabel}</p>
                      )}
                    </>
                  ) : (
                    <p className="text-[11px] text-[var(--text-muted)]">Open report</p>
                  )}
                </div>
                <span className="inline-flex items-center gap-1 text-xs font-medium text-[var(--primary)] opacity-80 group-hover:opacity-100">
                  View
                  <ArrowRight className="w-3.5 h-3.5 transition-transform group-hover:translate-x-0.5" />
                </span>
              </div>
            </Link>
          );
        })}
      </div>

      {children}

      {previewColumns && (
        <>
          {exportCategory && (
            <div className="mb-3 flex items-center justify-between gap-3 flex-wrap">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wider text-[var(--text-muted)]">
                  Export
                </p>
                <p className="text-xs text-[var(--text-muted)] mt-0.5">
                  Download the full category dataset (not only the preview rows below).
                </p>
              </div>
              <div className="inline-flex rounded-xl border border-[var(--border-main)] overflow-hidden bg-[var(--bg-card)] shadow-xs">
                <Button
                  type="button"
                  size="sm"
                  variant="ghost"
                  className="rounded-none border-r border-[var(--border-main)]"
                  disabled={!!busy}
                  onClick={() => runExport("xlsx")}
                >
                  <FileSpreadsheet className="w-3.5 h-3.5" />
                  {busy === "xlsx" ? "Preparing…" : "Export Excel"}
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant="ghost"
                  className="rounded-none"
                  disabled={!!busy}
                  onClick={() => runExport("pdf")}
                >
                  <FileText className="w-3.5 h-3.5" />
                  {busy === "pdf" ? "Preparing…" : "Export PDF"}
                </Button>
              </div>
            </div>
          )}

          {exportMsg && (
            <div
              className={`mb-3 px-4 py-3 rounded-xl text-sm font-medium ${
                exportMsg.type === "success"
                  ? "bg-[var(--color-success-bg)] text-[var(--color-success-text)] border border-[var(--border-main)]"
                  : "bg-[var(--color-danger-bg)] text-[var(--color-danger-text)] border border-[var(--border-main)]"
              }`}
            >
              {exportMsg.text}
            </div>
          )}

          <div className="bg-[var(--bg-card)] rounded-2xl border border-[var(--border-main)] p-5">
            <div className="mb-4">
              <h2 className="text-sm font-semibold text-[var(--text-primary)]">
                {previewTitle ?? "Live preview"}
              </h2>
              <p className="text-xs text-[var(--text-muted)] mt-0.5">
                {footerNote ??
                  "Preview only. Use Export Excel / PDF above for the complete category dataset."}
              </p>
            </div>

            {previewLoading ? (
              <TableSkeleton rows={6} />
            ) : (
              <div className="overflow-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-[var(--border-main)] bg-[var(--bg-subtle)]">
                      {previewColumns.map((col) => (
                        <th
                          key={col.key}
                          className="text-left text-[11px] font-semibold text-[var(--text-muted)] uppercase tracking-wider py-2.5 px-3"
                        >
                          {col.label}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[var(--border-main)]">
                    {rows.map((row, idx) => (
                      <tr key={idx} className="hover:bg-[var(--bg-hover)] transition-colors">
                        {previewColumns.map((col) => {
                          const isStatusCol =
                            col.key.toLowerCase().includes("status") ||
                            col.label.toLowerCase().includes("status");
                          return (
                            <td
                              key={col.key}
                              className={`py-2.5 px-3 text-xs text-[var(--text-secondary)] ${
                                col.mono ? "font-mono" : ""
                              }`}
                            >
                              {isStatusCol ? (
                                <StatusBadge status={row[col.key]} />
                              ) : (
                                cell(row[col.key])
                              )}
                            </td>
                          );
                        })}
                      </tr>
                    ))}
                    {rows.length === 0 && (
                      <tr>
                        <td
                          colSpan={previewColumns.length}
                          className="py-10 text-center text-sm text-[var(--text-muted)]"
                        >
                          {previewEmpty}
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </>
      )}
    </SimpleMasterShell>
  );
}
