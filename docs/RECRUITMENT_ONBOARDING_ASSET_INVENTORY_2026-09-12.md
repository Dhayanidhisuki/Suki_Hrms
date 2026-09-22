# Recruitment & Onboarding — Asset Inventory & Gap Analysis
Generated: 2026-09-12
Sources: `Kun.zip` (extracted), Recruitment BRD (`KUN HRMS Recurtiment - BRD (1).docx`), Main BRD (`KUN HRMS BRD.docx`), Module Overview, Prisma schema, existing code.

---

## 1. What we HAVE — Templates & Field Structures (from Kun.zip)

### 1a. Hiring / Letter Templates (Forms/*.docx) — ACTUAL company templates exist

| Template | File | Numbering | Key Fields |
|---|---|---|---|
| Offer Letter | Forms/Offer Letter.docx | HRM/OFL/2026 | name, designation, location, DOJ, CTC (Rs X Lakhs/Annum), probation 6mo, document checklist (Aadhaar, PAN, bank, certificates, relieving, salary proof, photos, dependents aadhaar) |
| Appointment Order | Forms/Appointment Letter.docx | KAPLHR/Appt/2025 | name, designation, effective date, gross salary, annual CTC, reporting to, allowances annexure, probation 6mo, leave rules, termination (1mo probation / 3mo confirmed), non-compete 3yr, retirement 58, jurisdiction Chennai |
| Internship Acceptance | Forms/Internship Acceptance Letter.docx | — | intern name, college, dept, training start/end, no benefits |
| Internship Completion | Forms/Internship Completion Certificate.docx | — | name, reg no, college, course, period, dept, conduct |
| Confirmation Letter | Forms/Confirmation Letter.docx | — | emp name, emp ID, designation, dept, confirmation date |
| Promotion Letter | Forms/Promotion Letter.docx | — | emp name, emp ID, old→new role, effective date, new responsibilities, reporting manager |
| Internal Job Transfer | Forms/Internal Job Transfer Letter.docx | — | emp name, emp ID, old→new dept, effective date, designation change, report to new HOD |
| Designation Change | Forms/Designation Change Letter.docx | — | emp name, emp ID, old→new designation, effective date, package unchanged |
| Service Certificate | Forms/Service Certificate_Above/Below JE.docx | — | emp name, emp code, DOJ, designation, relieved date, conduct |
| Bonafide Certificate | Forms/Bonafide Certificate.docx | — | emp name, father, DOJ, designation, purpose (e.g. housing loan) |
| Warning Letter | Forms/Warning Letter.docx | — | emp name, emp code, designation, month/absent dates/days, misconduct, explanation demand |
| Show Cause Notice | Forms/Showcause Notice.docx | — | emp name, emp ID, designation, dept, absence period, explanation deadline |

### 1b. Joining Forms (Forms/Joining Forms/*.pdf + xlsx) — field structures exist

| Form | File | Fields |
|---|---|---|
| Application Form | Application form.pdf | App no, post, name, father's name, DOB, age, gender, nationality, religion, communication address, permanent address, experience, languages, education, technical qual, marital status, dependents, email, blood group, mobile, reference |
| Joining Report | Joining Report.pdf | name, location, grade, blood group, designation, joined on, present+permanent address, contact, emergency contact (name+mobile), certificates verified by, reported to, PAN |
| Gratuity Nomination (Form F) | Gratuity_Nomination_Form F.pdf | nominee name+address, relationship, age, proportion; employee statement (name, sex, religion, marital, dept, post, DOJ, permanent address); witnesses; employer cert |
| ESI Form 1 | ESI_Form 1 Application.pdf | IP number, mobile (linked to IP), DOJ, photo, mobile (linked to Aadhaar), Aadhaar, DOB, present address, nominee (name/address/mobile), bank (IFSC/A/c) |
| PF Form 2 | PF_Form2_PF Nomination.pdf | UMANG app, Aadhaar Face RD app, mobile (linked to Aadhaar), Aadhaar, UAN |
| ESI & PF Need Data | ESI & PF Need Data.xlsx | ESI sheet: IP No, mobile, DOJ, photo, aadhaar, DOB, address, nominee, bank. PF sheet: UMANG, Aadhaar Face RD, mobile, Aadhaar, UAN |

### 1c. BRD Coverage (two BRDs exist)

| Document | Covers |
|---|---|
| Recruitment BRD (`KUN HRMS Recurtiment - BRD (1).docx`) | Full applicant pipeline: requisition → sourcing → screening → call interview → multi-level interview → evaluation → doc verification → selection → offer → joining → push-to-employee. 21 sections of detail. |
| Main BRD (`KUN HRMS BRD.docx` §3 "Forms & Certificate") | Lists ALL screens at header level: Hiring (Offer, Appointment, Internship, Joining Checklist) + Employee Lifecycle (Confirmation, Promotion, Transfer, Designation Change, Increment, Service Letter, Bonafide, Warning, Show Cause, Relieving) |
| Module Overview (`HRMS Module Overview.docx` Step 8) | Confirms Talent Acquisition scope: Applicant Registration, Interview, Final Interview, Offer, Appointment Order, Service Letter, Relieving, Increment, Confirmation, Promotion, Transfer, Internship, Designation Change, Bonafide, Show Cause, Warning |

### 1d. Built in code (Prisma + pages)

| Built | Status |
|---|---|
| Job Postings (page + API) | Thin — title, JD link, status only |
| JD Master (model + versioning + tags + sequence) | Complete |
| Department, Designation, EmployeeType, etc. | Complete (reusable masters) |
| Employee + PersonalDetails + KYC + Bank + Experience + Education + Documents | Complete (target of push-to-employee) |
| GratuityPolicy, PfRate, EsiRate, HealthInsuranceConfig | Exist (payroll-side configs, no joining-form screens) |

---

## 2. What we NEED — by screen

Legend: ✅ spec+template ready | ⚠️ template ready, BRD detail thin | ❌ missing

### Hiring group

| Screen | BRD | Template | Schema | Verdict |
|---|---|---|---|---|
| Job Postings (extend) | ✅ §3 | — | ✅ thin | Extend model: vacancies, location, closing date, employment type |
| Manpower Requisition | ✅ §3 | — | ❌ | New model + approval workflow |
| Recruitment Dashboard | ✅ §4.2 | — | ❌ | Summary cards + pipeline view |
| Applicant Registration | ✅ §4.3 | Application form.pdf ✅ | ❌ | Applicant model, auto app-no, dept→desig→criteria cascade |
| Call Interview | ✅ §4.4 | — | ❌ | Call-screening window + outcome |
| Interview Scheduling | ✅ §4.6–4.8 | — | ❌ | Level-based, designation-driven |
| Interviewer Assignment | ✅ §4.9 | — | ❌ | Interview Panel Master |
| Interview Evaluation | ✅ §4.10–4.11 | — | ❌ | Scorecard, weightages, pass/fail |
| Document Verification | ✅ §4.12 | — | ❌ | Doc Type Master + per-doc status |
| Final Selection | ✅ §4.13 | — | ❌ | Selection screen + approval |
| Offer Letter | ✅ §4.14 | Offer Letter.docx ✅ | ❌ | Template master, PDF gen, send, status lifecycle |
| **Appointment Order** | ⚠️ main BRD §3 lists it | Appointment Letter.docx ✅ | ❌ | Template ready; needs numbering (KAPLHR/Appt/YYYY) + screen |
| **Internship** | ⚠️ main BRD §3 lists it | Acceptance + Completion .docx ✅ | ❌ | Templates ready; needs intern model (college, period, dept, no-benefit) |
| Candidate Joining | ⚠️ §4.15 | Joining Report.pdf ✅ | ❌ | Thin BRD; use Joining Report fields |
| Push to Employee | ✅ §4.16 | — | ❌ | Field-mapping + Employee ID rule (❌ undefined) |
| Candidate 360° page | ✅ §4.17 | — | ❌ | Tabbed profile |
| Recruitment Grid + filters | ✅ §4.18 | — | ❌ | Filtered table |
| Status lifecycle | ✅ §4.19 | — | ❌ | State machine |
| Workflow automation | ✅ §4.20 | — | ❌ | Trigger engine (rejection email not wired) |
| Masters (§4.21) | ✅ | — | partial | Interview Level/Type/Criteria/Score/Panel, Doc Type, Status, Email/Offer Template, Approval Matrix |
| Email templates (8) | ✅ §4.5 | — | ❌ | Template master + send logging |

### Joining group

| Screen | BRD | Template | Schema | Verdict |
|---|---|---|---|---|
| Employee Joining | ⚠️ §4.15 | Joining Report.pdf ✅ | ❌ | Use Joining Report 12 fields |
| **Joining Checklist** | ⚠️ main BRD §3 | Offer Letter doc-checklist ✅ | ❌ | Offer letter lists docs to bring; formalize as checklist |
| **Joining Form** | ⚠️ main BRD §3 | Application form.pdf ✅ | ❌ | 19-field application form |
| **Gratuity Form** | ⚠️ main BRD §3 | Gratuity Form F.pdf ✅ | ❌ | Nomination form; GratuityPolicy exists |
| **PF Form** | ⚠️ main BRD §3 | PF Form 2.pdf ✅ | ❌ | Nomination; PfRate exists |
| **Insurance Form** | ⚠️ main BRD §3 | — (config exists) | ❌ | HealthInsuranceConfig exists, no form |
| **ESI Form** | ⚠️ main BRD §3 | ESI Form 1.pdf ✅ | ❌ | Application; EsiRate exists |
| **Other Joining Documents** | ⚠️ §4.16 | — | ❌ | Generic doc upload |
| **Employee Joining Approval** | ❌ | — | ❌ | No approval gate in §4.19 flow |

### Employee Lifecycle (bonus — templates exist, outside recruitment BRD)

| Screen | Template | Verdict |
|---|---|---|
| Confirmation Letter | Confirmation Letter.docx ✅ | Template ready |
| Promotion Letter | Promotion Letter.docx ✅ | Template ready |
| Internal Job Transfer | Internal Job Transfer Letter.docx ✅ | Template ready |
| Designation Change | Designation Change Letter.docx ✅ | Template ready |
| Service Certificate / Relieving | Service Certificate .docx ✅ | Template ready |
| Bonafide Certificate | Bonafide Certificate.docx ✅ | Template ready |
| Warning Letter | Warning Letter.docx ✅ | Template ready |
| Show Cause Notice | Showcause Notice.docx ✅ | Template ready |

---

## 3. Revised bottom line

The zip **closes most of the gap** I flagged earlier. The situation is far better than the Recruitment-only BRD suggested:

- **Templates exist for ALL letter screens** (Offer, Appointment, Internship, Confirmation, Promotion, Transfer, Designation Change, Service, Bonafide, Warning, Show Cause).
- **Field structures exist for ALL joining forms** (Application 19 fields, Joining Report 12 fields, Gratuity Form F, ESI Form 1, PF Form 2).
- **The main BRD §3 explicitly lists** every screen under "Forms & Certificate — Hiring" and "Employee Lifecycle".

### What's truly still missing (blockers):
1. **Employee ID generation rule** — §4.16 says "generates Employee ID" with no numbering logic.
2. **Employee Joining Approval** — no approval gate in the §4.19 status flow.
3. **Insurance Form template** — no actual form template (only HealthInsuranceConfig exists).
4. **Detailed BRD specs** for the joining forms — we have templates/fields but no workflow/automation/status spec per form.
5. **Sourcing channels, BGV, time-to-hire, candidate portal** — still absent (lower priority).

### What we can build NOW (no blocker):
- Entire applicant pipeline (Job Postings → Applicant → Interview → Offer)
- Offer Letter, Appointment Order, Internship (templates + BRD ready)
- All joining forms (templates + field structures ready)
- All employee lifecycle letters (templates ready)
