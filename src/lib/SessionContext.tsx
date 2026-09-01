"use client";

import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
} from "react";
import { apiGet } from "./apiClient";

export interface SessionUser {
  userId: string;
  name: string;
  empCd: string | null;
  roleName: string;
  addRoleName: string | null;
}

interface SessionContextValue {
  user: SessionUser | null;
  loading: boolean;
  refreshSession: () => Promise<void>;
  canModule: (moduleKey: string) => boolean;
  canModuleAction: (moduleKey: string, action: string) => boolean;
}

const SessionContext = createContext<SessionContextValue>({
  user: null,
  loading: true,
  refreshSession: async () => {},
  canModule: () => false,
  canModuleAction: () => false,
});

export function SessionProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<SessionUser | null>(null);
  const [modulePermissions, setModulePermissions] = useState<Record<string, boolean>>({});
  const [moduleActionPermissions, setModuleActionPermissions] = useState<Record<string, string[]>>({});
  const [loading, setLoading] = useState(true);

  const refreshSession = useCallback(async () => {
    const res = await apiGet<{
      user: SessionUser;
      modulePermissions?: Record<string, boolean>;
      moduleActionPermissions?: Record<string, string[]>;
    }>("/api/auth/me");
    if (res.data?.user) {
      setUser(res.data.user);
      setModulePermissions(res.data.modulePermissions ?? {});
      setModuleActionPermissions(res.data.moduleActionPermissions ?? {});
    } else {
      setUser(null);
      setModulePermissions({});
      setModuleActionPermissions({});
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    queueMicrotask(() => void refreshSession());
  }, [refreshSession]);

  const canModule = (moduleKey: string): boolean => Boolean(modulePermissions[moduleKey]);
  
  const canModuleAction = (moduleKey: string, action: string): boolean => {
    return Boolean(moduleActionPermissions[moduleKey]?.includes(action));
  };

  return (
    <SessionContext.Provider value={{ user, loading, refreshSession, canModule, canModuleAction }}>
      {children}
    </SessionContext.Provider>
  );
}

export function useSession() {
  return useContext(SessionContext);
}
