"use client";

import React, { createContext, useContext, useEffect, useState } from "react";
import { apiGet } from "./apiClient";

export interface SessionUser {
  userId: string;
  name: string;
  empCd: string | null;
  roleName: string;
  addRoleName: string | null;
}

export type PermissionKey =
  | "canApproveSupplier"
  | "canCreateIssue"
  | "canReceiveTool"
  | "canLogConsumption"
  | "canManageCalibration"
  | "canRaisePO"
  | "canEditMaster"
  | "canDeleteMaster";

interface SessionContextValue {
  user: SessionUser | null;
  loading: boolean;
  can: (permission: PermissionKey) => boolean;
}

// Mirror the backend role permission matrix exactly
const rolePermissions: Record<string, Record<PermissionKey, boolean>> = {
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

const SessionContext = createContext<SessionContextValue>({
  user: null,
  loading: true,
  can: () => false,
});

export function SessionProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<SessionUser | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    apiGet<{ user: SessionUser }>("/api/auth/me").then((res) => {
      if (res.data?.user) setUser(res.data.user);
      setLoading(false);
    });
  }, []);

  const can = (permission: PermissionKey): boolean => {
    if (!user) return false;
    return rolePermissions[user.roleName]?.[permission] ?? false;
  };

  return (
    <SessionContext.Provider value={{ user, loading, can }}>
      {children}
    </SessionContext.Provider>
  );
}

export function useSession() {
  return useContext(SessionContext);
}
