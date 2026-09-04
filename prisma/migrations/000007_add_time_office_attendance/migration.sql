BEGIN TRY

BEGIN TRAN;

-- CreateTable
CREATE TABLE [dbo].[DailyAttendance] (
    [id] INT NOT NULL IDENTITY(1,1),
    [employeeId] INT NOT NULL,
    [date] DATE NOT NULL,
    [shiftMasterId] INT,
    [shiftPlanId] INT,
    [status] NVARCHAR(20) NOT NULL,
    [inTime] DATETIME2,
    [outTime] DATETIME2,
    [workingMinutes] INT NOT NULL CONSTRAINT [DailyAttendance_workingMinutes_df] DEFAULT 0,
    [lateMinutes] INT NOT NULL CONSTRAINT [DailyAttendance_lateMinutes_df] DEFAULT 0,
    [earlyOutMinutes] INT NOT NULL CONSTRAINT [DailyAttendance_earlyOutMinutes_df] DEFAULT 0,
    [otMinutesCalculated] INT NOT NULL CONSTRAINT [DailyAttendance_otMinutesCalculated_df] DEFAULT 0,
    [otMinutesApproved] INT,
    [otApprovalStatus] NVARCHAR(20),
    [source] NVARCHAR(20) NOT NULL CONSTRAINT [DailyAttendance_source_df] DEFAULT 'manual',
    [remarks] NVARCHAR(500),
    [createdByUserId] INT,
    [updatedByUserId] INT,
    [createdAt] DATETIME2 NOT NULL CONSTRAINT [DailyAttendance_createdAt_df] DEFAULT CURRENT_TIMESTAMP,
    [updatedAt] DATETIME2 NOT NULL,
    CONSTRAINT [DailyAttendance_pkey] PRIMARY KEY CLUSTERED ([id]),
    CONSTRAINT [DailyAttendance_employeeId_date_key] UNIQUE NONCLUSTERED ([employeeId],[date])
);

-- CreateTable
CREATE TABLE [dbo].[MonthlyAttendanceSummary] (
    [id] INT NOT NULL IDENTITY(1,1),
    [employeeId] INT NOT NULL,
    [year] INT NOT NULL,
    [month] INT NOT NULL,
    [totalWorkingDays] INT NOT NULL CONSTRAINT [MonthlyAttendanceSummary_totalWorkingDays_df] DEFAULT 0,
    [presentDays] INT NOT NULL CONSTRAINT [MonthlyAttendanceSummary_presentDays_df] DEFAULT 0,
    [absentDays] INT NOT NULL CONSTRAINT [MonthlyAttendanceSummary_absentDays_df] DEFAULT 0,
    [leaveDays] INT NOT NULL CONSTRAINT [MonthlyAttendanceSummary_leaveDays_df] DEFAULT 0,
    [lopDays] INT NOT NULL CONSTRAINT [MonthlyAttendanceSummary_lopDays_df] DEFAULT 0,
    [otMinutesTotal] INT NOT NULL CONSTRAINT [MonthlyAttendanceSummary_otMinutesTotal_df] DEFAULT 0,
    [lateMinutesTotal] INT NOT NULL CONSTRAINT [MonthlyAttendanceSummary_lateMinutesTotal_df] DEFAULT 0,
    [earlyOutMinutesTotal] INT NOT NULL CONSTRAINT [MonthlyAttendanceSummary_earlyOutMinutesTotal_df] DEFAULT 0,
    [status] NVARCHAR(20) NOT NULL CONSTRAINT [MonthlyAttendanceSummary_status_df] DEFAULT 'OPEN',
    [finalizedAt] DATETIME2,
    [finalizedByUserId] INT,
    [frozenAt] DATETIME2,
    [reopenedAt] DATETIME2,
    [reopenedByUserId] INT,
    [reopenReason] NVARCHAR(500),
    [createdAt] DATETIME2 NOT NULL CONSTRAINT [MonthlyAttendanceSummary_createdAt_df] DEFAULT CURRENT_TIMESTAMP,
    [updatedAt] DATETIME2 NOT NULL,
    CONSTRAINT [MonthlyAttendanceSummary_pkey] PRIMARY KEY CLUSTERED ([id]),
    CONSTRAINT [MonthlyAttendanceSummary_employeeId_year_month_key] UNIQUE NONCLUSTERED ([employeeId],[year],[month])
);

-- CreateTable
CREATE TABLE [dbo].[LeaveApplication] (
    [id] INT NOT NULL IDENTITY(1,1),
    [employeeId] INT NOT NULL,
    [leaveMasterId] INT NOT NULL,
    [fromDate] DATE NOT NULL,
    [toDate] DATE NOT NULL,
    [numberOfDays] DECIMAL(5,2) NOT NULL,
    [isHalfDay] BIT NOT NULL CONSTRAINT [LeaveApplication_isHalfDay_df] DEFAULT 0,
    [reason] NVARCHAR(500),
    [status] NVARCHAR(20) NOT NULL CONSTRAINT [LeaveApplication_status_df] DEFAULT 'pending',
    [approvedByUserId] INT,
    [approvedAt] DATETIME2,
    [rejectionReason] NVARCHAR(500),
    [appliedAt] DATETIME2 NOT NULL CONSTRAINT [LeaveApplication_appliedAt_df] DEFAULT CURRENT_TIMESTAMP,
    [createdAt] DATETIME2 NOT NULL CONSTRAINT [LeaveApplication_createdAt_df] DEFAULT CURRENT_TIMESTAMP,
    [updatedAt] DATETIME2 NOT NULL,
    CONSTRAINT [LeaveApplication_pkey] PRIMARY KEY CLUSTERED ([id])
);

-- CreateTable
CREATE TABLE [dbo].[LeaveBalance] (
    [id] INT NOT NULL IDENTITY(1,1),
    [employeeId] INT NOT NULL,
    [leaveMasterId] INT NOT NULL,
    [year] INT NOT NULL,
    [openingBalance] DECIMAL(5,2) NOT NULL CONSTRAINT [LeaveBalance_openingBalance_df] DEFAULT 0,
    [accrued] DECIMAL(5,2) NOT NULL CONSTRAINT [LeaveBalance_accrued_df] DEFAULT 0,
    [availed] DECIMAL(5,2) NOT NULL CONSTRAINT [LeaveBalance_availed_df] DEFAULT 0,
    [adjusted] DECIMAL(5,2) NOT NULL CONSTRAINT [LeaveBalance_adjusted_df] DEFAULT 0,
    [closingBalance] DECIMAL(5,2) NOT NULL CONSTRAINT [LeaveBalance_closingBalance_df] DEFAULT 0,
    [carryForwardIn] DECIMAL(5,2) NOT NULL CONSTRAINT [LeaveBalance_carryForwardIn_df] DEFAULT 0,
    [createdAt] DATETIME2 NOT NULL CONSTRAINT [LeaveBalance_createdAt_df] DEFAULT CURRENT_TIMESTAMP,
    [updatedAt] DATETIME2 NOT NULL,
    CONSTRAINT [LeaveBalance_pkey] PRIMARY KEY CLUSTERED ([id]),
    CONSTRAINT [LeaveBalance_employeeId_leaveMasterId_year_key] UNIQUE NONCLUSTERED ([employeeId],[leaveMasterId],[year])
);

-- CreateIndex
CREATE NONCLUSTERED INDEX [DailyAttendance_employeeId_idx] ON [dbo].[DailyAttendance]([employeeId]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [DailyAttendance_date_idx] ON [dbo].[DailyAttendance]([date]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [MonthlyAttendanceSummary_employeeId_idx] ON [dbo].[MonthlyAttendanceSummary]([employeeId]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [LeaveApplication_employeeId_idx] ON [dbo].[LeaveApplication]([employeeId]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [LeaveApplication_leaveMasterId_idx] ON [dbo].[LeaveApplication]([leaveMasterId]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [LeaveApplication_status_idx] ON [dbo].[LeaveApplication]([status]);

-- NOTE: `prisma migrate diff` also emitted `ALTER TABLE [dbo].[Employee] ADD
-- CONSTRAINT [Employee_userId_key] UNIQUE NONCLUSTERED ([userId])` here —
-- intentionally excluded, same reason documented in migrations 000002/000005:
-- Employee.userId already has a FILTERED unique index (WHERE userId IS NOT
-- NULL) from migration 000001; the plain version would fail/corrupt given
-- multiple NULL userId rows.

-- AddForeignKey
ALTER TABLE [dbo].[DailyAttendance] ADD CONSTRAINT [DailyAttendance_employeeId_fkey] FOREIGN KEY ([employeeId]) REFERENCES [dbo].[Employee]([id]) ON DELETE NO ACTION ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE [dbo].[DailyAttendance] ADD CONSTRAINT [DailyAttendance_shiftMasterId_fkey] FOREIGN KEY ([shiftMasterId]) REFERENCES [dbo].[ShiftMaster]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[DailyAttendance] ADD CONSTRAINT [DailyAttendance_shiftPlanId_fkey] FOREIGN KEY ([shiftPlanId]) REFERENCES [dbo].[ShiftPlan]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[MonthlyAttendanceSummary] ADD CONSTRAINT [MonthlyAttendanceSummary_employeeId_fkey] FOREIGN KEY ([employeeId]) REFERENCES [dbo].[Employee]([id]) ON DELETE NO ACTION ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE [dbo].[LeaveApplication] ADD CONSTRAINT [LeaveApplication_employeeId_fkey] FOREIGN KEY ([employeeId]) REFERENCES [dbo].[Employee]([id]) ON DELETE NO ACTION ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE [dbo].[LeaveApplication] ADD CONSTRAINT [LeaveApplication_leaveMasterId_fkey] FOREIGN KEY ([leaveMasterId]) REFERENCES [dbo].[LeaveMaster]([id]) ON DELETE NO ACTION ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE [dbo].[LeaveBalance] ADD CONSTRAINT [LeaveBalance_employeeId_fkey] FOREIGN KEY ([employeeId]) REFERENCES [dbo].[Employee]([id]) ON DELETE NO ACTION ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE [dbo].[LeaveBalance] ADD CONSTRAINT [LeaveBalance_leaveMasterId_fkey] FOREIGN KEY ([leaveMasterId]) REFERENCES [dbo].[LeaveMaster]([id]) ON DELETE NO ACTION ON UPDATE CASCADE;

COMMIT TRAN;

END TRY
BEGIN CATCH

IF @@TRANCOUNT > 0
BEGIN
    ROLLBACK TRAN;
END;
THROW

END CATCH

