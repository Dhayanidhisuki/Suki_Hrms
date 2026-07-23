"use client";

import { Search, Bell, ChevronRight } from "lucide-react";
import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useSession } from "@/lib/SessionContext";

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
    <div className="h-14 shrink-0 bg-white border-b border-slate-200 flex items-center px-7 gap-4">
      {/* ── Breadcrumb ── */}
      <div className="flex items-center gap-1.5 text-sm text-slate-400 flex-1 min-w-0 overflow-hidden">
        <span className="hover:text-slate-600 cursor-pointer transition-colors shrink-0">
          SUKI ERP
        </span>
        {breadcrumbs.map((crumb, index) => {
          const isLast = index === breadcrumbs.length - 1;
          return (
            <span key={crumb.href} className="flex items-center gap-1.5 min-w-0">
              <ChevronRight className="w-3.5 h-3.5 shrink-0" />
              {isLast ? (
                <span className="text-slate-700 font-medium truncate">
                  {crumb.label}
                </span>
              ) : (
                <Link
                  href={crumb.href}
                  className="hover:text-slate-600 transition-colors truncate"
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
            className="text-sm border border-slate-200 rounded-lg px-3 py-1.5 w-64 outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-400 transition-all bg-slate-50"
          />
        ) : (
          <button
            id="topbar-search-btn"
            onClick={() => setSearchOpen(true)}
            className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-slate-100 text-slate-400 hover:text-slate-700 transition-colors"
          >
            <Search className="w-4 h-4" />
          </button>
        )}
      </div>

      {/* ── Bell ── */}
      <button
        id="topbar-notification-btn"
        className="relative w-8 h-8 flex items-center justify-center rounded-lg hover:bg-slate-100 text-slate-400 hover:text-slate-700 transition-colors"
      >
        <Bell className="w-4 h-4" />
        <span className="absolute top-1.5 right-1.5 w-1.5 h-1.5 bg-red-500 rounded-full ring-2 ring-white" />
      </button>

      {/* ── Logged In User Pill (ErpUser sample U0001) ── */}
      <div className="flex items-center gap-2 pl-2 border-l border-slate-200">
        <div className="w-7 h-7 rounded-full bg-blue-600 text-white flex items-center justify-center text-[10px] font-bold">
          {user?.userId ?? "..."}
        </div>
        <span className="text-xs font-semibold text-slate-700">
          {user?.name ?? "Loading..."}
        </span>
      </div>
    </div>
  );
}
