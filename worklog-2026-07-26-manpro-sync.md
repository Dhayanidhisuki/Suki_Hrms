# Worklog — Manpro ERP Schema Sync (26 Jul 2026)

> Note: this work is reconstructed from the current uncommitted working-tree
> changes (`git status` / `git diff`), not from actions performed together
> in this chat session. Verify details before submitting/committing.

## Summary
Synced the app's Prisma schema, request validators, and auth/session logic
against the **real** `ERPDb_Manpro` production database structure, replacing
earlier assumed/simplified field names and types with the actual legacy ERP
column names.

## Details

### 1. Pulled the real Manpro DB schema
- Ran `prisma db pull` against `ERPDb_Manpro` → saved as
  `prisma/pulled-schema-temp.prisma` (reference dump, hundreds of legacy ERP
  tables/models, e.g. `ErpUser`, `ACCOUNTS_MASTER`, `AUDIT_MASTER`,
  `ASSIGN_COURSE`, etc.).
- Exported full `ERPDb_Manpro` database script to `manpro.sql` (schema +
  users, e.g. `sukierpadmin`).

### 2. Aligned `prisma/schema.prisma` with the real schema
- 646-line diff — field names/types across models updated to match actual
  Manpro columns instead of prior simplified/custom naming.

### 3. Updated app code to match new schema
- `src/lib/auth.ts`
  - Active-user check changed from `erpUser.isActive` (boolean) to
    `erpUser.status !== "Active"` (string status column).
  - Display name now built from `employee.firstName` + `employee.lastName`
    instead of a single `empName` field.
  - `empCd` coerced to `String()` (real column is numeric); `roleName`
    defaulted to `""` when null.
- `src/lib/validators.ts` (184-line diff) — Zod schemas updated to match
  real Manpro column names/lengths/types, including:
  - **Supplier**: `address→add1`, `phone→phone1`, `email→emailId`,
    `accountNo→accountNumber`, `isApproved→approvedSupplier` (string flag),
    `status` now free-text instead of enum.
  - **Subcontractor**: `subCode→subConId`, boolean flags (`isStoreVendor`,
    `isInhouse`, `isIssueDc`) changed to string Y/N-style fields,
    `address→add1`.
  - **Tools/Gauge type masters**: restructured field sets per type
    (`ToolsTypeSchema`, `GaugeTypeSchema`, `OtherToolsTypeSchema`,
    `QmsOtherToolsTypeSchema`) to match distinct real tables instead of a
    shared generic shape.
  - **GaugeAndTools master**: added `refNo`, `des`, `uom`, `returnable`;
    renamed spec sub-fields (`specName→parameter`,
    `specValue→specification`, added `minRange`/`maxRange`).
  - **Issue/Receive/Consumption/PO/Calibration schemas**: field renames to
    match real columns (`deptName/partyName→receiveName`, `qtyIssued→issueQty`,
    `qtyReturned→quantity`, `poRef→poOrderNo`, `grnDate→girDate`,
    `calibDcNo→dcNo` (now numeric), etc.); several previously-required
    fields relaxed to optional and enums loosened to free-text status
    strings to match legacy data.
  - Added new `CalibFrequencyMasterSchema`.
- New route: `src/app/api/lookups/calib-frequency/` (added, untracked).

### 4. ERP user table setup
- `prisma/create-erp-user.sql` — creates `dbo.ERP_USER` in
  `suki_tools_management` (drops/recreates if exists) with columns
  `USER_ID`, `ROLE_NAME`, `ADD_ROLE_NAME`, `EMP_CD`, `IS_ACTIVE`.
  - Note: this simplified table shape differs from the `ErpUser` model
    pulled from `ERPDb_Manpro` (which has `STATUS` as a string, `PASS`,
    numeric `EMP_CD`, etc.) — worth confirming which shape is authoritative
    before relying on `auth.ts`'s `status`-based check in production.

## Status
- All of the above are **uncommitted** local changes (`git status` shows
  them as modified/untracked) — not yet committed to `main`.

## Follow-ups to verify
- Reconcile `create-erp-user.sql` (simple `IS_ACTIVE` bit) vs. the pulled
  `ErpUser` model (`STATUS` string) — `auth.ts` currently assumes the
  latter.
- Confirm all API routes consuming the renamed validator fields (issue,
  receive, consumption, PO GRN/schedule, calibration issue/receive) were
  updated consistently — many route files show as modified in `git status`
  alongside the validators.
- Decide whether `manpro.sql` / `pulled-schema-temp.prisma` should be
  removed before commit (large generated reference dumps, not meant as
  permanent project files) or kept under a `docs/`-style path.
