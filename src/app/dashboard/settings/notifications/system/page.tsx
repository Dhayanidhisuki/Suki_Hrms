"use client";

import { PendingFeature } from "@/components/PendingFeature";

export default function Page() {
  return (
    <PendingFeature
      title="System Notifications"
      kind="unavailable"
      reason="No notification infrastructure exists in the current database. This requires a new table and is pending a product decision."
    />
  );
}
