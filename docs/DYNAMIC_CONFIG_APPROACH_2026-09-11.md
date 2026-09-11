# Make Everything Dynamic — Configurable Payroll Engine

**Date:** 2026-09-11
**Approach:** Instead of waiting for 63 business decisions, build admin-configurable master pages so values can be set/changed at runtime without code changes.

---

## What Can Be Made Dynamic (54 of 63)

These can be built NOW as configurable master pages. Admin sets the values later — no business decision blocks development.

### Already Have Model — Just Need to Wire It (18)

| # | Decision | Existing Model/Field | What to Build |
|---|----------|---------------------|---------------|
| 1 | PF wage base | `SalaryComponent.includeInPf` flag | Wire payroll to sum only `includeInPf=true` components as PF wage |
| 2 | ESI wage base | `SalaryComponent.includeInEsi` flag | Wire payroll to sum only `includeInEsi=true` components as ESI wage |
| 3 | OT method | `OTPlan` model | Add `calculationBasis` field (BASIC / GROSS / BASIC_DA_HRA / FIXED_RATE) to OTPlan |
| 4 | OT day-type rates | `OTPlan.otRateMultiplier` | Add `weekdayMultiplier`, `weekendMultiplier`, `holidayMultiplier` fields |
| 5 | OT threshold | `OTPlan.applicableAfterMinutes` | Wire into payroll calculation (already exists, not consumed) |
| 6 | OT max per day | `OTPlan.maxOtHoursPerDay` | Wire into payroll validation |
| 7 | Canteen rate | `BenefitRateByEmployeeType` | Wire into payroll as auto-deduction |
| 8 | Petrol allowance | `JobInfo.petrolAllowance` flag | Build petrol model + wire to payroll |
| 9 | Gratuity components | `SalaryComponent.includeInGratuity` | Already wired in `gratuityCalculation.ts` |
| 10 | Gross split | `GrossSplitRule` model | Wire into salary revision component auto-fill |
| 11 | Deduction rates | `DeductionRate` model | Wire into payroll as auto-deduction |
| 12 | PT slabs | `ProfessionalTaxSlab` model | Add `stateCode` + `companyId` fields for state-wise config |
| 13 | TDS slabs | `TDSSlab` model | Add `financialYear`, `taxRegime` (OLD/NEW), `cessRate`, `surchargeSlabs` |
| 14 | PF rate | `PfRate` model | Already has employee/employer/pension rates — just confirm values are editable |
| 15 | ESI rate | `EsiRate` model | Already has employee/employer rates + ceiling — just confirm editable |
| 16 | Leave encashment | `LeaveMaster` | Add `encashmentAllowed` boolean + `encashmentFormula` (BASIC_DIV_26 / GROSS_DIV_30) |
| 17 | Permission free hours | `PermissionPolicy.freeHoursPerMonth` | Already configurable |
| 18 | Holiday types | `HolidayMaster.holidayType` | Already configurable (COMPANY/FESTIVAL/GOVERNMENT/OTHER) |

### Need New Model — Build as Configurable Master (24)

| # | Decision | New Model to Build | Configurable Fields |
|---|----------|-------------------|-------------------|
| 19 | LOM formula | `LomConfig` | `calculationBasis` (GROSS / BASIC), `multiplier` (1 or 2), `shiftDurationSource` (FIXED_8 / SHIFT_MASTER), `payrollDaysDenominator` (CALENDAR / FIXED_26) |
| 20 | LOM grace minutes | `LomConfig` | `graceMinutesExempt` (minutes exempt before LOM starts), `dailyLomCap` (max minutes per day) |
| 21 | Salary rounding | `RoundingConfig` | `roundingMode` (NONE / NEAREST_1 / NEAREST_5 / NEAREST_10 / NEAREST_100), `applyTo` (NET_ONLY / ALL_COMPONENTS) |
| 22 | Negative net salary | `PayrollValidationConfig` | `allowNegativeNet` (boolean), `minNetPercentOfGross` (0-100), `requireApprovalIfNegative` (boolean) |
| 23 | Deduction limit | `PayrollValidationConfig` | `maxDeductionPercentOfGross` (0-100), `statutoryIncluded` (boolean) |
| 24 | LWF | `LwfRate` | `stateCode`, `employeeContribution`, `employerContribution`, `wageBase` (GROSS / BASIC), `wageCeiling`, `frequency` (MONTHLY / HALF_YEARLY), `effectiveFrom/To` |
| 25 | Comp-Off | `CompOffPolicy` | `minHoursOnSundayHoliday`, `autoGenerate` (boolean), `expiryMonths`, `encashable` (boolean), `encashmentFormula` |
| 26 | Comp-Off balance | `CompOffBalance` | `employeeId`, `year`, `earned`, `utilized`, `expired`, `closingBalance` |
| 27 | Loan/Advance | `EmployeeLoan` | `employeeId`, `loanTypeId`, `amount`, `repayAmount`, `issueDate`, `noOfMonths`, `installmentAmount`, `startYear`, `startMonth`, `endYear`, `endMonth`, `status` (OPEN/CLOSED/SHORTCLOSED/HOLD/CANCELLED), `outstandingBalance` |
| 28 | Loan recovery | `LoanRecoveryTransaction` | `employeeLoanId`, `payrollRunId`, `amount`, `month`, `year`, `balanceAfter` |
| 29 | Loan master enhance | `LoanType` (add fields) | `loanCategory` (LOAN/ADVANCE), `interestApplicable`, `interestRate`, `interestType` (NONE/FLAT), `maxTenure`, `deductionFrequency`, `payrollDeductionCode`, `multipleLoanAllowed`, `deductionPriority` |
| 30 | Night shift allowance | `ShiftMaster` (add fields) | `nightAllowanceAmount`, `nightAllowanceFromHour` (e.g. 22) |
| 31 | Snacks/Food/Meals allowance | `ShiftMaster` (add fields) | `snacksAllowanceAmount`, `foodAllowanceAmount`, `mealsAllowanceAmount`, `perDayOrPerMonth` |
| 32 | Heat allowance | `AllowanceConfig` | `componentCode`, `amount`, `eligibility` (ALL / DESIGNATION / DEPARTMENT / SHIFT), `eligibilityValue` |
| 33 | Attendance bonus | `IncentivePolicy` | `type` (ATTENDANCE_BONUS), `amount`, `eligibilityCriteria` (JSON: {fullAttendance: true, noLop: true}) |
| 34 | Shift bonus | `IncentivePolicy` | `type` (SHIFT_BONUS), `amount`, `eligibleShiftCodes` (array) |
| 35 | Double machine | `DoubleMachineEntry` | `employeeId`, `date`, `machine1`, `machine2`, `numMachines`, `workingHours`, `incentiveRate`, `calculatedIncentive`, `status` |
| 36 | Other incentives | `IncentivePolicy` | `type` (PRODUCTION / SPECIAL / PERFORMANCE / OTHER), `amount`, `formula` (JSON), `eligibility` (JSON) |
| 37 | Health insurance | `HealthInsuranceConfig` | `schemeName`, `employeeContribution`, `employerContribution`, `frequency` (MONTHLY/QUARTERLY/ANNUAL), `perEmployeeOrPerFamily`, `taxExempt80D` (boolean) |
| 38 | LIC deduction | `LicDeductionConfig` | `employeeId`, `policyNumber`, `amount`, `frequency`, `taxExempt80C` (boolean) |
| 39 | Canteen token | `CanteenToken` | `employeeId`, `date`, `tokensUsed`, `ratePerToken`, `employeeContribution`, `companyContribution` |
| 40 | Petrol allowance entry | `PetrolAllowanceEntry` | `employeeId`, `month`, `travelDate`, `km`, `ratePerKm`, `eligibleAmount`, `approvedAmount`, `managerApprovalStatus` |
| 41 | Leave encashment | `LeaveEncashmentRequest` | `employeeId`, `leaveMasterId`, `daysEncashed`, `dailyRate`, `amount`, `status`, `encashmentType` (WHILE_EMPLOYED / EXIT) |
| 42 | Full & Final | `FullAndFinalSettlement` | `employeeId`, `exitDate`, `components` (JSON array), `salaryUpToDate`, `leaveEncashment`, `gratuity`, `noticePayRecovery`, `loanOutstanding`, `assetRecovery`, `bonus`, `incentive`, `totalPayable`, `totalRecoverable`, `netAmount`, `status` |
| 43 | Notice pay | `NoticePayConfig` | `noticePeriodDays`, `calculationBasis` (BASIC / GROSS), `buyoutAllowed` (boolean) |
| 44 | Break time | `ShiftMaster` (add fields) | `breakMinutes` (lunch/tea break deducted from working duration) |
| 45 | Probation leave | `LeaveMaster` (add fields) | `probationEligible` (boolean), `probationMaxDays` |
| 46 | Attendance color thresholds | `AttendanceColorConfig` | `companyId`, `zeroHoursColor`, `shortHoursColor`, `shortHoursThreshold`, `partialHoursColor`, `partialHoursThreshold`, `normalHoursColor`, `normalHoursThreshold`, `extendedHoursColor`, `weeklyOffColor` |
| 47 | OT incentive slabs | `OtIncentiveSlab` | `otPlanId`, `minHours`, `maxHours`, `incentiveAmount` |
| 48 | Weekly OT | `OtPlan` (add fields) | `weeklyOtThresholdHours`, `weeklyAggregationEnabled` (boolean) |
| 49 | Monthly OT limit | `OtPlan` (add fields) | `maxOtHoursPerMonth` |
| 50 | State-wise PT | `ProfessionalTaxSlab` (add fields) | `stateCode`, `companyId`, `halfYearlyAmount`, `annualCap` |
| 51 | Investment declarations | `InvestmentDeclaration` | `employeeId`, `financialYear`, `section80C`, `section80D`, `hraExemption`, `otherDeductions`, `totalDeclared`, `proofSubmitted` (boolean) |
| 52 | TDS config enhance | `TDSSlab` (add fields) | `financialYear`, `taxRegime`, `rebateThreshold`, `rebateAmount`, `surchargeSlabs` (JSON), `cessRate` |
| 53 | Deduction % display | `PayrollDisplayConfig` | `showDeductionPercent` (boolean), `decimalPlaces` |
| 54 | Bonus types | `BonusRate` (add fields) | `bonusType` (STATUTORY / FESTIVAL / PERFORMANCE / EX_GRATIA / PRODUCTION), `monthlyAccrual` (boolean) |

### Workflow — Build as Configurable Stages (3)

| # | Decision | How to Make Dynamic |
|---|----------|-------------------|
| 55 | Payroll workflow stages | `PayrollWorkflowConfig` — admin enables/disables VALIDATED, SUBMITTED, POSTED stages. System uses only enabled stages. |
| 56 | Approval chain | `ApprovalMatrix` — admin configures which roles approve at each stage. Already partially exists in RBAC. |
| 57 | Payroll cutoff | `PayrollPeriodConfig` — admin sets cutoff date per month, lock rules, reopen rules |

---

## What CANNOT Be Dynamic — Truly Needs Business Input (9)

These need real-world information that can't be guessed or defaulted:

| # | Decision | Why It Can't Be Dynamic |
|---|----------|------------------------|
| 1 | **Bank file format** | Each bank has a specific file format. Must get the actual format spec from the bank. Can build a generic CSV/TXT builder with configurable fields, but the exact bank format must be provided. |
| 2 | **SMTP server for email** | Need actual SMTP credentials (host, port, user, password) to send payslip emails. |
| 3 | **Which states company operates in** | Need actual state list to configure state-wise PT/LWF. System can support all states, but admin must select which ones apply. |
| 4 | **Payslip password type** | Need to decide: DOB / employee code / PAN / custom. Can make it configurable, but need initial choice. |
| 5 | **Biometric device API details** | Already configured, but if changing devices, need new API spec. |
| 6 | **Financial year start** | April-March (standard Indian FY) or custom? BRD says Apr-Mar. Confirm. |
| 7 | **Go-live date** | When does this system go live? Affects data migration, opening balances, first payroll period. |
| 8 | **Data migration scope** | Which historical data to migrate (employees, attendance, payroll, leave balances)? How many years? |
| 9 | **Existing loan data** | If employees have existing loans, need opening balances (loan amount, outstanding, installment). |

---

## Implementation Approach

### Phase 1: Wire Existing Config (no new models needed)

These use models that already exist — just connect them to payroll calculation:

1. PF wage base → use `includeInPf` flag
2. ESI wage base → use `includeInEsi` flag
3. OT threshold → consume `OTPlan.applicableAfterMinutes`
4. OT max per day → consume `OTPlan.maxOtHoursPerDay`
5. Canteen → wire `BenefitRateByEmployeeType` to payroll
6. Deduction rates → wire `DeductionRate` to payroll
7. Gross split → wire `GrossSplitRule` to salary revision

**Effort:** ~5-7 days. No new models. No migrations. Just logic changes in `payrollCalculation.ts`.

### Phase 2: New Config Models + Payroll Wiring

Build new configurable models and wire them:

1. `LomConfig` → LOM deduction in payroll
2. `RoundingConfig` → salary rounding
3. `PayrollValidationConfig` → negative net salary + deduction limits
4. `CompOffPolicy` + `CompOffBalance` → comp-off generation + balance
5. `EmployeeLoan` + `LoanRecoveryTransaction` → loan auto-deduction
6. `OtIncentiveSlab` → OT incentive calculation
7. `OtPlan` enhancements (weekly/monthly OT, day-type multipliers)
8. `ShiftMaster` enhancements (night/snacks/food/break)
9. `IncentivePolicy` → attendance/shift/production/other bonuses
10. `AttendanceColorConfig` → biometric grid colors
11. `PayrollWorkflowConfig` → configurable stages
12. `LwfRate` → LWF deduction
13. `HealthInsuranceConfig` → health insurance deduction
14. `LeaveEncashmentRequest` → leave encashment
15. `FullAndFinalSettlement` → FnF calculation
16. `NoticePayConfig` → notice pay
17. `InvestmentDeclaration` → TDS deductions
18. `TDSSlab` enhancements → annual TDS engine
19. `ProfessionalTaxSlab` enhancements → state-wise PT
20. `DoubleMachineEntry` → double machine incentive
21. `CanteenToken` → canteen tracking
22. `PetrolAllowanceEntry` → petrol tracking

**Effort:** ~30-40 days. New models + migrations + payroll logic + admin pages.

### Phase 3: Outputs

1. Bank Transfer File (generic CSV/TXT builder with configurable fields)
2. Payroll Summary (configurable breakdown dimensions)
3. Bulk Payslip PDF (password-protected, configurable password type)
4. Payroll Reconciliation
5. Time Office Final page
6. Biometric monthly grid with color coding

**Effort:** ~15-20 days.

### Phase 4: TDS Annual Engine

Full annual TDS with regime selection, exemptions, rebate, surcharge, cess:

1. `TDSSlab` with regime + FY
2. `InvestmentDeclaration` module
3. Annual tax computation
4. Monthly TDS projection
5. Form 16 / tax statement

**Effort:** ~10-15 days.

---

## Summary

| Category | Count | Approach |
|----------|-------|----------|
| Wire existing config | 18 | Just connect to payroll — no new models |
| New configurable models | 24 | Build master pages — admin sets values later |
| Workflow configurable | 3 | Admin enables/disables stages |
| Truly needs business input | 9 | Bank format, SMTP, states, go-live, migration |
| **Total** | **54 dynamic + 9 business** | |

**54 of 63 decisions can be made dynamic.** Build configurable admin pages now — business sets the actual values whenever ready. No more waiting.

Only 9 items truly need business input (bank format, SMTP, state list, go-live date, data migration scope).
