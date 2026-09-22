/**
 * Benefit Components — standalone monthly-amount per Employee Type.
 * Admin creates benefit components (e.g. Canteen Token, Petrol Allowance)
 * directly here; employees are enrolled on their profile or during creation.
 */

'use client';

import { useState, useEffect, useCallback } from 'react';
import { DataTable, FormModal, ConfirmDialog, useToast, type Column, type FieldDef, type FieldOption } from '@/components/ui';

interface BenefitComponent {
  id: number;
  companyId: number;
  code: string;
  name: string;
  employeeTypeId: number;
  salaryComponentId: number | null;
  amount: number;
  isActive: boolean;
  company: { id: number; name: string } | null;
  employeeType: { id: number; name: string } | null;
  salaryComponent: { id: number; code: string; name: string } | null;
  employeeCount?: number;
}

interface ApiResponse {
  data: BenefitComponent[];
  pagination: { page: number; limit: number; total: number; totalPages: number };
}

export default function BenefitRatesPage() {
  const toast = useToast();
  const [records, setRecords] = useState<BenefitComponent[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [pagination, setPagination] = useState({ page: 1, limit: 20, total: 0, totalPages: 0 });
  const [modalOpen, setModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [initialValues, setInitialValues] = useState<Record<string, string | number | boolean | undefined>>({});
  const [deleteId, setDeleteId] = useState<number | null>(null);
  const [companyOptions, setCompanyOptions] = useState<FieldOption[]>([]);
  const [employeeTypeOptions, setEmployeeTypeOptions] = useState<FieldOption[]>([]);
  const [salaryComponentOptions, setSalaryComponentOptions] = useState<FieldOption[]>([]);

  useEffect(() => {
    fetch('/api/masters/companies?limit=100')
      .then((r) => r.json())
      .then((json: { data: { id: number; name: string }[] }) => setCompanyOptions(json.data.map((c) => ({ label: c.name, value: c.id }))));
    fetch('/api/masters/employee-types?limit=100')
      .then((r) => r.json())
      .then((json: { data: { id: number; name: string }[] }) => setEmployeeTypeOptions(json.data.map((t) => ({ label: t.name, value: t.id }))));
    fetch('/api/masters/salary-components?limit=500')
      .then((r) => r.json())
      .then((json: { data: { id: number; code: string; name: string; type: string }[] }) =>
        setSalaryComponentOptions(json.data.filter((c) => c.type === 'earning' || c.type === 'deduction').map((c) => ({ label: `${c.name} (${c.code})`, value: c.id })))
      );
  }, []);

  const fields: FieldDef[] = [
    { name: 'companyId', label: 'Company', type: 'select', required: true, options: companyOptions },
    { name: 'code', label: 'Benefit Code', type: 'text', required: true, placeholder: 'e.g. CANTEEN' },
    { name: 'name', label: 'Benefit Name', type: 'text', required: true, placeholder: 'e.g. Canteen Token' },
    { name: 'employeeTypeId', label: 'Employee Type', type: 'select', required: true, options: employeeTypeOptions },
    { name: 'amount', label: 'Monthly Amount (₹)', type: 'number', required: true, step: '0.01', min: 0 },
    { name: 'salaryComponentId', label: 'Payroll Salary Component (optional)', type: 'select', options: salaryComponentOptions, helpText: 'Optional: links this benefit to a salary component for payroll processing' },
    { name: 'isActive', label: 'Active', type: 'checkbox', defaultValue: true },
  ];

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ page: String(page), limit: '20' });
      const res = await fetch(`/api/masters/benefit-rates?${params}`);
      if (!res.ok) throw new Error('Failed to fetch');
      const json: ApiResponse = await res.json();
      setRecords(json.data);
      setPagination(json.pagination);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  }, [page, toast]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleAdd = () => {
    setEditingId(null);
    setInitialValues({ isActive: true });
    setModalOpen(true);
  };

  const handleEdit = (row: BenefitComponent) => {
    setEditingId(row.id);
    setInitialValues({
      companyId: row.companyId,
      code: row.code,
      name: row.name,
      employeeTypeId: row.employeeTypeId,
      salaryComponentId: row.salaryComponentId ?? '',
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
      toast.error(err.error ?? 'Delete failed');
      return;
    }
    fetchData();
  };

  const columns: Column<BenefitComponent>[] = [
    { key: 'company', label: 'Company', render: (row) => row.company?.name ?? '—' },
    { key: 'code', label: 'Code', className: 'font-medium' },
    { key: 'name', label: 'Benefit Name' },
    { key: 'employeeType', label: 'Employee Type', render: (row) => row.employeeType?.name ?? '—' },
    { key: 'amount', label: 'Monthly Amount', render: (row) => Number(row.amount).toFixed(2) },
    {
      key: 'employeeCount',
      label: 'Employees',
      render: (row) => row.employeeCount ?? 0,
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
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold" style={{ color: 'var(--foreground)' }}>
            Benefit Components
          </h1>
          <p className="text-sm" style={{ color: 'var(--foreground-muted)' }}>
            Create benefit components (e.g. Canteen Token, Petrol Allowance) with a monthly amount per Employee Type.
            Employees are enrolled on their profile or during creation.
          </p>
        </div>
        <button
          onClick={handleAdd}
          className="rounded-lg px-4 py-2 text-sm font-medium text-white transition hover:opacity-90"
          style={{ backgroundColor: 'var(--accent)' }}
        >
          + Add Component
        </button>
      </div>

      <DataTable columns={columns} data={records} pagination={pagination} loading={loading} onPageChange={setPage} onEdit={handleEdit} onDelete={(row) => setDeleteId(row.id)} />

      <FormModal
        title={editingId ? 'Edit Benefit Component' : 'Add Benefit Component'}
        fields={fields}
        initialValues={initialValues}
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        onSubmit={handleSubmit}
        submitLabel={editingId ? 'Update' : 'Create'}
      />

      <ConfirmDialog
        title="Delete Benefit Component"
        message="Are you sure you want to delete this component?"
        isOpen={deleteId !== null}
        onConfirm={() => deleteId && handleDelete(deleteId)}
        onClose={() => setDeleteId(null)}
      />
    </div>
  );
}
