"use client";

import { PendingFeature } from "@/components/PendingFeature";

export default function Page() {
  return (
    <PendingFeature
      title="Roles"
      kind="scope"
      reason="Tools Management does not maintain its own user or role records — access is read directly from the existing ERP system. Pending confirmation on whether this page should be read-only (showing current access) or support editing (which would require a design change)."
    />
  );
}
