-- AlterTable: Add workflow stage timestamps to PayrollRun
ALTER TABLE [PayrollRun] ADD [validatedAt] DATETIME2;
ALTER TABLE [PayrollRun] ADD [validatedByUserId] INT;
ALTER TABLE [PayrollRun] ADD [submittedAt] DATETIME2;
ALTER TABLE [PayrollRun] ADD [submittedByUserId] INT;
ALTER TABLE [PayrollRun] ADD [postedAt] DATETIME2;
ALTER TABLE [PayrollRun] ADD [postedByUserId] INT;
