# Database table inventory — Tools Management inside the existing ERP database

The Tools app runs **inside the existing SUKI ERP SQL Server database**, not a separate one.
This document separates what the app **created** from what it **only reads/writes** on the ERP side.

Derived from `prisma/schema.prisma` (58 mapped tables) cross-referenced with every
`CREATE TABLE` / `ALTER TABLE` statement in `prisma/migrations/`.

**Totals: 58 tables mapped — 22 new, 36 pre-existing ERP.**

---

## 1. New tables created by this app (17, each with a migration)

All use a `TOOLS_APP_*`, `TOOLS_PO_FINANCE*`, `TOOLS_UNIT_*` or `TOOLS_ROLE_*` prefix.

| # | Table | Prisma model | Created by migration |
| --- | --- | --- | --- |
| 1 | `TOOLS_APP_USER` | `User` | `20260801130000_create_tools_app_user` |
| 2 | `TOOLS_APP_DOCUMENT` | `ToolDocument` | `20260803113000_create_tools_app_document` |
| 3 | `TOOLS_ROLE_PERMISSION` | `RolePermission` | `20260808160000_create_tools_role_permission` |
| 4 | `TOOLS_PO_FINANCE` | `ToolsPoFinance` | `20260808180000_tools_po_finance` |
| 5 | `TOOLS_PO_FINANCE_LINE` | `ToolsPoFinanceLine` | `20260808180000_tools_po_finance` |
| 6 | `TOOLS_APP_CALIBRATION_RESULT` | `CalibrationResultDetail` | `20260811120000_calibration_result_details` |
| 7 | `TOOLS_APP_CALIBRATION_RESULT_OBS` | `CalibrationResultObservation` | `20260811120000_calibration_result_details` |
| 8 | `TOOLS_UNIT_STOCK` | `ToolsUnitStock` | `20260811130000_add_tools_unit_stock` |
| 9 | `TOOLS_UNIT_MASTER` | `ToolsUnitMaster` | `20260811140000_add_tools_unit_master` |
| 10 | `TOOLS_APP_CALIBRATION_AGENCY` | `AuthorizedCalibrationAgency` | `20260811170000_authorized_calibration_agency` |
| 11 | `TOOLS_APP_INSTRUMENT_DEFECT` | `InstrumentDefect` | `20260811180000_defect_service_deviation` |
| 12 | `TOOLS_APP_INSTRUMENT_SERVICE` | `InstrumentServiceRecord` | `20260811180000_defect_service_deviation` |
| 13 | `TOOLS_APP_CALIBRATION_DEVIATION` | `CalibrationDeviation` | `20260811180000_defect_service_deviation` |
| 14 | `TOOLS_APP_NOTIFICATION_SETTING` | `CalibrationNotificationSetting` | `20260811190000_calibration_notifications` |
| 15 | `TOOLS_APP_NOTIFICATION_RECIPIENT` | `CalibrationNotificationRecipient` | `20260811190000_calibration_notifications` |
| 16 | `TOOLS_APP_CALIBRATION_NOTIFICATION` | `CalibrationNotification` | `20260811190000_calibration_notifications` |
| 17 | `TOOLS_APP_INSTRUMENT_MASTER_DATA` | `InstrumentImportedMasterData` | `20260814123000_add_instrument_imported_master_data` |

## 2. New tables with NO migration (5) — see warning below

These exist in `schema.prisma` and are live in the database, but **no migration file creates
them**. They are the "System A" module-matrix RBAC tables.

| Table | Prisma model | Purpose |
| --- | --- | --- |
| `TOOLS_APP_ROLE` | `Role` | Role records, incl. `isSystemAdmin` |
| `TOOLS_APP_MODULE` | `Module` | Module registry + `applicableActions` |
| `TOOLS_APP_ROLE_PERMISSION_MATRIX` | `RolePermissionMatrix` | role × module × action grants |
| `TOOLS_APP_USER_ROLE` | `UserRole` | user → role link |
| `TOOLS_APP_USER_UNIT_SCOPE` | `UserUnitScope` | per-unit data scoping |

> **Deployment risk.** They were created out-of-band (`prisma db push` or manual SQL), so a
> clean `prisma migrate deploy` against a fresh database will **fail**: migration
> `20260817150000_user_notification_email_permission` does
> `INSERT INTO [dbo].[TOOLS_APP_MODULE]`, and
> `20260817170000_notification_role_defaults` reads `TOOLS_APP_ROLE` and inserts into
> `TOOLS_APP_ROLE_PERMISSION_MATRIX` — all against tables no migration ever creates.
> Fix by adding a baseline migration that creates these five, ordered before `20260817150000`.

## 3. Pre-existing ERP tables (36) — read/written, never created here

No migration creates any of these. The app reads them and, for the transaction tables, writes
rows using existing ERP conventions (`CREAT_USER_ID_CD` etc.).

**Core ERP / org**
`ERP_USER` · `EMPLOYEE` · `SUPPLIER` · `SUBCONTRACTOR`

**Gauge & tool masters**
`GAUGEANDTOOLS` · `GAUGE_TYPE` · `GAUGE_SERIAL_NO` · `GAUGE_CONTROL_CARD` ·
`GAUGE_CONTROL_CARD_TRANS` · `GAUGE_TOOLS_ISSUE` · `TOOLS_TYPE` · `TOOLS_DETAILS` ·
`TOOLS_SPECIFICATION` · `TOOLS_MAPPING` · `TOOLS_PRICE_MASTER` · `OTHER_TOOLS_TYPE` ·
`QMS_OTHER_TOOLS_TYPE` · `CALIBRATION_FREQUENCY_MASTER`

**Issue / receive / consumption transactions**
`TOOLS_TRANS_ISSUE` · `TOOLS_ISSUE_RECEIVED` · `TOOLS_ISSUE_RECEIVED_TRANS` ·
`TOOLS_CONSUMPTION_TRANS_ISSUE` · `TOOLS_MACHINE_TRANS`

**Calibration transactions**
`TOOLS_ISSUE_FOR_CALIBRATION` · `TOOLS_TRANS_ISSUE_FOR_CALIBRATION` ·
`TOOLS_RECEIVE_FOR_CALIBRATION` · `TOOLS_TRANS_RECEIVE_FOR_CALIBRATION`

**Purchase / requisition**
`COMMON_PURCHASE_ORDER` · `COMMON_PURCHASE_ITEM` · `PURCHASE_APPROVAL` ·
`MATERIAL_REQUISITION_MASTER` · `MATERIAL_REQUISITION_TRANS` · `TOOLS_PO_SCH_MASTER` ·
`TOOLS_PO_SCH_TRANS` · `TOOLS_PO_RECEIVE` · `TOOLS_PO_RECEIVE_TRANS`

## 4. Columns added by migrations

**Two pre-existing ERP tables were extended.** Both additions are additive, all-nullable, and
guarded by `IF COL_LENGTH(...) IS NULL`, so they are re-runnable and invisible to the ERP
application — but they are changes to ERP-owned tables and should be declared to the ERP team.

| ERP table | Columns added | Migration |
| --- | --- | --- |
| `GAUGEANDTOOLS` | `MAKE` | `20260811150000_tools_master_make` |
| `TOOLS_PRICE_MASTER` | `PROPOSED_RATE`, `SUBMITTED_BY`, `SUBMITTED_AT`, `APPROVED_BY`, `APPROVED_AT`, `REJECTED_REASON` | `20260808170000_tools_price_master_approval_workflow` |

Changes to the app's own tables:

| Table | Change |
| --- | --- |
| `TOOLS_APP_USER` | + `email` |
| `TOOLS_APP_CALIBRATION_NOTIFICATION` | + `CC_ADDRESS`, `BCC_ADDRESS`, `RESPONSIBILITY` |
| `TOOLS_APP_NOTIFICATION_RECIPIENT` | + `UNIT_CODE`, `RESPONSIBILITY`, `UPDATED_BY`, `CREATED_BY`, `UPDATED_AT` |
| `TOOLS_UNIT_STOCK` | + `MFG_SERIAL_NO`, − `VALIDITY_DAYS` |

See [`WHY-NEW-TABLES.md`](./WHY-NEW-TABLES.md) for the rationale behind each new table.

---

## Naming rule of thumb

| Prefix | Owner |
| --- | --- |
| `TOOLS_APP_*` | Created by this app |
| `TOOLS_PO_FINANCE*`, `TOOLS_UNIT_*`, `TOOLS_ROLE_PERMISSION` | Created by this app |
| `TOOLS_*` (all others) | Pre-existing ERP |
| everything else | Pre-existing ERP |

The one trap: `TOOLS_ROLE_PERMISSION` (new, this app) vs
`TOOLS_APP_ROLE_PERMISSION_MATRIX` (new, this app, different RBAC system). Similar names,
different tables, different permission systems — see the RBAC notes.
