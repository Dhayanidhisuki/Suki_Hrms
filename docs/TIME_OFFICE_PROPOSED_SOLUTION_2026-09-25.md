# Time Office — proposed solution: two attendance sources, and leave vs punch

**Date:** 2026-09-25
**Status:** proposal for client review. Nothing in this document is built yet unless marked *(live)*.
**Companion documents:** `TIME_OFFICE_FLOW_AUDIT_2026-09-25.md` (what is wrong today), `TIME_OFFICE_ANALYSIS_2026-08-25.md` (BRD rules A1–A28, L1–L9).

---

## Part 1 — Two attendance sources: biometric device (in office) and Suki app

### 1.1 The rule

Every employee-day is built from **both** sources together, not one or the other.

| Field | Rule |
|-------|------|
| **Check-in** | The **earliest** check-in recorded by either source that day. |
| **Check-out** | The **latest** check-out recorded by either source that day. |
| **Failover** | If one source has nothing for that employee-day, the other source's timing is used as-is. No configuration needed: an empty side simply never wins. |

This is the "first-in / last-out across both sources" rule the client confirmed on 2026-09-23.

**Why the check-out is the latest, not the first.** An employee taps out on the app at 17:00 from the shop floor, walks to the gate and punches the device at 18:30. The first check-out would record a 17:00 exit and lose 90 minutes of worked time (and any overtime in it). The latest check-out is the true end of the day. Symmetrically, the earliest check-in is the true start.

### 1.2 Worked examples

| Biometric | Suki app | Result | Source recorded |
|-----------|----------|--------|-----------------|
| 09:05 – 18:10 | 09:00 – 17:55 | **09:00 – 18:10** | in = app, out = biometric |
| 09:05 – 18:10 | none | 09:05 – 18:10 | biometric (failover) |
| none | 09:00 – 17:55 | 09:00 – 17:55 | app (failover) |
| 09:05 – (no out) | (no in) – 17:55 | **09:05 – 17:55** | in = biometric, out = app |
| 09:05 – (no out) | none | 09:05 – (none) → **Mispunch** | biometric |
| 22:00 – (no out) on 1 Sep | 06:05 on 2 Sep (check-out) | 1 Sep 22:00 – 2 Sep 06:05 (night shift) | biometric + app |

### 1.3 Edge rules

1. **Night shift.** The day is the **check-in date** (BRD night-shift convention). A punch on the next morning within 120 minutes of the rostered shift end closes the previous night, whichever source it came from *(live for biometric; extend to app)*.
2. **Out before in.** If the merged check-out is earlier than the merged check-in on the same date (clock skew, wrong tap), the day is treated as a single punch → **Mispunch**, so a person reviews it. It is never silently swapped.
3. **Repeated taps.** Several check-ins from the same source in one day: earliest wins. Several check-outs: latest wins. Nothing else is stored, so a mid-day tap never shortens the day.
4. **Human-decided days are never overwritten** *(live since 2026-09-25)*: a day corrected by HR, approved as a mispunch, or set to Leave / On-Duty / WFH is skipped by both syncs and counted as "kept as corrected by HR". See Part 2 for the leave case.
5. **Locked months are never written** *(live)*: FROZEN, READY_FOR_PAYROLL, or payroll processed.
6. **Re-sync is safe** *(live)*: bringing the same merged times again changes nothing and does not re-open an approved OT or LOM decision.
7. **App-only day.** A day where only the app has punches is a **Present** day by the failover rule, but is stamped `source = app` so reports can list "app-only" days. Whether such days need a manager's confirmation is a client decision (§1.7 Q3).
8. **GPS.** App punches carry latitude / longitude. They are **stored** on the day (in and out separately) and shown in the tooltip. No geofence is enforced in this phase (§1.7 Q4).

### 1.4 What each punch becomes

```
Biometric device  ─┐
 (HTTP controller)  ├─►  mergeAttendanceSource(employee, date, {in, out, source, gps})
Suki app           ─┘        │  earliest in / latest out across existing row + incoming
 (ESSL_ATTENDANCE_LOG)       │  re-derive status, minutes, late, early-out, OT from the MERGED pair
                             │  skip if locked month or human-decided day
                             ▼
                       DailyAttendance (one row per employee-day)
                         inTime, outTime, inSource, outSource, source,
                         inLat/inLon, outLat/outLon, status, workingMinutes, …
                             ▼
                       MonthlyAttendanceSummary → Time Office Final → Payroll
```

One helper does the merge for both sources, so the rule lives in exactly one place. The biometric sync already exists; the app sync mirrors it and reads the legacy `dbo.ESSL_ATTENDANCE_LOG` table (`EMP_CD` = employee code, `IN_TIME` / `OUT_TIME` in the same HH.MM encoding the biometric import already parses, GPS columns).

### 1.5 Data changes (additive only, delta SQL — never `prisma db push`)

`DailyAttendance` gains:

| Column | Purpose |
|--------|---------|
| `inSource`, `outSource` (`biometric` / `app`) | which source won each side — shown on the daily grid and used by reports |
| `inLatitude`, `inLongitude`, `outLatitude`, `outLongitude` | app GPS, stored only when the app punch won that side |

`source` keeps its existing values and adds `app` and `biometric+app`.

### 1.6 Screens

- **Daily attendance / muster grid:** In and Out each show a small source mark (device icon / phone icon); tooltip shows both raw punches and GPS for app punches.
- **Biometric page:** a second "Sync Suki app" button and run history, same shape as the device sync (fetched / created / updated / unchanged / locked-skipped / kept-as-corrected / unmatched IDs).
- **Reports:** attendance statement gains an "app-only days" column and a per-punch source filter.

### 1.7 Decisions needed from the client before build

| # | Question | Recommendation |
|---|----------|----------------|
| Q1 | App sync frequency? Biometric is every 8 h. | Every **1 hour** for the app (it is the more real-time source), biometric unchanged. |
| Q2 | Is the biometric HTTP controller reading the same `ESSL_ATTENDANCE_LOG` table, or a separate device store? | If the same table, one sync reads both `ATTENDANCE_TYPE` values in one pass. Need the real distinct values of `ATTENDANCE_TYPE`. |
| Q3 | Does an **app-only** day count as Present with no further approval? | Yes for now, flagged as app-only in reports; revisit once GPS geofence exists. |
| Q4 | Geofence on app punches (must be within N metres of a site)? | Not in this phase. Store GPS now; add "outside site" flag + HR review later. |
| Q5 | Connection details for the ESSL SQL Server (host, port, database, login). | Required to start. |

---

## Part 2 — Leave vs punch: what happens when both exist for the same day

### 2.1 Today *(live)*

- Leave approved first, punch later → day stays Leave, punch is silently dropped (counted only in the sync result). Nobody is told.
- Punch first, leave approved later → day flips to Leave with no warning, and the old in/out, minutes and OT are left underneath the Leave status (inconsistent row).
- Half-day leave stamps the whole day as Leave and debits a full day.
- Leave over a Sunday / holiday writes Leave on that day too and debits the balance.
- Leave cancel turns the days into **LOP** instead of putting back what was there.

### 2.2 Proposed rules

**Rule L1 — a punch on an approved leave day is a conflict, not noise.**
The day stays **Leave** (the approved decision stands), but the row is flagged `leaveConflict` with the merged punch times attached, and it appears in a new **Leave conflicts** queue for HR. HR chooses one of:

| Action | Effect |
|--------|--------|
| **Employee worked — cancel this leave day** | That single day is removed from the leave (balance restored for 1 day or 0.5 day), the punches are applied, the day becomes Present / HalfDay per the normal derivation, and the summary is refreshed. The rest of a multi-day leave is untouched. |
| **Ignore the punch** | Day stays Leave, flag cleared, punch kept in history for audit. |

Nothing is auto-decided. A single stray tap (came in to collect a document) must not eat a leave decision without a person looking.

**Rule L2 — leave cannot be approved over a worked day without HR seeing it.**
When HR approves a leave and any date in the range already has a punch pair, approval is refused with the exact day and times ("12 Sep: punched 09:02 – 18:10"). HR may re-submit with **override = yes** and a reason; then the day is written as a clean Leave row (in/out, minutes, OT cleared, previous values in history). The reporting-manager stage is unaffected.

**Rule L3 — half-day leave is half a day.**
A half-day leave writes the day as `HalfDay` with the leave type noted, debits **0.5** from the balance, and counts 0.5 leave day and 0.5 working day in the summary. If the employee's punches on that day show a full shift (≥ the company's full-day hours threshold), Rule L1 applies and HR is asked whether to cancel the half-day.

**Rule L4 — weekly offs and holidays inside a leave are not leave.**
Leave days are written only on working days; Sundays and declared holidays in the range keep their WeeklyOff / Holiday status and are not debited. A **sandwich rule** (count the Sunday when leave is taken on both Saturday and Monday) is a per-leave-type setting on the Leave Master, default off, because the client has not given one.

**Rule L5 — cancelling a leave puts the day back, never LOP.**
Each day is restored from the history snapshot taken at approval (Present with its punches, Absent, WeeklyOff, …). Only if there was no row before approval and no punch exists does the day become Absent (and LOP at month-end, as today).

**Rule L6 — on-duty / WFH days plus punches are fine.** Both are worked days; a punch on an approved On-Duty day simply adds the times to the row. No conflict.

### 2.3 Flow

```
Punch arrives (either source) for employee-day
  ├─ day is Leave  ──►  keep Leave, set leaveConflict, queue for HR   (L1)
  ├─ day is OnDuty/WFH ──►  merge times into the row                  (L6)
  ├─ day is HR-corrected / mispunch-approved ──►  skip (kept as corrected)
  └─ otherwise ──►  normal merge (Part 1)

Leave approval (HR stage) for a date range
  ├─ any working day already has a punch pair and no override ──►  refuse with details (L2)
  ├─ Sunday / holiday in range ──►  skip that day, no debit           (L4)
  ├─ half-day ──►  HalfDay + 0.5 debit                                 (L3)
  └─ otherwise ──►  write Leave, debit balance, refresh summary

Leave cancel ──►  restore each day from history; refund balance (and comp-off ledger for comp-off leave)  (L5)
```

### 2.4 Data changes (additive)

| Table | Column | Purpose |
|-------|--------|---------|
| `DailyAttendance` | `leaveConflict` (bool), `conflictInTime`, `conflictOutTime`, `conflictSource` | the dropped punch, for the HR queue |
| `DailyAttendance` | `leaveApplicationId` | which application wrote this Leave day — makes per-day cancel and restore exact instead of the current "any row still marked Leave" guess |
| `LeaveMaster` | `sandwichRule` (bool, default false) | Rule L4 |
| `LeaveApplication` | `overrideWorkedDays` (bool), `overrideReason` | Rule L2 |

### 2.5 Screens

- **Approvals › Leave conflicts** (new, HR): employee, date, leave type, punch times and source, two buttons.
- **Approvals › Leave** (existing): the refusal message for Rule L2 and an "Approve anyway (reason)" control.
- **ESS › Leave**: half-day shows 0.5 in the balance preview; a conflict on one's own leave day shows "worked on leave day — under HR review".

### 2.6 Decisions needed from the client

| # | Question | Recommendation |
|---|----------|----------------|
| Q6 | Punch on an approved leave day: always HR decides, or auto-cancel the leave when a full shift was worked? | **Always HR decides** (Rule L1). Auto-cancel only if the client insists, and then only for full-shift days. |
| Q7 | Sandwich rule: yes / no, and for which leave types? | Off by default, per leave type. |
| Q8 | Full-day and half-day hour thresholds (needed for L3 and for the existing hard-coded 7 h half-day rule). | Company setting on Attendance Policy; no default guessed. |
| Q9 | May HR override Rule L2 (approve leave over a worked day)? | Yes, with a mandatory reason, logged. |

---

## Part 3 — Build order once the decisions are in

1. Leave rules L3, L4, L5 (no client input needed beyond Q7/Q8 defaults) and `leaveApplicationId` on the day row.
2. Leave conflict flag, HR queue, Rule L1 and L2.
3. App sync + merge helper + source / GPS columns (needs Q2 and Q5).
4. Screens in §1.6 and §2.5.

Each step ships with integration tests in the style of `tests/integration/time-office-flow.test.ts`.
