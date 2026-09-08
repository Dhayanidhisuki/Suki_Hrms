# `hr brd/` folder inventory (scanned 2026-09-05)

85 files from KUN Aerospace Pvt Ltd (Ambattur, Chennai). All are client-supplied
reference data for the SUKI HRMS build: payroll registers, the employee master,
statutory returns, finance reports, HR letters/forms, and the report checklist.
Grouped by purpose, not by folder. Row counts are employee rows unless stated.

---

## 1. Employee master (the import source)

| File | Content |
|---|---|
| `KUN- Emp.xlsx`, `Kun- Emp Master.xls` | Same data, 439 employees x 76 columns. **Complete master**: category, level, type, class, grade, dept name/id, designation/code, title, first/last name, emp code, old code, guest flag, gender, DOB, DOJ, probation, confirm date, exit date, daily sheet req, shift duration, retirement date, unit, shift, next revision date, additional role, team group, supplier, marital status, email, OT type, category code/name, mobile, Aadhaar, PAN, permanent address (3 lines, city, state, country, pincode), bank name / A/c no / IFSC, salary components (Basic, DA, HRA, LTA, Medical, Education, Additional HRA, Special, Other, Conveyance, Wash, Attendance, Other 2, Gross), wage type, payment mode, UAN, PF no, PF allow, PF restrict wage, ESI no, ESI allow, OT allow, OT factor, OT per-hour rate, production line, reimbursement, site. |

This one file covers Employee, PersonalDetails, ContactDetails, JobInfo, BankDetail
and the salary revision components in the HRMS schema.

## 2. Monthly payroll registers (Saral exports)

| Month | Salary Register | Overtime Register | PMS Incentive Register |
|---|---|---|---|
| Feb 2026 | root (438 emp, has Fixed Gross block) | root `Overtime Salary Register` (+ dept summary, 24-month OT comparison) | root (ESI 0.75% / 3.25% columns) |
| Apr 2026 | `03.08.2026/April'2026` (434) | yes (+ 4-month comparison) | yes |
| May 2026 | `03.08.2026/May'2026` (~438) | yes (+ 5-month comparison) | yes |
| Jun 2026 | `03.08.2026/June'2026` (~453) | yes (+ 6-month comparison) | yes |
| Jul 2026 | `03.08.2026/July'2026` (472) | – | – |

Salary Register columns: identity (Emp ID, name, dept, designation, DOJ, gender,
sal structure, category STAFF/TRAINEE), Total Earning (theoretical), Sal Cal Days,
LOP, Pay Days, earned Basic/HRA/LTA/Medical/Education/Add HRA, deductions
(Canteen, LWF, Mobile, Other, Mediclaim, Salary Adv, Snacks, PF, ESI, PT, TDS),
Net, bank A/c/IFSC/bank, Remark PROCESS/HOLD.

Overtime Register columns: Basic (Th), OT hrs, OT amount, Cumulative OT incentive,
Shift Continuation, Double Machine incentive, Attendance Bonus, Extra Work,
Employee Referral, Total OC earning, OC employee/employer ESI, OC net.

PMS Register columns: PMS fixed incentive, PMS % (KPI), days, prorated incentive,
ESI employee/employer, PMS net.

Other payroll files:
- `03.08.2026/CTC Break Up.xlsx` – Annexure-I CTC letter for one employee (salary break-up, deductions, employer PF/ESI/gratuity/bonus/mediclaim, annual CTC) plus scratch formulas.
- `Arrear Salary - April'25.xlsx` – LOP-reversal arrear sheet: per-head original vs arrear amounts for 2 employees.
- `21.04.2026/Reconciliation Report.xlsx` – Mar 2026 salary reconciliation: every pay head as per Feb, then additions (joined), deletions (left), increments/changes, arriving at Mar totals.
- `21.04.2026/Increment Report.xlsx` – Increment report Jan–Mar 2026 (per employee before/after Basic, HRA, LTA, Medical, Education, Add HRA) plus an "INC" sheet that is a **proposed screen layout** for the increment module (columns + Delete/Edit/Verification/Approved/Bulk Upload/Add buttons).
- `Suki Salary Processing feedback.xlsx` – KUN's review of our payroll output: ESI not applicable above gross 21,000; canteen = 600 / sal days x pay days; OT rate = basic/26/8x2; cumulative OT incentive 500 (50–69 h) / 1000 (70+ h); attendance bonus only for trainees; manual-entry heads.

## 3. Statutory / compliance

| File | Content |
|---|---|
| `Professional Tax_2025-2026_II Half_Sep 25-Feb'26.xlsx` | Per-employee monthly earned gross + PT for Sep–Feb, half-year totals; slab break-up sheet (TN slabs, only 12,501+ pays 1,250/half-year). |
| `21.04.2026/Professional Tax Slab Report.pdf` | Saral "PT detailed report" for Mar 2026, employees grouped by PT deducted (0, 30, 72, 155, 171, 208) with PT gross. |
| `ESI-Jan'26/Esi active - Jan'26.xlsx` | ESI-covered employees (~95): IP number, work days, salary wages, incentives, employee/employer contribution, final wages; plus left-employee list with last working day. |
| `ESI-Jan'26/final MC_Template1 - January'26.xls` | ESIC monthly contribution upload template (IP number, name, days, wages, reason code, last working day) + reason-code sheet. |
| `21.04.2026/FINANCE_REPORTS_RELATED_TO_HRMS/12_ESI & PF 2024-25.xlsx` | Monthly ESI and EPF payable vs paid tracker (employer/employee contribution, due date, challan no, paid date, diff). |
| `21.04.2026/FINANCE_REPORTS_RELATED_TO_HRMS/04_TDS-24Q-FORMAT-QUARTERWISE.xlsx` | Full 24Q return workbook: Deductor master, Employee (PAN, regime, DOB, address, bank), Salary heads, Other details (Chapter VI-A), Perquisites, NSC, SalDeduction (~340 rows of monthly TDS), Challan. |
| `Updated Active Bonus 2024-2025.xlsx` | Statutory bonus FY 2024-25: earned basic per month Apr–Mar for 323 active + 126 inactive + 14 late joiners, 8.33 % bonus, bank details; also a **bonus-screen layout** sheet. |
| `21.04.2026/Form-15 (I & II) Register of Leave with Wages.xlsx` | Factories Act Form 15 Part I & II layouts. |
| `21.04.2026/Form-25 Muster Roll.xlsx` | Form 25 muster roll / compensatory holidays layout. |
| `21.04.2026/Form-25B Payslip-Time Card-Service Card.xlsx` | Form 25B time card / payslip layout + KUN's own payslip format (26th-to-25th cycle). |
| `21.04.2026/Form-25C ID Card.xlsx` | Form 25C photo ID card layout. |
| `21.04.2026/Half Yearly Return/Form-21 - Half Yearly Return - 2025.xlsx` | Form 21 half-yearly return (Jun 2025). |
| `21.04.2026/Half Yearly Return/Form 2 - PSA, CPSW.xlsx` | Form 2 Subsistence Allowance return, Form 2 Conferment of Permanent Status, confirmation list (30 workmen), monthly working-days / mandays calc, monthly employee strength (opening, joined, left, closing). |
| `21.04.2026/Annual Return/Form-22 - Annual Return - 2025.doc` | Form 22 combined annual return: factory registration TVR/09353, occupier/manager, products manufactured with quantity and value, employment figures. |
| `21.04.2026/Annual Return/Annual Returns_2025.xlsx` | Working sheets for Form 22: monthly headcount by gender and category (Staff/NJ/Trainee/NAPS), mandays, OT hours by gender, on-roll salary totals, product list. |
| `ASI RETURN 2024-2025.xlsx` | Annual Survey of Industries data 2022-23 to 2024-25: monthly working days, male/female workers first/last day, mandays, absent days, trainees, contract workers, managers, office staff. |

## 4. Full & Final settlement (one worked example, Asohan K)

`21.04.2026/Full & Final Settlement/` – F&F sheet (resignation date, DOJ, F&F date,
salary dues, deductions), Bonus working FY 2025-26, Gratuity working (last basic,
service 13y 8m 29d rounded to 14 y, amount), Leave working (year-wise EL opening,
credit, availed, balance, CL lapsed since 2012).

## 5. Finance reports (`21.04.2026/FINANCE_REPORTS_RELATED_TO_HRMS/`)

| # | File | Content |
|---|---|---|
| 01 | `SALARY-FORMAT-KOTAK.xls` | Kotak bulk salary upload format (client code, product SALPAY, IFT, debit A/c, beneficiary name/IFSC/A/c, narration) + DD payable locations. |
| 02 | `SALARY-FORMAT-OTHERBANK.xls` | Same format for NEFT to other banks. |
| 03 | `Project-Cost.xlsx` | Template: salary particulars (direct/indirect, Unit I/II, regular/FAI) split across 18 project columns. |
| 05 | `Head-count.xlsx` | Monthly headcount Jan-24 to Mar-26 by dept, category (direct permanent/trainee/temporary, indirect) and type (onroll/contract). |
| 06 | `ATM-List.xlsx` | Incentive payout list (code, A/c, name, amount, IFSC). |
| 07 | `COPY-TABLE.xlsx` | Salary JV: GL code, GL name, Dr/Cr for basic, other income, PF, social security etc. |
| 08 | `Comparision-statement.xlsx` | Month-wise Apr-25 to Mar-26: employee count, earned gross, net, incentive, and diff. |
| 09 | `UNPAIDSALARY-OT-LIST.xlsx` | Statement of unpaid salary (same columns as ATM list). |
| 10 | `Salary-comparision.xlsx` | Per employee (~450): Mar gross & incentive vs Feb, diff, revised %. |
| 11 | `DEPARTMENTWISE-VALUEWISE.xlsx` | Salary band matrix: dept vs 0-20k / 20-40k / ... / 150k+. |
| 12 | `ESI & PF 2024-25.xlsx` | see statutory section. |

`Final Project Wise General Costing sheet - February'2026.xlsx` – project cost
allocation: per employee earned gross split by % across ~20 customer projects
(Ametek, Amphenol, Barksdale, Circor, CW, Crane, Deutsch, Eaton, Hydro-Aire, IEC,
Lockheed, Magal, Moog, P&W, TAC, Tyco, BATL, Parker, Woodward) with
Production vs FAI split; sheets for General, Projects, Production, Engineering,
Quality, CAM Programmer, plus dept headcount and dept cost roll-ups.

## 6. HR MIS reports (`21.04.2026/`)

| File | Content |
|---|---|
| `Bank Statement Report.xlsx` | Bank-wise salary credit letters for 22 banks (Kotak ~340 employees, HDFC, SBI, BOI, IOB, Canara, Indian, Union, CUB, KVB, ICICI, Federal, IDBI, ESAF, Axis, CBI, TMB, BOB, UCO). |
| `Employee Summary.xlsx` (+ Copy) | Single-employee summary (K Ganesh): current details, classification changes, yearly & monthly salary heads, theoretical salary, statutory (PF/ESI/PT/TDS) by FY, leave summary, checklist. |
| `Head Count Report.xlsx` | MIS headcount by salary structure and dept, monthly opening / joined / left / closing. |
| `OT Justification Comparison_Mar'2026...xlsx` | Day-wise attendance codes (P, OOD, CO, CL, EL, WO, LOP) for ~490 employees for Mar 2026, dept consolidation, OT hours (onroll vs contract), manpower available vs required, shortage. |
| `Check List_HRMS Reports.xlsx` (2 copies) | The 37-item HRMS report/layout checklist with priority, frequency, developer, status, and HRMS navigation path; plus "Points" (employee master corrections) and "KUN" status sheets. Notable: salary logic to be % of gross – Basic 55, HRA 30, LTA 5, Medical 7, Education 3. |

## 7. Letters, forms, training (`Forms/`)

- Letter templates (docx, each a filled example): Offer Letter, Appointment Order (terms, probation 6 months, leave, notice), Confirmation Letter, Designation Change, Internal Job Transfer, Promotion, Bonafide Certificate, Internship Acceptance, Internship Completion Certificate, Service/Relieving Certificate (above and below Junior Engineer), Show-cause Notice, Warning Letter (absenteeism).
- Joining forms (pdf): Application form (R/HRD/13:A), Joining Report (R/HRD/13:B), ESI Form 1 declaration, PF Form 2 nomination, Gratuity Form F nomination; `ESI & PF Need Data.xlsx` lists what a joiner must supply (IP number, UAN, Aadhaar, mobile, photo).
- Training / competency: Annual Training Calendar 2025-26 (topics, trainer, target depts, planned month), Training Needs Identification form (IT & System employees vs 30 topics), Skill Matrix – Store (per employee desired/available/gap across 14 skills), HR Process Metrics (KPIs: skill level, training completion, attrition ≤7 %, safety incidents, with monthly data).

## 8. Gate entry (`Gate Entry/`)

`Gate Entry Inward Outward Visitor Entry .xlsx` – screen specs for three screens:
Gate Inward (transaction type, doc no/date, card code/name, vendor invoice no/date,
vehicle no, status, prepared by, items), Gate Outward (vendor DC no, entry date/time),
Visitor Entry (visitor name/details, whom to meet, in/out time, steps).

## 9. Commercial scope

`SUKI - ERP_KUN_AEROSPACES_SCOPE.docx` – SUKI HRMS quotation and scope: modules,
3-month plan, server spec, licence, AMC, plus minutes of the June/July 2025
requirement meetings.
