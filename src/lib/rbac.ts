import { prisma } from "@/lib/prisma";
import type { SessionData } from "@/lib/session";
import { ensureRbacSeeded } from "@/lib/rbacSeed";
import { isAdminRole } from "@/lib/adminRoles";
import { ALL_PERMISSION_KEYS, flagsFromRecord, type PermissionFlagKey, type RolePermissionFlags } from "@/lib/rolePermissions";

export type RbacAction =
  | "VIEW"
  | "CREATE"
  | "EDIT"
  | "DELETE"
  | "APPROVE"
  | "SEND_FOR_CALIBRATION"
  | "RECEIVE_EMAIL";

export interface RbacPermissionCheckResult {
  allowed: boolean;
  isSystemAdmin: boolean;
  roleName: string | null;
}

const LEGACY_PERMISSION_MODULES: Record<string, Array<[string, RbacAction]>> = {
  canApproveSupplier: [["supplier_master", "APPROVE"], ["subcontractor_master", "APPROVE"]],
  canCreateIssue: [["tool_issue_receive", "CREATE"]],
  canReceiveTool: [["tool_issue_receive", "CREATE"]],
  canLogConsumption: [["tool_issue_receive", "CREATE"]],
  canManageCalibration: [
    ["calibration_issue", "CREATE"], ["calibration_receive", "CREATE"],
    ["calibration_results", "EDIT"], ["gauge_type", "EDIT"],
    ["calibration_frequency", "EDIT"], ["authorized_agencies", "EDIT"],
  ],
  canRaisePO: [["purchase", "CREATE"]],
  canCreatePO: [["purchase", "CREATE"]],
  canUpdateFinance: [["purchase", "EDIT"]],
  canApprovePricing: [["tool_pricing", "APPROVE"]],
  canEditMaster: [
    ["tool_master", "EDIT"], ["tool_group", "EDIT"], ["tool_subgroup", "EDIT"],
    ["tools_name_type", "EDIT"], ["tool_pricing", "EDIT"], ["tool_mapping", "EDIT"],
    ["supplier_master", "EDIT"], ["subcontractor_master", "EDIT"],
    ["gauge_type", "EDIT"], ["calibration_frequency", "EDIT"], ["authorized_agencies", "EDIT"],
  ],
  canDeleteMaster: [
    ["tool_master", "DELETE"], ["tool_group", "DELETE"], ["tool_subgroup", "DELETE"],
    ["tools_name_type", "DELETE"], ["tool_pricing", "DELETE"], ["tool_mapping", "DELETE"],
    ["supplier_master", "DELETE"], ["subcontractor_master", "DELETE"],
    ["gauge_type", "DELETE"], ["calibration_frequency", "DELETE"], ["authorized_agencies", "DELETE"],
  ],
  canManageUsers: [["settings_users", "VIEW"]],
  canManageSettings: [["settings_roles", "EDIT"]],
};

async function findUserWithRole(session: SessionData) {
  if (session.userDbId) {
    const u = await prisma.user.findUnique({
      where: { id: session.userDbId },
      include: { userRole: { include: { role: true } } },
    });
    if (u) return u;
  }
  return prisma.user.findUnique({
    where: { username: session.userId },
    include: { userRole: { include: { role: true } } },
  });
}

/**
 * Check if the current user session has permission for a specific module and action.
 * System Admin ("Tools Admin" / isSystemAdmin=true) is ALWAYS allowed (exempt).
 */
export async function checkModulePermission(
  session: SessionData | null,
  moduleKey: string,
  action: RbacAction
): Promise<RbacPermissionCheckResult> {
  if (!session?.isLoggedIn || !session.userId) {
    return { allowed: false, isSystemAdmin: false, roleName: null };
  }

  await ensureRbacSeeded();

  const user = await findUserWithRole(session);
  const userRole = user?.userRole;

  // Admin status is role-based only. The old `userId.startsWith("demo")` clause
  // made every demo* account a system admin regardless of its assigned role.
  const isSysAdmin =
    Boolean(userRole?.role.isSystemAdmin) || isAdminRole(session.roleName);

  if (isSysAdmin) {
    return { allowed: true, isSystemAdmin: true, roleName: userRole?.role.roleName ?? "Tools Admin" };
  }

  if (!userRole) {
    return { allowed: false, isSystemAdmin: false, roleName: null };
  }

  const mod = await prisma.module.findUnique({ where: { moduleKey } });
  if (!mod) {
    return { allowed: false, isSystemAdmin: false, roleName: userRole.role.roleName };
  }

  const perm = await prisma.rolePermissionMatrix.findUnique({
    where: {
      roleId_moduleId_action: {
        roleId: userRole.roleId,
        moduleId: mod.moduleId,
        action,
      },
    },
  });

  return {
    allowed: perm?.allowed ?? false,
    isSystemAdmin: false,
    roleName: userRole.role.roleName,
  };
}

/** Compatibility bridge for routes that still use the old permission names. */
export async function checkLegacyPermission(
  session: SessionData,
  permission: string
): Promise<boolean> {
  if (isAdminRole(session.roleName)) return true;
  await ensureRbacSeeded();
  const user = await findUserWithRole(session);
  if (!user?.userRole) return false;
  const policies = LEGACY_PERMISSION_MODULES[permission];
  if (!policies) return false;
  for (const [moduleKey, action] of policies) {
    const result = await checkModulePermission(session, moduleKey, action);
    if (result.allowed) return true;
  }
  return false;
}

export async function getModuleViewPermissions(session: SessionData): Promise<Record<string, boolean>> {
  await ensureRbacSeeded();
  const modules = await prisma.module.findMany({ select: { moduleKey: true, moduleId: true } });
  const user = await findUserWithRole(session);
  if (isAdminRole(session.roleName) || user?.userRole?.role.isSystemAdmin) {
    return Object.fromEntries(modules.map((module) => [module.moduleKey, true]));
  }
  if (!user?.userRole) return Object.fromEntries(modules.map((module) => [module.moduleKey, false]));
  const rows = await prisma.rolePermissionMatrix.findMany({
    where: { roleId: user.userRole.roleId, action: "VIEW" },
    select: { moduleId: true, allowed: true },
  });
  const allowedById = new Map(rows.map((row) => [row.moduleId, row.allowed]));
  return Object.fromEntries(modules.map((module) => [module.moduleKey, allowedById.get(module.moduleId) ?? false]));
}

export async function getModuleActionPermissions(session: SessionData): Promise<Record<string, RbacAction[]>> {
  await ensureRbacSeeded();
  const modules = await prisma.module.findMany({ select: { moduleKey: true, moduleId: true, applicableActions: true } });
  const user = await findUserWithRole(session);
  const isAdmin = isAdminRole(session.roleName) || user?.userRole?.role.isSystemAdmin;

  const result: Record<string, RbacAction[]> = {};

  if (isAdmin) {
    for (const mod of modules) {
      result[mod.moduleKey] = mod.applicableActions.split(",").map(a => a.trim() as RbacAction);
    }
    return result;
  }

  if (!user?.userRole) {
    for (const mod of modules) {
      result[mod.moduleKey] = [];
    }
    return result;
  }

  const rows = await prisma.rolePermissionMatrix.findMany({
    where: { roleId: user.userRole.roleId, allowed: true },
    select: { moduleId: true, action: true },
  });

  const actionsById = new Map<number, RbacAction[]>();
  for (const row of rows) {
    if (!actionsById.has(row.moduleId)) {
      actionsById.set(row.moduleId, []);
    }
    actionsById.get(row.moduleId)!.push(row.action as RbacAction);
  }

  for (const mod of modules) {
    result[mod.moduleKey] = actionsById.get(mod.moduleId) ?? [];
  }
  return result;
}

export async function getLegacyPermissionFlags(session: SessionData): Promise<RolePermissionFlags> {
  const record: Partial<Record<PermissionFlagKey, boolean>> = {};
  for (const permission of ALL_PERMISSION_KEYS) {
    record[permission] = await checkLegacyPermission(session, permission);
  }
  return flagsFromRecord(record);
}
