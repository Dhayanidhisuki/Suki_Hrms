-- Moves ndaDocument/fitnessCertificate from JobInfo to PersonalDetails, per
-- request to relocate these fields from the Basic Details tab to Personal
-- Details. Both columns were false for every existing row (verified before
-- writing this migration), so no data backfill is needed — this is a pure
-- schema relocation.
--
-- NOTE: `prisma migrate diff` also emits `ALTER TABLE [dbo].[Employee] ADD
-- CONSTRAINT [Employee_userId_key] UNIQUE NONCLUSTERED ([userId])` here —
-- that is NOT applied. Employee.userId is nullable and already has a
-- FILTERED unique index (`Employee_userId_key`, WHERE userId IS NOT NULL)
-- from migration 000001, added because SQL Server's plain UNIQUE constraint
-- treats multiple NULLs as duplicates. Prisma's diff engine doesn't
-- recognize that filtered index as satisfying the schema's `@unique`, so it
-- re-proposes a plain constraint every time — applying it would immediately
-- fail (or corrupt correctness) given multiple NULL userId rows. Ignore that
-- line in any future diff against this schema for the same reason.

ALTER TABLE [dbo].[JobInfo] DROP CONSTRAINT [JobInfo_fitnessCertificate_df];
ALTER TABLE [dbo].[JobInfo] DROP CONSTRAINT [JobInfo_ndaDocument_df];
ALTER TABLE [dbo].[JobInfo] DROP COLUMN [fitnessCertificate], [ndaDocument];

ALTER TABLE [dbo].[PersonalDetails] ADD [fitnessCertificate] BIT NOT NULL CONSTRAINT [PersonalDetails_fitnessCertificate_df] DEFAULT 0,
[ndaDocument] BIT NOT NULL CONSTRAINT [PersonalDetails_ndaDocument_df] DEFAULT 0;
