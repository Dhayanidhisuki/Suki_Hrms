-- Add employer-side PF/EPS/ESI columns to PayrollLine. These are present
-- in the Prisma schema (PayrollLine.pfEmployer / epsEmployer / esiEmployer)
-- but were never migrated, causing calculatePayrollRun to fail with
-- "Invalid column name 'pfEmployer'" on the upsert.

ALTER TABLE [PayrollLine] ADD [pfEmployer]  DECIMAL(18,2) NOT NULL CONSTRAINT [PayrollLine_pfEmployer_df]  DEFAULT 0;
ALTER TABLE [PayrollLine] ADD [epsEmployer] DECIMAL(18,2) NOT NULL CONSTRAINT [PayrollLine_epsEmployer_df] DEFAULT 0;
ALTER TABLE [PayrollLine] ADD [esiEmployer] DECIMAL(18,2) NOT NULL CONSTRAINT [PayrollLine_esiEmployer_df] DEFAULT 0;
