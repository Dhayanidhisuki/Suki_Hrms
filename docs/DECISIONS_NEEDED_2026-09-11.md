# Decisions Still Needed — After Reviewing All HR BRDs

**Date:** 2026-09-11
**BRDs Reviewed:**
1. Suki Kun Payroll.docx
2. suki kun Time office.docx
3. KUN HRMS - PT BRD.docx
4. KUN HRMS -Bonus & Gratuity BRD.docx
5. KUN HRMS -Increment & Arrear BRD.docx
6. KUN HRMS- Loan BRD.docx
7. KUN- Employee details.docx
8. suki kun new(personal).docx (overall HRMS scope)

---

## ANSWERED by HR BRDs (no decision needed)

| Topic | Answer from BRD |
|-------|----------------|
| PT slabs | 0-7500=0, 7501-10000=115, 10001-12500=171, 12501+=208 monthly |
| PT period | Half-yearly: I Half (Apr-Sep), II Half (Oct-Mar). Both Financial & Non-Financial variants |
| PT is state-specific | Yes — configurable by state, jurisdiction, employee category, salary slab, period |
| PT reports | Employee-wise, monthly, half-yearly, payment/challan |
| Bonus eligibility | Wage ≤ ₹21,000, worked ≥ 30 days |
| Bonus min/max | 8.33% min, 20% max |
| Bonus status flow | Pending → Eligible → Calculated → Approved → Processed |
| Gratuity formula | Last Drawn Eligible Salary × 15/26 × Completed Years |
| Gratuity components | Configurable per component (Basic, DA, other — `includeInGratuity` flag) |
| Gratuity ceiling | Configurable, effective-dated |
| Gratuity approval | HR Initiation → Payroll Validation → HR Approval → Finance Approval → Settlement |
| Gratuity death/disability | Special rules, nominee info, separate config |
| Salary revision methods | Percentage, Fixed Amount, Revised Gross Direct |
| Revision approval | HR Executive → HR Manager → Management |
| Revision status flow | Draft → Submitted → HR Verification → Pending Approval → Approved → Effective → Arrear Calculated → Payroll Processed → Completed |
| Arrear calculation | Month-wise, gross difference + PF arrear + ESI arrear |
| Arrear PF basis | Component-based (PF-applicable components), not gross |
| Loan types | Salary Advance, Festival Advance, Personal Loan, etc. |
| Loan master fields | Code, name, category (Loan/Advance), min/max amount, max tenure, interest (Yes/No, Flat/None), deduction frequency, payroll deduction code, multiple loan allowed |
| Loan eligibility | Min service, employee category, dept, designation, employment type, grade, max active loans, min salary |
| Loan status | OPEN, CLOSED, SHORTCLOSED, HOLD, CANCELLED |
| Loan short closure | Allowed with reason, future deductions cancelled |
| Loan hold/resume | Allowed with reason, no auto double-deduction |
| Loan payroll integration | Auto-deduction, balance update, duplicate prevention |
| Loan exit settlement | Outstanding identified for FnF, recovery through final settlement |
| Loan employee self-service | Apply, view status, repayment schedule, outstanding |
| OT eligibility | Per employee (JobInfo.overtimeAllowed) |
| OT threshold | Configurable (OTPlan.applicableAfterMinutes) |
| OT factor | 1.0×/1.5×/2.0× configurable |
| OT Sunday/holiday | OT or Comp-Off (configurable) |
| Leave master config | Code, name, annual days, accrual type, carry-forward, carry-forward limit |
| Leave approval | Employee → Reporting Manager → HR |
| Permission policy | Free hours per month (configurable, default 2) |
| Permission approval | Manager → HR |
| Mispunch approval | Manager → HR |
| Canteen structure | Token eligibility, daily/monthly quantity, food deduction rate, employee + company contribution |
| Petrol structure | Approved KM × Rate per KM, manager approval |
| Performance incentive | Company 50% + Individual 50%, capped at 100%, HR approval |
| Double machine | HR manual entry, machine 1/2, no. of machines, working days/hours, incentive rate |
| Attendance statuses | Present, Absent, Half Day, Weekly Off, Holiday, Leave, Permission, Comp-Off, On Duty, Missing Punch, LOP, Holiday Worked |
| Freeze after payroll | Attendance + Leave + OT + Permission + Comp-Off frozen |
| Reopen | Authorized HR/Admin only, captures user/date/reason |
| HRMS modules | Full module list defined in overall BRD |

---

## STILL NEEDED — Decisions Required

### P0 — Critical (blocks payroll accuracy)

| # | Decision | Reason |
|---|----------|--------|
| 1 | **LOM formula** — Gross-based or Basic×2? What shift duration (8 or from ShiftMaster)? What payroll days denominator (26 or 30/31)? | Late/early minutes exist in attendance but payroll doesn't deduct them. Salary is wrong for late/early employees. |
| 2 | **PF wage base** — Basic+DA only, or use `includeInPf` component flags, or full gross? | Flag exists but not consumed. PF may be over/under calculated. Arrear BRD says PF should be component-based, not gross. |
| 3 | **ESI wage base** — Full gross, or use `includeInEsi` component flags? Does OT/bonus/arrears count in ESI wage? | Flag exists but not consumed. ESI may be wrong. |
| 4 | **OT method** — Which of the 4: Basic×2, Gross dynamic, Fixed rate, or Basic+DA+HRA? | Only gross-based is implemented. 3 methods missing. Time Office BRD says configurable but doesn't say which one company uses. |
| 5 | **OT day-type rates** — What multiplier for weekday, weekend, holiday? | All OT paid at single rate. No day-type differentiation. |
| 6 | **TDS** — Old or New regime? Tax slabs for current FY? Cess %? Surcharge %? Rebate threshold? | Flat monthly slab lookup only. No annual engine. TDS is wrong. |
| 7 | **Negative net salary** — Block, allow with approval, or cap deductions at gross? Minimum net salary guarantee? | No validation. Employee can get negative net pay. |
| 8 | **Deduction limit** — Max total deductions as % of gross? Statutory included or excluded? | No limit. Entire salary can be consumed by deductions. |
| 9 | **Permission excess → LOP/LOM** — Auto-convert excess permission hours to LOP/LOM? Or manual HR correction only? | Excess hours flagged but not deducted. No salary impact. |
| 10 | **Comp-Off eligibility** — Minimum hours on Sunday/holiday to earn comp-off? Auto-generate or manual? | No Comp-Off model at all. Sunday/holiday work not compensated. |
| 11 | **Comp-Off expiry** — How long is comp-off valid? Can it be encashed? | No comp-off balance to expire. |

### P1 — High (blocks outputs)

| # | Decision | Reason |
|---|----------|--------|
| 12 | **Bank file format** — Which bank? What format (CSV/TXT/XLSX)? What fields? Header/trailer rows? | No bank file generation. Manual file creation from payslip. |
| 13 | **Payroll summary content** — What breakdowns (dept, branch, employee-type, component-wise)? Exportable? | No summary report. No company-level totals. |
| 14 | **Reconciliation scope** — Reconcile against what (attendance, statutory challan, bank file, previous month)? | No reconciliation. Errors go undetected. |
| 15 | **Payslip content** — Company logo? PAN/PF/ESI numbers? Bank account? Leave balance? YTD totals? Tax breakdown? | Payslip shows earnings/deductions only. Minimal content. |
| 16 | **Bulk payslip** — Individual PDFs or combined? Password-protected? Password = DOB/code/PAN? Email to employees? SMTP server? | No PDF, no email, no encryption. Browser print only. |
| 17 | **Salary rounding** — Nearest 1/5/10/100? Applied to net only or also PF/ESI/PT/TDS? Round-off shown separately? | Hardcoded `Math.round()`. No configurable rule. |
| 18 | **Canteen token rate** — Actual per-token deduction amount? Employee vs company contribution split? | Structure defined in BRD but no actual rates. |
| 19 | **Petrol rate per KM** — Actual company rate? | Structure defined in BRD but no actual rate. |
| 20 | **Double machine incentive rate** — Actual per-machine or per-hour rate? | Structure defined in BRD but no actual rate. |
| 21 | **Attendance bonus** — Actual amount? Eligibility = full attendance + no LOP? | Eligibility defined in BRD but no amount. |
| 22 | **Shift bonus** — Actual amount per shift type? Which shifts eligible? | Mentioned in BRD but no amount or eligibility. |
| 23 | **Time Office Final** — Is this a formal approval stage before payroll? Who approves? What fields to review? | No Time Office Final page. No formal handoff to payroll. |
| 24 | **Biometric grid** — Monthly day×employee grid with color coding? What color thresholds? | No grid view. No color coding. Poor HR experience. |

### P2 — Medium (workflow completeness)

| # | Decision | Reason |
|---|----------|--------|
| 25 | **Payroll workflow stages** — Are VALIDATED, SUBMITTED, POSTED needed as separate stages? Salary Revision BRD has 9 stages; Payroll BRD has 7. Current has 4. | Need to know which stages to build for payroll run. |
| 26 | **Payroll approval chain** — Manager → HR → Finance? Or just HR? Salary Revision BRD says HR Exec → HR Manager → Management. Does payroll follow same? | Single approver only. No Finance stage. |
| 27 | **Payroll cutoff** — What date each month? Can future month process before current locked? | No cutoff logic. Runs open-ended. |
| 28 | **COMPLETED vs LOCKED** — Is COMPLETED a post-lock state (after payslips + bank file)? | Only LOCKED. No COMPLETED. |
| 29 | **PENDING vs HOLD** — What scenarios are PENDING (not processed) vs HOLD (intentionally stopped)? Salary Revision BRD defines Hold with reason. | All unprocessed = HOLD. Misleading. |
| 30 | **Bulk processing** — Selective employee processing? Pre-validation summary (X valid, Y errors)? Salary Revision BRD has bulk upload with success/fail count. | All-or-nothing. No selective processing. |
| 31 | **Reopen rules** — Who can reopen frozen payroll? Does reopen auto-trigger recalculation? | Reopen exists but no auto-recalc. |
| 32 | **Weekly OT** — Minimum weekly OT threshold (e.g., 3 hours)? How aggregated? | No weekly OT calculation. |
| 33 | **Monthly OT limit** — Max OT hours per month? What happens when exceeded? | No monthly OT cap. |
| 34 | **OT incentive slabs** — What slab ranges? What incentive per slab? | No OT incentive slab model. |
| 35 | **Leave-type breakdown** — Should payslip show EL/CL/SL separately? Which leave types are paid vs unpaid? | Single `leaveDays` total. No type breakdown. |
| 36 | **Holiday worked** — Flag in monthly summary? Different OT rate for holidays? | No holiday OT differentiation. |
| 37 | **Error messages** — Use BRD's exact 9 messages? Or customize? | 7 of 9 BRD messages missing. |
| 38 | **Arrear types** — Need allowance arrears, deduction reversal, attendance correction, incentive correction, manual adjustment? Increment BRD only covers salary revision arrears. | Only gross revision arrears implemented. |
| 39 | **Arrear approval** — Separate arrear approval needed? Increment BRD says "optionally" separate. | No separate arrear approval. |

### P3 — Lower (feature completeness)

| # | Decision | Reason |
|---|----------|--------|
| 40 | **LWF** — Applicable? Which state? Employee/employer rate? Monthly or half-yearly? | No LWF model. |
| 41 | **Leave encashment** — Which leave types encashable? Formula (Basic/26 or Gross/30)? While employed or exit only? | No encashment model. Time Office BRD mentions "Encashment Allowed" config but no formula. |
| 42 | **Full & Final** — What components (salary, leave, gratuity, bonus, notice pay, loan, asset)? Formula for each? Workflow? Loan BRD says outstanding loan goes to FnF. Gratuity BRD has its own settlement flow. | No FnF model. Need to consolidate all exit components. |
| 43 | **Notice pay** — Notice period days? Basic or Gross? Buy-out allowed? | No notice pay logic. |
| 44 | **Night shift allowance** — Amount or formula? After what hour? Auto-calc from ShiftMaster? | No auto-calc. |
| 45 | **Heat allowance** — Amount? Who eligible? Auto or manual? | No auto-calc. |
| 46 | **Snacks/Food/Meals allowance** — Amount? From ShiftMaster flags? Per day or per month? | No auto-calc. |
| 47 | **Health insurance** — Scheme? Employee contribution? Monthly or annual? 80D exempt? | No deduction logic. |
| 48 | **LIC** — Deducted from salary? Amount source? 80C exempt? | No deduction logic. |
| 49 | **State-wise PT** — Which states? Monthly or half-yearly? Annual cap? PT BRD says state-specific but doesn't list states. | Single global slab. PT BRD says state-specific but no states configured. |
| 50 | **Investment declarations** — Collected? How (online/paper)? 80C/80D limits? Validated against proofs? | No declaration module. Old regime TDS impossible. |
| 51 | **Bonus types** — Festival, performance, annual, ex-gratia, production? Monthly accrual or annual payment? Bonus BRD covers statutory bonus. Other types? | Single bonus type only. |
| 52 | **Hourly-rate employees** — Exist? Rate source? Standard hours? Same statutory treatment? | All treated as monthly. |
| 53 | **PF employer rate** — 12% or 13%? EPS cap (₹1,250) enforced? | May be wrong. |
| 54 | **ESI eligibility** — Re-evaluated monthly or permanent once above ceiling? | May deduct from ineligible. |
| 55 | **PT for joiners/exits** — Deducted in partial month? Deducted in exit month? | No edge-case handling. |
| 56 | **Break time** — Lunch/tea break deducted from working hours? How many minutes? | No break model. Working duration may be wrong. |
| 57 | **Probation leave** — Are probationers eligible for leave? Which types? How many days? | No probation-specific rules. |
| 58 | **Deduction % display** — Show on payslip? What decimal places? | Not shown despite data available. |
| 59 | **Attendance color thresholds** — Working-hours ranges for Red/Orange/Yellow/Light Green/Dark Green/Blue? | No configurable thresholds. |
| 60 | **Incentive Policy Master** — Configurable rules for all incentive types? | No incentive policy model. |
| 61 | **Gratuity accrual/provision** — Monthly accrual or only at exit? Gratuity BRD mentions "periodic accrual or provision, where applicable." | Only calculation at exit. No monthly provision. |
| 62 | **Gratuity estimation** — Available to employees (self-service) or HR only? Gratuity BRD says "subject to permissions." | No estimation facility. |
| 63 | **Loan interest method** — Only No Interest and Flat Interest for now? Reducing-balance later? Loan BRD says start with these two. | Need confirmation on initial scope. |
