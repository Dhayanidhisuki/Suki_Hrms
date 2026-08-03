"use client";

import { PendingFeature } from "@/components/PendingFeature";

export default function Page() {
  return (
    <PendingFeature
      title="Approval Workflow"
      kind="scope"
      reason="An approval workflow exists for Purchase transactions only (PURCHASE_APPROVAL). Pending confirmation on whether Tools Management needs its own general-purpose approval workflow, or whether the existing Purchase approval is sufficient."
    />
  );
}
