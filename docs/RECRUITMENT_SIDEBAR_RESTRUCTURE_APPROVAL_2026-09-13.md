# Recruitment Module — Sidebar Restructure Proposal
## For Team Lead Approval

**Date:** 2026-09-13
**Module:** Recruitment & Onboarding
**Reference:** BRD v6.4 (RECRUITMENT_ONBOARDING_BRD_COMPLETE_2026-09-12) — §16 Module Structure
**Purpose:** Approve new sidebar structure before development begins

---

## 1. Problem Statement

**Current Recruitment sidebar:** 2 groups / 11 items — but **10 of 11 items are dead links** (no pages built). Only Job Postings works.

**If we add all missing BRD screens as flat sidebar items**, the module grows to **41 items** — unusable for recruiters.

**BRD §16.3 solution:** Tab-based pages — sidebar shows 4 groups, each opens a page with tabs inside.

---

## 2. CURRENT STRUCTURE (As-Is Today)

### 2.1 Recruitment Sidebar — 2 Groups / 11 Items

```
RECRUITMENT
│
├── HIRING
│   ├── Job Postings              ✅ Working (only working item)
│   ├── Offer Letter              🔴 Empty page
│   ├── Appointment Order         🔴 Empty page
│   └── Internship                🔴 Empty page
│
└── EMPLOYEE JOINING
    ├── Joining Checklist         🔴 Empty page + BRD HOLD (no template)
    ├── Joining Form              🔴 Empty page
    ├── Gratuity Form             🔴 Empty page
    ├── PF Form                   🔴 Empty page
    ├── Insurance Form            🔴 Empty page + BRD HOLD
    ├── ESI Form                  🔴 Empty page
    └── Other Documents           🔴 Empty page + BRD HOLD
```

**Status: 1 of 11 items functional.**

### 2.2 Masters — HR Masters Group

```
MASTERS > HR MASTERS
├── Interview Criteria            🔴 Dead link (no page, no API)
└── JD Master                     ✅ Working
```

### 2.3 Approval Center — Recruitment Group

```
APPROVAL CENTER > RECRUITMENT
├── Hiring Approval               🔴 Empty page
└── Employee Joining Approval     🔴 Empty page
```

---

## 3. PROPOSED STRUCTURE (To-Be)

### 3.1 Recruitment Sidebar — 4 Items Only

```
RECRUITMENT
│
├── Dashboard                     📄 Single page
│       └── Summary cards: Total | New | Call Pending | Interview
│           Scheduled | Evaluation Pending | Doc Verification |
│           Selected | Offer Released | Joined | Rejected
│       └── Metrics: Time-to-Hire | Offer Acceptance % | Pipeline Aging | SLA Breach
│
├── Applicants                    📄 Page with 4 tabs
│       ├── [Tab 1] Applicant Pipeline     — grid + filters (dept, designation,
│       │                                    stage, level, interviewer, status, search)
│       ├── [Tab 2] New Applicant          — registration form + duplicate checks
│       │                                    (Aadhaar / Mobile / Email)
│       ├── [Tab 3] Candidate 360°         — single-candidate view: 9 sub-tabs
│       │                                    (Overview | Personal | Application | Call |
│       │                                     Interview | Evaluation | Documents |
│       │                                     Offer | Joining | Activity Log)
│       └── [Tab 4] Call Interview         — call screening + outcome dropdown
│                                            ("Proceed" auto-sends interview email)
│
├── Interviews                    📄 Page with 4 tabs
│       ├── [Tab 1] Scheduling             — level-based schedule (L1→L2→L3→L4),
│       │                                    interviewer filtered by Panel master
│       ├── [Tab 2] My Interviews          — interviewer's personal queue
│       ├── [Tab 3] Evaluation             — scorecard per level (auto weighted score,
│       │                                    Pass/Fail/Hold decision)
│       └── [Tab 4] Document Verification  — required docs list, upload/verify/reject
│
└── Offer & Joining               📄 Page with 4 tabs
        ├── [Tab 1] Final Selection        — salary proposal → approval routing
        ├── [Tab 2] Offer Letter           — template → PDF → email → track status
        │                                    (Draft→Sent→Accepted/Rejected/Expired)
        ├── [Tab 3] Appointment Order      — PDF generate/send/track
        │                                    (Declined → revert to Offer Pending)
        └── [Tab 4] Joining                — SUB-TABS inside:
                ├── Joining Checklist       🔴 BRD HOLD
                ├── Application Form        (19 fields + PDF)
                ├── Joining Report          (12 fields + PDF)
                ├── Gratuity Form (Form F)  (nominees + PDF)
                ├── PF Form (Form 2)        (UAN + nominees + PDF)
                ├── ESI Form (Form 1)       (applicability check + PDF)
                ├── Insurance Form          🔴 BRD HOLD
                ├── Other Documents         🔴 BRD HOLD
                ├── Joining Approval        (approval gate → employee creation)
                └── Push to Employee        (convert candidate → Employee + auto ID)
```

### 3.2 Masters — HR Masters Group (2 → 21 items in 4 sub-groups)

```
MASTERS > HR MASTERS
│
├── INTERVIEW CONFIG
│   ├── Interview Process         🆕 P0 — CENTRAL CONFIG (6-step stepper:
│   │                               Basic → Levels → Criteria → Panel → Docs → Approval)
│   ├── Interview Levels          🆕 P0 (L1/L2/L3/L4, sequence, pass score)
│   ├── Interview Types           🆕 P0 (HR/Technical/Managerial, mode, duration)
│   ├── Interview Criteria        🔧 P0 (dead link → build real page)
│   ├── Score & Weightage         🆕 P0 (criteria weightage + min passing score)
│   └── Interview Panel           🆕 P0 (eligible interviewers per dept+designation+level)
│
├── RECRUITMENT SETUP
│   ├── Recruitment Status        🆕 P0 (20 status lifecycle states)
│   ├── Document Types            🆕 P0 (configurable doc list for verification)
│   ├── Sourcing Channels         🆕 P1 (Naukri/LinkedIn/Referral/Agency etc.)
│   ├── BGV Steps                 🆕 P1 (background verification checklist)
│   ├── SLA Config                🆕 P1 (days-per-stage + escalation)
│   ├── Checklist Master          🆕 P1 (joining checklist items)
│   ├── Designation Levels        🆕 P1 (Junior/Middle/Senior → drives approvals)
│   └── Employee ID Config        🆕 P0 (numbering rule: KUN-YYYY-NNNN)
│
├── TEMPLATES
│   ├── Email Templates           🆕 P0 (17 templates — invite/reject/offer/joining etc.)
│   ├── Offer Letter Templates    🆕 P0 (per employment type/dept/designation)
│   └── Appointment Templates     🆕 P1
│
├── APPROVAL CONFIG
│   ├── Recruitment Approval Matrix 🆕 P0 (CTC-based routing: HR→Dept Head→Mgmt)
│   └── Joining Approval Matrix     🆕 P0 (level-based approvers)
│
└── JD Master                     ✅ Existing — unchanged
```

### 3.3 Approval Center — Recruitment Group (2 → 4 items)

```
APPROVAL CENTER > RECRUITMENT
├── Hiring Approval               🔧 Existing placeholder → wire to requisition
├── Final Selection Approval      🆕 NEW (per §5.14)
├── Offer Approval                🆕 NEW (per §5.15)
└── Employee Joining Approval     🔧 Existing placeholder → wire to joining gate (§8)
```

---

## 4. SUMMARY OF CHANGES

| # | Change | Old | New | Reason |
|---|---|---|---|---|
| 1 | Recruitment sidebar | 2 groups / 11 items | **4 items** | 41 flat items unusable → tabs inside pages (BRD §16.3) |
| 2 | Joining forms | 7 separate sidebar items | **Sub-tabs inside Joining tab** | Same data flow, one screen |
| 3 | HR Masters | 2 items | **21 items in 4 sub-groups** | BRD requires 19 new masters |
| 4 | Approval Center | 2 items | **4 items** | BRD adds Final Selection + Offer approvals |
| 5 | Candidate handling | 10 separate popups/screens | **One Candidate 360° page** | All actions on one candidate in one place (§5.18) |
| 6 | Interview config | Hardcoded / none | **One Interview Process Master** | New designation/rounds = config, not code (§13) |
| 7 | Offer/Appointment numbering | None | **Auto-sequence (HRM/OFL/YYYY, KAPLHR/Appt/YYYY)** | BRD §5.15, §6.1 |
| 8 | Emails | None | **Email Template Master + auto-triggers** | 14 notification events (§5.21) |
| 9 | Employee creation | None | **Push to Employee + auto Employee ID** | §5.17, §9 |

---

## 5. ITEMS ON HOLD (BRD owner input needed — not blocking this approval)

| # | Item | Status |
|---|---|---|
| 1 | Insurance Form | 🔴 Template required |
| 2 | Joining Checklist | 🔴 Template/spec required |
| 3 | Other Joining Documents | 🔴 Confirm doc types |
| 4 | Employee ID numbering format | ⚠️ Confirm: `KUN-YYYY-NNNN`? |
| 5 | Joining Approval matrix | ⚠️ Confirm approver rules |
| 6 | Candidate Self-Service Portal | ⚠️ In-scope or future phase? |
| 7 | BGV agency integration | ⚠️ Internal-only or agency? |
| 8 | Internship stipend logic | ⚠️ Can interns be paid stipend? |

---

## 6. WHAT DOES NOT CHANGE

- ✅ Masters > Organization (Departments, Sites, Units, Reporting Structure) — reused as-is
- ✅ Masters > Employee (Designations, Levels, Employee Types) — reused as-is
- ✅ Masters > Payroll & Statutory (Gratuity Policies, PF Rates, ESI Rates, Health Insurance) — reused read-only
- ✅ Masters > JD Master — unchanged
- ✅ All other modules — untouched

---

## 7. DECISIONS NEEDED FROM TL

| # | Question | Options |
|---|---|---|
| 1 | Job Postings & Internship placement | (a) Standalone sidebar items (5-item sidebar) — (b) Inside Offer & Joining tabs (strict 4-item) |
| 2 | HR Masters layout | (a) 4 sub-groups as shown — (b) Flat list of 21 |
| 3 | Old dead routes (/recruitment/offer-letter etc.) | (a) Remove — (b) Redirect to new tab URLs |
| 4 | Approval needed for | Sidebar structure + masters grouping (this document) |

---

## 8. SIGN-OFF

| Role | Name | Decision | Date |
|---|---|---|---|
| Team Lead | | ☐ Approved / ☐ Approved with changes / ☐ Rejected | |
| Developer | | | |
| HR (BRD Owner) | | | |

**Comments:**

---
---

**End of Document**
