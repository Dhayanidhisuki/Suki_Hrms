-- CreateTable: TdsInvestmentDeclaration
CREATE TABLE [TdsInvestmentDeclaration] (
    [id] INT NOT NULL IDENTITY(1,1),
    [employeeId] INT NOT NULL,
    [companyId] INT NOT NULL,
    [financialYear] INT NOT NULL,
    [regime] NVARCHAR(20) NOT NULL CONSTRAINT [DF_TdsInvestmentDeclaration_regime] DEFAULT 'NEW',
    [section80C] DECIMAL(18,2) NOT NULL CONSTRAINT [DF_TdsInvestmentDeclaration_section80C] DEFAULT 0,
    [section80D] DECIMAL(18,2) NOT NULL CONSTRAINT [DF_TdsInvestmentDeclaration_section80D] DEFAULT 0,
    [section80CCD] DECIMAL(18,2) NOT NULL CONSTRAINT [DF_TdsInvestmentDeclaration_section80CCD] DEFAULT 0,
    [section80G] DECIMAL(18,2) NOT NULL CONSTRAINT [DF_TdsInvestmentDeclaration_section80G] DEFAULT 0,
    [section80E] DECIMAL(18,2) NOT NULL CONSTRAINT [DF_TdsInvestmentDeclaration_section80E] DEFAULT 0,
    [section80TTA] DECIMAL(18,2) NOT NULL CONSTRAINT [DF_TdsInvestmentDeclaration_section80TTA] DEFAULT 0,
    [otherDeductions] DECIMAL(18,2) NOT NULL CONSTRAINT [DF_TdsInvestmentDeclaration_otherDeductions] DEFAULT 0,
    [hraExemption] DECIMAL(18,2) NOT NULL CONSTRAINT [DF_TdsInvestmentDeclaration_hraExemption] DEFAULT 0,
    [otherIncome] DECIMAL(18,2) NOT NULL CONSTRAINT [DF_TdsInvestmentDeclaration_otherIncome] DEFAULT 0,
    [status] NVARCHAR(20) NOT NULL CONSTRAINT [DF_TdsInvestmentDeclaration_status] DEFAULT 'pending_hr',
    [approvedByUserId] INT,
    [approvedAt] DATETIME2,
    [rejectionReason] NVARCHAR(500),
    [remarks] NVARCHAR(500),
    [createdAt] DATETIME2 NOT NULL CONSTRAINT [DF_TdsInvestmentDeclaration_createdAt] DEFAULT CURRENT_TIMESTAMP,
    [updatedAt] DATETIME2 NOT NULL,
    CONSTRAINT [PK_TdsInvestmentDeclaration] PRIMARY KEY ([id])
);
CREATE INDEX [IX_TdsInvestmentDeclaration_employeeId_financialYear] ON [TdsInvestmentDeclaration] ([employeeId], [financialYear]);
CREATE INDEX [IX_TdsInvestmentDeclaration_companyId_financialYear] ON [TdsInvestmentDeclaration] ([companyId], [financialYear]);

-- CreateTable: TdsInvestmentProof
CREATE TABLE [TdsInvestmentProof] (
    [id] INT NOT NULL IDENTITY(1,1),
    [declarationId] INT NOT NULL,
    [section] NVARCHAR(20) NOT NULL,
    [amount] DECIMAL(18,2) NOT NULL,
    [description] NVARCHAR(500),
    [documentUrl] NVARCHAR(500),
    [status] NVARCHAR(20) NOT NULL CONSTRAINT [DF_TdsInvestmentProof_status] DEFAULT 'pending',
    [verifiedByUserId] INT,
    [verifiedAt] DATETIME2,
    [rejectionReason] NVARCHAR(500),
    [createdAt] DATETIME2 NOT NULL CONSTRAINT [DF_TdsInvestmentProof_createdAt] DEFAULT CURRENT_TIMESTAMP,
    [updatedAt] DATETIME2 NOT NULL,
    CONSTRAINT [PK_TdsInvestmentProof] PRIMARY KEY ([id])
);
CREATE INDEX [IX_TdsInvestmentProof_declarationId] ON [TdsInvestmentProof] ([declarationId]);

-- AddForeignKey
ALTER TABLE [TdsInvestmentDeclaration] ADD CONSTRAINT [FK_TdsInvestmentDeclaration_Employee] FOREIGN KEY ([employeeId]) REFERENCES [Employee]([id]);
ALTER TABLE [TdsInvestmentDeclaration] ADD CONSTRAINT [FK_TdsInvestmentDeclaration_Company] FOREIGN KEY ([companyId]) REFERENCES [Company]([id]);
ALTER TABLE [TdsInvestmentProof] ADD CONSTRAINT [FK_TdsInvestmentProof_TdsInvestmentDeclaration] FOREIGN KEY ([declarationId]) REFERENCES [TdsInvestmentDeclaration]([id]) ON DELETE CASCADE;
