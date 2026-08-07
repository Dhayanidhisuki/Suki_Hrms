"use client";

/** APP-SPECIFIC — Uses Sidebar/TopBar; copy as layout pattern only. See design-system-export/NOTES.md */

import Sidebar from "@/app/dashboard/components/Sidebar";
import TopBar from "@/app/dashboard/components/TopBar";
import { AlertCircle, HelpCircle } from "lucide-react";

export type PendingKind = "unavailable" | "scope";

interface PendingFeatureProps {
  title: string;
  kind: PendingKind;
  reason: string;
}

export function PendingFeature({ title, kind, reason }: PendingFeatureProps) {
  const Icon = kind === "unavailable" ? AlertCircle : HelpCircle;
  const headline =
    kind === "unavailable"
      ? "This feature is not yet available."
      : "This feature's data source is confirmed but its scope is still being finalized.";

  return (
    <div className="flex h-screen bg-[var(--bg-app)] text-[var(--text-primary)] overflow-hidden">
      <Sidebar />
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        <TopBar />
        <main className="flex-1 overflow-y-auto px-7 py-6">
          <div className="mb-6">
            <h1 className="text-2xl font-medium text-[var(--text-primary)] tracking-tight">{title}</h1>
          </div>
          <div className="max-w-2xl bg-[var(--bg-card)] border border-[var(--border-main)] rounded-2xl p-6 space-y-4">
            <div className="flex items-start gap-3">
              <div className="mt-0.5 w-9 h-9 rounded-xl bg-[var(--bg-subtle)] flex items-center justify-center shrink-0">
                <Icon className="w-5 h-5 text-[var(--primary)]" />
              </div>
              <div className="space-y-3">
                <p className="text-sm font-medium text-[var(--text-primary)]">{headline}</p>
                <p className="text-sm text-[var(--text-secondary)] leading-relaxed">{reason}</p>
                {kind === "unavailable" && (
                  <p className="text-sm text-[var(--text-muted)] leading-relaxed">
                    No changes will be made to the database for this feature without explicit approval.
                  </p>
                )}
              </div>
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}
