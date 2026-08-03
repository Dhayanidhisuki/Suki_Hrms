"use client";

import Link from "next/link";
import { SimpleMasterShell } from "@/components/SimpleMasterShell";

const LINKS = [
  { href: "/dashboard/settings/company", label: "Company Settings" },
  { href: "/dashboard/settings/branches", label: "Branch Settings" },
  { href: "/dashboard/settings/tool-numbering", label: "Tool Numbering" },
  { href: "/dashboard/settings/transaction-numbering", label: "Transaction Numbering" },
  { href: "/dashboard/settings/notifications/email", label: "Email Notifications" },
  { href: "/dashboard/settings/notifications/system", label: "System Notifications" },
  { href: "/dashboard/settings/users", label: "Users" },
  { href: "/dashboard/settings/roles", label: "Roles" },
  { href: "/dashboard/settings/permissions", label: "Permissions" },
  { href: "/dashboard/settings/approval-workflow", label: "Approval Workflow" },
  { href: "/dashboard/settings/audit-trail", label: "Audit Trail" },
  { href: "/dashboard/settings/activity-logs", label: "Activity Logs" },
];

export default function SettingsIndexPage() {
  return (
    <SimpleMasterShell title="Settings" subtitle="Organization, configuration, notifications, users, workflow, and audit">
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
        {LINKS.map((l) => (
          <Link
            key={l.href}
            href={l.href}
            className="block bg-[var(--bg-subtle)] border border-[var(--border-main)] rounded-xl p-4 hover:border-[var(--primary)] transition-colors"
          >
            <p className="text-sm font-medium text-[var(--text-primary)]">{l.label}</p>
          </Link>
        ))}
      </div>
    </SimpleMasterShell>
  );
}
