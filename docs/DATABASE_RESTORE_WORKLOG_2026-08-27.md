# Database creation and restoration worklog

**Project:** Suki Tools Management  
**Work date:** 27 August 2026  
**Prepared for:** Development lead / DBA handover  
**Source database:** `ERPDb_Manpro`  
**Created standalone database:** `Suki_Manpro_Tools`  
**Current database server:** `192.168.1.151`  

> This worklog intentionally contains no database, email or session credentials.

## 1. Objective

Create a separate Tools Management database from the existing Manpro ERP database without
changing the source, retain all Tools data and legacy identifiers, add the tables required by the
new application, and remove unrelated ERP/HRMS objects after verification.

## 2. Method used to create the database

The standalone database was created through a **SQL Server full backup and restore**, not through
`prisma db push` and not by recreating the legacy tables individually.

1. A full `COPY_ONLY` backup with `CHECKSUM` was taken from `ERPDb_Manpro`.
2. The backup was checked with `RESTORE VERIFYONLY`.
3. `RESTORE FILELISTONLY` was used to identify the logical data and log files.
4. The backup was restored on server `.151` with the new database name
   `Suki_Manpro_Tools`, using target-specific data and log file paths.
5. The source `ERPDb_Manpro` database was kept unchanged.
6. SQL Server logins and permissions were handled separately because server-level logins are not
   included in a database backup.

This approach preserved legacy primary keys, `REF_NO` values, identity values, relationships,
constraints, indexes, views, routines and existing application data.

## 3. Transfer verification

The read-only script
[`prisma/verify-full-database-transfer.sql`](../prisma/verify-full-database-transfer.sql) was used
to compare the source and restored databases. The verification covered:

- Database identity, compatibility and collation
- User-table inventory and metadata row counts
- Exact column definitions, defaults, identities and computed columns
- Primary keys, unique constraints and indexes
- Foreign keys and their enabled/trusted state
- Views, procedures, functions, triggers, sequences and synonyms
- Cross-database dependencies
- Database users and database-role membership

Any SQL Server Agent jobs, linked servers, server credentials, firewall rules, certificates and
server-level logins must be recreated by the DBA because they are outside the restored database.

## 4. Prisma application setup

After the SQL Server restore was verified:

1. The deployment connection was changed to target `Suki_Manpro_Tools` on `.151`.
2. The connection was checked with a read-only database-name query.
3. The committed additive migrations were applied with `prisma migrate deploy`.
4. Prisma Client was regenerated with `prisma generate`.
5. The Prisma schema was validated with `prisma validate`.

Prisma was used to add and track application-owned tables and columns. It was **not** used to
clone the original ERP schema or data.

## 5. Standalone cleanup

After application verification, a checksum-verified recovery backup was created:

`Suki_Manpro_Tools_before_unrelated_removal.bak`

The guarded transactional cleanup script
[`prisma/remove-unrelated-tables-from-standalone.sql`](../prisma/remove-unrelated-tables-from-standalone.sql)
was then used to remove unrelated restored ERP and HRMS objects. The script refuses to run against
a database whose name is not `Suki_Manpro_Tools`.

The final standalone database retains:

- 58 tables mapped by `prisma/schema.prisma`
- 5 runtime raw-SQL lookup dependencies:
  `COMPANY_DETAILS`, `DEPT`, `FINANCE_LEDGER_MASTER`, `LOCATION_MASTER` and `UOM_MASTER`
- `_prisma_migrations` for Prisma deployment history
- **64 user tables in total**

Final inventory checks found zero missing required tables, zero unexpected tables, zero HRMS
tables and zero unused legacy views/functions.

## 6. Retained-data verification

| Dataset | Verified rows |
| --- | ---: |
| Tools | 1,731 |
| Suppliers | 1,225 |
| Subcontractors | 327 |
| Employees | 1,045 |
| ERP users | 149 |
| Tools application users | 17 |

Existing Tools application users were retained and must not be deleted or replaced until an
approved user-migration decision is provided.

## 7. Technical validation completed

- All 21 Prisma migrations reported as applied.
- `npx prisma validate` passed.
- `npx tsc --noEmit --pretty false` passed.
- `npm run build` passed and generated 121 application routes/pages.
- Live Prisma reads passed for all 58 mapped models.
- Live reads passed for all 5 raw-SQL dependency tables.
- Runtime dependency scanning found no referenced legacy table missing.
- The application environment targets `.151 / Suki_Manpro_Tools`.
- Local environment files are ignored by Git.

Repository-wide ESLint still has existing errors and warnings. These did not block the successful
production build but must be addressed if deployment CI enforces a clean lint result.

## 8. Procedure for moving the completed database to server `.210`

The recommended `.210` deployment is another **full SQL Server backup/restore of the completed
`Suki_Manpro_Tools` database**.

1. Rotate the exposed SQL Server, SMTP and session credentials before deployment.
2. Take a fresh `COPY_ONLY`, `CHECKSUM` backup of the completed `.151` database.
3. Run `RESTORE VERIFYONLY` against the new backup.
4. Record the current migration status and key table counts on `.151`.
5. Copy the backup to the `.210` SQL Server host.
6. Use `RESTORE FILELISTONLY`, then restore it as `Suki_Manpro_Tools` using `.210` data/log paths.
7. Recreate and map the approved SQL Server login on `.210` with least-privilege access.
8. Run the transfer-verification script on both `.151` and `.210` and compare every result set.
9. Update the deployment-only `DATABASE_URL` to `.210`; do not commit it.
10. Run only the following initial application checks:

    ```bash
    npx prisma validate
    npx prisma migrate status
    npx prisma generate
    npm run build
    ```

11. If `migrate status` confirms all migrations are already applied, do not reapply or baseline
    them. Use `prisma migrate deploy` later only when a new committed migration exists.
12. Smoke-test login, master data, tool issue/receive, calibration, movement, PO/GRN, PDF/QR,
    email notifications and the 7:00 AM digest scheduler.
13. Keep the `.151` database and verified backup available until `.210` receives business sign-off.

Do not run `prisma db push`, `prisma migrate dev`, `prisma migrate reset`, `--force-reset` or
`--accept-data-loss` against `.210`.

## 9. Rollback plan

If `.210` verification or smoke testing fails:

1. Stop the application from writing to `.210`.
2. Point the application back to the previously verified `.151` database configuration.
3. Preserve the failed `.210` database for diagnosis; do not overwrite it until evidence is
   collected.
4. Restore from the checksum-verified backup if a clean `.210` retry is approved.

## 10. Sign-off checklist

- [ ] Source and target backup/restore evidence attached
- [ ] Source and target verification outputs match
- [ ] SQL login recreated and mapped on `.210`
- [ ] Credentials rotated and stored outside Git
- [ ] Prisma migration status clean
- [ ] Application build successful
- [ ] Functional smoke tests successful
- [ ] PDF QR opens the approved application verification URL
- [ ] Email and 7:00 AM digest scheduler verified on the deployment host
- [ ] Business owner and DBA sign-off recorded

