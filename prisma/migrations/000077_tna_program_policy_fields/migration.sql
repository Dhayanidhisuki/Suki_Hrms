-- Phase 27: BRD §7.2 TNA extended fields, §12 program mandatory flag, §13 policy rule fields.

ALTER TABLE [dbo].[TrainingNeedRequest] ADD
    [tnaYear] INT NULL,
    [category] NVARCHAR(50) NULL,
    [skillId] INT NULL,
    [currentLevelId] INT NULL,
    [requiredLevelId] INT NULL,
    [gapLevel] NVARCHAR(20) NULL,
    [businessImpact] NVARCHAR(500) NULL,
    [isMandatory] BIT NOT NULL CONSTRAINT [TrainingNeedRequest_isMandatory_df] DEFAULT 0,
    [proposedMethod] NVARCHAR(50) NULL,
    [proposedTrainer] NVARCHAR(100) NULL,
    [targetDate] DATE NULL,
    [estimatedCost] DECIMAL(18,2) NULL,
    [managerRemarks] NVARCHAR(500) NULL;

ALTER TABLE [dbo].[TrainingProgram] ADD
    [isMandatory] BIT NOT NULL CONSTRAINT [TrainingProgram_isMandatory_df] DEFAULT 0;

ALTER TABLE [dbo].[TrainingPolicy] ADD
    [reimbursementRules] NVARCHAR(500) NULL,
    [cancellationRules] NVARCHAR(500) NULL,
    [minTrainingHoursPerYear] INT NULL,
    [employeeObligations] NVARCHAR(500) NULL;
