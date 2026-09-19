/**
 * Administration > User Scopes (BRD 01 §20): which employee records a user's
 * role may touch. A user holds zero or more scope assignments; the visible
 * set is their union plus the implicit SELF scope. No assignment = SELF only.
 */

'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { DataTable, ConfirmDialog, StatusBadge, useToast, type Column } from '@/components/ui';

// BUSINESS_UNIT and LOCATION exist in the data-scope model but have no
// master screen in this UI (Unit already covers that role) — left out of
// the picker below so an admin can't select a scope with nothing to pick
// from (2026-09-15).
type ScopeType =
  | 'GLOBAL' | 'COMPANY' | 'UNIT' | 'SITE'
  | 'DEPARTMENT' | 'SUB_DEPARTMENT' | 'COST_CENTRE' | 'REPORTING_TREE' | 'EMPLOYEE_LIST';

const SCOPE_TYPES: { value: ScopeType; label: string; hint: string }[] = [
  { value: 'COMPANY', label: 'Company', hint: 'Every employee of the company' },
  { value: 'UNIT', label: 'Unit', hint: 'Employees whose location resolves to the listed units' },
  { value: 'SITE', label: 'Site', hint: 'Employees whose location resolves to the listed sites' },
  { value: 'DEPARTMENT', label: 'Department', hint: 'Employees of the listed departments' },
  { value: 'SUB_DEPARTMENT', label: 'Sub-Department', hint: 'Employees of the listed sub-departments' },
  { value: 'COST_CENTRE', label: 'Cost Centre', hint: 'Employees booked to the listed cost centres' },
  { value: 'REPORTING_TREE', label: 'Reporting Tree', hint: "The user's own direct reportees, or their whole downward tree" },
  { value: 'EMPLOYEE_LIST', label: 'Employee List', hint: 'Only the listed employee codes' },
];

const NEEDS_VALUES = new Set<ScopeType>(['UNIT', 'SITE', 'DEPARTMENT', 'SUB_DEPARTMENT', 'COST_CENTRE', 'EMPLOYEE_LIST']);

interface UserRow { id: number; email: string; role: { code: string; name: string } | null; isActive: boolean }
interface ScopeRow {
  id: number;
  userId: number;
  scopeType: ScopeType;
  scopeValues: string[];
  treeDepth: string | null;
  createdAt: string;
  user: { id: number; email: string; role: { code: string; name: string } | null } | null;
}
interface CodeOption { code: string; label: string }

const inputStyle = { borderColor: 'var(--border)', backgroundColor: 'var(--surface)', color: 'var(--foreground)' };

export default function UserScopesPage() {
  const toast = useToast();
  const [rows, setRows] = useState<ScopeRow[]>([]);
  const [users, setUsers] = useState<UserRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [deleteId, setDeleteId] = useState<number | null>(null);

  const [userId, setUserId] = useState<string>('');
  const [scopeType, setScopeType] = useState<ScopeType>('DEPARTMENT');
  const [values, setValues] = useState<string[]>([]);
  const [treeDepth, setTreeDepth] = useState<'DIRECT' | 'ALL'>('DIRECT');
  const [options, setOptions] = useState<CodeOption[]>([]);
  const [saving, setSaving] = useState(false);
  const [companyId, setCompanyId] = useState<number | null>(null);

  const load = useCallback(() => {
    Promise.all([fetch('/api/admin/user-scopes'), fetch('/api/admin/users?limit=200'), fetch('/api/auth/me')])
      .then(async ([scopeRes, userRes, meRes]) => {
        if (!scopeRes.ok) throw new Error('Failed to load user scopes');
        const scopeJson: { data: ScopeRow[] } = await scopeRes.json();
        const userJson: { data: UserRow[] } = userRes.ok ? await userRes.json() : { data: [] };
        const me: { companyId: number | null } | null = meRes.ok ? await meRes.json() : null;
        return { scopeJson, userJson, me };
      })
      .then(({ scopeJson, userJson, me }) => {
        setRows(scopeJson.data);
        setUsers(userJson.data.filter((u) => u.isActive));
        setCompanyId(me?.companyId ?? null);
      })
      .catch((err) => toast.error(err instanceof Error ? err.message : 'Unknown error'))
      .finally(() => setLoading(false));
  }, [toast]);

  useEffect(() => {
    load();
  }, [load]);

  // Value options depend on the scope type; codes are what the scope stores.
  const loadOptions = useCallback(() => {
    const byType: Record<string, string> = {
      UNIT: '/api/masters/units?limit=500',
      SITE: '/api/masters/sites?limit=500',
      DEPARTMENT: '/api/masters/departments?limit=500',
      SUB_DEPARTMENT: '/api/masters/sub-departments?limit=500',
      COST_CENTRE: '/api/masters/cost-centres?limit=500',
      EMPLOYEE_LIST: '/api/employees?limit=500',
    };
    const url = NEEDS_VALUES.has(scopeType) ? byType[scopeType] : null;
    const request = url
      ? fetch(url).then(async (res) => {
          if (!res.ok) throw new Error('Failed to load options');
          const json: { data: Array<Record<string, unknown>> } = await res.json();
          return json.data
            // Units / Sites list across companies for superadmins — keep our own company's.
            .filter((r) => companyId === null || r.companyId === undefined || r.companyId === companyId)
            .map((r) =>
              scopeType === 'EMPLOYEE_LIST'
                ? { code: String(r.employeeCode), label: `${r.firstName} ${r.lastName} (${r.oldEmployeeCode ?? r.employeeCode})` }
                : { code: String(r.code), label: `${r.name} (${r.code})` }
            );
        })
      : Promise.resolve([] as CodeOption[]);
    request
      .then((list) => {
        setOptions(list);
        setValues([]);
      })
      .catch(() => setOptions([]));
  }, [scopeType, companyId]);

  useEffect(() => {
    loadOptions();
  }, [loadOptions]);

  const handleAssign = async () => {
    setSaving(true);
    try {
      if (!userId) throw new Error('Pick a user');
      const res = await fetch('/api/admin/user-scopes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: Number(userId),
          scopeType,
          scopeValues: NEEDS_VALUES.has(scopeType) ? values : undefined,
          treeDepth: scopeType === 'REPORTING_TREE' ? treeDepth : undefined,
        }),
      });
      if (!res.ok) {
        const err = await res.json();
        const fieldErrors = err.details?.fieldErrors as Record<string, string[]> | undefined;
        const first = fieldErrors && Object.values(fieldErrors).find((m) => m?.length)?.[0];
        throw new Error(first ?? err.error ?? 'Assign failed');
      }
      toast.success('Scope assigned.');
      setValues([]);
      load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Assign failed');
    } finally {
      setSaving(false);
    }
  };

  const handleRevoke = async (id: number) => {
    const res = await fetch(`/api/admin/user-scopes/${id}`, { method: 'DELETE' });
    if (!res.ok) {
      const err = await res.json();
      toast.error(err.error ?? 'Revoke failed');
      return;
    }
    setDeleteId(null);
    load();
  };

  const scopeHint = useMemo(() => SCOPE_TYPES.find((s) => s.value === scopeType)?.hint ?? '', [scopeType]);

  const columns: Column<ScopeRow>[] = [
    { key: 'user', label: 'User', render: (r) => r.user?.email ?? `User #${r.userId}` },
    { key: 'role', label: 'Role', render: (r) => r.user?.role?.name ?? '—' },
    {
      key: 'scopeType',
      label: 'Scope',
      render: (r) => (
        <StatusBadge tone={r.scopeType === 'COMPANY' || r.scopeType === 'GLOBAL' ? 'accent' : 'info'}>{r.scopeType.replace('_', ' ')}</StatusBadge>
      ),
    },
    {
      key: 'values',
      label: 'Values',
      render: (r) =>
        r.scopeType === 'REPORTING_TREE' ? `Depth: ${r.treeDepth ?? 'DIRECT'}` : r.scopeValues.length ? r.scopeValues.join(', ') : '—',
    },
    {
      key: 'actions',
      label: '',
      render: (r) => (
        <button
          type="button"
          onClick={() => setDeleteId(r.id)}
          className="rounded-md border px-2.5 py-1 text-xs font-medium transition hover:opacity-80"
          style={{ borderColor: 'var(--danger)', color: 'var(--danger)' }}
        >
          Revoke
        </button>
      ),
    },
  ];

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-semibold" style={{ color: 'var(--foreground)' }}>
          User Scopes
        </h1>
        <p className="text-sm" style={{ color: 'var(--foreground-muted)' }}>
          Access = role (what actions) × data scope (whose records). A user with no scope sees only their own record.
        </p>
      </div>

      <div className="card space-y-4 p-5">
        <h2 className="text-base font-semibold" style={{ color: 'var(--foreground)' }}>
          Assign a scope
        </h2>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4">
          <label className="block text-sm" style={{ color: 'var(--foreground)' }}>
            User
            <select value={userId} onChange={(e) => setUserId(e.target.value)} className="mt-1 w-full rounded-lg border px-3 py-2 text-sm" style={inputStyle}>
              <option value="">Select a user…</option>
              {users.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.email}
                  {u.role ? ` — ${u.role.name}` : ''}
                </option>
              ))}
            </select>
          </label>
          <label className="block text-sm" style={{ color: 'var(--foreground)' }}>
            Scope type
            <select value={scopeType} onChange={(e) => setScopeType(e.target.value as ScopeType)} className="mt-1 w-full rounded-lg border px-3 py-2 text-sm" style={inputStyle}>
              {SCOPE_TYPES.map((s) => (
                <option key={s.value} value={s.value}>
                  {s.label}
                </option>
              ))}
            </select>
            <span className="mt-1 block text-xs" style={{ color: 'var(--foreground-muted)' }}>
              {scopeHint}
            </span>
          </label>
          {NEEDS_VALUES.has(scopeType) && (
            <label className="block text-sm" style={{ color: 'var(--foreground)' }}>
              Values ({values.length} selected)
              <select
                multiple
                size={6}
                value={values}
                onChange={(e) => setValues(Array.from(e.target.selectedOptions).map((o) => o.value))}
                className="mt-1 w-full rounded-lg border px-3 py-2 text-sm"
                style={inputStyle}
              >
                {options.map((o) => (
                  <option key={o.code} value={o.code}>
                    {o.label}
                  </option>
                ))}
              </select>
              <span className="mt-1 block text-xs" style={{ color: 'var(--foreground-muted)' }}>
                Hold Ctrl / Cmd to pick several
              </span>
            </label>
          )}
          {scopeType === 'REPORTING_TREE' && (
            <label className="block text-sm" style={{ color: 'var(--foreground)' }}>
              Tree depth
              <select value={treeDepth} onChange={(e) => setTreeDepth(e.target.value as 'DIRECT' | 'ALL')} className="mt-1 w-full rounded-lg border px-3 py-2 text-sm" style={inputStyle}>
                <option value="DIRECT">DIRECT — direct reportees only</option>
                <option value="ALL">ALL — whole downward tree</option>
              </select>
              <span className="mt-1 block text-xs" style={{ color: 'var(--foreground-muted)' }}>
                Resolved from the user&apos;s linked employee record
              </span>
            </label>
          )}
        </div>
        <div className="flex justify-end">
          <button
            type="button"
            onClick={handleAssign}
            disabled={saving || !userId || (NEEDS_VALUES.has(scopeType) && values.length === 0)}
            className="rounded-lg px-4 py-2 text-sm font-medium text-white transition hover:opacity-90 disabled:opacity-50"
            style={{ backgroundColor: 'var(--accent)' }}
          >
            {saving ? 'Assigning…' : 'Assign scope'}
          </button>
        </div>
      </div>

      <DataTable columns={columns} data={rows} loading={loading} emptyMessage="No scope assignments yet — every user sees only their own record." />

      <ConfirmDialog
        title="Revoke scope"
        message="Revoke this scope assignment? The user immediately stops seeing the employees it granted."
        isOpen={deleteId !== null}
        onConfirm={() => deleteId && handleRevoke(deleteId)}
        onClose={() => setDeleteId(null)}
        confirmLabel="Revoke"
      />
    </div>
  );
}
