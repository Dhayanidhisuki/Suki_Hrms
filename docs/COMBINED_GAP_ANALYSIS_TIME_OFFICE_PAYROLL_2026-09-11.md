# Combined Gap Analysis — Time Office + Payroll

> **STATUS UPDATE — 2026-09-13 (Phases 13–20)**
>
> All 50 gaps from the P0–P3 priority table below have been addressed.
> Many entries in the detailed section-by-section analysis below still
> show ❌/Missing because that section was written before Phases 4–20.
> Refer to `docs/WORKLOG_2026-09-10.md` for the authoritative list of
> what was implemented in each phase. Key completions:
>
> - **P0:** LOM deduction ✅, Comp-Off ✅, PF/ESI wage base ✅, OT day-type ✅, Loan recovery ✅, TDS annual ✅, Validations ✅, Permission excess → LOP ✅
> - **P1:** Time Office Final ✅, Bank file ✅, Payroll summary ✅, Bulk payslip ✅, Reconciliation ✅, Salary rounding ✅, Canteen ✅, Petrol ✅, Double machine ✅, Attendance bonus ✅, Shift bonus ✅, Monthly grid ✅, Biometric export/filters ✅
> - **P2:** Workflow stages ✅, Multi-level approval ✅, Weekly OT ✅, Monthly OT limit ✅, OT incentive slabs ✅, Bulk processing ✅, COMPLETED/PENDING/HOLD ✅, Error messages ✅, Leave breakdown ✅, Reopen → recalc ✅, Holiday worked flag ✅
> - **P3:** LWF ✅, Leave encashment ✅, FnF ✅, Night/Heat/Snacks/Food ✅, Health insurance ✅, LIC ✅, State-wise PT ✅, Investment declarations ✅, Arrear types ✅, Bonus types ✅, Hourly employees ✅, Attendance policy ✅, Break time ✅, Probation leave ✅, Comp-off expiry ✅, Incentive policy ✅, Deduction % display ✅, Payslip content ✅


**Document:** `docs/COMBINED_GAP_ANALYSIS_TIME_OFFICE_PAYROLL_2026-09-11.md`
**Source BRDs:**
- `/Users/sukimacbook01/Downloads/suki kun Time office.docx` (30 sections)
- `/Users/sukimacbook01/Downloads/Suki Kun Payroll.docx` (23 sections)
**Audit Date:** 2026-09-11
**Audited Commit:** `068cb57` (latest from `gitlab/main`)

---

## Executive Summary

This document combines the gap analysis for both the **Time Office** module and the **Payroll** module, since they are tightly coupled: Time Office produces attendance/leave/OT/permission data that Payroll consumes.

### Combined Scope

| Module | BRD Sections | Implemented | Partial | Missing | Completion |
|--------|-------------|-------------|---------|---------|------------|
| **Time Office** | 30 | 10 | 8 | 12 | ~40% |
| **Payroll** | 23 | 4 | 6 | 13 | ~30% |
| **Combined** | 53 | 14 | 14 | 25 | ~35% |

### What Works End-to-End (Time Office → Payroll)

The following pipeline is functional:

```
Biometric Sync → DailyAttendance → MonthlyAttendanceSummary (finalize)
  → PayrollRun (create → calculate → approve → lock)
  → Payslip (individual, browser print)
```

Supporting modules that work:
- Leave application → Manager → HR approval → attendance update
- Mispunch correction → Manager → HR approval → attendance update
- OT calculation (basic) → Manager → HR approval → OT/Comp-Off settlement
- Permission entry → Manager → HR approval → excess-hours flagging
- Salary revision → Manager → HR approval → arrear calculation
- Bonus calculation (two methods) → HR approval → payroll application
- PMS incentive → Manager input → HR approval → payroll application
- Gratuity calculation
- Monthly attendance freeze + reopen
- Company-scoped RBAC on all APIs

### What's Broken or Missing in the Pipeline

```
[Time Office gaps]                    [Payroll gaps]
Comp-Off not generated      →    No comp-off balance in payroll
Weekly OT not calculated   →    No weekly OT in payroll
Monthly OT limit not enforced →  No OT limit validation
Canteen tokens not tracked →    No canteen auto-deduction
Petrol allowance not tracked →  No petrol auto-earning
Double-machine not tracked →    No double-machine incentive
Attendance bonus not calc'd →   No attendance bonus auto-earning
Shift bonus not calc'd     →    No shift bonus auto-earning
LOM minutes not sent       →    No LOM deduction in payroll
Leave-type not broken down →   No leave-type-wise display on payslip
No Time Office Final page  →    No formal handoff to payroll
```

---

## PART A: TIME OFFICE GAPS (30 BRD Sections)

### A1. Biometric Integration (BRD §3) — ✅ Implemented

| Requirement | Status | Notes |
|-----------|--------|-------|
| Retrieve punch-in/punch-out from external device | ✅ | `src/lib/biometricSync.ts` + `biometricApi.ts` |
| Employee biometric ID mapped to HRMS employee | ✅ | `oldEmployeeCode` field on Employee |
| Scheduled synchronization | ✅ | 8-hourly job in `instrumentation.ts` |
| Manual synchronization/re-sync | ✅ | Biometric page + `/api/biometric/sync` |
| Duplicate punches don't create duplicates | ✅ | `upsertDailyAttendanceWithHistory` |
| Failed sync records logged | ✅ | `BiometricSyncRun` with error field |
| Missing employee mapping displayed | ✅ | `unmatchedUserIds` JSON on sync run |
| Biometric transaction history retained | ✅ | `BiometricAttendanceImport` + `DailyAttendanceHistory` |
| Sync for both Daily and Monthly | ✅ | Both views use same sync |
| Corrections after sync controlled | ✅ | Freeze gate + RBAC |

### A2. Biometric Page (BRD §4) — ⚠️ Partial

| Requirement | Status | Notes |
|-----------|--------|-------|
| View Toggle: Monthly / Daily | ⚠️ | Biometric page is CSV import viewer, not a monthly grid. Monthly view exists at `/workforce/attendance/monthly` separately |
| Advanced Filters (employee, dept, category, designation, location, shift, status, OT eligible, leave type, late, early out, missing punch, OT, comp-off, LOP) | ❌ | No advanced filter drawer. Basic filters only |
| Sync Biometric button + popup | ✅ | Sync button + confirmation modal |
| Sync result summary (total/synced/duplicate/failed/unmatched) | ✅ | `BiometricSyncRun` fields |
| Last sync info display | ✅ | Sync status shown on page |
| Monthly Attendance Grid (1 employee per row, 1 day per column) | ❌ | No calendar grid view. Biometric page shows imported CSV rows, not a day×employee matrix |
| Dynamic date columns (28-31 based on month) | ❌ | Not implemented as grid |
| Cell content: working hours in HH:MM | ❌ | Not implemented as grid |
| Color coding (Red/Orange/Yellow/Light Green/Dark Green/Blue) | ❌ | No color-coded cells. Status badge colors only |
| Configurable color thresholds | ❌ | No attendance policy model |
| Cell tooltip (employee, date, shift, in/out, working hours, late, early, permission, OT, status, biometric source) | ❌ | No tooltips on attendance cells |
| Missing Punch display ("MP" with warning) | ❌ | No MP indicator in grid |
| Attendance Correction action from missing punch | ⚠️ | Mispunch correction exists separately, not inline from grid |
| Employee-level summary columns (Late Mins, Total Work Hrs, OT Hrs) | ⚠️ | MonthlyAttendanceSummary has these fields, but no grid to display them |
| Wage/Salary columns (Wage Type, OT Eligible, Gross, Actual, OT Salary, Estimated) | ❌ | No salary columns on attendance page |
| Permission-controlled salary columns | ❌ | Not implemented |
| Wage Type display (Monthly/Daily/Hourly/Contract) | ❌ | No wage type field |
| Salary estimation (Gross, Actual, OT, Estimated) | ❌ | No salary estimation on attendance page |
| Column Selection (show/hide/reorder/reset) | ❌ | No column selector |
| Export (Excel/CSV/PDF/Print) | ⚠️ | CSV import exists. No Excel/PDF export from grid |
| Refresh button | ⚠️ | Page refetches, but no explicit refresh button |
| Working Duration Calculation (Out - In - Break) | ⚠️ | `workingMinutes` calculated from in/out, but **no break deduction** |
| Break/Permission adjustment | ❌ | No break time model. Permission hours tracked separately |
| Late-In Calculation (Actual IN - Shift Start - Grace) | ✅ | `biometricConversion.ts` line 252 |
| Early-Out Calculation | ⚠️ | `earlyOutMinutes` tracked, but calculation may not match BRD exactly |
| OT Calculation (eligibility → threshold → max limit → day-type rule → factor) | ⚠️ | OT eligibility + threshold done. No max limit, no day-type rule, no factor-by-day-type |
| Data Freeze display ("🔒 Attendance Frozen") | ❌ | No frozen indicator on page |
| Freeze workflow (disable edit/delete/leave/OT/permission/comp-off) | ⚠️ | Freeze exists on MonthlyAttendanceSummary, but not all sub-modules check it |

### A3. Daily Attendance (BRD §5) — ✅ Mostly Implemented

| Requirement | Status | Notes |
|-----------|--------|-------|
| Employee ID | ✅ | |
| Employee Name | ✅ | |
| Department | ✅ | Via employee relation |
| Date | ✅ | |
| Shift | ✅ | `shiftMasterId` snapshot |
| In Time | ✅ | |
| Out Time | ✅ | |
| Duration | ✅ | `workingMinutes` |
| Permission | ⚠️ | Permission tracked separately, not shown on daily attendance |
| Late In | ✅ | `lateMinutes` |
| Early Out | ✅ | `earlyOutMinutes` |
| OT Hours | ✅ | `otMinutesCalculated` / `otMinutesApproved` |
| Comp-Off | ❌ | No comp-off field on daily attendance |
| Status (Present/Absent/HalfDay/WeeklyOff/Holiday/Leave/Permission/Comp-Off/OnDuty/MissingPunch/LOP/HolidayWorked) | ⚠️ | Most statuses supported. "HolidayWorked" and "OnDuty" not explicitly handled |
| Remarks | ✅ | |

### A4. Monthly Attendance (BRD §6) — ✅ Mostly Implemented

| Requirement | Status | Notes |
|-----------|--------|-------|
| Display attendance for selected payroll month | ✅ | `/workforce/attendance/monthly` |
| Total present days | ✅ | `presentDays` |
| Total absent days | ✅ | `absentDays` |
| Leave days | ✅ | `leaveDays` |
| LOP days | ✅ | `lopDays` |
| Permission hours | ❌ | Not in MonthlyAttendanceSummary |
| Late-in hours/days | ✅ | `lateMinutesTotal` |
| Early-out hours/days | ✅ | `earlyOutMinutesTotal` |
| OT hours | ✅ | `otMinutesTotal` |
| Comp-Off | ❌ | No comp-off field |
| Shift information | ⚠️ | Shift on daily attendance, not summarized monthly |
| Attendance remarks | ⚠️ | On daily attendance, not summarized |
| Month-wise summary | ✅ | |
| Correction before finalization | ✅ | |
| Audit trail for manual changes | ✅ | `DailyAttendanceHistory` |
| Monthly Freeze after payroll approval | ✅ | `status: FROZEN` |
| Leave records frozen | ⚠️ | Leave has no freeze mechanism of its own |
| OT frozen | ⚠️ | OT approval status on DailyAttendance, frozen via attendance |
| Permission frozen | ⚠️ | Same — via attendance |
| Comp-Off frozen | ❌ | No comp-off to freeze |

### A5. Time Office Final (BRD §7) — ❌ Not Implemented

| Requirement | Status | Notes |
|-----------|--------|-------|
| Time Office Final page | ❌ | No page at `/workforce/attendance/time-office-final` |
| Time Office Final API | ❌ | No API |
| Employee ID/Name/Month display | ❌ | |
| Total Working Days | ❌ | (exists in MonthlyAttendanceSummary but no dedicated view) |
| Present/Absent/Leave/LOP days | ❌ | |
| Overall Working Duration | ❌ | |
| OT Hours | ❌ | |
| Permission hours | ❌ | |
| Late In / Early Out | ❌ | |
| Comp-Off | ❌ | |
| Leave Type breakdown | ❌ | |
| Shift display | ❌ | |
| Remarks | ❌ | |
| Payroll Status | ❌ | |
| Configurable leave types (CL/SL/EL/Other) | ✅ | `LeaveMaster` supports this |
| LOP identification | ⚠️ | LOP calculated in MonthlyAttendanceSummary, no dedicated review |
| LOP transfer to Payroll | ✅ | Payroll reads `lopDays` from summary |
| LOP freeze after payroll approval | ✅ | Via attendance freeze |

### A6. Leave Management (BRD §9-12) — ✅ Mostly Implemented

| Requirement | Status | Notes |
|-----------|--------|-------|
| Leave Master configuration | ✅ | `LeaveMaster` with code, name, annual days, accrual type, carry-forward |
| Leave Code | ✅ | |
| Leave Name | ✅ | |
| Previous leave details | ❌ | No "previous month leave" carry-over display |
| Annual Entitlement | ✅ | `defaultAnnualDays` |
| Carry Forward Allowed | ✅ | `carryForwardAllowed` |
| Carry Forward Limit | ✅ | `carryForwardMaxDays` |
| Encashment Allowed | ❌ | No encashment flag on LeaveMaster |
| Eligibility Criteria | ⚠️ | Only DOJ-based proxy, not true attendance-days check |
| Probation Eligibility | ❌ | No probation-specific leave eligibility |
| Leave Entry (employee self-service) | ✅ | `/workforce/leave/entry` |
| Leave Application fields (Emp ID, Leave Type, From/To, Days, Half/Full, Reason, Document, Manager, Date, Status) | ✅ | All fields on `LeaveApplication` |
| Leave Balance Validation | ✅ | Checked before submission |
| Negative/LOP leave prevention | ✅ | |
| Leave Approval (Manager → HR) | ✅ | Two-stage approval |
| Rejection reason captured | ✅ | |
| Approved leave updates attendance | ✅ | Via `attendanceHistory.ts` |
| Leave balance updated on approval | ✅ | |
| Rejected leave doesn't reduce balance | ✅ | |
| Cancelled leave restores balance | ✅ | |
| Approval history maintained | ✅ | |
| Leave History (Opening, Accrued, Availed, Pending, Cancelled, Adjusted, LOP, Closing) | ✅ | `LeaveBalance` model has all fields |
| Balance Calculation formula | ✅ | `closingBalance = opening + accrued + adjusted - availed` |
| Monthly Freeze of leave | ⚠️ | Via attendance freeze, not independent |

### A7. Overtime Management (BRD §13-19) — ⚠️ Partial

| Requirement | Status | Notes |
|-----------|--------|-------|
| OT Eligibility (Yes/No per employee) | ✅ | `JobInfo.overtimeAllowed` |
| OT eligibility by category/dept/designation/shift/grade/employee-type | ⚠️ | Only per-employee flag, no category-level rule |
| OT Calculation flow (attendance → shift → working duration → eligibility → threshold → calculate → factor → value) | ⚠️ | Basic flow implemented, missing day-type rules and factor selection |
| OT Rules: Normal working days | ⚠️ | Single factor, no day-type differentiation |
| OT Rules: Weekday | ⚠️ | Same as normal — no separate weekday rule |
| OT Rules: Weekly off | ❌ | No separate weekly-off OT rule |
| OT Rules: Sunday | ⚠️ | `otSettlementType` (OT/COMP_OFF) exists but no separate rate |
| OT Rules: Public holidays | ❌ | No holiday-specific OT rate |
| OT Rules: Shift-specific OT | ❌ | No shift-specific OT configuration |
| OT Rules: Employee-category-specific OT | ❌ | No category-specific OT |
| Minimum OT threshold (configurable) | ✅ | `OTPlan.applicableAfterMinutes` |
| Maximum OT hours per day | ⚠️ | `OTPlan.maxOtHoursPerDay` exists, not enforced in payroll |
| Monthly OT limit | ❌ | No monthly OT limit field |
| Weekly OT calculation | ❌ | No weekly OT aggregation |
| OT incentive/slab | ❌ | No OT incentive slab model |
| OT Factor (configurable: Basic/Gross/Basic+Allowance/Fixed Rate) | ⚠️ | Uses `JobInfo.overtimeFactor` and `overtimeRatePerHour`. No configurable basis selection |
| OT Factor values (1.0×/1.5×/2.0×/company-defined) | ⚠️ | Factor is a decimal on JobInfo, not day-type-specific |
| Sunday/Weekly-Off OT → OT or Comp-Off | ⚠️ | `otSettlementType` field exists (OT/COMP_OFF), but no Comp-Off balance model |
| OT + Comp-Off (if policy permits) | ❌ | Not supported |
| No benefit option | ❌ | Not supported |
| Weekly OT Calculation (aggregate → threshold → policy → eligible OT) | ❌ | Not implemented |
| Monthly OT Incentive (slab-based: 0-X none, X-Y incentive A, Y-Z incentive B, above Z incentive C) | ❌ | No OT incentive slab model |
| OT Approval (Manager → HR) | ✅ | Two-stage on `DailyAttendance.otApprovalStatus` |
| Rejected OT not sent to Payroll | ✅ | Only approved OT minutes flow to payroll |
| Approved OT locked after payroll | ✅ | Via attendance freeze |
| OT audit log | ✅ | `DailyAttendanceHistory` |

### A8. Comp-Off Management (BRD §20-21) — ❌ Not Implemented

| Requirement | Status | Notes |
|-----------|--------|-------|
| Automatic Comp-Off generation from Sunday/weekly-off work | ❌ | No Comp-Off model |
| Comp-Off eligibility check | ❌ | |
| Comp-Off generation flow (biometric → holiday check → eligible hours → rule → generate → approve → balance) | ❌ | |
| Comp-Off Approval | ❌ | |
| Comp-Off balance tracking | ❌ | No `CompOffBalance` model |
| Weekday Comp-Off (HR/Admin initiated) | ❌ | |
| Weekday Comp-Off minimum hours | ❌ | |
| Management approval for weekday comp-off | ❌ | |
| Comp-Off utilization tracking | ❌ | |
| Comp-Off expiry rules | ❌ | |

### A9. Permission Management (BRD §22) — ✅ Mostly Implemented

| Requirement | Status | Notes |
|-----------|--------|-------|
| Permission Entry (late arrival, early departure, personal, other) | ✅ | `PermissionRequest` model |
| Fields (Employee, Date, Type, From/To Time, Duration, Reason, Manager, Status, Remarks) | ✅ | All fields present |
| Workflow (Employee/HR → Manager Approval → Attendance Adjustment → Time Office Final → Payroll) | ✅ | Manager → HR approval |
| Permission considered in attendance/LOP calculation | ⚠️ | `exceedsAllowance` and `excessHours` flagged, but **not auto-converted to LOP** (manual HR correction needed) |
| Free hours per month policy | ✅ | `PermissionPolicy.freeHoursPerMonth` |
| Excess hours → LOM | ❌ | Not auto-converted (documented as manual step) |

### A10. Canteen Token / Deduction (BRD §23) — ❌ Not Implemented

| Requirement | Status | Notes |
|-----------|--------|-------|
| Canteen token/meal tracking | ❌ | No model |
| Employee-wise token eligibility | ❌ | |
| Daily/monthly token quantity | ❌ | |
| Food deduction rate | ❌ | `BenefitRateByEmployeeType` exists but not wired |
| Employee contribution | ❌ | |
| Company contribution | ❌ | |
| Payroll deduction integration | ❌ | |
| `JobInfo.canteenAllowanceApplicable` flag exists | ⚠️ | Flag exists, no logic |

### A11. Petrol Allowance (BRD §24) — ❌ Not Implemented

| Requirement | Status | Notes |
|-----------|--------|-------|
| Petrol allowance based on approved KM | ❌ | No model |
| Fields (Employee, Month, Travel Date, KM, Rate/KM, Eligible Amount, Approved Amount, Manager Approval, Payroll Amount) | ❌ | |
| Configurable rate per KM | ❌ | |
| Manager approval | ❌ | |
| Payroll integration | ❌ | |
| `JobInfo.petrolAllowance` flag exists | ⚠️ | Flag exists, no logic |

### A12. Performance Incentive (BRD §25) — ✅ Implemented

| Requirement | Status | Notes |
|-----------|--------|-------|
| Company Incentive (configurable %, max 50%) | ✅ | `PmsIncentive.companyPercent` |
| Individual Incentive (manager approval, configurable %, max 50%) | ✅ | `PmsIncentive.managerPercent` |
| Combined calculation (capped at 100%) | ✅ | `totalPercent` |
| Configurable basis (Basic/Gross/CTC/other) | ⚠️ | Percentage entered, basis not configurable — applied as ad-hoc earning |
| HR approval | ✅ | `status: pending_hr → approved/rejected` |
| Payroll integration | ✅ | Applied as ad-hoc PayrollLineComponent |

### A13. Double Machine Incentive (BRD §26) — ❌ Not Implemented

| Requirement | Status | Notes |
|-----------|--------|-------|
| HR manual entry (Employee, Date, Machine 1, Machine 2, No. of Machines, Working Days/Hours, Incentive Rate, Calculated Incentive, HR Remarks, Approval Status) | ❌ | No model |
| Double Machine calculation | ❌ | |
| Approval workflow | ❌ | |
| Payroll integration | ❌ | |

### A14. Other Incentives (BRD §27) — ❌ Not Implemented

| Requirement | Status | Notes |
|-----------|--------|-------|
| Attendance Bonus (Full Attendance + No LOP → bonus) | ❌ | No model, no calculation |
| Shift Bonus (shift-based eligibility → bonus) | ❌ | No model |
| Production Incentive | ❌ | No model |
| Special Incentive | ❌ | No model |
| Performance Bonus | ❌ | No model (PMS is separate) |
| Other management-approved incentive | ❌ | No model |
| Incentive Policy Master (configurable rules, not hard-coded) | ❌ | No incentive policy model |
| Bulk ad-hoc upload for incentives | ✅ | `/payroll/processing/salary/bulk-adhoc` exists for any component |

### A15. Payroll Integration from Time Office (BRD §28) — ⚠️ Partial

| Data to Payroll | Status | Notes |
|----------------|--------|-------|
| Present Days | ✅ | Via `MonthlyAttendanceSummary.presentDays` |
| Paid Days | ✅ | Via `MonthlyAttendanceSummary.payableDays` |
| Absent Days | ✅ | Via `MonthlyAttendanceSummary.absentDays` |
| LOP Days | ✅ | Via `MonthlyAttendanceSummary.lopDays` |
| Leave Days | ✅ | Via `MonthlyAttendanceSummary.leaveDays` |
| Leave Type | ❌ | Not broken down by type in summary |
| OT Hours | ✅ | Via `MonthlyAttendanceSummary.otMinutesTotal` |
| OT Amount | ✅ | Calculated in `payrollCalculation.ts` |
| Permission Adjustment | ❌ | Not sent to payroll (excess hours flagged but not deducted) |
| Comp-Off | ❌ | No comp-off data to send |
| Attendance Bonus | ❌ | Not calculated |
| Shift Bonus | ❌ | Not calculated |
| Petrol Allowance | ❌ | Not calculated |
| Canteen Deduction | ❌ | Not calculated |
| Performance Incentive | ✅ | Via PMS module → ad-hoc component |
| Double Machine Incentive | ❌ | Not calculated |
| Other Incentives | ❌ | Not calculated |

### A16. Freeze and Reopen (BRD §29) — ✅ Mostly Implemented

| Requirement | Status | Notes |
|-----------|--------|-------|
| Freeze status (Open → Attendance Processing → Time Office Final → Ready for Payroll → Payroll Processing → Payroll Approved → Frozen) | ⚠️ | Compressed: `OPEN → FINALIZED → FROZEN` on MonthlyAttendanceSummary |
| Freeze after Payroll Approval | ✅ | Attendance freeze after payroll lock |
| Attendance + Leave + OT + Permission + Comp-Off frozen | ⚠️ | Attendance + OT frozen. Leave/Permission/Comp-Off not independently frozen |
| Reopen by authorized HR/Admin only | ✅ | `/api/workforce/attendance/monthly/reopen` with RBAC |
| Reopen captures: date/time, user, reason, approval, original values, revised values, impact on payroll | ⚠️ | Captures user, date, reason. No "original vs revised values" comparison, no "impact on payroll" assessment |
| Reopen audit trail | ✅ | `reopenedAt`, `reopenedByUserId`, `reopenReason` |

### A17. Role-Based Access (BRD §30) — ⚠️ Partial

| Role | Required Access | Status |
|------|----------------|--------|
| Employee | Attendance view, Leave Entry, Permission, Comp-Off request | ⚠️ Leave/Permission done. No attendance self-view, no comp-off |
| Reporting Manager | Leave Approval, OT Approval, Permission Approval, Incentive Approval | ✅ All implemented (Manager stage) |
| HR Executive | Attendance processing, Leave, OT, Comp-Off, Benefits | ⚠️ Attendance/Leave/OT done. No Comp-Off, no Benefits (canteen/petrol) |
| HR Manager | Final approval, policy management, freeze/reopen | ✅ Freeze/reopen done. Policy management partial |
| Payroll User | Finalized Time Office and payroll integration | ✅ Payroll APIs RBAC-gated |
| Admin | Configuration and master data | ✅ |
| Management | Reports/Dashboard/Approvals | ⚠️ Dashboards exist, reports limited |

---

## PART B: PAYROLL GAPS (23 BRD Sections)

*(Summarized from `docs/PAYROLL_GAP_ANALYSIS_2026-09-11.md` — see that document for full detail.)*

### B1. Salary Processing Flow (BRD §1, §20) — ⚠️ Partial

- ✅ `DRAFT → CALCULATED → APPROVED → LOCKED`
- ❌ Missing: VALIDATED, SUBMITTED, POSTED stages
- ❌ Missing: Finance Approval stage
- ❌ Missing: Period Closure / reopen-after-lock

### B2. Attendance Inputs (BRD §2) — ⚠️ Partial

- ✅ Basic fields: workingDays, payableDays, presentDays, absentDays, leaveDays, lopDays, otMinutes
- ❌ Missing: paidHolidays, leave-type breakdown (EL/CL/SL), layoffDays, totalWorkHours, actualAttendance, lossOfMinutes
- ❌ LOM minutes exist in attendance but not consumed by payroll

### B3. Earnings (BRD §3) — ⚠️ Partial

- ✅ Configurable earning components via `SalaryComponent`
- ✅ OT, arrears, bonus as ad-hoc earnings
- ❌ No auto-calc for Night Shift, Heat, Snacks, Food, Attendance, Productivity incentives
- ❌ No "Fixed" vs "Variable" earning distinction

### B4. Gross Salary (BRD §4) — ⚠️ Partial

- ✅ LOP-prorated gross from recurring components
- ⚠️ OT added on top, not inside gross per BRD definition
- ❌ No configurable LOP-in-gross mode

### B5. OT Module (BRD §5) — ⚠️ Partial

- ✅ Basic OT calc (gross-based hourly rate × factor)
- ❌ 3 of 4 methods missing (Basic×2, Fixed, Basic+DA+HRA)
- ❌ No weekday/weekend/holiday rate differentiation
- ❌ OTPlan config not fully consumed

### B6. Arrears (BRD §5) — ✅ Mostly Done

- ✅ Gross revision arrears with PF/ESI
- ❌ 5 of 7 arrear types missing (allowance, deduction reversal, attendance, incentive, manual)

### B7. Bonus (BRD §6) — ✅ Mostly Done

- ✅ Two calculation methods, eligibility, approval workflow
- ❌ No bonus type categorization, no monthly accrual, no paid/balance tracking

### B8. Deductions (BRD §7) — ❌ Major Gap

- ✅ PF, ESI, PT, TDS calculated
- ✅ Manual ad-hoc deductions
- ❌ No loan/advance module (no EmployeeLoan model)
- ❌ No auto-deduction for canteen, mobile, transport, lunch, LIC, health insurance
- ❌ DeductionRate table not consumed

### B9. PF (BRD §8) — ⚠️ Partial

- ✅ PfRate model, calculation, employer/employee split, EPS
- ❌ `includeInPf` flag not consumed (uses full gross, not Basic+DA)

### B10. ESI (BRD §9) — ⚠️ Partial

- ✅ EsiRate model, calculation, eligibility check
- ❌ `includeInEsi` flag not consumed

### B11. Professional Tax (BRD §10) — ⚠️ Partial

- ✅ ProfessionalTaxSlab model, slab-based calculation
- ❌ No state-wise slabs (global, not company-scoped)

### B12. LOM (BRD §11) — ❌ Missing

- ❌ Entirely missing from payroll calculation
- ⚠️ Attendance data exists (lateMinutesTotal, earlyOutMinutesTotal)

### B13. TDS (BRD §12) — ❌ Major Gap

- ⚠️ Flat monthly slab lookup only
- ❌ No annual engine, no regime, no exemptions, no rebate, no surcharge, no cess

### B14. Loan Recovery (BRD §13) — ❌ Missing

- ❌ No EmployeeLoan model, no recovery, no balance tracking

### B15. LWF (BRD §14) — ❌ Missing

- ❌ No model, no calculation, no page

### B16. Salary Rounding (BRD §15) — ❌ Missing

- ⚠️ Hardcoded `Math.round()`
- ❌ No configurable rounding rules

### B17. Deduction % (BRD §16) — ❌ Missing

- ❌ Not displayed despite data available

### B18. Validations (BRD §17) — ❌ Major Gap

- ✅ 4 of 12 validations implemented
- ❌ 8 missing (negative net salary, deduction limits, OT limits, gross reconciliation, etc.)

### B19. Process Controls (BRD §19, §23) — ⚠️ Partial

- ✅ 4-stage workflow, per-employee HOLD
- ❌ Missing: VALIDATED, SUBMITTED, POSTED stages
- ❌ Missing: COMPLETED/PENDING/HOLD classification per BRD §23

### B20. Bulk Processing (BRD §21) — ❌ Major Gap

- ✅ All-employee calculation
- ❌ No selective processing, no pre-validation summary

### B21. Error Messages (BRD §22) — ❌ Major Gap

- ✅ 2 of 9 BRD messages
- ❌ 7 missing

### B22. Outputs — Mostly Missing

| Output | Status |
|--------|--------|
| Payslip (Individual) | ✅ Browser print |
| Payslip (Bulk) | ❌ No PDF, no email |
| Payroll Summary | ❌ No page, no API |
| Bank Transfer File | ❌ No file generation |
| Reconciliation | ❌ No page, no API |

### B23. Other Missing

| Module | Status |
|--------|--------|
| Leave Encashment | ❌ No model |
| Full & Final | ❌ No model |
| Other Incentives | ❌ No module |
| Health Insurance | ❌ No logic |
| Statutory UI Pages | ❌ Models exist, no pages |

---

## PART C: COMBINED GAP — Time Office → Payroll Integration

This is the critical integration layer where Time Office data flows into Payroll. These gaps affect both modules.

### C1. Data Flow Gaps

| Time Office Produces | Payroll Consumes | Gap |
|---------------------|-----------------|-----|
| Present days | ✅ `payableDays` | Working |
| LOP days | ✅ `lopDays` → proration | Working |
| OT minutes | ✅ `otMinutesTotal` → OT amount | Working |
| Late minutes | ❌ Not consumed | **LOM deduction missing** |
| Early out minutes | ❌ Not consumed | **LOM deduction missing** |
| Leave days (total) | ✅ `leaveDays` | Working (but no type breakdown) |
| Leave days (by type: EL/CL/SL) | ❌ Not available | **No type-wise breakdown** |
| Permission excess hours | ❌ Not consumed | **Excess not auto-converted to LOP/LOM** |
| Comp-Off earned | ❌ No comp-off model | **No comp-off balance** |
| Comp-Off utilized | ❌ No comp-off model | **No comp-off deduction** |
| Canteen tokens | ❌ No canteen model | **No canteen deduction** |
| Petrol KM | ❌ No petrol model | **No petrol earning** |
| Double machine hours | ❌ No double-machine model | **No double-machine incentive** |
| Attendance bonus eligibility | ❌ No attendance-bonus model | **No attendance bonus earning** |
| Shift bonus eligibility | ❌ No shift-bonus model | **No shift bonus earning** |
| Holiday worked | ❌ Not flagged in summary | **No holiday OT differentiation** |
| Weekly off worked | ⚠️ `otSettlementType` on daily | **No weekly-off OT rate** |

### C2. Freeze Integration Gaps

| Freeze Requirement | Status |
|-------------------|--------|
| Attendance frozen after payroll lock | ✅ |
| Leave frozen after payroll lock | ⚠️ Via attendance, not independent |
| OT frozen after payroll lock | ✅ Via attendance |
| Permission frozen after payroll lock | ⚠️ Via attendance, not independent |
| Comp-Off frozen after payroll lock | ❌ No comp-off to freeze |
| Canteen frozen after payroll lock | ❌ No canteen to freeze |
| Reopen triggers payroll recalculation | ❌ Reopen exists but no auto-recalc |

### C3. Time Office Final → Payroll Handoff

The BRD requires a formal "Time Office Final" stage as the handoff between Time Office and Payroll. This is entirely missing:

```
[Current flow]
MonthlyAttendanceSummary (FINALIZED) → PayrollRun (CALCULATED)

[BRD required flow]
MonthlyAttendanceSummary (FINALIZED)
  → Time Office Final (review + approve)
  → Ready for Payroll (handoff signal)
  → PayrollRun (CALCULATED)
```

| Handoff Requirement | Status |
|--------------------|----|
| Time Office Final review page | ❌ |
| Time Office Final approval | ❌ |
| "Ready for Payroll" status | ❌ |
| LOP review before payroll | ❌ |
| Leave-type review before payroll | ❌ |
| OT review before payroll | ⚠️ OT approval exists, but no consolidated review |
| Permission review before payroll | ❌ |
| Comp-Off review before payroll | ❌ |

---

## PART D: Combined Priority Matrix

### P0 — Critical (blocks both modules' accuracy)

| # | Gap | Module | Impact |
|---|-----|--------|--------|
| 1 | **LOM deduction** — late/early minutes not deducted from payroll | Both | Salary incorrect for late/early employees |
| 2 | **Comp-Off model** — no comp-off generation, balance, or utilization | Time Office | Sunday/holiday work not compensated |
| 3 | **PF/ESI wage base** — `includeInPf`/`includeInEsi` not consumed | Payroll | PF/ESI may be over/under calculated |
| 4 | **OT day-type differentiation** — no weekday/weekend/holiday rates | Both | OT paid at single rate regardless of day |
| 5 | **Loan & Advance recovery** — no model, no auto-deduction | Payroll | Loans not recovered through payroll |
| 6 | **TDS annual engine** — flat monthly only | Payroll | TDS incorrect |
| 7 | **Validations** — 8 of 12 missing | Payroll | Negative net salary, deduction limits not checked |
| 8 | **Permission excess → LOP/LOM** — not auto-converted | Both | Permission excess has no salary impact |

### P1 — High (blocks outputs)

| # | Gap | Module | Impact |
|---|-----|--------|--------|
| 9 | **Time Office Final page** — no formal handoff | Time Office | No review before payroll |
| 10 | **Bank Transfer File** | Payroll | No bank disbursement file |
| 11 | **Payroll Summary** | Payroll | No company-level totals |
| 12 | **Bulk Payslip PDF** | Payroll | No bulk payslip distribution |
| 13 | **Payroll Reconciliation** | Payroll | No error detection |
| 14 | **Salary Rounding** | Payroll | Hardcoded rounding |
| 15 | **Canteen deduction** | Both | No auto-deduction |
| 16 | **Petrol allowance** | Both | No auto-earning |
| 17 | **Double machine incentive** | Both | No calculation |
| 18 | **Attendance bonus** | Both | No auto-earning |
| 19 | **Shift bonus** | Both | No auto-earning |
| 20 | **Monthly grid view** with color coding | Time Office | No visual attendance workbench |
| 21 | **Biometric page: tooltips, export, column selector** | Time Office | Poor UX for HR |

### P2 — Medium (workflow completeness)

| # | Gap | Module | Impact |
|---|-----|--------|--------|
| 22 | **Workflow stages** (VALIDATED, SUBMITTED, POSTED) | Payroll | Incomplete workflow |
| 23 | **Multi-level approval** (Manager → HR → Finance) | Payroll | No finance approval |
| 24 | **Weekly OT calculation** | Time Office | No weekly OT aggregation |
| 25 | **Monthly OT limit** | Time Office | No monthly OT cap |
| 26 | **OT incentive slabs** | Time Office | No slab-based OT incentive |
| 27 | **Bulk processing** (selective + pre-validation) | Payroll | All-or-nothing processing |
| 28 | **COMPLETED/PENDING/HOLD classification** | Payroll | No proper status classification |
| 29 | **Error messages** (7 of 9 missing) | Payroll | Poor error UX |
| 30 | **Leave-type breakdown** in payroll | Both | No EL/CL/SL on payslip |
| 31 | **Reopen → auto-recalculation** | Both | Reopen doesn't trigger payroll recalc |
| 32 | **Holiday worked flag** in summary | Time Office | No holiday OT differentiation |

### P3 — Lower (feature completeness)

| # | Gap | Module | Impact |
|---|-----|--------|--------|
| 33 | **LWF** | Payroll | No LWF deduction |
| 34 | **Leave Encashment** | Payroll | No encashment |
| 35 | **Full & Final Settlement** | Payroll | No FnF |
| 36 | **Night/Heat/Snacks/Food allowance auto-calc** | Both | Manual entry only |
| 37 | **Health Insurance deduction** | Payroll | No auto-deduction |
| 38 | **LIC deduction** | Payroll | No auto-deduction |
| 39 | **State-wise PT slabs** | Payroll | Single global slab |
| 40 | **Investment declarations** (80C/80D) | Payroll | No TDS deductions |
| 41 | **Arrear types** beyond salary revision | Payroll | Only gross revision arrears |
| 42 | **Bonus type categorization** | Payroll | Single bonus type only |
| 43 | **Hourly-rate employees** | Both | All treated as monthly |
| 44 | **Attendance Policy model** (color thresholds, break rules) | Time Office | No configurable policy |
| 45 | **Break time deduction** | Time Office | No break model |
| 46 | **Probation leave eligibility** | Time Office | No probation-specific rules |
| 47 | **Comp-Off expiry rules** | Time Office | No comp-off at all |
| 48 | **Incentive Policy Master** | Time Office | No configurable incentive rules |
| 49 | **Deduction % display** | Payroll | Not shown |
| 50 | **Payslip content** (YTD, tax breakdown, leave balance) | Payroll | Minimal payslip |

---

## PART E: Combined Information Still Needed

The Time Office BRD partially answers 6 of the 38 payroll questions. **32 decisions remain unanswered.**

### Already Answered by Time Office BRD (partially)

| # | Question | What Time Office BRD Says | Still Needed |
|---|----------|--------------------------|--------------|
| OT method | §15: Configurable basis (Basic/Gross/Basic+Allowance/Fixed) | Which method does the company actually use? |
| OT factor | §15: 1.0×/1.5×/2.0× configurable | Which factor for which day type? |
| Approval chain | §11: Employee → Manager → HR | Is there a Finance stage? |
| Leave encashment | §9.1: "Encashment Allowed" config | What is the formula? Which leave types? |
| Canteen | §23: Token eligibility, rate, employee/company contribution | What are the actual rates? |
| Other incentives | §27: Attendance/Shift/Production/Special/Performance | What are the formulas and amounts? |

### Still Unanswered (32 decisions — see `docs/PAYROLL_BRD_INFORMATION_REQUIRED_2026-09-11.md` for full detail)

**P0 (7):** LOM formula, PF wage base, ESI wage base, Loan recovery rules, TDS regime+slabs, Negative net salary rules, Deduction limits

**P1 (6):** Bank file format, Payroll summary content, Reconciliation scope, Payslip content, Bulk payslip format, Salary rounding rule

**P2 (6):** Workflow stages, Payroll cutoff, COMPLETED vs LOCKED, PENDING vs HOLD, Bulk processing rules, Reopen rules

**P3 (13):** LWF rates, Leave encashment formula, FnF components, Shift allowance amounts, Health insurance, LIC, State-wise PT, Investment declarations, Arrear types, Bonus types, Hourly employees, PF employer rate, ESI eligibility

### New Questions from Time Office BRD (not in payroll BRD)

| # | Question | Why Needed |
|---|----------|-----------|
| T1 | **Break time policy** — is there a lunch/tea break deducted from working hours? | Working duration calculation needs break deduction |
| T2 | **Attendance color thresholds** — what are the working-hours thresholds for each color? | Biometric grid color coding |
| T3 | **Comp-Off eligibility** — minimum hours on Sunday/holiday to earn comp-off? | Comp-Off auto-generation |
| T4 | **Comp-Off expiry** — how long is comp-off valid? | Comp-Off balance management |
| T5 | **Weekly OT threshold** — what is the minimum weekly OT before it counts? | Weekly OT calculation |
| T6 | **Monthly OT limit** — what is the max OT hours per month? | Monthly OT cap |
| T7 | **OT incentive slabs** — what are the slab ranges and incentive amounts? | Monthly OT incentive |
| T8 | **Canteen token rate** — what is the per-token deduction amount? | Canteen deduction |
| T9 | **Petrol rate per KM** — what is the company's rate? | Petrol allowance |
| T10 | **Double machine incentive rate** — what is the per-machine rate? | Double machine incentive |
| T11 | **Attendance bonus amount** — what is the bonus for full attendance? | Attendance bonus |
| T12 | **Shift bonus amount** — what is the bonus per shift type? | Shift bonus |
| T13 | **Probation leave eligibility** — are probationers eligible for leave? Which types? | Leave eligibility |
| T14 | **Holiday worked OT rate** — what is the OT multiplier for holidays? | Holiday OT |
| T15 | **Weekly off OT rate** — what is the OT multiplier for weekly off? | Weekly off OT |

---

## PART F: What IS Working (Do Not Regress)

### Time Office — Working

1. ✅ Biometric sync (scheduled + manual) with device API
2. ✅ Biometric CSV import (legacy data migration path)
3. ✅ Daily attendance with shift snapshot, in/out, working minutes, late, early, OT
4. ✅ Monthly attendance summary with finalize/freeze/reopen
5. ✅ Leave master, entry, approval (Manager→HR), history, balance
6. ✅ Mispunch correction with two-stage approval
7. ✅ OT calculation (basic) with two-stage approval and OT/Comp-Off settlement type
8. ✅ Permission entry with two-stage approval and excess-hours flagging
9. ✅ PMS incentive with Manager input + HR approval
10. ✅ Attendance freeze after payroll lock
11. ✅ Daily attendance history (audit trail)
12. ✅ Shift master with night/snacks/meals fields
13. ✅ Shift rotation plan with weekly cycle slots
14. ✅ Holiday master with holiday types
15. ✅ OT plan with threshold, max hours, pay component

### Payroll — Working

1. ✅ Payroll run create → calculate → approve → lock
2. ✅ LOP-prorated earnings from salary revision components
3. ✅ PF/ESI/PT/TDS (basic) calculation
4. ✅ Per-employee HOLD with reason
5. ✅ Individual payslip with browser print
6. ✅ Salary revision with Manager→HR approval
7. ✅ Arrear calculation from retroactive revisions
8. ✅ Bonus calculation (two methods) with approval
9. ✅ PMS incentive → payroll application
10. ✅ Gratuity calculation
11. ✅ Bulk ad-hoc component upload via Excel
12. ✅ Company-scoped RBAC on all APIs
13. ✅ GrossSplitRule master (read-only)
14. ✅ DeductionRate master (read-only)
15. ✅ Payroll guard (no edits after approve/lock)

---

## Summary

| Metric | Time Office | Payroll | Combined |
|--------|------------|---------|----------|
| BRD Sections | 30 | 23 | 53 |
| ✅ Implemented | 10 | 4 | 14 |
| ⚠️ Partial | 8 | 6 | 14 |
| ❌ Missing | 12 | 13 | 25 |
| **Completion** | **~40%** | **~30%** | **~35%** |
| P0 critical gaps | 4 | 7 | 8 |
| P1 high gaps | 8 | 6 | 12 |
| P2 medium gaps | 5 | 6 | 11 |
| P3 lower gaps | 8 | 13 | 18 |
| **Total open gaps** | **25** | **32** | **50** |
| **Decisions still needed** | **15** | **32** | **47** |
