import { describe, it, expect } from 'vitest';
import { Prisma } from '@prisma/client';
import { selectMatrix, scoreMatrix, type MatrixCandidate } from '@/lib/platform/workflow/matrix';
import { evaluateLevel, type QuorumSlot } from '@/lib/platform/workflow/quorum';
import {
  addBusinessDaysWithCalendar,
  elapsedBusinessDaysWithCalendar,
  type BusinessCalendar,
} from '@/lib/platform/workflow/businessDays';
import { WorkflowError } from '@/lib/platform/workflow/types';

// ─── matrix selection ────────────────────────────────────────────────────────

function matrix(over: Partial<MatrixCandidate> & { code: string }): MatrixCandidate {
  return {
    id: over.code.length,
    versionNo: 1,
    effectiveFrom: new Date(Date.UTC(2026, 0, 1)),
    effectiveTo: null,
    isFallback: false,
    status: 'Active',
    minAmount: null,
    maxAmount: null,
    designationCodes: null,
    departmentCodes: null,
    gradeCodes: null,
    employmentType: null,
    locationCode: null,
    costCentreCode: null,
    requestSubType: null,
    ...over,
  };
}

const AT = new Date(Date.UTC(2026, 9, 1, 6, 12)); // 1 Oct 2026

describe('platform workflow — matrix selection (§7.5)', () => {
  const fallback = matrix({ code: 'FNF-DEFAULT', isFallback: true });
  const hosurA = matrix({ code: 'FNF-HOSUR-A', maxAmount: new Prisma.Decimal('100000'), locationCode: 'HOSUR' });
  const hosurB = matrix({ code: 'FNF-HOSUR-B', minAmount: '100000', maxAmount: '500000', locationCode: 'HOSUR' });
  const hosurC = matrix({ code: 'FNF-HOSUR-C', minAmount: 500000, locationCode: 'HOSUR' });
  const cnc = matrix({ code: 'FNF-CNC', departmentCodes: 'CNC, ASSY', gradeCodes: 'G3' });

  it('picks the most specific candidate (amount band + location = 33 over department + grade = 12)', () => {
    const sel = selectMatrix([fallback, hosurA, hosurB, hosurC, cnc], { amount: 45000, locationCode: 'HOSUR', departmentCode: 'CNC', gradeCode: 'G3' }, AT);
    expect(sel.matrix.code).toBe('FNF-HOSUR-A');
    expect(sel.score).toBe(33);
    expect(sel.viaFallback).toBe(false);
  });

  it('amount band is inclusive of min and exclusive of max', () => {
    expect(scoreMatrix(hosurA, { amount: 99999.99, locationCode: 'HOSUR' })).toBe(33);
    expect(scoreMatrix(hosurA, { amount: 100000, locationCode: 'HOSUR' })).toBeNull();
    expect(scoreMatrix(hosurB, { amount: 100000, locationCode: 'HOSUR' })).toBe(33);
    expect(scoreMatrix(hosurB, { amount: 500000, locationCode: 'HOSUR' })).toBeNull();
    expect(scoreMatrix(hosurC, { amount: 500000, locationCode: 'HOSUR' })).toBe(33);
  });

  it('a populated condition that does not match disqualifies the matrix entirely', () => {
    expect(scoreMatrix(hosurA, { amount: 1000, locationCode: 'BLR' })).toBeNull();
    expect(scoreMatrix(hosurA, { locationCode: 'HOSUR' })).toBeNull(); // amount band populated, no amount
  });

  it('code lists are comma-split and case-insensitive; exact fields are exact', () => {
    expect(scoreMatrix(cnc, { departmentCode: 'assy', gradeCode: 'g3' })).toBe(12);
    expect(scoreMatrix(cnc, { departmentCode: 'CNC', gradeCode: 'G4' })).toBeNull();
    const m = matrix({ code: 'X', employmentType: 'Permanent', requestSubType: 'RESIGNATION', costCentreCode: 'CC-MCH-01' });
    expect(scoreMatrix(m, { employmentType: 'PERMANENT', requestSubType: 'resignation', costCentreCode: 'CC-MCH-01' })).toBe(4);
    expect(scoreMatrix(m, { employmentType: 'Contract', requestSubType: 'RESIGNATION', costCentreCode: 'CC-MCH-01' })).toBeNull();
  });

  it('BRD worked example B scores 32+16+8+4+1 = 61', () => {
    const blrC = matrix({
      code: 'OFFR-BLR-C',
      minAmount: '1000000',
      designationCodes: 'SR-DESIGN-ENG',
      departmentCodes: 'DESIGN',
      gradeCodes: 'G7',
      locationCode: 'BLR',
    });
    expect(scoreMatrix(blrC, { amount: 1200000, designationCode: 'SR-DESIGN-ENG', departmentCode: 'DESIGN', gradeCode: 'G7', locationCode: 'BLR' })).toBe(61);
  });

  it('tie → latest effectiveFrom, then lowest code', () => {
    const older = matrix({ code: 'B-OLD', locationCode: 'HOSUR', effectiveFrom: new Date(Date.UTC(2025, 0, 1)) });
    const newer = matrix({ code: 'Z-NEW', locationCode: 'HOSUR', effectiveFrom: new Date(Date.UTC(2026, 5, 1)) });
    const sameDayA = matrix({ code: 'A-SAME', locationCode: 'HOSUR', effectiveFrom: new Date(Date.UTC(2026, 5, 1)) });
    expect(selectMatrix([older, newer], { locationCode: 'HOSUR' }, AT).matrix.code).toBe('Z-NEW');
    expect(selectMatrix([newer, sameDayA, older], { locationCode: 'HOSUR' }, AT).matrix.code).toBe('A-SAME');
  });

  it('ignores Inactive and not-yet-effective / expired versions', () => {
    const inactive = matrix({ code: 'INACTIVE', locationCode: 'HOSUR', status: 'Inactive' });
    const future = matrix({ code: 'FUTURE', locationCode: 'HOSUR', effectiveFrom: new Date(Date.UTC(2027, 0, 1)) });
    const expired = matrix({ code: 'EXPIRED', locationCode: 'HOSUR', effectiveTo: new Date(Date.UTC(2026, 8, 30)) });
    const sel = selectMatrix([inactive, future, expired, fallback], { locationCode: 'HOSUR' }, AT);
    expect(sel.matrix.code).toBe('FNF-DEFAULT');
    expect(sel.viaFallback).toBe(true);
  });

  it('effectiveTo is inclusive on its calendar day', () => {
    const endsToday = matrix({ code: 'ENDS-TODAY', locationCode: 'HOSUR', effectiveTo: new Date(Date.UTC(2026, 9, 1)) });
    expect(selectMatrix([endsToday, fallback], { locationCode: 'HOSUR' }, AT).matrix.code).toBe('ENDS-TODAY');
  });

  it('falls back to the isFallback matrix when no candidate matches, else WF-MATRIX-404', () => {
    const sel = selectMatrix([hosurA, hosurB, fallback], { amount: 45000, locationCode: 'BLR' }, AT);
    expect(sel.matrix.code).toBe('FNF-DEFAULT');
    expect(sel.score).toBe(0);
    let err: unknown;
    try {
      selectMatrix([hosurA, hosurB], { amount: 45000, locationCode: 'BLR' }, AT);
    } catch (e) {
      err = e;
    }
    expect(err).toBeInstanceOf(WorkflowError);
    expect((err as WorkflowError).code).toBe('WF-MATRIX-404');
  });

  it('a specific match beats the fallback even when the fallback is newer', () => {
    const newFallback = matrix({ code: 'FB', isFallback: true, effectiveFrom: new Date(Date.UTC(2026, 8, 1)) });
    expect(selectMatrix([newFallback, cnc], { departmentCode: 'CNC', gradeCode: 'G3' }, AT).matrix.code).toBe('FNF-CNC');
  });
});

// ─── quorum ──────────────────────────────────────────────────────────────────

function slot(over: Partial<QuorumSlot> & { sequence: number }): QuorumSlot {
  return { parallelGroup: 1, isMandatory: true, quorumRule: 'ALL', quorumN: null, status: 'Pending', ...over };
}

describe('platform workflow — level quorum (§7.7)', () => {
  it('ALL: both mandatory must approve; optional slot is advisory', () => {
    const a = slot({ sequence: 1, status: 'Approved' });
    const b = slot({ sequence: 2 });
    const c = slot({ sequence: 3, isMandatory: false });
    expect(evaluateLevel([a, b, c]).satisfied).toBe(false);
    expect(evaluateLevel([a, { ...b, status: 'Approved' }, c]).satisfied).toBe(true);
  });

  it('ANY: first of the mandatory slots satisfies the level', () => {
    const rule = { quorumRule: 'ANY' };
    const a = slot({ sequence: 1, ...rule });
    const b = slot({ sequence: 2, ...rule, status: 'Approved' });
    const c = slot({ sequence: 3, ...rule, isMandatory: false });
    expect(evaluateLevel([a, b, c]).satisfied).toBe(true);
    expect(evaluateLevel([a, { ...b, status: 'Pending' }, { ...c, status: 'Approved' }]).satisfied).toBe(false);
  });

  it('N_OF_M: any N of the slots, optional included', () => {
    const rule = { quorumRule: 'N_OF_M', quorumN: 2 };
    const a = slot({ sequence: 1, ...rule, status: 'Approved' });
    const b = slot({ sequence: 2, ...rule });
    const c = slot({ sequence: 3, ...rule, isMandatory: false, status: 'Approved' });
    expect(evaluateLevel([a, b, c]).satisfied).toBe(true);
    expect(evaluateLevel([a, b, { ...c, status: 'Pending' }]).satisfied).toBe(false);
  });

  it('a ROLE pool (several slots sharing a sequence) is satisfied by any one holder', () => {
    const p1 = slot({ sequence: 1, parallelGroup: null });
    const p2 = slot({ sequence: 1, parallelGroup: null, status: 'Approved' });
    const p3 = slot({ sequence: 1, parallelGroup: null });
    expect(evaluateLevel([p1, p2, p3]).satisfied).toBe(true);
  });

  it('escalation ADD slot (same sequence) satisfies the original slot — either may act', () => {
    const original = slot({ sequence: 1, parallelGroup: null });
    const added = slot({ sequence: 1, parallelGroup: null, status: 'Approved' });
    expect(evaluateLevel([original, added]).satisfied).toBe(true);
  });

  it('Skipped / Vacant / Replaced slots are out of play; a level with nothing in play is auto-satisfied', () => {
    const skipped = slot({ sequence: 1, status: 'Skipped' });
    const vacant = slot({ sequence: 2, status: 'Vacant' });
    const ev = evaluateLevel([skipped, vacant]);
    expect(ev.satisfied).toBe(true);
    expect(ev.nothingInPlay).toBe(true);

    const replaced = slot({ sequence: 1, status: 'Replaced' });
    const replacement = slot({ sequence: 1 });
    expect(evaluateLevel([replaced, replacement]).satisfied).toBe(false);
    expect(evaluateLevel([replaced, { ...replacement, status: 'Approved' }]).satisfied).toBe(true);
  });

  it('sequential (null parallelGroup) slots each form their own ALL group', () => {
    const s1 = slot({ sequence: 1, parallelGroup: null, status: 'Approved' });
    const s2 = slot({ sequence: 2, parallelGroup: null });
    const ev = evaluateLevel([s1, s2]);
    expect(ev.satisfied).toBe(false);
    expect(ev.groups.map((g) => g.key)).toEqual(['seq:1', 'seq:2']);
  });

  it('mixed groups: every group must be satisfied', () => {
    const g1a = slot({ sequence: 1, parallelGroup: 1, quorumRule: 'ANY', status: 'Approved' });
    const g1b = slot({ sequence: 2, parallelGroup: 1, quorumRule: 'ANY' });
    const g2 = slot({ sequence: 3, parallelGroup: 2 });
    expect(evaluateLevel([g1a, g1b, g2]).satisfied).toBe(false);
    expect(evaluateLevel([g1a, g1b, { ...g2, status: 'Approved' }]).satisfied).toBe(true);
  });
});

// ─── business days ───────────────────────────────────────────────────────────

/** Mon–Fri working, plus an explicit holiday list (UTC calendar days). */
function calendar(holidays: string[] = [], weeklyOff: number[] = [0, 6]): BusinessCalendar {
  const off = new Set(holidays);
  return {
    isBusinessDay(d) {
      if (weeklyOff.includes(d.getUTCDay())) return false;
      return !off.has(d.toISOString().slice(0, 10));
    },
  };
}

const iso = (d: Date) => d.toISOString();

describe('platform workflow — business days (§9.2)', () => {
  // Thu 1 Oct 2026 17:30 IST = 12:00Z
  const thu = new Date(Date.UTC(2026, 9, 1, 12, 0));

  it('adds whole business days skipping weekly offs', async () => {
    // Thu + 2 business days → Mon 5 Oct, same time
    expect(iso(await addBusinessDaysWithCalendar(thu, 2, calendar()))).toBe('2026-10-05T12:00:00.000Z');
  });

  it('skips company holidays', async () => {
    // Fri 2 Oct is Gandhi Jayanti → Thu + 2 → Tue 6 Oct
    expect(iso(await addBusinessDaysWithCalendar(thu, 2, calendar(['2026-10-02'])))).toBe('2026-10-06T12:00:00.000Z');
  });

  it('honours an injected weekly-off pattern (Sunday only)', async () => {
    // Sat is a working day: Thu + 2 → Sat 3 Oct
    expect(iso(await addBusinessDaysWithCalendar(thu, 2, calendar([], [0])))).toBe('2026-10-03T12:00:00.000Z');
  });

  it('applies a fractional day as wall-clock hours on the landing business day', async () => {
    // 0.5 day = 12h → Fri 2 Oct 00:00Z (still a business day)
    expect(iso(await addBusinessDaysWithCalendar(thu, 0.5, calendar()))).toBe('2026-10-02T00:00:00.000Z');
    // 1.5 days: +1 business day → Fri 12:00Z, +12h → Sat 00:00Z (weekly off) → rolls to Mon 00:00Z
    expect(iso(await addBusinessDaysWithCalendar(thu, 1.5, calendar()))).toBe('2026-10-05T00:00:00.000Z');
  });

  it('URGENT halves the SLA: 2.0 × 0.5 = 1.0 business day', async () => {
    expect(iso(await addBusinessDaysWithCalendar(thu, 2 * 0.5, calendar()))).toBe('2026-10-02T12:00:00.000Z');
  });

  it('zero or negative days returns the same instant', async () => {
    expect(iso(await addBusinessDaysWithCalendar(thu, 0, calendar()))).toBe(iso(thu));
  });

  it('elapsed business days counts only working days, plus the time-of-day fraction', async () => {
    const mon = new Date(Date.UTC(2026, 9, 5, 12, 0));
    expect(await elapsedBusinessDaysWithCalendar(thu, mon, calendar())).toBe(2);
    const monLater = new Date(Date.UTC(2026, 9, 5, 18, 0));
    expect(await elapsedBusinessDaysWithCalendar(thu, monLater, calendar())).toBe(2.25);
    expect(await elapsedBusinessDaysWithCalendar(thu, mon, calendar(['2026-10-02']))).toBe(1);
    expect(await elapsedBusinessDaysWithCalendar(mon, thu, calendar())).toBe(0);
  });
});
