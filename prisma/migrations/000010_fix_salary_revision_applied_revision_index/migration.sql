BEGIN TRY

BEGIN TRAN;

-- Migration 000009 created SalaryRevisionRequest.appliedRevisionId as a
-- plain UNIQUE NONCLUSTERED constraint (from Prisma's `@unique` attribute).
-- Unlike Postgres, SQL Server only allows a single NULL under a plain
-- unique constraint, but every DRAFT/SUBMITTED/HOLD/REJECTED/CANCELLED
-- request has appliedRevisionId = NULL until it's approved — the same
-- problem already solved for Employee.userId (migration 000001) with a
-- FILTERED unique index. Replace the plain constraint with the same fix.

ALTER TABLE [dbo].[SalaryRevisionRequest] DROP CONSTRAINT [SalaryRevisionRequest_appliedRevisionId_key];

CREATE UNIQUE NONCLUSTERED INDEX [SalaryRevisionRequest_appliedRevisionId_key] ON [dbo].[SalaryRevisionRequest]([appliedRevisionId]) WHERE [appliedRevisionId] IS NOT NULL;

COMMIT TRAN;

END TRY
BEGIN CATCH

IF @@TRANCOUNT > 0
BEGIN
    ROLLBACK TRAN;
END;
THROW

END CATCH
