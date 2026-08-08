"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { SimpleMasterShell } from "@/components/SimpleMasterShell";

/** Permissions UI lives on Roles (role × permission matrix). */
export default function PermissionsSettingsPage() {
  const router = useRouter();

  useEffect(() => {
    router.replace("/dashboard/settings/roles");
  }, [router]);

  return (
    <SimpleMasterShell
      title="Permissions"
      subtitle="Redirecting to Roles & Permissions…"
    >
      <p className="text-sm text-[var(--text-muted)]">
        Permission toggles are edited on the Roles page as a single matrix view.
      </p>
    </SimpleMasterShell>
  );
}
