/**
 * BRD 01 §7 — employee code allocation and the §7.4 rehire policy, through
 * the real POST /api/employees and POST /api/employees/from-candidate
 * handlers in the TESTCO tenant.
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { prisma } from '@/lib/prisma';
import { parseEmployeeCode } from '@/lib/employee/codePolicy';
import { transition } from '@/lib/employee/lifecycle';
import { testTenant, req, createEmployee, purgeEmployee, resetCodePolicy, baseMasters, type TestAuth } from './employee-helpers';

let auth: TestAuth;
let companyId: number;
const created: number[] = [];
const stamp = Date.now().toString(36);

beforeAll(async () => {
  const t = await testTenant();
  auth = t.adminAuth;
  companyId = t.companyId;
  await resetCodePolicy(companyId);
});

afterAll(async () => {
  for (const id of created.reverse()) await purgeEmployee(id);
  await resetCodePolicy(companyId);
});

describe('employee code policy (§7.2 / §7.3)', () => {
  it('two sequential creates receive consecutive codes from the company policy', async () => {
    const a = await createEmployee(auth);
    created.push(a.id);
    const b = await createEmployee(auth);
    created.push(b.id);

    const pa = parseEmployeeCode(a.employeeCode)!;
    const pb = parseEmployeeCode(b.employeeCode)!;
    expect(pa.prefix).toBe(pb.prefix);
    expect(pb.sequence).toBe(pa.sequence + 1);

    const policy = await prisma.employeeCodePolicy.findUnique({ where: { companyId } });
    expect(policy?.nextSequence).toBe(pb.sequence + 1);
  });

  it('a manual create lands in PROBATION (or CONFIRMED without probation) with the creation chain recorded', async () => {
    const withProbation = await createEmployee(auth, { probationPeriodMonths: 6 });
    created.push(withProbation.id);
    const noProbation = await createEmployee(auth, { probationPeriodMonths: 0 });
    created.push(noProbation.id);

    const [p, c] = await Promise.all([
      prisma.employee.findUnique({ where: { id: withProbation.id }, select: { lifecycleState: true, status: true, personUid: true } }),
      prisma.employee.findUnique({ where: { id: noProbation.id }, select: { lifecycleState: true, status: true } }),
    ]);
    expect(p?.lifecycleState).toBe('PROBATION');
    expect(p?.status).toBe('active');
    expect(p?.personUid).toBeTruthy();
    expect(c?.lifecycleState).toBe('CONFIRMED');

    const chain = await prisma.employeeStateTransition.findMany({ where: { employeeId: noProbation.id }, orderBy: { id: 'asc' } });
    expect(chain.map((r) => r.toState)).toEqual(['DRAFT', 'CANDIDATE_CONVERTED', 'PROBATION', 'CONFIRMED']);
    expect(chain[0].fromState).toBeNull();

    const history = await prisma.employeeReportingHistory.findMany({ where: { employeeId: withProbation.id } });
    expect(history).toHaveLength(1);
    expect(history[0].effectiveTo).toBeNull();

    const job = await prisma.jobInfo.findFirst({ where: { employeeId: withProbation.id, effectiveTo: null } });
    expect(job?.changeReason).toBe('JOINING');
  });

  it('GET /api/masters/employee-code-policy previews the next code', async () => {
    const { GET } = await import('@/app/api/masters/employee-code-policy/route');
    const res = await GET(req('http://localhost/api/masters/employee-code-policy', { auth }));
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.nextCode).toBe(`${json.prefix}${String(json.nextSequence).padStart(json.width, '0')}`);
  });
});

describe('recruitment handoff and rehire (§9 / §7.4)', () => {
  const pan = `AB${stamp.slice(-3).toUpperCase().replace(/[^A-Z]/g, 'X').padEnd(3, 'X')}1234Z`;
  const aadhaar = `9${stamp.replace(/\D/g, '').padEnd(11, '7').slice(0, 11)}`;

  async function handoff(body: Record<string, unknown>) {
    const { POST } = await import('@/app/api/employees/from-candidate/route');
    const m = await baseMasters();
    const manager = created[0];
    const managerCode = (await prisma.employee.findUnique({ where: { id: manager }, select: { employeeCode: true } }))!.employeeCode;
    const grade = await prisma.grade.findFirst({ where: { deletedAt: null, designationId: null } });
    const res = await POST(
      req('http://localhost/api/employees/from-candidate', {
        method: 'POST',
        auth,
        body: {
          sourceApplicationNo: `APP-${stamp}`,
          offerNo: `OFF-${stamp}-1`,
          firstName: 'Rehire',
          lastName: 'Candidate',
          dateOfBirth: '1995-05-05',
          gender: 'Female',
          mobile: '9876543210',
          personalEmail: `rehire-${stamp}@example.com`,
          permanentAddress: { line1: '1 Test Street', city: 'Hosur', state: 'Tamil Nadu', pinCode: '635109' },
          pan,
          aadhaar,
          departmentCode: m.department.code,
          designationCode: m.designation.code,
          gradeCode: grade?.code ?? 'JE1',
          employeeTypeCode: m.employeeType.code,
          reportingManagerCode: managerCode,
          dateOfJoining: '2026-02-01',
          probationMonths: 6,
          noticePeriodDays: 45,
          annualCtc: 480000,
          ...body,
        },
      })
    );
    return { status: res.status, json: await res.json() };
  }

  it('creates the employee in DRAFT with the offer notice period, and is idempotent on offerNo', async () => {
    const first = await handoff({});
    expect(first.status, JSON.stringify(first.json)).toBe(201);
    created.push(first.json.employeeId);
    expect(first.json.lifecycleState).toBe('DRAFT');

    const job = await prisma.jobInfo.findFirst({ where: { employeeId: first.json.employeeId, effectiveTo: null } });
    expect(job?.noticePeriodDays).toBe(45);
    expect(job?.noticePeriodSource).toBe('OFFER');
    expect(job?.changeReference).toBe(`OFFER:OFF-${stamp}-1`);

    const again = await handoff({});
    expect(again.status).toBe(200);
    expect(again.json.employeeCode).toBe(first.json.employeeCode);
    expect(again.json.idempotent).toBe(true);
  });

  it('rejects a duplicate of a still-employed person, then reinstates the original code on confirmed rehire', async () => {
    const employeeId = created[created.length - 1];
    const before = await prisma.employee.findUnique({ where: { id: employeeId }, select: { employeeCode: true } });

    const dup = await handoff({ offerNo: `OFF-${stamp}-2`, sourceApplicationNo: `APP-${stamp}-2` });
    expect(dup.status).toBe(409);
    expect(dup.json.employeeCode).toBe(before!.employeeCode);

    // Separate them: DRAFT → CANDIDATE_CONVERTED → PROBATION → SEPARATED.
    const actor = { userId: auth.userId };
    await transition(companyId, employeeId, 'CANDIDATE_CONVERTED', { trigger: 'TEST', actor });
    await transition(companyId, employeeId, 'PROBATION', { trigger: 'TEST', actor });
    await transition(companyId, employeeId, 'SEPARATED', { trigger: 'TEST', actor });

    const candidate = await handoff({ offerNo: `OFF-${stamp}-3`, sourceApplicationNo: `APP-${stamp}-3`, dateOfJoining: '2026-06-01' });
    expect(candidate.status).toBe(409);
    expect(candidate.json.error).toBe('rehire-candidate');
    expect(candidate.json.rehireCandidate.employeeCode).toBe(before!.employeeCode);

    const rehired = await handoff({ offerNo: `OFF-${stamp}-3`, sourceApplicationNo: `APP-${stamp}-3`, dateOfJoining: '2026-06-01', confirmRehire: true });
    expect(rehired.status, JSON.stringify(rehired.json)).toBe(200);
    expect(rehired.json.employeeCode).toBe(before!.employeeCode);
    expect(rehired.json.rehired).toBe(true);
    expect(rehired.json.lifecycleState).toBe('PROBATION');

    const jobs = await prisma.jobInfo.findMany({ where: { employeeId }, orderBy: { effectiveFrom: 'asc' } });
    expect(jobs).toHaveLength(2);
    expect(jobs[0].effectiveTo?.toISOString().slice(0, 10)).toBe('2026-05-31');
    expect(jobs[1].effectiveTo).toBeNull();
    expect(jobs[1].changeReason).toBe('REHIRE');

    const steps = await prisma.employeeStateTransition.findMany({ where: { employeeId }, orderBy: { id: 'asc' } });
    expect(steps.slice(-2).map((s) => s.toState)).toEqual(['REHIRED', 'PROBATION']);
  });
});
