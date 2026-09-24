-- App-merge phase — biometric + mobile-app attendance merge.
-- All additive: nullable columns + two new tables. No existing column,
-- constraint or table is altered in place, so applying this cannot
-- disturb any existing attendance, approval or payroll flow.

-- 1) Endpoint-level source attribution + app GPS on the final row.
ALTER TABLE [dbo].[DailyAttendance] ADD
    [inLatitude] FLOAT NULL,
    [inLongitude] FLOAT NULL,
    [outLatitude] FLOAT NULL,
    [outLongitude] FLOAT NULL,
    [inSource] NVARCHAR(20) NULL,
    [outSource] NVARCHAR(20) NULL,
    [inSourceRef] NVARCHAR(50) NULL,
    [outSourceRef] NVARCHAR(50) NULL;

-- 2) The same fields on the history snapshot so an overwrite preserves
--    which source/GPS each endpoint carried before the change.
ALTER TABLE [dbo].[DailyAttendanceHistory] ADD
    [inLatitude] FLOAT NULL,
    [inLongitude] FLOAT NULL,
    [outLatitude] FLOAT NULL,
    [outLongitude] FLOAT NULL,
    [inSource] NVARCHAR(20) NULL,
    [outSource] NVARCHAR(20) NULL,
    [inSourceRef] NVARCHAR(50) NULL,
    [outSourceRef] NVARCHAR(50) NULL;

-- 3) Per-source contribution rollup — one row per employee/date/source.
CREATE TABLE [dbo].[AttendanceSourceDay] (
    [id] INT NOT NULL IDENTITY(1,1),
    [employeeId] INT NOT NULL,
    [date] DATE NOT NULL,
    [source] NVARCHAR(20) NOT NULL,
    [inTime] DATETIME2 NULL,
    [outTime] DATETIME2 NULL,
    [hours] FLOAT NULL,
    [inLatitude] FLOAT NULL,
    [inLongitude] FLOAT NULL,
    [outLatitude] FLOAT NULL,
    [outLongitude] FLOAT NULL,
    [sourceRowId] NVARCHAR(50) NULL,
    [lastSeenAt] DATETIME2 NOT NULL CONSTRAINT [AttendanceSourceDay_lastSeenAt_df] DEFAULT CURRENT_TIMESTAMP,
    [createdAt] DATETIME2 NOT NULL CONSTRAINT [AttendanceSourceDay_createdAt_df] DEFAULT CURRENT_TIMESTAMP,
    [updatedAt] DATETIME2 NOT NULL,
    CONSTRAINT [AttendanceSourceDay_pkey] PRIMARY KEY CLUSTERED ([id] ASC),
    CONSTRAINT [AttendanceSourceDay_employeeId_date_source_key] UNIQUE NONCLUSTERED ([employeeId] ASC, [date] ASC, [source] ASC)
);

CREATE NONCLUSTERED INDEX [AttendanceSourceDay_date_idx] ON [dbo].[AttendanceSourceDay]([date] ASC);

ALTER TABLE [dbo].[AttendanceSourceDay] ADD CONSTRAINT [AttendanceSourceDay_employeeId_fkey]
    FOREIGN KEY ([employeeId]) REFERENCES [dbo].[Employee]([id])
    ON DELETE NO ACTION ON UPDATE NO ACTION;

-- 4) App sync run log.
CREATE TABLE [dbo].[AttendanceSyncRun] (
    [id] INT NOT NULL IDENTITY(1,1),
    [companyId] INT NOT NULL,
    [source] NVARCHAR(20) NOT NULL,
    [trigger] NVARCHAR(20) NOT NULL,
    [rangeStart] DATE NOT NULL,
    [rangeEnd] DATE NOT NULL,
    [status] NVARCHAR(20) NOT NULL CONSTRAINT [AttendanceSyncRun_status_df] DEFAULT 'running',
    [rowsFetched] INT NOT NULL CONSTRAINT [AttendanceSyncRun_rowsFetched_df] DEFAULT 0,
    [daysCreated] INT NOT NULL CONSTRAINT [AttendanceSyncRun_daysCreated_df] DEFAULT 0,
    [daysUpdated] INT NOT NULL CONSTRAINT [AttendanceSyncRun_daysUpdated_df] DEFAULT 0,
    [daysUnchanged] INT NOT NULL CONSTRAINT [AttendanceSyncRun_daysUnchanged_df] DEFAULT 0,
    [skippedFrozen] INT NOT NULL CONSTRAINT [AttendanceSyncRun_skippedFrozen_df] DEFAULT 0,
    [skippedProtected] INT NOT NULL CONSTRAINT [AttendanceSyncRun_skippedProtected_df] DEFAULT 0,
    [needsReview] INT NOT NULL CONSTRAINT [AttendanceSyncRun_needsReview_df] DEFAULT 0,
    [unmatchedUserIds] NVARCHAR(MAX) NULL,
    [error] NVARCHAR(2000) NULL,
    [triggeredByUserId] INT NULL,
    [startedAt] DATETIME2 NOT NULL CONSTRAINT [AttendanceSyncRun_startedAt_df] DEFAULT CURRENT_TIMESTAMP,
    [finishedAt] DATETIME2 NULL,
    CONSTRAINT [AttendanceSyncRun_pkey] PRIMARY KEY CLUSTERED ([id] ASC)
);

CREATE NONCLUSTERED INDEX [AttendanceSyncRun_companyId_startedAt_idx] ON [dbo].[AttendanceSyncRun]([companyId] ASC, [startedAt] ASC);
