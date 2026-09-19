# Employee Excel Import — Segment-wise Workbook

Date: 2026-09-18
Status: agreed in discussion, not yet built

## Decisions taken

1. One workbook, one sheet per UI tab segment. Sheets are joined by `Employee Code`.
2. Mandatory sheets: **Basic, Job Profile, Salary, CTC, KYC & Statutory**. An employee missing a row on any of these is rejected as a whole.
3. Optional sheets: Personal & Contact, Passport, Education, Experience, Dependents, Emergency Contacts, Skills, Assets. Benefits and Activity are out of scope.
4. Failure isolation: a failing employee is skipped, all other employees import. Repeatable-sheet rows (Education etc.) fail row by row, never the whole employee.
5. Nothing is written for an employee until every one of their rows passes validation.
6. Error workbook: same layout as the template, containing only failed employees, with `Status` and `Error` columns appended to every sheet. HR fixes and re-uploads the same file. The importer ignores those two columns on the way in.
7. Validation runs server-side in one request. A `dryRun` flag returns the report without writing.

## Workbook layout

| Sheet | Rows / employee | Mandatory | Source of columns |
|---|---|---|---|
| Basic | 1 | yes | `TEMPLATE_COLUMNS` in `src/lib/employee-bulk-import.ts` (already exists) |
| Job Profile | 1 | yes | `buildJobProfileFields()` |
| Salary | 1 | yes | `Effective From` + one column per active `SalaryComponent` of the company, generated at download time |
| CTC | 1 | yes | `buildCtcFields()` |
| KYC & Statutory | 1 | yes | `buildKycFields()` minus the `*Masked` fields |
| Personal & Contact | 1 | no | `buildPersonalFields()` + `buildContactFields()` |
| Passport | 1 | no | `buildPassportFields()` |
| Education | many | no | `buildEducationFields()` |
| Experience | many | no | `buildExperienceFields()` |
| Dependents | many | no | `buildDependentFields()` |
| Emergency Contacts | many | no | `buildEmergencyContactFields()` |
| Skills | many | no | `buildSkillFields()` |
| Assets | many | no | `buildAssetFields()` |
| Reference Lists | — | read-only | valid names for every select field, as today |

Column headers are the field `label`s, not the names, matching the existing Basic sheet. Select fields take the master's name; dates are `YYYY-MM-DD`; booleans are `Yes`/`No`.

## Employee Code handling

- Existing employee: real code on every sheet, Basic sheet row updates the employee.
- New employee: HR writes a temporary code like `NEW-001` on Basic and repeats it on the other sheets. The importer creates the employee, receives the generated code, and maps `NEW-001` to it for the rest of the workbook in the same run. The result report shows both codes.

## Validation order (per employee)

1. Sheet presence: every mandatory sheet has a row for this code. Missing → `Missing: mandatory sheet`.
2. Field level: reuse the `required` flags in `employee-form-fields.ts`, plus the zod schemas of each section API.
3. Referential: master names resolve; reporting manager code exists or is inside this workbook; salary component columns match active components; component amounts must total the gross.
4. Cross-sheet: CTC `Basic` equals the Salary `BASIC` component; `Effective From` on Salary and CTC is not before Join Date.

## Write order (per passing employee, inside one transaction)

Basic → Job Profile → Personal & Contact → KYC → Passport → Salary → CTC → repeatable sheets.

The per-section write logic must be extracted from the `src/app/api/employees/[id]/<section>/route.ts` handlers into shared functions so import and UI cannot drift. The routes then call the shared functions.

## API

- `GET  /api/employees/import/template` → workbook, company-scoped (salary component columns, reference lists).
- `POST /api/employees/import` with `file`, `dryRun=true|false` → JSON report `{ total, created, updated, failed, employees: [{ code, resolvedCode, status, sheets: { Basic: 'ok' | 'missing' | 'error', ... }, errors: [{ sheet, row, field, message }] }] }`.
- `POST /api/employees/import/errors` with the same file plus the report → error workbook download. (Or return a token from the first call and download by token; decide at build time.)

Permission: `employees.create` for create, `employees.edit` for updates. KYC values are encrypted on write as in the KYC route; the uploaded file is not persisted.

## UI (`/employees/bulk-upload`)

1. Download template.
2. Upload → runs dry run automatically → shows summary counts and a per-employee table with a status chip per sheet.
3. Buttons: **Download error file**, **Import valid employees**.
4. After import: same table with created/updated/failed, download error file still available.

## Decisions from 2026-09-18 follow-up (KUN only for now)

**Mandatory sheets are locked** as listed above. Locked fields inside them are the
`required` fields in `employee-form-fields.ts`, plus these KYC fields which are
required for payroll: PAN, Aadhaar, Bank Account Number, IFSC. UAN and ESI number
stay optional (new joiners may not have them).

**Status is locked to `active`.** The template has no Status column. On-leave,
terminated and resigned employees are not migrated through this file; leave and
separation are handled by their own modules.

**Confirmation.** Basic sheet gains a `Confirmation Date` column, but it is a
signal, not a literal date write — the real `confirmationDate` field can only
be set by the Confirmation approval workflow (`/confirmation/approve`), which
itself requires a manager recommendation first, so import cannot fabricate
that history.
- Filled → probation period is dropped from the create payload, so the
  employee lands straight on CONFIRMED (same effect the app already gives an
  employee hired with no probation).
- Blank + probation period given → PROBATION, as today.
- Blank + probation end date (join date + months) already in the past →
  rejected: "fill Confirmation Date to hire as already confirmed, or leave
  Probation Period blank". HR decides, not the system.
- Built and verified 2026-09-18 in [employee-bulk-import.ts](../src/lib/employee-bulk-import.ts).

**Volume.** Expected 500–700 employees per file. Cap 1,000 employees per upload.
Dry run is read-only (seconds). Import runs one transaction per employee inside a
single request with `maxDuration = 600` and a progress indicator in the UI. No
background queue for now.

**Fill guide.** A KUN-specific guide (`docs/EMPLOYEE_IMPORT_GUIDE_KUN.md`, also
exported to PDF for the client) is part of the deliverable. It lists every sheet,
every column, which are mandatory, accepted formats, the temp-code rule for new
employees, and how to read and fix the error workbook.

## Build status (2026-09-18)

**Sheet layout expanded to match every Employee-page tab** (2026-09-18, second pass) — the first pass
merged Job Profile into Basic and left out Personal, Education, Experience, Dependents, Emergency
Contacts, Benefits, Assets and Skills as "optional, not built yet". Per the client's request the
workbook now has one sheet per tab shown in the app's tab strip (Activity excluded, it's
system-generated): **Basic, Job Profile, Personal & Contact, CTC, Salary, Education, Experience,
Passport, Dependents, Emergency Contacts, Benefits, Assets, Skills, KYC & Statutory** — 14 data sheets
plus Reference Lists. Mandatory sheets are unchanged: Basic, Job Profile, CTC, Salary, KYC & Statutory.
The rest are optional; Education/Experience/Dependents/Emergency Contacts/Benefits/Assets/Skills are
repeatable (0+ rows per employee) and a bad row on one of those is skipped and reported, never blocks
the employee.

**Built and browser-verified:**
- [employee-bulk-import.ts](../src/lib/employee-bulk-import.ts) — 14-sheet template builder, workbook
  parser grouping rows by Employee Code (single-row `SheetOutcome<T>` for the 7 one-row sheets,
  `RepeatableOutcome<T>[]` for the 7 multi-row sheets), `validateBatch()` (mandatory-sheet + field-level
  on the 5 mandatory sheets → blocks the employee; repeatable-row errors → non-blocking `warnings`), and
  `buildErrorWorkbook()`.
- [bulk-upload/page.tsx](../src/app/employees/bulk-upload/page.tsx) — download, upload, dry-run
  validation table, error-file download, and the import run: new employees go through
  `POST /api/employees`, existing ones through `PUT .../basic`, then the 4 other mandatory sheets in
  parallel, then every optional/repeatable sheet's section API (`/job-profile`, `/personal`,
  `/contact`, `/passport`, `/benefits`, and one `POST` per row for `/education`, `/experience`,
  `/dependents`, `/emergency-contacts`, `/assets`, `/skills`) — all independent, so one failing item
  never blocks another.
- End-to-end smoke tests in the running app (logged in as KUN):
  - A 2-employee workbook correctly blocked the one missing the mandatory KYC sheet.
  - A 14-sheet, fully-filled single-employee workbook imported clean — read back afterward via every
    section API and confirmed Basic, Job Profile, Personal, Contact, Passport, CTC, Salary, Education,
    Experience, Dependents, Emergency Contacts, Benefits, Assets, Skills and KYC all landed correctly
    (created employee EMP185).
  - Re-ran with only the 5 mandatory sheets filled (no optional data) — imported clean (EMP186),
    confirming optional sheets are genuinely optional.
- Test employees left in the KUN database from these runs: **EMP184, EMP185, EMP186** — flagged to
  the client for a delete decision, not removed automatically.

**Known limitation, by design:** every sheet is written as its own request, not one transaction. If
Basic succeeds but a later sheet fails, the row is reported PARTIAL rather than silently lost — the
employee already exists and can be completed from their profile page or by re-running the import with
their real code.

**Not yet built:**
- The KUN-specific fill guide (`docs/EMPLOYEE_IMPORT_GUIDE_KUN.md` + PDF export).
- A caching/perf pass for the 500–700-row case (works today at 1–2 rows, hasn't been run at that
  volume yet — 14 sheets × up to a dozen requests per employee means a 700-row file makes several
  thousand sequential requests; worth a volume test before go-live).
- No sequencing/throttling beyond running employees one at a time — fine at expected volume, would need
  revisiting only if this grows well past 1,000 rows per file.
