"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { PageLoader } from "./PageLoader";

const MIN_DISPLAY_MS = 1800;

/** Shows the branded H-puzzle overlay on first paint and every client route change. */
export function NavigationLoader() {
  const pathname = usePathname();
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    const timer = setTimeout(() => setLoading(false), MIN_DISPLAY_MS);
    return () => clearTimeout(timer);
  }, [pathname]);

  return loading ? <PageLoader /> : null;
}
