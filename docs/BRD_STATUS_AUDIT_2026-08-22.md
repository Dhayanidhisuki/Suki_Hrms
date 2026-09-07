# KUN HRMS — BRD Status Audit

**Audit date:** 22 August 2026  
**Repository:** <https://github.com/roshinisuki/Suki_hrms.git>  
**Audited baseline:** `origin/main` at `9bd92db`

## Audit basis

This audit is based on:

- A fresh `git fetch --all --prune` and inspection of every remote branch tip.
- The Prisma schema from every distinct branch version.
- `docs/feature-prisma-base-worklog.md`, `docs/worklog_2026_07_17.md`, and `DECISIONS_PENDING_REVIEW.md` wherever present on any branch.
- The supplied KUN HRMS BRD document.
- Actual page and API source, rather than filenames or worklog claims alone.
- A direct lint and production-build run on `main`.

Terminology used below:

- **Verified:** Directly present in code, schema, or commit history.
- **Documented claim:** Stated by a worklog but not independently reproducible from committed repository artifacts.
- **Inference:** An interpretation of the verified evidence, explicitly identified as such.

## Executive status

`main` is technically buildable but is not an operational HRMS application.

Directly verified on `main`:

- `npm run lint` completes with one unused-variable warning.
- `npm run build` succeeds when Google Fonts is reachable.
- The generated application exposes only:
  - `/` — unchanged Next.js starter page.
  - `POST /api/auth/login` — skeleton authentication accepting any non-empty credentials.
  - `GET /api/protected/test` — RBAC demonstration endpoint.
- `main` contains 22 active Prisma models limited to master definitions and RBAC.
- No UI for a BRD module is merged.
- No Prisma migration directory is committed.
- Next.js reports that `middleware.ts` is deprecated in favor of the `proxy` convention.
- Dependency installation reports nine high-severity audit findings.

Substantial Masters, Employees, real authentication, and layout work exists, but only on unmerged remote branches.

## 1. Remote branch audit

Only `dev` and `feature/prisma-base` are ancestors of `main`. Every other feature branch is unmerged.

| Remote branch | Last commit | Merged into `main` | What it contains that `main` does not |
|---|---|---:|---|
| `origin/main` | `9bd92db` — Merge PR #1 from `feature/prisma-base` | Y | Current baseline: 22 Prisma models, slab triggers, RBAC/auth skeleton, starter page |
| `origin/dev` | `ec94149` — Add project title to README.md | Y | Nothing; fully contained in `main` |
| `origin/feature/prisma-base` | `4061fc3` — Prisma base schema + RBAC auth skeleton | Y | Nothing; fully contained in `main` |
| `origin/feature/layout-shell` | `569ede8` — responsive app shell with theme system | N | App shell, sidebar, top bar, theme toggle, spinner, placeholder dashboard |
| `origin/feature/shared-crud-components` | `ad1f2d4` — shared CRUD UI components | N | Layout shell plus `DataTable`, `FormModal`, `ConfirmDialog`, `Field`, and spinner |
| `origin/feature/master-setup-crud` | `18792cd` — 9 additional master CRUD tables | N | Full CRUD UI/API for 19 master tables, shared components, layout shell |
| `origin/feature/rbac-master-wiring` | `bfee025` — RBAC checks for all master routes | N | Master CRUD plus route-level permissions, RBAC seed API, middleware changes |
| `origin/feature/employee-master-models` | `c8a8710` — employee decisions resolved/grayscale UI | N | 11 employee-related Prisma models and employee list/create/view/edit/delete UI/APIs |
| `origin/feature/employee-master-doc-tracking` | `7f17f61` — document expiry/KPI-JD UI | N | Employee work plus document metadata add/delete APIs, expiry calculations, and KPI/JD metadata UI |
| `origin/feature/auth-login` | `5449234` — Suki rename on auth branch | N | Employee CRUD plus real `User` authentication, login/logout/seed-user APIs and login page; no Masters CRUD |
| `origin/chore/rename-kun-to-suki` | `4b25e65` — rename KUN to Suki | N | Broad integration branch containing Masters CRUD, RBAC wiring, Employee CRUD, real authentication, layout, and renamed branding; lacks later document tracking |

### Branch topology

- `layout-shell` → `shared-crud-components` → `master-setup-crud` → `rbac-master-wiring` → `chore/rename-kun-to-suki`.
- Employee work developed separately from the Masters chain, then older employee work was incorporated into `auth-login` and `chore/rename-kun-to-suki`.
- `employee-master-doc-tracking` contains newer employee document work absent from the broad integration/rename branch.

## 2. Prisma models on any branch

### Models merged to `main`

These 22 active models exist on `main` and its descendant feature branches:

| Area | Models |
|---|---|
| Organization/Masters | `Department`, `SubDepartment`, `Designation`, `EmployeeType`, `Category`, `Unit`, `Grade`, `Level` |
| Payroll/statutory definitions | `TDSSlab`, `ProfessionalTaxSlab`, `EsiRate`, `PfRate` |
| Workforce definitions | `ShiftMaster`, `ShiftPlan`, `OTPlan`, `LeaveMaster` |
| Other definitions | `DropdownMaster`, `LoanType`, `AssetMaster` |
| RBAC | `Role`, `Permission`, `RolePermission` |

`Site` appears only as a commented-out model and is therefore not an active Prisma model or database table.

### Unmerged Employee models

These models exist on `feature/employee-master-models`, `feature/employee-master-doc-tracking`, `feature/auth-login`, and `chore/rename-kun-to-suki`, but are not merged to `main`:

- `Employee`
- `PersonalDetails`
- `JobInfo`
- `SalaryStructure`
- `EmployeeBankDetail`
- `EmployeeDependent`
- `EmployeeExperience`
- `EmployeeEducation`
- `EmployeeDocument`
- `EmployeeAssetAllocation`
- `ExitInterview`

### Unmerged authentication model

`User` exists only on `feature/auth-login` and `chore/rename-kun-to-suki`.

The union across all branches is **34 active Prisma models: 22 merged and 12 unmerged**.

## 3. Implemented pages and APIs

Scaffold and explicitly marked placeholder pages are excluded from “implemented.”

### `main`, `dev`, and `feature/prisma-base`

- `POST /api/auth/login`
  - Skeleton only.
  - Accepts any non-empty username/password.
  - Creates an admin role/test permission and returns a JWT.
- `GET /api/protected/test`
  - RBAC demonstration endpoint.

The `/` page is the standard Next.js starter page. No HRMS module page exists.

### `feature/layout-shell`

Adds an app shell, sidebar, top bar, theme toggle, and spinner. It is not counted as a Dashboard implementation because the source explicitly identifies the dashboard content/stat cards, navigation, search, and user avatar as placeholders.

### `feature/shared-crud-components`

Adds reusable `DataTable`, `FormModal`, `ConfirmDialog`, `Field`, and `Spinner` components. It does not add a business route beyond the placeholder shell.

### `feature/master-setup-crud`

Adds 19 functional master pages:

- `/masters/departments`
- `/masters/sub-departments`
- `/masters/designations`
- `/masters/employee-types`
- `/masters/categories`
- `/masters/units`
- `/masters/grades`
- `/masters/levels`
- `/masters/shift-masters`
- `/masters/shift-plans`
- `/masters/ot-plans`
- `/masters/leave-masters`
- `/masters/loan-types`
- `/masters/asset-masters`
- `/masters/dropdown-master`
- `/masters/tds-slabs`
- `/masters/professional-tax-slabs`
- `/masters/esi-rates`
- `/masters/pf-rates`

Each master has:

- A collection endpoint implementing `GET` and `POST`.
- An item endpoint implementing `GET`, `PUT`, and `DELETE`.

This totals 38 API route paths for 19 master entities. The short wrapper pages instantiate the implemented reusable `SimpleMasterPage`; they are not empty scaffolds.

### `feature/rbac-master-wiring`

Contains the same 19 pages and CRUD APIs, adding permission enforcement to all master APIs and `POST /api/auth/seed` for RBAC/bootstrap data.

### `feature/employee-master-models`

Implemented pages:

- `/employees` — paginated/searchable list.
- `/employees/new` — create form.
- `/employees/[id]` — detailed view.
- `/employees/[id]/edit` — core-field edit form.

Implemented APIs:

- `GET /api/employees`
- `POST /api/employees`
- `GET /api/employees/[id]`
- `PUT /api/employees/[id]`
- `DELETE /api/employees/[id]`
- `GET /api/org-options`

Verified limitations:

- Edit changes only core Employee fields.
- No edit API/UI exists for personal details, job history, salary, bank, dependents, education, or experience.
- Create UI does not implement every schema-backed sub-table.
- Employee APIs have no RBAC enforcement.
- Reporting manager is entered as a raw numeric ID.
- Documents are placeholders on this branch.

### `feature/employee-master-doc-tracking`

Adds:

- `POST /api/employees/[id]/documents`
- `DELETE /api/employees/[id]/documents/[docId]`
- Runtime expiry status and days-to-expiry calculation.
- Employee-list expiry warning display.
- Inline KPI/JD/document metadata form and delete action.

This is metadata tracking, not file management. There is no upload/storage implementation, download, preview, or centralized repository/search. `fileName` and `filePath` remain manually captured placeholders.

### `feature/auth-login`

Adds:

- `/login`
- `POST /api/auth/login` — database-backed `User` lookup and bcrypt verification.
- `POST /api/auth/logout`
- `POST /api/auth/seed-user`
- Authentication-cookie redirect behavior on `/`.

It carries Employee CRUD but not Masters CRUD/RBAC wiring.

### `chore/rename-kun-to-suki`

This is the broadest single branch. It contains:

- All 19 Masters pages and CRUD APIs.
- Master RBAC wiring.
- Employee CRUD.
- Real user login/logout.
- Layout shell and shared CRUD components.
- Suki branding.

It does not contain the later document metadata endpoints and expiry/KPI/JD UI from `feature/employee-master-doc-tracking`.

## 4. BRD module status

“Built” evaluates the union of actual code across all branches. “Merged” reports whether meaningful implementation for the module exists on `main`.

| BRD Module | Built | Branch it is on | Merged to main | What is specifically missing |
|---|---|---|---|---|
| Dashboard | N | Placeholder shell on `layout-shell` and descendants | N | My/HR/payroll dashboards; headcount, attrition, attendance, leave, salary, statutory, and pending-salary KPIs |
| Masters | Partial | Models on `main`; CRUD on `master-setup-crud`, `rbac-master-wiring`, and rename branch | Partial: schema only | Organization/company, Branch/Site, reporting structure/org chart, income-tax slabs, interview criteria, JD master; all UI/API remains unmerged |
| Recruitment | N | None | N | Hiring, offers, appointments, internship, joining workflow/forms/checklists/documents |
| Employees | Partial | Employee feature branches, `auth-login`, and rename branch | N | Full sub-entity editing; lifecycle events; confirmation/transfer/promotion/designation change/increment; letters/certificates; separation forms; actual document handling; RBAC |
| Workforce | Partial | Definition models on `main`; master CRUD on Masters branches | Partial: definitions only | Attendance, biometric integration, time office, leave entry/approval/history, OT processing/approval, comp-off, permissions, benefits, and incentives |
| Payroll | Partial | TDS/PT/ESI/PF and loan models on `main`; CRUD on Masters branches | Partial: definitions only | Salary processing/revision, arrears, bonus, gratuity, leave encashment, F&F, deductions, statutory processing, payslips, bank files, summaries/reconciliation |
| Learning & Development | N | None | N | Competency, skill matrix/levels, yearly plans, and training calendar |
| Visitor | N | None | N | Gate inward/outward, visitors, and visitor passes |
| Document Management | Partial | Employee document schema on Employee branches; metadata UI/API on document-tracking branch | N | Central index/repository, actual storage, upload, search, preview, download, generated documents, non-employee document areas, authorization |
| Approval Center | N | None | N | Central approval workspace, workflow routing/configuration, and every listed approval type |
| ESS | N | None | N | Employee dashboard/profile updates, attendance, leave/permission/mis-punch requests, document/payslip download, visitor requests/approval |
| Compliance | N | None | N | Forms 25, 15, 25B, 25C, 21, and 22; compliance processing and documents |
| Reports | N | None | N | All employee, attendance, payroll, statutory, business, and finance reports; export/print infrastructure |
| Administration | Partial | RBAC models on `main`; real login and Master RBAC on unmerged branches | Partial: RBAC schema/skeleton only | User/role/permission administration pages, page-permission management, company/branch/salary settings, org chart, email/WhatsApp/utility settings; real auth unmerged |

No BRD module is fully implemented end to end.

## 5. Pending, deferred, TODO, and commented-out work

Directly verified:

- `Site`/Branch remains marked **PENDING CLIENT CONFIRMATION**.
  - The entire `Site` model is commented out.
  - It will not migrate.
  - No active `Branch` model exists.
- `ShiftPlan` override semantics must be specified before Attendance.
- `OTPlan` still carries the comment “Confirm shape.”
- `LeaveMaster`, `LoanType`, and `AssetMaster` still carry “Confirm if flags needed.”
- Employee code is manual; its auto-generation pattern is TBD.
- Employee status remains a free string, with a future enum/dropdown constraint noted.
- Employee bank details are 1:1, with possible future multiple-account support noted.
- Employee asset allocation is read-only/reference-level; asset logic is deferred.
- Employee sub-table editing is explicitly deferred.
- Reporting manager selection is a raw ID and logged as a UX gap.
- Employee API RBAC is deferred.
- Document storage is explicitly a placeholder.
- On the employee model branch, KPI/JD UI is explicitly a placeholder.
- On the document-tracking branch, KPI/JD/document metadata is implemented, but file storage remains a placeholder.
- Layout navigation, top-bar search, and user avatar remain placeholders.

### Decision-file nuance

- The employee decision file says E1–E9 and D1–D10 were reviewed and “all resolved.”
- That approval confirms temporary design decisions; it does not mean the recorded functional gaps were implemented.
- An older version on `chore/rename-kun-to-suki` still presents those items as pending-review material, demonstrating documentation divergence between branches.

## 6. Abandoned or half-done work

These are directly verified unmerged or divergent items. Calling them “abandoned” is an **inference**, because Git does not record project intent.

- Masters implementation progressed through three branches but never reached `main`.
- Layout and shared components were built and consumed by Masters but never merged.
- Employee schema and CRUD remain entirely on feature branches.
- Employee document tracking is isolated and absent from the broad integration/rename branch.
- Real bcrypt/User authentication is unmerged; `main` still accepts arbitrary credentials.
- There is no single branch containing all latest work.
- Worklogs claim 22 tables and triggers were successfully applied to a database, but no Prisma migration directory is committed. The repository cannot independently reproduce or verify that database state.
- Requested worklogs and `DECISIONS_PENDING_REVIEW.md` are absent from `main` and exist only on unmerged branches.
- The Dashboard shell was started, but its own source calls the module content and KPI cards placeholders.
- Employee schema/read views support many sub-entities while edit supports core fields only.

## 7. Built items not explicitly present in the BRD

Directly verified candidates:

- `GET /api/protected/test` and its `system.test.demo.view` permission: development/RBAC demonstration utility.
- `POST /api/auth/seed` and `POST /api/auth/seed-user`: bootstrap/development endpoints.
- Skeleton login behavior accepting arbitrary credentials: implementation scaffolding.
- Generic `DropdownMaster`: supporting infrastructure not named as a BRD master.
- Theme toggle/dark-theme framework: not specified in the BRD.
- Four SQL Server effective-date overlap-prevention triggers: technical enforcement beyond the BRD wording.
- `EsiRate` and `PfRate` configuration masters: sensible statutory support but not individually named in the BRD Masters list.

Interpretations explicitly labeled as **inference**:

- `AssetMaster` is not explicitly listed under BRD Masters, although it plausibly supports Employee → Asset Allocation.
- `EmployeeBankDetail` is not listed in the Employee Profile breakdown, but bank details are referenced under Document Management.
- These look more like supporting domain design than clear scope creep.
