# Recruitment & Onboarding Module — Implementation Plan

**Date:** 2026-09-13
**Source BRD:** `RECRUITMENT_ONBOARDING_BRD_COMPLETE_2026-09-12.md` (v6.4)
**Scope:** Full Recruitment & Onboarding lifecycle — Manpower Requisition → Employee Creation
**Approach:** Phased delivery — each phase is independently deployable. P0 (must-have for MVP) first, then P1 (enrichment), then HOLD items pending BRD-owner input.

---

## 0. Codebase Baseline (verified 2026-09-13)

| Area | Status | Notes |
|---|---|---|
| Stack | Next.js 16.2.10 (App Router), React 19, Prisma 6.19, zod, pdf-lib, xlsx, Tailwind 4 | `package.json` |
| `JobPosting` model | ✅ Exists (minimal) | `schema.prisma:3908` — title, dept, designation, jdId, status only. Needs extension per §10.7. |
| `JobDescription` master | ✅ Exists (full) | `schema.prisma:3836` — code, dept, designation, versions, tags, sequence. Reuse for JD attachment. |
| Recruitment pages | ⚠️ 1 of 12 | Only `/recruitment/job-postings/page.tsx` exists. Navigation has placeholder routes for the other 11. |
| Recruitment API | ⚠️ 1 of 12 | Only `/api/recruitment/job-postings` exists. |
| HR Masters group | ⚠️ 2 of 21 | Only Interview Criteria (no page) + JD Master (full). 19 more masters needed. |
| Cross-module deps | ✅ Exist | `GratuityPolicy`, `PfRate`, `EsiRate`, `HealthInsuranceConfig`, `SalaryStructure`, `EmployeeCtc` all in schema. Read-only interface needed. |
| Conventions | ✅ | `checkMasterPermission` (rbac-masters), `DataTable`/`ConfirmDialog`/`SearchableSelect` (components/ui), zod schemas in `src/lib/validations/`, `master-code.ts` for auto-codes. |
| Sidebar | ⚠️ Overload risk | Current: 2 groups / 11 items. BRD §16.4 proposes 4 groups with tab-based pages. |

---

## Phase Overview

| Phase | Focus | Items | Dependencies | Deployable? |
|---|---|---|---|---|
| **Phase 1** | Schema foundation — all recruitment models | 30+ Prisma models | None | Yes (DB only) |
| **Phase 2** | Core masters (P0) — interview config + status + email + offer + approval | 10 masters | Phase 1 | Yes |
| **Phase 3** | Applicant pipeline — registration, call interview, dashboard | 4 screens | Phase 2 | Yes |
| **Phase 4** | Interview engine — scheduling, evaluation, panel, document verification | 4 screens | Phase 2, 3 | Yes |
| **Phase 5** | Offer & joining — selection, offer, appointment, joining forms, push to employee | 8 screens | Phase 4 | Yes |
| **Phase 6** | Sidebar restructure — 4-group tab-based pages + Candidate 360° | Navigation + 1 screen | Phase 3–5 | Yes |
| **Phase 7** | Approval Center — Final Selection + Offer approvals | 2 approval screens | Phase 5 | Yes |
| **Phase 8** | Enrichment masters (P1) — sourcing, BGV, SLA, checklist, designation level, appointment template | 6 masters | Phase 2 | Yes |
| **Phase 9** | Cross-cutting — duplicate checks, rejection automation, time-to-hire, workflow automation | Logic only | Phase 3–5 | Yes |
| **Phase 10** | HOLD items — insurance form, joining checklist template, other docs, candidate portal, internship stipend | Pending BRD owner | — | Blocked |

---

## Phase 1 — Schema Foundation

> **Goal:** Define every Prisma model the module needs before any UI/API is written. This phase produces a migration and seed data only. All later phases depend on it.

### Step 1.1 — Extend `JobPosting` (§10.7)

**Why:** Current `JobPosting` has only title/dept/designation/jdId/status. BRD §10.7 requires vacancies, employment type, experience range, salary range, closing date, posted date, created by.

**Files:**
- Edit: `prisma/schema.prisma` (JobPosting model, ~line 3908)

**Fields to add:** `vacancies Int`, `employmentType String?` (Full-time/Part-time/Contract/Intern), `minExperienceYears Decimal?`, `maxExperienceYears Decimal?`, `minSalary Decimal?`, `maxSalary Decimal?`, `closingDate DateTime?`, `locationId Int?` (relation to Site), `postedDate DateTime @default(now())`.

### Step 1.2 — Applicant / Candidate models (§5.3, §5.18)

**Why:** Central entity of the module. Every screen reads/writes a candidate.

**New models:**
- `Candidate` — applicationNo (unique, auto), applicantDate, title, firstName, lastName, mobile, email, dob, aadhaar, departmentId, designationId, sourceChannelId, referenceComments, currentStatusId (→ RecruitmentStatus), jobPostingId?, createdById, deletedAt, timestamps.
- `CandidateDetail` — 1:1 extension for personal fields (blood group, gender, nationality, religion, marital status, address present/permanent, languages, spouse, dependents, references).
- `CandidateDocument` — candidateId, documentTypeId, fileUrl, status (Uploaded/Pending/Verified/Rejected/Re-upload), verifiedById, verifiedAt, remarks, version.
- `CandidateActivityLog` — candidateId, action, fromStatus, toStatus, performedById, remarks, timestamp. (Audit trail for Candidate 360° Activity Log tab.)

### Step 1.3 — Call Interview (§5.4)

**New model:** `CallInterview` — candidateId, recruiterId, callDate, callTime, callOutcome (Connected-Interested / Connected-Not Interested / Call Back / No Response / Not Reachable / Rejected / Proceed), candidateInterested Bool, expectedSalary Decimal?, noticePeriod String?, availableJoiningDate DateTime?, remarks, nextAction.

### Step 1.4 — Interview configuration masters (§12.1–12.4, §12.9, §13)

**New models:**
- `InterviewLevel` — levelCode (unique), levelName, sequence, interviewTypeId, mandatory Bool, minPassingScore Decimal?, maxAttempts Int?, autoProgressNext Bool, allowReinterview Bool, status.
- `InterviewType` — typeCode (unique), typeName, mode (Physical/Online/Phone), durationMins, evaluationRequired Bool, scoreRequired Bool, remarksRequired Bool, interviewerRequired Bool, meetingLinkRequired Bool, locationRequired Bool, status.
- `InterviewCriteria` — criteriaCode (unique), criteriaName, category, departmentId?, designationId?, interviewTypeId, interviewLevelId, scoreType, minScore, maxScore, weightage, mandatory Bool, remarksRequired Bool, status. (Existing "Interview Criteria" nav item — promote to full master.)
- `InterviewScoreConfig` — code, departmentId, designationId, interviewLevelId, interviewTypeId, criteriaId, maxScore, minScore, weightage, passingScore, ratingScale, status.
- `InterviewPanel` — panelCode, departmentId, designationId, interviewLevelId, interviewTypeId, eligibleInterviewerId (→ Employee), status.
- `InterviewProcess` — processName, departmentId, designationId, employmentType?, effectiveFrom, status. (Central config per §13.)
- `InterviewProcessLevel` — processId, interviewLevelId, sequence, mandatory, passScore. (Join table for §13 6-step stepper.)

### Step 1.5 — Interview transactions (§5.7, §5.9, §5.11)

**New models:**
- `InterviewSchedule` — candidateId, interviewLevelId, interviewTypeId, interviewerId (→ Employee), scheduledDate, startTime, endTime, mode, locationOrLink, status (Pending/Scheduled/Completed/Cancelled), processSnapshot Json. (Snapshot per §15.2 — store criteria+weightage at schedule time.)
- `InterviewEvaluation` — scheduleId, criteriaId, score, maxScore, remarks, submittedById, submittedAt. (One row per criteria per schedule.)
- `InterviewEvaluationSummary` — scheduleId, totalScore, weightedScore, result (Pass/Fail/Hold/Re-interview), recommendation, strengths, weaknesses, finalRemarks, calculatedAt.

### Step 1.6 — Document Type + Recruitment Status masters (§12.5, §12.10)

**New models:**
- `DocumentType` — documentCode (unique), documentName, category, mandatory Bool, departmentId?, designationId?, employmentType?, verificationRequired Bool, allowedFileTypes, maxFileSizeMb, multipleFiles Bool, status.
- `RecruitmentStatus` — statusCode (unique), statusName, sequence, stageCategory (Screening/Interview/Verification/Selection/Offer/Joining), isTerminal Bool, allowTransitionTo String[] (or join table), color, status. (Seed 20 statuses from §12.10.)

### Step 1.7 — Email Template + Offer Template masters (§12.6, §12.7)

**New models:**
- `EmailTemplate` — templateCode (unique), templateName, event, subject, body (Max), to, cc, bcc, attachmentUrl?, language, departmentId?, designationId?, status. (Seed 17 templates from §12.6.)
- `OfferTemplate` — templateCode (unique), templateName, departmentId?, designationId?, employmentType, grade?, locationId?, version, effectiveFrom, effectiveTo?, status.

### Step 1.8 — Approval matrices (§8, §12.8)

**New models:**
- `RecruitmentApprovalMatrix` — matrixCode, process (Recruitment/Selection/Offer), departmentId?, designationId?, employmentType?, minSalary Decimal?, maxSalary Decimal?, approvalLevel Int, approverType, approverId, mandatory Bool, sequence, escalationDays Int?, status.
- `JoiningApprovalMatrix` — matrixCode, departmentId?, designationLevelId, approvalLevel Int, approverId, mandatory Bool, sequence, escalationDays Int?, status.
- `DesignationLevel` — levelCode (unique), levelName (Junior/Middle/Senior/Top Management), description, defaultApproverId, status.
- `DesignationLevelMapping` — designationLevelId, designationId. (Many-to-many per §12.11.)

### Step 1.9 — Offer + Appointment + Internship transactions (§5.15, §6.1, §6.2)

**New models:**
- `OfferLetter` — candidateId, offerNo (unique, auto `HRM/OFL/YYYY`), offerTemplateId, status (Draft/Generated/Sent/Accepted/Rejected/Expired/Closed), proposedSalary, ctc, joiningDate, employmentType, reportingManagerId, locationId, probationMonths Int (default 6), generatedPdfUrl?, sentAt, acceptedAt, expiredAt, remarks, createdById, timestamps.
- `AppointmentOrder` — candidateId, apptNo (unique, auto `KAPLHR/Appt/YYYY`), offerLetterId, status (Draft/Generated/Sent/Accepted/Declined/Expired/Closed), generatedPdfUrl?, sentAt, acceptedAt, declinedAt, remarks, timestamps.
- `Internship` — internId (unique, auto), candidateId, college, regNo, course, departmentId, mentorId, trainingStart, trainingEnd, stipend Decimal?, status (Applied/Accepted/Active/Completed/Terminated/Converted/Closed), convertedEmployeeId?, timestamps.

### Step 1.10 — Joining forms (§7.2–7.6)

**New models:**
- `JoiningForm` (Application Form §7.2) — candidateId, applicationNo, postApplied, fatherName, dob, age, gender, nationality, religion, communicationAddress, permanentAddress, experience, languages, educationalQualification, technicalQualification, maritalStatus, email, bloodGroup, mobile, status (Pending/Verified), verifiedById, verifiedAt.
- `JoiningReport` (§7.3) — candidateId, joiningDate, locationId, grade, bloodGroup, designationId, reportedTo, panNo, presentAddress, permanentAddress, contactNumber, emergencyContact, certificatesVerifiedBy, candidateSignatureUrl, reportingAuthoritySignatureUrl, status.
- `GratuityNomination` (§7.4) — candidateId/employeeId, employerRefNo, sex, religion, maritalStatus, department, postHeld, appointmentDate, permanentAddress, employeeSignatureUrl, employerSignatureUrl, witnesses Json, status. + `GratuityNominee` — nominationId, nomineeName, relationship, age, proportion.
- `PfNomination` (§7.5) — candidateId/employeeId, employeeName, aadhaar, mobile, uan, employeeSignatureUrl, status. + `PfNominee` — nominationId, nomineeName, relationship, age, proportion.
- `EsiApplication` (§7.6) — candidateId/employeeId, applicable Bool, ipNumber, mobile, doj, photoUrl, aadhaarMobile, aadhaar, dob, presentAddress, nomineeDetails, bankIfsc, bankAccount, reasonIfNotApplicable, status.

### Step 1.11 — Joining + Employee creation (§5.16, §5.17, §8, §9)

**New models:**
- `CandidateJoining` — candidateId, offerLetterId, joiningDate, joiningStatus (Offer Released/Accepted/Joining Pending/Joining Approval/Joined), actualJoiningDate, remarks, approvalStatus, approverId, approvedAt, approvalRemarks.
- `EmployeeIdConfig` — prefix (default "KUN"), includeYear Bool, includeDepartment Bool, sequenceLength Int (default 4), separator (default "-"), startNumber Int (default 1). (Singleton row.)
- `EmployeeIdSequence` — counter table (similar to `JobDescriptionSequence`).

### Step 1.12 — P1 masters (§10.1, §10.3, §10.5, §7.1)

**New models:**
- `SourcingChannel` — channelCode (unique), channelName, type (External/Internal/Direct/Custom), notes, status.
- `BgvStep` — stepCode (unique), stepName, sequence, status.
- `CandidateBgv` — candidateId, bgvStepId, status (Not Initiated/In Progress/Completed/Failed/On Hold), contactName, contactPhone, performedAt, outcome, remarks.
- `SlaConfig` — stageCode (unique), stageName, slaDays, escalationRole, status.
- `ChecklistMaster` — itemCode (unique), itemName, sourceForm, mandatory Bool, status.

### Step 1.13 — Communication log (§5.5, §5.21)

**New model:** `CommunicationLog` — candidateId, emailTemplateId?, eventType, toEmail, subject, body, sentAt, status (Sent/Failed/Pending), deliveryStatus (Delivered/Bounced), createdById.

### Step 1.14 — Migration + seed

**Files:**
- Run: `npx prisma migrate dev --name recruitment_module_foundation`
- Create: `prisma/seed-recruitment.ts` — seed RecruitmentStatus (20 rows), EmailTemplate (17 rows), SourcingChannel (8 rows), BgvStep (7 rows), SlaConfig (8 rows), ChecklistMaster (15 rows), EmployeeIdConfig (singleton).

**Verify:**
1. `npx prisma migrate dev` succeeds with no drift.
2. `npx prisma studio` shows all new tables.
3. Seed script runs and `RecruitmentStatus` has 20 rows.

---

## Phase 2 — Core Masters (P0)

> **Goal:** Build the 10 P0 master pages + APIs that the transactional screens depend on. Follow the existing master pattern (e.g. `jd-master`).

Each master follows this template (mirroring `src/app/masters/jd-master/` + `src/app/api/masters/jd-master/`):
- Page: `src/app/masters/<master>/page.tsx` — list + create/edit modal using `DataTable`, `ConfirmDialog`, `SearchableSelect`.
- API: `src/app/api/masters/<master>/route.ts` (GET list, POST create) + `[id]/route.ts` (GET, PUT, DELETE soft-delete).
- Validation: `src/lib/validations/recruitment.ts` — zod schemas per master.
- RBAC: extend `src/lib/rbac-masters.ts` permission map.
- Nav: add to `src/components/layout/navigation.ts` HR Masters group.

### Step 2.1 — Interview Process Master (§13) — P0 Central
6-step stepper config: Basic → Levels → Criteria → Panel → Documents → Approval. This is the central config that drives candidate workflow.

### Step 2.2 — Interview Level Master (§12.1) — P0
### Step 2.3 — Interview Type Master (§12.2) — P0
### Step 2.4 — Interview Criteria Master (§12.3) — P0 (expand existing nav item)
### Step 2.5 — Interview Score/Weightage Master (§12.4) — P0
### Step 2.6 — Interview Panel/Interviewer Master (§12.9) — P0
### Step 2.7 — Document Type Master (§12.5) — P0
### Step 2.8 — Recruitment Status Master (§12.10) — P0
### Step 2.9 — Email Template Master (§12.6) — P0
### Step 2.10 — Offer Letter Template Master (§12.7) — P0
### Step 2.11 — Recruitment Approval Matrix (§12.8) — P0
### Step 2.12 — Joining Approval Matrix (§8) — P0
### Step 2.13 — Employee ID Config (§9) — P0 (singleton config screen)

**Verify per master:**
1. `npm run dev`, navigate to `/masters/<master>` — list loads.
2. Create → row appears → edit → soft-delete → row hidden.
3. `npm run lint` clean. `npm run build` succeeds.

---

## Phase 3 — Applicant Pipeline (P0)

> **Goal:** The recruiter's day-to-day entry point — register candidates, call them, see the pipeline.

### Step 3.1 — Recruitment Dashboard (§5.1) — `/recruitment/dashboard`
- 10 summary cards (Total/New/Call Pending/Interview Scheduled/Evaluation Pending/Doc Verification/Selected/Offer Released/Joined/Rejected).
- P1 metrics (Time-to-Hire, Offer Acceptance Rate, Pipeline Aging, SLA Breach) — wire in Phase 9.
- API: `GET /api/recruitment/dashboard` — aggregate counts.

### Step 3.2 — Applicant Pipeline (§5.2, §5.19) — `/recruitment/applicants` (Tab 1)
- Grid with §5.19 columns + §5.19 filters.
- API: `GET /api/recruitment/candidates` — paginated, filterable.

### Step 3.3 — New Applicant Registration (§5.3) — `/recruitment/applicants` (Tab 2)
- Form with §5.3 fields. Department → Designation cascade.
- Duplicate checks (Aadhaar/Email/Mobile) — soft warning (Phase 9 hardens).
- API: `POST /api/recruitment/candidates`, `GET /api/recruitment/candidates/[id]`.

### Step 3.4 — Call Interview (§5.4) — `/recruitment/applicants` (Tab 4)
- Modal/screen with §5.4 fields. On "Proceed to Interview" → auto-create interview comm (Phase 4 wires email).
- API: `POST /api/recruitment/candidates/[id]/call-interview`.

**Verify:**
1. Register a candidate → appears in pipeline with status NEW.
2. Open Call Interview → set outcome "Proceed" → candidate status moves to CALL INTERVIEW.
3. Dashboard counts update.

---

## Phase 4 — Interview Engine (P0)

> **Goal:** Schedule, evaluate, and gate candidates through configured interview levels.

### Step 4.1 — Interview Scheduling (§5.7, §5.9) — `/recruitment/interviews` (Tab 1)
- Load InterviewProcess for candidate's dept+designation.
- Show only eligible interviewers (InterviewPanel filter).
- On schedule: create `InterviewSchedule` with `processSnapshot` (§15.2).
- Auto-send Interview Invitation email (EmailTemplate #3) — wire to CommunicationLog.
- API: `POST /api/recruitment/candidates/[id]/interviews`, `GET /api/recruitment/interviews`.

### Step 4.2 — My Interviews (§5.10) — `/recruitment/interviews` (Tab 2)
- Interviewer's queue (filtered by `x-user-id`).
- API: `GET /api/recruitment/interviews?mine=1`.

### Step 4.3 — Interview Evaluation / Scorecard (§5.11, §5.12) — `/recruitment/interviews` (Tab 3)
- Render scorecard from `processSnapshot` (NOT current master — §15.2).
- Auto-calculate weighted score per §12.4 formula.
- Determine Pass/Fail/Hold/Re-interview.
- On Pass + autoProgressNext → enable next level. On all levels pass → enable Document Verification.
- API: `POST /api/recruitment/interviews/[id]/evaluation`.

### Step 4.4 — Document Verification (§5.13) — `/recruitment/interviews` (Tab 4)
- List required docs from DocumentType (filtered by dept/designation/employment type).
- Upload (reuse `src/lib/file-storage.ts`), verify, reject with reason.
- BGV steps (§10.3) surface here — full BGV logic in Phase 8.
- API: `POST /api/recruitment/candidates/[id]/documents/[docId]/verify`.

**Verify:**
1. Schedule L1 → interviewer sees it in My Interviews.
2. Submit evaluation with passing score → L2 becomes schedulable.
3. Fail L1 → candidate status → REJECTED (if configured) or HOLD.
4. All levels pass → Document Verification tab enabled.

---

## Phase 5 — Offer & Joining (P0)

> **Goal:** Select → Offer → Appointment → Joining forms → Create Employee.

### Step 5.1 — Final Selection & Approval (§5.14) — `/recruitment/offer-joining` (Tab 1)
- Proposed salary, joining date, employment type, reporting manager.
- Route through RecruitmentApprovalMatrix (Phase 7 wires approval Center).
- API: `POST /api/recruitment/candidates/[id]/selection`.

### Step 5.2 — Offer Letter (§5.15) — `/recruitment/offer-joining` (Tab 2)
- Auto-populate OfferTemplate placeholders.
- Generate PDF via `pdf-lib` (reuse pattern from `visitor-pdf.ts`).
- Numbering `HRM/OFL/YYYY` via sequence table.
- Send email → CommunicationLog.
- Status lifecycle: Draft → Generated → Sent → Accepted/Rejected/Expired.
- API: `POST /api/recruitment/candidates/[id]/offer`, `POST /api/recruitment/offers/[id]/send`, `POST .../accept`.

### Step 5.3 — Appointment Order (§6.1) — `/recruitment/offer-joining` (Tab 3)
- Numbering `KAPLHR/Appt/YYYY`.
- PDF generation. Unhappy path: Declined → revert to Offer Pending + notify HR.
- API: `POST /api/recruitment/candidates/[id]/appointment`.

### Step 5.4 — Internship (§6.2) — `/recruitment/internship`
- Acceptance letter + Completion certificate PDFs.
- Intern-to-Employee conversion action.
- Stipend conditional logic — ⚠️ pending BRD owner (Phase 10).

### Step 5.5 — Joining forms (§7.2–7.6) — `/recruitment/offer-joining` (Tab 4 sub-tabs)
- Application Form (§7.2), Joining Report (§7.3), Gratuity Form F (§7.4), PF Form 2 (§7.5), ESI Form 1 (§7.6).
- Each: form capture → PDF generation → link to candidate.
- Gratuity/PF/ESI read config from existing `GratuityPolicy`/`PfRate`/`EsiRate` (cross-module, read-only).
- Insurance Form (§7.7) + Other Documents (§7.8) — 🔴 HOLD (Phase 10).

### Step 5.6 — Joining Approval (§8) — sub-tab
- Approval gate between Offer Accepted → Joined.
- Route through JoiningApprovalMatrix (Phase 7).
- API: `POST /api/recruitment/candidates/[id]/joining-approval`.

### Step 5.7 — Push to Employee (§5.17, §9) — sub-tab
- Map candidate fields → `Employee` model (per §5.17 mapping table).
- Generate Employee ID via EmployeeIdConfig + EmployeeIdSequence.
- Write to Employee master + sub-models.
- Candidate status → EMPLOYEE CREATED.
- API: `POST /api/recruitment/candidates/[id]/create-employee`.

**Verify:**
1. Select candidate → generate offer PDF → email logged.
2. Accept offer → appointment order enabled → generate.
3. Fill joining forms → submit joining approval → approve.
4. Create Employee → appears in Employee Master with generated ID. Candidate status = EMPLOYEE CREATED.

---

## Phase 6 — Sidebar Restructure + Candidate 360°

> **Goal:** Implement BRD §16.4 — collapse 30+ items into 4 groups with tab-based pages.

### Step 6.1 — Restructure navigation (§16.4)
- Edit `src/components/layout/navigation.ts` Recruitment section:
  - `Dashboard` → `/recruitment/dashboard`
  - `Applicants` → `/recruitment/applicants` (4 tabs)
  - `Interviews` → `/recruitment/interviews` (4 tabs)
  - `Offer & Joining` → `/recruitment/offer-joining` (4 tabs + joining sub-tabs)
- Move Job Postings + Internship into Offer & Joining (or keep standalone per §16.4 note).
- Build a reusable `Tabs` component in `src/components/ui` if not present.

### Step 6.2 — Candidate 360° Page (§5.18) — P1
- Single page with header (name, app no, dept, designation, status, action buttons) + 9 tabs (Overview/Personal/Application/Call Interview/Interview/Evaluation/Documents/Offer/Joining/Activity Log).
- Route: `/recruitment/applicants/[id]`.
- Reuse data from Phase 3–5 APIs.

**Verify:**
1. Sidebar shows 4 items under Recruitment (not 11+).
2. Each tab page switches tabs without full reload.
3. Candidate 360° shows full history.

---

## Phase 7 — Approval Center (P0)

> **Goal:** Wire the 2 missing approval screens into the existing Approval Center.

### Step 7.1 — Final Selection Approval (§5.14)
- `/approvals/recruitment/final-selection` — list of pending selections routed via RecruitmentApprovalMatrix.
- Approve/Reject with remarks → triggers Offer Letter eligibility.

### Step 7.2 — Offer Approval (§5.15)
- `/approvals/recruitment/offer` — pending offers per approval matrix.
- Approve → enable offer generation. Reject → notify recruiter.

### Step 7.3 — Joining Approval (§8) — already exists in nav
- `/approvals/recruitment/joining` — wire to JoiningApprovalMatrix.

**Verify:** Approve a selection in Approval Center → candidate becomes offer-eligible in Offer & Joining tab.

---

## Phase 8 — Enrichment Masters (P1)

> **Goal:** Build the 6 P1 masters that add depth but aren't blocking MVP.

### Step 8.1 — Sourcing Channel Master (§10.1) — P1
### Step 8.2 — BGV Step Master (§10.3) — P1
### Step 8.3 — SLA Config Master (§10.5) — P1
### Step 8.4 — Checklist Master (§7.1) — P1
### Step 8.5 — Designation Level Master (§12.11) — P1
### Step 8.6 — Appointment Order Template Master (§11 #12) — P1

Each follows the same master template as Phase 2.

---

## Phase 9 — Cross-Cutting Logic (P0/P1)

> **Goal:** Wire the automation that makes the pipeline self-driving.

### Step 9.1 — Duplicate checks (§10.2) — P0
- On candidate create: check Aadhaar/Email/Mobile across all candidates.
- Soft warning UI with link to existing application. Log decision.

### Step 9.2 — Rejection automation (§10.4) — P0
- Status → REJECTED triggers Rejection email (EmailTemplate #9).
- Configurable per-stage enable/disable.

### Step 9.3 — Workflow automation (§5.21) — P0
- 14 triggers from §5.21 table. Implement as a `recruitment-workflow.ts` lib called on each status transition.
- Includes: auto-enable next level, auto-create interview comm, SLA timer notify, joining checklist trigger.

### Step 9.4 — Time-to-Hire / SLA metrics (§10.5) — P1
- Compute avg days application→joined, stage aging, SLA breach count.
- Surface on Dashboard (Phase 3.1 P1 cards).

### Step 9.5 — Email automation (§5.5, §5.21) — P0
- Wire all 14 notification events from §5.21 matrix to EmailTemplate + CommunicationLog.
- Reuse a `send-recruitment-email.ts` helper.

---

## Phase 10 — HOLD Items (Blocked on BRD Owner)

> **Goal:** These cannot be built until the BRD owner provides templates/specs. Listed here for completeness.

| # | Item | Blocker | BRD Section |
|---|---|---|---|
| 1 | Insurance Form | Template required | §7.7 |
| 2 | Joining Checklist template | Confirm items + master spec | §7.1 |
| 3 | Other Joining Documents | Confirm doc types + upload-only vs template | §7.8 |
| 4 | Employee ID numbering format | Confirm preferred format | §9 |
| 5 | Joining Approval matrix | Confirm approver matrix | §8 |
| 6 | Candidate Self-Service Portal | Confirm in-scope or future phase | §10.6 |
| 7 | BGV agency integration | Internal-only vs agency | §10.3 |
| 8 | Internship stipend conditional | Confirm if interns can be paid | §6.2 |
| 9 | Sourcing channel reuse | Reuse social-media-lead-integration pipeline? | §10.1 |

**Action:** Escalate items 1–9 to BRD owner. Items 4, 5, 8 have proposed defaults in the BRD — confirm to unblock.

---

## Cross-Module Dependencies (confirm before Phase 5)

Per BRD §17, these read-only interfaces are needed and the source models already exist:

| Dependency | Model | Needed For | Interface |
|---|---|---|---|
| Gratuity policy | `GratuityPolicy` | Gratuity Form F (§7.4) | Read policy → validate nomination |
| PF rate | `PfRate` | PF Form 2 (§7.5) | Read rate → check applicability |
| ESI rate | `EsiRate` | ESI Form 1 (§7.6) | Read rate → check salary ≤ ceiling |
| Health insurance | `HealthInsuranceConfig` | Insurance Form (§7.7) | Read config → coverage + nominee |
| Salary structure / CTC | `SalaryStructure`, `EmployeeCtc` | Offer (§5.15), Appointment (§6.1) | Read CTC → populate letter |
| Employee master (write) | `Employee` + sub-models | Push to Employee (§5.17) | Write candidate → employee on joining |

**Action:** Confirm API contracts with owners of Payroll and Employee Management modules before Phase 5.

---

## Verification (per phase)

Each phase must pass before the next begins:
1. `npx prisma migrate dev` — no drift (Phase 1+).
2. `npm run lint` — clean.
3. `npm run build` — succeeds.
4. `npm test` — existing tests green; add vitest specs per new API route.
5. Manual smoke test per phase's "Verify" steps.
6. Update `docs/WORKLOG_*.md` with phase completion.

---

## Build Order Summary (critical path)

```
Phase 1 (Schema) → Phase 2 (Masters) → Phase 3 (Applicants) → Phase 4 (Interviews)
                                          ↓
                                     Phase 5 (Offer/Joining) → Phase 7 (Approvals)
                                          ↓
                                     Phase 6 (Sidebar + 360°)
                                          ↓
                                     Phase 9 (Automation)
                                          ↓
                                     Phase 8 (P1 Masters)

Phase 10 (HOLD) — unblock with BRD owner in parallel
```

**End of Plan**
