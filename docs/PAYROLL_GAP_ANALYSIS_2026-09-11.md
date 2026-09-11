# Payroll Module Gap Analysis — Workforce → Payroll

**Document:** `docs/PAYROLL_GAP_ANALYSIS_2026-09-11.md`
**Source BRD:** `/Users/sukimacbook01/Downloads/Suki Kun Payroll.docx`
**Audit Date:** 2026-09-11
**Audited Commit:** `068cb57` (latest from `gitlab/main`)

---

## Executive Summary

The BRD defines **23 major sections** covering the full payroll pipeline from attendance inputs through statutory calculations, deductions, outputs, and process controls. The current codebase implements a **Phase 1 payroll engine** that handles the core calculate → approve → lock flow with basic PF/ESI/PT/TDS, but **17 of the 23 BRD sections have significant gaps**.

**Overall completion: ~30% of BRD scope.**

| Status | Count | Sections |
|--------|-------|----------|
| ✅ Substantially implemented | 4 | Salary Revision, Arrears (basic), Bonus (basic), Payslip (individual) |
| ⚠️ Partially implemented | 6 | Salary Processing flow, PF, ESI, PT, TDS, Attendance inputs |
| ❌ Not implemented | 13 | Leave Encashment, LWF, Loan Recovery, Health Insurance, Other Deductions, Bank Transfer File, Payroll Summary, Reconciliation, Bulk Payslip, LOM, Full TDS engine, Salary Rounding, Full & Final, Other Incentives, Bulk processing, Validations, Error handling, Status classification |

---

## Section-by-Section Gap Analysis

### 1. Salary Processing Flow (BRD §1, §20, §28)

**BRD requires:** Full pipeline: Employee Master → Salary Structure → Attendance & Leave → OT → Incentive/Bonus → Allowance → Deduction → Statutory → Gross → Net → Validation → Manager/HR Approval → Finance Approval → Finalization → Payslip → Bank/Payment → Reports → Period Closure.

**Status flow required:** `DRAFT → CALCULATED → VALIDATED → SUBMITTED → APPROVED → POSTED → LOCKED`

**Current implementation:**
- ✅ `PayrollRun` model with `DRAFT → CALCULATED → APPROVED → LOCKED` (compressed — no VALIDATED/SUBMITTED/POSTED stages)
- ✅ `calculatePayrollRun()` in `src/lib/payrollCalculation.ts` — reads `EmployeeSalaryRevision` + `MonthlyAttendanceSummary` + `JobInfo`
- ✅ Single-approver flow (approve → lock), not the BRD's Manager → HR → Finance multi-stage
- ❌ No VALIDATED stage (no separate validation pass before submission)
- ❌ No SUBMITTED stage (no submission step between calculation and approval)
- ❌ No POSTED stage (no posting-to-generalledger concept)
- ❌ No Finance Approval stage
- ❌ No Period Closure / reopen-after-lock mechanism

**Gap:** 4 missing workflow stages, 2 missing approval roles.

---

### 2. Attendance & Working-Day Inputs (BRD §2)

**BRD requires:** Days in Month, Days Worked, Paid Holidays, Earned Leave, Casual Leave, Sick Leave, Loss of Minutes, No. of Paid Leaves, No. of Layoff Days, Total Work Hours, Actual Attendance, Overtime Hours.

**Formula:**
```
Payable Days = Days Worked + Paid Holidays + Eligible Paid Leave + Other Paid Days
LOP Days = Total Working Days − Payable Days
LOP Amount = Daily Salary × LOP Days
Hourly Rate = Applicable Salary / Standard Working Hours
OT Amount = OT Hours × OT Rate
```

**Current implementation:**
- ✅ `MonthlyAttendanceSummary` has: `totalWorkingDays`, `payableDays`, `presentDays`, `absentDays`, `leaveDays`, `lopDays`, `otMinutesTotal`, `lateMinutesTotal`, `earlyOutMinutesTotal`
- ✅ `payrollCalculation.ts` reads `payableDays` and computes `lopFactor = payableDays / totalWorkingDays`
- ✅ LOP proration applied to all recurring earning/deduction components
- ❌ No `paidHolidays` field — holidays are not separately tracked in the summary
- ❌ No `earnedLeave` / `casualLeave` / `sickLeave` breakdown — all leave collapsed into `leaveDays`
- ❌ No `layoffDays` field
- ❌ No `totalWorkHours` field
- ❌ No `actualAttendance` field (distinct from presentDays)
- ❌ No `lossOfMinutes` field in MonthlyAttendanceSummary — `lateMinutesTotal` and `earlyOutMinutesTotal` exist but are **not consumed by payroll** (see §11 LOM below)

**Gap:** 7 missing attendance input fields, no leave-type breakdown, LOM not wired to payroll.

---

### 3. Salary Additions / Earnings (BRD §3)

**BRD requires — Fixed/Regular Earnings:** Basic, HRA, FDA, Conveyance Allowance, DA, Special Allowance, AHRA, Washing Allowance, LTA, Travel Allowance, Other Allowance 1 & 2, Education Allowance, Performance Allowance, Productivity Incentive, Food Allowance, Night Shift Allowance, Heat Allowance, Snacks Allowance.

**BRD requires — Variable Earnings:** Overtime Amount, Performance Incentive, Attendance Incentive, Festival/Other Incentive, Arrears, Miscellaneous Allowance, Bonus.

**Current implementation:**
- ✅ `SalaryComponent` model supports unlimited earning components (type: `"earning"`)
- ✅ `EmployeeSalaryComponent` links components to employee salary revisions
- ✅ `PayrollLineComponent` itemizes each earning on the payslip
- ✅ OT amount calculated separately and stored on `PayrollLine.otAmount`
- ✅ Arrears applied as ad-hoc `PayrollLineComponent` rows
- ✅ Bonus applied as ad-hoc `PayrollLineComponent` rows (via `bonusApply.ts`)
- ⚠️ No distinction between "Fixed/Regular" and "Variable" earnings — all earning components are treated the same way in calculation
- ❌ No "Attendance Incentive" calculation logic
- ❌ No "Night Shift Allowance" auto-calculation from `ShiftMaster.nightAllowed`
- ❌ No "Heat Allowance" calculation
- ❌ No "Snacks/Food Allowance" auto-calculation from `ShiftMaster.snacksAllowed/mealsAllowed`
- ❌ No "Productivity Incentive" calculation

**Gap:** No variable-earning auto-calculation logic; shift-based allowances not wired to payroll.

---

### 4. Gross Salary Calculation (BRD §4)

**BRD requires:**
```
Gross Salary = Total Earnings − Loss of Pay
   OR (if LOP already in Basic/allowances):
Gross Salary = Sum of all applicable earning components
```
Gross Salary should be **read-only and auto-calculated**.

**Current implementation:**
- ✅ `grossEarnings` computed as sum of LOP-prorated earning components
- ✅ LOP applied via `lopFactor` (uniform proration across all components)
- ✅ `grossEarnings` stored on `PayrollLine`, displayed read-only on payslip
- ⚠️ OT amount is **added on top** of gross (`grossEarnings + otAmount + otherEarningsTotal`), not included in "Gross Salary" per BRD's definition
- ❌ No configurable choice between "Gross = Total Earnings − LOP" vs "Gross = Sum of components (LOP already embedded)"

**Gap:** OT/other earnings not part of Gross per BRD definition; no configurable LOP-in-gross mode.

---

### 5. OT Module (BRD §5 — Overtime)

**BRD requires 4 OT calculation methods:**
1. **From Basic × 2:** `Hourly Rate = Basic / 26 / 8; OT = Hourly Rate × OT Hours × 2`
2. **From Gross (Dynamic):** `Hourly Rate = Gross / 31 / 8; OT = Hourly Rate × OT Hours × Factor`
3. **Fixed OT Rate:** `OT = Hourly Rate × OT Hours × Factor`
4. **From Basic+DA+HRA+Allowance (Dynamic):** `Hourly Rate = (Basic+DA+HRA+Other) / 31 / 8; OT = Hourly Rate × OT Hours × Factor`

Also: Weekday OT, Weekend OT, Holiday OT with different rates.

**Current implementation:**
- ✅ `OTPlan` model with `otRateMultiplier`, `applicableAfterMinutes`, `maxOtHoursPerDay`, `payComponentId`
- ✅ OT minutes tracked in `DailyAttendance.otMinutesCalculated` / `otMinutesApproved`
- ✅ Two-stage OT approval (Manager → HR) via `otApprovalStatus`
- ✅ OT settlement type (OT vs COMP_OFF) for Sunday/Holiday work
- ✅ Basic OT calculation in `payrollCalculation.ts`:
  - If `overtimeRatePerHour` set → `OT = otHours × ratePerHour`
  - Else → `OT = otHours × (grossSalary / totalWorkingDays / 8) × overtimeFactor`
- ❌ **No method selection** — only one calculation path, not the 4 BRD methods
- ❌ No "From Basic × 2" method (uses gross, not basic)
- ❌ No "From Basic+DA+HRA+Allowance" method
- ❌ No distinction between Weekday / Weekend / Holiday OT rates
- ❌ No "Fixed OT Rate" as a distinct method (only via `overtimeRatePerHour` on JobInfo)
- ❌ `OTPlan.applicableAfterMinutes` not consumed in payroll calculation
- ❌ `OTPlan.maxOtHoursPerDay` not enforced in payroll calculation
- ❌ `OTPlan.payComponentId` not used to create a payslip line item for OT

**Gap:** 3 of 4 OT methods missing; no weekday/weekend/holiday differentiation; OTPlan config not consumed.

---

### 6. Arrears & Salary Adjustment (BRD §5 — Arrears)

**BRD requires:** Salary correction, Basic salary revision arrears, Salary increment arrear, Allowance arrears, Deduction reversal, Attendance correction, Incentive correction, Manual adjustment.

**Current implementation:**
- ✅ `SalaryArrear` model with `oldGross`, `revisedGross`, `grossArrearTotal`, `pfArrearTotal`, `esiArrearTotal`, `netArrearTotal`
- ✅ `calculateArrear()` in `src/lib/arrearCalculation.ts` — computes per-month difference from actual `PayrollLine.grossEarnings`
- ✅ Monthly breakdown via `SalaryArrearMonth`
- ✅ Applied to payroll run as ad-hoc components via `applyArrear` endpoint
- ✅ PF/ESI arrear calculated (mirrors payroll's wage-basis convention)
- ❌ No "Allowance arrears" (only gross-level arrear, not per-component)
- ❌ No "Deduction reversal" arrear type
- ❌ No "Attendance correction" arrear type
- ❌ No "Incentive correction" arrear type
- ❌ No "Manual adjustment" arrear type
- ❌ No PT/TDS arrear (documented as intentionally omitted)

**Gap:** Only gross-level salary revision arrears supported; 5 of 7 arrear types missing.

---

### 7. Bonus / Incentive Details (BRD §6)

**BRD requires fields:** Bonus Type, Eligibility, Current Month Amount, Accumulated Amount, Financial Year, Paid Amount, Balance Amount.

**Current implementation:**
- ✅ `BonusRecord` model with `acYear`, `eligibilityStatus`, `calculationType`, `annualBonusWage`, `bonusPercent`, `bonusAmount`
- ✅ `BonusRate` model with `calculationType` (BASIC_PROJECTION / ACTUAL_NET_PAY), `ratePercent`, `wageEligibilityCeiling`, `minWorkingDays`
- ✅ `bonusCalculation.ts` — two calculation methods
- ✅ Applied to payroll as ad-hoc earning component
- ✅ Status workflow: PENDING → CALCULATED → APPROVED → PROCESSED
- ❌ No "Bonus Type" categorization (festival bonus, performance bonus, etc.)
- ❌ No "Current Month Amount" vs "Accumulated Amount" split
- ❌ No "Paid Amount" vs "Balance Amount" tracking across months
- ❌ No "Accumulated Amount" concept (bonus is a single annual calculation, not monthly accrual)

**Gap:** No monthly accrual/partial payment tracking; no bonus type categorization.

---

### 8. Salary Deductions (BRD §7)

**BRD requires — Statutory Deductions:** PF, ESI, Professional Tax, TDS.

**BRD requires — Employee Recovery / Other Deductions:** Salary Advance, Loan Deduction, Bank Loan, Festival Advance, Vehicle Advance, Education Loan, Canteen, G.House/Hostel, Mobile Deduction, Transport Deduction, Lunch/P.D., LIC, Medical Insurance, TDS, Income Tax, Other Deduction 1 & 2, Loss of Pay Amount, Loss of Minute Amount.

**Formula:**
```
Total Deduction = PF + ESI + PT + TDS + Loans + Advances + Other Deductions
Net Salary = Gross Salary − Total Deduction
```

**Current implementation:**
- ✅ PF, ESI, PT, TDS calculated in `payrollCalculation.ts`
- ✅ `otherDeductionsTotal` on `PayrollLine` — sum of ad-hoc deduction components
- ✅ `PayrollLineComponent` with `isAdhoc: true` for manual deductions
- ✅ `DeductionRate` model exists (catch-all rate table)
- ❌ **No `EmployeeLoan` / `LoanRecovery` model** — `LoanType` exists but no employee loan instances or recovery schedule
- ❌ No `EmployeeAdvance` model or recovery logic
- ❌ No automatic loan/advance deduction during payroll processing
- ❌ No outstanding balance tracking or update after payroll
- ❌ No Canteen/Mobile/Transport/Lunch auto-deduction (only manual ad-hoc)
- ❌ No LIC / Medical Insurance / Income Tax as structured deductions
- ❌ No "Loss of Pay Amount" as a separate deduction line (it's embedded in proration)
- ❌ No "Loss of Minute Amount" deduction (see §11)
- ❌ `DeductionRate` table not consumed by payroll calculation

**Gap:** No loan/advance module at all; 10+ deduction types are manual-only; DeductionRate not wired.

---

### 9. PF Calculation (BRD §8)

**BRD requires:**
```
PF Employee = 12% of PF Wage (Basic + DA)
PF Employer = 13% (split into EPF 3.67% + EPS 8.33%)
PF Wage Ceiling = Configurable
PF Applicable = Yes/No (per employee)
```

**Current implementation:**
- ✅ `PfRate` model with `employeeContributionRate`, `employerContributionRate`, `pensionContributionRate`, `wageCeilingMonthly`
- ✅ PF calculated in `payrollCalculation.ts`:
  - `pfWage = min(grossEarnings, pfWageCap)` where `pfWageCap = min(statutory ceiling, JobInfo.pfRestrictionAmount)`
  - `pfEmployee = pfWage × employeeRate%`
  - `pfEmployer = pfWage × employerRate% − epsEmployer`
  - `epsEmployer = pfWage × pensionRate%`
- ✅ Per-employee `pfApplicable` toggle on `PayrollLine`
- ✅ `SalaryComponent.includeInPf` flag exists (KUN BRD review)
- ⚠️ PF wage basis is **full LOP-adjusted gross earnings**, not "Basic + DA" per BRD — documented simplification
- ❌ `SalaryComponent.includeInPf` flag **not consumed** in PF wage calculation (wage = full gross, not component-flag-filtered)
- ❌ No "PF Restricted" vs "PF Actual" display on payslip

**Gap:** PF wage base doesn't use component-level `includeInPf` flag; uses full gross instead of Basic+DA.

---

### 10. ESI Calculation (BRD §9)

**BRD requires:**
```
ESI Employee = 0.75% of Applicable ESI Wage (Actual Gross)
ESI Employer = 3.25%
ESI Wage Limit = Configurable ceiling
ESI Applicable = Yes/No
```

**Current implementation:**
- ✅ `EsiRate` model with `employeeContributionRate`, `employerContributionRate`, `wageCeilingMonthly`
- ✅ ESI calculated in `payrollCalculation.ts`:
  - Eligibility: `grossSalary <= wageCeiling` OR `grossEarnings <= wageCeiling`
  - `esiEmployee = grossEarnings × employeeRate%`
  - `esiEmployer = grossEarnings × employerRate%`
- ✅ Per-employee `esiApplicable` from `JobInfo`
- ✅ `SalaryComponent.includeInEsi` flag exists (KUN BRD review)
- ❌ `SalaryComponent.includeInEsi` flag **not consumed** in ESI wage calculation

**Gap:** ESI wage base doesn't use component-level `includeInEsi` flag.

---

### 11. Professional Tax Calculation (BRD §10)

**BRD requires:** Slab-based monthly PT:
| Salary From | Salary To | Monthly PT |
|-------------|-----------|------------|
| 0 | 7,500 | 0.00 |
| 7,501 | 10,000 | 115.00 |
| 10,001 | 12,500 | 171.00 |
| 12,501 | Above | 208.00 |

**Current implementation:**
- ✅ `ProfessionalTaxSlab` model with `minSalary`, `maxSalary`, `monthlyAmount`
- ✅ PT calculated in `payrollCalculation.ts` via slab lookup against `grossEarnings`
- ✅ Per-employee `ptApplicable` from `JobInfo`
- ✅ Half-yearly PT (Jun/Dec) not implemented — BRD says "Monthly basis"
- ⚠️ Slabs are **global** (not company-scoped) — may need state-wise slabs
- ❌ No state-wise PT configuration

**Gap:** No state-wise PT slabs; slabs are global not company-scoped.

---

### 12. Loss of Minutes (LOM) Calculation (BRD §11)

**BRD requires:**
```
LOM Deduction = Gross Salary ÷ Payroll Days ÷ Shift Duration(8) ÷ 60 × LOM Minutes
```
Two methods:
1. **From Gross:** `LOM = Gross / 30 / 8 / 60 × 100`
2. **From Basic × 2:** `LOM = Basic / 30 / 8 / 60 × 100 × 2`

**Current implementation:**
- ❌ **LOM is NOT calculated or deducted in payroll at all**
- ⚠️ `MonthlyAttendanceSummary` has `lateMinutesTotal` and `earlyOutMinutesTotal` fields
- ⚠️ `DailyAttendance` has `lateMinutes` and `earlyOutMinutes` fields
- ❌ These minute totals are **not consumed** by `payrollCalculation.ts`
- ❌ No LOM deduction line on payslip
- ❌ No configurable LOM method (Gross-based vs Basic-based)
- ❌ No shift-duration-aware per-minute rate calculation
- ❌ `DeductionRate.isLop` flag exists but is not consumed

**Gap:** Entire LOM module missing from payroll calculation. Attendance data exists but is not wired.

---

### 13. Tax / TDS Calculation (BRD §12)

**BRD requires:**
- Tax slabs as configurable master data
- Per-slab: Financial Year, Tax Regime (Old/New), Income From, Income To
- Full annual tax statement:
  ```
  Annual Gross Income − Exemptions − Deductions = Taxable Income
  Taxable Income → Slab-wise tax → Rebate → Surcharge → Cess = Annual Tax
  Annual Tax − TDS Already Deducted = Balance Tax Payable
  ```

**Current implementation:**
- ✅ `TDSSlab` model with `minSalary`, `maxSalary`, `ratePercent`, `effectiveFrom/To`
- ⚠️ TDS calculated as **flat single-slab monthly lookup** against gross earnings:
  ```
  tds = grossEarnings × ratePercent%
  ```
- ❌ No Financial Year field on TDSSlab
- ❌ No Tax Regime (Old/New) support
- ❌ No annual tax computation (only monthly flat rate)
- ❌ No exemptions/deductions (80C, 80D, HRA exemption, etc.)
- ❌ No rebate (₹12,500 under ₹5L)
- ❌ No surcharge (high-income slabs)
- ❌ No cess (4% health & education)
- ❌ No TDS already-deducted tracking / balance computation
- ❌ No tax statement / Form 16 generation
- ❌ No investment declaration module

**Gap:** TDS is a flat monthly estimate only. Full annual TDS engine with regime selection, exemptions, rebate, surcharge, cess, and balance tracking is entirely missing.

---

### 14. Loan & Advance Recovery (BRD §13)

**BRD requires:** Salary Advance, Loan Deduction, Bank Loan, Vehicle Advance, Education Loan, Festival Advance.

**Requirements:**
- Outstanding liabilities retrieved from relevant module
- Monthly recovery applied during payroll processing
- Recovery ≤ outstanding balance
- Balance updated after successful salary processing
- Manual override requires authorization
- Transaction history for each recovery

**Current implementation:**
- ✅ `LoanType` model with `minAmount`, `maxAmount` (KUN BRD review)
- ❌ **No `EmployeeLoan` model** — no loan instances per employee
- ❌ **No `EmployeeAdvance` model**
- ❌ **No `LoanInstallment` / recovery schedule model**
- ❌ No outstanding balance tracking
- ❌ No automatic deduction during payroll processing
- ❌ No balance update after payroll
- ❌ No transaction history
- ❌ No manual override with authorization
- ❌ Loans/advances can only be added as manual ad-hoc `PayrollLineComponent` rows

**Gap:** Entire loan/advance recovery module missing. Only the `LoanType` definition master exists.

---

### 15. Labour Welfare Fund (LWF) (BRD §14)

**BRD requires:** LWF coverage based on state legislation, establishment registration, and applicable exclusions. HR/Payroll maintains LWF applicability status.

**Current implementation:**
- ❌ **No `LwfRate` / `LabourWelfareFund` model anywhere in schema**
- ❌ No LWF calculation in payroll
- ❌ No LWF applicability flag on employee/jobinfo
- ❌ Navigation has `/payroll/statutory/lwf` but no page exists
- ❌ Schema comment explicitly lists LWF as deferred: "LWF (no master anywhere)"

**Gap:** Entirely missing. No model, no calculation, no page, no API.

---

### 16. Salary Rounding (BRD §15)

**BRD requires:**
```
Net Salary After Rounding = Net Salary Before Rounding + Round Off
```
Configurable rounding: No rounding, Nearest whole number, Nearest 5, Nearest 10, Other business rules.

**Current implementation:**
- ⚠️ `Math.round()` used throughout `payrollCalculation.ts` — always rounds to nearest integer
- ❌ No configurable rounding rule
- ❌ No rounding mode selection (nearest 1/5/10/etc.)
- ❌ No "Round Off" amount displayed separately on payslip
- ❌ No `RoundingConfig` model
- ❌ No company-level rounding configuration

**Gap:** Rounding is hardcoded to `Math.round()`; no configurable rounding rules.

---

### 17. Total Deduction Percentage (BRD §16)

**BRD requires:**
```
Total Deduction % = (Total Deduction / Gross Salary) × 100
```
Displayed to configured decimal places. If Gross = 0, then 0%.

**Current implementation:**
- ❌ **Not calculated or displayed** on payslip or payroll summary
- ⚠️ All values exist to compute it (`grossEarnings`, `otherDeductionsTotal`, `pfEmployee`, `esiEmployee`, `professionalTax`, `tds`)
- ❌ No decimal-place configuration

**Gap:** Not displayed despite data being available.

---

### 18. Mandatory Validations (BRD §17)

**BRD requires 12 validations before Save/Process:**
1. Employee code must exist
2. Salary structure must be active
3. Payroll month should not already be processed
4. Days worked cannot exceed payable working days
5. Leave cannot exceed available balance
6. OT hours must be within configured limits
7. Gross salary must reconcile with earnings
8. Total deduction cannot exceed configured limits without approval
9. Net salary should not become negative without authorization
10. PF/ESI/PT should be calculated according to active statutory configuration
11. Loan deduction cannot exceed outstanding balance
12. Duplicate payroll for same employee/month must be prevented

**Current implementation:**
- ✅ #1: Employees without salary revision are skipped (`if (!revision) continue`)
- ✅ #3: `@@unique([companyId, year, month])` on `PayrollRun` prevents duplicate runs
- ✅ #12: `@@unique([payrollRunId, employeeId])` on `PayrollLine` prevents duplicate lines
- ⚠️ #2: "Active" salary = `effectiveTo: null` check, not an explicit `isActive` flag
- ❌ #4: No validation that days worked ≤ payable working days
- ❌ #5: No leave balance validation during payroll (done at leave application time only)
- ❌ #6: `OTPlan.maxOtHoursPerDay` not enforced in payroll
- ❌ #7: No gross-vs-earnings reconciliation check
- ❌ #8: No deduction limit validation
- ❌ #9: No negative net salary check
- ❌ #10: PF/ESI/PT use active config but no explicit validation pass
- ❌ #11: No loan balance check (no loan module)

**Gap:** 8 of 12 validations missing. No dedicated validation stage in the workflow.

---

### 19. Process Controls & Status (BRD §19, §23)

**BRD requires buttons:** Search → Calculate → Validate → Save Draft → Submit → Approve → Lock Payroll → Generate Payslip.

**BRD requires statuses:**
- `DRAFT → CALCULATED → VALIDATED → SUBMITTED → APPROVED → POSTED → LOCKED`

**BRD §23 requires 3 payroll statuses:**
- **COMPLETED:** Salary calculated, validated, finalized, payslip available
- **HOLD:** Intentionally stopped; reason captured; visible prominently; user/date/time captured; release triggers recalculation
- **PENDING:** Not completed; reason identified; available for processing; included in monitoring/exception reporting

**Current implementation:**
- ✅ `PayrollRun.status`: `DRAFT → CALCULATED → APPROVED → LOCKED`
- ✅ `PayrollLine.status`: `OK | HOLD` with `holdReason`
- ✅ Buttons: Create Run → Calculate → Approve → Lock (on salary processing page)
- ✅ Per-employee HOLD with reason (attendance not finalized)
- ❌ No VALIDATED stage
- ❌ No SUBMITTED stage
- ❌ No POSTED stage
- ❌ No "Save Draft" button
- ❌ No "Submit" button
- ❌ No "Validate" button
- ❌ No "Generate Payslip" as a workflow action (payslip is just a view)
- ❌ No PENDING status as a distinct state (employees without attendance are HOLD, not PENDING)
- ❌ No COMPLETED status (LOCKED is the closest, but BRD distinguishes)
- ❌ No hold-release triggering recalculation
- ❌ No exception reporting for HOLD/PENDING employees

**Gap:** 4 missing workflow stages; no separate validation/submission; HOLD/PENDING/COMPLETED classification not implemented per BRD.

---

### 20. Bulk Salary Processing (BRD §21)

**BRD requires:**
- Select All / individual selection
- Calculate Selected / Validate Selected / Process Selected / Generate Payslips
- Pre-processing validation: "111 selected, 108 valid, 3 errors — Proceed with 108?"
- Never silently process invalid records

**Current implementation:**
- ✅ `calculatePayrollRun()` processes all active employees in bulk
- ✅ `bulk-adhoc` page for bulk benefit/deduction upload via Excel
- ❌ No per-employee selection for payroll processing (all-or-nothing)
- ❌ No "Validate Selected" action
- ❌ No pre-processing validation summary ("X valid, Y errors")
- ❌ No "Proceed with valid only?" confirmation
- ❌ No individual payslip generation action from bulk view

**Gap:** No selective processing; no pre-processing validation summary; no error/valid count confirmation.

---

### 21. Error Messages (BRD §22)

**BRD requires 9 specific error messages:**
1. "Employee code does not exist."
2. "Employee is not eligible for salary processing."
3. "Please select salary year and month."
4. "Salary has already been processed for the selected period."
5. "Please enter a valid amount."
6. "Net salary cannot be negative."
7. "Unable to save salary details. Please try again."
8. "Are you sure you want to delete this salary transaction?"
9. "The selected payroll period is closed and cannot be modified."

**Current implementation:**
- ✅ #4: "A payroll run already exists for this period" (runs API)
- ✅ #9: "Payroll run is locked and can no longer be edited" (payrollGuard.ts)
- ⚠️ Generic errors exist but don't match BRD's exact messages
- ❌ #1, #2, #3, #5, #6, #7, #8: Not implemented with BRD-specified messages

**Gap:** 7 of 9 BRD-specified error messages missing.

---

### 22. Outputs (BRD — Outputs section)

**BRD requires 4 outputs:**

#### 22a. Payslip — Individual & Bulk

**Current:**
- ✅ Individual payslip page exists (`/payroll/outputs/payslip`)
- ✅ Itemized earnings/deductions, statutory totals, net salary
- ✅ Browser-native print (no PDF pipeline)
- ❌ No bulk payslip generation
- ❌ No PDF generation
- ❌ No encrypted PDF / email delivery
- ❌ Navigation `/payroll/outputs/payslip-bulk` has no page

#### 22b. Payroll Summary

**Current:**
- ❌ **No payroll summary page or API**
- ❌ Navigation `/payroll/outputs/summary` has no page
- ❌ No company-level totals (total gross, total deductions, total net, headcount)

#### 22c. Bank Transfer File

**Current:**
- ❌ **No bank transfer file generation**
- ❌ Navigation `/payroll/outputs/bank-transfer` has no page
- ❌ No bank file format (CSV, TXT, XLSX)
- ❌ `EmployeeBankDetail` model exists but not used for file generation

#### 22d. Payroll Reconciliation

**Current:**
- ❌ **No payroll reconciliation page or API**
- ❌ Navigation `/payroll/outputs/reconciliation` has no page
- ❌ No reconciliation against attendance, statutory, or bank file

**Gap:** 3 of 4 output types entirely missing. Individual payslip exists but no PDF/bulk/email.

---

### 23. Other Missing Modules (BRD-referenced but not in separate sections)

#### 23a. Leave Encashment
- ❌ No `LeaveEncashment` model
- ❌ No encashment calculation (leave balance × daily rate)
- ❌ No encashment request/approval workflow
- ❌ Navigation `/payroll/processing/leave-encashment` has no page

#### 23b. Full & Final Settlement
- ❌ No FnF calculation (leave encashment + gratuity + arrears + notice pay + bonus + LOP recovery)
- ❌ No FnF workflow
- ❌ Navigation `/payroll/processing/full-and-final` has no page

#### 23c. Other Incentives
- ❌ No separate "Other Incentives" module (festival, attendance, referral)
- ❌ Navigation `/payroll/processing/other-incentives` has no page
- ⚠️ PMS Incentive exists (`/payroll/processing/pms-incentive`) but is a separate module

#### 23d. Health Insurance Deduction
- ❌ No health insurance deduction logic
- ❌ Navigation `/payroll/deductions/health-insurance` has no page

#### 23e. Statutory Pages
- ❌ No `/payroll/statutory/pf` page (PfRate model exists, no UI)
- ❌ No `/payroll/statutory/esi` page (EsiRate model exists, no UI)
- ❌ No `/payroll/statutory/professional-tax` page (ProfessionalTaxSlab model exists, no UI)
- ❌ No `/payroll/statutory/tds` page (TDSSlab model exists, no UI)
- ❌ No `/payroll/statutory/lwf` page (no model at all)

---

## Gap Summary Table

| # | BRD Section | Status | Key Gap |
|---|------------|--------|---------|
| 1 | Salary Processing Flow | ⚠️ Partial | 4 missing workflow stages, no multi-level approval |
| 2 | Attendance Inputs | ⚠️ Partial | 7 missing fields, no leave-type breakdown, LOM not wired |
| 3 | Earnings | ⚠️ Partial | No variable-earning auto-calc, shift allowances not wired |
| 4 | Gross Salary | ⚠️ Partial | OT not in gross, no configurable LOP-in-gross mode |
| 5 | OT Module | ⚠️ Partial | 3 of 4 methods missing, no weekday/weekend/holiday split |
| 6 | Arrears | ✅ Mostly done | 5 of 7 arrear types missing (only gross revision arrear) |
| 7 | Bonus | ✅ Mostly done | No monthly accrual, no bonus type categorization |
| 8 | Deductions | ❌ Major gap | No loan/advance module, 10+ types manual-only |
| 9 | PF | ⚠️ Partial | `includeInPf` flag not consumed, uses full gross not Basic+DA |
| 10 | ESI | ⚠️ Partial | `includeInEsi` flag not consumed |
| 11 | Professional Tax | ⚠️ Partial | No state-wise slabs, slabs are global |
| 12 | LOM | ❌ Missing | Entirely missing from payroll calculation |
| 13 | TDS | ❌ Major gap | Flat monthly estimate only, no annual engine |
| 14 | Loan Recovery | ❌ Missing | No loan instances, no recovery, no balance tracking |
| 15 | LWF | ❌ Missing | No model, no calculation, no page |
| 16 | Salary Rounding | ❌ Missing | Hardcoded Math.round(), no configurable rules |
| 17 | Deduction % | ❌ Missing | Not displayed despite data available |
| 18 | Validations | ❌ Major gap | 8 of 12 validations missing |
| 19 | Process Controls | ⚠️ Partial | 4 missing stages, no COMPLETED/PENDING/HOLD classification |
| 20 | Bulk Processing | ❌ Major gap | No selective processing, no pre-validation summary |
| 21 | Error Messages | ❌ Major gap | 7 of 9 BRD messages missing |
| 22a | Payslip (Individual) | ✅ Done | No PDF, no email, no encryption |
| 22b | Payslip (Bulk) | ❌ Missing | No page, no PDF generation |
| 22c | Payroll Summary | ❌ Missing | No page, no API |
| 22d | Bank Transfer File | ❌ Missing | No page, no file generation |
| 22e | Reconciliation | ❌ Missing | No page, no API |
| 23a | Leave Encashment | ❌ Missing | No model, no calculation, no page |
| 23b | Full & Final | ❌ Missing | No model, no calculation, no page |
| 23c | Other Incentives | ❌ Missing | No page (PMS incentive exists separately) |
| 23d | Health Insurance | ❌ Missing | No deduction logic, no page |
| 23e | Statutory Pages | ❌ Missing | Models exist but no UI pages for PF/ESI/PT/TDS/LWF |

---

## Priority Classification

### P0 — Critical (blocks payroll accuracy)
1. **LOM calculation** — attendance data exists but not deducted from payroll
2. **PF/ESI wage base** — `includeInPf`/`includeInEsi` flags not consumed (uses full gross instead of Basic+DA)
3. **Loan & Advance Recovery** — no automatic deduction during payroll
4. **TDS engine** — flat monthly estimate, no annual computation
5. **Mandatory validations** — 8 of 12 missing (negative net salary, deduction limits, OT limits)

### P1 — High (blocks payroll outputs)
6. **Bank Transfer File** — no file generation
7. **Payroll Summary** — no company-level totals
8. **Bulk Payslip PDF** — no PDF generation
9. **Payroll Reconciliation** — no reconciliation
10. **Salary Rounding** — hardcoded, no configurable rules

### P2 — Medium (workflow completeness)
11. **Full workflow stages** — VALIDATED, SUBMITTED, POSTED missing
12. **Multi-level approval** — Manager → HR → Finance
13. **Bulk processing** — selective processing, pre-validation summary
14. **COMPLETED/HOLD/PENDING classification** — per BRD §23
15. **Error messages** — BRD-specified messages

### P3 — Lower (feature completeness)
16. **LWF** — no model or calculation
17. **Leave Encashment** — no model or calculation
18. **Full & Final Settlement** — no model or calculation
19. **Other Incentives** — festival, attendance, referral
20. **Health Insurance deduction** — no logic
21. **Statutory UI pages** — PF/ESI/PT/TDS/LWF management pages
22. **Shift-based allowances** — night, heat, snacks, food auto-calculation
23. **State-wise PT slabs**
24. **Deduction % display**
25. **Bonus type categorization and monthly accrual**

---

## What IS Working (Phase 1 Baseline)

The following are fully functional and should not be regressed:

1. ✅ `PayrollRun` create → calculate → approve → lock workflow
2. ✅ `payrollCalculation.ts` — LOP-prorated earnings, PF/ESI/PT/TDS (basic), net salary
3. ✅ `PayrollLineComponent` itemization (recurring + ad-hoc)
4. ✅ Individual payslip view with browser print
5. ✅ Salary Revision with Manager → HR approval workflow
6. ✅ Arrear calculation from retroactive salary revisions
7. ✅ Bonus calculation (BASIC_PROJECTION + ACTUAL_NET_PAY methods)
8. ✅ PMS Incentive module
9. ✅ Gratuity calculation
10. ✅ Bulk ad-hoc component upload via Excel
11. ✅ Per-employee HOLD with reason
12. ✅ Company-scoped payroll runs
13. ✅ RBAC permission checks on all payroll APIs
14. ✅ Attendance freeze gate (payroll requires finalized attendance)
15. ✅ `GrossSplitRule` master (read-only, not yet consumed)
16. ✅ `DeductionRate` master (read-only, not yet consumed)
17. ✅ `OTPlan` with `payComponentId` link
18. ✅ `ShiftMaster` with night/snacks/meals fields
19. ✅ `HolidayMaster` with holiday types
20. ✅ `LoanType` with min/max slabs
