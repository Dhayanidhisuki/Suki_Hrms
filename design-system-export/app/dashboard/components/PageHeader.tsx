"use client";

import { Plus } from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";

export type PageHeaderProps = {
  title?: string;
  subtitle?: string;
  /** Optional primary CTA */
  actionHref?: string;
  actionLabel?: string;
  actionId?: string;
};

/** Presentational page title + optional CTA. Pass href/label from the host app. */
export default function PageHeader({
  title = "Dashboard",
  subtitle = "Overview",
  actionHref,
  actionLabel = "Add",
  actionId = "page-primary-action",
}: PageHeaderProps) {
  return (
    <div className="flex items-center justify-between mb-6">
      <div>
        <h1 className="text-2xl font-bold text-[var(--text-primary)] tracking-tight">{title}</h1>
        <p className="text-sm text-[var(--text-muted)] mt-0.5">{subtitle}</p>
      </div>

      {actionHref ? (
        <Link href={actionHref}>
          <Button id={actionId} variant="primary" className="group">
            <Plus className="w-4 h-4 transition-transform group-hover:rotate-90 duration-200" />
            {actionLabel}
          </Button>
        </Link>
      ) : null}
    </div>
  );
}
