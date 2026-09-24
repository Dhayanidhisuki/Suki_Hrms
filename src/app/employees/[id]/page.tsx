/**
 * Employee Profile — header + tab shell.
 *
 * Phase 1 wires 4 tabs end-to-end (Basic, Personal, Contact, Job Profile)
 * with real lazy-loaded data and atomic per-tab saves. The remaining 11 tabs
 * render a "Coming in Phase 2" placeholder — present in the tab strip per
 * the spec's shell requirement, but not claiming to be functional yet.
 */

'use client';

import { useState, useEffect, useCallback, useMemo, type ReactNode } from 'react';
import { useParams, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { Field, DataTable, FormModal, ConfirmDialog, useToast, useConfirm, type FieldDef, type Column } from '@/components/ui';
import RepeatableListTab from '@/components/employees/RepeatableListTab';
import EmployeeDocumentsTab from '@/components/employees/EmployeeDocumentsTab';
import EmployeeKraTab from '@/components/employees/EmployeeKraTab';
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
interface CtcComponentRow { id: number; salaryComponentId: number; amount: string; salaryComponent: { id: number; code: string; name: string; grossTier: string } }
interface SalaryComponentRow { salaryComponentId: number; salaryComponent: { name: string; code: string; type: string; grossTier: string }; amount: string; }
interface SalaryRevisionRow { id: number; financialYear: string | null; grossSalary: string; netSalary: string | null; effectiveFrom: string; effectiveTo: string | null; components: SalaryComponentRow[]; }
interface ActivityRow { id: number; activityAt: string; module: string; activityType: string; remarks: string | null; }
interface TrainingHistoryRow {
  id: number;
  programName: string;
  scheduledDate: string | null;
  method: string | null;
  attendanceStatus: string;
  attendancePercent: number | null;
  result: string;
  status: string;
}

/**
 * Tab strip. Contact + Emergency Contacts live inside Personal Details,
 * CTC inside Salary Details, and Experience alongside Education — each of
 * those is still its own API/section card, just stacked on the one tab.
 */
type TabKey =
  | 'basic' | 'personal' | 'job_profile' | 'salary' | 'education'
  | 'passport' | 'dependents' | 'assets' | 'skills' | 'kyc' | 'documents' | 'kra' | 'activity' | 'benefits' | 'training';

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
  { key: 'training', label: 'Training' },
  { key: 'kyc', label: 'KYC & Statutory' },
  { key: 'documents', label: 'Documents' },
  { key: 'kra', label: 'KPI / KRA' },
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
  const toast = useToast();
  const { confirm } = useConfirm();
  const [values, setValues] = useState<FormValues>({});
  const [savedValues, setSavedValues] = useState<FormValues>({});
  const [editing, setEditing] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
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
      .catch(() => toast.error('Failed to load'))
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
  };

  const resolvedFields = typeof fields === 'function' ? fields(values) : fields;

  const handleSave = async () => {
    setSaving(true);
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
      toast.success('Saved.');
      setSavedValues(values);
      setEditing(false);
      onSaved?.();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Save failed');
    } finally {
      setSaving(false);
    }
  };

  const handleCancel = async () => {
    if (
      dirty &&
      !(await confirm({
        title: 'Discard unsaved changes?',
        message: 'Your edits on this tab will be lost.',
        confirmLabel: 'Discard',
        cancelLabel: 'Keep editing',
        tone: 'danger',
      }))
    )
      return;
    setValues(savedValues);
    setDirty(false);
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
        </div>
      ) : (
        <div className="space-y-6">
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
  const toast = useToast();
  const [rows, setRows] = useState<CtcRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [viewRow, setViewRow] = useState<CtcRow | null>(null);
  // Live figures pulled from Salary Details / CTC-only Components — CTC no
  // longer asks for Basic/HRA/allowances/PF/ESI manually; Payroll ("all of
  // that") is Salary Details' job. Monthly CTC = current Actual Gross + sum
  // of current CTC-only (Non-Payroll) components; Annual CTC = ×12.
  const [currentBasic, setCurrentBasic] = useState(0);
  const [currentActualGross, setCurrentActualGross] = useState(0);
  const [currentNonPayrollTotal, setCurrentNonPayrollTotal] = useState(0);
  // Itemized breakdown for the View dialog — same source data as above, kept
  // in full (not just totals) so View can show Earnings/Deductions/Non-Payroll
  // line by line, not just the Monthly/Annual CTC totals.
  const [currentSalaryRevision, setCurrentSalaryRevision] = useState<SalaryRevisionRow | null>(null);
  const [currentDeductionContext, setCurrentDeductionContext] = useState<DeductionContext | null>(null);
  const [currentNonPayrollComponents, setCurrentNonPayrollComponents] = useState<CtcComponentRow[]>([]);

  const fetchData = useCallback(() => {
    setLoading(true);
    fetch(`/api/employees/${employeeId}/ctc`)
      .then((res) => res.json())
      .then((json) => setRows(json.data ?? []))
      .finally(() => setLoading(false));
  }, [employeeId]);

  const fetchLiveFigures = useCallback(() => {
    Promise.all([
      fetch(`/api/employees/${employeeId}/salary`).then((r) => r.json()),
      fetch(`/api/employees/${employeeId}/ctc/components`).then((r) => r.json()).catch(() => ({ data: [] })),
    ]).then(([salaryJson, ctcCompJson]) => {
      const current: SalaryRevisionRow | undefined = (salaryJson.data ?? []).find((r: SalaryRevisionRow) => !r.effectiveTo);
      setCurrentSalaryRevision(current ?? null);
      setCurrentDeductionContext(salaryJson.deductionContext ?? null);
      if (current) {
        const earnings = current.components.filter((c) => c.salaryComponent.type === 'earning');
        const actualGross = round2(earnings.reduce((s, c) => s + Number(c.amount), 0));
        const basicRow = current.components.find((c) => c.salaryComponent.code === 'BASIC');
        setCurrentActualGross(actualGross);
        setCurrentBasic(basicRow ? Number(basicRow.amount) : 0);
      } else {
        setCurrentActualGross(0);
        setCurrentBasic(0);
      }
      const nonPayrollRows: CtcComponentRow[] = ctcCompJson.data ?? [];
      setCurrentNonPayrollComponents(nonPayrollRows);
      const nonPayrollTotal = nonPayrollRows.reduce((s, c) => s + Number(c.amount), 0);
      setCurrentNonPayrollTotal(round2(nonPayrollTotal));
    });
  }, [employeeId]);

  useEffect(() => {
    fetchData();
    fetchLiveFigures();
  }, [fetchData, fetchLiveFigures]);

  const monthlyCtc = round2(currentActualGross + currentNonPayrollTotal);
  // Bonus is a once-a-year figure — added on top of Monthly CTC × 12, not
  // folded into the monthly number itself. CTC uses the projected formula,
  // not the real earned-history sum shown in Salary Details.
  const currentBonusPreview = computeBonusProjection(currentBasic, currentDeductionContext);
  const annualCtc = round2(monthlyCtc * 12 + currentBonusPreview);

  // Only Effective From is actually asked — every other ctcSchema field is
  // auto-derived (Basic/Monthly/Annual from Salary Details + CTC-only
  // Components above) or a legacy breakdown field (HRA, allowances, PF/ESI…)
  // that's no longer entered here at all now that Salary Details/payroll own
  // that data; those all default to 0 silently.
  const ctcFields: FieldDef[] = [
    { name: 'effectiveFrom', label: 'Effective From', type: 'date', required: true },
    { name: 'basic', label: 'Basic', type: 'number', required: true, hidden: true, compute: () => currentBasic },
    { name: 'monthlyCtc', label: 'Monthly CTC', type: 'number', required: true, hidden: true, compute: () => monthlyCtc },
    { name: 'annualCtc', label: 'Annual CTC', type: 'number', required: true, hidden: true, compute: () => annualCtc },
    ...(['hra', 'specialAllowance', 'conveyanceAllowance', 'washAllowance', 'canteen', 'dislocationAllowance', 'otherAllowance', 'shiftAllowance', 'attendanceBonus', 'bonus', 'lta', 'medicalClaim', 'employeePf', 'employeeEsi', 'employerPf', 'employerEsi', 'gratuity', 'otherBenefits', 'nonMonetaryBenefits'] as const).map(
      (name) => ({ name, label: name, type: 'number' as const, defaultValue: 0, hidden: true })
    ),
  ];

  // Refresh — no dialog at all: every field ctcSchema needs is already
  // computed (Effective From = today, everything else from ctcFields'
  // compute/defaultValue), so one click both creates the CTC row and
  // recomputes it against Salary Details' current numbers.
  const [refreshing, setRefreshing] = useState(false);
  const handleRefresh = async () => {
    setRefreshing(true);
    // Full timestamp, not just a date — the server requires strictly-after
    // the current revision's own effectiveFrom, so a same-day Refresh (e.g.
    // clicking it twice today) would otherwise always 409 against a row
    // also created today at midnight.
    const values: Record<string, string | number | boolean> = { effectiveFrom: new Date().toISOString() };
    for (const f of ctcFields) {
      if (f.name === 'effectiveFrom') continue;
      values[f.name] = f.compute ? f.compute(values) : (f.defaultValue ?? 0);
    }
    try {
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
      fetchLiveFigures();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Save failed');
    } finally {
      setRefreshing(false);
    }
  };

  const columns: Column<CtcRow>[] = [
    { key: 'effectiveFrom', label: 'Effective From', render: (r) => r.effectiveFrom.slice(0, 10) },
    { key: 'effectiveTo', label: 'Effective To', render: (r) => (r.effectiveTo ? r.effectiveTo.slice(0, 10) : <span style={{ color: 'var(--accent)' }}>Current</span>) },
    { key: 'monthlyCtc', label: 'Monthly CTC' },
    { key: 'annualCtc', label: 'Annual CTC' },
    { key: 'basic', label: 'Basic' },
    {
      key: 'view',
      label: '',
      render: (r) => (
        <button type="button" onClick={() => setViewRow(r)} className="text-xs font-medium hover:underline" style={{ color: 'var(--accent)' }}>
          View
        </button>
      ),
    },
  ];

  const hasCurrentRevision = !loading && rows.some((r) => !r.effectiveTo);

  return (
    <SectionCard
      title="CTC Details"
      icon={<SectionIcon.Wallet />}
      action={
        <button
          onClick={handleRefresh}
          disabled={refreshing}
          className="rounded-lg px-3 py-1.5 text-xs font-medium text-white transition hover:opacity-90 disabled:opacity-50"
          style={{ backgroundColor: 'var(--accent)' }}
        >
          {refreshing ? 'Refreshing…' : 'Refresh'}
        </button>
      }
    >
      <div className="space-y-4">
      <DataTable columns={columns} data={rows} loading={loading} emptyMessage="No CTC fixed yet." />
      {hasCurrentRevision && <EmployeeCtcComponentsSection employeeId={employeeId} onChange={fetchLiveFigures} />}

      {viewRow && (() => {
        const rev = currentSalaryRevision;
        const earnings = rev ? rev.components.filter((c) => c.salaryComponent.type === 'earning') : [];
        const fixedEarnings = earnings.filter((c) => c.salaryComponent.grossTier === 'FIXED');
        const additionalEarnings = earnings.filter((c) => c.salaryComponent.grossTier !== 'FIXED');
        const fixedGross = round2(fixedEarnings.reduce((s, c) => s + Number(c.amount), 0));
        const additionalGross = round2(additionalEarnings.reduce((s, c) => s + Number(c.amount), 0));
        const actualGross = round2(fixedGross + additionalGross);
        const revCompRows = rev
          ? rev.components.map((c) => ({
              salaryComponentId: String(c.salaryComponentId),
              amount: c.amount,
              source: (c.salaryComponent.grossTier === 'FIXED' ? 'fixed' : 'manual') as 'fixed' | 'manual',
              type: c.salaryComponent.type,
            }))
          : [];
        const d = computeDeductionsShared(String(fixedGross), revCompRows, currentDeductionContext);
        const bonusPreview = computeBonusProjection(currentBasic, currentDeductionContext);
        const monthlyBonus = round2(bonusPreview / 12);
        const monthlyCtc = round2(actualGross + currentNonPayrollTotal + monthlyBonus);
        const annualCtc = round2(monthlyCtc * 12);

        return (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ backgroundColor: 'rgba(0,0,0,0.4)' }} onClick={() => setViewRow(null)}>
            <div
              className="w-full max-w-xl rounded-xl shadow-2xl max-h-[90vh] overflow-y-auto"
              style={{ backgroundColor: 'var(--surface)', border: '1px solid var(--border)' }}
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center justify-between px-5 py-4 border-b" style={{ borderColor: 'var(--border)' }}>
                <h2 className="text-base font-semibold" style={{ color: 'var(--foreground)' }}>
                  CTC — {viewRow.effectiveFrom.slice(0, 10)}
                  {viewRow.effectiveTo ? ` to ${viewRow.effectiveTo.slice(0, 10)}` : ' (Current)'}
                </h2>
                <button onClick={() => setViewRow(null)} className="text-lg leading-none hover:opacity-70" style={{ color: 'var(--foreground-muted)' }}>×</button>
              </div>
              <div className="px-5 py-4 space-y-4 text-sm">
                {!rev ? (
                  <p className="text-xs" style={{ color: 'var(--foreground-muted)' }}>No current Salary Details revision to break down.</p>
                ) : (() => {
                  const fmt = (n: number) => n.toLocaleString('en-IN', { maximumFractionDigits: 2 });

                  const SectionRows = ({
                    title,
                    accent,
                    rows,
                  }: {
                    title: string;
                    accent: string;
                    rows: { key: string; label: string; monthly: number }[];
                  }) => (
                    <>
                      <tr>
                        <td colSpan={3} className="px-3 py-1.5">
                          <div className="flex items-center gap-2 text-xs font-semibold" style={{ color: 'var(--foreground-muted)' }}>
                            <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: accent }} />
                            {title}
                          </div>
                        </td>
                      </tr>
                      {rows.length === 0 ? (
                        <tr>
                          <td colSpan={3} className="px-3 pb-2 text-xs" style={{ color: 'var(--foreground-muted)' }}>—</td>
                        </tr>
                      ) : (
                        rows.map((r) => (
                          <tr key={r.key} className="border-b" style={{ borderColor: 'var(--border)' }}>
                            <td className="px-3 py-1" style={{ color: 'var(--foreground)' }}>{r.label}</td>
                            <td className="px-3 py-1 text-right tabular-nums" style={{ color: 'var(--foreground)' }}>{fmt(r.monthly)}</td>
                            <td className="px-3 py-1 text-right tabular-nums" style={{ color: 'var(--foreground)' }}>{fmt(round2(r.monthly * 12))}</td>
                          </tr>
                        ))
                      )}
                    </>
                  );

                  return (
                    <div className="rounded-lg overflow-hidden" style={{ border: '1px solid var(--border)' }}>
                      <table className="w-full text-sm">
                        <thead>
                          <tr style={{ backgroundColor: 'var(--background-subtle, var(--surface-muted))' }}>
                            <th className="px-3 py-2 text-left text-xs font-semibold uppercase tracking-wide" style={{ color: 'var(--foreground-muted)' }}>Component</th>
                            <th className="px-3 py-2 text-right text-xs font-semibold uppercase tracking-wide" style={{ color: 'var(--foreground-muted)' }}>Per Month</th>
                            <th className="px-3 py-2 text-right text-xs font-semibold uppercase tracking-wide" style={{ color: 'var(--foreground-muted)' }}>Per Annum</th>
                          </tr>
                        </thead>
                        <tbody>
                          <SectionRows
                            title="Earnings — Fixed"
                            accent="#16a34a"
                            rows={fixedEarnings.map((c) => ({ key: c.salaryComponent.code, label: c.salaryComponent.name, monthly: Number(c.amount) }))}
                          />
                          <SectionRows
                            title="Earnings — Additional"
                            accent="#0ea5e9"
                            rows={additionalEarnings.map((c) => ({ key: c.salaryComponent.code, label: c.salaryComponent.name, monthly: Number(c.amount) }))}
                          />
                          <tr style={{ borderTop: '1px solid var(--border)' }}>
                            <td className="px-3 py-1.5" style={{ color: 'var(--foreground)' }}>Actual Gross</td>
                            <td className="px-3 py-1.5 text-right tabular-nums font-medium" style={{ color: 'var(--foreground)' }}>{fmt(actualGross)}</td>
                            <td className="px-3 py-1.5 text-right tabular-nums font-medium" style={{ color: 'var(--foreground)' }}>{fmt(round2(actualGross * 12))}</td>
                          </tr>

                          <SectionRows
                            title="Deductions"
                            accent="#dc2626"
                            rows={[
                              ...(d.pfEmployee > 0 ? [{ key: 'pf', label: 'PF', monthly: d.pfEmployee }] : []),
                              ...(d.esiEmployee > 0 ? [{ key: 'esi', label: 'ESI', monthly: d.esiEmployee }] : []),
                              ...d.otherDeductions.filter((o) => o.amount > 0).map((o) => ({ key: o.code, label: o.name, monthly: o.amount })),
                            ]}
                          />

                          <tr style={{ borderTop: '1px solid var(--border)' }}>
                            <td className="px-3 py-1.5 font-medium" style={{ color: 'var(--foreground)' }}>Net Pay</td>
                            <td className="px-3 py-1.5 text-right tabular-nums font-medium" style={{ color: 'var(--foreground)' }}>{fmt(round2(actualGross - d.total))}</td>
                            <td className="px-3 py-1.5 text-right tabular-nums font-medium" style={{ color: 'var(--foreground)' }}>{fmt(round2((actualGross - d.total) * 12))}</td>
                          </tr>

                          <SectionRows
                            title="Employee Contribution"
                            accent="#a855f7"
                            rows={currentNonPayrollComponents.map((c) => ({ key: String(c.id), label: c.salaryComponent.name, monthly: Number(c.amount) }))}
                          />

                          {bonusPreview > 0 && (
                            <tr>
                              <td className="px-3 py-1.5" style={{ color: 'var(--foreground)' }}>Bonus</td>
                              <td className="px-3 py-1.5 text-right tabular-nums font-medium" style={{ color: 'var(--foreground)' }}>{fmt(monthlyBonus)}</td>
                              <td className="px-3 py-1.5 text-right tabular-nums font-medium" style={{ color: 'var(--foreground)' }}>{fmt(bonusPreview)}</td>
                            </tr>
                          )}
                          <tr style={{ borderTop: '1px solid var(--accent)' }}>
                            <td className="px-3 py-2 font-semibold" style={{ color: 'var(--foreground)' }}>Total CTC</td>
                            <td className="px-3 py-2 text-right tabular-nums font-semibold" style={{ color: 'var(--accent)' }}>{fmt(monthlyCtc)}</td>
                            <td className="px-3 py-2 text-right tabular-nums font-semibold" style={{ color: 'var(--accent)' }}>{fmt(annualCtc)}</td>
                          </tr>
                        </tbody>
                      </table>
                    </div>
                  );
                })()}
                <p className="text-xs" style={{ color: 'var(--foreground-muted)' }}>
                  Computed live from Salary Details&apos; current revision and current CTC-only Components — not the (possibly stale) figures stored on this specific historical row. Bonus is a preview (Basic × Bonus Rate %), not the real annual bonusCalculation.ts figure.
                </p>
              </div>
            </div>
          </div>
        );
      })()}
      </div>
    </SectionCard>
  );
}

/**
 * CTC-only components (e.g. "Performance Incentive: 2135") on the employee's
 * current CTC revision. Restricted to SalaryComponents with grossTier =
 * NON_PAYROLL or PAYROLL_HIDDEN — the API refuses anything else.
 * NON_PAYROLL amounts are never read by payroll; they only feed the
 * Performance Incentive Report. PAYROLL_HIDDEN amounts are the opposite —
 * real earnings/deductions payroll DOES apply to Net Pay (see
 * payrollCalculation.ts) — kept off the Salary Details tab on purpose, but
 * still attached and shown here, same as NON_PAYROLL.
 */
function EmployeeCtcComponentsSection({ employeeId, onChange }: { employeeId: string; onChange?: () => void }) {
  const toast = useToast();
  const [rows, setRows] = useState<CtcComponentRow[]>([]);
  const [options, setOptions] = useState<OptionList>([]);
  const [loading, setLoading] = useState(true);
  const [selectedId, setSelectedId] = useState('');
  const [amount, setAmount] = useState('');

  const fetchData = useCallback(() => {
    setLoading(true);
    Promise.all([
      fetch(`/api/employees/${employeeId}/ctc/components`).then((r) => r.json()),
      fetch('/api/masters/salary-components?grossTier=NON_PAYROLL,PAYROLL_HIDDEN').then((r) => r.json()),
    ])
      .then(([compRes, optRes]) => {
        setRows(compRes.data ?? []);
        setOptions(optRes.data ?? []);
      })
      .finally(() => setLoading(false));
  }, [employeeId]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleAdd = async () => {
    if (!selectedId || !amount) return;
    const res = await fetch(`/api/employees/${employeeId}/ctc/components`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ salaryComponentId: Number(selectedId), amount: Number(amount) }),
    });
    if (!res.ok) {
      const err = await res.json();
      toast.error(err.error ?? 'Failed to save');
      return;
    }
    setSelectedId('');
    setAmount('');
    fetchData();
    onChange?.();
  };

  const handleRemove = async (rowId: number) => {
    const res = await fetch(`/api/employees/${employeeId}/ctc/components/${rowId}`, { method: 'DELETE' });
    if (!res.ok) {
      const err = await res.json();
      toast.error(err.error ?? 'Failed to remove');
      return;
    }
    fetchData();
    onChange?.();
  };

  return (
    <div className="border-t pt-4" style={{ borderColor: 'var(--border)' }}>
      <h4 className="text-sm font-semibold mb-2" style={{ color: 'var(--foreground)' }}>
        CTC-only Components (e.g. Performance Incentive)
      </h4>
      <p className="text-xs mb-3" style={{ color: 'var(--muted)' }}>
        Non-payroll figures quoted in this employee&apos;s CTC — never part of Gross, PF, ESI, or any payroll run. Used only by the Performance Incentive Report.
      </p>
      {!loading && rows.length > 0 && (
        <table className="w-full text-sm mb-3">
          <tbody>
            {rows.map((r) => (
              <tr key={r.id} className="border-b" style={{ borderColor: 'var(--border)' }}>
                <td className="py-1.5">{r.salaryComponent.name}</td>
                <td className="py-1.5">{r.amount}</td>
                <td className="py-1.5 text-right">
                  <button onClick={() => handleRemove(r.id)} className="text-xs font-medium hover:underline text-red-500">
                    Remove
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
      <div className="flex gap-2 items-end">
        <select
          value={selectedId}
          onChange={(e) => setSelectedId(e.target.value)}
          className="rounded-lg border px-3 py-2 text-sm flex-1"
          style={{ borderColor: 'var(--border)', color: 'var(--foreground)' }}
        >
          <option value="">Select component…</option>
          {options
            .filter((o) => !rows.some((r) => r.salaryComponent.id === o.id))
            .map((o) => (
              <option key={o.id} value={o.id}>{o.name}</option>
            ))}
        </select>
        <input
          type="number"
          placeholder="Amount / month"
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          className="rounded-lg border px-3 py-2 text-sm w-40"
          style={{ borderColor: 'var(--border)', color: 'var(--foreground)' }}
        />
        <button
          onClick={handleAdd}
          className="rounded-lg px-3 py-2 text-xs font-medium text-white transition hover:opacity-90"
          style={{ backgroundColor: 'var(--accent)' }}
        >
          Add
        </button>
      </div>
      {!loading && options.length === 0 && (
        <p className="text-xs mt-2" style={{ color: 'var(--muted)' }}>
          No Non-Payroll salary components exist yet — create one under Masters &gt; Salary Components with Gross Tier = Non-Payroll.
        </p>
      )}
    </div>
  );
}

/**
 * Salary Details tab — versioned history like CTC, but each revision has a
 * dynamic set of component amounts against the seeded SalaryComponent
 * catalog. FormModal only handles flat fields, so the "new revision" form is
 * hand-built here to support adding/removing component rows.
 */
interface SalaryComponentMeta { id: number; code: string; name: string; type: string; grossTier: string; percentOfGross: number | null; includeInPf: boolean; includeInEsi: boolean }

interface DeductionContext {
  pfApplicable: boolean;
  esiApplicable: boolean;
  bonusApplicable: boolean;
  pfRestrictionAmount: number | null;
  pfRateComponentIds: number[];
  pfRate: { employeeContributionRate: number; wageCeilingMonthly: number } | null;
  esiRate: { employeeContributionRate: number; wageCeilingMonthly: number } | null;
  bonusRate: { ratePercent: number; calculationWageCeiling: number } | null;
  // Average of this employee's actual monthly Earned Basic (already
  // prorated by real attendance/LOP) across every processed payroll month
  // this financial year — null when no month has been processed yet,
  // meaning there's nothing to show (not zero, not a fabricated projection).
  avgMonthlyEarnedBasic: number | null;
  deductionRates: { code: string; name: string; deductionType: 'PERCENT' | 'FLAT'; rateValue: number; excluded: boolean; overrideAmount: number | null }[];
}

// Bonus (report) = average of this FY's processed-month real attendance-
// prorated Basic pay (PayrollLineComponent BASIC amounts) × 12 × Bonus
// Rate's Rate %. Averaging (not summing) means it projects sanely to a full
// year even mid-year, before all 12 months have been processed — once they
// all have, avg × 12 is exactly the same as sum × rate. Returns null
// (nothing to show) rather than 0 when no payroll month's been processed yet.
function computeBonusPreview(deductionContext: DeductionContext | null): number | null {
  if (!deductionContext?.bonusApplicable || !deductionContext?.bonusRate || deductionContext.avgMonthlyEarnedBasic == null) return null;
  return round2(deductionContext.avgMonthlyEarnedBasic * 12 * (deductionContext.bonusRate.ratePercent / 100));
}

// CTC's Bonus figure — a projection, not the real earned-history average
// above: Basic × 12 × Rate % (no Calculation Wage Ceiling cap). CTC is a
// quoted/projected annual figure ("as if this pay continues all year"), so
// it deliberately doesn't depend on how many payroll months have actually
// been processed.
function computeBonusProjection(basic: number, deductionContext: DeductionContext | null): number {
  if (!deductionContext?.bonusApplicable || !deductionContext?.bonusRate) return 0;
  return round2(basic * 12 * (deductionContext.bonusRate.ratePercent / 100));
}

function round2(n: number) {
  return Math.round(n * 100) / 100;
}

/**
 * Shared by the Salary Details "Deductions" preview/View and the CTC View
 * dialog — same PF/ESI/Deduction-Rate formula both places, so the two tabs
 * never quietly disagree. `rowsIn` must already carry each row's `type`
 * ('earning' | 'deduction'); callers that don't have it handy per-row (the
 * live Salary Details form, keyed by componentById) map it in before calling.
 */
function computeDeductionsShared(
  gross: string,
  rowsIn: { salaryComponentId: string; amount: string; source: 'fixed' | 'manual'; type: string }[],
  deductionContext: DeductionContext | null
) {
  const additionalEarnings = rowsIn.reduce((sum, r) => {
    if (r.source !== 'manual') return sum;
    return r.type === 'earning' ? sum + (Number(r.amount) || 0) : sum;
  }, 0);
  const actual = (Number(gross) || 0) + additionalEarnings;

  // If the employee has a PF Restriction Amount set (Job Profile), PF is
  // calculated against that fixed amount directly instead of the summed
  // PF-Rate-attached components — a per-employee override for someone whose
  // PF should be capped/fixed below what their actual components add up to.
  // Falls back to the normal component-sum flow when no restriction is set.
  const pfComponentIds = new Set((deductionContext?.pfRateComponentIds ?? []).map(String));
  const pfComponentSum = rowsIn.reduce((sum, r) => (pfComponentIds.has(r.salaryComponentId) ? sum + (Number(r.amount) || 0) : sum), 0);
  const pfWageBase = deductionContext?.pfRestrictionAmount ?? pfComponentSum;
  const pfEmployee = deductionContext?.pfApplicable && deductionContext?.pfRate && pfWageBase > 0
    ? round2(pfWageBase * (deductionContext.pfRate.employeeContributionRate / 100))
    : 0;

  const esiEligible = Boolean(
    deductionContext?.esiApplicable && deductionContext?.esiRate && actual > 0 && actual <= deductionContext.esiRate.wageCeilingMonthly
  );
  const esiEmployee = esiEligible ? round2(actual * (deductionContext!.esiRate!.employeeContributionRate / 100)) : 0;

  const otherDeductions = (deductionContext?.deductionRates ?? []).map((dr) => ({
    code: dr.code,
    name: dr.name,
    amount: dr.excluded ? 0 : dr.overrideAmount != null ? dr.overrideAmount : round2(dr.deductionType === 'PERCENT' ? actual * (dr.rateValue / 100) : dr.rateValue),
    excluded: dr.excluded,
    overrideAmount: dr.overrideAmount,
  }));

  const total = round2(pfEmployee + esiEmployee + otherDeductions.reduce((s, d) => s + d.amount, 0));
  return { actual: round2(actual), pfEmployee, esiEmployee, esiEligible, otherDeductions, total };
}

function EmployeeSalaryTab({ employeeId }: { employeeId: string }) {
  const toast = useToast();
  const [rows, setRows] = useState<SalaryRevisionRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [viewRevision, setViewRevision] = useState<SalaryRevisionRow | null>(null);
  const [allComponents, setAllComponents] = useState<SalaryComponentMeta[]>([]);
  const [formOpen, setFormOpen] = useState(false);
  const [financialYear, setFinancialYear] = useState('');
  const [grossSalary, setGrossSalary] = useState('');
  const [netSalary, setNetSalary] = useState('');
  const [effectiveFrom, setEffectiveFrom] = useState('');
  // "fixed" rows are the auto-populated Fixed-tier components (their
  // dropdown only offers other Fixed components); "manual" rows come from
  // + Add Component and only offer Additional-tier components — Non-Payroll
  // components never appear here at all, only on the Employee CTC tab.
  const [compRows, setCompRows] = useState<{ salaryComponentId: string; amount: string; source: 'fixed' | 'manual' }[]>([]);
  const [saving, setSaving] = useState(false);
  const [deductionContext, setDeductionContext] = useState<DeductionContext | null>(null);
  // Deduction code currently being edited (Edit button on an "other
  // deduction" row) and its in-progress typed override amount.
  const [editingDeductionCode, setEditingDeductionCode] = useState<string | null>(null);
  const [editingDeductionAmount, setEditingDeductionAmount] = useState('');

  const componentById = new Map(allComponents.map((c) => [String(c.id), c]));
  const fixedComponents = allComponents.filter((c) => c.grossTier === 'FIXED');

  const bonusPreview = computeBonusPreview(deductionContext);

  // Computed Gross — the live sum of every component row's amount (Basic +
  // HRA + DA + every allowance), shown alongside the typed Gross Salary so
  // a mismatch between "what was typed" and "what the components add up
  // to" is visible before saving, not discovered later on a payslip.
  // Compared only against Fixed Gross, so Additional-tier rows (top-ups,
  // deductions) never trigger a false "doesn't match" mismatch warning here.
  const computedGross = compRows.filter((r) => r.source === 'fixed').reduce((sum, r) => sum + (Number(r.amount) || 0), 0);
  const grossMismatch = grossSalary !== '' && Math.abs(computedGross - (Number(grossSalary) || 0)) > 0.01;

  // Additional Gross — the live sum of every manually-added (+ Add
  // Component) EARNING row's amount only; deduction rows added the same way
  // (PF/PT/Canteen…) must never inflate Gross. Read-only, derived.
  const additionalGross = compRows.reduce((sum, r) => {
    if (r.source !== 'manual') return sum;
    const meta = componentById.get(r.salaryComponentId);
    return meta?.type === 'earning' ? sum + (Number(r.amount) || 0) : sum;
  }, 0);
  // Actual Gross — Fixed Gross + Additional Gross. Read-only, derived; never
  // typed directly.
  const actualGross = round2((Number(grossSalary) || 0) + additionalGross);

  // Fixed-tier components with a configured Percentage of Gross (set on
  // Masters > Salary Components) auto-fill their amount as that % of
  // whatever Gross Salary is typed — HR only has to type Gross once.
  const applyFixedPercentages = (gross: string, rowsIn: typeof compRows) => {
    const g = Number(gross) || 0;
    return rowsIn.map((r) => {
      const meta = componentById.get(r.salaryComponentId);
      if (!meta || meta.grossTier !== 'FIXED' || meta.percentOfGross === null) return r;
      return { ...r, amount: gross === '' ? '' : String(round2((g * meta.percentOfGross) / 100)) };
    });
  };

  // Deductions — this is a structure-time preview, not a payroll run;
  // see computeDeductionsShared's own comment for the PF/ESI/Deduction-Rate
  // formula. compRows doesn't carry each row's type, so it's mapped in from
  // componentById here before delegating to the shared calculator (also used
  // by the CTC tab's View dialog, so the two never disagree).
  const computeDeductions = (gross: string, rowsIn: typeof compRows) =>
    computeDeductionsShared(
      gross,
      rowsIn.map((r) => ({ ...r, type: componentById.get(r.salaryComponentId)?.type ?? '' })),
      deductionContext
    );

  // Net Salary = Actual Gross − every computed deduction above, recomputed
  // live so it never has to be hand-calculated before saving.
  const computeNet = (gross: string, rowsIn: typeof compRows) => {
    if (gross === '') return '';
    const { actual, total } = computeDeductions(gross, rowsIn);
    return String(round2(actual - total));
  };

  // Financial Year is picked as a From/To year pair (e.g. 2026 → 2027) and
  // combined into the stored "YYYY-YYYY" string, instead of free text that
  // could be typed inconsistently ("2026-27", "26-27", etc.).
  const fyYearOptions = Array.from({ length: 11 }, (_, i) => new Date().getFullYear() - 5 + i);
  const [fyFromStr, fyToStr] = financialYear.split('-');
  const fyFrom = fyFromStr ? Number(fyFromStr) : new Date().getFullYear();
  const fyTo = fyToStr ? Number(fyToStr) : fyFrom + 1;
  const setFyFrom = (year: number) => setFinancialYear(`${year}-${year + 1}`);
  const setFyTo = (year: number) => setFinancialYear(`${fyFrom}-${year}`);

  const handleGrossChange = (value: string) => {
    setGrossSalary(value);
    setCompRows(applyFixedPercentages(value, compRows));
  };

  const handleCompRowChange = (idx: number, patch: Partial<{ salaryComponentId: string; amount: string }>) => {
    setCompRows((rs) => {
      let next = rs.map((r, i) => (i === idx ? { ...r, ...patch } : r));
      // Picking a Fixed component with a configured % auto-fills its amount
      // from the current Gross immediately, same as typing Gross does.
      if (patch.salaryComponentId !== undefined) {
        const meta = componentById.get(patch.salaryComponentId);
        if (meta && meta.grossTier === 'FIXED' && meta.percentOfGross !== null && grossSalary !== '') {
          next = next.map((r, i) => (i === idx ? { ...r, amount: String(round2((Number(grossSalary) * meta.percentOfGross!) / 100)) } : r));
        }
      }
      return next;
    });
  };

  const removeCompRow = (idx: number) => {
    setCompRows((rs) => rs.filter((_, i) => i !== idx));
  };

  // Net Salary tracks Gross/Components/deductionContext reactively — this is
  // the single source of truth for recomputing it, so a Remove/Add back/Edit
  // on a deduction row (which only refreshes deductionContext via fetchData,
  // not compRows) still updates it, not just typing Gross or editing a
  // component amount.
  useEffect(() => {
    setNetSalary(computeNet(grossSalary, compRows));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [grossSalary, compRows, deductionContext]);

  // Excludes/re-includes this employee from one company-wide Deduction Rate
  // (the Remove / Add back action on an "other deduction" row).
  const toggleDeductionExclusion = async (code: string, currentlyExcluded: boolean) => {
    if (currentlyExcluded) {
      await fetch(`/api/employees/${employeeId}/deduction-exclusions?code=${encodeURIComponent(code)}`, { method: 'DELETE' });
    } else {
      await fetch(`/api/employees/${employeeId}/deduction-exclusions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ deductionCode: code }),
      });
    }
    fetchData();
  };

  // Sets (or, with amount === null, clears) a fixed per-employee override
  // amount for one deduction (the Edit action).
  const setDeductionOverride = async (code: string, amount: number | null) => {
    if (amount === null) {
      await fetch(`/api/employees/${employeeId}/deduction-exclusions?code=${encodeURIComponent(code)}`, { method: 'DELETE' });
    } else {
      await fetch(`/api/employees/${employeeId}/deduction-exclusions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ deductionCode: code, excluded: false, overrideAmount: amount }),
      });
    }
    fetchData();
  };

  const fetchData = useCallback(() => {
    setLoading(true);
    fetch(`/api/employees/${employeeId}/salary`)
      .then((res) => res.json())
      .then((json) => {
        setRows(json.data ?? []);
        setDeductionContext(json.deductionContext ?? null);
      })
      .finally(() => setLoading(false));
  }, [employeeId]);

  useEffect(() => {
    fetchData();
    // Fixed-tier components (Basic, HRA, LTA…) should be on the form by
    // default — HR shouldn't have to know to add them one by one; only
    // top-up/Additional components are opt-in via "+ Add Component". Each
    // component's type/grossTier/percentOfGross drives the Gross % auto-fill
    // and the Net Salary auto-calc below.
    fetch('/api/masters/salary-components')
      .then((res) => res.json())
      .then((json: { data: SalaryComponentMeta[] }) => setAllComponents(json.data ?? []));
  }, [fetchData]);

  const resetForm = () => {
    setFinancialYear('');
    setGrossSalary('');
    setNetSalary('');
    setEffectiveFrom('');
    setCompRows([]);
  };

  const handleSubmit = async () => {
    setSaving(true);
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
      toast.error(err instanceof Error ? err.message : 'Save failed');
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
    {
      key: 'view',
      label: '',
      render: (r) => (
        <button
          type="button"
          onClick={() => setViewRevision(r)}
          className="text-xs font-medium hover:underline"
          style={{ color: 'var(--accent)' }}
        >
          View
        </button>
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
          onClick={() => {
            if (!formOpen) {
              // Opening — default in every Fixed-tier component that isn't
              // already on the form, so HR doesn't have to know to add
              // Basic/HRA/LTA one by one, and a Fixed row can never end up
              // permanently missing (Remove is disabled for them, but this
              // also repairs a form still carrying a gap from before that
              // restriction existed).
              const present = new Set(compRows.filter((r) => r.source === 'fixed').map((r) => r.salaryComponentId));
              const missing = fixedComponents.filter((c) => !present.has(String(c.id)));
              if (missing.length > 0) {
                setCompRows((rs) => [
                  ...missing.map((c) => ({ salaryComponentId: String(c.id), amount: '', source: 'fixed' as const })),
                  ...rs,
                ]);
              }
              if (!financialYear) {
                const y = new Date().getFullYear();
                setFinancialYear(`${y}-${y + 1}`);
              }
            }
            setFormOpen((o) => !o);
          }}
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
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-3">
            <div>
              <label className="text-xs font-medium" style={{ color: 'var(--foreground)' }}>Financial Year</label>
              <div className="mt-1 flex items-center gap-1">
                <select
                  value={fyFrom}
                  onChange={(e) => setFyFrom(Number(e.target.value))}
                  className="w-full rounded-lg border px-2 py-2 text-sm"
                  style={{ borderColor: 'var(--border)', backgroundColor: 'var(--surface)', color: 'var(--foreground)' }}
                >
                  {fyYearOptions.map((y) => (
                    <option key={y} value={y}>{y}</option>
                  ))}
                </select>
                <span style={{ color: 'var(--foreground-muted)' }}>–</span>
                <select
                  value={fyTo}
                  onChange={(e) => setFyTo(Number(e.target.value))}
                  className="w-full rounded-lg border px-2 py-2 text-sm"
                  style={{ borderColor: 'var(--border)', backgroundColor: 'var(--surface)', color: 'var(--foreground)' }}
                >
                  {fyYearOptions.map((y) => (
                    <option key={y} value={y}>{y}</option>
                  ))}
                </select>
              </div>
            </div>
            <div>
              <label className="text-xs font-medium" style={{ color: 'var(--foreground)' }}>Fixed Gross *</label>
              <input type="number" min={0} value={grossSalary} onChange={(e) => handleGrossChange(e.target.value)} className="mt-1 w-full rounded-lg border px-3 py-2 text-sm" style={{ borderColor: grossMismatch ? 'var(--warning)' : 'var(--border)', backgroundColor: 'var(--surface)', color: 'var(--foreground)' }} />
              {compRows.length > 0 && (
                <p className="mt-1 text-xs" style={{ color: grossMismatch ? 'var(--warning)' : 'var(--foreground-muted)' }}>
                  Computed from components: <span className="font-semibold tabular-nums">{computedGross}</span>
                  {grossMismatch && (
                    <>
                      {' — doesn\'t match Fixed Gross. '}
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
              <label className="text-xs font-medium" style={{ color: 'var(--foreground)' }}>Actual Gross</label>
              <input type="number" value={actualGross} disabled className="mt-1 w-full rounded-lg border px-3 py-2 text-sm cursor-not-allowed font-semibold" style={{ borderColor: 'var(--border)', backgroundColor: 'var(--surface-muted)', color: 'var(--foreground)' }} />
              <p className="mt-1 text-xs" style={{ color: 'var(--foreground-muted)' }}>Fixed Gross + Additional Gross (sum of + Add Component earnings).</p>
            </div>
            <div>
              <label className="text-xs font-medium" style={{ color: 'var(--foreground)' }}>Net Salary</label>
              <input type="number" min={0} value={netSalary} onChange={(e) => setNetSalary(e.target.value)} className="mt-1 w-full rounded-lg border px-3 py-2 text-sm" style={{ borderColor: 'var(--border)', backgroundColor: 'var(--surface)', color: 'var(--foreground)' }} />
              <p className="mt-1 text-xs" style={{ color: 'var(--foreground-muted)' }}>Auto-calculated as Gross − deduction components; editable if it needs overriding.</p>
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
                onClick={() => setCompRows((r) => [...r, { salaryComponentId: '', amount: '', source: 'manual' as const }])}
                className="text-xs font-medium"
                style={{ color: 'var(--accent)' }}
              >
                + Add Component
              </button>
            </div>
            {compRows.map((row, idx) => {
              const meta = componentById.get(row.salaryComponentId);
              const isAutoFixed = meta?.grossTier === 'FIXED' && meta.percentOfGross !== null;
              // Fixed rows may only be swapped for another Fixed component;
              // manually-added rows may only pick Additional-tier components
              // (top-ups, deductions like PF/PT/Canteen) — Non-Payroll
              // components (e.g. Performance Incentive) are never offered
              // here at all, only on the Employee CTC tab. Also exclude
              // whatever's already picked on another row, so + Add Component
              // only ever offers components not yet added.
              const pickedElsewhere = new Set(
                compRows.filter((r, i) => i !== idx && r.salaryComponentId).map((r) => r.salaryComponentId)
              );
              const options = allComponents.filter(
                (c) => c.grossTier === (row.source === 'fixed' ? 'FIXED' : 'ADDITIONAL') && !pickedElsewhere.has(String(c.id))
              );
              return (
              <div key={idx} className="flex items-center gap-2">
                <select
                  value={row.salaryComponentId}
                  onChange={(e) => handleCompRowChange(idx, { salaryComponentId: e.target.value })}
                  className="flex-1 rounded-lg border px-3 py-2 text-sm"
                  style={{ borderColor: 'var(--border)', backgroundColor: 'var(--surface)', color: 'var(--foreground)' }}
                >
                  <option value="">— Select component —</option>
                  {options.map((c) => (
                    <option key={c.id} value={c.id}>{c.name}{c.grossTier === 'FIXED' && c.percentOfGross !== null ? ` (${c.percentOfGross}% of Gross)` : ''}</option>
                  ))}
                </select>
                <input
                  type="number"
                  min={0}
                  placeholder="Amount"
                  value={row.amount}
                  readOnly={isAutoFixed}
                  title={isAutoFixed ? 'Auto-filled from Gross × this component\'s % — change % on Masters > Salary Components to adjust.' : undefined}
                  onChange={(e) => handleCompRowChange(idx, { amount: e.target.value })}
                  className="w-32 rounded-lg border px-3 py-2 text-sm"
                  style={{ borderColor: 'var(--border)', backgroundColor: isAutoFixed ? 'var(--surface-muted)' : 'var(--surface)', color: 'var(--foreground)' }}
                />
                {row.source === 'fixed' ? (
                  <span className="text-xs w-[52px] text-center" style={{ color: 'var(--foreground-muted)' }} title="Fixed-tier components can be swapped for another Fixed component, but not removed">
                    —
                  </span>
                ) : (
                  <button
                    type="button"
                    onClick={() => removeCompRow(idx)}
                    className="text-xs"
                    style={{ color: 'var(--danger)' }}
                  >
                    Remove
                  </button>
                )}
              </div>
              );
            })}
          </div>

          {bonusPreview !== null && bonusPreview > 0 && (
            <div className="space-y-2">
              <span className="text-xs font-medium" style={{ color: 'var(--foreground)' }}>Other Earnings</span>
              <table className="w-full text-sm">
                <tbody>
                  <tr className="border-b" style={{ borderColor: 'var(--border)' }}>
                    <td className="py-1.5" style={{ color: 'var(--foreground)' }}>Bonus (year-end estimate)</td>
                    <td className="py-1.5 text-right tabular-nums" style={{ color: 'var(--foreground)' }}>{bonusPreview}</td>
                  </tr>
                </tbody>
              </table>
              <p className="text-xs" style={{ color: 'var(--foreground-muted)' }}>
                Basic × Bonus Rate % — a preview only, not part of Actual Gross/Net Salary. Shown once a year at bonus time; the real payable amount is computed by Payroll &gt; Processing &gt; Bonus from actual Net Pay across the year.
              </p>
            </div>
          )}

          {(() => {
            const d = computeDeductions(grossSalary, compRows);
            const visibleOther = d.otherDeductions.filter((o) => o.amount > 0 || o.excluded);
            const hasAny = d.pfEmployee > 0 || d.esiEmployee > 0 || visibleOther.length > 0;
            return (
              <div className="space-y-2">
                <span className="text-xs font-medium" style={{ color: 'var(--foreground)' }}>Deductions</span>
                {!hasAny ? (
                  <p className="text-xs" style={{ color: 'var(--foreground-muted)' }}>
                    No deductions apply yet — set a PF/ESI Rate or Deduction Rate under Masters, and flag components Include in PF/ESI.
                  </p>
                ) : (
                  <table className="w-full text-sm">
                    <tbody>
                      {d.pfEmployee > 0 && (
                        <tr className="border-b" style={{ borderColor: 'var(--border)' }}>
                          <td className="py-1.5" style={{ color: 'var(--foreground)' }}>PF</td>
                          <td className="py-1.5 text-right tabular-nums" style={{ color: 'var(--foreground)' }}>{d.pfEmployee}</td>
                          <td className="py-1.5" />
                        </tr>
                      )}
                      {deductionContext?.esiApplicable && (
                        <tr className="border-b" style={{ borderColor: 'var(--border)' }}>
                          <td className="py-1.5" style={{ color: 'var(--foreground)' }}>
                            ESI{!d.esiEligible && <span style={{ color: 'var(--foreground-muted)' }}> (not eligible — Actual Gross above ESI wage ceiling)</span>}
                          </td>
                          <td className="py-1.5 text-right tabular-nums" style={{ color: 'var(--foreground)' }}>{d.esiEmployee}</td>
                          <td className="py-1.5" />
                        </tr>
                      )}
                      {visibleOther.map((o) => (
                        <tr key={o.code} className="border-b" style={{ borderColor: 'var(--border)' }}>
                          <td className="py-1.5" style={{ color: o.excluded ? 'var(--foreground-muted)' : 'var(--foreground)', textDecoration: o.excluded ? 'line-through' : undefined }}>
                            {o.name}
                            {o.overrideAmount != null && !o.excluded && (
                              <span className="ml-1 text-xs" style={{ color: 'var(--foreground-muted)' }}>(edited)</span>
                            )}
                          </td>
                          <td className="py-1.5 text-right tabular-nums" style={{ color: o.excluded ? 'var(--foreground-muted)' : 'var(--foreground)', textDecoration: o.excluded ? 'line-through' : undefined }}>
                            {editingDeductionCode === o.code ? (
                              <input
                                type="number"
                                autoFocus
                                value={editingDeductionAmount}
                                onChange={(e) => setEditingDeductionAmount(e.target.value)}
                                className="w-24 rounded border px-2 py-0.5 text-right text-sm"
                                style={{ borderColor: 'var(--border)', backgroundColor: 'var(--surface)', color: 'var(--foreground)' }}
                              />
                            ) : o.excluded ? (
                              '—'
                            ) : (
                              o.amount
                            )}
                          </td>
                          <td className="py-1.5 text-right whitespace-nowrap">
                            {editingDeductionCode === o.code ? (
                              <>
                                <button
                                  type="button"
                                  onClick={async () => {
                                    await setDeductionOverride(o.code, editingDeductionAmount === '' ? null : Number(editingDeductionAmount));
                                    setEditingDeductionCode(null);
                                  }}
                                  className="text-xs font-medium hover:underline mr-2"
                                  style={{ color: 'var(--accent)' }}
                                >
                                  Save
                                </button>
                                <button
                                  type="button"
                                  onClick={() => setEditingDeductionCode(null)}
                                  className="text-xs font-medium hover:underline"
                                  style={{ color: 'var(--foreground-muted)' }}
                                >
                                  Cancel
                                </button>
                              </>
                            ) : (
                              <>
                                {!o.excluded && (
                                  <button
                                    type="button"
                                    onClick={() => {
                                      setEditingDeductionCode(o.code);
                                      setEditingDeductionAmount(String(o.amount));
                                    }}
                                    className="text-xs font-medium hover:underline mr-2"
                                    style={{ color: 'var(--accent)' }}
                                  >
                                    Edit
                                  </button>
                                )}
                                <button
                                  type="button"
                                  onClick={() => toggleDeductionExclusion(o.code, o.excluded)}
                                  className="text-xs font-medium hover:underline"
                                  style={{ color: o.excluded ? 'var(--accent)' : 'var(--danger)' }}
                                >
                                  {o.excluded ? 'Add back' : 'Remove'}
                                </button>
                              </>
                            )}
                          </td>
                        </tr>
                      ))}
                      <tr>
                        <td className="py-1.5 font-semibold" style={{ color: 'var(--foreground)' }}>Total Deductions</td>
                        <td className="py-1.5 text-right font-semibold tabular-nums" style={{ color: 'var(--foreground)' }}>{d.total}</td>
                        <td className="py-1.5" />
                      </tr>
                    </tbody>
                  </table>
                )}
              </div>
            );
          })()}

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

      {viewRevision && (() => {
        const earnings = viewRevision.components.filter((c) => c.salaryComponent.type === 'earning');
        const fixedEarnings = earnings.filter((c) => c.salaryComponent.grossTier === 'FIXED');
        const additionalEarnings = earnings.filter((c) => c.salaryComponent.grossTier !== 'FIXED');
        const fixedGross = round2(fixedEarnings.reduce((s, c) => s + Number(c.amount), 0));
        const additionalGross = round2(additionalEarnings.reduce((s, c) => s + Number(c.amount), 0));
        const actualGross = round2(fixedGross + additionalGross);

        // Same PF/ESI/Deduction-Rate breakdown as the live "New Salary
        // Revision" panel above, run against THIS revision's own stored
        // components — accurate for the current revision; for a closed
        // historical one it reflects today's rates, not necessarily what
        // applied back then (payroll's own record is the source of truth
        // for what was actually deducted that month).
        const revCompRows = viewRevision.components.map((c) => ({
          salaryComponentId: String(c.salaryComponentId),
          amount: c.amount,
          source: (c.salaryComponent.grossTier === 'FIXED' ? 'fixed' : 'manual') as 'fixed' | 'manual',
        }));
        const d = computeDeductions(String(fixedGross), revCompRows);

        const netSalary = round2(actualGross - d.total);
        const hasDeductions = d.pfEmployee > 0 || d.esiEmployee > 0 || d.otherDeductions.some((o) => o.amount > 0);

        const fmt = (n: number) => n.toLocaleString('en-IN', { maximumFractionDigits: 2 });

        const SectionTable = ({
          title,
          accent,
          rows,
        }: {
          title: string;
          accent: string;
          rows: { key: string; label: string; amount: number }[];
        }) => (
          <div className="rounded-lg overflow-hidden" style={{ border: '1px solid var(--border)' }}>
            <div
              className="flex items-center gap-2 px-3 py-2 text-xs font-semibold uppercase tracking-wide"
              style={{ backgroundColor: 'var(--background-subtle, var(--surface-muted))', color: 'var(--foreground-muted)' }}
            >
              <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: accent }} />
              {title}
            </div>
            {rows.length === 0 ? (
              <p className="px-3 py-3 text-xs" style={{ color: 'var(--foreground-muted)' }}>—</p>
            ) : (
              <table className="w-full text-sm">
                <tbody>
                  {rows.map((r, i) => (
                    <tr
                      key={r.key}
                      style={{
                        backgroundColor: i % 2 === 1 ? 'var(--background-subtle, transparent)' : 'transparent',
                        borderTop: i === 0 ? 'none' : '1px solid var(--border)',
                      }}
                    >
                      <td className="px-3 py-1.5" style={{ color: 'var(--foreground)' }}>{r.label}</td>
                      <td className="px-3 py-1.5 text-right tabular-nums font-medium" style={{ color: 'var(--foreground)' }}>
                        ₹{fmt(r.amount)}
                      </td>
                    </tr>
                  ))}
                  <tr style={{ borderTop: `1px solid ${accent}` }}>
                    <td className="px-3 py-1.5 font-semibold" style={{ color: 'var(--foreground)' }}>Total</td>
                    <td className="px-3 py-1.5 text-right tabular-nums font-semibold" style={{ color: accent }}>
                      ₹{fmt(rows.reduce((s, r) => s + r.amount, 0))}
                    </td>
                  </tr>
                </tbody>
              </table>
            )}
          </div>
        );

        return (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ backgroundColor: 'rgba(0,0,0,0.5)' }} onClick={() => setViewRevision(null)}>
            <div
              className="w-full max-w-lg rounded-xl shadow-2xl max-h-[90vh] overflow-y-auto"
              style={{ backgroundColor: 'var(--surface)', border: '1px solid var(--border)' }}
              onClick={(e) => e.stopPropagation()}
            >
              <div
                className="flex items-center justify-between px-5 py-4 border-b"
                style={{ borderColor: 'var(--border)', background: 'linear-gradient(135deg, color-mix(in srgb, var(--accent) 10%, transparent), transparent)' }}
              >
                <div>
                  <h2 className="text-base font-semibold" style={{ color: 'var(--foreground)' }}>
                    Salary Revision
                  </h2>
                  <p className="text-xs mt-0.5" style={{ color: 'var(--foreground-muted)' }}>
                    {viewRevision.effectiveFrom.slice(0, 10)}
                    {viewRevision.effectiveTo ? ` → ${viewRevision.effectiveTo.slice(0, 10)}` : (
                      <span
                        className="ml-2 px-1.5 py-0.5 rounded-full text-[10px] font-semibold uppercase tracking-wide"
                        style={{ backgroundColor: 'var(--accent-soft, #dcfce7)', color: 'var(--accent)' }}
                      >
                        Current
                      </span>
                    )}
                  </p>
                </div>
                <button onClick={() => setViewRevision(null)} className="text-lg leading-none hover:opacity-70" style={{ color: 'var(--foreground-muted)' }}>×</button>
              </div>
              <div className="px-5 py-4 space-y-4 text-sm">
                <div className="grid grid-cols-2 gap-2">
                  {[
                    { label: 'Financial Year', value: viewRevision.financialYear ?? '—', emphasize: false },
                    { label: 'Fixed Gross', value: `₹${fmt(fixedGross)}`, emphasize: true },
                    { label: 'Additional Gross', value: `₹${fmt(additionalGross)}`, emphasize: false },
                    { label: 'Actual Gross', value: `₹${fmt(actualGross)}`, emphasize: true },
                  ].map((item) => (
                    <div key={item.label} className="rounded-lg px-3 py-2" style={{ backgroundColor: 'var(--background-subtle, var(--surface-muted))', border: '1px solid var(--border)' }}>
                      <div className="text-[11px] uppercase tracking-wide" style={{ color: 'var(--foreground-muted)' }}>{item.label}</div>
                      <div className={item.emphasize ? 'font-semibold' : ''} style={{ color: 'var(--foreground)' }}>{item.value}</div>
                    </div>
                  ))}
                </div>

                <SectionTable
                  title="Earnings — Fixed"
                  accent="#16a34a"
                  rows={fixedEarnings.map((c) => ({ key: c.salaryComponent.code, label: c.salaryComponent.name, amount: Number(c.amount) }))}
                />

                <SectionTable
                  title="Earnings — Additional"
                  accent="#0ea5e9"
                  rows={additionalEarnings.map((c) => ({ key: c.salaryComponent.code, label: c.salaryComponent.name, amount: Number(c.amount) }))}
                />

                <SectionTable
                  title="Deductions"
                  accent="#dc2626"
                  rows={
                    hasDeductions
                      ? [
                          ...(d.pfEmployee > 0 ? [{ key: 'pf', label: 'PF', amount: d.pfEmployee }] : []),
                          ...(d.esiEmployee > 0 ? [{ key: 'esi', label: 'ESI', amount: d.esiEmployee }] : []),
                          ...d.otherDeductions.filter((o) => o.amount > 0).map((o) => ({ key: o.code, label: o.name, amount: o.amount })),
                        ]
                      : []
                  }
                />

                <div
                  className="flex justify-between items-center rounded-lg px-4 py-3"
                  style={{ backgroundColor: 'color-mix(in srgb, var(--accent) 12%, transparent)', border: '1px solid var(--accent)' }}
                >
                  <span className="font-semibold" style={{ color: 'var(--foreground)' }}>Net Salary</span>
                  <span className="font-bold text-base tabular-nums" style={{ color: 'var(--accent)' }}>₹{fmt(netSalary)}</span>
                </div>
              </div>
            </div>
          </div>
        );
      })()}
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
  const toast = useToast();
  const [available, setAvailable] = useState<EmployeeBenefitRow[]>([]);
  const [selected, setSelected] = useState<EmployeeBenefitRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const fetchBenefits = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/employees/${employeeId}/benefits`);
      if (!res.ok) throw new Error('Failed to fetch benefits');
      const json = await res.json();
      setAvailable(json.available ?? []);
      setSelected(json.selected ?? []);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  }, [employeeId, toast]);

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
      toast.error(err instanceof Error ? err.message : 'Save failed');
    } finally {
      setSaving(false);
    }
  };

  return (
    <SectionCard title="Benefits" icon={<SectionIcon.Gift />}>
      <div className="space-y-3">
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
 * Training tab (BRD §36) — read-only training history fed by the Learning
 * closed loop: each row is a TrainingHistory record written when a training
 * schedule is closed (/api/training-schedules/[id]/complete).
 */
function EmployeeTrainingTab({ employeeId }: { employeeId: string }) {
  const [items, setItems] = useState<TrainingHistoryRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    fetch(`/api/training-history?employeeId=${employeeId}`)
      .then((res) => res.json())
      .then((json) => { if (!cancelled) setItems(json.data ?? []); })
      .catch(() => { if (!cancelled) setItems([]); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [employeeId]);

  const columns: Column<TrainingHistoryRow>[] = [
    { key: 'programName', label: 'Program' },
    { key: 'scheduledDate', label: 'Date', render: (r) => (r.scheduledDate ? r.scheduledDate.slice(0, 10) : '—') },
    { key: 'method', label: 'Method', render: (r) => r.method ?? '—' },
    { key: 'attendanceStatus', label: 'Attendance' },
    { key: 'attendancePercent', label: 'Attendance %', render: (r) => (r.attendancePercent != null ? `${r.attendancePercent}%` : '—') },
    { key: 'result', label: 'Result' },
    { key: 'status', label: 'Status' },
  ];

  return (
    <SectionCard title="Training History" icon={<SectionIcon.Award />}>
      <DataTable columns={columns} data={items} loading={loading} emptyMessage="No training history recorded yet." />
    </SectionCard>
  );
}

/**
 * Reveals the real PAN/Aadhaar values for the KYC tab (numbers only).
 * File scans live on the Documents tab (PlatformDocument) — this panel
 * may still list legacy EmployeeDocument rows as read-only.
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

  return (
    <SectionCard
      title="Legacy file list"
      icon={<SectionIcon.Shield />}
      action={
        <Link href="?tab=documents" className="text-sm font-medium" style={{ color: 'var(--accent)' }}>
          Open Documents tab
        </Link>
      }
    >
      <div className="space-y-5">
        <p className="text-sm" style={{ color: 'var(--foreground-muted)' }}>
          Upload identity scans (Aadhaar, PAN, passport) on the Documents tab. This list is older files only, if any remain.
        </p>
        <div className="space-y-3">
          <h4 className="text-sm font-semibold" style={{ color: 'var(--foreground)' }}>
            Older files (read-only)
          </h4>
          {docsLoading ? (
            <p className="text-sm" style={{ color: 'var(--foreground-muted)' }}>Loading documents...</p>
          ) : docsError ? (
            <div className="rounded-lg px-3 py-2 text-sm" style={{ backgroundColor: 'var(--danger-soft)', color: 'var(--danger)' }}>
              {docsError}
            </div>
          ) : docs.length === 0 ? (
            <p className="text-sm" style={{ color: 'var(--foreground-muted)' }}>No older files on this tab. Use Documents for new uploads.</p>
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
  const toast = useToast();
  const [rows, setRows] = useState<JobHistoryRow[]>([]);
  const [reporting, setReporting] = useState<ReportingHistoryRow[]>([]);
  const [costCentres, setCostCentres] = useState<CodedRef[]>([]);
  const [loading, setLoading] = useState(true);
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
      })
      .catch((err) => toast.error(err instanceof Error ? err.message : 'Failed to load job history'))
      .finally(() => setLoading(false));
  }, [employeeId, toast]);

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
    toast.success('Job change recorded.');
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
          onClick={() => { setModalOpen(true); }}
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
  const { confirm } = useConfirm();
  const toast = useToast();
  const params = useParams<{ id: string }>();
  const searchParams = useSearchParams();
  const employeeId = params.id;

  const [header, setHeader] = useState<ProfileHeader | null>(null);
  const [loadingHeader, setLoadingHeader] = useState(true);
  const [headerError, setHeaderError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<TabKey>('basic');
  const [activeTabDirty, setActiveTabDirty] = useState(false);
  const [confirmToggle, setConfirmToggle] = useState(false);
  const [toggling, setToggling] = useState(false);
  const [lifecycle, setLifecycle] = useState<LifecycleInfo | null>(null);
  const [changeStateOpen, setChangeStateOpen] = useState(false);

  useEffect(() => {
    const tab = searchParams.get('tab');
    if (tab && TABS.some((t) => t.key === tab)) setActiveTab(tab as TabKey);
  }, [employeeId, searchParams]);

  const handleTabClick = useCallback(
    async (key: TabKey) => {
      if (key === activeTab) return;
      if (activeTabDirty) {
        const proceed = await confirm({
          title: 'Discard unsaved changes?',
          message: 'You have unsaved changes on this tab. Switching will lose them.',
          confirmLabel: 'Discard and switch',
          cancelLabel: 'Stay here',
          tone: 'danger',
        });
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
      toast.error(err instanceof Error ? err.message : 'Action failed');
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
  const siblingCode = (s: SiblingRef) => s.oldEmployeeCode ?? '—';

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
              {header.oldEmployeeCode ?? '—'}
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
          <p className="text-sm" style={{ color: 'var(--foreground-muted)' }}>
            Identity file scans (Aadhaar, PAN, passport) should be uploaded on the Documents tab. This tab keeps the numbers on file.
          </p>
        </div>
      )}
      {activeTab === 'documents' && header && (
        <EmployeeDocumentsTab
          employeeId={employeeId}
          employeeLabel={`${header.employeeCode} — ${header.firstName} ${header.lastName}`}
        />
      )}
      {activeTab === 'kra' && <EmployeeKraTab employeeId={employeeId} />}
      {activeTab === 'activity' && <EmployeeActivityTab employeeId={employeeId} />}
      {activeTab === 'training' && <EmployeeTrainingTab employeeId={employeeId} />}
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
