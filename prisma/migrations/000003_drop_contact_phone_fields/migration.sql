-- Consolidates Permanent/Present "Phone" + "Mobile" into a single "Mobile No"
-- field per address block, per request. No data existed in either Phone
-- column (verified before writing this migration) — pure schema cleanup.
--
-- NOTE: `prisma migrate diff` also emits the spurious
-- `Employee_userId_key` plain UNIQUE CONSTRAINT line again — see the note in
-- migrations/000002_move_nda_fitness_to_personal/migration.sql for why that
-- is intentionally excluded here too.

ALTER TABLE [dbo].[EmployeeContactDetails] DROP COLUMN [permanentPhone], [presentPhone];
