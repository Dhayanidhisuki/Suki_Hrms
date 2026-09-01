"use client";

import { Plus } from "lucide-react";
import Link from "next/link";
import { useSession } from "@/lib/SessionContext";

export default function PageHeader() {
  const { canModuleAction } = useSession();
  
  return (
    <div className="flex items-center justify-between mb-6">
      {/* ── Title block ── */}
      <div>
        <h1 className="text-2xl font-bold text-[var(--text-primary)] tracking-tight">
          Dashboard
        </h1>
        <p className="text-sm text-[var(--text-muted)] mt-0.5">
          Manage your tools and calibration easily
        </p>
      </div>

      {/* ── Primary CTA ── */}
      {canModuleAction("tool_master", "CREATE") && (
        <Link
          id="page-add-tool-btn"
          href="/dashboard/masters/tools?action=add"
          className="group inline-flex items-center justify-center gap-2 rounded-xl bg-[var(--primary)] px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition-all hover:bg-[var(--primary-hover)] hover:shadow-md"
        >
            <Plus className="w-4 h-4 transition-transform group-hover:rotate-90 duration-200" />
            Add Tool
        </Link>
      )}
    </div>
  );
}
