-- AlterTable: add LOM approval workflow columns to DailyAttendance
ALTER TABLE [DailyAttendance] ADD
    [lomApprovalStatus]  NVARCHAR(20) NULL,
    [lomApprovedMinutes] INT NULL,
    [lomActionByUserId]  INT NULL,
    [lomActionAt]        DATETIME2 NULL,
    [lomRejectionReason] NVARCHAR(500) NULL;
