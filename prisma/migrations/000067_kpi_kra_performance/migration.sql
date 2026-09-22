-- KPI/KRA Performance Management — BRD v1.0 §7-§9, §17, §41.
--
-- Drops the earlier ERP port from 000064 (KpiTemplate / KpiGoal /
-- EmployeeKraCycle / EmployeeKraLine): it had no KRA entity, KPIs were not
-- tied to a KRA, there was no measurement type and no weightage validation,
-- so it could not be extended into the BRD shape. 000064's letter and
-- recruitment tables are untouched.

IF OBJECT_ID(N'[EmployeeKraLine]', N'U') IS NOT NULL DROP TABLE [EmployeeKraLine];
IF OBJECT_ID(N'[EmployeeKraCycle]', N'U') IS NOT NULL DROP TABLE [EmployeeKraCycle];
IF OBJECT_ID(N'[KpiGoal]', N'U') IS NOT NULL DROP TABLE [KpiGoal];
IF OBJECT_ID(N'[KpiTemplate]', N'U') IS NOT NULL DROP TABLE [KpiTemplate];

-- ── BRD §7. Performance cycle ────────────────────────────────────────────────
IF OBJECT_ID(N'[PerformanceCycle]', N'U') IS NULL
BEGIN
  CREATE TABLE [PerformanceCycle] (
    [id] INT NOT NULL IDENTITY(1,1),
    [companyId] INT NOT NULL,
    [code] NVARCHAR(30) NOT NULL,
    [name] NVARCHAR(150) NOT NULL,
    [cycleType] NVARCHAR(20) NOT NULL CONSTRAINT [DF_PerformanceCycle_cycleType] DEFAULT 'ANNUAL',
    [startDate] DATE NOT NULL,
    [endDate] DATE NOT NULL,
    [goalSettingStart] DATE NOT NULL,
    [goalSettingEnd] DATE NOT NULL,
    [status] NVARCHAR(20) NOT NULL CONSTRAINT [DF_PerformanceCycle_status] DEFAULT 'DRAFT',
    [createdAt] DATETIME2 NOT NULL CONSTRAINT [DF_PerformanceCycle_createdAt] DEFAULT CURRENT_TIMESTAMP,
    [updatedAt] DATETIME2 NOT NULL,
    CONSTRAINT [PerformanceCycle_pkey] PRIMARY KEY CLUSTERED ([id]),
    CONSTRAINT [PerformanceCycle_companyId_code_key] UNIQUE ([companyId], [code])
  );
  CREATE INDEX [PerformanceCycle_companyId_status_idx] ON [PerformanceCycle]([companyId], [status]);
END;

-- ── BRD §8. KRA master ───────────────────────────────────────────────────────
IF OBJECT_ID(N'[Kra]', N'U') IS NULL
BEGIN
  CREATE TABLE [Kra] (
    [id] INT NOT NULL IDENTITY(1,1),
    [companyId] INT NOT NULL,
    [code] NVARCHAR(30) NOT NULL,
    [name] NVARCHAR(150) NOT NULL,
    [description] NVARCHAR(1000) NOT NULL,
    [departmentId] INT NULL,
    [designationId] INT NULL,
    [jobRole] NVARCHAR(100) NULL,
    [category] NVARCHAR(50) NOT NULL,
    [defaultWeightage] DECIMAL(5,2) NULL,
    [status] NVARCHAR(20) NOT NULL CONSTRAINT [DF_Kra_status] DEFAULT 'ACTIVE',
    [effectiveFrom] DATE NOT NULL,
    [effectiveTo] DATE NULL,
    [createdAt] DATETIME2 NOT NULL CONSTRAINT [DF_Kra_createdAt] DEFAULT CURRENT_TIMESTAMP,
    [updatedAt] DATETIME2 NOT NULL,
    CONSTRAINT [Kra_pkey] PRIMARY KEY CLUSTERED ([id]),
    CONSTRAINT [Kra_companyId_code_key] UNIQUE ([companyId], [code])
  );
  CREATE INDEX [Kra_companyId_status_idx] ON [Kra]([companyId], [status]);
  CREATE INDEX [Kra_companyId_departmentId_designationId_idx] ON [Kra]([companyId], [departmentId], [designationId]);
END;

-- ── BRD §9. KPI master ───────────────────────────────────────────────────────
IF OBJECT_ID(N'[Kpi]', N'U') IS NULL
BEGIN
  CREATE TABLE [Kpi] (
    [id] INT NOT NULL IDENTITY(1,1),
    [companyId] INT NOT NULL,
    [kraId] INT NOT NULL,
    [code] NVARCHAR(30) NOT NULL,
    [name] NVARCHAR(150) NOT NULL,
    [description] NVARCHAR(1000) NOT NULL,
    [measurementType] NVARCHAR(30) NOT NULL,
    [unit] NVARCHAR(30) NOT NULL,
    [target] DECIMAL(18,4) NOT NULL,
    [minThreshold] DECIMAL(18,4) NULL,
    [maxTarget] DECIMAL(18,4) NULL,
    [weightage] DECIMAL(5,2) NOT NULL,
    [frequency] NVARCHAR(20) NOT NULL,
    [dataSource] NVARCHAR(150) NULL,
    [status] NVARCHAR(20) NOT NULL CONSTRAINT [DF_Kpi_status] DEFAULT 'ACTIVE',
    [createdAt] DATETIME2 NOT NULL CONSTRAINT [DF_Kpi_createdAt] DEFAULT CURRENT_TIMESTAMP,
    [updatedAt] DATETIME2 NOT NULL,
    CONSTRAINT [Kpi_pkey] PRIMARY KEY CLUSTERED ([id]),
    CONSTRAINT [Kpi_companyId_code_key] UNIQUE ([companyId], [code]),
    CONSTRAINT [Kpi_kraId_fkey] FOREIGN KEY ([kraId]) REFERENCES [Kra]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION
  );
  CREATE INDEX [Kpi_companyId_kraId_idx] ON [Kpi]([companyId], [kraId]);
  CREATE INDEX [Kpi_companyId_status_idx] ON [Kpi]([companyId], [status]);
END;

-- ── Goal templates (header → KRA → KPI, Model A) ─────────────────────────────
IF OBJECT_ID(N'[GoalTemplate]', N'U') IS NULL
BEGIN
  CREATE TABLE [GoalTemplate] (
    [id] INT NOT NULL IDENTITY(1,1),
    [companyId] INT NOT NULL,
    [code] NVARCHAR(30) NOT NULL,
    [name] NVARCHAR(150) NOT NULL,
    [description] NVARCHAR(1000) NULL,
    [departmentId] INT NULL,
    [designationId] INT NULL,
    [status] NVARCHAR(20) NOT NULL CONSTRAINT [DF_GoalTemplate_status] DEFAULT 'ACTIVE',
    [createdAt] DATETIME2 NOT NULL CONSTRAINT [DF_GoalTemplate_createdAt] DEFAULT CURRENT_TIMESTAMP,
    [updatedAt] DATETIME2 NOT NULL,
    CONSTRAINT [GoalTemplate_pkey] PRIMARY KEY CLUSTERED ([id]),
    CONSTRAINT [GoalTemplate_companyId_code_key] UNIQUE ([companyId], [code])
  );
  CREATE INDEX [GoalTemplate_companyId_status_idx] ON [GoalTemplate]([companyId], [status]);
  CREATE INDEX [GoalTemplate_companyId_departmentId_designationId_idx] ON [GoalTemplate]([companyId], [departmentId], [designationId]);
END;

IF OBJECT_ID(N'[GoalTemplateKra]', N'U') IS NULL
BEGIN
  CREATE TABLE [GoalTemplateKra] (
    [id] INT NOT NULL IDENTITY(1,1),
    [templateId] INT NOT NULL,
    [kraId] INT NOT NULL,
    [weightage] DECIMAL(5,2) NOT NULL,
    CONSTRAINT [GoalTemplateKra_pkey] PRIMARY KEY CLUSTERED ([id]),
    CONSTRAINT [GoalTemplateKra_templateId_kraId_key] UNIQUE ([templateId], [kraId]),
    CONSTRAINT [GoalTemplateKra_templateId_fkey] FOREIGN KEY ([templateId]) REFERENCES [GoalTemplate]([id]) ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT [GoalTemplateKra_kraId_fkey] FOREIGN KEY ([kraId]) REFERENCES [Kra]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION
  );
  CREATE INDEX [GoalTemplateKra_kraId_idx] ON [GoalTemplateKra]([kraId]);
END;

IF OBJECT_ID(N'[GoalTemplateKpi]', N'U') IS NULL
BEGIN
  CREATE TABLE [GoalTemplateKpi] (
    [id] INT NOT NULL IDENTITY(1,1),
    [templateKraId] INT NOT NULL,
    [kpiId] INT NOT NULL,
    [target] DECIMAL(18,4) NOT NULL,
    [weightage] DECIMAL(5,2) NOT NULL,
    CONSTRAINT [GoalTemplateKpi_pkey] PRIMARY KEY CLUSTERED ([id]),
    CONSTRAINT [GoalTemplateKpi_templateKraId_kpiId_key] UNIQUE ([templateKraId], [kpiId]),
    CONSTRAINT [GoalTemplateKpi_templateKraId_fkey] FOREIGN KEY ([templateKraId]) REFERENCES [GoalTemplateKra]([id]) ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT [GoalTemplateKpi_kpiId_fkey] FOREIGN KEY ([kpiId]) REFERENCES [Kpi]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION
  );
  CREATE INDEX [GoalTemplateKpi_kpiId_idx] ON [GoalTemplateKpi]([kpiId]);
END;

-- ── BRD §17. Employee goal assignment ────────────────────────────────────────
IF OBJECT_ID(N'[EmployeeGoalSet]', N'U') IS NULL
BEGIN
  CREATE TABLE [EmployeeGoalSet] (
    [id] INT NOT NULL IDENTITY(1,1),
    [companyId] INT NOT NULL,
    [employeeId] INT NOT NULL,
    [cycleId] INT NOT NULL,
    [templateId] INT NULL,
    [status] NVARCHAR(30) NOT NULL CONSTRAINT [DF_EmployeeGoalSet_status] DEFAULT 'DRAFT',
    [assignedByUserId] INT NULL,
    [submittedAt] DATETIME2 NULL,
    [acceptedAt] DATETIME2 NULL,
    [returnedAt] DATETIME2 NULL,
    [employeeRemark] NVARCHAR(1000) NULL,
    [createdAt] DATETIME2 NOT NULL CONSTRAINT [DF_EmployeeGoalSet_createdAt] DEFAULT CURRENT_TIMESTAMP,
    [updatedAt] DATETIME2 NOT NULL,
    CONSTRAINT [EmployeeGoalSet_pkey] PRIMARY KEY CLUSTERED ([id]),
    CONSTRAINT [EmployeeGoalSet_companyId_employeeId_cycleId_key] UNIQUE ([companyId], [employeeId], [cycleId]),
    CONSTRAINT [EmployeeGoalSet_cycleId_fkey] FOREIGN KEY ([cycleId]) REFERENCES [PerformanceCycle]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION
  );
  CREATE INDEX [EmployeeGoalSet_companyId_status_idx] ON [EmployeeGoalSet]([companyId], [status]);
  CREATE INDEX [EmployeeGoalSet_companyId_employeeId_idx] ON [EmployeeGoalSet]([companyId], [employeeId]);
END;

IF OBJECT_ID(N'[EmployeeGoalKra]', N'U') IS NULL
BEGIN
  CREATE TABLE [EmployeeGoalKra] (
    [id] INT NOT NULL IDENTITY(1,1),
    [goalSetId] INT NOT NULL,
    [kraId] INT NOT NULL,
    [weightage] DECIMAL(5,2) NOT NULL,
    CONSTRAINT [EmployeeGoalKra_pkey] PRIMARY KEY CLUSTERED ([id]),
    CONSTRAINT [EmployeeGoalKra_goalSetId_kraId_key] UNIQUE ([goalSetId], [kraId]),
    CONSTRAINT [EmployeeGoalKra_goalSetId_fkey] FOREIGN KEY ([goalSetId]) REFERENCES [EmployeeGoalSet]([id]) ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT [EmployeeGoalKra_kraId_fkey] FOREIGN KEY ([kraId]) REFERENCES [Kra]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION
  );
  CREATE INDEX [EmployeeGoalKra_kraId_idx] ON [EmployeeGoalKra]([kraId]);
END;

IF OBJECT_ID(N'[EmployeeGoalKpi]', N'U') IS NULL
BEGIN
  CREATE TABLE [EmployeeGoalKpi] (
    [id] INT NOT NULL IDENTITY(1,1),
    [goalKraId] INT NOT NULL,
    [kpiId] INT NOT NULL,
    [description] NVARCHAR(1000) NOT NULL,
    [measurementType] NVARCHAR(30) NOT NULL,
    [unit] NVARCHAR(30) NOT NULL,
    [target] DECIMAL(18,4) NOT NULL,
    [minThreshold] DECIMAL(18,4) NULL,
    [maxTarget] DECIMAL(18,4) NULL,
    [weightage] DECIMAL(5,2) NOT NULL,
    [startDate] DATE NOT NULL,
    [endDate] DATE NOT NULL,
    [frequency] NVARCHAR(20) NOT NULL,
    [evidenceRequired] BIT NOT NULL CONSTRAINT [DF_EmployeeGoalKpi_evidenceRequired] DEFAULT 0,
    [employeeComments] NVARCHAR(1000) NULL,
    [managerComments] NVARCHAR(1000) NULL,
    [createdAt] DATETIME2 NOT NULL CONSTRAINT [DF_EmployeeGoalKpi_createdAt] DEFAULT CURRENT_TIMESTAMP,
    [updatedAt] DATETIME2 NOT NULL,
    CONSTRAINT [EmployeeGoalKpi_pkey] PRIMARY KEY CLUSTERED ([id]),
    CONSTRAINT [EmployeeGoalKpi_goalKraId_kpiId_key] UNIQUE ([goalKraId], [kpiId]),
    CONSTRAINT [EmployeeGoalKpi_goalKraId_fkey] FOREIGN KEY ([goalKraId]) REFERENCES [EmployeeGoalKra]([id]) ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT [EmployeeGoalKpi_kpiId_fkey] FOREIGN KEY ([kpiId]) REFERENCES [Kpi]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION
  );
  CREATE INDEX [EmployeeGoalKpi_kpiId_idx] ON [EmployeeGoalKpi]([kpiId]);
END;
