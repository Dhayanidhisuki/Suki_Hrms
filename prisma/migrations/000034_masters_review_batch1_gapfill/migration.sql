-- Gap-fill for migrations 000025-000030 ("masters review batch"): those
-- files were re-run today and mostly errored with "already exists" —
-- confirming the tables/columns/indexes they create had already landed on
-- this shared DB in an earlier, undocumented run. But two things were
-- genuinely still missing, discovered live (GET /api/masters/designations
-- 500ing with "column budget does not exist"):
--
--   1. Department.sanctionedHeadcount and 4 Designation columns
--      (budget/experienceYears/qualification/sanctionedHeadcount) from
--      000025 — that file's statements are one all-or-nothing transaction,
--      so it never committed ANY of the 14 statements once statement #2
--      (SubDepartment.sanctionedHeadcount, added by some other means) hit a
--      duplicate-column error.
--   2. Every FK constraint from 000026/000027/000028/000030
--      (GrossSplitRule, OTPlan.payComponentId, Site, Designation.reportsToId,
--      DeductionRate) plus the two indexes on OTPlan.payComponentId and
--      Designation.reportsToId — the tables/columns/other indexes from
--      those files exist, but not one FK constraint does. Re-adding them
--      here for referential integrity; harmless if a later, fuller re-run
--      of those files is ever attempted (SQL Server would just report them
--      as already existing, same as everything else this file works around).
--
-- Written without the prisma-diff TRY/CATCH wrapper because
-- scripts/apply-migration.mjs splits on ';' and runs statements one by one
-- inside its own transaction.

BEGIN TRAN;

ALTER TABLE [dbo].[Department] ADD [sanctionedHeadcount] INT NULL;
ALTER TABLE [dbo].[Designation] ADD [budget] DECIMAL(18, 2) NULL;
ALTER TABLE [dbo].[Designation] ADD [experienceYears] DECIMAL(4, 1) NULL;
ALTER TABLE [dbo].[Designation] ADD [qualification] NVARCHAR(200) NULL;
ALTER TABLE [dbo].[Designation] ADD [sanctionedHeadcount] INT NULL;
ALTER TABLE [dbo].[Designation] ADD [reportsToId] INT NULL;

ALTER TABLE [dbo].[GrossSplitRule] ADD CONSTRAINT [GrossSplitRule_companyId_fkey] FOREIGN KEY ([companyId]) REFERENCES [dbo].[Company]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;
ALTER TABLE [dbo].[GrossSplitRule] ADD CONSTRAINT [GrossSplitRule_salaryComponentId_fkey] FOREIGN KEY ([salaryComponentId]) REFERENCES [dbo].[SalaryComponent]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;
ALTER TABLE [dbo].[OTPlan] ADD CONSTRAINT [OTPlan_payComponentId_fkey] FOREIGN KEY ([payComponentId]) REFERENCES [dbo].[SalaryComponent]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;
CREATE NONCLUSTERED INDEX [OTPlan_payComponentId_idx] ON [dbo].[OTPlan]([payComponentId]);
ALTER TABLE [dbo].[Site] ADD CONSTRAINT [Site_companyId_fkey] FOREIGN KEY ([companyId]) REFERENCES [dbo].[Company]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;
ALTER TABLE [dbo].[Designation] ADD CONSTRAINT [Designation_reportsToId_fkey] FOREIGN KEY ([reportsToId]) REFERENCES [dbo].[Designation]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;
CREATE NONCLUSTERED INDEX [Designation_reportsToId_idx] ON [dbo].[Designation]([reportsToId]);
ALTER TABLE [dbo].[DeductionRate] ADD CONSTRAINT [DeductionRate_companyId_fkey] FOREIGN KEY ([companyId]) REFERENCES [dbo].[Company]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

COMMIT TRAN;
