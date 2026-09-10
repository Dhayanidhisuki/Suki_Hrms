# HRMS Core Bug Fix — Complete Implementation Plan

**Date:** 2026-09-10
**Scope:** P0 (Critical) + P1 (High) bugs from the gap analysis
**Total fixes:** 37 (15 P0 + 22 P1)
**Approach:** Phased delivery — each phase is independently deployable

---

## Phase Overview

| Phase | Focus | Fixes | Dependencies |
|-------|-------|-------|--------------|
| **Phase 1** | Security foundation | P0-1, P0-2, P0-3 | None |
| **Phase 2** | Tenant isolation | P0-4, P0-5, P0-6 | Phase 1 |
| **Phase 3** | Attendance & payroll accuracy | P0-7, P0-8, P0-9, P1-11, P1-12 | Phase 2 |
| **Phase 4** | Statutory payroll engine | P0-10, P0-11, P1-13, P1-14, P1-15, P1-21 | Phase 3 |
| **Phase 5** | Payroll outputs | P0-12, P1-16, P1-17, P1-18, P1-19 | Phase 4 |
| **Phase 6** | Auth hardening | P1-1, P1-2, P1-3, P1-4, P1-5 | Phase 1 |
| **Phase 7** | RBAC & UI gaps | P1-6, P1-7, P1-20, P0-13, P0-14 | Phase 2 |
| **Phase 8** | Employee master fixes | P1-8, P1-9, P1-10 | Phase 2 |
| **Phase 9** | Reports & company model | P0-15, P1-22 | Phase 4 |

---

## Phase 1 — Security Foundation (Do First)

> **Goal:** Close the two most dangerous security holes — no middleware and
> hardcoded secrets. These are prerequisites for all other phases.

### Step 1.1 — Wire proxy.ts as Next.js middleware (P0-1)

**Why:** `src/proxy.ts` contains the JWT verification and header injection
logic, but Next.js only loads middleware from `src/middleware.ts`. Without
it, every `x-company-id` / `x-role-id` / `x-user-id` header is client-spoofable.

**Files:**
- Create: `src/middleware.ts`

**Implementation:**
```ts
// src/middleware.ts
export { default, config } from './proxy';
```

**Verify:**
1. `npm run dev`
2. Hit `GET /api/employees` with no cookie → 401 Unauthorized
3. Hit `GET /api/employees` with a valid cookie → 200, and
   `request.headers.get('x-company-id')` returns the real company ID
4. Hit `GET /api/employees` with a fake `x-company-id: 999` header in the
   request → the injected header from proxy.ts overwrites it (proxy strips
   and re-injects)

### Step 1.2 — Remove hardcoded superadmin credentials (P0-2)

**Why:** `seed-superadmin/route.ts:20-21` hardcodes
`superadmin@suki.hrms` / `superadmin123` — anyone with repo access gets
admin credentials.

**Files:**
- Edit: `src/app/api/auth/seed-superadmin/route.ts`

**Implementation:**
```ts
// Replace lines 20-21:
const SUPERADMIN_EMAIL = process.env.SUPERADMIN_EMAIL;
const SUPERADMIN_DEFAULT_PASSWORD = process.env.SUPERADMIN_PASSWORD;
if (!SUPERADMIN_EMAIL || !SUPERADMIN_DEFAULT_PASSWORD) {
  return NextResponse.json(
    { error: 'SUPERADMIN_EMAIL and SUPERADMIN_PASSWORD env vars required' },
    { status: 500 }
  );
}
```

Add to `.env` (never commit):
```
SUPERADMIN_EMAIL=superadmin@suki.hrms
SUPERADMIN_PASSWORD=<generate-a-strong-random-password>
```

**Verify:**
1. Seed without env vars → 500 error
2. Set env vars, seed → works
3. Login with the new credentials → succeeds

### Step 1.3 — Remove hardcoded JWT fallback secret (P0-3)

**Why:** `jwt.ts:14,53` falls back to `'suki-hrms-super-secret-jwt-key'`
if `JWT_SECRET` is unset — a known secret in source code.

**Files:**
- Edit: `src/lib/jwt.ts` (lines 14 and 53)

**Implementation:**
```ts
// Replace both occurrences of:
//   process.env.JWT_SECRET ?? 'suki-hrms-super-secret-jwt-key'
// With:
const secret = process.env.JWT_SECRET;
if (!secret) throw new Error('JWT_SECRET environment variable is required');
```

Add to `.env`:
```
JWT_SECRET=<generate-a-64-char-random-string>
```

**Verify:**
1. Start server without `JWT_SECRET` → crash on first auth request
2. Set `JWT_SECRET`, start server → login works, token verifies

---

## Phase 2 — Tenant Isolation (Close IDOR Gaps)

> **Goal:** Ensure every API route verifies the caller's company before
> reading or writing data. Depends on Phase 1 (middleware must inject
> `x-company-id`).

### Step 2.1 — Add company scoping to all employee per-tab routes (P0-4)

**Why:** 18 employee sub-routes fetch by `id` only, without verifying the
employee belongs to the caller's company. Cross-tenant access is possible.

**Files (18 routes):**
```
src/app/api/employees/[id]/basic/route.ts
src/app/api/employees/[id]/contact/route.ts
src/app/api/employees/[id]/salary/route.ts
src/app/api/employees/[id]/ctc/route.ts
src/app/api/employees/[id]/kyc/route.ts
src/app/api/employees/[id]/kyc/reveal/route.ts
src/app/api/employees/[id]/passport/route.ts
src/app/api/employees/[id]/education/route.ts
src/app/api/employees/[id]/education/[recordId]/route.ts
src/app/api/employees/[id]/experience/route.ts
src/app/api/employees/[id]/experience/[recordId]/route.ts
src/app/api/employees/[id]/dependents/route.ts
src/app/api/employees/[id]/dependents/[recordId]/route.ts
src/app/api/employees/[id]/emergency-contacts/route.ts
src/app/api/employees/[id]/emergency-contacts/[recordId]/route.ts
src/app/api/employees/[id]/skills/route.ts
src/app/api/employees/[id]/skills/[recordId]/route.ts
src/app/api/employees/[id]/assets/route.ts
src/app/api/employees/[id]/assets/[recordId]/route.ts
src/app/api/employees/[id]/job-profile/route.ts
src/app/api/employees/[id]/exit/route.ts
src/app/api/employees/[id]/reactivate/route.ts
src/app/api/employees/[id]/confirmation/approve/route.ts
src/app/api/employees/[id]/confirmation/extend/route.ts
src/app/api/employees/[id]/confirmation/reject/route.ts
src/app/api/employees/[id]/confirmation/letter/route.ts
src/app/api/employees/activity/route.ts
src/app/api/employees/export/route.ts
src/app/api/employees/separations/route.ts
```

**Implementation pattern (apply to each):**
```ts
import { getCompanyId, findEmployeeInCompany } from '@/lib/companyScope';

// At the top of each handler, after permission check:
const scope = getCompanyId(request);
if ('error' in scope) return scope.error;
const { companyId } = scope;

// Before any employee data fetch, verify company ownership:
const employee = await findEmployeeInCompany(params.id, companyId);
if (!employee) return NextResponse.json({ error: 'Not found' }, { status: 404 });

// For list routes (activity, export, separations), add companyId to where:
const where = { companyId, ...existingFilters };
```

**Verify:**
1. Login as company A user
2. `GET /api/employees/<company-B-employee-id>/basic` → 404
3. `GET /api/employees/<company-A-employee-id>/basic` → 200

### Step 2.2 — Fix POST /api/employees to use session companyId (P0-5)

**Why:** `route.ts:127-129` reads `body.companyId` from the request body
instead of the session header.

**Files:**
- Edit: `src/app/api/employees/route.ts`

**Implementation:**
```ts
import { getCompanyId } from '@/lib/companyScope';

// In POST handler, replace:
//   companyId: body.companyId,
// With:
const scope = getCompanyId(request);
if ('error' in scope) return scope.error;
const { companyId } = scope;
// Use companyId from session in the create data:
const record = await prisma.employee.create({
  data: { ...parsed.data, companyId },
});
```

**Verify:**
1. POST with `companyId: 999` in body → employee is created under caller's
   actual company, not 999

### Step 2.3 — Add company scoping to Unit, Holiday, BenefitRate masters (P0-6)

**Why:** These 3 masters read `companyId` from body/query, not session.

**Files:**
```
src/app/api/masters/units/route.ts
src/app/api/masters/units/[id]/route.ts
src/app/api/masters/holidays/route.ts
src/app/api/masters/holidays/[id]/route.ts
src/app/api/masters/benefit-rates/route.ts
src/app/api/masters/benefit-rates/[id]/route.ts
```

**Implementation pattern (same as Step 2.1):**
```ts
const scope = getCompanyId(request);
if ('error' in scope) return scope.error;
const { companyId } = scope;

// GET: filter by companyId
const where = { companyId, deletedAt: null, ...searchFilters };

// POST: use session companyId, ignore body.companyId
const data = { ...parsed.data, companyId };

// PUT: verify record belongs to company before update
const existing = await prisma.unit.findFirst({
  where: { id: params.id, companyId },
});
if (!existing) return NextResponse.json({ error: 'Not found' }, { status: 404 });
```

**Verify:**
1. GET units as company A → only company A's units
2. POST unit with `companyId: 999` in body → created under company A

---

## Phase 3 — Attendance & Payroll Accuracy

> **Goal:** Fix the bugs that cause payroll to overpay employees. Depends on
> Phase 2 (company scoping must be in place for attendance queries).

### Step 3.1 — Fix payableDays to exclude Absent/MissingPunch (P0-7)

**Why:** `finalize/route.ts:58` sets `totalWorkingDays = daysInMonth()` (all
calendar days). `payableDays = totalWorkingDays - lopDays`. Absent,
MissingPunch, and HalfDay do NOT reduce payable days — only LOP does.

**Files:**
- Edit: `src/app/api/workforce/attendance/monthly/finalize/route.ts`

**Implementation:**
```ts
// Replace line 58:
//   const totalWorkingDays = daysInMonth(year, month);
// With:
const totalWorkingDays = daysInMonth(year, month); // TODO Phase 2: subtract weekly-offs + holidays

// In the counting loop, add MissingPunch and HalfDay handling:
let halfDays = 0;
for (const d of days) {
  if (d.status === 'Present' || d.status === 'OnDuty') presentDays += 1;
  else if (d.status === 'HalfDay') { presentDays += 0.5; halfDays += 0.5; }
  else if (d.status === 'Absent') absentDays += 1;
  else if (d.status === 'MissingPunch') absentDays += 1;  // ADD THIS
  else if (d.status === 'Leave') leaveDays += 1;
  else if (d.status === 'LOP') lopDays += 1;
  // ... OT/late/early-out totals
}

// Compute payableDays correctly:
const payableDays = totalWorkingDays - lopDays - absentDays - halfDays;

// Store payableDays in the summary (add field if not present):
return prisma.monthlyAttendanceSummary.upsert({
  // ...
  update: {
    totalWorkingDays,
    payableDays,  // ADD THIS FIELD
    presentDays: Math.round(presentDays),
    absentDays,
    // ...
  },
  create: {
    // same
  },
});
```

**Schema change needed:**
```prisma
// Add to MonthlyAttendanceSummary model:
payableDays Decimal @default(0) @db.Decimal(5, 2)
```

**Migration:**
```bash
npx prisma migrate dev --name add_payable_days_to_summary
npx prisma generate
```

**Verify:**
1. Create an employee with 5 Absent days in a 30-day month
2. Finalize → `payableDays` should be 25, not 30
3. Run payroll → LOP factor should be 25/30, not 30/30

### Step 3.2 — Generate Absent rows for missing biometric days (P0-8)

**Why:** Biometric sync only writes days the device reports. Days with no
punches are missing entirely, so `absentDays` stays 0 and payroll treats
them as payable.

**Files:**
- Edit: `src/app/api/workforce/attendance/monthly/finalize/route.ts`

**Implementation (add before the counting loop):**
```ts
// Before counting, generate Absent rows for missing expected-work days:
const holidays = await prisma.holidayMaster.findMany({
  where: { companyId: scope.companyId, date: { gte: monthStart, lt: monthEnd }, isActive: true, deletedAt: null },
  select: { date: true },
});
const holidayDates = new Set(holidays.map(h => h.date.toISOString().slice(0, 10)));

for (const emp of employees) {
  const existingDates = new Set(
    emp.dailyAttendances.map(d => d.date.toISOString().slice(0, 10))
  );
  for (let day = 1; day <= daysInMonth(year, month); day++) {
    const dateStr = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    const date = new Date(Date.UTC(year, month - 1, day));
    const dayOfWeek = date.getUTCDay();

    // Skip Sundays (weekly off) and holidays
    if (dayOfWeek === 0 || holidayDates.has(dateStr)) continue;

    if (!existingDates.has(dateStr)) {
      await prisma.dailyAttendance.create({
        data: {
          employeeId: emp.id,
          date,
          status: 'Absent',
          source: 'SYSTEM_AUTO',
        },
      });
    }
  }
}

// Re-fetch employees with updated attendances before counting:
const updatedEmployees = await prisma.employee.findMany({
  where: { companyId: scope.companyId, deletedAt: null, isActive: true,
    ...(employeeIdFilter ? { id: employeeIdFilter } : {}) },
  select: { id: true, dailyAttendances: { where: { date: { gte: monthStart, lt: monthEnd } } } },
});
```

**Verify:**
1. Sync biometric for an employee who was absent all week
2. Finalize → those days show as `Absent` with `source: 'SYSTEM_AUTO'`
3. `absentDays` in summary > 0

### Step 3.3 — Route daily PUT through history helper (P0-9)

**Why:** `daily/[id]/route.ts:56` does a direct `prisma.update` without
`upsertDailyAttendanceWithHistory`, no OT recompute, no summary refresh.

**Files:**
- Edit: `src/app/api/workforce/attendance/daily/[id]/route.ts`

**Implementation:**
```ts
import { upsertDailyAttendanceWithHistory } from '@/lib/attendanceHistory';
import { refreshMonthlySummary } from '@/lib/attendanceFreeze';

// Replace the direct update (lines 56-69):
//   const record = await prisma.dailyAttendance.update({ ... });
// With:
const record = await upsertDailyAttendanceWithHistory({
  employeeId: existing.employeeId,
  date: existing.date,
  shiftMasterId: parsed.data.shiftMasterId,
  status: parsed.data.status,
  inTime: parsed.data.inTime,
  outTime: parsed.data.outTime,
  workingMinutes: parsed.data.workingMinutes,
  lateMinutes: parsed.data.lateMinutes,
  earlyOutMinutes: parsed.data.earlyOutMinutes,
  otMinutesCalculated: parsed.data.otMinutesCalculated,
  remarks: parsed.data.remarks,
  source: 'MANUAL_EDIT',
  updatedByUserId: userId,
});

// Refresh the monthly summary for this employee/month:
await refreshMonthlySummary(existing.employeeId, existing.date);
```

**Note:** Check if `refreshMonthlySummary` exists in `attendanceFreeze.ts`.
If not, create it:
```ts
// src/lib/attendanceFreeze.ts — add:
export async function refreshMonthlySummary(employeeId: number, date: Date) {
  // Re-run the finalize logic for this single employee/month
  // (extract the per-employee finalize block into a reusable function)
}
```

**Verify:**
1. Edit a daily attendance row
2. Check `DailyAttendanceHistory` → has a snapshot of old values
3. Check `MonthlyAttendanceSummary` → reflects the change

### Step 3.4 — Fix OT approval to use history helper + summary refresh (P1-11)

**Why:** OT approve route does 3 direct `prisma.update` calls (lines 55, 85,
98) without history snapshots or summary refresh.

**Files:**
- Edit: `src/app/api/workforce/attendance/ot/[id]/approve/route.ts`

**Implementation:**
```ts
import { upsertDailyAttendanceWithHistory } from '@/lib/attendanceHistory';
import { refreshMonthlySummary } from '@/lib/attendanceFreeze';

// Replace each prisma.dailyAttendance.update with upsertDailyAttendanceWithHistory:

// Manager approval stage (line 55):
const updated = await upsertDailyAttendanceWithHistory({
  employeeId: record.employeeId,
  date: record.date,
  otApprovalStatus: 'pending_hr',
  otManagerActionByUserId: userId,
  otManagerActionAt: new Date(),
  source: 'OT_MANAGER_APPROVE',
});
await refreshMonthlySummary(record.employeeId, record.date);

// HR COMP_OFF stage (line 85):
const updated = await upsertDailyAttendanceWithHistory({
  employeeId: record.employeeId,
  date: record.date,
  otApprovalStatus: 'approved',
  otSettlementType: 'COMP_OFF',
  otMinutesApproved: null,
  otHrActionByUserId: userId,
  otHrActionAt: new Date(),
  source: 'OT_HR_APPROVE',
});
await refreshMonthlySummary(record.employeeId, record.date);

// HR OT stage (line 98):
const updated = await upsertDailyAttendanceWithHistory({
  employeeId: record.employeeId,
  date: record.date,
  otApprovalStatus: 'approved',
  otSettlementType: 'OT',
  otMinutesApproved: parsed.data.approvedMinutes ?? record.otMinutesCalculated,
  otHrActionByUserId: userId,
  otHrActionAt: new Date(),
  source: 'OT_HR_APPROVE',
});
await refreshMonthlySummary(record.employeeId, record.date);
```

**Verify:**
1. Approve OT → check `DailyAttendanceHistory` has snapshot
2. Check `MonthlyAttendanceSummary` `otMinutesTotal` updated

### Step 3.5 — Fix leave approve/cancel to use history helper (P1-12)

**Why:** Leave approve/cancel use `prisma.dailyAttendance.upsert/updateMany`
directly, bypassing `DailyAttendanceHistory`. Cancel reverts to `Absent`
(not `LOP`), which is still paid under current payroll logic.

**Files:**
- Edit: `src/app/api/workforce/leave/applications/[id]/approve/route.ts`
- Edit: `src/app/api/workforce/leave/applications/[id]/cancel/route.ts`

**Implementation:**
```ts
import { upsertDailyAttendanceWithHistory } from '@/lib/attendanceHistory';
import { refreshMonthlySummary } from '@/lib/attendanceFreeze';

// In approve route, replace prisma.dailyAttendance.upsert with:
for (const day of leaveDays) {
  await upsertDailyAttendanceWithHistory({
    employeeId: application.employeeId,
    date: day,
    status: 'Leave',
    source: 'LEAVE_APPROVED',
    updatedByUserId: userId,
  });
}
await refreshMonthlySummary(application.employeeId, leaveStartDate);

// In cancel route, replace prisma.dailyAttendance.updateMany with:
for (const day of leaveDays) {
  await upsertDailyAttendanceWithHistory({
    employeeId: application.employeeId,
    date: day,
    status: 'LOP',  // Changed from 'Absent' to 'LOP' — if already paid, it should be LOP
    source: 'LEAVE_CANCELLED',
    updatedByUserId: userId,
  });
}
await refreshMonthlySummary(application.employeeId, leaveStartDate);
```

**Verify:**
1. Approve leave → `DailyAttendanceHistory` has snapshot, summary updated
2. Cancel leave → days revert to `LOP` (not `Absent`), balance restored

---

## Phase 4 — Statutory Payroll Engine

> **Goal:** Fix the legally-required statutory calculations. Depends on
> Phase 3 (payableDays must be correct first).

### Step 4.1 — Add component-level PF/ESI/PT flags (P1-13, P1-14)

**Why:** PF/ESI wage basis is full gross. `SalaryComponent` only has
`includeInGratuity` — no `includeInPf`/`includeInEsi`/`includeInPt`. Also,
PF/ESI/PT/TDS master rates are global, not company-scoped.

**Files:**
- Edit: `prisma/schema.prisma` (SalaryComponent + statutory master models)
- Edit: `src/app/masters/salary-components/page.tsx` (add toggle fields)
- Edit: `src/lib/payrollCalculation.ts` (use component flags)

**Schema changes:**
```prisma
// Add to SalaryComponent model:
includeInPf  Boolean @default(false)
includeInEsi Boolean @default(false)
includeInPt  Boolean @default(false)

// Add companyId to PfRate, EsiRate, ProfessionalTaxSlab, TDSSlab:
model PfRate {
  // ... existing fields ...
  companyId Int?
  company   Company? @relation(fields: [companyId], references: [id])
  // ...
}
// Repeat for EsiRate, ProfessionalTaxSlab, TDSSlab
```

**Migration:**
```bash
npx prisma migrate dev --name add_statutory_flags_and_company_scoping
npx prisma generate
```

**payrollCalculation.ts changes:**
```ts
// Replace line 70-73 (global fetch) with company-scoped:
const [pfRate, esiRate, ptSlabs, tdsSlabs] = await Promise.all([
  prisma.pfRate.findFirst({ where: { companyId, effectiveTo: null, isActive: true } }),
  prisma.esiRate.findFirst({ where: { companyId, effectiveTo: null, isActive: true } }),
  prisma.professionalTaxSlab.findMany({ where: { companyId, effectiveTo: null, isActive: true } }),
  prisma.tDSSlab.findMany({ where: { companyId, effectiveTo: null, isActive: true } }),
]);

// Replace PF wage calculation (line 163-165):
// Instead of: const pfWage = Math.min(grossEarnings, ...)
// Use component-flagged wage:
const pfComponents = await prisma.salaryComponent.findMany({
  where: { companyId, includeInPf: true, isActive: true },
  select: { code: true },
});
const pfWage = Math.min(
  sumOfComponents(line, pfComponents.map(c => c.code)),
  Number(pfRate.wageCeilingMonthly)
);
// Same pattern for ESI and PT
```

**Verify:**
1. Mark only Basic + DA as `includeInPf: true`
2. Run payroll → PF should be calculated on Basic+DA, not full gross

### Step 4.2 — Compute and store employer PF/ESI contributions (P0-11)

**Why:** Only employee PF/ESI is computed. Employer contributions (which
affect CTC and statutory filings) are missing.

**Files:**
- Edit: `prisma/schema.prisma` (PayrollLine model)
- Edit: `src/lib/payrollCalculation.ts`

**Schema change:**
```prisma
// Add to PayrollLine model:
employerPf          Decimal @default(0) @db.Decimal(18, 2)
employerEsi         Decimal @default(0) @db.Decimal(18, 2)
pensionContribution Decimal @default(0) @db.Decimal(18, 2)
```

**payrollCalculation.ts changes:**
```ts
// After computing pfEmployee (line 165):
let pfEmployer = 0;
let pfPension = 0;
if (pfApplicable && pfRate) {
  const pfWage = Math.min(pfWageBase, Number(pfRate.wageCeilingMonthly));
  pfEmployee = round(pfWage * (Number(pfRate.employeeContributionRate) / 100));
  pfEmployer = round(pfWage * (Number(pfRate.employerContributionRate) / 100));
  if (pfRate.pensionContributionRate) {
    pfPension = round(pfWage * (Number(pfRate.pensionContributionRate) / 100));
  }
}

// After computing esiEmployee (line 185):
let esiEmployer = 0;
if (esiEligible && esiRate) {
  esiEmployee = round(esiWageBase * (Number(esiRate.employeeContributionRate) / 100));
  esiEmployer = round(esiWageBase * (Number(esiRate.employerContributionRate) / 100));
}

// Store in PayrollLine:
await prisma.payrollLine.update({
  where: { id: line.id },
  data: {
    pfEmployee, esiEmployee, professionalTax, tds,
    employerPf: pfEmployer, employerEsi: esiEmployer,
    pensionContribution: pfPension,
  },
});
```

**Verify:**
1. Run payroll → `PayrollLine.employerPf` and `employerEsi` are non-zero
2. Check employer PF = 12% of pfWage, employer ESI = 3.25% of esiWage

### Step 4.3 — Build annual TDS engine (P0-10)

**Why:** TDS is a flat monthly slab lookup. No regime selection, exemptions,
deductions, surcharge, cess, Form 16.

**Files:**
- New: `src/lib/tdsCalculation.ts`
- Edit: `prisma/schema.prisma` (add EmployeeTaxConfig model)
- Edit: `src/lib/payrollCalculation.ts` (replace flat TDS)
- New: `src/app/employees/[id]/tax-config/route.ts` (CRUD for tax config)

**Schema:**
```prisma
model EmployeeTaxConfig {
  id                      Int     @id @default(autoincrement())
  employeeId              Int     @unique
  regime                  String  @default('NEW') @db.NVarChar(10) // 'OLD' | 'NEW'
  previousEmploymentIncome Decimal @default(0) @db.Decimal(18, 2)
  section80C              Decimal @default(0) @db.Decimal(18, 2)
  section80D              Decimal @default(0) @db.Decimal(18, 2)
  hraExemption            Decimal @default(0) @db.Decimal(18, 2)
  section80CCD1B          Decimal @default(0) @db.Decimal(18, 2) // NPS
  section24B              Decimal @default(0) @db.Decimal(18, 2) // Home loan interest
  otherExemptions         Json?
  employee                Employee @relation(fields: [employeeId], references: [id])
}
```

**tdsCalculation.ts:**
```ts
export async function calculateMonthlyTds(
  employeeId: number,
  companyId: number,
  monthlyGross: number,
  month: number, // 1-12
  financialYear: number,
) {
  const config = await prisma.employeeTaxConfig.findUnique({
    where: { employeeId },
  });
  if (!config) return 0; // No config = no TDS (or use flat slab as fallback)

  // 1. Sum YTD gross from all PayrollLines for this FY
  const ytdGross = await sumYtdGross(employeeId, financialYear, month);

  // 2. Add previous-employment income
  const totalIncome = ytdGross + Number(config.previousEmploymentIncome);

  // 3. Apply regime-specific deductions
  let taxableIncome = totalIncome;
  if (config.regime === 'OLD') {
    taxableIncome -= Number(config.section80C);
    taxableIncome -= Number(config.section80D);
    taxableIncome -= Number(config.hraExemption);
    taxableIncome -= Number(config.section80CCD1B);
    taxableIncome -= Number(config.section24B);
    // Add standard deduction (₹50,000 for old regime)
    taxableIncome -= 50000;
  } else {
    // New regime: standard deduction only (₹50,000)
    taxableIncome -= 50000;
  }

  // 4. Apply slab rates + surcharge + cess
  const tax = computeTaxFromSlabs(taxableIncome, config.regime);

  // 5. Monthly TDS = (annual tax - YTD TDS already deducted) / remaining months
  const ytdTds = await sumYtdTds(employeeId, financialYear, month);
  const remainingMonths = 12 - month + 1;
  const monthlyTds = Math.max(0, (tax - ytdTds) / remainingMonths);

  return round(monthlyTds);
}

function computeTaxFromSlabs(taxableIncome: number, regime: string): number {
  // New regime slabs (FY 2024-25):
  // 0-3L: 0%, 3-7L: 5%, 7-10L: 10%, 10-12L: 15%, 12-15L: 20%, 15L+: 30%
  // Old regime slabs:
  // 0-2.5L: 0%, 2.5-5L: 5%, 5-10L: 20%, 10L+: 30%
  // + surcharge > 50L, + 4% cess
  // ...
}
```

**payrollCalculation.ts change:**
```ts
// Replace lines 196-199:
//   const tdsSlab = tdsSlabs.find(...);
//   const tds = tdsSlab ? round(grossEarnings * ...) : 0;
// With:
const tds = await calculateMonthlyTds(
  line.employeeId, companyId, grossEarnings, month, financialYear
);
```

**Verify:**
1. Set up employee with 80C = ₹150,000, old regime
2. Run payroll → TDS should be lower than flat slab lookup
3. Switch to new regime → TDS changes accordingly

### Step 4.4 — Recalculate statutory on ad-hoc entries (P1-15)

**Why:** Adding bonus/arrear/other incentive as ad-hoc doesn't recompute
PF/ESI/PT/TDS on the new total.

**Files:**
- Edit: `src/lib/payrollAdhoc.ts`
- Edit: `src/lib/bonusApply.ts`
- Edit: `src/lib/arrearApply.ts`

**Implementation:**
```ts
// In payrollAdhoc.ts, after creating the ad-hoc component:
export async function addAdhocComponent(payrollLineId: number, component: AdhocInput) {
  await prisma.payrollLineComponent.create({ data: { ...component, payrollLineId } });

  // Recalculate statutory based on new gross:
  await recalculateStatutory(payrollLineId);
}

async function recalculateStatutory(payrollLineId: number) {
  const line = await prisma.payrollLine.findUnique({
    where: { id: payrollLineId },
    include: { components: true },
  });
  const newGross = line.components
    .filter(c => c.type === 'EARNING')
    .reduce((sum, c) => sum + Number(c.amount), 0);

  // Re-run PF, ESI, PT, TDS on newGross (same logic as payrollCalculation)
  // Update PayrollLine with new statutory values + netSalary
}
```

**Verify:**
1. Add a bonus ad-hoc of ₹10,000 to a payroll line
2. PF, ESI, PT, TDS should increase based on the new gross
3. Net salary should reflect all deductions

### Step 4.5 — Add PT/TDS to arrears (P1-21)

**Why:** Arrears only compute PF/ESI adjustments, not PT/TDS.

**Files:**
- Edit: `src/lib/arrearCalculation.ts`

**Implementation:**
```ts
// In arrearCalculation.ts, after computing PF/ESI arrears:
const ptArrear = computePtArrear(oldGross, newGross, ptSlabs);
const tdsArrear = computeTdsArrear(oldGross, newGross, tdsSlabs);

// Store as SalaryArrearMonth fields:
await prisma.salaryArrearMonth.update({
  where: { id: arrearMonth.id },
  data: { ptArrear, tdsArrear },
});
```

**Verify:**
1. Create a retroactive salary revision
2. Arrear should include PT and TDS adjustments, not just PF/ESI

---

## Phase 5 — Payroll Outputs

> **Goal:** Generate the outputs needed to actually disburse salary and
> deliver payslips. Depends on Phase 4 (statutory values must be correct).

### Step 5.1 — Generate bank transfer file (P0-12)

**Files:**
- New: `src/app/api/payroll/runs/[id]/bank-transfer/route.ts`
- New: `src/app/payroll/outputs/bank-transfer/page.tsx`

**API implementation:**
```ts
// GET /api/payroll/runs/[id]/bank-transfer
export async function GET(request: NextRequest, { params }) {
  const scope = getCompanyId(request);
  if ('error' in scope) return scope.error;

  const run = await prisma.payrollRun.findFirst({
    where: { id: params.id, companyId: scope.companyId, status: 'LOCKED' },
  });
  if (!run) return NextResponse.json({ error: 'Locked run not found' }, { status: 404 });

  const lines = await prisma.payrollLine.findMany({
    where: { payrollRunId: run.id },
    include: {
      employee: { include: { bankDetails: true } },
    },
  });

  // Generate CSV (Kotak/ICICI format):
  const rows = lines.map(l => ({
    employeeCode: l.employee.employeeCode,
    employeeName: l.employee.fullName,
    accountNumber: l.employee.bankDetails?.accountNumber,
    ifsc: l.employee.bankDetails?.ifscCode,
    bankName: l.employee.bankDetails?.bankName,
    netSalary: l.netSalary,
  }));

  const csv = convertToCSV(rows);
  return new Response(csv, {
    headers: { 'Content-Type': 'text/csv', 'Content-Disposition': `attachment; filename="bank-transfer-${run.year}-${run.month}.csv"` },
  });
}
```

**Verify:**
1. Lock a payroll run
2. Open `/payroll/outputs/bank-transfer`
3. Select the locked run → download CSV
4. Verify CSV has all employees with account numbers and net pay

### Step 5.2 — Add payroll reopen/unlock (P1-16)

**Files:**
- New: `src/app/api/payroll/runs/[id]/reopen/route.ts`
- Edit: `src/lib/payrollGuard.ts`

**Implementation:**
```ts
// New route: POST /api/payroll/runs/[id]/reopen
export async function POST(request: NextRequest, { params }) {
  // Require special permission: payroll.run.reopen (superadmin only)
  const permErr = await checkSpecificPermission(request, 'payroll.run.reopen');
  if (permErr) return permErr;

  const run = await prisma.payrollRun.findUnique({ where: { id: params.id } });
  if (!run) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  if (run.status !== 'LOCKED') return NextResponse.json({ error: 'Only LOCKED runs can be reopened' }, { status: 409 });

  await prisma.payrollRun.update({
    where: { id: params.id },
    data: { status: 'APPROVED' },
  });

  // Log the reopen action in audit log:
  await logAdminAction(userId, 'PAYROLL_REOPEN', { runId: params.id });

  return NextResponse.json({ message: 'Run reopened' });
}
```

**Verify:**
1. Lock a run → status = LOCKED
2. Reopen → status = APPROVED
3. Non-superadmin → 403

### Step 5.3 — PDF payslip generation (P1-17)

**Files:**
- New: `src/app/api/payroll/runs/[id]/lines/[lineId]/payslip-pdf/route.ts`
- Install: `pdf-lib` or use `puppeteer`

**Implementation:**
```ts
import { PDFDocument, StandardFonts, rgb } from 'pdf-lib';

export async function GET(request: NextRequest, { params }) {
  const line = await prisma.payrollLine.findFirst({
    where: { id: params.lineId, payrollRunId: params.id },
    include: { employee: true, components: true, payrollRun: true },
  });
  if (!line) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  const pdf = await generatePayslipPdf(line);
  return new Response(pdf, {
    headers: { 'Content-Type': 'application/pdf', 'Content-Disposition': `attachment; filename="payslip-${line.employee.employeeCode}.pdf"` },
  });
}
```

**Verify:**
1. Open payslip page → download PDF
2. PDF should show earnings, deductions, net pay, employer PF/ESI

### Step 5.4 — Full & Final Settlement (P1-18)

**Files:**
- New: `prisma/schema.prisma` (FullAndFinalSettlement model)
- New: `src/app/api/payroll/full-and-final/route.ts`
- New: `src/app/payroll/processing/full-and-final/page.tsx`

**Schema:**
```prisma
model FullAndFinalSettlement {
  id              Int @id @default(autoincrement())
  employeeId      Int @unique
  exitDate        DateTime
  leaveEncashment Decimal @default(0) @db.Decimal(18, 2)
  noticePay       Decimal @default(0) @db.Decimal(18, 2)
  gratuityAmount  Decimal @default(0) @db.Decimal(18, 2)
  bonusAmount     Decimal @default(0) @db.Decimal(18, 2)
  arrearAmount    Decimal @default(0) @db.Decimal(18, 2)
  totalEarnings   Decimal @default(0) @db.Decimal(18, 2)
  totalDeductions Decimal @default(0) @db.Decimal(18, 2)
  netPayable      Decimal @default(0) @db.Decimal(18, 2)
  status          String @default('PENDING') @db.NVarChar(20)
  approvedByUserId Int?
  approvedAt      DateTime?
  createdAt       DateTime @default(now())
  updatedAt       DateTime @updatedAt
  employee        Employee @relation(fields: [employeeId], references: [id])
}
```

### Step 5.5 — PMS incentive amount calculation (P1-19)

**Files:**
- Edit: `prisma/schema.prisma` (PmsIncentive model — add `amount` field)
- Edit: `src/app/api/payroll/pms/route.ts`
- Edit: `src/app/payroll/processing/pms-incentive/page.tsx`

**Implementation:**
```ts
// On approval, compute amount:
const employee = await prisma.employee.findUnique({
  where: { id: incentive.employeeId },
  include: { jobInfo: { include: { currentSalaryRevision: true } } },
});
const baseSalary = Number(employee.jobInfo.currentSalaryRevision.grossSalary);
const amount = round(baseSalary * (incentive.managerPercent + incentive.companyPercent) / 100);

await prisma.pmsIncentive.update({
  where: { id: incentive.id },
  data: { amount, status: 'APPROVED' },
});

// Auto-push as earning line into the current payroll run:
await addAdhocComponent(payrollLineId, {
  code: 'PMS',
  name: 'PMS Incentive',
  type: 'EARNING',
  amount,
});
```

---

## Phase 6 — Auth Hardening

> **Goal:** Close auth security gaps. Depends on Phase 1 (middleware).

### Step 6.1 — Password reset flow (P1-1)

**Schema:**
```prisma
model PasswordResetToken {
  id        Int @id @default(autoincrement())
  userId    Int
  token     String @unique @db.NVarChar(64)
  expiresAt DateTime
  usedAt    DateTime?
  user      User @relation(fields: [userId], references: [id])
}
```

**Routes:**
- `POST /api/auth/forgot-password` — generate token, send email
- `POST /api/auth/reset-password` — verify token, set new password

### Step 6.2 — Brute-force protection (P1-4)

**Schema:**
```prisma
// Add to User model:
failedLoginAttempts Int @default(0)
lockedUntil         DateTime?
```

**Implementation in login route:**
```ts
// Before bcrypt compare:
if (user.lockedUntil && user.lockedUntil > new Date()) {
  return NextResponse.json({ error: 'Account locked. Try again later.' }, { status: 423 });
}

// After failed compare:
await prisma.user.update({
  where: { id: user.id },
  data: {
    failedLoginAttempts: { increment: 1 },
    lockedUntil: user.failedLoginAttempts + 1 >= 5 ? new Date(Date.now() + 15 * 60 * 1000) : null,
  },
});

// After successful login:
await prisma.user.update({
  where: { id: user.id },
  data: { failedLoginAttempts: 0, lockedUntil: null },
});
```

### Step 6.3 — Session revocation (P1-3)

**Schema:**
```prisma
model Session {
  id        Int @id @default(autoincrement())
  userId    Int
  tokenHash String @unique @db.NVarChar(64)
  revokedAt DateTime?
  expiresAt DateTime
  user      User @relation(fields: [userId], references: [id])
}
```

**Implementation:**
- On login: store token hash in Session table
- In middleware: check Session.revokedAt is null
- On logout: set `revokedAt = now()`

### Step 6.4 — Admin audit log (P1-5)

**Schema:**
```prisma
model AdminAuditLog {
  id        Int @id @default(autoincrement())
  userId    Int
  action    String @db.NVarChar(50)
  entityType String? @db.NVarChar(50)
  entityId  Int?
  metadata  Json?
  ipAddress String? @db.NVarChar(45)
  createdAt DateTime @default(now())
  user      User @relation(fields: [userId], references: [id])
}
```

**Implementation:**
- Create `src/lib/auditLog.ts` with `logAdminAction(userId, action, entity)`
- Call in every admin/auth API route after the action succeeds

### Step 6.5 — 2FA / MFA (P1-2)

**Install:** `otplib`
**Schema:** Add `twoFactorSecret` and `twoFactorEnabled` to User model
**Routes:** `/api/auth/2fa/setup`, `/api/auth/2fa/verify`

---

## Phase 7 — RBAC & UI Gaps

> **Goal:** Fix menu visibility, add missing UI, fix dashboard. Depends on
> Phase 2 (company scoping).

### Step 7.1 — Role-based menu filtering (P1-6)

**Files:**
- Edit: `src/components/layout/Sidebar.tsx`

**Implementation:**
```tsx
// Filter navigation before rendering:
const visibleModules = useMemo(() => {
  return navigation.filter(mod => {
    if (mod.label === 'Superadmin') return me?.isSuperAdmin;
    if (mod.label === 'Administration') return me?.hasAdminAccess;
    // For other modules, check if any ready leaf has permission
    return mod.groups.some(group =>
      group.items.some(item => {
        if (!item.ready) return false;
        // Map href to permission code and check
        return hasPermissionForRoute(item.href);
      })
    );
  });
}, [me]);
```

### Step 7.2 — Fix CTC RBAC bypass (P1-20)

**Files:**
- Edit: `src/lib/rbac-employee.ts`

**Implementation:**
```ts
// Add to PATH_RULES array (before the generic /api/employees rule):
{
  test: (p) => /^\/api\/employees\/[^/]+\/ctc(\/|\?|$)/.test(p),
  codes: { view: 'employee.ctc.view', edit: 'employee.ctc.edit' },
},
```

### Step 7.3 — Add Documents tab to Employee Master (P1-7)

**Files:**
- Edit: `src/app/api/employees/[id]/documents/route.ts` (add GET)
- New: `src/app/api/employees/[id]/documents/upload/route.ts`
- Edit: `src/app/employees/[id]/page.tsx` (add Documents tab)

### Step 7.4 — Wire dashboard to real APIs (P0-13, P0-14)

**Files:**
- Edit: `src/app/api/stats/[module]/route.ts` (fix prisma.payroll bug)
- Edit: `src/app/page.tsx` (replace static data imports)
- Delete: `src/components/dashboard/data.ts`

---

## Phase 8 — Employee Master Fixes

> **Goal:** Fix employee CRUD bugs. Depends on Phase 2.

### Step 8.1 — Atomic employee code generation (P1-8)

**Files:**
- Edit: `src/app/api/employees/route.ts`

**Implementation:**
```ts
// Use a transaction with SELECT FOR UPDATE, or a DB sequence:
const code = await prisma.$transaction(async (tx) => {
  const counter = await tx.$queryRaw`
    UPDATE EmployeeCodeCounter SET nextValue = nextValue + 1
    OUTPUT INSERTED.nextValue
  `;
  return `EMP${String(counter[0].nextValue).padStart(3, '0')}`;
});
```

### Step 8.2 — Validate masters belong to company (P1-9)

**Files:**
- Edit: `src/app/api/employees/route.ts` (POST)
- Edit: `src/app/api/employees/[id]/basic/route.ts` (PUT)

**Implementation:**
```ts
// After parsing body, before create:
const dept = await prisma.department.findFirst({
  where: { id: parsed.data.departmentId, companyId, deletedAt: null },
});
if (!dept) return NextResponse.json({ error: 'Invalid department for company' }, { status: 400 });
// Repeat for designationId, employeeTypeId, categoryId, unitId, etc.
```

### Step 8.3 — Separation sets isActive: false (P1-10)

**Files:**
- Edit: `src/app/api/employees/[id]/exit/route.ts`

**Implementation:**
```ts
await prisma.employee.update({
  where: { id: params.id },
  data: {
    status: exitType === 'termination' ? 'terminated' : 'resigned',
    isActive: false,
  },
});
```

---

## Phase 9 — Reports & Company Model

> **Goal:** Build statutory reports and extend Company model. Depends on
> Phase 4 (statutory values must be computed first).

### Step 9.1 — Extend Company model with statutory fields (P1-22)

**Schema:**
```prisma
// Add to Company model:
tan                  String? @db.NVarChar(20)
pan                  String? @db.NVarChar(20)
pfEstablishmentCode  String? @db.NVarChar(20)
esiEstablishmentCode String? @db.NVarChar(20)
addressLine1          String? @db.NVarChar(200)
addressLine2          String? @db.NVarChar(200)
city                  String? @db.NVarChar(100)
state                 String? @db.NVarChar(100)
pincode               String? @db.NVarChar(20)
```

### Step 9.2 — Build priority reports (P0-15)

**Priority order:**
1. Headcount report — `GET /api/reports/employee/headcount`
2. Salary statement — `GET /api/reports/payroll/salary-statement`
3. PF report (ECR format) — `GET /api/reports/statutory/pf`
4. ESI report — `GET /api/reports/statutory/esi`
5. TDS report (Form 24Q) — `GET /api/reports/statutory/tds`
6. Bank statement — `GET /api/reports/finance/salary-to-bank`

**Pattern for each:**
```ts
// src/app/api/reports/<category>/<name>/route.ts
export async function GET(request: NextRequest) {
  const scope = getCompanyId(request);
  if ('error' in scope) return scope.error;
  // Check report permission
  // Query data filtered by companyId + date range params
  // Return JSON
}
```

---

## Migration & Deployment Checklist

After each phase, run:
```bash
# 1. Generate Prisma Client
npx prisma generate

# 2. Run migration (if schema changed)
npx prisma migrate dev --name <descriptive_name>

# 3. Build check
npm run build

# 4. Run tests
npm test

# 5. Clear Next.js cache
rm -rf .next

# 6. Restart dev server
npm run dev
```

---

## Effort Estimates

| Phase | Fixes | Complexity | Est. Effort |
|-------|-------|------------|-------------|
| Phase 1 | 3 | Low | 1-2 hours |
| Phase 2 | 3 | Medium (18+ routes) | 4-6 hours |
| Phase 3 | 5 | Medium-High | 6-8 hours |
| Phase 4 | 5 | High (new engine) | 12-16 hours |
| Phase 5 | 5 | Medium-High | 8-12 hours |
| Phase 6 | 5 | Medium | 6-8 hours |
| Phase 7 | 4 | Medium | 4-6 hours |
| Phase 8 | 3 | Low-Medium | 2-4 hours |
| Phase 9 | 2 | Medium | 4-6 hours |
| **Total** | **37** | | **47-68 hours** |

---

## Dependency Graph

```
Phase 1 (Security)
  ├── Phase 2 (Tenant Isolation)
  │     ├── Phase 3 (Attendance/Payroll Accuracy)
  │     │     └── Phase 4 (Statutory Engine)
  │     │           └── Phase 5 (Payroll Outputs)
  │     ├── Phase 7 (RBAC & UI)
  │     └── Phase 8 (Employee Master)
  └── Phase 6 (Auth Hardening)
              └── Phase 9 (Reports)
```

**Critical path:** Phase 1 → 2 → 3 → 4 → 5 (statutory payroll pipeline)

---

## Quick Wins (Can do immediately, no dependencies)

1. **P0-1** — Create `src/middleware.ts` (1 line)
2. **P0-2** — Move superadmin creds to env vars (5 lines)
3. **P0-3** — Remove JWT fallback secret (4 lines)
4. **P0-14** — Fix `prisma.payroll` → `prisma.payrollRun` (3 lines)
5. **P1-10** — Separation sets `isActive: false` (1 line)
6. **P1-20** — Add CTC path rule to rbac-employee.ts (4 lines)
