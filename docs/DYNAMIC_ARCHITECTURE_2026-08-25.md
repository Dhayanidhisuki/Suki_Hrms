# Dynamic Architecture — Metadata-Driven HRMS

**Date:** 25 August 2026
**Decision:** Build at dynamic Levels 1–3. Level 4 (EAV / runtime schema) explicitly rejected.
**Ownership:** One senior developer, dedicated for the first month, while the rest of the team continues on employee and foundation work.

---

## 1. The decision in one line

**Metadata drives the user interface; the database stays typed.**

`FieldDefinition` does not store values — it *describes real columns in real tables*. A generated form writes `holidayType` into an `nvarchar(30)` column with a foreign key, exactly as a hand-written form would. We get generated screens without surrendering type safety, indexes, constraints or query performance.

The only place values live outside a typed column is the Level 3 `customFields` JSON column, and only on entities that explicitly opt in.

---

## 2. Scope

### Dynamic

| Area | What metadata controls |
|---|---|
| Master screens (all 60) | Entire CRUD screen generated: form, grid, filters, validation, export |
| Form layout | Field order, grouping, sections, column span, conditional visibility |
| List views | Visible columns, default sort, filters, per-role column sets |
| Navigation | Already data in `navigation.ts` — extended to read permissions |
| Permissions | Per entity, per field, per action |
| Approval workflows | Chain per transaction type per department |
| Salary components | Which components exist and how they are labelled |
| Report definitions | Columns, grouping, filters, export format |
| Document and notification templates | Body, merge fields, recipients |
| Custom fields | Client adds fields to employee, applicant, asset without a developer |

### Typed and fixed — never generated

| Area | Why |
|---|---|
| Employee core record | Referenced by everything; needs real foreign keys |
| Attendance rows | Millions of rows, queried by date range, must be indexed |
| Leave balances and ledger | Arithmetic integrity |
| Payroll run and payroll lines | Statutory reproducibility and audit |
| Statutory computations | Legal obligation to reproduce a past filing exactly |
| Audit log | Must be append-only and tamper-evident |
| Salary **arithmetic** | Components are configurable; how they combine is code |

### Screens that will never be generated — accept this now

The monthly attendance workbench, the payroll run screen, the org chart, the approval inbox, the shift roster grid, the leave calendar, and each dashboard. These are hand-built. The framework must not be contorted to cover them, and no time is budgeted as if it will.

---

## 3. The metadata model

```prisma
model EntityDefinition {
  id          Int      @id @default(autoincrement())
  code        String   @unique @db.NVarChar(60)   // "holiday"
  label       String   @db.NVarChar(100)          // "Holiday Master"
  pluralLabel String   @db.NVarChar(100)
  module      String   @db.NVarChar(40)           // "masters"
  tableName   String   @db.NVarChar(60)           // Prisma delegate key
  routePath   String   @db.NVarChar(120)          // "/masters/holidays"
  isSystem    Boolean  @default(true)             // false = client-created
  supportsCustomFields Boolean @default(false)
  sortOrder   Int      @default(0)
  isActive    Boolean  @default(true)
  deletedAt   DateTime?
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt

  fields FieldDefinition[]
  views  ViewDefinition[]
}

model FieldDefinition {
  id           Int      @id @default(autoincrement())
  entityId     Int
  name         String   @db.NVarChar(60)    // "holidayType" — real column name
  label        String   @db.NVarChar(100)
  dataType     String   @db.NVarChar(30)    // see section 4
  isCustom     Boolean  @default(false)     // true = lives in customFields JSON
  required     Boolean  @default(false)
  unique       Boolean  @default(false)
  readOnly     Boolean  @default(false)
  defaultValue String?  @db.NVarChar(200)
  maxLength    Int?
  precision    Int?
  scale        Int?
  lookupEntity String?  @db.NVarChar(60)    // FK target entity code
  lookupFilter String?  @db.NVarChar(300)   // JSON: constrain the lookup
  validation   String?  @db.NVarChar(Max)   // JSON: see section 5
  visibleWhen  String?  @db.NVarChar(300)   // JSON: see section 6
  permissionKey String? @db.NVarChar(80)    // field-level access, e.g. "salary.view"
  groupName    String?  @db.NVarChar(60)    // form section
  helpText     String?  @db.NVarChar(300)
  placeholder  String?  @db.NVarChar(100)
  colSpan      Int      @default(1)         // 1, 2 or 3 of a 3-column grid
  sortOrder    Int      @default(0)
  showInList   Boolean  @default(true)
  showInForm   Boolean  @default(true)
  filterable   Boolean  @default(false)
  isActive     Boolean  @default(true)
  deletedAt    DateTime?

  entity EntityDefinition @relation(fields: [entityId], references: [id])

  @@unique([entityId, name])
  @@index([entityId])
}

model ViewDefinition {
  id        Int      @id @default(autoincrement())
  entityId  Int
  code      String   @db.NVarChar(60)     // "default", "payroll-view"
  label     String   @db.NVarChar(100)
  type      String   @db.NVarChar(20)     // list | form
  roleId    Int?                          // null = all roles
  config    String   @db.NVarChar(Max)    // JSON: columns / layout
  isDefault Boolean  @default(false)
  isActive  Boolean  @default(true)

  entity EntityDefinition @relation(fields: [entityId], references: [id])

  @@unique([entityId, code, roleId])
}
```

---

## 4. Data type catalogue

Fixed list. Adding a type is a deliberate framework change, not a configuration.

| `dataType` | Column type | Renders as |
|---|---|---|
| `text` | `NVarChar(n)` | Single-line input |
| `longtext` | `NVarChar(Max)` | Textarea |
| `int` | `Int` | Number input |
| `decimal` | `Decimal(p,s)` | Number input, tabular figures |
| `money` | `Decimal(18,2)` | Currency input, right-aligned |
| `percent` | `Decimal(5,2)` | Percentage input |
| `bool` | `Boolean` | Toggle |
| `date` | `DateTime` | Date picker |
| `datetime` | `DateTime` | Date and time picker |
| `time` | `NVarChar(8)` | Time picker |
| `enum` | `NVarChar(n)` | Select, options from `DropdownMaster` |
| `lookup` | `Int` FK | Searchable select from `lookupEntity` |
| `multilookup` | join table | Multi-select |
| `file` | `NVarChar(n)` | Upload, stores path |
| `image` | `NVarChar(n)` | Upload with preview |
| `color` | `NVarChar(7)` | Colour picker — used by attendance bands |

---

## 5. Validation

`validation` holds JSON with a **fixed vocabulary**. No expressions, no eval.

```json
{
  "min": 0,
  "max": 100,
  "minLength": 2,
  "maxLength": 60,
  "pattern": "^[A-Z]{2}[0-9]{4}$",
  "patternMessage": "Format: two letters then four digits",
  "gtField": "fromDate",
  "uniqueWithin": ["companyId"]
}
```

At runtime the API builds a Zod schema from the field definitions and validates before touching Prisma. The same definitions build the client-side schema, so validation messages match exactly on both sides.

`gtField` covers the common pairs — `toDate > fromDate`, `maxLimit > minLimit`, `toSalary > fromSalary`. Anything more complex than that is a hand-written rule in the entity's service file, not metadata.

---

## 6. Conditional visibility

```json
{ "field": "isNightShift", "op": "eq", "value": true }
```

Operators: `eq`, `ne`, `in`, `notIn`, `gt`, `lt`, `isEmpty`, `isNotEmpty`. Single condition, or an `all` / `any` array of them. One level deep — no nesting.

Deliberately limited. The moment visibility rules need nesting, the screen belongs in the escape-hatch list.

---

## 7. Custom fields (Level 3)

Entities that opt in carry one column:

```prisma
customFields String? @db.NVarChar(Max)   // JSON object
```

Opted in at launch: `Employee`, `Applicant`, `Asset`, `Visitor`.

Rules:

1. A custom field is a `FieldDefinition` row with `isCustom = true`. It is described exactly like a system field — same types, same validation.
2. Values are read and written through the same generic API, which maps them into the JSON column.
3. **Custom fields may not participate in payroll.** They cannot be referenced by salary logic, attendance calculation or statutory computation. If the client needs a field that affects pay, it becomes a real typed column via a migration.
4. A custom field needing filtering or sorting gets a SQL Server computed column plus an index — a small migration the framework generates on request.
5. Custom fields are never hard-deleted; deactivating hides the field and preserves the stored values.

---

## 8. How historical documents stay correct

Metadata will change. A payslip issued in April must still render as it did in April.

**Solution: snapshot on approval, not metadata versioning.** When a payroll run is approved, each payslip stores a rendered JSON snapshot of its own line items and labels. The document is then immune to later metadata edits.

The same applies to approved letters, offer letters and statutory returns.

`FieldDefinition` rows are soft-deleted, never removed, so historical data always has a description available.

---

## 9. Generic API contract

```
GET    /api/dyn/:entity/meta        entity + fields + views for the current user
GET    /api/dyn/:entity             list — ?page &size &sort &filter[field]=op:value
POST   /api/dyn/:entity             create
GET    /api/dyn/:entity/:id         read
PUT    /api/dyn/:entity/:id         update
DELETE /api/dyn/:entity/:id         soft delete
POST   /api/dyn/:entity/export      xlsx | csv | pdf
```

Every request:

1. Resolves `:entity` against a **whitelist map** of entity code to Prisma delegate. An unknown code is a 404 — the route never interpolates a table name from user input.
2. Checks the entity-level permission for the action.
3. Strips fields the user lacks `permissionKey` for, **on the way in and on the way out**. Salary columns disappear from the payload, not just from the screen.
4. Validates against the generated Zod schema.
5. Checks the period lock where the entity is period-bound.
6. Writes an audit row.

Entities needing behaviour beyond CRUD register an optional service hook — `beforeCreate`, `afterUpdate` — in a plain TypeScript file. That is the pressure valve that stops the metadata growing a rules engine.

---

## 10. Generic components

```
<DynamicTable  entity="holiday" view="default" />
<DynamicForm   entity="holiday" id={42} />
<DynamicFilter entity="holiday" />
<FieldRenderer field={def} value={v} onChange={fn} />
```

`FieldRenderer` is a switch over `dataType`. One component per type, roughly sixteen small components. Everything else composes them.

A generated master page is then:

```tsx
export default function Page() {
  return <DynamicMasterPage entity="holiday" />;
}
```

Four lines per master. Sixty masters become sixty four-line files plus metadata rows.

---

## 11. Permissions

`FieldDefinition.permissionKey` gives field-level control, which the Time Office BRD explicitly requires — salary columns on the attendance grid must be invisible to users without salary access.

Resolution order: entity permission, then view permission, then field permission. Denied wins. Enforced in the API, with the UI merely reflecting what the API returned.

---

## 12. The first month

| Week | Deliverable |
|---|---|
| **1** | `EntityDefinition`, `FieldDefinition`, `ViewDefinition` models and migration. The `meta` endpoint. Metadata seeded for the 19 existing masters by reading the current Prisma schema. |
| **2** | `FieldRenderer` for all 16 types. `DynamicTable` with sort, filter, pagination and column selection. `DynamicForm` with grouping, conditional visibility and client-side validation. |
| **3** | Generic CRUD API: whitelist resolution, Zod generation, permission filtering, soft delete, audit write, period-lock check. Export to Excel, CSV and PDF. |
| **4** | Custom fields JSON handling. View definitions per role. Convert the 19 existing master screens to the framework and delete the hand-written pages. Write the "how to add a master" guide. |

**Definition of done for the month:** the 19 existing masters run on the framework with no behaviour lost, and a twentieth master can be added in under an hour.

---

## 13. Rules

1. **Metadata describes real columns.** The only exception is `customFields`.
2. **No expression language.** No user-authored formulas, anywhere.
3. **The whitelist is the security boundary.** Entity codes never reach Prisma or SQL unmapped.
4. **Field-level permission is enforced server-side.** Hiding a column in the UI is not access control.
5. **Escape hatches are first-class.** A hand-written screen is a valid outcome, not a framework failure.
6. **The framework does not know about payroll.** No calculation, no statutory logic, no period semantics beyond calling the shared lock check.
7. **Snapshot approved documents.** Never rely on metadata to reproduce the past.
8. **Fixed type catalogue.** Adding a `dataType` is a reviewed framework change.

---

## 14. Effect on the estimate

| Item | Before | After | Change |
|---|---:|---:|---:|
| Dynamic framework | — | 20 – 25 | **+22** |
| Masters layer (60) | 64 – 67 | 12 – 16 | **−51** |
| Reports (36) | 30 – 35 | 14 – 18 | **−17** |
| Forms across employee, recruitment, ESS | — | — | **−15** |
| Field-level permission work | included | absorbed by framework | **−4** |
| **Net** | | | **−65 days** |

Revised development total: approximately **355 – 460 days** (was 420 – 525).

Two caveats on that figure. The saving is **back-loaded** — the framework costs 22 days before it returns anything, so month one looks slower. And it is **conditional on the framework staying disciplined**: every rule in section 13 that gets bent moves the number the wrong way.

---

## 15. What to watch for

**The framework eating the schedule.** If week 4 arrives and the 19 masters have not been converted, stop adding capability and convert them. A framework that has never replaced a real screen is a guess.

**Metadata sprawl.** If a field needs six JSON keys to describe, it wants a hand-written screen.

**Juniors blocked.** The framework must come with a written guide and one worked example, or the rest of the team stalls waiting for its author.

**Debugging distance.** Generated screens fail further from their cause than hand-written ones. Log the entity code, view code and resolved field list on every server error, from day one — it costs nothing then and saves hours later.
