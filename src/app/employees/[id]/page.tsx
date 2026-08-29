/**
 * Employee Profile — header + 15-tab shell.
 *
 * Phase 1 wires 4 tabs end-to-end (Basic, Personal, Contact, Job Profile)
 * with real lazy-loaded data and atomic per-tab saves. The remaining 11 tabs
 * render a "Coming in Phase 2" placeholder — present in the tab strip per
 * the spec's shell requirement, but not claiming to be functional yet.
 */

'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { Field, DataTable, FormModal, ConfirmDialog, type FieldDef, type Column } from '@/components/ui';
import RepeatableListTab from '@/components/employees/RepeatableListTab';
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

type TabKey =
  | 'basic' | 'personal' | 'contact' | 'job_profile'
  | 'salary' | 'ctc' | 'education' | 'experience' | 'emergency'
  | 'passport' | 'dependents' | 'assets' | 'skills' | 'kyc' | 'activity';

const TABS: { key: TabKey; label: string; built: boolean }[] = [
  { key: 'basic', label: 'Basic Details', built: true },
  { key: 'personal', label: 'Personal Details', built: true },
  { key: 'contact', label: 'Contact Details', built: true },
  { key: 'job_profile', label: 'Job Profile', built: true },
  { key: 'salary', label: 'Salary Details', built: true },
  { key: 'ctc', label: 'CTC Details', built: true },
  { key: 'education', label: 'Education', built: true },
  { key: 'experience', label: 'Experience', built: true },
  { key: 'emergency', label: 'Emergency Contacts', built: true },
  { key: 'passport', label: 'Passport', built: true },
  { key: 'dependents', label: 'Dependents', built: true },
  { key: 'assets', label: 'Assets', built: true },
  { key: 'skills', label: 'Skill Matrix', built: true },
  { key: 'kyc', label: 'KYC & Statutory', built: true },
  { key: 'activity', label: 'Activity', built: true },
];

interface ProfileHeader {
  id: number;
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
  isActive: boolean;
  reportingManager: { id: number; firstName: string; lastName: string; employeeCode: string } | null;
  department: { id: number; name: string } | null;
  designation: { id: number; name: string } | null;
  joinDate: string | null;
  confirmationDate: string | null;
}

/** Generic lazy-loaded, per-tab form: fetch on first activation, atomic PUT save. */
function ProfileTabForm({
  fetchUrl,
  saveUrl,
  fields,
  onSaved,
  onDirtyChange,
}: {
  fetchUrl: string;
  saveUrl: string;
  fields: FieldDef[] | ((values: Record<string, string | number | boolean | undefined>) => FieldDef[]);
  onSaved?: () => void;
  onDirtyChange?: (dirty: boolean) => void;
}) {
  const [values, setValues] = useState<Record<string, string | number | boolean | undefined>>({});
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
        throw new Error(err.error ?? 'Save failed');
      }
      setDirty(false);
      setSaved(true);
      onSaved?.();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Save failed');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="card p-6 text-sm" style={{ color: 'var(--foreground-muted)' }}>
        Loading...
      </div>
    );
  }

  return (
    <div className="card p-5 space-y-4">
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {resolvedFields.map((f) => (
          <Field key={f.name} def={f} value={values[f.name]} onChange={(v) => handleChange(f.name, v)} />
        ))}
      </div>

      {error && (
        <div className="rounded-lg px-3 py-2 text-sm" style={{ backgroundColor: 'var(--danger-soft)', color: 'var(--danger)' }}>
          {error}
        </div>
      )}
      {saved && !dirty && (
        <div className="rounded-lg px-3 py-2 text-sm" style={{ backgroundColor: 'var(--success-soft)', color: 'var(--success)' }}>
          Saved.
        </div>
      )}

      <div className="flex justify-end">
        <button
          onClick={handleSave}
          disabled={saving || !dirty}
          className="rounded-lg px-4 py-2 text-sm font-medium text-white transition disabled:opacity-50"
          style={{ backgroundColor: 'var(--accent)' }}
        >
          {saving ? 'Saving...' : 'Save'}
        </button>
      </div>
    </div>
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

  return (
    <div className="card p-5 space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold" style={{ color: 'var(--foreground)' }}>CTC Details</h2>
        <button
          onClick={() => setModalOpen(true)}
          className="rounded-lg px-3 py-1.5 text-xs font-medium text-white transition hover:opacity-90"
          style={{ backgroundColor: 'var(--accent)' }}
        >
          + New Revision
        </button>
      </div>
      {error && (
        <div className="rounded-lg px-3 py-2 text-sm" style={{ backgroundColor: 'var(--danger-soft)', color: 'var(--danger)' }}>{error}</div>
      )}
      <DataTable columns={columns} data={rows} loading={loading} emptyMessage="No CTC revisions recorded yet." />
      <FormModal
        title="New CTC Revision"
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
        submitLabel="Add"
      />
    </div>
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
        r.components.length
          ? r.components.map((c) => `${c.salaryComponent.name}: ${c.amount}`).join(', ')
          : '—',
    },
  ];

  return (
    <div className="card p-5 space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold" style={{ color: 'var(--foreground)' }}>Salary Details</h2>
        <button
          onClick={() => setFormOpen((o) => !o)}
          className="rounded-lg px-3 py-1.5 text-xs font-medium text-white transition hover:opacity-90"
          style={{ backgroundColor: 'var(--accent)' }}
        >
          {formOpen ? 'Cancel' : '+ New Revision'}
        </button>
      </div>

      {formOpen && (
        <div className="rounded-lg border p-4 space-y-3" style={{ borderColor: 'var(--border)' }}>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
            <div>
              <label className="text-xs font-medium" style={{ color: 'var(--foreground)' }}>Financial Year</label>
              <input value={financialYear} onChange={(e) => setFinancialYear(e.target.value)} placeholder="e.g. 2026-27" className="mt-1 w-full rounded-lg border px-3 py-2 text-sm" style={{ borderColor: 'var(--border)', backgroundColor: 'var(--surface)', color: 'var(--foreground)' }} />
            </div>
            <div>
              <label className="text-xs font-medium" style={{ color: 'var(--foreground)' }}>Gross Salary *</label>
              <input type="number" min={0} value={grossSalary} onChange={(e) => setGrossSalary(e.target.value)} className="mt-1 w-full rounded-lg border px-3 py-2 text-sm" style={{ borderColor: 'var(--border)', backgroundColor: 'var(--surface)', color: 'var(--foreground)' }} />
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
              {saving ? 'Saving...' : 'Add Revision'}
            </button>
          </div>
        </div>
      )}

      <DataTable columns={columns} data={rows} loading={loading} emptyMessage="No salary revisions recorded yet." />
    </div>
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
    <div className="card p-5 space-y-4">
      <h2 className="text-sm font-semibold" style={{ color: 'var(--foreground)' }}>
        Activity
      </h2>
      <DataTable columns={columns} data={items} loading={loading} emptyMessage="No activity recorded for this employee yet." />
    </div>
  );
}

/**
 * Reveals the real PAN/Aadhaar values for the KYC tab, gated server-side by
 * employee.kyc.reveal — a permission distinct from employee.kyc.view (the
 * base tab only ever sees masked values). Every reveal is server-logged.
 */
function KycRevealPanel({ employeeId }: { employeeId: string }) {
  const [revealed, setRevealed] = useState<{ panNumber: string | null; aadhaarNumber: string | null } | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleReveal = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/employees/${employeeId}/kyc/reveal`, { method: 'POST' });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? 'Failed to reveal');
      setRevealed(json);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to reveal');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="card p-5 space-y-3">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold" style={{ color: 'var(--foreground)' }}>
          Sensitive Fields
        </h2>
        {revealed ? (
          <button
            onClick={() => setRevealed(null)}
            className="rounded-lg border px-3 py-1.5 text-xs font-medium transition hover:opacity-80"
            style={{ borderColor: 'var(--border)', color: 'var(--foreground)' }}
          >
            Hide
          </button>
        ) : (
          <button
            onClick={handleReveal}
            disabled={loading}
            className="rounded-lg px-3 py-1.5 text-xs font-medium text-white transition hover:opacity-90 disabled:opacity-50"
            style={{ backgroundColor: 'var(--accent)' }}
          >
            {loading ? 'Revealing...' : 'Reveal PAN / Aadhaar'}
          </button>
        )}
      </div>
      {error && (
        <div className="rounded-lg px-3 py-2 text-sm" style={{ backgroundColor: 'var(--danger-soft)', color: 'var(--danger)' }}>
          {error}
        </div>
      )}
      {revealed && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
          <div>
            <div className="text-xs uppercase tracking-wide" style={{ color: 'var(--foreground-muted)' }}>PAN Number</div>
            <div style={{ color: 'var(--foreground)' }}>{revealed.panNumber ?? '—'}</div>
          </div>
          <div>
            <div className="text-xs uppercase tracking-wide" style={{ color: 'var(--foreground-muted)' }}>Aadhaar Number</div>
            <div style={{ color: 'var(--foreground)' }}>{revealed.aadhaarNumber ?? '—'}</div>
          </div>
        </div>
      )}
    </div>
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
  const [shiftPlans, setShiftPlans] = useState<OptionList>([]);
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
      fetchAllMaster('shift-plans'),
      fetchEmployeeRefs(Number(employeeId)),
      fetchAllMaster('asset-masters'),
    ]).then(
      ([co, dept, subDept, desig, empType, cat, grade, level, unit, shiftM, shiftP, mgrs, assetM]) => {
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
        setShiftPlans(shiftP);
        setReportingManagers(mgrs);
        setAssetMasters(assetM);
      }
    );
  }, [fetchHeader, employeeId]);

  const basicFields: FieldDef[] = useMemo(
    () =>
      buildBasicFields({
        companies, units, departments, subDepartments, designations,
        employeeTypes, categories, grades, levels, shiftMasters, shiftPlans,
        reportingManagers,
      }),
    [companies, units, departments, subDepartments, designations, employeeTypes, categories, grades, levels, shiftMasters, shiftPlans, reportingManagers]
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

  return (
    <div className="space-y-4">
      {/* Profile header */}
      <div className="card p-5 flex flex-wrap items-center gap-4">
        <div
          className="h-14 w-14 rounded-full flex items-center justify-center text-lg font-semibold flex-shrink-0"
          style={{ backgroundColor: 'var(--accent-soft)', color: 'var(--accent)' }}
        >
          {header.firstName[0]}
          {header.lastName[0]}
        </div>
        <div className="flex-1 min-w-[220px]">
          <h1 className="text-lg font-semibold flex items-center gap-2" style={{ color: 'var(--foreground)' }}>
            {header.title ? `${header.title} ` : ''}
            {header.firstName} {header.middleName ?? ''} {header.lastName}
            {!header.isActive && (
              <span
                className="px-2 py-0.5 text-xs font-medium rounded-full"
                style={{ backgroundColor: 'var(--danger-soft)', color: 'var(--danger)' }}
              >
                Inactive
              </span>
            )}
          </h1>
          <p className="text-sm" style={{ color: 'var(--foreground-muted)' }}>
            {header.oldEmployeeCode ?? header.employeeCode} · {header.designation?.name ?? '—'} · {header.department?.name ?? '—'}
          </p>
        </div>
        <div className="flex flex-wrap gap-4 text-sm" style={{ color: 'var(--foreground-muted)' }}>
          <div>
            <div className="text-xs uppercase tracking-wide">Reporting Manager</div>
            <div style={{ color: 'var(--foreground)' }}>
              {header.reportingManager
                ? `${header.reportingManager.firstName} ${header.reportingManager.lastName}`
                : '—'}
            </div>
          </div>
          <div>
            <div className="text-xs uppercase tracking-wide">Status</div>
            <div style={{ color: 'var(--foreground)' }}>{header.status}</div>
          </div>
          <div>
            <div className="text-xs uppercase tracking-wide">Joining Date</div>
            <div style={{ color: 'var(--foreground)' }}>
              {header.joinDate ? header.joinDate.slice(0, 10) : '—'}
            </div>
          </div>
          {header.confirmationDate && (
            <div>
              <div className="text-xs uppercase tracking-wide">Confirmation Date</div>
              <div style={{ color: 'var(--foreground)' }}>{header.confirmationDate.slice(0, 10)}</div>
            </div>
          )}
        </div>
        {header.confirmationDate && (
          <a
            href={`/api/employees/${employeeId}/confirmation/letter`}
            className="rounded-lg border px-3 py-1.5 text-xs font-medium transition hover:opacity-80"
            style={{ borderColor: 'var(--accent)', color: 'var(--accent)' }}
          >
            Download Confirmation Letter
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

      {/* Tab strip */}
      <div className="flex flex-wrap gap-1 border-b" style={{ borderColor: 'var(--border)' }}>
        {TABS.map((tab) => (
          <button
            key={tab.key}
            onClick={() => handleTabClick(tab.key)}
            className="px-3 py-2 text-sm font-medium rounded-t-lg transition"
            style={{
              color: activeTab === tab.key ? 'var(--accent)' : 'var(--foreground-muted)',
              borderBottom: activeTab === tab.key ? '2px solid var(--accent)' : '2px solid transparent',
            }}
          >
            {tab.label}
            {!tab.built && <span className="ml-1 text-[10px] opacity-60">(Coming soon)</span>}
          </button>
        ))}
      </div>

      {/* Tab content */}
      {activeTab === 'basic' && (
        <ProfileTabForm
          key={activeTab}
          fetchUrl={`/api/employees/${employeeId}/basic`}
          saveUrl={`/api/employees/${employeeId}/basic`}
          fields={basicFields}
          onSaved={fetchHeader}
          onDirtyChange={setActiveTabDirty}
        />
      )}
      {activeTab === 'personal' && (
        <ProfileTabForm
          key={activeTab}
          fetchUrl={`/api/employees/${employeeId}/personal`}
          saveUrl={`/api/employees/${employeeId}/personal`}
          fields={personalFields}
          onDirtyChange={setActiveTabDirty}
        />
      )}
      {activeTab === 'contact' && (
        <ProfileTabForm
          key={activeTab}
          fetchUrl={`/api/employees/${employeeId}/contact`}
          saveUrl={`/api/employees/${employeeId}/contact`}
          fields={contactFields}
          onDirtyChange={setActiveTabDirty}
        />
      )}
      {activeTab === 'job_profile' && (
        <ProfileTabForm
          key={activeTab}
          fetchUrl={`/api/employees/${employeeId}/job-profile`}
          saveUrl={`/api/employees/${employeeId}/job-profile`}
          fields={jobProfileFields}
          onDirtyChange={setActiveTabDirty}
        />
      )}
      {activeTab === 'salary' && <EmployeeSalaryTab employeeId={employeeId} />}
      {activeTab === 'ctc' && <EmployeeCtcTab employeeId={employeeId} />}
      {activeTab === 'education' && (
        <RepeatableListTab<EducationRow>
          apiBasePath={`/api/employees/${employeeId}/education`}
          title="Education"
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
      )}
      {activeTab === 'experience' && (
        <RepeatableListTab<ExperienceRow>
          apiBasePath={`/api/employees/${employeeId}/experience`}
          title="Experience"
          addLabel="+ Add Experience"
          fields={buildExperienceFields()}
          emptyMessage="No experience records yet."
          columns={[
            { key: 'companyName', label: 'Company' },
            { key: 'designation', label: 'Designation' },
            { key: 'fromDate', label: 'From', render: (r) => r.fromDate.slice(0, 10) },
            { key: 'toDate', label: 'To', render: (r) => (r.toDate ? r.toDate.slice(0, 10) : 'Current') },
            { key: 'lastDrawnSalary', label: 'Last Drawn Salary', render: (r) => r.lastDrawnSalary ?? '—' },
          ]}
        />
      )}
      {activeTab === 'emergency' && (
        <RepeatableListTab<EmergencyContactRow>
          apiBasePath={`/api/employees/${employeeId}/emergency-contacts`}
          title="Emergency Contacts"
          addLabel="+ Add Emergency Contact"
          fields={buildEmergencyContactFields()}
          emptyMessage="No emergency contacts yet."
          columns={[
            { key: 'contactName', label: 'Name' },
            { key: 'relationship', label: 'Relationship' },
            { key: 'mobile', label: 'Mobile', render: (r) => r.mobile ?? '—' },
            {
              key: 'isPrimary',
              label: 'Primary',
              render: (r) =>
                r.isPrimary ? (
                  <span style={{ color: 'var(--accent)' }}>Primary</span>
                ) : (
                  '—'
                ),
            },
          ]}
        />
      )}
      {activeTab === 'passport' && (
        <ProfileTabForm
          key={activeTab}
          fetchUrl={`/api/employees/${employeeId}/passport`}
          saveUrl={`/api/employees/${employeeId}/passport`}
          fields={buildPassportFields()}
        />
      )}
      {activeTab === 'dependents' && (
        <RepeatableListTab<DependentRow>
          apiBasePath={`/api/employees/${employeeId}/dependents`}
          title="Dependents"
          addLabel="+ Add Dependent"
          fields={buildDependentFields()}
          emptyMessage="No dependents added yet."
          columns={[
            { key: 'name', label: 'Name' },
            { key: 'relationship', label: 'Relationship' },
            { key: 'dateOfBirth', label: 'Date of Birth', render: (r) => (r.dateOfBirth ? r.dateOfBirth.slice(0, 10) : '—') },
            { key: 'isDependent', label: 'Is Dependent', render: (r) => (r.isDependent ? 'Yes' : 'No') },
          ]}
        />
      )}
      {activeTab === 'skills' && (
        <RepeatableListTab<SkillRow>
          apiBasePath={`/api/employees/${employeeId}/skills`}
          title="Skill Matrix"
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
          <KycRevealPanel employeeId={employeeId} />
          <ProfileTabForm
            key={activeTab}
            fetchUrl={`/api/employees/${employeeId}/kyc`}
            saveUrl={`/api/employees/${employeeId}/kyc`}
            fields={buildKycFields()}
          />
        </div>
      )}
      {activeTab === 'activity' && <EmployeeActivityTab employeeId={employeeId} />}
      {!TABS.find((t) => t.key === activeTab)?.built && (
        <div className="card p-8 text-center text-sm" style={{ color: 'var(--foreground-muted)' }}>
          {TABS.find((t) => t.key === activeTab)?.label} is coming soon.
        </div>
      )}
    </div>
  );
}
