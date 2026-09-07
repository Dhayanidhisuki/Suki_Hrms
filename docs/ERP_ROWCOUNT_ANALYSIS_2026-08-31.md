# ERP Master Data — Row Count Result and What It Settles

**Date:** 31 August 2026
**Source:** `ERPDB_KUN_HRMS_Table_Dictionary.pdf`, generated 27 Aug 2026 13:14 against host 192.168.1.160
**Answers:** `scripts/erp-extract/01-row-counts.sql` (step 1 of the extraction package)
**Reads with:** `ERP_SCHEMA_ANALYSIS_2026-08-25.md`, `BUILD_SEQUENCE_2026-08-31.md`, `REQUIREMENTS_DECISIONS.md`

**Headline: 25 master tables, 272 rows in total, and 13 of the 25 are completely empty.** The legacy ERP is far less configured than its 867-table schema suggested. That is good news for migration scope and bad news for anyone hoping the ERP would answer the payroll formula questions — most of the tables that would have held those answers were never populated.

This document is still the *count*, not the data. The rows themselves have not been supplied yet.

---

## 1. What came back

| Table | Rows | Reading |
|---|---:|---|
| `HRMS_DESIG_MASTER` | 100 | Real designation list — worth migrating |
| `HRMS_SALARY_LOGIC` | **57** | **The most valuable table in the export** — see § 3 |
| `HRMS_SALARY_COMPONENT` | **35** | The live component list |
| `DEPT` | 32 | Real department list |
| `STATE_MASTER` | 32 | Indian states lookup — no migration value |
| `HRMS_SHIFT_MASTER` | 4 | Four shifts, with `IS_NIGHT_SHIFT`, `SNACKS_ALLOW`, `MEALS_ALLOW`, `END_PUNCH_BUFFER_MIN` |
| `HRMS_DROPDOWN_MASTER` | 4 | Only four configured dropdowns |
| `HRMS_LOAN_MASTER` | 3 | Three loan types |
| `HRMS_GRADE_MASTER` | 2 | Two grades |
| `COMPANY_DETAILS` | 1 | One company |
| `HRMS_EMPLOYEE_TYPE_MASTER` | 1 | One employee type |
| `HRMS_HOLIDAY_MASTER` | 1 | One holiday row in the entire system |
| `COMPANY_CHILD_UNIT_DETAILS` | **0** | No child units configured |
| `HRMS_DESIG_LEVEL_MASTER` | **0** | Never used |
| `HRMS_OVERTIME_SLAB` | **0** | Never used |
| `MULTI_LEVEL_APPROVAL_MASTER` | **0** | Never used |
| `PROF_TAX_SLAP_MASTER` | 0 | Never used |
| `HRMS_LEAVE_VALIDATE_MASTER` | 0 | Never used |
| `TAX_SECTION_MASTER` | 0 | Never used |
| `TDS_TAX_CODE_MASTER` | 0 | Never used |
| `HRMS_COM_BANK_MASTER` | 0 | Never used |
| `HRMS_EMP_CLASS` | 0 | Never used |
| `CLASS_SUB_DEPT` | 0 | Never used |
| `HRMS_ATTENDANCE_LOCATION_MASTER` | 0 | Never used |
| `PROFICIENCY_MASTER` | 0 | Never used |

`SKILL_NAME_DETAILS` was on our 26-table request list and is **not in the returned dictionary**. It needs to be asked for again.

---

## 2. Open questions this closes

| Was open | Now |
|---|---|
| **Q1.2 / Q1.3 — single or multiple companies, how many units?** | `COMPANY_DETAILS` = 1 row, `COMPANY_CHILD_UNIT_DETAILS` = 0 rows. In live use this is **one legal entity operating from one establishment**. Multi-unit is a schema capability the client never switched on. Build Company and Unit as models (the PT filing and the BRD both reference Unit), but do not design multi-entity payroll until the client asks for it. Worth one confirming sentence from the client, since a second plant may be planned rather than existing. |
| **Level vs Grade contradiction** (logged 25 Aug and again 27 Aug) | `HRMS_DESIG_LEVEL_MASTER`, the table holding BASIC / HRA / BASKET_ALLOW per level, is **empty**. Level has never been used as a pay band in practice. The contradiction dissolves: Level is an org-rank concept as decision O3 states, and the L1–L7 dropdown on the employee form is a designation attribute, not a salary driver. |
| **Five overlapping classification dropdowns** (Category, Sub Category, Type, Grade, Class) | `HRMS_GRADE_MASTER` = 2, `HRMS_EMPLOYEE_TYPE_MASTER` = 1, `HRMS_EMP_CLASS` = 0, `CLASS_SUB_DEPT` = 0. Four of the five dimensions are effectively unused. **Do not build five classification axes.** Department + designation carry the real structure; keep Grade and Employee Type as simple masters and drop Class and Sub Category unless the client asks for them. |
| **Does the ERP teach us the approval chains?** | No. `MULTI_LEVEL_APPROVAL_MASTER` is empty — approvals were being run outside the system. The engine *design* still comes from the ERP's table shape, but every actual chain must come from the client. Blocker B1 stands at full weight. |
| **Holiday calendar source** (gap G5) | `HRMS_HOLIDAY_MASTER` has one row. There is no calendar to migrate; it will be entered fresh. |

---

## 3. The salary component finding

`HRMS_SALARY_COMPONENT` (35 rows) is a bare list: `COMPONENT`, `DEFAULT_LABLE`, `CUSTOM_LABLE`, `STATUS`. No formula, no base, no PF or ESI flag.

All of that lives in `HRMS_SALARY_LOGIC` (57 rows): `LOGIC_TYPE`, `SAL_COMPONENT`, `SIGN_VALUE`, `STATUS`.

That is a component-to-logic mapping held **as rows, not as columns** — one row per (logic type, component, sign). So "which components make up gross", "which make up the PF base", "which make up the ESI base", "which are deducted from net" are each a set of rows under a logic type.

**This is a better model than the boolean-flag design proposed in `BUILD_SEQUENCE_2026-08-31.md` § Engine 1, and we should adopt it.** Flags on the component row (`isPfBase`, `isEsiBase`, `isGratuityBase`…) require a migration every time a new basis appears — and the new BRDs already add three: gratuity base, bonus base, OT base. A mapping table absorbs those as data.

Revised shape for Engine 1:

- `SalaryComponent` — code, name, display label, type, calculation type, sequence, rounding, effective dating, status.
- `SalaryLogic` — logicType (GROSS / NET / PF_BASE / ESI_BASE / PT_BASE / GRATUITY_BASE / BONUS_BASE / OT_BASE / CTC), componentId, sign (+/−), effective dating, status.

The 57 rows are the client's live answer to blocker **B4** — the one blocker I had flagged as needing a spreadsheet from the payroll team. It already exists in their database.

---

## 4. What is still not answerable from the ERP

Every table that would have carried a formula or a rate is empty:

| Blocker | Table that would have held it | Rows | Consequence |
|---|---|---:|---|
| **B5** OT basis, divisor, multipliers | `HRMS_OVERTIME_SLAB` (`FROM_SALARY`, `TO_SALARY`, `WEEK_PERCENTAGE`, `WEEK_OFF_PERCENTAGE`, `HOLIDAY_PERCENTAGE`) | 0 | Must come from the client. The column names confirm the *shape* — percentage by salary band and day type — which is enough to build the master, but not the engine's defaults. |
| **B1** approval chains | `MULTI_LEVEL_APPROVAL_MASTER` | 0 | Client only |
| **B11–B13** PT slabs | `PROF_TAX_SLAP_MASTER` | 0 | Already covered by the PT workbook — use that as the seed |
| TDS | `TAX_SECTION_MASTER`, `TDS_TAX_CODE_MASTER` | 0 | Client only |
| Leave validation rules | `HRMS_LEAVE_VALIDATE_MASTER` | 0 | Client only |
| Bank file format | `HRMS_COM_BANK_MASTER` | 0 | Client only |
| **B16** loan interest | `HRMS_LOAN_MASTER` has only `MIN_LIMIT` / `MAX_LIMIT` / `COMMENTS` — no interest, tenure, frequency or priority columns at all | 3 | Strong indication interest is not charged and recovery terms are set per loan issue. Confirm, but plan for the simple case. |

**Net effect on the blocker list in `BUILD_SEQUENCE_2026-08-31.md`:** B4 is answered pending the data. B1, B5, B15–B20 are unchanged and must be asked. B2 (reporting manager) and B3 (reopen semantics) were never ERP questions.

---

## 5. The revised ask

The count step is done; the data step is not. What is needed now is small — 272 rows, of which 92 matter most.

**Priority 1 — the two tables that unblock the pay layer (92 rows)**

- `HRMS_SALARY_LOGIC` — all 57 rows
- `HRMS_SALARY_COMPONENT` — all 35 rows

**Priority 2 — seed data for masters already built (143 rows)**

- `HRMS_DESIG_MASTER` (100), `DEPT` (32), `HRMS_SHIFT_MASTER` (4), `HRMS_LOAN_MASTER` (3), `HRMS_GRADE_MASTER` (2), `HRMS_EMPLOYEE_TYPE_MASTER` (1), `HRMS_HOLIDAY_MASTER` (1)

**Priority 3 — not in the original request, needed by the five new BRDs**

- `SKILL_NAME_DETAILS` — was requested, not returned
- `HRMS_EMP_BONUS_MASTER` — bonus configuration
- `HRMS_LOAN_APPLY_TABLE`, `HRMS_LOAN_ISSUE`, `HRMS_LOAN_ISSUE_TRANS` — how loan issue and recovery are actually structured
- `HRMS_SALARY_DETAIL`, `HRMS_SALARY_DETAIL_FOR_LEVEL_DESIG` — the per-employee salary structure shape
- `EMP_PF_CONT_CUSTOMIZE` — the per-employee PF treatment behind blocker B8
- **One completed payroll month** — `HRMS_EMP_MON_SALARY_DETAILS` and `HRMS_MONTHLY_SALARY_DEDUCTION` for a single month, which remains the single most valuable artefact still outstanding and would settle B5, B6, B7 and B9 at once by inspection

There appears to be no gratuity configuration table in the ERP at all, which suggests gratuity is computed outside the system. Worth confirming — it changes whether B18's values exist anywhere or must be decided fresh.

The client clearly has live query access to the database (this dictionary was generated directly against the host), so Priority 1 is a two-query request, not a project.
