/**
 * One-off, run-once script: replaces KUN Aerospace's 4 demo employees with 25
 * employees matching a real 25-EMP_ID sample drawn from the user's legacy
 * attendance.rpt export (Feb-Mar..Jul-Aug 2026 wage periods), then pushes that
 * sample through the REAL Biometric import pipeline (same route handlers the
 * UI calls), and exercises the full Finalize -> Freeze -> Payroll auto-trigger
 * -> Reopen lifecycle on Feb 2026 so every mechanism gets a real end-to-end
 * run against real data, not just isolated unit assertions.
 *
 * Every step below reuses the app's own route handlers directly (POST
 * handlers imported and invoked with a hand-built NextRequest, exactly like
 * tests/integration/*.test.ts do) rather than reimplementing any business
 * logic here — this script only supplies data and orchestrates the sequence.
 *
 *   npx tsx scripts/seed-kun-biometric-demo.mts
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

const EMP_IDS = [
  '100038', '100265', '100266', '100267', '100270', '100293', '100298', '100306', '100308', '100365',
  '100433', '100468', '100483', '100494', '100495', '100501', '100510', '100511', '100036', '100118',
  '100175', '100264', '100268', '100269', '100271',
];

const NAMES: [string, string][] = [
  ['Arun', 'Kumar'], ['Bala', 'Subramanian'], ['Chitra', 'Devi'], ['Dinesh', 'Raj'], ['Elumalai', 'Pandian'],
  ['Femina', 'Rose'], ['Gopal', 'Krishnan'], ['Hema', 'Latha'], ['Ilango', 'Sethu'], ['Jagan', 'Mohan'],
  ['Kavitha', 'Ramesh'], ['Lokesh', 'Waran'], ['Meena', 'Kumari'], ['Nagaraj', 'Velu'], ['Oviya', 'Shree'],
  ['Prakash', 'Babu'], ['Radha', 'Krishnan'], ['Selva', 'Kumar'], ['Tamil', 'Selvan'], ['Uma', 'Maheswari'],
  ['Vignesh', 'Waran'], ['Yazhini', 'Priya'], ['Zahir', 'Hussain'], ['Anitha', 'Rani'], ['Boopathi', 'Raja'],
];

const PERIOD_START: Record<string, string> = {
  'Feb-Mar': '2026-02-01',
  'Mar-Apr': '2026-03-01',
  'Apr-May': '2026-04-01',
  'May-Jun': '2026-05-01',
  'Jun-Jul': '2026-06-01',
  'Jul-Aug': '2026-07-01',
};

// ── SSMS grid parser + row mappers — mirrors src/app/workforce/attendance/biometric/page.tsx exactly ──
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
  console.log('=== Phase 0: safety check ===');
  const company = await prisma.company.findUnique({ where: { id: COMPANY_ID } });
  if (!company || !/kun/i.test(company.name)) {
    throw new Error(`companyId ${COMPANY_ID} is "${company?.name}", not KUN Aerospace. Aborting.`);
  }
  console.log('Company confirmed:', company.name);

  const adminRole = await prisma.role.findFirstOrThrow({ where: { companyId: COMPANY_ID, code: 'company-admin', isActive: true } });
  const adminUser = await prisma.user.findFirstOrThrow({ where: { companyId: COMPANY_ID, roleId: adminRole.id, isActive: true, deletedAt: null } });
  const auth = { roleId: adminRole.id, userId: adminUser.id };
  console.log('Acting as company-admin user', adminUser.id, 'role', adminRole.id);

  console.log('\n=== Phase 1: delete existing employees ===');
  const oldEmployees = await prisma.employee.findMany({ where: { companyId: COMPANY_ID }, select: { id: true } });
  const oldIds = oldEmployees.map((e) => e.id);
  console.log('Existing employees to remove:', oldIds);
  if (oldIds.length > 0) {
    await prisma.$transaction(async (tx) => {
      await tx.employee.updateMany({ where: { id: { in: oldIds } }, data: { reportingManagerId: null } });
      const revisions = await tx.employeeSalaryRevision.findMany({ where: { employeeId: { in: oldIds } }, select: { id: true } });
      await tx.employeeSalaryComponent.deleteMany({ where: { salaryRevisionId: { in: revisions.map((r) => r.id) } } });
      const revisionRequests = await tx.salaryRevisionRequest.findMany({ where: { employeeId: { in: oldIds } }, select: { id: true } });
      await tx.salaryRevisionComponent.deleteMany({ where: { salaryRevisionRequestId: { in: revisionRequests.map((r) => r.id) } } });
      const arrears = await tx.salaryArrear.findMany({ where: { employeeId: { in: oldIds } }, select: { id: true } });
      await tx.salaryArrearMonth.deleteMany({ where: { salaryArrearId: { in: arrears.map((a) => a.id) } } });
      const payrollLines = await tx.payrollLine.findMany({ where: { employeeId: { in: oldIds } }, select: { id: true } });
      await tx.payrollLineComponent.deleteMany({ where: { payrollLineId: { in: payrollLines.map((l) => l.id) } } });
      await tx.gratuityRecord.deleteMany({ where: { employeeId: { in: oldIds } } });
      await tx.bonusRecord.deleteMany({ where: { employeeId: { in: oldIds } } });
      await tx.leaveApplication.deleteMany({ where: { employeeId: { in: oldIds } } });
      await tx.leaveBalance.deleteMany({ where: { employeeId: { in: oldIds } } });
      await tx.dailyAttendanceHistory.deleteMany({ where: { employeeId: { in: oldIds } } });
      await tx.dailyAttendance.deleteMany({ where: { employeeId: { in: oldIds } } });
      await tx.monthlyAttendanceSummary.deleteMany({ where: { employeeId: { in: oldIds } } });
      await tx.employeeActivity.deleteMany({ where: { employeeId: { in: oldIds } } });
      await tx.employeeSkill.deleteMany({ where: { employeeId: { in: oldIds } } });
      await tx.employeeDocument.deleteMany({ where: { employeeId: { in: oldIds } } });
      await tx.employeeAssetAllocation.deleteMany({ where: { employeeId: { in: oldIds } } });
      await tx.employeeEmergencyContact.deleteMany({ where: { employeeId: { in: oldIds } } });
      await tx.employeeKyc.deleteMany({ where: { employeeId: { in: oldIds } } });
      await tx.employeePassport.deleteMany({ where: { employeeId: { in: oldIds } } });
      await tx.employeeDependent.deleteMany({ where: { employeeId: { in: oldIds } } });
      await tx.employeeExperience.deleteMany({ where: { employeeId: { in: oldIds } } });
      await tx.employeeEducation.deleteMany({ where: { employeeId: { in: oldIds } } });
      await tx.employeeBankDetail.deleteMany({ where: { employeeId: { in: oldIds } } });
      await tx.employeeContactDetails.deleteMany({ where: { employeeId: { in: oldIds } } });
      await tx.personalDetails.deleteMany({ where: { employeeId: { in: oldIds } } });
      await tx.salaryStructure.deleteMany({ where: { employeeId: { in: oldIds } } });
      await tx.employeeCtc.deleteMany({ where: { employeeId: { in: oldIds } } });
      await tx.salaryArrear.deleteMany({ where: { employeeId: { in: oldIds } } });
      await tx.salaryRevisionRequest.deleteMany({ where: { employeeId: { in: oldIds } } });
      await tx.employeeSalaryRevision.deleteMany({ where: { employeeId: { in: oldIds } } });
      await tx.payrollLine.deleteMany({ where: { employeeId: { in: oldIds } } });
      await tx.payrollRun.deleteMany({ where: { companyId: COMPANY_ID } });
      await tx.exitInterview.deleteMany({ where: { employeeId: { in: oldIds } } });
      await tx.jobInfo.deleteMany({ where: { employeeId: { in: oldIds } } });
      await tx.employee.deleteMany({ where: { id: { in: oldIds } } });
    });
    console.log('Deleted', oldIds.length, 'old employee(s).');
  }

  console.log('\n=== Phase 2: create 25 employees via real POST /api/employees ===');
  const { POST: createEmployee } = await import('@/app/api/employees/route');
  const empIdToRecordId = new Map<string, number>();
  for (let i = 0; i < EMP_IDS.length; i++) {
    const empId = EMP_IDS[i];
    const [firstName, lastName] = NAMES[i];
    const res = await createEmployee(
      req('http://localhost/api/employees', auth, {
        method: 'POST',
        body: {
          companyId: COMPANY_ID,
          departmentId: 6, // PRODUCTION
          designationId: 17, // OPERATOR
          employeeTypeId: 4, // PERMANENT
          firstName,
          lastName,
          oldEmployeeCode: empId,
          joinDate: '2025-06-01',
        },
      })
    );
    if (res.status !== 201) {
      console.error('FAILED to create employee for', empId, await res.json());
      continue;
    }
    const body = await res.json();
    empIdToRecordId.set(empId, body.id);
    console.log(`  ${empId} -> employee #${body.id} (${body.employeeCode}) ${firstName} ${lastName}`);
  }
  console.log('Created', empIdToRecordId.size, 'of', EMP_IDS.length, 'employees.');

  console.log('\n=== Phase 3: parse sample files ===');
  const hoursRows = parseSsmsGrid(readFileSync(`${SCRATCH}/sample_hours.txt`, 'utf8'));
  const intimeRows = parseSsmsGrid(readFileSync(`${SCRATCH}/sample_intime.txt`, 'utf8'));
  const outtimeRows = parseSsmsGrid(readFileSync(`${SCRATCH}/sample_outtime.txt`, 'utf8'));
  console.log('Parsed rows:', hoursRows.length, 'hours,', intimeRows.length, 'intime,', outtimeRows.length, 'outtime');

  console.log('\n=== Phase 4: push through real POST /api/biometric/import, period by period ===');
  const { POST: importPost } = await import('@/app/api/biometric/import/route');

  const bySource: Record<'hours' | 'intime' | 'outtime', Record<string, string>[]> = {
    hours: hoursRows, intime: intimeRows, outtime: outtimeRows,
  };
  const mapper: Record<'hours' | 'intime' | 'outtime', (c: Record<string, string>) => Record<string, unknown>> = {
    hours: mapHoursRow, intime: mapInTimeRow, outtime: mapOutTimeRow,
  };

  let totalImported = 0, totalUnmatched = 0, totalConverted = 0;
  for (const period of Object.keys(PERIOD_START)) {
    for (const source of ['hours', 'intime', 'outtime'] as const) {
      const rowsForPeriod = bySource[source].filter((c) => c['ATT_FOR_MONTH'] === period);
      if (rowsForPeriod.length === 0) continue;
      const mapped = rowsForPeriod.map(mapper[source]);
      const res = await importPost(
        req('http://localhost/api/biometric/import', auth, {
          method: 'POST',
          body: { periodStartDate: PERIOD_START[period], source, fromWhere: 'BIOMETRIC', rows: mapped },
        })
      );
      const json = await res.json();
      if (res.status !== 201) {
        console.error(`  FAILED ${period}/${source}:`, json);
        continue;
      }
      totalImported += json.imported;
      totalUnmatched += json.unmatched;
      totalConverted += json.conversion.converted;
      console.log(`  ${period}/${source}: imported ${json.imported}, unmatched ${json.unmatched}, converted ${json.conversion.converted}`);
    }
  }
  console.log('Totals: imported', totalImported, 'unmatched', totalUnmatched, 'converted', totalConverted);

  console.log('\n=== Phase 5: verify DailyAttendance / MonthlyAttendanceSummary landed ===');
  const empIds = [...empIdToRecordId.values()];
  const dailyCount = await prisma.dailyAttendance.count({ where: { employeeId: { in: empIds } } });
  const summaryCount = await prisma.monthlyAttendanceSummary.count({ where: { employeeId: { in: empIds } } });
  console.log('DailyAttendance rows:', dailyCount, '| MonthlyAttendanceSummary rows:', summaryCount);
  const sampleSummary = await prisma.monthlyAttendanceSummary.findMany({
    where: { employeeId: { in: empIds.slice(0, 3) } },
    orderBy: [{ employeeId: 'asc' }, { month: 'asc' }],
  });
  console.log('Sample summaries:', JSON.stringify(sampleSummary, null, 2));

  console.log('\n=== Phase 6: full lifecycle demo on Feb 2026 — PayrollRun -> Finalize -> Freeze (auto payroll) -> Reopen ===');
  const { POST: createRun } = await import('@/app/api/payroll/runs/route');
  const runRes = await createRun(req('http://localhost/api/payroll/runs', auth, { method: 'POST', body: { year: 2026, month: 2 } }));
  const runBody = await runRes.json();
  console.log('PayrollRun create:', runRes.status, JSON.stringify(runBody));

  const { POST: finalizePost } = await import('@/app/api/workforce/attendance/monthly/finalize/route');
  const finalizeRes = await finalizePost(req('http://localhost/api/workforce/attendance/monthly/finalize', auth, { method: 'POST', body: { year: 2026, month: 2 } }));
  console.log('Finalize:', finalizeRes.status, JSON.stringify(await finalizeRes.json()));

  const { POST: freezePost } = await import('@/app/api/workforce/attendance/monthly/freeze/route');
  const freezeRes = await freezePost(req('http://localhost/api/workforce/attendance/monthly/freeze', auth, { method: 'POST', body: { year: 2026, month: 2 } }));
  console.log('Freeze:', freezeRes.status, JSON.stringify(await freezeRes.json()));

  const runAfterFreeze = await prisma.payrollRun.findUnique({ where: { id: runBody.id }, include: { _count: { select: { lines: true } } } });
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
