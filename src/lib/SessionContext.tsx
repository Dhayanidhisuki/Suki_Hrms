"use client";

import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
} from "react";
import { apiGet } from "./apiClient";
import { rolePermissions, type UserRole } from "./rolePermissions";

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
  refreshSession: () => Promise<void>;
  can: (permission: PermissionKey) => boolean;
}

/** Roles that receive full app access (no DB/table changes — code matrix only). */
const FULL_ACCESS_ROLES = new Set([
  "Tools Admin",
  "Administrator",
  "Admin",
  "admin",
]);

const SessionContext = createContext<SessionContextValue>({
  user: null,
  loading: true,
  refreshSession: async () => {},
  can: () => false,
});

export function SessionProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<SessionUser | null>(null);
  const [loading, setLoading] = useState(true);

  const refreshSession = useCallback(async () => {
    const res = await apiGet<{ user: SessionUser }>("/api/auth/me");
    if (res.data?.user) {
      setUser(res.data.user);
    } else {
      setUser(null);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    void refreshSession();
  }, [refreshSession]);

  const can = (permission: PermissionKey): boolean => {
    if (!user?.userId) return false;
    // Seed / app admin + admin-equivalent role names → full access
    if (
      user.userId.toLowerCase() === "admin" ||
      FULL_ACCESS_ROLES.has(user.roleName)
    ) {
      return true;
    }
    const perms =
      rolePermissions[user.roleName as UserRole] ?? rolePermissions.Viewer;
    return Boolean(perms[permission]);
  };

  return (
    <SessionContext.Provider value={{ user, loading, refreshSession, can }}>
      {children}
    </SessionContext.Provider>
  );
}

export function useSession() {
  return useContext(SessionContext);
}
