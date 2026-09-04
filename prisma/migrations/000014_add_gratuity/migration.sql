BEGIN TRY

BEGIN TRAN;

-- AlterTable
ALTER TABLE [dbo].[SalaryComponent] ADD [includeInGratuity] BIT NOT NULL CONSTRAINT [SalaryComponent_includeInGratuity_df] DEFAULT 0;

-- CreateTable
CREATE TABLE [dbo].[GratuityPolicy] (
    [id] INT NOT NULL IDENTITY(1,1),
    [companyId] INT NOT NULL,
    [code] NVARCHAR(20) NOT NULL,
    [policyName] NVARCHAR(100) NOT NULL,
    [multiplierNumerator] DECIMAL(5,2) NOT NULL CONSTRAINT [GratuityPolicy_multiplierNumerator_df] DEFAULT 15,
    [multiplierDenominator] DECIMAL(5,2) NOT NULL CONSTRAINT [GratuityPolicy_multiplierDenominator_df] DEFAULT 26,
    [minEligibleServiceYears] DECIMAL(5,2) NOT NULL CONSTRAINT [GratuityPolicy_minEligibleServiceYears_df] DEFAULT 5,
    [maxGratuityCeiling] DECIMAL(18,2) NOT NULL,
    [effectiveFrom] DATETIME2 NOT NULL,
    [effectiveTo] DATETIME2,
    [isActive] BIT NOT NULL CONSTRAINT [GratuityPolicy_isActive_df] DEFAULT 1,
    [createdAt] DATETIME2 NOT NULL CONSTRAINT [GratuityPolicy_createdAt_df] DEFAULT CURRENT_TIMESTAMP,
    [updatedAt] DATETIME2 NOT NULL,
    CONSTRAINT [GratuityPolicy_pkey] PRIMARY KEY CLUSTERED ([id])
);

-- CreateTable
CREATE TABLE [dbo].[GratuityRecord] (
    [id] INT NOT NULL IDENTITY(1,1),
    [companyId] INT NOT NULL,
    [employeeId] INT NOT NULL,
    [exitInterviewId] INT NOT NULL,
    [doj] DATETIME2 NOT NULL,
    [separationDate] DATETIME2 NOT NULL,
    [qualifyingServiceYears] DECIMAL(6,2) NOT NULL,
    [eligibilityStatus] NVARCHAR(30) NOT NULL,
    [eligibilityReason] NVARCHAR(500),
    [eligibleSalary] DECIMAL(18,2),
    [multiplierNumerator] DECIMAL(5,2),
    [multiplierDenominator] DECIMAL(5,2),
    [grossGratuity] DECIMAL(18,2),
    [payableGratuity] DECIMAL(18,2),
    [status] NVARCHAR(20) NOT NULL CONSTRAINT [GratuityRecord_status_df] DEFAULT 'CALCULATED',
    [holdReason] NVARCHAR(500),
    [rejectReason] NVARCHAR(500),
    [remarks] NVARCHAR(500),
    [paymentDate] DATETIME2,
    [paymentReference] NVARCHAR(100),
    [calculatedAt] DATETIME2 NOT NULL CONSTRAINT [GratuityRecord_calculatedAt_df] DEFAULT CURRENT_TIMESTAMP,
    [approvedByUserId] INT,
    [approvedAt] DATETIME2,
    [createdAt] DATETIME2 NOT NULL CONSTRAINT [GratuityRecord_createdAt_df] DEFAULT CURRENT_TIMESTAMP,
    [updatedAt] DATETIME2 NOT NULL,
    CONSTRAINT [GratuityRecord_pkey] PRIMARY KEY CLUSTERED ([id]),
    CONSTRAINT [GratuityRecord_exitInterviewId_key] UNIQUE NONCLUSTERED ([exitInterviewId])
);

-- CreateIndex
CREATE NONCLUSTERED INDEX [GratuityPolicy_companyId_effectiveFrom_effectiveTo_idx] ON [dbo].[GratuityPolicy]([companyId], [effectiveFrom], [effectiveTo]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [GratuityPolicy_code_idx] ON [dbo].[GratuityPolicy]([code]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [GratuityRecord_companyId_status_idx] ON [dbo].[GratuityRecord]([companyId], [status]);

-- NOTE: `prisma migrate diff` also emitted two spurious plain UNIQUE
-- constraint lines here — intentionally excluded, same reason documented
-- repeatedly since migration 000002 (Employee_userId_key has a FILTERED
-- unique index from migration 000001; SalaryRevisionRequest_appliedRevisionId_key
-- has one from migration 000010 — both because most rows sit at NULL and
-- SQL Server's plain UNIQUE only allows one NULL).

-- AddForeignKey
ALTER TABLE [dbo].[GratuityPolicy] ADD CONSTRAINT [GratuityPolicy_companyId_fkey] FOREIGN KEY ([companyId]) REFERENCES [dbo].[Company]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[GratuityRecord] ADD CONSTRAINT [GratuityRecord_companyId_fkey] FOREIGN KEY ([companyId]) REFERENCES [dbo].[Company]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[GratuityRecord] ADD CONSTRAINT [GratuityRecord_employeeId_fkey] FOREIGN KEY ([employeeId]) REFERENCES [dbo].[Employee]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[GratuityRecord] ADD CONSTRAINT [GratuityRecord_exitInterviewId_fkey] FOREIGN KEY ([exitInterviewId]) REFERENCES [dbo].[ExitInterview]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

COMMIT TRAN;

END TRY
BEGIN CATCH

IF @@TRANCOUNT > 0
BEGIN
    ROLLBACK TRAN;
END;
THROW

END CATCH
