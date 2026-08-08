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
});

export function SessionProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<SessionUser | null>(null);
  const [permissions, setPermissions] = useState<RolePermissionFlags | null>(
    null
  );
  const [loading, setLoading] = useState(true);

  const refreshSession = useCallback(async () => {
    const res = await apiGet<{
      user: SessionUser;
      permissions?: RolePermissionFlags;
    }>("/api/auth/me");
    if (res.data?.user) {
      setUser(res.data.user);
      setPermissions(
        res.data.permissions ??
          rolePermissions[res.data.user.roleName] ??
          rolePermissions.Viewer
      );
    } else {
      setUser(null);
      setPermissions(null);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    void refreshSession();
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

  return (
    <SessionContext.Provider value={{ user, loading, refreshSession, can }}>
      {children}
    </SessionContext.Provider>
  );
}

export function useSession() {
  return useContext(SessionContext);
}
