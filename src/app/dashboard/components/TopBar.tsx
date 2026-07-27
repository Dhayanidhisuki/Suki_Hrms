"use client";

import { Search, Bell, ChevronRight, ChevronDown, User, Settings, LogOut, Check } from "lucide-react";
import { useState, useEffect, useRef } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useSession } from "@/lib/SessionContext";

import { ThemeSwitcher } from "@/components/ThemeSwitcher";

function getInitials(name: string) {
  return name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase())
    .join("");
}

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

  const [isNotifOpen, setIsNotifOpen] = useState(false);
  const notifRef = useRef<HTMLDivElement>(null);
  const [isProfileOpen, setIsProfileOpen] = useState(false);
  const profileRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (notifRef.current && !notifRef.current.contains(e.target as Node)) setIsNotifOpen(false);
      if (profileRef.current && !profileRef.current.contains(e.target as Node)) setIsProfileOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  return (
    <header className="h-14 shrink-0 bg-[var(--topbar-bg)] border-b border-[var(--topbar-border)] text-[var(--text-primary)] flex items-center px-5 md:px-7 gap-4 relative z-40 shadow-[0_1px_3px_rgba(0,0,0,0.04)]">
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
      <div className="relative hidden sm:block">
        {searchOpen ? (
          <input
            autoFocus
            onBlur={() => setSearchOpen(false)}
            type="text"
            placeholder="Search tools, empId, gauge no…"
            className="h-[30px] pl-8 pr-3 rounded-lg bg-[var(--bg-subtle)] text-xs text-[var(--text-primary)] placeholder:text-[var(--text-muted)] border border-[var(--border-main)] focus:outline-none focus:ring-2 focus:ring-[var(--primary)]/20 focus:border-[var(--primary)] transition-all w-[220px] lg:w-[280px]"
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

      {/* ── Theme Switcher (Color Dots + Sun/Moon) ── */}
      <ThemeSwitcher />

      {/* ── Notifications ── */}
      <div className="relative" ref={notifRef}>
        <button
          id="topbar-notification-btn"
          onClick={() => setIsNotifOpen((v) => !v)}
          className="relative w-8 h-8 flex items-center justify-center rounded-lg bg-[var(--bg-subtle)] hover:bg-[var(--bg-hover)] border border-[var(--border-main)] text-[var(--text-muted)] hover:text-[var(--text-primary)] transition-colors"
        >
          <Bell className="w-4 h-4" />
          <span className="absolute top-1.5 right-1.5 w-1.5 h-1.5 bg-red-500 rounded-full ring-2 ring-[var(--bg-card)]" />
        </button>

        {isNotifOpen && (
          <div className="absolute top-full mt-2 w-[340px] right-0 bg-[var(--bg-card)] shadow-2xl rounded-2xl overflow-hidden z-50 flex flex-col border border-[var(--border-main)]">
            <div className="bg-[#1A1A1A] text-white p-4">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-bold tracking-wide">Notifications</h3>
                  <div className="flex items-center gap-1.5 mt-0.5">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                    <span className="text-[10px] text-slate-400 uppercase tracking-widest font-semibold">Live</span>
                  </div>
                </div>
                <button className="px-2.5 py-1 rounded-lg bg-white/10 hover:bg-white/20 text-[10px] font-bold flex items-center gap-1 transition-colors">
                  <Check size={10} /> Mark read
                </button>
              </div>
            </div>
            <div className="p-8 text-center text-[var(--text-muted)] text-xs font-semibold">
              All caught up!
            </div>
          </div>
        )}
      </div>

      {/* ── Profile ── */}
      <div className="relative" ref={profileRef}>
        <button
          onClick={() => setIsProfileOpen((v) => !v)}
          className="flex items-center gap-2.5 pl-1 pr-1 py-1 rounded-full hover:bg-[var(--bg-hover)] transition-colors"
        >
          <div className="w-7 h-7 rounded-full bg-[var(--primary)] text-white flex items-center justify-center text-[10px] font-bold shrink-0">
            {getInitials(user?.name || user?.userId || "User")}
          </div>
          <div className="hidden md:block text-left">
            <p className="text-[11px] font-semibold text-[var(--text-primary)] leading-tight">
              {user?.name ?? "Loading..."}
            </p>
            <p className="text-[10px] text-[var(--text-secondary)] font-medium leading-tight">
              {user?.roleName ?? ""}
            </p>
          </div>
          <ChevronDown size={11} className="hidden md:block text-[var(--text-muted)]" />
        </button>

        {isProfileOpen && (
          <div className="absolute top-full mt-2 right-0 w-48 bg-[var(--bg-card)] border border-[var(--border-main)] rounded-2xl shadow-xl overflow-hidden z-50 py-1">
            <button className="w-full text-left px-4 py-2.5 text-sm font-semibold text-[var(--text-primary)] hover:bg-[var(--bg-hover)] transition-colors flex items-center gap-2.5">
              <User size={14} className="text-[var(--text-muted)]" /> Profile
            </button>
            <button className="w-full text-left px-4 py-2.5 text-sm font-semibold text-[var(--text-primary)] hover:bg-[var(--bg-hover)] transition-colors flex items-center gap-2.5">
              <Settings size={14} className="text-[var(--text-muted)]" /> Settings
            </button>
            <div className="h-px bg-[var(--border-main)] my-1" />
            <button className="w-full text-left px-4 py-2.5 text-sm font-bold text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/30 transition-colors flex items-center gap-2.5">
              <LogOut size={14} /> Sign Out
            </button>
          </div>
        )}
      </div>
    </header>
  );
}
