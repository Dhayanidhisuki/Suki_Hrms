-- CreateTable: IncentivePolicy
CREATE TABLE [IncentivePolicy] (
    [id] INT NOT NULL IDENTITY(1,1),
    [companyId] INT NOT NULL,
    [type] NVARCHAR(30) NOT NULL,
    [name] NVARCHAR(100) NOT NULL,
    [amount] DECIMAL(18,2) NOT NULL,
    [calculationType] NVARCHAR(20) NOT NULL CONSTRAINT [DF_IncentivePolicy_calculationType] DEFAULT 'FLAT',
    [formula] NVARCHAR(500),
    [eligibility] NVARCHAR(500),
    [eligibleShiftCodes] NVARCHAR(200),
    [isActive] BIT NOT NULL CONSTRAINT [DF_IncentivePolicy_isActive] DEFAULT 1,
    [createdAt] DATETIME2 NOT NULL CONSTRAINT [DF_IncentivePolicy_createdAt] DEFAULT CURRENT_TIMESTAMP,
    [updatedAt] DATETIME2 NOT NULL,
    CONSTRAINT [PK_IncentivePolicy] PRIMARY KEY ([id])
);
CREATE INDEX [IX_IncentivePolicy_companyId_type] ON [IncentivePolicy] ([companyId], [type]);

-- CreateTable: DoubleMachineEntry
CREATE TABLE [DoubleMachineEntry] (
    [id] INT NOT NULL IDENTITY(1,1),
    [employeeId] INT NOT NULL,
    [date] DATE NOT NULL,
    [machine1] NVARCHAR(50),
    [machine2] NVARCHAR(50),
    [numMachines] INT NOT NULL CONSTRAINT [DF_DoubleMachineEntry_numMachines] DEFAULT 1,
    [workingHours] DECIMAL(5,2) NOT NULL,
    [incentiveRate] DECIMAL(18,2) NOT NULL,
    [calculatedIncentive] DECIMAL(18,2) NOT NULL,
    [hrRemarks] NVARCHAR(500),
    [status] NVARCHAR(20) NOT NULL CONSTRAINT [DF_DoubleMachineEntry_status] DEFAULT 'PENDING',
    [approvedByUserId] INT,
    [approvedAt] DATETIME2,
    [createdAt] DATETIME2 NOT NULL CONSTRAINT [DF_DoubleMachineEntry_createdAt] DEFAULT CURRENT_TIMESTAMP,
    [updatedAt] DATETIME2 NOT NULL,
    CONSTRAINT [PK_DoubleMachineEntry] PRIMARY KEY ([id])
);
CREATE INDEX [IX_DoubleMachineEntry_employeeId] ON [DoubleMachineEntry] ([employeeId]);

-- CreateTable: CanteenToken
CREATE TABLE [CanteenToken] (
    [id] INT NOT NULL IDENTITY(1,1),
    [employeeId] INT NOT NULL,
    [date] DATE NOT NULL,
    [tokensUsed] INT NOT NULL CONSTRAINT [DF_CanteenToken_tokensUsed] DEFAULT 0,
    [ratePerToken] DECIMAL(18,2) NOT NULL,
    [employeeContribution] DECIMAL(18,2) NOT NULL,
    [companyContribution] DECIMAL(18,2) NOT NULL CONSTRAINT [DF_CanteenToken_companyContribution] DEFAULT 0,
    [createdAt] DATETIME2 NOT NULL CONSTRAINT [DF_CanteenToken_createdAt] DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT [PK_CanteenToken] PRIMARY KEY ([id])
);
CREATE INDEX [IX_CanteenToken_employeeId_date] ON [CanteenToken] ([employeeId], [date]);

-- CreateTable: PetrolAllowanceEntry
CREATE TABLE [PetrolAllowanceEntry] (
    [id] INT NOT NULL IDENTITY(1,1),
    [employeeId] INT NOT NULL,
    [month] INT NOT NULL,
    [year] INT NOT NULL,
    [travelDate] DATE NOT NULL,
    [km] DECIMAL(10,2) NOT NULL,
    [ratePerKm] DECIMAL(18,2) NOT NULL,
    [eligibleAmount] DECIMAL(18,2) NOT NULL,
    [approvedAmount] DECIMAL(18,2) NOT NULL,
    [status] NVARCHAR(20) NOT NULL CONSTRAINT [DF_PetrolAllowanceEntry_status] DEFAULT 'PENDING',
    [managerActionByUserId] INT,
    [managerActionAt] DATETIME2,
    [rejectionReason] NVARCHAR(500),
    [createdAt] DATETIME2 NOT NULL CONSTRAINT [DF_PetrolAllowanceEntry_createdAt] DEFAULT CURRENT_TIMESTAMP,
    [updatedAt] DATETIME2 NOT NULL,
    CONSTRAINT [PK_PetrolAllowanceEntry] PRIMARY KEY ([id])
);
CREATE INDEX [IX_PetrolAllowanceEntry_employeeId] ON [PetrolAllowanceEntry] ([employeeId]);
CREATE INDEX [IX_PetrolAllowanceEntry_employeeId_year_month] ON [PetrolAllowanceEntry] ([employeeId], [year], [month]);

-- CreateTable: AllowanceConfig
CREATE TABLE [AllowanceConfig] (
    [id] INT NOT NULL IDENTITY(1,1),
    [companyId] INT NOT NULL,
    [componentCode] NVARCHAR(30) NOT NULL,
    [amount] DECIMAL(18,2) NOT NULL,
    [eligibilityType] NVARCHAR(20) NOT NULL CONSTRAINT [DF_AllowanceConfig_eligibilityType] DEFAULT 'ALL',
    [eligibilityValue] NVARCHAR(200),
    [isActive] BIT NOT NULL CONSTRAINT [DF_AllowanceConfig_isActive] DEFAULT 1,
    [createdAt] DATETIME2 NOT NULL CONSTRAINT [DF_AllowanceConfig_createdAt] DEFAULT CURRENT_TIMESTAMP,
    [updatedAt] DATETIME2 NOT NULL,
    CONSTRAINT [PK_AllowanceConfig] PRIMARY KEY ([id])
);
CREATE INDEX [IX_AllowanceConfig_companyId] ON [AllowanceConfig] ([companyId]);

-- AddForeignKey
ALTER TABLE [IncentivePolicy] ADD CONSTRAINT [FK_IncentivePolicy_Company] FOREIGN KEY ([companyId]) REFERENCES [Company]([id]);
ALTER TABLE [DoubleMachineEntry] ADD CONSTRAINT [FK_DoubleMachineEntry_Employee] FOREIGN KEY ([employeeId]) REFERENCES [Employee]([id]);
ALTER TABLE [CanteenToken] ADD CONSTRAINT [FK_CanteenToken_Employee] FOREIGN KEY ([employeeId]) REFERENCES [Employee]([id]);
ALTER TABLE [PetrolAllowanceEntry] ADD CONSTRAINT [FK_PetrolAllowanceEntry_Employee] FOREIGN KEY ([employeeId]) REFERENCES [Employee]([id]);
ALTER TABLE [AllowanceConfig] ADD CONSTRAINT [FK_AllowanceConfig_Company] FOREIGN KEY ([companyId]) REFERENCES [Company]([id]);
