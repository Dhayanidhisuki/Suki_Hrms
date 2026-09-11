-- Experience + salary package on JD Master. Written without the prisma-diff
-- TRY/CATCH wrapper because scripts/apply-migration.mjs splits on ';' and
-- runs statements one by one inside its own transaction.

BEGIN TRAN;

ALTER TABLE [dbo].[JobDescription] ADD [minExperienceYears] DECIMAL(4, 1) NULL;
ALTER TABLE [dbo].[JobDescription] ADD [maxExperienceYears] DECIMAL(4, 1) NULL;
ALTER TABLE [dbo].[JobDescription] ADD [salaryPackage] NVARCHAR(100) NULL;

ALTER TABLE [dbo].[JobDescriptionVersion] ADD [minExperienceYears] DECIMAL(4, 1) NULL;
ALTER TABLE [dbo].[JobDescriptionVersion] ADD [maxExperienceYears] DECIMAL(4, 1) NULL;
ALTER TABLE [dbo].[JobDescriptionVersion] ADD [salaryPackage] NVARCHAR(100) NULL;

COMMIT TRAN;
