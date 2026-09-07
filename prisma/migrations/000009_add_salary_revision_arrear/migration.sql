BEGIN TRY

BEGIN TRAN;

-- CreateTable
CREATE TABLE [dbo].[SalaryRevisionRequest] (
    [id] INT NOT NULL IDENTITY(1,1),
    [companyId] INT NOT NULL,
    [employeeId] INT NOT NULL,
    [revisionType] NVARCHAR(30) NOT NULL,
    [revisionMethod] NVARCHAR(20) NOT NULL,
    [currentGross] DECIMAL(18,2) NOT NULL,
    [incrementPercent] DECIMAL(7,2),
    [incrementAmount] DECIMAL(18,2),
    [revisedGross] DECIMAL(18,2) NOT NULL,
    [effectiveFrom] DATETIME2 NOT NULL,
    [status] NVARCHAR(20) NOT NULL CONSTRAINT [SalaryRevisionRequest_status_df] DEFAULT 'DRAFT',
    [holdReason] NVARCHAR(500),
    [rejectReason] NVARCHAR(500),
    [remarks] NVARCHAR(500),
    [appliedRevisionId] INT,
    [createdByUserId] INT,
    [approvedByUserId] INT,
    [approvedAt] DATETIME2,
    [createdAt] DATETIME2 NOT NULL CONSTRAINT [SalaryRevisionRequest_createdAt_df] DEFAULT CURRENT_TIMESTAMP,
    [updatedAt] DATETIME2 NOT NULL,
    CONSTRAINT [SalaryRevisionRequest_pkey] PRIMARY KEY CLUSTERED ([id]),
    CONSTRAINT [SalaryRevisionRequest_appliedRevisionId_key] UNIQUE NONCLUSTERED ([appliedRevisionId])
);

-- CreateTable
CREATE TABLE [dbo].[SalaryRevisionComponent] (
    [id] INT NOT NULL IDENTITY(1,1),
    [salaryRevisionRequestId] INT NOT NULL,
    [salaryComponentId] INT NOT NULL,
    [currentAmount] DECIMAL(18,2) NOT NULL,
    [revisedAmount] DECIMAL(18,2) NOT NULL,
    CONSTRAINT [SalaryRevisionComponent_pkey] PRIMARY KEY CLUSTERED ([id]),
    CONSTRAINT [SalaryRevisionComponent_salaryRevisionRequestId_salaryComponentId_key] UNIQUE NONCLUSTERED ([salaryRevisionRequestId],[salaryComponentId])
);

-- CreateTable
CREATE TABLE [dbo].[SalaryArrear] (
    [id] INT NOT NULL IDENTITY(1,1),
    [salaryRevisionRequestId] INT NOT NULL,
    [employeeId] INT NOT NULL,
    [companyId] INT NOT NULL,
    [oldGross] DECIMAL(18,2) NOT NULL,
    [revisedGross] DECIMAL(18,2) NOT NULL,
    [arrearFromYear] INT NOT NULL,
    [arrearFromMonth] INT NOT NULL,
    [arrearToYear] INT NOT NULL,
    [arrearToMonth] INT NOT NULL,
    [grossArrearTotal] DECIMAL(18,2) NOT NULL CONSTRAINT [SalaryArrear_grossArrearTotal_df] DEFAULT 0,
    [pfArrearTotal] DECIMAL(18,2) NOT NULL CONSTRAINT [SalaryArrear_pfArrearTotal_df] DEFAULT 0,
    [esiArrearTotal] DECIMAL(18,2) NOT NULL CONSTRAINT [SalaryArrear_esiArrearTotal_df] DEFAULT 0,
    [netArrearTotal] DECIMAL(18,2) NOT NULL CONSTRAINT [SalaryArrear_netArrearTotal_df] DEFAULT 0,
    [status] NVARCHAR(20) NOT NULL CONSTRAINT [SalaryArrear_status_df] DEFAULT 'CALCULATED',
    [calculatedAt] DATETIME2 NOT NULL CONSTRAINT [SalaryArrear_calculatedAt_df] DEFAULT CURRENT_TIMESTAMP,
    [appliedPayrollRunId] INT,
    [appliedAt] DATETIME2,
    [createdAt] DATETIME2 NOT NULL CONSTRAINT [SalaryArrear_createdAt_df] DEFAULT CURRENT_TIMESTAMP,
    [updatedAt] DATETIME2 NOT NULL,
    CONSTRAINT [SalaryArrear_pkey] PRIMARY KEY CLUSTERED ([id]),
    CONSTRAINT [SalaryArrear_salaryRevisionRequestId_key] UNIQUE NONCLUSTERED ([salaryRevisionRequestId])
);

-- CreateTable
CREATE TABLE [dbo].[SalaryArrearMonth] (
    [id] INT NOT NULL IDENTITY(1,1),
    [salaryArrearId] INT NOT NULL,
    [year] INT NOT NULL,
    [month] INT NOT NULL,
    [oldGross] DECIMAL(18,2) NOT NULL,
    [revisedGross] DECIMAL(18,2) NOT NULL,
    [grossDifference] DECIMAL(18,2) NOT NULL,
    [pfArrear] DECIMAL(18,2) NOT NULL CONSTRAINT [SalaryArrearMonth_pfArrear_df] DEFAULT 0,
    [esiArrear] DECIMAL(18,2) NOT NULL CONSTRAINT [SalaryArrearMonth_esiArrear_df] DEFAULT 0,
    [netArrear] DECIMAL(18,2) NOT NULL,
    CONSTRAINT [SalaryArrearMonth_pkey] PRIMARY KEY CLUSTERED ([id]),
    CONSTRAINT [SalaryArrearMonth_salaryArrearId_year_month_key] UNIQUE NONCLUSTERED ([salaryArrearId],[year],[month])
);

-- CreateIndex
CREATE NONCLUSTERED INDEX [SalaryRevisionRequest_companyId_status_idx] ON [dbo].[SalaryRevisionRequest]([companyId], [status]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [SalaryRevisionRequest_employeeId_idx] ON [dbo].[SalaryRevisionRequest]([employeeId]);

-- NOTE: `prisma migrate diff` also emitted `ALTER TABLE [dbo].[Employee] ADD
-- CONSTRAINT [Employee_userId_key] UNIQUE NONCLUSTERED ([userId])` here —
-- intentionally excluded, same reason documented in migrations
-- 000002/000005/000007/000008: Employee.userId already has a FILTERED
-- unique index (WHERE userId IS NOT NULL) from migration 000001; the plain
-- version would fail/corrupt given multiple NULL userId rows.

-- AddForeignKey
ALTER TABLE [dbo].[SalaryRevisionRequest] ADD CONSTRAINT [SalaryRevisionRequest_companyId_fkey] FOREIGN KEY ([companyId]) REFERENCES [dbo].[Company]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[SalaryRevisionRequest] ADD CONSTRAINT [SalaryRevisionRequest_employeeId_fkey] FOREIGN KEY ([employeeId]) REFERENCES [dbo].[Employee]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[SalaryRevisionRequest] ADD CONSTRAINT [SalaryRevisionRequest_appliedRevisionId_fkey] FOREIGN KEY ([appliedRevisionId]) REFERENCES [dbo].[EmployeeSalaryRevision]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[SalaryRevisionComponent] ADD CONSTRAINT [SalaryRevisionComponent_salaryRevisionRequestId_fkey] FOREIGN KEY ([salaryRevisionRequestId]) REFERENCES [dbo].[SalaryRevisionRequest]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[SalaryRevisionComponent] ADD CONSTRAINT [SalaryRevisionComponent_salaryComponentId_fkey] FOREIGN KEY ([salaryComponentId]) REFERENCES [dbo].[SalaryComponent]([id]) ON DELETE NO ACTION ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE [dbo].[SalaryArrear] ADD CONSTRAINT [SalaryArrear_salaryRevisionRequestId_fkey] FOREIGN KEY ([salaryRevisionRequestId]) REFERENCES [dbo].[SalaryRevisionRequest]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[SalaryArrear] ADD CONSTRAINT [SalaryArrear_employeeId_fkey] FOREIGN KEY ([employeeId]) REFERENCES [dbo].[Employee]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[SalaryArrear] ADD CONSTRAINT [SalaryArrear_companyId_fkey] FOREIGN KEY ([companyId]) REFERENCES [dbo].[Company]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[SalaryArrear] ADD CONSTRAINT [SalaryArrear_appliedPayrollRunId_fkey] FOREIGN KEY ([appliedPayrollRunId]) REFERENCES [dbo].[PayrollRun]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[SalaryArrearMonth] ADD CONSTRAINT [SalaryArrearMonth_salaryArrearId_fkey] FOREIGN KEY ([salaryArrearId]) REFERENCES [dbo].[SalaryArrear]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

COMMIT TRAN;

END TRY
BEGIN CATCH

IF @@TRANCOUNT > 0
BEGIN
    ROLLBACK TRAN;
END;
THROW

END CATCH
