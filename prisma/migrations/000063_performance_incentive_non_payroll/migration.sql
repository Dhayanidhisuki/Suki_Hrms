-- Adds the NON_PAYROLL gross tier (documented only; grossTier stays a plain
-- NVARCHAR column, no DB-level change needed for that) plus two new tables:
-- EmployeeCtcComponent (CTC-only component+amount rows per CTC revision) and
-- PerformanceIncentivePercent (Workforce > Performance Incentive % entry).
-- Additive only.

-- CreateTable
CREATE TABLE [dbo].[EmployeeCtcComponent] (
    [id] INT NOT NULL IDENTITY(1,1),
    [employeeCtcId] INT NOT NULL,
    [salaryComponentId] INT NOT NULL,
    [amount] DECIMAL(18,2) NOT NULL,
    CONSTRAINT [EmployeeCtcComponent_pkey] PRIMARY KEY CLUSTERED ([id]),
    CONSTRAINT [EmployeeCtcComponent_employeeCtcId_salaryComponentId_key] UNIQUE NONCLUSTERED ([employeeCtcId],[salaryComponentId])
);

-- CreateTable
CREATE TABLE [dbo].[PerformanceIncentivePercent] (
    [id] INT NOT NULL IDENTITY(1,1),
    [companyId] INT NOT NULL,
    [employeeId] INT NOT NULL,
    [year] INT NOT NULL,
    [month] INT NOT NULL,
    [percent] DECIMAL(5,2) NOT NULL,
    [createdAt] DATETIME2 NOT NULL CONSTRAINT [PerformanceIncentivePercent_createdAt_df] DEFAULT CURRENT_TIMESTAMP,
    [updatedAt] DATETIME2 NOT NULL,
    CONSTRAINT [PerformanceIncentivePercent_pkey] PRIMARY KEY CLUSTERED ([id]),
    CONSTRAINT [PerformanceIncentivePercent_employeeId_year_month_key] UNIQUE NONCLUSTERED ([employeeId],[year],[month])
);

-- CreateIndex
CREATE NONCLUSTERED INDEX [PerformanceIncentivePercent_companyId_year_month_idx] ON [dbo].[PerformanceIncentivePercent]([companyId], [year], [month]);

-- AddForeignKey
ALTER TABLE [dbo].[EmployeeCtcComponent] ADD CONSTRAINT [EmployeeCtcComponent_employeeCtcId_fkey] FOREIGN KEY ([employeeCtcId]) REFERENCES [dbo].[EmployeeCtc]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[EmployeeCtcComponent] ADD CONSTRAINT [EmployeeCtcComponent_salaryComponentId_fkey] FOREIGN KEY ([salaryComponentId]) REFERENCES [dbo].[SalaryComponent]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;
