# Deployment runbook — `Suki_Manpro_Tools` on `.151`

## Objective

Create a new SQL Server database named `Suki_Manpro_Tools`, transfer the complete Manpro schema
and data while preserving legacy identifiers, apply the additive Tools application migrations,
then create fresh application login users.

## Non-negotiable safety rules

- Do not run `prisma db push`, `--accept-data-loss`, `--force-reset`, or `migrate reset`.
- Do not point the application at `.151` until restore and verification are complete.
- Do not delete/re-import `GAUGEANDTOOLS`; bulk import must update/upsert transferred records so
  `REF_NO` relationships remain intact.
- Keep the source database `SUKISERVER1 / ERPDb_Manpro` unchanged.

## Phase 1 — SQL Server transfer (DBA)

1. Take a full `COPY_ONLY`, `CHECKSUM` backup of `ERPDb_Manpro`.
2. Run `RESTORE VERIFYONLY` against the backup.
3. Copy the backup to the `.151` SQL Server host.
4. Use `RESTORE FILELISTONLY` to obtain logical data/log file names.
5. Restore it on `.151` under the new name `Suki_Manpro_Tools`, using target-specific `MOVE`
   paths supplied by the `.151` DBA.
6. Keep the restored database inaccessible to application users until verification completes.

## Phase 2 — Pre-migration verification

Run `prisma/verify-full-database-transfer.sql` against both source and target and export every
result set. It inventories every user table and metadata row count plus columns, indexes, foreign
keys, views, procedures, functions, triggers, sequences, synonyms, database principals and
cross-database dependencies.

Record and compare at minimum:

```sql
SELECT DB_NAME() AS database_name, COUNT(*) AS table_count
FROM sys.tables;

SELECT 'GAUGEANDTOOLS' AS table_name, COUNT_BIG(*) AS row_count FROM dbo.GAUGEANDTOOLS
UNION ALL SELECT 'SUPPLIER', COUNT_BIG(*) FROM dbo.SUPPLIER
UNION ALL SELECT 'SUBCONTRACTOR', COUNT_BIG(*) FROM dbo.SUBCONTRACTOR
UNION ALL SELECT 'ERP_USER', COUNT_BIG(*) FROM dbo.ERP_USER
UNION ALL SELECT 'TOOLS_TRANS_ISSUE', COUNT_BIG(*) FROM dbo.TOOLS_TRANS_ISSUE
UNION ALL SELECT 'TOOLS_ISSUE_RECEIVED_TRANS', COUNT_BIG(*) FROM dbo.TOOLS_ISSUE_RECEIVED_TRANS;
```

The source and target inventories must match before applying Tools migrations. Any mismatch must
be explained and signed off rather than ignored.

### Server-level objects not contained in a database backup

A full database backup includes all database tables/data, views, procedures, functions, triggers,
constraints, indexes and database users. It does **not** transfer SQL Server logins, SQL Agent jobs,
linked-server definitions, server credentials, certificates/keys held outside the database,
backup schedules or firewall configuration. The DBA must inventory and recreate required
server-level objects on `.151`, then map restored database users to their target logins.

## Phase 3 — Application migrations

1. Create a deployment-only environment file whose `DATABASE_URL` targets
   `.151 / Suki_Manpro_Tools`.
2. Confirm the connection with a read-only `DB_NAME()` query.
3. Review migration status.
4. Apply committed migrations:

```bash
npx prisma migrate status
npx prisma migrate deploy
npx prisma generate
```

Migration `20260817140000_create_module_rbac_baseline` creates the five module-RBAC tables that
were previously missing from the migration chain.

## Phase 4 — Fresh application users

Do not run the demo-user seed. Seed the canonical permission matrix, then one approved admin:

```bash
npm run db:seed:role-permissions

SEED_ADMIN_USERNAME=admin \
SEED_ADMIN_PASSWORD='<secure deployment secret>' \
SEED_ADMIN_NAME='System Admin' \
SEED_ADMIN_ERP_USER_CODE='<existing ERP_USER.USER_ID>' \
npm run db:seed
```

The ERP user code must already exist in `dbo.ERP_USER`; it is used for legacy audit foreign keys.

## Phase 5 — Tool Master refresh

- Use the Instrument Master template after the full database transfer.
- Import in preview mode first.
- Confirm updates are matched by Instrument/Equipment Number.
- Do not clear `GAUGEANDTOOLS` or regenerate existing `REF_NO` values.
- Download and review rejected rows before confirmation.

## Phase 6 — Application verification

- Build the application with `.151 / Suki_Manpro_Tools` configuration.
- Verify login, Instrument Master counts, suppliers, movements, calibration, PO/GRN, pricing and
  history-card pages.
- Compare key row counts again after migration and seed.
- Keep the original database and backup available for rollback until sign-off.

## Phase 7 — Standalone cleanup (completed 27 August 2026)

- Created and checksum-verified a pre-cleanup recovery backup.
- Retained the 58 Prisma-mapped tables, five runtime raw-SQL dependency tables and
  `_prisma_migrations`.
- Removed all other restored ERP tables and unused SQL views/functions with the guarded,
  transactional script `prisma/remove-unrelated-tables-from-standalone.sql`.
- Verified the final database contains exactly 64 required tables, with no missing or unexpected
  tables.
- Verified all mapped models and raw-SQL lookup tables through live reads.

## Required information before execution

- Exact `.151` SQL Server hostname or IP and port.
- SQL login with permission to create/restore the database and apply migrations.
- Source and target backup-file paths accessible by the SQL Server service accounts.
- Target logical/physical MDF and LDF paths.
- Approved `ERP_USER.USER_ID` for application audit writes.
