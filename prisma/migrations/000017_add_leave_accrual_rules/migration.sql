-- LeaveMaster: adds the fields the annual accrual job needs to tell EL's
-- "earned per days worked" rule apart from a flat annual entitlement, and to
-- know which leave types carry forward at year-end (per BRD: CL does not).
-- Additive only. Written without the prisma-diff TRY/CATCH wrapper because
-- scripts/apply-migration.mjs splits on ';' and runs statements one by one
-- inside its own transaction.

BEGIN TRAN;

ALTER TABLE [dbo].[LeaveMaster] ADD [accrualType] NVARCHAR(30) NOT NULL CONSTRAINT [LeaveMaster_accrualType_df] DEFAULT 'FIXED_ANNUAL';
ALTER TABLE [dbo].[LeaveMaster] ADD [daysWorkedPerAccrualUnit] INT;
ALTER TABLE [dbo].[LeaveMaster] ADD [carryForwardAllowed] BIT NOT NULL CONSTRAINT [LeaveMaster_carryForwardAllowed_df] DEFAULT 0;
ALTER TABLE [dbo].[LeaveMaster] ADD [carryForwardMaxDays] DECIMAL(5, 2);

COMMIT TRAN;
