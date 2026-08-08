"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { SimpleMasterShell } from "@/components/SimpleMasterShell";
import RoleGate from "@/app/dashboard/components/RoleGate";
import { TableSkeleton } from "@/app/dashboard/components/LoadingSkeleton";
import { apiGet, apiPut } from "@/lib/apiClient";
import { Button } from "@/components/ui/button";
import { toastSuccess, toastError } from "@/lib/appToast";
import type { PermissionFlagKey, RolePermissionFlags } from "@/lib/rolePermissions";
import { PERMISSION_LABELS, PERMISSION_SHORT_LABELS } from "@/lib/rolePermissions";

type MatrixRow = {
  role: string;
  permissions: RolePermissionFlags;
};

type RolesPermissionsResponse = {
  roles: string[];
  permissionKeys: PermissionFlagKey[];
  labels: Record<PermissionFlagKey, string>;
  matrix: MatrixRow[];
};

export default function RolesSettingsPage() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [permissionKeys, setPermissionKeys] = useState<PermissionFlagKey[]>([]);
  const [labels, setLabels] = useState<Record<string, string>>(PERMISSION_LABELS);
  const [draft, setDraft] = useState<Record<string, RolePermissionFlags>>({});
  const [baseline, setBaseline] = useState<Record<string, RolePermissionFlags>>({});

  const loadData = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    const res = await apiGet<RolesPermissionsResponse>("/api/roles-permissions");
    if (res.error || !res.data) {
      const msg = res.error?.message ?? "Failed to load roles";
      setLoadError(msg);
      toastError(msg);
      setDraft({});
      setBaseline({});
      setPermissionKeys([]);
      setLoading(false);
      return;
    }
    const map: Record<string, RolePermissionFlags> = {};
    for (const row of res.data.matrix) {
      map[row.role] = { ...row.permissions };
    }
    setDraft(map);
    setBaseline(structuredClone(map));
    setPermissionKeys(res.data.permissionKeys);
    setLabels(res.data.labels);
    setLoading(false);
  }, []);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  const dirty = useMemo(() => {
    return JSON.stringify(draft) !== JSON.stringify(baseline);
  }, [draft, baseline]);

  const toggle = (role: string, key: PermissionFlagKey) => {
    setDraft((prev) => {
      const row = prev[role];
      if (!row) return prev;
      return {
        ...prev,
        [role]: { ...row, [key]: !row[key] },
      };
    });
  };

  const handleSave = async () => {
    const updates: Array<{
      role: string;
      permissionKey: string;
      allowed: boolean;
    }> = [];
    for (const role of Object.keys(draft)) {
      for (const key of permissionKeys) {
        const next = draft[role]?.[key];
        const prev = baseline[role]?.[key];
        if (next !== prev) {
          updates.push({
            role,
            permissionKey: key,
            allowed: Boolean(next),
          });
        }
      }
    }
    if (updates.length === 0) {
      toastSuccess("No changes to save.");
      return;
    }
    setSaving(true);
    const res = await apiPut("/api/roles-permissions", { updates });
    setSaving(false);
    if (res.error) {
      toastError(res.error.message);
      return;
    }
    toastSuccess(`Saved ${updates.length} permission change(s).`);
    void loadData();
  };

  const roles = Object.keys(draft);

  return (
    <SimpleMasterShell
      title="Roles & Permissions"
      subtitle="TOOLS_ROLE_PERMISSION — role × permission matrix (JWT role strings)"
      actions={
        <RoleGate permission="canManageUsers">
          <div className="flex items-center gap-2">
            <Button
              type="button"
              variant="outline"
              disabled={!dirty || saving || loading}
              onClick={() => setDraft(structuredClone(baseline))}
            >
              Reset
            </Button>
            <Button
              type="button"
              variant="primary"
              disabled={!dirty || saving || loading}
              onClick={() => void handleSave()}
            >
              {saving ? "Saving…" : "Save changes"}
            </Button>
          </div>
        </RoleGate>
      }
    >
      <div className="bg-[var(--bg-card)] rounded-2xl border border-[var(--border-main)] overflow-hidden">
        {loading ? (
          <div className="p-4">
            <TableSkeleton rows={6} />
          </div>
        ) : (
          <div className="overflow-auto">
            <table className="w-full text-sm min-w-[1100px]">
              <thead>
                <tr className="border-b border-[var(--border-main)] bg-[var(--bg-subtle)]">
                  <th className="sticky left-0 z-10 bg-[var(--bg-subtle)] text-left text-[11px] font-semibold text-[var(--text-muted)] uppercase tracking-wider py-2.5 px-3 min-w-[160px]">
                    Role
                  </th>
                  {permissionKeys.map((key) => (
                    <th
                      key={key}
                      className="text-center text-[10px] font-semibold text-[var(--text-muted)] uppercase tracking-wide py-2.5 px-1.5 min-w-[88px] max-w-[100px]"
                      title={labels[key] ?? key}
                    >
                      <span className="block leading-snug break-words hyphens-auto">
                        {PERMISSION_SHORT_LABELS[key] ?? labels[key] ?? key}
                      </span>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--border-main)]">
                {roles.map((role) => (
                  <tr key={role} className="hover:bg-[var(--bg-hover)]">
                    <td className="sticky left-0 z-10 bg-[var(--bg-card)] py-3 px-3 font-semibold text-[var(--text-primary)]">
                      {role}
                    </td>
                    {permissionKeys.map((key) => (
                      <td key={key} className="py-3 px-2 text-center">
                        <RoleGate
                          permission="canManageUsers"
                          fallback={
                            <span className="text-xs text-[var(--text-muted)]">
                              {draft[role]?.[key] ? "Yes" : "No"}
                            </span>
                          }
                        >
                          <input
                            type="checkbox"
                            className="h-4 w-4 cursor-pointer accent-[var(--primary)]"
                            checked={Boolean(draft[role]?.[key])}
                            onChange={() => toggle(role, key)}
                            aria-label={`${role} ${key}`}
                          />
                        </RoleGate>
                      </td>
                    ))}
                  </tr>
                ))}
                {roles.length === 0 && (
                  <tr>
                    <td
                      colSpan={Math.max(permissionKeys.length, 1) + 1}
                      className="py-8 text-center text-sm text-[var(--text-muted)]"
                    >
                      {loadError ? (
                        <>
                          Could not load role permissions:{" "}
                          <span className="text-[var(--text-primary)]">{loadError}</span>
                          <button
                            type="button"
                            className="ml-2 text-[var(--primary)] font-semibold hover:underline"
                            onClick={() => void loadData()}
                          >
                            Retry
                          </button>
                        </>
                      ) : (
                        <>
                          No role permissions seeded yet. Run{" "}
                          <code className="text-xs">npm run db:seed:role-permissions</code>
                          .
                        </>
                      )}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>
      <p className="mt-3 text-xs text-[var(--text-muted)]">
        Scroll horizontally to see all permissions (including <span className="font-semibold">Create PO</span>{" "}
        and <span className="font-semibold">PO payment</span>). Hover a column header for the full label.
        Changes apply to API authorization within ~30s (cache TTL) or immediately after save on this
        server. Existing JWT sessions keep their role string; only the permission matrix for that
        role changes.
      </p>
    </SimpleMasterShell>
  );
}
