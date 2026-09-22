-- Phase 23 (§21/§35): approval-chain tracking on ExternalTraining.
ALTER TABLE [dbo].[ExternalTraining] ADD [currentStageOrder] INT NOT NULL CONSTRAINT ExternalTraining_currentStageOrder_df DEFAULT 0;
ALTER TABLE [dbo].[ExternalTraining] ADD [rejectionReason] NVARCHAR(500) NULL;
