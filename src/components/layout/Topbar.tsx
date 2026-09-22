"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import {
  Calendar,
  ChevronDown,
  LogOut,
  Menu,
  Search,
  Settings,
  User,
} from "lucide-react";
import NotificationDropdown from "./NotificationDropdown";
import { ThemeSwitcher } from "@/components/ThemeSwitcher";
import { fetchCurrentUser } from "@/lib/currentUser";

interface TopbarProps {
  onMenuClick: () => void;
}

interface CurrentUser {
  email: string | null;
  isSuperAdmin: boolean;
  roleCode: string | null;
  companyName: string | null;
  name: string | null;
}

const roleLabel = (me: CurrentUser | null): string => {
  if (!me) return "—";
  if (me.isSuperAdmin) return "Superadmin";
  if (!me.roleCode) return "User";
  return me.roleCode.replace(/-/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
};

const initials = (me: CurrentUser | null): string => {
  const source = me?.name || me?.email?.split("@")[0] || "?";
  return source
    .split(/[\s._-]+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((word) => word[0]?.toUpperCase())
    .join("");
};

export default function Topbar({ onMenuClick }: TopbarProps) {
  const [me, setMe] = useState<CurrentUser | null>(null);
  const [profileOpen, setProfileOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [now, setNow] = useState<Date | null>(null);
  const profileRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let cancelled = false;
    fetchCurrentUser()
      .then((data) => {
        if (!cancelled && data) {
          setMe({
            email: data.email,
            isSuperAdmin: data.isSuperAdmin,
            roleCode: data.roleCode,
            companyName: data.companyName,
            name: data.employeeName || null,
          });
        }
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, []);

  // Live clock — rendered only after mount so SSR and client agree.
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setNow(new Date());
    const id = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (profileRef.current && !profileRef.current.contains(e.target as Node)) {
        setProfileOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const formattedDate = now
    ? now.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" })
    : "";
  const formattedTime = now
    ? now.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit", hour12: false })
    : "";

  return (
    <header className="relative z-40 mx-4 mt-4 flex h-14 shrink-0 items-center justify-between gap-3 rounded-3xl border border-[var(--topbar-border)] bg-[var(--topbar-bg)] px-4 text-[var(--text-primary)] shadow-[0_1px_3px_rgba(0,0,0,0.03)] md:px-5">
      {/* Left: sidebar toggle + global search */}
      <div className="flex min-w-0 max-w-xl flex-1 items-center gap-3">
        <button
          type="button"
          onClick={onMenuClick}
          title="Toggle sidebar menu"
          aria-label="Toggle sidebar menu"
          className="flex h-8 w-8 shrink-0 cursor-pointer items-center justify-center rounded-xl border border-[var(--border-main)] bg-[var(--bg-subtle)] text-[var(--text-secondary)] shadow-xs transition-colors hover:bg-[var(--primary-light)] hover:text-[var(--primary)]"
        >
          <Menu className="h-4 w-4" />
        </button>

        <div className="relative min-w-0 flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-[var(--text-muted)]" />
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search employees, leave, payroll, reports..."
            className="h-8 w-full rounded-xl border border-[var(--border-main)] bg-[var(--bg-subtle)] pl-8 pr-3 font-sans text-xs text-[var(--text-primary)] placeholder-[var(--text-muted)] transition-all focus:border-[var(--primary)] focus:outline-none focus:ring-1 focus:ring-[var(--primary)]"
          />
        </div>
      </div>

      <div className="flex shrink-0 items-center gap-2.5">
        <ThemeSwitcher />

        <div className="hidden items-center gap-2 rounded-full border border-[var(--border-main)] bg-[var(--bg-subtle)] px-3 py-1.5 text-xs font-medium text-[var(--text-secondary)] shadow-xs lg:flex">
          <Calendar className="h-3.5 w-3.5 shrink-0 text-[var(--text-muted)]" />
          <span>{formattedDate}</span>
          <span className="font-mono font-bold text-[var(--text-primary)]">{formattedTime}</span>
        </div>

        <NotificationDropdown />

        <div className="relative" ref={profileRef}>
          <button
            type="button"
            onClick={() => setProfileOpen((v) => !v)}
            className="flex cursor-pointer items-center gap-2 rounded-full border border-[var(--border-main)] bg-[var(--bg-subtle)] py-1 pl-1 pr-2.5 shadow-xs transition-colors hover:bg-[var(--primary-light)]"
          >
            <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-[var(--primary)] text-[10px] font-bold text-white shadow-xs">
              {initials(me)}
            </span>
            <span className="hidden text-left sm:block">
              <span
                className="block max-w-[200px] truncate text-xs font-bold leading-tight text-[var(--text-primary)]"
                title={me?.email ?? undefined}
              >
                {me?.name || me?.email || "…"}
              </span>
              <span className="block text-[10px] font-medium leading-tight text-[var(--text-muted)]">
                {roleLabel(me)}
                {me && !me.isSuperAdmin && me.companyName ? ` · ${me.companyName}` : ""}
              </span>
            </span>
            <ChevronDown className="hidden h-3 w-3 text-[var(--text-muted)] sm:block" />
          </button>

          {profileOpen && (
            <div className="absolute right-0 top-full z-50 mt-2 w-48 overflow-hidden rounded-2xl border border-[var(--border-main)] bg-[var(--bg-card)] py-1 shadow-xl">
              <Link
                href="/ess/profile"
                onClick={() => setProfileOpen(false)}
                className="flex w-full items-center gap-2.5 px-4 py-2.5 text-left text-xs font-semibold text-[var(--text-primary)] transition-colors hover:bg-[var(--bg-hover)]"
              >
                <User size={14} className="text-[var(--text-muted)]" /> Profile
              </Link>
              <Link
                href="/admin"
                onClick={() => setProfileOpen(false)}
                className="flex w-full items-center gap-2.5 px-4 py-2.5 text-left text-xs font-semibold text-[var(--text-primary)] transition-colors hover:bg-[var(--bg-hover)]"
              >
                <Settings size={14} className="text-[var(--text-muted)]" /> Administration
              </Link>
              <div className="my-1 h-px bg-[var(--border-main)]" />
              <button
                type="button"
                onClick={async () => {
                  try {
                    await fetch("/api/auth/logout", { method: "POST" });
                  } finally {
                    window.location.href = "/login";
                  }
                }}
                className="flex w-full items-center gap-2.5 px-4 py-2.5 text-left text-xs font-bold text-rose-500 transition-colors hover:bg-rose-50 dark:hover:bg-rose-950/30"
              >
                <LogOut size={14} /> Sign Out
              </button>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
