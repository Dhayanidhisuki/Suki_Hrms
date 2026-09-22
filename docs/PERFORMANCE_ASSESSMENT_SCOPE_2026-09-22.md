# Performance Assessment — scope before build

**Status: not started. This document exists so it is not started against
assumptions.**

Goal setting shipped on 21 Sep: KRA master, KPI master, goal templates,
performance cycles, assignment, employee accept/return. This covers the other
half of the BRD — §18-§24 and §31-§40 — which is a workflow, not a feature
list, and carries the same class of decision that F&F's approval chain did.

Every open question below is one where guessing produces a working-looking
flow with the wrong shape baked in, and unwinding that later is far more
expensive than answering now.

---

## What already constrains the design

These are settled, not open:

| Fact | Consequence |
|---|---|
| `EmployeeGoalKpi` is the row an assessment attaches to | Actuals/ratings hang off it; no new goal model needed |
| Goal content is **snapshotted** at assignment | Assessment scores against the snapshot, never against live KPI master |
| Model A weightage (KRA 100%, KPI 100% within KRA) is enforced | Scoring maths can rely on it |
| `measurement.ts` already defines the three strategies + `achievementPct()` + §23 capping | Formulas exist and are unit-tested; nothing calls them yet. Wiring is the task, not deriving them |
| F&F's `approvalStages` config is an established precedent | Reuse the shape rather than inventing a second one |

---

## Open questions — these block the build

### Q1. Approval chain, and is the reviewer optional?

BRD §20 opens *"For organizations having two-level appraisal"*, and §6 says
stages may be optional by configuration. So reviewer is conditional — but the
allowed combinations must be named, exactly as F&F names
`HR | HR_FINANCE | MANAGER_HR_FINANCE`.

Candidate shapes:

- `SELF_MANAGER` — employee self-assesses, manager rates, done
- `SELF_MANAGER_HR` — HR finalises
- `SELF_MANAGER_REVIEWER_HR` — full §20 two-level chain

**Needed:** which of these KUN runs, and whether it is per-company (like F&F)
or per-cycle. Per-cycle is more flexible and costs little now; retrofitting it
later means migrating live assessments.

### Q2. What does "send back" do at each stage?

§19 gives the manager a "Send back" action and §27 lists a `Returned` status,
but not what it returns *to* or what becomes editable.

For each of manager→employee, reviewer→manager, HR→manager, decide:

- which status it lands in
- what the recipient may now edit (their own entries only, or everything)
- whether the returned party must re-submit through the whole chain, or
  resumes at the stage that sent it back

Goal assignment already hit exactly this: a `RETURNED` set was a dead end
until re-issue was added. The same trap exists here at three stages instead
of one.

### Q3. Is self-assessment mandatory?

If an employee never submits, can the manager proceed? §18 implies the
employee submits first. Needs an explicit answer, plus a deadline/skip rule,
or cycles will stall on non-responders with no defined escape.

### Q4. Rating scale configuration

§21 is explicit: *"Don't hard-code this. The rating scale should be
configurable."* §12 gives a 5-band example (Outstanding A+ 4.50-5.00 … D
<2.00).

**Needed:** a `RatingScale` master (band, min, max, label, grade), and
confirmation of whether KUN uses the 5-point scale, and whether score→rating
is a separate concept from the raw score (§24 says keep them separate).

### Q5. §36 KPI revision — versioning, not overwrite

The BRD is unambiguous: a mid-cycle target change must retain the previous
version, with Original Target, Revised Target, Revision Date, Reason, Changed
By, **Approved By**.

"Approved By" implies revision is itself an approval flow, not a plain edit.

**Needed:** who may request a revision, who approves it, and whether it is
allowed after self-assessment has started. This is the item most likely to be
implemented as a silent overwrite if nobody specifies it — the schema makes
overwriting easy and versioning deliberate.

### Q6. Achievement capping

§23 recommends 0-120% but insists it be configurable. `DEFAULT_CAPS` in
`measurement.ts` already encodes 0/120 and every strategy accepts caps as a
parameter. **Needed:** confirmation of KUN's cap, and whether it is per
company, per cycle, or per KPI.

---

## Rough shape once answered

Not a commitment; here so the size is visible.

- **Schema:** assessment columns on `EmployeeGoalKpi` (actual, self rating,
  manager rating, reviewer rating, per-stage comments), `RatingScale` master,
  `KpiRevision` history table, assessment-stage dates on `EmployeeGoalSet`.
- **Workflow:** extend the existing status machine with the §27 states, in the
  same style as `src/lib/fnf/workflow.ts`.
- **Scoring:** wire `achievementPct()` into a scoring service; derive weighted
  KRA and overall score; map score to rating via the configured scale.
- **Surfaces:** self-assessment, manager assessment, reviewer assessment, HR
  finalisation, plus the §13 employee performance page.
- **Then:** §30 notifications, §31-33 dashboards, §40 reports — each sized
  separately, none blocking the core.

---

## Explicitly out of this scope

§34 mid-year review, §35 periodic progress tracking, §37-39 transfer /
new-joiner / exit eligibility. All real BRD items, none blocking assessment,
all cheaper once the core exists.

---

## Recommended sequence

1. Answer Q1-Q6 (a short session with whoever owns the appraisal process).
2. Build schema + workflow + scoring against those answers.
3. Surfaces.
4. Notifications, dashboards, reports.

Items 1-3 of the module gap list (compliance document types, per-document
reminders, payroll-document indexing) are independent of all of this and can
proceed in parallel.
