'use client';

import { useState, useEffect, useCallback } from 'react';
import { DataTable, FormModal, ConfirmDialog, KPICard, KPIGrid } from '@/components/ui';
import { useModuleStats } from '@/hooks/useModuleStats';
import type { Column, FieldDef } from '@/components/ui';

interface SkillLevel {
  id: number;
  levelNumber: number;
  name: string;
  description: string | null;
  color: string | null;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

interface ApiResponse {
  data: SkillLevel[];
  pagination: { page: number; limit: number; total: number; totalPages: number };
}

const fields: FieldDef[] = [
  { name: 'levelNumber', label: 'Level Number', type: 'number', required: true, helpText: 'e.g. 1 for Awareness, 5 for Expert' },
  { name: 'name', label: 'Name', type: 'text', required: true, placeholder: 'e.g. Beginner' },
  { name: 'description', label: 'Description', type: 'textarea', placeholder: 'Optional description of this level' },
  { name: 'color', label: 'Color (hex)', type: 'text', placeholder: 'e.g. #22c55e' },
  { name: 'isActive', label: 'Active', type: 'checkbox', defaultValue: true },
];

export default function SkillLevelsPage() {
  const [records, setRecords] = useState<SkillLevel[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [pagination, setPagination] = useState({ page: 1, limit: 20, total: 0, totalPages: 0 });

  const { stats } = useModuleStats('skill-levels');

  const [modalOpen, setModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [initialValues, setInitialValues] = useState<Record<string, string | number | boolean | undefined>>({});
  const [deleteId, setDeleteId] = useState<number | null>(null);

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({ page: String(page), limit: '20', ...(search ? { search } : {}) });
      const res = await fetch(`/api/skill-levels?${params}`);
      if (!res.ok) throw new Error('Failed to fetch');
      const json: ApiResponse = await res.json();
      setRecords(json.data);
      setPagination(json.pagination);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  }, [page, search]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleAdd = () => {
    setEditingId(null);
    setInitialValues({ levelNumber: 1, isActive: true });
    setModalOpen(true);
  };

  const handleEdit = (row: SkillLevel) => {
    setEditingId(row.id);
    setInitialValues({
      levelNumber: row.levelNumber,
      name: row.name,
      description: row.description ?? '',
      color: row.color ?? '',
      isActive: row.isActive,
    });
    setModalOpen(true);
  };

  const handleSubmit = async (values: Record<string, string | number | boolean>) => {
    const payload = {
      ...values,
      description: values.description || null,
      color: values.color || null,
      levelNumber: Number(values.levelNumber),
    };

    const url = editingId ? `/api/skill-levels/${editingId}` : '/api/skill-levels';
    const method = editingId ? 'PUT' : 'POST';

    const res = await fetch(url, {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });

    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error ?? 'Save failed');
    }

    fetchData();
  };

  const handleDelete = async (id: number) => {
    const res = await fetch(`/api/skill-levels/${id}`, { method: 'DELETE' });
    if (!res.ok) {
      const err = await res.json();
      setError(err.error ?? 'Delete failed');
      return;
    }
    fetchData();
  };

  const columns: Column<SkillLevel>[] = [
    { key: 'levelNumber', label: 'Level', sortable: true, className: 'font-medium' },
    { key: 'name', label: 'Name', sortable: true },
    { key: 'description', label: 'Description', render: (row) => row.description ?? '—' },
    {
      key: 'color',
      label: 'Color',
      render: (row) =>
        row.color ? (
          <span
            className="inline-block h-5 w-5 rounded border"
            style={{ backgroundColor: row.color, borderColor: 'var(--border)' }}
            title={row.color}
          />
        ) : (
          '—'
        ),
    },
    {
      key: 'isActive',
      label: 'Status',
      render: (row) => (
        <span
          className="rounded-full px-2 py-0.5 text-xs font-medium"
          style={{
            backgroundColor: row.isActive ? '#dcfce7' : '#fee2e2',
            color: row.isActive ? '#166534' : '#991b1b',
          }}
        >
          {row.isActive ? 'Active' : 'Inactive'}
        </span>
      ),
    },
  ];

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold" style={{ color: 'var(--foreground)' }}>
          Skill Levels
        </h1>
        <button
          onClick={handleAdd}
          className="rounded-lg px-4 py-2 text-sm font-medium text-white transition hover:opacity-90"
          style={{ backgroundColor: 'var(--accent)' }}
        >
          + Add Skill Level
        </button>
      </div>

      <KPIGrid columns={3}>
        <KPICard label="Total Levels" value={stats.total} tone="info" />
        <KPICard label="Active" value={stats.active ?? 0} tone="success" />
        <KPICard label="Inactive" value={stats.inactive ?? 0} tone="danger" />
      </KPIGrid>

      {error && (
        <div
          className="rounded-lg px-3 py-2 text-sm"
          style={{ backgroundColor: '#fef2f2', color: '#dc2626', border: '1px solid #fecaca' }}
        >
          {error}
        </div>
      )}

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
        searchPlaceholder="Search by name..."
      />

      <FormModal
        title={editingId ? 'Edit Skill Level' : 'Add Skill Level'}
        fields={fields}
        initialValues={initialValues}
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        onSubmit={handleSubmit}
        submitLabel={editingId ? 'Update' : 'Create'}
      />

      <ConfirmDialog
        title="Delete Skill Level"
        message="Are you sure you want to soft-delete this skill level?"
        isOpen={deleteId !== null}
        onConfirm={() => deleteId && handleDelete(deleteId)}
        onClose={() => setDeleteId(null)}
      />
    </div>
  );
}
