-- CreateTable
CREATE TABLE [dbo].[SkillLevel] (
    [id] INT NOT NULL IDENTITY(1,1),
    [companyId] INT NOT NULL,
    [levelNumber] INT NOT NULL,
    [name] NVARCHAR(50) NOT NULL,
    [description] NVARCHAR(500),
    [color] NVARCHAR(7),
    [isActive] BIT NOT NULL CONSTRAINT [SkillLevel_isActive_df] DEFAULT 1,
    [deletedAt] DATETIME2,
    [createdAt] DATETIME2 NOT NULL CONSTRAINT [SkillLevel_createdAt_df] DEFAULT CURRENT_TIMESTAMP,
    [updatedAt] DATETIME2 NOT NULL,
    CONSTRAINT [SkillLevel_pkey] PRIMARY KEY CLUSTERED ([id]),
    CONSTRAINT [SkillLevel_companyId_levelNumber_key] UNIQUE NONCLUSTERED ([companyId],[levelNumber])
);

-- CreateTable
CREATE TABLE [dbo].[Competency] (
    [id] INT NOT NULL IDENTITY(1,1),
    [companyId] INT NOT NULL,
    [code] NVARCHAR(20),
    [name] NVARCHAR(100) NOT NULL,
    [category] NVARCHAR(50) NOT NULL,
    [type] NVARCHAR(50),
    [description] NVARCHAR(500),
    [isActive] BIT NOT NULL CONSTRAINT [Competency_isActive_df] DEFAULT 1,
    [deletedAt] DATETIME2,
    [createdAt] DATETIME2 NOT NULL CONSTRAINT [Competency_createdAt_df] DEFAULT CURRENT_TIMESTAMP,
    [updatedAt] DATETIME2 NOT NULL,
    CONSTRAINT [Competency_pkey] PRIMARY KEY CLUSTERED ([id])
);

-- CreateTable
CREATE TABLE [dbo].[CompetencyRequirement] (
    [id] INT NOT NULL IDENTITY(1,1),
    [companyId] INT NOT NULL,
    [competencyId] INT NOT NULL,
    [departmentId] INT,
    [designationId] INT,
    [gradeId] INT,
    [requiredLevelId] INT NOT NULL,
    [isActive] BIT NOT NULL CONSTRAINT [CompetencyRequirement_isActive_df] DEFAULT 1,
    [deletedAt] DATETIME2,
    [createdAt] DATETIME2 NOT NULL CONSTRAINT [CompetencyRequirement_createdAt_df] DEFAULT CURRENT_TIMESTAMP,
    [updatedAt] DATETIME2 NOT NULL,
    CONSTRAINT [CompetencyRequirement_pkey] PRIMARY KEY CLUSTERED ([id])
);

-- CreateTable
CREATE TABLE [dbo].[EmployeeCompetency] (
    [id] INT NOT NULL IDENTITY(1,1),
    [companyId] INT NOT NULL,
    [employeeId] INT NOT NULL,
    [competencyId] INT NOT NULL,
    [currentLevelId] INT NOT NULL,
    [targetLevelId] INT,
    [certificationNumber] NVARCHAR(50),
    [certifiedDate] DATETIME2,
    [expiryDate] DATETIME2,
    [isActive] BIT NOT NULL CONSTRAINT [EmployeeCompetency_isActive_df] DEFAULT 1,
    [deletedAt] DATETIME2,
    [createdAt] DATETIME2 NOT NULL CONSTRAINT [EmployeeCompetency_createdAt_df] DEFAULT CURRENT_TIMESTAMP,
    [updatedAt] DATETIME2 NOT NULL,
    CONSTRAINT [EmployeeCompetency_pkey] PRIMARY KEY CLUSTERED ([id]),
    CONSTRAINT [EmployeeCompetency_companyId_employeeId_competencyId_key] UNIQUE NONCLUSTERED ([companyId],[employeeId],[competencyId])
);

-- CreateTable
CREATE TABLE [dbo].[TrainingProgram] (
    [id] INT NOT NULL IDENTITY(1,1),
    [companyId] INT NOT NULL,
    [code] NVARCHAR(20),
    [name] NVARCHAR(100) NOT NULL,
    [category] NVARCHAR(50),
    [type] NVARCHAR(50),
    [objective] NVARCHAR(500),
    [learningOutcome] NVARCHAR(500),
    [targetAudience] NVARCHAR(200),
    [method] NVARCHAR(50),
    [duration] DECIMAL(8,2),
    [durationUnit] NVARCHAR(20) CONSTRAINT [TrainingProgram_durationUnit_df] DEFAULT 'HOURS',
    [assessmentRequired] BIT NOT NULL CONSTRAINT [TrainingProgram_assessmentRequired_df] DEFAULT 0,
    [certificationRequired] BIT NOT NULL CONSTRAINT [TrainingProgram_certificationRequired_df] DEFAULT 0,
    [validityMonths] INT,
    [refresherFrequency] NVARCHAR(50),
    [estimatedCost] DECIMAL(18,2),
    [isActive] BIT NOT NULL CONSTRAINT [TrainingProgram_isActive_df] DEFAULT 1,
    [deletedAt] DATETIME2,
    [createdAt] DATETIME2 NOT NULL CONSTRAINT [TrainingProgram_createdAt_df] DEFAULT CURRENT_TIMESTAMP,
    [updatedAt] DATETIME2 NOT NULL,
    CONSTRAINT [TrainingProgram_pkey] PRIMARY KEY CLUSTERED ([id])
);

-- CreateTable
CREATE TABLE [dbo].[Trainer] (
    [id] INT NOT NULL IDENTITY(1,1),
    [companyId] INT NOT NULL,
    [name] NVARCHAR(100) NOT NULL,
    [email] NVARCHAR(100),
    [phone] NVARCHAR(20),
    [isExternal] BIT NOT NULL CONSTRAINT [Trainer_isExternal_df] DEFAULT 0,
    [vendor] NVARCHAR(100),
    [commercialRate] DECIMAL(18,2),
    [contractDetails] NVARCHAR(500),
    [isActive] BIT NOT NULL CONSTRAINT [Trainer_isActive_df] DEFAULT 1,
    [deletedAt] DATETIME2,
    [createdAt] DATETIME2 NOT NULL CONSTRAINT [Trainer_createdAt_df] DEFAULT CURRENT_TIMESTAMP,
    [updatedAt] DATETIME2 NOT NULL,
    CONSTRAINT [Trainer_pkey] PRIMARY KEY CLUSTERED ([id])
);

-- CreateTable
CREATE TABLE [dbo].[TrainingVenue] (
    [id] INT NOT NULL IDENTITY(1,1),
    [companyId] INT NOT NULL,
    [name] NVARCHAR(100) NOT NULL,
    [capacity] INT,
    [location] NVARCHAR(200),
    [equipment] NVARCHAR(500),
    [isActive] BIT NOT NULL CONSTRAINT [TrainingVenue_isActive_df] DEFAULT 1,
    [deletedAt] DATETIME2,
    [createdAt] DATETIME2 NOT NULL CONSTRAINT [TrainingVenue_createdAt_df] DEFAULT CURRENT_TIMESTAMP,
    [updatedAt] DATETIME2 NOT NULL,
    CONSTRAINT [TrainingVenue_pkey] PRIMARY KEY CLUSTERED ([id])
);

-- CreateTable
CREATE TABLE [dbo].[TrainingPlan] (
    [id] INT NOT NULL IDENTITY(1,1),
    [companyId] INT NOT NULL,
    [year] NVARCHAR(9) NOT NULL,
    [departmentId] INT,
    [title] NVARCHAR(200),
    [status] NVARCHAR(20) NOT NULL CONSTRAINT [TrainingPlan_status_df] DEFAULT 'DRAFT',
    [totalEstimatedCost] DECIMAL(18,2),
    [totalApprovedBudget] DECIMAL(18,2),
    [approvedByUserId] INT,
    [approvedAt] DATETIME2,
    [isActive] BIT NOT NULL CONSTRAINT [TrainingPlan_isActive_df] DEFAULT 1,
    [deletedAt] DATETIME2,
    [createdAt] DATETIME2 NOT NULL CONSTRAINT [TrainingPlan_createdAt_df] DEFAULT CURRENT_TIMESTAMP,
    [updatedAt] DATETIME2 NOT NULL,
    CONSTRAINT [TrainingPlan_pkey] PRIMARY KEY CLUSTERED ([id])
);

-- CreateTable
CREATE TABLE [dbo].[TrainingPlanLine] (
    [id] INT NOT NULL IDENTITY(1,1),
    [companyId] INT NOT NULL,
    [trainingPlanId] INT NOT NULL,
    [competencyId] INT,
    [plannedMonth] INT NOT NULL,
    [trainingProgramId] INT NOT NULL,
    [trainerId] INT,
    [trainingMethod] NVARCHAR(50),
    [duration] DECIMAL(8,2),
    [durationUnit] NVARCHAR(20) CONSTRAINT [TrainingPlanLine_durationUnit_df] DEFAULT 'HOURS',
    [participantCount] INT,
    [targetEmployeeIds] NVARCHAR(max),
    [estimatedCost] DECIMAL(18,2),
    [approvedAmount] DECIMAL(18,2),
    [priority] NVARCHAR(20) CONSTRAINT [TrainingPlanLine_priority_df] DEFAULT 'MEDIUM',
    [isMandatory] BIT NOT NULL CONSTRAINT [TrainingPlanLine_isMandatory_df] DEFAULT 0,
    [expectedOutcome] NVARCHAR(500),
    [status] NVARCHAR(20) NOT NULL CONSTRAINT [TrainingPlanLine_status_df] DEFAULT 'DRAFT',
    [tnaReference] NVARCHAR(100),
    [isActive] BIT NOT NULL CONSTRAINT [TrainingPlanLine_isActive_df] DEFAULT 1,
    [deletedAt] DATETIME2,
    [createdAt] DATETIME2 NOT NULL CONSTRAINT [TrainingPlanLine_createdAt_df] DEFAULT CURRENT_TIMESTAMP,
    [updatedAt] DATETIME2 NOT NULL,
    CONSTRAINT [TrainingPlanLine_pkey] PRIMARY KEY CLUSTERED ([id])
);

-- CreateTable
CREATE TABLE [dbo].[TrainingSchedule] (
    [id] INT NOT NULL IDENTITY(1,1),
    [companyId] INT NOT NULL,
    [trainingPlanLineId] INT,
    [trainingProgramId] INT NOT NULL,
    [title] NVARCHAR(200),
    [scheduledDate] DATE,
    [startTime] NVARCHAR(8),
    [endTime] NVARCHAR(8),
    [duration] DECIMAL(8,2),
    [durationUnit] NVARCHAR(20) CONSTRAINT [TrainingSchedule_durationUnit_df] DEFAULT 'HOURS',
    [method] NVARCHAR(50),
    [venueId] INT,
    [meetingLink] NVARCHAR(500),
    [trainerId] INT,
    [coTrainerId] INT,
    [coordinator] NVARCHAR(100),
    [maxParticipants] INT,
    [targetDepartmentId] INT,
    [targetEmployeeIds] NVARCHAR(max),
    [status] NVARCHAR(20) NOT NULL CONSTRAINT [TrainingSchedule_status_df] DEFAULT 'PENDING',
    [isActive] BIT NOT NULL CONSTRAINT [TrainingSchedule_isActive_df] DEFAULT 1,
    [deletedAt] DATETIME2,
    [createdAt] DATETIME2 NOT NULL CONSTRAINT [TrainingSchedule_createdAt_df] DEFAULT CURRENT_TIMESTAMP,
    [updatedAt] DATETIME2 NOT NULL,
    CONSTRAINT [TrainingSchedule_pkey] PRIMARY KEY CLUSTERED ([id])
);

-- CreateIndex
CREATE NONCLUSTERED INDEX [SkillLevel_companyId_idx] ON [dbo].[SkillLevel]([companyId]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [Competency_companyId_category_idx] ON [dbo].[Competency]([companyId], [category]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [CompetencyRequirement_companyId_competencyId_idx] ON [dbo].[CompetencyRequirement]([companyId], [competencyId]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [CompetencyRequirement_companyId_departmentId_designationId_gradeId_idx] ON [dbo].[CompetencyRequirement]([companyId], [departmentId], [designationId], [gradeId]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [EmployeeCompetency_employeeId_idx] ON [dbo].[EmployeeCompetency]([employeeId]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [TrainingProgram_companyId_category_idx] ON [dbo].[TrainingProgram]([companyId], [category]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [Trainer_companyId_idx] ON [dbo].[Trainer]([companyId]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [TrainingVenue_companyId_idx] ON [dbo].[TrainingVenue]([companyId]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [TrainingPlan_companyId_year_idx] ON [dbo].[TrainingPlan]([companyId], [year]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [TrainingPlan_companyId_departmentId_idx] ON [dbo].[TrainingPlan]([companyId], [departmentId]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [TrainingPlanLine_companyId_trainingPlanId_idx] ON [dbo].[TrainingPlanLine]([companyId], [trainingPlanId]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [TrainingPlanLine_companyId_plannedMonth_idx] ON [dbo].[TrainingPlanLine]([companyId], [plannedMonth]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [TrainingSchedule_companyId_scheduledDate_idx] ON [dbo].[TrainingSchedule]([companyId], [scheduledDate]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [TrainingSchedule_companyId_status_idx] ON [dbo].[TrainingSchedule]([companyId], [status]);
