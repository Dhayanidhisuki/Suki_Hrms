"use client";

import { PendingFeature } from "@/components/PendingFeature";

export default function Page() {
  return (
    <PendingFeature
      title="Activity Logs"
      kind="unavailable"
      reason="Field-level change tracking (what changed, from what value, to what value) does not exist in the current database. The Audit Trail page (Settings → Audit → Audit Trail) shows who created/last updated a record — this page would show the actual field changes, which requires a new table and is pending a product decision."
    />
  );
}
