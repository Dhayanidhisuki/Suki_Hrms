# Payroll Module — Business Decisions & Information Required

**Document:** `docs/PAYROLL_BRD_INFORMATION_REQUIRED_2026-09-11.md`
**Purpose:** Lists every business decision, configuration value, and clarification needed from stakeholders to complete the remaining 70% of the Payroll module per the KUN HRMS Payroll BRD.
**Source BRD:** `/Users/sukimacbook01/Downloads/Suki Kun Payroll.docx`
**Gap Reference:** `docs/PAYROLL_GAP_ANALYSIS_2026-09-11.md`
**Date:** 2026-09-11

---

## How to Use This Document

Each section below corresponds to a gap in the current implementation. For each item:

- **What we need:** The specific business decision, configuration value, or clarification required.
- **Why it's needed:** What breaks or cannot be built without this answer.
- **Options:** Where the BRD offers choices, the available options are listed.
- **Impact if not answered:** The consequence of leaving this unresolved.

Stakeholders (Suresh / Payroll Team / Finance / Management) must answer each item before implementation can proceed.

---

## 1. Salary Processing Workflow

### 1.1 Approval Chain

**What we need:**
- Who are the approval stages? The BRD says "Manager / HR Approval → Finance Approval" but does not specify:
  - Is it Manager → HR → Finance (3 stages)?
  - Or Manager → HR (2 stages, Finance is just the lock)?
  - Can Finance override HR?
- Does each stage have a different permission, or is it the same role?
- Can any stage approve on behalf of another (e.g., HR approves if Manager is absent)?

**Why it's needed:** The current system has only one approval stage (APPROVED). We need to know how many stages to build and what permissions each requires.

**Impact if not answered:** Payroll will remain single-approver; no multi-stage workflow can be built.

---

### 1.2 Workflow Statuses

**What we need:**
- The BRD defines: `DRAFT → CALCULATED → VALIDATED → SUBMITTED → APPROVED → POSTED → LOCKED`
- Is each stage a hard gate (must pass before next), or can some be skipped?
- What is the difference between VALIDATED and SUBMITTED? Is validation automatic or manual?
- What does POSTED mean — is there a general ledger / accounting system to post to?
- After LOCKED, can payroll be reopened? If yes, who has authority and what is the reason workflow?

**Why it's needed:** We currently have 4 stages; BRD requires 7. Each stage needs UI, API, permissions, and transition rules.

**Impact if not answered:** Workflow stays at 4 stages; cannot add validation, submission, or posting steps.

---

### 1.3 Payroll Period Closure

**What we need:**
- What is the payroll cutoff date each month? (e.g., 25th of the month, last working day)
- Can payroll be processed for a future month before the current month is locked?
- What happens to pending attendance/leave approvals when payroll is locked — are they auto-rejected or carried forward?
- Is there a financial year-end close process separate from monthly lock?

**Why it's needed:** Period closure rules determine when payroll can be created, calculated, and locked.

**Impact if not answered:** No period closure logic can be implemented; payroll runs remain open-ended.

---

## 2. Attendance & Working-Day Inputs

### 2.1 Leave-Type Breakdown in Payroll

**What we need:**
- The BRD lists separate inputs: Earned Leave, Casual Leave, Sick Leave, Paid Holidays, Layoff Days.
- Should the MonthlyAttendanceSummary break down leave by type (EL/CL/SL), or is a single `leaveDays` total sufficient?
- Which leave types are "paid" (count toward payable days) vs "unpaid" (count toward LOP)?
- Is Paid Holiday automatically counted as a payable day, or does it need manual confirmation?

**Why it's needed:** The current `MonthlyAttendanceSummary` has a single `leaveDays` field. The BRD requires per-type breakdown for the payslip and for LOP calculation.

**Impact if not answered:** Payslip cannot show leave-type-wise days; LOP may be calculated incorrectly if paid vs unpaid leaves are mixed.

---

### 2.2 Layoff Days

**What we need:**
- Are layoff days paid or unpaid?
- How are layoff days recorded — by HR manually, or imported from attendance/biometric?
- Is there a separate approval for layoff days?

**Why it's needed:** No `layoffDays` field exists in the schema. Need to know if this is a real business scenario or a theoretical BRD item.

**Impact if not answered:** Layoff days will not be tracked; if they occur, they'll be treated as absent/LOP.

---

### 2.3 Total Work Hours & Actual Attendance

**What we need:**
- Is "Total Work Hours" the sum of `workingMinutes` across all days in the month?
- Is "Actual Attendance" the same as `presentDays`, or is it a separate concept (e.g., physically present vs remotely working)?
- Are work hours used in any calculation beyond OT (e.g., hourly-rate employees)?

**Why it's needed:** These fields don't exist in `MonthlyAttendanceSummary`. Need to know if they're display-only or calculation inputs.

**Impact if not answered:** No work-hours display on payslip; hourly-rate employees cannot be accurately paid.

---

### 2.4 Hourly-Rate Employees

**What we need:**
- Are there employees paid by the hour (not monthly salary)?
- If yes, what is the "Applicable Salary" for hourly rate calculation — Basic, Gross, or a configured hourly rate?
- What are the "Standard Working Hours" per day — 8, or shift-specific?
- Do hourly-rate employees get the same PF/ESI/PT/TDS treatment as salaried employees?

**Why it's needed:** The BRD's OT formula references hourly rate, but the current system assumes all employees are monthly-salaried.

**Impact if not answered:** Hourly-rate employees (if any) will be processed as monthly-salaried, causing incorrect pay.

---

## 3. Earnings — Variable & Shift-Based Allowances

### 3.1 Night Shift Allowance

**What we need:**
- What is the Night Shift Allowance amount or formula? (Fixed per shift? Percentage of basic? Per hour?)
- Is it paid only for nights worked after a certain hour (e.g., after 22:00)?
- Is it taxable or exempt?
- Should it be auto-calculated from `ShiftMaster.nightAllowed`, or manually entered?

**Why it's needed:** `ShiftMaster.nightAllowed` flag exists but no allowance calculation. Need the formula and auto-calc rule.

**Impact if not answered:** Night shift allowance cannot be auto-calculated; must be entered manually each month.

---

### 3.2 Snacks / Food / Meals Allowance

**What we need:**
- What is the Snacks Allowance amount? (Fixed per shift? Per day? Per month?)
- What is the Food/Meals Allowance amount?
- Are these paid only when `ShiftMaster.snacksAllowed` / `mealsAllowed` is true?
- Is `ShiftMaster.snacksMealsDurationMinutes` used to calculate the allowance, or is it just a display field?
- Are these taxable or exempt?

**Why it's needed:** `ShiftMaster` has `snacksAllowed`, `mealsAllowed`, `snacksMealsDurationMinutes` fields but no allowance calculation logic.

**Impact if not answered:** Shift-based allowances must be manually entered each month.

---

### 3.3 Heat Allowance

**What we need:**
- What is the Heat Allowance amount or formula?
- Who is eligible — employees working in specific areas, specific shifts, or specific designations?
- Is it auto-calculated from attendance/shift data, or manually entered?

**Why it's needed:** BRD lists "Heat Allowance" as a fixed earning but no eligibility or calculation rule is defined.

**Impact if not answered:** Heat allowance must be manually entered.

---

### 3.4 Attendance Incentive

**What we need:**
- What is the Attendance Incentive formula? (Fixed amount for zero-absence? Slab-based on attendance %?)
- What is the eligibility criteria? (Full month present? No late arrivals? No LOP?)
- Is it calculated automatically from attendance data, or manually entered?
- Is it paid monthly or annually?

**Why it's needed:** BRD lists "Attendance Incentive" as a variable earning but no formula or eligibility rule.

**Impact if not answered:** No auto-calculation; must be manually entered each month.

---

### 3.5 Productivity Incentive

**What we need:**
- What is the Productivity Incentive formula? (Per unit produced? Percentage of basic? Fixed amount?)
- How is productivity measured — from attendance (hours worked), from a production module, or manually entered?
- Is this the same as the existing PMS Incentive module, or separate?

**Why it's needed:** BRD lists "Productivity Incentive" as a fixed earning. The existing PMS module may or may not cover this.

**Impact if not answered:** Productivity incentive cannot be auto-calculated.

---

### 3.6 Other Allowance 1 & 2

**What we need:**
- What are "Other Allowance 1" and "Other Allowance 2"?
- Are these company-defined earning components (already supported by `SalaryComponent`), or do they need special calculation logic?
- Are they fixed monthly amounts or variable?

**Why it's needed:** The `SalaryComponent` model already supports custom earning components. Need to know if these need calculation logic beyond manual entry.

**Impact if not answered:** These will be treated as standard manual earning components (which may be sufficient).

---

## 4. Gross Salary Definition

### 4.1 OT in Gross

**What we need:**
- Should OT amount be included in "Gross Salary" or shown separately?
- The BRD says: `Gross Salary = Total Earnings − Loss of Pay`
- Does "Total Earnings" include OT, or only fixed/recurring components?
- Does "Total Earnings" include ad-hoc earnings (bonus, arrears, incentives)?

**Why it's needed:** Currently OT is added on top of gross (`grossEarnings + otAmount + otherEarningsTotal`). The BRD's definition may require OT to be inside gross.

**Impact if not answered:** Gross salary may be calculated differently from BRD intent; statutory calculations (PF/ESI) may use wrong base.

---

### 4.2 LOP-in-Gross Mode

**What we need:**
- The BRD offers two options:
  1. `Gross = Total Earnings − Loss of Pay` (LOP deducted from total)
  2. `Gross = Sum of applicable earning components` (LOP already embedded in each component)
- Which mode does the company use?
- Does this choice affect all components or only specific ones?

**Why it's needed:** Current system uses uniform LOP proration on all components. Need to confirm this matches the company's intent.

**Impact if not answered:** LOP proration may not match company's actual payroll practice.

---

## 5. OT Module — Calculation Methods

### 5.1 Which OT Method to Use

**What we need:**
- The BRD defines 4 OT calculation methods:
  1. **From Basic × 2:** `Hourly Rate = Basic / 26 / 8; OT = Rate × Hours × 2`
  2. **From Gross (Dynamic):** `Hourly Rate = Gross / 31 / 8; OT = Rate × Hours × Factor`
  3. **Fixed OT Rate:** `OT = Fixed Rate × Hours × Factor`
  4. **From Basic+DA+HRA+Allowance:** `Hourly Rate = (Basic+DA+HRA+Other) / 31 / 8; OT = Rate × Hours × Factor`
- Which method(s) does the company use?
- Is the method per-employee, per-employee-type, per-company, or per-OT-plan?
- Can different employees use different methods in the same company?

**Why it's needed:** Only one method (gross-based) is implemented. Need to know which method(s) to build.

**Impact if not answered:** OT will be calculated using gross-based method only, which may not match company's actual practice.

---

### 5.2 OT Rate Differentiation by Day Type

**What we need:**
- The BRD says: `OT Amount = Weekday OT + Weekend OT + Holiday OT`
- What are the OT multipliers for each day type?
  - Weekday OT: ×1.0? ×1.5? ×2.0?
  - Weekend OT: ×1.5? ×2.0?
  - Holiday OT: ×2.0? ×2.5?
- Is the multiplier configurable per OT Plan, or fixed company-wide?
- Is "Weekend" = Sunday only, or Saturday + Sunday?

**Why it's needed:** Current system uses a single `overtimeFactor` from JobInfo, with no day-type differentiation.

**Impact if not answered:** All OT will be calculated at a single rate regardless of day type.

---

### 5.3 OT Working Days Denominator

**What we need:**
- Method 1 uses 26 working days; Method 2 uses 31/30/28 calendar days.
- Which denominator applies — fixed 26, or actual calendar days in the month?
- Is this configurable, or fixed per method?

**Why it's needed:** The hourly rate changes significantly based on denominator (26 vs 31).

**Impact if not answered:** OT hourly rate may be calculated with wrong denominator.

---

### 5.4 OT Limits

**What we need:**
- `OTPlan.maxOtHoursPerDay` exists but is not enforced. What is the max OT per day?
- Is there a max OT per week? Per month?
- What happens when OT exceeds the limit — reject, auto-cap, or require approval?
- Is the limit per OT Plan, per company, or per employee type?

**Why it's needed:** No OT limit validation exists in payroll calculation.

**Impact if not answered:** No OT limit enforcement; employees may receive unlimited OT pay.

---

### 5.5 OT Minimum Threshold

**What we need:**
- `OTPlan.applicableAfterMinutes` exists but is not consumed. What is the minimum minutes before OT kicks in?
- Is this per OT Plan or company-wide?
- Does the threshold apply per day, per shift, or per attendance punch?

**Why it's needed:** Without this, OT is calculated from the first minute of overtime.

**Impact if not answered:** OT may be paid from minute 1, which may not match company policy.

---

## 6. Arrears

### 6.1 Arrear Types Beyond Salary Revision

**What we need:**
- The BRD lists 7 arrear types:
  1. Salary correction ✅ (done via revision)
  2. Basic salary revision arrears ✅ (done)
  3. Salary increment arrear ✅ (done)
  4. **Allowance arrears** — which allowances? How calculated?
  5. **Deduction reversal** — which deductions? How triggered?
  6. **Attendance correction** — how does attendance correction create an arrear?
  7. **Incentive correction** — which incentives? How calculated?
  8. **Manual adjustment** — who can enter? What approval is needed?

- For each missing type: What triggers it? What is the formula? Who approves it?

**Why it's needed:** Only gross-level salary revision arrears are implemented. The other 5 types need business rules.

**Impact if not answered:** Only salary revision arrears can be calculated; all other corrections must be manual ad-hoc entries.

---

## 7. Bonus / Incentive

### 7.1 Bonus Types

**What we need:**
- What bonus types does the company give?
  - Festival Bonus?
  - Performance Bonus?
  - Annual Bonus (statutory)?
  - Ex-gratia?
  - Production Bonus?
- For each type: What is the eligibility, calculation formula, and payment timing?
- Is the existing Bonus module (BonusRate with BASIC_PROJECTION / ACTUAL_NET_PAY) sufficient, or do we need separate configurations per bonus type?

**Why it's needed:** The current Bonus module has a single bonus calculation. Multiple bonus types need separate configuration and tracking.

**Impact if not answered:** Only one bonus type can be configured and calculated.

---

### 7.2 Bonus Monthly Accrual vs Annual Payment

**What we need:**
- The BRD mentions "Current Month Amount" and "Accumulated Amount" — does this mean bonus accrues monthly and pays out annually?
- If yes, what is the monthly accrual formula? (1/12 of annual bonus? Pro-rata based on attendance?)
- Can bonus be paid as a partial amount mid-year (advance), with balance at year-end?
- How is "Paid Amount" tracked — against which payroll runs?

**Why it's needed:** The current system calculates bonus as a single annual amount. Monthly accrual and partial payment need a different data model.

**Impact if not answered:** Bonus remains a single annual calculation with no monthly accrual or partial payment.

---

## 8. Deductions — Loan & Advance Recovery

### 8.1 Loan Types in Use

**What we need:**
- The BRD lists: Salary Advance, Loan Deduction, Bank Loan, Festival Advance, Vehicle Advance, Education Loan.
- Which of these does the company actually use?
- For each: What is the interest rate (if any)? What is the recovery period? What is the monthly installment formula?
- Are loans company-given (internal) or bank loans (external, company just deducts)?
- For bank loans: Does the company just deduct a fixed amount, or is there a bank-provided schedule?

**Why it's needed:** `LoanType` master exists but no `EmployeeLoan` instance model, no recovery schedule, no balance tracking.

**Impact if not answered:** No loan recovery module can be built; all deductions remain manual.

---

### 8.2 Loan Recovery Rules

**What we need:**
- When does recovery start — same month as loan disbursement, or next month?
- Can an employee have multiple active loans simultaneously?
- If yes, what is the priority order for recovery when salary cannot cover all installments?
- What happens when an employee exits with an outstanding loan balance — is it recovered from FnF?
- Can recovery be paused (e.g., during LOP month)? If yes, who authorizes?
- Is there a pre-closure option? Any penalty?

**Why it's needed:** Recovery rules determine the deduction logic during payroll processing.

**Impact if not answered:** No automated loan recovery; HR must manually enter deduction amounts each month.

---

### 8.3 Advance Recovery Rules

**What we need:**
- What is the difference between "Salary Advance" and "Loan"?
- Are advances interest-free?
- Is advance recovery full-deduction in one month, or spread across months?
- What is the max advance amount an employee can take? (Percentage of monthly salary?)
- Can an employee take a new advance while a previous one is still being recovered?

**Why it's needed:** Advances may have different recovery rules than loans.

**Impact if not answered:** Advances treated same as loans, which may be incorrect.

---

## 9. PF Calculation

### 9.1 PF Wage Base

**What we need:**
- The BRD says: `PF = 12% of (Basic + DA)`
- The current system uses **full gross earnings** as PF wage base.
- Which components should be included in PF wage?
  - Basic only?
  - Basic + DA?
  - Basic + DA + HRA?
  - All earning components flagged with `includeInPf`?
- Is the PF wage base the same for all employees, or configurable per employee/employee-type?

**Why it's needed:** `SalaryComponent.includeInPf` flag exists but is not consumed. Need confirmation on which components to include.

**Impact if not answered:** PF will continue to be calculated on full gross, which may over-deduct PF.

---

### 9.2 PF Restriction Amount

**What we need:**
- `JobInfo.pfRestrictionAmount` exists — is this the "Employee PF Cont. Customize" field from the legacy screen?
- What does it mean — is it the max PF wage (e.g., ₹15,000) or the max PF deduction amount?
- Who sets this — HR at employee onboarding, or admin per company?
- Can it be changed mid-employment? If yes, does it create a PF arrear?

**Why it's needed:** The current code caps PF wage at `min(statutory ceiling, pfRestrictionAmount)`. Need to confirm this is the correct interpretation.

**Impact if not answered:** PF restriction may be applied incorrectly.

---

### 9.3 PF Employer Contribution Split

**What we need:**
- The BRD says Employer = 13%, split into EPF (3.67%) + EPS (8.33%).
- Is the employer contribution always 13%, or is it 12% (3.67% EPF + 8.33% EPS = 12%)?
- The current `PfRate.employerContributionRate` defaults to 12% — should it be 13%?
- Is the EPS cap (₹1,250/month on ₹15,000 wage) enforced?

**Why it's needed:** Employer PF contribution affects CTC and company cost; incorrect split causes compliance issues.

**Impact if not answered:** Employer PF may be calculated at wrong rate.

---

## 10. ESI Calculation

### 10.1 ESI Wage Base

**What we need:**
- The BRD says: `ESI = 0.75% of Actual Gross`
- Which components constitute "Actual Gross" — all earnings, or only components flagged with `includeInEsi`?
- Is OT included in ESI wage?
- Are ad-hoc earnings (bonus, arrears) included in ESI wage?

**Why it's needed:** `SalaryComponent.includeInEsi` flag exists but is not consumed. Need confirmation on wage base.

**Impact if not answered:** ESI may be calculated on wrong base, causing compliance issues.

---

### 10.2 ESI Eligibility Period

**What we need:**
- ESI eligibility is based on monthly wage ≤ ceiling (₹21,000). Once an employee is above the ceiling, are they permanently out of ESI, or re-evaluated each month?
- The current system checks both structured salary and LOP-adjusted gross. Is this correct?
- What is the ESI wage ceiling — ₹21,000? Is it configurable?
- Does the company have any special ESI exemptions?

**Why it's needed:** ESI eligibility logic determines whether to deduct ESI at all.

**Impact if not answered:** ESI may be deducted from ineligible employees or missed for eligible ones.

---

## 11. Professional Tax

### 11.1 State-Wise PT Slabs

**What we need:**
- Which state(s) does the company operate in?
- PT slabs vary by state — which state's slabs should be configured?
- If multi-state: Are slabs per company, per branch/unit, or per employee residence state?
- The BRD provides one slab table — is this for the company's home state?
- Is PT deducted monthly, half-yearly, or annually? (BRD says monthly, but some states have half-yearly)
- Is there a PT cap per year? (e.g., ₹2,500/year in some states)

**Why it's needed:** `ProfessionalTaxSlab` is currently global (not company-scoped or state-scoped). Need to know if multi-state slabs are required.

**Impact if not answered:** PT will use a single global slab table, which may be wrong for multi-state operations.

---

### 11.2 PT for New Joiners and Exits

**What we need:**
- Is PT deducted in the joining month (partial month)?
- Is PT deducted in the exit month?
- Is PT deducted for the month even if the employee is on LOP for the full month?

**Why it's needed:** Edge cases for PT deduction in partial months.

**Impact if not answered:** PT may be incorrectly deducted or skipped for joiners/exits.

---

## 12. Loss of Minutes (LOM)

### 12.1 LOM Calculation Method

**What we need:**
- The BRD provides 2 methods:
  1. **From Gross:** `LOM = Gross / Payroll Days / Shift Duration / 60 × LOM Minutes`
  2. **From Basic × 2:** `LOM = Basic / Payroll Days / Shift Duration / 60 × LOM Minutes × 2`
- Which method does the company use?
- Is the method per company, per employee type, or per employee?
- What is "Shift Duration" — always 8 hours, or from `ShiftMaster` end time − start time?
- What is "Payroll Days" — calendar days (30/31) or working days (26)?

**Why it's needed:** LOM is entirely missing from payroll calculation. Need the formula to implement.

**Impact if not answered:** LOM will not be deducted; late arrivals and early departures have no salary impact.

---

### 12.2 LOM Minutes Source

**What we need:**
- Is LOM calculated from `lateMinutesTotal` + `earlyOutMinutesTotal` in `MonthlyAttendanceSummary`?
- Or is LOM a separate manually-entered value?
- Are there grace minutes that are exempt from LOM? (e.g., first 15 minutes late = no LOM)
- Is there a daily LOM cap (e.g., max 120 minutes per day)?
- Is LOM rounded (e.g., to nearest 15 minutes) before calculation?

**Why it's needed:** Determines which attendance fields feed into LOM deduction.

**Impact if not answered:** LOM calculation cannot be implemented.

---

### 12.3 LOM and LOP Interaction

**What we need:**
- If an employee is late by 4 hours in a day, is that:
  - LOM (minutes deduction only)?
  - Half-day LOP (0.5 day deducted)?
  - Both LOM and LOP?
- Is there a threshold where LOM converts to LOP (e.g., late > 4 hours = half-day LOP)?
- Does LOM reduce gross earnings (like LOP proration) or is it a separate deduction line?

**Why it's needed:** LOM and LOP may interact; need to know if they're independent or cumulative.

**Impact if not answered:** LOM and LOP may double-count salary deductions.

---

## 13. TDS / Income Tax

### 13.1 Tax Regime

**What we need:**
- Does the company default to Old Regime or New Regime?
- Can employees choose their regime? If yes, how is the choice recorded?
- Is regime selection per financial year, or one-time?
- What is the current financial year for TDS purposes? (Apr 2026 – Mar 2027?)

**Why it's needed:** Tax calculation differs significantly between Old and New regimes. The current system has no regime support at all.

**Impact if not answered:** TDS cannot be calculated correctly; flat slab lookup will be used.

---

### 13.2 Tax Slabs — Old Regime

**What we need:**
- What are the Old Regime tax slabs for the current financial year?
- What are the standard deductions available? (₹50,000 standard deduction? HRA exemption? Chapter VI-A deductions?)
- What is the rebate threshold? (₹5,000? ₹12,500?)
- What is the surcharge structure? (10% above ₹50L? 15% above ₹1Cr?)
- What is the cess rate? (4% health & education?)

**Why it's needed:** Old Regime requires slab-wise calculation with exemptions and deductions.

**Impact if not answered:** Old Regime TDS cannot be calculated.

---

### 13.3 Tax Slabs — New Regime

**What we need:**
- What are the New Regime tax slabs for the current financial year?
- Are there any deductions allowed under New Regime? (Employer NPS? Standard deduction?)
- What is the rebate threshold under New Regime? (₹7L? Section 87A rebate?)
- What is the surcharge and cess structure?

**Why it's needed:** New Regime has different slabs and limited deductions.

**Impact if not answered:** New Regime TDS cannot be calculated.

---

### 13.4 Investment Declarations

**What we need:**
- Does the company collect investment declarations from employees? (80C, 80D, HRA, etc.)
- If yes, how — online form, paper form, Excel upload?
- Are declarations validated against proofs? When?
- Is there a maximum limit per section? (80C: ₹1.5L, 80D: ₹25K/₹50K, etc.)
- Are declarations per financial year, or per month?

**Why it's needed:** Old Regime TDS requires investment declarations to compute taxable income.

**Impact if not answered:** No investment declaration module; Old Regime TDS will be calculated without deductions.

---

### 13.5 TDS Deduction Timing

**What we need:**
- Is TDS deducted monthly (pro-rata of annual tax) or as a lump sum in specific months?
- Is there a TDS deduction in the joining month?
- Is TDS deducted in the exit month (full-year tax liability recovered from FnF)?
- What happens if an employee joins mid-year — is previous employer income considered?
- Is there a TDS zero-deduct threshold (e.g., no TDS if monthly tax < ₹X)?

**Why it's needed:** TDS deduction timing affects monthly net pay.

**Impact if not answered:** TDS may be deducted incorrectly in joining/exiting months.

---

## 14. Labour Welfare Fund (LWF)

### 14.1 LWF Applicability

**What we need:**
- Is LWF applicable to the company? Which state's LWF Act applies?
- Which employee categories are covered? (All? Only workers? Exclude management?)
- Is there a wage ceiling for LWF?
- Is LWF employee-only, employer-only, or both?

**Why it's needed:** No LWF model exists. Need to know if this is applicable at all.

**Impact if not answered:** LWF will not be deducted, which may be a compliance issue.

---

### 14.2 LWF Rates

**What we need:**
- What is the employee LWF contribution? (Fixed amount? Percentage of wage?)
- What is the employer LWF contribution?
- Is LWF deducted monthly, half-yearly, or annually?
- What is the wage base for LWF? (Gross? Basic? Capped?)

**Why it's needed:** Need rates and frequency to build the LWF model and calculation.

**Impact if not answered:** LWF cannot be implemented.

---

## 15. Salary Rounding

### 15.1 Rounding Rule

**What we need:**
- Which rounding rule does the company use?
  - No rounding
  - Nearest whole number (₹1)
  - Nearest ₹5
  - Nearest ₹10
  - Nearest ₹100
  - Other (specify)
- Is rounding applied to Net Salary only, or also to Gross, PF, ESI, PT, TDS individually?
- Is the "Round Off" amount shown as a separate line on the payslip?
- Is rounding applied before or after total deduction calculation?

**Why it's needed:** Current system uses `Math.round()` (nearest ₹1) hardcoded. Need the company's actual rule.

**Impact if not answered:** Net salary will be rounded to nearest ₹1, which may not match company practice.

---

## 16. Health Insurance Deduction

### 16.1 Health Insurance Scheme

**What we need:**
- Does the company provide health insurance to employees?
- If yes, is it:
  - Group Mediclaim (company-paid, no employee deduction)?
  - Employee-contributed (deducted from salary)?
  - Mixed (company pays part, employee pays part)?
- What is the employee contribution amount? (Fixed per month? Percentage of premium?)
- Is the contribution per employee, per employee+family, or per dependent count?
- Is the deduction monthly, quarterly, or annual?
- Is it pre-tax (under 80D) or post-tax?

**Why it's needed:** No health insurance deduction logic exists.

**Impact if not answered:** Health insurance deduction cannot be automated.

---

## 17. Other Deductions

### 17.1 Canteen Deduction

**What we need:**
- Is canteen deduction a fixed monthly amount, or per-day-used?
- Is it per employee type (existing `BenefitRateByEmployeeType` model)?
- Is it deducted only for days present, or for all days?
- Is it tax-exempt or taxable?

**Why it's needed:** `BenefitRateByEmployeeType` exists for canteen/petrol but is not consumed in payroll.

**Impact if not answered:** Canteen deduction must be manually entered.

---

### 17.2 Mobile / Transport / Lunch Deductions

**What we need:**
- For each: Is it a fixed monthly amount, or variable?
- Is it per employee, per employee type, or per designation?
- Is it deducted only for days present, or for all days?
- Is there a company subsidy (company pays part, employee pays part)?

**Why it's needed:** No auto-deduction logic for these; currently manual ad-hoc only.

**Impact if not answered:** All these deductions must be manually entered each month.

---

### 17.3 LIC Deduction

**What we need:**
- Is LIC deducted from salary? If yes, is it the employee's personal LIC policy?
- Is the deduction amount provided by LIC or by the employee?
- Is it tax-exempt under 80C?
- Can an employee have multiple LIC policies deducted from salary?

**Why it's needed:** No LIC deduction logic exists.

**Impact if not answered:** LIC deduction must be manually entered.

---

## 18. Leave Encashment

### 18.1 Encashment Eligibility

**What we need:**
- Which leave types are encashable? (Earned Leave only? Casual Leave? Sick Leave?)
- Is encashment available while employed, or only at exit?
- If while employed: Is there a minimum leave balance to maintain? (e.g., must keep 15 EL, can encash above that)
- Is there a maximum encashment limit per year?
- Is encashment automatic at year-end, or employee-initiated?

**Why it's needed:** No leave encashment model exists.

**Impact if not answered:** Leave encashment cannot be processed.

---

### 18.2 Encashment Calculation

**What we need:**
- What is the encashment formula?
  - Daily rate = Basic / 26?
  - Daily rate = Gross / 30?
  - Daily rate = (Basic + DA) / 26?
  - Fixed amount per day?
- Is encashment amount taxable? (Fully taxable as "Salary")
- Is encashment paid through payroll or separately?

**Why it's needed:** Need the formula to calculate encashment amount.

**Impact if not answered:** Encashment amount cannot be calculated.

---

## 19. Full & Final Settlement

### 19.1 FnF Components

**What we need:**
- What components are included in Full & Final settlement?
  - Salary up to exit date (prorated)?
  - Leave encashment (which leave types)?
  - Gratuity (if eligible)?
  - Bonus (pro-rata)?
  - Notice pay (if not served)?
  - Notice period recovery (if employee didn't serve)?
  - Outstanding loan/advance recovery?
  - Asset recovery (value of unreturned assets)?
  - Incentive/Commission (pro-rata)?
  - Any other components?
- For each: What is the calculation formula?

**Why it's needed:** No FnF model or calculation exists.

**Impact if not answered:** FnF cannot be processed; must be calculated manually outside the system.

---

### 19.2 FnF Workflow

**What we need:**
- Who initiates FnF — HR, reporting manager, or employee?
- What is the approval workflow? (HR → Finance? Manager → HR → Finance?)
- What is the timeline for FnF processing? (Within X days of exit?)
- Is FnF generated as a separate document, or through the regular payroll run?
- Can FnF be revised after initial generation?

**Why it's needed:** FnF workflow determines the UI and API design.

**Impact if not answered:** No FnF workflow can be built.

---

### 19.3 Notice Pay & Recovery

**What we need:**
- What is the notice period? (30 days? 60 days? 90 days?)
- Is notice period per employee type/level, or company-wide?
- If employee doesn't serve notice: Is salary recovered for the notice period?
- If company terminates: Is notice pay given to employee?
- Can employee pay in lieu of notice (buy out notice period)?
- Is notice pay/recovery calculated on Basic or Gross?

**Why it's needed:** Notice pay/recovery is a key FnF component.

**Impact if not answered:** Notice pay/recovery cannot be calculated.

---

## 20. Bank Transfer File

### 20.1 Bank File Format

**What we need:**
- Which bank(s) does the company use for salary disbursement?
- What file format does each bank require?
  - CSV (generic)?
  - XLSX?
  - Fixed-width text?
  - Bank-specific format (e.g., HDFC, ICICI, SBI specific)?
- What fields are required in the file?
  - Employee bank account number
  - Employee name
  - IFSC code
  - Amount
  - Employee code
  - Any other fields?
- Is there a header row? What does it contain?
- Is there a trailer/summary row?

**Why it's needed:** No bank file generation exists. Need the exact format to generate the file.

**Impact if not answered:** Bank file must be manually created from payslip data.

---

### 20.2 Bank File Validation

**What we need:**
- Is the bank file validated before disbursement? If yes, by whom?
- Can the bank file be regenerated after correction?
- Is there a bank file confirmation/reconciliation process after disbursement?

**Why it's needed:** Determines if validation step is needed in the workflow.

**Impact if not answered:** No validation or reconciliation of bank disbursement.

---

## 21. Payroll Summary

### 21.1 Summary Content

**What we need:**
- What should the payroll summary report contain?
  - Total employees processed
  - Total gross earnings
  - Total deductions (PF, ESI, PT, TDS, other)
  - Total net salary
  - Department-wise / branch-wise breakdown?
  - Employee-type-wise breakdown?
  - Component-wise totals?
- Is the summary per payroll run, or cumulative for a period?
- Is it exportable (Excel, PDF)?

**Why it's needed:** No payroll summary page exists. Need the content to build it.

**Impact if not answered:** No payroll summary report available.

---

## 22. Payroll Reconciliation

### 22.1 Reconciliation Scope

**What we need:**
- What should be reconciled?
  - Payroll vs attendance (payable days match)?
  - Payroll vs statutory returns (PF/ESI/PT/TDS totals match challan)?
  - Payroll vs bank file (amounts match disbursement)?
  - Payroll vs previous month (variance analysis)?
- Is reconciliation manual (compare two reports) or automated (system flags mismatches)?
- What happens when a mismatch is found — block payroll, flag for review, or just report?

**Why it's needed:** No reconciliation module exists.

**Impact if not answered:** No reconciliation; errors may go undetected.

---

## 23. Payslip — Bulk & PDF

### 23.1 Bulk Payslip Format

**What we need:**
- Should bulk payslips be generated as individual PDFs or one combined PDF?
- Should payslips be password-protected? If yes:
  - What is the password? (Employee DOB? Employee code? PAN? Custom?)
  - Is the password per-employee or company-wide?
- Should payslips be emailed to employees? If yes:
  - From which email address?
  - What is the email template?
  - Is there an SMTP server available?
- Should payslips be downloadable by HR as a ZIP file?

**Why it's needed:** No PDF generation, no email, no encryption exists.

**Impact if not answered:** Payslips remain browser-print only; no bulk distribution.

---

### 23.2 Payslip Content

**What we need:**
- What should appear on the payslip?
  - Company logo and address?
  - Employee details (code, name, designation, department, PAN, PF number, ESI number)?
  - Bank account number?
  - Leave balance?
  - Attendance summary (days worked, LOP, leave taken)?
  - YTD (year-to-date) totals?
  - Tax breakdown (TDS deducted, cumulative tax, taxable income)?
- Is the payslip format defined, or should we use a standard template?

**Why it's needed:** Current payslip shows earnings/deductions/net only. Need to know what else to include.

**Impact if not answered:** Payslip will have minimal content; may not meet compliance or employee expectations.

---

## 24. Other Incentives

### 24.1 Incentive Types

**What we need:**
- The BRD lists: Performance Incentive, Attendance Incentive, Festival/Other Incentive.
- What "Other Incentives" does the company give?
  - Referral Bonus?
  - Double Machine Allowance?
  - Extra Work Allowance?
  - Festival Advance/Bonus?
- For each: What is the eligibility, calculation formula, and payment timing?
- Are these processed through payroll or paid separately?

**Why it's needed:** Only PMS Incentive exists. Other incentive types need business rules.

**Impact if not answered:** Other incentives must be manually entered as ad-hoc earnings.

---

## 25. Deduction Percentage Display

### 25.1 Display Requirement

**What we need:**
- Should "Total Deduction %" be displayed on the payslip, payroll summary, or both?
- What decimal places? (2? 1? 0?)
- Is it per employee or company-level?

**Why it's needed:** Not currently displayed despite data being available.

**Impact if not answered:** Deduction percentage will not be shown.

---

## 26. Payroll Status Classification (BRD §23)

### 26.1 COMPLETED vs LOCKED

**What we need:**
- The BRD defines COMPLETED as "salary calculated, validated, finalized, payslip available."
- The current system uses LOCKED as the final state.
- Is COMPLETED the same as LOCKED, or is COMPLETED a post-lock state (after payslips are generated and bank file is created)?
- If different: What triggers the transition from LOCKED to COMPLETED?

**Why it's needed:** Determines if we need an additional status after LOCKED.

**Impact if not answered:** No COMPLETED status; payroll stays LOCKED indefinitely.

---

### 26.2 PENDING vs HOLD

**What we need:**
- The BRD distinguishes PENDING (not yet processed, needs action) from HOLD (intentionally stopped).
- Current system only has HOLD (attendance not finalized).
- What scenarios should be PENDING vs HOLD?
  - PENDING: No salary structure? New joiner not set up?
  - HOLD: Manual hold by HR? Validation failure? Discrepancy?
- Can an employee be released from HOLD automatically (e.g., attendance finalized), or does it require manual release?
- Does releasing HOLD trigger automatic recalculation?

**Why it's needed:** Need to distinguish between "not yet processed" and "intentionally stopped."

**Impact if not answered:** All unprocessed employees are treated as HOLD, which may be misleading.

---

## 27. Validations

### 27.1 Negative Net Salary

**What we need:**
- If net salary becomes negative (deductions > earnings), what should happen?
  - Block the payroll line?
  - Allow with approval?
  - Cap deductions at gross earnings?
- Who can authorize a negative net salary?
- Is there a minimum net salary guarantee? (e.g., net salary cannot be less than 50% of gross)

**Why it's needed:** No validation exists for negative net salary.

**Impact if not answered:** Employees may receive negative net pay without any check.

---

### 27.2 Deduction Limit

**What we need:**
- Is there a maximum deduction limit? (e.g., total deductions cannot exceed 50% of gross)
- If yes, what is the limit?
- What happens when the limit is exceeded — block, warn, or require approval?
- Are statutory deductions (PF, ESI, PT, TDS) included in the limit, or only non-statutory?

**Why it's needed:** No deduction limit validation exists.

**Impact if not answered:** Entire salary may be consumed by deductions.

---

## Summary: Information Needed by Priority

### P0 — Cannot Build Without These (blocks payroll accuracy)

| # | Decision Needed | Stakeholder |
|---|----------------|-------------|
| 1 | LOM calculation method (Gross vs Basic×2) + shift duration + payroll days | Payroll Team |
| 2 | PF wage base (which components: Basic+DA, or includeInPf flag) | Payroll Team |
| 3 | ESI wage base (which components: full gross, or includeInEsi flag) | Payroll Team |
| 4 | OT calculation method (which of the 4 methods) + day-type multipliers | Payroll Team |
| 5 | Loan types in use + recovery rules + interest rates | Finance/HR |
| 6 | TDS: Old/New regime + tax slabs + cess + surcharge + rebate | Finance |
| 7 | Negative net salary and deduction limit rules | Finance/Management |

### P1 — Cannot Build Outputs Without These

| # | Decision Needed | Stakeholder |
|---|----------------|-------------|
| 8 | Bank file format (bank name, fields, format) | Finance |
| 9 | Payroll summary content (breakdown dimensions) | Management/Finance |
| 10 | Reconciliation scope (what to reconcile against) | Finance |
| 11 | Payslip content (fields, logo, YTD, tax breakdown) | HR/Payroll |
| 12 | Bulk payslip: PDF format, password, email, SMTP | HR/IT |
| 13 | Salary rounding rule (nearest 1/5/10/100) | Payroll Team |

### P2 — Cannot Build Workflow Without These

| # | Decision Needed | Stakeholder |
|---|----------------|-------------|
| 14 | Approval chain (Manager → HR → Finance? How many stages?) | Management |
| 15 | Workflow stages (VALIDATED, SUBMITTED, POSTED — needed?) | Management |
| 16 | Payroll cutoff date + reopen-after-lock rules | Payroll Team |
| 17 | COMPLETED vs LOCKED distinction | Payroll Team |
| 18 | PENDING vs HOLD classification rules | Payroll Team |
| 19 | Bulk processing: selective + pre-validation summary | Payroll Team |

### P3 — Feature Completeness

| # | Decision Needed | Stakeholder |
|---|----------------|-------------|
| 20 | LWF: applicable? State? Rates? Employee/employer split? | Finance/HR |
| 21 | Leave encashment: eligible leave types + formula + timing | HR/Payroll |
| 22 | Full & Final: components + formula + workflow + notice pay | HR/Finance |
| 23 | Night/Heat/Snacks/Food allowance: amount + formula + eligibility | Payroll Team |
| 24 | Attendance incentive: formula + eligibility | Payroll Team |
| 25 | Health insurance: scheme + employee contribution + frequency | HR/Finance |
| 26 | Canteen/Mobile/Transport/Lunch deduction: amount + rules | Payroll Team |
| 27 | LIC deduction: amount + source + tax treatment | Payroll Team |
| 28 | Bonus types: which types + formula + monthly accrual vs annual | Payroll Team |
| 29 | Other incentives: types + formula + eligibility | Payroll Team |
| 30 | State-wise PT slabs (which states? monthly vs half-yearly?) | Payroll Team |
| 31 | Investment declarations (80C/80D/etc.): collected? how? limits? | Finance/HR |
| 32 | Arrear types beyond salary revision (allowance, deduction, attendance, incentive, manual) | Payroll Team |
| 33 | Hourly-rate employees: exist? rate source? standard hours? | Payroll Team |
| 34 | Layoff days: real scenario? paid or unpaid? | Payroll Team |
| 35 | Leave-type breakdown in payroll (EL/CL/SL separate or combined?) | Payroll Team |
| 36 | PF employer contribution: 12% or 13%? EPS cap enforced? | Finance |
| 37 | ESI eligibility: re-evaluated monthly or permanent? | Finance |
| 38 | PT for joiners/exits: deducted in partial month? | Payroll Team |
