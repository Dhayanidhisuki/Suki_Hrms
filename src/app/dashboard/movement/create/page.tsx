"use client";

import { useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import IssueToolPage from "../../transactions/issue/page";

export default function CreateMovementPage() {
  const router = useRouter();
  const searchParams = useSearchParams();

  useEffect(() => {
    if (searchParams.get("action") !== "add") {
      const params = new URLSearchParams(searchParams.toString());
      params.set("action", "add");
      router.replace(`/dashboard/movement/create?${params.toString()}`, { scroll: false });
    }
  }, [router, searchParams]);

  return <IssueToolPage />;
}
