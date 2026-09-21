# KUN HRMS — Recruitment & Onboarding Module
## Business Requirements Document (BRD) — Advanced Level

**Document Version:** 6.4 (recruitment sidebar structure only)
**Date:** 2026-09-12
**Status:** Ready for Development — v6.4 reverts Masters sidebar changes, keeps only Recruitment sidebar structure with tab-based pages
**Prepared for:** KUN Aerospace Private Limited
**Module:** Recruitment & Onboarding (Talent Acquisition → Employee Joining)

---

## Document Control

| Field | Value |
|---|---|
| Document Owner | HR — KUN Aerospace |
| BRD Source 1 | KUN HRMS Recruitment BRD (Recruitment to On-Boarding) |
| BRD Source 2 | KUN HRMS Main BRD §3 — Forms & Certificate |
| Template Source | Kun.zip — Forms/ folder (actual company templates) |
| Module Overview | HRMS Module Overview Step 8 — Talent Acquisition |
| Status Legend | ✅ Specified | ⚠️ Partial | 🔴 HOLD (template/spec required) |

---

## Table of Contents

1. Objective
2. Scope
3. Recruitment Flow (End-to-End)
4. Key Functional Requirements
5. Applicant Tracking System
   - 5.1 Recruitment Dashboard
   - 5.2 Applicant Pipeline
   - 5.3 Applicant Registration
   - 5.4 Call Interview
   - 5.5 Automatic Email After Call Interview
   - 5.6 Email Template Master
   - 5.7 Interview Scheduling
   - 5.8 Designation-Based Interview Criteria
   - 5.9 Level-Based Interview Assignment
   - 5.10 Interviewer Assignment (Panel Master)
   - 5.11 Interview Evaluation (Scorecard)
   - 5.12 Level-Based Score & Weightage
   - 5.13 Document Verification
   - 5.14 Final Selection & Approval
   - 5.15 Offer Letter
   - 5.16 Candidate Joining
   - 5.17 Push to Employee
   - 5.18 Candidate 360° Page
   - 5.19 Recruitment Grid & Filters
   - 5.20 Status Lifecycle
   - 5.21 Workflow Automation
6. Post-Offer Letters
   - 6.1 Appointment Order
   - 6.2 Internship (Acceptance + Completion)
7. Joining Forms
   - 7.1 Joining Checklist 🔴 HOLD
   - 7.2 Application / Joining Form
   - 7.3 Joining Report
   - 7.4 Gratuity Nomination Form (Form F)
   - 7.5 PF Nomination Form (Form 2)
   - 7.6 ESI Application Form (Form 1)
   - 7.7 Insurance Form 🔴 HOLD
   - 7.8 Other Joining Documents 🔴 HOLD
8. Employee Joining Approval
9. Employee ID Generation
10. Cross-Cutting Requirements
   - 10.1 Sourcing Channels
   - 10.2 Duplicate Checks
   - 10.3 Background Verification
   - 10.4 Rejection Automation
   - 10.5 Time-to-Hire / SLA Metrics
   - 10.6 Candidate Self-Service Portal
   - 10.7 Job Posting Detail Fields
11. Key Masters Required
12. Master Specifications
    - 12.1 Interview Level Master
    - 12.2 Interview Type Master
    - 12.3 Interview Criteria Master
    - 12.4 Interview Score / Weightage Master
    - 12.5 Document Type Master
    - 12.6 Email Template Master
    - 12.7 Offer Letter Template Master
    - 12.8 Recruitment Approval Matrix
    - 12.9 Interview Panel / Interviewer Master
    - 12.10 Recruitment Status Master
    - 12.11 Designation Level Master
13. Interview Process Configuration
14. Role-Based Access Control
15. Effective Dating & Transaction Snapshot
16. Module Structure — Recruitment Sidebar
    - 16.1 Current Recruitment Sidebar
    - 16.2 Problem: Sidebar Overload
    - 16.3 Proposed Solution: Tab-Based Pages
    - 16.4 Proposed Recruitment Sidebar (4 groups)
    - 16.5 Proposed Approval Center
    - 16.6 Gap Analysis — Build List
    - 16.7 Existing Masters Already Available
    - 16.8 Key Architectural Recommendation
17. Cross-Module Dependencies
18. Reports & Analytics
19. Open Items / HOLD List

---

## 1. Objective

Develop a comprehensive recruitment management system to manage the complete hiring lifecycle:

**Manpower Requisition → Candidate Sourcing → Screening → Interview → Selection → Offer → Appointment → Joining → Employee Creation**

The system shall provide:
- Configurable approvals at multiple stages
- Status tracking with full audit trail
- Notifications (email + system)
- Document generation (PDF) for all letters and forms
- Workflow automation with trigger-based stage transitions
- Candidate 360° profile view
- Dashboard analytics with pipeline visibility

---

## 2. Scope

### In Scope
- Manpower Requisition & Approval
- Job Opening Creation
- Candidate Sourcing & Application Capture
- Applicant Tracking (Screening → Interview → Selection)
- Offer Letter Generation & Send
- Appointment Order Generation
- Internship Management
- Joining Forms (Application, Joining Report, Gratuity, PF, ESI, Insurance, Other)
- Joining Checklist
- Employee Creation (Push to Employee Master)
- Recruitment Dashboard & Reports
- Email Notifications & Templates
- Workflow Automation
- Masters Configuration

### Out of Scope (NOT this module — belongs elsewhere)
- Employee Lifecycle Letters (Confirmation, Promotion, Transfer, Designation Change, Service Certificate, Bonafide, Warning, Show Cause, Increment) — belongs in Employee Lifecycle / HR Letters module
- Signatory Master — cross-cutting config, not recruitment-specific
- Probation Config Master — belongs in Employee Management / Payroll
- Recruitment Portal (public career page) — future phase
- Performance Appraisal Workflow — future phase
- Mobile Application — future phase

---

## 3. Recruitment Flow (End-to-End)

```
Manpower Requirement
        ↓
Manpower Requisition (unique ID)
        ↓
Department / HR / Management Approval
        ↓
Job Opening Creation (Job ID, designation, location, dept, vacancies)
        ↓
Candidate Sourcing
        ↓
Application / Resume Capture
        ↓
HR Screening
        ↓
Call Interview (initial contact + outcome)
        ↓
Technical / Functional Screening
        ↓
Interview Scheduling (level-based, designation-driven)
        ↓
Interview Evaluation (scorecard + remarks)
        ↓
Selection / Rejection (with reason)
        ↓
Salary & Offer Approval
        ↓
Offer Letter Generation (PDF) + Email
        ↓
Candidate Acceptance
        ↓
Appointment Order Generation (PDF)
        ↓
Pre-Joining Documentation (Joining Checklist)
        ↓
Joining Forms Collection (Application, Gratuity, PF, ESI, Insurance)
        ↓
Joining Approval
        ↓
Employee Creation (Push to Employee Master + Employee ID)
```

---

## 4. Key Functional Requirements

| Module | Requirement | Developer View |
|---|---|---|
| Manpower Requisition | Department raises hiring request | Create requisition with unique ID |
| Approval | Manager/HR/Management approval | Configurable approval workflow |
| Job Opening | HR creates vacancy | Job ID, designation, plant/location, department, vacancies, closing date, employment type, salary range, experience range |
| Candidate | Capture candidate details/resume | Candidate master + document upload |
| Screening | HR evaluates candidate | Screening checklist + status |
| Interview | Schedule interview | Interview date/time/panel/mode |
| Evaluation | Interviewer provides feedback | Scorecard with mandatory comments |
| Selection | Select/reject candidate | Status transition with reason |
| Offer | Generate salary offer | Approval + offer template + PDF |
| Appointment | Generate appointment order | Template + PDF + numbering |
| Joining | Capture joining details + forms | Convert candidate to employee |
| Tracking | View recruitment progress | Dashboard + reports |
| Notification | Inform stakeholders | Email/system notifications |

---

## 5. Applicant Tracking System

### 5.1 Recruitment Dashboard

**Objective:** Replace the simple data-entry popup with a Recruitment Dashboard + Applicant Pipeline.

#### Top Summary Cards

| Card | Information |
|---|---|
| Total Applicants | Total registered candidates |
| New Applicants | Newly received applications |
| Call Interview Pending | Candidates waiting for initial call |
| Interview Scheduled | Upcoming interviews |
| Evaluation Pending | Interviews awaiting score/remarks |
| Document Verification | Pending verification |
| Selected | Candidates selected |
| Offer Released | Offers sent |
| Joined | Candidates who joined |
| Rejected | Rejected candidates |

#### Additional Metrics (NEW — not in original BRD)

| Card | Information |
|---|---|
| Time-to-Hire (Avg) | Average days from application to joining |
| Offer Acceptance Rate | % of offers accepted |
| Pipeline Aging | Candidates stuck > X days in a stage |
| SLA Breach Count | Interviews/verifications past SLA deadline |

---

### 5.2 Applicant Pipeline

Display candidates in stages:
```
New → Screening → Call Interview → Interview → Evaluation → Verification → Selected → Offer → Joined
```

Each candidate card should display:

| Field | Description |
|---|---|
| Applicant Name | Full name |
| Application/Enrolment No. | Auto-generated |
| Department | Target department |
| Designation/Position | Target role |
| Application Date | Date of application |
| Current Stage | Pipeline stage |
| Current Interview Level | L1/L2/L3/L4 |
| Interviewer | Assigned interviewer |
| Interview Date | Scheduled date |
| Score | Evaluation score % |
| Verification Status | Document verification |
| Offer Status | Offer lifecycle |
| Joining Date | Actual/planned joining |

---

### 5.3 Applicant Registration

#### Basic Information

| Field | Type | Required | Notes |
|---|---|---|---|
| Application/Enrolment No. | Auto | Yes | Auto-generated |
| Applicant Date | Auto | Yes | System date |
| Title | Dropdown | No | Mr/Ms/Mrs/Dr |
| First Name | Text | Yes | |
| Last Name | Text | Yes | |
| Mobile No. | Text | Yes | **Duplicate check required (NEW)** |
| Email ID | Email | Yes | **Duplicate check required (NEW)** |
| Date of Birth | Date | No | |
| Age | Auto | No | Calculated from DOB |
| Aadhaar No. | Text | Yes | Duplicate Aadhaar confirmation |
| Department | Dropdown | Yes | Filters designations |
| Position/Designation | Dropdown | Yes | Filtered by department |
| Source/Reference | Text | No | **Expand to sourcing channels (NEW — see §10.1)** |
| Reference Comments | Text | No | |

#### Department → Designation → Recruitment Criteria Cascade

```
Department
    ↓
Designation (filtered by department)
    ↓
Interview Criteria (auto-loaded based on designation)
```

Example:
```
Department: IT
    ↓
Designation: Software Developer
    ↓
Interview Criteria: Technical → Managerial → HR
```

---

### 5.4 Call Interview

When a candidate is ready for initial screening, the Recruiter clicks **Call Interview** to open a call-screening window.

#### Call Interview Details

| Field | Type | Notes |
|---|---|---|
| Candidate Name | Auto | From application |
| Mobile Number | Auto | From application |
| Email | Auto | From application |
| Department | Auto | From application |
| Designation | Auto | From application |
| Recruiter | Dropdown | Active recruiters |
| Call Date | Date | |
| Call Time | Time | |
| Call Outcome | Dropdown | See below |
| Candidate Interested | Yes/No | |
| Expected Salary | Number | |
| Notice Period | Text | |
| Available Joining Date | Date | |
| Recruiter Remarks | Textarea | |
| Next Action | Text | |

#### Call Outcome Dropdown

| Value | Next Step |
|---|---|
| Connected – Interested | Proceed to Interview |
| Connected – Not Interested | Rejected |
| Call Back Required | Schedule callback |
| No Response | Call back later |
| Number Not Reachable | Call back later |
| Rejected During Call | Rejected |
| Proceed to Interview | Auto-create interview communication |

---

### 5.5 Automatic Email After Call Interview

When Recruiter selects **Call Outcome = Proceed to Interview**, the system auto-triggers an interview email.

#### Email Content

| Field | Value |
|---|---|
| Subject | Interview Invitation – [Designation] – [Company Name] |
| Body includes | Candidate Name, Position, Department, Interview Type, Date, Time, Mode, Location/Meeting Link, Interviewer, Instructions, Contact details |

#### System Records

| Field | Value |
|---|---|
| Email Sent Date/Time | Auto |
| Email Status | Sent / Failed / Pending |
| Delivery Status | Delivered / Bounced |
| Template Used | Template reference |

---

### 5.6 Email Template Master

Admin should be able to configure templates for:

| # | Template | Trigger |
|---|---|---|
| 1 | Interview Invitation | Call Outcome = Proceed to Interview |
| 2 | Interview Reschedule | Interview rescheduled |
| 3 | Interview Reminder | X hours before interview |
| 4 | Document Request | Document verification stage |
| 5 | Selection Confirmation | Final selection approved |
| 6 | Offer Letter | Offer generated + sent |
| 7 | Rejection | **Candidate rejected/hold (NEW — see §10.4)** |
| 8 | Joining Reminder | X days before joining date |

---

### 5.7 Interview Scheduling

The system determines the interview flow based on:

#### Department
```
IT | Finance | HR | Sales | Operations | Production
```

#### Designation (filtered by department)
```
IT
 ├── Software Developer
 ├── Senior Developer
 ├── QA Engineer
 └── Team Lead
```

Each designation has a configurable **Interview Criteria / Interview Process**.

---

### 5.8 Designation-Based Interview Criteria

#### Master: Interview Criteria Master

| Department | Designation | Level | Interview Type | Mandatory |
|---|---|---|---|---|
| IT | Software Developer | Level 1 | HR Screening | Yes |
| IT | Software Developer | Level 2 | Technical | Yes |
| IT | Software Developer | Level 3 | Managerial | Yes |
| IT | Software Developer | Level 4 | HR Final | Yes |
| Sales | Sales Executive | Level 1 | HR | Yes |
| Sales | Sales Executive | Level 2 | Sales Manager | Yes |
| Sales | Sales Executive | Level 3 | Management | Yes |

Configurable by Admin/HR. System auto-determines required interviews per candidate.

---

### 5.9 Level-Based Interview Assignment

The interview process supports multiple levels with sequential gating.

```
Level 1: HR Screening
      ↓ PASS
Level 2: Technical Interview
      ↓ PASS
Level 3: Technical/Project Lead
      ↓ PASS
Level 4: Management / HR Final
      ↓ PASS
Document Verification
      ↓
Offer
```

**Rule:** Next level becomes available only when the previous mandatory level is successfully completed (score ≥ minimum passing score).

#### Interview Assignment Fields (per level)

| Field | Type |
|---|---|
| Interview Level | Dropdown |
| Interview Type | Dropdown |
| Interviewer | Dropdown (filtered by eligibility) |
| Interviewer Department | Auto |
| Scheduled Date | Date |
| Start Time | Time |
| End Time | Time |
| Interview Mode | Online / In-person / Phone |
| Location/Meeting Link | Text |
| Status | Pending / Scheduled / Completed / Cancelled |

---

### 5.10 Interviewer Assignment (Panel Master)

#### Master: Interview Panel Master

| Department | Designation | Interview Level | Eligible Interviewer |
|---|---|---|---|
| IT | Software Developer | Technical | Technical Lead |
| IT | Software Developer | Managerial | IT Manager |
| Sales | Sales Executive | Technical | Sales Manager |

**Rule:** Scheduler shows only eligible interviewers for that interview level — prevents incorrect assignment.

---

### 5.11 Interview Evaluation (Scorecard)

After each interview, the interviewer receives an Interview Evaluation screen.

#### Candidate Information (auto-filled)

| Field | Source |
|---|---|
| Candidate Name | Application |
| Department | Application |
| Designation | Application |
| Interview Level | Schedule |
| Interviewer | Schedule |
| Interview Date | Schedule |

#### Evaluation Criteria (configurable by designation)

| Criteria | Score |
|---|---|
| Technical Knowledge | /10 |
| Communication | /10 |
| Problem Solving | /10 |
| Relevant Experience | /10 |
| Teamwork | /10 |
| Leadership | /10 |
| Overall | /10 (auto-calculated) |

#### Remarks

| Field | Type |
|---|---|
| Strengths | Textarea |
| Weaknesses | Textarea |
| Interviewer Remarks | Textarea |
| Final Recommendation | Dropdown: Select / Reject / Hold / Next Level / Re-interview Required |

**System auto-calculates total/average score.**

---

### 5.12 Level-Based Score & Weightage

Different interview levels can have different criteria, weightages, and passing scores.

#### Example: Technical Interview

| Criteria | Weightage |
|---|---|
| Technical Knowledge | 40% |
| Coding / Practical | 30% |
| Problem Solving | 20% |
| Communication | 10% |
| **Minimum Passing Score** | **70%** |

#### Example: Managerial Interview

| Criteria | Weightage |
|---|---|
| Leadership | 30% |
| Team Management | 25% |
| Decision Making | 25% |
| Communication | 20% |
| **Minimum Passing Score** | **70%** |

**System determines:** PASS / FAIL / HOLD based on configured criteria.

---

### 5.13 Document Verification

After successful completion of required interview levels, candidate moves to Document Verification.

#### Required Documents (configurable)

| # | Document |
|---|---|
| 1 | Aadhaar |
| 2 | PAN |
| 3 | Resume |
| 4 | Educational Certificates |
| 5 | Experience Certificate |
| 6 | Previous Salary Proof |
| 7 | Address Proof |
| 8 | Photograph |
| 9 | Bank Details |
| 10 | Other Company-Specific Documents |

#### Verification Status (per document)

| Status | Description |
|---|---|
| Uploaded | Document submitted |
| Pending | Awaiting verification |
| Verified | Verified by HR |
| Rejected | Rejected with reason |
| Re-upload Required | Candidate needs to resubmit |

#### Verification Remarks
HR/Verifier can enter remarks against every document.
Example: "PAN document unclear – Re-upload required."

#### Background Verification (NEW — see §10.3)

| BGV Step | Status | Remarks |
|---|---|---|
| Document Verification | Pending/Verified/Rejected | |
| Reference Check 1 | Pending/Completed/Failed | |
| Reference Check 2 | Pending/Completed/Failed | |
| Previous Employment Verification | Pending/Completed/Failed | |
| Education Verification | Pending/Completed/Failed | |

---

### 5.14 Final Selection & Approval

Once all mandatory interviews are passed, required scores achieved, and documents verified, the candidate becomes eligible for Final Selection.

#### Selection Screen

| Field | Type |
|---|---|
| Candidate | Auto |
| Department | Auto |
| Designation | Auto |
| Proposed Salary | Number |
| Joining Date | Date |
| Employment Type | Dropdown |
| Reporting Manager | Dropdown |
| Location | Dropdown |
| Interview Score | Auto (from evaluations) |
| Verification Status | Auto |
| Final Remarks | Textarea |
| Approval Status | Pending / Approved / Rejected |

**HR/Management approval can be configured if required (Recruitment Approval Matrix — see §11).**

---

### 5.15 Offer Letter

After final approval, generate Offer Letter.

#### Template Auto-Populate

| Placeholder | Source |
|---|---|
| Candidate Name | Application |
| Address | Application |
| Designation | Selection |
| Department | Selection |
| Reporting Manager | Selection |
| Salary | Selection (CTC) |
| Benefits | Config |
| Joining Date | Selection |
| Location | Selection |
| Employment Type | Selection |
| Probation Period | Config (default 6 months) |
| Terms & Conditions | Template |

#### Offer Letter Numbering

| Format | Example |
|---|---|
| HRM/OFL/YYYY | HRM/OFL/2026 |

#### Actions

| Button | Action |
|---|---|
| Preview | View populated template |
| Generate | Create PDF |
| Send Email | Email PDF to candidate |
| Download | Download PDF |

#### Offer Status Lifecycle

```
Draft → Generated → Sent → Accepted → (Closed)
                         → Rejected → (Closed)
                         → Expired → (Closed)
```

#### Email Activity Logging
All email sending activity logged against the candidate (date/time, status, delivery, template).

#### Offer Letter Template (from Kun.zip — Forms/Offer Letter.docx)

| Field | Value |
|---|---|
| Ref No | HRM/OFL/2026 |
| Date | System date |
| Candidate Name | From application |
| Location | From selection |
| Designation | From selection |
| DOJ | From selection |
| CTC | Rs X Lakhs/Annum |
| Probation | 6 months from joining |
| Documents to bring | Aadhaar, PAN, Bank Account Copy, Academic Certificates (10th to highest), Relieving letters, 3 months salary proof, 4 passport photos, Dependents' Aadhaar (for health insurance) |
| Acceptance | Candidate signs copy |

---

### 5.16 Candidate Joining

Candidate remains in Recruitment module until actual joining date.

#### Joining Screen

| Field | Type |
|---|---|
| Candidate Name | Auto |
| Offer Number | Auto |
| Offer Date | Auto |
| Joining Date | Date |
| Department | Auto |
| Designation | Auto |
| Reporting Manager | Auto |
| Location | Auto |
| Joining Status | Dropdown |
| Actual Joining Date | Date |
| Joining Remarks | Textarea |

#### Joining Status Flow

```
Offer Released → Offer Accepted → Joining Pending → Joined
```

#### Joining Approval Gate (NEW — see §8)

```
Offer Accepted → Joining Pending → Joining Approval → Joined
```

---

### 5.17 Push to Employee Details

Once Joining Status = Joined, system provides **Create Employee** action.

#### Information Transferred (auto-mapped)

| Recruitment Field | Employee Master Field |
|---|---|
| Candidate/Application No. | Reference field |
| Name | Employee Name |
| DOB | Date of Birth |
| Mobile | Contact Mobile |
| Email | Personal Email |
| Address | Present Address |
| Aadhaar/PAN | KYC fields |
| Department | Department |
| Designation | Designation |
| Joining Date | Date of Joining |
| Salary | CTC / Salary Structure |
| Reporting Manager | Reporting Manager |
| Employment Type | Employee Type |
| Documents | Employee Documents |
| Offer Details | Reference |

#### Employee ID Generation (NEW — see §9)

System generates Employee ID per configurable numbering rule.

#### Status Change
Recruitment candidate status → **Joined / Converted to Employee**

---

### 5.18 Candidate 360° Page

Replace multiple independent popups with a single Candidate 360° page.

#### Header

```
CANDIDATE: John Kumar                 Application: APP000125
Software Developer | IT Department
Status: Interview - Level 2
[Call] [Schedule Interview] [Evaluation]
[Documents] [Offer] [Convert to Employee]
```

#### Tabs

| Tab | Content |
|---|---|
| Overview | Summary, current stage, scores |
| Personal | Personal details, DOB, blood group, etc. |
| Application | Application fields, source, reference |
| Call Interview | Call details, outcome, remarks |
| Interview | All levels, schedules, interviewers |
| Evaluation | Scorecards, recommendations |
| Documents | Uploaded docs, verification status |
| Offer | Offer letter, status, email log |
| Joining | Joining details, forms status |
| Activity Log | Full audit trail |

---

### 5.19 Recruitment Grid & Filters

#### Grid Columns

| Application | Candidate | Department | Designation | Stage | Level | Interview | Score | Documents | Offer | Joining | Action |
|---|---|---|---|---|---|---|---|---|---|---|---|

#### Filters

| Filter | Type |
|---|---|
| Date From / To | Date range |
| Department | Dropdown |
| Designation | Dropdown |
| Recruitment Stage | Dropdown |
| Interview Level | Dropdown |
| Interviewer | Dropdown |
| Call Status | Dropdown |
| Interview Status | Dropdown |
| Verification Status | Dropdown |
| Offer Status | Dropdown |
| Joining Status | Dropdown |
| Search Candidate | Text search |

---

### 5.20 Status Lifecycle

#### Main Flow

```
NEW
 ↓
SCREENING
 ↓
CALL INTERVIEW
 ↓
INTERVIEW SCHEDULED
 ↓
INTERVIEW LEVEL 1
 ↓
INTERVIEW LEVEL 2
 ↓
INTERVIEW LEVEL 3
 ↓
DOCUMENT VERIFICATION
 ↓
FINAL APPROVAL
 ↓
OFFER GENERATED
 ↓
OFFER SENT
 ↓
OFFER ACCEPTED
 ↓
JOINING PENDING
 ↓
JOINING APPROVAL (NEW)
 ↓
JOINED
 ↓
EMPLOYEE CREATED
```

#### Terminal States (applicable at any stage)

| State | Description |
|---|---|
| REJECTED | Candidate rejected |
| ON HOLD | Candidate put on hold |
| WITHDRAWN | Candidate withdrew |
| CANCELLED | Application cancelled |

---

### 5.21 Workflow Automation

#### Automation Triggers

| # | Trigger | Action |
|---|---|---|
| 1 | Candidate passes screening | Enable Call Interview |
| 2 | Call Interview = Proceed | Auto-create/send interview communication |
| 3 | Level 1 passed + Dept/Designation selected | Auto-load configured interview criteria |
| 4 | Level 1 passed | Auto-create/enable Level 2 |
| 5 | Interviewer completes evaluation | Auto-calculate score |
| 6 | Minimum score achieved | Move candidate to next level |
| 7 | All interview levels pass | Enable Document Verification |
| 8 | All mandatory documents verified | Enable Final Selection |
| 9 | Final Selection approved | Enable Offer Letter |
| 10 | Candidate joins | Enable Create Employee |
| 11 | Employee created | Recruitment status → Converted to Employee |
| 12 | **Candidate rejected/hold (NEW)** | **Auto-trigger Rejection email** |
| 13 | **Offer accepted (NEW)** | **Auto-trigger Joining Checklist + forms notification** |
| 14 | **Joining approval pending (NEW)** | **Auto-notify approver + SLA timer** |

#### Notifications & Automation Matrix

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

---

## 6. Post-Offer Letters

### 6.1 Appointment Order

#### Purpose
Formal appointment letter issued after offer acceptance, before/at joining.

#### Numbering

| Format | Example |
|---|---|
| KAPLHR/Appt/YYYY | KAPLHR/Appt/2025 |

#### Template Fields (from Kun.zip — Forms/Appointment Letter.docx)

| Field | Source |
|---|---|
| Ref No | KAPLHR/Appt/YYYY |
| Date | System date |
| Candidate Name | From application |
| Designation | From selection |
| Effective Date | From joining |
| Gross Salary (monthly) | From offer |
| Annual CTC | From offer |
| Reporting To | From selection |
| Allowances | Annexure (from salary structure) |
| Probation | 6 months (configurable) |
| Leave Rules | No leave during probation; EL/CL after confirmation |
| Termination Notice | 1 month (probation) / 3 months (confirmed) |
| Non-Compete | 3 years post-employment |
| Retirement Age | 58 years |
| Confidentiality | Standard clause |
| Jurisdiction | Chennai |
| Authorized Signatory | Configured signatory |

#### Status Lifecycle

```
Draft → Generated → Sent → Accepted → (Closed)
                         → Declined → (Closed / Revert to Offer Pending)
                         → Expired → (Closed)
```

> **⚠️ UNHAPPY PATH ADDED:** Original BRD only had Accepted → Closed. If a candidate declines the Appointment Order after accepting the Offer, the system must revert the candidate to Offer Pending status and notify HR. Expired state handles cases where the candidate does not respond within the deadline.

#### Actions
Preview → Generate (PDF) → Send Email → Download

---

### 6.2 Internship

#### Purpose
Manage internship lifecycle from acceptance to completion certificate.

#### Internship Acceptance Letter (from Kun.zip — Forms/Internship Acceptance Letter.docx)

| Field | Source |
|---|---|
| Date | System date |
| Intern Name | From application |
| College/Institution | From application |
| Department | From selection |
| Training Start Date | From selection |
| Training End Date | From selection |
| Rules | Standard clause (abide by KUN rules) |
| Benefits | None during internship tenure |
| Signatory | Configured signatory |

#### Internship Completion Certificate (from Kun.zip — Forms/Internship Completion Certificate.docx)

| Field | Source |
|---|---|
| Date | System date |
| Intern Name | From application |
| Reg No | From application |
| College/Institution | From application |
| Course | From application |
| Training Period | Start – End |
| Department | From selection |
| Conduct | Good / Satisfactory |
| Signatory | Configured signatory |

#### Internship Model (NEW — not in original BRD)

| Field | Type | Notes |
|---|---|---|
| Intern ID | Auto | Unique ID |
| Intern Name | Text | |
| College/Institution | Text | |
| Reg No | Text | College registration no. |
| Course | Text | |
| Department | Dropdown | |
| Mentor | Dropdown | Assigned mentor |
| Training Start Date | Date | |
| Training End Date | Date | |
| Stipend | Number | If applicable — see note below |
| Status | Dropdown | Active / Completed / Terminated |
| Intern-to-Employee Conversion | Action | Convert intern to employee if hired |

> **⚠️ TEMPLATE CONTRADICTION:** The Acceptance Letter template (Forms/Internship Acceptance Letter.docx) hardcodes "You will not be entitled with any benefit from the company during this tenure." If `Stipend > 0`, the letter needs conditional logic to print the stipend amount instead of "no benefits." The template must be updated to: `{IF Stipend > 0 THEN "You will be entitled to a stipend of Rs {Stipend} per month." ELSE "You will not be entitled with any benefit from the company during this tenure."}`

#### Status Lifecycle

```
Applied → Accepted → Active → Completed → (Converted to Employee / Closed)
                              → Terminated → (Closed)
```

---

## 7. Joining Forms

### 7.1 Joining Checklist 🔴 HOLD — Template Required

**Status:** HOLD — No template in zip. Main BRD §3 lists "Joining Checklist (Joining Form, Gratuity, PF, Insurance, ESI, etc)" as a concept only.

#### Requirement
A configurable checklist master that tracks which joining forms/documents have been collected and verified before an employee's joining is complete.

#### Proposed Checklist Items

| # | Item | Source Form |
|---|---|---|
| 1 | Application Form collected | §7.2 |
| 2 | Joining Report collected | §7.3 |
| 3 | Gratuity Nomination Form collected | §7.4 |
| 4 | PF Nomination Form collected | §7.5 |
| 5 | ESI Application Form collected | §7.6 |
| 6 | Insurance Form collected | §7.7 |
| 7 | Other Joining Documents collected | §7.8 |
| 8 | Aadhaar copy collected | From offer letter checklist |
| 9 | PAN copy collected | From offer letter checklist |
| 10 | Bank Account copy collected | From offer letter checklist |
| 11 | Academic Certificates verified | From offer letter checklist |
| 12 | Relieving letters collected | From offer letter checklist |
| 13 | Salary proof (3 months) collected | From offer letter checklist |
| 14 | Passport photos collected | From offer letter checklist |
| 15 | Dependents' Aadhaar collected | For insurance endorsement |

#### Checklist Status (per item)

| Status | Description |
|---|---|
| Pending | Not yet collected |
| Collected | Document received |
| Verified | Verified by HR |
| Not Applicable | Item not required for this employee |

#### Rule
Joining cannot be marked complete until all mandatory checklist items are Collected/Verified/Not Applicable.

---

### 7.2 Application / Joining Form

**Template Source:** Kun.zip — Forms/Joining Forms/Application form.pdf

#### Fields (19 fields)

| # | Field | Type | Required |
|---|---|---|---|
| 1 | Application No | Auto | Yes |
| 2 | Post Applied For | Text | Yes |
| 3 | Name of Applicant | Text | Yes |
| 4 | Father's Name | Text | Yes |
| 5 | Date of Birth | Date | Yes |
| 6 | Age | Auto | Yes |
| 7 | Gender | Dropdown (Male/Female) | Yes |
| 8 | Nationality | Text | Yes |
| 9 | Religion | Text | No |
| 10 | Address for Communication | Textarea | Yes |
| 11 | Permanent Address | Textarea | Yes |
| 12 | Experience | Textarea | No |
| 13 | Languages Known | Text | No |
| 14 | Educational Qualification | Textarea | Yes |
| 15 | Technical Qualification | Text | No |
| 16 | Marital Status | Dropdown (Yes/No) | Yes |
| 17 | E-Mail ID | Email | Yes |
| 18 | Blood Group | Text | No |
| 19 | Mobile No / Residence No | Text | Yes |

#### Additional Fields

| Field | Type | Notes |
|---|---|---|
| Dependent Name with Age | Textarea | If married |
| Spouse Name | Text | If married |
| No. of Children | Number | If married |
| Reference Name + Mobile | Text | |

#### Workflow

| Step | Actor | Action |
|---|---|---|
| 1 | Candidate / HR | Fill application form |
| 2 | HR | Verify fields against documents |
| 3 | HR | Mark form as Verified |
| 4 | System | Link to Employee Master on joining |

---

### 7.3 Joining Report

**Template Source:** Kun.zip — Forms/Joining Forms/Joining Report.pdf

#### Fields (12 fields)

| # | Field | Type | Required |
|---|---|---|---|
| 1 | Date | Auto | Yes |
| 2 | Name of Candidate Joining | Text | Yes |
| 3 | Location | Dropdown | Yes |
| 4 | Grade | Dropdown | Yes |
| 5 | Blood Group | Text | No |
| 6 | Designation | Dropdown | Yes |
| 7 | Joined On | Date | Yes |
| 8 | Present Address | Textarea | Yes |
| 9 | Permanent Address | Textarea | Yes |
| 10 | Contact Number | Text | Yes |
| 11 | Emergency Contact (Name + Mobile) | Text | Yes |
| 12 | Certificates Verified By | Text | Yes |

#### Additional Fields

| Field | Type | Notes |
|---|---|---|
| Reported To | Text | Name of executive reported to |
| PAN No | Text | Mandatory (if not held, apply immediately) |
| Candidate Signature | Upload | Signature scan |
| Reporting Authority Signature | Upload | Signature scan |

#### Workflow

| Step | Actor | Action |
|---|---|---|
| 1 | HR | Fill joining report on joining day |
| 2 | Candidate | Sign report |
| 3 | Reporting Authority | Sign report |
| 4 | HR | Verify certificates against offer letter checklist |
| 5 | System | Link to Employee Master |

---

### 7.4 Gratuity Nomination Form (Form F)

**Template Source:** Kun.zip — Forms/Joining Forms/Gratuity_Nomination_Form F.pdf

#### Nominee Details

| # | Field | Type |
|---|---|---|
| 1 | Nominee Name (full with address) | Textarea |
| 2 | Relationship with Employee | Text |
| 3 | Age of Nominee | Number |
| 4 | Proportion of Gratuity Shared | Percentage |

(Multiple nominees allowed — each row is a nominee)

#### Employee Statement

| # | Field | Type |
|---|---|---|
| 1 | Name of Employee (full) | Text |
| 2 | Sex | Dropdown |
| 3 | Religion | Text |
| 4 | Marital Status | Dropdown (Unmarried/Married/Widow/Widower) |
| 5 | Department/Branch/Section | Text |
| 6 | Post Held (Ticket/Serial No.) | Text |
| 7 | Date of Appointment | Date |
| 8 | Permanent Address | Textarea |

#### Declarations

| # | Declaration | Type |
|---|---|---|
| 1 | Nominees are family members within meaning of §2(h) of Payment of Gratuity Act | Checkbox |
| 2 | I have no family within meaning of §2(h) | Checkbox |
| 3 | Father/mother not dependant on me | Checkbox |
| 4 | I have excluded my husband by notice | Checkbox |
| 5 | This nomination invalidates previous nomination | Auto |

#### Witnesses (2 required)

| # | Field | Type |
|---|---|---|
| 1 | Witness Name + Address | Text |
| 2 | Witness Signature | Upload |

#### Employer Certification

| Field | Type |
|---|---|
| Employer Reference No | Auto |
| Employer Signature | Upload |
| Date | Auto |

#### Employee Acknowledgement

| Field | Type |
|---|---|
| Employee Signature | Upload |
| Date | Auto |

#### Workflow

| Step | Actor | Action |
|---|---|---|
| 1 | Employee | Fill nomination form |
| 2 | Employee | Sign + get witnesses |
| 3 | HR | Verify + certify |
| 4 | System | Store + link to Employee Master + GratuityPolicy |
| 5 | System | Generate PDF for record |

---

### 7.5 PF Nomination Form (Form 2)

**Template Source:** Kun.zip — Forms/Joining Forms/PF_Form2_PF Nomination.pdf

#### Pre-Requisites (from ESI & PF Need Data.xlsx)

| # | Requirement | Notes |
|---|---|---|
| 1 | UMANG App | Employee should download |
| 2 | Aadhaar Face RD App | Employee should download |
| 3 | Mobile Number linked with Aadhaar | Required |
| 4 | Aadhaar Number | Required |

#### PF Form Fields

| # | Field | Type |
|---|---|---|
| 1 | Employee Name | Text |
| 2 | Aadhaar Number | Text |
| 3 | Mobile Number (linked to Aadhaar) | Text |
| 4 | UAN | Auto / Text |
| 5 | Nominee Details | Same structure as Gratuity (name, relationship, age, proportion) |
| 6 | Employee Signature | Upload |

#### Workflow

| Step | Actor | Action |
|---|---|---|
| 1 | Employee | Download UMANG + Aadhaar Face RD apps |
| 2 | Employee | Verify Aadhaar linkage |
| 3 | Employee | Fill nomination form |
| 4 | HR | Verify UAN + Aadhaar linkage |
| 5 | System | Store + link to Employee Master + PfRate |
| 6 | System | Generate PDF for record |

---

### 7.6 ESI Application Form (Form 1)

**Template Source:** Kun.zip — Forms/Joining Forms/ESI_Form 1 Application.pdf

#### Fields (from ESI & PF Need Data.xlsx — ESI sheet)

| # | Field | Type | Required | Notes |
|---|---|---|---|---|
| 1 | ESI Applicable? | Yes/No | Yes | If Yes, fill below |
| 2 | IP Number | Text | Yes | If already registered |
| 3 | Mobile Number (linked with IP) | Text | Yes | |
| 4 | Date of Joining | Date | Yes | |
| 5 | Photo | Upload | Yes | Mandatory |
| 6 | Mobile Number (linked with Aadhaar) | Text | Yes | |
| 7 | Aadhaar Number | Text | Yes | |
| 8 | Date of Birth | Date | Yes | |
| 9 | Present Address | Textarea | Yes | |
| 10 | Nominee Details | Textarea | Yes | Name, Address, Mobile |
| 11 | Bank Details | Text | Yes | IFSC + A/c Number |

#### If ESI Not Applicable

| Field | Type |
|---|---|
| Reason | Text (salary above ceiling / already covered / other) |

#### Workflow

| Step | Actor | Action |
|---|---|---|
| 1 | HR | Check ESI applicability (salary ≤ ceiling) |
| 2 | Employee | Fill Form 1 if applicable |
| 3 | HR | Verify IP number + Aadhaar linkage |
| 4 | System | Store + link to Employee Master + EsiRate |
| 5 | System | Generate PDF for record |

---

### 7.7 Insurance Form 🔴 HOLD — Template Required

**Status:** HOLD — No standalone template in zip. Currently handled via:
- Dependents' Aadhaar hardcopy (per Offer Letter — "for health insurance endorsement")
- "ESI / Insurance Number" field on Employee Master (main BRD §4)

#### Requirement
A dedicated insurance enrollment form capturing:

| # | Field | Type | Required |
|---|---|---|---|
| 1 | Employee Name | Text | Yes |
| 2 | Employee ID | Auto | Yes |
| 3 | Insurance Policy No | Text | Yes |
| 4 | Insurance Provider | Text | Yes |
| 5 | Coverage Type | Dropdown | Yes |
| 6 | Coverage Amount | Number | Yes |
| 7 | Premium Amount | Number | Yes |
| 8 | Nominee Name | Text | Yes |
| 9 | Nominee Relationship | Text | Yes |
| 10 | Nominee Age | Number | Yes |
| 11 | Nominee Address | Textarea | Yes |
| 12 | Dependents Covered | Textarea | Names + Aadhaar (for endorsement) |
| 13 | Employee Signature | Upload | Yes |
| 14 | HR Verification | Upload | Yes |

#### Workflow

| Step | Actor | Action |
|---|---|---|
| 1 | HR | Check insurance eligibility (HealthInsuranceConfig) |
| 2 | Employee | Fill insurance form + nominee |
| 3 | Employee | Submit dependents' Aadhaar for endorsement |
| 4 | HR | Verify + submit to insurance provider |
| 5 | System | Store + link to Employee Master + HealthInsuranceConfig |
| 6 | System | Generate PDF for record |

> **ACTION REQUIRED:** BRD owner to provide Insurance Form template or confirm the above field structure.

---

### 7.8 Other Joining Documents 🔴 HOLD — Template Required

**Status:** HOLD — No dedicated template in zip. §5.17 has only a generic "Documents" field.

#### Requirement
A generic document-upload screen for miscellaneous joining documents not covered by specific forms.

#### Proposed Fields

| # | Field | Type |
|---|---|---|
| 1 | Document Type | Dropdown (configurable) |
| 2 | Document Name | Text |
| 3 | File Upload | Upload (PDF/Image) |
| 4 | Uploaded By | Auto |
| 5 | Upload Date | Auto |
| 6 | Verification Status | Pending / Verified / Rejected |
| 7 | Remarks | Text |

#### Configurable Document Types (master)

| Document Type | Example |
|---|---|
| Medical Certificate | Fitness certificate |
| Police Verification | Background check doc |
| Previous Employment Proof | Relieving/experience letter |
| Education Certificate | Degree/diploma |
| Address Proof | Utility bill/rental |
| ID Proof | Voter ID/Driving License |
| Other | Custom |

#### Workflow

| Step | Actor | Action |
|---|---|---|
| 1 | HR / Employee | Upload document |
| 2 | HR | Verify document |
| 3 | System | Store + link to Employee Documents |
| 4 | System | Update Joining Checklist status |

> **ACTION REQUIRED:** BRD owner to confirm document type list and whether a formal template is needed or upload-only is sufficient.

---

## 8. Employee Joining Approval

**Status:** NEW — Not in original BRD §4.19 status flow.

#### Requirement
An approval gate between Offer Accepted and Joined status.

#### Approval Flow

```
Offer Accepted
      ↓
Joining Pending
      ↓
Joining Approval Request (auto-notify approver)
      ↓
Approved → Joined → Employee Created
Rejected → Hold (notify HR + candidate)
```

#### Approval Screen

| Field | Type |
|---|---|
| Candidate Name | Auto |
| Offer Number | Auto |
| Joining Date | Date |
| Department | Auto |
| Designation | Auto |
| Reporting Manager | Auto |
| Joining Checklist Status | Auto (all items complete?) |
| Approver | Dropdown |
| Approval Status | Pending / Approved / Rejected |
| Approval Date | Auto |
| Remarks | Textarea |

#### Approval Matrix (configurable)

| Department | Designation Level | Approver 1 | Approver 2 |
|---|---|---|---|
| All | Junior | HR Manager | — |
| All | Middle | HR Manager | Department Head |
| All | Senior | HR Manager | CEO |

#### Automation
- Auto-notify approver when Joining Approval is pending
- SLA timer: if not approved within X days, escalate
- On approval: auto-trigger Employee Creation

---

## 9. Employee ID Generation

**Status:** NEW — Original BRD §4.16 says "generates Employee ID" with no numbering logic.

#### Requirement
A configurable Employee ID generation rule.

#### Proposed Numbering Options

| Option | Format | Example |
|---|---|---|
| Sequential | EMP0001, EMP0002 | EMP0001 |
| Year + Sequential | YYYY-NNNN | 2026-0001 |
| Department + Sequential | DEPT-NNNN | IT-0001 |
| Company + Year + Sequential | KUN-YYYY-NNNN | KUN-2026-0001 |

#### Configuration

| Field | Type | Default |
|---|---|---|
| Prefix | Text | KUN |
| Include Year | Boolean | Yes |
| Include Department | Boolean | No |
| Sequence Length | Number | 4 |
| Separator | Text | - |
| Start Number | Number | 1 |

#### Rule
- Employee ID is generated when **Create Employee** action is triggered (§5.17)
- ID is unique across all employees
- Sequence is maintained in a dedicated counter table (similar to JobDescriptionSequence)
- Once generated, ID cannot be changed

> **ACTION REQUIRED:** BRD owner to confirm preferred numbering format.

---

## 10. Cross-Cutting Requirements

### 10.1 Sourcing Channels

**Status:** NEW — Original BRD has only "Source/Reference" text field (§4.3).

#### Requirement
Track and manage candidate sourcing channels.

#### Sourcing Channel Master

| Channel | Type | Notes |
|---|---|---|
| Job Portal — Naukri | External | API/future integration |
| Job Portal — LinkedIn | External | API/future integration |
| Career Page | Internal | Company website |
| Employee Referral | Internal | Track referring employee |
| Consultant/Agency | External | Track agency + cost |
| Walk-in | Direct | |
| Social Media | External | Track campaign — **see reuse note below** |
| Other | Custom | |

> **⚠️ REUSE OPPORTUNITY:** The existing `social-media-lead-integration` pipeline already pulls WhatsApp/Facebook/Instagram/LinkedIn leads into CRM. The Social Media sourcing channel should reuse this pipeline rather than building a second social intake from scratch. **Confirm with BRD owner / integration team** whether to (a) reuse the existing pipeline, (b) build a separate recruitment-only intake, or (c) extend the existing pipeline to tag leads as "recruitment" vs "sales."

#### Application Source Tracking

| Field | Type |
|---|---|
| Source Channel | Dropdown (from master) |
| Source Detail | Text (e.g., specific portal, campaign) |
| Referring Employee | Dropdown (if referral) |
| Agency Name | Text (if consultant) |
| Agency Cost | Number (if consultant) |

#### Reports
- Source-wise application count
- Source-wise conversion rate (application → hired)
- Referral tracking report
- Agency cost vs hire report

---

### 10.2 Duplicate Checks

**Status:** NEW — Original BRD has only Aadhaar duplicate check (§4.3).

#### Requirement
Duplicate checks on multiple identifiers to prevent duplicate applications.

#### Duplicate Check Rules

| Field | Check | Action on Duplicate |
|---|---|---|
| Aadhaar No. | Check across all applicants | Warn + confirm to proceed |
| Email ID | Check across all applicants | Warn + link to existing application |
| Mobile No. | Check across all applicants | Warn + link to existing application |

#### Behavior
- Soft warning (not hard block) — allow HR to decide
- Show existing application details for reference
- Log duplicate check decision

---

### 10.3 Background Verification

**Status:** NEW — Original BRD §4.12 is document-status verification only.

#### Requirement
Formal BGV/reference-check step after document verification.

#### BGV Steps

| # | Step | Status | Remarks |
|---|---|---|---|
| 1 | Document Verification | Pending/Verified/Rejected | (existing original BRD §4.12) |
| 2 | Reference Check 1 | Pending/Completed/Failed | Contact name, phone, date, outcome |
| 3 | Reference Check 2 | Pending/Completed/Failed | Contact name, phone, date, outcome |
| 4 | Previous Employment Verification | Pending/Completed/Failed | Employer, contact, date, outcome |
| 5 | Education Verification | Pending/Completed/Failed | Institution, contact, date, outcome |
| 6 | Address Verification | Pending/Completed/Failed | Method, date, outcome |
| 7 | Police Verification | Pending/Completed/Failed | (if applicable) |

#### BGV Status

| Status | Description |
|---|---|
| Not Initiated | BGV not started |
| In Progress | Some checks pending |
| Completed | All checks passed |
| Failed | One or more checks failed |
| On Hold | BGV paused |

#### Rule
- Final Selection (§5.14) requires BGV status = Completed
- BGV failure triggers candidate hold/rejection with reason

---

### 10.4 Rejection Automation

**Status:** NEW — Original BRD §4.5 has rejection template but §4.20 automation never triggers it.

#### Requirement
Auto-trigger rejection email when candidate is rejected or put on hold.

#### Trigger Rules

| # | Trigger | Action |
|---|---|---|
| 1 | Candidate status → REJECTED | Auto-send Rejection email |
| 2 | Candidate status → ON HOLD | Auto-send Hold email (optional) |
| 3 | Call Interview → Connected – Not Interested | No email (candidate declined) |
| 4 | Call Interview → Rejected During Call | Auto-send Rejection email |
| 5 | Interview evaluation → Reject | Auto-send Rejection email |
| 6 | Final Selection → Rejected | Auto-send Rejection email |

#### Rejection Email Template

| Field | Value |
|---|---|
| Subject | Update on your application – [Designation] – [Company Name] |
| Body | Thank you + regret + keep on file + signatory |

#### Configuration
- HR can enable/disable auto-rejection email per stage
- HR can customize rejection reason mapping to email template
- All rejection emails logged against candidate

---

### 10.5 Time-to-Hire / SLA Metrics

**Status:** NEW — Original BRD §4.2 dashboard cards are counts only.

#### Requirement
Aging and SLA tracking for recruitment pipeline velocity.

#### Metrics

| Metric | Calculation |
|---|---|
| Time-to-Hire (Avg) | Avg days from Application Date → Joined Date |
| Time-to-Offer (Avg) | Avg days from Application Date → Offer Sent Date |
| Stage Aging | Days a candidate has been in current stage |
| SLA Breach Count | Candidates past SLA deadline in any stage |
| Offer Acceptance Rate | Accepted Offers / Total Offers Sent |
| Drop-off Rate by Stage | Candidates who exited at each stage |

#### SLA Configuration (per stage)

| Stage | SLA (days) | Escalation |
|---|---|---|
| Screening | 3 | Notify HR Manager |
| Call Interview | 2 | Notify Recruiter |
| Interview Scheduling | 5 | Notify Interviewer |
| Evaluation | 2 | Notify Interviewer |
| Document Verification | 3 | Notify HR |
| Final Selection | 2 | Notify Management |
| Offer Approval | 2 | Notify Approver |
| Joining Approval | 2 | Notify Approver |

#### Dashboard Display
- SLA breach count card on Recruitment Dashboard
- Red/yellow/green aging indicators on candidate cards
- SLA breach report (filterable by stage, department, recruiter)

---

### 10.6 Candidate Self-Service Portal

**Status:** NEW — Communication is one-way (system → candidate) only.

#### Requirement
Candidate-facing portal for application status and document submission.

#### Candidate Portal Features

| # | Feature | Description |
|---|---|---|
| 1 | Application Status | View current stage + history |
| 2 | Document Upload | Submit requested documents |
| 3 | Interview Schedule | View confirmed interview details |
| 4 | Offer Letter | View + accept/reject offer |
| 5 | Joining Details | Confirm joining date + submit joining forms |
| 6 | Communication | Message HR (two-way) |

#### Access
- Unique link sent to candidate email (token-based, no login required)
- Link expires after joining or rejection

---

### 10.7 Job Posting Detail Fields

**Status:** NEW — §4's Job Opening row lists these fields at a summary level; this section is the authoritative field spec.

#### Requirement
Extend Job Posting model with full vacancy details (supersedes §4 Job Opening row).

#### Extended Fields

| # | Field | Type | Required |
|---|---|---|---|
| 1 | Job ID | Auto | Yes |
| 2 | Title | Text | Yes |
| 3 | Department | Dropdown | Yes |
| 4 | Designation | Dropdown | Yes |
| 5 | Plant/Location | Dropdown | Yes |
| 6 | Vacancies | Number | Yes |
| 7 | Employment Type | Dropdown (Full-time/Part-time/Contract/Intern) | Yes |
| 8 | Experience (Min/Max) | Number (years) | No |
| 9 | Salary Range (Min/Max) | Number | No |
| 10 | Job Description | Rich text / JD link | Yes |
| 11 | Closing Date | Date | No |
| 12 | Status | Open/Closed/On Hold | Yes |
| 13 | Posted Date | Auto | Yes |
| 14 | Created By | Auto | Yes |

---

## 11. Key Masters Required

| # | Master | Purpose | Configurable By |
|---|---|---|---|
| 1 | Department Master | Departments | Admin |
| 2 | Designation Master | Designations (filtered by dept) | Admin |
| 3 | Interview Level Master | L1/L2/L3/L4 | Admin/HR |
| 4 | Interview Type Master | HR/Technical/Managerial/Management | Admin/HR |
| 5 | Interview Criteria Master | Dept+Designation→Level+Type+Mandatory | Admin/HR |
| 6 | Interview Score/Weightage Master | Criteria+Weightage+Passing Score per level | Admin/HR |
| 7 | Interview Panel/Interviewer Master | Eligible interviewer per dept+designation+level | Admin/HR |
| 8 | Document Type Master | Configurable document list for verification | Admin/HR |
| 9 | Recruitment Status Master | Status lifecycle states | Admin |
| 10 | Email Template Master | 8+ email templates | Admin/HR |
| 11 | Offer Letter Template Master | Offer letter template | Admin/HR |
| 12 | Appointment Order Template Master | Appointment order template | Admin/HR |
| 13 | Recruitment Approval Matrix | Approval workflow config | Admin/HR |
| 14 | Joining Approval Matrix (NEW) | Joining approval config | Admin/HR |
| 15 | Sourcing Channel Master (NEW) | Sourcing channels | Admin/HR |
| 16 | BGV Step Master (NEW) | Background verification steps | Admin/HR |
| 17 | SLA Config Master (NEW) | SLA per stage | Admin/HR |
| 18 | Employee ID Config (NEW) | Employee ID numbering rule | Admin |
| 19 | Checklist Master (NEW) | Joining checklist items | Admin/HR |
| 20 | Letter Template Master (NEW) | Offer + Appointment + Internship letter templates (recruitment-only) | Admin/HR |
| 21 | Designation Level Master (NEW) | Junior / Middle / Senior classification per designation — used by Joining Approval Matrix (§8) | Admin/HR |

---

## 12. Master Specifications

Detailed field-level specifications for each recruitment master.

### 12.1 Interview Level Master

**Purpose:** Defines the sequence and hierarchy of interviews through which a candidate must pass.

#### List Page Columns

| Column | Description |
|---|---|
| Level Code | Unique code |
| Level Name | Interview level |
| Sequence | Processing order |
| Interview Type | Associated interview type |
| Mandatory | Yes/No |
| Minimum Score | Passing score |
| Auto Move Next | Yes/No |
| Status | Active/Inactive |

#### Create Form Fields

| Field | Type | Required |
|---|---|---|
| Level Code | Text | Yes |
| Level Name | Text | Yes |
| Description | Text | No |
| Sequence No. | Number | Yes |
| Interview Type | Dropdown | Yes |
| Mandatory | Yes/No | Yes |
| Minimum Passing Score | Number | No |
| Maximum Attempts | Number | No |
| Auto Progress to Next Level | Yes/No | No |
| Allow Re-interview | Yes/No | No |
| Status | Active/Inactive | Yes |

#### Workflow Configuration

| Outcome | Action |
|---|---|
| PASS | Move to Level 2 (configurable) |
| FAIL | Recruitment Rejected (configurable) |
| HOLD | Candidate On Hold (configurable) |
| RE-INTERVIEW | Reschedule Same Level (configurable) |

#### Business Rules
- Level Code must be unique
- Sequence must be unique within the configured interview process
- Mandatory levels cannot be skipped
- Inactive levels cannot be assigned to new candidates
- Existing candidates retain historical level configuration
- Minimum score cannot exceed maximum score
- A candidate cannot proceed to the next mandatory level unless the current level is passed
- Re-interview should be allowed only when configured

---

### 12.2 Interview Type Master

**Purpose:** Defines what kind of interview is conducted.

#### Fields

| Field | Type |
|---|---|
| Interview Type Code | Text |
| Interview Type Name | Text |
| Description | Text |
| Mode | Physical / Online / Phone |
| Duration | Minutes |
| Evaluation Required | Yes/No |
| Score Required | Yes/No |
| Remarks Required | Yes/No |
| Interviewer Required | Yes/No |
| Meeting Link Required | Yes/No |
| Location Required | Yes/No |
| Status | Active/Inactive |

#### Mode-Specific Fields

| Mode | Fields |
|---|---|
| Physical | Interview Location, Room, Floor, Building |
| Online | Meeting Platform, Meeting URL, Meeting ID, Password, Instructions |
| Telephone | Contact Number, Call Duration, Call Outcome |

#### Business Rules
- Online Interview → Meeting Link Mandatory
- Physical Interview → Location mandatory
- Telephone Interview → Interviewer + Candidate Mobile mandatory
- If Evaluation Required = Yes, system must create an evaluation task after the interview

---

### 12.3 Interview Criteria Master

**Purpose:** Defines what should be evaluated during each interview. Different designations require different evaluation criteria.

#### Criteria Master Fields

| Field | Type |
|---|---|
| Criteria Code | Text |
| Criteria Name | Text |
| Description | Text |
| Category | Dropdown |
| Applicable Department | Dropdown |
| Applicable Designation | Dropdown |
| Interview Type | Dropdown |
| Interview Level | Dropdown |
| Status | Active/Inactive |

#### Criteria Categories

| Category | Examples |
|---|---|
| Technical | Technical Knowledge, Coding, Database Knowledge |
| Functional | Domain-specific skills |
| Behavioral | Teamwork, Leadership |
| Communication | Verbal, Written |
| Leadership | Decision Making, Team Management |
| Analytical | Problem Solving |
| Domain Knowledge | Industry expertise |
| Culture Fit | Values alignment |
| Problem Solving | Analytical thinking |

#### Criteria Configuration

Each criterion supports:

| Field | Type |
|---|---|
| Score Type | /10, /5, Percentage |
| Minimum Score | Number |
| Maximum Score | Number |
| Weightage | Percentage |
| Mandatory | Yes/No |
| Remarks Required | Yes/No |
| Evidence Required | Yes/No |

---

### 12.4 Interview Score / Weightage Master

**Purpose:** Controls how interview scores are calculated. The system should calculate the score from configured criteria and weightages, not store a manually entered overall score.

#### Fields

| Field | Type |
|---|---|
| Score Configuration Code | Text |
| Department | Dropdown |
| Designation | Dropdown |
| Interview Level | Dropdown |
| Interview Type | Dropdown |
| Criteria | Dropdown |
| Maximum Score | Number |
| Minimum Score | Number |
| Weightage % | Number |
| Passing Score | Number |
| Rating Scale | 10-Point / 5-Point / Percentage |
| Status | Active/Inactive |

#### Rating Scales

**Option A — 10 Point:** 1=Very Poor, 2=Poor, 3=Below Average, 4=Average, 5=Satisfactory, 6=Good, 7=Very Good, 8=Excellent, 9=Outstanding, 10=Exceptional

**Option B — 5 Point:** 1=Poor, 2=Needs Improvement, 3=Average, 4=Good, 5=Excellent

**Option C — Percentage:** 0–100

#### Score Calculation

```
Weighted Score = Σ (Candidate Score / Maximum Score × Weightage)
```

Example:
- Technical: 8/10 × 30% = 24
- Coding: 9/10 × 30% = 27
- Problem Solving: 7/10 × 20% = 14
- Communication: 8/10 × 20% = 16
- **Total: 81% → PASS**

#### Score Rules
- Minimum overall passing score (configurable)
- Minimum individual criteria score (configurable)
- Weightage per criteria
- Mandatory criteria
- Automatic pass/fail determination
- Manual override with approval + remarks

Example: Overall score = 80%, but Coding score < 50% → System can be configured to FAIL despite overall score.

---

### 12.5 Document Type Master

**Purpose:** Defines the documents required from candidates during recruitment.

#### Fields

| Field | Type |
|---|---|
| Document Code | Text |
| Document Name | Text |
| Category | Dropdown |
| Description | Text |
| Mandatory | Yes/No |
| Applicable Department | Dropdown |
| Applicable Designation | Dropdown |
| Applicable Employment Type | Dropdown |
| Verification Required | Yes/No |
| Expiry Required | Yes/No |
| Allowed File Types | Text (pdf, jpg, png) |
| Maximum File Size | Number (MB) |
| Multiple Files Allowed | Yes/No |
| Status | Active/Inactive |

#### Document Categories

| Category | Examples |
|---|---|
| Identity | Aadhaar, PAN, Passport, Driving Licence |
| Education | 10th Certificate, 12th Certificate, Degree Certificate, Mark Sheets |
| Employment | Experience Certificate, Relieving Letter, Salary Slip |
| Other | Photograph, Address Proof, Bank Details |

#### Verification Flow

```
Required → Uploaded → Under Verification → Verified
                                    → Rejected → Re-upload Required → Under Verification
```

Verifier records: Verified By, Verification Date, Remarks, Document Version

---

### 12.6 Email Template Master

**Purpose:** Configurable email templates for all recruitment communications.

#### Recommended Templates (16)

| # | Template |
|---|---|
| 1 | Application Received |
| 2 | Call Interview Invitation |
| 3 | Interview Scheduled |
| 4 | Interview Rescheduled |
| 5 | Interview Reminder |
| 6 | Document Request |
| 7 | Document Re-upload Request |
| 8 | Interview Selected |
| 9 | Interview Rejected |
| 10 | Candidate On Hold |
| 11 | Final Selection |
| 12 | Offer Letter |
| 13 | Offer Reminder |
| 14 | Offer Acceptance |
| 15 | Joining Reminder |
| 16 | Joining Confirmation |
| 17 | Recruitment Cancellation |

#### Template Fields

| Field | Type |
|---|---|
| Template Code | Text |
| Template Name | Text |
| Event | Dropdown |
| Subject | Text |
| Email Body | Rich Text |
| To | Text |
| CC | Text |
| BCC | Text |
| Attachment | File |
| Language | Dropdown |
| Department | Dropdown |
| Designation | Dropdown |
| Status | Active/Inactive |

#### Dynamic Parameters (Placeholders)

```
Dear {{CandidateName}},

Congratulations!
You have been shortlisted for the position of
{{Designation}} in {{Department}}.

Interview Date: {{InterviewDate}}
Interview Time: {{InterviewTime}}
Interview Mode: {{InterviewMode}}
Interviewer: {{InterviewerName}}

Regards,
{{CompanyName}}
```

Supported parameters: `{{CandidateName}}`, `{{ApplicationNo}}`, `{{Department}}`, `{{Designation}}`, `{{InterviewLevel}}`, `{{InterviewType}}`, `{{InterviewDate}}`, `{{InterviewTime}}`, `{{InterviewerName}}`, `{{MeetingLink}}`, `{{JoiningDate}}`, `{{OfferNo}}`, `{{CompanyName}}`, `{{HRContact}}`

#### Email Automation Flow

```
Call Interview
     │
     └── Outcome = Proceed
                ↓
         Email Template
                ↓
         Interview Invitation
                ↓
             Send
                ↓
        Communication Log
```

---

### 12.7 Offer Letter Template Master

**Purpose:** Defines reusable offer-letter templates. Different employment categories may require different templates.

#### Employment Categories

Permanent Employee, Contract Employee, Trainee, Intern, Consultant, Probationary Employee

#### Template Fields

| Field | Type |
|---|---|
| Template Code | Text |
| Template Name | Text |
| Department | Dropdown |
| Designation | Dropdown |
| Employment Type | Dropdown |
| Grade | Dropdown |
| Location | Dropdown |
| Version | Text |
| Effective From | Date |
| Effective To | Date |
| Status | Active/Inactive |

#### Offer Letter Content Sections

| Section | Fields |
|---|---|
| Candidate Information | Name, Address, Application Number |
| Job Information | Department, Designation, Grade, Reporting Manager, Location, Joining Date |
| Compensation | Basic Salary, Allowances, Incentives, Gross Salary, CTC |
| Employment Conditions | Probation, Notice Period, Working Hours, Leave, Benefits, Confidentiality, Terms & Conditions |

---

### 12.8 Recruitment Approval Matrix

**Purpose:** Controls which recruitment activities require approval and who should approve them. Critical for salary, selection, offer and exception handling.

#### Approval Conditions (configurable)

Department, Designation, Grade, Employment Type, Salary/CTC Range, Interview Result, Candidate Source, Recruitment Type, Location

#### Example: CTC-Based Routing

```
Software Developer
CTC < ₹5 Lakh → HR Manager Approval
CTC ₹5–10 Lakh → HR Manager → Department Head
CTC > ₹10 Lakh → HR Manager → Department Head → Management
```

#### Approval Matrix Fields

| Field | Description |
|---|---|
| Matrix Code | Unique |
| Process | Recruitment / Selection / Offer |
| Department | Applicable department |
| Designation | Applicable designation |
| Employment Type | Applicable type |
| Min Salary | Lower range |
| Max Salary | Upper range |
| Approval Level | 1, 2, 3 |
| Approver Type | Employee/Role/Position |
| Approver | Specific approver |
| Mandatory | Yes/No |
| Sequence | Approval order |
| Escalation Days | SLA |
| Status | Active/Inactive |

#### Approval Workflow

```
Candidate Selected
       ↓
Salary Proposed
       ↓
Approval Matrix Evaluation
       ↓
Level 1 – HR Manager → Approved
       ↓
Level 2 – Department Head → Approved
       ↓
Level 3 – Management → Approved
       ↓
Generate Offer
```

If rejected: Recruiter notified → Reason captured → Modify / Cancel / Resubmit

---

### 12.9 Interview Panel / Interviewer Master

**Purpose:** Defines which interviewers are eligible to conduct interviews for specific departments, designations, and levels.

#### Fields

| Field | Type |
|---|---|
| Panel Code | Text |
| Department | Dropdown |
| Designation | Dropdown |
| Interview Level | Dropdown |
| Interview Type | Dropdown |
| Eligible Interviewer | Dropdown (Employee) |
| Interviewer Department | Auto |
| Status | Active/Inactive |

#### Business Rules
- Scheduler shows only eligible interviewers for the selected department + designation + level
- An interviewer cannot evaluate their own interview (§14 RBAC)
- Multiple interviewers can be eligible for the same level
- Inactive panel members cannot be assigned to new interviews

---

### 12.10 Recruitment Status Master

**Purpose:** Defines the controlled status lifecycle for candidate progression.

#### Fields

| Field | Type |
|---|---|
| Status Code | Text |
| Status Name | Text |
| Description | Text |
| Sequence | Number |
| Stage Category | Dropdown (Screening/Interview/Verification/Selection/Offer/Joining) |
| Is Terminal | Yes/No |
| Allow Transition To | Multi-select (other status codes) |
| Color | Text (for UI) |
| Status | Active/Inactive |

#### Status Values (predefined)

| # | Status | Terminal |
|---|---|---|
| 1 | NEW | No |
| 2 | SCREENING | No |
| 3 | CALL INTERVIEW | No |
| 4 | INTERVIEW SCHEDULED | No |
| 5 | INTERVIEW LEVEL 1 | No |
| 6 | INTERVIEW LEVEL 2 | No |
| 7 | INTERVIEW LEVEL 3 | No |
| 8 | DOCUMENT VERIFICATION | No |
| 9 | FINAL APPROVAL | No |
| 10 | OFFER GENERATED | No |
| 11 | OFFER SENT | No |
| 12 | OFFER ACCEPTED | No |
| 13 | JOINING PENDING | No |
| 14 | JOINING APPROVAL | No |
| 15 | JOINED | No |
| 16 | EMPLOYEE CREATED | No |
| 17 | REJECTED | Yes |
| 18 | ON HOLD | Yes |
| 19 | WITHDRAWN | Yes |
| 20 | CANCELLED | Yes |

---

### 12.11 Designation Level Master

**Purpose:** Classifies designations into levels (Junior / Middle / Senior) for use by the Joining Approval Matrix (§8) and Recruitment Approval Matrix (§12.8).

#### Fields

| Field | Type |
|---|---|
| Level Code | Text |
| Level Name | Text (Junior / Middle / Senior / Top Management) |
| Description | Text |
| Designation | Dropdown (multi-select) |
| Default Approver | Dropdown |
| Status | Active/Inactive |

#### Example

| Designation | Level | Joining Approver |
|---|---|---|
| Junior Engineer | Junior | HR Manager |
| Senior Engineer | Middle | HR Manager + Dept Head |
| Team Lead | Middle | HR Manager + Dept Head |
| Manager | Senior | HR Manager + CEO |

---

> **Note on other masters:** The following masters from §11 are covered in their functional sections and don't need separate §12 specs:
> - Joining Approval Matrix → §8
> - Sourcing Channel Master → §10.1
> - BGV Step Master → §10.3
> - SLA Config Master → §10.5
> - Employee ID Config → §9
> - Checklist Master → §7.1
> - Letter Template Master → merged into Offer Template (§12.7) and Appointment Template
> - Department/Designation Master → already exist in Prisma schema

---

## 13. Interview Process Configuration

The Interview Process Master should be the central configuration point. The other masters are reusable components underneath it.

**Architecture:**
```
Department + Designation → Interview Process → Levels → Types → Criteria → Weightage → Interviewer → Evaluation → Documents → Approval → Offer → Joining → Employee
```

#### 6-Step Stepper Configuration

**Step 1 — Basic**

| Field | Type | Required |
|---|---|---|
| Process Name | Text | Yes |
| Department | Dropdown | Yes |
| Designation | Dropdown | Yes |
| Employment Type | Dropdown | No |
| Effective From | Date | Yes |
| Status | Active/Inactive | Yes |

**Step 2 — Interview Levels**

| Seq | Level | Type | Mandatory | Pass Score |
|---|---|---|---|---|
| 1 | L1 | HR | Yes | 60% |
| 2 | L2 | Tech | Yes | 70% |
| 3 | L3 | Mgmt | Yes | 65% |

**Step 3 — Criteria** (per level)

Example — L2 Technical Interview:
- Technical Knowledge: 30%
- Coding: 30%
- Problem Solving: 20%
- Communication: 20%

**Step 4 — Interview Panel** (per level)

Example — L2 Technical:
- ☑ Technical Lead
- ☑ Senior Developer
- ☑ Engineering Manager

**Step 5 — Documents**

- ☑ Aadhaar
- ☑ PAN
- ☑ Degree Certificate
- ☑ Experience Certificate
- ☐ Passport

**Step 6 — Approval**

```
Selection Approval → HR Manager → Department Head → Management
```

> This single configuration then drives the candidate workflow. No code change needed when adding new departments, designations, interview rounds, scoring models, or approval policies.

---

## 14. Role-Based Access Control

#### Recommended Roles

| Role | Access |
|---|---|
| HR Admin | Full Recruitment Masters |
| Recruiter | View configuration, candidate transactions |
| Interviewer | Evaluation only |
| HR Manager | Approvals + evaluation |
| Department Head | Interview + approvals |
| Management | Final approvals |
| Document Verifier | Document verification |
| System Admin | Full configuration |

#### Interviewer Restrictions

Interviewers should NOT be allowed to:
- Change score configuration
- Change interview criteria
- Change passing score
- Modify candidate personal information
- Approve own interview

They should only see assigned candidates and submit evaluations.

---

## 15. Effective Dating & Transaction Snapshot

### 15.1 Effective Dating

Masters affecting recruitment should support effective dates.

Example:
```
Interview Process: Software Developer – V1
Effective: 01-Jan-2026 to 30-Jun-2026

Then:
Interview Process: Software Developer – V2
Effective: 01-Jul-2026 onwards
```

A candidate created in June retains V1; a candidate created in July uses V2.

This is particularly important for interview criteria, score weightage, and offer templates.

### 15.2 Transaction Snapshot Requirement

**Critical:** Do not dynamically change historical candidate configuration.

Example:
```
Candidate A interviewed in January with:
  Coding Weightage = 30%
  Communication = 20%

HR changes the master in February:
  Coding Weightage = 40%
  Communication = 10%

Candidate A's old evaluation must remain 30% / 20%.
```

When an interview is scheduled, the system should create a **snapshot** of the applicable configuration:

```
Master Configuration
        ↓
Interview Scheduled
        ↓
Configuration Snapshot
        ↓
Evaluation
```

This is critical for audit and legal/HR traceability.

---

## 16. Module Structure — Current vs Required

### 16.1 Current Recruitment Sidebar

| Module | Groups | Items | Problem |
|---|---|---|---|
| **Recruitment** | **2** | **11** | Missing 11 screens + 19 masters |
| Masters > HR Masters | 1 | 2 | Only Interview Criteria + JD Master — needs 19 more |

#### Current Recruitment Module — 2 groups, 11 items

```
RECRUITMENT
├── Hiring
│   ├── Job Postings ✅ (ready)
│   ├── Offer Letter
│   ├── Appointment Order
│   └── Internship
│
└── Employee Joining
    ├── Joining Checklist
    ├── Joining Form
    ├── Gratuity Form
    ├── PF Form
    ├── Insurance Form
    ├── ESI Form
    └── Other Joining Documents
```

#### Current Approval Center — Recruitment group — 2 items

```
APPROVAL CENTER > Recruitment
├── Hiring Approval
└── Employee Joining Approval
```

### 16.2 Problem: Sidebar Overload

**Recruitment** currently has **11 items** across 2 groups. Adding 11 screens + 19 masters would make it **41 items** — unusable.

### 16.3 Proposed Solution: Tab-Based Pages (4 Groups per Module)

**Pattern:** Sidebar shows 4 groups → Click a group → Page opens with tabs inside → Switch tabs to see sub-screens.

This reduces sidebar clutter while keeping all functionality accessible.

---

### 16.4 Proposed Recruitment Sidebar (4 groups)

```
RECRUITMENT
│
├── Dashboard                          → 1 page (§5.1)
│
├── Applicants                         → 1 page with 4 tabs inside
│   ├── [Tab 1] Applicant Pipeline      (§5.2, §5.19)
│   ├── [Tab 2] New Applicant           (§5.3)
│   ├── [Tab 3] Candidate 360°          (§5.18)
│   └── [Tab 4] Call Interview          (§5.4)
│
├── Interviews                         → 1 page with 4 tabs inside
│   ├── [Tab 1] Interview Scheduling    (§5.7)
│   ├── [Tab 2] My Interviews           (§5.10)
│   ├── [Tab 3] Evaluation              (§5.11)
│   └── [Tab 4] Document Verification   (§5.13)
│
└── Offer & Joining                    → 1 page with 4 tabs inside
    ├── [Tab 1] Final Selection         (§5.14)
    ├── [Tab 2] Offer Letter            (§5.15)
    ├── [Tab 3] Appointment Order       (§6.1)
    └── [Tab 4] Joining                 (§5.16, §8, §5.17)
         └── Joining sub-tabs:
             ├── Joining Checklist 🔴   (§7.1)
             ├── Application Form        (§7.2)
             ├── Joining Report          (§7.3)
             ├── Gratuity Form           (§7.4)
             ├── PF Form                (§7.5)
             ├── ESI Form                (§7.6)
             ├── Insurance Form 🔴       (§7.7)
             ├── Other Documents 🔴     (§7.8)
             ├── Joining Approval        (§8)
             └── Push to Employee        (§5.17)
```

**Sidebar items: 4** (instead of 30+)

#### Additional items kept outside Recruitment module

| Item | Location | BRD Section |
|---|---|---|
| Job Postings | Recruitment > Offer & Joining > Tab (or keep as separate) | §4 |
| Internship | Recruitment > Offer & Joining > Tab (or keep as separate) | §6.2 |

---

---

### 16.5 Proposed Approval Center (Recruitment group)

```
APPROVAL CENTER > Recruitment
├── Hiring Approval ✅ (exists)          §4
├── Final Selection Approval              §5.14
├── Offer Approval                        §5.15
└── Employee Joining Approval ✅ (exists) §8
```

---

### 16.6 Gap Analysis — What's Missing (Build List)

#### Missing Recruitment Screens (11)

| # | Screen | BRD Section | Priority | Goes Into |
|---|---|---|---|---|
| 1 | Recruitment Dashboard | §5.1 | P0 | Sidebar item (standalone) |
| 2 | Applicant Pipeline | §5.2, §5.19 | P0 | Applicants > Tab 1 |
| 3 | New Applicant Registration | §5.3 | P0 | Applicants > Tab 2 |
| 4 | Call Interview | §5.4 | P0 | Applicants > Tab 4 |
| 5 | Interview Scheduling | §5.7 | P0 | Interviews > Tab 1 |
| 6 | Interview Evaluation | §5.11 | P0 | Interviews > Tab 3 |
| 7 | Document Verification | §5.13 | P0 | Interviews > Tab 4 |
| 8 | Final Selection & Approval | §5.14 | P0 | Offer & Joining > Tab 1 |
| 9 | Candidate Joining | §5.16 | P0 | Offer & Joining > Tab 4 |
| 10 | Candidate 360° Page | §5.18 | P1 | Applicants > Tab 3 |
| 11 | Joining Report | §7.3 | P1 | Offer & Joining > Tab 4 > sub-tab |

#### Missing Masters (19) — add to Masters > HR Masters group

| # | Master | BRD Section | Priority |
|---|---|---|---|
| 1 | Interview Process Master | §13 | P0 — Central config |
| 2 | Interview Level Master | §12.1 | P0 |
| 3 | Interview Type Master | §12.2 | P0 |
| 4 | Interview Criteria Master | §12.3 | P0 (exists, expand) |
| 5 | Interview Score/Weightage Master | §12.4 | P0 |
| 6 | Interview Panel/Interviewer Master | §12.9 | P0 |
| 7 | Document Type Master | §12.5 | P0 |
| 8 | Recruitment Status Master | §12.10 | P0 |
| 9 | Email Template Master | §12.6 | P0 |
| 10 | Offer Letter Template Master | §12.7 | P0 |
| 11 | Appointment Order Template Master | §11 #12 | P1 |
| 12 | Recruitment Approval Matrix | §12.8 | P0 |
| 13 | Joining Approval Matrix | §8 | P0 |
| 14 | Sourcing Channel Master | §10.1 | P1 |
| 15 | BGV Step Master | §10.3 | P1 |
| 16 | SLA Config Master | §10.5 | P1 |
| 17 | Employee ID Config | §9 | P0 |
| 18 | Checklist Master | §7.1 | P1 |
| 19 | Designation Level Master | §12.11 | P1 |

#### Missing Approval Center Items (2)

| # | Screen | BRD Section | Priority |
|---|---|---|---|
| 1 | Final Selection Approval | §5.14 | P0 |
| 2 | Offer Approval | §5.15 | P0 |

---

### 16.7 Existing Masters Already Available (no build needed — reuse)

| Master | Current Location | BRD Use |
|---|---|---|
| Department Master | Masters > Organization | Applicant filter, Interview config |
| Designation Master | Masters > Employee > Designations & Grades | Applicant, Interview config, Offer |
| Levels | Masters > Employee > Levels | Interview level reference |
| Employee Types | Masters > Employee | Offer, Appointment, Internship |
| Employee Categories | Masters > Employee | Offer, Appointment |
| Sites | Masters > Organization > Site Master | Job Posting location |
| Units | Masters > Organization > Branch / Unit | Job Posting location |
| Reporting Structure | Masters > Organization | Reporting Manager assignment |
| JD Master | Masters > HR Masters | Job Posting JD attachment |
| Gratuity Policies | Masters > Payroll & Statutory | Gratuity Form F (§7.4) |
| PF Rates | Masters > System | PF Form 2 (§7.5) |
| ESI Rates | Masters > System | ESI Form 1 (§7.6) |
| Health Insurance Config | Masters > Payroll & Statutory | Insurance Form (§7.7) |

---

### 16.8 Key Architectural Recommendation

The **Interview Process Master** (§13) should be the central configuration point. The other masters are reusable components underneath it:

```
Department + Designation → Interview Process → Levels → Types → Criteria → Weightage → Interviewer → Evaluation → Documents → Approval → Offer → Joining → Employee
```

This makes the Recruitment module scalable when the organization adds new departments, designations, interview rounds, scoring models, or approval policies without requiring a code change.

---

## 17. Cross-Module Dependencies

The following items in this BRD depend on masters/configs/data owned by OTHER HRMS modules. These must be confirmed as external dependencies with an owner and interface before integration.

| # | Dependency | This BRD Section | External Module | External Model (existing in Prisma) | Interface Needed |
|---|---|---|---|---|---|
| 1 | Gratuity Policy config | §7.4 Gratuity Form F | Statutory & Deductions / Payroll | `GratuityPolicy` | Read policy → validate nomination |
| 2 | PF Rate config | §7.5 PF Form 2 | Statutory & Deductions / Payroll | `PfRate` | Read rate → check PF applicability |
| 3 | ESI Rate config | §7.6 ESI Form 1 | Statutory & Deductions / Payroll | `EsiRate` | Read rate → check ESI applicability (salary ≤ ceiling) |
| 4 | Health Insurance config | §7.7 Insurance Form | Statutory & Deductions / Payroll | `HealthInsuranceConfig` | Read config → determine coverage + nominee fields |
| 5 | Salary Structure / CTC | §5.15 Offer, §6.1 Appointment | Payroll | `SalaryStructure`, `EmployeeCtc` | Read CTC → populate offer/appointment letter |
| 6 | Employee Master (push) | §5.17 Push to Employee | Employee Management | `Employee` + sub-models | Write candidate → employee on joining |

> **Removed from dependencies (not Recruitment module):** Probation tracking (Employee Management), Attendance disciplinary (Workforce — was for Warning/Show Cause letters, now removed), Full & Final settlement (Payroll/F&F — was for Service Certificate, now removed), Payroll revision trigger (was for Increment Letter, now removed).
>
> **Action:** Each remaining dependency needs a confirmed owner and API interface contract before the dependent section is built.

---

## 18. Reports & Analytics

| # | Report | Description |
|---|---|---|
| 1 | Recruitment Dashboard | Summary cards + pipeline view |
| 2 | Applicant Pipeline Report | Stage-wise candidate list |
| 3 | Time-to-Hire Report | Avg days by dept/designation/recruiter |
| 4 | SLA Breach Report | Candidates past SLA deadline |
| 5 | Source-wise Report | Applications + conversion by source |
| 6 | Offer Acceptance Report | Accepted/rejected/expired offers |
| 7 | Rejection Report | Rejections by stage/reason |
| 8 | Interviewer Performance | Interviews conducted + scores given |
| 9 | Joining Report | Joined candidates per period |
| 10 | BGV Report | BGV status across candidates |
| 11 | Recruitment Cost Report | Agency cost + referral cost per hire |

---

## 19. Open Items / HOLD List

The following items require input from the BRD owner before development can proceed:

| # | Item | Type | Status | Action Required |
|---|---|---|---|---|
| 1 | Insurance Form | Template + Spec | 🔴 HOLD | Provide template or confirm field structure (§7.7) |
| 2 | Joining Checklist | Template + Spec | 🔴 HOLD | Confirm checklist items + master spec (§7.1) |
| 3 | Other Joining Documents | Template + Spec | 🔴 HOLD | Confirm document types + upload-only vs template (§7.8) |
| 4 | Employee ID Generation Rule | Spec | ⚠️ Partial | Confirm numbering format (§9) |
| 5 | Employee Joining Approval | Spec | ⚠️ Partial | Confirm approval matrix (§8) |
| 6 | Candidate Self-Service Portal | Spec | ⚠️ Partial | Confirm if in scope or future phase (§10.6) |
| 7 | BGV Agency Integration | Spec | ⚠️ Partial | Confirm if internal-only or agency integration needed (§10.3) |
| 8 | Internship Stipend Conditional Logic | Template | ⚠️ Partial | Confirm if interns can be paid stipend — letter template needs conditional (§6.2) |
| 9 | Sourcing Channel Reuse | Architecture | ⚠️ Partial | Confirm reuse of existing social-media-lead-integration pipeline (§10.1) |

> **Removed from this list (not Recruitment module):** Increment Letter (Employee Lifecycle/Payroll), Module Boundary question (resolved — lifecycle letters removed), Signatory Master (cross-cutting, not recruitment-specific), Probation Config Master (Employee Management/Payroll).

---

## Appendix A: Template Inventory (from Kun.zip)

### Recruitment Module Templates

| Template | File | Status |
|---|---|---|
| Offer Letter | Forms/Offer Letter.docx | ✅ Available |
| Appointment Letter | Forms/Appointment Letter.docx | ✅ Available |
| Internship Acceptance | Forms/Internship Acceptance Letter.docx | ✅ Available |
| Internship Completion | Forms/Internship Completion Certificate.docx | ✅ Available |
| Application Form | Forms/Joining Forms/Application form.pdf | ✅ Available |
| Joining Report | Forms/Joining Forms/Joining Report.pdf | ✅ Available |
| Gratuity Form F | Forms/Joining Forms/Gratuity_Nomination_Form F.pdf | ✅ Available |
| PF Form 2 | Forms/Joining Forms/PF_Form2_PF Nomination.pdf | ✅ Available |
| ESI Form 1 | Forms/Joining Forms/ESI_Form 1 Application.pdf | ✅ Available |
| ESI & PF Need Data | Forms/Joining Forms/ESI & PF Need Data.xlsx | ✅ Available |
| Insurance Form | — | 🔴 HOLD |
| Joining Checklist | — | 🔴 HOLD |
| Other Joining Documents | — | 🔴 HOLD |

### Non-Recruitment Templates (exist in zip but NOT this module)

| Template | File | Belongs To |
|---|---|---|
| Confirmation Letter | Forms/Confirmation Letter.docx | Employee Lifecycle |
| Promotion Letter | Forms/Promotion Letter.docx | Employee Lifecycle |
| Internal Job Transfer | Forms/Internal Job Transfer Letter.docx | Employee Lifecycle |
| Designation Change | Forms/Designation Change Letter.docx | Employee Lifecycle |
| Service Certificate (Above JE) | Forms/Service Certificate_Above Junior Engineer Category.docx | Employee Lifecycle |
| Service Certificate (Below JE) | Forms/Service Certificate_Below Junior Engineer Category.docx | Employee Lifecycle |
| Bonafide Certificate | Forms/Bonafide Certificate.docx | Employee Lifecycle |
| Warning Letter | Forms/Warning Letter.docx | Employee Lifecycle / Disciplinary |
| Show Cause Notice | Forms/Showcause Notice.docx | Employee Lifecycle / Disciplinary |

---

## Appendix B: Status Legend

| Symbol | Meaning |
|---|---|
| ✅ | Specified / Template available |
| ⚠️ | Partial — needs confirmation |
| 🔴 HOLD | Template or spec required before development |
| NEW | Not in original Recruitment BRD — added based on gap analysis |

---

**End of Document**
