-- AlterTable: Add leave-type breakdown + holiday worked + Time Office Final handoff to MonthlyAttendanceSummary
ALTER TABLE [MonthlyAttendanceSummary] ADD [elDays] DECIMAL(5,2) NOT NULL CONSTRAINT [DF_MonthlyAttendanceSummary_elDays] DEFAULT 0;
ALTER TABLE [MonthlyAttendanceSummary] ADD [clDays] DECIMAL(5,2) NOT NULL CONSTRAINT [DF_MonthlyAttendanceSummary_clDays] DEFAULT 0;
ALTER TABLE [MonthlyAttendanceSummary] ADD [slDays] DECIMAL(5,2) NOT NULL CONSTRAINT [DF_MonthlyAttendanceSummary_slDays] DEFAULT 0;
ALTER TABLE [MonthlyAttendanceSummary] ADD [mlDays] DECIMAL(5,2) NOT NULL CONSTRAINT [DF_MonthlyAttendanceSummary_mlDays] DEFAULT 0;
ALTER TABLE [MonthlyAttendanceSummary] ADD [plDays] DECIMAL(5,2) NOT NULL CONSTRAINT [DF_MonthlyAttendanceSummary_plDays] DEFAULT 0;
ALTER TABLE [MonthlyAttendanceSummary] ADD [compOffDays] DECIMAL(5,2) NOT NULL CONSTRAINT [DF_MonthlyAttendanceSummary_compOffDays] DEFAULT 0;
ALTER TABLE [MonthlyAttendanceSummary] ADD [otherLeaveDays] DECIMAL(5,2) NOT NULL CONSTRAINT [DF_MonthlyAttendanceSummary_otherLeaveDays] DEFAULT 0;
ALTER TABLE [MonthlyAttendanceSummary] ADD [holidayWorkedDays] INT NOT NULL CONSTRAINT [DF_MonthlyAttendanceSummary_holidayWorkedDays] DEFAULT 0;
ALTER TABLE [MonthlyAttendanceSummary] ADD [permissionHours] DECIMAL(5,2) NOT NULL CONSTRAINT [DF_MonthlyAttendanceSummary_permissionHours] DEFAULT 0;
ALTER TABLE [MonthlyAttendanceSummary] ADD [permissionExcessHours] DECIMAL(5,2) NOT NULL CONSTRAINT [DF_MonthlyAttendanceSummary_permissionExcessHours] DEFAULT 0;
ALTER TABLE [MonthlyAttendanceSummary] ADD [readyForPayrollAt] DATETIME2;
ALTER TABLE [MonthlyAttendanceSummary] ADD [readyForPayrollByUserId] INT;
ALTER TABLE [MonthlyAttendanceSummary] ADD [readyForPayrollRemarks] NVARCHAR(500);

-- AlterTable: Add holiday/weekly-off worked flags to DailyAttendance
ALTER TABLE [DailyAttendance] ADD [isHolidayWorked] BIT NOT NULL CONSTRAINT [DF_DailyAttendance_isHolidayWorked] DEFAULT 0;
ALTER TABLE [DailyAttendance] ADD [isWeeklyOffWorked] BIT NOT NULL CONSTRAINT [DF_DailyAttendance_isWeeklyOffWorked] DEFAULT 0;
