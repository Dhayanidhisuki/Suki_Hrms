-- Performance Incentive BRD: company-level config + richer employee rows.
-- Additive only; follows the project's migration convention of BEGIN/COMMIT
-- with the custom apply-migration script splitting on ';'.

BEGIN TRAN;

-- CreateTable
CREATE TABLE [dbo].[PmsIncentiveConfig] (
    [id] INT NOT NULL IDENTITY(1,1),
    [companyId] INT NOT NULL,
    [financialYear] NVARCHAR(10) NOT NULL,
    [effectiveFrom] DATETIME2 NOT NULL,
    [effectiveTo] DATETIME2 NOT NULL,
    [calculationBasis] NVARCHAR(30) NOT NULL CONSTRAINT [PmsIncentiveConfig_calculationBasis_df] DEFAULT 'basic',
    [salaryComponentId] INT NULL,
    [incentiveType] NVARCHAR(20) NOT NULL CONSTRAINT [PmsIncentiveConfig_incentiveType_df] DEFAULT 'percentage',
    [companyPercent] DECIMAL(5, 2) NOT NULL CONSTRAINT [PmsIncentiveConfig_companyPercent_df] DEFAULT 0,
    [companyValue] DECIMAL(18, 2) NULL,
    [targetIncentiveAmount] DECIMAL(18, 2) NULL,
    [remarks] NVARCHAR(500) NULL,
    [status] NVARCHAR(20) NOT NULL CONSTRAINT [PmsIncentiveConfig_status_df] DEFAULT 'active',
    [createdByUserId] INT NULL,
    [updatedByUserId] INT NULL,
    [createdAt] DATETIME2 NOT NULL CONSTRAINT [PmsIncentiveConfig_createdAt_df] DEFAULT CURRENT_TIMESTAMP,
    [updatedAt] DATETIME2 NOT NULL,
    CONSTRAINT [PmsIncentiveConfig_pkey] PRIMARY KEY CLUSTERED ([id]),
    CONSTRAINT [PmsIncentiveConfig_companyId_financialYear_key] UNIQUE ([companyId], [financialYear])
);

-- AlterTable — widen PmsIncentive for the BRD fields
ALTER TABLE [dbo].[PmsIncentive] DROP CONSTRAINT [PmsIncentive_companyPercent_df];
ALTER TABLE [dbo].[PmsIncentive] DROP CONSTRAINT [PmsIncentive_status_df];

ALTER TABLE [dbo].[PmsIncentive] ADD
    [configId] INT NULL,
    [financialYear] NVARCHAR(10) NULL,
    [calculationBasis] NVARCHAR(30) NULL,
    [salaryComponentId] INT NULL,
    [incentiveType] NVARCHAR(20) NOT NULL CONSTRAINT [PmsIncentive_incentiveType_df] DEFAULT 'percentage',
    [basisAmount] DECIMAL(18, 2) NOT NULL CONSTRAINT [PmsIncentive_basisAmount_df] DEFAULT 0,
    [companyValue] DECIMAL(18, 2) NULL,
    [individualValue] DECIMAL(18, 2) NULL,
    [companyAmount] DECIMAL(18, 2) NOT NULL CONSTRAINT [PmsIncentive_companyAmount_df] DEFAULT 0,
    [individualAmount] DECIMAL(18, 2) NOT NULL CONSTRAINT [PmsIncentive_individualAmount_df] DEFAULT 0,
    [overallAmount] DECIMAL(18, 2) NOT NULL CONSTRAINT [PmsIncentive_overallAmount_df] DEFAULT 0,
    [supportingFileName] NVARCHAR(200) NULL,
    [supportingFilePath] NVARCHAR(500) NULL,
    [remarks] NVARCHAR(500) NULL;

ALTER TABLE [dbo].[PmsIncentive] ADD CONSTRAINT [PmsIncentive_companyPercent_df] DEFAULT 0 FOR [companyPercent];
ALTER TABLE [dbo].[PmsIncentive] ADD CONSTRAINT [PmsIncentive_managerPercent_df] DEFAULT 0 FOR [managerPercent];
ALTER TABLE [dbo].[PmsIncentive] ADD CONSTRAINT [PmsIncentive_totalPercent_df] DEFAULT 0 FOR [totalPercent];
ALTER TABLE [dbo].[PmsIncentive] ADD CONSTRAINT [PmsIncentive_status_df] DEFAULT 'draft' FOR [status];

-- Indexes
CREATE INDEX [PmsIncentive_configId_idx] ON [dbo].[PmsIncentive]([configId]);
CREATE INDEX [PmsIncentive_status_idx] ON [dbo].[PmsIncentive]([status]);

-- Foreign keys
ALTER TABLE [dbo].[PmsIncentiveConfig] ADD CONSTRAINT [PmsIncentiveConfig_companyId_fkey] FOREIGN KEY ([companyId]) REFERENCES [dbo].[Company]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;
ALTER TABLE [dbo].[PmsIncentiveConfig] ADD CONSTRAINT [PmsIncentiveConfig_salaryComponentId_fkey] FOREIGN KEY ([salaryComponentId]) REFERENCES [dbo].[SalaryComponent]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;
ALTER TABLE [dbo].[PmsIncentive] ADD CONSTRAINT [PmsIncentive_configId_fkey] FOREIGN KEY ([configId]) REFERENCES [dbo].[PmsIncentiveConfig]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;
ALTER TABLE [dbo].[PmsIncentive] ADD CONSTRAINT [PmsIncentive_salaryComponentId_fkey] FOREIGN KEY ([salaryComponentId]) REFERENCES [dbo].[SalaryComponent]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

COMMIT TRAN;
