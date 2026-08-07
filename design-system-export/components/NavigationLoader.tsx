"use client";

import { useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import { PageLoader } from "./PageLoader";

const MIN_DISPLAY_MS = 450;

export function NavigationLoader() {
  const pathname = usePathname();
  const [loading, setLoading] = useState(false);
  const isFirstRender = useRef(true);

  useEffect(() => {
    if (isFirstRender.current) {
      isFirstRender.current = false;
      return;
    }
    setLoading(true);
    const timer = setTimeout(() => setLoading(false), MIN_DISPLAY_MS);
    return () => clearTimeout(timer);
  }, [pathname]);

  return loading ? <PageLoader /> : null;
}
