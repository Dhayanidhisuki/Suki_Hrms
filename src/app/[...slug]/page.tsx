"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import Icon from "@/components/layout/NavIcons";
import { allNavLeaves, navigation } from "@/components/layout/navigation";

/**
 * Placeholder screen for sidebar routes that exist in the navigation tree but
 * have no page yet. Real pages take precedence over this catch-all route.
 */
export default function ModulePlaceholder() {
  const pathname = usePathname();
  const leaf = allNavLeaves.find((item) => item.href === pathname);
  const mod = navigation.find(
    (entry) => entry.href !== "/" && pathname.startsWith(entry.href),
  );

  const siblings = leaf
    ? navigation
        .find((entry) => entry.label === leaf.module)
        ?.groups.find((group) => group.label === leaf.group)
        ?.items.filter((item) => item.href !== pathname) ?? []
    : [];

  if (!leaf) {
    return (
      <div className="mx-auto max-w-lg py-20 text-center">
        <p className="text-5xl font-black" style={{ color: "var(--foreground-muted)" }}>
          404
        </p>
        <h1 className="mt-3 text-lg font-bold" style={{ color: "var(--foreground)" }}>
          Screen not found
        </h1>
        <p className="mt-1 text-sm" style={{ color: "var(--foreground-muted)" }}>
          <code>{pathname}</code> is not part of the HRMS navigation.
        </p>
        <Link
          href="/"
          className="mt-6 inline-block rounded-full px-5 py-2 text-sm font-semibold text-white"
          style={{ background: "var(--accent)" }}
        >
          Back to dashboard
        </Link>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-3xl">
      <p className="text-[12px] font-semibold uppercase tracking-wider" style={{ color: "var(--foreground-muted)" }}>
        {leaf.module} · {leaf.group}
      </p>
      <h1 className="mt-1 text-2xl font-extrabold tracking-tight" style={{ color: "var(--foreground)" }}>
        {leaf.label}
      </h1>

      <div className="card mt-5 flex flex-col items-center px-6 py-14 text-center">
        <span
          className="grid h-14 w-14 place-items-center rounded-2xl"
          style={{ background: "var(--accent-soft)", color: "var(--accent)" }}
        >
          <Icon name={mod?.icon ?? "masters"} size={26} />
        </span>
        <h2 className="mt-4 text-base font-bold" style={{ color: "var(--foreground)" }}>
          This screen is not built yet
        </h2>
        <p className="mt-1 max-w-md text-sm" style={{ color: "var(--foreground-muted)" }}>
          The route is reserved in the navigation so the module structure can be reviewed.
          The page will be implemented when the {leaf.module} module is developed.
        </p>
        <p className="mt-4 text-[12px]" style={{ color: "var(--foreground-muted)" }}>
          <code>{pathname}</code>
        </p>
      </div>

      {siblings.length > 0 && (
        <div className="mt-5">
          <p className="mb-2 text-[11px] font-bold uppercase tracking-wider" style={{ color: "var(--foreground-muted)" }}>
            Also in {leaf.group}
          </p>
          <div className="flex flex-wrap gap-2">
            {siblings.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className="rounded-full border px-3 py-1.5 text-[13px] transition hover:bg-[color:var(--surface-hover)]"
                style={{ borderColor: "var(--border)", color: "var(--foreground-muted)" }}
              >
                {item.label}
              </Link>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
