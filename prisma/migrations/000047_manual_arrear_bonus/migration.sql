-- CreateTable: ManualArrear
CREATE TABLE [ManualArrear] (
    [id] INT NOT NULL IDENTITY(1,1),
    [companyId] INT NOT NULL,
    [employeeId] INT NOT NULL,
    [arrearType] NVARCHAR(30) NOT NULL,
    [amountType] NVARCHAR(10) NOT NULL CONSTRAINT [DF_ManualArrear_amountType] DEFAULT 'EARNING',
    [amount] DECIMAL(18,2) NOT NULL,
    [arrearYear] INT NOT NULL,
    [arrearMonth] INT NOT NULL,
    [description] NVARCHAR(500),
    [status] NVARCHAR(20) NOT NULL CONSTRAINT [DF_ManualArrear_status] DEFAULT 'PENDING',
    [approvedByUserId] INT,
    [approvedAt] DATETIME2,
    [rejectReason] NVARCHAR(500),
    [appliedPayrollRunId] INT,
    [appliedAt] DATETIME2,
    [createdByUserId] INT,
    [createdAt] DATETIME2 NOT NULL CONSTRAINT [DF_ManualArrear_createdAt] DEFAULT CURRENT_TIMESTAMP,
    [updatedAt] DATETIME2 NOT NULL,
    CONSTRAINT [PK_ManualArrear] PRIMARY KEY ([id])
);
CREATE INDEX [IX_ManualArrear_companyId_status] ON [ManualArrear] ([companyId], [status]);
CREATE INDEX [IX_ManualArrear_employeeId] ON [ManualArrear] ([employeeId]);

-- AlterTable: Add bonus type + paid/balance tracking to BonusRecord
ALTER TABLE [BonusRecord] ADD [bonusType] NVARCHAR(30) NOT NULL CONSTRAINT [DF_BonusRecord_bonusType] DEFAULT 'ANNUAL';
ALTER TABLE [BonusRecord] ADD [monthlyAccrual] DECIMAL(18,2) NOT NULL CONSTRAINT [DF_BonusRecord_monthlyAccrual] DEFAULT 0;
ALTER TABLE [BonusRecord] ADD [totalAccrued] DECIMAL(18,2) NOT NULL CONSTRAINT [DF_BonusRecord_totalAccrued] DEFAULT 0;
ALTER TABLE [BonusRecord] ADD [totalPaid] DECIMAL(18,2) NOT NULL CONSTRAINT [DF_BonusRecord_totalPaid] DEFAULT 0;
ALTER TABLE [BonusRecord] ADD [balanceDue] DECIMAL(18,2) NOT NULL CONSTRAINT [DF_BonusRecord_balanceDue] DEFAULT 0;

-- AddForeignKey
ALTER TABLE [ManualArrear] ADD CONSTRAINT [FK_ManualArrear_Company] FOREIGN KEY ([companyId]) REFERENCES [Company]([id]);
ALTER TABLE [ManualArrear] ADD CONSTRAINT [FK_ManualArrear_Employee] FOREIGN KEY ([employeeId]) REFERENCES [Employee]([id]);
ALTER TABLE [ManualArrear] ADD CONSTRAINT [FK_ManualArrear_PayrollRun] FOREIGN KEY ([appliedPayrollRunId]) REFERENCES [PayrollRun]([id]);
