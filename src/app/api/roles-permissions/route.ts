import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/session";
import { requireSession } from "@/lib/auth";
import { checkModulePermission } from "@/lib/rbac";
import { invalidatePermissionsCache } from "@/lib/permissionsCache";
import {
  ALL_PERMISSION_KEYS,
  CANONICAL_ROLES,
  PERMISSION_LABELS,
  flagsFromRecord,
  type PermissionFlagKey,
} from "@/lib/rolePermissions";
import { RolePermissionsUpdateSchema } from "@/lib/validators";

export const runtime = "nodejs";

/** GET /api/roles-permissions — role × permission matrix (admin). */
export async function GET() {
  const session = await getSession();
  const authCheck = await requireSession(session);
  if (!authCheck.ok) return NextResponse.json({ success: false, error: "Forbidden" }, { status: 403 });

  const permCheck = await checkModulePermission(
    authCheck.session,
    "settings_roles",
    "VIEW"
  );
  if (!permCheck.allowed) {
    return NextResponse.json({ success: false, error: "Forbidden" }, { status: 403 });
  }

  try {
    if (typeof prisma.rolePermission?.findMany !== "function") {
      return NextResponse.json(
        {
          error:
            "Prisma client is missing RolePermission. Restart the Next.js dev server after prisma generate.",
        },
        { status: 503 }
      );
    }

    const rows = await prisma.rolePermission.findMany({
      orderBy: [{ role: "asc" }, { permissionKey: "asc" }],
    });

    // Prefer canonical roles for the UI grid; include any extra roles present in DB
    const roleSet = new Set<string>(CANONICAL_ROLES);
    for (const r of rows) roleSet.add(r.role);
    // Hide auth aliases from the editable grid (still in DB for JWT compatibility)
    const aliasRoles = new Set(["Administrator", "Admin", "admin"]);
    const roles = [...roleSet].filter((r) => !aliasRoles.has(r));

    const byRole: Record<string, Record<string, boolean>> = {};
    for (const role of roles) {
      byRole[role] = {};
      for (const key of ALL_PERMISSION_KEYS) {
        byRole[role][key] = false;
      }
    }
    for (const r of rows) {
      if (aliasRoles.has(r.role)) continue;
      if (!byRole[r.role]) {
        byRole[r.role] = {};
        for (const key of ALL_PERMISSION_KEYS) {
          byRole[r.role][key] = false;
        }
      }
      byRole[r.role][r.permissionKey] = r.allowed;
    }

    const matrix = roles.map((role) => ({
      role,
      permissions: flagsFromRecord(byRole[role]),
    }));

    return NextResponse.json({
      roles,
      permissionKeys: [...ALL_PERMISSION_KEYS],
      labels: PERMISSION_LABELS,
      matrix,
      rows: rows.map((r) => ({
        id: r.id,
        role: r.role,
        permissionKey: r.permissionKey,
        allowed: r.allowed,
      })),
    });
  } catch (err) {
    console.error("GET /api/roles-permissions:", err);
    return NextResponse.json(
      {
        error:
          err instanceof Error
            ? err.message
            : "Failed to load role permissions",
      },
      { status: 500 }
    );
  }
}

/** PUT /api/roles-permissions — update allowed flags (admin). */
export async function PUT(req: NextRequest) {
  const session = await getSession();
  const authCheck = await requireSession(session);
  if (!authCheck.ok) return NextResponse.json({ success: false, error: "Forbidden" }, { status: 403 });

  const permCheck = await checkModulePermission(
    authCheck.session,
    "settings_roles",
    "EDIT"
  );
  if (!permCheck.allowed) {
    return NextResponse.json({ success: false, error: "Forbidden" }, { status: 403 });
  }

  const body = await req.json().catch(() => null);
  const parsed = RolePermissionsUpdateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.flatten() },
      { status: 400 }
    );
  }

  const allowedKeys = new Set<string>(ALL_PERMISSION_KEYS);
  for (const entry of parsed.data.updates) {
    if (!allowedKeys.has(entry.permissionKey)) {
      return NextResponse.json(
        { error: `Unknown permission_key: ${entry.permissionKey}` },
        { status: 400 }
      );
    }
  }

  await prisma.$transaction(
    parsed.data.updates.map((entry) =>
      prisma.rolePermission.upsert({
        where: {
          role_permissionKey: {
            role: entry.role,
            permissionKey: entry.permissionKey,
          },
        },
        create: {
          role: entry.role,
          permissionKey: entry.permissionKey as PermissionFlagKey,
          allowed: entry.allowed,
        },
        update: { allowed: entry.allowed },
      })
    )
  );

  invalidatePermissionsCache();

  return NextResponse.json({ ok: true });
}
