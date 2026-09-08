-- BenefitRateByEmployeeType + PmsIncentive: the "Employee Benefits &
-- Allowances" BRD section. Additive only. Written without the prisma-diff
-- TRY/CATCH wrapper because scripts/apply-migration.mjs splits on ';' and
-- runs statements one by one inside its own transaction.

BEGIN TRAN;

-- CreateTable
CREATE TABLE [dbo].[BenefitRateByEmployeeType] (
    [id] INT NOT NULL IDENTITY(1,1),
    [companyId] INT NOT NULL,
    [salaryComponentId] INT NOT NULL,
    [employeeTypeId] INT NOT NULL,
    [amount] DECIMAL(18, 2) NOT NULL,
    [isActive] BIT NOT NULL CONSTRAINT [BenefitRateByEmployeeType_isActive_df] DEFAULT 1,
    [createdAt] DATETIME2 NOT NULL CONSTRAINT [BenefitRateByEmployeeType_createdAt_df] DEFAULT CURRENT_TIMESTAMP,
    [updatedAt] DATETIME2 NOT NULL,
    CONSTRAINT [BenefitRateByEmployeeType_pkey] PRIMARY KEY CLUSTERED ([id]),
    CONSTRAINT [BenefitRateByEmployeeType_companyId_salaryComponentId_employeeTypeId_key] UNIQUE ([companyId], [salaryComponentId], [employeeTypeId])
);

-- CreateTable
CREATE TABLE [dbo].[PmsIncentive] (
    [id] INT NOT NULL IDENTITY(1,1),
    [employeeId] INT NOT NULL,
    [year] INT NOT NULL,
    [month] INT NOT NULL,
    [companyPercent] DECIMAL(5, 2) NOT NULL CONSTRAINT [PmsIncentive_companyPercent_df] DEFAULT 50,
    [managerPercent] DECIMAL(5, 2) NOT NULL,
    [totalPercent] DECIMAL(5, 2) NOT NULL,
    [status] NVARCHAR(20) NOT NULL CONSTRAINT [PmsIncentive_status_df] DEFAULT 'pending_manager',
    [managerActionByUserId] INT,
    [managerActionAt] DATETIME2,
    [hrActionByUserId] INT,
    [hrActionAt] DATETIME2,
    [rejectionReason] NVARCHAR(500),
    [createdAt] DATETIME2 NOT NULL CONSTRAINT [PmsIncentive_createdAt_df] DEFAULT CURRENT_TIMESTAMP,
    [updatedAt] DATETIME2 NOT NULL,
    CONSTRAINT [PmsIncentive_pkey] PRIMARY KEY CLUSTERED ([id]),
    CONSTRAINT [PmsIncentive_employeeId_year_month_key] UNIQUE ([employeeId], [year], [month])
);

-- AddForeignKey
ALTER TABLE [dbo].[BenefitRateByEmployeeType] ADD CONSTRAINT [BenefitRateByEmployeeType_companyId_fkey] FOREIGN KEY ([companyId]) REFERENCES [dbo].[Company]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;
ALTER TABLE [dbo].[BenefitRateByEmployeeType] ADD CONSTRAINT [BenefitRateByEmployeeType_salaryComponentId_fkey] FOREIGN KEY ([salaryComponentId]) REFERENCES [dbo].[SalaryComponent]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;
ALTER TABLE [dbo].[BenefitRateByEmployeeType] ADD CONSTRAINT [BenefitRateByEmployeeType_employeeTypeId_fkey] FOREIGN KEY ([employeeTypeId]) REFERENCES [dbo].[EmployeeType]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[PmsIncentive] ADD CONSTRAINT [PmsIncentive_employeeId_fkey] FOREIGN KEY ([employeeId]) REFERENCES [dbo].[Employee]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

COMMIT TRAN;
