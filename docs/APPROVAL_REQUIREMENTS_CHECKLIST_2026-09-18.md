# Approval Workflows — Client Requirement Checklist

Purpose: capture, for every approval type in HRMS, (a) what's already built, (b) what the client confirmed in the 2026-09-07 BRD, and (c) what's still open — so nothing is missed when gathering requirements.

For each approval, we need from the client:
1. Who can apply/raise the request
2. Approval chain (order of approvers — e.g. Reporting Manager → HOD → HR)
3. SLA / auto-escalation if an approver doesn't act
4. What happens on rejection (resubmit? terminal?)
5. Any conditional routing (e.g. amount/duration thresholds change the chain)

---

## A. Already built (`src/app/approvals/`) — confirm/refine only

### Workforce
| # | Approval | Chain confirmed so far | Open questions |
|---|----------|------------------------|-----------------|
| 1 | Leave | — | Hierarchy not given: HOD only, or HOD→HR? Leave-eligibility-after-probation? |
| 2 | LOM / Loss of Manday | — | Not covered in BRD yet — ask chain + trigger conditions |
| 3 | Mispunch | Employee → Reporting Manager → HR (confirmed) | none |
| 4 | On-Duty | — | Not covered in BRD yet |
| 5 | WFH | — | Not covered in BRD yet |
| 6 | Permission (short leave) | Exceeding ~2 hrs/month allowance → LOP only | Exact allowance is "dynamic" — needs real number; approval chain not given |
| 7 | Overtime | Reporting Manager → HOD → HR, post-facto (not pre-approved) | Daily/monthly OT cap not given; OT eligibility "as per employee basis" — needs per-employee config rule |

### Recruitment
| # | Approval | Chain confirmed so far | Open questions |
|---|----------|------------------------|-----------------|
| 8 | Offer | Matrix model exists (`RecruitmentApprovalMatrix`) | Levels/roles in matrix not yet confirmed by client |
| 9 | Joining | Matrix model exists (`JoiningApprovalMatrix`) | Levels/roles not yet confirmed |
| 10 | Final Selection | — | Not covered in BRD |
| 11 | Hiring | — | Not covered in BRD (relation to Offer/Final Selection unclear — same workflow or distinct?) |

### Payroll
| # | Approval | Chain confirmed so far | Open questions |
|---|----------|------------------------|-----------------|
| 12 | Salary Processing | HR approves PMS Incentive % before payroll (partial) | Full chain for monthly salary run not given |
| 13 | Salary Revision | — | Not covered in BRD |
| 14 | Full & Final | — | Not covered in BRD |

### Other
| # | Approval | Chain confirmed so far | Open questions |
|---|----------|------------------------|-----------------|
| 15 | Visitor Pass | — | Not covered in BRD |
| 16 | Employee Confirmation (probation → confirm) | — | Linked to "leave-eligibility-after-probation" open question |

---

## B. Not yet built — common HR approvals to ask the client about

Ask the client explicitly whether each of these exists as a process today, and if so, capture the chain:

| # | Approval | Typical trigger |
|---|----------|------------------|
| 17 | Comp-Off (grant/usage) | Working on weekly-off/holiday — BRD says accrual logic still "dynamic, TBD by company" |
| 18 | Resignation / Exit | Employee-initiated separation |
| 19 | Expense / Reimbursement | Travel, medical, misc. claims |
| 20 | Travel / Tour Request | Pre-travel authorization |
| 21 | Loan / Salary Advance | Employee request against salary |
| 22 | Asset Request/Return (laptop, ID card, etc.) | Onboarding/offboarding or ad hoc |
| 23 | Shift Change Request | Employee-requested shift swap |
| 24 | Document/Certificate Request (payslip, experience letter) | Employee self-service request |
| 25 | Training/Nomination | Training enrollment sign-off |
| 26 | "Other Benefits" (Double Machine Allowance, Attendance Bonus, Extra Work Allowance, Referral Bonus) | BRD confirms these exist but **no approval chain given** — explicitly open |

---

## How to use this with the client

Walk section A row by row confirming/correcting what's already assumed, then walk section B asking "does this approval exist in your current process, yes/no — if yes, who approves in what order." Record every answer back into [project_brd_business_rules.md memory](../../../.claude/projects/-Users-sukimacbook01-CascadeProjects-HRMS/memory/project_brd_business_rules.md) — do not hardcode any numeric threshold (OT cap, permission allowance, etc.) until the client gives a real figure.
