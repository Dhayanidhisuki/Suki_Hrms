"use client";

import { useCallback, useEffect, useState } from "react";
import { Plus, Edit2, UserX, UserCheck } from "lucide-react";
import { SimpleMasterShell } from "@/components/SimpleMasterShell";
import RoleGate from "@/app/dashboard/components/RoleGate";
import { TableSkeleton } from "@/app/dashboard/components/LoadingSkeleton";
import { apiGet, apiPost, apiPut } from "@/lib/apiClient";
import { Button } from "@/components/ui/button";
import { MasterSearchInput, MasterTableCard } from "@/components/ui/MasterTableCard";
import { toastSuccess, toastError } from "@/lib/appToast";
import { CANONICAL_ROLES } from "@/lib/rolePermissions";

type AppUser = {
  id: number;
  username: string;
  name: string;
  email: string | null;
  role: string;
  roleId: number | null;
  isSystemAdmin: boolean;
  unitScopes: string[];
  erpUserCode: string | null;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
};

function formatDate(value: string | null | undefined) {
  if (!value) return "—";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleDateString("en-IN");
}

const emptyForm = {
  username: "",
  password: "",
  name: "",
  email: "",
  role: "Quality Engineer" as string,
  unitScopes: ["COMMON"] as string[],
  erpUserCode: "",
};

export default function UsersSettingsPage() {
  const [items, setItems] = useState<AppUser[]>([]);
  const [roles, setRoles] = useState<string[]>([...CANONICAL_ROLES]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState("");
  const [showInactive, setShowInactive] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editItem, setEditItem] = useState<AppUser | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [formErrors, setFormErrors] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);

  const loadData = useCallback(async () => {
    setLoading(true);
    const qs = showInactive ? "?includeInactive=1" : "";
    const res = await apiGet<{ items: AppUser[]; roles: string[] }>(
      `/api/users${qs}`
    );
    if (res.data?.items) setItems(res.data.items);
    if (res.data?.roles?.length) setRoles(res.data.roles);
    else if (res.error) toastError(res.error.message);
    setLoading(false);
  }, [showInactive]);

  useEffect(() => {
    queueMicrotask(() => void loadData());
  }, [loadData]);

  const handleOpenAdd = () => {
    setEditItem(null);
    setForm(emptyForm);
    setFormErrors({});
    setIsModalOpen(true);
  };

  const handleOpenEdit = (row: AppUser) => {
    setEditItem(row);
    setForm({
      username: row.username,
      password: "",
      name: row.name,
      email: row.email ?? "",
      role: row.role,
      unitScopes: row.unitScopes.length > 0 ? row.unitScopes : ["COMMON"],
      erpUserCode: row.erpUserCode ?? "",
    });
    setFormErrors({});
    setIsModalOpen(true);
  };

  const handleToggleActive = async (row: AppUser) => {
    const next = !row.isActive;
    const label = next ? "reactivate" : "deactivate";
    if (!confirm(`${label[0].toUpperCase()}${label.slice(1)} user "${row.username}"?`)) {
      return;
    }
    const res = await apiPut<{ ok: boolean }>("/api/users", {
      id: row.id,
      isActive: next,
    });
    if (res.error) {
      toastError(res.error.message);
      return;
    }
    toastSuccess(next ? "User reactivated." : "User deactivated.");
    void loadData();
  };

  const handleToggleUnitScope = (scope: string) => {
    setForm((f) => {
      let current = [...f.unitScopes];
      if (scope === "COMMON") {
        current = current.includes("COMMON") ? [] : ["COMMON"];
      } else {
        current = current.filter((s) => s !== "COMMON");
        if (current.includes(scope)) {
          current = current.filter((s) => s !== scope);
        } else {
          current.push(scope);
        }
      }
      return { ...f, unitScopes: current };
    });
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    const errors: Record<string, string> = {};
    if (!editItem && !form.username.trim()) errors.username = "Username is required";
    if (!form.name.trim()) errors.name = "Name is required";
    if (form.email.trim() && !/^\S+@\S+\.\S+$/.test(form.email.trim())) errors.email = "Enter a valid email address";
    if (!form.role.trim()) errors.role = "Role is required";
    if (!editItem && form.password.length < 8) {
      errors.password = "Password must be at least 8 characters";
    }
    if (editItem && form.password && form.password.length < 8) {
      errors.password = "Password must be at least 8 characters";
    }
    if (Object.keys(errors).length > 0) {
      setFormErrors(errors);
      return;
    }

    setSaving(true);
    const isSysAdmin = form.role === "Tools Admin";
    const finalScopes = isSysAdmin ? [] : form.unitScopes.length === 0 ? ["COMMON"] : form.unitScopes;

    if (editItem) {
      const payload: Record<string, unknown> = {
        id: editItem.id,
        name: form.name.trim(),
        email: form.email.trim() || null,
        role: form.role.trim(),
        unitScopes: finalScopes,
        erpUserCode: form.erpUserCode.trim() || null,
      };
      if (form.password) payload.password = form.password;
      const res = await apiPut("/api/users", payload);
      setSaving(false);
      if (res.error) {
        toastError(res.error.message);
        return;
      }
      toastSuccess("User updated.");
    } else {
      const res = await apiPost("/api/users", {
        username: form.username.trim(),
        password: form.password,
        name: form.name.trim(),
        email: form.email.trim() || null,
        role: form.role.trim(),
        unitScopes: finalScopes,
        erpUserCode: form.erpUserCode.trim() || null,
      });
      setSaving(false);
      if (res.error) {
        toastError(res.error.message);
        return;
      }
      toastSuccess("User created.");
    }
    setIsModalOpen(false);
    void loadData();
  };

  const filtered = items.filter((row) => {
    const q = query.toLowerCase();
    if (!q) return true;
    return (
      row.username.toLowerCase().includes(q) ||
      row.name.toLowerCase().includes(q) ||
      (row.email || "").toLowerCase().includes(q) ||
      row.role.toLowerCase().includes(q) ||
      (row.erpUserCode || "").toLowerCase().includes(q)
    );
  });

  const isFormSysAdmin = form.role === "Tools Admin";
  const isCommonChecked = form.unitScopes.includes("COMMON");

  return (
    <SimpleMasterShell
      title="Users & Unit Scope"
      subtitle="TOOLS_APP_USER — application login accounts, role permissions & unit scope"
      actions={
        <RoleGate permission="canManageUsers">
          <Button onClick={handleOpenAdd} variant="primary" className="group">
            <Plus className="w-4 h-4 transition-transform group-hover:rotate-90 duration-200" />
            Add User
          </Button>
        </RoleGate>
      }
    >
      <MasterTableCard
        toolbar={
          <>
            <MasterSearchInput
              id="users-search-input"
              value={query}
              onChange={setQuery}
              placeholder="Search users…"
            />
            <label className="flex items-center gap-2 text-xs text-[var(--text-muted)] shrink-0 cursor-pointer">
              <input
                type="checkbox"
                checked={showInactive}
                onChange={(e) => setShowInactive(e.target.checked)}
                className="rounded border-[var(--border-main)]"
              />
              Show inactive
            </label>
          </>
        }
      >
        {loading ? (
          <div className="p-4">
            <TableSkeleton rows={5} />
          </div>
        ) : (
          <div className="overflow-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-[var(--border-main)] bg-[var(--bg-subtle)]">
                  {["Username", "Name", "Email", "Role", "Unit Scope", "Status", "Updated", "Actions"].map(
                    (col) => (
                      <th
                        key={col}
                        className="text-left text-[11px] font-semibold text-[var(--text-muted)] uppercase tracking-wider py-2.5 px-3"
                      >
                        {col}
                      </th>
                    )
                  )}
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--border-main)]">
                {filtered.map((row) => (
                  <tr
                    key={row.id}
                    className="hover:bg-[var(--bg-hover)] transition-colors"
                  >
                    <td className="py-3.5 px-3 font-mono text-xs text-[var(--text-secondary)]">
                      {row.username}
                    </td>
                    <td className="py-3.5 px-3 font-semibold text-[var(--text-primary)]">
                      {row.name}
                    </td>
                    <td className="py-3.5 px-3 text-xs text-[var(--text-secondary)]">
                      {row.email || "—"}
                    </td>
                    <td className="py-3.5 px-3 text-[var(--text-secondary)]">
                      <span className="inline-flex items-center gap-1">
                        {row.role}
                        {row.isSystemAdmin && (
                          <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300">
                            Admin
                          </span>
                        )}
                      </span>
                    </td>
                    <td className="py-3.5 px-3 text-xs">
                      {row.isSystemAdmin ? (
                        <span className="text-[var(--text-muted)] italic">All Units (Unscoped)</span>
                      ) : row.unitScopes.includes("COMMON") || row.unitScopes.length === 0 ? (
                        <span className="px-2 py-0.5 rounded-full bg-blue-100 text-blue-700 dark:bg-blue-950/50 dark:text-blue-300 font-semibold text-[11px]">
                          Common (All Units)
                        </span>
                      ) : (
                        <div className="flex gap-1 flex-wrap">
                          {row.unitScopes.map((s) => (
                            <span
                              key={s}
                              className="px-2 py-0.5 rounded-full bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300 text-[11px] font-mono font-medium"
                            >
                              {s === "UNIT1" ? "Unit 1" : s === "UNIT2" ? "Unit 2" : s === "UNIT3" ? "Unit 3" : s}
                            </span>
                          ))}
                        </div>
                      )}
                    </td>
                    <td className="py-3.5 px-3">
                      <span
                        className={
                          row.isActive
                            ? "text-emerald-700 text-xs font-medium"
                            : "text-red-600 text-xs font-medium"
                        }
                      >
                        {row.isActive ? "Active" : "Inactive"}
                      </span>
                    </td>
                    <td className="py-3.5 px-3 text-[var(--text-secondary)]">
                      {formatDate(row.updatedAt)}
                    </td>
                    <td className="py-3.5 px-3">
                      <div className="flex items-center gap-1">
                        <RoleGate permission="canManageUsers">
                          <button
                            type="button"
                            onClick={() => handleOpenEdit(row)}
                            title="Edit"
                            className="p-1.5 hover:bg-[var(--bg-hover)] rounded-lg text-[var(--text-muted)] hover:text-[var(--primary)] transition-colors cursor-pointer"
                          >
                            <Edit2 className="w-4 h-4" />
                          </button>
                          <button
                            type="button"
                            onClick={() => void handleToggleActive(row)}
                            title={row.isActive ? "Deactivate" : "Reactivate"}
                            className="p-1.5 hover:bg-[var(--bg-hover)] rounded-lg text-[var(--text-muted)] hover:text-[var(--primary)] transition-colors cursor-pointer"
                          >
                            {row.isActive ? (
                              <UserX className="w-4 h-4" />
                            ) : (
                              <UserCheck className="w-4 h-4" />
                            )}
                          </button>
                        </RoleGate>
                      </div>
                    </td>
                  </tr>
                ))}
                {filtered.length === 0 && (
                  <tr>
                    <td
                      colSpan={8}
                      className="py-8 text-center text-sm text-[var(--text-muted)]"
                    >
                      No users found.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </MasterTableCard>

      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <form
            onSubmit={handleSave}
            className="w-full max-w-md bg-[var(--bg-card)] border border-[var(--border-main)] rounded-2xl p-5 shadow-xl space-y-4"
          >
            <h2 className="text-lg font-semibold text-[var(--text-primary)]">
              {editItem ? "Edit User & Scope" : "Add User & Scope"}
            </h2>
            <div className="space-y-3">
              <div>
                <label className="text-xs font-medium text-[var(--text-muted)]">
                  Username
                </label>
                <input
                  className="mt-1 w-full rounded-lg border border-[var(--border-main)] bg-[var(--bg-subtle)] px-3 py-2 text-sm disabled:opacity-60"
                  value={form.username}
                  disabled={Boolean(editItem)}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, username: e.target.value }))
                  }
                />
                {formErrors.username && (
                  <p className="text-xs text-red-600 mt-1">{formErrors.username}</p>
                )}
              </div>
              <div>
                <label className="text-xs font-medium text-[var(--text-muted)]">
                  {editItem ? "New password (optional)" : "Password"}
                </label>
                <input
                  type="password"
                  className="mt-1 w-full rounded-lg border border-[var(--border-main)] bg-[var(--bg-subtle)] px-3 py-2 text-sm"
                  value={form.password}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, password: e.target.value }))
                  }
                  autoComplete="new-password"
                />
                {formErrors.password && (
                  <p className="text-xs text-red-600 mt-1">{formErrors.password}</p>
                )}
              </div>
              <div>
                <label className="text-xs font-medium text-[var(--text-muted)]">
                  Display name
                </label>
                <input
                  className="mt-1 w-full rounded-lg border border-[var(--border-main)] bg-[var(--bg-subtle)] px-3 py-2 text-sm"
                  value={form.name}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, name: e.target.value }))
                  }
                />
                {formErrors.name && (
                  <p className="text-xs text-red-600 mt-1">{formErrors.name}</p>
                )}
              </div>
              <div>
                <label className="text-xs font-medium text-[var(--text-muted)]">
                  Notification email (optional)
                </label>
                <input
                  type="email"
                  className="mt-1 w-full rounded-lg border border-[var(--border-main)] bg-[var(--bg-subtle)] px-3 py-2 text-sm"
                  value={form.email}
                  onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
                  placeholder="user@company.com"
                />
                {formErrors.email && (
                  <p className="text-xs text-red-600 mt-1">{formErrors.email}</p>
                )}
              </div>
              <div>
                <label className="text-xs font-medium text-[var(--text-muted)]">
                  Role (Single-Select)
                </label>
                <select
                  className="mt-1 w-full rounded-lg border border-[var(--border-main)] bg-[var(--bg-subtle)] px-3 py-2 text-sm font-medium"
                  value={form.role}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, role: e.target.value }))
                  }
                >
                  {roles.map((r) => (
                    <option key={r} value={r}>
                      {r}
                    </option>
                  ))}
                </select>
              </div>

              {/* Unit Scope Selection Section */}
              <div className="pt-2 border-t border-[var(--border-main)]">
                <label className="text-xs font-semibold text-[var(--text-primary)] block mb-1">
                  Unit Scope Assignment
                </label>
                {isFormSysAdmin ? (
                  <div className="p-3 rounded-lg bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800 text-xs text-amber-800 dark:text-amber-300">
                    Tools Admin has full access to all units. Unit scoping does not apply to System Admin.
                  </div>
                ) : (
                  <div className="space-y-2 bg-[var(--bg-subtle)] p-3 rounded-lg border border-[var(--border-main)]">
                    <label className="flex items-center gap-2.5 text-xs font-medium text-[var(--text-primary)] cursor-pointer">
                      <input
                        type="checkbox"
                        checked={isCommonChecked}
                        onChange={() => handleToggleUnitScope("COMMON")}
                        className="w-4 h-4 rounded border-[var(--border-main)] text-[var(--primary)]"
                      />
                      <span className="font-semibold text-blue-600 dark:text-blue-400">Common (Wildcard — All Units)</span>
                    </label>

                    <div className="grid grid-cols-3 gap-2 pt-2 border-t border-[var(--border-main)]">
                      {[
                        { key: "UNIT1", label: "Unit 1" },
                        { key: "UNIT2", label: "Unit 2" },
                        { key: "UNIT3", label: "Unit 3" },
                      ].map((u) => {
                        const isChecked = isCommonChecked || form.unitScopes.includes(u.key);
                        return (
                          <label
                            key={u.key}
                            className={`flex items-center gap-2 text-xs p-2 rounded border transition-colors ${
                              isCommonChecked
                                ? "bg-slate-100 text-slate-400 border-slate-200 cursor-not-allowed opacity-60 dark:bg-slate-800 dark:border-slate-700"
                                : "bg-[var(--bg-card)] border-[var(--border-main)] cursor-pointer hover:bg-[var(--bg-hover)]"
                            }`}
                          >
                            <input
                              type="checkbox"
                              checked={isChecked}
                              disabled={isCommonChecked}
                              onChange={() => handleToggleUnitScope(u.key)}
                              className="rounded border-[var(--border-main)] text-[var(--primary)] disabled:cursor-not-allowed"
                            />
                            <span>{u.label}</span>
                          </label>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>

              <div>
                <label className="text-xs font-medium text-[var(--text-muted)]">
                  ERP user code (optional)
                </label>
                <input
                  className="mt-1 w-full rounded-lg border border-[var(--border-main)] bg-[var(--bg-subtle)] px-3 py-2 text-sm"
                  value={form.erpUserCode}
                  maxLength={10}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, erpUserCode: e.target.value }))
                  }
                />
              </div>
            </div>
            <div className="mt-5 flex justify-end gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => setIsModalOpen(false)}
                disabled={saving}
              >
                Cancel
              </Button>
              <Button type="submit" variant="primary" disabled={saving}>
                {saving ? "Saving…" : "Save"}
              </Button>
            </div>
          </form>
        </div>
      )}
    </SimpleMasterShell>
  );
}
