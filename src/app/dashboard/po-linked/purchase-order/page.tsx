"use client";

import { PendingFeature } from "@/components/PendingFeature";

export default function Page() {
  return (
    <PendingFeature
      title="Purchase Order"
      kind="unavailable"
      reason="Purchase Order creation is handled by a separate, shared Purchasing module (COMMON_PURCHASE_ORDER), not owned by Tools Management. This page will show a read-only reference view once that integration is scoped."
    />
  );
}
