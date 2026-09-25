-- Leave core (docs/TIME_OFFICE_FLAWS_QA_2026-09-25.md §9, plan 2026-09-25):
--   * DailyAttendance rows written by a leave approval carry the application
--     that wrote them and what kind of day it was (full leave / half day /
--     sandwiched LOP), so cancel and resolve can restore exactly those rows
--     and the monthly summary can count leave types from the days themselves.
--   * A punch arriving on an approved leave day is recorded on the row as a
--     conflict for HR to decide (present / keep leave), never applied silently.
--   * LeaveApplication remembers how many days HR later gave back.
-- Additive only; backfills the link for leaves approved before this change.
--
-- Statements that reference the new columns run through sp_executesql so they
-- compile after the ALTERs — SQL Server compiles a batch up front, and a plain
-- CREATE INDEX / UPDATE on a column added in the same batch fails otherwise.

BEGIN TRAN;

ALTER TABLE [dbo].[DailyAttendance] ADD
    [leaveApplicationId] INT NULL,
    [leaveDayKind] NVARCHAR(20) NULL,
    [leaveConflictInTime] DATETIME2 NULL,
    [leaveConflictOutTime] DATETIME2 NULL,
    [leaveConflictSource] NVARCHAR(20) NULL,
    [leaveConflictDecision] NVARCHAR(20) NULL,
    [leaveConflictDecidedAt] DATETIME2 NULL,
    [leaveConflictDecidedByUserId] INT NULL;

ALTER TABLE [dbo].[DailyAttendanceHistory] ADD [leaveApplicationId] INT NULL;

ALTER TABLE [dbo].[LeaveApplication] ADD
    [daysReversed] DECIMAL(5,2) NOT NULL CONSTRAINT [DF_LeaveApplication_daysReversed] DEFAULT 0,
    [reversalNote] NVARCHAR(500) NULL;

EXEC sp_executesql N'
ALTER TABLE [dbo].[DailyAttendance] ADD CONSTRAINT [DailyAttendance_leaveApplicationId_fkey]
    FOREIGN KEY ([leaveApplicationId]) REFERENCES [dbo].[LeaveApplication]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;';

EXEC sp_executesql N'
CREATE NONCLUSTERED INDEX [DailyAttendance_leaveApplicationId_idx] ON [dbo].[DailyAttendance]([leaveApplicationId]);';

EXEC sp_executesql N'
CREATE NONCLUSTERED INDEX [DailyAttendance_leaveConflict_idx] ON [dbo].[DailyAttendance]([leaveConflictInTime])
    WHERE [leaveConflictInTime] IS NOT NULL;';

-- Backfill: link each existing Leave day to the single approved application
-- that covers it. A date covered by two approved applications is left
-- unlinked (ambiguous) and falls back to the legacy range heuristic on cancel.
EXEC sp_executesql N'
UPDATE da
SET da.leaveApplicationId = la.id,
    da.leaveDayKind = ''LEAVE''
FROM [dbo].[DailyAttendance] da
JOIN [dbo].[LeaveApplication] la
  ON la.employeeId = da.employeeId
 AND la.status = ''approved''
 AND da.date BETWEEN la.fromDate AND la.toDate
WHERE da.status = ''Leave''
  AND da.leaveApplicationId IS NULL
  AND NOT EXISTS (
    SELECT 1 FROM [dbo].[LeaveApplication] la2
    WHERE la2.id <> la.id
      AND la2.employeeId = da.employeeId
      AND la2.status = ''approved''
      AND da.date BETWEEN la2.fromDate AND la2.toDate
  );';

COMMIT TRAN;
