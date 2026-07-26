"use client";

import { useState, useEffect, useRef } from "react";
import {
  Wrench,
  LayoutDashboard,
  Package,
  ArrowUpRight,
  ArrowDownLeft,
  CalendarClock,
  History,
  Users,
  Settings,
  Bell,
  ChevronRight,
  LogOut,
  ShoppingCart,
  ClipboardList,
  Layers,
  Building2,
  ArrowLeftRight,
  ChevronLeft,
  type LucideIcon,
} from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useSession } from "@/lib/SessionContext";

interface NavItem {
  label: string;
  href: string;
  icon: LucideIcon;
  badge?: string;
}

interface NavSection {
  label: string;
  sectionIcon: LucideIcon;
  items: NavItem[];
}

const navSections: NavSection[] = [
  {
    label: "Main",
    sectionIcon: LayoutDashboard,
    items: [
      { label: "Dashboard", href: "/", icon: LayoutDashboard },
    ],
  },
  {
    label: "Masters",
    sectionIcon: Layers,
    items: [
      { label: "Tools Master", href: "/dashboard/masters/tools", icon: Package },
      { label: "Supplier Master", href: "/dashboard/masters/suppliers", icon: Users },
      { label: "Subcontractors", href: "/dashboard/masters/subcontractors", icon: Building2 },
      { label: "Lookup Tables", href: "/dashboard/masters/lookups", icon: Layers },
    ],
  },
  {
    label: "Transactions",
    sectionIcon: ArrowLeftRight,
    items: [
      { label: "Issue Tool", href: "/dashboard/transactions/issue", icon: ArrowUpRight },
      { label: "Receive Tool", href: "/dashboard/transactions/receive", icon: ArrowDownLeft },
      { label: "Consumption", href: "/dashboard/transactions/consumption", icon: ClipboardList },
    ],
  },
  {
    label: "Purchase",
    sectionIcon: ShoppingCart,
    items: [
      { label: "PO GRN Receive", href: "/dashboard/po-linked/receive", icon: ShoppingCart },
      { label: "PO Schedule", href: "/dashboard/po-linked/schedule", icon: ClipboardList },
    ],
  },
  {
    label: "Calibration",
    sectionIcon: CalendarClock,
    items: [
      { label: "Calibration Issue", href: "/dashboard/calibration/issue", icon: CalendarClock },
      { label: "Calibration Receive", href: "/dashboard/calibration/receive", icon: ArrowDownLeft },
      { label: "Due List & History", href: "/dashboard/calibration/due-list", icon: History, badge: "14" },
    ],
  },
];

const STORAGE_KEY = "suki_sidebar_collapsed";

export default function Sidebar() {
  const pathname = usePathname();
  const { user } = useSession();
  const displayUser = user ?? { userId: "...", name: "Loading...", roleName: "" };

  // Whole-sidebar collapsed/expanded
  const [isCollapsed, setIsCollapsed] = useState<boolean>(() => {
    if (typeof window !== "undefined") {
      return localStorage.getItem(STORAGE_KEY) === "true";
    }
    return false;
  });

  // Per-section expanded/collapsed (for children tree)
  const [sectionExpanded, setSectionExpanded] = useState<Record<string, boolean>>(() => {
    const defaults: Record<string, boolean> = {};
    navSections.forEach((s) => { defaults[s.label] = true; });
    return defaults;
  });

  // Track which flyout is visible when collapsed
  const [flyoutSection, setFlyoutSection] = useState<string | null>(null);
  const flyoutTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, String(isCollapsed));
  }, [isCollapsed]);

  // Close flyout when navigating
  useEffect(() => {
    setFlyoutSection(null);
  }, [pathname]);

  const handleFlyoutEnter = (label: string) => {
    if (flyoutTimeoutRef.current) clearTimeout(flyoutTimeoutRef.current);
    setFlyoutSection(label);
  };

  const handleFlyoutLeave = () => {
    flyoutTimeoutRef.current = setTimeout(() => setFlyoutSection(null), 150);
  };

  const toggleSection = (label: string) => {
    setSectionExpanded((prev) => ({ ...prev, [label]: !prev[label] }));
  };

  return (
    <aside
      className="shrink-0 h-screen sticky top-0 bg-[var(--sidebar-bg)] text-[var(--sidebar-text)] border-r border-[var(--sidebar-border)] flex flex-col overflow-visible relative z-30 transition-[width] duration-300 ease-in-out"
      style={{ width: isCollapsed ? "64px" : "240px" }}
    >
      {/* ── Collapse Toggle Button ── */}
      <button
        onClick={() => setIsCollapsed((v) => !v)}
        aria-label={isCollapsed ? "Expand sidebar" : "Collapse sidebar"}
        className="absolute -right-3 top-1/2 -translate-y-1/2 z-50 w-6 h-6 rounded-full bg-[var(--sidebar-bg)] border border-[var(--sidebar-border)] flex items-center justify-center text-slate-400 hover:text-white hover:border-[var(--primary)] hover:bg-[var(--primary)] transition-all duration-150 shadow-sm cursor-pointer"
      >
        <ChevronLeft
          className={`w-3.5 h-3.5 transition-transform duration-300 ${isCollapsed ? "rotate-180" : ""}`}
        />
      </button>

      {/* ── Logo ── */}
      <div
        className={`flex items-center border-b border-[var(--sidebar-border)] shrink-0 overflow-hidden transition-all duration-300 ${
          isCollapsed ? "justify-center px-0 py-4" : "gap-3 px-5 py-5"
        }`}
      >
        <div className="w-9 h-9 bg-[var(--primary)] rounded-xl flex items-center justify-center shadow-sm shrink-0">
          <Wrench className="w-4 h-4 text-white" />
        </div>
        {!isCollapsed && (
          <div className="leading-tight min-w-0 overflow-hidden">
            <p className="text-sm font-bold text-white tracking-tight truncate">SUKI ERP</p>
            <p className="text-[10px] text-slate-400 font-medium tracking-wider uppercase truncate">
              Tools Management
            </p>
          </div>
        )}
      </div>

      {/* ── Nav Sections ── */}
      <nav className="flex-1 overflow-y-auto overflow-x-visible py-3 px-2">
        {navSections.map((section) => {
          const SectionIcon = section.sectionIcon;
          const hasActive = section.items.some(
            (item) => pathname === item.href || (item.href !== "/" && pathname.startsWith(item.href))
          );
          const isExpanded = sectionExpanded[section.label] ?? true;
          const isFlyoutOpen = flyoutSection === section.label;

          if (isCollapsed) {
            /* ── COLLAPSED: icon only + hover flyout ── */
            return (
              <div
                key={section.label}
                className="relative mb-1"
                onMouseEnter={() => handleFlyoutEnter(section.label)}
                onMouseLeave={handleFlyoutLeave}
              >
                {/* Section icon button */}
                <button
                  className={`w-full h-10 flex items-center justify-center rounded-xl transition-all duration-150 cursor-pointer ${
                    hasActive
                      ? "bg-[var(--primary)] text-white"
                      : "text-slate-400 hover:bg-[var(--sidebar-hover)] hover:text-white"
                  }`}
                  aria-label={section.label}
                >
                  <SectionIcon className="w-4.5 h-4.5 shrink-0" />
                </button>

                {/* Flyout panel */}
                {isFlyoutOpen && (
                  <div
                    className="absolute left-full top-0 ml-2 w-52 bg-[#1a2236] border border-[var(--sidebar-border)] rounded-xl shadow-2xl z-50 py-1.5 overflow-hidden"
                    onMouseEnter={() => handleFlyoutEnter(section.label)}
                    onMouseLeave={handleFlyoutLeave}
                  >
                    {/* Flyout header */}
                    <div className="px-3 py-2 border-b border-[var(--sidebar-border)] mb-1">
                      <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                        {section.label}
                      </p>
                    </div>
                    {/* Flyout items */}
                    {section.items.map((item) => {
                      const ItemIcon = item.icon;
                      const isActive =
                        pathname === item.href ||
                        (item.href !== "/" && pathname.startsWith(item.href));
                      return (
                        <Link
                          key={item.label}
                          href={item.href}
                          className={`flex items-center gap-2.5 px-3 py-2 text-sm font-medium transition-all duration-100 ${
                            isActive
                              ? "bg-[var(--primary)] text-white"
                              : "text-slate-300 hover:bg-[var(--sidebar-hover)] hover:text-white"
                          }`}
                        >
                          <ItemIcon className="w-3.5 h-3.5 shrink-0" />
                          <span className="flex-1 truncate">{item.label}</span>
                          {item.badge && (
                            <span
                              className={`text-[9px] font-bold px-1.5 py-0.5 rounded-full ${
                                isActive
                                  ? "bg-white/20 text-white"
                                  : "bg-amber-900/60 text-amber-300 border border-amber-700/50"
                              }`}
                            >
                              {item.badge}
                            </span>
                          )}
                        </Link>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          }

          /* ── EXPANDED: parent row + tree-style children ── */
          return (
            <div key={section.label} className="mb-1">
              {/* Section parent row */}
              <button
                onClick={() => toggleSection(section.label)}
                className={`flex items-center gap-2.5 w-full px-3 py-2.5 rounded-xl text-xs font-semibold tracking-wide transition-all duration-150 group cursor-pointer ${
                  hasActive
                    ? "text-white bg-[var(--sidebar-hover)]"
                    : "text-slate-400 hover:bg-[var(--sidebar-hover)] hover:text-slate-200"
                }`}
              >
                <SectionIcon
                  className={`w-4 h-4 shrink-0 transition-colors ${
                    hasActive ? "text-[var(--primary)]" : "text-slate-500 group-hover:text-slate-300"
                  }`}
                />
                <span className="flex-1 uppercase tracking-widest truncate">{section.label}</span>
                <ChevronRight
                  className={`w-3.5 h-3.5 shrink-0 transition-transform duration-200 ${
                    isExpanded ? "rotate-90" : ""
                  } ${hasActive ? "text-slate-300" : "text-slate-600 group-hover:text-slate-400"}`}
                />
              </button>

              {/* Children with tree connector */}
              <div
                className={`overflow-hidden transition-all duration-250 ease-in-out ${
                  isExpanded ? "max-h-96 opacity-100" : "max-h-0 opacity-0"
                }`}
              >
                <ul className="mt-0.5 ml-3 pl-3 border-l border-[var(--sidebar-border)] space-y-0.5 pb-1">
                  {section.items.map((item) => {
                    const isActive =
                      pathname === item.href ||
                      (item.href !== "/" && pathname.startsWith(item.href));
                    const Icon = item.icon;
                    return (
                      <li key={item.label} className="relative">
                        {/* Branch tick line */}
                        <span className="absolute -left-3 top-1/2 w-2.5 h-px bg-[var(--sidebar-border)]" />
                        <Link
                          href={item.href}
                          className={`flex items-center gap-2.5 px-3 py-2 rounded-xl text-sm font-medium transition-all duration-150 group ${
                            isActive
                              ? "bg-[var(--primary)] text-white shadow-sm"
                              : "text-slate-400 hover:bg-[var(--sidebar-hover)] hover:text-white"
                          }`}
                        >
                          <Icon
                            className={`w-3.5 h-3.5 shrink-0 ${
                              isActive
                                ? "text-white"
                                : "text-slate-500 group-hover:text-slate-200"
                            }`}
                          />
                          <span className="flex-1 truncate text-[13px]">{item.label}</span>
                          {item.badge && (
                            <span
                              className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full ${
                                isActive
                                  ? "bg-white/20 text-white"
                                  : "bg-amber-900/60 text-amber-300 border border-amber-700/50"
                              }`}
                            >
                              {item.badge}
                            </span>
                          )}
                        </Link>
                      </li>
                    );
                  })}
                </ul>
              </div>
            </div>
          );
        })}
      </nav>

      {/* ── Bottom utility buttons ── */}
      <div className="border-t border-[var(--sidebar-border)] px-2 py-2 space-y-0.5 shrink-0">
        <button
          id="sidebar-settings-btn"
          className={`w-full flex items-center rounded-xl text-sm font-medium text-slate-300 hover:bg-[var(--sidebar-hover)] hover:text-white transition-colors group cursor-pointer ${
            isCollapsed ? "justify-center p-2.5" : "gap-3 px-3 py-2.5"
          }`}
          title={isCollapsed ? "Settings" : undefined}
        >
          <Settings className="w-4 h-4 text-slate-400 group-hover:text-slate-200 shrink-0" />
          {!isCollapsed && <span>Settings</span>}
        </button>
        <button
          id="sidebar-notifications-btn"
          className={`w-full flex items-center rounded-xl text-sm font-medium text-slate-300 hover:bg-[var(--sidebar-hover)] hover:text-white transition-colors group cursor-pointer relative ${
            isCollapsed ? "justify-center p-2.5" : "gap-3 px-3 py-2.5"
          }`}
          title={isCollapsed ? "Notifications (3)" : undefined}
        >
          <span className="relative shrink-0">
            <Bell className="w-4 h-4 text-slate-400 group-hover:text-slate-200" />
            {isCollapsed && (
              <span className="absolute -top-1.5 -right-1.5 text-[9px] font-bold w-3.5 h-3.5 flex items-center justify-center rounded-full bg-red-500 text-white leading-none">
                3
              </span>
            )}
          </span>
          {!isCollapsed && (
            <>
              <span>Notifications</span>
              <span className="ml-auto text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-red-950/80 text-red-300 border border-red-800/50">
                3
              </span>
            </>
          )}
        </button>
      </div>

      {/* ── User profile footer ── */}
      <div className="border-t border-[var(--sidebar-border)] p-2 shrink-0">
        <div
          className={`flex items-center rounded-xl hover:bg-[var(--sidebar-hover)] cursor-pointer transition-colors group ${
            isCollapsed ? "justify-center p-2" : "gap-3 px-2 py-2"
          }`}
        >
          <div className="w-8 h-8 rounded-full bg-[var(--primary)] flex items-center justify-center text-white text-xs font-bold shadow-sm shrink-0">
            {displayUser.userId?.slice(0, 2) ?? "??"}
          </div>
          {!isCollapsed && (
            <>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-slate-200 truncate leading-tight">
                  {displayUser.name}
                </p>
                <p className="text-[11px] text-slate-400 truncate leading-tight font-mono">
                  {displayUser.userId}
                </p>
              </div>
              <button
                id="sidebar-logout-btn"
                className="w-7 h-7 rounded-lg flex items-center justify-center text-slate-400 hover:text-red-400 hover:bg-red-950/50 transition-colors shrink-0"
              >
                <LogOut className="w-3.5 h-3.5" />
              </button>
            </>
          )}
        </div>
      </div>
    </aside>
  );
}
