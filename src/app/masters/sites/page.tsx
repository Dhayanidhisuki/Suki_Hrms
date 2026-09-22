/**
 * Site Master (KUN BRD review, 2026-09-10) — the physical location an
 * employee reports to. Kept separate from Unit (the legal/org entity,
 * relabelled "Branch / Unit"), per the client's own wording. Pattern B:
 * simple master + FK (companyId), mirrors masters/units/page.tsx.
 */

'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { DataTable, FormModal, ConfirmDialog, useToast, type Column, type FieldDef, type FieldOption, StatusPillTabs } from '@/components/ui';
import MasterGroupTabs from '@/components/masters/MasterGroupTabs';

interface AuthMe {
  userId: number;
  email: string;
  isSuperAdmin: boolean;
  roleId: number | null;
  roleCode: string | null;
  companyId: number | null;
  companyName: string | null;
  hasAdminAccess: boolean;
}

interface Site {
  id: number;
  code: string;
  name: string;
  address: string | null;
  city: string | null;
  state: string | null;
  pinCode: string | null;
  companyId: number;
  isActive: boolean;
  deletedAt: string | null;
  company: { id: number; name: string } | null;
}

interface ApiResponse {
  data: Site[];
  pagination: { page: number; limit: number; total: number; totalPages: number };
}

interface Unit {
  id: number;
  code: string;
  name: string;
  address: string | null;
  state: string | null;
  companyId: number;
}

export default function SitesPage() {
  const toast = useToast();
  const [records, setRecords] = useState<Site[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  // Server-side: the list is paginated, so a client-side filter would only
  // hide rows on the current page and misreport the total.
  const [status, setStatus] = useState<'' | 'active' | 'inactive'>('');
  const [page, setPage] = useState(1);
  const [pagination, setPagination] = useState({ page: 1, limit: 20, total: 0, totalPages: 0 });
  const [modalOpen, setModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [initialValues, setInitialValues] = useState<Record<string, string | number | boolean | undefined>>({});
  const [deleteId, setDeleteId] = useState<number | null>(null);
  const [companyOptions, setCompanyOptions] = useState<FieldOption[]>([]);
  const [unitOptions, setUnitOptions] = useState<FieldOption[]>([]);
  const [auth, setAuth] = useState<AuthMe | null>(null);

  useEffect(() => {
    fetch('/api/auth/me')
      .then(async (r) => (r.ok ? r.json() : null))
      .then((me: AuthMe | null) => {
        if (!me) return;
        setAuth(me);
        if (me.isSuperAdmin) {
          fetch('/api/masters/companies?limit=100')
            .then(async (r) => (r.ok ? r.json() : { data: [] }))
            .then((json: { data: { id: number; name: string }[] }) =>
              setCompanyOptions(json.data.map((c) => ({ label: c.name, value: c.id })))
            );
          fetch('/api/masters/units?limit=500')
            .then(async (r) => (r.ok ? r.json() : { data: [] }))
            .then((json: { data: Unit[] }) => setUnitOptions(json.data.map((u) => ({ label: u.name, value: u.name }))));
        } else if (me.companyId) {
          setCompanyOptions([{ label: me.companyName ?? `Company #${me.companyId}`, value: me.companyId }]);
          fetch('/api/masters/units?limit=500')
            .then(async (r) => (r.ok ? r.json() : { data: [] }))
            .then((json: { data: Unit[] }) =>
              setUnitOptions(json.data.filter((u) => u.companyId === me.companyId).map((u) => ({ label: u.name, value: u.name })))
            );
        }
      });
  }, []);

  const fields: FieldDef[] = useMemo(() => {
    const list: FieldDef[] = [];
    // Company is pre-filled for company admins; superadmins can choose.
    if (auth?.isSuperAdmin) {
      list.push({ name: 'companyId', label: 'Company', type: 'select', required: true, options: companyOptions });
    }
    if (editingId) {
      list.push({ name: 'code', label: 'Site Code', type: 'text', disabled: true, helpText: 'Generated automatically' });
    }
    list.push(
      editingId
        ? { name: 'name', label: 'Name', type: 'text', required: true, placeholder: 'e.g. Chennai — Block A' }
        : { name: 'name', label: 'Name', type: 'select', required: true, options: unitOptions, helpText: 'Select from the Branch / Unit list' },
      { name: 'address', label: 'Address', type: 'textarea', placeholder: 'Optional' },
      { name: 'city', label: 'City', type: 'text', placeholder: 'Optional' },
      { name: 'state', label: 'State', type: 'text', placeholder: 'Optional' },
      { name: 'pinCode', label: 'PIN Code', type: 'text', placeholder: 'Optional' },
      { name: 'isActive', label: 'Active', type: 'checkbox', defaultValue: true }
    );
    return list;
  }, [auth, companyOptions, unitOptions, editingId]);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        page: String(page),
        limit: '20',
        ...(search ? { search } : {}),
        ...(status ? { status } : {}),
      });
      const res = await fetch(`/api/masters/sites?${params}`);
      if (!res.ok) throw new Error('Failed to fetch');
      const json: ApiResponse = await res.json();
      setRecords(json.data);
      setPagination(json.pagination);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  }, [page, search, status, toast]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleAdd = () => {
    setEditingId(null);
    const defaults: Record<string, string | number | boolean | undefined> = { isActive: true };
    if (!auth?.isSuperAdmin && auth?.companyId) {
      defaults.companyId = auth.companyId;
    }
    setInitialValues(defaults);
    setModalOpen(true);
  };

  const handleEdit = (row: Site) => {
    setEditingId(row.id);
    setInitialValues({
      code: row.code,
      name: row.name,
      address: row.address ?? '',
      city: row.city ?? '',
      state: row.state ?? '',
      pinCode: row.pinCode ?? '',
      companyId: row.companyId,
      isActive: row.isActive,
    });
    setModalOpen(true);
  };

  const handleSubmit = async (values: Record<string, string | number | boolean>) => {
    const payload: Record<string, string | number | boolean | null> = {
      ...values,
      address: values.address || null,
      city: values.city || null,
      state: values.state || null,
      pinCode: values.pinCode || null,
    };
    if (!auth?.isSuperAdmin && auth?.companyId) {
      payload.companyId = auth.companyId;
    }
    const url = editingId ? `/api/masters/sites/${editingId}` : '/api/masters/sites';
    const method = editingId ? 'PUT' : 'POST';
    const res = await fetch(url, { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error ?? 'Save failed');
    }
    fetchData();
  };

  const handleDelete = async (id: number) => {
    const res = await fetch(`/api/masters/sites/${id}`, { method: 'DELETE' });
    if (!res.ok) {
      const err = await res.json();
      toast.error(err.error ?? 'Delete failed');
      return;
    }
    fetchData();
  };

  const columns: Column<Site>[] = [
    { key: 'code', label: 'Site Code', sortable: true, className: 'font-medium' },
    { key: 'name', label: 'Name' },
    { key: 'company', label: 'Company', render: (row) => row.company?.name ?? '—' },
    {
      key: 'location',
      label: 'Location',
      render: (row) => [row.city, row.state].filter(Boolean).join(', ') || '—',
    },
    {
      key: 'isActive',
      label: 'Status',
      render: (row) => (
        <span
          className="px-2 py-0.5 text-xs font-medium rounded-full"
          style={{ backgroundColor: row.isActive ? '#dcfce7' : '#fee2e2', color: row.isActive ? '#166534' : '#991b1b' }}
        >
          {row.isActive ? 'Active' : 'Inactive'}
        </span>
      ),
    },
  ];

  return (
    <div className="space-y-4">
      <MasterGroupTabs groupLabel="Organization" />
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold" style={{ color: 'var(--foreground)' }}>
            Site Master
          </h1>
          <p className="text-sm" style={{ color: 'var(--foreground-muted)' }}>
            Physical locations. Distinct from Branch / Unit (the legal/organisational entity).
          </p>
        </div>
        <button
          onClick={handleAdd}
          className="rounded-lg px-4 py-2 text-sm font-medium text-white transition hover:opacity-90"
          style={{ backgroundColor: 'var(--accent)' }}
        >
          + Add Site
        </button>
      </div>

      <div className="flex flex-wrap items-center gap-2">

        <StatusPillTabs

          items={[

            { value: '', label: 'All' },

            { value: 'active', label: 'Active', tone: 'success' },

            { value: 'inactive', label: 'Inactive', tone: 'neutral' },

          ]}

          value={status}

          onChange={(v) => { setStatus(v as '' | 'active' | 'inactive'); setPage(1); }}

          idPrefix="sites-status"

        />

      </div>


      <DataTable
        columns={columns}
        data={records}
        pagination={pagination}
        loading={loading}
        searchValue={search}
        onSearchChange={(v) => {
          setSearch(v);
          setPage(1);
        }}
        onPageChange={setPage}
        onEdit={handleEdit}
        onDelete={(row) => setDeleteId(row.id)}
      />

      <FormModal
        title={editingId ? 'Edit Site' : 'Add Site'}
        fields={fields}
        initialValues={initialValues}
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        onSubmit={handleSubmit}
        submitLabel={editingId ? 'Update' : 'Create'}
      />

      <ConfirmDialog
        title="Delete Site"
        message="Are you sure you want to soft-delete this site? It will be marked inactive and hidden from lists."
        isOpen={deleteId !== null}
        onConfirm={() => deleteId && handleDelete(deleteId)}
        onClose={() => setDeleteId(null)}
      />
    </div>
  );
}
