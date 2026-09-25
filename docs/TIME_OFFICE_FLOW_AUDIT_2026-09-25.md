# Time Office flow audit — punch → request → approval → freeze → payroll

**Date:** 2026-09-25
**Scope:** the hand-offs between stages of the Time Office pipeline: biometric punch ingestion, daily attendance derivation, ESS requests (mispunch, leave, OT, comp-off, on-duty, WFH, permission, shift change) and their approval chains, month finalize / freeze / ready-for-payroll, and what payroll reads.
**Method:** every finding was read in the code, not inferred from documentation. `✔` = read directly at the cited lines; `○` = reported by a code sweep and consistent with what was read, re-verify while fixing.

This is different from `COMBINED_GAP_ANALYSIS_TIME_OFFICE_PAYROLL_2026-09-11.md`, which tracks BRD feature coverage. This document is about where data is silently corrupted or the lock is bypassed *between* stages that individually "work".

The governing client rule (BRD answers, 2026-09-07): **attendance must not be editable once payroll for that month is processed — hard lock, no exceptions.** Mispunch / leave / OT go Employee → Reporting Manager → HR.

---

## 1. Pipeline as built

```
Device API (daily firstIn / lastOut only)  ──┐
Legacy CSV import (31 day columns)          ──┼─> upsertDailyAttendanceWithHistory ──> DailyAttendance ──> refreshMonthlySummary
Manual daily entry / ESS approvals          ──┘      (src/lib/attendanceHistory.ts)                       (src/lib/biometricConversion.ts)
                                                                                                                 │
  monthly/finalize  (fills WeeklyOff / Holiday / LOP rows, status → FINALIZED)
  → monthly/freeze  (status → FROZEN, recalculates DRAFT/CALCULATED payroll runs)
  → time-office-final/[id]/ready-for-payroll  (status → READY_FOR_PAYROLL; no UI calls it)
  → PayrollRun calculate → approve → lock → post
```

The freeze gate is `MonthlyAttendanceSummary.status`. Until this audit, `checkMonthNotFrozen` (`src/lib/attendanceFreeze.ts`) blocked **only** `FROZEN`.

---

## 2. Findings

### A. Punch ingestion → DailyAttendance

| # | Flaw | Where | Effect |
|---|------|-------|--------|
| A1 ✔ | **Re-sync overwrites approved days.** The device sync writes status / in / out for every non-frozen day with no check of the existing row's `source` or status. It runs every 8 h with a 2-day look-back. | `src/lib/biometricSync.ts` write loop | Approved Leave / OnDuty / WFH / mispunch-corrected / manually entered days flip back to whatever the device says (often `MissingPunch`). The leave balance stays deducted. |
| A2 ✔ | **Re-sync resets approvals.** Any write that carries `otMinutesCalculated` re-queues OT to `pending_manager` and nulls `otMinutesApproved`; any write carrying `lateMinutes` resets `lomApprovalStatus` to `pending`. Sync and import always pass both, even when nothing changed. | `src/lib/attendanceHistory.ts` re-queue block | Manager / HR OT and LOM decisions are undone by the next scheduled sync. |
| A3 ✔ | Sync resolves the shift with `resolveDailyShift`, not `resolveDailyShiftWithOverride`. Mispunch approval did the same. | `biometricSync.ts`, `mispunch/[id]/approve/route.ts` | Approved shift changes and roster overrides are ignored → wrong late / early / OT. |
| A4 ✔ | Sync never writes `earlyOutMinutes`, `isWeeklyOffWorked`, `isHolidayWorked`. | `biometricSync.ts` | Sunday / holiday work from the device is never flagged → no weekly-off OT factor, no comp-off eligibility, stale early-out in LOM. |
| A5 ○ | `deriveStatusAndMinutes` never yields WeeklyOff / Holiday; half-day threshold is hard-coded at 7 h; the `AttendancePolicy` master is never read. | `biometricConversion.ts` | The policy master is cosmetic. |
| A6 ○ | Manual daily entry parses `YYYY-MM-DDTHH:mm` with `z.coerce.date()`; mispunch uses `wallClockDateTime`. | `src/lib/validations/workforce.ts` | Manual times shift by the server's TZ offset (5 h 30 on IST). |
| A7 ○ | Legacy import re-write sends all 31 day fields including nulls. | `src/app/api/biometric/import/route.ts` | A partial re-import wipes previously imported days. |
| A8 ○ | OT plan = first active `OTPlan` globally (no companyId). | `biometricConversion.ts` | Wrong plan in a multi-company database. |

### B. Month summary and finalize

| # | Flaw | Where | Effect |
|---|------|-------|--------|
| B1 ✔ | **Missing rows are paid.** `payableDays = calendarDays − absent − LOP`; a date with no `DailyAttendance` row counts as neither. Only finalize back-fills rows. | `refreshMonthlySummary` | Any refresh before finalize (and any row skipped after) shows full pay. |
| B2 ✔ | Leave is counted as paid regardless of LeaveMaster paid / unpaid; the leave-type breakdown counts calendar days of the application span (including weekends); the comp-off code is compared as `'CO' \|\| 'COMP_OFF'` while approval uses `'COMPOFF'`. | `refreshMonthlySummary` | Comp-off leave lands in `otherLeaveDays`; type-wise days over-count. |
| B3 ✔ | Finalize phase 1 converts any `Absent` / `MissingPunch` row with no punches to `LOP` **before** checking weekly-off / holiday. | `monthly/finalize/route.ts` | An `Absent` row on a Sunday becomes LOP. |
| B4 ✔ | Finalize only rejected `FROZEN`; a `READY_FOR_PAYROLL` month could be re-finalized and downgraded to `FINALIZED`. | `monthly/finalize/route.ts` | Hand-off state lost silently. |
| B5 ✔ | `refreshMonthlySummary` had no status guard and is called by every approval / reject route. | `biometricConversion.ts` | Counts on a FROZEN / READY month still changed. |
| B6 ○ | Reopen refreshed every employee's summary in the month, including ones still FROZEN. | `monthly/reopen/route.ts` | Same as B5 through a different door. |

### C. Freeze / payroll lock

| # | Flaw | Where | Effect |
|---|------|-------|--------|
| C1 ✔ | **Guard blocked only `FROZEN`.** `FINALIZED` and `READY_FOR_PAYROLL` were writable everywhere; `checkFrozenMonths` documented this as intended. | `attendanceFreeze.ts`, `biometricSync.ts`, `leave/finalizeApproval.ts` | The "ready for payroll" state locked nothing. Payroll validation only *warned* on it; reopen could not even reopen it. |
| C2 ✔ | **Payroll lock did not freeze attendance**; freeze did not look at payroll; reopen did not refuse when a `PayrollRun` for that month was APPROVED / LOCKED. | `api/payroll/runs/[id]/lock`, `monthly/freeze`, `monthly/reopen` | Direct violation of the client's hard-lock rule. |
| C3 ✔ | Writers with **no freeze check at all**: OT approve (manager stage), OT reject + bulk-reject, LOM reject + bulk-approve + bulk-reject, permission approve / reject, comp-off approve, shift override writers (bulk-shift-upload, shift-plan, shift-change approve), every ESS *create* route. | grep over `dailyAttendance.update\|upsertDailyAttendanceWithHistory` | Frozen-month pay inputs change. |
| C4 ✔ | Payroll reads **live** `DailyAttendance` for OT (`payroll/otCalculation.ts`), LOM (`payrollCalculation.ts`) and night allowance, not a frozen snapshot. | | Every C1 / C3 hole changes pay after approval. |
| C5 ✔ | Leave approval / cancel checked freeze only on the from-month and to-month. | `leave/finalizeApproval.ts` | A 3-month leave skipped the middle month's lock. |
| C6 ○ | `DepartmentWeeklyOff.isFrozen` is never read. | `src/lib/weeklyOff.ts` | Dead flag. |

### D. ESS requests and approvals

**Mispunch** (`src/app/api/workforce/mispunch/…`)

| # | Flaw | Where |
|---|------|-------|
| D1 ✔ | **One-sided correction wiped the other punch.** Approval wrote `inTime: requestedInTime, outTime: requestedOutTime` verbatim; with one null, `deriveStatusAndMinutes` fell to the hours branch → `Absent`, 0 min. | `[id]/approve/route.ts` |
| D2 ✔ | `earlyOutMinutes`, `isWeeklyOffWorked`, `isHolidayWorked` not written; shift override ignored (A3). | `[id]/approve/route.ts` |
| D3 ○ | Policy (`maxBackdateDays`, `maxRequestsPerMonth`, one-open-per-date) enforced on create only; HR stage had no company-scope check; nothing stops a second correction after an approved one. | `mispunch/route.ts` |
| D4 ○ | No cancel route (the 409 text told the user to "Cancel"); notification deep-link `/ess/mispunch` but the page is `/ess/mis-punch`. | approve / reject / create routes |

**Leave** (`src/app/api/workforce/leave/…`, `my-leave/…`, `src/lib/leave/finalizeApproval.ts`)

| # | Flaw | Where |
|---|------|-------|
| D5 ✔ | Approval writes `status:'Leave'` for **every calendar day** in range, including Sundays / holidays; no sandwich logic. Finalize then never back-fills WeeklyOff for those dates → the Sunday is debited from the balance. | `finalizeApproval.ts` |
| D6 ✔ | Half-day ignored: `numberOfDays` 0.5 still writes a full `Leave` day and the summary counts 1. | `finalizeApproval.ts`, `refreshMonthlySummary` |
| D7 ✔ | Overwrites a `Present` day with punches, no conflict check. | `finalizeApproval.ts` |
| D8 ✔ | **Cancel turns days into `LOP`** instead of re-deriving from the punches that exist; never refunds `CompOffBalance`. | both cancel routes |
| D9 ○ | ESS create: balance checked only if a balance row exists (pending not counted); `numberOfDays` trusted from the browser; no overlap check (bulk-upload is the only path with one); LeaveMaster policy fields (notice, back-date, min / max, half-day allowed, probation) not enforced. HR cancel allows `'pending'`, which is not a stored status. Manager reject does not record the actor. |
| D10 ✔ | Comp-off leave: approval upserts a `LeaveBalance` row **and** debits `CompOffBalance` → two ledgers. |

**OT** (`ot-request/…`, `attendance/ot/…`)

| # | Flaw |
|---|------|
| D11 ○ | No UI calls `ot-request/[id]/approve\|reject`; approval **adds** requested minutes on top of calculated OT with no cap or punch check; reject lacks a company check. |
| D12 ✔ | Biometric OT approve at manager stage and all OT reject routes skipped the freeze (C3). |
| D13 ○ | Comp-off from biometric OT credits **both** `LeaveBalance` (`grantCompOff`) and `CompOffBalance`; the comp-off request path credits only `CompOffBalance`. |

**Comp-off** (`comp-off-request/…`, `comp-off/expire`)

| # | Flaw |
|---|------|
| D14 ○ | **Double benefit**: a comp-off request is allowed when OT was settled as paid `OT`; only rejected when settlement was `COMP_OFF`. |
| D15 ○ | `CompOffPolicy` (min hours, requiresApproval, isActive) is read only by reports; expiry is manual; credit dated `requestedDate` not `workedDate`; credit + status not in one transaction. |

**On-duty / WFH / Permission / Shift change**

| # | Flaw |
|---|------|
| D16 ○ | On-duty / WFH approval overwrites WeeklyOff / Holiday / Leave days; no overlap check; no cancel; WFH writes `Present` with 0 minutes. |
| D17 ○ | Permission approve does not call `refreshMonthlySummary`; create enforces a hard monthly cap while approve only flags excess. |
| D18 ○ | Shift-change `ROLE` stages have no authorization branch → any company user can approve; past-date overrides do not recompute attendance. |

**Approver resolution / notifications**

| # | Flaw |
|---|------|
| D19 ○ | Level-2 managers can approve leave / on-duty / WFH / permission but the queues filter Level-1 only. `ApprovalChainConfig` (LEAVE / OT / LOM modules offered) is read only by shift change; no escalation for any attendance request. |
| D20 ○ | No notification when a request reaches `pending_hr`; ESS leave create / cancel and bulk approve send nothing. |

### E. Tests

Before this audit only `mispunchRequestSchema` and `myLeaveApplicationSchema` (`tests/unit/request-validation.test.ts`), the overnight carry rule, and one frozen-import guard were covered. No test existed for any approve / reject / cancel, sync-over-approval, freeze bypass, or payroll lock.

---

## 3. Fixed in this pass (2026-09-25)

| Finding | Fix |
|---------|-----|
| C1, C2, C3, C5, B4, B5, B6 | `src/lib/attendanceFreeze.ts` now exposes one rule, `getAttendanceLock`: a month is locked when its summary is `FROZEN` **or** `READY_FOR_PAYROLL`, **or** a `PayrollRun` for the employee's company / year / month is `APPROVED`, `LOCKED` or `POSTED`. `checkMonthNotFrozen` uses it; `checkRangeNotFrozen` checks every month of a date range. Every writer listed in C3 and every ESS create route now consults it. `refreshMonthlySummary` refuses to touch a locked month. Payroll lock freezes the month's summaries; reopen refuses while payroll is processed and refreshes only the employees it reopened; finalize refuses locked months. |
| A1 | Device sync and biometric import skip rows a person wrote (`source = 'manual'`, i.e. manual entry, mispunch / leave / on-duty / WFH approval) and any row whose status is `Leave` or `OnDuty`. Skips are counted as `skippedProtected` in the sync outcome. |
| A2 | `upsertDailyAttendanceWithHistory` re-queues OT only when `otMinutesCalculated` actually changes, and LOM only when late / early-out minutes actually change. Unchanged re-syncs keep the existing decision. |
| A3, A4 | Sync uses `resolveDailyShiftWithOverride`, writes `earlyOutMinutes`, and sets `isWeeklyOffWorked` / `isHolidayWorked` the same way the import path already did. |
| D1, D2, D3 (company scope), D4 | Mispunch approval merges the requested time with the existing punch, writes `MissingPunch` (not `Absent`) when still one-sided, uses the override-aware shift, writes early-out and weekly-off / holiday flags, checks company scope, and links to `/ess/mis-punch`. A cancel route (and a Withdraw button on `/ess/mis-punch`) lets the employee withdraw a request that is still awaiting a decision at either stage. |

Regression tests: `tests/unit/attendance-lock-and-requeue.test.ts`, `tests/integration/time-office-flow.test.ts`.

### Leave core (later on 2026-09-25, from the client's answers in `TIME_OFFICE_FLAWS_QA_2026-09-25.md` §9)

| Finding | Fix |
|---------|-----|
| D5 | Approval writes and debits **working days only** (`src/lib/leave/leaveDays.ts` `computeLeaveDays`). Sundays / holidays inside a paid leave are skipped. Unpaid types (`LeaveMaster.isPaid = false`) count a weekly off between two leave days as LOP when `countSandwichedNonWorking` is on. |
| D6 | Half-day leave writes `HalfDay`, keeps the punches, debits 0.5; the summary counts 0.5 present + 0.5 leave (unpaid: 0.5 LOP). Device punches on a half-day leave merge into the day, no OT/LOM queue. |
| D7 | A full-day leave is refused at submission when the date already has a punch-in, and again at HR approval (`WORKED_DAY`); a half-day only when a full `Present` day exists. Overlapping applications are refused at submission and at approval (`OVERLAP`). |
| new | A punch on an approved full-day leave is recorded on the row (`leaveConflict*`) and queued at `/approvals/workforce/leave-conflicts` (event `LEAVE_CONFLICT` → `ROLE:hr-admin`). HR picks **present** (date leaves the leave, balance credited back, punches applied, sandwiched weekly offs restored) or **keep leave**. Never auto-decided; a decided conflict is not re-raised by the next sync. |
| D8 | Cancel restores every linked day from the evidence (conflict punches → derived, weekly off / holiday → that status, else Absent) via `restoreLeaveDay`, refunds what is still debited, refunds the comp-off ledger for COMPOFF. Both cancel routes share `src/lib/leave/cancel.ts`; HR can now cancel pending applications. |
| D9 (part) | The server computes `numberOfDays`; the browser value is ignored. Balance is checked against the computed count at submission and at approval; unpaid types have no ledger. Notice / back-date limits stay unenforced (on hold). |
| D10 | Comp-off leave no longer creates a phantom negative `LeaveBalance` row. |
| B2 | Leave-type breakdown counts from the linked day rows (code `COMPOFF`), legacy prorate only for unlinked applications. |
| A7 | A partial re-import writes only the day fields the file carries. |
| race | Approval, cancel and resolve flip status with guarded `updateMany`, so two approvers cannot both debit; leave transactions use a 60 s timeout. |
| guards | WFH / on-duty approval, mispunch submit / approve, and manual daily entry refuse a date that is an approved full-day leave. |

Schema: migration `000090_leave_attendance_link` (links, kind, conflict fields, `daysReversed`; backfilled 28 legacy leave days). Tests: `tests/integration/leave-core.test.ts` (15 cases).

## 4. Still open (documented for follow-up)

Remaining phases: OT / comp-off ledger integrity (D11, D13–D15), summary payable-day derivation and finalize weekly-off order (B1, B3), thresholds from the policy master (A5), WFH minutes / permission excess / chain engine (D16–D20), OT plan tenancy (A8), dead weekly-off flag (C6), Leave Master limits (D9 remainder), dual source ingestion.
