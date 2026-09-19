'use client';

import { useState, useEffect, useCallback } from 'react';
import { DataTable, FormModal, ConfirmDialog, useToast, type Column, type FieldDef, type FieldOption } from '@/components/ui';

interface OTPlan {
  id: number; code: string; name: string; otRateMultiplier: number;
  otCalculationBasis: string | null;
  applicableAfterMinutes: number; maxOtHoursPerDay: number | null;
  payComponentId: number | null;
  payComponent: { id: number; name: string } | null;
  weekdayFactor: number;
  weeklyOffFactor: number;
  holidayFactor: number;
  maxOtHoursPerWeek: number | null;
  maxOtHoursPerMonth: number | null;
  weeklyOffSettlement: string;
  description: string | null; isActive: boolean; deletedAt: string | null;
}

interface ApiResponse { data: OTPlan[]; pagination: { page: number; limit: number; total: number; totalPages: number }; }

export default function OTPlansPage() {
  const toast = useToast();
  const [records, setRecords] = useState<OTPlan[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [pagination, setPagination] = useState({ page: 1, limit: 20, total: 0, totalPages: 0 });
  const [modalOpen, setModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [initialValues, setInitialValues] = useState<Record<string, string | number | boolean | undefined>>({});
  const [deleteId, setDeleteId] = useState<number | null>(null);
  const [componentOptions, setComponentOptions] = useState<FieldOption[]>([]);

  useEffect(() => {
    fetch('/api/masters/salary-components?type=earning')
      .then((r) => (r.ok ? r.json() : { data: [] }))
      .then((json: { data: { id: number; name: string }[] }) => setComponentOptions(json.data.map((c) => ({ label: c.name, value: c.id }))))
      .catch(() => {});
  }, []);

  const fields: FieldDef[] = [
    { name: 'code', label: 'Code', type: 'text', required: true, placeholder: 'e.g. OT-1.5x' },
    { name: 'name', label: 'Name', type: 'text', required: true, placeholder: 'e.g. Overtime 1.5x' },
    { name: 'otRateMultiplier', label: 'OT Rate Multiplier', type: 'number', required: true, step: '0.01', min: 0, helpText: 'e.g. 1.50, 2.00' },
    { name: 'otCalculationBasis', label: 'Calculation Basis', type: 'select', defaultValue: 'GROSS', options: [
      { label: 'Gross Salary', value: 'GROSS' },
      { label: 'Basic', value: 'BASIC' },
      { label: 'Basic + DA', value: 'BASIC_DA' },
      { label: 'Basic + DA + HRA', value: 'BASIC_DA_HRA' },
      { label: 'Fixed Rate', value: 'FIXED' },
    ], helpText: 'Basis for OT hourly rate calculation' },
    { name: 'applicableAfterMinutes', label: 'Applicable After (min)', type: 'number', defaultValue: 0, min: 0 },
    { name: 'maxOtHoursPerDay', label: 'Max OT Hours/Day', type: 'number', min: 0, helpText: 'Leave blank for no cap' },
    { name: 'payComponentId', label: 'Pay Component', type: 'select', options: componentOptions, helpText: 'The salary component the calculated OT amount is credited to on the payslip.' },
    { name: 'weekdayFactor', label: 'Weekday Factor', type: 'number', defaultValue: 1, step: '0.01', min: 0, helpText: 'Multiplier for OT on normal working days (1 = same as base)' },
    { name: 'weeklyOffFactor', label: 'Weekly-Off Factor', type: 'number', defaultValue: 1.5, step: '0.01', min: 0, helpText: 'Multiplier for OT on weekly off (e.g. Sunday)' },
    { name: 'holidayFactor', label: 'Holiday Factor', type: 'number', defaultValue: 2, step: '0.01', min: 0, helpText: 'Multiplier for OT on holidays' },
    { name: 'maxOtHoursPerWeek', label: 'Max OT Hours/Week', type: 'number', min: 0, helpText: 'Leave blank for no weekly cap' },
    { name: 'maxOtHoursPerMonth', label: 'Max OT Hours/Month', type: 'number', min: 0, helpText: 'Leave blank for no monthly cap' },
    { name: 'weeklyOffSettlement', label: 'Weekly-Off Settlement', type: 'select', defaultValue: 'PAYMENT', options: [
      { label: 'Payment', value: 'PAYMENT' },
      { label: 'Comp-Off', value: 'COMP_OFF' },
      { label: 'Employee Choice', value: 'CHOICE' },
    ], helpText: 'How OT on weekly-off/holiday is settled' },
    { name: 'description', label: 'Description', type: 'textarea', placeholder: 'Optional' },
    { name: 'isActive', label: 'Active', type: 'checkbox', defaultValue: true },
  ];

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ page: String(page), limit: '20', ...(search ? { search } : {}) });
      const res = await fetch(`/api/masters/ot-plans?${params}`);
      if (!res.ok) throw new Error('Failed to fetch');
      const json: ApiResponse = await res.json();
      setRecords(json.data); setPagination(json.pagination);
    } catch (err) { toast.error(err instanceof Error ? err.message : 'Unknown error'); }
    finally { setLoading(false); }
  }, [page, search, toast]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const handleAdd = () => { setEditingId(null); setInitialValues({ isActive: true, applicableAfterMinutes: 0 }); setModalOpen(true); };
  const handleEdit = (row: OTPlan) => {
    setEditingId(row.id);
    setInitialValues({
      code: row.code,
      name: row.name,
      otRateMultiplier: row.otRateMultiplier,
      otCalculationBasis: row.otCalculationBasis ?? 'GROSS',
      applicableAfterMinutes: row.applicableAfterMinutes,
      maxOtHoursPerDay: row.maxOtHoursPerDay ?? '',
      payComponentId: row.payComponentId ?? '',
      weekdayFactor: row.weekdayFactor,
      weeklyOffFactor: row.weeklyOffFactor,
      holidayFactor: row.holidayFactor,
      maxOtHoursPerWeek: row.maxOtHoursPerWeek ?? '',
      maxOtHoursPerMonth: row.maxOtHoursPerMonth ?? '',
      weeklyOffSettlement: row.weeklyOffSettlement,
      description: row.description ?? '',
      isActive: row.isActive,
    });
    setModalOpen(true);
  };

  const handleSubmit = async (values: Record<string, string | number | boolean>) => {
    const payload = {
      ...values,
      description: values.description || null,
      maxOtHoursPerDay: values.maxOtHoursPerDay || null,
      maxOtHoursPerWeek: values.maxOtHoursPerWeek || null,
      maxOtHoursPerMonth: values.maxOtHoursPerMonth || null,
      payComponentId: values.payComponentId || null,
    };
    const url = editingId ? `/api/masters/ot-plans/${editingId}` : '/api/masters/ot-plans';
    const method = editingId ? 'PUT' : 'POST';
    const res = await fetch(url, { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
    if (!res.ok) { const err = await res.json(); throw new Error(err.error ?? 'Save failed'); }
    fetchData();
  };

  const handleDelete = async (id: number) => {
    const res = await fetch(`/api/masters/ot-plans/${id}`, { method: 'DELETE' });
    if (!res.ok) { const err = await res.json(); toast.error(err.error ?? 'Delete failed'); return; }
    fetchData();
  };

  const columns: Column<OTPlan>[] = [
    { key: 'code', label: 'Code', sortable: true, className: 'font-medium' },
    { key: 'name', label: 'Name' },
    { key: 'otRateMultiplier', label: 'Rate Multiplier', render: (row) => `${row.otRateMultiplier}x` },
    { key: 'otCalculationBasis', label: 'Basis', render: (row) => row.otCalculationBasis ?? 'GROSS' },
    { key: 'applicableAfterMinutes', label: 'After (min)' },
    { key: 'maxOtHoursPerDay', label: 'Max hrs/day', render: (row) => row.maxOtHoursPerDay ?? 'No cap' },
    { key: 'payComponent', label: 'Pay Component', render: (row) => row.payComponent?.name ?? '—' },
    { key: 'description', label: 'Description', render: (row) => row.description ?? '—' },
    {
      key: 'isActive', label: 'Status',
      render: (row) => (
        <span className="px-2 py-0.5 text-xs font-medium rounded-full"
          style={{ backgroundColor: row.isActive ? '#dcfce7' : '#fee2e2', color: row.isActive ? '#166534' : '#991b1b' }}>
          {row.isActive ? 'Active' : 'Inactive'}
        </span>
      ),
    },
  ];

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold" style={{ color: 'var(--foreground)' }}>OT Plans</h1>
        <button onClick={handleAdd} className="rounded-lg px-4 py-2 text-sm font-medium text-white transition hover:opacity-90"
          style={{ backgroundColor: 'var(--accent)' }}>+ Add OT Plan</button>
      </div>
      <DataTable columns={columns} data={records} pagination={pagination} loading={loading}
        searchValue={search} onSearchChange={(v) => { setSearch(v); setPage(1); }} onPageChange={setPage}
        onEdit={handleEdit} onDelete={(row) => setDeleteId(row.id)} />
      <FormModal title={editingId ? 'Edit OT Plan' : 'Add OT Plan'} fields={fields}
        initialValues={initialValues} isOpen={modalOpen} onClose={() => setModalOpen(false)}
        onSubmit={handleSubmit} submitLabel={editingId ? 'Update' : 'Create'} />
      <ConfirmDialog title="Delete OT Plan" message="Are you sure you want to soft-delete this OT plan?"
        isOpen={deleteId !== null} onConfirm={() => deleteId && handleDelete(deleteId)} onClose={() => setDeleteId(null)} />
    </div>
  );
}
