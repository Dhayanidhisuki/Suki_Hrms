"use client";

import { Toaster } from "sonner";

/** App-wide action feedback (success / error). Not for loading — use PageLoader for that. */
export function AppToaster() {
  return (
    <Toaster
      position="top-right"
      richColors
      closeButton
      duration={4000}
      toastOptions={{
        classNames: {
          toast:
            "border border-[var(--border-main)] bg-[var(--bg-card)] text-[var(--text-primary)] shadow-lg",
          title: "text-sm font-semibold",
          description: "text-xs text-[var(--text-secondary)]",
          closeButton: "bg-[var(--bg-subtle)] border-[var(--border-main)]",
        },
      }}
    />
  );
}
