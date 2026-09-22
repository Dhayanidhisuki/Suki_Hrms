/**
 * Guards a failure class this codebase has now produced twice: a string key
 * declared in one place and consumed in another, with nothing asserting the
 * two agree. Neither instance threw — the totals stayed correct, so every
 * existing test passed while the output was quietly wrong.
 *
 *  1. payrollCalculation looked up salary components DM_INCENTIVE / PETROL /
 *     EMP_REFERRAL while the catalog declared DOUBLE_MACHINE / PETROL_ALLOW /
 *     REFERRAL_BONUS. The lookups matched nothing, so the amounts were paid
 *     but never itemised — every incentive collapsed into "Other Earnings".
 *
 *  2. A Permission row stored with submodule `double-machine` for the code
 *     `payroll.dm.approve` matched nothing in checkSpecificPermission, which
 *     derives the submodule from the code itself. Every caller got a 403
 *     despite the RolePermission grant existing.
 *
 * These are source-level checks on purpose: they need no database, and they
 * fail at the moment the drift is introduced rather than when someone traces
 * a payslip line by line.
 */

import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { DEFAULT_SALARY_COMPONENTS } from '@/lib/defaultSalaryComponents';

const root = path.resolve(__dirname, '../..');
const read = (p: string) => readFileSync(path.join(root, p), 'utf8');

/** Salary component codes a file resolves at runtime. */
function extractComponentCodes(source: string): Set<string> {
  const codes = new Set<string>();
  // prisma.salaryComponent.findUnique({ where: { companyId_code: { companyId, code: 'X' } } })
  for (const m of source.matchAll(/companyId_code:\s*\{\s*companyId[^}]*?code:\s*'([A-Z0-9_]+)'/g)) codes.add(m[1]);
  // helper call sites: creditAutoEarning('X', …) / componentAmount('X') / pick('X', …)
  for (const m of source.matchAll(/(?:creditAutoEarning|componentAmount|pick)\(\s*'([A-Z0-9_]+)'/g)) codes.add(m[1]);
  // where: { salaryComponent: { code: { in: ['A', 'B'] } } }
  for (const m of source.matchAll(/code:\s*\{\s*in:\s*\[([^\]]+)\]/g)) {
    for (const c of m[1].matchAll(/'([A-Z0-9_]+)'/g)) codes.add(c[1]);
  }
  // componentSum(['BASIC', 'DA', 'HRA']) — the OT-basis and bonus-base sums
  for (const m of source.matchAll(/componentSum\(\[([^\]]+)\]/g)) {
    for (const c of m[1].matchAll(/'([A-Z0-9_]+)'/g)) codes.add(c[1]);
  }
  return codes;
}

/**
 * Codes the catalog declares that nothing resolves. Allowlisted rather than
 * failed: these were added for the BenefitRateByEmployeeType / ad-hoc-line
 * mechanism, and a company may already have payroll lines pointing at them.
 * The point of the allowlist is that a NEW orphan fails this test.
 */
const KNOWN_UNCONSUMED = new Set([
  'SRA', 'QA', 'FDA', 'SNACKS', 'SPL_ALLOW', 'HEAT', 'WASH', 'NIGHT_SHIFT', 'DA',
  'EDUCATION', 'ATTENDANCE', 'ADD_HRA', 'HEALTH', 'CANTEEN', 'GUEST_HOUSE', 'CCA',
  'DIS_LOCATION', 'OTHER1', 'OTHER2', 'OTHER3', 'LUNCH_PER_DAY', 'FOOD', 'PROD_INS',
  'PERFORMANCE', 'LIC', 'LWF', 'ATTENDANCE1', 'ATTENDANCE2', 'OTHER_DED2', 'CONVEYANCE',
  'PETROL_ALLOW', 'DOUBLE_MACHINE', 'EXTRA_WORK', 'REFERRAL_BONUS',
]);

const CONSUMER_FILES = [
  'src/lib/payrollCalculation.ts',
  'src/lib/payroll/otIncentiveRegister.ts',
  'src/lib/payroll/otCalculation.ts',
  'src/app/api/reports/payroll/double-machine/route.ts',
  'src/lib/arrearApply.ts',
  'src/lib/bonusApply.ts',
  'src/lib/bonusCalculation.ts',
];

/**
 * Codes payroll resolves whose amount ALSO lives in a PayrollLine column that
 * PayslipView renders from directly (`if (Number(line.otAmount) > 0) …`).
 *
 * These must deliberately NOT be seeded. If the component existed, payroll
 * would write a component row AND the column would still render its own line,
 * so the payslip would show the same money twice and the earnings lines would
 * overstate Total Earnings. Verified as latent, not live: no PayrollLine
 * currently has both a non-zero column and its matching component row.
 *
 * The real fix is for PayslipView to prefer one path or the other — tracked,
 * not done. Until then, seeding any of these is a payslip bug.
 */
const COLUMN_BACKED_DO_NOT_SEED = new Set([
  'OT_PAY',        // line.otAmount
  'OT_INCENTIVE',  // line.otIncentiveAmount
  'LOM',           // line.lomAmount
  'HEALTH_INS',    // line.healthInsurance
  'LOAN',          // folded into otherDeductionsTotal, shown via "Other Auto Deductions"
  'NIGHT_ALLOWANCE', // AllowanceConfig-driven; already present in company data
]);

describe('salary component codes: catalog vs consumers', () => {
  const declared = new Set(DEFAULT_SALARY_COMPONENTS.map((c) => c.code));
  const consumed = new Set<string>();
  for (const f of CONSUMER_FILES) for (const c of extractComponentCodes(read(f))) consumed.add(c);

  it('finds the codes it is supposed to be checking', () => {
    // A regex that silently matches nothing would make this suite vacuous.
    expect(consumed.size, 'no component codes extracted — the patterns have drifted').toBeGreaterThan(5);
    expect(consumed.has('DM_INCENTIVE')).toBe(true);
    expect(consumed.has('PF')).toBe(true);
  });

  it('every code payroll and the reports look up exists in the catalog', () => {
    const missing = [...consumed]
      .filter((c) => !declared.has(c) && !COLUMN_BACKED_DO_NOT_SEED.has(c))
      .sort();
    expect(
      missing,
      `These codes are resolved at runtime but never seeded, so the lookup silently `
        + `returns nothing and the amount is paid without ever being itemised. Add them `
        + `to src/lib/defaultSalaryComponents.ts (and backfill existing companies with a `
        + `scripts/seed-*.mjs): ${missing.join(', ')}`
    ).toEqual([]);
  });

  it('flags a catalog entry that nothing consumes, unless it is a known orphan', () => {
    const orphans = [...declared]
      .filter((c) => !consumed.has(c) && !KNOWN_UNCONSUMED.has(c))
      .sort();
    expect(
      orphans,
      `Declared in the catalog but resolved by no code. Either something should `
        + `consume it, or it belongs in KNOWN_UNCONSUMED with a note: ${orphans.join(', ')}`
    ).toEqual([]);
  });
});

describe('permission codes: submodule must match the code', () => {
  const source = read('src/app/api/superadmin/companies/[id]/bootstrap-admin/route.ts');
  const defs = [...source.matchAll(
    /\{\s*code:\s*'([a-z0-9_.-]+)'\s*,\s*module:\s*'([a-z0-9_-]+)'\s*,\s*submodule:\s*('([a-z0-9_.-]+)'|null)/g
  )].map((m) => ({ code: m[1], module: m[2], submodule: m[4] ?? null }));

  it('finds the permission definitions', () => {
    expect(defs.length, 'no permission definitions extracted — the pattern has drifted').toBeGreaterThan(20);
  });

  it('each definition matches how checkSpecificPermission parses its code', () => {
    // rbac-employee.ts: const [module, ...rest] = code.split('.');
    //                   action = rest.at(-1); submodule = rest.slice(0, -1).join('.') || undefined
    const wrong = defs
      .map((d) => {
        const [module, ...rest] = d.code.split('.');
        const expectedSub = rest.slice(0, -1).join('.') || null;
        return { ...d, expectedModule: module, expectedSub };
      })
      .filter((d) => d.module !== d.expectedModule || (d.submodule ?? null) !== d.expectedSub)
      .map((d) => `${d.code}: stored module/submodule "${d.module}"/"${d.submodule}" but the code parses to "${d.expectedModule}"/"${d.expectedSub}"`);

    expect(
      wrong,
      `checkSpecificPermission derives { module, submodule, action } from the code `
        + `string, so a row stored with anything else matches nothing and every caller `
        + `gets a 403 even with the grant in place:\n${wrong.join('\n')}`
    ).toEqual([]);
  });
});
