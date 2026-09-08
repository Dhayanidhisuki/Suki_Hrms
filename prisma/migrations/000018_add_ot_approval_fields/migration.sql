-- DailyAttendance: adds the fields the new two-stage OT Approval workflow
-- needs (Reporting Manager, then HR, same pattern as MispunchCorrection)
-- plus otSettlementType for the OT-vs-Comp-Off choice on weekly-off/holiday
-- work. Additive only. Written without the prisma-diff TRY/CATCH wrapper
-- because scripts/apply-migration.mjs splits on ';' and runs statements one
-- by one inside its own transaction.

BEGIN TRAN;

ALTER TABLE [dbo].[DailyAttendance] ADD [otSettlementType] NVARCHAR(20);
ALTER TABLE [dbo].[DailyAttendance] ADD [otManagerActionByUserId] INT;
ALTER TABLE [dbo].[DailyAttendance] ADD [otManagerActionAt] DATETIME2;
ALTER TABLE [dbo].[DailyAttendance] ADD [otHrActionByUserId] INT;
ALTER TABLE [dbo].[DailyAttendance] ADD [otHrActionAt] DATETIME2;
ALTER TABLE [dbo].[DailyAttendance] ADD [otRejectionReason] NVARCHAR(500);

COMMIT TRAN;
