-- Phase 3: Assessment & Training Effectiveness (BRD §24-28)
-- All additive. No FK into Employee/User — only scalar employeeId/userId.

BEGIN TRY

BEGIN TRAN;

-- CreateTable: QuestionBankGroup (§24)
CREATE TABLE [dbo].[QuestionBankGroup] (
    [id] INT NOT NULL IDENTITY(1,1),
    [companyId] INT NOT NULL,
    [name] NVARCHAR(200) NOT NULL,
    [description] NVARCHAR(500),
    [isActive] BIT NOT NULL CONSTRAINT [QuestionBankGroup_isActive_df] DEFAULT 1,
    [deletedAt] DATETIME2,
    [createdAt] DATETIME2 NOT NULL CONSTRAINT [QuestionBankGroup_createdAt_df] DEFAULT CURRENT_TIMESTAMP,
    [updatedAt] DATETIME2 NOT NULL,
    CONSTRAINT [QuestionBankGroup_pkey] PRIMARY KEY CLUSTERED ([id])
);

CREATE NONCLUSTERED INDEX [QuestionBankGroup_companyId_idx] ON [dbo].[QuestionBankGroup]([companyId]);

-- CreateTable: QuestionBank (§24)
CREATE TABLE [dbo].[QuestionBank] (
    [id] INT NOT NULL IDENTITY(1,1),
    [companyId] INT NOT NULL,
    [groupId] INT,
    [question] NVARCHAR(1000) NOT NULL,
    [questionType] NVARCHAR(20) CONSTRAINT [QuestionBank_questionType_df] DEFAULT 'MCQ',
    [options] NVARCHAR(max),
    [correctAnswer] NVARCHAR(500),
    [maxScore] INT NOT NULL CONSTRAINT [QuestionBank_maxScore_df] DEFAULT 1,
    [isActive] BIT NOT NULL CONSTRAINT [QuestionBank_isActive_df] DEFAULT 1,
    [deletedAt] DATETIME2,
    [createdAt] DATETIME2 NOT NULL CONSTRAINT [QuestionBank_createdAt_df] DEFAULT CURRENT_TIMESTAMP,
    [updatedAt] DATETIME2 NOT NULL,
    CONSTRAINT [QuestionBank_pkey] PRIMARY KEY CLUSTERED ([id])
);

ALTER TABLE [dbo].[QuestionBank]
    ADD CONSTRAINT [QuestionBank_groupId_fkey]
    FOREIGN KEY ([groupId]) REFERENCES [dbo].[QuestionBankGroup]([id])
    ON DELETE NO ACTION;

CREATE NONCLUSTERED INDEX [QuestionBank_companyId_groupId_idx] ON [dbo].[QuestionBank]([companyId], [groupId]);

-- CreateTable: Assessment (§26)
CREATE TABLE [dbo].[Assessment] (
    [id] INT NOT NULL IDENTITY(1,1),
    [companyId] INT NOT NULL,
    [trainingProgramId] INT,
    [trainingScheduleId] INT,
    [title] NVARCHAR(200) NOT NULL,
    [description] NVARCHAR(500),
    [assessmentType] NVARCHAR(20) CONSTRAINT [Assessment_assessmentType_df] DEFAULT 'POST',
    [passingScore] INT NOT NULL CONSTRAINT [Assessment_passingScore_df] DEFAULT 70,
    [durationMinutes] INT,
    [questionIds] NVARCHAR(max),
    [isActive] BIT NOT NULL CONSTRAINT [Assessment_isActive_df] DEFAULT 1,
    [deletedAt] DATETIME2,
    [createdAt] DATETIME2 NOT NULL CONSTRAINT [Assessment_createdAt_df] DEFAULT CURRENT_TIMESTAMP,
    [updatedAt] DATETIME2 NOT NULL,
    CONSTRAINT [Assessment_pkey] PRIMARY KEY CLUSTERED ([id])
);

CREATE NONCLUSTERED INDEX [Assessment_companyId_trainingProgramId_idx] ON [dbo].[Assessment]([companyId], [trainingProgramId]);
CREATE NONCLUSTERED INDEX [Assessment_companyId_trainingScheduleId_idx] ON [dbo].[Assessment]([companyId], [trainingScheduleId]);

-- CreateTable: AssessmentAttempt (§26)
CREATE TABLE [dbo].[AssessmentAttempt] (
    [id] INT NOT NULL IDENTITY(1,1),
    [companyId] INT NOT NULL,
    [assessmentId] INT NOT NULL,
    [employeeId] INT NOT NULL,
    [answersJson] NVARCHAR(max),
    [totalScore] INT NOT NULL CONSTRAINT [AssessmentAttempt_totalScore_df] DEFAULT 0,
    [maxScore] INT NOT NULL CONSTRAINT [AssessmentAttempt_maxScore_df] DEFAULT 0,
    [scorePercent] INT NOT NULL CONSTRAINT [AssessmentAttempt_scorePercent_df] DEFAULT 0,
    [result] NVARCHAR(20) NOT NULL CONSTRAINT [AssessmentAttempt_result_df] DEFAULT 'INCOMPLETE',
    [startedAt] DATETIME2 NOT NULL CONSTRAINT [AssessmentAttempt_startedAt_df] DEFAULT CURRENT_TIMESTAMP,
    [submittedAt] DATETIME2,
    [isActive] BIT NOT NULL CONSTRAINT [AssessmentAttempt_isActive_df] DEFAULT 1,
    [deletedAt] DATETIME2,
    [createdAt] DATETIME2 NOT NULL CONSTRAINT [AssessmentAttempt_createdAt_df] DEFAULT CURRENT_TIMESTAMP,
    [updatedAt] DATETIME2 NOT NULL,
    CONSTRAINT [AssessmentAttempt_pkey] PRIMARY KEY CLUSTERED ([id])
);

ALTER TABLE [dbo].[AssessmentAttempt]
    ADD CONSTRAINT [AssessmentAttempt_assessmentId_fkey]
    FOREIGN KEY ([assessmentId]) REFERENCES [dbo].[Assessment]([id])
    ON DELETE CASCADE;

CREATE UNIQUE NONCLUSTERED INDEX [AssessmentAttempt_companyId_assessmentId_employeeId_key]
    ON [dbo].[AssessmentAttempt]([companyId], [assessmentId], [employeeId]);

CREATE NONCLUSTERED INDEX [AssessmentAttempt_companyId_employeeId_idx]
    ON [dbo].[AssessmentAttempt]([companyId], [employeeId]);

-- CreateTable: TrainingEffectiveness (§27-28)
CREATE TABLE [dbo].[TrainingEffectiveness] (
    [id] INT NOT NULL IDENTITY(1,1),
    [companyId] INT NOT NULL,
    [trainingScheduleId] INT NOT NULL,
    [employeeId] INT NOT NULL,
    [preScore] INT,
    [postScore] INT,
    [scoreImprovement] INT,
    [level1Reaction] INT,
    [level2Learning] INT,
    [level3Behavior] INT,
    [level4Results] INT,
    [effectivenessRating] NVARCHAR(20),
    [evaluationDate] DATE,
    [remarks] NVARCHAR(500),
    [isActive] BIT NOT NULL CONSTRAINT [TrainingEffectiveness_isActive_df] DEFAULT 1,
    [deletedAt] DATETIME2,
    [createdAt] DATETIME2 NOT NULL CONSTRAINT [TrainingEffectiveness_createdAt_df] DEFAULT CURRENT_TIMESTAMP,
    [updatedAt] DATETIME2 NOT NULL,
    CONSTRAINT [TrainingEffectiveness_pkey] PRIMARY KEY CLUSTERED ([id])
);

CREATE UNIQUE NONCLUSTERED INDEX [TrainingEffectiveness_companyId_trainingScheduleId_employeeId_key]
    ON [dbo].[TrainingEffectiveness]([companyId], [trainingScheduleId], [employeeId]);

CREATE NONCLUSTERED INDEX [TrainingEffectiveness_companyId_trainingScheduleId_idx]
    ON [dbo].[TrainingEffectiveness]([companyId], [trainingScheduleId]);

CREATE NONCLUSTERED INDEX [TrainingEffectiveness_companyId_employeeId_idx]
    ON [dbo].[TrainingEffectiveness]([companyId], [employeeId]);

COMMIT TRAN;

END TRY
BEGIN CATCH
    ROLLBACK TRAN;
    THROW;
END CATCH
