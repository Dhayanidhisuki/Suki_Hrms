import { prisma } from "@/lib/prisma";

export const SEED_MODULES = [
  {
    moduleKey: "tool_master",
    moduleLabel: "Instrument & Gauge Master",
    moduleGroup: "Masters",
    applicableActions: "VIEW,CREATE,EDIT,DELETE",
    isBuilt: true,
  },
  {
    moduleKey: "tool_group",
    moduleLabel: "Tool Group",
    moduleGroup: "Masters",
    applicableActions: "VIEW,CREATE,EDIT,DELETE",
    isBuilt: true,
  },
  {
    moduleKey: "tool_subgroup",
    moduleLabel: "Tool Subgroup",
    moduleGroup: "Masters",
    applicableActions: "VIEW,CREATE,EDIT,DELETE",
    isBuilt: true,
  },
  {
    moduleKey: "tools_name_type",
    moduleLabel: "Tools Name for Type",
    moduleGroup: "Masters",
    applicableActions: "VIEW,CREATE,EDIT,DELETE",
    isBuilt: true,
  },
  {
    moduleKey: "tool_pricing",
    moduleLabel: "Tool Pricing Master",
    moduleGroup: "Masters",
    applicableActions: "VIEW,CREATE,EDIT,DELETE",
    isBuilt: true,
  },
  {
    moduleKey: "reorder_level",
    moduleLabel: "Reorder Level",
    moduleGroup: "Masters",
    applicableActions: "VIEW,EDIT",
    isBuilt: true,
  },
  {
    moduleKey: "tool_mapping",
    moduleLabel: "Tool Mapping",
    moduleGroup: "Masters",
    applicableActions: "VIEW,CREATE,EDIT,DELETE",
    isBuilt: true,
  },
  {
    moduleKey: "supplier_master",
    moduleLabel: "Supplier Master",
    moduleGroup: "Vendor Masters",
    applicableActions: "VIEW,CREATE,EDIT,DELETE,APPROVE",
    isBuilt: true,
  },
  {
    moduleKey: "subcontractor_master",
    moduleLabel: "Subcontractor Master",
    moduleGroup: "Vendor Masters",
    applicableActions: "VIEW,CREATE,EDIT,DELETE,APPROVE",
    isBuilt: true,
  },
  {
    moduleKey: "gauge_type",
    moduleLabel: "Gauge Type Master",
    moduleGroup: "Calibration Masters",
    applicableActions: "VIEW,CREATE,EDIT,DELETE",
    isBuilt: true,
  },
  {
    moduleKey: "calibration_frequency",
    moduleLabel: "Calibration Frequency",
    moduleGroup: "Calibration Masters",
    applicableActions: "VIEW,CREATE,EDIT,DELETE",
    isBuilt: true,
  },
  {
    moduleKey: "authorized_agencies",
    moduleLabel: "Authorized Agencies",
    moduleGroup: "Calibration Masters",
    applicableActions: "VIEW,CREATE,EDIT,DELETE",
    isBuilt: true,
  },
  {
    moduleKey: "tool_issue_receive",
    moduleLabel: "Tool Issue / Receive",
    moduleGroup: "Transactions",
    applicableActions: "VIEW,CREATE,APPROVE",
    isBuilt: true,
  },
  {
    moduleKey: "calibration_issue",
    moduleLabel: "Calibration Issue",
    moduleGroup: "Transactions",
    applicableActions: "VIEW,CREATE,APPROVE,SEND_FOR_CALIBRATION",
    isBuilt: true,
  },
  {
    moduleKey: "calibration_receive",
    moduleLabel: "Calibration Receive",
    moduleGroup: "Transactions",
    applicableActions: "VIEW,CREATE,APPROVE",
    isBuilt: true,
  },
  {
    moduleKey: "calibration_results",
    moduleLabel: "Calibration Results",
    moduleGroup: "Transactions",
    applicableActions: "VIEW,CREATE,EDIT",
    isBuilt: true,
  },
  {
    moduleKey: "purchase",
    moduleLabel: "Purchase / PO",
    moduleGroup: "Purchase",
    applicableActions: "VIEW,CREATE,EDIT,APPROVE",
    isBuilt: true,
  },
  {
    moduleKey: "requisition",
    moduleLabel: "Requisition",
    moduleGroup: "Purchase",
    applicableActions: "VIEW,CREATE,APPROVE",
    isBuilt: false, // Not yet built
  },
  {
    moduleKey: "reports",
    moduleLabel: "Reports",
    moduleGroup: "Reports",
    applicableActions: "VIEW",
    isBuilt: true,
  },
  {
    moduleKey: "history_card",
    moduleLabel: "Tool History Card",
    moduleGroup: "Reports",
    applicableActions: "VIEW",
    isBuilt: true,
  },
  {
    moduleKey: "settings_users",
    moduleLabel: "Settings → Users",
    moduleGroup: "Settings",
    applicableActions: "VIEW,CREATE,EDIT,DELETE",
    isBuilt: true,
  },
  {
    moduleKey: "settings_roles",
    moduleLabel: "Settings → Roles & Permissions",
    moduleGroup: "Settings",
    applicableActions: "VIEW,EDIT",
    isBuilt: true,
  },
  {
    moduleKey: "documents",
    moduleLabel: "Documents & Photos Hub",
    moduleGroup: "Calibration",
    applicableActions: "VIEW,CREATE,EDIT,DELETE",
    isBuilt: true,
  },
  {
    moduleKey: "email_notifications",
    moduleLabel: "Email Notifications",
    moduleGroup: "Notifications",
    applicableActions: "RECEIVE_EMAIL",
    isBuilt: true,
  },
];

let seedPromise: Promise<void> | null = null;

async function seedRbac() {
  // 1. Ensure Roles
  const rolesData = [
    { roleName: "Tools Admin", isSystemAdmin: true },
    { roleName: "Store Keeper", isSystemAdmin: false },
    { roleName: "Calibration Engineer", isSystemAdmin: false },
    { roleName: "Purchase Coordinator", isSystemAdmin: false },
    { roleName: "Viewer", isSystemAdmin: false },
    { roleName: "Quality Manager", isSystemAdmin: false },
    { roleName: "Quality Engineer", isSystemAdmin: false },
  ];

  const roleMap = new Map<string, number>();
  for (const r of rolesData) {
    const existing = await prisma.role.findUnique({ where: { roleName: r.roleName } });
    if (existing) {
      roleMap.set(r.roleName, existing.roleId);
    } else {
      const created = await prisma.role.create({ data: r });
      roleMap.set(r.roleName, created.roleId);
    }
  }

  // 2. Ensure Modules
  const moduleMap = new Map<string, number>();
  for (const m of SEED_MODULES) {
    const existing = await prisma.module.findUnique({ where: { moduleKey: m.moduleKey } });
    if (existing) {
      moduleMap.set(m.moduleKey, existing.moduleId);
    } else {
      const created = await prisma.module.create({ data: m });
      moduleMap.set(m.moduleKey, created.moduleId);
    }
  }

  // 3. Add missing permission rows without resetting changes made in Settings.
  // This keeps new roles/modules secure by default while making seeding idempotent.
  const defaultAllowed = (roleName: string, moduleKey: string, action: string) => {
    if (roleName === "Viewer") return false;
    if (roleName === "Store Keeper") {
      return (moduleKey === "tool_master" && action === "VIEW") ||
        (moduleKey === "tool_issue_receive" && (action === "VIEW" || action === "CREATE"));
    }
    if (roleName === "Purchase Coordinator") {
      return moduleKey === "purchase" && ["VIEW", "CREATE", "EDIT", "APPROVE"].includes(action);
    }
    if (roleName === "Quality Manager") return action !== "DELETE";
    if (roleName === "Quality Engineer") {
      return ["VIEW", "CREATE", "EDIT", "SEND_FOR_CALIBRATION"].includes(action);
    }
    if (roleName === "Calibration Engineer") {
      const isCalibModule =
        moduleKey === "tool_master" || moduleKey === "reports" || moduleKey === "history_card" ||
        moduleKey === "gauge_type" || moduleKey === "calibration_frequency" ||
        moduleKey === "authorized_agencies" || moduleKey.includes("calibration") ||
        moduleKey === "documents";
      return isCalibModule && ["VIEW", "CREATE", "EDIT", "SEND_FOR_CALIBRATION"].includes(action);
    }
    return false;
  };

  for (const role of rolesData) {
    const roleId = roleMap.get(role.roleName);
    if (!roleId || role.isSystemAdmin) continue;
    for (const seedModule of SEED_MODULES) {
      for (const action of seedModule.applicableActions.split(",")) {
        await prisma.rolePermissionMatrix.upsert({
          where: { roleId_moduleId_action: { roleId, moduleId: moduleMap.get(seedModule.moduleKey)!, action } },
          update: {},
          create: {
            roleId,
            moduleId: moduleMap.get(seedModule.moduleKey)!,
            action,
            allowed: defaultAllowed(role.roleName, seedModule.moduleKey, action),
          },
        });
      }
    }
  }

  // 4. Ensure Users Roles & Unit Scopes
  const users = await prisma.user.findMany();
  for (const user of users) {
    // Check if UserRole exists
    const userRole = await prisma.userRole.findUnique({ where: { userId: user.id } });
    if (!userRole) {
      let targetRoleName = "Tools Admin";
      if (user.username.toLowerCase() === "user1" || user.role === "Calibration Engineer") {
        targetRoleName = "Calibration Engineer";
      } else if (user.role && roleMap.has(user.role)) {
        targetRoleName = user.role;
      }
      const roleId = roleMap.get(targetRoleName) ?? roleMap.get("Tools Admin")!;
      await prisma.userRole.create({ data: { userId: user.id, roleId } });
    }
  }
}

export function ensureRbacSeeded(): Promise<void> {
  seedPromise ??= seedRbac().catch((error) => {
    seedPromise = null;
    throw error;
  });
  return seedPromise;
}
