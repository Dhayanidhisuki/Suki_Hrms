-- AlterTable: Add state to Unit for state-wise PT lookup
ALTER TABLE [Unit] ADD [state] NVARCHAR(100);

-- CreateTable: LicDeductionConfig
CREATE TABLE [LicDeductionConfig] (
    [id] INT NOT NULL IDENTITY(1,1),
    [companyId] INT NOT NULL,
    [deductionType] NVARCHAR(20) NOT NULL CONSTRAINT [DF_LicDeductionConfig_deductionType] DEFAULT 'FLAT',
    [amount] DECIMAL(18,2) NOT NULL CONSTRAINT [DF_LicDeductionConfig_amount] DEFAULT 0,
    [minAmount] DECIMAL(18,2) NOT NULL CONSTRAINT [DF_LicDeductionConfig_minAmount] DEFAULT 0,
    [maxAmount] DECIMAL(18,2),
    [isActive] BIT NOT NULL CONSTRAINT [DF_LicDeductionConfig_isActive] DEFAULT 1,
    [createdAt] DATETIME2 NOT NULL CONSTRAINT [DF_LicDeductionConfig_createdAt] DEFAULT CURRENT_TIMESTAMP,
    [updatedAt] DATETIME2 NOT NULL,
    CONSTRAINT [PK_LicDeductionConfig] PRIMARY KEY ([id]),
    CONSTRAINT [UQ_LicDeductionConfig_companyId] UNIQUE ([companyId])
);

-- CreateTable: AttendancePolicy
CREATE TABLE [AttendancePolicy] (
    [id] INT NOT NULL IDENTITY(1,1),
    [companyId] INT NOT NULL,
    [breakMinutesPerDay] INT NOT NULL CONSTRAINT [DF_AttendancePolicy_breakMinutesPerDay] DEFAULT 30,
    [breakDeductible] BIT NOT NULL CONSTRAINT [DF_AttendancePolicy_breakDeductible] DEFAULT 0,
    [lateGraceMinutes] INT NOT NULL CONSTRAINT [DF_AttendancePolicy_lateGraceMinutes] DEFAULT 0,
    [earlyOutGraceMinutes] INT NOT NULL CONSTRAINT [DF_AttendancePolicy_earlyOutGraceMinutes] DEFAULT 0,
    [halfDayMinHours] INT,
    [halfDayMaxHours] INT,
    [minFullDayHours] INT NOT NULL CONSTRAINT [DF_AttendancePolicy_minFullDayHours] DEFAULT 8,
    [autoAbsentIfNoPunch] BIT NOT NULL CONSTRAINT [DF_AttendancePolicy_autoAbsentIfNoPunch] DEFAULT 0,
    [createdAt] DATETIME2 NOT NULL CONSTRAINT [DF_AttendancePolicy_createdAt] DEFAULT CURRENT_TIMESTAMP,
    [updatedAt] DATETIME2 NOT NULL,
    CONSTRAINT [PK_AttendancePolicy] PRIMARY KEY ([id]),
    CONSTRAINT [UQ_AttendancePolicy_companyId] UNIQUE ([companyId])
);

-- AddForeignKey
ALTER TABLE [LicDeductionConfig] ADD CONSTRAINT [FK_LicDeductionConfig_Company] FOREIGN KEY ([companyId]) REFERENCES [Company]([id]);
ALTER TABLE [AttendancePolicy] ADD CONSTRAINT [FK_AttendancePolicy_Company] FOREIGN KEY ([companyId]) REFERENCES [Company]([id]);

-- AlterTable: Add licAmount to PayrollLine
ALTER TABLE [PayrollLine] ADD [licAmount] DECIMAL(18,2) NOT NULL CONSTRAINT [DF_PayrollLine_licAmount] DEFAULT 0;
