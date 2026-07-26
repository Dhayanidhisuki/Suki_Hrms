"use client";

import { Search, Bell, ChevronRight } from "lucide-react";
import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useSession } from "@/lib/SessionContext";

import { ThemeSwitcher } from "@/components/ThemeSwitcher";

function formatSegment(segment: string) {
  return segment
    .split("-")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}

function useBreadcrumbs() {
  const pathname = usePathname();

  if (pathname === "/") {
    return [{ label: "Dashboard", href: "/" }];
  }

  const segments = pathname.split("/").filter(Boolean);
  let href = "";
  const crumbs = segments.map((segment) => {
    href += `/${segment}`;
    return { label: formatSegment(segment), href };
  });

  return [{ label: "Dashboard", href: "/" }, ...crumbs];
}

export default function TopBar() {
  const [searchOpen, setSearchOpen] = useState(false);
  const breadcrumbs = useBreadcrumbs();
  const { user } = useSession();

  return (
    <div className="h-14 shrink-0 bg-[var(--bg-surface)] border-b border-[var(--border-main)] text-[var(--text-primary)] flex items-center px-7 gap-4">
      {/* ── Breadcrumb ── */}
      <div className="flex items-center gap-1.5 text-sm text-[var(--text-muted)] flex-1 min-w-0 overflow-hidden">
        <span className="hover:text-[var(--text-primary)] cursor-pointer transition-colors shrink-0">
          SUKI ERP
        </span>
        {breadcrumbs.map((crumb, index) => {
          const isLast = index === breadcrumbs.length - 1;
          return (
            <span key={crumb.href} className="flex items-center gap-1.5 min-w-0">
              <ChevronRight className="w-3.5 h-3.5 shrink-0" />
              {isLast ? (
                <span className="text-[var(--text-primary)] font-medium truncate">
                  {crumb.label}
                </span>
              ) : (
                <Link
                  href={crumb.href}
                  className="hover:text-[var(--text-primary)] transition-colors truncate"
                >
                  {crumb.label}
                </Link>
              )}
            </span>
          );
        })}
      </div>

      {/* ── Search ── */}
      <div className="flex items-center">
        {searchOpen ? (
          <input
            autoFocus
            onBlur={() => setSearchOpen(false)}
            type="text"
            placeholder="Search tools, empId, gauge no…"
            className="text-sm border border-[var(--border-main)] rounded-lg px-3 py-1.5 w-64 outline-none focus:ring-2 focus:ring-[var(--primary)] focus:border-[var(--primary)] transition-all bg-[var(--bg-subtle)] text-[var(--text-primary)]"
          />
        ) : (
          <button
            id="topbar-search-btn"
            onClick={() => setSearchOpen(true)}
            className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-[var(--bg-hover)] text-[var(--text-muted)] hover:text-[var(--text-primary)] transition-colors"
          >
            <Search className="w-4 h-4" />
          </button>
        )}
      </div>

      {/* ── Bell ── */}
      <button
        id="topbar-notification-btn"
        className="relative w-8 h-8 flex items-center justify-center rounded-lg hover:bg-[var(--bg-hover)] text-[var(--text-muted)] hover:text-[var(--text-primary)] transition-colors"
      >
        <Bell className="w-4 h-4" />
        <span className="absolute top-1.5 right-1.5 w-1.5 h-1.5 bg-red-500 rounded-full ring-2 ring-white" />
      </button>

      {/* ── Theme Switcher (Color Dots + Sun/Moon) ── */}
      <ThemeSwitcher />

      {/* ── Logged In User Pill (ErpUser sample U0001) ── */}
      <div className="flex items-center gap-2 pl-2 border-l border-[var(--border-main)]">
        <div className="w-7 h-7 rounded-full bg-[var(--primary)] text-white flex items-center justify-center text-[10px] font-bold">
          {user?.userId ?? "..."}
        </div>
        <span className="text-xs font-semibold text-[var(--text-primary)]">
          {user?.name ?? "Loading..."}
        </span>
      </div>
    </div>
  );
}
