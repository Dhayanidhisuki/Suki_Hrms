"use client";

import { PendingFeature } from "@/components/PendingFeature";

export default function Page() {
  return (
    <PendingFeature
      title="Requisition Pending"
      kind="scope"
      reason="Two possible data sources exist for this feature — a tools-capable requisition table that has never been used, or an active indent table currently used only for raw materials. Pending a decision on which to build against."
    />
  );
}
