-- CreateTable: Loan
CREATE TABLE [Loan] (
    [id] INT NOT NULL IDENTITY(1,1),
    [companyId] INT NOT NULL,
    [employeeId] INT NOT NULL,
    [loanTypeId] INT NOT NULL,
    [code] NVARCHAR(20) NOT NULL,
    [principal] DECIMAL(18,2) NOT NULL,
    [interestRate] DECIMAL(5,2) NOT NULL CONSTRAINT [DF_Loan_interestRate] DEFAULT 0,
    [tenureMonths] INT NOT NULL,
    [installmentAmount] DECIMAL(18,2) NOT NULL,
    [disbursementDate] DATE NOT NULL,
    [firstDeductionMonth] INT,
    [firstDeductionYear] INT,
    [status] NVARCHAR(20) NOT NULL CONSTRAINT [DF_Loan_status] DEFAULT 'pending',
    [requestedByUserId] INT,
    [approvedByUserId] INT,
    [approvedAt] DATETIME2,
    [rejectionReason] NVARCHAR(500),
    [disbursedByUserId] INT,
    [disbursedAt] DATETIME2,
    [disbursementReference] NVARCHAR(100),
    [principalPaid] DECIMAL(18,2) NOT NULL CONSTRAINT [DF_Loan_principalPaid] DEFAULT 0,
    [interestPaid] DECIMAL(18,2) NOT NULL CONSTRAINT [DF_Loan_interestPaid] DEFAULT 0,
    [outstandingBalance] DECIMAL(18,2) NOT NULL,
    [installmentsPaid] INT NOT NULL CONSTRAINT [DF_Loan_installmentsPaid] DEFAULT 0,
    [closedAt] DATETIME2,
    [closureReason] NVARCHAR(500),
    [remarks] NVARCHAR(500),
    [createdAt] DATETIME2 NOT NULL CONSTRAINT [DF_Loan_createdAt] DEFAULT CURRENT_TIMESTAMP,
    [updatedAt] DATETIME2 NOT NULL,
    CONSTRAINT [PK_Loan] PRIMARY KEY ([id]),
    CONSTRAINT [UQ_Loan_companyId_code] UNIQUE ([companyId], [code])
);
CREATE INDEX [IX_Loan_employeeId] ON [Loan] ([employeeId]);
CREATE INDEX [IX_Loan_companyId_status] ON [Loan] ([companyId], [status]);

-- CreateTable: LoanInstallment
CREATE TABLE [LoanInstallment] (
    [id] INT NOT NULL IDENTITY(1,1),
    [loanId] INT NOT NULL,
    [installmentNumber] INT NOT NULL,
    [dueDate] DATE NOT NULL,
    [principalComponent] DECIMAL(18,2) NOT NULL,
    [interestComponent] DECIMAL(18,2) NOT NULL,
    [totalAmount] DECIMAL(18,2) NOT NULL,
    [status] NVARCHAR(20) NOT NULL CONSTRAINT [DF_LoanInstallment_status] DEFAULT 'pending',
    [payrollRunId] INT,
    [deductedAt] DATETIME2,
    [createdAt] DATETIME2 NOT NULL CONSTRAINT [DF_LoanInstallment_createdAt] DEFAULT CURRENT_TIMESTAMP,
    [updatedAt] DATETIME2 NOT NULL,
    CONSTRAINT [PK_LoanInstallment] PRIMARY KEY ([id])
);
CREATE INDEX [IX_LoanInstallment_loanId_installmentNumber] ON [LoanInstallment] ([loanId], [installmentNumber]);

-- AddForeignKey
ALTER TABLE [Loan] ADD CONSTRAINT [FK_Loan_Company] FOREIGN KEY ([companyId]) REFERENCES [Company]([id]);
ALTER TABLE [Loan] ADD CONSTRAINT [FK_Loan_Employee] FOREIGN KEY ([employeeId]) REFERENCES [Employee]([id]);
ALTER TABLE [Loan] ADD CONSTRAINT [FK_Loan_LoanType] FOREIGN KEY ([loanTypeId]) REFERENCES [LoanType]([id]);
ALTER TABLE [LoanInstallment] ADD CONSTRAINT [FK_LoanInstallment_Loan] FOREIGN KEY ([loanId]) REFERENCES [Loan]([id]) ON DELETE CASCADE;
