/**
 * Goal Assignment Coverage report, against the dev DB (KUNAERO, company 1).
 *
 * The report's whole reason to exist is the employee with NO goal set, so the
 * tests that matter are the ones asserting an unassigned employee appears as
 * a row rather than being omitted the way a goal-set-driven query would omit
 * them. Read-only route — nothing here mutates a goal set.
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { prisma } from '@/lib/prisma';
import { createTestEmployee, deleteTestEmployee, getAdminAuth, makeRequest } from './fixtures';
import { GET } from '@/app/api/reports/performance/goal-coverage/route';

const BASE = 'http://localhost/api/reports/performance/goal-coverage';
const COMPANY_ID = 1;

let auth: { roleId: number; userId: number };
let cycleId: number;
let employeeId: number | undefined;

interface CoverageRow {
  employeeId: number;
  employeeCode: string;
  status: string;
  kraCount: number;
  kpiCount: number;
  goalSetId: number | null;
  pendingDays: number | null;
}

interface CoverageBody {
  cycle: { id: number; code: string };
  data: CoverageRow[];
  summary: {
    eligible: number;
    withGoals: number;
    notAssigned: number;
    accepted: number;
    assignedPct: number;
    acceptedPct: number;
    byStatus: Record<string, number>;
    joinedAfterCycle: number;
    shown: number;
  };
}

async function fetchCoverage(params: Record<string, string>) {
  const qs = new URLSearchParams(params).toString();
  const res = await GET(makeRequest(`${BASE}?${qs}`, { auth, companyId: COMPANY_ID }));
  return { status: res.status, body: (await res.json()) as CoverageBody & { error?: string } };
}

beforeAll(async () => {
  auth = await getAdminAuth();
  const cycle = await prisma.performanceCycle.findFirst({
    where: { companyId: COMPANY_ID },
    orderBy: { startDate: 'desc' },
    select: { id: true },
  });
  if (!cycle) throw new Error('No performance cycle in company 1 — cannot measure coverage.');
  cycleId = cycle.id;

  // A brand-new employee has no goal set for any cycle, which is exactly the
  // case the report must not drop. Join date is well before any cycle so the
  // joined-after-cycle exclusion never hides them.
  const created = await createTestEmployee(auth, { joinDate: '2020-01-01' });
  employeeId = created.id;
});

afterAll(async () => {
  await deleteTestEmployee(employeeId);
});

describe('goal coverage report', () => {
  it('requires a cycle — coverage without a denominator is meaningless', async () => {
    const res = await GET(makeRequest(BASE, { auth, companyId: COMPANY_ID }));
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toMatch(/cycleId is required/i);
  });

  it('404s on a cycle that is not in the caller company', async () => {
    const { status } = await fetchCoverage({ cycleId: '999999' });
    expect(status).toBe(404);
  });

  it('lists an employee with no goal set as NOT_ASSIGNED rather than omitting them', async () => {
    const { status, body } = await fetchCoverage({ cycleId: String(cycleId) });
    expect(status).toBe(200);

    const row = body.data.find((r) => r.employeeId === employeeId);
    expect(row, 'the unassigned test employee must appear as a row').toBeDefined();
    expect(row!.status).toBe('NOT_ASSIGNED');
    expect(row!.goalSetId).toBeNull();
    expect(row!.kraCount).toBe(0);
    expect(row!.kpiCount).toBe(0);
    expect(row!.pendingDays).toBeNull();
  });

  it('summary totals reconcile against the rows', async () => {
    const { body } = await fetchCoverage({ cycleId: String(cycleId) });
    const { summary, data } = body;

    expect(summary.eligible).toBe(data.length);
    expect(summary.withGoals + summary.notAssigned).toBe(summary.eligible);

    const counted = Object.values(summary.byStatus).reduce((a, b) => a + b, 0);
    expect(counted).toBe(summary.eligible);

    expect(summary.accepted).toBe((summary.byStatus.ACCEPTED ?? 0) + (summary.byStatus.COMPLETED ?? 0));
    expect(summary.assignedPct).toBeCloseTo((summary.withGoals / summary.eligible) * 100, 1);
  });

  it('a status filter narrows the rows but never the denominator', async () => {
    const all = await fetchCoverage({ cycleId: String(cycleId) });
    const filtered = await fetchCoverage({ cycleId: String(cycleId), status: 'NOT_ASSIGNED' });

    // Same population, same coverage figure — only the visible rows change.
    expect(filtered.body.summary.eligible).toBe(all.body.summary.eligible);
    expect(filtered.body.summary.assignedPct).toBe(all.body.summary.assignedPct);

    expect(filtered.body.data.every((r) => r.status === 'NOT_ASSIGNED')).toBe(true);
    expect(filtered.body.data.length).toBe(all.body.summary.notAssigned);
    expect(filtered.body.summary.shown).toBe(filtered.body.data.length);
  });

  it('counts KRAs and KPIs for employees who do have a set', async () => {
    const { body } = await fetchCoverage({ cycleId: String(cycleId) });
    const assigned = body.data.filter((r) => r.goalSetId != null);

    for (const r of assigned) {
      const real = await prisma.employeeGoalKra.findMany({
        where: { goalSetId: r.goalSetId! },
        select: { _count: { select: { kpis: true } } },
      });
      expect(r.kraCount).toBe(real.length);
      expect(r.kpiCount).toBe(real.reduce((n, k) => n + k._count.kpis, 0));
    }
  });

  it('search narrows to the matching employee', async () => {
    const created = await prisma.employee.findUnique({
      where: { id: employeeId },
      select: { employeeCode: true },
    });
    const { body } = await fetchCoverage({ cycleId: String(cycleId), q: created!.employeeCode });
    expect(body.data.some((r) => r.employeeId === employeeId)).toBe(true);
  });
});
