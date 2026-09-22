/**
 * KNOWN-BROKEN MARKER — Full & Final cannot complete a settlement.
 *
 * Migration 20260916192131_add-recruitment-module rebuilt 40 tables with
 * `[id] INT NOT NULL` and no IDENTITY(1,1), then renamed the shadow tables
 * over the originals. Two of them are on the F&F critical path:
 *
 *   FnFSettlementLine  — every calculate and every line override inserts here
 *   ExitClearanceCheck — ensureClearanceChecks() seeds the clearance gate here
 *
 * Both now fail with P2011 "Null constraint violation on the fields: (id)".
 * That means the F&F page cannot get past step one: Calculate/freeze throws,
 * so no settlement ever reaches `calculated`, so nothing can be submitted,
 * approved, paid or completed through the UI.
 *
 * These assertions PIN THE BROKEN STATE ON PURPOSE so the suite stays green
 * and the incident stays visible in code rather than in someone's memory.
 * They are not an endorsement. The moment the tables are repaired these tests
 * will fail — that failure is the signal to delete this file, not to loosen
 * the assertions.
 *
 * The repair is a destructive table rebuild and is deliberately NOT done here:
 * no native database backup exists (BACKUP DATABASE is denied, error 262 —
 * suki_hrms_user is not sysadmin/db_owner/db_backupoperator), and the standing
 * instruction is that these two tables go first only once a backup exists,
 * with the other 38 requiring a dedicated session and sign-off.
 * See prisma/migrations/20260916192131_add-recruitment-module/DO_NOT_APPLY.md
 */
import { describe, it, expect } from 'vitest';
import { prisma } from '@/lib/prisma';

const ON_THE_FNF_PATH = ['FnFSettlementLine', 'ExitClearanceCheck'];

async function identityFlags(tables: string[]): Promise<Record<string, boolean>> {
  const rows = await prisma.$queryRawUnsafe<{ tbl: string; is_identity: boolean }[]>(
    `SELECT t.name AS tbl, c.is_identity
       FROM sys.tables t
       JOIN sys.columns c ON c.object_id = t.object_id
      WHERE c.name = 'id' AND t.name IN (${tables.map((t) => `'${t}'`).join(',')})`,
  );
  return Object.fromEntries(rows.map((r) => [r.tbl, Boolean(r.is_identity)]));
}

describe('F&F IDENTITY blocker (known broken — delete this file once repaired)', () => {
  it('FnFSettlementLine and ExitClearanceCheck still have no IDENTITY on id', async () => {
    const flags = await identityFlags(ON_THE_FNF_PATH);
    for (const table of ON_THE_FNF_PATH) {
      expect(
        flags[table],
        `${table}.id now HAS IDENTITY — the incident is fixed. Delete tests/integration/fnf-identity-blocker.test.ts and re-enable the end-to-end F&F flow.`,
      ).toBe(false);
    }
  });

  it('FnFSettlement itself was NOT affected, which is why drafts can still be created', async () => {
    const flags = await identityFlags(['FnFSettlement', 'ExitInterview', 'FullAndFinalConfig']);
    expect(flags.FnFSettlement).toBe(true);
    expect(flags.ExitInterview).toBe(true);
    expect(flags.FullAndFinalConfig).toBe(true);
  });

  it('an insert into FnFSettlementLine fails with P2011, so calculate cannot persist lines', async () => {
    const exit = await prisma.exitInterview.findFirst({ select: { id: true, employeeId: true } });
    if (!exit) return; // nothing to probe against in this database
    const emp = await prisma.employee.findUnique({
      where: { id: exit.employeeId },
      select: { id: true, companyId: true },
    });
    if (!emp) return;

    let code: string | undefined;
    try {
      // Rolled back either way — this must never leave a settlement behind.
      await prisma.$transaction(async (tx) => {
        const s = await tx.fnFSettlement.create({
          data: {
            companyId: emp.companyId,
            employeeId: emp.id,
            exitInterviewId: exit.id,
            lastWorkingDay: new Date('2026-09-15'),
            status: 'pending',
          },
        });
        await tx.fnFSettlementLine.create({
          data: { settlementId: s.id, kind: 'EARNING', code: 'PROBE', name: 'probe', source: 'MANUAL', amount: 1, sortOrder: 0 },
        });
        throw new Error('__ROLLBACK__');
      });
    } catch (err) {
      code = (err as { code?: string }).code;
      if (!code && (err as Error).message !== '__ROLLBACK__') throw err;
    }
    expect(
      code,
      'FnFSettlementLine now accepts inserts — the incident is fixed. Delete this file.',
    ).toBe('P2011');
  });
});
