/**
 * Shared fetch of GET /api/auth/me.
 *
 * The sidebar and the topbar both need the signed-in user, and each used to
 * call the endpoint itself — two identical round trips on every page load.
 * The in-flight promise is cached at module scope so the second caller joins
 * the first request instead of starting another.
 *
 * Deliberately not a React context: the callers are far apart in the tree and
 * a provider would mean re-rendering the whole shell to share one object.
 */

export interface CurrentUser {
  userId: number;
  email: string | null;
  isSuperAdmin: boolean;
  roleId: number | null;
  roleCode: string | null;
  companyId: number | null;
  companyName: string | null;
  hasAdminAccess: boolean;
  hasHrAccess: boolean;
  hasEmployeeAccess: boolean;
  isManager: boolean;
  employeeId: number | null;
  employeeCode: string | null;
  employeeName: string | null;
}

let inFlight: Promise<CurrentUser | null> | null = null;

export function fetchCurrentUser(): Promise<CurrentUser | null> {
  if (!inFlight) {
    inFlight = fetch('/api/auth/me')
      .then((res) => (res.ok ? (res.json() as Promise<CurrentUser>) : null))
      .catch(() => null);
  }
  return inFlight;
}

/** Drop the cache — call after sign-in or sign-out changes who is logged in. */
export function clearCurrentUser() {
  inFlight = null;
}
