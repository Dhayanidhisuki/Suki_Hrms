-- Goal templates: snapshot KPI measurement fields, Draft status, clone
-- provenance, and optional job-role targeting.
-- ADD COLUMN and the backfill UPDATE cannot share a batch: SQL Server
-- compiles the UPDATE before the new columns exist.

IF COL_LENGTH('dbo.GoalTemplate', 'jobRole') IS NULL
  ALTER TABLE [dbo].[GoalTemplate] ADD [jobRole] NVARCHAR(100) NULL;

IF COL_LENGTH('dbo.GoalTemplate', 'createdByUserId') IS NULL
  ALTER TABLE [dbo].[GoalTemplate] ADD [createdByUserId] INT NULL;

IF COL_LENGTH('dbo.GoalTemplate', 'clonedFromId') IS NULL
  ALTER TABLE [dbo].[GoalTemplate] ADD [clonedFromId] INT NULL;

IF COL_LENGTH('dbo.GoalTemplateKpi', 'description') IS NULL
  ALTER TABLE [dbo].[GoalTemplateKpi] ADD [description] NVARCHAR(1000) NULL;
IF COL_LENGTH('dbo.GoalTemplateKpi', 'measurementType') IS NULL
  ALTER TABLE [dbo].[GoalTemplateKpi] ADD [measurementType] NVARCHAR(30) NULL;
IF COL_LENGTH('dbo.GoalTemplateKpi', 'unit') IS NULL
  ALTER TABLE [dbo].[GoalTemplateKpi] ADD [unit] NVARCHAR(30) NULL;
IF COL_LENGTH('dbo.GoalTemplateKpi', 'minThreshold') IS NULL
  ALTER TABLE [dbo].[GoalTemplateKpi] ADD [minThreshold] DECIMAL(18, 4) NULL;
IF COL_LENGTH('dbo.GoalTemplateKpi', 'maxTarget') IS NULL
  ALTER TABLE [dbo].[GoalTemplateKpi] ADD [maxTarget] DECIMAL(18, 4) NULL;
IF COL_LENGTH('dbo.GoalTemplateKpi', 'frequency') IS NULL
  ALTER TABLE [dbo].[GoalTemplateKpi] ADD [frequency] NVARCHAR(20) NULL;

EXEC(N'
UPDATE t
SET
  t.[description]     = COALESCE(t.[description], k.[description], N''''),
  t.[measurementType] = COALESCE(t.[measurementType], k.[measurementType], N''HIGHER_IS_BETTER''),
  t.[unit]            = COALESCE(t.[unit], k.[unit], N''''),
  t.[minThreshold]    = COALESCE(t.[minThreshold], k.[minThreshold]),
  t.[maxTarget]       = COALESCE(t.[maxTarget], k.[maxTarget]),
  t.[frequency]       = COALESCE(t.[frequency], k.[frequency], N''ANNUAL'')
FROM [dbo].[GoalTemplateKpi] t
INNER JOIN [dbo].[Kpi] k ON k.[id] = t.[kpiId];

UPDATE [dbo].[GoalTemplateKpi] SET [description] = N'''' WHERE [description] IS NULL;
UPDATE [dbo].[GoalTemplateKpi] SET [measurementType] = N''HIGHER_IS_BETTER'' WHERE [measurementType] IS NULL;
UPDATE [dbo].[GoalTemplateKpi] SET [unit] = N'''' WHERE [unit] IS NULL;
UPDATE [dbo].[GoalTemplateKpi] SET [frequency] = N''ANNUAL'' WHERE [frequency] IS NULL;

ALTER TABLE [dbo].[GoalTemplateKpi] ALTER COLUMN [description] NVARCHAR(1000) NOT NULL;
ALTER TABLE [dbo].[GoalTemplateKpi] ALTER COLUMN [measurementType] NVARCHAR(30) NOT NULL;
ALTER TABLE [dbo].[GoalTemplateKpi] ALTER COLUMN [unit] NVARCHAR(30) NOT NULL;
ALTER TABLE [dbo].[GoalTemplateKpi] ALTER COLUMN [frequency] NVARCHAR(20) NOT NULL;
');
