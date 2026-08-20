import { redirect } from "next/navigation";
import { getSession } from "@/lib/session";
import { isAdminRole } from "@/lib/adminRoles";

/**
 * Server-side guard for the whole /dashboard/settings/** subtree.
 *
 * Defence in depth: `src/middleware.ts` already blocks these paths at the edge,
 * but this layout re-checks on the server so the pages stay protected even if
 * the middleware matcher is ever narrowed or a route is rendered directly.
 *
 * Non-admins never receive the settings HTML at all — they are redirected
 * before any child page renders.
 */
export const dynamic = "force-dynamic";

export default async function SettingsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await getSession();

  if (!session.isLoggedIn) {
    redirect("/login?redirect=/dashboard/settings");
  }

  if (!isAdminRole(session.roleName)) {
    redirect("/dashboard");
  }

  return <>{children}</>;
}
