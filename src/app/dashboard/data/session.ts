export type UserRole =
  | "Tools Admin"
  | "Store Keeper"
  | "Calibration Engineer"
  | "Purchase Coordinator"
  | "Viewer";

export interface SessionUser {
  userId: string; // e.g. "U0001"
  name: string; // e.g. "System Admin"
  empCd: string; // e.g. "EMP-001"
  role: UserRole;
  roleName: string; // display string
}

// The currently active mock session — swap role here to test different permission views
export const mockSession: SessionUser = {
  userId: "U0001",
  name: "System Admin",
  empCd: "EMP-001",
  role: "Tools Admin",
  roleName: "Tools Admin",
};

// Permission matrix — what each role can do
export const rolePermissions: Record<
  UserRole,
  {
    canApproveSupplier: boolean;
    canCreateIssue: boolean;
    canReceiveTool: boolean;
    canLogConsumption: boolean;
    canManageCalibration: boolean;
    canRaisePO: boolean;
    canEditMaster: boolean;
    canDeleteMaster: boolean;
  }
> = {
  "Tools Admin": {
    canApproveSupplier: true,
    canCreateIssue: true,
    canReceiveTool: true,
    canLogConsumption: true,
    canManageCalibration: true,
    canRaisePO: true,
    canEditMaster: true,
    canDeleteMaster: true,
  },
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
