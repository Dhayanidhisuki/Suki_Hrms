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
    <header className="bg-white border-b border-slate-200 sticky top-0 z-50">
      <div className="flex items-center h-16 px-6 gap-8">
        {/* ── Logo ── */}
        <div className="flex items-center gap-2.5 shrink-0">
          <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center shadow-sm">
            <Wrench className="w-4 h-4 text-white" />
          </div>
          <div className="leading-tight">
            <span className="text-sm font-bold text-slate-900 tracking-tight">
              SUKI ERP
            </span>
            <span className="block text-[10px] text-slate-400 font-medium tracking-wider uppercase -mt-0.5">
              Tools Management
            </span>
          </div>
        </div>

        {/* ── Divider ── */}
        <div className="h-6 w-px bg-slate-200" />

        {/* ── Nav Links ── */}
        <nav className="flex items-center gap-1">
          {navLinks.map((link) => (
            <Link
              key={link.label}
              href={link.href}
              className={`px-3 py-1.5 rounded-md text-sm font-medium transition-all duration-150 ${
                link.active
                  ? "bg-blue-50 text-blue-700 font-semibold"
                  : "text-slate-500 hover:text-slate-800 hover:bg-slate-50"
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
              className="text-sm border border-slate-200 rounded-lg px-3 py-1.5 w-56 outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-400 transition-all"
            />
          ) : (
            <button
              id="nav-search-btn"
              onClick={() => setSearchOpen(true)}
              className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-slate-100 text-slate-500 hover:text-slate-700 transition-colors"
            >
              <Search className="w-4.5 h-4.5" />
            </button>
          )}

          {/* Notification Bell */}
          <button
            id="nav-notification-btn"
            className="relative w-8 h-8 flex items-center justify-center rounded-full hover:bg-slate-100 text-slate-500 hover:text-slate-700 transition-colors"
          >
            <Bell className="w-4.5 h-4.5" />
            <span className="absolute top-1.5 right-1.5 w-1.5 h-1.5 bg-red-500 rounded-full ring-2 ring-white" />
          </button>

          {/* ── User Avatar ── */}
          <button
            id="nav-user-menu-btn"
            className="flex items-center gap-2 pl-1 pr-2 py-1 rounded-full hover:bg-slate-100 transition-colors group"
          >
            <div className="w-7 h-7 rounded-full bg-gradient-to-br from-blue-500 to-blue-700 flex items-center justify-center text-white text-xs font-bold shadow-sm">
              RZ
            </div>
            <span className="text-sm font-medium text-slate-700 hidden xl:block">
              Roshi Z.
            </span>
            <ChevronDown className="w-3.5 h-3.5 text-slate-400 group-hover:text-slate-600 hidden xl:block" />
          </button>
        </div>
      </div>
    </header>
  );
}
