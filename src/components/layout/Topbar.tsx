"use client";

import { usePathname } from "next/navigation";
import Icon from "./NavIcons";
import ThemeToggle from "./ThemeToggle";

interface TopbarProps {
  onMenuClick: () => void;
}

export default function Topbar({ onMenuClick }: TopbarProps) {
  const pathname = usePathname();
  const segments = pathname.split("/").filter(Boolean);
  const title =
    pathname === "/"
      ? "Dashboard"
      : segments
          .map((segment) => (segment.startsWith("[") ? "Details" : segment.replaceAll("-", " ")))
          .map((segment) => segment.replace(/\b\w/g, (char) => char.toUpperCase()))
          .join(" / ");

  return (
    <header className="sticky top-0 z-20 px-4 pt-4 md:px-6" style={{ background: "var(--background)" }}>
      <div className="card flex items-center gap-3 px-3 py-2.5 md:px-4">
        <button
          onClick={onMenuClick}
          aria-label="Toggle sidebar"
          className="grid h-9 w-9 shrink-0 place-items-center rounded-lg md:hidden"
          style={{ color: "var(--foreground-muted)" }}
        >
          <Icon name="menu" size={20} strokeWidth={2} />
        </button>

        {/* Search */}
        <label
          className="hidden h-11 flex-1 items-center gap-3 rounded-full border px-4 sm:flex md:max-w-md"
          style={{ borderColor: "var(--border)", background: "var(--surface)" }}
        >
          <Icon name="search" size={17} style={{ color: "var(--foreground-muted)" }} />
          <input
            type="search"
            placeholder="Search anything Here..."
            className="w-full bg-transparent text-sm outline-none placeholder:text-[color:var(--foreground-muted)]"
            style={{ color: "var(--foreground)" }}
          />
        </label>

        <p className="truncate text-sm font-semibold sm:hidden" style={{ color: "var(--foreground)" }}>
          {title}
        </p>

        <div className="ml-auto flex items-center gap-2 md:gap-3">
          <ThemeToggle />

          {(["bell", "message"] as const).map((name) => (
            <button
              key={name}
              type="button"
              aria-label={name === "bell" ? "Notifications" : "Messages"}
              className="relative hidden h-11 w-11 place-items-center rounded-full border transition hover:bg-[color:var(--surface-hover)] sm:grid"
              style={{ borderColor: "var(--border)", color: "var(--foreground-muted)" }}
            >
              <Icon name={name} size={18} />
              {name === "bell" && (
                <span
                  className="absolute right-3 top-3 h-2 w-2 rounded-full ring-2"
                  style={{ background: "var(--danger)", ["--tw-ring-color" as string]: "var(--surface)" }}
                />
              )}
            </button>
          ))}

          <div
            className="flex items-center gap-2 rounded-full border py-1.5 pl-1.5 pr-2 md:pr-3"
            style={{ borderColor: "var(--border)" }}
          >
            <span
              className="grid h-8 w-8 shrink-0 place-items-center rounded-full text-xs font-bold text-white"
              style={{ background: "var(--accent)" }}
            >
              JC
            </span>
            <span className="hidden leading-tight md:block">
              <span className="block text-[13px] font-semibold" style={{ color: "var(--foreground)" }}>
                James Carter
              </span>
              <span className="block text-[11px]" style={{ color: "var(--foreground-muted)" }}>
                Super Admin
              </span>
            </span>
            <Icon name="chevron" size={13} style={{ color: "var(--foreground-muted)", transform: "rotate(90deg)" }} />
          </div>

          <form action="/api/auth/logout" method="POST" className="hidden lg:block">
            <button
              className="rounded-full border px-3 py-2 text-xs font-medium transition hover:opacity-70"
              style={{ borderColor: "var(--border)", color: "var(--foreground-muted)" }}
            >
              Sign out
            </button>
          </form>
        </div>
      </div>
    </header>
  );
}
