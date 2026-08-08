/**
 * Role permission matrix — seed source + fallback for auth.
 *
 * @deprecated Runtime checks should use `src/lib/permissionsCache.ts`
 * (TOOLS_ROLE_PERMISSION). This file remains the canonical seed matrix and
 * offline fallback if the DB table is empty / unreachable.
 */

export type UserRole =
  | "Tools Admin"
  | "Store Keeper"
  | "Calibration Engineer"
  | "Purchase Coordinator"
  | "Viewer";

export type RolePermissionFlags = {
  canApproveSupplier: boolean;
  canCreateIssue: boolean;
  canReceiveTool: boolean;
  canLogConsumption: boolean;
  canManageCalibration: boolean;
  canRaisePO: boolean;
  canEditMaster: boolean;
  canDeleteMaster: boolean;
  /** Settings → Users / Roles admin (Phase 0) */
  canManageUsers: boolean;
  /** Pricing Master approve / reject (Phase 1) */
  canApprovePricing: boolean;
  /** Create COMMON_PURCHASE_ORDER from Tools (Phase 2) */
  canCreatePO: boolean;
  /** Update Tools PO payment status (Phase 3 — TOOLS_PO_FINANCE) */
  canUpdateFinance: boolean;
};

/** All permission keys stored in TOOLS_ROLE_PERMISSION.permission_key */
export const ALL_PERMISSION_KEYS = [
  "canApproveSupplier",
  "canCreateIssue",
  "canReceiveTool",
  "canLogConsumption",
  "canManageCalibration",
  "canRaisePO",
  "canEditMaster",
  "canDeleteMaster",
  "canManageUsers",
  "canApprovePricing",
  "canCreatePO",
  "canUpdateFinance",
] as const;

export type PermissionFlagKey = (typeof ALL_PERMISSION_KEYS)[number];

export const PERMISSION_LABELS: Record<PermissionFlagKey, string> = {
  canApproveSupplier: "Approve supplier / subcontractor",
  canCreateIssue: "Create tool issue / requisition",
  canReceiveTool: "Receive tools",
  canLogConsumption: "Log consumption",
  canManageCalibration: "Manage calibration",
  canRaisePO: "Raise PO / GRN",
  canEditMaster: "Edit masters",
  canDeleteMaster: "Delete masters",
  canManageUsers: "Manage users & roles",
  canApprovePricing: "Approve / reject pricing",
  canCreatePO: "Create purchase order",
  canUpdateFinance: "Update PO payment status",
};

/** Compact column headers for the Roles matrix (full text stays in PERMISSION_LABELS / title). */
export const PERMISSION_SHORT_LABELS: Record<PermissionFlagKey, string> = {
  canApproveSupplier: "Approve supplier",
  canCreateIssue: "Create issue",
  canReceiveTool: "Receive tool",
  canLogConsumption: "Log consumption",
  canManageCalibration: "Calibration",
  canRaisePO: "Raise PO/GRN",
  canEditMaster: "Edit masters",
  canDeleteMaster: "Delete masters",
  canManageUsers: "Manage users",
  canApprovePricing: "Pricing approve",
  canCreatePO: "Create PO",
  canUpdateFinance: "PO payment",
};

/** Canonical roles shown in Settings (aliases still seeded for JWT compatibility). */
export const CANONICAL_ROLES: UserRole[] = [
  "Tools Admin",
  "Store Keeper",
  "Calibration Engineer",
  "Purchase Coordinator",
  "Viewer",
];

const FULL_ACCESS: RolePermissionFlags = {
  canApproveSupplier: true,
  canCreateIssue: true,
  canReceiveTool: true,
  canLogConsumption: true,
  canManageCalibration: true,
  canRaisePO: true,
  canEditMaster: true,
  canDeleteMaster: true,
  canManageUsers: true,
  canApprovePricing: true,
  canCreatePO: true,
  canUpdateFinance: true,
};

/**
 * Hardcoded matrix — must match seed into TOOLS_ROLE_PERMISSION.
 * Keep in sync when adding permissions until seed is re-run.
 */
export const rolePermissions: Record<string, RolePermissionFlags> = {
  "Tools Admin": FULL_ACCESS,
  /** Aliases — no DB user change; maps display/ERP-style names to full access */
  Administrator: FULL_ACCESS,
  Admin: FULL_ACCESS,
  admin: FULL_ACCESS,
  "Store Keeper": {
    canApproveSupplier: false,
    canCreateIssue: true,
    canReceiveTool: true,
    canLogConsumption: false,
    canManageCalibration: false,
    canRaisePO: false,
    canEditMaster: false,
    canDeleteMaster: false,
    canManageUsers: false,
    canApprovePricing: false,
    canCreatePO: false,
    canUpdateFinance: false,
  },
  "Calibration Engineer": {
    canApproveSupplier: false,
    canCreateIssue: false,
    canReceiveTool: false,
    canLogConsumption: false,
    canManageCalibration: true,
    canRaisePO: false,
    canEditMaster: false,
    canDeleteMaster: false,
    canManageUsers: false,
    canApprovePricing: false,
    canCreatePO: false,
    canUpdateFinance: false,
  },
  "Purchase Coordinator": {
    canApproveSupplier: false,
    canCreateIssue: false,
    canReceiveTool: false,
    canLogConsumption: false,
    canManageCalibration: false,
    canRaisePO: true,
    canEditMaster: false,
    canDeleteMaster: false,
    canManageUsers: false,
    canApprovePricing: false,
    canCreatePO: true,
    canUpdateFinance: false,
  },
  Viewer: {
    canApproveSupplier: false,
    canCreateIssue: false,
    canReceiveTool: false,
    canLogConsumption: false,
    canManageCalibration: false,
    canRaisePO: false,
    canEditMaster: false,
    canDeleteMaster: false,
    canManageUsers: false,
    canApprovePricing: false,
    canCreatePO: false,
    canUpdateFinance: false,
  },
};

export function flagsFromRecord(
  record: Partial<Record<string, boolean>> | undefined
): RolePermissionFlags {
  const base = rolePermissions.Viewer;
  if (!record) return { ...base };
  const out = { ...base };
  for (const key of ALL_PERMISSION_KEYS) {
    if (typeof record[key] === "boolean") out[key] = record[key]!;
  }
  return out;
}

/** Flatten matrix into seed rows for TOOLS_ROLE_PERMISSION. */
export function rolePermissionSeedRows(): Array<{
  role: string;
  permissionKey: string;
  allowed: boolean;
}> {
  const rows: Array<{ role: string; permissionKey: string; allowed: boolean }> =
    [];
  for (const [role, flags] of Object.entries(rolePermissions)) {
    for (const key of ALL_PERMISSION_KEYS) {
      rows.push({
        role,
        permissionKey: key,
        allowed: Boolean(flags[key]),
      });
    }
  }
  return rows;
}
