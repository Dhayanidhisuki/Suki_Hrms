"use client";

import { useSession, type PermissionKey } from "@/lib/SessionContext";

interface RoleGateProps {
  permission: PermissionKey;
  children: React.ReactNode;
  fallback?: React.ReactNode;
}

export default function RoleGate({
  permission,
  children,
  fallback = null,
}: RoleGateProps) {
  const { can, loading } = useSession();
  if (loading) return null;
  if (!can(permission)) return <>{fallback}</>;
  return <>{children}</>;
}
