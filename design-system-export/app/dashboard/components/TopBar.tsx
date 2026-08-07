"use client";

import {
  Menu,
  Search,
  Bell,
  ChevronDown,
  User,
  Settings,
  LogOut,
  Check,
  Calendar,
} from "lucide-react";
import { useState, useEffect, useRef } from "react";
import { ThemeSwitcher } from "@/components/ThemeSwitcher";

export type TopBarUser = {
  name?: string | null;
  userId?: string | null;
  roleName?: string | null;
  addRoleName?: string | null;
};

export type TopBarProps = {
  user?: TopBarUser | null;
  searchPlaceholder?: string;
  searchQuery?: string;
  onSearchQueryChange?: (value: string) => void;
  /** Fired when Sign Out is clicked. Host app should clear session / redirect. */
  onSignOut?: () => void | Promise<void>;
  /** Custom event name dispatched to toggle sidebar (default matches original shell). */
  sidebarToggleEvent?: string;
};

function getInitials(name: string) {
  return name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase())
    .join("");
}

/**
 * Presentational top bar. Pass `user` from your auth layer.
 * Does not import app SessionContext or call logout APIs directly.
 */
export default function TopBar({
  user = null,
  searchPlaceholder = "Search…",
  searchQuery: controlledQuery,
  onSearchQueryChange,
  onSignOut,
  sidebarToggleEvent = "suki_toggle_sidebar",
}: TopBarProps) {
  const [internalQuery, setInternalQuery] = useState("");
  const searchQuery = controlledQuery ?? internalQuery;
  const setSearchQuery = onSearchQueryChange ?? setInternalQuery;

  const [isNotifOpen, setIsNotifOpen] = useState(false);
  const notifRef = useRef<HTMLDivElement>(null);
  const [isProfileOpen, setIsProfileOpen] = useState(false);
  const profileRef = useRef<HTMLDivElement>(null);

  const [now, setNow] = useState<Date | null>(null);

  useEffect(() => {
    setNow(new Date());
    const interval = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (notifRef.current && !notifRef.current.contains(e.target as Node)) setIsNotifOpen(false);
      if (profileRef.current && !profileRef.current.contains(e.target as Node)) setIsProfileOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const toggleSidebar = () => {
    window.dispatchEvent(new CustomEvent(sidebarToggleEvent));
  };

  const formattedDate = now
    ? now.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" })
    : "";
  const formattedTime = now
    ? now.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit", hour12: false })
    : "";

  return (
    <header className="h-14 shrink-0 mt-4 mr-4 ml-4 bg-[var(--topbar-bg)] border border-[var(--topbar-border)] text-[var(--text-primary)] flex items-center justify-between px-4 md:px-5 gap-3 relative z-40 rounded-3xl shadow-[0_1px_3px_rgba(0,0,0,0.03)]">
      <div className="flex items-center gap-3 flex-1 min-w-0 max-w-xl">
        <button
          onClick={toggleSidebar}
          className="w-8 h-8 rounded-xl bg-[var(--bg-subtle)] hover:bg-[var(--primary-light)] border border-[var(--border-main)] flex items-center justify-center text-[var(--text-secondary)] hover:text-[var(--primary)] transition-colors cursor-pointer shrink-0 shadow-xs"
          title="Toggle Sidebar Menu"
          aria-label="Toggle Sidebar Menu"
          type="button"
        >
          <Menu className="w-4 h-4" />
        </button>

        <div className="relative flex-1 min-w-0">
          <Search className="w-3.5 h-3.5 text-[var(--text-muted)] absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder={searchPlaceholder}
            className="w-full h-8 pl-8 pr-3 text-xs bg-[var(--bg-subtle)] text-[var(--text-primary)] placeholder-[var(--text-muted)] rounded-xl border border-[var(--border-main)] focus:outline-none focus:ring-1 focus:ring-[var(--primary)] focus:border-[var(--primary)] transition-all font-sans"
          />
        </div>
      </div>

      <div className="flex items-center gap-2.5 shrink-0">
        <ThemeSwitcher />

        <div className="hidden lg:flex items-center gap-2 px-3 py-1.5 rounded-full bg-[var(--bg-subtle)] border border-[var(--border-main)] text-xs text-[var(--text-secondary)] font-medium shadow-xs">
          <Calendar className="w-3.5 h-3.5 text-[var(--text-muted)] shrink-0" />
          <span>{formattedDate}</span>
          <span className="font-bold font-mono text-[var(--text-primary)]">{formattedTime}</span>
        </div>

        <div className="relative" ref={notifRef}>
          <button
            id="topbar-notification-btn"
            type="button"
            onClick={() => setIsNotifOpen((v) => !v)}
            className="relative w-8 h-8 flex items-center justify-center rounded-xl bg-[var(--bg-subtle)] hover:bg-[var(--primary-light)] border border-[var(--border-main)] text-[var(--text-muted)] hover:text-[var(--primary)] transition-colors shadow-xs cursor-pointer"
            title="Notifications"
          >
            <Bell className="w-3.5 h-3.5" />
            <span className="absolute top-1.5 right-1.5 w-1.5 h-1.5 bg-rose-500 rounded-full ring-2 ring-[var(--bg-card)]" />
          </button>

          {isNotifOpen && (
            <div className="absolute top-full mt-2 w-[320px] right-0 bg-[var(--bg-card)] shadow-2xl rounded-2xl overflow-hidden z-50 flex flex-col border border-[var(--border-main)] animate-fade-in">
              <div className="bg-[#1A1A1A] text-white p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-xs font-bold tracking-wide">Notifications</h3>
                    <div className="flex items-center gap-1.5 mt-0.5">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                      <span className="text-[10px] text-slate-400 uppercase tracking-widest font-semibold">
                        Live
                      </span>
                    </div>
                  </div>
                  <button
                    type="button"
                    className="px-2.5 py-1 rounded-lg bg-white/10 hover:bg-white/20 text-[10px] font-bold flex items-center gap-1 transition-colors"
                  >
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

        <div className="relative" ref={profileRef}>
          <button
            type="button"
            onClick={() => setIsProfileOpen((v) => !v)}
            className="flex items-center gap-2 pl-1 pr-2.5 py-1 rounded-full bg-[var(--bg-subtle)] hover:bg-[var(--primary-light)] border border-[var(--border-main)] transition-colors shadow-xs cursor-pointer"
          >
            <div className="w-6 h-6 rounded-full bg-[var(--primary)] text-white flex items-center justify-center text-[10px] font-bold shrink-0 shadow-xs">
              {getInitials(user?.name || user?.userId || "?")}
            </div>
            <div className="hidden sm:block text-left">
              <p className="text-xs font-bold text-[var(--text-primary)] leading-tight">
                {user?.name || user?.userId || "Not signed in"}
              </p>
              <p className="text-[10px] text-[var(--text-muted)] font-medium leading-tight">
                {user ? user.addRoleName || user.roleName || "User" : "—"}
              </p>
            </div>
            <ChevronDown size={12} className="hidden sm:block text-[var(--text-muted)]" />
          </button>

          {isProfileOpen && (
            <div className="absolute top-full mt-2 right-0 w-48 bg-[var(--bg-card)] border border-[var(--border-main)] rounded-2xl shadow-xl overflow-hidden z-50 py-1 animate-fade-in">
              <button
                type="button"
                className="w-full text-left px-4 py-2.5 text-xs font-semibold text-[var(--text-primary)] hover:bg-[var(--bg-hover)] transition-colors flex items-center gap-2.5"
              >
                <User size={14} className="text-[var(--text-muted)]" /> Profile
              </button>
              <button
                type="button"
                className="w-full text-left px-4 py-2.5 text-xs font-semibold text-[var(--text-primary)] hover:bg-[var(--bg-hover)] transition-colors flex items-center gap-2.5"
              >
                <Settings size={14} className="text-[var(--text-muted)]" /> Settings
              </button>
              <div className="h-px bg-[var(--border-main)] my-1" />
              <button
                type="button"
                onClick={() => void onSignOut?.()}
                className="w-full text-left px-4 py-2.5 text-xs font-bold text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/30 transition-colors flex items-center gap-2.5"
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
