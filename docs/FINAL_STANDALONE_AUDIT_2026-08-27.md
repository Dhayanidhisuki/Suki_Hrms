# Final standalone audit — 27 August 2026

## Outcome

`Suki_Manpro_Tools` on `192.168.1.151` is now a standalone Tools database.

- Exactly 64 user tables remain.
- 58 are mapped by `prisma/schema.prisma`.
- 5 are runtime raw-SQL dependencies: `COMPANY_DETAILS`, `DEPT`,
  `FINANCE_LEDGER_MASTER`, `LOCATION_MASTER` and `UOM_MASTER`.
- `_prisma_migrations` is retained for deployment history.
- Missing required tables: 0.
- Unexpected tables: 0.
- Remaining HRMS tables: 0.
- Remaining legacy views/functions: 0.

## Retained record verification

| Dataset | Rows |
| --- | ---: |
| Tools | 1,731 |
| Suppliers | 1,225 |
| Subcontractors | 327 |
| Employees | 1,045 |
| ERP users | 149 |
| Tools application users | 17 |

## Verification passed

- All 21 Prisma migrations are applied.
- `npx prisma validate` passed.
- `npx tsc --noEmit --pretty false` passed.
- `npm run build` passed and generated all 121 application routes/pages.
- Live Prisma reads passed for all 58 mapped models.
- Live reads passed for all 5 raw-SQL dependency tables.
- Runtime-source dependency scan found no referenced legacy table missing from the database.
- `.env` targets `.151 / Suki_Manpro_Tools`.
- `.env.local` does not override `DATABASE_URL`.
- `.env` and `.env.local` are ignored by Git.

## Recovery

SQL Server contains a checksum-verified recovery backup created immediately before the broad
standalone cleanup:

`Suki_Manpro_Tools_before_unrelated_removal.bak`

The guarded cleanup is reproducible from
`prisma/remove-unrelated-tables-from-standalone.sql`.

## Remaining gaps

1. Repository-wide ESLint does not pass. Within `src/`, there are 54 errors and 53 warnings across
   35 files. These are primarily existing React hook, explicit-`any`, unused-variable and mock-data
   rules. They do not block the current production build, but must be addressed if CI requires a
   clean lint gate.
2. The restored database contains 17 active Tools application users. Do not delete or replace them
   until the approved fresh-user list and credentials are supplied.
3. Rotate the SQL Server password, SMTP password and session secret because they were exposed in
   project conversation/context.
4. Confirm the 7:00 AM calibration scheduler on the deployment host after the application is
   restarted with the standalone database configuration.
5. Database backups do not include uploaded document bytes stored on the application filesystem;
   include the configured document-storage directory in deployment backups.

