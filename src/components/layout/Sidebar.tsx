"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import { ChevronDown, Search, X } from "lucide-react";
import { BrandLogo } from "@/components/BrandLogo";
import { navIcon } from "./navIconMap";
import { navigation, allNavLeaves, type NavModule, type NavLeaf } from "./navigation";
import { fetchCurrentUser } from "@/lib/currentUser";

interface SidebarProps {
  open: boolean;
  onClose: () => void;
  collapsed: boolean;
  onToggleCollapse: () => void;
}

interface CurrentUser {
  isSuperAdmin: boolean;
  hasAdminAccess: boolean;
  /** Holds any permission at all — an HR-side role rather than an ESS-only login. */
  hasHrAccess: boolean;
  roleCode: string | null;
  hasEmployeeAccess: boolean;
  isManager: boolean;
  name?: string | null;
  roleName?: string | null;
}

/**
 * Approval Center as a manager sees it: only the queues that actually have a
 * Reporting-Manager stage. The HR-only groups (Recruitment, Employees,
 * Payroll, Visitor) are dropped rather than shown empty.
 */
function managerApprovalModule(mod: NavModule): NavModule | null {
  const groups = mod.groups
    .map((g) => ({ ...g, items: g.items.filter((i) => i.managerQueue) }))
    .filter((g) => g.items.length > 0);
  return groups.length > 0 ? { ...mod, groups } : null;
}

/** Label tooltip for the collapsed rail. */
function CollapsedTooltip({ label }: { label: string }) {
  return (
    <span
      role="tooltip"
      className="pointer-events-none absolute left-full top-1/2 z-50 ml-3 -translate-y-1/2 whitespace-nowrap rounded-lg bg-white px-2.5 py-1.5 text-xs font-semibold text-[var(--sidebar-bg)] opacity-0 shadow-md transition-opacity duration-150 group-hover/tip:opacity-100"
    >
      {label}
    </span>
  );
}

export default function Sidebar({ open, onClose, collapsed, onToggleCollapse }: SidebarProps) {
  const pathname = usePathname();
  const [openModule, setOpenModule] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [me, setMe] = useState<CurrentUser | null>(null);
  const [flyout, setFlyout] = useState<string | null>(null);
  const flyoutTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const searchRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    let cancelled = false;
    fetchCurrentUser()
      .then((data) => {
        if (!cancelled && data)
          setMe({
            isSuperAdmin: data.isSuperAdmin,
            hasAdminAccess: data.hasAdminAccess,
            hasHrAccess: !!data.hasHrAccess,
            roleCode: data.roleCode,
            hasEmployeeAccess: data.hasEmployeeAccess,
            isManager: !!data.isManager,
            name: data.employeeName || data.email || null,
            roleName: data.roleCode ?? null,
          });
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, []);

  // ⌘K focuses module search, expanding the rail first if it is collapsed.
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        if (collapsed) onToggleCollapse();
        setTimeout(() => searchRef.current?.focus(), 60);
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [collapsed, onToggleCollapse]);

  // Superadmin sees ONLY the Superadmin section. An ESS-only login (an employee
  // record, no permissions) sees ONLY Dashboard (employee), Services, Profile
  // and Visitors. An HR-side login sees the HR modules — and if it ALSO has an
  // employee record, it keeps its own ESS modules too, because an HR manager is
  // still someone who applies for leave and reads their own payslip.
  //
  // The HR test is hasHrAccess (holds any permission), not hasAdminAccess
  // (admin.* only): an HR Admin has no admin.* grant, and testing the narrow
  // flag used to strip every HR module the moment that person was given an
  // employee record.
  const visibleNavigation = useMemo(() => {
    const employeeModules = ["Dashboard", "Services", "Profile", "Visitors"];
    const isEmployeeModule = (mod: NavModule) =>
      mod.label === "Dashboard"
        ? mod.href.includes("/ess/")
        : employeeModules.includes(mod.label);

    if (me?.isSuperAdmin) {
      return navigation.filter((mod) => mod.label === "Superadmin");
    }

    if (me?.hasEmployeeAccess && !me?.hasHrAccess) {
      const employeeNav = navigation.filter(isEmployeeModule);
      // A plain employee who manages someone still has approval queues to
      // work — the manager stage is gated on the org chart, not on RBAC.
      if (me.isManager) {
        const approvals = navigation.find((mod) => mod.label === "Approval Center");
        const managerView = approvals ? managerApprovalModule(approvals) : null;
        if (managerView) employeeNav.splice(1, 0, managerView);
      }
      return employeeNav;
    }

    return navigation.filter((mod) => {
      if (mod.label === "Superadmin") return false;
      if (mod.label === "Administration") return me ? me.hasAdminAccess : false;
      // An HR user with no employee record has no self-service data to show,
      // so those modules stay hidden for them and only for them.
      if (isEmployeeModule(mod)) return me ? me.hasEmployeeAccess : false;
      return true;
    });
  }, [me]);

  const canSeeLeaf = (item: NavLeaf) =>
    !item.requiredRole || me?.roleCode === item.requiredRole || me?.isSuperAdmin;

  const isLeafActive = (href: string) =>
    href === "/" ? pathname === "/" : pathname === href || pathname.startsWith(`${href}/`);

  const isModuleActive = (mod: NavModule) =>
    mod.href === "/"
      ? pathname === "/"
      : pathname === mod.href || pathname.startsWith(`${mod.href}/`);

  // The module holding the current route opens by default until the user picks another.
  const activeModule = visibleNavigation.find(isModuleActive)?.href ?? null;
  const expandedModule = openModule ?? activeModule;

  const visibleModuleLabels = useMemo(
    () => new Set(visibleNavigation.map((mod) => mod.label)),
    [visibleNavigation]
  );

  const searchResults = useMemo(() => {
    const term = query.trim().toLowerCase();
    if (!term) return [];
    return allNavLeaves
      .filter((leaf) => visibleModuleLabels.has(leaf.module))
      .filter((leaf) => !leaf.requiredRole || me?.roleCode === leaf.requiredRole || me?.isSuperAdmin)
      .filter(
        (leaf) =>
          leaf.label.toLowerCase().includes(term) ||
          leaf.module.toLowerCase().includes(term) ||
          leaf.group.toLowerCase().includes(term),
      )
      .slice(0, 40);
  }, [query, visibleModuleLabels, me]);

  const handleModuleClick = (mod: NavModule) => {
    if (collapsed) {
      onToggleCollapse();
      setOpenModule(mod.href);
      return;
    }
    setOpenModule((current) => (current === mod.href ? "" : mod.href));
  };

  const enterFlyout = (href: string) => {
    if (flyoutTimer.current) clearTimeout(flyoutTimer.current);
    setFlyout(href);
  };
  const leaveFlyout = () => {
    flyoutTimer.current = setTimeout(() => setFlyout(null), 150);
  };

  const readyDot = (
    <span
      className="ml-auto h-1.5 w-1.5 shrink-0 rounded-full bg-white/40"
      title="Screen available"
    />
  );

  const renderLeaf = (item: NavLeaf) => {
    const active = isLeafActive(item.href);
    return (
      <Link
        key={item.href + item.label}
        href={item.href}
        onClick={onClose}
        title={item.label}
        className={`flex items-center justify-between gap-2 rounded-xl px-3 py-2 text-xs font-medium transition-all duration-150 ${
          active
            ? "bg-[var(--primary)] font-semibold text-white shadow-sm"
            : "text-slate-300 hover:bg-[var(--sidebar-hover)] hover:text-white"
        }`}
      >
        <span className="min-w-0 flex-1 truncate">{item.short ?? item.label}</span>
        {item.ready && readyDot}
      </Link>
    );
  };

  const renderGroups = (mod: NavModule) =>
    mod.groups.map((group) => {
      const items = group.items.filter(canSeeLeaf);
      if (items.length === 0) return null;
      return (
        <div key={group.label} className="space-y-0.5">
          <p className="px-3 pb-0.5 pt-1.5 text-[10px] font-semibold uppercase tracking-wider text-slate-500">
            {group.label}
          </p>
          {items.map(renderLeaf)}
        </div>
      );
    });

  const renderModule = (mod: NavModule) => {
    const ModIcon = navIcon(mod.icon);
    const active = isModuleActive(mod);
    const expanded = expandedModule === mod.href && !collapsed;

    if (collapsed) {
      return (
        <div
          key={mod.href}
          className="relative mb-1.5"
          onMouseEnter={() => enterFlyout(mod.href)}
          onMouseLeave={leaveFlyout}
        >
          <button
            type="button"
            onClick={() => handleModuleClick(mod)}
            aria-label={mod.label}
            className={`flex h-10 w-full cursor-pointer items-center justify-center rounded-xl transition-all duration-150 ${
              active
                ? "bg-[var(--primary)] text-white shadow-sm"
                : "text-slate-400 hover:bg-[var(--sidebar-hover)] hover:text-white"
            }`}
          >
            <ModIcon className="h-5 w-5 shrink-0" />
          </button>
          {flyout === mod.href && (
            <div className="absolute left-full top-0 z-50 ml-3 max-h-[70vh] min-w-[230px] overflow-y-auto rounded-2xl border border-white/10 bg-[var(--sidebar-bg)] p-2.5 shadow-2xl">
              <p className="mb-1.5 border-b border-white/10 px-3 py-1.5 text-[11px] font-bold uppercase tracking-wider text-slate-400">
                {mod.label}
              </p>
              <div className="space-y-2">{renderGroups(mod)}</div>
            </div>
          )}
        </div>
      );
    }

    return (
      <div key={mod.href} className="mb-1">
        <button
          type="button"
          onClick={() => handleModuleClick(mod)}
          aria-expanded={expanded}
          className={`flex w-full cursor-pointer items-center justify-between rounded-xl px-3 py-2 text-xs font-bold transition-all duration-150 ${
            active
              ? "bg-white/10 text-white"
              : "text-slate-400 hover:bg-[var(--sidebar-hover)] hover:text-slate-200"
          }`}
        >
          <div className="flex min-w-0 items-center gap-2.5">
            <ModIcon className="h-4 w-4 shrink-0 opacity-80" />
            <span className="truncate text-[11px] font-bold uppercase tracking-wider">
              {mod.short ?? mod.label}
            </span>
          </div>
          <ChevronDown
            className={`h-3.5 w-3.5 shrink-0 text-slate-400 transition-transform duration-200 ${
              expanded ? "rotate-180" : ""
            }`}
          />
        </button>

        {expanded && (
          <div className="ml-2 mt-1 space-y-2 border-l border-white/10 pl-2">{renderGroups(mod)}</div>
        )}
      </div>
    );
  };

  const userName = me?.name || "Not signed in";
  const userRole = me?.isSuperAdmin
    ? "Superadmin"
    : me?.roleName
      ? me.roleName.replace(/-/g, " ").replace(/\b\w/g, (c) => c.toUpperCase())
      : "—";

  return (
    <>
      {open && (
        <div className="fixed inset-0 z-30 bg-black/40 md:hidden" onClick={onClose} aria-hidden />
      )}

      <aside
        className={`fixed z-40 m-4 mr-0 flex shrink-0 flex-col self-start overflow-visible rounded-3xl bg-[var(--sidebar-bg)] text-[var(--sidebar-text)] shadow-xl transition-[transform,width] duration-300 ease-in-out md:sticky md:top-4 ${
          open ? "translate-x-0" : "-translate-x-[120%] md:translate-x-0"
        }`}
        style={{ width: collapsed ? "72px" : "252px", height: "calc(100vh - 2rem)" }}
      >
        {/* Brand */}
        <div
          className={`flex shrink-0 items-center justify-center overflow-hidden transition-all duration-300 ${
            collapsed ? "px-0 py-4" : "px-3 py-4"
          }`}
        >
          <Link
            href="/"
            onClick={onClose}
            className={`flex items-center justify-center ${collapsed ? "" : "w-full"}`}
          >
            <BrandLogo
              variant={collapsed ? "mark" : "full"}
              className={collapsed ? "text-white" : "w-full justify-center text-white"}
            />
          </Link>
        </div>

        {/* Module search */}
        {!collapsed ? (
          <div className="shrink-0 px-3 pb-3">
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />
              <input
                ref={searchRef}
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search modules... (⌘K)"
                className="h-8 w-full rounded-xl border border-white/10 bg-white/5 pl-8 pr-7 text-xs text-[var(--sidebar-text)] transition-all placeholder:text-slate-500 focus:border-white/20 focus:outline-none focus:ring-1 focus:ring-white/30"
              />
              {query ? (
                <button
                  type="button"
                  onClick={() => setQuery("")}
                  aria-label="Clear search"
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white"
                >
                  <X className="h-3 w-3" />
                </button>
              ) : (
                <span className="absolute right-2 top-1/2 -translate-y-1/2 select-none rounded border border-white/10 bg-white/10 px-1.5 py-0.5 font-mono text-[9px] text-slate-400">
                  ⌘K
                </span>
              )}
            </div>
          </div>
        ) : (
          <div className="flex shrink-0 justify-center px-2 pb-3">
            <div className="group/tip relative">
              <button
                type="button"
                onClick={() => {
                  onToggleCollapse();
                  setTimeout(() => searchRef.current?.focus(), 120);
                }}
                aria-label="Search modules (⌘K)"
                className="flex h-10 w-10 items-center justify-center rounded-xl text-slate-400 transition-colors hover:bg-[var(--sidebar-hover)] hover:text-white"
              >
                <Search className="h-4 w-4" />
              </button>
              <CollapsedTooltip label="Search" />
            </div>
          </div>
        )}

        <nav className="scroll-thin min-h-0 flex-1 overflow-y-auto overflow-x-visible px-2.5 py-2">
          {query.trim() ? (
            <div className="space-y-0.5 pt-1">
              {searchResults.length === 0 && (
                <p className="px-3 py-6 text-center text-xs text-slate-400">
                  No screen matches &ldquo;{query}&rdquo;
                </p>
              )}
              {searchResults.map((leaf) => (
                <Link
                  key={leaf.module + leaf.href + leaf.label}
                  href={leaf.href}
                  onClick={() => {
                    setQuery("");
                    onClose();
                  }}
                  className="flex items-center gap-2 rounded-xl px-3 py-2 text-slate-300 transition hover:bg-[var(--sidebar-hover)] hover:text-white"
                >
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-xs font-medium">{leaf.label}</span>
                    <span className="block truncate text-[10px] text-slate-500">
                      {leaf.module} · {leaf.group}
                    </span>
                  </span>
                  {leaf.ready && readyDot}
                </Link>
              ))}
            </div>
          ) : (
            visibleNavigation.map(renderModule)
          )}
        </nav>

        {/* Signed-in user */}
        <div className="mt-auto shrink-0 px-2.5 pb-3 pt-4">
          <div
            className={`flex items-center gap-3 rounded-2xl bg-white/5 ${
              collapsed ? "justify-center p-2" : "px-2.5 py-2.5"
            }`}
          >
            <div className="group/tip relative">
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[var(--primary)] text-xs font-bold text-white">
                {userName.charAt(0).toUpperCase()}
              </div>
              {collapsed && <CollapsedTooltip label={userName} />}
            </div>
            {!collapsed && (
              <div className="min-w-0 flex-1">
                <p className="truncate text-xs font-bold leading-tight text-white">{userName}</p>
                <p className="truncate text-[10px] leading-tight text-slate-400">{userRole}</p>
              </div>
            )}
          </div>
        </div>
      </aside>
    </>
  );
}
