-- Phase 24 (§25): per-attempt question order for randomized assessments.
ALTER TABLE [dbo].[AssessmentAttempt] ADD [questionIdsJson] NVARCHAR(MAX) NULL;
