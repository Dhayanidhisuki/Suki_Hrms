-- BRD remaining-field phases: §35 external linkage, §17 schedule mentor
-- details, §19 resource booking, §25 group links, §13 policy rule text,
-- §36 history columns, §9 method master, §30 job-role scope. All additive.

-- §35: provider link on external trainings.
ALTER TABLE [dbo].[ExternalTraining] ADD
    [providerId] INT NULL;

-- §35: real participant records for external trainings.
CREATE TABLE [dbo].[ExternalTrainingParticipant] (
    [id] INT NOT NULL IDENTITY(1,1),
    [companyId] INT NOT NULL,
    [externalTrainingId] INT NOT NULL,
    [employeeId] INT NOT NULL,
    [status] NVARCHAR(20) NOT NULL CONSTRAINT [ExternalTrainingParticipant_status_df] DEFAULT 'NOMINATED',
    [certificateId] INT NULL,
    [feedbackRating] INT NULL,
    [feedbackComments] NVARCHAR(1000) NULL,
    [effectivenessRating] NVARCHAR(20) NULL,
    [isActive] BIT NOT NULL CONSTRAINT [ExternalTrainingParticipant_isActive_df] DEFAULT 1,
    [deletedAt] DATETIME2 NULL,
    [createdAt] DATETIME2 NOT NULL CONSTRAINT [ExternalTrainingParticipant_createdAt_df] DEFAULT CURRENT_TIMESTAMP,
    [updatedAt] DATETIME2 NOT NULL,
    CONSTRAINT [ExternalTrainingParticipant_pkey] PRIMARY KEY CLUSTERED ([id] ASC)
);

CREATE UNIQUE NONCLUSTERED INDEX [ExternalTrainingParticipant_companyId_externalTrainingId_employeeId_key]
    ON [dbo].[ExternalTrainingParticipant]([companyId], [externalTrainingId], [employeeId]);

CREATE NONCLUSTERED INDEX [ExternalTrainingParticipant_companyId_employeeId_idx]
    ON [dbo].[ExternalTrainingParticipant]([companyId], [employeeId]);

-- §17: schedule-level mentor details + §19 booked resources.
ALTER TABLE [dbo].[TrainingSchedule] ADD
    [mentorId] INT NULL,
    [mentorRole] NVARCHAR(100) NULL,
    [mentorStartDate] DATE NULL,
    [mentorEndDate] DATE NULL,
    [mentorOutcome] NVARCHAR(300) NULL,
    [resourceIds] NVARCHAR(MAX) NULL;

-- §25: question group links to skill / proficiency / program.
ALTER TABLE [dbo].[QuestionBankGroup] ADD
    [skillId] INT NULL,
    [proficiencyLevelId] INT NULL,
    [trainingProgramId] INT NULL;

-- §13: policy rule text blocks.
ALTER TABLE [dbo].[TrainingPolicy] ADD
    [eligibilityRules] NVARCHAR(500) NULL,
    [nominationRules] NVARCHAR(500) NULL,
    [approvalHierarchy] NVARCHAR(500) NULL,
    [externalTrainingRules] NVARCHAR(500) NULL,
    [costPolicyRules] NVARCHAR(500) NULL,
    [certificationRules] NVARCHAR(500) NULL,
    [attendanceRules] NVARCHAR(500) NULL,
    [effectivenessRules] NVARCHAR(500) NULL,
    [validityRules] NVARCHAR(500) NULL,
    [refresherRules] NVARCHAR(500) NULL,
    [managerResponsibilities] NVARCHAR(500) NULL,
    [hrResponsibilities] NVARCHAR(500) NULL;

-- §36: training history completeness columns.
ALTER TABLE [dbo].[TrainingHistory] ADD
    [duration] DECIMAL(8,2) NULL,
    [cost] DECIMAL(18,2) NULL,
    [effectivenessRating] NVARCHAR(20) NULL;

-- §9: Training Method master.
CREATE TABLE [dbo].[TrainingMethod] (
    [id] INT NOT NULL IDENTITY(1,1),
    [companyId] INT NOT NULL,
    [code] NVARCHAR(20) NULL,
    [name] NVARCHAR(100) NOT NULL,
    [description] NVARCHAR(500) NULL,
    [delivery] NVARCHAR(20) NULL,
    [mode] NVARCHAR(20) NULL,
    [isActive] BIT NOT NULL CONSTRAINT [TrainingMethod_isActive_df] DEFAULT 1,
    [deletedAt] DATETIME2 NULL,
    [createdAt] DATETIME2 NOT NULL CONSTRAINT [TrainingMethod_createdAt_df] DEFAULT CURRENT_TIMESTAMP,
    [updatedAt] DATETIME2 NOT NULL,
    CONSTRAINT [TrainingMethod_pkey] PRIMARY KEY CLUSTERED ([id] ASC)
);

CREATE NONCLUSTERED INDEX [TrainingMethod_companyId_idx] ON [dbo].[TrainingMethod]([companyId]);

-- §30: job-role scope on requirement mappings.
ALTER TABLE [dbo].[CompetencyRequirement] ADD [jobRole] NVARCHAR(100) NULL;
ALTER TABLE [dbo].[SkillRequirement] ADD [jobRole] NVARCHAR(100) NULL;
