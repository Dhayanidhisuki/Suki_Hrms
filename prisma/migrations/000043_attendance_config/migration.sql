-- AlterTable: Add probation fields to LeaveMaster
ALTER TABLE [LeaveMaster] ADD [probationEligible] BIT NOT NULL CONSTRAINT [DF_LeaveMaster_probationEligible] DEFAULT 1;
ALTER TABLE [LeaveMaster] ADD [probationMaxDays] DECIMAL(5,2);

-- CreateTable: AttendanceColorConfig
CREATE TABLE [AttendanceColorConfig] (
    [id] INT NOT NULL IDENTITY(1,1),
    [companyId] INT NOT NULL,
    [zeroHoursColor] NVARCHAR(10) NOT NULL CONSTRAINT [DF_AttendanceColorConfig_zeroHoursColor] DEFAULT '#ef4444',
    [shortHoursColor] NVARCHAR(10) NOT NULL CONSTRAINT [DF_AttendanceColorConfig_shortHoursColor] DEFAULT '#f97316',
    [shortHoursThreshold] INT NOT NULL CONSTRAINT [DF_AttendanceColorConfig_shortHoursThreshold] DEFAULT 4,
    [partialHoursColor] NVARCHAR(10) NOT NULL CONSTRAINT [DF_AttendanceColorConfig_partialHoursColor] DEFAULT '#eab308',
    [partialHoursThreshold] INT NOT NULL CONSTRAINT [DF_AttendanceColorConfig_partialHoursThreshold] DEFAULT 6,
    [normalHoursColor] NVARCHAR(10) NOT NULL CONSTRAINT [DF_AttendanceColorConfig_normalHoursColor] DEFAULT '#22c55e',
    [normalHoursThreshold] INT NOT NULL CONSTRAINT [DF_AttendanceColorConfig_normalHoursThreshold] DEFAULT 8,
    [extendedHoursColor] NVARCHAR(10) NOT NULL CONSTRAINT [DF_AttendanceColorConfig_extendedHoursColor] DEFAULT '#15803d',
    [weeklyOffColor] NVARCHAR(10) NOT NULL CONSTRAINT [DF_AttendanceColorConfig_weeklyOffColor] DEFAULT '#3b82f6',
    [createdAt] DATETIME2 NOT NULL CONSTRAINT [DF_AttendanceColorConfig_createdAt] DEFAULT CURRENT_TIMESTAMP,
    [updatedAt] DATETIME2 NOT NULL,
    CONSTRAINT [PK_AttendanceColorConfig] PRIMARY KEY ([id]),
    CONSTRAINT [UQ_AttendanceColorConfig_companyId] UNIQUE ([companyId])
);

-- AddForeignKey
ALTER TABLE [AttendanceColorConfig] ADD CONSTRAINT [FK_AttendanceColorConfig_Company] FOREIGN KEY ([companyId]) REFERENCES [Company]([id]);
