/**
 * Salary Components — this company's own catalog (migration 000012 made
 * SalaryComponent company-scoped; previously one global list shared by
 * every company with no admin UI at all). Not built on SimpleMasterPage
 * (used by 9 other masters pages) since it needs a `type` selector and has
 * no `description` column — same DataTable/FormModal/ConfirmDialog shape,
 * hand-built. System-defined rows (BASIC/PF/ESI/ARREAR_GROSS/ARREAR_PF/
 * ARREAR_ESI/BONUS — the codes Payroll/Arrear/Bonus depend on) show a
 * badge and have no Edit/Delete.
 */

'use client';

import { useState, useEffect, useCallback } from 'react';
import { DataTable, FormModal, ConfirmDialog, type Column, type FieldDef, KPICard, KPIGrid, useToast } from '@/components/ui';
import { useModuleStats } from '@/hooks/useModuleStats';

interface SalaryComponentRow {
  id: number;
  code: string;
  name: string;
  type: string;
  includeInGratuity: boolean;
  includeInEsi: boolean;
  includeInPf: boolean;
  includeInGross: boolean;
  grossTier: string;
  fnfPayable: boolean;
  fnfProration: string;
  fnfTaxable: boolean;
  isSystemDefined: boolean;
  isActive: boolean;
  percentOfGross: number | null;
  deletedAt?: string | null;
}

const CODE_PREFIX: Record<string, string> = {
  earning: 'EARN',
  deduction: 'DED',
  employer_contribution: 'ECONT',
};

// Reserved codes that Payroll/PF/ESI/Bonus/Payslip/CTC logic looks up by
// exact code match throughout the app (e.g. code === 'BASIC') — matched by
// Name so re-adding "Basic Salary" after deleting the system-defined row
// (or setting up a fresh company) lands on the code everything else already
// depends on, instead of a generic EARN-N that silently breaks those lookups.
const RESERVED_CODE_BY_NAME: Record<string, string> = {
  'basic': 'BASIC',
  'basic salary': 'BASIC',
  'pf': 'PF',
  'esi': 'ESI',
  'esi allowance': 'ESI',
  'bonus': 'BONUS',
  'salary arrear': 'ARREAR_GROSS',
  'pf arrear': 'ARREAR_PF',
  'esi arrear': 'ARREAR_ESI',
  'ot incentive bonus': 'OT_INCENTIVE',
  'overtime incentive': 'OT_INCENTIVE',
};

function makeGenerateComponentCode(existing: SalaryComponentRow[]) {
  return (values: Record<string, string | number | boolean | undefined>): string => {
    const reserved = RESERVED_CODE_BY_NAME[String(values.name ?? '').trim().toLowerCase()];
    if (reserved) return reserved;
    const type = String(values.type ?? '');
    const prefix = CODE_PREFIX[type] ?? 'CMP';
    // Max existing suffix number for this type's prefix, not a plain count —
    // a count would reissue an already-used number (unique-constraint clash)
    // once any component of that type has been deleted, since deleted rows
    // still occupy their code in the DB.
    const prefixPattern = new RegExp(`^${prefix}-(\\d+)$`);
    const maxSuffix = existing.reduce((max, r) => {
      const match = prefixPattern.exec(r.code);
      return match ? Math.max(max, Number(match[1])) : max;
    }, 0);
    return `${prefix}-${maxSuffix + 1}`;
  };
}

function buildFields(isEditing: boolean, existing: SalaryComponentRow[]): FieldDef[] {
  return [
  isEditing
    ? { name: 'code', label: 'Code', type: 'text', required: true, placeholder: 'e.g. SPL_ALLOW_2' }
    : { name: 'code', label: 'Code', type: 'text', required: true, hidden: true, compute: makeGenerateComponentCode(existing) },
  { name: 'name', label: 'Name', type: 'text', required: true, placeholder: 'e.g. Special Allowance' },
  {
    name: 'type',
    label: 'Type',
    type: 'select',
    required: true,
    options: [
      { label: 'Earning', value: 'earning' },
      { label: 'Deduction', value: 'deduction' },
      { label: 'Employer Contribution', value: 'employer_contribution' },
    ],
  },
  // Gratuity/ESI/PF are the actual wage-base flags payrollCalculation.ts and
  // gratuityCalculation.ts read to decide which components count toward each
  // statutory base — genuinely need to stay editable per component. NON_PAYROLL
  // still forces all three off server-side (normalizeSalaryComponentFlags)
  // regardless of what's checked here. Include in Gross stays hidden since
  // Gross Tier alone already decides it (true for FIXED/ADDITIONAL, forced
  // off for NON_PAYROLL) and there's no legitimate per-component override.
  { name: 'includeInGratuity', label: 'Include in Gratuity', type: 'checkbox', defaultValue: false },
  { name: 'includeInEsi', label: 'Include in ESI', type: 'checkbox', defaultValue: false, helpText: 'Counts toward the ESI eligible-wage base used by payroll.' },
  { name: 'includeInPf', label: 'Include in PF', type: 'checkbox', defaultValue: false, helpText: 'Counts toward the PF eligible-wage base used by payroll.' },
  { name: 'includeInGross', label: 'Include in Gross', type: 'checkbox', defaultValue: true, hidden: true },
  { name: 'fnfPayable', label: 'Include in F&F', type: 'checkbox', defaultValue: true, helpText: 'When off, this earning is skipped on Full & Final salary lines.' },
  {
    name: 'fnfProration',
    label: 'F&F proration',
    type: 'select',
    defaultValue: 'PRO_RATA',
    options: [
      { label: 'Pro-rata by payable days', value: 'PRO_RATA' },
      { label: 'Full month', value: 'FULL' },
      { label: 'Exclude', value: 'EXCLUDE' },
    ],
  },
  { name: 'fnfTaxable', label: 'F&F taxable', type: 'checkbox', defaultValue: true },
  {
    name: 'grossTier',
    label: 'Gross Tier',
    type: 'select',
    defaultValue: 'ADDITIONAL',
    options: [
      { label: 'Fixed', value: 'FIXED' },
      { label: 'Additional', value: 'ADDITIONAL' },
      { label: 'Non-Payroll', value: 'NON_PAYROLL' },
      { label: 'Payroll-Hidden (deducted, hidden from Salary Details)', value: 'PAYROLL_HIDDEN' },
    ],
  },
  {
    name: 'percentOfGross',
    label: 'Percentage of Gross (%)',
    type: 'number',
    placeholder: 'e.g. 40',
    showIf: (v) => v.grossTier === 'FIXED',
    requiredIf: (v) => v.grossTier === 'FIXED',
  },
  { name: 'isActive', label: 'Active', type: 'checkbox', defaultValue: true, hidden: true },
  ];
}

export default function SalaryComponentsPage() {
  const toast = useToast();
  const [records, setRecords] = useState<SalaryComponentRow[]>([]);
  // Includes soft-deleted rows (unlike `records`, which drives the table) —
  // only used to seed the auto-code generator's max-suffix search, since a
  // deleted row's code still occupies the companyId+code unique constraint.
  const [allRowsIncludingDeleted, setAllRowsIncludingDeleted] = useState<SalaryComponentRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [initialValues, setInitialValues] = useState<Record<string, string | number | boolean | undefined>>({});
  const [deleteId, setDeleteId] = useState<number | null>(null);
  const [codeSortDir, setCodeSortDir] = useState<'asc' | 'desc'>('asc');

  const { stats } = useModuleStats('salary-components');

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/masters/salary-components?includeInactive=true&includeDeleted=true');
      if (!res.ok) throw new Error('Failed to fetch');
      const json: { data: SalaryComponentRow[] } = await res.json();
      setAllRowsIncludingDeleted(json.data);
      setRecords(json.data.filter((r) => !r.deletedAt));
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleAdd = () => {
    setEditingId(null);
    setInitialValues({ isActive: true, includeInGratuity: false, includeInEsi: false, includeInPf: false, includeInGross: true, grossTier: 'ADDITIONAL', fnfPayable: true, fnfProration: 'PRO_RATA', fnfTaxable: true });
    setModalOpen(true);
  };

  const handleEdit = (row: SalaryComponentRow) => {
    setEditingId(row.id);
    setInitialValues({
      code: row.code,
      name: row.name,
      type: row.type,
      includeInGratuity: row.includeInGratuity,
      includeInEsi: row.includeInEsi,
      includeInPf: row.includeInPf,
      includeInGross: row.includeInGross,
      grossTier: row.grossTier,
      fnfPayable: row.fnfPayable,
      fnfProration: row.fnfProration,
      fnfTaxable: row.fnfTaxable,
      isActive: row.isActive,
      percentOfGross: row.percentOfGross ?? undefined,
    });
    setModalOpen(true);
  };

  const handleSubmit = async (values: Record<string, string | number | boolean>) => {
    const url = editingId ? `/api/masters/salary-components/${editingId}` : '/api/masters/salary-components';
    const method = editingId ? 'PUT' : 'POST';
    const res = await fetch(url, { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(values) });
    if (!res.ok) {
      const err = await res.json().catch(() => null);
      throw new Error(err?.error ?? 'Save failed');
    }
    fetchData();
  };

  const handleDelete = async (id: number) => {
    const res = await fetch(`/api/masters/salary-components/${id}`, { method: 'DELETE' });
    if (!res.ok) {
      const err = await res.json();
      toast.error(err.error ?? 'Delete failed');
      return;
    }
    fetchData();
  };

  const setGrossTier = async (row: SalaryComponentRow, tier: 'FIXED' | 'ADDITIONAL' | 'NON_PAYROLL' | 'PAYROLL_HIDDEN') => {
    const res = await fetch(`/api/masters/salary-components/${row.id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        code: row.code,
        name: row.name,
        type: row.type,
        isActive: row.isActive,
        includeInGratuity: row.includeInGratuity,
        includeInEsi: row.includeInEsi,
        includeInPf: row.includeInPf,
        includeInGross: row.includeInGross,
        grossTier: tier,
        fnfPayable: row.fnfPayable,
        fnfProration: row.fnfProration,
        fnfTaxable: row.fnfTaxable,
      }),
    });
    if (!res.ok) {
      const err = await res.json();
      toast.error(err.error ?? 'Failed to update');
      return;
    }
    fetchData();
  };

  const setPercentOfGross = async (row: SalaryComponentRow, percent: string) => {
    const res = await fetch(`/api/masters/salary-components/${row.id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        code: row.code,
        name: row.name,
        type: row.type,
        isActive: row.isActive,
        includeInGratuity: row.includeInGratuity,
        includeInEsi: row.includeInEsi,
        includeInPf: row.includeInPf,
        includeInGross: row.includeInGross,
        grossTier: row.grossTier,
        percentOfGross: percent === '' ? null : Number(percent),
      }),
    });
    if (!res.ok) {
      const err = await res.json();
      toast.error(err.error ?? 'Failed to update');
      return;
    }
    fetchData();
  };

  const toggleActive = async (row: SalaryComponentRow) => {
    const res = await fetch(`/api/masters/salary-components/${row.id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        code: row.code,
        name: row.name,
        type: row.type,
        isActive: !row.isActive,
        includeInGratuity: row.includeInGratuity,
        includeInEsi: row.includeInEsi,
        includeInPf: row.includeInPf,
        includeInGross: row.includeInGross,
        grossTier: row.grossTier,
      }),
    });
    if (!res.ok) {
      const err = await res.json();
      toast.error(err.error ?? 'Failed to update');
      return;
    }
    fetchData();
  };

  const columns: Column<SalaryComponentRow>[] = [
    {
      key: 'code',
      label: (
        <button
          type="button"
          onClick={() => setCodeSortDir((d) => (d === 'asc' ? 'desc' : 'asc'))}
          className="inline-flex items-center gap-1 hover:opacity-70"
          title={`Sorted ${codeSortDir === 'asc' ? 'ascending' : 'descending'} — click to reverse`}
        >
          Code
          <span aria-hidden="true">{codeSortDir === 'asc' ? '↑' : '↓'}</span>
        </button>
      ),
      className: 'font-medium',
    },
    { key: 'name', label: 'Name' },
    { key: 'type', label: 'Type', render: (r) => r.type.replace('_', ' ') },
    {
      key: 'grossTier',
      label: 'Tier',
      render: (r) => (
        <select
          value={r.grossTier}
          onChange={(e) => setGrossTier(r, e.target.value as 'FIXED' | 'ADDITIONAL' | 'NON_PAYROLL' | 'PAYROLL_HIDDEN')}
          className="rounded border px-1 py-0.5 text-xs"
          style={{ borderColor: 'var(--border)', color: 'var(--foreground)', opacity: r.grossTier === 'NON_PAYROLL' || r.includeInGross ? 1 : 0.4 }}
          title={
            r.grossTier === 'NON_PAYROLL'
              ? 'Never touched by payroll'
              : r.grossTier === 'PAYROLL_HIDDEN'
              ? 'Deducted in real payroll, but hidden from the Salary Details tab'
              : undefined
          }
        >
          <option value="FIXED">Fixed</option>
          <option value="ADDITIONAL">Additional</option>
          <option value="NON_PAYROLL">Non-Payroll</option>
          <option value="PAYROLL_HIDDEN">Payroll-Hidden</option>
        </select>
      ),
    },
    {
      key: 'percentOfGross',
      label: '% of Gross',
      render: (r) =>
        r.type === 'earning' && r.grossTier === 'FIXED' ? (
          <input
            type="number"
            min={0}
            max={100}
            step="0.01"
            defaultValue={r.percentOfGross ?? ''}
            onBlur={(e) => {
              if (e.target.value !== String(r.percentOfGross ?? '')) setPercentOfGross(r, e.target.value);
            }}
            placeholder="—"
            className="w-16 rounded border px-1 py-0.5 text-xs"
            style={{ borderColor: 'var(--border)', color: 'var(--foreground)' }}
          />
        ) : (
          <span style={{ color: 'var(--foreground-muted)' }}>—</span>
        ),
    },
    {
      key: 'isSystemDefined',
      label: '',
      render: (r) =>
        r.isSystemDefined ? (
          <span className="rounded-full px-2 py-0.5 text-xs font-medium" style={{ backgroundColor: '#e0e7ff', color: '#3730a3' }}>
            System
          </span>
        ) : null,
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
    {
      key: 'actions',
      label: 'Actions',
      className: 'text-right',
      render: (r) =>
        r.isSystemDefined ? null : (
          <div className="flex items-center gap-3 justify-end">
            <button
              onClick={() => toggleActive(r)}
              title={r.isActive ? 'Deactivate' : 'Activate'}
              className="hover:opacity-70"
              style={{ color: r.isActive ? 'var(--accent)' : 'var(--foreground-muted)' }}
            >
              {r.isActive ? (
                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8Z" />
                  <circle cx="12" cy="12" r="3" />
                </svg>
              ) : (
                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M17.94 17.94A10.94 10.94 0 0 1 12 20c-7 0-11-8-11-8a18.7 18.7 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24" />
                  <line x1="1" y1="1" x2="23" y2="23" />
                </svg>
              )}
            </button>
            <button onClick={() => handleEdit(r)} className="text-xs font-medium hover:underline" style={{ color: 'var(--accent)' }}>
              Edit
            </button>
            <button onClick={() => setDeleteId(r.id)} className="text-xs font-medium hover:underline text-red-500">
              Delete
            </button>
          </div>
        ),
    },
  ];

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold" style={{ color: 'var(--foreground)' }}>
          Salary Components
        </h1>
        <button
          onClick={handleAdd}
          className="rounded-lg px-4 py-2 text-sm font-medium text-white transition hover:opacity-90"
          style={{ backgroundColor: 'var(--accent)' }}
        >
          + Add Component
        </button>
      </div>

      {/* KPI Cards */}
      <KPIGrid columns={2}>
        <KPICard label="Total Components" value={stats.total} tone="info" />
        <KPICard label="Active" value={stats.active ?? 0} tone="success" />
      </KPIGrid>

      <DataTable
        columns={columns}
        data={[...records].sort((a, b) => (codeSortDir === 'asc' ? a.code.localeCompare(b.code) : b.code.localeCompare(a.code)))}
        loading={loading}
        emptyMessage="No salary components yet."
      />

      <FormModal
        title={editingId ? 'Edit Salary Component' : 'Add Salary Component'}
        fields={buildFields(editingId !== null, allRowsIncludingDeleted)}
        initialValues={initialValues}
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        onSubmit={handleSubmit}
        submitLabel={editingId ? 'Update' : 'Create'}
      />

      <ConfirmDialog
        title="Delete Salary Component"
        message="Are you sure you want to soft-delete this component? It will be marked inactive and hidden from lists."
        isOpen={deleteId !== null}
        onConfirm={() => deleteId && handleDelete(deleteId)}
        onClose={() => setDeleteId(null)}
      />
    </div>
  );
}
