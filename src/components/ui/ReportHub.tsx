"use client";

import Link from "next/link";
import { ReactNode, useState } from "react";
import { ArrowRight, Download, FileSpreadsheet, FileText, type LucideIcon } from "lucide-react";
import PageHeader from "./PageHeader";
import Button from "./Button";
import StatusBadge, { statusTone } from "./StatusBadge";
import { ModuleKpiRow, type ModuleKpiItem } from "./ModuleKpiRow";
import { TableSkeleton } from "./LoadingSkeleton";
import { toastError, toastSuccess } from "@/lib/appToast";

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

interface ReportHubProps {
  title: string;
  subtitle: string;
  kpis?: ModuleKpiItem[];
  /** Analytics chart rendered below the KPIs, above the link cards. */
  chart?: ReactNode;
  /** Chart left + link cards stacked right, one full-width row of equal height. */
  chartBesideLinks?: boolean;
  /** Chart left + a 2×2 KPI grid right. Takes precedence over the default KPI row. */
  chartBesideKpis?: boolean;
  links: ReportLink[];
  previewTitle?: string;
  previewColumns?: PreviewColumn[];
  previewRows?: Record<string, unknown>[];
  previewLoading?: boolean;
  previewEmpty?: string;
  footerNote?: string;
  /**
   * Optional per-row download column. Return a same-origin URL; the hub fetches
   * it with credentials and saves the file.
   */
  previewRowDownload?: {
    label?: string;
    getUrl: (row: Record<string, unknown>) => string | null;
    getFilename?: (row: Record<string, unknown>) => string;
  };
  /**
   * Full-dataset export. Given a format, return the endpoint that streams the
   * whole report — not just the preview rows. HRMS report routes differ per
   * module, so the hub takes a URL builder rather than a fixed category.
   */
  exportUrl?: (format: "xlsx" | "pdf") => string;
  /** Stable row identity for the download column; defaults to the row index. */
  previewRowKey?: (row: Record<string, unknown>, index: number) => string;
  children?: ReactNode;
}

function cell(v: unknown) {
  if (v == null || v === "") return "—";
  if (typeof v === "string" && /^\d{4}-\d{2}-\d{2}/.test(v)) return v.split("T")[0];
  if (typeof v === "number") return v.toLocaleString();
  return String(v);
}

/** Fetch a same-origin URL and save the response as a file. */
async function saveFromUrl(url: string, fallbackName: string) {
  const res = await fetch(url, { credentials: "include" });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(
      typeof body.error === "string" ? body.error : `Download failed (${res.status})`
    );
  }
  const blob = await res.blob();
  const disposition = res.headers.get("Content-Disposition") ?? "";
  const match = disposition.match(/filename="?([^"]+)"?/i);
  const filename = match?.[1] ?? fallbackName;
  const count = res.headers.get("X-Export-Count");

  const objectUrl = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = objectUrl;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(objectUrl);

  return { filename, count: count ? Number(count) : null };
}

function ReportLinkCard({ link, className = "" }: { link: ReportLink; className?: string }) {
  const Icon = link.icon;
  return (
    <Link
      href={link.href}
      className={`group relative flex flex-col rounded-2xl border border-[var(--border-main)] bg-[var(--bg-card)] p-5 transition-all duration-200 hover:border-[var(--primary)]/50 hover:shadow-sm ${className}`}
    >
      <div className="mb-4 flex items-start justify-between gap-3">
        <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-[var(--primary-light)]">
          <Icon className="h-5 w-5 text-[var(--primary)]" />
        </div>
        {link.badge && (
          <span className="rounded-full border border-[var(--border-main)] bg-[var(--bg-subtle)] px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-[var(--text-muted)]">
            {link.badge}
          </span>
        )}
      </div>

      <h3 className="text-sm font-semibold text-[var(--text-primary)] transition-colors group-hover:text-[var(--primary)]">
        {link.title}
      </h3>
      <p className="mt-1.5 flex-1 text-xs leading-relaxed text-[var(--text-muted)]">
        {link.description}
      </p>

      <div className="mt-4 flex items-end justify-between gap-3 border-t border-[var(--border-main)] pt-3">
        <div>
          {link.metric != null && link.metric !== "" ? (
            <>
              <p className="text-xl font-medium tabular-nums tracking-tight text-[var(--text-primary)]">
                {typeof link.metric === "number" ? link.metric.toLocaleString() : link.metric}
              </p>
              {link.metricLabel && (
                <p className="mt-0.5 text-[11px] text-[var(--text-muted)]">{link.metricLabel}</p>
              )}
            </>
          ) : (
            <p className="text-[11px] text-[var(--text-muted)]">Open report</p>
          )}
        </div>
        <span className="inline-flex items-center gap-1 text-xs font-medium text-[var(--primary)] opacity-80 group-hover:opacity-100">
          View
          <ArrowRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5" />
        </span>
      </div>
    </Link>
  );
}

/**
 * Landing page for a reports module: KPIs, an optional chart, a grid of report
 * link cards, and a live preview table with full-dataset export.
 */
export function ReportHub({
  title,
  subtitle,
  kpis,
  chart,
  chartBesideLinks = false,
  chartBesideKpis = false,
  links,
  previewTitle,
  previewColumns,
  previewRows,
  previewLoading,
  previewEmpty = "No preview rows available.",
  footerNote,
  previewRowDownload,
  exportUrl,
  previewRowKey,
  children,
}: ReportHubProps) {
  const rows = previewRows ?? [];
  const [busy, setBusy] = useState<"xlsx" | "pdf" | null>(null);
  const [rowBusyKey, setRowBusyKey] = useState<string | null>(null);
  const [exportMsg, setExportMsg] = useState<{ type: "success" | "error"; text: string } | null>(
    null
  );

  const downloadRow = async (row: Record<string, unknown>, rowKey: string) => {
    if (!previewRowDownload) return;
    const url = previewRowDownload.getUrl(row);
    if (!url) {
      toastError("No document available to download");
      return;
    }
    setRowBusyKey(rowKey);
    try {
      const fallback =
        previewRowDownload.getFilename?.(row) ?? `report_${rowKey.replace(/[^\w-]+/g, "_")}.pdf`;
      const { filename } = await saveFromUrl(url, fallback);
      toastSuccess(`Downloaded ${filename}`);
    } catch (err) {
      toastError(err instanceof Error ? err.message : "Download failed");
    } finally {
      setRowBusyKey(null);
    }
  };

  const runExport = async (format: "xlsx" | "pdf") => {
    if (!exportUrl) return;
    setExportMsg(null);
    setBusy(format);
    try {
      const result = await saveFromUrl(exportUrl(format), `report.${format}`);
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

  const splitChartLinks = Boolean(chart && chartBesideLinks);
  const splitChartKpis = Boolean(chart && chartBesideKpis && kpis && kpis.length > 0);

  return (
    <div className="space-y-6">
      <PageHeader title={title} description={subtitle} />

      {splitChartKpis ? (
        <div className="grid w-full grid-cols-1 items-stretch gap-4 lg:grid-cols-3">
          <div className="flex min-w-0 flex-col lg:col-span-2 [&>*]:mb-0 [&>*]:h-full [&>*]:flex-1">
            {chart}
          </div>
          <ModuleKpiRow items={kpis!} columns={2} className="mb-0 h-full content-stretch" />
        </div>
      ) : (
        kpis && kpis.length > 0 && <ModuleKpiRow items={kpis} className="mb-0" />
      )}

      {splitChartLinks ? (
        <div className="grid w-full grid-cols-1 items-stretch gap-4 lg:grid-cols-3">
          <div className="flex min-w-0 flex-col lg:col-span-2 [&>*]:mb-0 [&>*]:h-full [&>*]:flex-1">
            {chart}
          </div>
          <div className="flex h-full min-w-0 flex-col gap-4">
            {links.map((link) => (
              <ReportLinkCard key={link.href} link={link} className="flex-1" />
            ))}
          </div>
        </div>
      ) : (
        <>
          {!splitChartKpis && chart}
          <div className="grid w-full grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
            {links.map((link) => (
              <ReportLinkCard key={link.href} link={link} />
            ))}
          </div>
        </>
      )}

      {children}

      {previewColumns && (
        <div className="space-y-3">
          {exportUrl && (
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wider text-[var(--text-muted)]">
                  Export
                </p>
                <p className="mt-0.5 text-xs text-[var(--text-muted)]">
                  Download the full dataset, not only the preview rows below.
                </p>
              </div>
              <div className="inline-flex overflow-hidden rounded-xl border border-[var(--border-main)] bg-[var(--bg-card)] shadow-xs">
                <Button
                  type="button"
                  size="sm"
                  variant="ghost"
                  className="rounded-none border-r border-[var(--border-main)]"
                  disabled={!!busy}
                  onClick={() => runExport("xlsx")}
                  leftIcon={<FileSpreadsheet className="h-3.5 w-3.5" />}
                >
                  {busy === "xlsx" ? "Preparing…" : "Export Excel"}
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant="ghost"
                  className="rounded-none"
                  disabled={!!busy}
                  onClick={() => runExport("pdf")}
                  leftIcon={<FileText className="h-3.5 w-3.5" />}
                >
                  {busy === "pdf" ? "Preparing…" : "Export PDF"}
                </Button>
              </div>
            </div>
          )}

          {exportMsg && (
            <div
              className={`rounded-xl border border-[var(--border-main)] px-4 py-3 text-sm font-medium ${
                exportMsg.type === "success"
                  ? "bg-[var(--color-success-bg)] text-[var(--color-success-text)]"
                  : "bg-[var(--color-danger-bg)] text-[var(--color-danger-text)]"
              }`}
            >
              {exportMsg.text}
            </div>
          )}

          <div className="rounded-2xl border border-[var(--border-main)] bg-[var(--bg-card)] p-5">
            <div className="mb-4">
              <h2 className="text-sm font-semibold text-[var(--text-primary)]">
                {previewTitle ?? "Live preview"}
              </h2>
              <p className="mt-0.5 text-xs text-[var(--text-muted)]">
                {footerNote ??
                  "Preview only. Use Export Excel / PDF above for the complete dataset."}
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
                          className="px-3 py-2.5 text-left text-[11px] font-semibold uppercase tracking-wider text-[var(--text-muted)]"
                        >
                          {col.label}
                        </th>
                      ))}
                      {previewRowDownload && (
                        <th className="w-16 px-3 py-2.5 text-right text-[11px] font-semibold uppercase tracking-wider text-[var(--text-muted)]">
                          {previewRowDownload.label ?? "PDF"}
                        </th>
                      )}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[var(--border-main)]">
                    {rows.map((row, idx) => {
                      const key = previewRowKey?.(row, idx) ?? String(idx);
                      const canDownload = Boolean(previewRowDownload?.getUrl(row));
                      return (
                        <tr key={key} className="transition-colors hover:bg-[var(--bg-hover)]">
                          {previewColumns.map((col) => {
                            const isStatusCol =
                              col.key.toLowerCase().includes("status") ||
                              col.label.toLowerCase().includes("status");
                            const value = row[col.key];
                            return (
                              <td
                                key={col.key}
                                className={`px-3 py-2.5 text-xs text-[var(--text-secondary)] ${
                                  col.mono ? "font-mono" : ""
                                }`}
                              >
                                {isStatusCol && value != null && value !== "" ? (
                                  <StatusBadge tone={statusTone(String(value))} dot>
                                    {String(value)}
                                  </StatusBadge>
                                ) : (
                                  cell(value)
                                )}
                              </td>
                            );
                          })}
                          {previewRowDownload && (
                            <td className="px-3 py-2.5 text-right">
                              <button
                                type="button"
                                title={canDownload ? "Download PDF" : "No document available"}
                                disabled={!canDownload || rowBusyKey === key}
                                onClick={() => void downloadRow(row, key)}
                                className="inline-flex rounded-lg p-1.5 text-[var(--primary)] hover:bg-[var(--primary-light)] disabled:pointer-events-none disabled:opacity-40"
                              >
                                <Download className="h-3.5 w-3.5" />
                              </button>
                            </td>
                          )}
                        </tr>
                      );
                    })}
                    {rows.length === 0 && (
                      <tr>
                        <td
                          colSpan={previewColumns.length + (previewRowDownload ? 1 : 0)}
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
        </div>
      )}
    </div>
  );
}
