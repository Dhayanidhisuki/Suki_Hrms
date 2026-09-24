# Notification requirements — consolidated from the HRMS BRDs

Assembled 2026-09-23. Only notifications; everything else in these documents is
out of scope here.

## Sources searched

| Document | Notification content |
|---|---|
| `RECRUITMENT_ONBOARDING_BRD_COMPLETE_2026-09-12.md` | The substantive source: §5.5 auto-email, §5.6 Email Template Master, the Notifications & Automation Matrix, the SLA escalation matrix |
| `ESS_GAP_ANALYSIS_2026-09-17.md` | Client MoM items (23/June/2025, 17/July/2025) and gap G3 |
| `REQUIREMENTS_DECISIONS.md` §12 "Notifications & Alerts" | **PENDING — the client has answered nothing** |
| `HR_BRD_FOLDER_INVENTORY_2026-09-05.md` | 85 client files, none about notifications |
| `PERFORMANCE_ASSESSMENT_SCOPE_2026-09-22.md` | §30 notifications deferred to a later phase |
| `MASTERS_PLAN`, `BUILD_ESTIMATE`, `DYNAMIC_ARCHITECTURE` | "notification" only in the statutory sense (rate changes by government notification) — not requirements |

---

## 1. Client instructions (MoM — binding)

| Date | Requirement |
|---|---|
| 23/June/2025 | "Enable announcement notifications on the employee portal (e.g., policy updates, internal circulars)" |
| 17/July/2025 | "Notifications via the employee self-service portal must be configured and maintained" |

Both are about **ESS**. Neither has been withdrawn.

## 2. Recruitment BRD — Notifications & Automation Matrix

| Event | Notification | Recipient |
|---|---|---|
| Candidate Created | Application Received | Candidate |
| Call Passed | Interview Invitation | Candidate |
| Interview Scheduled | Schedule Email | Candidate + Interviewer |
| Interview Tomorrow | Reminder | Candidate + Interviewer |
| Interview Completed | Evaluation Pending | Interviewer |
| Evaluation Passed | Next Level Notification | Recruiter |
| Evaluation Failed | Status Notification | Recruiter |
| Documents Required | Document Request | Candidate |
| Documents Rejected | Re-upload Request | Candidate |
| Selection Approved | Selection Notification | Recruiter |
| Offer Sent | Offer Email | Candidate |
| Offer Accepted | Notification | HR |
| Joining Approaching | Joining Reminder | Candidate |
| Candidate Joined | Employee Creation Task | HR |
| Joining approval pending | Auto-notify approver + SLA timer | Approver |

## 3. Recruitment BRD §5.6 — Email Template Master (admin-configurable)

| # | Template | Trigger |
|---|---|---|
| 1 | Interview Invitation | Call Outcome = Proceed to Interview |
| 2 | Interview Reschedule | Interview rescheduled |
| 3 | Interview Reminder | X hours before interview |
| 4 | Document Request | Document verification stage |
| 5 | Selection Confirmation | Final selection approved |
| 6 | Offer Letter | Offer generated + sent |
| 7 | Rejection | Candidate rejected / on hold |
| 8 | Joining Reminder | X days before joining date |

§5.5 also requires the email to be **logged**: Email Sent Date/Time, and Email
Status of Sent / Failed / Pending.

## 4. Recruitment BRD — SLA escalation

Each stage escalates by notification when its SLA lapses:

| Stage | SLA (days) | Escalates to |
|---|---|---|
| Screening | 3 | HR Manager |
| Call Interview | 2 | Recruiter |
| Interview Scheduling | 5 | Interviewer |
| Evaluation | 2 | Interviewer |
| Document Verification | 3 | Interviewer |
| Final Selection | 2 | Management |
| Offer Approval | 2 | Approver |
| Joining Approval | 2 | Approver |

Plus an SLA-breach count card on the Recruitment Dashboard.

---

## 5. What is already built (checked against the live database)

The engine is real and in production use:

| | Count |
|---|---|
| `NotificationEvent` | 76 rows — **41 distinct codes** across 13 companies |
| `NotificationTemplate` | 121 |
| `NotificationDelivery` | 11,416 — EMAIL 5,289, INAPP 6,127 |

Per-event configuration already supports channel toggles (in-app, email, SMS,
push), category, priority, recipient expressions, quiet-hours exemption, digest
eligibility and retention — so the **infrastructure for everything below already
exists**; what is missing is registered events and the calls that fire them.

Registered modules:

| Module | Events | Covers |
|---|---|---|
| CORE | 4 | employee created / job changed / rehired / state changed |
| FNFS | 18 | the full settlement chain |
| PLAT | 24 | workflow (`WF_*`), documents, announcements |
| TRDV | 30 | training, TNA, nominations, induction, certificates |

## 6. Gap

Measured, not estimated:

- **Recruitment events registered: 0.** No `CANDIDATE_*`, `INTERVIEW_*`,
  `OFFER_*` or `JOINING_*` event exists. All 15 matrix rows, all 8 templates and
  all 8 SLA escalations in §2–§4 are unbuilt.
- **ESS request events registered: 0.** No `LEAVE_*`, `PERMISSION_*`,
  `MISPUNCH_*`, `OT_*`, `COMP_OFF_*`, `SHIFT_CHANGE_*`, `WFH_*`, `ON_DUTY_*`,
  `VISITOR_PASS_*` or `PAYSLIP_PUBLISHED`. An employee who applies for leave is
  told nothing when it is approved or rejected — they must reopen the page.
- `ANNOUNCEMENT_PUBLISHED` **is** registered, so the 23/June/2025 MoM item is
  partly covered; whether it actually fires on publish needs checking in code.

## 7. What the client still has to decide

`REQUIREMENTS_DECISIONS.md` §12 is marked **PENDING**, so none of this is
settled:

1. **Channels per event** — in-app only, or email too? SMS is off by default and
   no provider appears configured.
2. **Quiet hours** and which events are exempt.
3. **Digest vs immediate** — the schema supports digests; nobody has said which
   events should batch.
4. **Retention** — the default is 365 days.
5. **Recipient rules** for ESS requests — applicant only, or reporting manager
   and HR too?
6. **SLA timers** — the recruitment SLAs above are stated in the BRD but have
   never been confirmed against real hiring turnaround.

## 8. Suggested order

1. **ESS request events** — the only items with a binding client MoM behind
   them, and the engine already works; this is registration plus a `notify()`
   call at each status transition.
2. **Verify `ANNOUNCEMENT_PUBLISHED` actually fires** — the event exists, which
   is not the same as it being wired.
3. **Recruitment matrix + templates** — larger, and blocked on §12 answers for
   channel and recipient rules.
4. **SLA escalation** — needs a scheduler; last, and only once the SLA numbers
   are confirmed.
