/**
 * Benefit Rates — per-Employee-Type monthly amount for Canteen Deduction /
 * Petrol Allowance (or any other component an admin wants to rate this
 * way). Pattern B: simple master + 2 FKs (salaryComponentId, employeeTypeId)
 * + companyId, mirrors units/page.tsx. Applied to a payroll run via the
 * "Apply Canteen/Petrol" action on Salary Processing.
 */

'use client';

import { useState, useEffect, useCallback } from 'react';
import { DataTable, FormModal, ConfirmDialog, type Column, type FieldDef, type FieldOption } from '@/components/ui';

interface BenefitRate {
  id: number;
  companyId: number;
  salaryComponentId: number;
  employeeTypeId: number;
  amount: number;
  isActive: boolean;
  company: { id: number; name: string } | null;
  salaryComponent: { id: number; code: string; name: string } | null;
  employeeType: { id: number; name: string } | null;
}

interface ApiResponse {
  data: BenefitRate[];
  pagination: { page: number; limit: number; total: number; totalPages: number };
}

export default function BenefitRatesPage() {
  const [records, setRecords] = useState<BenefitRate[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [pagination, setPagination] = useState({ page: 1, limit: 20, total: 0, totalPages: 0 });
  const [modalOpen, setModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [initialValues, setInitialValues] = useState<Record<string, string | number | boolean | undefined>>({});
  const [deleteId, setDeleteId] = useState<number | null>(null);
  const [companyOptions, setCompanyOptions] = useState<FieldOption[]>([]);
  const [componentOptions, setComponentOptions] = useState<FieldOption[]>([]);
  const [employeeTypeOptions, setEmployeeTypeOptions] = useState<FieldOption[]>([]);

  useEffect(() => {
    fetch('/api/masters/companies?limit=100')
      .then((r) => r.json())
      .then((json: { data: { id: number; name: string }[] }) => setCompanyOptions(json.data.map((c) => ({ label: c.name, value: c.id }))));
    fetch('/api/masters/salary-components?limit=500')
      .then((r) => r.json())
      .then((json: { data: { id: number; code: string; name: string; type: string }[] }) =>
        setComponentOptions(json.data.filter((c) => c.type === 'earning' || c.type === 'deduction').map((c) => ({ label: `${c.name} (${c.code})`, value: c.id })))
      );
    fetch('/api/masters/employee-types?limit=100')
      .then((r) => r.json())
      .then((json: { data: { id: number; name: string }[] }) => setEmployeeTypeOptions(json.data.map((t) => ({ label: t.name, value: t.id }))));
  }, []);

  const fields: FieldDef[] = [
    { name: 'companyId', label: 'Company', type: 'select', required: true, options: companyOptions },
    { name: 'employeeTypeId', label: 'Employee Type', type: 'select', required: true, options: employeeTypeOptions },
    { name: 'salaryComponentId', label: 'Benefit Component', type: 'select', required: true, options: componentOptions },
    { name: 'amount', label: 'Monthly Amount', type: 'number', required: true },
    { name: 'isActive', label: 'Active', type: 'checkbox', defaultValue: true },
  ];

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({ page: String(page), limit: '20' });
      const res = await fetch(`/api/masters/benefit-rates?${params}`);
      if (!res.ok) throw new Error('Failed to fetch');
      const json: ApiResponse = await res.json();
      setRecords(json.data);
      setPagination(json.pagination);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  }, [page]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleAdd = () => {
    setEditingId(null);
    setInitialValues({ isActive: true });
    setModalOpen(true);
  };

  const handleEdit = (row: BenefitRate) => {
    setEditingId(row.id);
    setInitialValues({
      companyId: row.companyId,
      employeeTypeId: row.employeeTypeId,
      salaryComponentId: row.salaryComponentId,
      amount: row.amount,
      isActive: row.isActive,
    });
    setModalOpen(true);
  };

  const handleSubmit = async (values: Record<string, string | number | boolean>) => {
    const url = editingId ? `/api/masters/benefit-rates/${editingId}` : '/api/masters/benefit-rates';
    const method = editingId ? 'PUT' : 'POST';
    const res = await fetch(url, { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(values) });
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error ?? 'Save failed');
    }
    fetchData();
  };

  const handleDelete = async (id: number) => {
    const res = await fetch(`/api/masters/benefit-rates/${id}`, { method: 'DELETE' });
    if (!res.ok) {
      const err = await res.json();
      setError(err.error ?? 'Delete failed');
      return;
    }
    fetchData();
  };

  const columns: Column<BenefitRate>[] = [
    { key: 'company', label: 'Company', render: (row) => row.company?.name ?? '—' },
    { key: 'employeeType', label: 'Employee Type', render: (row) => row.employeeType?.name ?? '—' },
    { key: 'salaryComponent', label: 'Benefit', render: (row) => row.salaryComponent?.name ?? '—' },
    { key: 'amount', label: 'Monthly Amount', render: (row) => Number(row.amount).toFixed(2) },
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
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold" style={{ color: 'var(--foreground)' }}>
            Benefit Rates
          </h1>
          <p className="text-sm" style={{ color: 'var(--foreground-muted)' }}>
            Monthly Canteen Deduction / Petrol Allowance amount per Employee Type — applied to payroll via Salary
            Processing&apos;s &ldquo;Apply Canteen/Petrol&rdquo; action.
          </p>
        </div>
        <button
          onClick={handleAdd}
          className="rounded-lg px-4 py-2 text-sm font-medium text-white transition hover:opacity-90"
          style={{ backgroundColor: 'var(--accent)' }}
        >
          + Add Rate
        </button>
      </div>

      {error && (
        <div className="rounded-lg px-3 py-2 text-sm" style={{ backgroundColor: '#fef2f2', color: '#dc2626', border: '1px solid #fecaca' }}>
          {error}
        </div>
      )}

      <DataTable columns={columns} data={records} pagination={pagination} loading={loading} onPageChange={setPage} onEdit={handleEdit} onDelete={(row) => setDeleteId(row.id)} />

      <FormModal
        title={editingId ? 'Edit Benefit Rate' : 'Add Benefit Rate'}
        fields={fields}
        initialValues={initialValues}
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        onSubmit={handleSubmit}
        submitLabel={editingId ? 'Update' : 'Create'}
      />

      <ConfirmDialog
        title="Delete Benefit Rate"
        message="Are you sure you want to delete this rate?"
        isOpen={deleteId !== null}
        onConfirm={() => deleteId && handleDelete(deleteId)}
        onClose={() => setDeleteId(null)}
      />
    </div>
  );
}
