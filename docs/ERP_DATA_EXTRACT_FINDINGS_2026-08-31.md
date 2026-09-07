# ERP Data Extract — Findings

**Date:** 31 August 2026
**Source:** `scripts/erp-extract/out/extract-full.txt`, produced by running `03-extract-L0-L1-L2.sql` against the live `ERPDB_KUN_HRMS` (read-only, `sukierpadmin` login, confirmed zero write statements in the script).

This is the first real data — not just structure — pulled from the ERP. It answers several questions that have been open since 25 August.

---

## Security issue found and fixed

The `EMPLOYEE` table has a `PASSWORD` column (`nvarchar(50)`), and Section 4 of the extraction script (`SELECT * FROM EMPLOYEE`) did not exclude it — unlike Section 2, which explicitly guards the login table. All 479 employee rows came through with what appears to be an encrypted or hashed credential value in that column.

**Fixed already:**
- `scripts/erp-extract/out/` added to `.gitignore` — this data can no longer be committed by accident.
- `03-extract-L0-L1-L2.sql` Section 4 rewritten to an explicit 61-column list that omits `PASSWORD`.

**Resolved (31 Aug, later same day):** re-ran the fixed script, overwriting `extract-full.txt` in place. Verified directly on the output file — zero password-shaped (base64-looking) values remain (was 479/479, now 0), zero SQL errors, all other data (employee rows, sub-entity tables, org masters, salary component/logic) came through unchanged. No compromised copy remains on disk. Nothing here ever suggested the value was a *plaintext* password — it read as base64-encoded, consistent with an encrypted or hashed field — but it was credential material and is now gone from the extract.

---

## Employee sub-entity tables — now confirmed by name

These were referenced only as guesses in the 25 August field map. They're now certain, with real row counts:

| Table | Rows | Maps to (field map doc) |
|---|---:|---|
| `HRMS_PERSONAL_DETAILS` | 469 | Personal Details tab |
| `HRMS_CONTACT_DETAILS` | 469 | Contact Details tab |
| `HRMS_JOB_PROFILE` | 469 | Job Profile tab |
| `HRMS_SALARY_DETAIL` | 438 | Salary Details tab |
| `HRMS_CTC_DETAILS` | 1,375 | CTC Details tab — far more rows than employees, confirms it's a running/versioned history, not a snapshot |
| `HRMS_EDUCATION_DETAILS` | 30 | Education Details tab |
| `HRMS_DEPENDENT_DETAILS` | 29 | Dependent Details tab |
| `HRMS_EMERGENCY_CONTACT` | 29 | Emergency Contact tab |
| `HRMS_EXPERIENCE_SERVICE_DETAILS` | 24 | Experience Details tab |
| `HRMS_EMP_BONUS_MASTER` / `HRMS_EMP_BONUS_TRANS` | 470 / 5,640 | Not previously mapped — a bonus module exists and is actively used |
| `HRMS_SALARY_HISTORY_DETAIL` | 35 | Salary change history |

Also found: `ERP_USER` (5 rows) is the real login/user table — small, likely just admin/HR accounts, not one row per employee.

Genuinely empty (0 rows, confirmed again): `HRMS_EMP_SKILL_MATRIX`, `HRMS_PASSPORT_DETAILS`, `HRMS_KYC_DOCUMENTS`, `HRMS_ASSETS_EMPLOYEE`, `HRMS_EMP_LEAVE_MASTER_DETAILS`, `EMPLOYEE_TRANSFER`, `EMP_GRIEVANCE`, `HRMS_LOAN_APPLY_TABLE`, and about 70 more transaction-shaped tables — these features exist in the ERP's schema but were never actually used.

---

## `EMPLOYEE` — full 62-column schema, decoded

The complete column list came back (`EMP_CD`, `TITLE`, `FIRST_NAME`, `LAST_NAME`, `DESIG_CODE`, `GRADE_CODE`, `DEPT_NO`, `SHIFT_NAME`, `JOIN_DATE`, `CONFIRM_DATE`, `OLDEMP_CD`, `EMP_CLASS`, `EMP_CAT`, `EMP_LEVEL`, `EMP_TYPE`, `UNIT_NAME`, `EXIT_DATE`, `HOME_MANAGER`, `BUSINESS_MANAGER`, `HR_MANAGER`, `VR_MANAGER`, `PETROL_ALLOWANCE`, `INDUCTION_STATUS`, `GRACE_MINS`, `SITE`, and more — 62 in total). Cross-references cleanly against nearly every field found in the Employee Master screenshots.

**Two things this settles:**

1. **All four manager roles are populated for every employee, not just some.** Ran the exact query: `total_employees=479, has_home_manager=479, has_business_manager=479, has_hr_manager=479, has_vr_manager=479`. Every single employee has all four manager fields filled in. This resolves Q1.7 and blocker B2 — the matrix-reporting structure isn't a decorative or half-used feature, it's fully live. The new schema needs all four manager relationships, not one `reportingManagerId`.

2. **`EMP_LEVEL` is a free-text `nvarchar(15)` column, and `HRMS_DESIG_LEVEL_MASTER` (the master it should reference) came back with zero rows.** So the "Level: L1–L7" dropdown seen in the Employee Master screenshots isn't backed by any master table at all right now — it's either hardcoded in the ERP's frontend or entered as free text. This is a partial answer to the Level contradiction: whatever L1–L7 turns out to mean, it is not the same thing as `HRMS_GRADE_MASTER` (which has only 2 real rows: `GM1 GENERAL MANAGER`, `JE1 JUNIOR EXECUTIVE`) or the empty `HRMS_DESIG_LEVEL_MASTER`. The actual distinct `EMP_LEVEL` values in use are still unknown — see "Next step" below.

---

## L1 org masters — what's real vs. empty, now confirmed with data

| Table | Rows | Status |
|---|---:|---|
| `COMPANY_DETAILS` | 1 | Real — KUN Aerospace Private Limited, single company row |
| `COMPANY_CHILD_UNIT_DETAILS` | 0 | Empty |
| `DEPT` | 32 | Real — full department list with codes (PRODUCTION, QUALITY, HR, IT & SYSTEM, etc.) |
| `CLASS_SUB_DEPT` | 0 | Empty |
| `HRMS_DESIG_MASTER` | 100 | Real — full designation list, includes a `LEVEL` text column with values like L3–L7 on some rows only (senior designations), blank on most |
| `HRMS_DESIG_LEVEL_MASTER` | 0 | Empty (see above) |
| `HRMS_GRADE_MASTER` | 2 | Real but thin — only 2 grades defined |
| `HRMS_EMP_CLASS` | 0 | Empty |
| `HRMS_EMPLOYEE_TYPE_MASTER` | 1 | Real but thin — only "INTERN" defined, even though employees carry values like "PERMANENT" |
| `HRMS_DROPDOWN_MASTER` | 4 | Real but narrow — all 4 rows are Shift definitions (GENERAL, SHIFT 1/2/3). Not a general-purpose dropdown catalog in practice, despite the name. |
| `STATE_MASTER` | 32 | Real — standard Indian state list, generic reference data |
| `COUNTRY_MASTER` | 1 | Real — just "INDIA" |
| `SKILL_NAME_DETAILS` | 0 | Empty — despite existing as a table, no skill names were ever entered |
| `PROFICIENCY_MASTER` | 0 | Empty |

**Pattern worth naming**: several "master" tables exist structurally but are nearly empty, while the real classification values live only as free text on the 479 `EMPLOYEE` rows (`EMP_CLASS`, `EMP_CAT`, `EMP_LEVEL`, `EMP_TYPE`, `EMP_SUB_CAT`). This matches the extraction plan's original "Recovery" strategy — reconstruct the missing masters from what's actually on the employee records, rather than treating the empty tables as the source of truth.

---

## Salary Component master — full 35-row list recovered

`HRMS_SALARY_COMPONENT` came back in full. This is the exact seed data for the component-based salary model recommended in the Employee Master field map (replacing `SalaryStructure`'s flat columns):

`BASIC`, `SRA`, `QA`, `FDA`, `SNACKS`, `CONVEYANCE`, `SPL_ALLOW`, `HEAT`, `WASH`, `HRA`, `NIGHT_SHIFT`, `DA`, `EDUCATION`, `ATTENDANCE`, `ADD_HRA`, `HEALTH`, `CANTEEN`, `GUEST_HOUSE`, `CCA`, `DIS_LOCATION`, `OTHER1`, `OTHER2`, `OTHER3`, `LUNCH_PER_DAY`, `FOOD`, `PROD_INS`, `PERFORMANCE_INS`, `PERFORMANCE`, `ESI`, `PF`, `LIC`, `LWF`, `ATTENDANCE1`, `ATTENDANCE2`, `OTHER_DED2` — 35 components, each with a code and a display name.

---

## Salary Logic — the actual payroll formula rules, recovered

`HRMS_SALARY_LOGIC` (57 rows) turned out to be exactly what it sounds like: the rule table defining which components count toward which statutory base, and the gross-salary split percentages. This is the payroll formula sheet that's been flagged as missing since 25 August — recovered directly from the data, not from a client conversation.

**Gross salary composition** (percentages sum to 100): `BASIC 55%`, `HRA 30%`, `HEALTH ALLOWANCE 7%`, `EDUCATION ALLOWANCE 3%`, `LTA 5%`.

**PF wage base** — confirms the rule already found on the Employee Master screenshot, now from the authoritative source table: `PF BASIC (yes)`, `PF EDUCATION ALLOW (yes)`, `PF HEALTH ALLOW (yes)`, `PF LTA (yes)`, `PF HRA (no)`, `PF DA (no)`, `PF SPL ALLOW (no)`, plus several `PF OTHER ALLOW` flags mostly off.

**ESI wage base**: `ESI GROSS (+, yes)`, `ESI WASH ALLOW (−, yes — subtracted)`, `ESI ACTUAL GROSS (+, no)`, and several ESI OT/OTHER ALLOW components all `(no)`.

**Bonus wage base**: `BONUS GROSS (+, yes)` only — every other bonus-prefixed component (`BONUS BASIC`, `BONUS DA`, `BONUS HRA`, `BONUS SPL ALLOW`, etc.) is `(no)`. Bonus is calculated on gross alone.

**OT wage base**: `OT BASIC (+, yes)` and `OT ATTENDANCE OT CALCULATION (yes)`; every other OT-prefixed component (`OT GROSS`, `OT DA`, `OT HRA`, `OT WASH ALLOW`, etc.) is `(no)`. OT is calculated on basic plus an attendance-based factor, not gross.

This table should be treated as close to authoritative for the payroll engine's formula logic — it's a strong candidate to become the seed data for whatever "salary logic" or "statutory base rules" model gets built.

---

## What's still open

**`EMP_LEVEL`'s actual values are still unknown.** The extraction script generated (but the run stopped short of executing) 12 ready-to-run queries that would show the real distinct values, with counts, for every classification-looking column on `EMPLOYEE` — including `EMP_LEVEL`, `EMP_CLASS`, `EMP_CAT`, `EMP_TYPE`, `GRADE_CODE`, `EMP_SUB_CAT`, `STATUS`, `INDUCTION_STATUS`, `SHIFT_NAME`, `UNIT_NAME`, `SHIFT`, `EMP_FEEDBACK_STATUS`. This is genuinely the single most useful next query in the whole project — it will very likely settle the Level/Grade/Category/Class/Type contradiction outright, since it shows what's actually stored rather than what a UI dropdown offers.

I've saved these as `scripts/erp-extract/04-recover-classification-values.sql`, ready to run the same way as before:

```bash
cd ~/CascadeProjects/HRMS
sqlcmd -S 192.168.1.160,1433 -U sukierpadmin -P '<password>' -C -b -y 0 -i scripts/erp-extract/04-recover-classification-values.sql -o scripts/erp-extract/out/recover-classification.txt
```

Also still needed: `HRMS_EMP_BONUS_MASTER`/`HRMS_EMP_BONUS_TRANS` weren't in the original extraction scope but clearly hold real, actively-used data (470 and 5,640 rows) — worth a follow-up export once the Bonus BRD is in scope.

---

## Update — classification column recovery (`04-recover-classification-values.sql`)

Ran against the live 479 `EMPLOYEE` rows. This settles the Level/Grade/Category/Class/Type contradiction, and it settles it differently than expected.

**`EMP_LEVEL` does not hold "L1–L7."** Its real values are `CONFIRM` (29), `-Select-` (5), and blank (437). That's an employment-confirmation status (confirmed vs. probation), not a pay band or an org rank. Wherever the "Level: L1–L7" dropdown seen in one of the Employee Master screenshots actually saves to, it isn't this column — either it writes to a field outside the 62 captured here, or it's a UI element that was never fully wired to the database. Either way: **the 5-tier org-rank "Level" already agreed for Topic 1 has no legacy data to migrate or reconcile against.** It's clean new scope, not a mapping problem.

**A systemic data-quality pattern showed up**: the literal string `-Select-` (the dropdown's own unselected placeholder) is stored as if it were a real value, across multiple columns (`EMP_CLASS`: 33 of 471 non-null rows; `EMP_LEVEL`: 5; `EMP_CAT`: 3; `UNIT_NAME`: 34). Any migration/seed logic needs to treat `-Select-` as equivalent to null, not as a real category.

**What's actually meaningfully populated, out of the five classification axes:**
- `EMP_CAT` — 468 of 479 are `EMPLOYEE` (a real, if nearly constant, value).
- `EMP_TYPE` — 471 of 479 are `PERMANENT` (also real, also nearly constant — and notably, `HRMS_EMPLOYEE_TYPE_MASTER` only has "INTERN" as its one defined row, meaning the master doesn't even contain the value actually in use).
- `UNIT_NAME` — mostly "KUN Aerospace Private Limited" (437), but 8 employees are genuinely split across "UNIT-1"/"UNIT-2" — a small but real multi-unit signal, despite `COMPANY_CHILD_UNIT_DETAILS` being empty.
- `GRADE_CODE`, `EMP_CLASS`, `EMP_LEVEL`, `EMP_SUB_CAT` — all overwhelmingly blank or placeholder. Not meaningfully used in practice.
- `SHIFT` (the Y/N flag) is `Yes` for all 479 employees — no discriminating value at all.
- `INDUCTION_STATUS` is `PENDING` for 478 of 479 — reads as a dead/unused workflow, not an active one.

**Practical takeaway**: of the five overlapping classification dropdowns flagged as contradiction #2 on 27 Aug, only two (Category, Type) carry real signal in the live data, and both are near-constant today. Recommend against building out five parallel classification masters to match the ERP's UI — the data doesn't support that many meaningful axes. Worth confirming with the client whether they *intend* to use Grade/Class/Level/Sub-Category more going forward, or whether this is legacy UI surface that should be simplified, not replicated.
