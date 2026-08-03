"use client";

import { ReactNode } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  History,
  Gauge,
  Users,
  ArrowUpRight,
  ArrowDownLeft,
  CalendarClock,
  ClipboardList,
  Package,
  FileText,
  LucideIcon,
} from "lucide-react";
import Sidebar from "@/app/dashboard/components/Sidebar";
import TopBar from "@/app/dashboard/components/TopBar";
import { ModuleKpiRow, ModuleKpiItem } from "@/app/dashboard/components/ModuleKpiRow";

export const HISTORY_CARD_NAV: {
  href: string;
  label: string;
  short: string;
  icon: LucideIcon;
  description: string;
}[] = [
  {
    href: "/dashboard/tools-history-card",
    label: "History Card",
    short: "Card",
    icon: History,
    description: "Per-tool unit lifecycle card",
  },
  {
    href: "/dashboard/tools-history-card/status",
    label: "Current Status",
    short: "Status",
    icon: Gauge,
    description: "Roll-up status from serial units",
  },
  {
    href: "/dashboard/tools-history-card/holder",
    label: "Current Holder",
    short: "Holder",
    icon: Users,
    description: "Who holds issued tools now",
  },
  {
    href: "/dashboard/tools-history-card/issue",
    label: "Issue History",
    short: "Issue",
    icon: ArrowUpRight,
    description: "Tool issue DC history",
  },
  {
    href: "/dashboard/tools-history-card/receive",
    label: "Receive History",
    short: "Receive",
    icon: ArrowDownLeft,
    description: "Tool return / receive history",
  },
  {
    href: "/dashboard/tools-history-card/calibration",
    label: "Calibration Records",
    short: "Calib",
    icon: CalendarClock,
    description: "Calibration issue DCs",
  },
  {
    href: "/dashboard/tools-history-card/calibration-results",
    label: "Calibration Results",
    short: "Results",
    icon: ClipboardList,
    description: "Calib due / results lines",
  },
  {
    href: "/dashboard/tools-history-card/grn",
    label: "GRN History",
    short: "GRN",
    icon: Package,
    description: "PO goods receipt history",
  },
  {
    href: "/dashboard/tools-history-card/purchase-orders",
    label: "Purchase Orders",
    short: "PO",
    icon: FileText,
    description: "PO references (ERP purchasing)",
  },
];

interface HistoryCardShellProps {
  title: string;
  subtitle?: string;
  kpis?: ModuleKpiItem[];
  actions?: ReactNode;
  toolbar?: ReactNode;
  children: ReactNode;
}

function navActive(pathname: string, href: string) {
  if (href === "/dashboard/tools-history-card") {
    return pathname === href;
  }
  return pathname === href || pathname.startsWith(`${href}/`);
}

export function HistoryCardShell({
  title,
  subtitle,
  kpis,
  actions,
  toolbar,
  children,
}: HistoryCardShellProps) {
  const pathname = usePathname();

  return (
    <div className="flex h-screen bg-[var(--bg-app)] text-[var(--text-primary)] overflow-hidden">
      <Sidebar />
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        <TopBar />
        <main className="flex-1 overflow-y-auto px-7 py-6">
          <div className="mb-5 flex items-start justify-between gap-4 flex-wrap">
            <div>
              <p className="text-[11px] font-bold uppercase tracking-widest text-[var(--text-muted)] mb-1">
                Tools History Card
              </p>
              <h1 className="text-2xl font-bold text-[var(--text-primary)] tracking-tight">{title}</h1>
              {subtitle && (
                <p className="text-sm text-[var(--text-muted)] mt-0.5 max-w-2xl">{subtitle}</p>
              )}
            </div>
            {actions}
          </div>

          <nav
            aria-label="History Card module"
            className="mb-6 -mx-1 overflow-x-auto"
          >
            <div className="flex gap-1.5 min-w-max px-1 pb-1">
              {HISTORY_CARD_NAV.map((item) => {
                const Icon = item.icon;
                const active = navActive(pathname, item.href);
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    title={item.description}
                    className={`inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold border transition-colors ${
                      active
                        ? "bg-[var(--primary)] text-white border-[var(--primary)] shadow-sm"
                        : "bg-[var(--bg-card)] text-[var(--text-secondary)] border-[var(--border-main)] hover:bg-[var(--bg-hover)] hover:text-[var(--text-primary)]"
                    }`}
                  >
                    <Icon className="w-3.5 h-3.5 shrink-0" />
                    <span className="hidden lg:inline">{item.label}</span>
                    <span className="lg:hidden">{item.short}</span>
                  </Link>
                );
              })}
            </div>
          </nav>

          {kpis && kpis.length > 0 && <ModuleKpiRow items={kpis} />}

          {toolbar && <div className="mb-5">{toolbar}</div>}

          {children}
        </main>
      </div>
    </div>
  );
}

/** Shared search field used across history-card subpages */
export function HistoryCardSearch({
  value,
  onChange,
  placeholder = "Search…",
  hint,
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  hint?: string;
}) {
  return (
    <div className="bg-[var(--bg-card)] rounded-2xl border border-[var(--border-main)] p-4">
      <div className="relative max-w-md">
        <svg
          className="w-4 h-4 text-[var(--text-muted)] absolute left-3 top-1/2 -translate-y-1/2"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
        >
          <circle cx="11" cy="11" r="8" />
          <path d="m21 21-4.3-4.3" />
        </svg>
        <input
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          className="w-full text-sm border border-[var(--border-main)] rounded-lg pl-9 pr-3 py-2 outline-none focus:ring-2 focus:ring-[var(--primary-subtle)] focus:border-[var(--primary)] bg-[var(--bg-subtle)] text-[var(--text-primary)] placeholder-[var(--text-muted)]"
        />
      </div>
      {hint && <p className="text-xs text-[var(--text-muted)] mt-2">{hint}</p>}
    </div>
  );
}

export function HistoryCardPanel({
  title,
  subtitle,
  actions,
  children,
  className = "",
}: {
  title?: string;
  subtitle?: string;
  actions?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={`bg-[var(--bg-card)] rounded-2xl border border-[var(--border-main)] overflow-hidden ${className}`}
    >
      {(title || actions) && (
        <div className="px-5 py-3.5 border-b border-[var(--border-main)] flex items-center justify-between gap-3 bg-[var(--bg-subtle)]/60">
          <div>
            {title && (
              <h2 className="text-sm font-bold text-[var(--text-primary)] uppercase tracking-wider">
                {title}
              </h2>
            )}
            {subtitle && <p className="text-xs text-[var(--text-muted)] mt-0.5">{subtitle}</p>}
          </div>
          {actions}
        </div>
      )}
      <div className="p-5">{children}</div>
    </div>
  );
}

export function fmtCell(v: unknown) {
  if (v == null || v === "") return "—";
  if (typeof v === "string" && /^\d{4}-\d{2}-\d{2}/.test(v)) return v.split("T")[0];
  if (typeof v === "number") return Number.isInteger(v) ? String(v) : v.toLocaleString();
  return String(v);
}
