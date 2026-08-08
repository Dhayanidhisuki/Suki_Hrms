"use client";

import { useState } from "react";
import {
  Download,
  FileSpreadsheet,
  FileText,
  CheckCircle2,
  Loader2,
  BarChart3,
  CalendarClock,
  Users,
  Building2,
  History,
  LucideIcon,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { toastError, toastSuccess } from "@/lib/appToast";

type ExportCategory =
  | "tools"
  | "calibration"
  | "suppliers"
  | "subcontractors"
  | "tools-history";

type ExportFormat = "xlsx" | "pdf";

interface CategoryConfig {
  category: ExportCategory;
  label: string;
  description: string;
  icon: LucideIcon;
  accentClass: string;
}

const CATEGORIES: CategoryConfig[] = [
  {
    category: "tools",
    label: "All Tools",
    description: "Full GAUGEANDTOOLS register",
    icon: BarChart3,
    accentClass: "text-[var(--primary)] bg-[var(--primary-light)]",
  },
  {
    category: "calibration",
    label: "Calibration",
    description: "Due / overdue calibration dataset",
    icon: CalendarClock,
    accentClass: "text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/30",
  },
  {
    category: "suppliers",
    label: "Suppliers",
    description: "Full supplier master data",
    icon: Users,
    accentClass: "text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-950/30",
  },
  {
    category: "subcontractors",
    label: "Subcontractors",
    description: "Job-work & lab vendor roster",
    icon: Building2,
    accentClass: "text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/30",
  },
  {
    category: "tools-history",
    label: "Tools History",
    description: "Issue & movement history with lines",
    icon: History,
    accentClass: "text-violet-600 dark:text-violet-400 bg-violet-50 dark:bg-violet-950/30",
  },
];

async function downloadReport(category: ExportCategory, format: ExportFormat) {
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
  const filename =
    match?.[1] ?? `${category}_report.${format === "xlsx" ? "xlsx" : "pdf"}`;
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

interface RowStatus {
  busy: ExportFormat | null;
  result: { type: "success" | "error"; text: string } | null;
}

export function DownloadCenter() {
  const [status, setStatus] = useState<Record<ExportCategory, RowStatus>>({
    tools: { busy: null, result: null },
    calibration: { busy: null, result: null },
    suppliers: { busy: null, result: null },
    subcontractors: { busy: null, result: null },
    "tools-history": { busy: null, result: null },
  });

  const handleDownload = async (category: ExportCategory, format: ExportFormat) => {
    setStatus((prev) => ({
      ...prev,
      [category]: { busy: format, result: null },
    }));

    try {
      const result = await downloadReport(category, format);
      const msg = result.count
        ? `${result.count.toLocaleString()} records — ${result.filename}`
        : result.filename;
      setStatus((prev) => ({
        ...prev,
        [category]: { busy: null, result: { type: "success", text: msg } },
      }));
      toastSuccess(`Downloaded ${result.filename}`);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Export failed";
      setStatus((prev) => ({
        ...prev,
        [category]: { busy: null, result: { type: "error", text: msg } },
      }));
      toastError(msg);
    }
  };

  const anyBusy = Object.values(status).some((s) => s.busy !== null);

  return (
    <div className="bg-[var(--bg-card)] rounded-2xl border border-[var(--border-main)] shadow-[0_1px_3px_0_rgba(0,0,0,0.04)] overflow-hidden mb-6">
      {/* Header */}
      <div className="px-5 py-4 border-b border-[var(--border-main)] bg-gradient-to-r from-[var(--bg-card)] to-[var(--bg-subtle)]">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-[var(--primary-light)] flex items-center justify-center shrink-0">
            <Download className="w-4.5 h-4.5 text-[var(--primary)]" />
          </div>
          <div>
            <h2 className="text-sm font-semibold text-[var(--text-primary)]">
              Download Center
            </h2>
            <p className="text-xs text-[var(--text-muted)] mt-0.5">
              Export full datasets for any report category — Excel or PDF, one click
            </p>
          </div>
        </div>
      </div>

      {/* Category rows */}
      <div className="divide-y divide-[var(--border-main)]">
        {CATEGORIES.map((cat) => {
          const Icon = cat.icon;
          const row = status[cat.category];
          const isBusy = row.busy !== null;

          return (
            <div
              key={cat.category}
              className="px-5 py-3.5 flex items-center gap-4 hover:bg-[var(--bg-hover)] transition-colors group"
            >
              {/* Icon + label */}
              <div className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${cat.accentClass}`}>
                <Icon className="w-4 h-4" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-[var(--text-primary)] truncate">
                  {cat.label}
                </p>
                <p className="text-[11px] text-[var(--text-muted)] truncate mt-0.5">
                  {cat.description}
                </p>
              </div>

              {/* Status feedback */}
              {row.result && (
                <div
                  className={`hidden sm:flex items-center gap-1.5 text-[11px] font-medium max-w-[220px] truncate ${
                    row.result.type === "success"
                      ? "text-emerald-600 dark:text-emerald-400"
                      : "text-rose-600 dark:text-rose-400"
                  }`}
                >
                  {row.result.type === "success" && (
                    <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
                  )}
                  <span className="truncate">{row.result.text}</span>
                </div>
              )}

              {/* Download buttons */}
              <div className="inline-flex rounded-xl border border-[var(--border-main)] overflow-hidden bg-[var(--bg-card)] shadow-xs shrink-0">
                <Button
                  type="button"
                  size="sm"
                  variant="ghost"
                  className="rounded-none border-r border-[var(--border-main)] h-8 px-3 text-xs gap-1.5"
                  disabled={anyBusy}
                  onClick={() => handleDownload(cat.category, "xlsx")}
                >
                  {row.busy === "xlsx" ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <FileSpreadsheet className="w-3.5 h-3.5" />
                  )}
                  {row.busy === "xlsx" ? "Preparing…" : "Excel"}
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant="ghost"
                  className="rounded-none h-8 px-3 text-xs gap-1.5"
                  disabled={anyBusy}
                  onClick={() => handleDownload(cat.category, "pdf")}
                >
                  {row.busy === "pdf" ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <FileText className="w-3.5 h-3.5" />
                  )}
                  {row.busy === "pdf" ? "Preparing…" : "PDF"}
                </Button>
              </div>
            </div>
          );
        })}
      </div>

      {/* Footer hint */}
      <div className="px-5 py-3 border-t border-[var(--border-main)] bg-[var(--bg-subtle)]">
        <p className="text-[11px] text-[var(--text-muted)]">
          Each export downloads the complete dataset for that category. For filtered or preview data, open the individual report page above.
        </p>
      </div>
    </div>
  );
}
