BEGIN TRY

BEGIN TRAN;

-- CreateTable
CREATE TABLE [dbo].[PayrollRun] (
    [id] INT NOT NULL IDENTITY(1,1),
    [companyId] INT NOT NULL,
    [year] INT NOT NULL,
    [month] INT NOT NULL,
    [status] NVARCHAR(20) NOT NULL CONSTRAINT [PayrollRun_status_df] DEFAULT 'DRAFT',
    [calculatedAt] DATETIME2,
    [approvedAt] DATETIME2,
    [approvedByUserId] INT,
    [lockedAt] DATETIME2,
    [createdAt] DATETIME2 NOT NULL CONSTRAINT [PayrollRun_createdAt_df] DEFAULT CURRENT_TIMESTAMP,
    [updatedAt] DATETIME2 NOT NULL,
    CONSTRAINT [PayrollRun_pkey] PRIMARY KEY CLUSTERED ([id]),
    CONSTRAINT [PayrollRun_companyId_year_month_key] UNIQUE NONCLUSTERED ([companyId],[year],[month])
);

-- CreateTable
CREATE TABLE [dbo].[PayrollLine] (
    [id] INT NOT NULL IDENTITY(1,1),
    [payrollRunId] INT NOT NULL,
    [employeeId] INT NOT NULL,
    [totalWorkingDays] INT NOT NULL CONSTRAINT [PayrollLine_totalWorkingDays_df] DEFAULT 0,
    [payableDays] DECIMAL(5,2) NOT NULL CONSTRAINT [PayrollLine_payableDays_df] DEFAULT 0,
    [lopDays] INT NOT NULL CONSTRAINT [PayrollLine_lopDays_df] DEFAULT 0,
    [grossEarnings] DECIMAL(18,2) NOT NULL CONSTRAINT [PayrollLine_grossEarnings_df] DEFAULT 0,
    [otAmount] DECIMAL(18,2) NOT NULL CONSTRAINT [PayrollLine_otAmount_df] DEFAULT 0,
    [otherEarningsTotal] DECIMAL(18,2) NOT NULL CONSTRAINT [PayrollLine_otherEarningsTotal_df] DEFAULT 0,
    [pfEmployee] DECIMAL(18,2) NOT NULL CONSTRAINT [PayrollLine_pfEmployee_df] DEFAULT 0,
    [esiEmployee] DECIMAL(18,2) NOT NULL CONSTRAINT [PayrollLine_esiEmployee_df] DEFAULT 0,
    [professionalTax] DECIMAL(18,2) NOT NULL CONSTRAINT [PayrollLine_professionalTax_df] DEFAULT 0,
    [tds] DECIMAL(18,2) NOT NULL CONSTRAINT [PayrollLine_tds_df] DEFAULT 0,
    [otherDeductionsTotal] DECIMAL(18,2) NOT NULL CONSTRAINT [PayrollLine_otherDeductionsTotal_df] DEFAULT 0,
    [netSalary] DECIMAL(18,2) NOT NULL CONSTRAINT [PayrollLine_netSalary_df] DEFAULT 0,
    [pfApplicable] BIT NOT NULL CONSTRAINT [PayrollLine_pfApplicable_df] DEFAULT 1,
    [esiApplicable] BIT NOT NULL CONSTRAINT [PayrollLine_esiApplicable_df] DEFAULT 0,
    [ptApplicable] BIT NOT NULL CONSTRAINT [PayrollLine_ptApplicable_df] DEFAULT 0,
    [status] NVARCHAR(20) NOT NULL CONSTRAINT [PayrollLine_status_df] DEFAULT 'OK',
    [holdReason] NVARCHAR(500),
    [createdAt] DATETIME2 NOT NULL CONSTRAINT [PayrollLine_createdAt_df] DEFAULT CURRENT_TIMESTAMP,
    [updatedAt] DATETIME2 NOT NULL,
    CONSTRAINT [PayrollLine_pkey] PRIMARY KEY CLUSTERED ([id]),
    CONSTRAINT [PayrollLine_payrollRunId_employeeId_key] UNIQUE NONCLUSTERED ([payrollRunId],[employeeId])
);

-- CreateTable
CREATE TABLE [dbo].[PayrollLineComponent] (
    [id] INT NOT NULL IDENTITY(1,1),
    [payrollLineId] INT NOT NULL,
    [salaryComponentId] INT NOT NULL,
    [amount] DECIMAL(18,2) NOT NULL,
    [isAdhoc] BIT NOT NULL CONSTRAINT [PayrollLineComponent_isAdhoc_df] DEFAULT 0,
    [createdAt] DATETIME2 NOT NULL CONSTRAINT [PayrollLineComponent_createdAt_df] DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT [PayrollLineComponent_pkey] PRIMARY KEY CLUSTERED ([id])
);

-- CreateIndex
CREATE NONCLUSTERED INDEX [PayrollLine_employeeId_idx] ON [dbo].[PayrollLine]([employeeId]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [PayrollLineComponent_payrollLineId_idx] ON [dbo].[PayrollLineComponent]([payrollLineId]);

-- NOTE: `prisma migrate diff` also emitted `ALTER TABLE [dbo].[Employee] ADD
-- CONSTRAINT [Employee_userId_key] UNIQUE NONCLUSTERED ([userId])` here —
-- intentionally excluded, same reason documented in migrations
-- 000002/000005/000007: Employee.userId already has a FILTERED unique index
-- (WHERE userId IS NOT NULL) from migration 000001; the plain version would
-- fail/corrupt given multiple NULL userId rows.

-- AddForeignKey
ALTER TABLE [dbo].[PayrollRun] ADD CONSTRAINT [PayrollRun_companyId_fkey] FOREIGN KEY ([companyId]) REFERENCES [dbo].[Company]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[PayrollLine] ADD CONSTRAINT [PayrollLine_payrollRunId_fkey] FOREIGN KEY ([payrollRunId]) REFERENCES [dbo].[PayrollRun]([id]) ON DELETE NO ACTION ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE [dbo].[PayrollLine] ADD CONSTRAINT [PayrollLine_employeeId_fkey] FOREIGN KEY ([employeeId]) REFERENCES [dbo].[Employee]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[PayrollLineComponent] ADD CONSTRAINT [PayrollLineComponent_payrollLineId_fkey] FOREIGN KEY ([payrollLineId]) REFERENCES [dbo].[PayrollLine]([id]) ON DELETE NO ACTION ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE [dbo].[PayrollLineComponent] ADD CONSTRAINT [PayrollLineComponent_salaryComponentId_fkey] FOREIGN KEY ([salaryComponentId]) REFERENCES [dbo].[SalaryComponent]([id]) ON DELETE NO ACTION ON UPDATE CASCADE;

COMMIT TRAN;

END TRY
BEGIN CATCH

IF @@TRANCOUNT > 0
BEGIN
    ROLLBACK TRAN;
END;
THROW

END CATCH

