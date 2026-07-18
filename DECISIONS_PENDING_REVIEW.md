# DECISIONS_PENDING_REVIEW.md

**Branch:** `feature/employee-master-models`
**Original owner:** On leave — decisions below were made by the pickup developer.
**Purpose:** Every judgment call not explicitly specified in the task brief is logged here for review/override when the original owner returns.

> **REVIEW STATUS: ALL ITEMS RESOLVED** — Original owner reviewed and confirmed all entries (E1–E9, D1–D10) on 2026-07-18. No overrides requested. This file is retained for audit trail only.

---

## Existing decisions made by original owner (in schema comments E1–E9)

These were already in `schema.prisma` from the original owner's commits. I am continuing from them, not overriding them. Listed here for completeness so the original owner can confirm or revisit.

| ID | Decision | Why | Alternative | Resolution |
|----|----------|-----|-------------|------------|
| E1 | Employee code = manual entry, NVarChar(20), unique | Simplest for Phase 1 — no auto-gen logic needed | Auto-generated sequence (e.g. EMP-0001). Would need a counter table or DB sequence. | ✅ CONFIRMED |
| E2 | Status = String NVarChar(20), default "active" | Flexibility — constrain via DropdownMaster later | Enum or FK to DropdownMaster. Adds coupling now. | ✅ CONFIRMED |
| E3 | JobInfo = versioned (multiple records, effectiveFrom/effectiveTo) | Job history tracking is a core HR need | Single current record only — simpler but loses history. | ✅ CONFIRMED |
| E4 | SalaryStructure = versioned (same pattern as slab tables) | CTC changes over time, need history | Single current CTC — simpler but loses audit trail. | ✅ CONFIRMED |
| E5 | Documents = one EmployeeDocument table with docType field | Unified table, handles typed docs + generic uploads | Separate tables per doc type — more rigid, more models. | ✅ CONFIRMED |
| E6 | KPI/JD = EmployeeDocument with docType "kpi"/"jd" | Reuses same table, no extra model | Separate KPI/JD model with structured fields — more schema. | ✅ CONFIRMED |
| E7 | ExitInterview = separate model, 1:1 with Employee | Created only on exit, keeps Employee lean | Fields on Employee — nullable clutter for active employees. | ✅ CONFIRMED |
| E8 | Reporting manager = self-referential FK on Employee | Standard pattern for org hierarchy | Separate EmployeeManager join table — over-engineered for 1:1. | ✅ CONFIRMED |
| E9 | Bank details = separate EmployeeBankDetail (1:1) | May extend to multiple accounts in future | Fields on Employee — simpler but harder to extend. | ✅ CONFIRMED |

---

## New decisions made by pickup developer (this session)

### D1. Prisma Client not regenerated — schema exists but DB not pushed

**What:** The original owner added Employee models to `schema.prisma` but never ran `prisma db push` or `prisma generate` on this branch. The Prisma Client doesn't know about Employee models, causing 7 TypeScript errors.

**Why:** I need to run `npx prisma db push` to create the 11 Employee-related tables in the DB and regenerate the client. This is a prerequisite for any CRUD to work.

**Alternative:** Skip migration and only fix code — but then nothing runs. Migration is required.

**Status:** Action item — will push after CHECKPOINT 1 approval.

**Resolution:** ✅ CONFIRMED — `prisma db push` executed successfully on 2026-07-18. Tables created, Prisma Client regenerated.

---

### D2. No DECISIONS_PENDING_REVIEW.md existed from original owner

**What:** The original owner did not create this file. I am creating it now.

**Why:** The task brief mandates it. The original owner's E1–E9 comments in `schema.prisma` serve a similar purpose but are not in the required file format.

**Alternative:** Extract E1–E9 from schema comments and leave them there only — but the brief explicitly requires a separate file.

**Resolution:** ✅ CONFIRMED — no override requested.

---

### D3. Existing CRUD code uses raw forms, not shared components

**What:** The original owner built Employee CRUD pages (`list`, `new`, `view`, `edit`) using raw HTML forms and tables, NOT the shared `DataTable`, `FormModal`, `ConfirmDialog`, `Field` components built in `feature/shared-crud-components`.

**Why (inferred):** The Employee form is significantly more complex than master table forms — it has nested sub-forms (PersonalDetails, JobInfo, SalaryStructure, etc.), multi-field fieldsets, and a view page with 10+ sections. The shared `FormModal` is a simple modal with flat fields — it doesn't support nested creates or multi-section forms.

**Decision:** Keep the existing raw form approach for Employee. The shared components are designed for simple flat-entity CRUD (master tables). Employee is a complex nested entity. Forcing it into `FormModal` would require either (a) extending `FormModal` with nested form support (scope creep) or (b) building a hacky wrapper. Neither is appropriate for this branch.

**Alternative:** Refactor all Employee pages to use shared components. Would require extending `FormModal` and `DataTable` significantly — not a 2-3 day task.

**Resolution:** ✅ CONFIRMED — no override requested.

---

### D4. Create page only includes core + PersonalDetails + JobInfo — not all sub-tables

**What:** The create form captures Employee core fields, PersonalDetails (email, mobile, DOB, gender, blood group), and JobInfo (department, designation, employee type, join date, job title). It does NOT include SalaryStructure, BankDetails, Dependents, Experience, Education, or Documents on the create page.

**Why (inferred):** Creating all sub-tables in a single form would be overwhelming and error-prone. The create page captures the minimum to get an employee record in. Other sub-tables can be added via the edit page or dedicated sub-table APIs later.

**Decision:** Keep this approach. The view page already shows all sub-tables (read-only). The edit page currently only edits core fields — extending it to manage sub-tables is a natural next step but not required for "basic CRUD works end-to-end" (CHECKPOINT 3).

**Alternative:** Single massive create form with all sub-tables — poor UX, high validation complexity.

**Resolution:** ✅ CONFIRMED — no override requested.

---

### D5. Edit page only edits core Employee fields — no sub-table management

**What:** The edit page (`/employees/[id]/edit`) only edits `employeeCode`, `firstName`, `middleName`, `lastName`, `status`, `reportingManagerId`. It does not edit PersonalDetails, JobInfo, SalaryStructure, or any sub-table.

**Why (inferred):** Sub-table editing requires either (a) separate API endpoints per sub-table (e.g. `PUT /api/employees/[id]/job-info`) or (b) a complex nested update in the main PUT endpoint. Both are beyond "basic CRUD."

**Decision:** Keep core-only edit for now. Log as a known gap. The view page shows all data, the create page captures initial data. Sub-table editing APIs are a future checkpoint.

**Alternative:** Build sub-table edit endpoints now — adds significant scope and complexity.

**Resolution:** ✅ CONFIRMED — no override requested.

---

### D6. Reporting manager = raw ID input, not a dropdown

**What:** The create and edit forms use a plain number input for `reportingManagerId` instead of a dropdown of existing employees.

**Why (inferred):** A manager dropdown requires fetching all employees and searching/filtering — a combobox component that doesn't exist yet. For Phase 1, a raw ID input is functional.

**Decision:** Keep raw ID input for now. Flag as UX gap.

**Alternative:** Build an employee search/combobox component — adds scope.

**Resolution:** ✅ CONFIRMED — no override requested.

---

### D7. org-options API allows specific Org tables only — not Employee

**What:** The `/api/org-options` endpoint has an allowlist of table names (Department, SubDepartment, Designation, etc.) and does NOT include Employee. So the reporting manager dropdown can't use this endpoint.

**Why (inferred):** The original owner deliberately scoped org-options to master tables only. Employee is not a "master table" in the org structure sense.

**Decision:** Keep as-is. If a manager dropdown is needed later, it should be a separate endpoint (e.g. `/api/employees/search?q=...`) with its own permission check.

**Resolution:** ✅ CONFIRMED — no override requested.

---

### D8. No RBAC permission checks on Employee API routes

**What:** The Employee API routes (`/api/employees`, `/api/employees/[id]`) do not have `checkMasterPermission()` or any RBAC check. The middleware on `feature/rbac-master-wiring` protects `/api/masters/*` but not `/api/employees/*`.

**Why:** The task brief says "Do not modify auth/RBAC middleware." Employee routes are under `/api/employees/*`, not `/api/masters/*`, so they're outside the RBAC wiring scope. RBAC for Employee would be a separate permission group (`employee.view`, `employee.edit`).

**Decision:** Leave Employee routes without RBAC for now. This branch's scope is Employee models + CRUD, not RBAC wiring. Flag for the RBAC branch to pick up.

**Alternative:** Add employee RBAC checks now — but the brief explicitly says don't touch auth/RBAC middleware.

**Resolution:** ✅ CONFIRMED — no override requested.

---

### D9. Document upload UI = placeholder stub only

**What:** The create page has a dashed-border placeholder fieldset saying "Document upload with expiry tracking will be available in a future checkpoint." The view page shows documents if they exist (read-only) with expiry date coloring (red if expired).

**Why:** The task brief explicitly says "Document upload UI can be a placeholder/stub — full expiry-tracking LOGIC is required at schema level, but the UI for surfacing/alerting on it is a later checkpoint."

**Decision:** Keep placeholder. The schema has `expiryDate`, `issuedDate`, `isVerified` fields. The view page already shows expiry status with color coding. Full upload + alerting UI is deferred.

**Resolution:** ✅ CONFIRMED — no override requested.

---

## New decisions made on feature/employee-master-doc-tracking branch

### D11. 30-day expiry warning threshold

**What:** Documents within 30 days of their `expiryDate` are classified as "expiring soon." Documents past their expiry date are "expired." Documents with no expiry date are "no_expiry."

**Why:** 30 days is a common HR compliance window — gives enough time to initiate renewal before expiry without being noisy. Configurable via `EXPIRY_WARNING_DAYS` constant in `src/lib/document-expiry.ts`.

**Alternative:** 60-day or 90-day warning window. 30 is conservative but standard for identity documents (passport renewal can take weeks).

---

### D12. Expiry status computed at API layer (derived field), not stored in DB

**What:** `expiryStatus` and `daysToExpiry` are computed at runtime in the API response from the existing `expiryDate` field. They are NOT stored as columns in the `EmployeeDocument` table.

**Why:** Storing a computed status would require a cron job or trigger to update it daily as time passes. Computing at read time is simpler and always accurate.

**Alternative:** Add `expiryStatus` as a DB column + nightly refresh job — more complex, stale risk.

---

### D13. KPI/JD attach UI is inline on the view page, not a separate page

**What:** The KPI/JD attachment form appears inline within the "KPI / JD Attachments" section of the employee view page. It toggles via a "+ Attach KPI / JD" button. No separate `/employees/[id]/documents/new` page.

**Why:** A separate page for a 5-field form is overkill. Inline keeps context — you see existing attachments while adding a new one.

**Alternative:** Dedicated document management page — more navigation, less context.

---

### D14. File storage is still placeholder — attach form captures metadata only

**What:** The attach form captures `docType`, `docNumber`, `fileName` (as text), `issuedDate`, `expiryDate`. There is no actual file upload — `fileName` is a free-text field and `filePath` is not exposed in the UI.

**Why:** The brief says "attachment" not "file storage." Real file upload requires storage infrastructure (S3/local disk + upload endpoint + virus scanning). Metadata-only is functional for tracking what documents exist and their expiry.

**Alternative:** Build full file upload with S3 — significant infrastructure scope beyond this branch.
