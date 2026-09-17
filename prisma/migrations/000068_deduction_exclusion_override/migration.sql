ALTER TABLE [dbo].[EmployeeDeductionExclusion] ADD [excluded] BIT NOT NULL CONSTRAINT [DF_EmployeeDeductionExclusion_excluded] DEFAULT 1;
ALTER TABLE [dbo].[EmployeeDeductionExclusion] ADD [overrideAmount] DECIMAL(18,2) NULL;
ALTER TABLE [dbo].[EmployeeDeductionExclusion] ADD [updatedAt] DATETIME2 NOT NULL CONSTRAINT [DF_EmployeeDeductionExclusion_updatedAt] DEFAULT CURRENT_TIMESTAMP;
