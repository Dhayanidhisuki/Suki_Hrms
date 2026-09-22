-- Double Machine / Other Incentives: approval attribution.
--
-- Additive, nullable columns only — no table rebuild. This matters: this
-- database already has tables whose IDENTITY was stripped by a rebuilding
-- migration (see 20260916192131_add-recruitment-module/DO_NOT_APPLY.md), so
-- nothing here may drop, recreate or re-key a table.
--
-- Applied by hand and recorded with `prisma migrate resolve --applied`,
-- because `prisma migrate dev` would attempt the poisoned migration above.

ALTER TABLE [dbo].[DoubleMachineIncentive] ADD [approvedByUserId] INT NULL;
ALTER TABLE [dbo].[DoubleMachineIncentive] ADD [approvedAt] DATETIME2 NULL;
ALTER TABLE [dbo].[DoubleMachineIncentive] ADD [rejectionReason] NVARCHAR(500) NULL;
