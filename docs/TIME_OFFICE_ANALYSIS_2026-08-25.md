# Time Office BRD — Analysis and Impact

**Date:** 25 August 2026
**Source:** `suki kun Time office.docx` — KUN HRMS Time Office BRD v1.0
**Covers:** Requirement topics 4 (Attendance & Shift), 5 (Leave), 6 (Overtime), plus benefits, incentives, payroll integration and period locking.

---

## 1. Status change

| Topic | Was | Now |
|---|---|---|
| 4. Attendance & Shift Management | PENDING | **PARTIAL — substantially answered** |
| 5. Leave Management | PENDING | **PARTIAL — structure answered, values missing** |
| 6. Overtime Management | PENDING | **PARTIAL — logic answered, thresholds missing** |
| Benefits & Incentives | Not a listed topic | **PARTIAL — newly specified** |

This document is now the governing specification for the Time Office module. Where it conflicts with the original BRD sidebar or the legacy ERP, it wins unless the client says otherwise.

---

## 2. Decisions recorded

### Attendance capture (A1-A9)

- **A1.** Biometric punches are pulled from an external device system into HRMS. Employee biometric ID maps to HRMS employee ID.
- **A2.** Synchronization supports both **scheduled** and **manual/re-sync** modes.
- **A3.** Duplicate punches must not create duplicate attendance records.
- **A4.** Failed syncs are logged; unmapped employees are surfaced as exceptions.
- **A5.** Biometric transaction history is retained.
- **A6.** Sync result is reported with counts: total punches, successfully synced, duplicates, failed, unmatched employees.
- **A7.** Last sync timestamp and status are displayed on the page.
- **A8.** Post-sync attendance corrections are permission-controlled.
- **A9.** The processing chain is fixed: Biometric device > external system > sync > HRMS attendance > daily > monthly > Time Office Final > Payroll.

### Attendance calculation (A10-A15)

- **A10.** Working Duration = Valid Out − Valid In − Applicable Break, subject to the configured Shift Policy.
- **A11.** Late Minutes = Actual In − Shift Start − Grace Period.
- **A12.** Early Out = Shift End − Actual Out, with permission rules considered.
- **A13.** The per-day pipeline is: punch > employee mapping > shift identification > first valid IN > last valid OUT > break/permission adjustment > working duration > late-in > early-out > OT eligibility > OT hours > attendance status.
- **A14.** Working hours are displayed as **HH:MM**, never as ambiguous decimals.
- **A15.** Attendance statuses are configurable. Initial set: Present, Absent, Half Day, Weekly Off, Holiday, Leave, Permission, Comp-Off, On Duty, Missing Punch, LOP, Holiday Worked.

### Monthly attendance workbench (A16-A24)

- **A16.** One employee per row, one day per column. **Date columns are generated dynamically from the selected month** — 28, 29, 30 or 31. Never hard-coded.
- **A17.** View toggle: Monthly (default) / Daily. The same sync mechanism serves both.
- **A18.** Cell colour coding by working hours, **configurable through Attendance Policy, not hard-coded**:

  | Working hours | Colour | Meaning |
  |---|---|---|
  | 0 | Red | Absent / no working hours |
  | 0-4 | Orange | Very short working |
  | 4-6 | Yellow | Partial working |
  | 6-8 | Light green | Normal / acceptable |
  | Above 8 | Dark green | Extended working |
  | Weekly off / holiday | Blue | Weekly off / holiday |

- **A19.** Cell tooltip shows shift, in time, out time, working hours, late in, early out, permission, OT hours, status and biometric sync state.
- **A20.** A single punch renders as **MP** in a warning colour, with a link to attendance correction for authorized users.
- **A21.** Summary columns after the date columns: Late (mins), Total Work (hrs), OT (hrs).
- **A22.** Salary columns: Wage Type, OT Eligible, Gross Salary, Actual Salary, OT Salary, Estimated Salary. **Permission-controlled — users without salary access must not see them.**
- **A23.** Column selector with show/hide, reorder and reset to default.
- **A24.** Export to Excel, CSV, PDF and Print, with visible-columns or all-columns choice. **Salary columns respect permissions on export.**

- **A25.** Advanced filters open as a drawer, not permanent screen furniture. Filters: Employee, Department, Category, Designation, Location, Shift, Employee Status, OT Eligible, Attendance Status, Leave Type, Late Employees, Early Out, Missing Punch, OT Employees, Comp-Off Eligible, LOP Employees.

### Wage and salary on the attendance page (A26-A28)

- **A26.** Wage types: Monthly, Daily, Hourly, Contract.
- **A27.** OT eligibility comes from the Employee or OT Policy. **The attendance grid must not determine eligibility independently.**
- **A28.** Actual Salary is attendance-adjusted (present days, paid leave, LOP). OT Salary = eligible OT hours × OT rate. **All salary calculation must use the Payroll module's approved rules — the attendance page must not duplicate payroll logic.**

### Period freeze and reopen (F1-F6) — NEW SCOPE

- **F1.** Each payroll month carries a status: Open > Attendance Processing > Time Office Final > Ready for Payroll > Payroll Processing > Payroll Approved > Frozen > Reopened.
- **F2.** After payroll approval, **attendance, leave, OT, permission, comp-off and Time Office Final are all frozen together**.
- **F3.** When frozen: edit, delete, leave modification, OT modification, permission modification and comp-off modification are all disabled. View and export remain available.
- **F4.** The frozen state is displayed explicitly on screen with the reason.
- **F5.** Only authorized HR/Admin may reopen a frozen period.
- **F6.** Reopening must capture: date and time, user, reason, approval, original values, revised values, and impact on payroll.

### Leave (L1-L9)

- **L1.** Leave Master fields: Leave Code, Leave Name, previous-period leave and comp-off details, Annual Entitlement, Carry Forward Allowed, Carry Forward Limit, Encashment Allowed, Eligibility Criteria, Probation Eligibility.
- **L2.** Accrual examples given: CL 1 day per month, SL 1 day per month, EL 1 day per defined qualifying working days. **All values configurable, not hard-coded.**
- **L3.** Leave application fields: employee, leave type, from, to, days, half/full day, reason, supporting document, reporting manager, application date, status.
- **L4.** Pre-submission validation chain: leave master > available balance > eligibility > existing attendance > submit.
- **L5.** Application is blocked when balance is insufficient **unless policy permits negative or LOP leave**.
- **L6.** Approval flow: employee > application > reporting manager approve/reject > HR validation if applicable > attendance > payroll. Rejection reason is captured.
- **L7.** Approved leave automatically updates attendance and reduces balance. Rejected leave does not reduce balance. Cancelled leave restores balance. Approval history is retained.
- **L8.** Leave History ledger columns: Opening Balance, Accrued, Availed, Pending, Cancelled, Adjusted, LOP, Closing Balance.
- **L9.** Closing Balance = Opening + Accrued + Adjustments − Approved − Other policy deductions.

### Overtime (O1-O9)

- **O1.** OT eligibility is a yes/no flag that may depend on employee category, department, designation, shift, grade, employment type and company policy.
- **O2.** OT is **not** simply Out Time − Shift End. It must pass the configured OT rules.
- **O3.** OT gate sequence: eligible? > required shift hours completed? > minimum OT threshold satisfied? > maximum OT limit check > weekday/weekly-off/holiday rule > eligible OT hours > OT factor.
- **O4.** Configurable rule dimensions: normal working days, weekdays, weekly off, Sunday, public holidays, shift-specific, employee-category-specific, minimum threshold, maximum hours, monthly limit, weekly calculation, incentive slab.
- **O5.** OT calculation basis is configurable: Basic, Gross, Basic + Allowance, fixed hourly rate, or other configured earning components.
- **O6.** OT Value = Hourly Rate × OT Factor × OT Hours. Factor may be 1.0, 1.5, 2.0 or company-defined, configurable by employee category and day type.
- **O7.** Weekly OT aggregation is supported, with a configurable minimum threshold (example given: 3 hours).
- **O8.** Monthly OT incentive slabs based on accumulated OT hours, maintained in an OT Policy Master.
- **O9.** Approval flow: attendance > OT calculation > OT process > employee/HR review > reporting manager > approval > payroll. Rejected OT is not sent to payroll. Approved OT locks after payroll processing. All changes are audit-logged.

### Comp-off (C1-C5)

- **C1.** **Automatic generation:** biometric attendance > holiday/weekly-off check > eligible working hours > comp-off rule > comp-off generated > approval > balance.
- **C2.** Sunday/weekly-off work may result in OT, comp-off, both, or neither — **configurable by employee category and policy**.
- **C3.** Weekday comp-off is initiated by HR/Admin, with eligibility after configured minimum hours and management approval captured.
- **C4.** Comp-off utilization is tracked.
- **C5.** Expiry rules are supported where required.

### Permission (P1-P3)

- **P1.** Permission types include late arrival, early departure, short-duration personal, and other company-defined reasons.
- **P2.** Fields: employee, date, permission type, from time, to time, duration, reason, reporting manager, approval status, remarks.
- **P3.** Permission is considered during attendance and LOP calculation per company policy.

### Benefits and incentives (B1-B7)

- **B1.** **Canteen token:** employee-wise eligibility, daily/monthly token quantity, food deduction rate, employee contribution, company contribution, payroll deduction integration.
- **B2.** **Petrol allowance:** Approved KM × Rate per KM. Fields include travel date, KM, rate, eligible amount, approved amount, manager approval, payroll amount. Rate is configurable.
- **B3.** **Performance incentive has two components:** a company-level component (max 50%) and an individual component (max 50%, requiring reporting manager approval), combined and **capped at 100%**.
- **B4.** The percentage basis is configurable: Basic, Gross, CTC, target incentive, or another configured basis.
- **B5.** **Double machine incentive is manual HR entry.** Fields: employee, date, machine 1, machine 2, number of machines, working days/hours, incentive rate, calculated incentive, HR remarks, approval status.
- **B6.** Other incentives: attendance bonus, shift bonus, production incentive, special incentive, performance bonus, other management-approved.
- **B7.** All incentive rules live in an **Incentive Policy Master, not in code**.

### Payroll integration (I1-I2)

- **I1.** Time Office hands 18 data items to Payroll: present days, paid days, absent days, LOP days, leave days, leave type, OT hours, OT amount, permission adjustment, comp-off, attendance bonus, shift bonus, petrol allowance, canteen deduction, performance incentive, double machine incentive, other incentives.
- **I2.** Integration chain: biometric > attendance > leave/permission/OT/comp-off > Time Office Final > HR approval > payroll > processing > approval > Time Office and leave freeze.

### Roles (R1)

- **R1.** Seven roles with defined access:

  | Role | Access |
  |---|---|
  | Employee | Attendance view, leave entry, permission, comp-off request |
  | Reporting Manager | Leave, OT, permission and incentive approval |
  | HR Executive | Attendance processing, leave, OT, comp-off, benefits |
  | HR Manager | Final approval, policy management, freeze/reopen |
  | Payroll User | Finalized Time Office and payroll integration |
  | Admin | Configuration and master data |
  | Management | Reports, dashboard, approvals |

---

## 3. New masters this document requires

These are in addition to the 47 already identified in `MASTERS_PLAN_2026-08-25.md`.

| # | Master | Holds | Days |
|---:|---|---|---:|
| 48 | **Attendance Policy** | Colour thresholds, grace period, half-day thresholds, break rules, LOP rules | 2.0 |
| 49 | **OT Policy** | Eligibility criteria, minimum threshold, maximum hours, monthly limit, factor by day type, calculation basis | 3.0 |
| 50 | **OT Incentive Slab** | Monthly OT hours bands mapped to incentive values | 1.0 |
| 51 | **Incentive Policy** | Attendance bonus, shift bonus, production, special incentive rules | 2.5 |
| 52 | **Performance Incentive Policy** | Company percentage, individual percentage, overall cap, calculation basis | 1.5 |
| 53 | **Canteen Policy** | Eligibility, daily/monthly quantity, rate, employee and company contribution | 1.0 |
| 54 | **Petrol Rate** | Rate per KM, effective dating | 0.75 |
| 55 | **Comp-Off Policy** | Minimum qualifying hours, weekly-off treatment, expiry rules, by category | 1.5 |
| 56 | **Permission Type** | Permission categories and their rules | 0.5 |
| 57 | **Attendance Status** | Configurable status list | 0.5 |
| 58 | **Payroll Period / Freeze Status** | Period lifecycle state machine and reopen audit | 2.0 |
| 59 | **Biometric Device / Sync Config** | Device connection, schedule, mapping rules | 1.5 |
| 60 | **Employee Biometric Mapping** | Biometric ID to employee ID | 0.75 |

**New masters subtotal: 13 masters, 18.5 days**

Revised Masters layer total: **60 masters, 64-67 developer-days** (was 47 masters, 46-48 days).

The existing `LeaveMaster` model also needs extending with carry-forward limit, encashment flag, probation eligibility and eligibility criteria.

---

## 4. Impact on the build estimate

| Management area | Previous | Revised | Reason |
|---|---:|---:|---|
| 12. Attendance Management | 25 – 30 | **28 – 34** | The monthly workbench grid alone is 8-10 days: dynamic columns, colour coding, tooltips, missing-punch handling, column selector, permission-controlled salary columns, four export formats |
| 13. Leave Management | 15 – 18 | **16 – 20** | Leave history ledger with eight balance movements, cancellation restoring balance, approval history |
| 14. Overtime Management | 8 – 10 | **14 – 18** | Policy engine with day types, weekly aggregation, monthly incentive slabs, configurable factor and basis, approval workflow |
| 15. Comp-Off & Permission | 6 – 8 | **8 – 10** | Automatic generation from biometric, weekday manual route, expiry tracking |
| 23. Benefits & Incentives | 10 – 12 | **14 – 18** | Canteen, petrol, two-component performance incentive, double machine, attendance bonus, shift bonus, all policy-driven |
| **NEW — Period Freeze & Reopen** | — | **8 – 10** | Cross-cutting state machine over attendance, leave, OT, permission and comp-off, with a full reopen audit trail |
| Masters layer | 46 – 48 | **64 – 67** | 13 additional policy masters |

**Net increase: approximately 37 to 47 developer-days.**

Revised development total: **420 – 525 days** (was 383 – 478).
Revised overall total: **610 – 770 developer-days** (was 556 – 700).

Calendar with four developers moves from 8-10 months to approximately **9-11 months**.

---

## 5. Confidence improvement

| Area | Was | Now | Why |
|---|---|---|---|
| Attendance | Low | **Medium** | Pipeline, formulas and UI are now specified. Only threshold values are missing. |
| Leave | Low | **Medium** | Master fields, validation chain and balance formula are specified. Actual entitlement values are missing. |
| Overtime | Medium | **Medium-High** | Complete rule structure. Only threshold numbers are missing. |
| Benefits & Incentives | Low | **Medium** | Every incentive now has a defined field set and process. |
| Freeze & Reopen | — | **High** | Fully specified state machine. |

The proportion of the estimate sitting in Low-confidence areas drops from roughly 40 per cent to roughly 25 per cent. The remaining Low-confidence weight is concentrated in the Payroll Engine, Statutory, Recruitment and Data Migration.

---

## 6. Blocking questions

### Missing attachment

**The document references "the attached reference screenshot of the existing Suki ERP — Employee Daily Attendance (Page 300)". It was not attached.** The monthly grid is specified against that screenshot, so it is needed before the workbench is built.

### Values referenced as examples, not confirmed

| # | Question | Where it appears |
|---:|---|---|
| T1 | Grace period — is it per employee (the ERP holds `GRACE_MINS` on the employee record) or per shift/policy? The document says "configured company policy", which conflicts with the ERP. | Section 4.19 |
| T2 | Minimum OT threshold — the example says 1 hour beyond shift. Confirm the real value. | Section 14 |
| T3 | Weekly OT threshold — the example says 3 hours. Confirm. | Section 17 |
| T4 | Monthly OT incentive slabs — shown as X, Y, Z placeholders. Real bands and amounts needed. | Section 18 |
| T5 | EL accrual — "1 EL for defined qualifying working days". The number is needed (commonly 20). | Section 9.1 |
| T6 | Carry-forward limits and encashment rules per leave type. | Section 9.1 |
| T7 | Performance incentive basis — Basic, Gross, CTC or target incentive? | Section 25 |
| T8 | Canteen rate, daily/monthly token quantity, and the employee/company contribution split. | Section 23.1 |
| T9 | Petrol rate per KM. | Section 24 |
| T10 | Attendance bonus eligibility rule — the document says "full attendance + no LOP + policy conditions". The conditions are undefined. | Section 27 |
| T11 | Double machine incentive rate. | Section 26 |

### Rules not covered at all

| # | Question | Why it matters |
|---:|---|---|
| T12 | **Half-day threshold.** The colour bands (0-4, 4-6, 6-8) are display bands, not status rules. The hours at which a day becomes half day or absent are not stated. | Directly drives LOP and therefore pay |
| T13 | **Break deduction** — is the break fixed per shift, or derived from punches? | Changes working duration for every employee every day |
| T14 | **Night shift crossing midnight** — which calendar date does the shift belong to? | Manufacturing runs night shifts; this affects daily and monthly totals |
| T15 | **Does reopening a frozen period trigger payroll arrears**, or is the previous payroll reversed and re-run? | Determines whether an arrears engine is needed |
| T16 | **Weekly off definition** — fixed day, rotating by shift plan, or per unit? | The document assumes weekly off exists but never defines where it comes from |
| T17 | **Holiday master** — referenced throughout but never specified as a screen. | Confirmed as required; still absent from the sidebar |
| T18 | **Comp-off unit** — the ERP tracks comp-off in minutes; this document refers to comp-off days and to "Comp-Off days & Min". Confirm the unit. | Affects balance arithmetic |

---

## 7. Design notes

1. **Shared calculation service.** The document requires salary figures on the attendance page while explicitly forbidding duplicated payroll logic. The only clean resolution is a single calculation service consumed by both Attendance and Payroll. This must be designed before either module is built.

2. **Everything is policy-driven.** Colour thresholds, OT factors, incentive slabs, leave accrual and comp-off rules are all stated as configurable. That is the right instinct, and it is why the masters layer grew by 13. It also means the Attendance Policy and OT Policy masters must be built *before* the attendance and OT engines, not after.

3. **The freeze mechanism touches every table.** Attendance, leave, OT, permission and comp-off all need a period reference and a frozen check on every write path. This is cheaper to build in from the start than to retrofit — it should be part of the foundation phase, not the Time Office phase.

4. **The grid is a performance concern.** One row per employee and up to 31 day columns, plus summary and salary columns, across a full workforce. This needs server-side pagination, virtualized columns, and a pre-aggregated monthly table rather than computing from raw punches at render time.

5. **Gap G8 is now closed.** The earlier finding that comp-off had an approval screen but no earning screen is resolved: comp-off is generated automatically from weekly-off biometric attendance, with a manual weekday route for HR.
