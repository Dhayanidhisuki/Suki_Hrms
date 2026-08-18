import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/session";
import { requireSession } from "@/lib/auth";
import { checkModulePermission } from "@/lib/rbac";
import { ensureRbacSeeded } from "@/lib/rbacSeed";

interface PermissionUpdate {
  roleId: number;
  moduleId: number;
  action: string;
  allowed: boolean;
}

function isPermissionUpdate(value: unknown): value is PermissionUpdate {
  if (!value || typeof value !== "object") return false;
  const item = value as Record<string, unknown>;
  return (
    typeof item.roleId === "number" &&
    Number.isInteger(item.roleId) &&
    typeof item.moduleId === "number" &&
    Number.isInteger(item.moduleId) &&
    typeof item.action === "string" &&
    typeof item.allowed === "boolean"
  );
}

export async function GET() {
  const session = await getSession();
  const check = await requireSession(session);
  if (!check.ok) return check.response;

  // Check permission for settings_roles (VIEW)
  const perm = await checkModulePermission(session, "settings_roles", "VIEW");
  if (!perm.allowed) {
    return NextResponse.json({ success: false, error: "Forbidden" }, { status: 403 });
  }

  await ensureRbacSeeded();

  const [roles, modules, matrix] = await Promise.all([
    prisma.role.findMany({ orderBy: { roleId: "asc" } }),
    prisma.module.findMany({ orderBy: { moduleId: "asc" } }),
    prisma.rolePermissionMatrix.findMany(),
  ]);

  return NextResponse.json({
    success: true,
    roles,
    modules,
    matrix,
  });
}

export async function POST(req: NextRequest) {
  const session = await getSession();
  const check = await requireSession(session);
  if (!check.ok) return check.response;

  // Check permission for settings_roles (EDIT)
  const perm = await checkModulePermission(session, "settings_roles", "EDIT");
  if (!perm.allowed) {
    return NextResponse.json({ success: false, error: "Forbidden" }, { status: 403 });
  }

  await ensureRbacSeeded();

  const body = await req.json();
  const rawPermissions: unknown[] = Array.isArray(body.permissions) ? body.permissions : [body];
  if (rawPermissions.length === 0 || !rawPermissions.every(isPermissionUpdate)) {
    return NextResponse.json({ success: false, error: "Invalid payload" }, { status: 400 });
  }
  const permissions: PermissionUpdate[] = rawPermissions;

  const roleIds = [...new Set(permissions.map((item) => item.roleId))];
  const moduleIds = [...new Set(permissions.map((item) => item.moduleId))];
  const [targetRoles, targetModules] = await Promise.all([
    prisma.role.findMany({ where: { roleId: { in: roleIds } } }),
    prisma.module.findMany({ where: { moduleId: { in: moduleIds } } }),
  ]);

  if (targetRoles.length !== roleIds.length || targetModules.length !== moduleIds.length) {
    return NextResponse.json({ success: false, error: "Role or module not found" }, { status: 404 });
  }
  if (targetRoles.some((role) => role.isSystemAdmin)) {
    return NextResponse.json(
      { success: false, error: "Tools Admin / System Admin permissions are read-only and cannot be modified." },
      { status: 400 }
    );
  }

  const modulesById = new Map(targetModules.map((targetModule) => [targetModule.moduleId, targetModule]));
  const invalidAction = permissions.some((item) => {
    const targetModule = modulesById.get(item.moduleId);
    return !targetModule?.applicableActions.split(",").includes(item.action);
  });
  if (invalidAction) {
    return NextResponse.json({ success: false, error: "Action is not available for this module" }, { status: 400 });
  }

  await prisma.$transaction(
    permissions.map((item) =>
      prisma.rolePermissionMatrix.upsert({
        where: {
          roleId_moduleId_action: {
            roleId: item.roleId,
            moduleId: item.moduleId,
            action: item.action,
          },
        },
        update: { allowed: item.allowed },
        create: {
          roleId: item.roleId,
          moduleId: item.moduleId,
          action: item.action,
          allowed: item.allowed,
        },
      })
    )
  );

  return NextResponse.json({
    success: true,
    updatedCount: permissions.length,
  });
}
