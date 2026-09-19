# Mis-Punch Correction — Required Data

**Status:** current behaviour as built. Items marked **[CLIENT]** are open BRD
decisions, not implemented rules.

The biometric device reports one `{ date, firstIn, lastOut }` rollup per
calendar day. Anything that does not fit that shape — a missed punch, a shift
crossing midnight, a double shift — needs either automatic pairing or a
mis-punch correction. This is the boundary between the two, and what a
correction must carry.

---

## 1. What the sync resolves by itself

`carryOvernightPunches` (src/lib/biometricSync.ts) closes a night shift with
the following morning's punch, so no correction is needed. It fires **only**
when all five hold:

| # | Condition | Why |
|---|---|---|
| 1 | Earlier day has an in-punch and no distinct out-punch | Nothing to close otherwise |
| 2 | That day's roster shift is genuinely overnight (`end < start`) | A morning shift running into the night is a *double shift*, not an overnight one |
| 3 | The next day is the immediately following calendar date | A gap means an unrelated day |
| 4 | The next day holds exactly one punch | If it has a pair it is a working day in its own right; consuming its first punch would destroy that record |
| 5 | The punch is no later than shift end + **120 min** | Beyond that, the pairing is a guess |

That 120-minute window governs **automatic pairing only** — never pay. Erring
small costs an employee one request; erring large would invent a punch pair,
and with it working minutes and overtime.

## 2. What always needs a correction

| Case | Recorded as | Why not automatic |
|---|---|---|
| Forgot to punch out (day shift) | `MissingPunch`, **0 min** | No second punch exists anywhere |
| Forgot to punch in | `MissingPunch`, 0 min | Same |
| **Morning → night (double shift)** | Two `MissingPunch` days, 0 min each | Condition 2 fails. A ~20 h day must be seen by a person |
| **Night → morning (double shift)** | Two `MissingPunch` days, 0 min each | Condition 5 fails — the punch is hours past the shift end |
| Exit punch on a day that has its own pair | `MissingPunch` | Condition 4 fails |
| Wrong punch (device misread) | Present, wrong minutes | Nothing signals it is wrong |

**Neither day is auto-LOP'd.** Month-end finalize converts `MissingPunch` to
LOP only when there is no in-punch *and* no out-punch. A day with a lone
in-punch survives finalize carrying **zero** worked minutes — it is not lost
pay, but it is not credited either until corrected.

## 3. Required fields

Enforced by `mispunchRequestSchema` (src/lib/validations/workforce.ts) and
covered by `tests/unit/request-validation.test.ts`.

| Field | Required | Rule |
|---|---|---|
| `date` | **Yes** | The shift's **in-punch date**. Not in the future |
| `requestedInTime` | One of the two | Wall clock `YYYY-MM-DDTHH:mm` |
| `requestedOutTime` | One of the two | Same. Must be **after** the in time |
| `reason` | **Yes** | 1–500 chars |

Also enforced:

- **At least one** of in/out must be supplied — a correction that changes
  nothing is rejected.
- **Out after in**, compared as full datetimes. A night shift passes because
  its out carries the *next* date.
- **One open request per employee per date.** A second returns `409` naming
  the first. Without this, two approvals would write the same day twice and
  the later would silently overwrite the earlier.

## 4. Filing a cross-midnight correction

The shift is recorded under its **in-punch date** (BRD night-shift
convention), with the out time on the following date.

**Night shift, 01-Sep 22:00 → 02-Sep 06:00**
- Date: `2026-09-01`
- In `22:00`, Out `06:00`, **tick "Out time is on the next day"**
- Stored as in `2026-09-01T22:00`, out `2026-09-02T06:00` — 8 h

Without the toggle the out composes onto 01-Sep, landing *before* the in, and
the out-after-in rule rejects it.

**Double shift, 01-Sep 09:42 → 02-Sep 06:00**
- File against `2026-09-01` with the toggle ticked → one day of ~20 h 18 m.
- The second day usually also needs clearing: the device read the exit punch
  as 02-Sep's *first in*, leaving a phantom in-punch there.

## 5. What a double shift is worth today

With the active `OT-1.5X` plan — ×1.5, qualifies after 30 min, **3 h daily
cap**:

```
worked 1218 min (20 h 18 m)
excess 1218 − 480 = 738 min (12 h 18 m)
OT     min(738, 180) = 180 min  → 3 h
```

**≈ 9 h 18 m is discarded silently.** Nothing warns anyone. `maxOtHoursPerWeek`
and `maxOtHoursPerMonth` are both null, so no periodic ceiling applies either.

## 6. Open — needs the client **[CLIENT]**

1. **Is a 20 h day recordable at all?** KUN files Factories Act returns
   (Forms 25/15/25B/25C/21/22) from this data, and daily spread-over is
   statutorily limited. Verify the limits with whoever owns compliance —
   there is **no statutory hour guard anywhere in the code**, only the OT
   *pay* cap, which is a different thing.
2. **Is a second shift overtime, or its own shift?** If shift-based, it
   cannot route through the OT plan at all — that is a modelling change.
3. **Daily / weekly / monthly OT caps** — only the daily one (3 h) is set.
   Listed as "Based on Company" in the BRD; no figure supplied.
4. **Should the discarded excess be surfaced** to the approver as a warning,
   or is silent capping intended?

Until 1 and 2 are answered, the sync deliberately refuses to pair a double
shift — recording zero hours that a human must correct is safer than inventing
a 20 h day nobody reviewed.
