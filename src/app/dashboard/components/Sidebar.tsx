"use client";

import { useState, useEffect, useRef } from "react";
import {
  Search,
  LayoutDashboard,
  Package,
  ArrowUpRight,
  ArrowDownLeft,
  CalendarClock,
  History,
  Users,
  Settings,
  ChevronDown,
  ClipboardList,
  ArrowLeftRight,
  BarChart3,
  Bell,
  Shield,
  AlertTriangle,
  Gauge,
  Building2,
  Handshake,
  FileText,
  type LucideIcon,
} from "lucide-react";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { useSession } from "@/lib/SessionContext";
import { isAdminRole } from "@/lib/adminRoles";
import { useTheme } from "@/contexts/ThemeContext";

const LOGO_BY_THEME: Record<string, { full: string; icon: string }> = {
  blue: { full: "/logo-blue.svg", icon: "/logo-icon-blue.svg" },
  green: { full: "/logo-green.svg", icon: "/logo-icon-green.svg" },
  purple: { full: "/logo-purple.svg", icon: "/logo-icon-purple.svg" },
  orange: { full: "/logo-orange.svg", icon: "/logo-icon-orange.svg" },
};

interface NavItem {
  label: string;
  href: string;
  icon: LucideIcon;
  moduleKey?: string;
  badge?: string;
}

interface NavGroup {
  label?: string;
  items: NavItem[];
}

interface NavSection {
  label: string;
  sectionIcon: LucideIcon;
  groups: NavGroup[];
}

const navSections: NavSection[] = [
  {
    label: "Dashboard",
    sectionIcon: LayoutDashboard,
    groups: [
      {
        items: [
          { label: "Tools Overview", href: "/dashboard", icon: LayoutDashboard },
          { label: "Transaction Overview", href: "/dashboard/overview/transactions", icon: BarChart3, moduleKey: "reports" },
        ],
      },
    ],
  },
  {
    label: "Masters",
    sectionIcon: Package,
    groups: [
      {
        items: [
          { label: "All Instruments & Gauges", href: "/dashboard/masters/tools", icon: Package, moduleKey: "tool_master" },
          { label: "Defect & Services", href: "/dashboard/instruments/defects", icon: AlertTriangle, moduleKey: "tool_master" },
          { label: "Supplier", href: "/dashboard/masters/suppliers", icon: Building2, moduleKey: "supplier_master" },
          { label: "Subcontractor", href: "/dashboard/masters/subcontractors", icon: Handshake, moduleKey: "subcontractor_master" },
        ],
      },
    ],
  },
  {
    label: "Transactions",
    sectionIcon: ArrowLeftRight,
    groups: [
      {
        label: "Internal Movement",
        items: [
          { label: "Create Movement", href: "/dashboard/movement/history?movement=internal", icon: ArrowUpRight, moduleKey: "tool_issue_receive" },
          { label: "Receive Movement", href: "/dashboard/movement/receive?movement=internal", icon: ArrowDownLeft, moduleKey: "tool_issue_receive" },
        ],
      },
      {
        label: "External Movement",
        items: [
          { label: "Create Movement", href: "/dashboard/movement/history?movement=external", icon: ArrowUpRight, moduleKey: "tool_issue_receive" },
          { label: "Receive Movement", href: "/dashboard/movement/receive?movement=external", icon: ArrowDownLeft, moduleKey: "tool_issue_receive" },
        ],
      },
    ],
  },
  {
    label: "Calibration",
    sectionIcon: CalendarClock,
    groups: [
      {
        items: [
          { label: "Issue", href: "/dashboard/masters/tools?calibration=1", icon: ArrowUpRight, moduleKey: "calibration_issue" },
          { label: "DC History", href: "/dashboard/calibration/issue", icon: History, moduleKey: "calibration_issue" },
          { label: "Receive", href: "/dashboard/calibration/receive", icon: ArrowDownLeft, moduleKey: "calibration_receive" },
          { label: "Result Update", href: "/dashboard/calibration/results-update", icon: ClipboardList, moduleKey: "calibration_results" },
          { label: "Documents & Photos", href: "/dashboard/documents", icon: FileText, moduleKey: "documents" },
        ],
      },
    ],
  },
  {
    label: "Tools History Card",
    sectionIcon: History,
    groups: [
      {
        items: [
          { label: "History Card", href: "/dashboard/tools-history-card", icon: History, moduleKey: "history_card" },
          { label: "Current Status", href: "/dashboard/tools-history-card/status", icon: Gauge, moduleKey: "history_card" },
          { label: "Current Holder", href: "/dashboard/tools-history-card/holder", icon: Users, moduleKey: "history_card" },
          { label: "Issue History", href: "/dashboard/movement/history", icon: ArrowUpRight, moduleKey: "history_card" },
          { label: "Receive History", href: "/dashboard/movement/receive", icon: ArrowDownLeft, moduleKey: "history_card" },
          { label: "Calibration Records", href: "/dashboard/tools-history-card/calibration", icon: CalendarClock, moduleKey: "history_card" },
          { label: "Calibration Results", href: "/dashboard/tools-history-card/calibration-results", icon: ClipboardList, moduleKey: "history_card" },
          { label: "GRN History", href: "/dashboard/tools-history-card/grn", icon: Package, moduleKey: "history_card" },
          { label: "Purchase Orders", href: "/dashboard/tools-history-card/purchase-orders", icon: FileText, moduleKey: "history_card" },
        ],
      },
    ],
  },
  {
    label: "Reports & Analytics",
    sectionIcon: BarChart3,
    groups: [
      {
        items: [
          { label: "All Tool Reports", href: "/dashboard/reports/tools", icon: BarChart3, moduleKey: "reports" },
          { label: "Calibration Reports", href: "/dashboard/reports/calibration", icon: CalendarClock, moduleKey: "reports" },
          { label: "Supplier Report", href: "/dashboard/reports/suppliers", icon: Users, moduleKey: "reports" },
          { label: "Subcontractor Report", href: "/dashboard/reports/subcontractors", icon: Building2, moduleKey: "reports" },
          { label: "Tools History Report", href: "/dashboard/reports/tools-history", icon: History, moduleKey: "reports" },
          { label: "Purchase Order Report", href: "/dashboard/reports/purchase-orders", icon: FileText, moduleKey: "reports" },
        ],
      },
    ],
  },
  {
    label: "Settings",
    sectionIcon: Settings,
    groups: [
      {
        label: "Access & Notifications",
        items: [
          { label: "Users", href: "/dashboard/settings/users", icon: Users, moduleKey: "settings_users" },
          { label: "Roles & Permissions", href: "/dashboard/settings/roles", icon: Shield, moduleKey: "settings_roles" },
          { label: "Email Notifications", href: "/dashboard/settings/notifications/email", icon: Bell, moduleKey: "email_notifications" },
          { label: "Audit Trail", href: "/dashboard/settings/audit-trail", icon: History, moduleKey: "settings_users" },
        ],
      },
    ],
  },
];

const STORAGE_KEY = "suki_sidebar_collapsed";

function sectionItems(section: NavSection): NavItem[] {
  return section.groups.flatMap((g) => g.items);
}

/** Every leaf href in the sidebar — used so parent routes don't stay active on children. */
const ALL_NAV_HREFS = navSections.flatMap((s) => sectionItems(s).map((i) => i.href));

function routeMatches(pathname: string, href: string, currentSearch = ""): boolean {
  const [hrefPath, hrefSearch = ""] = href.split("?");
  const pathMatches =
    hrefPath === "/dashboard"
      ? pathname === "/dashboard" || pathname === "/"
      : pathname === hrefPath || pathname.startsWith(`${hrefPath}/`);
  if (!pathMatches || !hrefSearch) return pathMatches;

  const expected = new URLSearchParams(hrefSearch);
  const current = new URLSearchParams(currentSearch);
  return Array.from(expected.entries()).every(([key, value]) => current.get(key) === value);
}

/**
 * Active when this href is the longest matching nav item for the current path.
 * Prevents e.g. History Card (/tools-history-card) lighting up on Current Holder.
 */
function isRouteActive(pathname: string, href: string, currentSearch = ""): boolean {
  if (!routeMatches(pathname, href, currentSearch)) return false;
  const matches = ALL_NAV_HREFS.filter((h) => routeMatches(pathname, h, currentSearch));
  if (matches.length === 0) return false;
  const best = matches.reduce((a, b) => (a.length >= b.length ? a : b));
  return best === href;
}

function NavLink({ item, pathname }: { item: NavItem; pathname: string }) {
  const ItemIcon = item.icon;
  const searchParams = useSearchParams();
  const isActive = isRouteActive(pathname, item.href, searchParams.toString());
  return (
    <Link
      href={item.href}
      className={`flex items-center justify-between px-3 py-2 rounded-xl text-xs font-medium transition-all duration-150 ${
        isActive
          ? "bg-[var(--primary)] text-white font-semibold shadow-sm"
          : "text-slate-300 hover:bg-[var(--sidebar-hover)] hover:text-white"
      }`}
    >
      <div className="flex items-center gap-2.5 min-w-0">
        <ItemIcon className="w-3.5 h-3.5 shrink-0" />
        <span className="truncate">{item.label}</span>
      </div>
      {item.badge && (
        <span
          className={`px-1.5 py-0.5 rounded-full text-[10px] font-mono font-bold ${
            isActive ? "bg-white/25 text-white" : "bg-white/10 text-slate-300"
          }`}
        >
          {item.badge}
        </span>
      )}
    </Link>
  );
}

/** Simple label tooltip for collapsed non-parent (flat) icons — not used for parent flyouts. */
function CollapsedTooltip({ label }: { label: string }) {
  return (
    <span
      className="pointer-events-none absolute left-full top-1/2 -translate-y-1/2 ml-3 z-50 whitespace-nowrap rounded-lg bg-white px-2.5 py-1.5 text-xs font-semibold text-[var(--sidebar-bg)] shadow-md opacity-0 group-hover/tip:opacity-100 transition-opacity duration-150"
      role="tooltip"
    >
      {label}
    </span>
  );
}

export default function Sidebar() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const currentSearch = searchParams.toString();
  const { user, loading, canModule } = useSession();
  const { theme } = useTheme();
  const displayUser = user;
  const logos = LOGO_BY_THEME[theme] ?? LOGO_BY_THEME.blue;

  const [isCollapsed, setIsCollapsed] = useState<boolean>(() => {
    if (typeof window !== "undefined") {
      return localStorage.getItem(STORAGE_KEY) === "true";
    }
    return false;
  });

  const [openSection, setOpenSection] = useState<string | null>(() => {
    const active = navSections.find((s) =>
      sectionItems(s).some((item) => isRouteActive(pathname, item.href, currentSearch))
    );
    return active?.label ?? navSections[0]?.label ?? null;
  });

  const [flyoutSection, setFlyoutSection] = useState<string | null>(null);
  const flyoutTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const searchInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setIsCollapsed(false);
        setTimeout(() => searchInputRef.current?.focus(), 50);
      }
    };
    const handleSidebarToggle = () => setIsCollapsed((prev) => !prev);
    window.addEventListener("keydown", handleKeyDown);
    window.addEventListener("suki_toggle_sidebar", handleSidebarToggle);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("suki_toggle_sidebar", handleSidebarToggle);
    };
  }, []);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, String(isCollapsed));
  }, [isCollapsed]);

  const handleFlyoutEnter = (label: string) => {
    if (flyoutTimeoutRef.current) clearTimeout(flyoutTimeoutRef.current);
    setFlyoutSection(label);
  };

  const handleFlyoutLeave = () => {
    flyoutTimeoutRef.current = setTimeout(() => setFlyoutSection(null), 150);
  };

  // Settings is admin-only. Hidden while the session is still loading
  // (user === null) so it never flashes for a non-admin.
  const canSeeSettings = loading || isAdminRole(displayUser?.roleName) || canModule("settings_users") || canModule("settings_roles");

  const filteredSections = navSections
    .filter((section) => section.label !== "Settings" || canSeeSettings)
    .map((section) => {
      const accessGroups = section.groups
        .map((group) => ({ ...group, items: group.items.filter((item) => !item.moduleKey || loading || canModule(item.moduleKey)) }))
        .filter((group) => group.items.length > 0);
      if (!searchQuery.trim()) return { ...section, groups: accessGroups };
      const q = searchQuery.toLowerCase();
      const groups = accessGroups
        .map((group) => ({
          ...group,
          items: group.items.filter(
            (item) =>
              item.label.toLowerCase().includes(q) ||
              section.label.toLowerCase().includes(q) ||
              (group.label ?? "").toLowerCase().includes(q)
          ),
        }))
        .filter((g) => g.items.length > 0);
      return { ...section, groups };
    })
    .filter((section) => sectionItems(section).length > 0);

  return (
    <aside
      className="shrink-0 sticky top-4 m-4 mr-0 self-start bg-[var(--sidebar-bg)] text-[var(--sidebar-text)] rounded-3xl shadow-xl flex flex-col overflow-visible relative z-30 transition-[width] duration-300 ease-in-out"
      style={{
        width: isCollapsed ? "72px" : "248px",
        height: "calc(100vh - 2rem)",
      }}
    >
      {/* Collapse toggle lives in TopBar (hamburger) — single control */}
      <div
        className={`flex items-center shrink-0 overflow-hidden transition-all duration-300 ${
          isCollapsed ? "justify-center px-0 py-4" : "px-4 py-4"
        }`}
      >
        {isCollapsed ? (
          <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0 overflow-hidden bg-white/5">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img key={logos.icon} src={logos.icon} alt="Suki logo icon" className="w-9 h-9 object-contain" />
          </div>
        ) : (
          <div className="flex w-full justify-center overflow-hidden">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              key={logos.full}
              src={logos.full}
              alt="Suki logo"
              className="h-12 w-full object-contain object-center"
              style={{ maxWidth: "200px" }}
            />
          </div>
        )}
      </div>

      {!isCollapsed ? (
        <div className="px-3 pb-3 shrink-0">
          <div className="relative">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              ref={searchInputRef}
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search modules... (⌘K)"
              className="w-full h-8 pl-8 pr-7 text-xs bg-white/5 text-[var(--sidebar-text)] placeholder:text-slate-500 rounded-xl border border-white/10 focus:outline-none focus:ring-1 focus:ring-white/30 focus:border-white/20 transition-all"
            />
            {searchQuery ? (
              <button onClick={() => setSearchQuery("")} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white text-xs font-bold">
                ✕
              </button>
            ) : (
              <span className="absolute right-2 top-1/2 -translate-y-1/2 text-[9px] font-mono text-slate-400 bg-white/10 px-1.5 py-0.5 rounded border border-white/10 select-none">
                ⌘K
              </span>
            )}
          </div>
        </div>
      ) : (
        <div className="px-2 pb-3 flex justify-center shrink-0">
          <div className="relative group/tip">
            <button
              onClick={() => {
                setIsCollapsed(false);
                setTimeout(() => searchInputRef.current?.focus(), 100);
              }}
              className="w-10 h-10 rounded-xl flex items-center justify-center text-slate-400 hover:text-white hover:bg-[var(--sidebar-hover)] transition-colors"
              aria-label="Search modules (⌘K)"
            >
              <Search className="w-4 h-4" />
            </button>
            <CollapsedTooltip label="Search" />
          </div>
        </div>
      )}

      <nav className="flex-1 min-h-0 overflow-y-auto overflow-x-visible py-2 px-2.5">
        {filteredSections.map((section) => {
          const SectionIcon = section.sectionIcon;
          const items = sectionItems(section);
          const hasActive = items.some((item) => isRouteActive(pathname, item.href, currentSearch));
          const isExpanded = searchQuery.trim() ? true : openSection === section.label;
          const isFlyoutOpen = flyoutSection === section.label;

          if (isCollapsed) {
            return (
              <div
                key={section.label}
                className="relative mb-1.5"
                onMouseEnter={() => handleFlyoutEnter(section.label)}
                onMouseLeave={handleFlyoutLeave}
              >
                <button
                  className={`w-full h-10 flex items-center justify-center rounded-xl transition-all duration-150 cursor-pointer ${
                    hasActive
                      ? "bg-[var(--primary)] text-white shadow-sm"
                      : "text-slate-400 hover:bg-[var(--sidebar-hover)] hover:text-white"
                  }`}
                  aria-label={section.label}
                >
                  <SectionIcon className="w-5 h-5 shrink-0" />
                </button>
                {isFlyoutOpen && (
                  <div className="absolute left-full top-0 ml-3 z-50 min-w-[220px] max-h-[70vh] overflow-y-auto bg-[var(--sidebar-bg)] border border-white/10 rounded-2xl shadow-2xl p-2.5 animate-fade-in">
                    <p className="px-3 py-1.5 text-[11px] font-bold text-slate-400 uppercase tracking-wider border-b border-white/10 mb-1.5">
                      {section.label}
                    </p>
                    <div className="space-y-2">
                      {section.groups.map((group, gi) => (
                        <div key={group.label ?? gi} className="space-y-0.5">
                          {group.label && (
                            <p className="px-3 pt-1 text-[10px] font-semibold text-slate-500 uppercase tracking-wider">{group.label}</p>
                          )}
                          {group.items.map((item) => (
                            <NavLink key={item.href} item={item} pathname={pathname} />
                          ))}
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            );
          }

          return (
            <div key={section.label} className="mb-1">
              <button
                onClick={() => setOpenSection((prev) => (prev === section.label ? null : section.label))}
                className={`w-full flex items-center justify-between px-3 py-2 rounded-xl text-xs font-bold transition-all duration-150 cursor-pointer ${
                  hasActive ? "text-white bg-white/10" : "text-slate-400 hover:text-slate-200 hover:bg-[var(--sidebar-hover)]"
                }`}
              >
                <div className="flex items-center gap-2.5">
                  <SectionIcon className="w-4 h-4 shrink-0 opacity-80" />
                  <span className="uppercase tracking-wider text-[11px] font-bold">{section.label}</span>
                </div>
                <ChevronDown className={`w-3.5 h-3.5 text-slate-400 transition-transform duration-200 ${isExpanded ? "rotate-180" : ""}`} />
              </button>

              {isExpanded && (
                <div className="mt-1 ml-2 pl-2 border-l border-white/10 space-y-2">
                  {section.groups.map((group, gi) => (
                    <div key={group.label ?? gi} className="space-y-0.5">
                      {group.label && (
                        <p className="px-3 pt-1.5 pb-0.5 text-[10px] font-semibold text-slate-500 uppercase tracking-wider">
                          {group.label}
                        </p>
                      )}
                      {group.items.map((item) => (
                        <NavLink key={item.href} item={item} pathname={pathname} />
                      ))}
                    </div>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </nav>

      {/* Spacer separation + bottom utility / profile */}
      <div className="mt-auto shrink-0 px-2.5 pb-3 pt-4">
        <div className={`flex items-center gap-3 rounded-2xl bg-white/5 ${isCollapsed ? "justify-center p-2" : "px-2.5 py-2.5"}`}>
          <div className="relative group/tip">
            <div className="w-8 h-8 rounded-full bg-[var(--primary)] text-white flex items-center justify-center text-xs font-bold shrink-0">
              {(displayUser?.name || displayUser?.userId || "?").charAt(0).toUpperCase()}
            </div>
            {isCollapsed && (
              <CollapsedTooltip label={displayUser?.name || displayUser?.userId || "Not signed in"} />
            )}
          </div>
          {!isCollapsed && (
            <div className="min-w-0 flex-1">
              <p className="text-xs font-bold text-white truncate leading-tight">
                {displayUser?.name || displayUser?.userId || "Not signed in"}
              </p>
              <p className="text-[10px] text-slate-400 truncate leading-tight">
                {displayUser
                  ? displayUser.addRoleName || displayUser.roleName || "User"
                  : "—"}
              </p>
            </div>
          )}
        </div>
      </div>
    </aside>
  );
}
