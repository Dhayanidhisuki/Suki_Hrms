# Dynamic Payroll Engine — Implementation Plan

**Document:** `docs/DYNAMIC_PAYROLL_IMPLEMENTATION_PLAN_2026-09-11.md`
**Date:** 2026-09-11
**Approach:** Build everything configurable. Admin sets values at runtime. No business decisions block development.

---

## Overview

| Phase | Tasks | New Models | New Pages | New APIs | Effort |
|-------|-------|-----------|-----------|----------|--------|
| Phase 1 | Wire existing config | 0 | 0 | 0 | 5-7 days |
| Phase 2 | New config models + payroll wiring | 22 | 18 | 36 | 30-40 days |
| Phase 3 | Outputs | 0 | 5 | 10 | 15-20 days |
| Phase 4 | TDS annual engine | 2 | 2 | 4 | 10-15 days |
| Phase 5 | Time Office gaps | 5 | 4 | 8 | 10-15 days |
| **Total** | — | **29** | **29** | **58** | **70-97 days** |

---

## Phase 1: Wire Existing Config (5-7 days)

No new models. No migrations. Just connect existing config to payroll calculation.

### Task 1.1: PF wage base — use `includeInPf` flag (1 day)

**Files to change:**
- `src/lib/payrollCalculation.ts` — PF wage calculation (lines ~171-187)
- `src/lib/arrearCalculation.ts` — PF arrear calculation

**Current code:**
```typescript
const pfWage = Math.min(grossEarnings, pfWageCap);
```

**New code:**
```typescript
// Sum only components where includeInPf = true
const pfWageComponents = revision.components.filter(
  c => c.salaryComponent.includeInPf && c.salaryComponent.type === 'earning'
);
const pfWage = Math.min(
  pfWageComponents.reduce((sum, c) => sum + Number(c.amount) * lopFactor, 0),
  pfWageCap
);
```

**Also update:** `SalaryComponent` select in the Prisma query to include `includeInPf`.

### Task 1.2: ESI wage base — use `includeInEsi` flag (0.5 day)

**Files to change:**
- `src/lib/payrollCalculation.ts` — ESI wage calculation (lines ~189-207)

**Change:** Same pattern as PF — sum only `includeInEsi=true` components for ESI wage base.

### Task 1.3: OT threshold + max hours — consume OTPlan (0.5 day)

**Files to change:**
- `src/lib/payrollCalculation.ts` — OT calculation (lines ~155-165)

**Changes:**
- Read `OTPlan.applicableAfterMinutes` — subtract threshold from OT minutes before calculating amount
- Read `OTPlan.maxOtHoursPerDay` — cap OT hours at max (monthly: sum of daily caps)
- Read `OTPlan.payComponentId` — create a `PayrollLineComponent` for OT amount using the configured component

### Task 1.4: Canteen deduction — wire `BenefitRateByEmployeeType` (1 day)

**Files to change:**
- `src/lib/payrollCalculation.ts` — add canteen auto-deduction

**Changes:**
- Look up `BenefitRateByEmployeeType` for the employee's type + canteen component
- Apply as recurring deduction (prorated by `lopFactor`)
- Add to `PayrollLineComponent` as `isAdhoc: false`

### Task 1.5: DeductionRate — wire to payroll (1 day)

**Files to change:**
- `src/lib/payrollCalculation.ts` — add generic deduction rate application

**Changes:**
- Read active `DeductionRate` records for the company
- For PERCENT type: `amount = grossEarnings × rateValue / 100`
- For FLAT type: `amount = rateValue`
- For `isLop=true`: `amount = grossEarnings / payrollDays × lopDays` (LOP deduction)
- Create `PayrollLineComponent` entries

### Task 1.6: GrossSplitRule — wire to salary revision (1 day)

**Files to change:**
- `src/app/api/payroll/revisions/route.ts` — auto-fill components on revision
- `src/lib/salaryRevisioning.ts` — component auto-fill logic

**Changes:**
- When creating a salary revision with `REVISED_GROSS` method, auto-fill component amounts using `GrossSplitRule.percentOfGross`
- Each active rule: `componentAmount = revisedGross × percentOfGross / 100`
- Only fill components that have an active rule; leave others for manual entry

### Task 1.7: LOM from attendance — wire late/early minutes (1 day)

**Files to change:**
- `src/lib/payrollCalculation.ts` — add LOM deduction

**Changes:**
- Read `MonthlyAttendanceSummary.lateMinutesTotal` + `earlyOutMinutesTotal`
- Total LOM minutes = `lateMinutesTotal + earlyOutMinutesTotal`
- For now use a simple default formula (configurable later in Phase 2):
  ```
  lomDeduction = (grossEarnings / totalWorkingDays / 8 / 60) × lomMinutes
  ```
- Store as separate deduction line on `PayrollLine`
- Add `lomAmount` field to `PayrollLine` model (migration needed)

**Migration:** Add `lomAmount Decimal @default(0) @db.Decimal(18, 2)` to `PayrollLine`.

---

## Phase 2: New Configurable Models + Payroll Wiring (30-40 days)

### Batch 2A: Payroll Calculation Config (7-10 days)

#### Task 2A.1: `LomConfig` model + admin page (2 days)

**Schema:**
```prisma
model LomConfig {
  id                      Int      @id @default(autoincrement())
  companyId               Int      @unique
  calculationBasis        String   @default("GROSS") @db.NVarChar(20) // GROSS | BASIC
  multiplier              Decimal  @default(1) @db.Decimal(5, 2) // 1 or 2
  shiftDurationSource     String   @default("FIXED_8") @db.NVarChar(20) // FIXED_8 | SHIFT_MASTER
  payrollDaysDenominator  String   @default("CALENDAR") @db.NVarChar(20) // CALENDAR | FIXED_26
  graceMinutesExempt      Int      @default(0)
  dailyLomCap             Int?     // null = no cap
  isActive                Boolean  @default(true)
  createdAt               DateTime @default(now())
  updatedAt               DateTime @updatedAt
  company                 Company  @relation(fields: [companyId], references: [id])
  @@map("LomConfig")
}
```

**Files:**
- `prisma/schema.prisma` — add model
- `prisma/migrations/000035_lom_config/migration.sql`
- `src/app/api/masters/lom-config/route.ts` — GET/PUT
- `src/app/masters/lom-config/page.tsx` — admin config page
- `src/lib/payrollCalculation.ts` — read `LomConfig` and apply formula

**Payroll logic:**
```typescript
const lomConfig = await prisma.lomConfig.findUnique({ where: { companyId } });
const basis = lomConfig.calculationBasis === 'BASIC' ? basicAmount : grossEarnings;
const shiftDuration = lomConfig.shiftDurationSource === 'SHIFT_MASTER' ? shiftHours : 8;
const denom = lomConfig.payrollDaysDenominator === 'FIXED_26' ? 26 : totalWorkingDays;
const lomMinutes = Math.max(0, lateMinutes + earlyMinutes - lomConfig.graceMinutesExempt);
const lomDeduction = (basis / denom / shiftDuration / 60) × lomMinutes × lomConfig.multiplier;
```

#### Task 2A.2: `RoundingConfig` model + admin page (1 day)

**Schema:**
```prisma
model RoundingConfig {
  id           Int      @id @default(autoincrement())
  companyId     Int      @unique
  roundingMode String   @default("NEAREST_1") @db.NVarChar(20) // NONE | NEAREST_1 | NEAREST_5 | NEAREST_10 | NEAREST_100
  applyTo       String   @default("NET_ONLY") @db.NVarChar(20) // NET_ONLY | ALL_COMPONENTS
  showRoundOff Boolean  @default(true)
  createdAt     DateTime @default(now())
  updatedAt     DateTime @updatedAt
  company       Company  @relation(fields: [companyId], references: [id])
  @@map("RoundingConfig")
}
```

**Files:**
- `prisma/schema.prisma`, migration
- `src/app/api/masters/rounding-config/route.ts`
- `src/app/masters/rounding-config/page.tsx`
- `src/lib/payrollCalculation.ts` — apply rounding to net salary

**Payroll logic:**
```typescript
function applyRounding(amount, mode) {
  switch(mode) {
    case 'NONE': return amount;
    case 'NEAREST_1': return Math.round(amount);
    case 'NEAREST_5': return Math.round(amount / 5) * 5;
    case 'NEAREST_10': return Math.round(amount / 10) * 10;
    case 'NEAREST_100': return Math.round(amount / 100) * 100;
  }
}
const roundedNet = applyRounding(netSalary, roundingConfig.roundingMode);
const roundOff = roundedNet - netSalary;
```

#### Task 2A.3: `PayrollValidationConfig` model + admin page (1 day)

**Schema:**
```prisma
model PayrollValidationConfig {
  id                       Int      @id @default(autoincrement())
  companyId                Int      @unique
  allowNegativeNet         Boolean  @default(false)
  minNetPercentOfGross     Decimal  @default(0) @db.Decimal(5, 2) // 0-100
  requireApprovalIfNeg    Boolean  @default(true)
  maxDeductionPercent      Decimal  @default(100) @db.Decimal(5, 2)
  statutoryIncludedInLimit Boolean  @default(true)
  createdAt                DateTime @default(now())
  updatedAt                DateTime @updatedAt
  company                  Company  @relation(fields: [companyId], references: [id])
  @@map("PayrollValidationConfig")
}
```

**Files:**
- `prisma/schema.prisma`, migration
- `src/app/api/masters/payroll-validation-config/route.ts`
- `src/app/masters/payroll-validation-config/page.tsx`
- `src/lib/payrollCalculation.ts` — add validation checks after calculation
- `src/lib/validations/payroll.ts` — add validation schema

**Validation logic:**
```typescript
// After calculating net salary:
if (netSalary < 0 && !validationConfig.allowNegativeNet) {
  line.status = 'HOLD';
  line.holdReason = 'Net salary is negative';
}
if (netSalary < grossEarnings * validationConfig.minNetPercentOfGross / 100) {
  line.status = 'HOLD';
  line.holdReason = `Net salary below minimum ${validationConfig.minNetPercentOfGross}% of gross`;
}
const totalDeductions = pfEmployee + esiEmployee + professionalTax + tds + otherDeductionsTotal;
const deductionPercent = (totalDeductions / grossEarnings) * 100;
if (deductionPercent > Number(validationConfig.maxDeductionPercent)) {
  line.status = 'HOLD';
  line.holdReason = `Total deductions ${deductionPercent}% exceed max ${validationConfig.maxDeductionPercent}%`;
}
```

#### Task 2A.4: `PayrollWorkflowConfig` model (1 day)

**Schema:**
```prisma
model PayrollWorkflowConfig {
  id                   Int      @id @default(autoincrement())
  companyId            Int      @unique
  enableValidatedStage Boolean  @default(false)
  enableSubmittedStage Boolean  @default(false)
  enablePostedStage    Boolean  @default(false)
  approvalStages       String   @default("HR") @db.NVarChar(100) // HR | MANAGER_HR | HR_FINANCE | MANAGER_HR_FINANCE
  cutoffDayOfMonth     Int?     // e.g. 25 = 25th of each month
  allowReopenAfterLock Boolean  @default(true)
  reopenRequiresReason Boolean  @default(true)
  createdAt            DateTime @default(now())
  updatedAt            DateTime @updatedAt
  company              Company  @relation(fields: [companyId], references: [id])
  @@map("PayrollWorkflowConfig")
}
```

**Files:**
- `prisma/schema.prisma`, migration
- `src/app/api/masters/payroll-workflow-config/route.ts`
- `src/app/masters/payroll-workflow-config/page.tsx`
- `src/app/api/payroll/runs/[id]/validate/route.ts` — new VALIDATED stage
- `src/app/api/payroll/runs/[id]/submit/route.ts` — new SUBMITTED stage
- `src/app/api/payroll/runs/[id]/post/route.ts` — new POSTED stage
- `src/lib/payrollGuard.ts` — update to respect enabled stages

#### Task 2A.5: `PayrollDisplayConfig` model (0.5 day)

**Schema:**
```prisma
model PayrollDisplayConfig {
  id                   Int      @id @default(autoincrement())
  companyId            Int      @unique
  showDeductionPercent Boolean  @default(true)
  decimalPlaces        Int      @default(2)
  showYTD              Boolean  @default(false)
  showLeaveBalance     Boolean  @default(false)
  showTaxBreakdown     Boolean  @default(false)
  createdAt            DateTime @default(now())
  updatedAt            DateTime @updatedAt
  company              Company  @relation(fields: [companyId], references: [id])
  @@map("PayrollDisplayConfig")
}
```

**Files:**
- `prisma/schema.prisma`, migration
- `src/app/api/masters/payroll-display-config/route.ts`
- `src/app/payroll/outputs/payslip/page.tsx` — apply display config

#### Task 2A.6: Shift-based allowances (1.5 days)

**Schema changes to `ShiftMaster`:**
```prisma
// Add to existing ShiftMaster model:
nightAllowanceAmount     Decimal? @db.Decimal(18, 2)
nightAllowanceFromHour   Int?     // e.g. 22 (10 PM)
snacksAllowanceAmount    Decimal? @db.Decimal(18, 2)
foodAllowanceAmount      Decimal? @db.Decimal(18, 2)
mealsAllowanceAmount     Decimal? @db.Decimal(18, 2)
breakMinutes             Int      @default(0) // lunch/tea break deducted from working duration
```

**Files:**
- `prisma/schema.prisma` — add fields to ShiftMaster
- `prisma/migrations/000036_shift_allowances/migration.sql`
- `src/app/masters/shift-masters/page.tsx` — add fields to form
- `src/lib/biometricConversion.ts` — deduct `breakMinutes` from working duration
- `src/lib/payrollCalculation.ts` — auto-calculate shift-based allowances

**Payroll logic:**
```typescript
// For each day the employee worked on a shift with allowances:
// Night allowance: if inTime hour >= nightAllowanceFromHour
// Snacks/Food/Meals: if shift flags are true and employee is present
// Sum across the month, prorate by lopFactor
```

### Batch 2B: OT Enhancements (5-7 days)

#### Task 2B.1: OTPlan enhancements (2 days)

**Schema changes to `OTPlan`:**
```prisma
// Add to existing OTPlan model:
calculationBasis     String   @default("GROSS") @db.NVarChar(20) // BASIC | GROSS | BASIC_DA_HRA | FIXED_RATE
weekdayMultiplier    Decimal  @default(1) @db.Decimal(5, 2)
weekendMultiplier    Decimal  @default(1.5) @db.Decimal(5, 2)
holidayMultiplier    Decimal  @default(2) @db.Decimal(5, 2)
weeklyOtThresholdHours Int?   // null = no weekly threshold
maxOtHoursPerMonth   Int?     // null = no monthly cap
```

**Files:**
- `prisma/schema.prisma`, migration
- `src/app/masters/ot-plans/page.tsx` — add fields
- `src/lib/payrollCalculation.ts` — use `calculationBasis` for hourly rate, use day-type multipliers
- `src/lib/biometricConversion.ts` — pass day type (weekday/weekend/holiday) to OT calculation

**Payroll logic:**
```typescript
// 1. Determine hourly rate based on calculationBasis:
const basis = otPlan.calculationBasis;
let hourlyRate;
if (basis === 'BASIC') hourlyRate = basicAmount / denom / 8;
else if (basis === 'GROSS') hourlyRate = grossSalary / denom / 8;
else if (basis === 'BASIC_DA_HRA') hourlyRate = (basic + da + hra) / denom / 8;
else if (basis === 'FIXED_RATE') hourlyRate = otPlan.fixedRatePerHour;

// 2. Determine multiplier based on day type:
// Read DailyAttendance for each day, check if weekend/holiday
// Sum OT per day type, apply respective multiplier
const weekdayOtAmount = weekdayOtHours × hourlyRate × otPlan.weekdayMultiplier;
const weekendOtAmount = weekendOtHours × hourlyRate × otPlan.weekendMultiplier;
const holidayOtAmount = holidayOtHours × hourlyRate × otPlan.holidayMultiplier;
const totalOtAmount = weekdayOtAmount + weekendOtAmount + holidayOtAmount;
```

#### Task 2B.2: `OtIncentiveSlab` model (1 day)

**Schema:**
```prisma
model OtIncentiveSlab {
  id            Int     @id @default(autoincrement())
  otPlanId      Int
  minHours      Decimal @db.Decimal(5, 2)
  maxHours      Decimal? @db.Decimal(5, 2) // null = no upper limit
  incentiveAmount Decimal @db.Decimal(18, 2) // flat incentive for this slab
  isActive      Boolean @default(true)
  otPlan        OTPlan  @relation(fields: [otPlanId], references: [id], onDelete: Cascade)
  @@map("OtIncentiveSlab")
}
```

**Files:**
- `prisma/schema.prisma`, migration
- `src/app/api/masters/ot-plans/[id]/incentive-slabs/route.ts`
- `src/lib/payrollCalculation.ts` — look up slab by monthly OT hours, add incentive

#### Task 2B.3: Weekly OT aggregation (1 day)

**Files:**
- `src/lib/payrollCalculation.ts` — aggregate OT by week, apply weekly threshold

**Logic:**
```typescript
// Group DailyAttendance by ISO week
// Sum OT hours per week
// If weeklyOtThresholdHours set, only count OT above threshold
// Sum eligible weekly OT across all weeks in month
```

### Batch 2C: Loan & Advance Module (5-7 days)

#### Task 2C.1: Enhance `LoanType` model (1 day)

**Schema changes:**
```prisma
// Add to existing LoanType model:
loanCategory          String   @default("LOAN") @db.NVarChar(10) // LOAN | ADVANCE
interestApplicable    Boolean  @default(false)
interestRate          Decimal  @default(0) @db.Decimal(5, 2)
interestType          String   @default("NONE") @db.NVarChar(10) // NONE | FLAT
maxTenureMonths       Int?
deductionFrequency    String   @default("MONTHLY") @db.NVarChar(20)
payrollDeductionCode  String?  @db.NVarChar(30)
multipleLoanAllowed   Boolean  @default(true)
deductionPriority     Int      @default(0) // lower = higher priority
```

**Files:**
- `prisma/schema.prisma`, migration
- `src/app/masters/loan-types/page.tsx` — add fields

#### Task 2C.2: `EmployeeLoan` model (1.5 days)

**Schema:**
```prisma
model EmployeeLoan {
  id                Int      @id @default(autoincrement())
  employeeId        Int
  loanTypeId        Int
  loanAmount        Decimal  @db.Decimal(18, 2)
  repayAmount       Decimal  @db.Decimal(18, 2)
  issueDate         DateTime @db.Date
  noOfMonths        Int
  installmentAmount Decimal  @db.Decimal(18, 2)
  startYear         Int
  startMonth        Int
  endYear           Int
  endMonth          Int
  outstandingBalance Decimal @db.Decimal(18, 2)
  status            String   @default("OPEN") @db.NVarChar(20) // OPEN | CLOSED | SHORTCLOSED | HOLD | CANCELLED
  holdReason        String?  @db.NVarChar(500)
  approvedByUserId  Int?
  approvedAt        DateTime?
  createdAt         DateTime @default(now())
  updatedAt         DateTime @updatedAt
  employee          Employee @relation(fields: [employeeId], references: [id])
  loanType          LoanType @relation(fields: [loanTypeId], references: [id])
  recoveries        LoanRecoveryTransaction[]
  @@index([employeeId])
  @@index([status])
  @@map("EmployeeLoan")
}
```

**Files:**
- `prisma/schema.prisma`, migration
- `src/app/api/payroll/loans/route.ts` — GET list, POST create
- `src/app/api/payroll/loans/[id]/route.ts` — GET, PUT, DELETE
- `src/app/api/payroll/loans/[id]/approve/route.ts` — approve
- `src/app/api/payroll/loans/[id]/hold/route.ts` — hold/resume
- `src/app/api/payroll/loans/[id]/short-close/route.ts` — short close
- `src/app/payroll/deductions/loan-recovery/page.tsx` — loan management page

#### Task 2C.3: `LoanRecoveryTransaction` model (1 day)

**Schema:**
```prisma
model LoanRecoveryTransaction {
  id              Int      @id @default(autoincrement())
  employeeLoanId  Int
  payrollRunId    Int?
  amount          Decimal  @db.Decimal(18, 2)
  month           Int
  year            Int
  balanceAfter    Decimal  @db.Decimal(18, 2)
  createdAt       DateTime @default(now())
  employeeLoan    EmployeeLoan @relation(fields: [employeeLoanId], references: [id])
  @@index([employeeLoanId])
  @@map("LoanRecoveryTransaction")
}
```

#### Task 2C.4: Wire loan deduction to payroll (1.5 days)

**Files:**
- `src/lib/payrollCalculation.ts` — auto-deduct loan installments

**Logic:**
```typescript
// For each employee with OPEN loans where current month is in [startYear/startMonth, endYear/endMonth]:
const activeLoans = await prisma.employeeLoan.findMany({
  where: {
    employeeId: emp.id,
    status: 'OPEN',
    startYear: { lte: year },
    OR: [{ startYear: { lt: year } }, { startMonth: { lte: month } }],
  },
});
for (const loan of activeLoans) {
  const deduction = Math.min(loan.installmentAmount, loan.outstandingBalance);
  // Create PayrollLineComponent (isAdhoc: false, linked to loan's payrollDeductionCode component)
  // Create LoanRecoveryTransaction
  // Update loan.outstandingBalance -= deduction
  // If outstandingBalance <= 0, set status = CLOSED
}
```

### Batch 2D: Comp-Off Module (3-4 days)

#### Task 2D.1: `CompOffPolicy` + `CompOffBalance` models (1.5 days)

**Schema:**
```prisma
model CompOffPolicy {
  id                Int      @id @default(autoincrement())
  companyId         Int      @unique
  minHoursOnSunday  Decimal  @default(4) @db.Decimal(4, 2)
  minHoursOnHoliday Decimal  @default(4) @db.Decimal(4, 2)
  autoGenerate      Boolean  @default(true)
  expiryMonths      Int?     // null = no expiry
  encashable        Boolean  @default(false)
  encashmentFormula String   @default("BASIC_DIV_26") @db.NVarChar(20)
  createdAt         DateTime @default(now())
  updatedAt         DateTime @updatedAt
  company           Company  @relation(fields: [companyId], references: [id])
  @@map("CompOffPolicy")
}

model CompOffBalance {
  id              Int     @id @default(autoincrement())
  employeeId      Int
  year            Int
  earned          Decimal @default(0) @db.Decimal(5, 2)
  utilized        Decimal @default(0) @db.Decimal(5, 2)
  expired         Decimal @default(0) @db.Decimal(5, 2)
  closingBalance  Decimal @default(0) @db.Decimal(5, 2)
  employee        Employee @relation(fields: [employeeId], references: [id])
  @@unique([employeeId, year])
  @@map("CompOffBalance")
}
```

#### Task 2D.2: Auto-generate comp-off from attendance (1 day)

**Files:**
- `src/lib/attendanceHistory.ts` — after daily attendance write, check if Sunday/holiday + min hours met → generate comp-off
- `src/app/api/workforce/comp-off/route.ts` — list comp-off records
- `src/app/api/workforce/comp-off/[id]/approve/route.ts` — approve comp-off

#### Task 2D.3: Comp-off page + balance display (1 day)

**Files:**
- `src/app/workforce/comp-off/page.tsx` — comp-off management
- `src/app/workforce/leave/history/page.tsx` — show comp-off balance alongside leave balance

### Batch 2E: Incentives & Allowances (5-7 days)

#### Task 2E.1: `IncentivePolicy` model (1.5 days)

**Schema:**
```prisma
model IncentivePolicy {
  id                Int      @id @default(autoincrement())
  companyId         Int
  type              String   @db.NVarChar(30) // ATTENDANCE_BONUS | SHIFT_BONUS | PRODUCTION | SPECIAL | OTHER
  name              String   @db.NVarChar(100)
  amount            Decimal  @db.Decimal(18, 2)
  calculationType   String   @default("FLAT") @db.NVarChar(20) // FLAT | FORMULA
  formula           String?  @db.NVarChar(500) // JSON formula if calculationType=FORMULA
  eligibility       String?  @db.NVarChar(500) // JSON eligibility criteria
  eligibleShiftCodes String? @db.NVarChar(200) // comma-separated shift codes for SHIFT_BONUS
  isActive          Boolean  @default(true)
  createdAt         DateTime @default(now())
  updatedAt         DateTime @updatedAt
  company           Company  @relation(fields: [companyId], references: [id])
  @@map("IncentivePolicy")
}
```

**Files:**
- `prisma/schema.prisma`, migration
- `src/app/api/masters/incentive-policies/route.ts`
- `src/app/masters/incentive-policies/page.tsx`
- `src/lib/payrollCalculation.ts` — evaluate incentive policies per employee

#### Task 2E.2: `DoubleMachineEntry` model (1.5 days)

**Schema:**
```prisma
model DoubleMachineEntry {
  id                Int      @id @default(autoincrement())
  employeeId        Int
  date              DateTime @db.Date
  machine1          String?   @db.NVarChar(50)
  machine2          String?   @db.NVarChar(50)
  numMachines       Int       @default(1)
  workingHours      Decimal   @db.Decimal(5, 2)
  incentiveRate     Decimal  @db.Decimal(18, 2)
  calculatedIncentive Decimal @db.Decimal(18, 2)
  hrRemarks         String?   @db.NVarChar(500)
  status            String   @default("PENDING") @db.NVarChar(20) // PENDING | APPROVED | REJECTED
  approvedByUserId  Int?
  approvedAt        DateTime?
  createdAt         DateTime @default(now())
  updatedAt         DateTime @updatedAt
  employee          Employee @relation(fields: [employeeId], references: [id])
  @@index([employeeId])
  @@map("DoubleMachineEntry")
}
```

**Files:**
- `prisma/schema.prisma`, migration
- `src/app/api/payroll/double-machine/route.ts`
- `src/app/api/payroll/double-machine/[id]/approve/route.ts`
- `src/app/payroll/processing/double-machine/page.tsx`

#### Task 2E.3: `CanteenToken` model (1 day)

**Schema:**
```prisma
model CanteenToken {
  id              Int      @id @default(autoincrement())
  employeeId      Int
  date            DateTime @db.Date
  tokensUsed      Int      @default(0)
  ratePerToken    Decimal  @db.Decimal(18, 2)
  employeeContribution Decimal @db.Decimal(18, 2)
  companyContribution   Decimal @default(0) @db.Decimal(18, 2)
  createdAt       DateTime @default(now())
  employee        Employee @relation(fields: [employeeId], references: [id])
  @@index([employeeId, date])
  @@map("CanteenToken")
}
```

**Files:**
- `prisma/schema.prisma`, migration
- `src/app/api/workforce/canteen/route.ts`
- `src/app/workforce/canteen/page.tsx`
- `src/lib/payrollCalculation.ts` — sum canteen tokens for the month, add as deduction

#### Task 2E.4: `PetrolAllowanceEntry` model (1 day)

**Schema:**
```prisma
model PetrolAllowanceEntry {
  id              Int      @id @default(autoincrement())
  employeeId      Int
  month           Int
  year            Int
  travelDate      DateTime @db.Date
  km              Decimal  @db.Decimal(10, 2)
  ratePerKm       Decimal  @db.Decimal(18, 2)
  eligibleAmount  Decimal  @db.Decimal(18, 2)
  approvedAmount  Decimal  @db.Decimal(18, 2)
  status          String   @default("PENDING") @db.NVarChar(20)
  managerActionByUserId Int?
  managerActionAt DateTime?
  createdAt       DateTime @default(now())
  employee        Employee @relation(fields: [employeeId], references: [id])
  @@index([employeeId])
  @@map("PetrolAllowanceEntry")
}
```

**Files:**
- `prisma/schema.prisma`, migration
- `src/app/api/workforce/petrol/route.ts`
- `src/app/api/workforce/petrol/[id]/approve/route.ts`
- `src/app/workforce/petrol/page.tsx`
- `src/lib/payrollCalculation.ts` — sum approved petrol entries for the month, add as earning

#### Task 2E.5: `AllowanceConfig` for Heat/Other (0.5 day)

**Schema:**
```prisma
model AllowanceConfig {
  id              Int      @id @default(autoincrement())
  companyId       Int
  componentCode   String   @db.NVarChar(30) // links to SalaryComponent
  amount          Decimal  @db.Decimal(18, 2)
  eligibilityType String   @default("ALL") @db.NVarChar(20) // ALL | DESIGNATION | DEPARTMENT | SHIFT
  eligibilityValue String? @db.NVarChar(200) // comma-separated IDs
  isActive        Boolean  @default(true)
  createdAt       DateTime @default(now())
  updatedAt       DateTime @updatedAt
  company         Company  @relation(fields: [companyId], references: [id])
  @@map("AllowanceConfig")
}
```

### Batch 2F: Statutory Config (5-7 days)

#### Task 2F.1: `LwfRate` model (1 day)

**Schema:**
```prisma
model LwfRate {
  id                    Int      @id @default(autoincrement())
  companyId             Int
  stateCode             String   @db.NVarChar(10)
  employeeContribution  Decimal  @db.Decimal(18, 2)
  employerContribution  Decimal  @db.Decimal(18, 2)
  wageBase              String   @default("GROSS") @db.NVarChar(20) // GROSS | BASIC
  wageCeiling           Decimal? @db.Decimal(18, 2)
  frequency             String   @default("MONTHLY") @db.NVarChar(20) // MONTHLY | HALF_YEARLY
  effectiveFrom         DateTime
  effectiveTo          DateTime?
  isActive             Boolean  @default(true)
  createdAt             DateTime @default(now())
  updatedAt             DateTime @updatedAt
  company               Company  @relation(fields: [companyId], references: [id])
  @@map("LwfRate")
}
```

#### Task 2F.2: State-wise PT — enhance `ProfessionalTaxSlab` (1 day)

**Schema changes:**
```prisma
// Add to existing ProfessionalTaxSlab model:
companyId    Int?
stateCode    String?  @db.NVarChar(10)
halfYearlyAmount Decimal? @db.Decimal(18, 2)
annualCap    Decimal? @db.Decimal(18, 2)
```

**Files:**
- `prisma/schema.prisma`, migration
- `src/app/api/masters/professional-tax-slabs/route.ts` — add state filter
- `src/app/masters/professional-tax/page.tsx` — state-wise slab management
- `src/lib/payrollCalculation.ts` — look up slab by employee's state

#### Task 2F.3: `HealthInsuranceConfig` model (1 day)

**Schema:**
```prisma
model HealthInsuranceConfig {
  id                  Int      @id @default(autoincrement())
  companyId           Int      @unique
  schemeName          String   @db.NVarChar(100)
  employeeContribution Decimal @db.Decimal(18, 2)
  employerContribution Decimal @default(0) @db.Decimal(18, 2)
  frequency           String   @default("MONTHLY") @db.NVarChar(20)
  perEmployeeOrFamily String   @default("PER_EMPLOYEE") @db.NVarChar(20)
  taxExempt80D        Boolean  @default(false)
  isActive            Boolean  @default(true)
  createdAt           DateTime @default(now())
  updatedAt           DateTime @updatedAt
  company             Company  @relation(fields: [companyId], references: [id])
  @@map("HealthInsuranceConfig")
}
```

#### Task 2F.4: `LicDeductionConfig` model (0.5 day)

**Schema:**
```prisma
model LicDeduction {
  id            Int      @id @default(autoincrement())
  employeeId    Int
  policyNumber  String   @db.NVarChar(50)
  amount        Decimal  @db.Decimal(18, 2)
  frequency      String   @default("MONTHLY") @db.NVarChar(20)
  taxExempt80C  Boolean  @default(true)
  isActive      Boolean  @default(true)
  createdAt     DateTime @default(now())
  updatedAt     DateTime @updatedAt
  employee      Employee @relation(fields: [employeeId], references: [id])
  @@map("LicDeduction")
}
```

#### Task 2F.5: Wire all statutory to payroll (1.5 days)

**Files:**
- `src/lib/payrollCalculation.ts` — add LWF, health insurance, LIC deductions

**Logic:**
```typescript
// LWF: look up by company + state, apply based on frequency
// Health Insurance: look up by company, apply per frequency
// LIC: look up by employee, apply per frequency
// All added as PayrollLineComponent entries
```

### Batch 2G: Leave Encashment + FnF (3-4 days)

#### Task 2G.1: Enhance `LeaveMaster` for encashment (0.5 day)

**Schema changes:**
```prisma
// Add to existing LeaveMaster:
encashmentAllowed Boolean @default(false)
encashmentFormula String? @db.NVarChar(20) // BASIC_DIV_26 | GROSS_DIV_30
```

#### Task 2G.2: `LeaveEncashmentRequest` model (1 day)

**Schema:**
```prisma
model LeaveEncashmentRequest {
  id            Int      @id @default(autoincrement())
  employeeId    Int
  leaveMasterId Int
  daysEncashed  Decimal  @db.Decimal(5, 2)
  dailyRate     Decimal  @db.Decimal(18, 2)
  amount        Decimal  @db.Decimal(18, 2)
  encashmentType String  @default("WHILE_EMPLOYED") @db.NVarChar(20) // WHILE_EMPLOYED | EXIT
  status        String   @default("PENDING") @db.NVarChar(20)
  approvedByUserId Int?
  approvedAt    DateTime?
  createdAt     DateTime @default(now())
  employee      Employee @relation(fields: [employeeId], references: [id])
  leaveMaster   LeaveMaster @relation(fields: [leaveMasterId], references: [id])
  @@map("LeaveEncashmentRequest")
}
```

**Files:**
- `prisma/schema.prisma`, migration
- `src/app/api/payroll/leave-encashment/route.ts`
- `src/app/payroll/processing/leave-encashment/page.tsx`
- `src/lib/payrollCalculation.ts` — apply approved encashment as earning

#### Task 2G.3: `FullAndFinalSettlement` model (1.5 days)

**Schema:**
```prisma
model FullAndFinalSettlement {
  id                Int      @id @default(autoincrement())
  employeeId        Int
  exitDate          DateTime @db.Date
  salaryUpToDate    Decimal  @default(0) @db.Decimal(18, 2)
  leaveEncashment   Decimal  @default(0) @db.Decimal(18, 2)
  gratuity          Decimal  @default(0) @db.Decimal(18, 2)
  bonus             Decimal  @default(0) @db.Decimal(18, 2)
  noticePayRecovery Decimal  @default(0) @db.Decimal(18, 2)
  loanOutstanding   Decimal  @default(0) @db.Decimal(18, 2)
  assetRecovery     Decimal  @default(0) @db.Decimal(18, 2)
  incentive         Decimal  @default(0) @db.Decimal(18, 2)
  totalPayable      Decimal  @default(0) @db.Decimal(18, 2)
  totalRecoverable  Decimal  @default(0) @db.Decimal(18, 2)
  netAmount         Decimal  @default(0) @db.Decimal(18, 2)
  status            String   @default("DRAFT") @db.NVarChar(20)
  approvedByUserId  Int?
  approvedAt        DateTime?
  createdAt         DateTime @default(now())
  updatedAt         DateTime @updatedAt
  employee          Employee @relation(fields: [employeeId], references: [id])
  @@map("FullAndFinalSettlement")
}

model NoticePayConfig {
  id                Int      @id @default(autoincrement())
  companyId         Int      @unique
  noticePeriodDays Int      @default(30)
  calculationBasis String   @default("GROSS") @db.NVarChar(20) // BASIC | GROSS
  buyoutAllowed    Boolean  @default(true)
  createdAt        DateTime @default(now())
  updatedAt        DateTime @updatedAt
  company          Company  @relation(fields: [companyId], references: [id])
  @@map("NoticePayConfig")
}
```

**Files:**
- `prisma/schema.prisma`, migration
- `src/app/api/payroll/full-and-final/route.ts`
- `src/app/api/payroll/full-and-final/[id]/approve/route.ts`
- `src/app/payroll/processing/full-and-final/page.tsx`
- `src/lib/fullAndFinal.ts` — FnF calculation logic (consolidates all components)

### Batch 2H: Attendance Config (2-3 days)

#### Task 2H.1: `AttendanceColorConfig` model (0.5 day)

**Schema:**
```prisma
model AttendanceColorConfig {
  id                   Int     @id @default(autoincrement())
  companyId            Int     @unique
  zeroHoursColor       String  @default("#ef4444") @db.NVarChar(10) // red
  shortHoursColor      String  @default("#f97316") @db.NVarChar(10) // orange
  shortHoursThreshold  Int     @default(4) // hours
  partialHoursColor    String  @default("#eab308") @db.NVarChar(10) // yellow
  partialHoursThreshold Int    @default(6) // hours
  normalHoursColor     String  @default("#22c55e") @db.NVarChar(10) // light green
  normalHoursThreshold Int     @default(8) // hours
  extendedHoursColor   String  @default("#15803d") @db.NVarChar(10) // dark green
  weeklyOffColor       String  @default("#3b82f6") @db.NVarChar(10) // blue
  createdAt            DateTime @default(now())
  updatedAt            DateTime @updatedAt
  company              Company  @relation(fields: [companyId], references: [id])
  @@map("AttendanceColorConfig")
}
```

#### Task 2H.2: Enhance `LeaveMaster` for probation (0.5 day)

**Schema changes:**
```prisma
// Add to existing LeaveMaster:
probationEligible Boolean @default(true)
probationMaxDays  Decimal? @db.Decimal(5, 2)
```

---

## Phase 3: Outputs (15-20 days)

### Task 3.1: Bank Transfer File (3-4 days)

**Schema:**
```prisma
model BankFileConfig {
  id              Int      @id @default(autoincrement())
  companyId       Int      @unique
  bankName        String   @db.NVarChar(100)
  fileFormat      String   @default("CSV") @db.NVarChar(10) // CSV | TXT | XLSX
  fieldMapping    String   @db.NVarChar(2000) // JSON: [{source, target, format}]
  hasHeader       Boolean  @default(true)
  hasTrailer      Boolean  @default(false)
  headerTemplate  String?  @db.NVarChar(500)
  trailerTemplate String?  @db.NVarChar(500)
  createdAt       DateTime @default(now())
  updatedAt       DateTime @updatedAt
  company         Company  @relation(fields: [companyId], references: [id])
  @@map("BankFileConfig")
}
```

**Files:**
- `prisma/schema.prisma`, migration
- `src/app/api/masters/bank-file-config/route.ts`
- `src/app/masters/bank-file-config/page.tsx`
- `src/app/api/payroll/outputs/bank-transfer/route.ts` — generate file
- `src/app/payroll/outputs/bank-transfer/page.tsx` — download page
- `src/lib/bankFileGenerator.ts` — file generation logic

### Task 3.2: Payroll Summary (2-3 days)

**Files:**
- `src/app/api/payroll/outputs/summary/route.ts` — company-level totals with breakdowns
- `src/app/payroll/outputs/summary/page.tsx` — summary dashboard
- Support: total gross, total deductions, total net, headcount, dept-wise, branch-wise, component-wise

### Task 3.3: Bulk Payslip PDF (3-4 days)

**Files:**
- `src/app/api/payroll/outputs/payslip-bulk/route.ts` — generate bulk PDFs
- `src/app/payroll/outputs/payslip-bulk/page.tsx` — bulk generation page
- `src/lib/payslipPdf.ts` — PDF generation with password protection
- Use `pdf-lib` or `puppeteer` for PDF generation
- Password = configurable (DOB / employee code / PAN)

### Task 3.4: Payroll Reconciliation (2-3 days)

**Files:**
- `src/app/api/payroll/outputs/reconciliation/route.ts`
- `src/app/payroll/outputs/reconciliation/page.tsx`
- Reconcile: payroll vs attendance, payroll vs statutory, payroll vs bank file, month-over-month variance

### Task 3.5: Time Office Final page (2-3 days)

**Files:**
- `src/app/api/workforce/attendance/time-office-final/route.ts`
- `src/app/workforce/attendance/time-office-final/page.tsx`
- Consolidated review: attendance + leave + OT + permission + comp-off + LOP
- Approval action → marks "Ready for Payroll"

### Task 3.6: Biometric monthly grid with color coding (3-4 days)

**Files:**
- `src/app/workforce/attendance/biometric/page.tsx` — rewrite as monthly grid
- Day columns (28-31), employee rows, color-coded cells, tooltips, export

---

## Phase 4: TDS Annual Engine (10-15 days)

### Task 4.1: Enhance `TDSSlab` model (1 day)

**Schema changes:**
```prisma
// Add to existing TDSSlab:
financialYear  String?  @db.NVarChar(10) // e.g. "2026-27"
taxRegime      String   @default("NEW") @db.NVarChar(10) // OLD | NEW
rebateThreshold Decimal? @db.Decimal(18, 2) // e.g. 500000
rebateAmount   Decimal? @db.Decimal(18, 2) // e.g. 12500
cessRate       Decimal  @default(4) @db.Decimal(5, 2) // 4%
```

### Task 4.2: `TdsSurchargeSlab` model (0.5 day)

**Schema:**
```prisma
model TdsSurchargeSlab {
  id            Int     @id @default(autoincrement())
  financialYear String  @db.NVarChar(10)
  minIncome     Decimal @db.Decimal(18, 2)
  maxIncome     Decimal? @db.Decimal(18, 2)
  surchargeRate Decimal @db.Decimal(5, 2) // e.g. 10, 15, 25
  @@map("TdsSurchargeSlab")
}
```

### Task 4.3: `InvestmentDeclaration` model (1 day)

**Schema:**
```prisma
model InvestmentDeclaration {
  id              Int      @id @default(autoincrement())
  employeeId      Int
  financialYear   String   @db.NVarChar(10)
  section80C      Decimal  @default(0) @db.Decimal(18, 2)
  section80D      Decimal  @default(0) @db.Decimal(18, 2)
  hraExemption    Decimal  @default(0) @db.Decimal(18, 2)
  otherDeductions Decimal  @default(0) @db.Decimal(18, 2)
  totalDeclared   Decimal  @default(0) @db.Decimal(18, 2)
  proofSubmitted  Boolean  @default(false)
  approvedByUserId Int?
  approvedAt      DateTime?
  createdAt       DateTime @default(now())
  updatedAt       DateTime @updatedAt
  employee        Employee @relation(fields: [employeeId], references: [id])
  @@unique([employeeId, financialYear])
  @@map("InvestmentDeclaration")
}
```

### Task 4.4: Annual TDS calculation engine (3-4 days)

**Files:**
- `src/lib/tdsCalculation.ts` — new file

**Logic:**
```typescript
export async function calculateAnnualTds(employeeId, financialYear) {
  // 1. Get all PayrollLines for the FY (Apr-Mar)
  // 2. Sum grossEarnings → annual gross income
  // 3. Get InvestmentDeclaration → deductions
  // 4. taxableIncome = annualGross - standardDeduction - investments
  // 5. Slab-wise tax calculation using TDSSlab for the FY + regime
  // 6. Apply rebate if taxableIncome <= rebateThreshold
  // 7. Add surcharge based on TdsSurchargeSlab
  // 8. Add cess (4% on tax+surcharge)
  // 9. annualTax = slab tax - rebate + surcharge + cess
  // 10. monthlyTds = annualTax / 12
  // 11. balanceTax = annualTax - tdsAlreadyDeducted
  return { annualGross, taxableIncome, taxBeforeRebate, rebate, surcharge, cess, annualTax, monthlyTds, balanceTax };
}
```

### Task 4.5: TDS admin pages (2-3 days)

**Files:**
- `src/app/api/masters/tds-slabs/route.ts` — CRUD with FY + regime
- `src/app/masters/tds-slabs/page.tsx` — slab management
- `src/app/api/employees/[id]/investment-declaration/route.ts`
- `src/app/employees/[id]/investment-declaration/page.tsx` — employee declaration
- `src/app/payroll/statutory/tds/page.tsx` — TDS summary

### Task 4.6: Wire TDS to payroll (1-2 days)

**Files:**
- `src/lib/payrollCalculation.ts` — replace flat slab lookup with `calculateAnnualTds`

---

## Phase 5: Time Office Gaps (10-15 days)

### Task 5.1: Comp-Off auto-generation from biometric (2 days)

**Files:**
- `src/lib/biometricConversion.ts` — after computing daily attendance, check if Sunday/holiday + min hours → create comp-off entry
- `src/lib/attendanceHistory.ts` — hook into comp-off generation

### Task 5.2: Weekly OT aggregation in attendance (2 days)

**Files:**
- `src/lib/biometricConversion.ts` — aggregate OT by week, apply weekly threshold
- `src/app/api/workforce/attendance/ot/route.ts` — show weekly OT summary

### Task 5.3: Permission excess → auto LOP/LOM (1 day)

**Files:**
- `src/lib/attendanceHistory.ts` — when permission is approved and exceeds allowance, auto-create LOP/LOM entry
- `src/lib/payrollCalculation.ts` — consume permission excess as LOM minutes

### Task 5.4: Canteen token tracking from attendance (2 days)

**Files:**
- `src/lib/attendanceHistory.ts` — on present day, auto-create canteen token entry
- `src/app/api/workforce/canteen/route.ts` — CRUD
- `src/app/workforce/canteen/page.tsx`

### Task 5.5: Biometric monthly grid (3-4 days)

**Files:**
- `src/app/workforce/attendance/biometric/page.tsx` — rewrite as monthly grid
- Color-coded cells from `AttendanceColorConfig`
- Tooltips with full day detail
- Export to Excel/CSV/PDF
- Column selector

### Task 5.6: Time Office Final page (2 days)

**Files:**
- `src/app/api/workforce/attendance/time-office-final/route.ts`
- `src/app/workforce/attendance/time-office-final/page.tsx`
- Consolidated review + approval → "Ready for Payroll" status

---

## Implementation Schedule

| Week | Phase | Tasks |
|------|-------|-------|
| Week 1 | Phase 1 | Wire PF/ESI/OT/canteen/deduction/LOM/gross-split |
| Week 2-3 | Phase 2A | LomConfig, RoundingConfig, ValidationConfig, WorkflowConfig, DisplayConfig, Shift allowances |
| Week 4-5 | Phase 2B | OT enhancements, OT incentive slabs, weekly OT |
| Week 5-6 | Phase 2C | Loan module (EmployeeLoan, Recovery, payroll wiring) |
| Week 7 | Phase 2D | Comp-Off module |
| Week 8-9 | Phase 2E | Incentives (policy, double machine, canteen, petrol, heat) |
| Week 10 | Phase 2F | Statutory (LWF, state PT, health insurance, LIC) |
| Week 11 | Phase 2G | Leave encashment + Full & Final |
| Week 11-12 | Phase 2H | Attendance config (colors, probation leave) |
| Week 13-14 | Phase 3 | Outputs (bank file, summary, payslip PDF, reconciliation, Time Office Final) |
| Week 15-16 | Phase 4 | TDS annual engine |
| Week 17-18 | Phase 5 | Time Office gaps (comp-off auto, weekly OT, permission LOP, grid) |

---

## Migration Sequence

All migrations in order:

```
000035_lom_config
000036_shift_allowances (ShiftMaster fields)
000037_rounding_config
000038_payroll_validation_config
000039_payroll_workflow_config
000040_payroll_display_config
000041_ot_plan_enhancements
000042_ot_incentive_slab
000043_loan_type_enhancements
000044_employee_loan
000045_loan_recovery_transaction
000046_comp_off_policy
000047_comp_off_balance
000048_incentive_policy
000049_double_machine_entry
000050_canteen_token
000051_petrol_allowance_entry
000052_allowance_config
000053_lwf_rate
000054_pt_slab_enhancements
000055_health_insurance_config
000056_lic_deduction
000057_leave_master_enhancements
000058_leave_encashment_request
000059_full_and_final_settlement
000060_notice_pay_config
000061_attendance_color_config
000062_bank_file_config
000063_tds_slab_enhancements
000064_tds_surcharge_slab
000065_investment_declaration
000066_lom_amount_on_payroll_line
```

---

## What Gets Unblocked After Each Phase

| After Phase | What Works |
|-------------|-----------|
| Phase 1 | PF/ESI on correct wage base, OT threshold enforced, canteen/deduction auto-applied, LOM deducted, gross split auto-fill |
| Phase 2A | LOM configurable, rounding configurable, validations enforced, workflow stages configurable, display configurable, shift allowances auto-calculated |
| Phase 2B | OT with correct method + day-type rates, OT incentive slabs, weekly OT |
| Phase 2C | Loan auto-deduction, balance tracking, short close, hold/resume |
| Phase 2D | Comp-Off auto-generation, balance, utilization |
| Phase 2E | Attendance/shift/double-machine/petrol/heat incentives auto-calculated |
| Phase 2F | LWF, state-wise PT, health insurance, LIC auto-deducted |
| Phase 2G | Leave encashment, Full & Final settlement |
| Phase 3 | Bank file, payroll summary, bulk payslip PDF, reconciliation, Time Office Final |
| Phase 4 | Full annual TDS with regime, investments, rebate, surcharge, cess |
| Phase 5 | Comp-Off from biometric, weekly OT, permission→LOP, monthly grid |
