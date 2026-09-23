"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { PageLoader } from "./PageLoader";

/**
 * How long the branded overlay covers a client-side route change.
 *
 * This was 1800ms, which held the screen on every single navigation whether or
 * not the page was ready — the app read as stuck. Long enough to register as a
 * deliberate transition, short enough that it never becomes the wait itself.
 */
const DISPLAY_MS = 450;

/** Branded overlay across client-side route changes. */
export function NavigationLoader() {
  const pathname = usePathname();
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setLoading(true);
    const timer = setTimeout(() => setLoading(false), DISPLAY_MS);
    return () => clearTimeout(timer);
  }, [pathname]);

  return loading ? <PageLoader /> : null;
}
