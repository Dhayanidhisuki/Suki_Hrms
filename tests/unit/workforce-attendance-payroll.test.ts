import { describe, it, expect } from 'vitest';

describe('Workforce Attendance to Payroll Calculation Engine', () => {
  function computePayableDays(
    totalCalendarDays: number,
    absentDays: number,
    lopDays: number,
    halfDays: number,
    missingPunchDays: number = 0
  ) {
    const totalAbsent = absentDays + missingPunchDays + halfDays * 0.5;
    return Math.max(0, totalCalendarDays - totalAbsent - lopDays);
  }

  function computeLopFactor(payableDays: number, totalCalendarDays: number) {
    return totalCalendarDays > 0 ? Math.min(1, Math.max(0, payableDays / totalCalendarDays)) : 0;
  }

  describe('Payable Days & Salaried Proration (P0-7)', () => {
    it('grants full pay when there are 0 absences and 0 LOP in a 30-day month', () => {
      const payableDays = computePayableDays(30, 0, 0, 0);
      const lopFactor = computeLopFactor(payableDays, 30);
      expect(payableDays).toBe(30);
      expect(lopFactor).toBe(1.0);
    });

    it('deducts 5 full days from payableDays and prorates salary for 5 absent days', () => {
      const payableDays = computePayableDays(30, 5, 0, 0);
      const lopFactor = computeLopFactor(payableDays, 30);
      expect(payableDays).toBe(25);
      expect(lopFactor).toBeCloseTo(25 / 30, 4);
    });

    it('deducts half a day for each HalfDay status', () => {
      // 2 half days = 1 full day unpaid
      const payableDays = computePayableDays(30, 0, 0, 2);
      const lopFactor = computeLopFactor(payableDays, 30);
      expect(payableDays).toBe(29);
      expect(lopFactor).toBeCloseTo(29 / 30, 4);
    });

    it('deducts unregularized MissingPunch days as unpaid absence', () => {
      const payableDays = computePayableDays(30, 2, 0, 0, 3);
      expect(payableDays).toBe(25);
    });

    it('correctly handles combination of LOP, Absent, and HalfDays', () => {
      // 30 days - 3 LOP - 2 Absent - (2 * 0.5) HalfDays = 24 payable days
      const payableDays = computePayableDays(30, 2, 3, 2);
      const lopFactor = computeLopFactor(payableDays, 30);
      expect(payableDays).toBe(24);
      expect(lopFactor).toBeCloseTo(24 / 30, 4);
    });

    it('caps payableDays at zero if absences exceed calendar days', () => {
      const payableDays = computePayableDays(30, 35, 0, 0);
      expect(payableDays).toBe(0);
      expect(computeLopFactor(payableDays, 30)).toBe(0);
    });
  });

  describe('Mid-Month Joiner Proration', () => {
    it('prorates an employee joining on April 21 in a 30-day month to 10 active days', () => {
      const joinDate = new Date(Date.UTC(2026, 3, 21)); // April 21
      const totalCalendarDays = 30;
      let activeDays = 0;

      for (let d = 1; d <= totalCalendarDays; d++) {
        const currentDate = new Date(Date.UTC(2026, 3, d));
        if (currentDate >= joinDate) {
          activeDays++;
        }
      }

      expect(activeDays).toBe(10);
      const lopFactor = computeLopFactor(activeDays, totalCalendarDays);
      expect(lopFactor).toBeCloseTo(10 / 30, 4);

      // Component proration on ₹60,000 monthly gross
      const monthlyGross = 60000;
      const proratedGross = Math.round(monthlyGross * lopFactor);
      expect(proratedGross).toBe(20000);
    });
  });

  describe('Overtime Cash vs Comp-Off Filtering (P1-11)', () => {
    function filterApprovedCashOtMinutes(
      days: Array<{
        otCalculated: number;
        otApprovalStatus: string | null;
        otSettlementType: string | null;
        otMinutesApproved: number | null;
      }>
    ) {
      let cashOtMinutes = 0;
      for (const d of days) {
        if (d.otApprovalStatus === 'approved' && d.otSettlementType === 'OT' && d.otMinutesApproved) {
          cashOtMinutes += d.otMinutesApproved;
        }
      }
      return cashOtMinutes;
    }

    it('excludes unapproved overtime from cash payout', () => {
      const days = [
        { otCalculated: 120, otApprovalStatus: 'pending_manager', otSettlementType: null, otMinutesApproved: null },
        { otCalculated: 60, otApprovalStatus: 'pending_hr', otSettlementType: null, otMinutesApproved: null },
      ];
      expect(filterApprovedCashOtMinutes(days)).toBe(0);
    });

    it('excludes COMP_OFF settlements from cash payout', () => {
      const days = [
        { otCalculated: 120, otApprovalStatus: 'approved', otSettlementType: 'COMP_OFF', otMinutesApproved: null },
      ];
      expect(filterApprovedCashOtMinutes(days)).toBe(0);
    });

    it('includes approved OT settlements with their approved minutes', () => {
      const days = [
        { otCalculated: 120, otApprovalStatus: 'approved', otSettlementType: 'OT', otMinutesApproved: 100 },
        { otCalculated: 180, otApprovalStatus: 'approved', otSettlementType: 'COMP_OFF', otMinutesApproved: null },
        { otCalculated: 60, otApprovalStatus: 'approved', otSettlementType: 'OT', otMinutesApproved: 60 },
      ];
      expect(filterApprovedCashOtMinutes(days)).toBe(160);
    });
  });

  describe('Arrear Proration (GAP-14)', () => {
    function computeArrearForMonth(
      revisedGross: number,
      oldGross: number,
      payableDays: number,
      totalWorkingDays: number
    ) {
      const lopFactor = totalWorkingDays > 0 ? Math.min(1, Math.max(0, payableDays / totalWorkingDays)) : 0;
      const proratedRevisedGross = Math.round(revisedGross * lopFactor);
      return Math.round(proratedRevisedGross - oldGross);
    }

    it('prorates revisedGross by LOP factor before computing arrear', () => {
      // Employee was on 10-day LOP in a 30-day month
      // Old salary was ₹50K, old gross paid was ₹33,333 (prorated)
      // Revised salary is ₹60K → prorated revised = 60K × 20/30 = ₹40K
      // Correct arrear = 40K - 33,333 = ₹6,667
      const arrear = computeArrearForMonth(60000, 33333, 20, 30);
      expect(arrear).toBe(6667); // NOT 60000 - 33333 = 26667 (old bug)
    });

    it('returns zero arrear when full attendance and no salary change after proration', () => {
      // Full attendance (30/30), old was ₹50K, revised is ₹50K → arrear = 0
      const arrear = computeArrearForMonth(50000, 50000, 30, 30);
      expect(arrear).toBe(0);
    });

    it('returns full difference when employee had full attendance', () => {
      // Full attendance, old ₹50K, revised ₹60K → arrear = ₹10K
      const arrear = computeArrearForMonth(60000, 50000, 30, 30);
      expect(arrear).toBe(10000);
    });

    it('returns zero arrear for an employee on full LOP', () => {
      // 0 payable days → prorated revised = 0, old gross was also 0
      const arrear = computeArrearForMonth(60000, 0, 0, 30);
      expect(arrear).toBe(0);
    });
  });

  describe('Ad-Hoc Statutory Recalculation (GAP-15)', () => {
    function recalculateStatutory(
      grossEarnings: number,
      otAmount: number,
      otherEarningsTotal: number,
      pfApplicable: boolean,
      esiApplicable: boolean,
      pfEmployeeRate: number,
      pfEmployerRate: number,
      epsRate: number,
      esiEmployeeRate: number,
      esiEmployerRate: number,
      pfCeiling: number,
      esiCeiling: number
    ) {
      const totalTaxable = grossEarnings + otAmount + otherEarningsTotal;

      let pfEmployee = 0, pfEmployer = 0, epsEmployer = 0;
      if (pfApplicable) {
        const pfWage = Math.min(totalTaxable, pfCeiling);
        pfEmployee = Math.round(pfWage * (pfEmployeeRate / 100));
        const pfEmployerTotal = Math.round(pfWage * (pfEmployerRate / 100));
        epsEmployer = Math.round(pfWage * (epsRate / 100));
        pfEmployer = pfEmployerTotal - epsEmployer;
      }

      let esiEmployee = 0, esiEmployer = 0;
      if (esiApplicable && totalTaxable <= esiCeiling) {
        esiEmployee = Math.round(totalTaxable * (esiEmployeeRate / 100));
        esiEmployer = Math.round(totalTaxable * (esiEmployerRate / 100));
      }

      return { pfEmployee, pfEmployer, epsEmployer, esiEmployee, esiEmployer };
    }

    it('increases PF/ESI when ad-hoc earning raises taxable base', () => {
      // Before ad-hoc: gross=30000, OT=0, other=0
      const before = recalculateStatutory(30000, 0, 0, true, true, 12, 12, 8.33, 0.75, 3.25, 15000, 21000);
      // After ad-hoc: gross=30000, OT=0, other=10000 (ad-hoc bonus)
      const after = recalculateStatutory(30000, 0, 10000, true, true, 12, 12, 8.33, 0.75, 3.25, 15000, 21000);

      // PF is capped at ceiling (15000), so pfEmployee stays the same
      expect(after.pfEmployee).toBe(before.pfEmployee);
      // ESI: 40K > 21K ceiling → not eligible anymore
      expect(after.esiEmployee).toBe(0);
    });

    it('recalculates PF when taxable is below ceiling', () => {
      const result = recalculateStatutory(10000, 0, 2000, true, false, 12, 12, 8.33, 0.75, 3.25, 15000, 21000);
      // PF wage = min(12000, 15000) = 12000
      expect(result.pfEmployee).toBe(Math.round(12000 * 0.12)); // 1440
      expect(result.pfEmployer + result.epsEmployer).toBe(Math.round(12000 * 0.12)); // total employer = 1440
    });
  });

  describe('Employer Contributions (GAP-17)', () => {
    it('splits employer PF into EPF (3.67%) and EPS (8.33%)', () => {
      const pfWage = 15000;
      const employerRate = 12 / 100;
      const epsRate = 8.33 / 100;
      const pfEmployerTotal = Math.round(pfWage * employerRate);
      const epsEmployer = Math.round(pfWage * epsRate);
      const pfEmployer = pfEmployerTotal - epsEmployer;

      expect(pfEmployerTotal).toBe(1800); // 15000 × 12%
      expect(epsEmployer).toBe(1250); // 15000 × 8.33% ≈ 1249.5 → 1250
      expect(pfEmployer).toBe(550); // 1800 - 1250
    });

    it('calculates ESI employer at 3.25%', () => {
      const grossEarnings = 18000;
      const esiEmployerRate = 3.25;
      const esiEmployer = Math.round(grossEarnings * (esiEmployerRate / 100));
      expect(esiEmployer).toBe(585); // 18000 × 3.25%
    });

    it('sets employer contributions to 0 when not applicable', () => {
      const pfApplicable = false;
      const pfEmployer = pfApplicable ? Math.round(15000 * 0.0367) : 0;
      const epsEmployer = pfApplicable ? Math.round(15000 * 0.0833) : 0;
      expect(pfEmployer).toBe(0);
      expect(epsEmployer).toBe(0);
    });
  });

  describe('WeeklyOff / Holiday Day Classification (GAP-06)', () => {
    function classifyMissingDay(
      dayOfWeek: number,
      isHoliday: boolean
    ): 'WeeklyOff' | 'Holiday' | 'Absent' {
      if (dayOfWeek === 0) return 'WeeklyOff';
      if (isHoliday) return 'Holiday';
      return 'Absent';
    }

    function computePayableDaysWithStatuses(
      totalCalendarDays: number,
      statuses: string[]
    ) {
      let absentDays = 0;
      let lopDays = 0;
      let halfDays = 0;
      for (const s of statuses) {
        if (s === 'Absent' || s === 'MissingPunch') absentDays++;
        else if (s === 'LOP') lopDays++;
        else if (s === 'HalfDay') halfDays++;
        // WeeklyOff, Holiday, Present, Leave — no deduction
      }
      const totalAbsent = absentDays + halfDays * 0.5;
      return Math.max(0, totalCalendarDays - totalAbsent - lopDays);
    }

    it('classifies Sunday as WeeklyOff', () => {
      expect(classifyMissingDay(0, false)).toBe('WeeklyOff');
    });

    it('classifies declared holiday on a weekday as Holiday', () => {
      expect(classifyMissingDay(3, true)).toBe('Holiday');
    });

    it('classifies regular missing weekday as Absent', () => {
      expect(classifyMissingDay(2, false)).toBe('Absent');
    });

    it('does not deduct WeeklyOff or Holiday from payableDays', () => {
      // 30-day month: 4 Sundays (WeeklyOff), 1 Holiday, 2 Absent, rest Present
      const statuses = [
        ...Array(23).fill('Present'),
        ...Array(4).fill('WeeklyOff'),
        'Holiday',
        ...Array(2).fill('Absent'),
      ];
      const payableDays = computePayableDaysWithStatuses(30, statuses);
      // Only 2 absent days deducted: 30 - 2 = 28
      expect(payableDays).toBe(28);
    });

    it('Sunday holiday is classified as WeeklyOff (Sunday takes priority)', () => {
      // Sunday that is also a declared holiday
      expect(classifyMissingDay(0, true)).toBe('WeeklyOff');
    });
  });
});
