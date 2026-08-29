# KUN / Suki HRMS — Requirements Decisions Log

**Started:** 25 August 2026
**Purpose:** Capture client answers to the 18 open requirement topics, point by point, as they are received. This file is the working record and becomes the BRD annexure.
**Source BRD:** KUN HRMS – Business Requirements Document
**Status legend:** `PENDING` · `PARTIAL` · `CONFIRMED` · `ASSUMED` (proceeding on assumption, needs later confirmation)

---

## How to read this file

Each topic has:

- **Status**
- **Decisions** — confirmed answers, stated as buildable rules
- **Open** — follow-ups still blocking
- **Build impact** — models/logic affected

---

## Tier 1 — Blocking development now

### 1. Organization Structure
**Status:** PARTIAL — answered 25 August 2026

**Decisions:**

- O1. The organization is a **manufacturing company**, structured department-wise.
- O2. A **fixed 5-tier position hierarchy (Level 1-5)** applies across the organization:
  | Level | Tier | Example designations |
  |---:|---|---|
  | 1 | Founder | Founder |
  | 2 | C-Suite | CEO, CTO, CFO |
  | 3 | Reporting authority / Department Head | HR Head, Production Head |
  | 4 | Mid-level | Team Leader, Supervisor |
  | 5 | Workforce (headcount base) | Operators, staff |
- O3. **Level = organizational rank, not a pay band.** Levels 1-5 are fixed and will not vary by department.
- O4. Employees are classified **category-wise and designation-wise** in addition to their level.
- O5. Headcount is reported **department-wise and cumulative** (rolls up the hierarchy).

**Open (blocking):**

- Q1.1 Confirm the 5 levels rank **people/positions**, not nested departments. (Current reading: positions.)
- Q1.2 Single legal entity, or multiple companies? Still unanswered — schema has no Company model.
- Q1.3 How many branches / plants / units, and does payroll run per unit or centrally?
- Q1.4 Do Level 1 and Level 2 belong to a department (e.g. "Management"), or sit outside the department tree? Affects department-wise totals.
- Q1.5 "Cumulative" definition: does a department total include its sub-departments? Does a Level 3 head's count include every Level 4 and 5 beneath them?
- Q1.6 Is a designation permanently tied to one level (CEO is always Level 2), or can the same designation sit at different levels in different departments?
- Q1.7 Does every employee have a **named reporting manager**, or is the manager derived from level + department? This determines the entire approval routing model.
- Q1.8 What are the employee **categories**? (Typically Staff / Worker / Contract / Trainee / Apprentice in manufacturing.) They drive OT eligibility, PF/ESI applicability and attendance rules.
- Q1.9 With Level now meaning organizational rank, what does **Grade** mean? Confirm Grade = pay band.
- Q1.10 Can one department have more than one Level 3 head? Can an employee report to someone in a different department (matrix reporting)?

**Build impact:**

Already supported by the schema, no change needed:

- `JobInfo` carries `departmentId`, `subDepartmentId`, `designationId`, `categoryId`, `gradeId`, `levelId`, `unitId`, and is versioned via `effectiveFrom` / `effectiveTo`.
- `Employee.reportingManagerId` is a self-referencing FK, so a named reporting chain is already possible.
- Department-wise cumulative headcount can be produced by grouping current `JobInfo` rows (`effectiveTo IS NULL`) — no new model required.

Changes required:

- **`Level` needs a numeric `rank` field (1-5, unique).** It currently holds only `code` / `name` / `description`, so levels cannot be ordered or rolled up. This is the one blocking schema change from this answer.
- `Designation` may need an optional `levelId` (default level per designation) — depends on Q1.6.
- No Company or Branch model exists yet — depends on Q1.2 and Q1.3.
- `Department` supports only two tiers (Department > SubDepartment). Adequate if Q1.1 confirms levels rank people, not departments.

Screens unlocked by this answer: Masters > Levels (with rank), Masters > Reporting Structure, Administration > Organization Chart, Dashboard > Headcount by Dept.

---

### 2. Roles, Permissions & Approval Hierarchy
**Status:** PENDING

**Decisions:**
- _(none yet)_

**Open:**
- Fixed approval chain (Manager → HR) for all requests, or per-request-type chains?
- Approver derived from reporting structure, or configured per department?
- Any amount-based or duration-based escalation?
- Approver unavailable — auto-escalate, delegate, or stall?
- Are the four BRD roles (Admin, HR, Manager, Employee) sufficient, or are custom roles needed?
- Data scoping: does a Manager see only their department, or their branch?

**Build impact:** no approval models exist yet. Determines whether a generic `ApprovalRequest` table suffices or a configurable workflow engine is required.

---

### 3. Employee Information & Lifecycle
**Status:** PENDING

**Decisions:**
- _(none yet)_

**Open:**
- Employee code format and generation rule
- Mandatory vs optional master fields
- Confirmation / probation rules
- Which lifecycle events must be approved vs recorded

**Build impact:** existing Employee models (11) may need extension; lifecycle event models do not exist.

---

### 4. Attendance & Shift Management
**Status:** PARTIAL — substantially answered 25 Aug 2026 by the Time Office BRD. Decisions A1-A28 and F1-F6 recorded in `TIME_OFFICE_ANALYSIS_2026-08-25.md`. Outstanding: T1, T12, T13, T14, T16, T17 (grace ownership, half-day threshold, break rule, night-shift date, weekly off source, holiday master) plus the missing Page 300 reference screenshot.

**Decisions:**
- _(none yet)_

**Open:**
- Biometric device make/model and integration method (push / pull / file)
- Late-in and early-out treatment
- Permission hours: monthly free allowance and conversion rule
- Half-day / full-day absence thresholds
- Night shift and shift-crossing-midnight handling
- Weekly off and holiday calendar source
- Attendance cut-off date vs pay date
- Lock rule: can attendance be edited after payroll processing?

**Build impact:** no attendance models exist.

---

### 5. Leave Management
**Status:** PARTIAL — structure answered 25 Aug 2026 (decisions L1-L9). Master fields, validation chain and the closing-balance formula are fixed. Outstanding: T5, T6 (EL qualifying days, carry-forward limits and encashment rules per type).

**Decisions:**
- _(none yet)_

**Open:**
- Leave types and annual entitlement per type
- Accrual: monthly, yearly, or on-joining credit
- Pro-rata rule for mid-year joiners and leavers
- Carry-forward cap and lapse rule
- Encashment eligibility and formula
- Loss of Pay calculation basis (calendar days vs working days)
- Negative leave balance permitted?

**Build impact:** `LeaveMaster` exists as a definition table only; no balance, transaction, or accrual models.

---

### 6. Salary Structure & Payroll Processing
**Status:** PENDING

**Decisions:**
- _(none yet)_

**Open:**
- **Request the client's current payroll workbook** with live formulas and one completed month — this answers most of this section
- Earning and deduction components and their formulas
- Salary calculation basis: fixed 30 days, calendar days, or working days
- Payroll cycle and cut-off
- Approval steps before payout
- Retro / arrears handling for back-dated increments
- Rounding rules per component
- Go-live date and whether YTD figures must be imported

**Build impact:** `SalaryStructure` exists; no payroll run, component, or payslip models.

---

### 7. Statutory Compliance
**Status:** PENDING

**Decisions:**
- _(none yet)_

**Open:**
- Applicable acts and state(s)
- PF: wage ceiling applied or actual, employer contribution split, admin charges
- ESI: threshold and mid-period exit handling
- PT: state slab confirmation
- TDS: regime handling and declaration/proof workflow
- LWF: state and deduction frequency
- Which statutory return formats are required as outputs

**Build impact:** slab masters exist (`TDSSlab`, `ProfessionalTaxSlab`, `EsiRate`, `PfRate`); no computation or return-generation logic.

---

## Tier 2 — Needed before the respective module starts

### 8. Overtime Management
**Status:** PARTIAL — logic answered 25 Aug 2026 (decisions O1-O9). Gate sequence, configurable factor and basis, weekly aggregation and monthly incentive slabs are all specified. Outstanding: T2, T3, T4 (minimum OT threshold, weekly threshold, incentive slab values).

### 9. Recruitment Workflow
**Status:** PENDING

### 10. Document Management
**Status:** PENDING

### 11. Reports & Dashboards
**Status:** PENDING

---

## Tier 3 — Can be answered later without rework

### 12. Notifications & Alerts
**Status:** PENDING

### 13. Web & Mobile Access / ESS
**Status:** PENDING

### 14. Expected User & Employee Count
**Status:** PENDING

### 15. User Acceptance & Approval Criteria
**Status:** PENDING

---

## Tier 4 — Propose, then get approval (client will not have an answer)

### 16. Security & Access Controls
**Status:** PENDING

### 17. Existing Data Migration
**Status:** PENDING

**Open:**
- Which data sets migrate: employees, attendance history, leave balances, payroll history, documents
- How many years of history
- Source system and export format

### 18. Third-Party Integrations
**Status:** PENDING

**Open:**
- Biometric device / software
- Bank and bank file format
- ERP, if any
- Email provider (SMTP / API)
- WhatsApp provider

---

## Added topics — not in the original list, recommended to raise

| # | Topic | Why it matters |
|---|---|---|
| A | Payroll cut-off and period locking | Determines reversal and re-run logic across all modules |
| B | Retro / mid-cycle changes | Largest source of payroll rework if unplanned |
| C | Rounding and precision rules | Causes reconciliation disputes if left undefined |
| D | Financial year and go-live date | Mid-year go-live requires YTD import for TDS and PF |
| E | Single point of contact and sign-off authority | Prevents contradictory answers across sessions |
| F | Audit logging and data retention | BRD mentions audit logging without scope |

---

---

## Navigation structure — CONFIRMED 25 Aug 2026

**Status:** CONFIRMED (as sidebar structure only; business rules still pending per topic)

The client-side sidebar is fixed at **14 modules, ~200 leaf screens**:

| # | Module | Leaf screens (approx) |
|---:|---|---:|
| 1 | Dashboard | 10 |
| 2 | Masters | 20 |
| 3 | Recruitment | 10 |
| 4 | Employees | 26 |
| 5 | Workforce | 15 |
| 6 | Payroll | 26 |
| 7 | Learning & Development | 5 |
| 8 | Visitor | 3 |
| 9 | Document Management | 6 |
| 10 | Approval Center | 15 |
| 11 | Employee Self Service | 10 |
| 12 | Compliance | 6 |
| 13 | Reports | 36 |
| 14 | Administration | 11 |

Built as of this date: ~25 screens (20 Masters CRUD + Employee profile/CRUD) = approx 12%.

### Schema vs sidebar mismatches

Models that exist in `prisma/schema.prisma` but have **no sidebar page**:

- `AssetMaster` — Asset Allocation appears under Employees > Profile, but no Asset Master page under Masters
- `DropdownMaster` — no page; may be intentionally internal
- `PfRate` — no PF rate master under Masters > Payroll & Statutory
- `EsiRate` — no ESI rate master under Masters > Payroll & Statutory

Sidebar items with **no backing model**:

- Reporting Structure, Branches/Sites, Interview Criteria, JD Master (Masters)
- Everything in Recruitment, Workforce, Payroll, L&D, Visitor, Compliance, Approval Center, ESS

### Gaps identified in the navigation — to raise with client

| # | Gap | Why it blocks | Tier |
|---:|---|---|---|
| G1 | No Company master; "Company Profile" sits under Administration | Implies single legal entity. Must be confirmed before any payroll or statutory work | 1 |
| G2 | Branches/Sites appears in Masters AND as "Branch Configuration" in Administration | Two owners for one entity; must decide which creates and which configures | 1 |
| G3 | "TDS Slabs" and "Income Tax Slabs" both listed under Masters | Likely the same thing; if different, need the distinction | 1 |
| G4 | No PF or ESI rate master in the sidebar, though slabs exist for TDS/PT | Rates change yearly; hard-coding them creates annual code changes | 1 |
| G5 | No Holiday Master / Holiday Calendar anywhere | Attendance, LOP, OT and weekly-off calculations all depend on it | 1 |
| G6 | No Weekly Off configuration | Same as above | 1 |
| G7 | No Salary Component master; only "Salary Logic" under Administration | Earnings/deductions must be configurable or every change is a code change | 1 |
| G8 | Comp-Off Approval exists, but no Comp-Off entry/accrual screen | Where is comp-off earned and credited? | 2 |
| G9 | Mis-Punch Requests exist in ESS, but no Mis-Punch Approval in Approval Center or Workforce | Breaks the "all approvals centralized" rule | 2 |
| G10 | Visitor Pass Approval appears in both ESS and Approval Center | Contradicts centralized approval; who actually approves? | 2 |
| G11 | Recruitment starts at Offer Letter; no candidate/applicant, requisition, or interview scheduling screens, yet Masters has Interview Criteria and Approval Center has Hiring Approval | Either recruitment is out of scope pre-offer, or several screens are missing | 2 |
| G12 | Loan Types master and Loan Recovery deduction exist, but no loan application/sanction/disbursement screen | Recovery cannot run without a loan record | 2 |
| G13 | No income tax declaration / investment proof screen in ESS | TDS cannot be computed correctly without declarations | 2 |
| G14 | No resignation request in ESS and no separation approval in Approval Center | Separation begins with an Exit Form with no initiating workflow | 2 |
| G15 | Reports > Finance includes "Project Cost", but no Project or Cost Centre master or allocation exists | Report cannot be produced from available data | 3 |
| G16 | "Time Office Final" and "ATM List" are undefined terms | Cannot be scoped | 3 |
| G17 | L&D has training plan/calendar but no training attendance, feedback, or effectiveness capture | Training records incomplete | 3 |
| G18 | Compliance forms (25, 15, 25B, 25C, 21, 22) are state-specific | Must confirm the state whose Factories Rules apply | 2 |


## Contradiction log

Answers that conflict with the BRD, the schema, or an earlier answer are recorded here as they arise.

| Date | Topic | Conflict | Resolution |
|---|---|---|---|
| 25 Aug | Org Structure | Decision O3 says Level is organizational rank, not a pay band. ERP `HRMS_DESIG_LEVEL_MASTER` stores BASIC, HRA, BASKET_ALLOW per level. | OPEN — blocks salary structure design |
| 25 Aug | Scope | BRD sidebar omits 7+ screens the ERP actively uses: holiday master, salary components, loans, investment declaration, resignation, candidate pipeline, contract payroll | OPEN — confirm each in or out of scope |
| 25 Aug | Org Structure | BRD treats company as a single profile under Administration. ERP is multi-company with child units carrying their own GSTIN and state. | OPEN — Company and Unit masters required |
| 25 Aug | Masters | BRD lists both "TDS Slabs" and "Income Tax Slabs". ERP has neither; only `TDS_TAX_CODE_MASTER` (sections). | OPEN — likely duplicate |
| 25 Aug | Reporting | Current Prisma schema has one `reportingManagerId`. ERP has four manager roles per employee (HOME, BUSINESS, HR, VR). | OPEN — extend before approvals are built |

| 25 Aug | Attendance | Time Office BRD says grace period is "configured company policy". ERP holds `GRACE_MINS` per employee. | OPEN — question T1 |
| 25 Aug | Scope | Period Freeze and Reopen is a full state machine over attendance, leave, OT, permission and comp-off. Absent from the original BRD and from the ERP schema. | ACCEPTED as new scope — 8-10 days, belongs in the foundation phase |
| 25 Aug | Architecture | Time Office BRD requires salary figures on the attendance page while forbidding duplicated payroll logic. | RESOLVED by design — one shared calculation service consumed by both modules |
| 25 Aug | Comp-off | ERP tracks comp-off in minutes; Time Office BRD refers to comp-off days. | OPEN — question T18 |
| 27 Aug | Org Structure | Employee master core form has a live "Level" dropdown (L1-L7), which reads as a pay/grade band, not the 5-tier org rank agreed in decision O3. Likely the same root issue as the 25 Aug Org Structure row above, now confirmed in the UI. | OPEN — is UI "Level" actually Grade, and is org-rank "Level" a new concept absent from the legacy screen entirely? |
| 27 Aug | Employee Master | Employee core form carries five overlapping classification dropdowns: Category, Sub Category, Type, Grade Code, Class. | OPEN — need plain-English definitions distinguishing all five before they become schema fields |
| 27 Aug | Employee Master | Statutory IDs (PAN, Aadhar, UAN, PF No, Driving License, Election Card, Ration Card) are entered on up to three separate tabs (Personal Details, Job Profile/KYC, Passport) with no single source of truth. | OPEN — recommend one home per fact; KYC tab becomes a read-only rollup + document grid only |
| 27 Aug | Employee Master | CTC exists both as a pre-hire concept (`HRMS_NA_SALARY_DETAILS`, keyed on APPLICANT_ID) and as a mostly-empty post-hire Employee tab. | OPEN — recommend CTC is offer-stage only, superseded by Salary post-hire |
| 27 Aug | Employee Master | Job Profile tab stores an "Official Password" field directly on the employee record. | FLAGGED — recommend excluding from new schema; office credentials should not live in HRMS data |

See `ERP_SCHEMA_ANALYSIS_2026-08-25.md` for the legacy ERP analysis, `TIME_OFFICE_ANALYSIS_2026-08-25.md` for the Time Office analysis, and `EMPLOYEE_MASTER_FIELD_MAP_2026-08-27.md` for the full Employee Details UI field map behind these entries.
