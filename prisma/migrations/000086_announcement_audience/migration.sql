-- Announcement audience targeting: lets an admin scope an announcement to one
-- department/sub-department/designation/employee-type/unit instead of always
-- reaching every active employee in the company. Additive-only, both columns
-- nullable so every existing row keeps today's "everyone" behavior.

BEGIN TRAN;

ALTER TABLE [dbo].[Announcement] ADD [audienceScopeType] NVARCHAR(20) NULL;
ALTER TABLE [dbo].[Announcement] ADD [audienceScopeValues] NVARCHAR(2000) NULL;

COMMIT TRAN;
