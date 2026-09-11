-- CreateTable: LeaveEncashmentConfig
CREATE TABLE [LeaveEncashmentConfig] (
    [id] INT NOT NULL IDENTITY(1,1),
    [companyId] INT NOT NULL,
    [calculationBasis] NVARCHAR(20) NOT NULL CONSTRAINT [DF_LeaveEncashmentConfig_calculationBasis] DEFAULT 'GROSS',
    [denominator] INT NOT NULL CONSTRAINT [DF_LeaveEncashmentConfig_denominator] DEFAULT 26,
    [minServiceMonths] INT NOT NULL CONSTRAINT [DF_LeaveEncashmentConfig_minServiceMonths] DEFAULT 0,
    [maxEncashableDays] INT NOT NULL CONSTRAINT [DF_LeaveEncashmentConfig_maxEncashableDays] DEFAULT 45,
    [includeEarnedOnly] BIT NOT NULL CONSTRAINT [DF_LeaveEncashmentConfig_includeEarnedOnly] DEFAULT 1,
    [prorateByLop] BIT NOT NULL CONSTRAINT [DF_LeaveEncashmentConfig_prorateByLop] DEFAULT 0,
    [isActive] BIT NOT NULL CONSTRAINT [DF_LeaveEncashmentConfig_isActive] DEFAULT 1,
    [createdAt] DATETIME2 NOT NULL CONSTRAINT [DF_LeaveEncashmentConfig_createdAt] DEFAULT CURRENT_TIMESTAMP,
    [updatedAt] DATETIME2 NOT NULL,
    CONSTRAINT [PK_LeaveEncashmentConfig] PRIMARY KEY ([id]),
    CONSTRAINT [UQ_LeaveEncashmentConfig_companyId] UNIQUE ([companyId])
);

-- CreateTable: FullAndFinalConfig
CREATE TABLE [FullAndFinalConfig] (
    [id] INT NOT NULL IDENTITY(1,1),
    [companyId] INT NOT NULL,
    [includeUnpaidSalary] BIT NOT NULL CONSTRAINT [DF_FullAndFinalConfig_includeUnpaidSalary] DEFAULT 1,
    [includeLeaveEncashment] BIT NOT NULL CONSTRAINT [DF_FullAndFinalConfig_includeLeaveEncashment] DEFAULT 1,
    [includeGratuity] BIT NOT NULL CONSTRAINT [DF_FullAndFinalConfig_includeGratuity] DEFAULT 1,
    [includeBonusProportion] BIT NOT NULL CONSTRAINT [DF_FullAndFinalConfig_includeBonusProportion] DEFAULT 0,
    [includeNoticePay] BIT NOT NULL CONSTRAINT [DF_FullAndFinalConfig_includeNoticePay] DEFAULT 1,
    [noticePeriodDays] INT NOT NULL CONSTRAINT [DF_FullAndFinalConfig_noticePeriodDays] DEFAULT 30,
    [includeLoanRecovery] BIT NOT NULL CONSTRAINT [DF_FullAndFinalConfig_includeLoanRecovery] DEFAULT 1,
    [includeAssetRecovery] BIT NOT NULL CONSTRAINT [DF_FullAndFinalConfig_includeAssetRecovery] DEFAULT 1,
    [approvalStages] NVARCHAR(100) NOT NULL CONSTRAINT [DF_FullAndFinalConfig_approvalStages] DEFAULT 'HR_FINANCE',
    [isActive] BIT NOT NULL CONSTRAINT [DF_FullAndFinalConfig_isActive] DEFAULT 1,
    [createdAt] DATETIME2 NOT NULL CONSTRAINT [DF_FullAndFinalConfig_createdAt] DEFAULT CURRENT_TIMESTAMP,
    [updatedAt] DATETIME2 NOT NULL,
    CONSTRAINT [PK_FullAndFinalConfig] PRIMARY KEY ([id]),
    CONSTRAINT [UQ_FullAndFinalConfig_companyId] UNIQUE ([companyId])
);

-- CreateTable: BankFileTemplate
CREATE TABLE [BankFileTemplate] (
    [id] INT NOT NULL IDENTITY(1,1),
    [companyId] INT NOT NULL,
    [code] NVARCHAR(20) NOT NULL,
    [name] NVARCHAR(100) NOT NULL,
    [bankName] NVARCHAR(100) NOT NULL,
    [fileFormat] NVARCHAR(20) NOT NULL CONSTRAINT [DF_BankFileTemplate_fileFormat] DEFAULT 'CSV',
    [delimiter] NVARCHAR(5) NOT NULL CONSTRAINT [DF_BankFileTemplate_delimiter] DEFAULT ',',
    [columnMapping] NVARCHAR(2000) NOT NULL,
    [headerRow] BIT NOT NULL CONSTRAINT [DF_BankFileTemplate_headerRow] DEFAULT 1,
    [footerRow] BIT NOT NULL CONSTRAINT [DF_BankFileTemplate_footerRow] DEFAULT 0,
    [footerTemplate] NVARCHAR(500),
    [isActive] BIT NOT NULL CONSTRAINT [DF_BankFileTemplate_isActive] DEFAULT 1,
    [createdAt] DATETIME2 NOT NULL CONSTRAINT [DF_BankFileTemplate_createdAt] DEFAULT CURRENT_TIMESTAMP,
    [updatedAt] DATETIME2 NOT NULL,
    CONSTRAINT [PK_BankFileTemplate] PRIMARY KEY ([id]),
    CONSTRAINT [UQ_BankFileTemplate_companyId_code] UNIQUE ([companyId], [code])
);
CREATE INDEX [IX_BankFileTemplate_companyId] ON [BankFileTemplate] ([companyId]);

-- AddForeignKey
ALTER TABLE [LeaveEncashmentConfig] ADD CONSTRAINT [FK_LeaveEncashmentConfig_Company] FOREIGN KEY ([companyId]) REFERENCES [Company]([id]);
ALTER TABLE [FullAndFinalConfig] ADD CONSTRAINT [FK_FullAndFinalConfig_Company] FOREIGN KEY ([companyId]) REFERENCES [Company]([id]);
ALTER TABLE [BankFileTemplate] ADD CONSTRAINT [FK_BankFileTemplate_Company] FOREIGN KEY ([companyId]) REFERENCES [Company]([id]);
