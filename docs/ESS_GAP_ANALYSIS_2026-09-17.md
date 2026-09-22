# ESS (Employee Self Service) — BRD vs Build, Gap Analysis

**Date:** 2026-09-17
**Scope:** Employee Self Service portal only (`/ess/**`, `/api/workforce/my-*`).

---

## Part A — Where the ESS requirement is actually written

There is **no standalone ESS BRD document**. The requirement is spread across four
sources; together these are the ESS BRD.

| # | Source | What it says |
|---|---|---|
| 1 | `hr brd/SUKI - ERP_KUN_AEROSPACES_SCOPE.docx` — signed scope | "Employee Self-care portal (Internal access)" as a line item of the HRMS suite |
| 2 | Same doc, MoM 23/June/2025 | "Enable announcement notifications on the employee portal (e.g., policy updates, internal circulars)"; "Conduct regular employee feedback and satisfaction surveys"; "Make exit feedback and surveys mandatory as part of the exit formalities" |
| 3 | Same doc, MoM 17/July/2025 | "Employee Self-Service Portal — Notifications via the employee self-service portal must be configured and maintained" |
| 4 | `docs/BRD_STATUS_AUDIT_2026-08-22.md:244` | ESS = "Employee dashboard/profile updates, attendance, leave/permission/mis-punch requests, document/payslip download, visitor requests/approval" |
| 5 | `docs/BUILD_ESTIMATE_2026-08-25.md:91` | Same list + **"Must work well on mobile, which is where most of the effort goes."** 10 days estimated. |
| 6 | `docs/DECISIONS_NEEDED_2026-09-11.md:45,148` | Loan self-service (apply/status/schedule/outstanding); gratuity estimation self-service — still an open decision |

---

## Part B — What is built

20 ESS pages, all reachable from the sidebar (`src/components/layout/navigation.ts:512-576`),
all backed by real endpoints.

| BRD item (source 4/5) | Status | Page |
|---|---|---|
| Employee dashboard | Built | `/ess/dashboard` |
| Profile update | **Partial** — see G6 | `/ess/profile` |
| Attendance view | Built | `/ess/attendance` |
| Leave request | Built | `/ess/leave` |
| Permission request | Built | `/ess/permission` |
| Mis-punch request | Built | `/ess/mis-punch` |
| Document download | Built | `/ess/documents` |
| Payslip download | Built | `/ess/payslip` |
| Visitor pass request | Built | `/ess/visitor-request` |
| Visitor pass approval | Built | `/ess/visitor-approval` |
| Loan self-service (source 6) | Built | `/ess/loans` |
| Mobile (source 5) | **Not met** — see G2 | — |

Beyond the BRD line, also built: On-Duty, WFH, Shift Change, Comp-Off,
Leave Encashment, Holiday Calendar, OT Slip, Income Tax / TDS proofs, Benefits.

**Access model is correct.** The Employee role (`roleId 74`) holds *zero*
RolePermission rows, and every `my-*` endpoint still answers 200 for it. The
self-service routes resolve the employee from the session
(`resolveOwnEmployeeId`) and only apply `checkSpecificPermission` on the HR/manager
scope of the same route. So ESS works without granting employees any HR
permission — verified against a live Employee login.

---

## Part C — Gaps

### G1. Announcements / circulars — ✅ BUILT 2026-09-17 (was: not built)
MoM 23/June/2025 requires announcement notifications on the employee portal for
policy updates and internal circulars.

- No `Announcement`, `Notice` or `Circular` model in `prisma/schema.prisma`.
- `src/components/dashboard/NoticeBoard.tsx` exists but fetches `/api/notices`,
  which **does not exist** (404). It also renders on the *HR* landing page, not ESS.
- Nothing announcement-shaped anywhere under `/ess/**`.

**Closed.** `Announcement` + `AnnouncementRead` models (migration
`000066_announcements`), HR authoring at `/admin/announcements`, employee view at
`/ess/announcements`, read receipts, and an `ANNOUNCEMENT_PUBLISHED` in-app
notification on publish. `NoticeBoard.tsx` and its dead `/api/notices` fetch are
untouched and still dead — that HR-dashboard component is now redundant and
should be either pointed at this API or removed.

### G2. Mobile — NOT MET (BRD calls this the bulk of the effort)
Source 5 says ESS "must work well on mobile, which is where most of the effort goes."
Measured at 375x812 (iPhone width):

| Page | Measurement |
|---|---|
| `/ess/attendance` | Content is **685px wide inside a 375px column**. Export buttons (CSV/Excel/PDF) and the month picker run off-screen; the KPI strip is forced to `grid-cols-6` so values wrap to "0h / 00m"; the table is clipped mid-column. |
| `/ess/dashboard` | Better — cards stack, sidebar collapses to a hamburger — but the Attendance Flag Summary filter row still overflows (341 -> 394px). |

The page body itself does not scroll horizontally, so the overflow is hidden
inside scroll containers: on a phone the user must swipe sideways inside the card
to find controls. This is the single largest ESS gap by estimated effort.

**Effort:** responsive pass across all 20 pages — card layout for tables below
`md`, wrapping toolbars, dropping the fixed column grids. ~4-5 days.

### G3. ESS request notifications — ENGINE BUILT, ESS JOURNEYS NOT WIRED
MoM 17/July/2025 requires ESS portal notifications to be configured and maintained.

The engine is real and live: 61 `NotificationEvent`, 106 `NotificationTemplate`,
2,724 `NotificationDelivery`, 1,924 `NotificationInApp` rows, and the topbar bell
(`NotificationDropdown.tsx`) reads `/api/platform/notification/inbox` correctly.

But the registered events cover only four modules:

| Module | Events |
|---|---|
| CORE | EMPLOYEE_CREATED, EMPLOYEE_JOB_CHANGED, EMPLOYEE_REHIRED, EMPLOYEE_STATE_CHANGED |
| FNFS | FNF_SUBMITTED / MANAGER_APPROVED / FINANCE_VERIFIED / APPROVED / PAID / REJECTED / CANCELLED |
| PLAT | WF_* (workflow), DOCUMENT_* |
| TRDV | TNA_*, NOMINATION_*, TRAINING_*, INDUCTION_ASSIGNED, CERT_EXPIRING, ... |

**There is no event for any ESS request type** — no LEAVE_*, PERMISSION_*,
MISPUNCH_*, OT_*, COMP_OFF_*, SHIFT_CHANGE_*, WFH_*, ON_DUTY_*, VISITOR_PASS_*,
or PAYSLIP_PUBLISHED. Confirmed by code too: no file outside
`src/lib/platform/notification/**` calls `notify()`.

Net effect: an employee applies for leave and is told nothing when it is approved
or rejected. They must reopen the page to find out.

**Effort:** register events + templates per request type and call `notify()` at
each status transition. ~2-3 days; low risk, the engine already works.

### G4. Employee feedback & satisfaction surveys — NOT BUILT (MoM item)
MoM 23/June/2025: "Conduct regular employee feedback and satisfaction surveys"
and "Make exit feedback and surveys mandatory as part of the exit formalities."

No survey/feedback model, API or page exists. (`ExitInterview` exists on the
employee master as an HR-entered record — that is not the same thing as an
employee-completed survey, and nothing makes it mandatory or blocks exit on it.)

### G5. Internal ticketing system — NOT BUILT (signed scope line item)
The signed scope lists "Internal Ticketing System with Migration from old data
from Excel Sheet into New system." Nothing matching ticket / grievance / helpdesk
exists anywhere in `src/app`. This is employee-facing and would normally live in ESS.

**Note:** this is a scope-level line item, not strictly an ESS BRD row — flagged
here because it is the largest unbuilt employee-facing item found.

### G6. Profile update is narrower than the BRD wording
The BRD says "profile updates." What an employee can actually write:

| Endpoint | Methods |
|---|---|
| `/api/workforce/my-profile` | GET only |
| `/api/workforce/my-profile/contact` | PUT |
| `/api/workforce/my-profile/emergency-contacts` | POST, PUT, DELETE |

So contact details and emergency contacts are editable; personal details, bank,
PAN and Aadhaar are read-only with **no request-a-change path**. Locking those
behind HR is defensible, but as built the employee has no way to even ask for a
correction. Needs a client decision, not just code.

### G7. Gratuity estimation self-service — OPEN DECISION, NOT BUILT
`docs/DECISIONS_NEEDED_2026-09-11.md:148` (item 62). Gratuity BRD says "subject to
permissions"; no estimation facility exists on ESS. Still awaiting the client's answer.

---

## Part D — Priority

| Rank | Gap | Why | Est. |
|---|---|---|---|
| 1 | G2 Mobile | BRD names it the bulk of ESS effort; affects all 20 pages | 4-5 d |
| 2 | G3 ESS notifications | Explicit MoM item; engine already exists, just unwired | 2-3 d |
| ~~3~~ | ~~G1 Announcements~~ | **Done 2026-09-17** | — |
| 4 | G4 Surveys / exit feedback | Explicit MoM item ("mandatory") | 3-4 d |
| 5 | G6 Profile change requests | Needs a client decision first | 1-2 d after decision |
| 6 | G7 Gratuity estimation | Blocked on open decision 62 | 1 d after decision |
| — | G5 Ticketing | Scope line item, separate module | Not estimated |

---

## Part E — Not gaps (verified working, do not regress)

1. Employee role with zero permissions can use every ESS read endpoint (verified live).
2. All 20 ESS pages are reachable from the sidebar; no orphan pages.
3. Notification bell and inbox are wired and returning data for an employee login.
4. ESS pages resolve the employee from the session, never from a client-supplied id.
5. `/ess/**` is now behind the proxy JWT check (added 2026-09-17).
