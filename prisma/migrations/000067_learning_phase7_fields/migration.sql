-- Phase 7: BRD field completion — all additive (nullable/defaulted) columns
-- on existing Learning tables + new Skill master chain. Nothing dropped.

-- Trainer (BRD §18): employee link, expertise, certifications, rating, experience
ALTER TABLE [dbo].[Trainer] ADD [employeeId] INT NULL,
  [expertise] NVARCHAR(300) NULL,
  [certifications] NVARCHAR(500) NULL,
  [rating] DECIMAL(3,1) NULL,
  [experienceYears] INT NULL;

-- TrainingVenue (BRD §19): floor, building
ALTER TABLE [dbo].[TrainingVenue] ADD [floor] NVARCHAR(50) NULL,
  [building] NVARCHAR(100) NULL;

-- TrainingSchedule (BRD §17): min participants, target grade, mentor, materials,
-- requirement flags
ALTER TABLE [dbo].[TrainingSchedule] ADD [minParticipants] INT NULL,
  [targetGradeId] INT NULL,
  [mentorEmployeeId] INT NULL,
  [materials] NVARCHAR(500) NULL,
  [assessmentRequired] BIT NOT NULL CONSTRAINT [TrainingSchedule_assessmentRequired_df] DEFAULT 0,
  [feedbackRequired] BIT NOT NULL CONSTRAINT [TrainingSchedule_feedbackRequired_df] DEFAULT 0,
  [certificationRequired] BIT NOT NULL CONSTRAINT [TrainingSchedule_certificationRequired_df] DEFAULT 0;

-- TrainingNomination (BRD §20): nominating manager
ALTER TABLE [dbo].[TrainingNomination] ADD [managerEmployeeId] INT NULL;

-- TrainingFeedback (BRD §37): additional rating areas
ALTER TABLE [dbo].[TrainingFeedback] ADD [materialRating] INT NULL,
  [durationRating] INT NULL,
  [relevanceRating] INT NULL,
  [learningOutcomeRating] INT NULL;

-- TrainingBudget (BRD §34): location, category, approved amount
ALTER TABLE [dbo].[TrainingBudget] ADD [locationId] INT NULL,
  [category] NVARCHAR(50) NULL,
  [approvedAmount] DECIMAL(18,2) NULL;

-- TrainingPolicy (BRD §13): version control + applicability + approval
ALTER TABLE [dbo].[TrainingPolicy] ADD [policyNumber] NVARCHAR(30) NULL,
  [version] NVARCHAR(20) NULL,
  [applicableDepartmentId] INT NULL,
  [applicableLocationId] INT NULL,
  [applicableGroup] NVARCHAR(100) NULL,
  [approvalStatus] NVARCHAR(20) NOT NULL CONSTRAINT [TrainingPolicy_approvalStatus_df] DEFAULT 'DRAFT',
  [approvedByUserId] INT NULL,
  [approvedAt] DATETIME2 NULL,
  [attachmentPath] NVARCHAR(500) NULL;

-- QuestionBankGroup (BRD §25): pass mark, duration, random, negative marking, linkage
ALTER TABLE [dbo].[QuestionBankGroup] ADD [passMark] INT NULL,
  [durationMinutes] INT NULL,
  [randomQuestions] BIT NOT NULL CONSTRAINT [QuestionBankGroup_randomQuestions_df] DEFAULT 0,
  [negativeMarking] BIT NOT NULL CONSTRAINT [QuestionBankGroup_negativeMarking_df] DEFAULT 0,
  [competencyId] INT NULL,
  [gradeId] INT NULL;

-- QuestionBank (BRD §24): difficulty, explanation, competency link
ALTER TABLE [dbo].[QuestionBank] ADD [difficulty] NVARCHAR(20) NULL,
  [explanation] NVARCHAR(1000) NULL,
  [competencyId] INT NULL;

-- Assessment (BRD §26): max attempts
ALTER TABLE [dbo].[Assessment] ADD [maxAttempts] INT NOT NULL CONSTRAINT [Assessment_maxAttempts_df] DEFAULT 1;

-- AssessmentAttempt (BRD §26): re-attempt support + time taken
ALTER TABLE [dbo].[AssessmentAttempt] ADD [attemptNumber] INT NOT NULL CONSTRAINT [AssessmentAttempt_attemptNumber_df] DEFAULT 1,
  [timeTakenSeconds] INT NULL;

-- TrainingEffectiveness (BRD §28): evaluation stage + manager/L&D sections
ALTER TABLE [dbo].[TrainingEffectiveness] ADD [evaluationStage] NVARCHAR(10) NULL,
  [applicationOfLearning] INT NULL,
  [behavioralChange] INT NULL,
  [skillImprovement] INT NULL,
  [productivityImprovement] INT NULL,
  [qualityImprovement] INT NULL,
  [additionalTrainingRequired] BIT NOT NULL CONSTRAINT [TrainingEffectiveness_additionalTrainingRequired_df] DEFAULT 0,
  [trainingOutcome] NVARCHAR(500) NULL,
  [roiImpact] NVARCHAR(500) NULL,
  [recommendation] NVARCHAR(500) NULL,
  [followUpRequired] BIT NOT NULL CONSTRAINT [TrainingEffectiveness_followUpRequired_df] DEFAULT 0;

-- OjtAssignment (BRD §43): checklist, skills covered, observation, sign-off
ALTER TABLE [dbo].[OjtAssignment] ADD [checklistId] INT NULL,
  [skillsCovered] NVARCHAR(500) NULL,
  [observation] NVARCHAR(1000) NULL,
  [signOffByUserId] INT NULL,
  [signOffDate] DATE NULL;

-- InductionProgram (BRD §23): location scope + topics
ALTER TABLE [dbo].[InductionProgram] ADD [locationId] INT NULL,
  [topicsJson] NVARCHAR(MAX) NULL;

-- InductionAssignment (BRD §23): per-employee checklist + confirmation
ALTER TABLE [dbo].[InductionAssignment] ADD [checklistJson] NVARCHAR(MAX) NULL,
  [employeeConfirmed] BIT NOT NULL CONSTRAINT [InductionAssignment_employeeConfirmed_df] DEFAULT 0,
  [confirmedAt] DATETIME2 NULL;

-- Skill master chain (BRD §29, §47) — parallel to Competency chain
CREATE TABLE [dbo].[Skill] (
    [id] INT NOT NULL IDENTITY(1,1),
    [companyId] INT NOT NULL,
    [code] NVARCHAR(20) NULL,
    [name] NVARCHAR(100) NOT NULL,
    [category] NVARCHAR(50) NULL,
    [description] NVARCHAR(500) NULL,
    [isActive] BIT NOT NULL CONSTRAINT [Skill_isActive_df] DEFAULT 1,
    [deletedAt] DATETIME2 NULL,
    [createdAt] DATETIME2 NOT NULL CONSTRAINT [Skill_createdAt_df] DEFAULT CURRENT_TIMESTAMP,
    [updatedAt] DATETIME2 NOT NULL,
    CONSTRAINT [Skill_pkey] PRIMARY KEY CLUSTERED ([id])
);
CREATE NONCLUSTERED INDEX [Skill_companyId_category_idx] ON [dbo].[Skill]([companyId], [category]);

CREATE TABLE [dbo].[SkillRequirement] (
    [id] INT NOT NULL IDENTITY(1,1),
    [companyId] INT NOT NULL,
    [skillId] INT NOT NULL,
    [departmentId] INT NULL,
    [designationId] INT NULL,
    [gradeId] INT NULL,
    [requiredLevelId] INT NOT NULL,
    [isActive] BIT NOT NULL CONSTRAINT [SkillRequirement_isActive_df] DEFAULT 1,
    [deletedAt] DATETIME2 NULL,
    [createdAt] DATETIME2 NOT NULL CONSTRAINT [SkillRequirement_createdAt_df] DEFAULT CURRENT_TIMESTAMP,
    [updatedAt] DATETIME2 NOT NULL,
    CONSTRAINT [SkillRequirement_pkey] PRIMARY KEY CLUSTERED ([id]),
    CONSTRAINT [SkillRequirement_skillId_fkey] FOREIGN KEY ([skillId]) REFERENCES [dbo].[Skill]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION,
    CONSTRAINT [SkillRequirement_requiredLevelId_fkey] FOREIGN KEY ([requiredLevelId]) REFERENCES [dbo].[SkillLevel]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION
);
CREATE NONCLUSTERED INDEX [SkillRequirement_companyId_skillId_idx] ON [dbo].[SkillRequirement]([companyId], [skillId]);
CREATE NONCLUSTERED INDEX [SkillRequirement_companyId_departmentId_designationId_gradeId_idx] ON [dbo].[SkillRequirement]([companyId], [departmentId], [designationId], [gradeId]);

CREATE TABLE [dbo].[EmployeeSkillLevel] (
    [id] INT NOT NULL IDENTITY(1,1),
    [companyId] INT NOT NULL,
    [employeeId] INT NOT NULL,
    [skillId] INT NOT NULL,
    [currentLevelId] INT NOT NULL,
    [targetLevelId] INT NULL,
    [isActive] BIT NOT NULL CONSTRAINT [EmployeeSkillLevel_isActive_df] DEFAULT 1,
    [deletedAt] DATETIME2 NULL,
    [createdAt] DATETIME2 NOT NULL CONSTRAINT [EmployeeSkillLevel_createdAt_df] DEFAULT CURRENT_TIMESTAMP,
    [updatedAt] DATETIME2 NOT NULL,
    CONSTRAINT [EmployeeSkillLevel_pkey] PRIMARY KEY CLUSTERED ([id]),
    CONSTRAINT [EmployeeSkillLevel_skillId_fkey] FOREIGN KEY ([skillId]) REFERENCES [dbo].[Skill]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION,
    CONSTRAINT [EmployeeSkillLevel_currentLevelId_fkey] FOREIGN KEY ([currentLevelId]) REFERENCES [dbo].[SkillLevel]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION,
    CONSTRAINT [EmployeeSkillLevel_targetLevelId_fkey] FOREIGN KEY ([targetLevelId]) REFERENCES [dbo].[SkillLevel]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION
);
CREATE UNIQUE INDEX [EmployeeSkillLevel_companyId_employeeId_skillId_key] ON [dbo].[EmployeeSkillLevel]([companyId], [employeeId], [skillId]);
CREATE NONCLUSTERED INDEX [EmployeeSkillLevel_employeeId_idx] ON [dbo].[EmployeeSkillLevel]([employeeId]);
