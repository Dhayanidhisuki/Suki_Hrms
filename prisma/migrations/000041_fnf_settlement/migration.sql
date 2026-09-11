-- CreateTable: FnFSettlement
CREATE TABLE [FnFSettlement] (
    [id] INT NOT NULL IDENTITY(1,1),
    [companyId] INT NOT NULL,
    [employeeId] INT NOT NULL,
    [exitInterviewId] INT NOT NULL,
    [lastWorkingDay] DATE NOT NULL,
    [settlementDate] DATETIME2,
    [unpaidSalary] DECIMAL(18,2) NOT NULL CONSTRAINT [DF_FnFSettlement_unpaidSalary] DEFAULT 0,
    [leaveEncashment] DECIMAL(18,2) NOT NULL CONSTRAINT [DF_FnFSettlement_leaveEncashment] DEFAULT 0,
    [leaveEncashmentDays] INT NOT NULL CONSTRAINT [DF_FnFSettlement_leaveEncashmentDays] DEFAULT 0,
    [gratuity] DECIMAL(18,2) NOT NULL CONSTRAINT [DF_FnFSettlement_gratuity] DEFAULT 0,
    [bonusProportion] DECIMAL(18,2) NOT NULL CONSTRAINT [DF_FnFSettlement_bonusProportion] DEFAULT 0,
    [noticePay] DECIMAL(18,2) NOT NULL CONSTRAINT [DF_FnFSettlement_noticePay] DEFAULT 0,
    [loanRecovery] DECIMAL(18,2) NOT NULL CONSTRAINT [DF_FnFSettlement_loanRecovery] DEFAULT 0,
    [assetRecovery] DECIMAL(18,2) NOT NULL CONSTRAINT [DF_FnFSettlement_assetRecovery] DEFAULT 0,
    [otherPayments] DECIMAL(18,2) NOT NULL CONSTRAINT [DF_FnFSettlement_otherPayments] DEFAULT 0,
    [otherDeductions] DECIMAL(18,2) NOT NULL CONSTRAINT [DF_FnFSettlement_otherDeductions] DEFAULT 0,
    [totalPayable] DECIMAL(18,2) NOT NULL CONSTRAINT [DF_FnFSettlement_totalPayable] DEFAULT 0,
    [totalRecovery] DECIMAL(18,2) NOT NULL CONSTRAINT [DF_FnFSettlement_totalRecovery] DEFAULT 0,
    [netPayable] DECIMAL(18,2) NOT NULL CONSTRAINT [DF_FnFSettlement_netPayable] DEFAULT 0,
    [status] NVARCHAR(20) NOT NULL CONSTRAINT [DF_FnFSettlement_status] DEFAULT 'pending',
    [calculatedByUserId] INT,
    [calculatedAt] DATETIME2,
    [approvedByUserId] INT,
    [approvedAt] DATETIME2,
    [rejectionReason] NVARCHAR(500),
    [remarks] NVARCHAR(500),
    [paymentDate] DATETIME2,
    [paymentReference] NVARCHAR(100),
    [createdAt] DATETIME2 NOT NULL CONSTRAINT [DF_FnFSettlement_createdAt] DEFAULT CURRENT_TIMESTAMP,
    [updatedAt] DATETIME2 NOT NULL,
    CONSTRAINT [PK_FnFSettlement] PRIMARY KEY ([id]),
    CONSTRAINT [UQ_FnFSettlement_exitInterviewId] UNIQUE ([exitInterviewId])
);
CREATE INDEX [IX_FnFSettlement_companyId_status] ON [FnFSettlement] ([companyId], [status]);

-- AddForeignKey
ALTER TABLE [FnFSettlement] ADD CONSTRAINT [FK_FnFSettlement_Company] FOREIGN KEY ([companyId]) REFERENCES [Company]([id]);
ALTER TABLE [FnFSettlement] ADD CONSTRAINT [FK_FnFSettlement_Employee] FOREIGN KEY ([employeeId]) REFERENCES [Employee]([id]);
ALTER TABLE [FnFSettlement] ADD CONSTRAINT [FK_FnFSettlement_ExitInterview] FOREIGN KEY ([exitInterviewId]) REFERENCES [ExitInterview]([id]);
