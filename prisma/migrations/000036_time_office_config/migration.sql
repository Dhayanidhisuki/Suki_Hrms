-- AlterTable: OTPlan new fields
ALTER TABLE [OTPlan] ADD [weekdayFactor] DECIMAL(5,2) NOT NULL CONSTRAINT [DF_OTPlan_weekdayFactor] DEFAULT 1;
ALTER TABLE [OTPlan] ADD [weeklyOffFactor] DECIMAL(5,2) NOT NULL CONSTRAINT [DF_OTPlan_weeklyOffFactor] DEFAULT 1.5;
ALTER TABLE [OTPlan] ADD [holidayFactor] DECIMAL(5,2) NOT NULL CONSTRAINT [DF_OTPlan_holidayFactor] DEFAULT 2;
ALTER TABLE [OTPlan] ADD [maxOtHoursPerWeek] INT;
ALTER TABLE [OTPlan] ADD [maxOtHoursPerMonth] INT;
ALTER TABLE [OTPlan] ADD [weeklyOffSettlement] NVARCHAR(20) NOT NULL CONSTRAINT [DF_OTPlan_weeklyOffSettlement] DEFAULT 'PAYMENT';

-- CreateTable: CompOffPolicy
CREATE TABLE [CompOffPolicy] (
    [id] INT NOT NULL IDENTITY(1,1),
    [companyId] INT NOT NULL,
    [minQualifyingHours] INT NOT NULL CONSTRAINT [DF_CompOffPolicy_minQualifyingHours] DEFAULT 4,
    [qualifyingDayTypes] NVARCHAR(100) NOT NULL CONSTRAINT [DF_CompOffPolicy_qualifyingDayTypes] DEFAULT 'WEEKLY_OFF,HOLIDAY',
    [requiresApproval] BIT NOT NULL CONSTRAINT [DF_CompOffPolicy_requiresApproval] DEFAULT 1,
    [expiryMonths] INT NOT NULL CONSTRAINT [DF_CompOffPolicy_expiryMonths] DEFAULT 3,
    [allowEncashment] BIT NOT NULL CONSTRAINT [DF_CompOffPolicy_allowEncashment] DEFAULT 0,
    [encashmentRatePerDay] DECIMAL(18,2),
    [autoCreditOnApproval] BIT NOT NULL CONSTRAINT [DF_CompOffPolicy_autoCreditOnApproval] DEFAULT 1,
    [isActive] BIT NOT NULL CONSTRAINT [DF_CompOffPolicy_isActive] DEFAULT 1,
    [createdAt] DATETIME2 NOT NULL CONSTRAINT [DF_CompOffPolicy_createdAt] DEFAULT CURRENT_TIMESTAMP,
    [updatedAt] DATETIME2 NOT NULL,
    CONSTRAINT [PK_CompOffPolicy] PRIMARY KEY ([id]),
    CONSTRAINT [UQ_CompOffPolicy_companyId] UNIQUE ([companyId])
);

-- CreateTable: CompOffBalance
CREATE TABLE [CompOffBalance] (
    [id] INT NOT NULL IDENTITY(1,1),
    [employeeId] INT NOT NULL,
    [balance] DECIMAL(8,2) NOT NULL CONSTRAINT [DF_CompOffBalance_balance] DEFAULT 0,
    [earned] DECIMAL(8,2) NOT NULL CONSTRAINT [DF_CompOffBalance_earned] DEFAULT 0,
    [used] DECIMAL(8,2) NOT NULL CONSTRAINT [DF_CompOffBalance_used] DEFAULT 0,
    [expired] DECIMAL(8,2) NOT NULL CONSTRAINT [DF_CompOffBalance_expired] DEFAULT 0,
    [encashed] DECIMAL(8,2) NOT NULL CONSTRAINT [DF_CompOffBalance_encashed] DEFAULT 0,
    [createdAt] DATETIME2 NOT NULL CONSTRAINT [DF_CompOffBalance_createdAt] DEFAULT CURRENT_TIMESTAMP,
    [updatedAt] DATETIME2 NOT NULL,
    CONSTRAINT [PK_CompOffBalance] PRIMARY KEY ([id]),
    CONSTRAINT [UQ_CompOffBalance_employeeId] UNIQUE ([employeeId])
);

-- CreateTable: CompOffTransaction
CREATE TABLE [CompOffTransaction] (
    [id] INT NOT NULL IDENTITY(1,1),
    [employeeId] INT NOT NULL,
    [date] DATE NOT NULL,
    [type] NVARCHAR(20) NOT NULL,
    [days] DECIMAL(8,2) NOT NULL,
    [balanceAfter] DECIMAL(8,2) NOT NULL,
    [reason] NVARCHAR(500),
    [sourceType] NVARCHAR(20),
    [sourceId] INT,
    [createdAt] DATETIME2 NOT NULL CONSTRAINT [DF_CompOffTransaction_createdAt] DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT [PK_CompOffTransaction] PRIMARY KEY ([id])
);
CREATE INDEX [IX_CompOffTransaction_employeeId_date] ON [CompOffTransaction] ([employeeId], [date]);

-- CreateTable: OTIncentiveSlab
CREATE TABLE [OTIncentiveSlab] (
    [id] INT NOT NULL IDENTITY(1,1),
    [companyId] INT NOT NULL,
    [code] NVARCHAR(20) NOT NULL,
    [name] NVARCHAR(100) NOT NULL,
    [minOtHours] DECIMAL(8,2) NOT NULL,
    [maxOtHours] DECIMAL(8,2),
    [incentiveMultiplier] DECIMAL(5,2) NOT NULL,
    [effectiveFrom] DATETIME2 NOT NULL,
    [effectiveTo] DATETIME2,
    [isActive] BIT NOT NULL CONSTRAINT [DF_OTIncentiveSlab_isActive] DEFAULT 1,
    [createdAt] DATETIME2 NOT NULL CONSTRAINT [DF_OTIncentiveSlab_createdAt] DEFAULT CURRENT_TIMESTAMP,
    [updatedAt] DATETIME2 NOT NULL,
    CONSTRAINT [PK_OTIncentiveSlab] PRIMARY KEY ([id])
);
CREATE INDEX [IX_OTIncentiveSlab_companyId_code] ON [OTIncentiveSlab] ([companyId], [code]);
CREATE INDEX [IX_OTIncentiveSlab_effectiveFrom_effectiveTo] ON [OTIncentiveSlab] ([effectiveFrom], [effectiveTo]);

-- CreateTable: AttendanceBonusConfig
CREATE TABLE [AttendanceBonusConfig] (
    [id] INT NOT NULL IDENTITY(1,1),
    [companyId] INT NOT NULL,
    [bonusAmount] DECIMAL(18,2) NOT NULL CONSTRAINT [DF_AttendanceBonusConfig_bonusAmount] DEFAULT 0,
    [requiresZeroLop] BIT NOT NULL CONSTRAINT [DF_AttendanceBonusConfig_requiresZeroLop] DEFAULT 1,
    [requiresZeroLate] BIT NOT NULL CONSTRAINT [DF_AttendanceBonusConfig_requiresZeroLate] DEFAULT 0,
    [requiresZeroEarlyOut] BIT NOT NULL CONSTRAINT [DF_AttendanceBonusConfig_requiresZeroEarlyOut] DEFAULT 0,
    [prorateByPayableDays] BIT NOT NULL CONSTRAINT [DF_AttendanceBonusConfig_prorateByPayableDays] DEFAULT 0,
    [minPayableDaysPercent] DECIMAL(5,2) NOT NULL CONSTRAINT [DF_AttendanceBonusConfig_minPayableDaysPercent] DEFAULT 100,
    [isActive] BIT NOT NULL CONSTRAINT [DF_AttendanceBonusConfig_isActive] DEFAULT 1,
    [createdAt] DATETIME2 NOT NULL CONSTRAINT [DF_AttendanceBonusConfig_createdAt] DEFAULT CURRENT_TIMESTAMP,
    [updatedAt] DATETIME2 NOT NULL,
    CONSTRAINT [PK_AttendanceBonusConfig] PRIMARY KEY ([id]),
    CONSTRAINT [UQ_AttendanceBonusConfig_companyId] UNIQUE ([companyId])
);

-- AddForeignKey
ALTER TABLE [CompOffPolicy] ADD CONSTRAINT [FK_CompOffPolicy_Company] FOREIGN KEY ([companyId]) REFERENCES [Company]([id]);
ALTER TABLE [CompOffBalance] ADD CONSTRAINT [FK_CompOffBalance_Employee] FOREIGN KEY ([employeeId]) REFERENCES [Employee]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;
ALTER TABLE [CompOffTransaction] ADD CONSTRAINT [FK_CompOffTransaction_Employee] FOREIGN KEY ([employeeId]) REFERENCES [Employee]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;
ALTER TABLE [OTIncentiveSlab] ADD CONSTRAINT [FK_OTIncentiveSlab_Company] FOREIGN KEY ([companyId]) REFERENCES [Company]([id]);
ALTER TABLE [AttendanceBonusConfig] ADD CONSTRAINT [FK_AttendanceBonusConfig_Company] FOREIGN KEY ([companyId]) REFERENCES [Company]([id]);
