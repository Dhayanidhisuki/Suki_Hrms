"use client";

import { useState, useEffect, useRef } from "react";
import {
  LayoutDashboard,
  Package,
  ArrowUpRight,
  ArrowDownLeft,
  CalendarClock,
  History,
  Users,
  Settings,
  Bell,
  ChevronDown,
  ChevronUp,
  LogOut,
  ShoppingCart,
  ClipboardList,
  Layers,
  Building2,
  ArrowLeftRight,
  ChevronLeft,
  type LucideIcon,
} from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useSession } from "@/lib/SessionContext";
import { useTheme } from "@/contexts/ThemeContext";

const LOGO_BY_THEME: Record<string, string> = {
  blue: "/logo-blue.svg",
  green: "/logo-green.svg",
  purple: "/logo-purple.svg",
  orange: "/logo-orange.svg",
};

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
    label: "Home",
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
  const { theme } = useTheme();
  const displayUser = user ?? { userId: "...", name: "Loading...", roleName: "" };
  const logoSrc = LOGO_BY_THEME[theme] ?? LOGO_BY_THEME.blue;

  // Whole-sidebar collapsed/expanded
  const [isCollapsed, setIsCollapsed] = useState<boolean>(() => {
    if (typeof window !== "undefined") {
      return localStorage.getItem(STORAGE_KEY) === "true";
    }
    return false;
  });

  // Accordion: only one section open at a time (CRM-style)
  const [openSection, setOpenSection] = useState<string | null>(() => {
    const active = navSections.find((s) =>
      s.items.some((item) => pathname === item.href || (item.href !== "/" && pathname.startsWith(item.href)))
    );
    return active?.label ?? navSections[0]?.label ?? null;
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
    setOpenSection((prev) => (prev === label ? null : label));
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

      {/* ── Logo (theme-aware) ── */}
      <div
        className={`flex items-center border-b border-[var(--sidebar-border)] shrink-0 overflow-hidden transition-all duration-300 ${
          isCollapsed ? "justify-center px-0 py-4" : "px-5 py-5"
        }`}
      >
        {isCollapsed ? (
          <div className="w-9 h-9 rounded-xl flex items-center justify-center shadow-sm shrink-0 overflow-hidden bg-white/5">
            <Image
              key={logoSrc}
              src={logoSrc}
              alt="Suki logo"
              width={36}
              height={36}
              className="w-full h-full object-contain"
              priority
            />
          </div>
        ) : (
          <Image
            key={logoSrc}
            src={logoSrc}
            alt="Suki logo"
            width={160}
            height={50}
            className="h-8 w-auto object-contain"
            priority
          />
        )}
      </div>

      {/* ── Nav Sections ── */}
      <nav className="flex-1 overflow-y-auto overflow-x-visible py-3 px-2">
        {navSections.map((section) => {
          const SectionIcon = section.sectionIcon;
          const hasActive = section.items.some(
            (item) => pathname === item.href || (item.href !== "/" && pathname.startsWith(item.href))
          );
          const isExpanded = openSection === section.label;
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

          /* ── EXPANDED: CRM-style accordion (single section open) ── */
          return (
            <div key={section.label} className="mb-1 space-y-1">
              {/* Section parent row */}
              <button
                onClick={() => toggleSection(section.label)}
                className="w-full flex items-center justify-between px-3.5 py-2.5 rounded-lg font-medium transition-colors group cursor-pointer"
                style={{
                  fontSize: "13.5px",
                  color: hasActive ? "var(--sidebar-text-active)" : "var(--sidebar-text)",
                  background: "transparent",
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.background = "var(--sidebar-hover)";
                  e.currentTarget.style.borderLeft = "3px solid var(--primary)";
                  e.currentTarget.style.paddingLeft = "11px";
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = "transparent";
                  e.currentTarget.style.borderLeft = "";
                  e.currentTarget.style.paddingLeft = "";
                }}
              >
                <div className="flex items-center gap-3">
                  <SectionIcon
                    className="w-4 h-4 shrink-0 transition-colors"
                    style={{ color: hasActive ? "var(--sidebar-text-active)" : "var(--sidebar-heading)" }}
                  />
                  <span className="whitespace-nowrap overflow-hidden text-ellipsis">{section.label}</span>
                </div>
                {isExpanded ? (
                  <ChevronUp className="w-3.5 h-3.5 shrink-0" style={{ color: "var(--sidebar-heading)" }} />
                ) : (
                  <ChevronDown className="w-3.5 h-3.5 shrink-0" style={{ color: "var(--sidebar-heading)" }} />
                )}
              </button>

              {/* Children */}
              {isExpanded && (
                <div className="overflow-hidden pl-4 pr-1 py-1 space-y-1 border-l border-[var(--sidebar-border)] ml-5">
                  {section.items.map((item) => {
                    const isActive =
                      pathname === item.href ||
                      (item.href !== "/" && pathname.startsWith(item.href));
                    const Icon = item.icon;
                    return (
                      <Link
                        key={item.label}
                        href={item.href}
                        className="flex items-center py-1.5 px-2 rounded-md font-medium transition-colors gap-2.5"
                        style={{
                          fontSize: "12.5px",
                          color: isActive ? "var(--sidebar-text-active)" : "var(--sidebar-text)",
                          fontWeight: isActive ? 600 : 500,
                          background: isActive ? "var(--sidebar-active-bg)" : "transparent",
                        }}
                        onMouseEnter={(e) => {
                          if (!isActive) {
                            e.currentTarget.style.color = "var(--sidebar-text-active)";
                            e.currentTarget.style.background = "var(--sidebar-hover)";
                            e.currentTarget.style.borderLeft = "2px solid var(--primary)";
                            e.currentTarget.style.paddingLeft = "6px";
                          }
                        }}
                        onMouseLeave={(e) => {
                          if (!isActive) {
                            e.currentTarget.style.color = "var(--sidebar-text)";
                            e.currentTarget.style.background = "transparent";
                            e.currentTarget.style.borderLeft = "";
                            e.currentTarget.style.paddingLeft = "";
                          }
                        }}
                      >
                        <Icon className="w-3.5 h-3.5 shrink-0" />
                        <span className="flex-1 truncate whitespace-nowrap overflow-hidden text-ellipsis">{item.label}</span>
                        {item.badge && (
                          <span
                            className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full shrink-0 ${
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
      <div className={`shrink-0 border-t border-[var(--sidebar-border)] p-3 ${isCollapsed ? "px-1.5" : ""}`}>
        <div
          className={`flex items-center gap-3 rounded-xl p-2 transition-colors ${isCollapsed ? "justify-center" : ""}`}
          style={{ background: "var(--sidebar-active-bg)" }}
        >
          <div className="w-8 h-8 rounded-full bg-white/15 flex items-center justify-center text-white text-[13px] font-bold shrink-0">
            {displayUser.userId?.slice(0, 2) ?? "??"}
          </div>
          {!isCollapsed && (
            <>
              <div className="flex-1 min-w-0">
                <p className="text-[12.5px] font-semibold text-white truncate leading-tight">
                  {displayUser.name}
                </p>
                <p className="text-[10.5px] text-white/70 truncate leading-tight">
                  {displayUser.userId}
                </p>
              </div>
              <button
                id="sidebar-logout-btn"
                className="shrink-0 w-7 h-7 flex items-center justify-center rounded-lg text-white/80 hover:text-white hover:bg-white/10 transition-colors"
                aria-label="Log out"
                title="Log out"
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
