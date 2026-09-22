-- Snapshot the KRA's identity onto template and goal lines.
--
-- GoalTemplateKpi already snapshots the KPI's measurement fields so a master
-- edit cannot rewrite an existing template. The KRA's own code/name/category
-- were still read live through the join, so renaming a KRA changed what an
-- ALREADY-ACCEPTED goal set displayed to the employee — a record of something
-- they agreed to, silently altered.
--
-- Nullable + backfilled from the current master, so existing rows keep showing
-- exactly what they show today; only future master edits stop leaking through.

IF COL_LENGTH('GoalTemplateKra', 'kraCode') IS NULL
  ALTER TABLE [GoalTemplateKra] ADD [kraCode] NVARCHAR(30) NULL;
IF COL_LENGTH('GoalTemplateKra', 'kraName') IS NULL
  ALTER TABLE [GoalTemplateKra] ADD [kraName] NVARCHAR(150) NULL;
IF COL_LENGTH('GoalTemplateKra', 'kraCategory') IS NULL
  ALTER TABLE [GoalTemplateKra] ADD [kraCategory] NVARCHAR(50) NULL;

IF COL_LENGTH('EmployeeGoalKra', 'kraCode') IS NULL
  ALTER TABLE [EmployeeGoalKra] ADD [kraCode] NVARCHAR(30) NULL;
IF COL_LENGTH('EmployeeGoalKra', 'kraName') IS NULL
  ALTER TABLE [EmployeeGoalKra] ADD [kraName] NVARCHAR(150) NULL;
IF COL_LENGTH('EmployeeGoalKra', 'kraCategory') IS NULL
  ALTER TABLE [EmployeeGoalKra] ADD [kraCategory] NVARCHAR(50) NULL;

EXEC(N'
UPDATE tk
SET tk.[kraCode] = k.[code], tk.[kraName] = k.[name], tk.[kraCategory] = k.[category]
FROM [GoalTemplateKra] tk JOIN [Kra] k ON k.[id] = tk.[kraId]
WHERE tk.[kraCode] IS NULL;
');

EXEC(N'
UPDATE gk
SET gk.[kraCode] = k.[code], gk.[kraName] = k.[name], gk.[kraCategory] = k.[category]
FROM [EmployeeGoalKra] gk JOIN [Kra] k ON k.[id] = gk.[kraId]
WHERE gk.[kraCode] IS NULL;
');
