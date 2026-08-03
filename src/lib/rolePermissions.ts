/** Role permission matrix — shared by client SessionContext and server checks. */

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
};

const FULL_ACCESS: RolePermissionFlags = {
  canApproveSupplier: true,
  canCreateIssue: true,
  canReceiveTool: true,
  canLogConsumption: true,
  canManageCalibration: true,
  canRaisePO: true,
  canEditMaster: true,
  canDeleteMaster: true,
};

export const rolePermissions: Record<string, RolePermissionFlags> = {
  "Tools Admin": FULL_ACCESS,
  /** Aliases — no DB change; maps display/ERP-style names to full access */
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
  },
};
