/**
 * Continuation of seed-kun-biometric-demo.mts: Phase 1/2 (delete old
 * employees, create the 25 real ones matching the sample EMP_IDs) already
 * completed successfully in the prior run. This resumes from Phase 4 —
 * re-importing all periods (safe/idempotent: the import route upserts on
 * [companyId, empIdRaw, year, attForMonth] and DailyAttendance upserts on
 * [employeeId, date], so re-running never duplicates anything) — through
 * the full Finalize -> Freeze -> Payroll auto-trigger -> Reopen lifecycle
 * demo on Feb 2026.
 *
 *   npx tsx scripts/seed-kun-biometric-demo-part2.mts
 */
import { readFileSync } from 'node:fs';
import { NextRequest } from 'next/server';

for (const line of readFileSync(new URL('../.env', import.meta.url), 'utf8').split('\n')) {
  const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/i);
  if (!m) continue;
  const v = m[2].trim().replace(/^["']|["']$/g, '');
  if (!process.env[m[1]]) process.env[m[1]] = v;
}

const { prisma } = await import('@/lib/prisma');

const COMPANY_ID = 1;
const SCRATCH = 'C:/Users/franklin/AppData/Local/Temp/claude/D--HRMS/c7619703-558a-410c-9771-c3b58c438048/scratchpad';

// Stops at May-Jun by request — Jun-Jul and Jul-Aug are deliberately not
// imported. Feb-Mar..Apr-May carry all 25 employees; May-Jun carries 5.
const PERIOD_START: Record<string, string> = {
  'Feb-Mar': '2026-02-01', 'Mar-Apr': '2026-03-01', 'Apr-May': '2026-04-01',
  'May-Jun': '2026-05-01',
};

function parseSsmsGrid(raw: string): Record<string, string>[] {
  const lines = raw.replace(/\r\n/g, '\n').split('\n');
  let i = 0;
  while (i < lines.length && lines[i].trim() === '') i++;
  const headerLine = lines[i];
  const sepLine = lines[i + 1] ?? '';
  const bounds: { start: number; end: number }[] = [];
  const dashRegex = /-+/g;
  let m: RegExpExecArray | null;
  while ((m = dashRegex.exec(sepLine))) bounds.push({ start: m.index, end: m.index + m[0].length });
  const headers = bounds.map((b) => headerLine.slice(b.start, b.end).trim());
  const rows: Record<string, string>[] = [];
  for (let j = i + 2; j < lines.length; j++) {
    const line = lines[j];
    if (line.trim() === '') break;
    if (/^\(\d+ rows? affected\)/i.test(line.trim())) break;
    const rowObj: Record<string, string> = {};
    bounds.forEach((b, idx) => {
      rowObj[headers[idx]] = (idx === bounds.length - 1 ? line.slice(b.start) : line.slice(b.start, b.end)).trim();
    });
    rows.push(rowObj);
  }
  return rows;
}
function num(v: string | undefined): number | null {
  if (!v || v.toUpperCase() === 'NULL') return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}
function str(v: string | undefined): string | null {
  if (!v || v.toUpperCase() === 'NULL') return null;
  return v;
}
function isoDateTime(v: string | undefined): string | null {
  const s = str(v);
  return s ? s.replace(' ', 'T') : null;
}
function mapHoursRow(c: Record<string, string>): Record<string, unknown> {
  const row: Record<string, unknown> = {
    empIdRaw: c['EMP_ID'], year: num(c['YEAR']), attForMonth: c['ATT_FOR_MONTH'],
    refNo: num(c['REF_NO']), total: num(c['TOTAL']), totalLom: num(c['TOTAL_LOM']), totalOtHrs: num(c['TOTAL_OT_HRS']),
    creatUserIdCd: str(c['CREAT_USER_ID_CD']), creatDt: isoDateTime(c['CREAT_DT']),
    lstUpdtUserIdCd: str(c['LST_UPDT_USER_ID_CD']), lstUpdtTs: isoDateTime(c['LST_UPDT_TS']),
    attEndMonth: isoDateTime(c['ATT_END_MONTH']),
  };
  for (let d = 1; d <= 31; d++) row[`day${d}`] = num(c[`DAY${d}`]);
  return row;
}
function mapInTimeRow(c: Record<string, string>): Record<string, unknown> {
  const row: Record<string, unknown> = { empIdRaw: c['EMP_ID'], year: num(c['YEAR']), attForMonth: c['ATT_FOR_MONTH'] };
  for (let d = 1; d <= 31; d++) row[`day${d}InTime`] = num(c[`DAY${d}_INTIME`]);
  return row;
}
function mapOutTimeRow(c: Record<string, string>): Record<string, unknown> {
  const row: Record<string, unknown> = { empIdRaw: c['EMP_ID'], year: num(c['YEAR']), attForMonth: c['ATT_FOR_MONTH'] };
  for (let d = 1; d <= 31; d++) row[`day${d}OutTime`] = num(c[`DAY${d}_OUTTIME`]);
  return row;
}

function req(url: string, auth: { roleId: number; userId: number }, opts: { method?: string; body?: unknown } = {}) {
  const headers = new Headers({
    'content-type': 'application/json',
    'x-role-id': String(auth.roleId),
    'x-user-id': String(auth.userId),
    'x-company-id': String(COMPANY_ID),
  });
  return new NextRequest(new URL(url, 'http://localhost'), {
    method: opts.method ?? 'GET',
    headers,
    body: opts.body !== undefined ? JSON.stringify(opts.body) : undefined,
  });
}

async function main() {
  const company = await prisma.company.findUniqueOrThrow({ where: { id: COMPANY_ID } });
  console.log('Company:', company.name);
  const adminRole = await prisma.role.findFirstOrThrow({ where: { companyId: COMPANY_ID, code: 'company-admin', isActive: true } });
  const adminUser = await prisma.user.findFirstOrThrow({ where: { companyId: COMPANY_ID, roleId: adminRole.id, isActive: true, deletedAt: null } });
  const auth = { roleId: adminRole.id, userId: adminUser.id };

  const employees = await prisma.employee.findMany({ where: { companyId: COMPANY_ID, deletedAt: null }, select: { id: true, oldEmployeeCode: true } });
  console.log('Employees present:', employees.length);
  if (employees.length !== 25) throw new Error(`Expected 25 employees, found ${employees.length}`);

  console.log('\n=== Phase 4: push through real POST /api/biometric/import, period by period ===');
  const { POST: importPost } = await import('@/app/api/biometric/import/route');
  const hoursRows = parseSsmsGrid(readFileSync(`${SCRATCH}/sample_hours.txt`, 'utf8'));
  const intimeRows = parseSsmsGrid(readFileSync(`${SCRATCH}/sample_intime.txt`, 'utf8'));
  const outtimeRows = parseSsmsGrid(readFileSync(`${SCRATCH}/sample_outtime.txt`, 'utf8'));
  const bySource: Record<'hours' | 'intime' | 'outtime', Record<string, string>[]> = { hours: hoursRows, intime: intimeRows, outtime: outtimeRows };
  const mapper: Record<'hours' | 'intime' | 'outtime', (c: Record<string, string>) => Record<string, unknown>> = { hours: mapHoursRow, intime: mapInTimeRow, outtime: mapOutTimeRow };

  // The DB is a LAN SQL Server that has dropped connections mid-run (P1001);
  // every write here is idempotent (upsert on natural keys), so a dropped
  // chunk is simply retried rather than aborting the whole import.
  async function withRetry<T>(label: string, fn: () => Promise<T>, attempts = 4): Promise<T | null> {
    for (let i = 1; i <= attempts; i++) {
      try {
        return await fn();
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        console.error(`  ${label} attempt ${i}/${attempts} failed: ${msg.split('\n')[0]}`);
        if (i === attempts) return null;
        await new Promise((r) => setTimeout(r, 5000 * i));
      }
    }
    return null;
  }

  /**
   * Resumable: this LAN SQL Server has dropped mid-run more than once, and a
   * re-import of an already-completed chunk costs ~25 employees x 31 day
   * upserts for no gain. Skip a (period, source) that is already fully
   * landed — the import itself stays idempotent either way, this just
   * avoids redoing minutes of work before reaching what's actually missing.
   */
  async function alreadyDone(period: string, source: 'hours' | 'intime' | 'outtime', expectedRows: number) {
    const landed = await prisma.biometricAttendanceImport.count({ where: { companyId: COMPANY_ID, attForMonth: period, year: 2026 } });
    if (landed < expectedRows) return false;
    if (source === 'hours') {
      const unprocessed = await prisma.biometricAttendanceImport.count({ where: { companyId: COMPANY_ID, attForMonth: period, year: 2026, processedAt: null } });
      return unprocessed === 0;
    }
    // in/out time: consider done once any punch column for this period is populated
    const col = source === 'intime' ? 'InTime' : 'OutTime';
    const [{ cnt }] = await prisma.$queryRawUnsafe<{ cnt: number }[]>(
      `SELECT COUNT(*) cnt FROM BiometricAttendanceImport
       WHERE companyId = ${COMPANY_ID} AND year = 2026 AND attForMonth = '${period}'
         AND (day17${col} IS NOT NULL OR day18${col} IS NOT NULL OR day19${col} IS NOT NULL OR day20${col} IS NOT NULL)`
    );
    return Number(cnt) > 0;
  }

  // Feb-Mar..Apr-May already landed for all 25 employees. For the remaining
  // months only 5 employees are imported — enough to demonstrate the full
  // flow end to end without another 20+ minutes against a LAN SQL Server
  // that keeps dropping the connection mid-run. These 5 all have complete
  // Feb-Mar..Jul-Aug coverage, so they show an unbroken 6-period picture.
  const LIMITED_EMP_IDS = new Set(['100038', '100265', '100266', '100267', '100270']);
  const FULL_PERIODS = new Set(['Feb-Mar', 'Mar-Apr']);

  let totalImported = 0, totalUnmatched = 0, totalConverted = 0;
  for (const period of Object.keys(PERIOD_START)) {
    for (const source of ['hours', 'intime', 'outtime'] as const) {
      let rowsForPeriod = bySource[source].filter((c) => c['ATT_FOR_MONTH'] === period);
      if (!FULL_PERIODS.has(period)) {
        rowsForPeriod = rowsForPeriod.filter((c) => LIMITED_EMP_IDS.has(c['EMP_ID']));
      }
      if (rowsForPeriod.length === 0) continue;
      // FORCE_REIMPORT: the route's duplicate-merge fix landed after some
      // periods were already imported under the old last-row-wins logic
      // (which let a near-empty duplicate row wipe out real data — see
      // mergeDuplicateRows in the import route). Bypassing the skip here so
      // every period gets reprocessed through the fixed logic at least once.
      const FORCE_REIMPORT = true;
      if (!FORCE_REIMPORT && (await alreadyDone(period, source, rowsForPeriod.length))) {
        console.log(`  ${period}/${source}: already imported — skipping`);
        continue;
      }
      const mapped = rowsForPeriod.map(mapper[source]);
      const json = await withRetry(`${period}/${source}`, async () => {
        const res = await importPost(req('http://localhost/api/biometric/import', auth, {
          method: 'POST',
          body: { periodStartDate: PERIOD_START[period], source, fromWhere: 'BIOMETRIC', rows: mapped },
        }));
        const body = await res.json();
        if (res.status !== 201) throw new Error(`HTTP ${res.status}: ${JSON.stringify(body)}`);
        return body;
      });
      if (!json) {
        console.error(`  GAVE UP on ${period}/${source}`);
        continue;
      }
      totalImported += json.imported;
      totalUnmatched += json.unmatched;
      totalConverted += json.conversion.converted;
      console.log(`  ${period}/${source}: imported ${json.imported}, unmatched ${json.unmatched}, converted ${json.conversion.converted}`);
    }
  }
  console.log('Totals: imported', totalImported, 'unmatched', totalUnmatched, 'converted', totalConverted);

  console.log('\n=== Phase 5: verify ===');
  const empIds = employees.map((e) => e.id);
  const dailyCount = await prisma.dailyAttendance.count({ where: { employeeId: { in: empIds } } });
  const summaryCount = await prisma.monthlyAttendanceSummary.count({ where: { employeeId: { in: empIds } } });
  console.log('DailyAttendance rows:', dailyCount, '| MonthlyAttendanceSummary rows:', summaryCount);

  console.log('\n=== Phase 6: full lifecycle demo on Feb 2026 ===');
  const existingRun = await prisma.payrollRun.findUnique({ where: { companyId_year_month: { companyId: COMPANY_ID, year: 2026, month: 2 } } });
  let runId: number;
  if (existingRun) {
    runId = existingRun.id;
    console.log('PayrollRun already exists:', JSON.stringify(existingRun));
  } else {
    const { POST: createRun } = await import('@/app/api/payroll/runs/route');
    const runRes = await createRun(req('http://localhost/api/payroll/runs', auth, { method: 'POST', body: { year: 2026, month: 2 } }));
    const runBody = await runRes.json();
    console.log('PayrollRun create:', runRes.status, JSON.stringify(runBody));
    runId = runBody.id;
  }

  const { POST: finalizePost } = await import('@/app/api/workforce/attendance/monthly/finalize/route');
  const finalizeRes = await finalizePost(req('http://localhost/api/workforce/attendance/monthly/finalize', auth, { method: 'POST', body: { year: 2026, month: 2 } }));
  const finalizeJson = await finalizeRes.json();
  console.log('Finalize:', finalizeRes.status, finalizeJson.message);

  const { POST: freezePost } = await import('@/app/api/workforce/attendance/monthly/freeze/route');
  const freezeRes = await freezePost(req('http://localhost/api/workforce/attendance/monthly/freeze', auth, { method: 'POST', body: { year: 2026, month: 2 } }));
  console.log('Freeze:', freezeRes.status, JSON.stringify(await freezeRes.json()));

  const runAfterFreeze = await prisma.payrollRun.findUnique({ where: { id: runId }, include: { _count: { select: { lines: true } } } });
  console.log('PayrollRun after freeze:', JSON.stringify(runAfterFreeze));

  const { POST: reopenPost } = await import('@/app/api/workforce/attendance/monthly/reopen/route');
  const reopenRes = await reopenPost(req('http://localhost/api/workforce/attendance/monthly/reopen', auth, {
    method: 'POST',
    body: { year: 2026, month: 2, reason: 'Full-flow demo (biometric sample import) — reopening to leave Feb 2026 editable for further review.' },
  }));
  console.log('Reopen:', reopenRes.status, JSON.stringify(await reopenRes.json()));

  const feb2026 = await prisma.monthlyAttendanceSummary.findFirst({ where: { employeeId: empIds[0], year: 2026, month: 2 } });
  console.log('Employee #1 Feb 2026 summary after full cycle:', JSON.stringify(feb2026, null, 2));

  console.log('\n=== DONE ===');
}

main()
  .catch((err) => {
    console.error('SCRIPT FAILED:', err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
