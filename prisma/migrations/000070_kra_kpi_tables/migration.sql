-- The four models the merged schema declares but no migration ever created:
-- the recruitment migration only DROPs them, it never creates them.
--
-- Additive only. Nothing here drops a table, a column or a constraint — the
-- rest of that generated delta did, and was deliberately left out (see
-- WORKLOG). `id` carries no IDENTITY because the schema declares these as
-- `id Int @id` with no @default(autoincrement()); adding IDENTITY here would
-- make Prisma inserts fail, since it would supply the id itself.

CREATE TABLE [dbo].[EmployeeKraCycle] (
    [id] INT NOT NULL,
    [companyId] INT NOT NULL,
    [employeeId] INT NOT NULL,
    [financialYear] NVARCHAR(9) NOT NULL,
    [periodLabel] NVARCHAR(20) NOT NULL,
    [status] NVARCHAR(20) NOT NULL,
    [overallScore] DECIMAL(6,2),
    [managerRemark] NVARCHAR(1000),
    [submittedAt] DATETIME2,
    [lockedAt] DATETIME2,
    [createdAt] DATETIME2 NOT NULL CONSTRAINT [EmployeeKraCycle_createdAt_df] DEFAULT CURRENT_TIMESTAMP,
    [updatedAt] DATETIME2 NOT NULL CONSTRAINT [EmployeeKraCycle_updatedAt_df] DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT [EmployeeKraCycle_pkey] PRIMARY KEY CLUSTERED ([id])
);

CREATE TABLE [dbo].[EmployeeKraLine] (
    [id] INT NOT NULL,
    [cycleId] INT NOT NULL,
    [kpiTemplateId] INT,
    [goalId] INT,
    [name] NVARCHAR(200) NOT NULL,
    [weightage] DECIMAL(5,2) NOT NULL,
    [targetValue] NVARCHAR(100),
    [actualValue] NVARCHAR(100),
    [score] DECIMAL(6,2),
    [maxScore] DECIMAL(6,2) NOT NULL,
    [createdAt] DATETIME2 NOT NULL CONSTRAINT [EmployeeKraLine_createdAt_df] DEFAULT CURRENT_TIMESTAMP,
    [updatedAt] DATETIME2 NOT NULL CONSTRAINT [EmployeeKraLine_updatedAt_df] DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT [EmployeeKraLine_pkey] PRIMARY KEY CLUSTERED ([id])
);

CREATE TABLE [dbo].[KpiGoal] (
    [id] INT NOT NULL,
    [companyId] INT NOT NULL,
    [name] NVARCHAR(200) NOT NULL,
    [measurementCriteria] NVARCHAR(500) NOT NULL,
    [monitoringFrequency] NVARCHAR(20) NOT NULL,
    [reportingFrequency] NVARCHAR(20) NOT NULL,
    [responsibility] NVARCHAR(200),
    [condition] NVARCHAR(200),
    [targetValue] NVARCHAR(100),
    [isActive] BIT NOT NULL,
    [createdAt] DATETIME2 NOT NULL CONSTRAINT [KpiGoal_createdAt_df] DEFAULT CURRENT_TIMESTAMP,
    [updatedAt] DATETIME2 NOT NULL CONSTRAINT [KpiGoal_updatedAt_df] DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT [KpiGoal_pkey] PRIMARY KEY CLUSTERED ([id])
);

CREATE TABLE [dbo].[KpiTemplate] (
    [id] INT NOT NULL,
    [companyId] INT NOT NULL,
    [code] NVARCHAR(30) NOT NULL,
    [kpiFor] NVARCHAR(20) NOT NULL,
    [departmentId] INT,
    [designationId] INT,
    [criteria] NVARCHAR(500) NOT NULL,
    [targetValue] NVARCHAR(100),
    [kpiType] NVARCHAR(20) NOT NULL,
    [required] BIT NOT NULL,
    [isActive] BIT NOT NULL,
    [createdAt] DATETIME2 NOT NULL CONSTRAINT [KpiTemplate_createdAt_df] DEFAULT CURRENT_TIMESTAMP,
    [updatedAt] DATETIME2 NOT NULL CONSTRAINT [KpiTemplate_updatedAt_df] DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT [KpiTemplate_pkey] PRIMARY KEY CLUSTERED ([id])
);

CREATE NONCLUSTERED INDEX [EmployeeKraCycle_companyId_employeeId_financialYear_periodLabel_idx] ON [dbo].[EmployeeKraCycle]([companyId], [employeeId], [financialYear], [periodLabel]);

CREATE NONCLUSTERED INDEX [EmployeeKraCycle_companyId_status_idx] ON [dbo].[EmployeeKraCycle]([companyId], [status]);

CREATE NONCLUSTERED INDEX [EmployeeKraLine_cycleId_idx] ON [dbo].[EmployeeKraLine]([cycleId]);

CREATE NONCLUSTERED INDEX [KpiGoal_companyId_isActive_idx] ON [dbo].[KpiGoal]([companyId], [isActive]);

CREATE NONCLUSTERED INDEX [KpiTemplate_companyId_code_idx] ON [dbo].[KpiTemplate]([companyId], [code]);

CREATE NONCLUSTERED INDEX [KpiTemplate_companyId_kpiFor_idx] ON [dbo].[KpiTemplate]([companyId], [kpiFor]);
