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
  role: string;
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
  role: "Viewer" as string,
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
    void loadData();
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
      role: row.role,
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

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    const errors: Record<string, string> = {};
    if (!editItem && !form.username.trim()) errors.username = "Username is required";
    if (!form.name.trim()) errors.name = "Name is required";
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
    if (editItem) {
      const payload: Record<string, unknown> = {
        id: editItem.id,
        name: form.name.trim(),
        role: form.role.trim(),
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
        role: form.role.trim(),
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
      row.role.toLowerCase().includes(q) ||
      (row.erpUserCode || "").toLowerCase().includes(q)
    );
  });

  return (
    <SimpleMasterShell
      title="Users"
      subtitle="TOOLS_APP_USER — application login accounts (not ERP_USER)"
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
                  {["Username", "Name", "Role", "ERP User", "Status", "Updated", "Actions"].map(
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
                    <td className="py-3.5 px-3 text-[var(--text-secondary)]">{row.role}</td>
                    <td className="py-3.5 px-3 font-mono text-xs text-[var(--text-muted)]">
                      {row.erpUserCode || "—"}
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
                      colSpan={7}
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
            className="w-full max-w-md bg-[var(--bg-card)] border border-[var(--border-main)] rounded-2xl p-5 shadow-xl"
          >
            <h2 className="text-lg font-semibold text-[var(--text-primary)] mb-4">
              {editItem ? "Edit User" : "Add User"}
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
                  Role
                </label>
                <select
                  className="mt-1 w-full rounded-lg border border-[var(--border-main)] bg-[var(--bg-subtle)] px-3 py-2 text-sm"
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
