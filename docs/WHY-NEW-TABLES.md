# Why the Tools app added tables instead of reusing the ERP masters

**Scope:** answers "why didn't you just use `GAUGEANDTOOLS` and the existing tools tables?"

**Important caveat:** there is no ADR or design-decision document in this repo. `docs/erp-gap-analysis.md`
compares *screens*, not schema. Everything below is **reconstructed from the schema, the migration
SQL, and code comments** — it is the rationale the evidence supports, not a record of what was
decided in the room. Section 5 lists the places where the evidence does *not* support a clean
rationale.

---

## 0. The headline: the app reuses far more than it adds

| | count |
| --- | --- |
| Pre-existing ERP tables mapped and used | **36** |
| New tables created by the app | **22** |
| Existing ERP tables the app **extended** with new columns | **2** |

`GAUGEANDTOOLS` **is** the tools master for this app. It was not replaced or duplicated — 22 Prisma
relations hang off it, and every new calibration, stock, defect and document record keys back to it
by `REF_NO` or `TOOL_OR_GAUGE_NO`. There is no second tools master.

The app also writes directly into the ERP transaction tables — `TOOLS_TRANS_ISSUE`,
`TOOLS_ISSUE_RECEIVED`, `TOOLS_ISSUE_FOR_CALIBRATION`, `TOOLS_RECEIVE_FOR_CALIBRATION`,
`GAUGE_CONTROL_CARD_TRANS`, `COMMON_PURCHASE_ORDER` — using ERP conventions
(`CREAT_USER_ID_CD`, `CREAT_DT`). Issue and receive movements land in the ERP's own tables, not in
app-private ones.

And where extending an ERP table was safe, that is what was done rather than adding a table:

| ERP table extended | Columns added | Migration |
| --- | --- | --- |
| `GAUGEANDTOOLS` | `MAKE` | `20260811150000_tools_master_make` |
| `TOOLS_PRICE_MASTER` | `PROPOSED_RATE`, `SUBMITTED_BY`, `SUBMITTED_AT`, `APPROVED_BY`, `APPROVED_AT`, `REJECTED_REASON` | `20260808170000_tools_price_master_approval_workflow` |

Both are additive, all-nullable, and guarded by `IF COL_LENGTH(...) IS NULL` so they are safe to
re-run and invisible to the ERP application.

So the question is not "why a parallel system" — it's "why these specific 22".

---

## 1. Blocker: ERP primary keys are not IDENTITY

The single most important constraint. From `prisma/schema.prisma`:

```prisma
model GaugeControlCardTrans {
  // ERP ROW_ID is NOT identity; every writer must allocate max(ROW_ID)+1.
  rowId Int @id @map("ROW_ID")
```

ERP tables allocate primary keys as `SELECT MAX(ROW_ID) + 1`. That works when one application
writes. With the ERP and the Tools app both inserting, two concurrent writers read the same MAX and
collide — a PK violation, or worse, a silent overwrite.

Every table the Tools app created uses a real database-assigned key:

```prisma
model CalibrationResultDetail {
  id Int @id @default(autoincrement()) @map("ID")
```

Storing high-frequency new records (every calibration result, every unit stock row, every document,
every notification) in ERP tables would have meant adopting `MAX+1` for all of them and accepting
collisions under concurrent use. This alone rules out reusing ERP tables for anything write-heavy.

## 2. Blocker: ERP columns are too narrow to hold the data

Two concrete cases where reuse is physically impossible, not merely inconvenient:

**`ERP_USER` cannot store a modern password.**

```prisma
model ErpUser {
  userId   String @id @map("USER_ID") @db.NVarChar(10)
  pass     String @map("PASS")        @db.NVarChar(50)
  roleName String? @map("ROLE_NAME")  @db.NVarChar(15)
```

`PASS` is `NVARCHAR(50)`. A bcrypt hash is **60 characters** — it does not fit. `TOOLS_APP_USER`
uses `passwordHash NVARCHAR(255)` at 12 rounds. Widening `ERP_USER.PASS` would mean altering the
table the ERP's own login reads, and `ROLE_NAME NVARCHAR(15)` cannot hold `"Calibration Engineer"`
(20 chars) or `"Purchase Coordinator"` (20 chars) either.

**`GAUGE_CONTROL_CARD_TRANS` cannot record a calibration certificate.**

The ERP's calibration history row is: `C_DATE`, `NEXT_C_DATE`, `REMARKS NVARCHAR(25)`. Twenty-five
characters of free text, and nothing else. A calibration result in this app records certificate
number, reference standard used, observed error, pass/fail status, calibrated-by, comments up to
1000 characters, plus child rows for individual observations and out-of-tolerance deviations.

You cannot put an ISO-traceable calibration certificate in a 25-character remarks field. This is why
`TOOLS_APP_CALIBRATION_RESULT` + `_OBS` exist. The ERP control card is still written — the new table
supplements it, it does not replace it.

## 3. Blocker: the cardinality is different

`GAUGEANDTOOLS` carries **one** set of stock figures for the whole company:
`TOT_QTY`, `QTY_IN`, `QTY_OUT`, `QTY_NEW`, `QTY_IN_USE`.

Multi-unit operation needs those figures **per unit**. Two ways to force that into the master, both
bad:

- one master row per (tool × unit) — breaks the `TOOL_OR_GAUGE_NO` unique constraint and multiplies
  every master record the ERP reads
- add five more quantity columns per unit — unbounded schema growth, new columns each time a plant opens

`TOOLS_UNIT_STOCK` is a normal 1:N child keyed `(REF_NO, UNIT_CODE)`. This is a modelling
requirement, not a preference: a 1:1 table cannot hold 1:N data.

## 4. Blocker: the concept does not exist in the ERP at all

No existing table was rejected here — there was nothing to reuse.

| New table | What it holds | ERP equivalent |
| --- | --- | --- |
| `TOOLS_ROLE_PERMISSION` | per-role permission flags | none — ERP has a single `ROLE_NAME` string |
| `TOOLS_APP_ROLE` / `_MODULE` / `_ROLE_PERMISSION_MATRIX` / `_USER_ROLE` / `_USER_UNIT_SCOPE` | module × action RBAC | none |
| `TOOLS_APP_DOCUMENT` | tool photos, certificates, attachments | none |
| `TOOLS_APP_NOTIFICATION_SETTING` / `_RECIPIENT` / `TOOLS_APP_CALIBRATION_NOTIFICATION` | scheduled calibration-due email config + send log | none |
| `TOOLS_APP_INSTRUMENT_DEFECT` / `_SERVICE` / `TOOLS_APP_CALIBRATION_DEVIATION` | defect register, service history, out-of-tolerance recovery | none |
| `TOOLS_APP_CALIBRATION_AGENCY` | approved external calibration labs | none |
| `TOOLS_UNIT_MASTER` | unit/plant list | none |
| `TOOLS_PO_FINANCE` / `_LINE` | PO payment status tracking | `COMMON_PURCHASE_ORDER` exists but is shared with the ERP's purchasing module; adding workflow state there risks that module |

---

## 5. Where the evidence does *not* support a clean rationale

Stated plainly, because an ERP team will find these:

**5.1 — Five tables have no migration.** `TOOLS_APP_ROLE`, `TOOLS_APP_MODULE`,
`TOOLS_APP_ROLE_PERMISSION_MATRIX`, `TOOLS_APP_USER_ROLE`, `TOOLS_APP_USER_UNIT_SCOPE` are live in
the database but nothing in `prisma/migrations/` creates them. Two later migrations *insert into*
them. A clean `prisma migrate deploy` fails.

**5.2 — Two parallel permission systems.** `TOOLS_ROLE_PERMISSION` (flag-based, read by ~60 API
routes) and `TOOLS_APP_ROLE_PERMISSION_MATRIX` (module × action, written by the Settings → Roles
screen, read by 2 routes). The Settings UI edits one; nearly everything enforces the other. This is
not a design choice with a rationale — it is an unfinished migration between two designs.

**5.3 — Duplicated calibration snapshot fields.** `calibDate`, `nextCalibDate`, `observedError`,
`calibAgency` exist on **both** `TOOLS_UNIT_STOCK` and `TOOLS_APP_INSTRUMENT_MASTER_DATA`. Two
places to write, two places to drift.

**5.4 — `TOOLS_APP_INSTRUMENT_MASTER_DATA` is inconsistent with the project's own precedent.** It is
a strict 1:1 sidecar on `GAUGEANDTOOLS` (`REF_NO` is both PK and FK, `onDelete: Cascade`) holding
four columns. Since `MAKE` was already added directly to `GAUGEANDTOOLS`, those four could have been
added the same way. A 1:1 sidecar is a defensible pattern — it keeps ERP DDL untouched — but the
project did not apply it consistently.

---

## Summary for the ERP team

1. The ERP tools master is used, not duplicated. 36 ERP tables read and written; issue, receive and
   calibration movements go into the ERP's own transaction tables.
2. Two ERP tables gained nullable columns, both additive and re-runnable.
3. New tables were added only where an ERP table physically could not hold the data — non-IDENTITY
   PKs unsafe for a second concurrent writer, columns too narrow (60-char hash into `NVARCHAR(50)`,
   calibration certificate into `NVARCHAR(25)`), 1:N data in a 1:1 table — or where the concept had
   no ERP table at all.
4. Four known debts are listed in section 5 and should be closed before the next environment build.
