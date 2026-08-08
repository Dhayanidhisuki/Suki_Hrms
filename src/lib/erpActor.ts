import { prisma } from "@/lib/prisma";
import type { SessionData } from "@/lib/session";

/**
 * ERP tables FK CREAT_USER_ID_CD / LST_UPDT_USER_ID_CD → ERP_USER.USER_ID.
 * App login usernames (e.g. "admin") are NOT in ERP_USER, so writers must
 * resolve a valid ERP actor without altering ERP schema.
 *
 * Resolution order:
 * 1) TOOLS_APP_USER.erpUserCode (if set and exists in ERP_USER)
 * 2) session.userId if it exists in ERP_USER
 * 3) ERP_AUDIT_USER_ID env (must exist in ERP_USER)
 * 4) First ACTIVE ERP_USER row (last-resort for local testing)
 */
export async function resolveErpAuditUserId(
  session: SessionData
): Promise<string> {
  const candidates: string[] = [];

  try {
    // Prefer numeric app-user id from JWT (reliable); username lookup is fallback
    if (session.userDbId != null) {
      const byId = await prisma.user.findUnique({
        where: { id: session.userDbId },
        select: { erpUserCode: true, username: true },
      });
      if (byId?.erpUserCode?.trim()) candidates.push(byId.erpUserCode.trim());
      if (byId?.username?.trim()) candidates.push(byId.username.trim());
    }

    if (session.userId?.trim()) {
      const appUser = await prisma.user.findFirst({
        where: {
          username: session.userId,
          isActive: true,
          deletedAt: null,
        },
        select: { erpUserCode: true },
      });
      if (appUser?.erpUserCode?.trim()) {
        candidates.push(appUser.erpUserCode.trim());
      }
    }
  } catch {
    // User table unavailable — continue with other candidates
  }

  if (session.userId?.trim()) candidates.push(session.userId.trim());

  const envActor = process.env.ERP_AUDIT_USER_ID?.trim();
  if (envActor) candidates.push(envActor);

  for (const id of candidates) {
    const clipped = id.slice(0, 10);
    const found = await prisma.erpUser.findUnique({
      where: { userId: clipped },
      select: { userId: true },
    });
    if (found?.userId) return found.userId;
  }

  const fallback = await prisma.erpUser.findFirst({
    where: { OR: [{ status: "ACTIVE" }, { status: "Active" }] },
    select: { userId: true },
    orderBy: { userId: "asc" },
  });
  if (fallback?.userId) return fallback.userId.slice(0, 10);

  // Absolute last resort — should not happen on a live ERP DB
  throw new Error(
    "No valid ERP_USER found for audit fields. Set TOOLS_APP_USER.erpUserCode or ERP_AUDIT_USER_ID to a real ERP USER_ID."
  );
}
