-- Phase 15: opt-in proficiency promotion on assessment pass (BRD §51).
-- promoteOnPass defaults to 0 so existing assessments are unaffected;
-- promoteToLevelId is nullable.

IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('Assessment') AND name = 'promoteOnPass')
  ALTER TABLE [Assessment] ADD [promoteOnPass] BIT NOT NULL CONSTRAINT [Assessment_promoteOnPass_df] DEFAULT 0;

IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('Assessment') AND name = 'promoteToLevelId')
  ALTER TABLE [Assessment] ADD [promoteToLevelId] INT NULL;

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'Assessment_promoteToLevelId_idx' AND object_id = OBJECT_ID('Assessment'))
  CREATE INDEX [Assessment_promoteToLevelId_idx] ON [Assessment]([promoteToLevelId]);
