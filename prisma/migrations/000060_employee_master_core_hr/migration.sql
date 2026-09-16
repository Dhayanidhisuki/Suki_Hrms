-- Employee Master / Core HR (Step 1, tranche 3): organisational hierarchy
-- completion (BusinessUnit, Location, CostCentre), employee code policy,
-- lifecycle transitions, dated reporting history, role x data-scope access.
-- Spec: docs/BRD/01 - Employee Master & Core HR - BRD.docx; schema section 20.
--
-- Additive only: 7 new tables, nullable columns on Employee, JobInfo, Unit,
-- Site and Grade, and their indexes. No existing column is altered or dropped.


-- AlterTable
ALTER TABLE [dbo].[Site] ADD [unitId] INT;

-- AlterTable
ALTER TABLE [dbo].[Unit] ADD [businessUnitId] INT;

-- AlterTable
ALTER TABLE [dbo].[Grade] ADD [defaultNoticeDays] INT;

-- AlterTable
ALTER TABLE [dbo].[Employee] ADD [lifecycleState] NVARCHAR(24),
[personUid] NVARCHAR(40);

-- AlterTable
ALTER TABLE [dbo].[JobInfo] ADD [changeReason] NVARCHAR(30),
[changeReference] NVARCHAR(60),
[costCentreId] INT,
[locationId] INT,
[noticePeriodDays] INT,
[noticePeriodSource] NVARCHAR(20);

-- CreateTable
CREATE TABLE [dbo].[BusinessUnit] (
    [id] INT NOT NULL IDENTITY(1,1),
    [companyId] INT NOT NULL,
    [code] NVARCHAR(20) NOT NULL,
    [name] NVARCHAR(100) NOT NULL,
    [headEmpId] INT,
    [description] NVARCHAR(500),
    [isActive] BIT NOT NULL CONSTRAINT [BusinessUnit_isActive_df] DEFAULT 1,
    [deletedAt] DATETIME2,
    [createdAt] DATETIME2 NOT NULL CONSTRAINT [BusinessUnit_createdAt_df] DEFAULT CURRENT_TIMESTAMP,
    [updatedAt] DATETIME2 NOT NULL,
    CONSTRAINT [BusinessUnit_pkey] PRIMARY KEY CLUSTERED ([id]),
    CONSTRAINT [BusinessUnit_companyId_code_key] UNIQUE NONCLUSTERED ([companyId],[code])
);

-- CreateTable
CREATE TABLE [dbo].[Location] (
    [id] INT NOT NULL IDENTITY(1,1),
    [companyId] INT NOT NULL,
    [siteId] INT,
    [code] NVARCHAR(20) NOT NULL,
    [name] NVARCHAR(100) NOT NULL,
    [locationType] NVARCHAR(20) NOT NULL CONSTRAINT [Location_locationType_df] DEFAULT 'PLANT',
    [address] NVARCHAR(500),
    [isActive] BIT NOT NULL CONSTRAINT [Location_isActive_df] DEFAULT 1,
    [deletedAt] DATETIME2,
    [createdAt] DATETIME2 NOT NULL CONSTRAINT [Location_createdAt_df] DEFAULT CURRENT_TIMESTAMP,
    [updatedAt] DATETIME2 NOT NULL,
    CONSTRAINT [Location_pkey] PRIMARY KEY CLUSTERED ([id]),
    CONSTRAINT [Location_companyId_code_key] UNIQUE NONCLUSTERED ([companyId],[code])
);

-- CreateTable
CREATE TABLE [dbo].[CostCentre] (
    [id] INT NOT NULL IDENTITY(1,1),
    [companyId] INT NOT NULL,
    [code] NVARCHAR(20) NOT NULL,
    [name] NVARCHAR(100) NOT NULL,
    [departmentId] INT,
    [ownerEmpId] INT,
    [description] NVARCHAR(500),
    [isActive] BIT NOT NULL CONSTRAINT [CostCentre_isActive_df] DEFAULT 1,
    [deletedAt] DATETIME2,
    [createdAt] DATETIME2 NOT NULL CONSTRAINT [CostCentre_createdAt_df] DEFAULT CURRENT_TIMESTAMP,
    [updatedAt] DATETIME2 NOT NULL,
    CONSTRAINT [CostCentre_pkey] PRIMARY KEY CLUSTERED ([id]),
    CONSTRAINT [CostCentre_companyId_code_key] UNIQUE NONCLUSTERED ([companyId],[code])
);

-- CreateTable
CREATE TABLE [dbo].[EmployeeCodePolicy] (
    [id] INT NOT NULL IDENTITY(1,1),
    [companyId] INT NOT NULL,
    [prefix] NVARCHAR(5) NOT NULL CONSTRAINT [EmployeeCodePolicy_prefix_df] DEFAULT 'EMP',
    [width] INT NOT NULL CONSTRAINT [EmployeeCodePolicy_width_df] DEFAULT 3,
    [nextSequence] INT NOT NULL CONSTRAINT [EmployeeCodePolicy_nextSequence_df] DEFAULT 1,
    [updatedAt] DATETIME2 NOT NULL,
    CONSTRAINT [EmployeeCodePolicy_pkey] PRIMARY KEY CLUSTERED ([id]),
    CONSTRAINT [EmployeeCodePolicy_companyId_key] UNIQUE NONCLUSTERED ([companyId])
);

-- CreateTable
CREATE TABLE [dbo].[EmployeeStateTransition] (
    [id] INT NOT NULL IDENTITY(1,1),
    [companyId] INT NOT NULL,
    [employeeId] INT NOT NULL,
    [fromState] NVARCHAR(24),
    [toState] NVARCHAR(24) NOT NULL,
    [trigger] NVARCHAR(40) NOT NULL,
    [effectiveDate] DATE NOT NULL,
    [reason] NVARCHAR(500),
    [referenceNo] NVARCHAR(60),
    [performedByUserId] INT,
    [createdAt] DATETIME2 NOT NULL CONSTRAINT [EmployeeStateTransition_createdAt_df] DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT [EmployeeStateTransition_pkey] PRIMARY KEY CLUSTERED ([id])
);

-- CreateTable
CREATE TABLE [dbo].[EmployeeReportingHistory] (
    [id] INT NOT NULL IDENTITY(1,1),
    [companyId] INT NOT NULL,
    [employeeId] INT NOT NULL,
    [primaryManagerId] INT,
    [secondaryManagerId] INT,
    [effectiveFrom] DATE NOT NULL,
    [effectiveTo] DATE,
    [changeReason] NVARCHAR(30),
    [createdByUserId] INT,
    [createdAt] DATETIME2 NOT NULL CONSTRAINT [EmployeeReportingHistory_createdAt_df] DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT [EmployeeReportingHistory_pkey] PRIMARY KEY CLUSTERED ([id])
);

-- CreateTable
CREATE TABLE [dbo].[UserScope] (
    [id] INT NOT NULL IDENTITY(1,1),
    [companyId] INT NOT NULL,
    [userId] INT NOT NULL,
    [scopeType] NVARCHAR(20) NOT NULL,
    [scopeValues] NVARCHAR(2000),
    [treeDepth] NVARCHAR(8),
    [isActive] BIT NOT NULL CONSTRAINT [UserScope_isActive_df] DEFAULT 1,
    [createdByUserId] INT,
    [createdAt] DATETIME2 NOT NULL CONSTRAINT [UserScope_createdAt_df] DEFAULT CURRENT_TIMESTAMP,
    [updatedAt] DATETIME2 NOT NULL,
    CONSTRAINT [UserScope_pkey] PRIMARY KEY CLUSTERED ([id])
);

-- CreateIndex
CREATE NONCLUSTERED INDEX [BusinessUnit_companyId_idx] ON [dbo].[BusinessUnit]([companyId]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [Location_companyId_idx] ON [dbo].[Location]([companyId]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [Location_siteId_idx] ON [dbo].[Location]([siteId]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [CostCentre_companyId_idx] ON [dbo].[CostCentre]([companyId]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [CostCentre_departmentId_idx] ON [dbo].[CostCentre]([departmentId]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [EmployeeStateTransition_employeeId_createdAt_idx] ON [dbo].[EmployeeStateTransition]([employeeId], [createdAt]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [EmployeeStateTransition_companyId_toState_idx] ON [dbo].[EmployeeStateTransition]([companyId], [toState]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [EmployeeReportingHistory_employeeId_effectiveFrom_idx] ON [dbo].[EmployeeReportingHistory]([employeeId], [effectiveFrom]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [EmployeeReportingHistory_primaryManagerId_idx] ON [dbo].[EmployeeReportingHistory]([primaryManagerId]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [UserScope_userId_isActive_idx] ON [dbo].[UserScope]([userId], [isActive]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [UserScope_companyId_idx] ON [dbo].[UserScope]([companyId]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [Site_unitId_idx] ON [dbo].[Site]([unitId]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [Unit_businessUnitId_idx] ON [dbo].[Unit]([businessUnitId]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [Employee_lifecycleState_idx] ON [dbo].[Employee]([lifecycleState]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [Employee_personUid_idx] ON [dbo].[Employee]([personUid]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [JobInfo_locationId_idx] ON [dbo].[JobInfo]([locationId]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [JobInfo_costCentreId_idx] ON [dbo].[JobInfo]([costCentreId]);

