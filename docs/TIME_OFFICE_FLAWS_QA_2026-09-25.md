# Time Office — open flaws, questions and proposed answers

**Date:** 2026-09-25
**Use:** working sheet. For each flaw: the question that must be answered, the answer we propose, and what gets built once it is agreed. Fill the **Decision** column and we build in the order of §7.
**Sources:** `TIME_OFFICE_FLOW_AUDIT_2026-09-25.md` (flaw IDs), `TIME_OFFICE_PROPOSED_SOLUTION_2026-09-25.md` (dual source + leave design).

Already fixed on 2026-09-25, no decision needed: single lock rule (C1, C2, C3, C5, B4, B5, B6), sync does not undo approvals (A1, A2, A3, A4), one-sided mispunch correction (D1, D2), mispunch company scope, cancel route and link (D3 part, D4).

---

## 1. Leave

| # | Flaw | Question | Proposed answer | Build | Decision |
|---|------|----------|-----------------|-------|----------|
| 1 | **D5** Leave is written on Sundays / holidays inside the range and debited. | Should a Sunday or holiday inside a leave be counted as leave? Is there a sandwich rule (Sat + Mon leave → Sunday counted)? | No. Skip weekly-off and holiday days when writing and debiting. Sandwich rule is a per-leave-type switch on Leave Master, default **off**. | `commitLeaveApproval` skips WO/holiday; `LeaveMaster.sandwichRule`. | |
| 2 | **D6** Half-day leave stamps the whole day and debits 1 day. | Half-day = 0.5 debit, and the day counts 0.5 worked? What are the full-day / half-day hour thresholds? | Yes. Day = `HalfDay` with leave type noted, balance −0.5, summary 0.5 leave + 0.5 present. Thresholds are a **company setting** (Attendance Policy), no default guessed. | Half-day path in approval and summary; read `AttendancePolicy` thresholds. | |
| 3 | **D7** Leave approved over a day that already has punches silently overwrites it. | Refuse, or allow with HR override? | **Refuse** with the exact day and times. HR may override with a mandatory reason; the row is then cleaned (in/out, minutes, OT cleared, old values in history). | Check in `checkCanApprove`; `overrideWorkedDays` + reason on application. | |
| 4 | **new** A punch on an already-approved leave day is dropped silently (sync counts it, nobody sees it). | HR decides, or auto-cancel the leave when a full shift was worked? | **HR decides.** Day stays Leave, flagged `leaveConflict`, HR queue with two actions: cancel that one leave day (restore balance, apply punches) or ignore the punch. | Conflict columns on the day row; `Approvals › Leave conflicts` page. | |
| 5 | **D8** Cancelling an approved leave turns the days into **LOP**; comp-off leave never refunds the comp-off ledger. | — (no policy question) | Restore each day from the history snapshot taken at approval; refund `CompOffBalance` for comp-off leave. Only a day with no prior row and no punch becomes Absent. | Both cancel routes; `leaveApplicationId` on the day row so restore is exact. | fix |
| 6 | **D9** ESS submit: balance checked only if a balance row exists; pending requests do not reserve balance; `numberOfDays` is trusted from the browser; no overlap check. | Should a pending request reserve balance? Should overlapping requests be blocked? | Yes and yes. Server computes `numberOfDays` from the dates (working days only, per #1). Available = closing − pending. Overlap with any pending/approved leave, on-duty or WFH is refused. | `my-leave` and `leave/applications` POST share one validator. | |
| 7 | **D9** Leave Master policy fields (notice days, back-date limit, min/max days, probation eligibility, half-day allowed) are stored but never enforced. | Which of these apply, and with what values, per leave type? | Enforce every field that has a value; empty = no limit. Client supplies values per leave type (CL / SL / EL / Comp-off). | Validator reads Leave Master. | values needed |
| 8 | **D10** Comp-off leave approval writes a `LeaveBalance` row **and** debits `CompOffBalance` — two ledgers. | — | One ledger: `CompOffBalance` only. Drop the `LeaveBalance` path for code `COMPOFF`. | `commitLeaveApproval`. | fix |
| 9 | HR cancel accepts status `pending`, which is never stored (so HR cannot cancel a pending leave); manager reject does not record who rejected. | — | Accept `pending_manager` / `pending_hr` / `approved`; record `managerActionByUserId` on reject. | Cancel + reject routes. | fix |
| 10 | **B2** Summary counts leave-type days from the application span (calendar days, incl. weekends); comp-off code compared as `CO`/`COMP_OFF` while approval uses `COMPOFF`. | — | Count from `DailyAttendance` rows (with `leaveApplicationId`); one code constant. | `refreshMonthlySummary`. | fix |

## 2. Overtime and comp-off

| # | Flaw | Question | Proposed answer | Build | Decision |
|---|------|----------|-----------------|-------|----------|
| 11 | **D11** Employee OT requests have no approval screen; approval **adds** the requested minutes on top of calculated OT with no cap and no check that the person was even there. | Keep employee-raised OT requests at all, now that device OT auto-queues for approval? If yes, what is the daily cap? | Keep, for days the device missed. Approval **replaces** (not adds) the day's OT, capped at `OTPlan.maxOtHoursPerDay`, requires a punch pair on that day, company-scoped. Show them on the existing OT Approval page in a second tab. | `ot-request/[id]/approve`; tab on `/approvals/workforce/overtime`. | |
| 12 | **D13** Comp-off from OT approval credits **both** `LeaveBalance` (via `grantCompOff`) and `CompOffBalance`. | — | One ledger: `CompOffBalance`. Remove `grantCompOff`. | OT approve + bulk-approve. | fix |
| 13 | **D14** Double benefit: OT settled as paid cash **and** a comp-off request for the same day is allowed. | OT cash **or** comp-off, never both? | Never both (BRD: "OT or Comp-Off depending on approval"). Comp-off request refused when OT settled as cash; settling OT as cash refused when a comp-off credit exists. | Both routes. | |
| 14 | **D15** `CompOffPolicy` (minimum qualifying hours, requires approval, active flag) is read only by reports; expiry is a manual button; credit is dated on the requested date, not the worked date. | Minimum hours worked on a Sunday/holiday to earn a comp-off? Validity in months? Auto-expire monthly? | Enforce the policy; credit dated on the **worked** date; expiry runs automatically on the 1st. Values from client (BRD T3 / T4 still open). | Policy checks; scheduler job. | values needed |
| 15 | OT eligibility is only a per-employee flag; BRD asks for category / department / shift rules. | Is per-employee enough for go-live? | Yes for go-live. Category defaults later. | — | |

## 3. Month summary, finalize, payroll hand-off

| # | Flaw | Question | Proposed answer | Build | Decision |
|---|------|----------|-----------------|-------|----------|
| 16 | **B1** A date with no attendance row counts as neither present nor absent, so it is **paid**. Only finalize back-fills rows. | Should payroll be blocked while a month has unaccounted days? | Yes. Summary stores `unaccountedDays`; Time Office Final shows it; payroll pre-validation errors when > 0. | `refreshMonthlySummary`, Time Office Final, `payrollValidation`. | |
| 17 | **B3** Finalize converts an `Absent` row on a Sunday / holiday to LOP (checks LOP before weekly-off). | — | Check weekly-off / holiday first. | Finalize phase 1. | fix |
| 18 | **A5** Half-day threshold hard-coded 7 h; `AttendancePolicy` master never read; no auto-absent rule. | Full-day hours, half-day hours, and "auto-absent if no punch" — company values? | Read them from `AttendancePolicy` (already has the fields). Client supplies numbers. | `deriveStatusAndMinutes` takes policy. | values needed |
| 19 | **C4** Payroll reads **live** day rows for OT, LOM and night allowance, not a frozen snapshot. Any future write bug changes pay after approval. | Snapshot at Time Office Final? | Yes. "Ready for Payroll" stores a per-employee snapshot (paid days, LOP, OT minutes by day type, LOM minutes, night-shift days, permission excess). Payroll reads the snapshot; the lock makes it immutable. | Snapshot table + payroll readers. Larger change; schedule after §1–2. | |
| 20 | "Ready for Payroll" exists as an API but no screen calls it; Time Office Final page is read-only. | Who presses it — HR Manager? | HR Manager, per employee or whole month, with remarks. | Button on `/workforce/attendance/time-office-final`. | |

## 4. Permission, on-duty, WFH, shift change

| # | Flaw | Question | Proposed answer | Build | Decision |
|---|------|----------|-----------------|-------|----------|
| 21 | **D16** On-duty / WFH approval overwrites WeeklyOff / Holiday / Leave days; no overlap check; no withdraw; WFH writes Present with **0 minutes**. | Does a WFH day earn the standard shift minutes? | Yes: credit the day's shift standard minutes, no late / early-out / OT. Skip WO / holiday days. Overlap refused. Withdraw like mispunch. | Both approve routes; validators; cancel routes. | |
| 22 | **D17** Permission: submit is hard-refused when the monthly free hours are used up, but the BRD says excess is simply LOP; approval never refreshes the summary. | Refuse at submission, or allow and convert excess to LOP? | **Allow**, mark excess → LOP (BRD). Remove the hard cap at submit; show remaining free hours in the form. Approval refreshes the summary. | `permission` POST + approve. | |
| 23 | **D18** Shift-change chain stage of type `ROLE` has no authorization check (any signed-in user can approve); an override on a past date does not recompute that day. | — | Authorise ROLE stages; recompute the day's late / early / OT when an override lands on a date that already has punches. | Approve route + override writers. | fix |

## 5. Approvers, chains, notifications, withdraw

| # | Flaw | Question | Proposed answer | Build | Decision |
|---|------|----------|-----------------|-------|----------|
| 24 | **D19** Level-2 managers can approve leave / on-duty / WFH / permission but the queues show Level-1 only. `ApprovalChainConfig` (offers LEAVE / OT / LOM modules) is read only by shift change. No escalation anywhere. | Should leave, mispunch and OT use the configurable chain (so the OT chain RM → HOD → HR from the BRD can be set without code)? After how many days does a pending request escalate? | Yes: one chain engine for all attendance requests; today's hard-coded RM → HR becomes the default chain. Escalation to the next stage after **N** days, N a company setting. | Chain resolver shared by all approve routes; queues built from the chain. | N needed |
| 25 | **D20** No notification when a request reaches HR; ESS leave submit / cancel and bulk approve send nothing. | — | Add `PENDING_HR` event; wire the missing senders. | `notifyEssRequest`. | fix |
| 26 | **D3** Mispunch policy checked at submit only; a second correction for an already-corrected day is allowed. | Allow re-correcting a corrected day? | Yes, it counts against the monthly limit and shows the previous correction to the approver. | Approve route shows history. | |
| 27 | **D4** No withdraw for OT request, on-duty, WFH, permission (mispunch has one now). | — | Same withdraw route and button on each ESS page. | 4 routes + buttons. | fix |

## 6. Ingestion and sources

| # | Flaw | Question | Proposed answer | Build | Decision |
|---|------|----------|-----------------|-------|----------|
| 28 | **A6** Manual daily entry parses `YYYY-MM-DDTHH:mm` as server-local time; mispunch parses it as wall clock. On an IST server manual times shift by 5 h 30. | — | Use `wallClockDateTime` for manual entry too. | `dailyAttendanceSchema`. | fix |
| 29 | **A7** Re-importing a legacy file writes all 31 day fields including nulls, wiping days not in the file. | — | Write only the days present in the file. | Import route. | fix |
| 30 | **A8** The OT plan used is the first active plan **globally**; `OTPlan` has no company. | Accept for now (single company live)? | Accept for go-live; tenant-scope masters is a separate, deferred piece of work. | — | |
| 31 | **C6** `DepartmentWeeklyOff.isFrozen` exists but is never read. | What was it meant to freeze? | Remove the column or wire it to block weekly-off edits for a finalized month. | — | |
| 32 | **Dual source** (proposal Part 1): app punches are not ingested at all yet. | Q1 app sync frequency · Q2 same table as device controller and real `ATTENDANCE_TYPE` values · Q3 app-only day = Present · Q4 geofence · Q5 ESSL connection details. | 1 h · one pass if same table · yes, flagged · not now, store GPS · required. | Merge helper, app sync, source + GPS columns, screens. | Q1–Q5 |

## 7. Proposed working order

1. **Leave core** — #1, #2, #5, #6, #8, #9, #10 (needs answers to #1, #2, #6; #7 values can follow).
2. **Leave conflicts** — #3, #4 (needs answers to #3, #4).
3. **OT / comp-off integrity** — #11, #12, #13, #14.
4. **Summary and hand-off** — #16, #17, #18, #20; then #19 snapshot.
5. **Permission / OD / WFH / shift** — #21, #22, #23, #27.
6. **Chain engine + notifications** — #24, #25, #26.
7. **Ingestion hygiene** — #28, #29, #31; **dual source** #32 once Q2 and Q5 are in.

---

## 8. Reason and timesheet example for each question

Numbers refer to §1–§6. "Today" = what the timesheet records now; "Proposed" = after the fix. Shift in all examples: 09:00–17:30 general shift, Sunday weekly off.

**#1 Sunday / holiday inside a leave**
Ravi applies CL for Sat 10 Oct → Mon 12 Oct.
Today: 10, 11, 12 Oct all recorded `Leave`; **3 CL** debited; the Sunday row that finalize would have marked `WeeklyOff` is now a leave day.
Proposed: 10 and 12 Oct `Leave`, 11 Oct stays `WeeklyOff`; **2 CL** debited. With sandwich rule on for CL: 3 CL.
Reason: Sunday is not a working day, so debiting it charges the employee for a day they were never expected to work. The sandwich rule is a policy choice, so it must be a switch, not a default.

**#2 Half-day leave**
Priya takes a half-day SL on 14 Oct afternoon. Device: 09:00 – 13:10.
Today: 14 Oct recorded `Leave`, **1 SL** debited, her 4 h 10 m of work disappear from the month's hours.
Proposed: 14 Oct `HalfDay (SL)`, in 09:00 out 13:10, **0.5 SL** debited; summary shows 0.5 present + 0.5 leave.
Reason: the balance and the summary must match what happened. The thresholds decide the other direction too: if she had punched 09:00 – 16:00 (7 h) on a half-day leave, is that a full day worked? That needs the company's full-day and half-day hour values.

**#3 Leave approved over a worked day**
Arun's EL for 20–22 Oct is approved on 23 Oct (applied late). Device shows 21 Oct 09:02 – 18:10.
Today: 21 Oct flips to `Leave` but still carries in 09:02, out 18:10, 549 minutes and 40 min OT underneath; **1 EL** debited for a day he worked.
Proposed: HR sees "21 Oct: punched 09:02 – 18:10" and approval stops. HR approves 20 and 22 only, or overrides with a reason and the row becomes a clean `Leave`.
Reason: a leave day and a worked day cannot both be true; a person must choose, and the record must not contradict itself.

**#4 Punch on an already-approved leave day**
Meena has approved CL on 16 Oct. She comes in for an urgent job: 09:05 – 17:50.
Today: the punch is dropped by the sync (counted as "kept as corrected"), 16 Oct stays `Leave`, **1 CL** burnt, and nobody is told she worked.
Proposed: 16 Oct stays `Leave` but shows a conflict; HR queue → "Employee worked, cancel this leave day": CL +1, row becomes `Present` 09:05 – 17:50. Or "Ignore punch" if she only came to collect something.
Reason: the approved decision should not be overturned by a device automatically, but the fact that she worked must reach a person, otherwise she loses both the day's pay logic and the leave.

**#5 Submission checks (reserve pending, block overlap, server computes days)**
Kumar has 3 CL. He applies 3 CL for 5–7 Nov (pending), then 2 CL for 12–13 Nov.
Today: both accepted, because only the stored closing balance (3) is checked; the second fails at approval or drives the balance negative. He can also file on-duty for 6 Nov while the leave is pending.
Proposed: the second application is refused: "0 CL available (3 reserved by pending request #…)". On-duty for 6 Nov refused as overlapping. Day count computed on the server from the dates (working days only).
Reason: the browser currently sends the day count and the balance check ignores what is already claimed, so the ledger can be overdrawn before anyone approves anything.

**#6 Leave Master limits**
Example if the client sets: EL notice 7 days, CL back-date max 3 days, no EL during 6-month probation.
Today: all of these fields exist on Leave Master and none is enforced; an employee applies EL on 3 Nov for 5 Nov and it goes through.
Proposed: refused at submission with the rule that failed. Empty field = no limit.
Reason: the master promises rules that the system silently ignores. We need the real values per leave type before enforcing.

**#7 Employee OT requests**
Suresh's device day: 09:00 – 18:00, so 30 min calculated OT (already queued for approval). He raises an OT request for 120 min.
Today: approval **adds** → 150 min approved OT, no daily cap, and the same would succeed on a day with no punches at all.
Proposed: approval **replaces** the day's OT with 120, capped at the plan's daily max (180), refused if the day has no punch pair; shown as a second tab on the OT Approval page.
Reason: "adds" double-counts the same hours; a request with no punches is unverifiable.

**#8 OT cash or comp-off, never both**
Sunday 19 Oct, 8 h worked. HR approves OT as **cash**.
Today: the employee can still raise a comp-off request for 19 Oct and get a paid day off as well.
Proposed: comp-off request refused: "OT for 19 Oct was settled as cash". Settling as cash is likewise refused once a comp-off credit exists.
Reason: the BRD says Sunday work is OT **or** comp-off, chosen at approval; paying both is a double benefit.

**#9 Comp-off policy**
Policy example: minimum 4 h to earn, valid 3 months.
Today: 2 h 30 m on a Sunday still earns a full comp-off; expiry never runs unless someone presses the button; the credit is dated on the requested day, not the day worked.
Proposed: 2 h 30 m → not eligible. Earned 19 Oct → expires 19 Jan; on 1 Feb the scheduler expires it.
Reason: the policy master exists but nothing reads it, so the balance drifts from the rule.

**#10 Unaccounted days block payroll**
October: device rows on 20 dates, 4 Sundays, 6 dates with **no row** (device offline for 3 days, month not yet finalized).
Today: payable days = 31 − 0 absent − 0 LOP = **31**, full salary, because a missing row counts as neither.
Proposed: summary shows "6 unaccounted days"; Time Office Final lists them; payroll pre-validation errors until finalize back-fills or HR corrects them.
Reason: silence must not mean "paid". Every date needs an explicit status before money moves.

**#11 Attendance thresholds**
Punch 09:00 – 15:30 = 6 h 30 m.
Today: hard-coded 7 h rule → `HalfDay`, regardless of company policy.
Proposed: if the company's Attendance Policy says full day ≥ 6 h → `Present`; if it says 7 h → `HalfDay`. Auto-absent if no punch at all.
Reason: the Attendance Policy master already has these fields; the code ignores them. We need the numbers.

**#12 Payroll reads a snapshot**
October payroll approved on 5 Nov with 10 h OT for Suresh. On 8 Nov a future defect (or a deliberate reopen) changes a day's OT to 14 h.
Today: payroll reads the live day rows, so a recalculation would silently pay 14 h. The new lock blocks known writers, but nothing proves the paid figures match what Time Office Final showed.
Proposed: Ready for Payroll stores per-employee figures (paid days, LOP, OT by day type, LOM, night days, permission excess). Payroll reads only that; a reopen produces a difference report instead of a silent change.
Reason: what was paid must be provable from one frozen record.

**#13 WFH day**
Approved WFH on 22 Oct.
Today: 22 Oct `Present`, **0 minutes**; monthly hours and any hours-based report show him as having worked nothing that day.
Proposed: 22 Oct `Present (WFH)`, 510 minutes (the shift's standard), no late / early-out / OT.
Reason: a worked day with zero hours is wrong in every report that sums hours.

**#14 Permission over the free hours**
Free allowance 2 h/month. Used 1 h 30 m; requests 1 h on 25 Oct.
Today: refused at submission ("only 0.5 h left").
Proposed: allowed and approved; excess 30 min → LOP of 30/480 = 0.0625 day on the summary.
Reason: the client's answer was "exceeding the allowance results in LOP only, no other penalty". Refusing at submit contradicts it and hides the absence.

**#15 Approval chains and escalation**
BRD OT chain: Reporting Manager → HOD → HR. Code today: Reporting Manager → HR, hard-coded; the chain master only works for shift change.
Today: adding the HOD stage is a code change; a request waits with an absent manager forever.
Proposed: leave, mispunch, OT and permission read the chain master (default chain = today's RM → HR). Pending with the same approver for N days → moves to the next stage and both are notified. N is a company setting.
Reason: the client's chains differ per module and will change; escalation stops requests dying in a queue before month-end.

**#16 Two sources (app + device)**
Suresh: app tap-in 09:00 at the plant gate (GPS), device 09:05; app tap-out 17:55, device 18:30.
Today: only the device is read → 09:05 – 18:30. If the device was down: no row at all → Mispunch/absent.
Proposed: 09:00 – 18:30 (earliest in, latest out), in = app, out = device, GPS stored for the app punch. Device down → 09:00 – 17:55 from the app alone, stamped "app only".
Reason: whichever source saw the person first / last is the truth; taking the first check-out (17:55) would drop 35 minutes of overtime.

---

## 9. Decisions received (Suresh, handwritten, 2026-09-25)

| # | Decision | Notes / still to confirm |
|---|----------|--------------------------|
| 1 | Paid leave (CL, SL, any paid type): Sunday inside the leave is **not** leave, not debited. **LOP sandwich only**: when the Saturday (and Monday) are LOP, the Sunday between them is LOP too. | Sandwich applies to LOP days only, never to paid leave. |
| 2 | Half-day leave, when applied as half-day, is treated as leave for that half (0.5 debit). | Thresholds per #11. |
| 3 | **Validate at application**: if the day already has a punch-in recorded, leave cannot be applied for it. If no punch that day, leave can be applied (including back-dated). | Stronger than "refuse at approval": refused at submission. Approval keeps the same check for punches that arrived after submission. |
| 4 | Do not auto-calculate; **validate** — HR decides. | Same as #5 below. |
| 5 | Punch on an approved leave day → notify HR in one module; HR chooses **approve as present** (leave reversed / restored) or **not approve** (stays leave). Balance is deducted **at approval**, not at application (a pending request does not reserve balance). | Leave restored to balance when HR approves the day as present. |
| 6 | **Hold.** Leave Master limits not enforced yet. | Revisit with client values. |
| 7 | Only **approved** OT is paid, and **actual punch-out decides**: if worked less than the approved minutes, pay the worked minutes; approved OT is a ceiling, never a floor. | Applies to both device OT and employee OT requests. |
| 8 | OT cash or comp-off — **never both; refuse**. | |
| 9 | Comp-off earned **according to punch-in / punch-out, using the half-day policy**: half-day hours → 0.5 comp-off, full-day hours → 1 comp-off, below half-day → none. | Needs the hour values from #11. |
| 10 | **Yes** — unaccounted days block payroll. | |
| 11 | Below the full-day hours, **only 4 h (half day) is counted and the rest vanishes**: e.g. 6 h 30 m worked → half day. | Read as: half-day = 4 h, full day = shift hours; anything between counts as half day. Please confirm the full-day figure (8 h? shift length?). |
| 12 | "Only the latest report is correct." | Read as: payroll uses the **latest** attendance figures, no separate snapshot; the lock keeps them from changing. **Please confirm** — the alternative reading is "the latest snapshot is the one payroll uses". |
| 13 | WFH day: **calculate from the app punch times**, not a fixed shift credit. | WFH with no app punch → treat as mispunch for review. |
| 14 | Permission excess → **loss of pay**. Figure written: 0.625. | 30 min excess on an 8 h day = 30/480 = **0.0625** day; 0.625 would be 5 h. Assuming 0.0625 unless you meant a different basis. |
| 15 | Chain stays **RM → HR** (no HOD stage). | Escalation days not answered — assume none for now. |
| 16 | App 09:00 / device 09:05, app 17:55 / device 18:30 → **09:00 – 18:30**. Agreed. | Earliest in, latest out. |

**Confirmed in planning (2026-09-25 afternoon):** half-day leave + punches is normal (merge, no conflict; refuse only a full Present day). LOP is a Leave Master type with `isPaid = false`; the sandwich rule applies to that type only.

**Built (2026-09-25, leave core):** #1, #2, #3, #4, #5, #8 (via D10), #10 of §1 plus item 29 (A7). Sheet items 6, 7, 9–28, 30–32 remain open. See `TIME_OFFICE_FLOW_AUDIT_2026-09-25.md` §3 "Leave core".
