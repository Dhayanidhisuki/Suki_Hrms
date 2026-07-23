# Worklog: ERP to Sample Database Sync

**Date:** 2026-07-22  
**Task:** Sync data from ERP MSSQL database (`ERPDb_ESSKAY`) to sample database (`suki_tools_management`)

---

## Objective

Extract data from the original ERP MSSQL database and insert it into the sample database `suki_tools_management` for development/testing purposes, without modifying the ERP database.

## Context

- The project uses Prisma ORM with SQL Server.
- The sample database (`suki_tools_management`) has a different schema from the ERP database (`ERPDb_ESSKAY`) — column names differ.
- Both databases are on the same SQL Server instance, enabling direct `INSERT INTO [SampleDB].dbo.TABLE SELECT ... FROM [ERPDB].dbo.TABLE` statements.
- The ERP database should never be written to; the script only reads from it.

## Files Created/Modified

| File | Purpose |
|------|---------|
| `prisma/sync-erp-to-sample.sql` | Main sync script — clears sample DB, inserts data from ERP with column mappings |
| `prisma/discover-erp-schema.sql` | Schema discovery script — queries `INFORMATION_SCHEMA.COLUMNS` on ERP DB |

## Process

### Phase 1: Schema Discovery

1. Created `discover-erp-schema.sql` to query `INFORMATION_SCHEMA.COLUMNS` on the ERP database.
2. Iteratively refined the script to handle output truncation:
   - First attempt: standard `SELECT` — output truncated due to large number of columns.
   - Second attempt: `STRING_AGG` to concatenate columns per table — still truncated for some tables.
   - Third attempt: One column per row — guaranteed no truncation.
3. Ran discovery in batches to get all 30 ERP tables' actual column names and data types.

### Phase 2: Sync Script Creation

1. Created `sync-erp-to-sample.sql` with 3 steps:
   - **STEP 1:** `USE suki_tools_management` — DELETE all data and reset identity columns via `DBCC CHECKIDENT`.
   - **STEP 2:** `USE ERPDb_ESSKAY` — `INSERT INTO suki_tools_management.dbo.* SELECT ... FROM ERP_TABLE` with explicit column mappings.
   - **STEP 3:** `USE suki_tools_management` — Update calibration dates on `GAUGEANDTOOLS` from `GAUGE_CONTROL_CARD` data.

2. Key column mappings discovered:
   - ERP `EMPLOYEE` uses `FIRST_NAME` → sample DB uses `EMP_NAME`.
   - ERP `SUPPLIER` uses `ADD1`, `ADD2` → sample DB uses `ADDRESS` (concatenated).
   - ERP `GAUGEANDTOOLS` uses `REF_NO` as identity → sample DB uses `ID` (auto-increment).
   - ERP `GAUGEANDTOOLS.SERIAL_NO_GEN_REQ` is `nvarchar ('Yes'/'No')` → sample DB is `Boolean/int`.
   - ERP `TOOLS_PO_RECEIVE.GIR_NO` is `int` → sample DB `GRN_NO` is `VARCHAR(30)`.
   - ERP `TOOLS_MAPPING.TOOL_REF_NO` → sample DB `TOOL_OR_GAUGE_NO` (via join with `GAUGEANDTOOLS.REF_NO`).

### Phase 3: Debugging & Fixes

#### Error 1: "Invalid column name" errors (all tables)
- **Cause:** User ran STEP 2 while still connected to `suki_tools_management` instead of `ERPDb_ESSKAY`. The sample DB has different column names.
- **Fix:** Added `USE ERPDb_ESSKAY;` at the start of STEP 2 to auto-switch databases.

#### Error 2: String truncation — `ADD_ROLE_NAME` in `ERP_USER`
- **Error:** `Msg 2628: String or binary data would be truncated in column 'ADD_ROLE_NAME'.`
- **Cause:** ERP `ADD_ROLE_NAME` contains comma-separated roles longer than 50 chars.
- **Fix:** `LEFT(ADD_ROLE_NAME, 50)` and `LEFT(ROLE_NAME, 50)` in the SELECT.

#### Error 3: Data type conversion — `SERIAL_NO_GEN_REQ` in `GAUGEANDTOOLS`
- **Error:** `Msg 245: Conversion failed when converting nvarchar value 'No' to int.`
- **Cause:** ERP stores `'Yes'/'No'`, sample DB expects `int (1/0)`.
- **Fix:** `CASE WHEN ISNULL(SERIAL_NO_GEN_REQ, 'No') IN ('Yes', '1', 'true') THEN 1 ELSE 0 END`.

#### Error 4: Duplicate key — `GAUGE_SERIAL_NO`
- **Error:** `Msg 2627: Violation of UNIQUE KEY constraint 'GAUGE_SERIAL_NO_SERIAL_NO_key'. Duplicate key value (1).`
- **Cause:** Multiple tools share the same serial number (e.g., serial_no = 1).
- **Fix:** Appended `-REF_NO` to make serials unique: `CAST(SERIAL_NO AS VARCHAR(50)) + '-' + CAST(REF_NO AS VARCHAR(10))`.

#### Error 5: FK violation — `GAUGE_SERIAL_NO.TOOL_OR_GAUGE_NO`
- **Error:** `Msg 547: FK constraint 'GAUGE_SERIAL_NO_TOOL_OR_GAUGE_NO_fkey' conflict.`
- **Cause:** Some serial numbers reference tools that don't exist in the sample DB.
- **Fix:** Added `INNER JOIN GAUGEANDTOOLS g ON gs.TOOL_OR_GAUGE_NO = g.TOOL_OR_GAUGE_NO`.

#### Error 6: FK violation — `TOOLS_MAPPING.SUP_CODE`
- **Error:** `Msg 547: FK constraint 'TOOLS_MAPPING_SUP_CODE_fkey' conflict.`
- **Cause:** ERP `TOOLS_MAPPING` has supplier codes not present in the sample `SUPPLIER` table.
- **Fix:** Added `INNER JOIN suki_tools_management.dbo.SUPPLIER s ON m.SUP_CODE = s.SUP_CODE`.

#### Error 7: Unique constraint — `TOOLS_MAPPING`
- **Error:** `Msg 2627: Violation of UNIQUE KEY constraint 'TOOLS_MAPPING_TOOL_OR_GAUGE_NO_SUP_CODE_key'.`
- **Cause:** Duplicate `(TOOL_OR_GAUGE_NO, SUP_CODE)` pairs in ERP data.
- **Fix:** Added `ROW_NUMBER() OVER (PARTITION BY TOOL_REF_NO, SUP_CODE ORDER BY ROW_ID)` and filtered `rn = 1`.

#### Error 8: FK violation — `TOOLS_PO_RECEIVE.SUP_CODE`
- **Error:** `Msg 547: FK constraint 'TOOLS_PO_RECEIVE_SUP_CODE_fkey' conflict.`
- **Cause:** Same as Error 6 — supplier codes in ERP not in sample SUPPLIER table.
- **Fix:** Added `INNER JOIN suki_tools_management.dbo.SUPPLIER s ON pr.SUP_CODE = s.SUP_CODE`.

#### Error 9: Ambiguous column names — `TOOLS_PO_RECEIVE`
- **Error:** `Msg 209: Ambiguous column name 'SUP_CODE', 'CREAT_USER_ID_CD', 'CREAT_DT'.`
- **Cause:** Join with `SUPPLIER` table created ambiguity on shared column names.
- **Fix:** Added `pr.` prefix to all columns in the SELECT from `TOOLS_PO_RECEIVE`.

#### Error 10: FK violation — `TOOLS_PO_RECEIVE_TRANS.GRN_NO`
- **Error:** `Msg 547: FK constraint 'TOOLS_PO_RECEIVE_TRANS_GRN_NO_fkey' conflict.`
- **Cause:** Trans lines reference GRN numbers that weren't inserted (because their suppliers were filtered out).
- **Fix:** Added `INNER JOIN TOOLS_PO_RECEIVE pr ON t.GIR_NO = pr.GIR_NO` and `INNER JOIN suki_tools_management.dbo.SUPPLIER s ON pr.SUP_CODE = s.SUP_CODE`.

## Final Result

**All 30 tables synced successfully with zero errors.**

### Row Counts

| Table | Rows Synced |
|-------|-------------|
| ERP_USER | 15 |
| EMPLOYEE | 159 |
| SUPPLIER | 176 |
| SUBCONTRACTOR | 37 |
| TOOLS_TYPE | 43 |
| GAUGE_TYPE | 31 |
| OTHER_TOOLS_TYPE | 8 |
| QMS_OTHER_TOOLS_TYPE | 71 |
| GAUGEANDTOOLS | 1,639 |
| GAUGE_SERIAL_NO | 268 |
| TOOLS_DETAILS | 0 (no matching TOOL_REF_NO) |
| TOOLS_SPECIFICATION | 0 (no matching TOOL_REF_NO) |
| TOOLS_PRICE_MASTER | 2,009 |
| TOOLS_MAPPING | 1,333 |
| TOOLS_MACHINE_TRANS | 0 (no matching TOOL_REF_NO) |
| GAUGE_TOOLS_ISSUE | 116 |
| TOOLS_TRANS_ISSUE | 230 |
| TOOLS_ISSUE_RECEIVED | 99 |
| TOOLS_ISSUE_RECEIVED_TRANS | 165 |
| TOOLS_CONSUMPTION_TRANS_ISSUE | 0 (no matching TOOL_OR_GAUGE_NO) |
| TOOLS_PO_RECEIVE | 1,669 |
| TOOLS_PO_RECEIVE_TRANS | 3,130 |
| TOOLS_PO_SCH_MASTER | 0 (empty in ERP) |
| TOOLS_PO_SCH_TRANS | 0 (empty in ERP) |
| TOOLS_ISSUE_FOR_CALIBRATION | 81 |
| TOOLS_TRANS_ISSUE_FOR_CALIBRATION | 81 |
| TOOLS_RECEIVE_FOR_CALIBRATION | 0 (empty in ERP) |
| TOOLS_TRANS_RECEIVE_FOR_CALIBRATION | 0 (empty in ERP) |
| GAUGE_CONTROL_CARD | 0 (empty in ERP) |
| GAUGE_CONTROL_CARD_TRANS | 0 (empty in ERP) |

### Tables with 0 rows

Some tables show 0 rows because:
- **TOOLS_DETAILS, TOOLS_SPECIFICATION, TOOLS_MACHINE_TRANS:** The ERP uses `TOOL_REF_NO` (int) to link to `GAUGEANDTOOLS.REF_NO`, but some `TOOL_REF_NO` values don't match any `REF_NO` in the sample DB (filtered by the INNER JOIN).
- **TOOLS_CONSUMPTION_TRANS_ISSUE:** The `TOOL_OR_GAUGE_NO` values in ERP don't match the tool numbers in the sample DB.
- **TOOLS_PO_SCH_MASTER/TRANS, TOOLS_RECEIVE_FOR_CALIBRATION, GAUGE_CONTROL_CARD:** These tables appear to be empty in the ERP database.

## Key Decisions

1. **Direct INSERT approach:** Instead of exporting to CSV and importing, used direct `INSERT INTO [SampleDB].dbo.TABLE SELECT ... FROM [ERPDB].dbo.TABLE` since both DBs are on the same SQL Server instance.
2. **INNER JOIN filtering:** Used INNER JOINs with parent tables (SUPPLIER, GAUGEANDTOOLS) to skip orphaned records that would violate FK constraints, rather than inserting dummy parent records.
3. **Serial number uniqueness:** Made serial numbers unique by appending `-REF_NO` rather than skipping duplicates, to preserve all serial number records.
4. **Deduplication:** Used `ROW_NUMBER()` to handle duplicate `(TOOL_OR_GAUGE_NO, SUP_CODE)` pairs in TOOLS_MAPPING, keeping only the first occurrence.
5. **Data type conversions:** Used `CASE` statements for nvarchar→boolean conversions and `CAST` for int→varchar conversions.

## How to Re-run

1. Open `prisma/sync-erp-to-sample.sql` in SSMS.
2. Execute the entire script (no need to switch databases manually — the script handles it with `USE` statements).
3. The script is idempotent — it clears the sample DB first, then re-inserts all data.
