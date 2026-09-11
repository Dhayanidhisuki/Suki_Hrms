-- CreateTable: EmployeeBenefit
CREATE TABLE [dbo].[EmployeeBenefit] (
    [id] INT NOT NULL IDENTITY(1,1),
    [employeeId] INT NOT NULL,
    [benefitRateId] INT NOT NULL,
    [isActive] BIT NOT NULL CONSTRAINT [EmployeeBenefit_isActive_df] DEFAULT 1,
    [createdAt] DATETIME2 NOT NULL CONSTRAINT [EmployeeBenefit_createdAt_df] DEFAULT CURRENT_TIMESTAMP,
    [updatedAt] DATETIME2 NOT NULL,
    CONSTRAINT [EmployeeBenefit_pkey] PRIMARY KEY CLUSTERED ([id])
);

-- CreateIndex
CREATE NONCLUSTERED INDEX [EmployeeBenefit_employeeId_idx] ON [dbo].[EmployeeBenefit]([employeeId]);
CREATE NONCLUSTERED INDEX [EmployeeBenefit_benefitRateId_idx] ON [dbo].[EmployeeBenefit]([benefitRateId]);

-- AddForeignKey
ALTER TABLE [dbo].[EmployeeBenefit] ADD CONSTRAINT [EmployeeBenefit_employeeId_fkey] FOREIGN KEY ([employeeId]) REFERENCES [dbo].[Employee]([id]) ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE [dbo].[EmployeeBenefit] ADD CONSTRAINT [EmployeeBenefit_benefitRateId_fkey] FOREIGN KEY ([benefitRateId]) REFERENCES [dbo].[BenefitRateByEmployeeType]([id]) ON DELETE CASCADE ON UPDATE CASCADE;

-- Unique constraint
ALTER TABLE [dbo].[EmployeeBenefit] ADD CONSTRAINT [EmployeeBenefit_employeeId_benefitRateId_key] UNIQUE NONCLUSTERED ([employeeId], [benefitRateId]);
