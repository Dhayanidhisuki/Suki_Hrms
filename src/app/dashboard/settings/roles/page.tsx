"use client";

import React, { useState, useEffect, useCallback } from "react";
import Sidebar from "@/app/dashboard/components/Sidebar";
import TopBar from "@/app/dashboard/components/TopBar";
import { TableSkeleton } from "@/app/dashboard/components/LoadingSkeleton";
import { apiGet, apiPost } from "@/lib/apiClient";
import { toastSuccess, toastError } from "@/lib/appToast";
import { Shield, Lock, Save, RefreshCw, Bell, BellOff } from "lucide-react";

interface Role {
  roleId: number;
  roleName: string;
  isSystemAdmin: boolean;
}

interface Module {
  moduleId: number;
  moduleKey: string;
  moduleLabel: string;
  moduleGroup: string;
  applicableActions: string;
  isBuilt: boolean;
}

interface PermissionEntry {
  roleId: number;
  moduleId: number;
  action: string;
  allowed: boolean;
}

const ALL_ACTIONS = [
  { key: "VIEW",                 label: "View" },
  { key: "RECEIVE_EMAIL",        label: "Receive Alerts" },
  { key: "CREATE",               label: "Create" },
  { key: "EDIT",                 label: "Edit" },
  { key: "DELETE",               label: "Delete" },
  { key: "APPROVE",              label: "Approve" },
  { key: "SEND_FOR_CALIBRATION", label: "Send for Calibration" },
] as const;

/** Roles that should receive calibration email alerts */
const NOTIFICATION_ROLES = ["Calibration Engineer", "Quality Engineer", "Quality Manager"];

export default function RolesAndPermissionsPage() {
  const [roles, setRoles]               = useState<Role[]>([]);
  const [modules, setModules]           = useState<Module[]>([]);
  const [matrix, setMatrix]             = useState<Record<string, boolean>>({});
  const [selectedRoleId, setSelectedRoleId] = useState<number | null>(null);
  const [loading, setLoading]           = useState(true);
  const [pendingChanges, setPendingChanges] = useState<Record<string, boolean>>({});
  const [saving, setSaving]             = useState(false);
  const [quickSaving, setQuickSaving]   = useState(false);

  const loadData = useCallback(async () => {
    setLoading(true);
    const res = await apiGet<{
      success: boolean;
      roles: Role[];
      modules: Module[];
      matrix: PermissionEntry[];
    }>("/api/settings/roles");

    if (res.data?.success) {
      setRoles(res.data.roles);
      setModules(res.data.modules);

      const m: Record<string, boolean> = {};
      for (const entry of res.data.matrix) {
        m[`${entry.roleId}:${entry.moduleId}:${entry.action}`] = entry.allowed;
      }
      setMatrix(m);
      setPendingChanges({});

      setSelectedRoleId((currentRoleId) => {
        // Auto-select Calibration Engineer on first load
        if (currentRoleId !== null && res.data!.roles.some((r) => r.roleId === currentRoleId)) {
          return currentRoleId;
        }
        const ce = res.data!.roles.find((r) => r.roleName === "Calibration Engineer");
        if (ce) return ce.roleId;
        const nonAdmin = res.data!.roles.find((r) => !r.isSystemAdmin);
        return nonAdmin?.roleId ?? res.data!.roles[0]?.roleId ?? null;
      });
    } else {
      toastError("Failed to load roles and permissions matrix.");
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    queueMicrotask(() => void loadData());
  }, [loadData]);

  const selectedRole = roles.find((r) => r.roleId === selectedRoleId);
  const emailModule  = modules.find((m) => m.moduleKey === "email_notifications");

  // ── Quick email-alert status per notification role ──────────────────────────
  function roleEmailEnabled(role: Role): boolean {
    if (role.isSystemAdmin) return true;
    if (!emailModule) return false;
    return Boolean(matrix[`${role.roleId}:${emailModule.moduleId}:RECEIVE_EMAIL`]);
  }

  /** Toggle RECEIVE_EMAIL for all three notification roles at once */
  async function handleQuickEmailToggle(targetRole: Role, enable: boolean) {
    if (!emailModule) return toastError("Email Notifications module not found.");
    if (targetRole.isSystemAdmin) return;

    setQuickSaving(true);
    const permissions = [{
      roleId:   targetRole.roleId,
      moduleId: emailModule.moduleId,
      action:   "RECEIVE_EMAIL",
      allowed:  enable,
    }];

    const res = await apiPost<{ success: boolean; updatedCount: number }>(
      "/api/settings/roles",
      { permissions }
    );
    setQuickSaving(false);

    if (!res.data?.success) {
      toastError(res.error?.message ?? "Failed to update email alert permission.");
      return;
    }

    // Refresh local matrix
    const key = `${targetRole.roleId}:${emailModule.moduleId}:RECEIVE_EMAIL`;
    setMatrix((prev) => ({ ...prev, [key]: enable }));
    setPendingChanges((prev) => {
      const next = { ...prev };
      delete next[key];
      return next;
    });

    toastSuccess(
      `${enable ? "✅ Email alerts enabled" : "🔕 Email alerts disabled"} for ${targetRole.roleName}`
    );
  }

  // ── Individual cell toggle ──────────────────────────────────────────────────
  const handleToggle = (roleId: number, moduleId: number, action: string, currentAllowed: boolean) => {
    if (selectedRole?.isSystemAdmin) {
      toastError("Tools Admin permissions are full-access and cannot be modified.");
      return;
    }
    const key = `${roleId}:${moduleId}:${action}`;
    const next = !currentAllowed;
    setMatrix((prev) => ({ ...prev, [key]: next }));
    setPendingChanges((prev) => ({ ...prev, [key]: next }));
  };

  const handleSave = async () => {
    const permissions = Object.entries(pendingChanges).map(([key, allowed]) => {
      const [roleId, moduleId, action] = key.split(":");
      return { roleId: Number(roleId), moduleId: Number(moduleId), action, allowed };
    });
    if (permissions.length === 0) return;

    setSaving(true);
    const res = await apiPost<{ success: boolean; updatedCount: number }>(
      "/api/settings/roles",
      { permissions }
    );
    setSaving(false);

    if (!res.data?.success) {
      toastError(res.error?.message ?? "Failed to save permission changes.");
      return;
    }
    setPendingChanges({});
    toastSuccess(`${res.data.updatedCount} permission change${res.data.updatedCount === 1 ? "" : "s"} saved`);
  };

  const pendingCount   = Object.keys(pendingChanges).length;
  const groupedModules = modules.reduce<Record<string, Module[]>>((acc, m) => {
    const g = m.moduleGroup || "General";
    acc[g] = [...(acc[g] ?? []), m];
    return acc;
  }, {});

  // ── Which notification roles exist in DB ────────────────────────────────────
  const notifRoles = roles.filter((r) => NOTIFICATION_ROLES.includes(r.roleName));

  return (
    <div className="flex h-screen bg-[var(--bg-app)] text-[var(--text-primary)]">
      <Sidebar />
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        <TopBar />
        <main className="flex-1 overflow-y-auto p-4 md:p-6">
          <div className="max-w-7xl mx-auto space-y-6">

            {/* ── Page header ── */}
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
              <div>
                <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
                  <Shield className="w-6 h-6 text-[var(--primary)]" />
                  Roles &amp; Permissions
                </h1>
                <p className="text-sm text-[var(--text-muted)] mt-1">
                  Configure module-level action permissions per user role.
                </p>
              </div>
              <button
                onClick={loadData}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg bg-[var(--bg-card)] border border-[var(--border-main)] hover:bg-[var(--bg-hover)] transition-colors cursor-pointer self-start sm:self-auto"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                Refresh Matrix
              </button>
            </div>

            {loading ? <TableSkeleton rows={8} /> : (
              <>
                {/* ── Quick Email Alert panel ── */}
                {notifRoles.length > 0 && emailModule && (
                  <div className="rounded-xl border border-blue-200 bg-blue-50 dark:border-blue-900 dark:bg-blue-950/30 p-4">
                    <div className="flex items-start gap-3 mb-3">
                      <Bell className="w-5 h-5 text-blue-600 dark:text-blue-400 shrink-0 mt-0.5" />
                      <div>
                        <p className="text-sm font-semibold text-blue-900 dark:text-blue-200">
                          Calibration Email Alerts — Quick Toggle
                        </p>
                        <p className="text-xs text-blue-700 dark:text-blue-400 mt-0.5">
                          Enable &ldquo;Receive Alerts&rdquo; permission so these roles get calibration digest emails.
                          You can also configure individual permissions in the matrix below.
                        </p>
                      </div>
                    </div>

                    <div className="flex flex-wrap gap-3">
                      {notifRoles.map((role) => {
                        const enabled = roleEmailEnabled(role);
                        return (
                          <div
                            key={role.roleId}
                            className={`flex items-center gap-3 rounded-lg border px-4 py-2.5 min-w-[220px] transition-all ${
                              enabled
                                ? "border-emerald-300 bg-emerald-50 dark:border-emerald-700 dark:bg-emerald-950/40"
                                : "border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-900/40"
                            }`}
                          >
                            <div className="flex-1 min-w-0">
                              <p className="text-xs font-semibold text-[var(--text-primary)] truncate">
                                {role.roleName}
                              </p>
                              <p className={`text-[11px] font-medium mt-0.5 ${
                                enabled ? "text-emerald-600 dark:text-emerald-400" : "text-slate-400 dark:text-slate-500"
                              }`}>
                                {enabled ? "✅ Email alerts enabled" : "❌ Email alerts disabled"}
                              </p>
                            </div>

                            {/* Toggle button */}
                            <button
                              type="button"
                              disabled={quickSaving}
                              onClick={() => handleQuickEmailToggle(role, !enabled)}
                              title={enabled ? `Disable email alerts for ${role.roleName}` : `Enable email alerts for ${role.roleName}`}
                              className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-1 disabled:opacity-50 disabled:cursor-not-allowed ${
                                enabled ? "bg-emerald-500" : "bg-slate-300 dark:bg-slate-600"
                              }`}
                            >
                              <span
                                className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                                  enabled ? "translate-x-5" : "translate-x-0"
                                }`}
                              />
                            </button>

                            {/* Jump-to in matrix */}
                            <button
                              type="button"
                              onClick={() => setSelectedRoleId(role.roleId)}
                              title={`View full permissions for ${role.roleName}`}
                              className={`shrink-0 text-[11px] font-medium px-2 py-1 rounded-md transition-colors ${
                                selectedRoleId === role.roleId
                                  ? "bg-[var(--primary)] text-white"
                                  : "bg-[var(--bg-subtle)] text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-hover)]"
                              }`}
                            >
                              {selectedRoleId === role.roleId ? "Selected ↓" : "Full →"}
                            </button>
                          </div>
                        );
                      })}

                      {/* Enable all shortcut */}
                      {notifRoles.some((r) => !roleEmailEnabled(r)) && (
                        <button
                          type="button"
                          disabled={quickSaving}
                          onClick={async () => {
                            setQuickSaving(true);
                            for (const role of notifRoles) {
                              if (!roleEmailEnabled(role)) {
                                await handleQuickEmailToggle(role, true);
                              }
                            }
                            setQuickSaving(false);
                          }}
                          className="flex items-center gap-2 rounded-lg border border-dashed border-blue-300 dark:border-blue-700 bg-transparent px-4 py-2.5 text-xs font-semibold text-blue-700 dark:text-blue-400 hover:bg-blue-100 dark:hover:bg-blue-900/30 transition-colors disabled:opacity-50"
                        >
                          <Bell className="w-3.5 h-3.5" />
                          Enable All 3 Roles
                        </button>
                      )}

                      {notifRoles.every((r) => roleEmailEnabled(r)) && (
                        <div className="flex items-center gap-2 rounded-lg border border-emerald-300 dark:border-emerald-700 bg-emerald-50 dark:bg-emerald-950/20 px-4 py-2.5 text-xs font-semibold text-emerald-700 dark:text-emerald-400">
                          <Bell className="w-3.5 h-3.5" />
                          All notification roles enabled ✓
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {/* ── Main matrix ── */}
                <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
                  {/* Left: Role Selector */}
                  <div className="lg:col-span-1 space-y-3">
                    <h2 className="text-xs font-semibold uppercase tracking-wider text-[var(--text-muted)] px-1">
                      Select Role
                    </h2>
                    <div className="space-y-1 bg-[var(--bg-card)] p-2 rounded-xl border border-[var(--border-main)] shadow-sm">
                      {roles.map((role) => {
                        const isSelected   = role.roleId === selectedRoleId;
                        const emailEnabled = roleEmailEnabled(role);
                        const isNotifRole  = NOTIFICATION_ROLES.includes(role.roleName);
                        return (
                          <button
                            key={role.roleId}
                            onClick={() => setSelectedRoleId(role.roleId)}
                            className={`w-full text-left px-3 py-2.5 rounded-lg text-xs font-medium transition-colors cursor-pointer flex items-center justify-between gap-2 ${
                              isSelected
                                ? "bg-[var(--primary)] text-white shadow-sm"
                                : "hover:bg-[var(--bg-hover)] text-[var(--text-primary)]"
                            }`}
                          >
                            <span className="font-semibold truncate">{role.roleName}</span>
                            <div className="flex items-center gap-1.5 shrink-0">
                              {/* Email alert indicator */}
                              {isNotifRole && !role.isSystemAdmin && (
                                emailEnabled
                                  ? <Bell className={`w-3 h-3 ${isSelected ? "text-white/80" : "text-emerald-500"}`} />
                                  : <BellOff className={`w-3 h-3 ${isSelected ? "text-white/60" : "text-amber-400"}`} />
                              )}
                              {role.isSystemAdmin ? (
                                <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                                  isSelected
                                    ? "bg-white/20 text-white"
                                    : "bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300"
                                }`}>
                                  Admin
                                </span>
                              ) : (
                                <span className={`text-[10px] ${isSelected ? "text-white/70" : "text-[var(--text-muted)]"}`}>
                                  Config
                                </span>
                              )}
                            </div>
                          </button>
                        );
                      })}
                    </div>

                    {/* Legend */}
                    <div className="rounded-lg border border-[var(--border-main)] bg-[var(--bg-card)] px-3 py-3 space-y-1.5 text-[11px] text-[var(--text-muted)]">
                      <p className="font-semibold text-[var(--text-primary)] mb-1">Legend</p>
                      <p className="flex items-center gap-1.5"><Bell className="w-3 h-3 text-emerald-500" /> Email alerts ON</p>
                      <p className="flex items-center gap-1.5"><BellOff className="w-3 h-3 text-amber-400" /> Email alerts OFF</p>
                    </div>
                  </div>

                  {/* Right: Permission Matrix */}
                  <div className="lg:col-span-3">
                    {selectedRole ? (
                      <div className="bg-[var(--bg-card)] rounded-xl border border-[var(--border-main)] shadow-sm overflow-hidden">
                        {/* Matrix Banner */}
                        <div className="px-5 py-4 border-b border-[var(--border-main)] bg-[var(--bg-subtle)] flex items-center justify-between gap-4">
                          <div>
                            <h2 className="text-base font-bold flex items-center gap-2">
                              {selectedRole.roleName} Permissions
                              {selectedRole.isSystemAdmin && (
                                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300 border border-amber-300 dark:border-amber-800">
                                  <Lock className="w-3 h-3" />
                                  Full access — not editable
                                </span>
                              )}
                            </h2>
                            <p className="text-xs text-[var(--text-muted)] mt-0.5">
                              {selectedRole.isSystemAdmin
                                ? "Tools Admin role is exempt from permission restrictions and unit scoping."
                                : "Toggle allowed actions for each application module."}
                            </p>
                          </div>
                          {!selectedRole.isSystemAdmin && (
                            <button
                              type="button"
                              onClick={handleSave}
                              disabled={saving || pendingCount === 0}
                              className="inline-flex shrink-0 items-center gap-2 rounded-lg bg-[var(--primary)] px-4 py-2 text-xs font-semibold text-white shadow-sm transition-opacity disabled:cursor-not-allowed disabled:opacity-50"
                            >
                              <Save className="h-4 w-4" />
                              {saving ? "Saving…" : pendingCount > 0 ? `Save changes (${pendingCount})` : "Saved"}
                            </button>
                          )}
                        </div>

                        {/* Table */}
                        <div className="overflow-x-auto">
                          <table className="w-full text-xs">
                            <thead>
                              <tr className="border-b border-[var(--border-main)] bg-[var(--bg-subtle)] text-[var(--text-muted)] uppercase tracking-wider font-semibold">
                                <th className="sticky left-0 z-20 min-w-[220px] bg-[var(--bg-subtle)] py-3 px-4 text-left">
                                  Module Name
                                </th>
                                {ALL_ACTIONS.map((act) => (
                                  <th key={act.key} className={`py-3 px-3 text-center w-28 whitespace-nowrap ${
                                    act.key === "RECEIVE_EMAIL" ? "text-blue-600 dark:text-blue-400" : ""
                                  }`}>
                                    {act.key === "RECEIVE_EMAIL" && (
                                      <Bell className="w-3 h-3 inline-block mr-1 -mt-0.5" />
                                    )}
                                    {act.label}
                                  </th>
                                ))}
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-[var(--border-main)]">
                              {Object.entries(groupedModules).map(([groupName, groupMods]) => (
                                <React.Fragment key={groupName}>
                                  {/* Group header */}
                                  <tr className="bg-[var(--bg-subtle)]/70">
                                    <td
                                      colSpan={ALL_ACTIONS.length + 1}
                                      className="py-2 px-4 font-bold text-[11px] uppercase tracking-wider text-[var(--primary)] border-y border-[var(--border-main)]"
                                    >
                                      {groupName}
                                    </td>
                                  </tr>

                                  {groupMods.map((mod) => {
                                    const allowedActions = mod.applicableActions.split(",");
                                    const isEmailModule  = mod.moduleKey === "email_notifications";
                                    return (
                                      <tr
                                        key={mod.moduleId}
                                        className={`hover:bg-[var(--bg-hover)] transition-colors ${
                                          isEmailModule ? "bg-blue-50/40 dark:bg-blue-950/10" : ""
                                        }`}
                                      >
                                        <td className="sticky left-0 z-10 bg-[var(--bg-card)] py-3 px-4 font-medium shadow-[2px_0_0_0_var(--border-main)]">
                                          <div className="flex items-center gap-2">
                                            {isEmailModule && (
                                              <Bell className="w-3.5 h-3.5 text-blue-500 shrink-0" />
                                            )}
                                            <span>{mod.moduleLabel}</span>
                                            {!mod.isBuilt && (
                                              <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-slate-100 text-slate-500 border border-slate-200">
                                                Not yet built
                                              </span>
                                            )}
                                          </div>
                                        </td>
                                        {ALL_ACTIONS.map((act) => {
                                          const isApplicable = allowedActions.includes(act.key);
                                          const key          = `${selectedRole.roleId}:${mod.moduleId}:${act.key}`;
                                          const isChecked    = selectedRole.isSystemAdmin ? true : Boolean(matrix[key]);
                                          const isPending    = key in pendingChanges;
                                          const isEmailCell  = isEmailModule && act.key === "RECEIVE_EMAIL";

                                          if (!isApplicable) {
                                            return (
                                              <td key={act.key} className="py-3 px-3 text-center bg-slate-50/50 dark:bg-slate-900/30">
                                                <span className="text-[10px] text-[var(--text-muted)] opacity-40">—</span>
                                              </td>
                                            );
                                          }

                                          return (
                                            <td
                                              key={act.key}
                                              className={`py-3 px-3 text-center ${isEmailCell ? "bg-blue-50/60 dark:bg-blue-950/20" : ""}`}
                                            >
                                              <label className="inline-flex flex-col items-center justify-center cursor-pointer gap-1">
                                                <input
                                                  type="checkbox"
                                                  checked={isChecked}
                                                  disabled={selectedRole.isSystemAdmin || saving}
                                                  onChange={() => handleToggle(selectedRole.roleId, mod.moduleId, act.key, isChecked)}
                                                  className={`w-4 h-4 rounded border-[var(--border-main)] focus:ring-[var(--primary)] disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer ${
                                                    isEmailCell ? "text-blue-600 focus:ring-blue-500" : "text-[var(--primary)]"
                                                  }`}
                                                />
                                                {isPending && (
                                                  <span className="text-[9px] font-bold text-amber-500 uppercase">Unsaved</span>
                                                )}
                                              </label>
                                            </td>
                                          );
                                        })}
                                      </tr>
                                    );
                                  })}
                                </React.Fragment>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    ) : null}
                  </div>
                </div>
              </>
            )}
          </div>
        </main>
      </div>
    </div>
  );
}
