# HRMS Bug Fix Report — 2026-09-10

Comprehensive fix plan for all gaps identified in the end-to-end gap analysis.
Each fix includes: root cause, affected files, fix steps, and verification.

---

## P0 — CRITICAL (Must fix before go-live)

### P0-1: proxy.ts not registered as Next.js middleware

**Root cause:** `src/proxy.ts` exports a middleware function and `config`, but
Next.js only loads middleware from `src/middleware.ts`. Without it, JWT
verification and header injection (`x-user-id`, `x-company-id`, `x-role-id`)
never run — any client can spoof any tenant/role/user.

**Affected files:**
- `src/proxy.ts` (the middleware logic)
- `src/middleware.ts` (MISSING)

**Fix:**
```bash
# Create src/middleware.ts that re-exports proxy
```
```ts
// src/middleware.ts
export { default, config } from './proxy';
```

**Verification:**
- `npm run dev` — hit any `/api/*` route without a cookie → should get 401
- Check headers are injected: log `request.headers.get('x-company-id')` in any
  API route — should show the JWT-derived company, not null

---

### P0-2: Hardcoded superadmin credentials

**Root cause:** `seed-superadmin/route.ts:20-21` hardcodes
`superadmin@suki.hrms` / `superadmin123`. Anyone reading the repo gets admin
access.

**Affected files:**
- `src/app/api/auth/seed-superadmin/route.ts:20-21`

**Fix:**
```ts
// Replace lines 20-21:
const SUPERADMIN_EMAIL = process.env.SUPERADMIN_EMAIL;
const SUPERADMIN_DEFAULT_PASSWORD = process.env.SUPERADMIN_PASSWORD;
if (!SUPERADMIN_EMAIL || !SUPERADMIN_DEFAULT_PASSWORD) {
  return NextResponse.json({ error: 'SUPERADMIN_EMAIL and SUPERADMIN_PASSWORD env vars required' }, { status: 500 });
}
```
Add to `.env` (never commit):
```
SUPERADMIN_EMAIL=superadmin@suki.hrms
SUPERADMIN_PASSWORD=<strong-random-password>
```

**Verification:** Seed without env vars → 500. Seed with env vars → works.

---

### P0-3: Hardcoded JWT fallback secret

**Root cause:** `jwt.ts:14,53` falls back to `'suki-hrms-super-secret-jwt-key'`
if `JWT_SECRET` is unset. In production, this is a known secret in source code.

**Affected files:**
- `src/lib/jwt.ts:14,53`

**Fix:**
```ts
// Replace both occurrences:
const secret = process.env.JWT_SECRET;
if (!secret) throw new Error('JWT_SECRET environment variable is required');
```

**Verification:** Start server without `JWT_SECRET` → crash on boot. With it →
works.

---

### P0-4: Employee API routes lack company scoping (IDOR)

**Root cause:** Most per-tab employee API routes (`basic`, `contact`,
`salary`, `kyc`, `passport`, `education`, `experience`, `dependents`,
`emergency-contacts`, `skills`, `assets`, `ctc`, `exit`, `reactivate`,
`confirmation/*`, `activity`, `export`, `separations`) fetch by `id` only,
without verifying the employee belongs to the caller's company.

**Affected files:**
- `src/app/api/employees/[id]/basic/route.ts`
- `src/app/api/employees/[id]/contact/route.ts`
- `src/app/api/employees/[id]/salary/route.ts`
- `src/app/api/employees/[id]/ctc/route.ts`
- `src/app/api/employees/[id]/kyc/route.ts`
- `src/app/api/employees/[id]/passport/route.ts`
- `src/app/api/employees/[id]/education/route.ts`
- `src/app/api/employees/[id]/experience/route.ts`
- `src/app/api/employees/[id]/dependents/route.ts`
- `src/app/api/employees/[id]/emergency-contacts/route.ts`
- `src/app/api/employees/[id]/skills/route.ts`
- `src/app/api/employees/[id]/assets/route.ts`
- `src/app/api/employees/[id]/exit/route.ts`
- `src/app/api/employees/[id]/reactivate/route.ts`
- `src/app/api/employees/[id]/confirmation/*.ts`
- `src/app/api/employees/activity/route.ts`
- `src/app/api/employees/export/route.ts`
- `src/app/api/employees/separations/route.ts`

**Fix pattern (apply to each route):**
```ts
import { getCompanyId } from '@/lib/companyScope';

// At the top of each handler, after permission check:
const companyId = getCompanyId(request);
if (!companyId) return NextResponse.json({ error: 'Company context required' }, { status: 403 });

// Before fetching the employee, verify company ownership:
const employee = await prisma.employee.findFirst({
  where: { id: params.id, companyId },
});
if (!employee) return NextResponse.json({ error: 'Not found' }, { status: 404 });
```

For list routes (`activity`, `export`, `separations`), add `companyId` to the
`where` clause:
```ts
const where = { companyId, ...existingFilters };
```

**Verification:** Log in as company A user, try to GET `/api/employees/<company-B-employee-id>/basic` → 404.

---

### P0-5: POST /api/employees trusts body.companyId

**Root cause:** `route.ts:127-129` reads `body.companyId` directly from the
request body instead of from the session header.

**Affected files:**
- `src/app/api/employees/route.ts:127-129`

**Fix:**
```ts
import { getCompanyId } from '@/lib/companyScope';

// Replace:
//   companyId: body.companyId,
// With:
const companyId = getCompanyId(request);
if (!companyId) return NextResponse.json({ error: 'Company context required' }, { status: 403 });
// Use companyId from session, not body
```

**Verification:** POST with a different `companyId` in body → employee is
created under the caller's actual company.

---

### P0-6: Company scoping missing for Unit, Holiday, BenefitRate masters

**Root cause:** These routes read `companyId` from the request body/query
instead of the session header, allowing cross-tenant access.

**Affected files:**
- `src/app/api/masters/units/route.ts:14-43`
- `src/app/api/masters/units/[id]/route.ts:25-32`
- `src/app/api/masters/holidays/route.ts:13-47`
- `src/app/api/masters/holidays/[id]/route.ts`
- `src/app/api/masters/benefit-rates/route.ts:12-52`
- `src/app/api/masters/benefit-rates/[id]/route.ts`

**Fix:**
```ts
import { getCompanyId } from '@/lib/companyScope';

// In GET: filter by session company
const companyId = getCompanyId(request);
const where = { companyId, deletedAt: null, ...searchFilters };

// In POST/PUT: use session company, ignore body.companyId
const companyId = getCompanyId(request);
const data = { ...parsed.body, companyId };
```

**Verification:** GET units as company A → only company A's units appear.

---

### P0-7: Payroll payableDays uses calendar days, ignores Absent

**Root cause:** `finalize/route.ts:58` sets `totalWorkingDays = daysInMonth()`
(all calendar days). `payableDays = totalWorkingDays - lopDays`. Absent,
MissingPunch, and HalfDay do NOT reduce payable days — only explicit LOP does.
This overpays employees.

**Affected files:**
- `src/app/api/workforce/attendance/monthly/finalize/route.ts:58-90`
- `src/lib/payrollCalculation.ts:127,130-146`

**Fix (finalize/route.ts):**
```ts
// Replace:
const totalWorkingDays = daysInMonth(year, month);
// With:
const totalWorkingDays = workingDaysInMonth(year, month, holidays, weeklyOffs);

// Replace:
if (d.status === 'Absent') absentDays += 1;
// With:
if (d.status === 'Absent') absentDays += 1;
if (d.status === 'MissingPunch') absentDays += 1;
if (d.status === 'HalfDay') halfDays += 0.5;

// Replace:
payableDays = totalWorkingDays - lopDays;
// With:
payableDays = totalWorkingDays - lopDays - absentDays - halfDays;
```

**Fix (payrollCalculation.ts):**
```ts
// Replace:
const lopFactor = totalWorkingDays > 0 ? payableDays / totalWorkingDays : 1;
// This is already correct IF payableDays is now computed correctly above.
// Just ensure the attendance summary feeds the right numbers.
```

**Verification:** Create an employee with 5 Absent days in a 30-day month.
Finalize → `payableDays` should be 25 (or less if holidays), not 30.

---

### P0-8: No Absent generation for missing biometric days

**Root cause:** `biometricSync.ts:14-17` documents: "Only days the device
reports are written. Absent days for people with no punches are not created."
When the month is finalized, those days are simply missing, so `absentDays`
stays 0 and payroll treats them as payable.

**Affected files:**
- `src/lib/biometricSync.ts` (add post-sync absent generation)
- `src/app/api/workforce/attendance/monthly/finalize/route.ts` (add absent
  generation before counting)

**Fix (in finalize/route.ts, before counting):**
```ts
// Before counting statuses, generate Absent rows for missing expected-work days:
const activeEmployees = await prisma.employee.findMany({
  where: { companyId, isActive: true, deletedAt: null },
  select: { id: true },
});

for (const emp of activeEmployees) {
  for (let day = 1; day <= daysInMonth(year, month); day++) {
    const date = new Date(Date.UTC(year, month, day));
    // Skip weekly offs and holidays for this employee's shift
    if (isWeeklyOff(date, emp.shift) || isHoliday(date, holidays)) continue;

    const existing = await prisma.dailyAttendance.findUnique({
      where: { employeeId_date: { employeeId: emp.id, date } },
    });
    if (!existing) {
      await prisma.dailyAttendance.create({
        data: { employeeId: emp.id, date, status: 'Absent', source: 'SYSTEM' },
      });
    }
  }
}
```

**Verification:** Sync biometric for an employee who was absent all week.
Finalize → those days show as `Absent`, not missing.

---

### P0-9: Daily attendance PUT bypasses history and summary refresh

**Root cause:** `daily/[id]/route.ts:56` does a direct
`prisma.dailyAttendance.update()` without calling
`upsertDailyAttendanceWithHistory`, without recomputing workingMinutes/late/OT,
and without `refreshMonthlySummary`. Manual edits silently corrupt data and
leave monthly summaries stale.

**Affected files:**
- `src/app/api/workforce/attendance/daily/[id]/route.ts:54-71`

**Fix:**
```ts
import { upsertDailyAttendanceWithHistory } from '@/lib/attendanceHistory';
import { refreshMonthlySummary } from '@/lib/attendanceFreeze';

// Replace the direct update:
//   const record = await prisma.dailyAttendance.update({ where: { id }, data });
// With:
const record = await upsertDailyAttendanceWithHistory({
  employeeId: existing.employeeId,
  date: existing.date,
  ...parsed.data,
  source: 'MANUAL_EDIT',
  updatedByUserId: request.headers.get('x-user-id'),
});

await refreshMonthlySummary(existing.employeeId, existing.date);
```

**Verification:** Edit a daily attendance row → check
`DailyAttendanceHistory` has a snapshot of the old values. Check
`MonthlyAttendanceSummary` reflects the change.

---

### P0-10: TDS is flat monthly slab lookup, not annual computation

**Root cause:** `payrollCalculation.ts:19-21,196-199` does a simple slab
lookup on monthly gross. No regime selection (old/new), no exemptions (80C,
80D, HRA, etc.), no deductions, no surcharge, no cess, no previous-employment
income, no PAN validation, no Form 16.

**Affected files:**
- `src/lib/payrollCalculation.ts:19-21,196-199`
- `prisma/schema.prisma` (TDSSlab model — needs replacement/augmentation)
- New file: `src/lib/tdsCalculation.ts`

**Fix (new TDS engine):**
```ts
// src/lib/tdsCalculation.ts
export async function calculateAnnualTax(
  employeeId: number,
  financialYear: number,
  regime: 'OLD' | 'NEW',
  previousEmploymentIncome: number,
  exemptions: { section80C: number; section80D: number; hraExemption: number; ... },
) {
  // 1. Sum all gross earnings for the FY from PayrollLine
  // 2. Add previous-employment income
  // 3. Apply regime-specific deductions/exemptions
  // 4. Compute taxable income
  // 5. Apply slab rates + surcharge + cess
  // 6. Return annual tax + monthly TDS deduction
}
```

Schema additions needed:
```prisma
model EmployeeTaxConfig {
  id              Int      @id @default(autoincrement())
  employeeId      Int      @unique
  regime          String   @default('NEW') // 'OLD' | 'NEW'
  previousEmploymentIncome Decimal @default(0)
  section80C      Decimal  @default(0)
  section80D      Decimal  @default(0)
  hraExemption    Decimal  @default(0)
  otherExemptions Json?
  employee        Employee @relation(fields: [employeeId], references: [id])
}
```

**Verification:** Set up an employee with 80C investments. Run payroll → TDS
should be lower than the flat slab lookup.

---

### P0-11: Employer PF/ESI contributions not computed or stored

**Root cause:** `payrollCalculation.ts:161-185` only computes employee PF/ESI
deductions. `PfRate` and `EsiRate` schemas have employer fields
(`employerContributionRate`, `pensionRate`, etc.) but the calculator never uses
them. `PayrollLine` has no employer-contribution columns.

**Affected files:**
- `src/lib/payrollCalculation.ts:161-185`
- `prisma/schema.prisma` (PayrollLine model — add employer columns)

**Fix (payrollCalculation.ts):**
```ts
// After computing employee PF:
if (pfApplicable && pfRate) {
  const pfWage = Math.min(grossEarnings, Number(pfRate.wageCeilingMonthly));
  pfEmployee = round(pfWage * (Number(pfRate.employeeContributionRate) / 100));
  // ADD:
  pfEmployer = round(pfWage * (Number(pfRate.employerContributionRate) / 100));
  pfPension = round(pfWage * (Number(pfRate.pensionRate) / 100));
}

// After computing employee ESI:
if (esiApplicable && esiRate) {
  esiEmployee = round(grossEarnings * (Number(esiRate.employeeContributionRate) / 100));
  // ADD:
  esiEmployer = round(grossEarnings * (Number(esiRate.employerContributionRate) / 100));
}
```

Schema addition:
```prisma
// Add to PayrollLine model:
employerPf        Decimal? @db.Decimal(12, 2)
employerEsi        Decimal? @db.Decimal(12, 2)
pensionContribution Decimal? @db.Decimal(12, 2)
```

**Verification:** Run payroll → PayrollLine should have non-zero
`employerPf` and `employerEsi` for eligible employees.

---

### P0-12: No bank transfer file generation

**Root cause:** Navigation advertises `/payroll/outputs/bank-transfer` but no
page or API exists. After payroll is locked, there's no way to generate the
bank advice file for salary disbursement.

**Affected files:**
- New: `src/app/payroll/outputs/bank-transfer/page.tsx`
- New: `src/app/api/payroll/runs/[id]/bank-transfer/route.ts`

**Fix (API):**
```ts
// src/app/api/payroll/runs/[id]/bank-transfer/route.ts
export async function GET(request: NextRequest, { params }) {
  // 1. Verify run is LOCKED
  // 2. Fetch all PayrollLines with employee bank details
  // 3. Generate bank advice file (CSV/Excel/TEXT per bank format)
  //    - Employee name, account number, IFSC, net pay
  // 4. Return as downloadable file
  const lines = await prisma.payrollLine.findMany({
    where: { payrollRunId: runId },
    include: { employee: { include: { bankDetails: true } } },
  });
  // Generate CSV/Excel...
}
```

**Fix (UI):**
```tsx
// src/app/payroll/outputs/bank-transfer/page.tsx
// - Select a locked payroll run
// - Preview the bank transfer list
// - Download button → calls API → downloads file
```

**Verification:** Lock a payroll run → open bank transfer page → download
file → verify it contains all employees with their bank details and net pay.

---

### P0-13: Dashboard is fully static mock data

**Root cause:** `src/components/dashboard/data.ts:1-80` contains hardcoded
arrays. `src/app/page.tsx` imports from `data.ts` instead of calling real APIs.
The dashboard shows fake numbers.

**Affected files:**
- `src/app/page.tsx`
- `src/components/dashboard/data.ts` (delete or replace)
- `src/components/dashboard/StatCard.tsx`
- `src/components/dashboard/AttendanceChart.tsx`
- `src/components/dashboard/LeaveApplications.tsx`
- `src/components/dashboard/AwardTable.tsx`
- `src/components/dashboard/NoticeBoard.tsx`

**Fix:**
```tsx
// src/app/page.tsx — replace static imports with API calls
'use client';
import { useEffect, useState } from 'react';

export default function DashboardPage() {
  const [stats, setStats] = useState(null);
  useEffect(() => {
    fetch('/api/stats/employees').then(r => r.json()).then(setStats);
  }, []);
  // Pass real data to StatCard, AttendanceChart, etc.
}
```

**Verification:** Dashboard should show real employee count, real attendance
percentage, real leave applications — not hardcoded numbers.

---

### P0-14: Stats API uses non-existent prisma.payroll model

**Root cause:** `stats/[module]/route.ts:123-125` calls `prisma.payroll.count()`
but the schema model is `PayrollRun` (accessed as `prisma.payrollRun`). Also no
company scoping and creates a new PrismaClient per request.

**Affected files:**
- `src/app/api/stats/[module]/route.ts:1-85`

**Fix:**
```ts
import { prisma } from '@/lib/prisma'; // reuse shared client
import { getCompanyId } from '@/lib/companyScope';

// Replace:
//   const total = await prisma.payroll.count();
//   const processed = await prisma.payroll.count({ where: { status: 'PROCESSED' } });
// With:
const companyId = getCompanyId(request);
const total = await prisma.payrollRun.count({ where: { companyId } });
const processed = await prisma.payrollRun.count({
  where: { companyId, status: 'APPROVED' } // or LOCKED
});
const pending = await prisma.payrollRun.count({
  where: { companyId, status: { in: ['DRAFT', 'CALCULATED'] } },
});
```

**Verification:** `GET /api/stats/payroll` → returns real counts, no 500
error.

---

### P0-15: Only 1 of 30 reports implemented

**Root cause:** Only Professional Tax report exists. All other `/reports/*`
routes fall through to the placeholder page.

**Affected files (new files needed):**
- `src/app/api/reports/employee/summary/route.ts`
- `src/app/api/reports/employee/kyc/route.ts`
- `src/app/api/reports/employee/headcount/route.ts`
- `src/app/api/reports/attendance/statement/route.ts`
- `src/app/api/reports/attendance/overtime/route.ts`
- `src/app/api/reports/payroll/salary-statement/route.ts`
- `src/app/api/reports/payroll/bank-statement/route.ts`
- `src/app/api/reports/statutory/pf/route.ts`
- `src/app/api/reports/statutory/esi/route.ts`
- `src/app/api/reports/statutory/tds/route.ts`
- `src/app/api/reports/finance/salary-to-bank/route.ts`
- `src/app/api/reports/finance/quarterly-tds/route.ts`
- ...and corresponding UI pages

**Fix pattern (per report):**
```ts
// src/app/api/reports/<category>/<name>/route.ts
export async function GET(request: NextRequest) {
  const companyId = getCompanyId(request);
  // Check report permission
  // Query data filtered by companyId + date range
  // Return JSON for the UI to render
}
```

**Priority order:**
1. Headcount report (employee count by dept)
2. Salary statement (monthly payroll summary)
3. PF report (ECR format)
4. ESI report (monthly contribution)
5. TDS report (quarterly Form 24Q)
6. Bank statement (salary to bank)

**Verification:** Each report page loads with real data, not placeholder.

---

## P1 — HIGH (Core flow incomplete)

### P1-1: No password reset / forgot password

**Fix:**
```prisma
model PasswordResetToken {
  id        Int      @id @default(autoincrement())
  userId    Int
  token     String   @unique
  expiresAt DateTime
  usedAt    DateTime?
  user      User     @relation(fields: [userId], references: [id])
}
```
New routes: `/api/auth/forgot-password` (send email), `/api/auth/reset-password`
(verify token + set new password). Requires email service integration.

---

### P1-2: No 2FA / MFA

**Fix:** Add TOTP using `otplib`. Add `twoFactorSecret` and `twoFactorEnabled`
to `User` model. New routes: `/api/auth/2fa/setup`, `/api/auth/2fa/verify`.

---

### P1-3: No session revocation

**Fix:** Store issued JWTs in a `Session` table with `revokedAt`. Check
revocation on every request in middleware. Logout sets `revokedAt = now()`.

---

### P1-4: No brute-force protection

**Fix:** Add `failedLoginAttempts` and `lockedUntil` to `User`. Increment on
failed login, lock after 5 attempts for 15 minutes. Add rate limiting via
middleware or `@upstash/ratelimit`.

---

### P1-5: No audit log for auth/admin actions

**Fix:**
```prisma
model AdminAuditLog {
  id        Int      @id @default(autoincrement())
  userId    Int
  action    String   // 'LOGIN', 'LOGOUT', 'USER_CREATE', 'ROLE_UPDATE', etc.
  entityType String?
  entityId  Int?
  metadata  Json?
  ipAddress String?
  createdAt DateTime @default(now())
  user      User     @relation(fields: [userId], references: [id])
}
```
Log in every admin/auth API route after the action succeeds.

---

### P1-6: No role-based menu visibility

**Affected:** `src/components/layout/Sidebar.tsx:51-60`

**Fix:**
```tsx
// Filter navigation by permission before rendering
const visibleModules = navigation.filter(mod => {
  if (mod.label === 'Superadmin') return isSuperAdmin;
  if (mod.label === 'Administration') return hasAdminAccess;
  // For all other modules, check if any leaf has permission
  return mod.groups.some(group =>
    group.items.some(item =>
      item.ready && hasPermission(item.href, 'view') // or permission code
    )
  );
});
```

---

### P1-7: No Documents tab in Employee Master

**Affected:**
- `src/app/api/employees/[id]/documents/route.ts` (add GET)
- `src/app/employees/[id]/page.tsx` (add Documents tab)

**Fix:** Add GET route that lists documents. Add file upload endpoint using
`multipart/form-data` with storage to local/S3. Add Documents tab to the
profile page.

---

### P1-8: Employee code generation is non-atomic

**Affected:** `src/app/api/employees/route.ts:107-118`

**Fix:** Use a DB sequence or a transaction with `SELECT ... FOR UPDATE`:
```ts
// Option 1: DB sequence (preferred)
const result = await prisma.$queryRaw`SELECT NEXT VALUE FOR EmployeeCodeSeq`;
// Option 2: Atomic upsert with retry
const code = `EMP${String(nextNum).padStart(3, '0')}`;
```

---

### P1-9: No validation that masters belong to chosen company

**Fix:** In POST/PUT employee routes, after parsing the body, verify each
master ID belongs to the same company:
```ts
const dept = await prisma.department.findFirst({
  where: { id: body.departmentId, companyId, deletedAt: null },
});
if (!dept) return NextResponse.json({ error: 'Invalid department for company' }, { status: 400 });
```

---

### P1-10: Separation does not set isActive: false

**Affected:** `src/app/api/employees/[id]/exit/route.ts:53-57`

**Fix:**
```ts
// After updating status:
await prisma.employee.update({
  where: { id: params.id },
  data: {
    status: exitType === 'termination' ? 'terminated' : 'resigned',
    isActive: false,  // ADD THIS
    deletedAt: new Date(), // optional: soft-delete
  },
});
```

---

### P1-11: OT approval bypasses history and summary refresh

**Affected:** `src/app/api/workforce/attendance/ot/[id]/approve/route.ts:55,85,98`

**Fix:** Replace direct `prisma.dailyAttendance.update` with
`upsertDailyAttendanceWithHistory` and call `refreshMonthlySummary`:
```ts
import { upsertDailyAttendanceWithHistory } from '@/lib/attendanceHistory';
import { refreshMonthlySummary } from '@/lib/attendanceFreeze';

const updated = await upsertDailyAttendanceWithHistory({
  employeeId: record.employeeId,
  date: record.date,
  otMinutesApproved: approvedMinutes,
  otSettlementType: settlementType,
  source: 'OT_APPROVAL',
});
await refreshMonthlySummary(record.employeeId, record.date);
```

---

### P1-12: Leave approve/cancel bypass history helper

**Affected:**
- `src/app/api/workforce/leave/applications/[id]/approve/route.ts:89-95`
- `src/app/api/workforce/leave/applications/[id]/cancel/route.ts:62-69`

**Fix:** Route all daily attendance writes through
`upsertDailyAttendanceWithHistory` and call `refreshMonthlySummary` after.

---

### P1-13: PF/ESI wage basis is full gross

**Affected:** `src/lib/payrollCalculation.ts:15-18,161-185`

**Fix:** Add `includeInPf`, `includeInEsi`, `includeInPt` boolean flags to
`SalaryComponent` model. Then:
```ts
const pfWageComponents = await prisma.salaryComponent.findMany({
  where: { companyId, includeInPf: true, isActive: true },
});
const pfWage = sum of payroll line components where component is in pfWageComponents
```

---

### P1-14: PF/ESI/PT/TDS masters are global, not company-scoped

**Fix:** Add `companyId` to `PfRate`, `EsiRate`, `ProfessionalTaxSlab`,
`TDSSlab` models. Update all queries in `payrollCalculation.ts` to filter by
`companyId`.

---

### P1-15: Ad-hoc entries don't trigger statutory recalculation

**Affected:** `src/lib/payrollAdhoc.ts:11-17`

**Fix:** After adding ad-hoc components, re-run the statutory calculation:
```ts
// In payrollAdhoc.ts, after creating the ad-hoc component:
await recalculateStatutory(payrollLineId);
// This recomputes PF, ESI, PT, TDS based on the new gross including ad-hoc
```

---

### P1-16: No reopen/unlock after LOCKED payroll run

**Affected:** `src/lib/payrollGuard.ts:10-21`

**Fix:** Add a `reopen` endpoint that requires superadmin or special
permission, sets status back to `APPROVED`, and logs the action.

---

### P1-17: No PDF payslip generation

**Fix:** Use `pdf-lib` or `puppeteer` to generate PDF payslips server-side.
New route: `GET /api/payroll/runs/[id]/lines/[lineId]/payslip-pdf`.

---

### P1-18: No Full & Final Settlement

**Fix:** New model `FullAndFinalSettlement` with fields for leave encashment,
notice pay, gratuity, bonus, arrears, deductions. New page and API at
`/payroll/processing/full-and-final`.

---

### P1-19: PMS incentive only stores percentage

**Fix:** Add `amount` field to `PmsIncentive`. On approval, compute:
`amount = baseSalary * (managerPercent + companyPercent) / 100`. Push as an
earning line into payroll automatically.

---

### P1-20: CTC routes bypass RBAC

**Affected:** `src/lib/rbac-employee.ts:21-53`

**Fix:** Add a path rule for `/api/employees/[id]/ctc`:
```ts
if (path.startsWith('/api/employees/') && path.includes('/ctc')) {
  return { module: 'employee', action: 'ctc', code: 'employee.ctc.view' };
}
```

---

### P1-21: Arrears don't compute PT/TDS adjustments

**Affected:** `src/lib/arrearCalculation.ts:16-17`

**Fix:** After computing the arrear amount, also compute the PT and TDS
differential on the arrear amount and store as separate arrear components.

---

### P1-22: Company model lacks statutory fields

**Fix:**
```prisma
// Add to Company model:
tan             String?  @db.NVarChar(20)
pan             String?  @db.NVarChar(20)
pfEstablishmentCode String? @db.NVarChar(20)
esiEstablishmentCode String? @db.NVarChar(20)
addressLine1    String?  @db.NVarChar(200)
addressLine2    String?  @db.NVarChar(200)
city            String?  @db.NVarChar(100)
state           String?  @db.NVarChar(100)
pincode         String?  @db.NVarChar(20)
```

---

## P2 — MEDIUM (Important, has workaround)

### P2-1: No photo/signature upload
Add `multipart/form-data` upload endpoint, store to local/S3, add fields to
Basic tab form.

### P2-2: No duplicate checks for PAN/Aadhaar/UAN
Add `findFirst` check before create/update in KYC and passport routes.

### P2-3: Exit form missing interview fields
Add `interviewNotes`, `interviewDate`, `interviewedBy` to the exit form UI.

### P2-4: KPI stats API only supports 7 modules
Extend the switch in `stats/[module]/route.ts` to support all master module
names.

### P2-5: Soft-delete code-reuse guard broken
Change `findUnique` to `findFirst({ where: { code, deletedAt: null } })` in
all POST uniqueness checks.

### P2-6: No referential integrity on master delete
Before soft-deleting a parent, check for active child records:
```ts
const childCount = await prisma.subDepartment.count({
  where: { departmentId: id, deletedAt: null },
});
if (childCount > 0) return NextResponse.json({ error: 'Cannot delete: has sub-departments' }, { status: 409 });
```

### P2-7: Missing masters (Bank, IT Slabs, LWF, Document Type)
Create new models, API routes, and UI pages for each.

### P2-8: ShiftMaster time format not validated
Add `z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/)` to the validation schema.

### P2-9: Leave numberOfDays trusted from client
Compute server-side by iterating calendar days, excluding weekly offs and
holidays.

### P2-10: No approval notifications
Add email/push notification on status transitions. Requires email service.

### P2-11: Leave accrual not scheduled
Add a cron job (e.g., `node-cron` or external scheduler) to run
`runAnnualLeaveCredit` on the 1st of every month/year.

### P2-12: No bulk salary revision
Add Excel upload endpoint for department/grade-wide revision cycles.

### P2-13: No loan recovery module
Create `Loan` and `LoanInstallment` models. Deduct automatically in payroll.

### P2-14: Gratuity has no payment integration
Add bank payment voucher generation on `mark-paid`.

### P2-15: PMS companyPercent hardcoded to 50
Move to company settings or `OrgOptions`.

### P2-16: No payroll summary/reconciliation report
New API + page at `/payroll/outputs/summary`.

---

## P3 — LOW (Nice-to-have)

### P3-1: DataTable sortable prop is decorative
Wire `onClick` handler to sort by column.

### P3-2: DropdownMaster category is free text
Predefine categories: `['gender', 'blood_group', 'marital_status', 'religion', 'nationality']`.

### P3-3: Rounding hardcoded to whole rupees
Add `roundingPolicy` to company settings: `'whole' | 'paise'`.

### P3-4: hasPermission caching not implemented
Add `Map` cache per request lifecycle in `rbac.ts`.

### P3-5: z.coerce.date() local-time risk
Replace with `wallClockDateTime` schema in workforce validations.

---

## Runtime Bug (Fixed This Session)

### Grade API 500 — Unknown field `designation`

**Root cause:** Prisma Client was stale — schema had the `designation` relation
on `Grade` (added in migration 000022, commit `274a100`) but `prisma generate`
was never run after the schema change.

**Fix applied:**
```bash
npx prisma generate
rm -rf .next
npm run dev
```

**Status:** FIXED

---

## Summary

| Priority | Count | Status |
|----------|-------|--------|
| P0 (Critical) | 15 | Pending |
| P1 (High) | 22 | Pending |
| P2 (Medium) | 16 | Pending |
| P3 (Low) | 5 | Pending |
| **Total** | **58** | **1 fixed (Grade API)** |
