# Masters Module — Completion Plan

**Date:** 25 August 2026
**Question answered:** with full master details and a complete requirements document, how much of the Masters layer can be built?

**Answer: all of it.** Masters are pure structure — they depend on knowing *what fields and values exist*, not on knowing calculation rules. Complete master data plus a complete requirements document removes every blocker for this layer.

---

## 1. Scope of the Masters layer

Combining the BRD sidebar with the masters the legacy ERP proves are in use:

| Status | Count |
|---|---:|
| Built and working today | 19 |
| Identified but not built | 28 |
| **Total masters in scope** | **47** |

The 28 remaining split into 5 from the BRD sidebar and 23 that the ERP analysis surfaced as required but absent from the BRD.

---

## 2. Built today (19)

Departments, Sub Departments, Units, Designations, Employee Types, Employee Categories, Grades, Levels, Shift Master, Shift Plans, OT Plans, Leave Master, Loan Types, TDS Slabs, Professional Tax Slabs, ESI Rates, PF Rates, Asset Masters, Dropdown Master.

All use the shared `SimpleMasterPage` / `SlabPage` components, which is why the remaining ones are cheap.

---

## 3. Remaining masters (28)

### From the BRD sidebar (5)

| Master | Days | Notes |
|---|---:|---|
| Branches / Sites | 1.5 | Relational to Company; carries GSTIN and state per the ERP |
| Reporting Structure | 2.0 | Must support 4 manager types (home, business, HR, reviewing) |
| Income Tax Slabs | 0.75 | Likely a duplicate of TDS Slabs — confirm before building |
| Interview Criteria | 1.0 | Criteria + weighting, feeds the interview process |
| JD Master | 1.5 | Rich text + versioning + link to designation |

**Subtotal: 6.75 days**

### Surfaced by the ERP analysis (23)

| Master | Days | Why it is needed |
|---|---:|---|
| Company | 2.0 | ERP is multi-company; GSTIN, PAN, CIN, state, bank, logo, templates |
| Salary Logic | 2.0 | Maps components to gross / net / PF base / ESI base with signs |
| Salary Component | 1.5 | Configurable components with custom labels |
| Holiday Master | 1.5 | Year, date, holiday type; calendar view |
| Weekly Off Configuration | 1.5 | Varies by unit, department or shift in manufacturing |
| Designation-Level Salary | 1.5 | ERP stores BASIC / HRA / BASKET_ALLOW per level |
| Approval Workflow Config | 3.0 | Per transaction type, per department, per level, multiple approvers |
| OT Slab | 1.0 | Percentage by salary band and day type |
| Attendance Location | 1.0 | Geofence coordinates and radius for mobile attendance |
| Training / Course | 1.0 | Course catalogue with scoring |
| Competency Details | 0.75 | Competency items under each category |
| LWF Slab | 0.75 | Tamil Nadu Labour Welfare Fund |
| Bank Master | 0.75 | Required for the bank transfer file |
| Document Type | 0.75 | Drives the document repository taxonomy |
| Employee Class | 0.5 | Fourth classification axis in the ERP |
| Employee Sub-Category | 0.5 | Fifth classification axis in the ERP |
| Leave Validate | 0.5 | Minimum notice days per leave type |
| TDS Section | 0.5 | TDS sections list |
| Asset Category | 0.5 | Groups assets for allocation |
| Competency Category | 0.5 | Top level of the competency tree |
| Skill Master | 0.5 | Named skills for the skill matrix |
| Skill Levels | 0.5 | Proficiency scale |
| Visitor / Gate Pass Type | 0.5 | Visitor classification |

**Subtotal: 23.5 days**

**Screen development total: 30.25 days**

---

## 4. Supporting work

| Activity | Days | Notes |
|---|---:|---|
| Prisma models and migration | 3-4 | Approximately 20 new models, plus `Level.rank` and `Designation.levelId` |
| Seed master data from the ERP export | 3-4 | Transform and load the client's actual values |
| RBAC wiring for the new screens | 2 | Register 28 nodes in the permission model |
| QA and fixes | 8 | 20% of development |
| **Supporting subtotal** | **16-18** | |

---

## 5. Totals

| | Days |
|---|---:|
| Screen development | 30 |
| Supporting work | 16-18 |
| **Total to complete the Masters layer** | **46-48 developer-days** |

### Calendar

| Team | Duration |
|---|---|
| 1 developer | 11-12 weeks |
| 2 developers | 6-7 weeks |
| **3 developers** | **4-5 weeks** |

Masters parallelize well — screens are largely independent of one another — so extra developers give close to linear benefit here, unlike the payroll or attendance work.

---

## 6. Optional reduction

Eight of the small masters are simple code-and-name lookups with no extra fields:

Employee Class, Employee Sub-Category, Leave Validate, TDS Section, Asset Category, Skill Levels, Document Type, Visitor Type.

The project already has a generic **Dropdown Master**. Routing these eight through it instead of building dedicated screens:

- Saves approximately **4 developer-days**
- Reduces dedicated master screens from 47 to 39
- Trade-off: they lose their own validation and become harder to extend later if a field needs adding

Recommended for genuinely fixed lists; not recommended for Leave Validate, which carries a numeric rule and is likely to grow.

---

## 7. What "complete details" must actually contain

For this estimate to hold, the master data and requirements need to supply, per master:

1. **Field list** — every column, its type, length, and whether it is mandatory.
2. **The actual values in use** — the real departments, designations, categories, classes, leave types and salary components, not examples.
3. **Validation rules** — uniqueness, allowed ranges, code formats.
4. **Relationships** — which masters depend on which (sub-department belongs to department, branch belongs to company, level maps to designation).
5. **Effective dating** — which masters change over time and must retain history. Rate and slab masters almost certainly do; PF and ESI rates change by notification, and payroll for a past month must use the rate in force then.
6. **Who may edit each master** — masters drive payroll, so edit rights matter.

Item 5 is the one most often missed and the most expensive to retrofit. If rate masters need history, that decision must be made before they are built, not after.

---

## 8. Why this is worth doing first

Masters are the lowest-risk, highest-leverage work available right now:

- **No dependency on unknown formulas.** Every other Low-confidence area — payroll, attendance, leave, statutory — is blocked on rules the client has not yet supplied. Masters are not.
- **They unblock everything else.** Attendance cannot be built without shift, holiday and weekly-off masters. Payroll cannot be built without salary component and salary logic masters. Approvals cannot be configured without the workflow master.
- **They are demonstrable.** 47 working screens with the client's real data is something they can log into and validate, which surfaces requirement errors early and cheaply.
- **The estimate is High confidence.** The pattern is already built in this codebase and 19 screens already prove it.

At 4-5 weeks with 3 developers, completing the Masters layer converts roughly 10% of the total project into finished, verifiable work while the payroll and attendance questions are still being answered.
