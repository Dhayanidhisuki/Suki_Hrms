"use client";

import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
} from "react";
import { apiGet } from "./apiClient";
import type { RolePermissionFlags, PermissionFlagKey } from "./rolePermissions";
import { rolePermissions } from "./rolePermissions";

export interface SessionUser {
  userId: string;
  name: string;
  empCd: string | null;
  roleName: string;
  addRoleName: string | null;
}

export type PermissionKey = PermissionFlagKey;

interface SessionContextValue {
  user: SessionUser | null;
  loading: boolean;
  refreshSession: () => Promise<void>;
  can: (permission: PermissionKey) => boolean;
  canModule: (moduleKey: string) => boolean;
}

/** Roles that receive full app access (matches server permissionsCache). */
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
  canModule: () => false,
});

export function SessionProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<SessionUser | null>(null);
  const [permissions, setPermissions] = useState<RolePermissionFlags | null>(
    null
  );
  const [modulePermissions, setModulePermissions] = useState<Record<string, boolean>>({});
  const [loading, setLoading] = useState(true);

  const refreshSession = useCallback(async () => {
    const res = await apiGet<{
      user: SessionUser;
      permissions?: RolePermissionFlags;
      modulePermissions?: Record<string, boolean>;
    }>("/api/auth/me");
    if (res.data?.user) {
      setUser(res.data.user);
      setPermissions(
        res.data.permissions ??
          rolePermissions[res.data.user.roleName] ??
          rolePermissions.Viewer
      );
      setModulePermissions(res.data.modulePermissions ?? {});
    } else {
      setUser(null);
      setPermissions(null);
      setModulePermissions({});
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    queueMicrotask(() => void refreshSession());
  }, [refreshSession]);

  const can = (permission: PermissionKey): boolean => {
    if (!user?.userId) return false;
    if (
      user.userId.toLowerCase() === "admin" ||
      FULL_ACCESS_ROLES.has(user.roleName)
    ) {
      return true;
    }
    const perms = permissions ?? rolePermissions.Viewer;
    return Boolean(perms[permission]);
  };

  const canModule = (moduleKey: string): boolean => Boolean(modulePermissions[moduleKey]);

  return (
    <SessionContext.Provider value={{ user, loading, refreshSession, can, canModule }}>
      {children}
    </SessionContext.Provider>
  );
}

export function useSession() {
  return useContext(SessionContext);
}
