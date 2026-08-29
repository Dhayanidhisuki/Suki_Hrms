# Legacy ERP Schema Analysis — `ERPDB_KUN_HRMS`

**Date:** 25 August 2026
**Source:** `script.sql` supplied by the client (SQL Server generate-script output)
**Purpose:** Extract the manufacturing HR/payroll logic already encoded in the client's live ERP, and reconcile it against the BRD, the sidebar, and the current Prisma schema.

---

## 1. What the file contains

| Object type | Count |
|---|---:|
| Tables | 867 |
| Stored procedures | 0 |
| Views | 0 |
| Functions | 0 |
| Triggers | 0 |
| INSERT / seed rows | 0 |

**Critical limitation:** this is a **structure-only** script. It contains no calculation logic and no data.

Consequence: the ERP tells us **what is stored** — every component, every rate, every flag — but **not how anything is computed**. Payroll formulas, LOP rules, OT computation and PF/ESI logic live in the ERP's application code, which we do not have. The request for the client's live payroll workbook (one filled month with formulas) therefore still stands, and is now more precisely scoped: we know exactly which columns need formulas.

Also missing: no master data rows, so we do not yet have the actual list of departments, designations, categories, leave types or salary components in use.

Of the 867 tables, roughly **70 are HR, payroll, attendance, recruitment, visitor or RBAC** tables. The remainder is manufacturing ERP (production, quality, purchase, stores, sales, accounts) and is out of scope, with two exceptions noted in section 8.

---

## 2. Answers to previously open questions

### Q1.2 / Q1.3 — Multiple entities: CONFIRMED MULTI-UNIT

- `COMPANY_DETAILS` — 70 columns, keyed `COMPANY_ID`, carries `UNIT_NO`, `GSTIN`, `STATE`, `CIN_NO`, `IT_PAN_NO`, `BRANCH_NAME`, `IS_BASED_ON_HO`, `MAX_NO_USER`, bank details and document templates.
- `COMPANY_CHILD_UNIT_DETAILS` — parent/child unit structure with its own `STATE_CD`, address, contacts and **`CANTEEN_AMT`** (canteen rate is set per unit).
- `EMPLOYEE.UNIT_NAME` and `HRMS_EMP_MON_SALARY_DETAILS.UNIT_NAME` — payroll rows are stamped with the unit.

**Decision implied:** the organization is **multi-unit with per-unit GSTIN and state**. A `Company` model and a `Branch`/`Unit` model are required. This closes gap G1 and confirms the Company master must exist, not merely a settings page.

### Q1.7 / Q1.10 — Reporting manager: CONFIRMED NAMED, AND MATRIX

`EMPLOYEE` carries **four separate manager foreign keys**:

| Column | Meaning (to confirm) |
|---|---|
| `HOME_MANAGER` | Administrative / departmental manager |
| `BUSINESS_MANAGER` | Functional / business-line manager |
| `HR_MANAGER` | HR business partner |
| `VR_MANAGER` | Reviewing authority (to confirm) |

Plus `CONT_SUP_CODE` (contractor supervisor) and `MANAGER_PERM` (a manager-permission flag).

**Decision implied:** every employee has **named managers**, and reporting is **matrix**, not a single chain. This resolves Q1.7 decisively and makes the current single `Employee.reportingManagerId` insufficient. Approval routing must be able to pick *which* manager type approves *which* request.

### Q1.8 — Employee classification: FOUR AXES, NOT ONE

`EMPLOYEE` carries `EMP_CLASS`, `EMP_CAT`, `EMP_SUB_CAT`, `EMP_TYPE` and `EMP_LEVEL`, backed by `HRMS_EMP_CLASS` and `HRMS_EMPLOYEE_TYPE_MASTER`.

The current Prisma schema has only `Category` and `EmployeeType`. Two more axes (Class, Sub-Category) are missing. The actual value lists are still needed — the script carries no data.

### Q1.9 — Grade vs Level: CONTRADICTS DECISION O3

`HRMS_DESIG_LEVEL_MASTER` stores, per designation level: **`BASIC`, `BASKET_ALLOW`, `HRA`** and `SCREENING_LEVEL`. `HRMS_SALARY_DETAIL_FOR_LEVEL_DESIG` extends this to level + designation combinations.

`HRMS_GRADE_MASTER` is by contrast a thin ranked list (`GRADE_CODE`, `GRADE_NAME`, `SEQ_NO`).

**This contradicts decision O3** ("Level is organizational rank, not a pay band"). In the ERP, **Level drives default salary components**. Either the client's 5-level answer describes a different concept from the ERP's `DESIG_LEVEL`, or O3 needs revising. Logged as contradiction C1 and must be resolved before the salary structure is designed.

### Compliance state: CONFIRMED TAMIL NADU

`HRMS_EMP_MON_SALARY_DETAILS.TNLWF` and `HRMS_MONTHLY_SALARY_DEDUCTION.TNLWF` — Tamil Nadu Labour Welfare Fund.

**Decision implied:** the applicable Factories Rules are Tamil Nadu's, which matches the BRD's Forms 25, 15, 25B, 25C, 21 and 22. Closes gap G18.

### Biometric vendor: CONFIRMED eSSL

`ESSL_ATTENDANCE_LOG` and `ESSL_CANTEEN_DETAIL_LOGS` — the devices are **eSSL**, and the same device estate also feeds canteen consumption.

---

## 3. Approval engine — Topic 2 substantially answered

Two tables define a **generic, configurable, multi-level approval engine**:

**`MULTI_LEVEL_APPROVAL_MASTER`** — the configuration
`ROW_ID, TYPE, LEVEL, APPROVER_ID_1, APPROVER_ID_2, APPROVER_ID_3, DEPT_ID, STATUS`

**`MULTI_APPROVAL_CREATION`** — the running requests
`ROW_ID, REF_ID, TRANS_REF_NO, TYPE, APPROVER_ID, STATUS_ID, LEVEL, COMMENTS, CREATE_DT, CREATE_USER_ID, ...`

What this tells us:

- Approval chains are **configured per transaction type and per department**, not hard-coded.
- Chains are **multi-level** (`LEVEL`), with up to **three alternate approvers per level** — the standard answer to "what if the approver is on leave".
- Requests carry a free-text `COMMENTS` field, so approve/reject remarks are expected.
- `REF_ID` + `TRANS_REF_NO` + `TYPE` is a polymorphic pointer back to the originating record — exactly the Approval Center design the BRD describes.

**Decision implied:** build a generic `ApprovalWorkflow` (config) + `ApprovalRequest` + `ApprovalStep` model set, not per-module approval columns. The three-fixed-approver design should be normalized into rows.

Separately, `PURCHASE_APPROVAL` exists for the purchase side, confirming the same pattern is used across the ERP.

---

## 4. Attendance — the manufacturing model

### Capture

| Table | Purpose |
|---|---|
| `ESSL_ATTENDANCE_LOG` | Device punches: `IN_TIME`, `OUT_TIME` (decimal hours), `SHIFT`, `ATTENDANCE_TYPE`, `EARLY_IN_MINS`, `EARLY_OUT_MINS`, **`LOM_MINS`**, `OT_MINS`, `TOT_WO_MINS`, `HALF_DAY` |
| `ATTENDANCE_ENTRY` | Mobile/manual punch with **geolocation and photo**: `LAT_LONG_IN/OUT`, `ATT_LOC_IN/OUT`, `FILE_NAME_IN/OUT` |
| `HRMS_ATTENDANCE_LOCATION_MASTER` | Permitted attendance locations (geofencing) |
| `DAILY_ATT_FILE_UPLOAD` | Bulk file import path |
| `OD_ATTENDANCE_ENTRY`, `HRMS_EMP_ONDUTY` | On-duty (off-site work counted as present) |

**"LOM" = Loss of Minutes** — the client's late-arrival concept, tracked in minutes, carried all the way into payroll (`LOM`, `LOM_AMT`, `TOTAL_LOM`, `LOM_DED_ALLOW`, `LOM_ALLOW_MINUTES`). This is distinct from LOP (Loss of Pay, in days).

`EMPLOYEE.GRACE_MINS` — **grace period is per employee**, not a global setting. `EMPLOYEE.ATTENDANCE_REQ` flags whether an employee is under attendance control at all.

### Shift model

`HRMS_SHIFT_MASTER`: `SHIFT_NAME`, `SHIFT_TIME`, `START_TIME`/`END_TIME` (both decimal and `time(7)`), **`IS_NIGHT_SHIFT`**, **`IS_PROD_SHIFT`**, **`SNACKS_ALLOW`**, **`MEALS_ALLOW`**, `END_PUNCH_BUFFER_MIN`.

**Shift drives allowance eligibility** — snacks and meals entitlement is a property of the shift, and the payroll table counts `NO_OF_NIGHT_SHIFTS`, `NO_OF_SNACKS_SHIFTS`, `NO_OF_MEALS`.

`SHIFT_PLAN` and `SHIFT_PLAN_OT_HOURS`: per employee, per month, with `DAY1`..`DAY31` columns — the roster is **planned per employee per day**, and planned OT is rostered separately from actual OT (`PLAN_SHIFT_DET` vs `ACTUAL_SHIFT_DET`).

### Holiday master — gap G5 closed

`HRMS_HOLIDAY_MASTER`: `HOL_CODE`, `YEAR`, `DATE`, `HOLIDAY_REASON`, **`HOLIDAY_TYPE`**.

The holiday calendar exists in the ERP and is typed (national / festival / plant shutdown). It is missing from the BRD sidebar and must be added.

### Daily and monthly attendance storage

`HRMS_EMP_DAILY_ATT_DETAILS_*` — **eight parallel tables**, each a 31-day pivot: `INTIME`, `OUTTIME`, `LATE`, `EARLYOUT`, `OD`, `PERMISSION`, `REMARKS`, `ACTUALSHIFT`.

`HRMS_EMP_MON_ATT_DETAILS` — `DAY1`..`DAY31` plus `TOTAL`, `TOTAL_LOM`, `TOTAL_OT_HRS`, `FROM_WHERE`.

See section 7 for why this shape should not be copied.

---

## 5. Leave, permission and comp-off

| Table | What it tells us |
|---|---|
| `HRMS_EMP_LEAVE_MASTER_DETAILS` | Balances held as **fixed columns**: `EL`, `CL`, `SL`, `AL`, `PL`, `SO`, `WFH` — each with a matching `PREV_YRS_*` column |
| `HRMS_LEAVE_VALIDATE_MASTER` | `LEAVE_TYPE` + `LEAVE_VALIDATE_DAYS` — minimum notice period per leave type |
| `EMP_LEAVE_REQUEST` | Request with `HALF_DAY` / `FULL_DAY` / `DAY_TIME` (first or second half), `STATUS`, `REJ_REASON` |
| `HRMS_EMP_LEAVE_ENCASH`, `LEAVE_ENCASH_REQUEST` | Encashment is request-driven |
| `HRMS_PERMISSION_DETAILS` | Short permission: `FROM_TIME`, `TO_TIME`, `DIFF_TIME`, `DELAY_REASON`, `DELAY_REASON_BY`, approval status |
| `HRMS_EMP_ATT_COFF_DETAILS` | **Comp-off**: `COFF_DATE`, **`WORKED_ON_DATE`**, `UTTILIZED_MINS`, `SHIFT`, `APPROVED_BY_CD` |
| `LEAVE_TRAVEL_ALLOW_MASTER` / `_TRANS` | LTA is tracked (also appears as `LTA` in `HRMS_SALARY_DETAIL`) |

**Leave types in use: EL, CL, SL, AL, PL, SO, WFH.** Work-from-home is treated as a leave type.

**Carry-forward design:** a separate previous-year bucket per type, not a single balance — so carry-forward and current-year accrual are consumed distinctly.

**Comp-off — gap G8 closed:** comp-off is earned by linking the **worked date** to the comp-off date, and is consumed in **minutes**, not days.

---

## 6. Payroll

### Configuration layer

`HRMS_SALARY_COMPONENT` — `COMPONENT`, `DEFAULT_LABLE`, **`CUSTOM_LABLE`**, `STATUS`.
Components are configurable and **renameable per installation**. Gap G7 closed — a salary component master exists and belongs in Masters.

`HRMS_SALARY_LOGIC` — `LOGIC_TYPE`, `SAL_COMPONENT`, **`SIGN_VALUE`**, `STATUS`.
Defines which components add to or subtract from which computed total (gross, net, PF base, ESI base). This is the BRD's "Salary Logic" screen under Administration, and it is the closest thing in the file to a formula definition — but it only carries signs, not arithmetic.

`HRMS_OVERTIME_SLAB` — `FROM_SALARY`, `TO_SALARY`, **`WEEK_PERCENTAGE`**, **`WEEK_OFF_PERCENTAGE`**, **`HOLIDAY_PERCENTAGE`**.

**OT formula shape recovered:** OT is paid as a **percentage that varies by salary band and by day type** (normal weekday / weekly off / holiday). The payroll table carries the matching triplets `WEEK_OT_HOURS` / `WEEKEND_OT_HOURS` / `HOLIDAY_OT_HOURS` and `WEEK_OT_AMT` / `WEEKEND_OT_AMT` / `HOLIDAY_OT_AMT`. This substantially answers Topic 6 — only the base (basic vs gross) and the divisor remain unknown.

`PROF_TAX_SLAP_MASTER` — `MIN_GROSS` / `MAX_GROSS` / `PROF_TAX_AMT`, matching the existing `ProfessionalTaxSlab` model.
`TDS_TAX_CODE_MASTER` — TDS sections only. **There is no income tax slab table**, supporting the conclusion that the BRD's "TDS Slabs" and "Income Tax Slabs" are duplicates (gap G3).

### Salary structure

`HRMS_SALARY_DETAIL` (74 columns) — the employee's standing salary structure, versioned by `EFFECTIVE_FROM`, with `TAX_REGIME` (old/new), `PF_TYPE`, `FIXED_PF` + `FIXED_PF_DOC_NAME`, `EMP_PF_CONT_CUSTOMIZE`, `EMPLOYEE_PF_PER`, `PF_ELIGIBVLE`, plus `GRATUITY`, `BONUS`, `LTA`, `BASKET_ALLOW`.

**PF is configurable per employee** — statutory percentage, a fixed amount with a supporting document, or a custom percentage.

`HRMS_NA_SALARY_DETAILS` (84 columns) — keyed on **`APPLICANT_ID`**, not employee. This is the **offer-stage CTC build-up**, and it is the only place carrying the employer side: `PF_EMPLR`, `ESI_EMPLR`, `LABOUR_WF_EMPLR`, `STATUTORY_BONUS`, `UNIFORM`, `SHOES`, `MOBILE_CUG`, `PETROL_ALLOW`, `APPRAISAL_PER`, **`CTC_VAL`**.

**This answers the CTC question:** CTC is built at offer stage and includes employer contributions; the monthly payroll table holds only the employee side.

### Monthly payroll run

`HRMS_EMP_MON_SALARY_DETAILS` — **151 columns**, one row per employee per month.

Earnings observed: `BASIC`, `HRA`, `DA`, `DLA`, `CONV`, `WASH_ALLOW`, `FDA`, `SRA`, `QA`, `SNACKS`, `HEAT`, `NIGHT_SH_ALLOW`, `EDU_ALLOW`, `AHRA`, `CCA`, `LUNCH`, `HEALTH`, `PER_ALLOW`, `CANTEEN_ALLOW`, `FOOD_ALLOWANCE`, `GUEST_HOUSE_ALLOW`, `TRANSPORT_ALLOW`, `ATT_ALLOW` / `ATT_ALLOW1` / `ATT_ALLOW2`, `PROD_INCENTIVE`, `PERFORM_INCENTIVE`, `SPL_ALLOW1/2`, `OTHER_ALLOW` 1-3, `MONTH_BONUS_AMT`.

Deductions observed: `PF_DED`, `EPF_DED`, `FPS_DED`, `ESI`, `LIC`, `PROF_TAX`, `INCOME_TAX`, `LABOUR_WELFARE_FUND`, `TNLWF`, `MOBILE_DED`, `TRANSPORT_DED`, `SNACKS_DEDUCTION`, `ACTUAL_CANTEEN_DED`, `SAL_ADVANCE`, `FEST_ADVANCE`, `OTHER_ADVANCE`, `VEHICLE_ADV_DED`, `BANK_LOAN_DED`, `EDU_LOAN`, `LOAN_DEDUCTION`, `OTHER_DED` 1-3.

**Key structural insight — the `ACTUAL_*` pairs.** Almost every earning appears twice: `ACTUAL_BASIC` and `BASIC`, `ACTUAL_HRA` and `HRA`, and so on. `ACTUAL_*` holds the **entitled** monthly figure from the salary structure; the unprefixed column holds the **earned** figure after attendance pro-rating. This is the pro-rata mechanism, and it must be preserved — a payslip has to show both.

Day accounting: `NO_WORKING_DAY`, `NO_PAID_DAYS`, `NO_P_HOLIDAYS`, `LOSS_OF_PAY` + `LOSS_OF_PAY_AMT`, `LOM` + `LOM_AMT`, **`NO_OF_LAYOFF` + `LAYOFF_AMT`**, `EXIT_LOP`, `TOT_WORK_HOURS`, `NO_LEAVES_ALLOW`, `C_OFF`.

**Layoff is a paid, tracked concept** — normal in manufacturing (compensated plant idle days) and absent from the BRD entirely.

Rounding: `ROUND_NET` and `ROUND_OFF` are **stored per payslip**, so rounding is a recorded value, not a display convention.

Other flags: `PF_ALLOW`, `ESI_ALLOW`, `WAGE_TYPE`, `PAYSLIP_TYPE`, `SALARY_STRUCTURE`, `TYPE_TRANS`, `PERFORM_INCENTIVE_PER`, `ESI_EMP_CONT_PER`, `EST_EMPLOYER_CONT_PER`, `PF_PER`.

### Contract labour — a separate payroll

`HRMS_CONTRACT_MONTH_SALARY` — `BASIC_PER_DAY`, `HRA_PER_DAY`, `NO_W_DAYS`, `NO_HOLIDAYS`, `TOT_OT_HRS`, `TOT_LATE_HRS`, `ARREARS`, `STIC_CHARGE`, `PF`, `ESI`, `CANTEEN_DED`, `NETT_SAL`.

**Contract workers are paid on a per-day basis through a completely separate table**, with a service/contractor charge. Combined with `EMPLOYEE.CONT_SUP_CODE`, this is a second payroll engine that the BRD does not mention. Significant scope item.

### Loans — gap G12 closed

`HRMS_LOAN_MASTER` (`MIN_LIMIT`, `MAX_LIMIT`) → `HRMS_LOAN_APPLY_TABLE` → `HRMS_LOAN_ISSUE` (`LOAN_AMT`, `RE_PAYMENT_TOT_AMT`, `NO_OF_MONTHS`, `INS_AMT`, instalment start/end year and month, `APPROVAL_STATUS`, `RECD_AMOUNT`, `LOAN_BASED_ON`) → `HRMS_LOAN_ISSUE_TRANS`.

A complete apply → approve → issue → EMI recovery cycle exists. The instalment schedule is explicit, so `Loan Recovery` in payroll simply consumes it.

### Income tax — gap G13 closed

`EMP_INVESTMENTS_DECLARATION` (27 columns: PF, LIC, PPF, ULIP, housing loan, tuition, FD, mutual fund, pension fund, infra bonds, stamp duty, NSC, medical, physically challenged), `EMP_INVESTMENTS_ACTUALS`, `EMPLOYEE_INVESTMENT_MASTER` / `_TRANS`, and `HRMS_EMP_TAX_DETAILS` (`TOT_NET_SAL`, `PROJECTED_TAX`, `MONTHLY_TAX`, `NO_OF_MONTH`).

**Declaration → projection → monthly TDS** is the model, with declared versus actual proof tracking. An ESS declaration screen is required.

### Bonus, incentives, other deductions

- `HRMS_EMP_BONUS_MASTER` / `_TRANS` — `ACC_YEAR`, `NO_YEAR_SERVICE`, `BONUS_PER`, `TOT_NODW`, **`BONUS_CEILING`**, `TOT_LF_AMT`. Statutory bonus with a ceiling, computed on accounting year and days worked.
- `DOUBLE_MACHINE_INCENTIVE` and `INCENTIVE_DET_MULTI_MACHINE` — the BRD's "Double Machine & Other Incentive" is a **production incentive for operators running more than one machine**, combining `DOUBLE_MACHINE_CODE`, `ATTENDANCE_BONUS`, `SHIFT_INCENTIVE` and `OT_WEEKLY_INC`.
- `EMP_PERFORMANCE_INCENTIVE`, `HRMS_MONTHLY_ADDITIONAL_INCENTIVE`.
- `HRMS_CANTEEN_DEDUCTION` (`NO_OF_TOKEN`, `RATE`, `AMOUNT`) fed by `ESSL_CANTEEN_DETAIL_LOGS` — canteen deduction is **token-based off the same biometric estate**.
- `HRMS_MONTHLY_SALARY_DEDUCTION` — mobile bill vs mobile deduction, festival advance, salary advance, special advance, fund advance, food, snacks.
- `EMP_OTHER_DEDUCTIONS`.

---

## 7. Design decisions — what to adopt and what not to copy

### Adopt

1. The **generic approval engine** (config + running requests, polymorphic reference, per-type per-department chains).
2. The **entitled versus earned** split on every payroll component.
3. The **salary component master + salary logic** configuration layer.
4. **OT percentage by salary band and day type.**
5. **Comp-off linked to the worked date**, consumed in minutes.
6. **Per-employee PF configuration** (statutory / fixed / custom percentage).
7. **Offer-stage CTC build-up** including employer contributions.
8. **Per-employee grace minutes** and the LOM (minutes) versus LOP (days) distinction.
9. **Shift-driven allowance eligibility** (night, snacks, meals).
10. **Holiday master with holiday type.**

### Do not copy

| ERP pattern | Problem | Target design |
|---|---|---|
| `DAY1`..`DAY31` pivots in 5+ tables | Cannot query a date range, breaks on month boundaries, impossible to index | One row per employee per date |
| 151-column monthly salary table | Adding a component means a schema change, contradicting the configurable `HRMS_SALARY_COMPONENT` | `PayrollRun` → `PayrollLine` rows keyed by component |
| Leave balances as fixed columns (`EL`, `CL`, `SL`, ...) | Adding a leave type means a schema change | `LeaveBalance` rows keyed by leave type |
| `APPROVER_ID_1/2/3` | Caps alternates at three | `ApprovalStepApprover` rows |
| `SKILL1`..`SKILL5` with parallel proficiency columns | Caps skills at five | `EmployeeSkill` rows |
| Eight parallel `HRMS_EMP_DAILY_ATT_DETAILS_*` tables | One logical fact split across eight tables | One `DailyAttendance` row with typed columns |
| Codes as loose strings, no foreign keys | No referential integrity | Proper relations, as the current Prisma schema already does |
| `MONTH` stored as `nvarchar` alongside `YEAR:int` | Cannot sort or range-query | A single date or a period key |

---

## 8. Cross-module dependencies on the manufacturing ERP

Two HR features read from production data and cannot be built in isolation:

1. **Double machine / multi-machine incentive** depends on machine allocation and production records (`CELL_MACHINE_MAPPING`, `DAILY_PRODUCTION_PLAN`, `CARD_DAILY_TRANS`).
2. **Project Cost** (BRD Reports → Finance) — the ERP has costing tables (`PC_OTHERS_COSTING`, `COSTING_POLICY`, `COST_DETAILS_OLDDATA`) but **no employee-to-project allocation table**. Gap G15 stands: this report has no data source on either side.

`EMPLOYEE.PRODUCTION_LINE` and `TEAM_GROUP` also tie employees to the shop floor.

---

## 9. Modules the ERP has that the BRD sidebar omits

| ERP capability | Tables | Sidebar status |
|---|---|---|
| Holiday master | `HRMS_HOLIDAY_MASTER` | **Missing** (gap G5) |
| Salary component master + salary logic | `HRMS_SALARY_COMPONENT`, `HRMS_SALARY_LOGIC` | Only "Salary Logic" under Admin (gap G7) |
| Loan apply / issue / EMI | `HRMS_LOAN_*` | **Missing** (gap G12) |
| Investment declaration and actuals | `EMP_INVESTMENTS_*` | **Missing** (gap G13) |
| Resignation initiation | `HRMS_RESIGNATION_DETAILS` | **Missing** (gap G14) |
| Candidate, interview, verification, induction | `HRMS_APPLICANT_VERIFICATION_*`, `INTERVIEW_*`, `ASSIGN_INDUCTION_PROCES`, `INDUCTION_TRAINING_MASTER` | **Missing** (gap G11) |
| Contract labour payroll | `HRMS_CONTRACT_MONTH_SALARY` | **Missing — new scope** |
| Layoff days and compensation | `NO_OF_LAYOFF`, `LAYOFF_AMT` | **Missing — new scope** |
| Employee grievance | `EMP_GRIEVANCE` | **Missing** |
| Memo / warning letters | `HRMS_EMP_MEMO` | Partly — Letters exist under Employees |
| Daily work sheet and add-on tasks | `EMP_DAILY_SHEET`, `EMP_ADD_ON_TASK`, `DAILY_TASK_DETAILS` | **Missing** |
| Mobile / geolocation attendance | `ATTENDANCE_ENTRY`, `HRMS_ATTENDANCE_LOCATION_MASTER` | **Missing** |
| Employee satisfaction feedback | `EMPLOYEE.EMP_FEEDBACK_STATUS` and related | **Missing** |
| Bonafide certificate | `BONOFIDE` | Present |
| Designation change order, transfer | `DESIGNATION_CHANGE_ORDER`, `EMPLOYEE_TRANSFER` | Present |

**RBAC granularity:** `ERP_MENU` / `ERP_SUB_MENU` / `ERP_PAGE_MENU_USER_ROLE` and `SUKI_ERP_USER_MODULE` / `_SUBMODULE` / `_PAGE` implement **module → sub-module → page permissions per user per role**. This maps exactly onto the three-level `navigation.ts` tree, which is therefore the right granularity for the permission model.

---

## 10. Contradictions logged

| # | Contradiction | Action |
|---|---|---|
| C1 | Decision O3 says Level is organizational rank, not a pay band. `HRMS_DESIG_LEVEL_MASTER` stores `BASIC`, `HRA`, `BASKET_ALLOW` per level. | Ask the client whether the 5-level hierarchy is the same concept as the ERP's `DESIG_LEVEL`, or a new one. Blocks salary structure design. |
| C2 | The BRD sidebar omits at least seven screens the ERP actively uses (holiday master, salary components, loans, investment declaration, resignation, candidate pipeline, contract payroll). | Confirm each as in or out of scope. |
| C3 | The BRD treats the company as a single profile under Administration. The ERP is multi-company with child units carrying their own GSTIN and state. | Company and Unit masters required. |
| C4 | The BRD lists both "TDS Slabs" and "Income Tax Slabs". The ERP has neither an income tax slab table nor a TDS slab table — only `TDS_TAX_CODE_MASTER` (sections). | Confirm the duplicate and confirm how TDS slabs are actually held. |
| C5 | The current Prisma schema has one `reportingManagerId`. The ERP has four manager roles per employee. | Extend the reporting model before approvals are built. |

---

## 11. Still unanswered after this file

1. **All calculation formulas** — the script has no procedures. The live payroll workbook is still required.
2. **Master data values** — no rows, so the real departments, designations, categories, classes, leave types and salary components are still unknown. A data extract of the master tables would settle Topics 1, 3 and 5 almost entirely.
3. **PF base and OT base** — which components form the PF/ESI base, and whether OT is computed on basic or gross, and over what divisor.
4. **Migration scope** — how many years of `HRMS_EMP_MON_SALARY_DETAILS` and `ESSL_ATTENDANCE_LOG` must be carried over.
5. **Which unit(s)** the new system covers at go-live.

## 12. Recommended next request to the client

A single ask that would unblock most of the remaining topics:

1. A **data-only export of the master tables** — `DEPT`, `HRMS_DESIG_MASTER`, `HRMS_DESIG_LEVEL_MASTER`, `HRMS_GRADE_MASTER`, `HRMS_EMP_CLASS`, `HRMS_EMPLOYEE_TYPE_MASTER`, `HRMS_SALARY_COMPONENT`, `HRMS_SALARY_LOGIC`, `HRMS_SHIFT_MASTER`, `HRMS_HOLIDAY_MASTER`, `HRMS_OVERTIME_SLAB`, `PROF_TAX_SLAP_MASTER`, `HRMS_LOAN_MASTER`, `HRMS_LEAVE_VALIDATE_MASTER`, `MULTI_LEVEL_APPROVAL_MASTER`, `COMPANY_DETAILS`, `COMPANY_CHILD_UNIT_DETAILS`.
2. **One completed month** of `HRMS_EMP_MON_SALARY_DETAILS` for a handful of employees across categories, with the matching payslips.
3. The **payroll formula sheet** or the relevant ERP source code.
