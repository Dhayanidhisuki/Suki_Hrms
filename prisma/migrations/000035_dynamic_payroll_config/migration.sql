-- CreateTable: LomConfig
CREATE TABLE [LomConfig] (
    [id] INT NOT NULL IDENTITY(1,1),
    [companyId] INT NOT NULL,
    [calculationBasis] NVARCHAR(20) NOT NULL CONSTRAINT [DF_LomConfig_calculationBasis] DEFAULT 'GROSS',
    [multiplier] DECIMAL(5,2) NOT NULL CONSTRAINT [DF_LomConfig_multiplier] DEFAULT 1,
    [shiftDurationSource] NVARCHAR(20) NOT NULL CONSTRAINT [DF_LomConfig_shiftDurationSource] DEFAULT 'FIXED_8',
    [payrollDaysDenominator] NVARCHAR(20) NOT NULL CONSTRAINT [DF_LomConfig_payrollDaysDenominator] DEFAULT 'CALENDAR',
    [graceMinutesExempt] INT NOT NULL CONSTRAINT [DF_LomConfig_graceMinutesExempt] DEFAULT 0,
    [dailyLomCap] INT,
    [isActive] BIT NOT NULL CONSTRAINT [DF_LomConfig_isActive] DEFAULT 1,
    [createdAt] DATETIME2 NOT NULL CONSTRAINT [DF_LomConfig_createdAt] DEFAULT CURRENT_TIMESTAMP,
    [updatedAt] DATETIME2 NOT NULL,
    CONSTRAINT [PK_LomConfig] PRIMARY KEY ([id]),
    CONSTRAINT [UQ_LomConfig_companyId] UNIQUE ([companyId])
);

-- CreateTable: RoundingConfig
CREATE TABLE [RoundingConfig] (
    [id] INT NOT NULL IDENTITY(1,1),
    [companyId] INT NOT NULL,
    [roundingMode] NVARCHAR(20) NOT NULL CONSTRAINT [DF_RoundingConfig_roundingMode] DEFAULT 'NEAREST_1',
    [applyTo] NVARCHAR(20) NOT NULL CONSTRAINT [DF_RoundingConfig_applyTo] DEFAULT 'NET_ONLY',
    [showRoundOff] BIT NOT NULL CONSTRAINT [DF_RoundingConfig_showRoundOff] DEFAULT 1,
    [createdAt] DATETIME2 NOT NULL CONSTRAINT [DF_RoundingConfig_createdAt] DEFAULT CURRENT_TIMESTAMP,
    [updatedAt] DATETIME2 NOT NULL,
    CONSTRAINT [PK_RoundingConfig] PRIMARY KEY ([id]),
    CONSTRAINT [UQ_RoundingConfig_companyId] UNIQUE ([companyId])
);

-- CreateTable: PayrollValidationConfig
CREATE TABLE [PayrollValidationConfig] (
    [id] INT NOT NULL IDENTITY(1,1),
    [companyId] INT NOT NULL,
    [allowNegativeNet] BIT NOT NULL CONSTRAINT [DF_PayrollValidationConfig_allowNegativeNet] DEFAULT 0,
    [minNetPercentOfGross] DECIMAL(5,2) NOT NULL CONSTRAINT [DF_PayrollValidationConfig_minNetPercentOfGross] DEFAULT 0,
    [requireApprovalIfNegative] BIT NOT NULL CONSTRAINT [DF_PayrollValidationConfig_requireApprovalIfNegative] DEFAULT 1,
    [maxDeductionPercent] DECIMAL(5,2) NOT NULL CONSTRAINT [DF_PayrollValidationConfig_maxDeductionPercent] DEFAULT 100,
    [statutoryIncludedInLimit] BIT NOT NULL CONSTRAINT [DF_PayrollValidationConfig_statutoryIncludedInLimit] DEFAULT 1,
    [createdAt] DATETIME2 NOT NULL CONSTRAINT [DF_PayrollValidationConfig_createdAt] DEFAULT CURRENT_TIMESTAMP,
    [updatedAt] DATETIME2 NOT NULL,
    CONSTRAINT [PK_PayrollValidationConfig] PRIMARY KEY ([id]),
    CONSTRAINT [UQ_PayrollValidationConfig_companyId] UNIQUE ([companyId])
);

-- CreateTable: PayrollWorkflowConfig
CREATE TABLE [PayrollWorkflowConfig] (
    [id] INT NOT NULL IDENTITY(1,1),
    [companyId] INT NOT NULL,
    [enableValidatedStage] BIT NOT NULL CONSTRAINT [DF_PayrollWorkflowConfig_enableValidatedStage] DEFAULT 0,
    [enableSubmittedStage] BIT NOT NULL CONSTRAINT [DF_PayrollWorkflowConfig_enableSubmittedStage] DEFAULT 0,
    [enablePostedStage] BIT NOT NULL CONSTRAINT [DF_PayrollWorkflowConfig_enablePostedStage] DEFAULT 0,
    [approvalStages] NVARCHAR(100) NOT NULL CONSTRAINT [DF_PayrollWorkflowConfig_approvalStages] DEFAULT 'HR',
    [cutoffDayOfMonth] INT,
    [allowReopenAfterLock] BIT NOT NULL CONSTRAINT [DF_PayrollWorkflowConfig_allowReopenAfterLock] DEFAULT 1,
    [reopenRequiresReason] BIT NOT NULL CONSTRAINT [DF_PayrollWorkflowConfig_reopenRequiresReason] DEFAULT 1,
    [createdAt] DATETIME2 NOT NULL CONSTRAINT [DF_PayrollWorkflowConfig_createdAt] DEFAULT CURRENT_TIMESTAMP,
    [updatedAt] DATETIME2 NOT NULL,
    CONSTRAINT [PK_PayrollWorkflowConfig] PRIMARY KEY ([id]),
    CONSTRAINT [UQ_PayrollWorkflowConfig_companyId] UNIQUE ([companyId])
);

-- CreateTable: PayrollDisplayConfig
CREATE TABLE [PayrollDisplayConfig] (
    [id] INT NOT NULL IDENTITY(1,1),
    [companyId] INT NOT NULL,
    [showDeductionPercent] BIT NOT NULL CONSTRAINT [DF_PayrollDisplayConfig_showDeductionPercent] DEFAULT 1,
    [decimalPlaces] INT NOT NULL CONSTRAINT [DF_PayrollDisplayConfig_decimalPlaces] DEFAULT 2,
    [showYTD] BIT NOT NULL CONSTRAINT [DF_PayrollDisplayConfig_showYTD] DEFAULT 0,
    [showLeaveBalance] BIT NOT NULL CONSTRAINT [DF_PayrollDisplayConfig_showLeaveBalance] DEFAULT 0,
    [showTaxBreakdown] BIT NOT NULL CONSTRAINT [DF_PayrollDisplayConfig_showTaxBreakdown] DEFAULT 0,
    [createdAt] DATETIME2 NOT NULL CONSTRAINT [DF_PayrollDisplayConfig_createdAt] DEFAULT CURRENT_TIMESTAMP,
    [updatedAt] DATETIME2 NOT NULL,
    CONSTRAINT [PK_PayrollDisplayConfig] PRIMARY KEY ([id]),
    CONSTRAINT [UQ_PayrollDisplayConfig_companyId] UNIQUE ([companyId])
);

-- AddColumn: PayrollLine.lomAmount
ALTER TABLE [PayrollLine] ADD [lomAmount] DECIMAL(18,2) NOT NULL CONSTRAINT [DF_PayrollLine_lomAmount] DEFAULT 0;

-- AddColumn: ShiftMaster break/allowance fields
ALTER TABLE [ShiftMaster] ADD [breakMinutes] INT NOT NULL CONSTRAINT [DF_ShiftMaster_breakMinutes] DEFAULT 0;
ALTER TABLE [ShiftMaster] ADD [nightAllowanceAmount] DECIMAL(18,2);
ALTER TABLE [ShiftMaster] ADD [nightAllowanceFromHour] INT;
ALTER TABLE [ShiftMaster] ADD [snacksAllowanceAmount] DECIMAL(18,2);
ALTER TABLE [ShiftMaster] ADD [foodAllowanceAmount] DECIMAL(18,2);
ALTER TABLE [ShiftMaster] ADD [mealsAllowanceAmount] DECIMAL(18,2);

-- AddForeignKey constraints
ALTER TABLE [LomConfig] ADD CONSTRAINT [FK_LomConfig_Company] FOREIGN KEY ([companyId]) REFERENCES [Company]([id]);
ALTER TABLE [RoundingConfig] ADD CONSTRAINT [FK_RoundingConfig_Company] FOREIGN KEY ([companyId]) REFERENCES [Company]([id]);
ALTER TABLE [PayrollValidationConfig] ADD CONSTRAINT [FK_PayrollValidationConfig_Company] FOREIGN KEY ([companyId]) REFERENCES [Company]([id]);
ALTER TABLE [PayrollWorkflowConfig] ADD CONSTRAINT [FK_PayrollWorkflowConfig_Company] FOREIGN KEY ([companyId]) REFERENCES [Company]([id]);
ALTER TABLE [PayrollDisplayConfig] ADD CONSTRAINT [FK_PayrollDisplayConfig_Company] FOREIGN KEY ([companyId]) REFERENCES [Company]([id]);
