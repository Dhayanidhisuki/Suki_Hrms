BEGIN TRY

BEGIN TRAN;

-- CreateTable
CREATE TABLE [dbo].[BonusRate] (
    [id] INT NOT NULL IDENTITY(1,1),
    [code] NVARCHAR(20) NOT NULL,
    [ratePercent] DECIMAL(5,2) NOT NULL,
    [minRatePercent] DECIMAL(5,2) NOT NULL,
    [maxRatePercent] DECIMAL(5,2) NOT NULL,
    [wageEligibilityCeiling] DECIMAL(18,2) NOT NULL,
    [calculationWageCeiling] DECIMAL(18,2) NOT NULL,
    [minWorkingDays] INT NOT NULL CONSTRAINT [BonusRate_minWorkingDays_df] DEFAULT 30,
    [effectiveFrom] DATETIME2 NOT NULL,
    [effectiveTo] DATETIME2,
    [isActive] BIT NOT NULL CONSTRAINT [BonusRate_isActive_df] DEFAULT 1,
    [createdAt] DATETIME2 NOT NULL CONSTRAINT [BonusRate_createdAt_df] DEFAULT CURRENT_TIMESTAMP,
    [updatedAt] DATETIME2 NOT NULL,
    CONSTRAINT [BonusRate_pkey] PRIMARY KEY CLUSTERED ([id])
);

-- CreateTable
CREATE TABLE [dbo].[BonusRecord] (
    [id] INT NOT NULL IDENTITY(1,1),
    [companyId] INT NOT NULL,
    [employeeId] INT NOT NULL,
    [acYear] INT NOT NULL,
    [currentGross] DECIMAL(18,2) NOT NULL,
    [currentBasic] DECIMAL(18,2) NOT NULL,
    [doj] DATETIME2 NOT NULL,
    [yearsOfService] DECIMAL(6,2) NOT NULL,
    [eligibilityStatus] NVARCHAR(30) NOT NULL,
    [eligibilityReason] NVARCHAR(500),
    [bonusPercent] DECIMAL(5,2),
    [bonusAmount] DECIMAL(18,2),
    [status] NVARCHAR(20) NOT NULL CONSTRAINT [BonusRecord_status_df] DEFAULT 'PENDING',
    [holdReason] NVARCHAR(500),
    [rejectReason] NVARCHAR(500),
    [remarks] NVARCHAR(500),
    [appliedPayrollRunId] INT,
    [appliedAt] DATETIME2,
    [calculatedAt] DATETIME2,
    [approvedByUserId] INT,
    [approvedAt] DATETIME2,
    [createdAt] DATETIME2 NOT NULL CONSTRAINT [BonusRecord_createdAt_df] DEFAULT CURRENT_TIMESTAMP,
    [updatedAt] DATETIME2 NOT NULL,
    CONSTRAINT [BonusRecord_pkey] PRIMARY KEY CLUSTERED ([id]),
    CONSTRAINT [BonusRecord_companyId_employeeId_acYear_key] UNIQUE NONCLUSTERED ([companyId],[employeeId],[acYear])
);

-- CreateIndex
CREATE NONCLUSTERED INDEX [BonusRate_effectiveFrom_effectiveTo_idx] ON [dbo].[BonusRate]([effectiveFrom], [effectiveTo]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [BonusRate_code_idx] ON [dbo].[BonusRate]([code]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [BonusRecord_companyId_acYear_status_idx] ON [dbo].[BonusRecord]([companyId], [acYear], [status]);

-- NOTE: `prisma migrate diff` also emitted two spurious plain UNIQUE
-- constraint lines here — intentionally excluded, same reason documented
-- repeatedly since migration 000002:
--   `ALTER TABLE [dbo].[Employee] ADD CONSTRAINT [Employee_userId_key]
--   UNIQUE NONCLUSTERED ([userId])` — Employee.userId already has a
--   FILTERED unique index (WHERE userId IS NOT NULL) from migration 000001.
--   `ALTER TABLE [dbo].[SalaryRevisionRequest] ADD CONSTRAINT
--   [SalaryRevisionRequest_appliedRevisionId_key] UNIQUE NONCLUSTERED
--   ([appliedRevisionId])` — already has a FILTERED unique index (WHERE
--   appliedRevisionId IS NOT NULL) from migration 000010, same reason.
-- Both plain versions would fail/corrupt given multiple NULL rows.

-- AddForeignKey
ALTER TABLE [dbo].[BonusRecord] ADD CONSTRAINT [BonusRecord_companyId_fkey] FOREIGN KEY ([companyId]) REFERENCES [dbo].[Company]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[BonusRecord] ADD CONSTRAINT [BonusRecord_employeeId_fkey] FOREIGN KEY ([employeeId]) REFERENCES [dbo].[Employee]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[BonusRecord] ADD CONSTRAINT [BonusRecord_appliedPayrollRunId_fkey] FOREIGN KEY ([appliedPayrollRunId]) REFERENCES [dbo].[PayrollRun]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

COMMIT TRAN;

END TRY
BEGIN CATCH

IF @@TRANCOUNT > 0
BEGIN
    ROLLBACK TRAN;
END;
THROW

END CATCH
