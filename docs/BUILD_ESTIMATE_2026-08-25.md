# KUN / Suki HRMS — Management Areas & Build Estimate

**Date:** 25 August 2026
**Basis:** BRD sidebar (14 modules, 203 screens) + legacy ERP analysis (`ERP_SCHEMA_ANALYSIS_2026-08-25.md`) + current codebase state
**Purpose:** Identify every management area the system must deliver, and estimate the effort transparently — including what the estimate depends on and what would change it.

---

## How to read this estimate

**Unit:** one developer-day = one developer working one full day on this project.

**What a day estimate includes:** database model, API, UI screen, validation, role-based access, and developer self-testing.

**What it excludes** (added separately in section 4): QA testing, UAT cycles, bug fixing, project management, requirement clarification meetings, deployment, training and documentation.

**Confidence levels used:**

| Level | Meaning |
|---|---|
| **High** | Pattern already built in this codebase, or fully specified by the ERP schema. Estimate should hold within 20%. |
| **Medium** | Structure known, business rules partly unknown. Estimate could move 30-50%. |
| **Low** | Business rules unknown. The number is a placeholder until the client answers. Could double. |

**Current baseline:** 21 of 203 screens exist (20 master CRUD screens + employee profile). Shared components already built: `DataTable`, `FormModal`, `ConfirmDialog`, `Field`, `SimpleMasterPage`, `SlabPage`, app shell, navigation, authentication. This materially reduces the cost of every remaining master screen and is reflected below.

---

## 1. The 32 management areas

### Foundation

| # | Management area | Screens | Days | Confidence | Reasoning |
|---:|---|---:|---:|---|---|
| 1 | **Organization Management** | 10 | 8-10 | High | 6 of 10 masters already exist. New work: Company model, Branch/Unit model, `Level.rank`, reporting structure screen, org chart visualization. Org chart is the only non-trivial piece. |
| 2 | **User & Access Management** | 4 | 10-12 | Medium | `Role`, `Permission`, `RolePermission` exist but page-level permissions do not. Must map 203 navigation nodes to permission records and enforce on both route and API. ERP proves the client expects module > submodule > page granularity. |
| 3 | **Approval Management** | 15 | 12-15 | High | ERP hands us the design: generic config table + running requests with polymorphic reference. Build the engine once (5 days), then 15 Approval Center views reusing one component. Every other module depends on this, so it must come early. |
| 4 | **Audit & Security Management** | 3 | 8-10 | Medium | Audit log table and write interceptor, session policy, password policy, field-level masking for salary data. BRD names audit logging but does not scope who reads it or retention. |

**Foundation subtotal: 38-47 days**

### Employee lifecycle

| # | Management area | Screens | Days | Confidence | Reasoning |
|---:|---|---:|---:|---|---|
| 5 | **Employee Management** | 13 | 12-15 | High | Employee CRUD and 11 related models already exist. Remaining work is the profile tab screens: contact, dependents, education, experience, assets, documents, JD, KPI/KRA. Repetitive, well-understood. |
| 6 | **Recruitment Management** | 12+ | 18-22 | Low | BRD shows only offer letter onward, but the ERP runs a full candidate > interview > verification > induction pipeline. Screen count is uncertain until the client confirms scope. If recruitment truly starts at offer stage, this drops to 8-10 days. |
| 7 | **Joining / Onboarding Management** | 8 | 8-10 | Medium | Joining checklist plus 6 statutory forms (Gratuity, PF, Insurance, ESI, other). Each is a printable form — needs a PDF template engine, which is built once here and reused by items 8, 11 and 27. |
| 8 | **Lifecycle Management** | 5 | 8-10 | High | Confirmation, transfer, promotion, designation change, increment. Each writes a new versioned `JobInfo` row and raises an approval. `JobInfo` versioning already exists, so this is mostly workflow wiring. |
| 9 | **Letters & Certificate Management** | 5 | 6-8 | High | Service letter, bonafide, warning, show cause, memo. Template + merge fields + PDF. Cheap once item 7 has built the template engine. |
| 10 | **Separation Management** | 6 | 8-10 | Medium | Resignation request (missing from BRD, present in ERP), exit form, exit interview, no due, relieving letter. Must hand off cleanly to Full & Final settlement in payroll. |

**Employee lifecycle subtotal: 60-75 days**

### Time and attendance

| # | Management area | Screens | Days | Confidence | Reasoning |
|---:|---|---:|---:|---|---|
| 11 | **Shift & Holiday Management** | 6 | 10-12 | Medium | Shift master and OT plans exist. New: holiday master (typed), weekly off configuration, and the shift roster — a per-employee per-day grid for a whole month. The roster grid is the expensive part. |
| 12 | **Attendance Management** | 8 | 25-30 | Low | The single hardest non-payroll area. eSSL device integration, punch pairing, night shifts crossing midnight, per-employee grace minutes, LOM in minutes, half-day thresholds, on-duty, mis-punch correction, mobile attendance with geolocation and photo, and the Time Office Final lock. Almost none of the rules are documented yet. |
| 13 | **Leave Management** | 7 | 15-18 | Low | 7 leave types (EL, CL, SL, AL, PL, SO, WFH), each with its own accrual, eligibility, carry-forward bucket and encashment rule. The accrual engine is the risk: monthly vs annual, pro-rata for joiners and leavers, lapse rules. None confirmed. |
| 14 | **Overtime Management** | 3 | 8-10 | Medium | ERP gives the formula shape — percentage by salary band and by day type. Unknowns: the base (basic or gross) and the divisor. Structure is clear, arithmetic is not. |
| 15 | **Comp-Off & Permission Management** | 4 | 6-8 | Medium | ERP shows comp-off links a worked date to a comp-off date and is consumed in minutes. Permission needs a monthly free allowance and a conversion rule once exceeded — not yet stated. |

**Time and attendance subtotal: 64-78 days**

### Compensation

| # | Management area | Screens | Days | Confidence | Reasoning |
|---:|---|---:|---:|---|---|
| 16 | **Salary Structure Management** | 6 | 15-18 | Medium | Salary component master, salary logic (which components feed gross, net, PF base, ESI base), employee salary structure with effective dating, CTC build-up including employer contributions, and salary revision triggering arrears. Structure is well-mapped by the ERP. |
| 17 | **Payroll Processing Engine** | 9 | 30-40 | Low | The largest single item. Monthly run covering: entitled vs earned pro-rating, LOP and LOM, paid days, OT by day type, incentives, all deductions, statutory, rounding, plus period locking, re-run and reversal. **This estimate is unreliable until the payroll formula sheet arrives** — it is the difference between 30 days and 60. |
| 18 | **Statutory Management** | 5 | 15-20 | Low | PF (with per-employee configuration: statutory, fixed, or custom percentage), ESI with threshold and mid-period exit handling, Professional Tax, TDS, and Tamil Nadu LWF — plus the return formats. Rules are statutory and knowable, but the client's specific choices are not documented. |
| 19 | **Deduction Management** | 7 | 8-10 | High | Health insurance, loan recovery, canteen, mobile, travel, lunch, snacks, other. Mostly simple per-month entry screens feeding the payroll run. Canteen is fed automatically from eSSL token logs. |
| 20 | **Loan Management** | 4 | 8-10 | High | ERP defines the whole cycle: loan master with min/max limits > apply > approve > issue with instalment schedule > EMI recovery. Well-specified, straightforward to build. |
| 21 | **Income Tax Management** | 4 | 12-15 | Medium | Investment declaration (27 categories in the ERP), actual proof submission, annual projection, monthly TDS, old vs new regime. Well-structured but arithmetically fiddly and must be right. |
| 22 | **Contract Labour Payroll** | 4 | 10-12 | Low | A second, separate payroll engine computing per-day basic and HRA with a contractor service charge. Not mentioned in the BRD at all — scope must be confirmed before this is committed. |
| 23 | **Benefits & Incentive Management** | 4 | 10-12 | Low | Canteen token, petrol allowance, performance incentive, and the double-machine incentive. The last one reads machine allocation and production data from the manufacturing ERP — a cross-system dependency with real integration risk. |
| 24 | **Payroll Output Management** | 5 | 10-12 | Medium | Individual and bulk payslip PDF, payroll summary, bank transfer file, reconciliation. The bank file format is bank-specific and not yet supplied. |

**Compensation subtotal: 118-149 days**

### Supporting modules

| # | Management area | Screens | Days | Confidence | Reasoning |
|---:|---|---:|---:|---|---|
| 25 | **Document Management** | 6 | 10-12 | Medium | Documents are generated inside their own modules; this layer indexes and centralizes them with search, preview, download and access control. Depends on every producing module existing first. |
| 26 | **Learning & Development** | 5 | 10-12 | Medium | Competency management, skill matrix, skill levels, yearly training plan, training calendar. ERP also tracks training scores and feedback, which the BRD omits. |
| 27 | **Visitor & Gate Management** | 3 | 8-10 | Medium | Gate inward, gate outward, visitor pass with approval. ERP version includes photo capture at check-in and check-out, food and kit allocation. Self-contained, low dependency. |
| 28 | **Compliance Management** | 6 | 12-15 | Medium | Tamil Nadu Factories Rules Forms 25, 15, 25B, 25C, 21, 22. Layouts are statutorily fixed, so effort is precise formatting rather than logic — but every form depends on attendance, leave and payroll being complete and correct. Must be built last. |
| 29 | **Employee Self Service** | 10 | 12-15 | Medium | Attendance view, leave, permission, mis-punch requests, employee dashboard, profile update, document and payslip download, visitor pass request. Must work well on mobile, which is where most of the effort goes. |
| 30 | **Reports Management** | 36 | 30-35 | Medium | Build a shared report framework first (filters, grouping, export to Excel and PDF, print) at roughly 5 days, then approximately 0.75 days per report. Several finance reports have no data source yet — Project Cost in particular has neither a project master nor an allocation table. |
| 31 | **Dashboard Management** | 10 | 8-10 | High | 10 KPI views over data the other modules already produce. Chart components and the card system already exist. |
| 32 | **Notification Management** | 3 | 8-10 | Medium | Email and WhatsApp configuration plus the event triggers. Cost scales with how many business events need notifying — not yet listed by the client. |

**Supporting subtotal: 88-109 days**

### Cross-cutting

| # | Management area | Screens | Days | Confidence | Reasoning |
|---:|---|---:|---:|---|---|
| — | **Data Migration** | — | 15-20 | Low | Extract, transform and load from the ERP: employee master, attendance history, leave balances, payroll history, documents. Scope is entirely unknown — how many years, how many units. A mid-year go-live additionally requires year-to-date import for TDS and PF, which is a feature in its own right. |

---

## 2. Totals

| Group | Days (low) | Days (high) |
|---|---:|---:|
| Foundation | 38 | 47 |
| Employee lifecycle | 60 | 75 |
| Time and attendance | 64 | 78 |
| Compensation | 118 | 149 |
| Supporting modules | 88 | 109 |
| Data migration | 15 | 20 |
| **Development subtotal** | **383** | **478** |

---

## 3. Where the effort actually sits

| Area | Share of development effort |
|---|---:|
| Compensation (payroll, statutory, salary, tax) | 31% |
| Supporting modules (reports, ESS, documents, compliance) | 23% |
| Time and attendance | 17% |
| Employee lifecycle | 16% |
| Foundation | 10% |
| Data migration | 4% |

**Four items alone account for roughly 30% of the build:** Payroll Processing (30-40), Reports (30-35), Attendance (25-30), and Statutory (15-20). Three of those four are Low confidence.

---

## 4. Non-development effort

These are real costs and are not in the 383-478 figure.

| Activity | Basis | Days |
|---|---|---:|
| QA and test cycles | 20% of development | 77-96 |
| UAT support and rework | 10% of development | 38-48 |
| Project management and client meetings | 10% of development | 38-48 |
| Deployment, environment setup, go-live | Fixed | 10-15 |
| Training and documentation | Fixed | 10-15 |
| **Non-development subtotal** | | **173-222** |

### Total effort

| | Days |
|---|---:|
| Development | 383-478 |
| Non-development | 173-222 |
| **Total** | **556-700 developer-days** |

---

## 5. Calendar duration

Effort is not duration. Duration depends on team size and how much can run in parallel.

| Team size | Effective days/dev/week | Working days | Calendar (at 21 working days/month) |
|---:|---:|---:|---|
| 2 developers | 4 | 70-88 weeks | **16-20 months** |
| 3 developers | 4 | 46-58 weeks | **11-13 months** |
| 4 developers | 4 | 35-44 weeks | **8-10 months** |
| 5 developers | 4 | 28-35 weeks | **7-8 months** |

**Why 4 effective days per week rather than 5:** meetings, code review, clarification, context switching and unplanned support. Estimating at 5 is the most common cause of schedule overrun.

**Why more developers does not scale linearly beyond 5:** the dependency chain is real. Approvals block eight modules. Attendance blocks leave, overtime and payroll. Payroll blocks statutory, outputs, compliance and half the reports. Adding a sixth or seventh developer produces waiting, not throughput.

**Recommended: 4 developers, 8-10 months** to a complete system.

---

## 6. Suggested phasing

Order is set by dependency, not by preference.

| Phase | Contents | Days | Cumulative |
|---|---|---:|---:|
| **1. Foundation** | Organization, User & Access, Approval engine, Audit | 38-47 | 47 |
| **2. Employee core** | Employee, Lifecycle, Letters, Separation, Onboarding | 42-53 | 100 |
| **3. Time** | Shift & Holiday, Attendance, Leave, Overtime, Comp-Off | 64-78 | 178 |
| **4. Pay** | Salary Structure, Payroll Engine, Statutory, Deductions, Loans, Tax, Outputs | 98-125 | 303 |
| **5. Extended** | Recruitment, Contract Payroll, Benefits, ESS, Documents | 58-71 | 374 |
| **6. Output & compliance** | Reports, Dashboards, Compliance forms, L&D, Visitor, Notifications | 76-92 | 466 |
| **7. Migration & go-live** | Data migration, deployment, training | 25-35 | 501 |

**First usable release** arrives at the end of Phase 4 — an organization that can hire, manage, track attendance and run payroll. That is roughly 300-380 development days, or **6-8 months with 4 developers**.

---

## 7. What would change these numbers

Stated plainly, because these estimates are only as good as their assumptions.

### Assumptions made

1. The current stack continues: Next.js, Prisma, SQL Server, the existing component library.
2. Developers are familiar with the stack and need no ramp-up.
3. The client answers questions within a few days, not weeks.
4. Requirements do not expand beyond the 203-screen sidebar plus the confirmed gaps.
5. One production unit at go-live.
6. eSSL provides a usable integration path — API, database or file export.

### Risks that would increase the estimate

| Risk | Impact |
|---|---|
| **Payroll formulas remain undocumented** | Payroll Engine could go from 30 to 60 days. Highest single risk in the project. |
| **Multiple units go live together** | Statutory registers, compliance forms and payroll all multiply. Add 15-25%. |
| **Full recruitment pipeline is in scope** | Add 10-12 days over the BRD-only reading. |
| **Contract labour payroll is confirmed** | Already counted at 10-12, but a second statutory treatment could double it. |
| **Double-machine incentive needs live production data** | Cross-system integration; add 8-15 days and a dependency on the ERP team. |
| **Bank file format is non-standard** | Each additional bank format costs 2-3 days. |
| **Mid-year go-live** | Year-to-date import for TDS and PF: add 10-15 days. |
| **Attendance rules turn out to be per-department or per-category** | Add 10-15 days to Attendance alone. |

### What would reduce the estimate

| Opportunity | Saving |
|---|---|
| Client supplies the payroll workbook with formulas | Removes the largest uncertainty; may cut 10-15 days of rework |
| Client supplies a master-data export | Removes guesswork across Topics 1, 3 and 5; saves 5-8 days |
| Recruitment confirmed as offer-stage only | Saves 10-12 days |
| Contract labour payroll deferred to phase 2 | Saves 10-12 days |
| Reports reduced from 36 to the 15 actually used | Saves 15-18 days |
| Compliance forms deferred until after first payroll | No saving, but removes go-live risk |

---

## 8. Honest statement of confidence

Of 32 management areas: **8 are High confidence, 15 Medium, 9 Low.**

The Low-confidence items — Attendance, Leave, Payroll Engine, Statutory, Recruitment, Contract Payroll, Benefits, Data Migration — account for roughly **40% of the total development estimate**.

This means the current range of 383-478 development days should be read as **indicative, not committed**. A commitment-grade estimate is possible once the client supplies:

1. The payroll formula sheet or a completed payroll month with payslips.
2. A master-data export from the ERP.
3. Answers to the attendance and leave rule questions in `REQUIREMENTS_DECISIONS.md`.

With those three inputs, the range should narrow to within roughly 15%.
