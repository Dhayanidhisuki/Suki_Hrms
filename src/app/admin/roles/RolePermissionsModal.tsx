/**
 * Bespoke modal for assigning permissions to a role.
 *
 * FormModal is built for flat FieldDef[] forms and doesn't fit a grouped
 * checkbox matrix, so this is a standalone modal — it reuses the same
 * overlay/backdrop/card classes and styling FormModal.tsx uses so it reads
 * as the same design system.
 */

'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';

interface Permission {
  id: number;
  code: string;
  module: string;
  submodule: string | null;
  page: string | null;
  action: string;
  description: string | null;
}

interface RolePermissionsModalProps {
  roleId: number;
  roleName: string;
  isOpen: boolean;
  onClose: () => void;
  onSaved: () => void;
}

const GENERAL_GROUP = '(general)';

export default function RolePermissionsModal({
  roleId,
  roleName,
  isOpen,
  onClose,
  onSaved,
}: RolePermissionsModalProps) {
  const [allPermissions, setAllPermissions] = useState<Permission[]>([]);
  const [grantedIds, setGrantedIds] = useState<Set<number>>(new Set());
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [permsRes, grantedRes] = await Promise.all([
        fetch('/api/admin/permissions'),
        fetch(`/api/admin/roles/${roleId}/permissions`),
      ]);
      if (!permsRes.ok || !grantedRes.ok) throw new Error('Failed to load permissions');
      const perms: Permission[] = await permsRes.json();
      const granted: number[] = await grantedRes.json();
      setAllPermissions(perms);
      setGrantedIds(new Set(granted));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  }, [roleId]);

  useEffect(() => {
    if (isOpen) {
      load();
    }
  }, [isOpen, load]);

  const groups = useMemo(() => {
    const byModule = new Map<string, Map<string, Permission[]>>();
    for (const perm of allPermissions) {
      const submoduleKey = perm.submodule ?? GENERAL_GROUP;
      if (!byModule.has(perm.module)) byModule.set(perm.module, new Map());
      const bySubmodule = byModule.get(perm.module)!;
      if (!bySubmodule.has(submoduleKey)) bySubmodule.set(submoduleKey, []);
      bySubmodule.get(submoduleKey)!.push(perm);
    }
    return byModule;
  }, [allPermissions]);

  const toggleOne = (id: number) => {
    setGrantedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleGroup = (perms: Permission[]) => {
    const allChecked = perms.every((p) => grantedIds.has(p.id));
    setGrantedIds((prev) => {
      const next = new Set(prev);
      for (const p of perms) {
        if (allChecked) next.delete(p.id);
        else next.add(p.id);
      }
      return next;
    });
  };

  const handleSave = async () => {
    setSaving(true);
    setError(null);
    try {
      const res = await fetch(`/api/admin/roles/${roleId}/permissions`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ permissionIds: [...grantedIds] }),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error ?? 'Save failed');
      }
      onSaved();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setSaving(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ backgroundColor: 'rgba(0,0,0,0.4)' }}
      onClick={onClose}
    >
      <div
        className="w-full max-w-2xl rounded-xl shadow-2xl max-h-[90vh] overflow-y-auto"
        style={{ backgroundColor: 'var(--surface)', border: '1px solid var(--border)' }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div
          className="flex items-center justify-between px-5 py-4 border-b"
          style={{ borderColor: 'var(--border)' }}
        >
          <h2 className="text-base font-semibold" style={{ color: 'var(--foreground)' }}>
            Permissions — {roleName}
          </h2>
          <button
            onClick={onClose}
            className="text-lg leading-none hover:opacity-70"
            style={{ color: 'var(--foreground-muted)' }}
          >
            ×
          </button>
        </div>

        {/* Body */}
        <div className="px-5 py-4 space-y-5">
          {loading ? (
            <p className="text-sm" style={{ color: 'var(--foreground-muted)' }}>
              Loading...
            </p>
          ) : (
            [...groups.entries()].map(([moduleName, bySubmodule]) => (
              <div key={moduleName} className="space-y-3">
                <h3
                  className="text-sm font-semibold uppercase tracking-wide"
                  style={{ color: 'var(--foreground)' }}
                >
                  {moduleName}
                </h3>
                {[...bySubmodule.entries()].map(([submoduleName, perms]) => {
                  const allChecked = perms.every((p) => grantedIds.has(p.id));
                  const someChecked = perms.some((p) => grantedIds.has(p.id));
                  return (
                    <div
                      key={submoduleName}
                      className="rounded-lg border px-3 py-2"
                      style={{ borderColor: 'var(--border)', backgroundColor: 'var(--surface-muted)' }}
                    >
                      <label className="flex items-center gap-2 cursor-pointer pb-2">
                        <input
                          type="checkbox"
                          checked={allChecked}
                          ref={(el) => {
                            if (el) el.indeterminate = !allChecked && someChecked;
                          }}
                          onChange={() => toggleGroup(perms)}
                          className="h-4 w-4 rounded"
                          style={{ accentColor: 'var(--accent)' }}
                        />
                        <span className="text-sm font-medium" style={{ color: 'var(--foreground)' }}>
                          {submoduleName === GENERAL_GROUP ? moduleName : submoduleName}
                        </span>
                      </label>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-1.5 pl-6">
                        {perms.map((perm) => (
                          <label key={perm.id} className="flex items-center gap-2 cursor-pointer">
                            <input
                              type="checkbox"
                              checked={grantedIds.has(perm.id)}
                              onChange={() => toggleOne(perm.id)}
                              className="h-3.5 w-3.5 rounded"
                              style={{ accentColor: 'var(--accent)' }}
                            />
                            <span className="text-xs" style={{ color: 'var(--foreground-muted)' }}>
                              {perm.action}
                              {perm.description ? ` — ${perm.description}` : ''}
                            </span>
                          </label>
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>
            ))
          )}

          {error && (
            <div
              className="rounded-lg px-3 py-2 text-sm"
              style={{ backgroundColor: '#fef2f2', color: '#dc2626', border: '1px solid #fecaca' }}
            >
              {error}
            </div>
          )}

          {/* Footer */}
          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg border px-4 py-2 text-sm font-medium transition hover:opacity-80"
              style={{ borderColor: 'var(--border)', color: 'var(--foreground)' }}
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleSave}
              disabled={saving || loading}
              className="rounded-lg px-4 py-2 text-sm font-medium text-white transition disabled:opacity-50"
              style={{ backgroundColor: 'var(--accent)' }}
            >
              {saving ? 'Saving...' : 'Save'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
