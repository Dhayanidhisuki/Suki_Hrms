-- Phase 19 (§44): attachable checklist template + per-schedule checklist state.
ALTER TABLE [dbo].[TrainingSchedule] ADD [checklistId] INT NULL;
ALTER TABLE [dbo].[TrainingSchedule] ADD [checklistJson] NVARCHAR(MAX) NULL;
