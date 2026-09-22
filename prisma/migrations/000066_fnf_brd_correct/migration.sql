IF COL_LENGTH('SalaryComponent', 'fnfPayable') IS NULL
  ALTER TABLE [SalaryComponent] ADD [fnfPayable] BIT NOT NULL CONSTRAINT [DF_SalaryComponent_fnfPayable] DEFAULT 1;
IF COL_LENGTH('SalaryComponent', 'fnfProration') IS NULL
  ALTER TABLE [SalaryComponent] ADD [fnfProration] NVARCHAR(20) NOT NULL CONSTRAINT [DF_SalaryComponent_fnfProration] DEFAULT 'PRO_RATA';
IF COL_LENGTH('SalaryComponent', 'fnfTaxable') IS NULL
  ALTER TABLE [SalaryComponent] ADD [fnfTaxable] BIT NOT NULL CONSTRAINT [DF_SalaryComponent_fnfTaxable] DEFAULT 1;

ALTER TABLE [ExitInterview] ALTER COLUMN [exitType] NVARCHAR(30) NOT NULL;

IF COL_LENGTH('ExitInterview', 'approvedLastWorkingDay') IS NULL
  ALTER TABLE [ExitInterview] ADD [approvedLastWorkingDay] DATE NULL;
IF COL_LENGTH('ExitInterview', 'rehireEligible') IS NULL
  ALTER TABLE [ExitInterview] ADD [rehireEligible] BIT NOT NULL CONSTRAINT [DF_ExitInterview_rehireEligible] DEFAULT 1;

IF OBJECT_ID(N'[ExitClearanceCheck]', N'U') IS NULL
BEGIN
  CREATE TABLE [ExitClearanceCheck] (
    [id] INT NOT NULL IDENTITY(1,1),
    [exitInterviewId] INT NOT NULL,
    [checkCode] NVARCHAR(20) NOT NULL,
    [status] NVARCHAR(20) NOT NULL CONSTRAINT [DF_ExitClearanceCheck_status] DEFAULT 'PENDING',
    [remark] NVARCHAR(500) NULL,
    [clearedByUserId] INT NULL,
    [clearedAt] DATETIME2 NULL,
    CONSTRAINT [ExitClearanceCheck_pkey] PRIMARY KEY CLUSTERED ([id]),
    CONSTRAINT [ExitClearanceCheck_exitInterviewId_checkCode_key] UNIQUE ([exitInterviewId], [checkCode]),
    CONSTRAINT [ExitClearanceCheck_exitInterviewId_fkey] FOREIGN KEY ([exitInterviewId]) REFERENCES [ExitInterview]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION
  );
END;

IF COL_LENGTH('FullAndFinalConfig', 'salaryDivisorMode') IS NULL
  ALTER TABLE [FullAndFinalConfig] ADD [salaryDivisorMode] NVARCHAR(20) NOT NULL CONSTRAINT [DF_FullAndFinalConfig_salaryDivisorMode] DEFAULT 'DAYS_30';
IF COL_LENGTH('FullAndFinalConfig', 'includePt') IS NULL
  ALTER TABLE [FullAndFinalConfig] ADD [includePt] BIT NOT NULL CONSTRAINT [DF_FullAndFinalConfig_includePt] DEFAULT 1;
IF COL_LENGTH('FullAndFinalConfig', 'clearanceRequired') IS NULL
  ALTER TABLE [FullAndFinalConfig] ADD [clearanceRequired] BIT NOT NULL CONSTRAINT [DF_FullAndFinalConfig_clearanceRequired] DEFAULT 1;

IF EXISTS (SELECT 1 FROM sys.default_constraints WHERE name = 'DF_FnFSettlement_payableDays')
  ALTER TABLE [FnFSettlement] DROP CONSTRAINT [DF_FnFSettlement_payableDays];
ALTER TABLE [FnFSettlement] ALTER COLUMN [payableDays] DECIMAL(8, 2) NOT NULL;
IF NOT EXISTS (SELECT 1 FROM sys.default_constraints WHERE name = 'DF_FnFSettlement_payableDays')
  ALTER TABLE [FnFSettlement] ADD CONSTRAINT [DF_FnFSettlement_payableDays] DEFAULT 0 FOR [payableDays];

ALTER TABLE [FnFSettlement] ALTER COLUMN [status] NVARCHAR(24) NOT NULL;

IF COL_LENGTH('FnFSettlement', 'freezeSnapshotId') IS NULL
  ALTER TABLE [FnFSettlement] ADD [freezeSnapshotId] INT NULL;
IF COL_LENGTH('FnFSettlement', 'journalJson') IS NULL
  ALTER TABLE [FnFSettlement] ADD [journalJson] NVARCHAR(MAX) NULL;
IF COL_LENGTH('FnFSettlement', 'clearanceOverrideRemark') IS NULL
  ALTER TABLE [FnFSettlement] ADD [clearanceOverrideRemark] NVARCHAR(500) NULL;
IF COL_LENGTH('FnFSettlement', 'holdReason') IS NULL
  ALTER TABLE [FnFSettlement] ADD [holdReason] NVARCHAR(500) NULL;
IF COL_LENGTH('FnFSettlement', 'financeVerifiedByUserId') IS NULL
  ALTER TABLE [FnFSettlement] ADD [financeVerifiedByUserId] INT NULL;
IF COL_LENGTH('FnFSettlement', 'financeVerifiedAt') IS NULL
  ALTER TABLE [FnFSettlement] ADD [financeVerifiedAt] DATETIME2 NULL;
