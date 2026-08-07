"use client";

/** APP-SPECIFIC — Hardcoded Tools Management nav + session permissions. See design-system-export/NOTES.md */

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
  ShoppingCart,
  ClipboardList,
  Layers,
  Building2,
  ArrowLeftRight,
  BarChart3,
  FileText,
  Bell,
  Shield,
  GitBranch,
  Tag,
  IndianRupee,
  Gauge,
  type LucideIcon,
} from "lucide-react";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useSession } from "@/lib/SessionContext";
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
          { label: "Tool Overview", href: "/dashboard", icon: LayoutDashboard },
          { label: "Transaction Overview", href: "/dashboard/overview/transactions", icon: ArrowLeftRight },
          { label: "Calibration Overview", href: "/dashboard/overview/calibration", icon: CalendarClock },
          { label: "Purchase Overview", href: "/dashboard/overview/purchase", icon: ShoppingCart },
        ],
      },
    ],
  },
  {
    label: "Masters",
    sectionIcon: Layers,
    groups: [
      {
        label: "Tool Masters",
        items: [
          { label: "Tool Group", href: "/dashboard/masters/tools-group", icon: Package },
          { label: "Tool Subgroup", href: "/dashboard/masters/tools-subgroup", icon: Layers },
          { label: "Tools Name for Type", href: "/dashboard/masters/tool-types", icon: Tag },
          { label: "Item/Asset Master", href: "/dashboard/masters/tools", icon: Package },
          { label: "Tool Pricing Master", href: "/dashboard/masters/pricing", icon: IndianRupee },
          { label: "Reorder Level", href: "/dashboard/masters/reorder-level", icon: Gauge },
          { label: "Tool Mapping", href: "/dashboard/masters/tool-mapping", icon: GitBranch },
        ],
      },
      {
        label: "Calibration Masters",
        items: [
          { label: "Gauge Type Master", href: "/dashboard/masters/gauge-types", icon: Gauge },
          { label: "Calibration Frequency", href: "/dashboard/masters/calib-frequency", icon: CalendarClock },
        ],
      },
      {
        label: "Purchase Masters",
        items: [
          { label: "Supplier Master", href: "/dashboard/masters/suppliers", icon: Users },
          { label: "Subcontractor Master", href: "/dashboard/masters/subcontractors", icon: Building2 },
        ],
      },
    ],
  },
  {
    label: "Tool Transactions",
    sectionIcon: ArrowLeftRight,
    groups: [
      {
        label: "Tool Issue & Return",
        items: [
          { label: "Tool Issue", href: "/dashboard/transactions/issue", icon: ArrowUpRight },
          { label: "Tool Receive", href: "/dashboard/transactions/receive", icon: ArrowDownLeft },
        ],
      },
      {
        label: "Customer Tool Transactions",
        items: [
          { label: "Receive From Customer", href: "/dashboard/transactions/customer-receive", icon: ArrowDownLeft },
        ],
      },
      {
        label: "Tool Requisition",
        items: [
          { label: "Requisition Pending", href: "/dashboard/transactions/requisition-pending", icon: ClipboardList },
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
          { label: "Calibration Issue", href: "/dashboard/calibration/issue", icon: CalendarClock },
          { label: "Calibration Receive", href: "/dashboard/calibration/receive", icon: ArrowDownLeft },
          { label: "Results Update", href: "/dashboard/calibration/results-update", icon: ClipboardList },
          { label: "Due List", href: "/dashboard/calibration/due-list", icon: History },
        ],
      },
    ],
  },
  {
    label: "Purchase",
    sectionIcon: ShoppingCart,
    groups: [
      {
        label: "Purchase Transactions",
        items: [
          { label: "Goods Receipt Note", href: "/dashboard/po-linked/receive", icon: Package },
          { label: "Purchase Order", href: "/dashboard/po-linked/purchase-order", icon: FileText },
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
          { label: "History Card", href: "/dashboard/tools-history-card", icon: History },
          { label: "Current Status", href: "/dashboard/tools-history-card/status", icon: Gauge },
          { label: "Current Holder", href: "/dashboard/tools-history-card/holder", icon: Users },
          { label: "Issue History", href: "/dashboard/tools-history-card/issue", icon: ArrowUpRight },
          { label: "Receive History", href: "/dashboard/tools-history-card/receive", icon: ArrowDownLeft },
          { label: "Calibration Records", href: "/dashboard/tools-history-card/calibration", icon: CalendarClock },
          { label: "Calibration Results", href: "/dashboard/tools-history-card/calibration-results", icon: ClipboardList },
          { label: "GRN History", href: "/dashboard/tools-history-card/grn", icon: Package },
          { label: "Purchase Orders", href: "/dashboard/tools-history-card/purchase-orders", icon: FileText },
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
          { label: "All Tool Reports", href: "/dashboard/reports/tools", icon: BarChart3 },
          { label: "Calibration Reports", href: "/dashboard/reports/calibration", icon: CalendarClock },
          { label: "Supplier Report", href: "/dashboard/reports/suppliers", icon: Users },
          { label: "Subcontractor Report", href: "/dashboard/reports/subcontractors", icon: Building2 },
          { label: "Tools History Report", href: "/dashboard/reports/tools-history", icon: History },
          { label: "Purchase Order Report", href: "/dashboard/reports/purchase-orders", icon: FileText },
        ],
      },
    ],
  },
  {
    label: "Settings",
    sectionIcon: Settings,
    groups: [
      {
        label: "Organization",
        items: [
          { label: "Company Settings", href: "/dashboard/settings/company", icon: Building2 },
          { label: "Branch Settings", href: "/dashboard/settings/branches", icon: GitBranch },
        ],
      },
      {
        label: "Configuration",
        items: [
          { label: "Tool Numbering", href: "/dashboard/settings/tool-numbering", icon: Tag },
          { label: "Transaction Numbering", href: "/dashboard/settings/transaction-numbering", icon: FileText },
        ],
      },
      {
        label: "Notifications",
        items: [
          { label: "Email Notifications", href: "/dashboard/settings/notifications/email", icon: Bell },
          { label: "System Notifications", href: "/dashboard/settings/notifications/system", icon: Bell },
        ],
      },
      {
        label: "Users",
        items: [
          { label: "Users", href: "/dashboard/settings/users", icon: Users },
          { label: "Roles", href: "/dashboard/settings/roles", icon: Shield },
          { label: "Permissions", href: "/dashboard/settings/permissions", icon: Shield },
        ],
      },
      {
        label: "Workflow",
        items: [
          { label: "Approval Workflow", href: "/dashboard/settings/approval-workflow", icon: GitBranch },
        ],
      },
      {
        label: "Audit",
        items: [
          { label: "Audit Trail", href: "/dashboard/settings/audit-trail", icon: History },
          { label: "Activity Logs", href: "/dashboard/settings/activity-logs", icon: ClipboardList },
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

function routeMatches(pathname: string, href: string): boolean {
  if (href === "/dashboard") return pathname === "/dashboard" || pathname === "/";
  return pathname === href || pathname.startsWith(`${href}/`);
}

/**
 * Active when this href is the longest matching nav item for the current path.
 * Prevents e.g. History Card (/tools-history-card) lighting up on Current Holder.
 */
function isRouteActive(pathname: string, href: string): boolean {
  if (!routeMatches(pathname, href)) return false;
  const matches = ALL_NAV_HREFS.filter((h) => routeMatches(pathname, h));
  if (matches.length === 0) return false;
  const best = matches.reduce((a, b) => (a.length >= b.length ? a : b));
  return best === href;
}

function NavLink({ item, pathname }: { item: NavItem; pathname: string }) {
  const ItemIcon = item.icon;
  const isActive = isRouteActive(pathname, item.href);
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
  const { user } = useSession();
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
    const active = navSections.find((s) => sectionItems(s).some((item) => isRouteActive(pathname, item.href)));
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

  const filteredSections = navSections
    .map((section) => {
      if (!searchQuery.trim()) return section;
      const q = searchQuery.toLowerCase();
      const groups = section.groups
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
          <div className="w-full overflow-hidden">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img key={logos.full} src={logos.full} alt="Suki logo" className="w-full h-12 object-contain object-left" style={{ maxWidth: "200px" }} />
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
          const hasActive = items.some((item) => isRouteActive(pathname, item.href));
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
