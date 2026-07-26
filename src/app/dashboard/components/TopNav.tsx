"use client";

import { Search, Bell, ChevronDown, Wrench } from "lucide-react";
import Link from "next/link";
import { useState } from "react";

const navLinks = [
  { label: "Dashboard", href: "/", active: true },
  { label: "Tools", href: "#" },
  { label: "Issue", href: "#" },
  { label: "Receive", href: "#" },
  { label: "Calibration", href: "#" },
  { label: "History", href: "#" },
];

export default function TopNav() {
  const [searchOpen, setSearchOpen] = useState(false);

  return (
    <header className="bg-[var(--bg-card)] border-b border-[var(--border-main)] sticky top-0 z-50 text-[var(--text-primary)]">
      <div className="flex items-center h-16 px-6 gap-8">
        {/* ── Logo ── */}
        <div className="flex items-center gap-2.5 shrink-0">
          <div className="w-8 h-8 bg-[var(--primary)] rounded-lg flex items-center justify-center shadow-sm">
            <Wrench className="w-4 h-4 text-white" />
          </div>
          <div className="leading-tight">
            <span className="text-sm font-bold text-[var(--text-primary)] tracking-tight">
              SUKI ERP
            </span>
            <span className="block text-[10px] text-[var(--text-muted)] font-medium tracking-wider uppercase -mt-0.5">
              Tools Management
            </span>
          </div>
        </div>

        {/* ── Divider ── */}
        <div className="h-6 w-px bg-[var(--border-main)]" />

        {/* ── Nav Links ── */}
        <nav className="flex items-center gap-1">
          {navLinks.map((link) => (
            <Link
              key={link.label}
              href={link.href}
              className={`px-3 py-1.5 rounded-md text-sm font-medium transition-all duration-150 ${
                link.active
                  ? "bg-[var(--primary-light)] text-[var(--primary)] font-semibold"
                  : "text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-hover)]"
              }`}
            >
              {link.label}
            </Link>
          ))}
        </nav>

        {/* ── Spacer ── */}
        <div className="flex-1" />

        {/* ── Search ── */}
        <div className="flex items-center gap-2">
          {searchOpen ? (
            <input
              autoFocus
              onBlur={() => setSearchOpen(false)}
              type="text"
              placeholder="Search tools, employees…"
              className="text-sm border border-[var(--border-main)] rounded-lg px-3 py-1.5 w-56 outline-none focus:ring-2 focus:ring-[var(--primary-subtle)] focus:border-[var(--primary)] transition-all bg-[var(--bg-subtle)] text-[var(--text-primary)] placeholder-[var(--text-muted)]"
            />
          ) : (
            <button
              id="nav-search-btn"
              onClick={() => setSearchOpen(true)}
              className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-[var(--bg-hover)] text-[var(--text-muted)] hover:text-[var(--text-primary)] transition-colors"
            >
              <Search className="w-4.5 h-4.5" />
            </button>
          )}

          {/* Notification Bell */}
          <button
            id="nav-notification-btn"
            className="relative w-8 h-8 flex items-center justify-center rounded-full hover:bg-[var(--bg-hover)] text-[var(--text-muted)] hover:text-[var(--text-primary)] transition-colors"
          >
            <Bell className="w-4.5 h-4.5" />
            <span className="absolute top-1.5 right-1.5 w-1.5 h-1.5 bg-red-500 rounded-full ring-2 ring-[var(--bg-card)]" />
          </button>

          {/* ── User Avatar ── */}
          <button
            id="nav-user-menu-btn"
            className="flex items-center gap-2 pl-1 pr-2 py-1 rounded-full hover:bg-[var(--bg-hover)] transition-colors group"
          >
            <div className="w-7 h-7 rounded-full bg-[var(--primary)] flex items-center justify-center text-white text-xs font-bold shadow-sm">
              RZ
            </div>
            <span className="text-sm font-medium text-[var(--text-primary)] hidden xl:block">
              Roshi Z.
            </span>
            <ChevronDown className="w-3.5 h-3.5 text-[var(--text-muted)] group-hover:text-[var(--text-primary)] hidden xl:block" />
          </button>
        </div>
      </div>
    </header>
  );
}
