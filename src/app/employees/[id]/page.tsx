/**
 * Employee Profile — header + 15-tab shell.
 *
 * Phase 1 wires 4 tabs end-to-end (Basic, Personal, Contact, Job Profile)
 * with real lazy-loaded data and atomic per-tab saves. The remaining 11 tabs
 * render a "Coming in Phase 2" placeholder — present in the tab strip per
 * the spec's shell requirement, but not claiming to be functional yet.
 */

'use client';

import { useState, useEffect, useCallback, useMemo, useRef, type ReactNode } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { Field, DataTable, FormModal, ConfirmDialog, type FieldDef, type Column } from '@/components/ui';
import RepeatableListTab from '@/components/employees/RepeatableListTab';
import EmployeeAvatarUpload from '@/components/employees/EmployeeAvatarUpload';
import { SectionCard, DetailGrid, EditButton, SectionIcon } from '@/components/employees/SectionCard';
import { formatDate } from '@/lib/format-date';
import {
  buildBasicFields,
  buildPersonalFields,
  buildContactFields,
  buildJobProfileFields,
  buildEducationFields,
  buildExperienceFields,
  buildDependentFields,
  buildEmergencyContactFields,
  buildSkillFields,
  buildPassportFields,
  buildAssetFields,
  buildKycFields,
  buildCtcFields,
  fetchAllMaster,
  fetchEmployeeRefs,
  applyEmployeeFieldChange,
  toOptions,
  toReportingManagerOptions,
  type OptionList,
  type EmployeeRef,
} from '@/lib/employee-form-fields';

interface EducationRow { id: number; qualification: string; institution: string | null; university: string | null; yearOfPassing: number | null; percentage: string | null; }
interface ExperienceRow { id: number; companyName: string; designation: string; fromDate: string; toDate: string | null; lastDrawnSalary: string | null; }
interface DependentRow { id: number; name: string; relationship: string; dateOfBirth: string | null; isDependent: boolean; }
interface EmergencyContactRow { id: number; contactName: string; relationship: string; mobile: string | null; isPrimary: boolean; }
interface SkillRow { id: number; skillCategory: string | null; skillName: string; proficiencyLevel: string | null; certified: boolean; expiryDate: string | null; }
interface AssetRow { id: number; assetMasterId: number; assetTypeName: string; serialNumber: string | null; model: string | null; assetValue: string | null; allocatedDate: string; expectedReturnDate: string | null; returnedDate: string | null; }
interface CtcRow { id: number; effectiveFrom: string; effectiveTo: string | null; monthlyCtc: string; annualCtc: string; basic: string; }
interface SalaryComponentRow { salaryComponent: { name: string; code: string; type: string }; amount: string; }
interface SalaryRevisionRow { id: number; financialYear: string | null; grossSalary: string; netSalary: string | null; effectiveFrom: string; effectiveTo: string | null; components: SalaryComponentRow[]; }
interface ActivityRow { id: number; activityAt: string; module: string; activityType: string; remarks: string | null; }

/**
 * Tab strip. Contact + Emergency Contacts live inside Personal Details,
 * CTC inside Salary Details, and Experience alongside Education — each of
 * those is still its own API/section card, just stacked on the one tab.
 */
type TabKey =
  | 'basic' | 'personal' | 'job_profile' | 'salary' | 'education'
  | 'passport' | 'dependents' | 'assets' | 'skills' | 'kyc' | 'activity' | 'benefits';

const TABS: { key: TabKey; label: string }[] = [
  { key: 'basic', label: 'Basic Details' },
  { key: 'personal', label: 'Personal Details' },
  { key: 'job_profile', label: 'Job Profile' },
  { key: 'salary', label: 'Salary Details' },
  { key: 'education', label: 'Education & Experience' },
  { key: 'passport', label: 'Passport' },
  { key: 'dependents', label: 'Dependents' },
  { key: 'benefits', label: 'Benefits' },
  { key: 'assets', label: 'Assets' },
  { key: 'skills', label: 'Skill Matrix' },
  { key: 'kyc', label: 'KYC & Statutory' },
  { key: 'activity', label: 'Activity' },
];

interface SiblingRef {
  id: number;
  firstName: string;
  lastName: string;
  employeeCode: string;
  oldEmployeeCode: string | null;
}

const STATUS_TONE: Record<string, { bg: string; fg: string }> = {
  active: { bg: 'var(--success-soft)', fg: 'var(--success)' },
  'on-leave': { bg: 'var(--warning-soft)', fg: 'var(--warning)' },
  terminated: { bg: 'var(--danger-soft)', fg: 'var(--danger)' },
  resigned: { bg: 'var(--danger-soft)', fg: 'var(--danger)' },
};

function StatusPill({ status }: { status: string }) {
  const tone = STATUS_TONE[status] ?? { bg: 'var(--surface-muted)', fg: 'var(--foreground-muted)' };
  const label = status.replace(/-/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
  return (
    <span
      className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium"
      style={{ backgroundColor: tone.bg, color: tone.fg }}
    >
      <span className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: tone.fg }} />
      {label}
    </span>
  );
}

interface ProfileHeader {
  id: number;
  prev: SiblingRef | null;
  next: SiblingRef | null;
  companyId: number;
  company: { id: number; name: string } | null;
  title: string | null;
  firstName: string;
  middleName: string | null;
  lastName: string;
  employeeCode: string;
  oldEmployeeCode: string | null;
  profilePhotoPath: string | null;
  status: string;
  lifecycleState: string | null;
  isActive: boolean;
  reportingManager: { id: number; firstName: string; lastName: string; employeeCode: string } | null;
  secondReportingManager: { id: number; firstName: string; lastName: string; employeeCode: string } | null;
  department: { id: number; name: string } | null;
  designation: { id: number; name: string } | null;
  joinDate: string | null;
  confirmationDate: string | null;
}

type FormValues = Record<string, string | number | boolean | undefined>;

/** Human-readable display of one field's stored value. */
function displayValue(def: FieldDef, value: string | number | boolean | undefined): ReactNode {
  if (value === undefined || value === null || value === '') return '—';
  if (def.type === 'checkbox') return value ? 'Yes' : 'No';
  if (def.type === 'select') {
    const opt = def.options?.find((o) => String(o.value) === String(value));
    return opt?.label ?? String(value);
  }
  if (def.type === 'date') return formatDate(String(value));
  return String(value);
}

/**
 * Generic lazy-loaded, per-tab section: fetch on first activation, show a
 * read-only label/value grid, and switch to the editable form (atomic PUT
 * save) when the header's Edit button is clicked.
 */
function ProfileTabForm({
  title,
  icon,
  fetchUrl,
  saveUrl,
  fields,
  onSaved,
  onDirtyChange,
  children,
}: {
  title: string;
  icon?: ReactNode;
  fetchUrl: string;
  saveUrl: string;
  fields: FieldDef[] | ((values: FormValues) => FieldDef[]);
  onSaved?: () => void;
  onDirtyChange?: (dirty: boolean) => void;
  /** Extra read-only content rendered under the grid (view mode only). */
  children?: ReactNode;
}) {
  const [values, setValues] = useState<FormValues>({});
  const [savedValues, setSavedValues] = useState<FormValues>({});
  const [editing, setEditing] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [dirty, setDirty] = useState(false);

  useEffect(() => {
    onDirtyChange?.(dirty);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dirty]);

  // Clear the parent's dirty flag when this tab unmounts (e.g. after a
  // confirmed tab switch discards changes) so it doesn't linger stale.
  useEffect(() => () => onDirtyChange?.(false), [onDirtyChange]);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    fetch(fetchUrl)
      .then((res) => res.json())
      .then((data) => {
        if (cancelled) return;
        const normalized: Record<string, string | number | boolean | undefined> = {};
        for (const [k, v] of Object.entries(data)) {
          if (v === null || v === undefined) continue;
          if (typeof v === 'string' && /^\d{4}-\d{2}-\d{2}T/.test(v)) {
            normalized[k] = v.slice(0, 10);
          } else if (typeof v === 'string' || typeof v === 'number' || typeof v === 'boolean') {
            normalized[k] = v;
          }
        }
        setValues(normalized);
        setSavedValues(normalized);
      })
      .catch(() => setError('Failed to load'))
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fetchUrl]);

  // Routed through applyEmployeeFieldChange — a no-op outside Contact
  // Details / Date of Joining / Probation Period, and live-mirrors
  // present-address fields and the computed Probation End Date respectively.
  const handleChange = (name: string, value: string | number | boolean) => {
    setValues((v) => applyEmployeeFieldChange(v, name, value));
    setDirty(true);
    setSaved(false);
  };

  const resolvedFields = typeof fields === 'function' ? fields(values) : fields;

  const handleSave = async () => {
    setSaving(true);
    setError(null);
    try {
      const res = await fetch(saveUrl, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(values),
      });
      if (!res.ok) {
        const err = await res.json();
        // A plain "Validation failed" doesn't say which field, or why — surface
        // the first Zod field error (e.g. "ifscCode: Invalid IFSC format") when present.
        const fieldErrors = err.details?.fieldErrors as Record<string, string[]> | undefined;
        const firstFieldError = fieldErrors && Object.entries(fieldErrors).find(([, msgs]) => msgs?.length);
        throw new Error(firstFieldError ? `${firstFieldError[0]}: ${firstFieldError[1][0]}` : (err.error ?? 'Save failed'));
      }
      setDirty(false);
      setSaved(true);
      setSavedValues(values);
      setEditing(false);
      onSaved?.();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Save failed');
    } finally {
      setSaving(false);
    }
  };

  const handleCancel = () => {
    if (dirty && !window.confirm('Discard unsaved changes?')) return;
    setValues(savedValues);
    setDirty(false);
    setError(null);
    setEditing(false);
  };

  const action = loading ? undefined : editing ? (
    <div className="flex items-center gap-2">
      <button
        type="button"
        onClick={handleCancel}
        disabled={saving}
        className="rounded-lg border px-3 py-1.5 text-xs font-medium transition hover:opacity-80 disabled:opacity-50"
        style={{ borderColor: 'var(--border)', color: 'var(--foreground)' }}
      >
        Cancel
      </button>
      <button
        type="button"
        onClick={handleSave}
        disabled={saving || !dirty}
        className="rounded-lg px-3 py-1.5 text-xs font-medium text-white transition disabled:opacity-50"
        style={{ backgroundColor: 'var(--accent)' }}
      >
        {saving ? 'Saving...' : 'Save'}
      </button>
    </div>
  ) : (
    <EditButton onClick={() => setEditing(true)} />
  );

  return (
    <SectionCard title={title} icon={icon} action={action}>
      {loading ? (
        <div className="text-sm" style={{ color: 'var(--foreground-muted)' }}>
          Loading...
        </div>
      ) : editing ? (
        <div className="space-y-4">
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
            {resolvedFields.map((f) => (
              <Field key={f.name} def={f} value={values[f.name]} onChange={(v) => handleChange(f.name, v)} />
            ))}
          </div>
          {error && (
            <div className="rounded-lg px-3 py-2 text-sm" style={{ backgroundColor: 'var(--danger-soft)', color: 'var(--danger)' }}>
              {error}
            </div>
          )}
        </div>
      ) : (
        <div className="space-y-6">
          {error && (
            <div className="rounded-lg px-3 py-2 text-sm" style={{ backgroundColor: 'var(--danger-soft)', color: 'var(--danger)' }}>
              {error}
            </div>
          )}
          {saved && (
            <div className="rounded-lg px-3 py-2 text-sm" style={{ backgroundColor: 'var(--success-soft)', color: 'var(--success)' }}>
              Saved.
            </div>
          )}
          <DetailGrid items={resolvedFields.map((f) => ({ label: f.label, value: displayValue(f, values[f.name]) }))} />
          {children}
        </div>
      )}
    </SectionCard>
  );
}

/**
 * CTC Details tab — versioned history (immutable rows, no PUT/DELETE; a new
 * revision closes whatever was current). A flat FormModal is enough here
 * since ctcSchema has no nested arrays, unlike Salary Details below.
 */
function EmployeeCtcTab({ employeeId }: { employeeId: string }) {
  const [rows, setRows] = useState<CtcRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchData = useCallback(() => {
    setLoading(true);
    fetch(`/api/employees/${employeeId}/ctc`)
      .then((res) => res.json())
      .then((json) => setRows(json.data ?? []))
      .finally(() => setLoading(false));
  }, [employeeId]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleSubmit = async (values: Record<string, string | number | boolean>) => {
    const res = await fetch(`/api/employees/${employeeId}/ctc`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(values),
    });
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error ?? 'Save failed');
    }
    fetchData();
  };

  const columns: Column<CtcRow>[] = [
    { key: 'effectiveFrom', label: 'Effective From', render: (r) => r.effectiveFrom.slice(0, 10) },
    { key: 'effectiveTo', label: 'Effective To', render: (r) => (r.effectiveTo ? r.effectiveTo.slice(0, 10) : <span style={{ color: 'var(--accent)' }}>Current</span>) },
    { key: 'monthlyCtc', label: 'Monthly CTC' },
    { key: 'annualCtc', label: 'Annual CTC' },
    { key: 'basic', label: 'Basic' },
  ];

  // The first-ever CTC entered for an employee isn't a "revision" of
  // anything — HR/payroll terms that "CTC Fixation" (an employee with no
  // CTC row yet); only subsequent entries are a revision.
  const isFixation = !loading && rows.length === 0;

  return (
    <SectionCard
      title="CTC Details"
      icon={<SectionIcon.Wallet />}
      action={
        <button
          onClick={() => setModalOpen(true)}
          className="rounded-lg px-3 py-1.5 text-xs font-medium text-white transition hover:opacity-90"
          style={{ backgroundColor: 'var(--accent)' }}
        >
          {isFixation ? '+ Fix CTC' : '+ New Revision'}
        </button>
      }
    >
      <div className="space-y-4">
      {error && (
        <div className="rounded-lg px-3 py-2 text-sm" style={{ backgroundColor: 'var(--danger-soft)', color: 'var(--danger)' }}>{error}</div>
      )}
      <DataTable columns={columns} data={rows} loading={loading} emptyMessage="No CTC fixed yet." />
      <FormModal
        title={isFixation ? 'CTC Fixation' : 'New CTC Revision'}
        fields={buildCtcFields()}
        initialValues={{}}
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        onSubmit={async (v) => {
          try {
            await handleSubmit(v);
            setModalOpen(false);
          } catch (err) {
            setError(err instanceof Error ? err.message : 'Save failed');
            throw err;
          }
        }}
        submitLabel={isFixation ? 'Fix CTC' : 'Add'}
      />
      </div>
    </SectionCard>
  );
}

/**
 * Salary Details tab — versioned history like CTC, but each revision has a
 * dynamic set of component amounts against the seeded SalaryComponent
 * catalog. FormModal only handles flat fields, so the "new revision" form is
 * hand-built here to support adding/removing component rows.
 */
function EmployeeSalaryTab({ employeeId }: { employeeId: string }) {
  const [rows, setRows] = useState<SalaryRevisionRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [components, setComponents] = useState<OptionList>([]);
  const [formOpen, setFormOpen] = useState(false);
  const [financialYear, setFinancialYear] = useState('');
  const [grossSalary, setGrossSalary] = useState('');
  const [netSalary, setNetSalary] = useState('');
  const [effectiveFrom, setEffectiveFrom] = useState('');
  const [compRows, setCompRows] = useState<{ salaryComponentId: string; amount: string }[]>([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Computed Gross — the live sum of every component row's amount (Basic +
  // HRA + DA + every allowance), shown alongside the typed Gross Salary so
  // a mismatch between "what was typed" and "what the components add up
  // to" is visible before saving, not discovered later on a payslip.
  const computedGross = compRows.reduce((sum, r) => sum + (Number(r.amount) || 0), 0);
  const grossMismatch = grossSalary !== '' && Math.abs(computedGross - (Number(grossSalary) || 0)) > 0.01;

  const fetchData = useCallback(() => {
    setLoading(true);
    fetch(`/api/employees/${employeeId}/salary`)
      .then((res) => res.json())
      .then((json) => setRows(json.data ?? []))
      .finally(() => setLoading(false));
  }, [employeeId]);

  useEffect(() => {
    fetchData();
    fetchAllMaster('salary-components').then(setComponents);
  }, [fetchData]);

  const resetForm = () => {
    setFinancialYear('');
    setGrossSalary('');
    setNetSalary('');
    setEffectiveFrom('');
    setCompRows([]);
    setError(null);
  };

  const handleSubmit = async () => {
    setSaving(true);
    setError(null);
    try {
      const res = await fetch(`/api/employees/${employeeId}/salary`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          financialYear: financialYear || undefined,
          grossSalary: Number(grossSalary),
          netSalary: netSalary ? Number(netSalary) : undefined,
          effectiveFrom,
          components: compRows
            .filter((c) => c.salaryComponentId)
            .map((c) => ({ salaryComponentId: Number(c.salaryComponentId), amount: Number(c.amount || 0) })),
        }),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error ?? 'Save failed');
      }
      resetForm();
      setFormOpen(false);
      fetchData();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Save failed');
    } finally {
      setSaving(false);
    }
  };

  const columns: Column<SalaryRevisionRow>[] = [
    { key: 'effectiveFrom', label: 'Effective From', render: (r) => r.effectiveFrom.slice(0, 10) },
    { key: 'effectiveTo', label: 'Effective To', render: (r) => (r.effectiveTo ? r.effectiveTo.slice(0, 10) : <span style={{ color: 'var(--accent)' }}>Current</span>) },
    { key: 'financialYear', label: 'FY', render: (r) => r.financialYear ?? '—' },
    { key: 'grossSalary', label: 'Gross Salary' },
    { key: 'netSalary', label: 'Net Salary', render: (r) => r.netSalary ?? '—' },
    {
      key: 'components',
      label: 'Components',
      render: (r) =>
        r.components.length ? (
          <div className="flex max-w-md flex-wrap gap-1.5">
            {r.components.map((c) => (
              <span
                key={c.salaryComponent.code}
                className="inline-flex items-center gap-1 whitespace-nowrap rounded-full px-2 py-0.5 text-xs font-medium"
                style={{ backgroundColor: 'var(--surface-muted)', color: 'var(--foreground)' }}
              >
                <span style={{ color: 'var(--foreground-muted)' }}>{c.salaryComponent.name}</span>
                <span className="font-semibold">{c.amount}</span>
              </span>
            ))}
          </div>
        ) : (
          '—'
        ),
    },
  ];

  // Same "Fixation vs Revision" distinction as CTC — the first salary
  // structure entered for an employee is a Fixation, not a Revision.
  const isFixation = !loading && rows.length === 0;

  return (
    <SectionCard
      title="Salary Details"
      icon={<SectionIcon.Wallet />}
      action={
        <button
          onClick={() => setFormOpen((o) => !o)}
          className="rounded-lg px-3 py-1.5 text-xs font-medium text-white transition hover:opacity-90"
          style={{ backgroundColor: 'var(--accent)' }}
        >
          {formOpen ? 'Cancel' : isFixation ? '+ Fix Salary' : '+ New Revision'}
        </button>
      }
    >
      <div className="space-y-4">
      {formOpen && (
        <div className="rounded-lg border p-4 space-y-3" style={{ borderColor: 'var(--border)' }}>
          <h3 className="text-sm font-semibold" style={{ color: 'var(--foreground)' }}>
            {isFixation ? 'Salary Fixation' : 'New Salary Revision'}
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
            <div>
              <label className="text-xs font-medium" style={{ color: 'var(--foreground)' }}>Financial Year</label>
              <input value={financialYear} onChange={(e) => setFinancialYear(e.target.value)} placeholder="e.g. 2026-27" className="mt-1 w-full rounded-lg border px-3 py-2 text-sm" style={{ borderColor: 'var(--border)', backgroundColor: 'var(--surface)', color: 'var(--foreground)' }} />
            </div>
            <div>
              <label className="text-xs font-medium" style={{ color: 'var(--foreground)' }}>Gross Salary *</label>
              <input type="number" min={0} value={grossSalary} onChange={(e) => setGrossSalary(e.target.value)} className="mt-1 w-full rounded-lg border px-3 py-2 text-sm" style={{ borderColor: grossMismatch ? 'var(--warning)' : 'var(--border)', backgroundColor: 'var(--surface)', color: 'var(--foreground)' }} />
              {compRows.length > 0 && (
                <p className="mt-1 text-xs" style={{ color: grossMismatch ? 'var(--warning)' : 'var(--foreground-muted)' }}>
                  Computed from components: <span className="font-semibold tabular-nums">{computedGross}</span>
                  {grossMismatch && (
                    <>
                      {' — doesn\'t match Gross Salary. '}
                      <button
                        type="button"
                        onClick={() => setGrossSalary(String(computedGross))}
                        className="font-medium hover:underline"
                        style={{ color: 'var(--accent)' }}
                      >
                        Use this value
                      </button>
                    </>
                  )}
                </p>
              )}
            </div>
            <div>
              <label className="text-xs font-medium" style={{ color: 'var(--foreground)' }}>Net Salary</label>
              <input type="number" min={0} value={netSalary} onChange={(e) => setNetSalary(e.target.value)} className="mt-1 w-full rounded-lg border px-3 py-2 text-sm" style={{ borderColor: 'var(--border)', backgroundColor: 'var(--surface)', color: 'var(--foreground)' }} />
            </div>
            <div>
              <label className="text-xs font-medium" style={{ color: 'var(--foreground)' }}>Effective From *</label>
              <input type="date" value={effectiveFrom} onChange={(e) => setEffectiveFrom(e.target.value)} className="mt-1 w-full rounded-lg border px-3 py-2 text-sm" style={{ borderColor: 'var(--border)', backgroundColor: 'var(--surface)', color: 'var(--foreground)' }} />
            </div>
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium" style={{ color: 'var(--foreground)' }}>Components</span>
              <button
                type="button"
                onClick={() => setCompRows((r) => [...r, { salaryComponentId: '', amount: '' }])}
                className="text-xs font-medium"
                style={{ color: 'var(--accent)' }}
              >
                + Add Component
              </button>
            </div>
            {compRows.map((row, idx) => (
              <div key={idx} className="flex items-center gap-2">
                <select
                  value={row.salaryComponentId}
                  onChange={(e) => setCompRows((rs) => rs.map((r, i) => (i === idx ? { ...r, salaryComponentId: e.target.value } : r)))}
                  className="flex-1 rounded-lg border px-3 py-2 text-sm"
                  style={{ borderColor: 'var(--border)', backgroundColor: 'var(--surface)', color: 'var(--foreground)' }}
                >
                  <option value="">— Select component —</option>
                  {components.map((c) => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </select>
                <input
                  type="number"
                  min={0}
                  placeholder="Amount"
                  value={row.amount}
                  onChange={(e) => setCompRows((rs) => rs.map((r, i) => (i === idx ? { ...r, amount: e.target.value } : r)))}
                  className="w-32 rounded-lg border px-3 py-2 text-sm"
                  style={{ borderColor: 'var(--border)', backgroundColor: 'var(--surface)', color: 'var(--foreground)' }}
                />
                <button
                  type="button"
                  onClick={() => setCompRows((rs) => rs.filter((_, i) => i !== idx))}
                  className="text-xs"
                  style={{ color: 'var(--danger)' }}
                >
                  Remove
                </button>
              </div>
            ))}
          </div>

          {error && (
            <div className="rounded-lg px-3 py-2 text-sm" style={{ backgroundColor: 'var(--danger-soft)', color: 'var(--danger)' }}>{error}</div>
          )}

          <div className="flex justify-end">
            <button
              onClick={handleSubmit}
              disabled={saving || !grossSalary || !effectiveFrom}
              className="rounded-lg px-4 py-2 text-sm font-medium text-white transition disabled:opacity-50"
              style={{ backgroundColor: 'var(--accent)' }}
            >
              {saving ? 'Saving...' : isFixation ? 'Fix Salary' : 'Add Revision'}
            </button>
          </div>
        </div>
      )}

      <DataTable columns={columns} data={rows} loading={loading} emptyMessage="No salary fixed yet." />
      </div>
    </SectionCard>
  );
}

interface EmployeeBenefitRow {
  id: number;
  code: string;
  name: string;
  employeeType: string;
  amount: number;
}

/** Benefits tab — shows available benefit components and allows toggling enrollment. */
function EmployeeBenefitsTab({
  employeeId,
  onDirtyChange,
}: {
  employeeId: string;
  onDirtyChange?: (dirty: boolean) => void;
}) {
  const [available, setAvailable] = useState<EmployeeBenefitRow[]>([]);
  const [selected, setSelected] = useState<EmployeeBenefitRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchBenefits = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/employees/${employeeId}/benefits`);
      if (!res.ok) throw new Error('Failed to fetch benefits');
      const json = await res.json();
      setAvailable(json.available ?? []);
      setSelected(json.selected ?? []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  }, [employeeId]);

  useEffect(() => {
    fetchBenefits();
  }, [fetchBenefits]);

  const selectedIds = new Set(selected.map((s) => s.id));

  const toggle = (benefit: EmployeeBenefitRow) => {
    const exists = selected.some((s) => s.id === benefit.id);
    const next = exists ? selected.filter((s) => s.id !== benefit.id) : [...selected, benefit];
    setSelected(next);
    onDirtyChange?.(true);
  };

  const handleSave = async () => {
    setSaving(true);
    setError(null);
    try {
      const res = await fetch(`/api/employees/${employeeId}/benefits`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ benefitRateIds: selected.map((s) => s.id) }),
      });
      if (!res.ok) throw new Error('Save failed');
      const json = await res.json();
      setSelected(json.selected ?? []);
      onDirtyChange?.(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Save failed');
    } finally {
      setSaving(false);
    }
  };

  return (
    <SectionCard title="Benefits" icon={<SectionIcon.Gift />}>
      <div className="space-y-3">
        {error && (
          <div className="rounded-lg px-3 py-2 text-sm" style={{ backgroundColor: 'var(--danger-soft)', color: 'var(--danger)' }}>
            {error}
          </div>
        )}

        {loading ? (
          <p className="text-sm" style={{ color: 'var(--foreground-muted)' }}>Loading…</p>
        ) : available.length === 0 ? (
          <p className="text-sm" style={{ color: 'var(--foreground-muted)' }}>No benefit components configured yet.</p>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2">
            {available.map((b) => {
              const checked = selectedIds.has(b.id);
              return (
                <label
                  key={b.id}
                  className="flex items-start gap-2 rounded-lg border px-3 py-2 cursor-pointer transition hover:opacity-80"
                  style={{ borderColor: checked ? 'var(--accent)' : 'var(--border)', backgroundColor: checked ? 'var(--accent-soft)' : 'transparent' }}
                >
                  <input
                    type="checkbox"
                    checked={checked}
                    onChange={() => toggle(b)}
                    className="mt-0.5"
                  />
                  <div className="flex flex-col">
                    <span className="text-sm font-medium" style={{ color: 'var(--foreground)' }}>{b.name}</span>
                    <span className="text-xs" style={{ color: 'var(--foreground-muted)' }}>
                      {b.code} · {b.employeeType} · ₹{b.amount.toFixed(2)}/mo
                    </span>
                  </div>
                </label>
              );
            })}
          </div>
        )}

        {!loading && available.length > 0 && (
          <div className="flex justify-end">
            <button
              onClick={handleSave}
              disabled={saving}
              className="rounded-lg px-4 py-2 text-sm font-medium text-white transition disabled:opacity-50"
              style={{ backgroundColor: 'var(--accent)' }}
            >
              {saving ? 'Saving…' : 'Save Benefits'}
            </button>
          </div>
        )}
      </div>
    </SectionCard>
  );
}

/** Per-profile Activity tab — reuses the global activity API, filtered to this employee. */
function EmployeeActivityTab({ employeeId }: { employeeId: string }) {
  const [items, setItems] = useState<ActivityRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    fetch(`/api/employees/activity?employeeId=${employeeId}&limit=100`)
      .then((res) => res.json())
      .then((json) => setItems(json.data ?? []))
      .finally(() => setLoading(false));
  }, [employeeId]);

  const columns: Column<ActivityRow>[] = [
    { key: 'activityAt', label: 'Date/Time', render: (r) => new Date(r.activityAt).toLocaleString() },
    { key: 'module', label: 'Module' },
    { key: 'activityType', label: 'Activity Type' },
    { key: 'remarks', label: 'Remarks', render: (r) => r.remarks ?? '—' },
  ];

  return (
    <SectionCard title="Activity" icon={<SectionIcon.Activity />}>
      <DataTable columns={columns} data={items} loading={loading} emptyMessage="No activity recorded for this employee yet." />
    </SectionCard>
  );
}

/**
 * Reveals the real PAN/Aadhaar values for the KYC tab, gated server-side by
 * employee.kyc.reveal — a permission distinct from employee.kyc.view (the
 * base tab only ever sees masked values). Every reveal is server-logged.
 *
 * Also doubles as a document upload center for signature and government
 * documents (PDF/images), stored as EmployeeDocument rows and served through
 * the permission-gated /api/uploads/[...path] route.
 */

interface EmployeeDoc {
  id: number;
  docType: string;
  docNumber: string | null;
  fileName: string | null;
  filePath: string | null;
  issuedDate: string | null;
  expiryDate: string | null;
  isExpired?: boolean;
}

const DOC_TYPE_LABELS: Record<string, string> = {
  aadhaar: 'Aadhaar',
  pan: 'PAN',
  passport: 'Passport',
  driving_license: 'Driving Licence',
  kpi: 'KPI',
  jd: 'Job Description',
  signature: 'Signature',
  government: 'Government Document',
  other: 'Other',
};

function KycRevealPanel({ employeeId }: { employeeId: string }) {
  const [docs, setDocs] = useState<EmployeeDoc[]>([]);
  const [docsLoading, setDocsLoading] = useState(true);
  const [docsError, setDocsError] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [docType, setDocType] = useState('government');
  const [docNumber, setDocNumber] = useState('');
  const [issuedDate, setIssuedDate] = useState('');
  const [expiryDate, setExpiryDate] = useState('');
  const [previewDoc, setPreviewDoc] = useState<EmployeeDoc | null>(null);

  const fetchDocs = useCallback(async () => {
    setDocsLoading(true);
    setDocsError(null);
    try {
      const res = await fetch(`/api/employees/${employeeId}/documents`);
      const json = (await res.json()) as { data: EmployeeDoc[] };
      setDocs(json.data ?? []);
    } catch (err) {
      setDocsError(err instanceof Error ? err.message : 'Failed to load documents');
    } finally {
      setDocsLoading(false);
    }
  }, [employeeId]);

  useEffect(() => {
    fetchDocs();
  }, [fetchDocs]);

  const handleUpload = async () => {
    setUploadError(null);
    if (!selectedFile) {
      setUploadError('Choose a file first.');
      return;
    }
    setUploading(true);
    try {
      const formData = new FormData();
      formData.append('file', selectedFile);
      formData.append('docType', docType);
      if (docNumber.trim()) formData.append('docNumber', docNumber.trim());
      if (issuedDate) formData.append('issuedDate', issuedDate);
      if (expiryDate) formData.append('expiryDate', expiryDate);
      const res = await fetch(`/api/employees/${employeeId}/documents`, { method: 'POST', body: formData });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? 'Upload failed');
      setSelectedFile(null);
      setDocNumber('');
      setIssuedDate('');
      setExpiryDate('');
      if (fileInputRef.current) fileInputRef.current.value = '';
      await fetchDocs();
    } catch (err) {
      setUploadError(err instanceof Error ? err.message : 'Upload failed');
    } finally {
      setUploading(false);
    }
  };

  const handleDelete = async (docId: number) => {
    if (!window.confirm('Delete this document?')) return;
    try {
      const res = await fetch(`/api/employees/${employeeId}/documents/${docId}`, { method: 'DELETE' });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? 'Delete failed');
      await fetchDocs();
    } catch (err) {
      setDocsError(err instanceof Error ? err.message : 'Delete failed');
    }
  };

  return (
    <SectionCard
      title="Document Upload Center"
      icon={<SectionIcon.Shield />}
    >
      <div className="space-y-5">
        <div className="space-y-3">
          <h4 className="text-sm font-semibold" style={{ color: 'var(--foreground)' }}>
            Upload a new document
          </h4>
          {uploadError && (
            <div className="rounded-lg px-3 py-2 text-sm" style={{ backgroundColor: 'var(--danger-soft)', color: 'var(--danger)' }}>
              {uploadError}
            </div>
          )}
          <div className="grid grid-cols-1 gap-3 rounded-lg border p-3" style={{ borderColor: 'var(--border)' }}>
            <div className="grid grid-cols-1 gap-3 md:grid-cols-4">
              <label className="text-xs" style={{ color: 'var(--foreground-muted)' }}>
                Document type
                <select
                  value={docType}
                  onChange={(e) => setDocType(e.target.value)}
                  className="mt-1 block w-full rounded-lg border bg-transparent px-2 py-1.5 text-sm"
                  style={{ borderColor: 'var(--border)', color: 'var(--foreground)' }}
                >
                  <option value="signature">Signature</option>
                  <option value="government">Government Document</option>
                  <option value="aadhaar">Aadhaar</option>
                  <option value="pan">PAN</option>
                  <option value="passport">Passport</option>
                  <option value="driving_license">Driving Licence</option>
                  <option value="other">Other</option>
                </select>
              </label>
              <label className="text-xs" style={{ color: 'var(--foreground-muted)' }}>
                Document number
                <input
                  type="text"
                  value={docNumber}
                  onChange={(e) => setDocNumber(e.target.value)}
                  placeholder="e.g. PAN / Aadhaar number"
                  className="mt-1 block w-full rounded-lg border bg-transparent px-2 py-1.5 text-sm"
                  style={{ borderColor: 'var(--border)', color: 'var(--foreground)' }}
                />
              </label>
              <label className="text-xs" style={{ color: 'var(--foreground-muted)' }}>
                Issued on
                <input
                  type="date"
                  value={issuedDate}
                  onChange={(e) => setIssuedDate(e.target.value)}
                  className="mt-1 block w-full rounded-lg border bg-transparent px-2 py-1.5 text-sm"
                  style={{ borderColor: 'var(--border)', color: 'var(--foreground)' }}
                />
              </label>
              <label className="text-xs" style={{ color: 'var(--foreground-muted)' }}>
                Expires on
                <input
                  type="date"
                  value={expiryDate}
                  onChange={(e) => setExpiryDate(e.target.value)}
                  className="mt-1 block w-full rounded-lg border bg-transparent px-2 py-1.5 text-sm"
                  style={{ borderColor: 'var(--border)', color: 'var(--foreground)' }}
                />
              </label>
            </div>
            <div className="flex flex-wrap items-end gap-3">
              <label className="flex-1 text-xs" style={{ color: 'var(--foreground-muted)' }}>
                File (PDF or image, max 5 MB)
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".pdf,.jpg,.jpeg,.png,.webp"
                  onChange={(e) => setSelectedFile(e.target.files?.[0] ?? null)}
                  className="mt-1 block w-full rounded-lg border bg-transparent px-2 py-1.5 text-sm file:mr-3 file:rounded file:border-0 file:bg-[var(--accent)] file:px-2 file:py-1 file:text-xs file:text-white"
                  style={{ borderColor: 'var(--border)', color: 'var(--foreground)' }}
                />
              </label>
              <button
                onClick={handleUpload}
                disabled={uploading || !selectedFile}
                className="rounded-lg px-4 py-2 text-sm font-medium text-white transition hover:opacity-90 disabled:opacity-50"
                style={{ backgroundColor: 'var(--accent)' }}
              >
                {uploading ? 'Uploading...' : 'Upload'}
              </button>
            </div>
          </div>
        </div>

        <div className="space-y-3">
          <h4 className="text-sm font-semibold" style={{ color: 'var(--foreground)' }}>
            Uploaded documents
          </h4>
          {docsLoading ? (
            <p className="text-sm" style={{ color: 'var(--foreground-muted)' }}>Loading documents...</p>
          ) : docsError ? (
            <div className="rounded-lg px-3 py-2 text-sm" style={{ backgroundColor: 'var(--danger-soft)', color: 'var(--danger)' }}>
              {docsError}
            </div>
          ) : docs.length === 0 ? (
            <p className="text-sm" style={{ color: 'var(--foreground-muted)' }}>No documents uploaded yet.</p>
          ) : (
            <div className="divide-y rounded-lg border" style={{ borderColor: 'var(--border)' }}>
              {docs.map((d) => (
                <div key={d.id} className="flex items-start justify-between gap-3 px-3 py-2.5 text-sm">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="font-medium" style={{ color: 'var(--foreground)' }}>
                        {DOC_TYPE_LABELS[d.docType] ?? d.docType}
                      </span>
                      {d.isExpired && (
                        <span className="rounded-full px-1.5 py-0.5 text-[10px] font-medium" style={{ backgroundColor: 'var(--danger-soft)', color: 'var(--danger)' }}>
                          Expired
                        </span>
                      )}
                    </div>
                    <div className="truncate text-xs" style={{ color: 'var(--foreground-muted)' }}>
                      {d.fileName ?? '—'}
                      {d.docNumber ? ` · ${d.docNumber}` : ''}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {d.filePath && (
                      <button
                        onClick={() => setPreviewDoc(d)}
                        className="rounded-lg border px-2.5 py-1 text-xs font-medium transition hover:opacity-80"
                        style={{ borderColor: 'var(--border)', color: 'var(--foreground)' }}
                      >
                        View
                      </button>
                    )}
                    <button
                      onClick={() => handleDelete(d.id)}
                      className="rounded-lg px-2.5 py-1 text-xs font-medium text-white transition hover:opacity-90"
                      style={{ backgroundColor: 'var(--danger)' }}
                    >
                      Delete
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {previewDoc && previewDoc.filePath && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          style={{ backgroundColor: 'rgba(0,0,0,0.5)' }}
          onClick={() => setPreviewDoc(null)}
        >
          <div
            className="flex max-h-[90vh] w-full max-w-3xl flex-col rounded-xl shadow-2xl"
            style={{ backgroundColor: 'var(--surface)', border: '1px solid var(--border)' }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b px-5 py-3" style={{ borderColor: 'var(--border)' }}>
              <h3 className="text-sm font-semibold" style={{ color: 'var(--foreground)' }}>
                {previewDoc.fileName ?? DOC_TYPE_LABELS[previewDoc.docType] ?? 'Document'}
              </h3>
              <button
                onClick={() => setPreviewDoc(null)}
                className="rounded-lg border px-2.5 py-1 text-xs font-medium transition hover:opacity-80"
                style={{ borderColor: 'var(--border)', color: 'var(--foreground)' }}
              >
                Close
              </button>
            </div>
            <div className="flex-1 overflow-auto p-2">
              {previewDoc.filePath.toLowerCase().endsWith('.pdf') ? (
                <iframe
                  src={previewDoc.filePath}
                  title={previewDoc.fileName ?? 'Document'}
                  className="h-[70vh] w-full rounded-lg"
                  style={{ border: '1px solid var(--border)' }}
                />
              ) : (
                <img
                  src={previewDoc.filePath}
                  alt={previewDoc.fileName ?? 'Document'}
                  className="mx-auto max-h-[70vh] max-w-full rounded-lg"
                  style={{ border: '1px solid var(--border)' }}
                />
              )}
            </div>
          </div>
        </div>
      )}
    </SectionCard>
  );
}

// ─── Lifecycle (BRD 01 §8) ───────────────────────────────────────────────────

interface LifecycleInfo {
  state: string;
  derived: boolean;
  legacyStatus: string;
  allowedTargets: string[];
  history: Array<{ id: number; fromState: string | null; toState: string; trigger: string; effectiveDate: string; reason: string | null; referenceNo: string | null; createdAt: string }>;
}

const LIFECYCLE_TONE: Record<string, { bg: string; fg: string }> = {
  DRAFT: { bg: 'var(--surface-muted)', fg: 'var(--foreground-muted)' },
  CANDIDATE_CONVERTED: { bg: 'var(--info-soft)', fg: 'var(--info)' },
  PROBATION: { bg: 'var(--warning-soft)', fg: 'var(--warning)' },
  CONFIRMED: { bg: 'var(--success-soft)', fg: 'var(--success)' },
  ON_NOTICE: { bg: 'var(--warning-soft)', fg: 'var(--warning)' },
  SUSPENDED: { bg: 'var(--danger-soft)', fg: 'var(--danger)' },
  LONG_LEAVE: { bg: 'var(--info-soft)', fg: 'var(--info)' },
  SEPARATED: { bg: 'var(--danger-soft)', fg: 'var(--danger)' },
  REHIRED: { bg: 'var(--accent-soft)', fg: 'var(--accent)' },
};

function LifecycleBadge({ state }: { state: string | null | undefined }) {
  if (!state) return null;
  const tone = LIFECYCLE_TONE[state] ?? LIFECYCLE_TONE.DRAFT;
  return (
    <span
      className="rounded-full px-2 py-0.5 text-xs font-medium"
      style={{ backgroundColor: tone.bg, color: tone.fg }}
      title="Lifecycle state (BRD §8)"
    >
      {state.replace(/_/g, ' ')}
    </span>
  );
}

const LIFECYCLE_TRIGGERS: Record<string, string> = {
  CANDIDATE_CONVERTED: 'MANDATORY_FIELDS_COMPLETE',
  PROBATION: 'JOINING_CONFIRMED',
  CONFIRMED: 'CONFIRMATION',
  ON_NOTICE: 'RESIGNATION_ACCEPTED',
  SUSPENDED: 'SUSPENSION_ORDER',
  LONG_LEAVE: 'LONG_LEAVE_COMMENCED',
  SEPARATED: 'LAST_WORKING_DAY',
  REHIRED: 'REHIRE',
};

/** "Change state" dialog — target list limited to what the §8.2 table permits from the current state. */
function LifecycleChangeModal({
  employeeId,
  lifecycle,
  isOpen,
  onClose,
  onChanged,
}: {
  employeeId: string;
  lifecycle: LifecycleInfo | null;
  isOpen: boolean;
  onClose: () => void;
  onChanged: () => void;
}) {
  const today = new Date().toISOString().slice(0, 10);
  const targets = lifecycle?.allowedTargets ?? [];
  const fields: FieldDef[] = [
    {
      name: 'toState',
      label: 'New State',
      type: 'select',
      required: true,
      options: targets.map((t) => ({ label: t.replace(/_/g, ' '), value: t })),
      helpText: lifecycle ? `Current: ${lifecycle.state.replace(/_/g, ' ')}` : undefined,
    },
    { name: 'effectiveDate', label: 'Effective Date', type: 'date', required: true, defaultValue: today },
    { name: 'referenceNo', label: 'Reference No.', type: 'text', placeholder: 'Order / letter reference (optional)', maxLength: 60 },
    { name: 'reason', label: 'Reason', type: 'textarea', placeholder: 'Optional' },
    ...(targets.includes('REHIRED')
      ? [{ name: 'rehireTo', label: 'Rehire lands in', type: 'select', options: [{ label: 'Probation', value: 'PROBATION' }, { label: 'Confirmed (probation waived)', value: 'CONFIRMED' }], defaultValue: 'PROBATION', helpText: 'Only used when the new state is REHIRED' } as FieldDef]
      : []),
  ];

  const handleSubmit = async (values: Record<string, string | number | boolean>) => {
    const toState = String(values.toState);
    const res = await fetch(`/api/employees/${employeeId}/lifecycle/transition`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        toState,
        trigger: LIFECYCLE_TRIGGERS[toState] ?? 'HR_ACTION',
        effectiveDate: values.effectiveDate || undefined,
        reason: values.reason || null,
        referenceNo: values.referenceNo || null,
        rehireTo: toState === 'REHIRED' ? values.rehireTo || 'PROBATION' : undefined,
      }),
    });
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error ?? 'Transition failed');
    }
    onChanged();
  };

  return (
    <FormModal
      title="Change Lifecycle State"
      fields={fields}
      initialValues={{ effectiveDate: today, rehireTo: 'PROBATION' }}
      isOpen={isOpen}
      onClose={onClose}
      onSubmit={handleSubmit}
      submitLabel="Apply"
    />
  );
}

// ─── Job history (BRD 01 §15 / §18 / §19) ────────────────────────────────────

interface JobHistoryRow {
  id: number;
  effectiveFrom: string;
  effectiveTo: string | null;
  isCurrent: boolean;
  superseded: boolean;
  changeReason: string | null;
  changeReference: string | null;
  department: { name: string } | null;
  subDepartment: { name: string } | null;
  designation: { name: string } | null;
  grade: { name: string } | null;
  level: { name: string } | null;
  employeeType: { name: string } | null;
  unit: { name: string } | null;
  location: { code: string; name: string } | null;
  costCentre: { code: string; name: string } | null;
  noticePeriodDays: number | null;
  noticePeriodSource: string | null;
}
interface ReportingHistoryRow {
  id: number;
  effectiveFrom: string;
  effectiveTo: string | null;
  changeReason: string | null;
  primaryManager: { firstName: string; lastName: string; employeeCode: string } | null;
  secondaryManager: { firstName: string; lastName: string; employeeCode: string } | null;
}
interface CodedRef { id: number; code: string; name: string }

const JOB_CHANGE_REASON_OPTIONS = [
  { label: 'Transfer', value: 'TRANSFER' },
  { label: 'Promotion', value: 'PROMOTION' },
  { label: 'Designation change', value: 'DESIGNATION_CHANGE' },
  { label: 'Departmental change', value: 'DEPARTMENT_CHANGE' },
  { label: 'Employee type change', value: 'EMPLOYEE_TYPE_CHANGE' },
  { label: 'Reporting change', value: 'REPORTING_CHANGE' },
  { label: 'Correction', value: 'CORRECTION' },
  { label: 'Policy', value: 'POLICY' },
  { label: 'Demotion (HR Admin)', value: 'DEMOTION' },
];

function JobHistorySection({
  employeeId,
  masters,
}: {
  employeeId: string;
  masters: {
    departments: OptionList; subDepartments: OptionList; designations: OptionList; grades: OptionList; levels: OptionList;
    employeeTypes: OptionList; categories: OptionList; units: OptionList; reportingManagers: EmployeeRef[];
  };
}) {
  const [rows, setRows] = useState<JobHistoryRow[]>([]);
  const [reporting, setReporting] = useState<ReportingHistoryRow[]>([]);
  const [costCentres, setCostCentres] = useState<CodedRef[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);

  const load = useCallback(() => {
    Promise.all([
      fetch(`/api/employees/${employeeId}/lifecycle/job-history`),
      fetch('/api/masters/cost-centres?limit=500'),
    ])
      .then(async ([histRes, ccRes]) => {
        if (!histRes.ok) throw new Error('Failed to load job history');
        const hist: { data: JobHistoryRow[]; reporting: ReportingHistoryRow[] } = await histRes.json();
        const ccs = ccRes.ok ? ((await ccRes.json()) as { data: CodedRef[] }).data : [];
        return { hist, ccs };
      })
      .then(({ hist, ccs }) => {
        setRows(hist.data);
        setReporting(hist.reporting);
        setCostCentres(ccs);
        setError(null);
      })
      .catch((err) => setError(err instanceof Error ? err.message : 'Failed to load job history'))
      .finally(() => setLoading(false));
  }, [employeeId]);

  useEffect(() => {
    load();
  }, [load]);

  const current = rows.find((r) => r.isCurrent) ?? null;
  const today = new Date().toISOString().slice(0, 10);
  const codedOptions = (list: CodedRef[]) => list.map((l) => ({ label: `${l.name} (${l.code})`, value: l.id }));

  const changeFields: FieldDef[] = [
    { name: 'effectiveFrom', label: 'Effective From', type: 'date', required: true, defaultValue: today, helpText: 'Closes the current row the day before' },
    { name: 'changeReason', label: 'Change Reason', type: 'select', required: true, options: JOB_CHANGE_REASON_OPTIONS },
    { name: 'changeReference', label: 'Reference', type: 'text', placeholder: 'Letter / order no. (optional)', maxLength: 60 },
    { name: 'departmentId', label: 'Department', type: 'select', options: toOptions(masters.departments) },
    { name: 'subDepartmentId', label: 'Sub-Department', type: 'select', options: toOptions(masters.subDepartments) },
    { name: 'designationId', label: 'Designation', type: 'select', options: toOptions(masters.designations) },
    { name: 'gradeId', label: 'Grade', type: 'select', options: toOptions(masters.grades) },
    { name: 'levelId', label: 'Level', type: 'select', options: toOptions(masters.levels) },
    { name: 'employeeTypeId', label: 'Employee Type', type: 'select', options: toOptions(masters.employeeTypes) },
    { name: 'unitId', label: 'Branch / Unit', type: 'select', options: toOptions(masters.units) },
    { name: 'costCentreId', label: 'Cost Centre', type: 'select', options: codedOptions(costCentres) },
    { name: 'noticePeriodDays', label: 'Notice Period (days)', type: 'number', min: 0, max: 365, helpText: 'Forward-dated only; blank keeps / re-derives the current value' },
    { name: 'reportingManagerId', label: 'Reporting Manager', type: 'select', options: toReportingManagerOptions(masters.reportingManagers) },
    { name: 'secondReportingManagerId', label: 'Second Reporting Manager', type: 'select', options: toReportingManagerOptions(masters.reportingManagers) },
    { name: 'remarks', label: 'Remarks', type: 'textarea', placeholder: 'Optional' },
  ];

  const handleChange = async (values: Record<string, string | number | boolean>) => {
    // Only fields the user actually set travel; everything else is carried forward server-side.
    const body: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(values)) {
      if (v === '' || v === undefined || v === null) continue;
      body[k] = v;
    }
    const res = await fetch(`/api/employees/${employeeId}/lifecycle/job-change`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    if (!res.ok) {
      const err = await res.json();
      const fieldErrors = err.details?.fieldErrors as Record<string, string[]> | undefined;
      const first = fieldErrors && Object.entries(fieldErrors).find(([, m]) => m?.length);
      throw new Error(first ? `${first[0]}: ${first[1][0]}` : (err.error ?? 'Job change failed'));
    }
    setSaved(true);
    load();
  };

  const period = (r: { effectiveFrom: string; effectiveTo: string | null }) => `${formatDate(r.effectiveFrom)} → ${r.effectiveTo ? formatDate(r.effectiveTo) : 'current'}`;

  return (
    <SectionCard
      title="Job History"
      icon={<SectionIcon.Briefcase />}
      action={
        <button
          type="button"
          onClick={() => { setSaved(false); setModalOpen(true); }}
          className="rounded-lg px-3 py-1.5 text-xs font-medium text-white transition hover:opacity-90"
          style={{ backgroundColor: 'var(--accent)' }}
        >
          + Record Job Change
        </button>
      }
    >
      {loading ? (
        <div className="text-sm" style={{ color: 'var(--foreground-muted)' }}>Loading...</div>
      ) : (
        <div className="space-y-6">
          {error && (
            <div className="rounded-lg px-3 py-2 text-sm" style={{ backgroundColor: 'var(--danger-soft)', color: 'var(--danger)' }}>{error}</div>
          )}
          {saved && (
            <div className="rounded-lg px-3 py-2 text-sm" style={{ backgroundColor: 'var(--success-soft)', color: 'var(--success)' }}>Job change recorded.</div>
          )}

          <div>
            <h3 className="mb-3 text-sm font-semibold" style={{ color: 'var(--foreground)' }}>Current posting &amp; notice period</h3>
            <DetailGrid
              items={[
                { label: 'Branch / Unit', value: current?.unit?.name ?? '—' },
                { label: 'Cost Centre', value: current?.costCentre ? `${current.costCentre.name} (${current.costCentre.code})` : '—' },
                { label: 'Notice Period', value: current?.noticePeriodDays !== null && current?.noticePeriodDays !== undefined ? `${current.noticePeriodDays} days` : '—' },
                { label: 'Notice Source', value: current?.noticePeriodSource ?? '—' },
                { label: 'Effective From', value: current ? formatDate(current.effectiveFrom) : '—' },
                { label: 'Change Reason', value: current?.changeReason ?? '—' },
              ]}
            />
          </div>

          <div className="overflow-x-auto">
            <table className="w-full min-w-[900px] text-sm">
              <thead>
                <tr className="text-left text-xs uppercase tracking-wide" style={{ color: 'var(--foreground-muted)' }}>
                  <th className="py-2 pr-3">Period</th>
                  <th className="py-2 pr-3">Department</th>
                  <th className="py-2 pr-3">Designation</th>
                  <th className="py-2 pr-3">Grade / Level</th>
                  <th className="py-2 pr-3">Branch / Unit</th>
                  <th className="py-2 pr-3">Cost Centre</th>
                  <th className="py-2 pr-3">Notice</th>
                  <th className="py-2 pr-3">Reason</th>
                </tr>
              </thead>
              <tbody>
                {rows.length === 0 && (
                  <tr><td colSpan={8} className="py-3 text-sm" style={{ color: 'var(--foreground-muted)' }}>No job history rows.</td></tr>
                )}
                {rows.map((r) => (
                  <tr key={r.id} className="border-t" style={{ borderColor: 'var(--border)', color: 'var(--foreground)', opacity: r.superseded ? 0.55 : 1 }}>
                    <td className="py-2 pr-3 whitespace-nowrap">
                      {period(r)}
                      {r.isCurrent && <span className="ml-2 rounded-full px-1.5 py-0.5 text-[10px] font-medium" style={{ backgroundColor: 'var(--success-soft)', color: 'var(--success)' }}>current</span>}
                      {r.superseded && <span className="ml-2 rounded-full px-1.5 py-0.5 text-[10px] font-medium" style={{ backgroundColor: 'var(--surface-muted)', color: 'var(--foreground-muted)' }}>superseded</span>}
                    </td>
                    <td className="py-2 pr-3">{r.department?.name ?? '—'}{r.subDepartment ? ` / ${r.subDepartment.name}` : ''}</td>
                    <td className="py-2 pr-3">{r.designation?.name ?? '—'}</td>
                    <td className="py-2 pr-3">{[r.grade?.name, r.level?.name].filter(Boolean).join(' / ') || '—'}</td>
                    <td className="py-2 pr-3">{r.unit?.name ?? '—'}</td>
                    <td className="py-2 pr-3">{r.costCentre?.code ?? '—'}</td>
                    <td className="py-2 pr-3">{r.noticePeriodDays ?? '—'}{r.noticePeriodSource ? ` (${r.noticePeriodSource})` : ''}</td>
                    <td className="py-2 pr-3">{r.changeReason ?? '—'}{r.changeReference ? ` · ${r.changeReference}` : ''}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {reporting.length > 0 && (
            <div>
              <h3 className="mb-2 text-sm font-semibold" style={{ color: 'var(--foreground)' }}>Reporting line history</h3>
              <ul className="space-y-1 text-sm" style={{ color: 'var(--foreground)' }}>
                {reporting.map((r) => (
                  <li key={r.id}>
                    <span className="whitespace-nowrap" style={{ color: 'var(--foreground-muted)' }}>{period(r)}:</span>{' '}
                    {r.primaryManager ? `${r.primaryManager.firstName} ${r.primaryManager.lastName} (${r.primaryManager.employeeCode})` : 'no primary manager'}
                    {r.secondaryManager ? `; secondary ${r.secondaryManager.firstName} ${r.secondaryManager.lastName} (${r.secondaryManager.employeeCode})` : ''}
                    {r.changeReason ? ` — ${r.changeReason}` : ''}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}

      <FormModal
        title="Record Job Change"
        fields={changeFields}
        initialValues={{ effectiveFrom: today }}
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        onSubmit={handleChange}
        submitLabel="Record"
      />
    </SectionCard>
  );
}

export default function EmployeeProfilePage() {
  const params = useParams<{ id: string }>();
  const employeeId = params.id;

  const [header, setHeader] = useState<ProfileHeader | null>(null);
  const [loadingHeader, setLoadingHeader] = useState(true);
  const [headerError, setHeaderError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<TabKey>('basic');
  const [activeTabDirty, setActiveTabDirty] = useState(false);
  const [confirmToggle, setConfirmToggle] = useState(false);
  const [toggling, setToggling] = useState(false);
  const [toggleError, setToggleError] = useState<string | null>(null);
  const [lifecycle, setLifecycle] = useState<LifecycleInfo | null>(null);
  const [changeStateOpen, setChangeStateOpen] = useState(false);

  const handleTabClick = useCallback(
    (key: TabKey) => {
      if (key === activeTab) return;
      if (activeTabDirty) {
        const proceed = window.confirm('You have unsaved changes on this tab. Discard them and switch tabs?');
        if (!proceed) return;
      }
      setActiveTabDirty(false);
      setActiveTab(key);
    },
    [activeTab, activeTabDirty]
  );

  const [companies, setCompanies] = useState<OptionList>([]);
  const [departments, setDepartments] = useState<OptionList>([]);
  const [subDepartments, setSubDepartments] = useState<OptionList>([]);
  const [designations, setDesignations] = useState<OptionList>([]);
  const [employeeTypes, setEmployeeTypes] = useState<OptionList>([]);
  const [categories, setCategories] = useState<OptionList>([]);
  const [grades, setGrades] = useState<OptionList>([]);
  const [levels, setLevels] = useState<OptionList>([]);
  const [units, setUnits] = useState<OptionList>([]);
  const [shiftMasters, setShiftMasters] = useState<OptionList>([]);
  const [shiftRotationPlans, setShiftRotationPlans] = useState<OptionList>([]);
  const [reportingManagers, setReportingManagers] = useState<EmployeeRef[]>([]);
  const [assetMasters, setAssetMasters] = useState<OptionList>([]);

  useEffect(() => {
    if (!activeTabDirty) return;
    const handler = (e: BeforeUnloadEvent) => {
      e.preventDefault();
    };
    window.addEventListener('beforeunload', handler);
    return () => window.removeEventListener('beforeunload', handler);
  }, [activeTabDirty]);

  const fetchHeader = useCallback(() => {
    setLoadingHeader(true);
    setHeaderError(null);
    fetch(`/api/employees/${employeeId}`)
      .then(async (res) => {
        const json = await res.json();
        if (!res.ok) {
          setHeaderError(json.error ?? 'Failed to load employee');
          setHeader(null);
          return;
        }
        setHeader(json);
      })
      .catch(() => setHeaderError('Failed to load employee'))
      .finally(() => setLoadingHeader(false));
  }, [employeeId]);

  const fetchLifecycle = useCallback(() => {
    fetch(`/api/employees/${employeeId}/lifecycle`)
      .then(async (res) => (res.ok ? ((await res.json()) as LifecycleInfo) : null))
      .then((info) => setLifecycle(info))
      .catch(() => setLifecycle(null));
  }, [employeeId]);

  useEffect(() => {
    fetchLifecycle();
  }, [fetchLifecycle]);

  useEffect(() => {
    fetchHeader();
    Promise.all([
      fetchAllMaster('companies'),
      fetchAllMaster('departments'),
      fetchAllMaster('sub-departments'),
      fetchAllMaster('designations'),
      fetchAllMaster('employee-types'),
      fetchAllMaster('categories'),
      fetchAllMaster('grades'),
      fetchAllMaster('levels'),
      fetchAllMaster('units'),
      fetchAllMaster('shift-masters'),
      fetchAllMaster('shift-rotation-plans'),
      fetchEmployeeRefs(Number(employeeId)),
      fetchAllMaster('asset-masters'),
    ]).then(
      ([co, dept, subDept, desig, empType, cat, grade, level, unit, shiftM, shiftR, mgrs, assetM]) => {
        setCompanies(co);
        setDepartments(dept);
        setSubDepartments(subDept);
        setDesignations(desig);
        setEmployeeTypes(empType);
        setCategories(cat);
        setGrades(grade);
        setLevels(level);
        setUnits(unit);
        setShiftMasters(shiftM);
        setShiftRotationPlans(shiftR);
        setReportingManagers(mgrs);
        setAssetMasters(assetM);
      }
    );
  }, [fetchHeader, employeeId]);

  // Function form — the Level select is narrowed to the Grade currently
  // chosen on the form, which only ProfileTabForm's own values can drive.
  const basicFields = useCallback(
    (v: FormValues) =>
      buildBasicFields(
        {
          companies, units, departments, subDepartments, designations,
          employeeTypes, categories, grades, levels, shiftMasters, shiftRotationPlans,
          reportingManagers,
        },
        v
      ),
    [companies, units, departments, subDepartments, designations, employeeTypes, categories, grades, levels, shiftMasters, shiftRotationPlans, reportingManagers]
  );

  const personalFields: FieldDef[] = useMemo(() => buildPersonalFields(), []);
  // Function form — Contact Details' present-address fields need to be
  // disabled/re-enabled live as "Present Same as Permanent" is toggled,
  // which only ProfileTabForm's own internal values can drive.
  const contactFields = useCallback(
    (v: Record<string, string | number | boolean | undefined>) => buildContactFields(Boolean(v.sameAsPermanent)),
    []
  );
  const jobProfileFields: FieldDef[] = useMemo(() => buildJobProfileFields(), []);

  if (loadingHeader) {
    return (
      <div className="p-6 text-sm" style={{ color: 'var(--foreground-muted)' }}>
        Loading employee profile...
      </div>
    );
  }

  const handleToggleActive = async () => {
    if (!header) return;
    setToggling(true);
    setToggleError(null);
    try {
      const res = await fetch(`/api/employees/${employeeId}${header.isActive ? '' : '/reactivate'}`, {
        method: header.isActive ? 'DELETE' : 'POST',
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error ?? 'Action failed');
      }
      setConfirmToggle(false);
      fetchHeader();
    } catch (err) {
      setToggleError(err instanceof Error ? err.message : 'Action failed');
    } finally {
      setToggling(false);
    }
  };

  if (headerError || !header) {
    return (
      <div className="card p-8 text-center space-y-3">
        <p className="text-sm font-medium" style={{ color: 'var(--danger)' }}>
          {headerError ?? 'Employee not found'}
        </p>
        <div className="flex items-center justify-center gap-3">
          <button
            onClick={fetchHeader}
            className="rounded-lg border px-4 py-2 text-sm font-medium transition hover:opacity-80"
            style={{ borderColor: 'var(--border)', color: 'var(--foreground)' }}
          >
            Retry
          </button>
          <Link
            href="/employees"
            className="rounded-lg px-4 py-2 text-sm font-medium text-white transition hover:opacity-90"
            style={{ backgroundColor: 'var(--accent)' }}
          >
            Back to Employee Master
          </Link>
        </div>
      </div>
    );
  }

  const siblingName = (s: SiblingRef) => `${s.firstName} ${s.lastName}`;
  const siblingCode = (s: SiblingRef) => s.oldEmployeeCode ?? s.employeeCode;

  return (
    <div className="space-y-4">
      {/* Page title */}
      <div className="flex items-center gap-3">
        <Link
          href="/employees"
          aria-label="Back to Employee Master"
          className="inline-flex h-8 w-8 items-center justify-center rounded-lg transition hover:opacity-70"
          style={{ color: 'var(--foreground)' }}
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="m12 19-7-7 7-7" /><path d="M19 12H5" />
          </svg>
        </Link>
        <h1 className="text-xl font-semibold" style={{ color: 'var(--foreground)' }}>
          Employee Details
        </h1>
      </div>

      {/* Profile header */}
      <div className="card flex flex-wrap items-center gap-5 p-5">
        <EmployeeAvatarUpload
          employeeId={header.id}
          firstName={header.firstName}
          lastName={header.lastName}
          photoPath={header.profilePhotoPath}
          size={88}
          onChanged={(profilePhotoPath) => setHeader((h) => (h ? { ...h, profilePhotoPath } : h))}
        />
        <div className="min-w-[240px] flex-1 space-y-2">
          <h2 className="text-lg font-semibold" style={{ color: 'var(--foreground)' }}>
            {header.title ? `${header.title} ` : ''}
            {header.firstName} {header.middleName ?? ''} {header.lastName}
          </h2>
          <div className="flex flex-wrap items-center gap-2">
            <span
              className="rounded-md px-2 py-0.5 text-xs font-medium"
              style={{ backgroundColor: 'var(--surface-muted)', color: 'var(--foreground)' }}
            >
              {header.oldEmployeeCode ?? header.employeeCode}
            </span>
            <StatusPill status={header.status} />
            <LifecycleBadge state={lifecycle?.state ?? header.lifecycleState} />
            {!header.isActive && (
              <span className="rounded-full px-2 py-0.5 text-xs font-medium" style={{ backgroundColor: 'var(--danger-soft)', color: 'var(--danger)' }}>
                Inactive
              </span>
            )}
          </div>
          <div className="flex flex-wrap items-center gap-x-5 gap-y-1 text-sm" style={{ color: 'var(--foreground)' }}>
            <span className="inline-flex items-center gap-1.5">
              <span style={{ color: 'var(--foreground-muted)' }}><SectionIcon.Briefcase /></span>
              {header.department?.name ?? '—'}
            </span>
            <span className="inline-flex items-center gap-1.5">
              <span style={{ color: 'var(--foreground-muted)' }}><SectionIcon.User /></span>
              {header.designation?.name ?? '—'}
            </span>
            <span className="inline-flex items-center gap-1.5">
              <span style={{ color: 'var(--foreground-muted)' }}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M8 2v4" /><path d="M16 2v4" /><rect width="18" height="18" x="3" y="4" rx="2" /><path d="M3 10h18" />
                </svg>
              </span>
              Joined On {formatDate(header.joinDate)}
            </span>
            {header.confirmationDate && (
              <span className="inline-flex items-center gap-1.5">
                <span style={{ color: 'var(--foreground-muted)' }}><SectionIcon.Shield /></span>
                Confirmed {formatDate(header.confirmationDate)}
              </span>
            )}
          </div>
        </div>

        {/* Right column: prev/next navigator + secondary actions */}
        <div className="flex flex-col items-end gap-2">
          <div
            className="flex items-stretch rounded-xl border"
            style={{ borderColor: 'var(--accent-soft)', backgroundColor: 'var(--accent-soft)' }}
          >
            <SiblingNav
              direction="prev"
              label="Previous Employee"
              sibling={header.prev}
              code={header.prev ? siblingCode(header.prev) : undefined}
              name={header.prev ? siblingName(header.prev) : undefined}
            />
            <div className="my-3 w-px" style={{ backgroundColor: 'var(--border)' }} />
            <SiblingNav
              direction="next"
              label="Next Employee"
              sibling={header.next}
              code={header.next ? siblingCode(header.next) : undefined}
              name={header.next ? siblingName(header.next) : undefined}
            />
          </div>
          <div className="flex items-center gap-2">
            {lifecycle && lifecycle.allowedTargets.length > 0 && (
              <button
                type="button"
                onClick={() => setChangeStateOpen(true)}
                className="rounded-lg border px-3 py-1.5 text-xs font-medium transition hover:opacity-80"
                style={{ borderColor: 'var(--accent)', color: 'var(--accent)' }}
              >
                Change State
              </button>
            )}
            {header.confirmationDate && (
              <a
                href={`/api/employees/${employeeId}/confirmation/letter`}
                className="rounded-lg border px-3 py-1.5 text-xs font-medium transition hover:opacity-80"
                style={{ borderColor: 'var(--accent)', color: 'var(--accent)' }}
              >
                Confirmation Letter
              </a>
            )}
            <button
              onClick={() => setConfirmToggle(true)}
              className="rounded-lg border px-3 py-1.5 text-xs font-medium transition hover:opacity-80"
              style={
                header.isActive
                  ? { borderColor: 'var(--danger)', color: 'var(--danger)' }
                  : { borderColor: 'var(--accent)', color: 'var(--accent)' }
              }
            >
              {header.isActive ? 'Deactivate' : 'Reactivate'}
            </button>
          </div>
        </div>
      </div>

      {toggleError && (
        <div className="rounded-lg px-3 py-2 text-sm" style={{ backgroundColor: 'var(--danger-soft)', color: 'var(--danger)' }}>
          {toggleError}
        </div>
      )}

      <ConfirmDialog
        title={header.isActive ? 'Deactivate Employee' : 'Reactivate Employee'}
        message={
          header.isActive
            ? `Deactivate ${header.firstName} ${header.lastName}? They will be marked inactive; all their data is preserved and this can be reversed at any time.`
            : `Reactivate ${header.firstName} ${header.lastName}?`
        }
        isOpen={confirmToggle}
        onConfirm={handleToggleActive}
        onClose={() => setConfirmToggle(false)}
        confirmLabel={toggling ? 'Working...' : header.isActive ? 'Deactivate' : 'Reactivate'}
      />

      <LifecycleChangeModal
        employeeId={employeeId}
        lifecycle={lifecycle}
        isOpen={changeStateOpen}
        onClose={() => setChangeStateOpen(false)}
        onChanged={() => {
          fetchLifecycle();
          fetchHeader();
        }}
      />

      {/* Tab strip */}
      <div className="card overflow-x-auto p-2">
        <div className="flex min-w-max items-center gap-1" role="tablist">
          {TABS.map((tab) => {
            const active = activeTab === tab.key;
            return (
              <button
                key={tab.key}
                role="tab"
                aria-selected={active}
                onClick={() => handleTabClick(tab.key)}
                className="whitespace-nowrap rounded-full px-4 py-2 text-sm font-medium transition"
                style={{
                  backgroundColor: active ? 'var(--accent)' : 'transparent',
                  color: active ? '#fff' : 'var(--foreground-muted)',
                }}
                onMouseEnter={(e) => { if (!active) e.currentTarget.style.backgroundColor = 'var(--surface-hover)'; }}
                onMouseLeave={(e) => { if (!active) e.currentTarget.style.backgroundColor = 'transparent'; }}
              >
                {tab.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* Tab content */}
      {activeTab === 'basic' && (
        <ProfileTabForm
          key={activeTab}
          title="Basic Details"
          icon={<SectionIcon.IdCard />}
          fetchUrl={`/api/employees/${employeeId}/basic`}
          saveUrl={`/api/employees/${employeeId}/basic`}
          fields={basicFields}
          onSaved={fetchHeader}
          onDirtyChange={setActiveTabDirty}
        />
      )}
      {activeTab === 'personal' && (
        <div className="space-y-4">
          <ProfileTabForm
            key="personal"
            title="Personal Details"
            icon={<SectionIcon.User />}
            fetchUrl={`/api/employees/${employeeId}/personal`}
            saveUrl={`/api/employees/${employeeId}/personal`}
            fields={personalFields}
            onDirtyChange={setActiveTabDirty}
          />
          <ProfileTabForm
            key="contact"
            title="Contact Details"
            icon={<SectionIcon.Phone />}
            fetchUrl={`/api/employees/${employeeId}/contact`}
            saveUrl={`/api/employees/${employeeId}/contact`}
            fields={contactFields}
            onDirtyChange={setActiveTabDirty}
          />
          <RepeatableListTab<EmergencyContactRow>
            apiBasePath={`/api/employees/${employeeId}/emergency-contacts`}
            title="Emergency Contacts"
            icon={<SectionIcon.Phone />}
            addLabel="+ Add Emergency Contact"
            fields={buildEmergencyContactFields()}
            emptyMessage="No emergency contacts yet."
            columns={[
              { key: 'contactName', label: 'Name' },
              { key: 'relationship', label: 'Relationship' },
              { key: 'mobile', label: 'Phone Number', render: (r) => r.mobile ?? '—' },
              {
                key: 'isPrimary',
                label: 'Primary',
                render: (r) => (r.isPrimary ? <span style={{ color: 'var(--accent)' }}>Primary</span> : '—'),
              },
            ]}
          />
        </div>
      )}
      {activeTab === 'job_profile' && (
        <div className="space-y-4">
          <ProfileTabForm
            key={activeTab}
            title="Job Profile"
            icon={<SectionIcon.Briefcase />}
            fetchUrl={`/api/employees/${employeeId}/job-profile`}
            saveUrl={`/api/employees/${employeeId}/job-profile`}
            fields={jobProfileFields}
            onDirtyChange={setActiveTabDirty}
          />
          <JobHistorySection
            employeeId={employeeId}
            masters={{ departments, subDepartments, designations, grades, levels, employeeTypes, categories, units, reportingManagers }}
          />
        </div>
      )}
      {activeTab === 'salary' && (
        <div className="space-y-4">
          <EmployeeSalaryTab employeeId={employeeId} />
          <EmployeeCtcTab employeeId={employeeId} />
        </div>
      )}
      {activeTab === 'education' && (
        <div className="space-y-4">
          <RepeatableListTab<EducationRow>
            apiBasePath={`/api/employees/${employeeId}/education`}
            title="Education"
            icon={<SectionIcon.GraduationCap />}
            addLabel="+ Add Education"
            fields={buildEducationFields()}
            emptyMessage="No education records yet."
            columns={[
              { key: 'qualification', label: 'Qualification' },
              { key: 'institution', label: 'Institution', render: (r) => r.institution ?? '—' },
              { key: 'university', label: 'University', render: (r) => r.university ?? '—' },
              { key: 'yearOfPassing', label: 'Year', render: (r) => r.yearOfPassing ?? '—' },
              { key: 'percentage', label: '%', render: (r) => r.percentage ?? '—' },
            ]}
          />
          <RepeatableListTab<ExperienceRow>
            apiBasePath={`/api/employees/${employeeId}/experience`}
            title="Experience"
            icon={<SectionIcon.Briefcase />}
            addLabel="+ Add Experience"
            fields={buildExperienceFields()}
            emptyMessage="No experience records yet."
            columns={[
              { key: 'companyName', label: 'Company' },
              { key: 'designation', label: 'Designation' },
              { key: 'fromDate', label: 'From', render: (r) => formatDate(r.fromDate) },
              { key: 'toDate', label: 'To', render: (r) => (r.toDate ? formatDate(r.toDate) : 'Current') },
              { key: 'lastDrawnSalary', label: 'Last Drawn Salary', render: (r) => r.lastDrawnSalary ?? '—' },
            ]}
          />
        </div>
      )}
      {activeTab === 'passport' && (
        <ProfileTabForm
          key={activeTab}
          title="Passport"
          icon={<SectionIcon.Passport />}
          fetchUrl={`/api/employees/${employeeId}/passport`}
          saveUrl={`/api/employees/${employeeId}/passport`}
          fields={buildPassportFields()}
        />
      )}
      {activeTab === 'dependents' && (
        <RepeatableListTab<DependentRow>
          apiBasePath={`/api/employees/${employeeId}/dependents`}
          title="Dependents"
          icon={<SectionIcon.Users />}
          addLabel="+ Add Dependent"
          fields={buildDependentFields()}
          emptyMessage="No dependents added yet."
          columns={[
            { key: 'name', label: 'Name' },
            { key: 'relationship', label: 'Relationship' },
            { key: 'dateOfBirth', label: 'Date of Birth', render: (r) => formatDate(r.dateOfBirth) },
            { key: 'isDependent', label: 'Is Dependent', render: (r) => (r.isDependent ? 'Yes' : 'No') },
          ]}
        />
      )}
      {activeTab === 'benefits' && (
        <EmployeeBenefitsTab employeeId={employeeId} onDirtyChange={setActiveTabDirty} />
      )}
      {activeTab === 'skills' && (
        <RepeatableListTab<SkillRow>
          apiBasePath={`/api/employees/${employeeId}/skills`}
          title="Skill Matrix"
          icon={<SectionIcon.Award />}
          addLabel="+ Add Skill"
          fields={buildSkillFields()}
          emptyMessage="No skills recorded yet."
          columns={[
            { key: 'skillName', label: 'Skill / Machine / Operation' },
            { key: 'skillCategory', label: 'Category', render: (r) => r.skillCategory ?? '—' },
            { key: 'proficiencyLevel', label: 'Proficiency', render: (r) => r.proficiencyLevel ?? '—' },
            { key: 'certified', label: 'Certified', render: (r) => (r.certified ? 'Yes' : 'No') },
            { key: 'expiryDate', label: 'Expiry', render: (r) => (r.expiryDate ? r.expiryDate.slice(0, 10) : '—') },
          ]}
        />
      )}
      {activeTab === 'assets' && (
        <RepeatableListTab<AssetRow>
          apiBasePath={`/api/employees/${employeeId}/assets`}
          title="Assets"
          icon={<SectionIcon.Laptop />}
          addLabel="+ Allocate Asset"
          fields={buildAssetFields(assetMasters)}
          emptyMessage="No assets allocated yet."
          toFormValues={(r) => ({
            assetMasterId: r.assetMasterId,
            serialNumber: r.serialNumber ?? undefined,
            model: r.model ?? undefined,
            assetValue: r.assetValue ?? undefined,
            allocatedDate: r.allocatedDate.slice(0, 10),
            expectedReturnDate: r.expectedReturnDate ? r.expectedReturnDate.slice(0, 10) : undefined,
            returnedDate: r.returnedDate ? r.returnedDate.slice(0, 10) : undefined,
          })}
          columns={[
            { key: 'assetTypeName', label: 'Asset Type' },
            { key: 'serialNumber', label: 'Serial Number', render: (r) => r.serialNumber ?? '—' },
            { key: 'model', label: 'Model', render: (r) => r.model ?? '—' },
            { key: 'allocatedDate', label: 'Issue Date', render: (r) => r.allocatedDate.slice(0, 10) },
            {
              key: 'returnedDate',
              label: 'Status',
              render: (r) =>
                r.returnedDate ? (
                  `Returned ${r.returnedDate.slice(0, 10)}`
                ) : (
                  <span style={{ color: 'var(--accent)' }}>Active</span>
                ),
            },
          ]}
        />
      )}
      {activeTab === 'kyc' && (
        <div className="space-y-4">
          <ProfileTabForm
            key={activeTab}
            title="KYC & Statutory"
            icon={<SectionIcon.Shield />}
            fetchUrl={`/api/employees/${employeeId}/kyc`}
            saveUrl={`/api/employees/${employeeId}/kyc`}
            fields={buildKycFields()}
          />
          <KycRevealPanel employeeId={employeeId} />
        </div>
      )}
      {activeTab === 'activity' && <EmployeeActivityTab employeeId={employeeId} />}
    </div>
  );
}

/** One half of the "Previous / Next Employee" navigator in the profile header. */
function SiblingNav({
  direction,
  label,
  sibling,
  code,
  name,
}: {
  direction: 'prev' | 'next';
  label: string;
  sibling: SiblingRef | null;
  code?: string;
  name?: string;
}) {
  const arrow = (
    <span
      className="inline-flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full border"
      style={{ borderColor: 'var(--accent)', color: 'var(--accent)', opacity: sibling ? 1 : 0.4 }}
    >
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        {direction === 'prev' ? <><path d="m12 19-7-7 7-7" /><path d="M19 12H5" /></> : <><path d="M5 12h14" /><path d="m12 5 7 7-7 7" /></>}
      </svg>
    </span>
  );
  const text = (
    <span className="min-w-[120px]">
      <span className="block text-xs" style={{ color: 'var(--foreground-muted)' }}>{label}</span>
      <span className="block text-sm font-semibold" style={{ color: 'var(--foreground)' }}>{code ?? '—'}</span>
      <span className="block text-xs" style={{ color: 'var(--foreground-muted)' }}>{name ?? 'None'}</span>
    </span>
  );
  const inner = direction === 'prev' ? <>{arrow}{text}</> : <>{text}{arrow}</>;
  const cls = `flex items-center gap-3 px-4 py-3 ${direction === 'next' ? 'text-right' : ''}`;

  if (!sibling) {
    return <div className={cls} aria-disabled="true">{inner}</div>;
  }
  return (
    <Link href={`/employees/${sibling.id}`} className={`${cls} rounded-xl transition hover:opacity-80`}>
      {inner}
    </Link>
  );
}
