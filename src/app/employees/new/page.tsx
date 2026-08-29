/**
 * Add Employee — captures just Basic Details, the minimum needed to create
 * the Employee + current JobInfo row. Every other tab (Personal, Contact,
 * Job Profile, Salary, CTC, Assets, KYC, Education, ...) is a child record
 * that needs a real employee id to save against, so it isn't reachable until
 * the employee exists — "Create & Continue" redirects straight to the full
 * profile (src/app/employees/[id]/page.tsx) where every tab is live.
 */

'use client';

import { useState, useEffect, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { Field, type FieldDef } from '@/components/ui';
import {
  buildBasicFields,
  fetchAllMaster,
  fetchEmployeeRefs,
  applyEmployeeFieldChange,
  type OptionList,
  type EmployeeRef,
} from '@/lib/employee-form-fields';

export default function NewEmployeePage() {
  const router = useRouter();
  const [values, setValues] = useState<Record<string, string | number | boolean | undefined>>({
    status: 'active',
  });
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

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

  // Live-recomputes the displayed Probation End Date as Date of Joining /
  // Probation Period change — a no-op for every other field on this tab.
  const handleChange = (name: string, value: string | number | boolean) => {
    setValues((v) => applyEmployeeFieldChange(v, name, value));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
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
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold" style={{ color: 'var(--foreground)' }}>
            Add Employee
          </h1>
          <p className="text-sm" style={{ color: 'var(--foreground-muted)' }}>
            Just the essentials to create the record — Personal, Contact, Job Profile, Salary, CTC, Assets, KYC and
            every other tab open up on the profile page right after this.
          </p>
        </div>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => router.push('/employees')}
            className="rounded-lg border px-4 py-2 text-sm font-medium transition hover:opacity-80"
            style={{ borderColor: 'var(--border)', color: 'var(--foreground)' }}
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={submitting}
            className="rounded-lg px-4 py-2 text-sm font-medium text-white transition disabled:opacity-50"
            style={{ backgroundColor: 'var(--accent)' }}
          >
            {submitting ? 'Creating...' : 'Create & Continue'}
          </button>
        </div>
      </div>

      {error && (
        <div className="rounded-lg px-3 py-2 text-sm" style={{ backgroundColor: 'var(--danger-soft)', color: 'var(--danger)' }}>
          {error}
        </div>
      )}

      <div className="card p-5 space-y-4">
        <h2 className="text-sm font-semibold" style={{ color: 'var(--foreground)' }}>
          Basic Details
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {basicFields.map((f) => (
            <Field key={f.name} def={f} value={values[f.name]} onChange={(v) => handleChange(f.name, v)} />
          ))}
        </div>
      </div>
    </form>
  );
}
