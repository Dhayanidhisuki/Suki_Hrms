-- Migration 000038: Refactor BenefitRateByEmployeeType to standalone benefit components

-- Drop dependent EmployeeBenefit first (we'll recreate it with the new structure)
DROP TABLE IF EXISTS [dbo].[EmployeeBenefit];

-- Drop child BenefitRateComponent table
DROP TABLE IF EXISTS [dbo].[BenefitRateComponent];

-- Recreate BenefitRateByEmployeeType with code/name instead of salaryComponentId
DROP TABLE IF EXISTS [dbo].[BenefitRateByEmployeeType];

CREATE TABLE [dbo].[BenefitRateByEmployeeType] (
    [id] INT NOT NULL IDENTITY(1,1),
    [companyId] INT NOT NULL,
    [code] NVARCHAR(20) NOT NULL,
    [name] NVARCHAR(100) NOT NULL,
    [employeeTypeId] INT NOT NULL,
    [amount] DECIMAL(18,2) NOT NULL,
    [isActive] BIT NOT NULL CONSTRAINT [BenefitRateByEmployeeType_isActive_df] DEFAULT 1,
    [createdAt] DATETIME2 NOT NULL CONSTRAINT [BenefitRateByEmployeeType_createdAt_df] DEFAULT CURRENT_TIMESTAMP,
    [updatedAt] DATETIME2 NOT NULL,
    CONSTRAINT [BenefitRateByEmployeeType_pkey] PRIMARY KEY CLUSTERED ([id])
);

CREATE NONCLUSTERED INDEX [BenefitRateByEmployeeType_companyId_idx] ON [dbo].[BenefitRateByEmployeeType]([companyId]);
CREATE NONCLUSTERED INDEX [BenefitRateByEmployeeType_employeeTypeId_idx] ON [dbo].[BenefitRateByEmployeeType]([employeeTypeId]);
ALTER TABLE [dbo].[BenefitRateByEmployeeType] ADD CONSTRAINT [BenefitRateByEmployeeType_companyId_code_key] UNIQUE NONCLUSTERED ([companyId], [code]);

ALTER TABLE [dbo].[BenefitRateByEmployeeType] ADD CONSTRAINT [BenefitRateByEmployeeType_companyId_fkey] FOREIGN KEY ([companyId]) REFERENCES [dbo].[Company]([id]) ON DELETE NO ACTION ON UPDATE CASCADE;
ALTER TABLE [dbo].[BenefitRateByEmployeeType] ADD CONSTRAINT [BenefitRateByEmployeeType_employeeTypeId_fkey] FOREIGN KEY ([employeeTypeId]) REFERENCES [dbo].[EmployeeType]([id]) ON DELETE NO ACTION ON UPDATE CASCADE;

-- Recreate EmployeeBenefit
CREATE TABLE [dbo].[EmployeeBenefit] (
    [id] INT NOT NULL IDENTITY(1,1),
    [employeeId] INT NOT NULL,
    [benefitRateId] INT NOT NULL,
    [isActive] BIT NOT NULL CONSTRAINT [EmployeeBenefit_isActive_df] DEFAULT 1,
    [createdAt] DATETIME2 NOT NULL CONSTRAINT [EmployeeBenefit_createdAt_df] DEFAULT CURRENT_TIMESTAMP,
    [updatedAt] DATETIME2 NOT NULL,
    CONSTRAINT [EmployeeBenefit_pkey] PRIMARY KEY CLUSTERED ([id])
);

CREATE NONCLUSTERED INDEX [EmployeeBenefit_employeeId_idx] ON [dbo].[EmployeeBenefit]([employeeId]);
CREATE NONCLUSTERED INDEX [EmployeeBenefit_benefitRateId_idx] ON [dbo].[EmployeeBenefit]([benefitRateId]);
ALTER TABLE [dbo].[EmployeeBenefit] ADD CONSTRAINT [EmployeeBenefit_employeeId_benefitRateId_key] UNIQUE NONCLUSTERED ([employeeId], [benefitRateId]);

ALTER TABLE [dbo].[EmployeeBenefit] ADD CONSTRAINT [EmployeeBenefit_employeeId_fkey] FOREIGN KEY ([employeeId]) REFERENCES [dbo].[Employee]([id]) ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE [dbo].[EmployeeBenefit] ADD CONSTRAINT [EmployeeBenefit_benefitRateId_fkey] FOREIGN KEY ([benefitRateId]) REFERENCES [dbo].[BenefitRateByEmployeeType]([id]) ON DELETE CASCADE ON UPDATE CASCADE;
