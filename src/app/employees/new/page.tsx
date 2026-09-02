/**
 * Add Employee — captures just Basic Details, the minimum needed to create
 * the Employee + current JobInfo row. Every other tab (Personal, Contact,
 * Job Profile, Salary, CTC, Assets, KYC, Education, ...) is a child record
 * that needs a real employee id to save against, so it isn't reachable until
 * the employee exists — "Create & Continue" redirects straight to the full
 * profile (src/app/employees/[id]/page.tsx) where every tab is live.
 *
 * Presented as a 4-step wizard purely for readability on a ~27-field form —
 * the field set and submit behavior are unchanged from the single-page
 * version, this only splits the same fields into smaller screens:
 *   1. Basic Details      — who: name, identifiers, company/unit
 *   2. Organization       — department/designation/type/category/grade/level
 *   3. Role & Team        — production line, role, team, reporting manager
 *   4. Employment Terms   — status, dates, probation, shift
 */

'use client';

import { useState, useEffect, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { Field, Stepper, type FieldDef, type StepDef } from '@/components/ui';
import {
  buildBasicFields,
  fetchAllMaster,
  fetchEmployeeRefs,
  applyEmployeeFieldChange,
  type OptionList,
  type EmployeeRef,
} from '@/lib/employee-form-fields';

// Same fields buildBasicFields always returned — just grouped into smaller
// screens. Keeping the split as name lists (rather than editing
// employee-form-fields.ts) means the profile page's Basic tab, which uses
// the same buildBasicFields() and needs every field on one screen, is
// untouched.
const WIZARD_STEPS: { key: string; label: string; fieldNames: string[] }[] = [
  {
    key: 'basic',
    label: 'Basic Details',
    fieldNames: ['title', 'firstName', 'middleName', 'lastName', 'employeeCode', 'oldEmployeeCode', 'companyId', 'unitId'],
  },
  {
    key: 'organization',
    label: 'Organization',
    fieldNames: ['departmentId', 'subDepartmentId', 'designationId', 'employeeTypeId', 'categoryId', 'subCategory', 'gradeId', 'levelId'],
  },
  {
    key: 'role',
    label: 'Role & Team',
    fieldNames: ['productionLine', 'additionalRole', 'teamGroup', 'reportingManagerId'],
  },
  {
    key: 'terms',
    label: 'Employment Terms',
    fieldNames: ['status', 'joinDate', 'probationPeriodMonths', 'probationEndDate', 'confirmationDate', 'shiftMasterId', 'shiftPlanId'],
  },
];

export default function NewEmployeePage() {
  const router = useRouter();
  const [values, setValues] = useState<Record<string, string | number | boolean | undefined>>({
    status: 'active',
  });
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [stepIndex, setStepIndex] = useState(0);

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

  useEffect(() => {
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
      fetchEmployeeRefs(),
    ]).then(([co, dept, subDept, desig, empType, cat, grade, level, unit, shiftM, shiftP, mgrs]) => {
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

      // Default to the only company when there's exactly one (common case).
      if (co.length === 1) {
        setValues((v) => ({ ...v, companyId: co[0].id }));
      }
    });
  }, []);

  const basicFields: FieldDef[] = useMemo(
    () =>
      buildBasicFields({
        companies, units, departments, subDepartments, designations,
        employeeTypes, categories, grades, levels, shiftMasters, shiftPlans,
        reportingManagers,
      }),
    [companies, units, departments, subDepartments, designations, employeeTypes, categories, grades, levels, shiftMasters, shiftPlans, reportingManagers]
  );

  const fieldsByStep: FieldDef[][] = useMemo(
    () => WIZARD_STEPS.map((step) => basicFields.filter((f) => step.fieldNames.includes(f.name))),
    [basicFields]
  );

  const steps: StepDef[] = WIZARD_STEPS.map((step, i) => ({
    key: step.key,
    label: step.label,
    count: fieldsByStep[i]?.length,
  }));

  const currentStep = WIZARD_STEPS[stepIndex];
  const currentFields = fieldsByStep[stepIndex] ?? [];
  const isLastStep = stepIndex === WIZARD_STEPS.length - 1;

  // Live-recomputes the displayed Probation End Date as Date of Joining /
  // Probation Period change — a no-op for every other field on this tab.
  const handleChange = (name: string, value: string | number | boolean) => {
    setValues((v) => applyEmployeeFieldChange(v, name, value));
  };

  const missingRequired = (fields: FieldDef[]) =>
    fields.filter((f) => f.required && !f.disabled && !values[f.name]);

  const goNext = () => {
    const missing = missingRequired(currentFields);
    if (missing.length > 0) {
      setError(`Please fill in: ${missing.map((f) => f.label).join(', ')}`);
      return;
    }
    setError(null);
    setStepIndex((i) => Math.min(i + 1, WIZARD_STEPS.length - 1));
  };

  const goBack = () => {
    setError(null);
    setStepIndex((i) => Math.max(i - 1, 0));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const missing = missingRequired(currentFields);
    if (missing.length > 0) {
      setError(`Please fill in: ${missing.map((f) => f.label).join(', ')}`);
      return;
    }

    setSubmitting(true);
    setError(null);

    try {
      const res = await fetch('/api/employees', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(values),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error ?? 'Failed to create employee');
      }
      const created = await res.json();
      router.push(`/employees/${created.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create employee');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold" style={{ color: 'var(--foreground)' }}>
            Add Employee
          </h1>
          <p className="text-sm" style={{ color: 'var(--foreground-muted)' }}>
            Just the essentials to create the record — Personal, Contact, Job Profile, Salary, CTC, Assets, KYC and
            every other tab open up on the profile page right after this.
          </p>
        </div>
        <div className="flex shrink-0 gap-2">
          <button
            type="button"
            onClick={() => router.push('/employees')}
            className="rounded-lg border px-4 py-2 text-sm font-medium transition hover:opacity-80"
            style={{ borderColor: 'var(--border)', color: 'var(--foreground)' }}
          >
            Cancel
          </button>
          {stepIndex > 0 && (
            <button
              type="button"
              onClick={goBack}
              className="rounded-lg border px-4 py-2 text-sm font-medium transition hover:opacity-80"
              style={{ borderColor: 'var(--border)', color: 'var(--foreground)' }}
            >
              Back
            </button>
          )}
          {isLastStep ? (
            <button
              type="submit"
              disabled={submitting}
              className="rounded-lg px-4 py-2 text-sm font-medium text-white transition disabled:opacity-50"
              style={{ backgroundColor: 'var(--accent)' }}
            >
              {submitting ? 'Creating...' : 'Create & Continue'}
            </button>
          ) : (
            <button
              type="button"
              onClick={goNext}
              className="rounded-lg px-4 py-2 text-sm font-medium text-white transition"
              style={{ backgroundColor: 'var(--accent)' }}
            >
              Next
            </button>
          )}
        </div>
      </div>

      <div className="card px-5 py-4">
        <Stepper steps={steps} activeKey={currentStep.key} completedKeys={WIZARD_STEPS.slice(0, stepIndex).map((s) => s.key)} />
      </div>

      {error && (
        <div className="rounded-lg px-3 py-2 text-sm" style={{ backgroundColor: 'var(--danger-soft)', color: 'var(--danger)' }}>
          {error}
        </div>
      )}

      <div className="card p-5 space-y-4">
        <h2 className="text-sm font-semibold" style={{ color: 'var(--foreground)' }}>
          {currentStep.label}
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {currentFields.map((f) => (
            <Field key={f.name} def={f} value={values[f.name]} onChange={(v) => handleChange(f.name, v)} />
          ))}
        </div>
      </div>
    </form>
  );
}
