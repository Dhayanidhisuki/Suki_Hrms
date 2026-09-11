-- SubDepartment.code was globally unique; the sub-department code is now
-- auto-generated per department ("<DeptCode>-001", "<DeptCode>-002"...), so
-- uniqueness becomes (departmentId, code) — same pattern as migration
-- 000024 (Level code unique per grade). Written without the prisma-diff
-- TRY/CATCH wrapper because scripts/apply-migration.mjs splits on ';' and
-- runs statements one by one inside its own transaction.

BEGIN TRAN;

ALTER TABLE [dbo].[SubDepartment] DROP CONSTRAINT [SubDepartment_code_key];

ALTER TABLE [dbo].[SubDepartment] ADD CONSTRAINT [SubDepartment_departmentId_code_key] UNIQUE ([departmentId], [code]);

COMMIT TRAN;
