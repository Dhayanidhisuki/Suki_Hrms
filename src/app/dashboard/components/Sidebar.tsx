"use client";

import { useState } from "react";
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
  type LucideIcon,
} from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useSession } from "@/lib/SessionContext";

const navSections: {
  label: string;
  items: { label: string; href: string; icon: LucideIcon; badge?: string }[];
}[] = [
  {
    label: "Main",
    items: [
      { label: "Dashboard", href: "/", icon: LayoutDashboard },
    ],
  },
  {
    label: "Masters",
    items: [
      { label: "Tools Master", href: "/dashboard/masters/tools", icon: Package },
      { label: "Supplier Master", href: "/dashboard/masters/suppliers", icon: Users },
      { label: "Subcontractors", href: "/dashboard/masters/subcontractors", icon: Building2 },
      { label: "Lookup Tables", href: "/dashboard/masters/lookups", icon: Layers },
    ],
  },
  {
    label: "Transactions",
    items: [
      { label: "Issue Tool", href: "/dashboard/transactions/issue", icon: ArrowUpRight },
      { label: "Receive Tool", href: "/dashboard/transactions/receive", icon: ArrowDownLeft },
      { label: "Consumption", href: "/dashboard/transactions/consumption", icon: ClipboardList },
    ],
  },
  {
    label: "Purchase",
    items: [
      { label: "PO GRN Receive", href: "/dashboard/po-linked/receive", icon: ShoppingCart },
      { label: "PO Schedule", href: "/dashboard/po-linked/schedule", icon: ClipboardList },
    ],
  },
  {
    label: "Calibration",
    items: [
      { label: "Calibration Issue", href: "/dashboard/calibration/issue", icon: CalendarClock },
      { label: "Calibration Receive", href: "/dashboard/calibration/receive", icon: ArrowDownLeft },
      { label: "Due List & History", href: "/dashboard/calibration/due-list", icon: History, badge: "14" },
    ],
  },
];

export default function Sidebar() {
  const pathname = usePathname();
  const { user } = useSession();
  const displayUser = user ?? { userId: "...", name: "Loading...", roleName: "" };
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});

  return (
    <aside className="w-[240px] shrink-0 h-screen sticky top-0 bg-white border-r border-slate-200 flex flex-col overflow-hidden">
      {/* ── Logo ── */}
      <div className="flex items-center gap-3 px-5 py-5 border-b border-slate-100">
        <div className="w-9 h-9 bg-blue-600 rounded-xl flex items-center justify-center shadow-sm shrink-0">
          <Wrench className="w-4.5 h-4.5 text-white" />
        </div>
        <div className="leading-tight min-w-0">
          <p className="text-sm font-bold text-slate-900 tracking-tight truncate">
            SUKI ERP
          </p>
          <p className="text-[10px] text-slate-400 font-medium tracking-wider uppercase truncate">
            Tools Management
          </p>
        </div>
      </div>

      {/* ── Nav sections ── */}
      <nav className="flex-1 overflow-y-auto py-4 px-3">
        {navSections.map((section) => {
          const hasActive = section.items.some(
            (item) => pathname === item.href || (item.href !== "/" && pathname.startsWith(item.href))
          );
          const isExpanded = !collapsed[section.label] || hasActive;
          return (
          <div key={section.label} className="mb-5">
            {/* Section label — clickable to toggle */}
            <button
              onClick={() =>
                setCollapsed((prev) => ({ ...prev, [section.label]: !prev[section.label] }))
              }
              className="flex items-center gap-1 w-full text-[10px] font-bold text-slate-400 uppercase tracking-widest px-2 mb-1.5 hover:text-slate-600 transition-colors"
            >
              <ChevronRight
                className={`w-3 h-3 shrink-0 transition-transform duration-200 ${
                  isExpanded ? "rotate-90" : ""
                }`}
              />
              <span>{section.label}</span>
            </button>

            {/* Nav items */}
            <div
              className={`overflow-hidden transition-all duration-200 ${
                isExpanded ? "max-h-96 opacity-100" : "max-h-0 opacity-0"
              }`}
            >
            <ul className="space-y-0.5">
              {section.items.map((item) => {
                const isActive = pathname === item.href || (item.href !== "/" && pathname.startsWith(item.href));
                const Icon = item.icon;
                return (
                  <li key={item.label}>
                    <Link
                      href={item.href}
                      className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all duration-150 group ${
                        isActive
                          ? "bg-blue-600 text-white shadow-sm shadow-blue-200"
                          : "text-slate-600 hover:bg-slate-50 hover:text-slate-900"
                      }`}
                    >
                      <Icon
                        className={`w-4 h-4 shrink-0 ${
                          isActive
                            ? "text-white"
                            : "text-slate-400 group-hover:text-slate-600"
                        }`}
                      />

                      <span className="flex-1 truncate">{item.label}</span>

                      {item.badge && (
                        <span
                          className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full ${
                            isActive
                              ? "bg-white/20 text-white"
                              : "bg-amber-100 text-amber-700"
                          }`}
                        >
                          {item.badge}
                        </span>
                      )}

                      {!isActive && (
                        <ChevronRight className="w-3.5 h-3.5 text-slate-300 opacity-0 group-hover:opacity-100 transition-opacity shrink-0" />
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
      <div className="border-t border-slate-100 px-3 py-3 space-y-0.5">
        <button
          id="sidebar-settings-btn"
          className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium text-slate-500 hover:bg-slate-50 hover:text-slate-800 transition-colors group"
        >
          <Settings className="w-4 h-4 text-slate-400 group-hover:text-slate-600" />
          <span>Settings</span>
        </button>
        <button
          id="sidebar-notifications-btn"
          className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium text-slate-500 hover:bg-slate-50 hover:text-slate-800 transition-colors group"
        >
          <Bell className="w-4 h-4 text-slate-400 group-hover:text-slate-600" />
          <span>Notifications</span>
          <span className="ml-auto text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-red-100 text-red-600">
            3
          </span>
        </button>
      </div>

      {/* ── User profile footer (Sample ErpUser U0001) ── */}
      <div className="border-t border-slate-100 p-3">
        <div className="flex items-center gap-3 px-2 py-2 rounded-xl hover:bg-slate-50 cursor-pointer transition-colors group">
          <div className="w-8 h-8 rounded-full bg-blue-600 flex items-center justify-center text-white text-xs font-bold shadow-sm shrink-0">
            {displayUser.userId}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-slate-800 truncate leading-tight">
              {displayUser.name}
            </p>
            <p className="text-[11px] text-slate-400 truncate leading-tight font-mono">
              {displayUser.userId}
            </p>
          </div>
          <button
            id="sidebar-logout-btn"
            className="w-7 h-7 rounded-lg flex items-center justify-center text-slate-300 hover:text-red-500 hover:bg-red-50 transition-colors shrink-0"
          >
            <LogOut className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
    </aside>
  );
}
