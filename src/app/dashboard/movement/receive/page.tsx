"use client";

import { useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import ReceiveToolPage from "../../transactions/receive/page";

export default function ReceiveMovementPage() {
  const router = useRouter();
  const searchParams = useSearchParams();

  useEffect(() => {
    if (searchParams.get("action") !== "add") {
      const params = new URLSearchParams(searchParams.toString());
      params.set("action", "add");
      router.replace(`/dashboard/movement/receive?${params.toString()}`, { scroll: false });
    }
  }, [router, searchParams]);

  return <ReceiveToolPage />;
}
