"use client";

import { useSession } from "@/lib/SessionContext";

interface RoleGateProps {
  module: string;
  action: string;
  children: React.ReactNode;
  fallback?: React.ReactNode;
}

export default function RoleGate({
  module,
  action,
  children,
  fallback = null,
}: RoleGateProps) {
  const { canModuleAction, loading } = useSession();
  if (loading) return null;

  const isAllowed = canModuleAction(module, action);

  if (!isAllowed) return <>{fallback}</>;
  return <>{children}</>;
}
