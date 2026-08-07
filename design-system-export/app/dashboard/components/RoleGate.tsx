"use client";

/**
 * Presentational permission gate.
 * Host app supplies `allowed` (and optional `loading`) from its own auth layer.
 * Original app used SessionContext — see NOTES.md.
 */
interface RoleGateProps {
  allowed: boolean;
  loading?: boolean;
  children: React.ReactNode;
  fallback?: React.ReactNode;
}

export default function RoleGate({
  allowed,
  loading = false,
  children,
  fallback = null,
}: RoleGateProps) {
  if (loading) return null;
  if (!allowed) return <>{fallback}</>;
  return <>{children}</>;
}
