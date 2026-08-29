"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useMemo, useState } from "react";
import Icon from "./NavIcons";
import { navigation, allNavLeaves, type NavModule } from "./navigation";

interface SidebarProps {
  open: boolean;
  onClose: () => void;
  collapsed: boolean;
  onToggleCollapse: () => void;
}

const readyCount = allNavLeaves.filter((leaf) => leaf.ready).length;
const totalCount = allNavLeaves.length;

export default function Sidebar({ open, onClose, collapsed, onToggleCollapse }: SidebarProps) {
  const pathname = usePathname();
  const [openModule, setOpenModule] = useState<string | null>(null);
  const [query, setQuery] = useState("");

  const isLeafActive = (href: string) =>
    href === "/" ? pathname === "/" : pathname === href || pathname.startsWith(`${href}/`);

  const isModuleActive = (mod: NavModule) =>
    mod.href === "/"
      ? pathname === "/"
      : pathname === mod.href || pathname.startsWith(`${mod.href}/`);

  // The module holding the current route opens by default until the user picks another.
  const activeModule = navigation.find(isModuleActive)?.label ?? null;
  const expandedModule = openModule ?? activeModule;

  const searchResults = useMemo(() => {
    const term = query.trim().toLowerCase();
    if (!term) return [];
    return allNavLeaves
      .filter(
        (leaf) =>
          leaf.label.toLowerCase().includes(term) ||
          leaf.module.toLowerCase().includes(term) ||
          leaf.group.toLowerCase().includes(term),
      )
      .slice(0, 40);
  }, [query]);

  const handleModuleClick = (mod: NavModule) => {
    if (collapsed) {
      onToggleCollapse();
      setOpenModule(mod.label);
      return;
    }
    setOpenModule((current) => (current === mod.label ? "" : mod.label));
  };

  const readyDot = (
    <span
      className="ml-auto h-1.5 w-1.5 shrink-0 rounded-full"
      style={{ background: "var(--accent)" }}
      title="Screen available"
    />
  );

  const renderModule = (mod: NavModule) => {
    const active = isModuleActive(mod);
    const expanded = expandedModule === mod.label && !collapsed;

    return (
      <div key={mod.label}>
        <button
          type="button"
          onClick={() => handleModuleClick(mod)}
          aria-expanded={expanded}
          title={mod.label}
          className={`group flex w-full items-center gap-3 rounded-full py-2 pl-2 pr-3 text-sm font-medium transition ${
            collapsed ? "justify-center px-2" : ""
          }`}
          style={
            active
              ? { background: "var(--accent)", color: "var(--sidebar-fg-active)" }
              : { color: "var(--sidebar-fg)" }
          }
        >
          <span
            className="grid h-8 w-8 shrink-0 place-items-center rounded-full transition"
            style={{
              background: active ? "rgba(255,255,255,0.22)" : "var(--sidebar-icon-bg)",
              color: active ? "var(--sidebar-fg-active)" : "var(--foreground-muted)",
            }}
          >
            <Icon name={mod.icon} size={17} />
          </span>

          {!collapsed && (
            <>
              <span className="flex-1 truncate text-left">{mod.short ?? mod.label}</span>
              <Icon
                name="chevron"
                size={14}
                className="shrink-0 transition-transform"
                style={{ transform: expanded ? "rotate(90deg)" : "rotate(0deg)" }}
              />
            </>
          )}
        </button>

        {expanded && (
          <div
            className="mt-1 mb-2 ml-[26px] border-l pl-3"
            style={{ borderColor: "var(--border)" }}
          >
            {mod.groups.map((group) => (
              <div key={group.label} className="mb-2 last:mb-0">
                <p
                  className="px-2 pb-1 pt-2 text-[10px] font-bold uppercase tracking-wider"
                  style={{ color: "var(--foreground-muted)" }}
                >
                  {group.label}
                </p>
                <div className="space-y-0.5">
                  {group.items.map((item) => {
                    const itemActive = isLeafActive(item.href);
                    return (
                      <Link
                        key={item.href + item.label}
                        href={item.href}
                        onClick={onClose}
                        title={item.label}
                        className="flex items-center gap-2 rounded-lg px-2.5 py-1.5 text-[13px] leading-snug transition hover:bg-[color:var(--surface-hover)]"
                        style={{
                          color: itemActive ? "var(--accent)" : "var(--foreground-muted)",
                          fontWeight: itemActive ? 600 : 400,
                          background: itemActive ? "var(--accent-soft)" : "transparent",
                        }}
                      >
                        <span className="min-w-0 flex-1 truncate">{item.short ?? item.label}</span>
                        {item.ready && readyDot}
                      </Link>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    );
  };

  return (
    <>
      {open && (
        <div className="fixed inset-0 z-30 bg-black/40 md:hidden" onClick={onClose} aria-hidden />
      )}

      <aside
        className={`fixed md:sticky top-0 z-40 flex h-screen shrink-0 flex-col border-r transition-[transform,width] duration-200 ${
          collapsed ? "w-[84px]" : "w-[272px]"
        } ${open ? "translate-x-0" : "-translate-x-full md:translate-x-0"}`}
        style={{ background: "var(--sidebar-bg)", borderColor: "var(--border)" }}
      >
        {/* Brand */}
        <div
          className={`flex items-center gap-2 px-4 pt-5 pb-3 ${collapsed ? "justify-center" : ""}`}
        >
          <Link href="/" onClick={onClose} className="flex min-w-0 items-center gap-2">
            <span
              className="grid h-9 w-9 shrink-0 place-items-center rounded-xl text-sm font-black text-white"
              style={{ background: "var(--accent)" }}
            >
              S
            </span>
            {!collapsed && (
              <span className="min-w-0">
                <span
                  className="block truncate text-[17px] font-extrabold tracking-tight"
                  style={{ color: "var(--foreground)" }}
                >
                  Suki HRM
                </span>
                <span
                  className="block truncate text-[11px]"
                  style={{ color: "var(--foreground-muted)" }}
                >
                  People operations
                </span>
              </span>
            )}
          </Link>

          <button
            type="button"
            onClick={onToggleCollapse}
            aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
            className="ml-auto hidden h-7 w-7 place-items-center rounded-lg text-white transition hover:opacity-90 md:grid"
            style={{ background: "var(--accent)" }}
          >
            <Icon
              name="chevron"
              size={14}
              strokeWidth={2.2}
              style={{ transform: collapsed ? "rotate(0deg)" : "rotate(180deg)" }}
            />
          </button>
        </div>

        {/* Module search */}
        {!collapsed && (
          <div className="px-3 pb-2">
            <div
              className="flex items-center gap-2 rounded-full px-3 py-2"
              style={{ background: "var(--surface-muted)" }}
            >
              <Icon name="search" size={14} style={{ color: "var(--foreground-muted)" }} />
              <input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Search modules"
                className="min-w-0 flex-1 bg-transparent text-[13px] outline-none"
                style={{ color: "var(--foreground)" }}
              />
              {query && (
                <button
                  type="button"
                  onClick={() => setQuery("")}
                  aria-label="Clear search"
                  style={{ color: "var(--foreground-muted)" }}
                >
                  <Icon name="close" size={13} />
                </button>
              )}
            </div>
          </div>
        )}

        <nav className="scroll-thin flex-1 overflow-y-auto px-3 pb-4">
          {query.trim() ? (
            <div className="space-y-0.5 pt-1">
              {searchResults.length === 0 && (
                <p className="px-3 py-6 text-center text-[13px]" style={{ color: "var(--foreground-muted)" }}>
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
                  className="flex items-center gap-2 rounded-lg px-3 py-2 transition hover:bg-[color:var(--surface-hover)]"
                >
                  <span className="min-w-0 flex-1">
                    <span
                      className="block truncate text-[13px] font-medium"
                      style={{ color: "var(--foreground)" }}
                    >
                      {leaf.label}
                    </span>
                    <span
                      className="block truncate text-[11px]"
                      style={{ color: "var(--foreground-muted)" }}
                    >
                      {leaf.module} · {leaf.group}
                    </span>
                  </span>
                  {leaf.ready && readyDot}
                </Link>
              ))}
            </div>
          ) : (
            <div className="space-y-1">{navigation.map(renderModule)}</div>
          )}
        </nav>

        {/* Build progress */}
        {!collapsed && !query.trim() && (
          <div className="px-3 pb-4">
            <div className="rounded-2xl p-3" style={{ background: "var(--surface-muted)" }}>
              <div className="flex items-baseline justify-between">
                <p className="text-[11px] font-bold uppercase tracking-wider" style={{ color: "var(--foreground-muted)" }}>
                  Build progress
                </p>
                <p className="text-[11px] font-semibold" style={{ color: "var(--foreground)" }}>
                  {readyCount}/{totalCount}
                </p>
              </div>
              <div
                className="mt-2 h-1.5 w-full overflow-hidden rounded-full"
                style={{ background: "var(--chart-track)" }}
              >
                <div
                  className="h-full rounded-full"
                  style={{
                    width: `${Math.round((readyCount / totalCount) * 100)}%`,
                    background: "var(--accent)",
                  }}
                />
              </div>
              <p className="mt-2 text-[11px]" style={{ color: "var(--foreground-muted)" }}>
                Screens available across 14 modules
              </p>
            </div>
          </div>
        )}
      </aside>
    </>
  );
}
