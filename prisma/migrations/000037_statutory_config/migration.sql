-- CreateTable: LwfRate
CREATE TABLE [LwfRate] (
    [id] INT NOT NULL IDENTITY(1,1),
    [companyId] INT NOT NULL,
    [state] NVARCHAR(50) NOT NULL,
    [code] NVARCHAR(20) NOT NULL,
    [employeeRate] DECIMAL(10,2) NOT NULL,
    [employerRate] DECIMAL(10,2) NOT NULL,
    [rateType] NVARCHAR(10) NOT NULL CONSTRAINT [DF_LwfRate_rateType] DEFAULT 'FLAT',
    [frequency] NVARCHAR(20) NOT NULL CONSTRAINT [DF_LwfRate_frequency] DEFAULT 'MONTHLY',
    [deductionMonth] INT NOT NULL CONSTRAINT [DF_LwfRate_deductionMonth] DEFAULT 1,
    [effectiveFrom] DATETIME2 NOT NULL,
    [effectiveTo] DATETIME2,
    [isActive] BIT NOT NULL CONSTRAINT [DF_LwfRate_isActive] DEFAULT 1,
    [createdAt] DATETIME2 NOT NULL CONSTRAINT [DF_LwfRate_createdAt] DEFAULT CURRENT_TIMESTAMP,
    [updatedAt] DATETIME2 NOT NULL,
    CONSTRAINT [PK_LwfRate] PRIMARY KEY ([id]),
    CONSTRAINT [UQ_LwfRate_companyId_state_effectiveFrom] UNIQUE ([companyId], [state], [effectiveFrom])
);
CREATE INDEX [IX_LwfRate_companyId_state] ON [LwfRate] ([companyId], [state]);

-- CreateTable: StatePtConfig
CREATE TABLE [StatePtConfig] (
    [id] INT NOT NULL IDENTITY(1,1),
    [companyId] INT NOT NULL,
    [state] NVARCHAR(50) NOT NULL,
    [code] NVARCHAR(20) NOT NULL,
    [slabCode] NVARCHAR(20) NOT NULL,
    [effectiveFrom] DATETIME2 NOT NULL,
    [effectiveTo] DATETIME2,
    [isActive] BIT NOT NULL CONSTRAINT [DF_StatePtConfig_isActive] DEFAULT 1,
    [createdAt] DATETIME2 NOT NULL CONSTRAINT [DF_StatePtConfig_createdAt] DEFAULT CURRENT_TIMESTAMP,
    [updatedAt] DATETIME2 NOT NULL,
    CONSTRAINT [PK_StatePtConfig] PRIMARY KEY ([id]),
    CONSTRAINT [UQ_StatePtConfig_companyId_state_effectiveFrom] UNIQUE ([companyId], [state], [effectiveFrom])
);
CREATE INDEX [IX_StatePtConfig_companyId_state] ON [StatePtConfig] ([companyId], [state]);

-- CreateTable: TdsRegimeConfig
CREATE TABLE [TdsRegimeConfig] (
    [id] INT NOT NULL IDENTITY(1,1),
    [companyId] INT NOT NULL,
    [defaultRegime] NVARCHAR(20) NOT NULL CONSTRAINT [DF_TdsRegimeConfig_defaultRegime] DEFAULT 'NEW',
    [financialYearStart] INT NOT NULL CONSTRAINT [DF_TdsRegimeConfig_financialYearStart] DEFAULT 4,
    [cessRate] DECIMAL(5,2) NOT NULL CONSTRAINT [DF_TdsRegimeConfig_cessRate] DEFAULT 4,
    [surchargeThreshold] DECIMAL(18,2) NOT NULL CONSTRAINT [DF_TdsRegimeConfig_surchargeThreshold] DEFAULT 5000000,
    [surchargeRate] DECIMAL(5,2) NOT NULL CONSTRAINT [DF_TdsRegimeConfig_surchargeRate] DEFAULT 10,
    [rebateUptoIncome] DECIMAL(18,2) NOT NULL CONSTRAINT [DF_TdsRegimeConfig_rebateUptoIncome] DEFAULT 500000,
    [rebateAmount] DECIMAL(18,2) NOT NULL CONSTRAINT [DF_TdsRegimeConfig_rebateAmount] DEFAULT 12500,
    [standardDeduction] DECIMAL(18,2) NOT NULL CONSTRAINT [DF_TdsRegimeConfig_standardDeduction] DEFAULT 50000,
    [isActive] BIT NOT NULL CONSTRAINT [DF_TdsRegimeConfig_isActive] DEFAULT 1,
    [createdAt] DATETIME2 NOT NULL CONSTRAINT [DF_TdsRegimeConfig_createdAt] DEFAULT CURRENT_TIMESTAMP,
    [updatedAt] DATETIME2 NOT NULL,
    CONSTRAINT [PK_TdsRegimeConfig] PRIMARY KEY ([id]),
    CONSTRAINT [UQ_TdsRegimeConfig_companyId] UNIQUE ([companyId])
);

-- CreateTable: HealthInsuranceConfig
CREATE TABLE [HealthInsuranceConfig] (
    [id] INT NOT NULL IDENTITY(1,1),
    [companyId] INT NOT NULL,
    [employeeContributionRate] DECIMAL(5,2) NOT NULL CONSTRAINT [DF_HealthInsuranceConfig_employeeContributionRate] DEFAULT 0,
    [employerContributionRate] DECIMAL(5,2) NOT NULL CONSTRAINT [DF_HealthInsuranceConfig_employerContributionRate] DEFAULT 0,
    [monthlyPremium] DECIMAL(18,2) NOT NULL CONSTRAINT [DF_HealthInsuranceConfig_monthlyPremium] DEFAULT 0,
    [applyToAllEmployees] BIT NOT NULL CONSTRAINT [DF_HealthInsuranceConfig_applyToAllEmployees] DEFAULT 1,
    [isActive] BIT NOT NULL CONSTRAINT [DF_HealthInsuranceConfig_isActive] DEFAULT 1,
    [createdAt] DATETIME2 NOT NULL CONSTRAINT [DF_HealthInsuranceConfig_createdAt] DEFAULT CURRENT_TIMESTAMP,
    [updatedAt] DATETIME2 NOT NULL,
    CONSTRAINT [PK_HealthInsuranceConfig] PRIMARY KEY ([id]),
    CONSTRAINT [UQ_HealthInsuranceConfig_companyId] UNIQUE ([companyId])
);

-- AddColumn: PayrollLine
ALTER TABLE [PayrollLine] ADD [lwfAmount] DECIMAL(18,2) NOT NULL CONSTRAINT [DF_PayrollLine_lwfAmount] DEFAULT 0;
ALTER TABLE [PayrollLine] ADD [healthInsurance] DECIMAL(18,2) NOT NULL CONSTRAINT [DF_PayrollLine_healthInsurance] DEFAULT 0;

-- AddForeignKey
ALTER TABLE [LwfRate] ADD CONSTRAINT [FK_LwfRate_Company] FOREIGN KEY ([companyId]) REFERENCES [Company]([id]);
ALTER TABLE [StatePtConfig] ADD CONSTRAINT [FK_StatePtConfig_Company] FOREIGN KEY ([companyId]) REFERENCES [Company]([id]);
ALTER TABLE [TdsRegimeConfig] ADD CONSTRAINT [FK_TdsRegimeConfig_Company] FOREIGN KEY ([companyId]) REFERENCES [Company]([id]);
ALTER TABLE [HealthInsuranceConfig] ADD CONSTRAINT [FK_HealthInsuranceConfig_Company] FOREIGN KEY ([companyId]) REFERENCES [Company]([id]);
