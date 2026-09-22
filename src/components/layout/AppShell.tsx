"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import Sidebar from "./Sidebar";
import Topbar from "./Topbar";

const COLLAPSE_KEY = "suki_sidebar_collapsed";

export default function AppShell({ children }: { children: React.ReactNode }) {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [collapsed, setCollapsed] = useState(false);
  const pathname = usePathname();

  // Restore the rail state after mount — reading localStorage during render
  // would desync the server-rendered markup.
  useEffect(() => {
    // Syncing from a browser-only source after mount is the point here.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setCollapsed(localStorage.getItem(COLLAPSE_KEY) === "true");
  }, []);

  const toggleCollapse = () => {
    setCollapsed((value) => {
      const next = !value;
      localStorage.setItem(COLLAPSE_KEY, String(next));
      return next;
    });
  };

  // The hamburger opens the drawer on mobile and collapses the rail on desktop.
  const handleMenuClick = () => {
    if (window.matchMedia("(min-width: 768px)").matches) {
      toggleCollapse();
    } else {
      setSidebarOpen((value) => !value);
    }
  };

  if (pathname === "/login" || pathname.startsWith("/portal")) {
    return <>{children}</>;
  }

  return (
    <div className="flex min-h-screen bg-[var(--bg-app)]">
      <Sidebar
        open={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
        collapsed={collapsed}
        onToggleCollapse={toggleCollapse}
      />
      <div className="flex min-w-0 flex-1 flex-col">
        <Topbar onMenuClick={handleMenuClick} />
        <main className="min-w-0 flex-1 overflow-x-auto px-4 py-4 md:py-5">{children}</main>
      </div>
    </div>
  );
}
