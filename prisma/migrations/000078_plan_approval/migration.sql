-- Phase 28 (§14): annual plan approval chain tracking fields.
ALTER TABLE [dbo].[TrainingPlan] ADD
    [currentStageOrder] INT NOT NULL CONSTRAINT [TrainingPlan_currentStageOrder_df] DEFAULT 0,
    [rejectionReason] NVARCHAR(500) NULL,
    [rejectedByUserId] INT NULL,
    [rejectedAt] DATETIME2 NULL;
