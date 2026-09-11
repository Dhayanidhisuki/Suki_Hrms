-- Unit.code was globally unique; the unit code is now auto-generated per
-- company ("<CompanyCode>-001", "<CompanyCode>-002"...), so uniqueness
-- becomes (companyId, code) — same pattern as migrations 000024 (Level per
-- Grade) and 000031 (SubDepartment per Department). Written without the
-- prisma-diff TRY/CATCH wrapper because scripts/apply-migration.mjs splits
-- on ';' and runs statements one by one inside its own transaction.

BEGIN TRAN;

ALTER TABLE [dbo].[Unit] DROP CONSTRAINT [Unit_code_key];

ALTER TABLE [dbo].[Unit] ADD CONSTRAINT [Unit_companyId_code_key] UNIQUE ([companyId], [code]);

COMMIT TRAN;
