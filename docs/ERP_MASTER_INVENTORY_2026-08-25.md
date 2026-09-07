# ERP Master Inventory, Field Map and Duplicate Analysis

**Date:** 25 August 2026
**Source:** `script.sql` — `ERPDB_KUN_HRMS`, 867 tables, structure only
**Purpose:** Identify every master table the ERP actually contains, list its fields, state which Prisma models can be created from it now, and flag duplicate or redundant tables that must NOT be carried across.

---

## 1. Method

- All 867 `CREATE TABLE` blocks parsed; columns and types extracted.
- 197 tables carry `_MASTER` in the name; a further set of HR masters do not follow that convention (`DEPT`, `SHIFT_PLAN`, `COMMON_DROP_DOWN_TABLE`).
- Duplicate detection: pairwise column-name set comparison across all 867 tables, ignoring audit columns (`CREAT_USER_ID_CD`, `LST_UPDT_TS` and similar). Pairs flagged where similarity is 0.55 or higher, or where one table's columns are 85 per cent contained in another's. 72 pairs flagged; the HR-relevant ones are listed in section 5.
- Naming variants checked by regex for weekly off, comp-off, biometric, period, freeze, grace, roster, canteen, petrol and incentive.

---

## 2. Masters that CAN be built now from the ERP

Every table below has a usable field list. Prisma models can be written directly.

### 2.1 Organization

| ERP table | Business cols | Proposed Prisma model | Notes |
|---|---:|---|---|
| `COMPANY_DETAILS` | 70 | `Company` | Only about 25 are HR-relevant. GSTIN, PAN, CIN, state, bank, logo, address. The rest is purchase and invoice template configuration — leave it out. |
| `COMPANY_CHILD_UNIT_DETAILS` | 18 | `Unit` / `Branch` | Parent/child to Company. Carries `STATE_CD` and `CANTEEN_AMT` — canteen rate is per unit. |
| `DEPT` | 5 | `Department` *(exists)* | `DEPT_NO`, `DEPT_NAME`, `DEPT_SHORT_NAME`, `SEQ_NO`, `NDA_CERTIFICATE`. Our model is missing `shortName`, `sortOrder` and the NDA flag. |
| `CLASS_SUB_DEPT` | 3 | `SubDepartment` *(exists)* | `CLASS_NO`, `CLASS_NAME`. Thin — our model is already richer. |
| `STATE_MASTER` | 3 | `State` | `STATE`, `STATE_CD`, `SHORT_STATE_CD`. Needed for statutory (PT and LWF are state-specific). |
| `COUNTRY_MASTER` | 3 | *(fold into DropdownMaster)* | Name plus remarks only. |
| `LOCATION_MASTER` | 6 | *(skip)* | Store rack and bin locations — inventory, not HR. |

### 2.2 Employee classification

| ERP table | Business cols | Proposed model | Fields |
|---|---:|---|---|
| `HRMS_DESIG_MASTER` | 11 | `Designation` *(exists, extend)* | `DESIG_CODE`, `NAME`, `LEVEL`, `EXP`, `QUALFICATION`, `JOB_DESCRIP` (1000 chars), `NO_OF_POISTION`, `DISP_SL_NO`, `SEQ_NO`, `DESIG_SHORT_NAME`, `APPEAR_IN_CP`. **Our model has none of the extras — notably `LEVEL`, which links designation to level, and `NO_OF_POISTION` which is headcount budget.** |
| `HRMS_DESIG_LEVEL_MASTER` | 5 | `DesignationLevel` | `DESIG_LEVEL`, `BASIC`, `BASKET_ALLOW`, `HRA`, `SCREENING_LEVEL`. **This is the table behind contradiction C1** — level carries default pay. |
| `HRMS_GRADE_MASTER` | 4 | `Grade` *(exists, extend)* | `GRADE_CODE`, `GRADE_NAME`, `SEQ_NO`. Add `sortOrder`. |
| `GRADE_MAPPING` | 5 | `GradeMapping` | `ACTUAL_GRADE_MAPPING`, `EQUAL_MAPPING`, `STATUS`, `REMARKS`. Equivalence between grade schemes — probably a migration artifact; confirm before building. |
| `HRMS_EMP_CLASS` | 3 | `EmployeeClass` | `EMP_CLASS`, `SHORT_NAME`. **New axis we do not have.** |
| `HRMS_EMPLOYEE_TYPE_MASTER` | 2 | `EmployeeType` *(exists)* | `EMP_TYPE_NAME` only. Ours is already richer. |

### 2.3 Time and attendance

| ERP table | Business cols | Proposed model | Fields |
|---|---:|---|---|
| `HRMS_SHIFT_MASTER` | 13 | `ShiftMaster` *(exists, extend)* | `SHIFT_NAME`, `SHIFT_SHRT_NAME`, `SHIFT_TIME`, `START_TIME_HRS`, `END_TIME_HRS`, `IS_NIGHT_SHIFT`, `IS_PROD_SHIFT`, `SNACKS_ALLOW`, `MEALS_ALLOW`, `END_PUNCH_BUFFER_MIN`, `REMARKS`. **Five fields we are missing, all of which feed payroll.** |
| `HRMS_HOLIDAY_MASTER` | 5 | `Holiday` | `HOL_CODE`, `YEAR`, `DATE`, `HOLIDAY_REASON`, `HOLIDAY_TYPE`. Buildable immediately. |
| `HRMS_ATTENDANCE_LOCATION_MASTER` | 4 | `AttendanceLocation` | `NAME`, `LATITUDE`, `LONGITUDE`. **No radius column** — geofence tolerance must be added by us. |
| `HRMS_LEAVE_VALIDATE_MASTER` | 3 | `LeaveNoticeRule` | `LEAVE_TYPE`, `LEAVE_VALIDATE_DAYS`. Minimum notice days per leave type. |
| `HRMS_OVERTIME_SLAB` | 7 | `OvertimeSlab` | `FROM_SALARY`, `TO_SALARY`, `WEEK_PERCENTAGE`, `WEEK_OFF_PERCENTAGE`, `HOLIDAY_PERCENTAGE`, `STATUS`. The OT rate table. |

### 2.4 Payroll and statutory

| ERP table | Business cols | Proposed model | Fields |
|---|---:|---|---|
| `HRMS_SALARY_COMPONENT` | 5 | `SalaryComponent` | `COMPONENT`, `DEFAULT_LABLE`, `CUSTOM_LABLE`, `STATUS`. |
| `HRMS_SALARY_LOGIC` | 5 | `SalaryLogic` | `LOGIC_TYPE`, `SAL_COMPONENT`, `SIGN_VALUE`, `STATUS`. Which component adds to or subtracts from which total. |
| `PROF_TAX_SLAP_MASTER` | 4 | `ProfessionalTaxSlab` *(exists)* | `MIN_GROSS`, `MAX_GROSS`, `PROF_TAX_AMT`. Matches ours. **Ours has no effective dating — theirs does not either. Add it.** |
| `TAX_SECTION_MASTER` | 7 | `TaxSection` | `TAX_CLASS`, `TYPE`, `PERCENTAGE`, `DESCRIPTION`, `POST_LEDGER_CODE`. **Carries the percentage — richer than `TDS_TAX_CODE_MASTER`.** |
| `TDS_TAX_CODE_MASTER` | 3 | *(merge into TaxSection)* | `SECTION`, `STATUS` only. See duplicate D9. |
| `HRMS_LOAN_MASTER` | 5 | `LoanType` *(exists, extend)* | `LOAN_NAME`, `MIN_LIMIT`, `MAX_LIMIT`, `COMMENTS`. **Our model has no min/max limit.** |
| `HRMS_COM_BANK_MASTER` | 14 | `CompanyBank` | `BANK_NAME`, `ACCOUNT_NO`, `BRANCH_NAME`, `BSR_CODE`, `IFSC_CODE`, `ACCOUNT_NAME`, `ACCOUNT_TYPE`, `BANK_LEDGER_CODE`, `CURRENCY`, `BANK_LIMIT`, `ALLOWED_LIMIT`, `OD`, `ADDRESS`. **Correction to the earlier gap list — a bank master does exist.** Needed for the bank transfer file. |
| `INCOME_TAX_COMPUTATION_MASTER` | 12 | `IncomeTaxComputation` | `FIN_YEAR`, `ASS_YEAR`, `FROM_DATE`, `TO_DATE`, `ACK_NO`, `ACK_DATE`, `TAX_PER`, `TOT_TAX_AMT`, `REGIME`. Transaction, not master, despite the name. |

### 2.5 Recruitment and onboarding

| ERP table | Business cols | Proposed model | Notes |
|---|---:|---|---|
| `INTERVIEW_CRITERIA_MASTER` | 10 | `InterviewCriteria` | `CRITERIA_MASTER`, `ANSWER`, `DEPT_NO`, `LEVEL`, `INTERVIEW_ROUND`, `ATTACHMENT_REQUIRED`, `STATUS`. Criteria vary by department, level and round. |
| `HRMS_APPLICANT_VERIFICATION_CRITERIA` | 6 | `VerificationCriteria` | `SEQ_NO`, `TYPE`, `DESCRIPTION`, `STATUS`. |
| `INDUCTION_MASTER` | 9 | `InductionCourse` | `IND_COURSE_NAME`, `IND_COURSE_TYPE`, `DURATION`, `UOM`, `EMP_LEVEL`, `IS_MANDATORY`, `MENTOR_REQUIRED`. |
| `INDUCTION_CRITERIA_MASTER` | 9 | *(merge — see D11)* | Same shape as `INTERVIEW_CRITERIA_MASTER`. |
| `HRMS_NEWAPP_MASTER` | 32 | `Applicant` | The candidate record. Confirms recruitment starts well before the offer letter. |

### 2.6 Learning and development

| ERP table | Business cols | Proposed model | Fields |
|---|---:|---|---|
| `COMPETANCY_CATEGORY` | 2 | `CompetencyCategory` | `COMP_CAT`. |
| `COMPETANCY_DETAILS` | 5 | `Competency` | `REF_ROW_ID`, `COMP_DET`, `DESIG_CODE`, `DEPT_CD`. |
| `SKILL_NAME_DETAILS` | 2 | `Skill` | `SKILL_NAME`. |
| `PROFICIENCY_MASTER` | 4 | `ProficiencyLevel` | `PROF_LVL`, `PROF_DETAILS`, `LEVEL_PERCENTAGE`. **Correction — a skill-level master exists.** |
| `COURSE_DETAILS` | 9 | `Course` | `COURSE_NAME`, `COURSE_ID`, `DURATION`, `COMP_CAT_ID`, `COMP_DET_ID`, `DESCRIPTION`, files. |
| `KPI_MASTER` | 7 | `KpiTemplate` | `KPI_FOR`, `CRITERIA`, `VALUE`, `KPI_TYPE`, `KPI_REQUIRED`. |
| `GOAL_KPI_MASTER` | 15 | `Goal` | Name, measurement criteria, monitoring and reporting frequency, responsibility, condition and value. |

### 2.7 Assets, access and general

| ERP table | Business cols | Proposed model | Notes |
|---|---:|---|---|
| `ASSET_CATEGORY_MASTER` | 9 | `AssetCategory` | `ASSET_CATEGORY_CD`, `ASSET_DESCRIPTION`, `DEP_PER`, `DEP_METHOD`. |
| `ASSET_REGISTER_MASTER` | 29 | `Asset` | Full fixed-asset register with depreciation. Mostly finance; HR needs about 10 fields for allocation. |
| `MULTI_LEVEL_APPROVAL_MASTER` | 8 | `ApprovalWorkflow` | `TYPE`, `LEVEL`, `APPROVER_ID_1..3`, `DEPT_ID`, `STATUS`. **Normalize the three approver columns into rows.** |
| `HRMS_DROPDOWN_MASTER` | 6 | `DropdownMaster` *(exists)* | `TYPE`, `VALUE`, `STATUS`. Ours already covers it. |
| `ERP_ROLE_MASTER` | 2 | `Role` *(exists)* | `ROLE_NAME`. |
| `ERP_MENU` / `ERP_SUB_MENU` / `ERP_PAGE_MASTER` | 2 / 3 / 3 | *(replaced by `navigation.ts`)* | Our navigation tree already encodes module > submodule > page. |
| `ERP_PAGE_ACCESS_MASTER` | 2 | `PermissionAction` | `ACCESS_TYPE`. |
| `PROJECT_MASTER` | 21 | `Project` | `PROJECT_ID`, `PROJECT_NAME`, dates, manager, members, `ESTIMATED_COST`, department. **Correction to gap G15 — a project master exists.** An employee-to-project allocation table still does not. |
| `TEMPLATE_MASTER` / `ANNEXURE_MASTER` | 2 / 3 | `DocumentTemplate` | Letter and annexure bodies. Useful for the letters module. |
| `UOM_MASTER` | 3 | `UnitOfMeasure` | `UOM`, `TYPE`. |
| `CONTACT_MASTER` | 17 | *(skip for HR)* | Vendor and customer contacts. |

**Total buildable directly from the ERP: about 38 masters.**

---

## 3. Corrections to earlier gap findings

Three items previously listed as missing do exist in the ERP:

| Previously said | Actually | Table |
|---|---|---|
| No bank master | Exists | `HRMS_COM_BANK_MASTER` |
| No skill-level master | Exists | `PROFICIENCY_MASTER` |
| No project master (gap G15) | Exists | `PROJECT_MASTER` — but no employee-to-project allocation table, so the Project Cost report is still half-blocked |

---

## 4. Masters the ERP does NOT contain

Searched by name and by column pattern. These have **no source table** — the client must supply the values, and we design the model ourselves.

| Missing master | Searched for | What the ERP does instead |
|---|---|---|
| **Weekly off configuration** | `WEEK_OFF`, `WEEKLY` | Nothing. Weekly off is presumably assumed to be Sunday in application code. |
| **Attendance policy** (grace, half-day, thresholds) | `POLICY`, `GRACE` | `HRMS_POLICY_MASTER` is a **document register** (doc no, prepared by, approved by, file name) — not an attendance policy. Grace sits on `EMPLOYEE.GRACE_MINS`, per employee. |
| **Comp-off policy** | `COMP_OFF`, `COFF` | Only the transaction table `HRMS_EMP_ATT_COFF_DETAILS`. Rules are in code. |
| **Permission type master** | `PERMISSION` | Only `HRMS_PERMISSION_DETAILS` (transactions). |
| **Payroll period / freeze status** | `PERIOD`, `FREEZE`, `LOCK` | Nothing. The freeze mechanism in the Time Office BRD is genuinely new. |
| **Biometric device config** | `BIOMETRIC`, `DEVICE`, `ESSL` | Only `ESSL_ATTENDANCE_LOG` (data). No device registry, no employee-to-biometric-ID mapping table. |
| **Leave entitlement master** | `LEAVE` | `HRMS_LEAVE_VALIDATE_MASTER` holds notice days only. Entitlements live as **columns** on `HRMS_EMP_LEAVE_MASTER_DETAILS` (EL, CL, SL, AL, PL, SO, WFH) — so accrual and carry-forward rules are in code, not data. |
| **Incentive policy** | `INCENTIVE` | Four transaction tables, no rule table. |
| **Canteen policy / rate** | `CANTEEN` | Rate is per transaction on `HRMS_CANTEEN_DEDUCTION`; a per-unit amount sits on `COMPANY_CHILD_UNIT_DETAILS.CANTEEN_AMT`. No policy master. |
| **Petrol rate** | `PETROL`, `FUEL` | `PETROL_ALLOWANCE_DETAILS` and `_OVERVIEW` are transactions. No rate master. |
| **Attendance status master** | `ATTEND` | Statuses are strings in application code; may partly live in `HRMS_DROPDOWN_MASTER`. |

**Eleven masters must be designed from the Time Office BRD, not extracted.** This is exactly the list HR has to fill in — the ERP cannot answer it because the ERP never held it as data.

---

## 5. Duplicate and redundant tables

Ordered by how much they matter to us.

### D1 — Four salary-structure tables that should be one

| Table | Cols | Similarity |
|---|---:|---|
| `HRMS_SALARY_DETAIL` | 69 | baseline |
| `HRMS_SALARY_HISTORY_DETAIL` | 56 | 0.81 vs above |
| `HRMS_NA_SALARY_DETAILS` | 79 | 0.61 vs above |
| `HRMS_SALARY_DETAIL_FOR_LEVEL_DESIG` | 79 | **0.95 vs NA_SALARY — 77 of 79 columns shared** |

All four hold the same salary-component shape. One is current, one is history, one is the offer-stage version, one is the level/designation default.

**Build as one `SalaryStructure` model with `effectiveFrom` / `effectiveTo` and a `scope` discriminator (employee / applicant / level-designation-default).** History is versioning, not a second table.

### D2 — Investment declaration and actuals are identical

`EMP_INVESTMENTS_DECLARATION` and `EMP_INVESTMENTS_ACTUALS` share **all 22 columns**.

**One `EmployeeInvestment` model with `type = DECLARED | ACTUAL`.**

### D3 — Two roster tables, both 31-column pivots

`SHIFT_PLAN` (39 cols) and `SHIFT_PLAN_OT_HOURS` (36 cols) — 0.83 similarity, both `DAY1`…`DAY31`. One holds the shift code per day, the other the planned OT minutes per day.

**One `ShiftRoster` row per employee per date, with `shiftId` and `plannedOtMinutes`.** 70 columns collapse into 4.

### D4 — The 31-column pivot is systemic

`HRMS_EMP_MON_ATT_DETAILS`, `SHIFT_PLAN`, `SHIFT_PLAN_OT_HOURS` and `PRODUCT_DAILY_PLAN` all flag as 0.73–0.79 similar to one another — purely because they share `DAY1`…`DAY31`. Add the eight `HRMS_EMP_DAILY_ATT_DETAILS_*` tables and that is **twelve tables built on the same anti-pattern**.

**All become row-per-date tables.**

### D5 — Leave encashment, twice

`HRMS_EMP_LEAVE_ENCASH` (25 cols) and `LEAVE_ENCASH_REQUEST` (28 cols) — 0.83 similarity.

**One `LeaveEncashment` with a status field.**

### D6 — Offer letter, twice

`HRMS_OFFER_LETTER` (18 cols) and `OFFER_LETTER` (20 cols) — 0.76 similarity. The second adds `COLLEGE_NAME` and `STATUS`, suggesting one was built for internship offers.

**One `OfferLetter` with a `type`.**

### D7 — Six letter tables with the same shape

`BONOFIDE` and `PROMOTION_OFFER` are **column-identical** (9 cols, 1.00 similarity). Alongside them sit `HRMS_CONFIRMATION_ORDER`, `HRMS_RELEIVING_ORDER`, `DESIGNATION_CHANGE_ORDER` and `EMPLOYEE_TRANSFER` — all "an employee event that produces a document".

**One `EmployeeLetter` model with `letterType`, plus one `EmployeeLifecycleEvent`.** Six tables become two.

### D8 — Two complete RBAC systems

| System A | System B |
|---|---|
| `ERP_MENU`, `ERP_SUB_MENU`, `ERP_PAGE_MASTER`, `ERP_PAGE_ACCESS_MASTER`, `ERP_ROLE_MASTER`, `ERP_MAIN_MENU_USER_ROLE`, `ERP_SUB_MENU_USER_ROLE`, `ERP_PAGE_MENU_USER_ROLE` | `SUKI_ERP_USER_MODULE`, `SUKI_ERP_USER_SUBMODULE`, `SUKI_ERP_USER_PAGE`, `SUKI_ERP_MODULE_COMPANY`, `SUKI_ERP_SUBMODULE_COMPANY`, `SUKI_ERP_PAGE_COMPANY` |

Eight tables versus six, doing the same job. System B is richer — `SUKI_ERP_USER_PAGE` carries `READ_PERM`, `WRITE_PERM`, `DELETE_PERM`, `PRINT_PERM`, `MANAGER_PERM` and three spare permission slots.

**Take System B's permission model, drive the menu tree from our `navigation.ts`, and drop all fourteen tables.** Ask the client which system is actually live before migrating any permission data.

### D9 — Tax section, twice

`TDS_TAX_CODE_MASTER` (section name and status) and `TAX_SECTION_MASTER` (tax class, type, **percentage**, description, ledger code).

**Keep the richer one.** Also note: **neither is an income tax slab table**, confirming that the BRD's "Income Tax Slabs" and "TDS Slabs" are the same item (gap G3).

### D10 — Two dropdown systems

`HRMS_DROPDOWN_MASTER` (`TYPE`, `VALUE`, `STATUS`) and `COMMON_DROP_DOWN_TABLE` (`CATEGORY_NAME`, `DROP_DOWN_COL_NAME`, two numeric values).

**Our existing `DropdownMaster` replaces both.**

### D11 — Induction, three ways

`INDUCTION_MASTER` (course definition), `INDUCTION_CRITERIA_MASTER` (criteria, same shape as `INTERVIEW_CRITERIA_MASTER`), `INDUCTION_TRAINING_MASTER` (transaction), plus `ASSIGN_INDUCTION_PROCES`.

**One `InductionCourse` master, one shared `AssessmentCriteria` master used by both interview and induction, one `InductionRecord` transaction.**

### D12 — Employee and applicant education, twice

`HRMS_EDUCATION_DETAILS` and `HRMS_NA_EDUCATION_DETAIL` — 0.68 similarity, 16 columns each. One for employees, one for applicants.

**One `EducationRecord` with a polymorphic owner**, since an applicant becomes an employee and their education should not be re-entered.

### D13 — Attendance entry, twice

`ATTENDANCE_ENTRY` (10 cols, geolocation punch) and `OD_ATTENDANCE_ENTRY` (16 cols, on-duty) — 0.62 similarity.

**One `AttendancePunch` with a `type` — exactly the source-agnostic design already agreed for check-in/check-out.**

### D14 — Four gate and visitor systems

`GATE_ENTRY_MASTER` / `_TRANS`, `GATE_PASS_MASTER` / `_TRANS`, `ERP_GATE_ENTRY`, `VISITOR_GATE_PASS` / `_TRANS` — eight tables covering gate inward, gate outward, material gate pass and visitor pass.

**Two models: `GatePass` (material) and `VisitorPass` (people), each with movements.** Confirm with the client which are live.

### D15 — Competency spelled two ways

`COMPETANCY_CATEGORY` and `COMPETANCY_DETAILS` versus `COMPETENCY_MAPPING`, `COMPETENCY_MATRIX_MASTER` and `COMPETENCY_MATRIX_TRANS`.

Not duplicate tables, but a spelling split that will confuse any migration script. **Use the correct spelling throughout the new schema.**

### D16 — A "master" that is a transaction

`OVER_TIME_MASTER` has `EMP_ID`, `OT_DATE`, `OT_AMT`, `APPROVED_BY_CD` — it is an overtime **transaction**, not a master, despite the name. Do not let the naming mislead the migration.

Same applies to `HRMS_EMP_BONUS_MASTER`, `EMPLOYEE_INVESTMENT_MASTER`, `HRMS_APPLICANT_VERIFICATION_MASTER`, `INCOME_TAX_COMPUTATION_MASTER`, `LEAVE_TRAVEL_ALLOW_MASTER`, `EMP_CHECKLIST_MASTER` and `HRMS_CHECKLIST_PENDING_MASTER` — all transactions carrying the `_MASTER` suffix.

---

## 6. Consolidation summary

| Group | ERP tables | Our models | Reduction |
|---|---:|---:|---:|
| Salary structure | 4 | 1 | −3 |
| Investment declaration | 2 | 1 | −1 |
| Shift roster | 2 | 1 | −1 |
| Daily attendance pivots | 8 | 1 | −7 |
| Monthly attendance pivot | 1 | 0 (derived) | −1 |
| Leave encashment | 2 | 1 | −1 |
| Offer letters | 2 | 1 | −1 |
| Employee letters and orders | 6 | 2 | −4 |
| RBAC | 14 | 3 | −11 |
| Tax sections | 2 | 1 | −1 |
| Dropdowns | 2 | 1 | −1 |
| Induction | 4 | 3 | −1 |
| Education | 2 | 1 | −1 |
| Attendance entry | 2 | 1 | −1 |
| Gate and visitor | 8 | 2 | −6 |
| **Total** | **61** | **20** | **−41** |

Sixty-one ERP tables collapse into twenty models with no loss of information — the reduction is entirely duplication, pivoting and missing versioning.

---

## 7. Proposed build batches

Ordered so each batch is independently useful and nothing waits on the client.

**Batch 1 — extractable, no client input needed (14 masters, about 12 days)**
Company, Unit, State, DesignationLevel, EmployeeClass, Holiday, OvertimeSlab, SalaryComponent, SalaryLogic, TaxSection, CompanyBank, LeaveNoticeRule, ProficiencyLevel, AttendanceLocation.
Plus field extensions to Department, Designation, Grade, ShiftMaster and LoanType.

**Batch 2 — extractable, lower priority (12 masters, about 10 days)**
CompetencyCategory, Competency, Skill, Course, KpiTemplate, Goal, AssetCategory, InterviewCriteria, VerificationCriteria, InductionCourse, DocumentTemplate, Project.

**Batch 3 — designed by us, seeded with defaults (11 masters, about 16 days)**
WeeklyOff, AttendancePolicy, CompOffPolicy, PermissionType, AttendanceStatus, PayrollPeriod, BiometricDevice, EmployeeBiometricMapping, LeaveEntitlement, IncentivePolicy, CanteenPolicy, PetrolRate.

Batch 3 ships with sensible defaults so nothing waits on HR. When their values arrive it is data entry, not development.
