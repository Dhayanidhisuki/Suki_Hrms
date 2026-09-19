/**
 * Bulk Upload — segment-wise Excel import. One sheet per Employee-page tab
 * (Basic, Job Profile, Personal & Contact, CTC, Salary, Education,
 * Experience, Passport, Dependents, Emergency Contacts, Benefits, Assets,
 * Skills, KYC & Statutory), joined by an Employee Code column. See
 * docs/EMPLOYEE_EXCEL_IMPORT_PLAN_2026-09-18.md.
 *
 * Flow: download template → upload → client-side validation report (no
 * writes yet) → download error file to fix and re-upload, or import the
 * employees that passed. Each employee is written with the same section
 * APIs the Employee page itself uses (POST/PUT /basic, PUT /job-profile,
 * PUT /personal, PUT /contact, POST /ctc, POST /salary, PUT /passport,
 * POST /education, /experience, /dependents, /emergency-contacts, /assets,
 * /skills, PUT /benefits, PUT /kyc) so it shares their validation and side
 * effects instead of duplicating them.
 *
 * These are many separate requests per employee, not one transaction — if
 * Basic succeeds but a later sheet fails, the employee record already
 * exists; it's reported as PARTIAL rather than silently lost, and can be
 * completed from the employee's own profile page or by re-running the
 * import with that person's real code. The four mandatory sheets (Basic,
 * Job Profile, CTC, Salary, KYC) are attempted in parallel after Basic
 * succeeds; the optional/repeatable sheets are then attempted the same way,
 * and a bad repeatable row never blocks its siblings.
 */

'use client';

import { useState, useMemo } from 'react';
import Link from 'next/link';
import * as XLSX from 'xlsx';
import { fetchAllMaster, fetchEmployeeRefs, type EmployeeRef } from '@/lib/employee-form-fields';
import {
  buildTemplateWorkbook,
  parseImportWorkbook,
  validateBatch,
  buildErrorWorkbook,
  type BulkImportMasters,
  type EmployeeImportRow,
} from '@/lib/employee-bulk-import';

type Phase = 'basic' | 'jobProfile' | 'ctc' | 'salary' | 'kyc';
type PhaseStatus = 'pending' | 'ok' | 'failed' | 'skipped';
type RowState = 'blocked' | 'ready' | 'running' | 'imported' | 'partial' | 'failed';

interface RuntimeRow {
  data: EmployeeImportRow;
  state: RowState;
  resolvedEmployeeId?: number;
  resolvedEmployeeCode?: string;
  phase: Record<Phase, PhaseStatus>;
  phaseError: Partial<Record<Phase, string>>;
  extraErrors: string[]; // failures on optional/repeatable sheets during the actual write
}

const PHASES: Phase[] = ['basic', 'jobProfile', 'ctc', 'salary', 'kyc'];
const PHASE_LABEL: Record<Phase, string> = { basic: 'Basic', jobProfile: 'Job Profile', ctc: 'CTC', salary: 'Salary', kyc: 'KYC' };

/** Mirrors the "Read Me First" sheet built into the template — keep the two in sync. */
const SHEET_GUIDE: { sheet: string; mandatory: boolean; rows: 'One' | 'Many'; covers: string }[] = [
  { sheet: 'Basic', mandatory: true, rows: 'One', covers: 'Name, company, department, designation, join date, reporting manager, probation/confirmation' },
  { sheet: 'Job Profile', mandatory: true, rows: 'One', covers: 'Wage type, payment mode, PF/ESI/bonus/LTA flags, overtime rules, leave allowance' },
  { sheet: 'Personal & Contact', mandatory: false, rows: 'One', covers: 'Date of birth, gender, marital status, permanent and present address' },
  { sheet: 'CTC', mandatory: true, rows: 'One', covers: 'Fixed CTC breakup — Basic, HRA, allowances, Monthly/Annual CTC' },
  { sheet: 'Salary', mandatory: true, rows: 'One', covers: 'Component-wise salary used by payroll — one column per active salary component' },
  { sheet: 'Education', mandatory: false, rows: 'Many', covers: 'Qualifications — one row per qualification' },
  { sheet: 'Experience', mandatory: false, rows: 'Many', covers: 'Previous employment — one row per past employer' },
  { sheet: 'Passport', mandatory: false, rows: 'One', covers: 'Passport number and validity, if applicable' },
  { sheet: 'Dependents', mandatory: false, rows: 'Many', covers: 'Family members marked as dependents — one row per person' },
  { sheet: 'Emergency Contacts', mandatory: false, rows: 'Many', covers: 'Who to contact in an emergency — one row per contact' },
  { sheet: 'Benefits', mandatory: false, rows: 'Many', covers: 'Benefit rates assigned to this employee — one row per benefit, by its code' },
  { sheet: 'Assets', mandatory: false, rows: 'Many', covers: 'Company assets issued to this employee — one row per asset' },
  { sheet: 'Skills', mandatory: false, rows: 'Many', covers: 'Skill / machine / operation proficiency — one row per skill' },
  { sheet: 'KYC & Statutory', mandatory: true, rows: 'One', covers: 'PAN, Aadhaar, bank account, IFSC — required for payroll' },
];

function initRuntime(rows: EmployeeImportRow[]): RuntimeRow[] {
  return rows.map((data) => ({
    data,
    state: data.blocked ? 'blocked' : 'ready',
    phase: { basic: 'pending', jobProfile: 'pending', ctc: 'pending', salary: 'pending', kyc: 'pending' },
    phaseError: {},
    extraErrors: [],
  }));
}

async function callApi(url: string, method: 'POST' | 'PUT', body: unknown): Promise<{ ok: boolean; data: { error?: string; id?: number; employeeCode?: string } }> {
  const res = await fetch(url, { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
  const data = await res.json().catch(() => ({}));
  return { ok: res.ok, data };
}

export default function BulkUploadEmployeesPage() {
  const [downloading, setDownloading] = useState(false);
  const [parsing, setParsing] = useState(false);
  const [fileError, setFileError] = useState<string | null>(null);
  const [rows, setRows] = useState<RuntimeRow[]>([]);
  const [mastersCache, setMastersCache] = useState<BulkImportMasters | null>(null);
  const [allEmployees, setAllEmployees] = useState<EmployeeRef[]>([]);
  const [importing, setImporting] = useState(false);
  const [sheetsSeen, setSheetsSeen] = useState<string[]>([]);
  const [blankCodeCount, setBlankCodeCount] = useState(0);
  const [showHelp, setShowHelp] = useState(true);

  const loadMasters = useMemo(
    () => async (): Promise<{ masters: BulkImportMasters; employees: EmployeeRef[] }> => {
      const [
        companies, units, departments, subDepartments, designations, employeeTypes, categories, grades, levels,
        salaryComponents, assetMasters, benefitRates, employees,
      ] = await Promise.all([
        fetchAllMaster('companies'),
        fetchAllMaster('units'),
        fetchAllMaster('departments'),
        fetchAllMaster('sub-departments'),
        fetchAllMaster('designations'),
        fetchAllMaster('employee-types'),
        fetchAllMaster('categories'),
        fetchAllMaster('grades'),
        fetchAllMaster('levels'),
        fetchAllMaster('salary-components'),
        fetchAllMaster('asset-masters'),
        fetchAllMaster('benefit-rates'),
        fetchEmployeeRefs(),
      ]);
      const masters: BulkImportMasters = {
        companies, units, departments, subDepartments, designations, employeeTypes, categories, grades, levels,
        salaryComponents, assetMasters, benefitRates, reportingManagers: employees,
      };
      setMastersCache(masters);
      setAllEmployees(employees);
      return { masters, employees };
    },
    []
  );

  const downloadTemplate = async () => {
    setDownloading(true);
    try {
      const { masters } = await loadMasters();
      const wb = buildTemplateWorkbook(masters);
      XLSX.writeFile(wb, 'employee-bulk-upload-template.xlsx');
    } finally {
      setDownloading(false);
    }
  };

  const handleFile = async (file: File) => {
    setFileError(null);
    setRows([]);
    setParsing(true);
    try {
      const { masters, employees } = mastersCache && allEmployees.length ? { masters: mastersCache, employees: allEmployees } : await loadMasters();
      const existingCodes = new Set<string>();
      for (const e of employees) {
        existingCodes.add(e.employeeCode.toUpperCase());
        if (e.oldEmployeeCode) existingCodes.add(e.oldEmployeeCode.toUpperCase());
      }
      const buf = await file.arrayBuffer();
      const { rows: parsedRows, sheetsFound, blankCodeRows } = parseImportWorkbook(buf, masters, existingCodes);
      if (parsedRows.length === 0) {
        setFileError('No rows found — check that the workbook still has the Basic, Job Profile, CTC, Salary and KYC & Statutory sheets with an Employee Code on every row.');
        return;
      }
      validateBatch(parsedRows);
      setSheetsSeen(sheetsFound);
      setBlankCodeCount(blankCodeRows.length);
      setRows(initRuntime(parsedRows));
    } catch (err) {
      setFileError(err instanceof Error ? err.message : 'Failed to read the uploaded file');
    } finally {
      setParsing(false);
    }
  };

  const codeToExistingId = useMemo(() => {
    const map = new Map<string, number>();
    for (const e of allEmployees) {
      map.set(e.employeeCode.toUpperCase(), e.id);
      if (e.oldEmployeeCode) map.set(e.oldEmployeeCode.toUpperCase(), e.id);
    }
    return map;
  }, [allEmployees]);

  const downloadErrorFile = () => {
    if (!mastersCache) return;
    const failing = rows.filter((r) => r.state !== 'imported').map((r) => r.data);
    if (failing.length === 0) return;
    const wb = buildErrorWorkbook(failing, mastersCache);
    XLSX.writeFile(wb, 'employee-bulk-upload-errors.xlsx');
  };

  /** Writes every optional/repeatable sheet for one employee; each item is independent — one failing row never blocks another. */
  async function writeOptionalSheets(employeeId: number, d: EmployeeImportRow): Promise<string[]> {
    const errors: string[] = [];
    const tasks: Promise<void>[] = [];

    if (d.personal.payload) {
      tasks.push(
        callApi(`/api/employees/${employeeId}/personal`, 'PUT', d.personal.payload.personal).then(({ ok, data }) => {
          if (!ok) errors.push(`Personal: ${data.error ?? 'failed'}`);
        })
      );
      tasks.push(
        callApi(`/api/employees/${employeeId}/contact`, 'PUT', d.personal.payload.contact).then(({ ok, data }) => {
          if (!ok) errors.push(`Contact: ${data.error ?? 'failed'}`);
        })
      );
    }
    if (d.passport.payload) {
      tasks.push(
        callApi(`/api/employees/${employeeId}/passport`, 'PUT', d.passport.payload).then(({ ok, data }) => {
          if (!ok) errors.push(`Passport: ${data.error ?? 'failed'}`);
        })
      );
    }
    if (d.benefits.some((b) => b.payload)) {
      const benefitRateIds = d.benefits.filter((b) => b.payload).map((b) => b.payload!.benefitRateId);
      tasks.push(
        callApi(`/api/employees/${employeeId}/benefits`, 'PUT', { benefitRateIds }).then(({ ok, data }) => {
          if (!ok) errors.push(`Benefits: ${data.error ?? 'failed'}`);
        })
      );
    }

    const repeatable: { name: string; url: string; items: { payload?: unknown }[] }[] = [
      { name: 'Education', url: `/api/employees/${employeeId}/education`, items: d.education },
      { name: 'Experience', url: `/api/employees/${employeeId}/experience`, items: d.experience },
      { name: 'Dependents', url: `/api/employees/${employeeId}/dependents`, items: d.dependents },
      { name: 'Emergency Contacts', url: `/api/employees/${employeeId}/emergency-contacts`, items: d.emergencyContacts },
      { name: 'Assets', url: `/api/employees/${employeeId}/assets`, items: d.assets },
      { name: 'Skills', url: `/api/employees/${employeeId}/skills`, items: d.skills },
    ];
    for (const group of repeatable) {
      for (const item of group.items) {
        if (!item.payload) continue; // already flagged as a warning at parse/validate time
        tasks.push(
          callApi(group.url, 'POST', item.payload).then(({ ok, data }) => {
            if (!ok) errors.push(`${group.name}: ${data.error ?? 'failed'}`);
          })
        );
      }
    }

    await Promise.allSettled(tasks);
    return errors;
  }

  const runImport = async () => {
    setImporting(true);
    try {
      for (let i = 0; i < rows.length; i++) {
        if (rows[i].state === 'blocked') continue;
        setRows((prev) => prev.map((r, idx) => (idx === i ? { ...r, state: 'running' } : r)));

        const row = rows[i];
        const d = row.data;
        let employeeId: number | undefined;
        let employeeCode: string | undefined;
        const phase: Record<Phase, PhaseStatus> = { basic: 'pending', jobProfile: 'pending', ctc: 'pending', salary: 'pending', kyc: 'pending' };
        const phaseError: Partial<Record<Phase, string>> = {};

        // ── Basic (create or update) ──
        try {
          if (d.isNewEmployee) {
            const { ok, data } = await callApi('/api/employees', 'POST', d.basic.payload);
            if (!ok) throw new Error(data.error ?? 'Failed to create employee');
            employeeId = data.id;
            employeeCode = data.employeeCode;
          } else {
            const existingId = codeToExistingId.get(d.code.toUpperCase());
            if (!existingId) throw new Error('Employee Code not found among existing employees');
            const { ok, data } = await callApi(`/api/employees/${existingId}/basic`, 'PUT', {
              ...d.basic.payload,
              employeeCode: d.code,
            });
            if (!ok) throw new Error(data.error ?? 'Failed to update employee');
            employeeId = existingId;
            employeeCode = d.code;
          }
          phase.basic = 'ok';
        } catch (err) {
          phase.basic = 'failed';
          phaseError.basic = err instanceof Error ? err.message : 'Failed';
          phase.jobProfile = phase.ctc = phase.salary = phase.kyc = 'skipped';
          setRows((prev) => prev.map((r, idx) => (idx === i ? { ...r, state: 'failed', phase, phaseError } : r)));
          continue;
        }

        // ── Job Profile, CTC, Salary, KYC — independent, all attempted even if one fails ──
        const results = await Promise.allSettled([
          callApi(`/api/employees/${employeeId}/job-profile`, 'PUT', d.jobProfile.payload),
          callApi(`/api/employees/${employeeId}/ctc`, 'POST', d.ctc.payload),
          callApi(`/api/employees/${employeeId}/salary`, 'POST', {
            financialYear: d.salary.payload?.financialYear,
            grossSalary: d.salary.payload?.grossSalary,
            effectiveFrom: d.salary.payload?.effectiveFrom,
            components: d.salary.payload?.components,
          }),
          callApi(`/api/employees/${employeeId}/kyc`, 'PUT', d.kyc.payload),
        ]);

        (['jobProfile', 'ctc', 'salary', 'kyc'] as Phase[]).forEach((p, idx) => {
          const settled = results[idx];
          if (settled.status === 'fulfilled' && settled.value.ok) {
            phase[p] = 'ok';
          } else {
            phase[p] = 'failed';
            phaseError[p] =
              settled.status === 'fulfilled' ? settled.value.data?.error ?? 'Failed' : settled.reason instanceof Error ? settled.reason.message : 'Failed';
          }
        });

        const extraErrors = employeeId ? await writeOptionalSheets(employeeId, d) : [];

        const allOk = PHASES.every((p) => phase[p] === 'ok') && extraErrors.length === 0;
        const finalState: RowState = allOk ? 'imported' : 'partial';

        setRows((prev) =>
          prev.map((r, idx) =>
            idx === i ? { ...r, state: finalState, resolvedEmployeeId: employeeId, resolvedEmployeeCode: employeeCode, phase, phaseError, extraErrors } : r
          )
        );
      }
    } finally {
      setImporting(false);
    }
  };

  const blockedCount = rows.filter((r) => r.state === 'blocked').length;
  const readyCount = rows.filter((r) => r.state === 'ready').length;
  const importedCount = rows.filter((r) => r.state === 'imported').length;
  const partialCount = rows.filter((r) => r.state === 'partial').length;
  const failedCount = rows.filter((r) => r.state === 'failed').length;
  const finishedCount = importedCount + partialCount + failedCount;

  const STATE_LABEL: Record<RowState, string> = {
    blocked: 'Blocked', ready: 'Ready', running: 'Importing…', imported: 'Imported', partial: 'Partial', failed: 'Failed',
  };
  const STATE_COLOR: Record<RowState, string> = {
    blocked: 'var(--danger)', ready: 'var(--foreground-muted)', running: 'var(--warning)',
    imported: 'var(--success)', partial: 'var(--warning)', failed: 'var(--danger)',
  };

  return (
    <div className="space-y-4">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold" style={{ color: 'var(--foreground)' }}>
            Bulk Upload Employees
          </h1>
          <p className="text-sm" style={{ color: 'var(--foreground-muted)' }}>
            Download the segment-wise template — one sheet per Employee page tab — fill one row per employee per
            sheet keyed by Employee Code, then upload it here. Basic, Job Profile, CTC, Salary and KYC &amp;
            Statutory are mandatory for every employee; the rest are optional.
          </p>
        </div>
        <Link
          href="/employees"
          className="rounded-lg border px-4 py-2 text-sm font-medium transition hover:opacity-80 shrink-0"
          style={{ borderColor: 'var(--border)', color: 'var(--foreground)' }}
        >
          Back to Employee Master
        </Link>
      </div>

      <div className="card p-5 space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold" style={{ color: 'var(--foreground)' }}>
            How to fill this in
          </h2>
          <button
            type="button"
            onClick={() => setShowHelp((v) => !v)}
            className="text-sm font-medium hover:underline"
            style={{ color: 'var(--accent)' }}
          >
            {showHelp ? 'Hide' : 'Show'}
          </button>
        </div>

        {showHelp && (
          <div className="space-y-4 text-sm" style={{ color: 'var(--foreground)' }}>
            <ol className="list-decimal list-inside space-y-1.5" style={{ color: 'var(--foreground-muted)' }}>
              <li>
                Start with the <strong style={{ color: 'var(--foreground)' }}>Basic</strong> sheet — every other sheet is
                matched to it by the <strong style={{ color: 'var(--foreground)' }}>Employee Code</strong> column.
              </li>
              <li>
                Hiring someone new? Invent a short temporary code, e.g. <code>NEW-001</code>, <code>NEW-002</code> — and
                use that exact same code on every sheet you fill in for that person.
              </li>
              <li>Updating someone already in the system? Use their real Employee Code (or Device ID) from the Employee Master — not a temporary code.</li>
              <li>The 5 sheets marked <strong style={{ color: 'var(--danger)' }}>Mandatory</strong> below need one row per employee, or that employee is not imported.</li>
              <li>The rest are optional — leave a sheet blank for someone if it does not apply. Several can have more than one row per employee (add as many rows as needed, repeating the Employee Code).</li>
              <li>
                For Company / Department / Designation / Employee Type / Category / Grade / Level / Asset Type, type the
                name exactly as it appears on the <strong style={{ color: 'var(--foreground)' }}>Reference Lists</strong>{' '}
                sheet — copy-paste from there is safest.
              </li>
              <li>Dates go in YYYY-MM-DD. Yes/No columns take the word &quot;Yes&quot; or &quot;No&quot;.</li>
              <li>Upload the filled file below — nothing is saved yet. You get a report first, per employee, per sheet.</li>
              <li>
                Anyone marked <strong style={{ color: 'var(--danger)' }}>Blocked</strong> was not imported.{' '}
                <strong style={{ color: 'var(--foreground)' }}>Download Error File</strong> — it&apos;s this same template
                with only the people still needing fixes, showing exactly what&apos;s wrong. Fix those cells and upload it
                again.
              </li>
            </ol>

            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left" style={{ color: 'var(--foreground-muted)' }}>
                    <th className="py-1.5 pr-4">Sheet</th>
                    <th className="py-1.5 pr-4">Mandatory?</th>
                    <th className="py-1.5 pr-4">Rows / employee</th>
                    <th className="py-1.5 pr-4">Covers</th>
                  </tr>
                </thead>
                <tbody>
                  {SHEET_GUIDE.map((s) => (
                    <tr key={s.sheet} style={{ borderTop: '1px solid var(--border)' }}>
                      <td className="py-1.5 pr-4 font-medium">{s.sheet}</td>
                      <td className="py-1.5 pr-4" style={{ color: s.mandatory ? 'var(--danger)' : 'var(--foreground-muted)' }}>
                        {s.mandatory ? 'Mandatory' : 'Optional'}
                      </td>
                      <td className="py-1.5 pr-4" style={{ color: 'var(--foreground-muted)' }}>{s.rows}</td>
                      <td className="py-1.5 pr-4" style={{ color: 'var(--foreground-muted)' }}>{s.covers}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className="text-xs" style={{ color: 'var(--foreground-muted)' }}>
              The same instructions are built into the workbook itself, on its first sheet — &quot;Read Me First&quot; —
              so they travel with the file even if someone else opens it later.
            </p>
          </div>
        )}
      </div>

      <div className="card p-5 space-y-3">
        <h2 className="text-sm font-semibold" style={{ color: 'var(--foreground)' }}>
          Step 1 — Download template
        </h2>
        <button
          type="button"
          onClick={downloadTemplate}
          disabled={downloading}
          className="rounded-lg px-4 py-2 text-sm font-medium text-white transition disabled:opacity-50"
          style={{ backgroundColor: 'var(--accent)' }}
        >
          {downloading ? 'Preparing…' : 'Download Excel Template'}
        </button>
      </div>

      <div className="card p-5 space-y-3">
        <h2 className="text-sm font-semibold" style={{ color: 'var(--foreground)' }}>
          Step 2 — Upload filled template
        </h2>
        <input
          type="file"
          accept=".xlsx,.xls"
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) handleFile(f);
          }}
          className="text-sm"
        />
        {parsing && <p className="text-sm" style={{ color: 'var(--foreground-muted)' }}>Reading and validating…</p>}
        {fileError && (
          <div className="rounded-lg px-3 py-2 text-sm" style={{ backgroundColor: 'var(--danger-soft)', color: 'var(--danger)' }}>
            {fileError}
          </div>
        )}
        {blankCodeCount > 0 && (
          <div className="rounded-lg px-3 py-2 text-sm" style={{ backgroundColor: 'var(--warning-soft)', color: 'var(--warning)' }}>
            {blankCodeCount} row{blankCodeCount !== 1 ? 's' : ''} across the workbook had a blank Employee Code and could not be
            matched to anyone — they were skipped.
          </div>
        )}
        {rows.length > 0 && sheetsSeen.length < 5 && (
          <div className="rounded-lg px-3 py-2 text-sm" style={{ backgroundColor: 'var(--warning-soft)', color: 'var(--warning)' }}>
            Only found sheet(s): {sheetsSeen.join(', ') || 'none'}. Missing mandatory sheets are treated as missing for every
            employee.
          </div>
        )}
      </div>

      {rows.length > 0 && (
        <div className="card p-5 space-y-3">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <h2 className="text-sm font-semibold" style={{ color: 'var(--foreground)' }}>
              Step 3 — Review &amp; import ({rows.length} employee{rows.length !== 1 ? 's' : ''} found, {blockedCount} blocked,{' '}
              {readyCount} ready
              {finishedCount > 0
                ? `, ${importedCount} imported${partialCount ? `, ${partialCount} partial` : ''}${failedCount ? `, ${failedCount} failed` : ''}`
                : ''}
              )
            </h2>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={downloadErrorFile}
                disabled={blockedCount + failedCount + partialCount === 0}
                className="rounded-lg border px-4 py-2 text-sm font-medium transition disabled:opacity-50"
                style={{ borderColor: 'var(--border)', color: 'var(--foreground)' }}
              >
                Download Error File
              </button>
              <button
                type="button"
                onClick={runImport}
                disabled={importing || readyCount === 0}
                className="rounded-lg px-4 py-2 text-sm font-medium text-white transition disabled:opacity-50"
                style={{ backgroundColor: 'var(--accent)' }}
              >
                {importing ? 'Importing…' : `Import ${readyCount} Employee${readyCount !== 1 ? 's' : ''}`}
              </button>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left" style={{ color: 'var(--foreground-muted)' }}>
                  <th className="py-2 pr-4">Employee Code</th>
                  <th className="py-2 pr-4">Name</th>
                  <th className="py-2 pr-4">New?</th>
                  <th className="py-2 pr-4">Status</th>
                  {PHASES.map((p) => (
                    <th key={p} className="py-2 pr-4">{PHASE_LABEL[p]}</th>
                  ))}
                  <th className="py-2 pr-4">Details</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r, idx) => {
                  const mandatoryPresence: Record<Phase, { present: boolean; errors: string[] }> = {
                    basic: r.data.basic, jobProfile: r.data.jobProfile, ctc: r.data.ctc, salary: r.data.salary, kyc: r.data.kyc,
                  };
                  return (
                    <tr key={r.data.code + idx} style={{ borderTop: '1px solid var(--border)' }}>
                      <td className="py-2 pr-4">{r.resolvedEmployeeCode ?? r.data.code}</td>
                      <td className="py-2 pr-4">{r.data.displayName}</td>
                      <td className="py-2 pr-4">{r.data.isNewEmployee ? 'Yes' : 'No'}</td>
                      <td className="py-2 pr-4 font-medium" style={{ color: STATE_COLOR[r.state] }}>
                        {STATE_LABEL[r.state]}
                      </td>
                      {PHASES.map((p) => (
                        <td key={p} className="py-2 pr-4" style={{ color: 'var(--foreground-muted)' }}>
                          {r.state === 'blocked'
                            ? !mandatoryPresence[p].present
                              ? 'missing'
                              : mandatoryPresence[p].errors.length > 0
                                ? 'error'
                                : 'ok'
                            : r.phase[p]}
                        </td>
                      ))}
                      <td className="py-2 pr-4 max-w-md" style={{ color: 'var(--foreground-muted)' }}>
                        {r.state === 'blocked'
                          ? r.data.blockReasons.join('; ')
                          : [...Object.values(r.phaseError), ...r.extraErrors].join('; ') || (r.data.warnings.length ? r.data.warnings.join('; ') : '')}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
