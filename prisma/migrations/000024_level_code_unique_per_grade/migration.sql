-- Level.code was globally unique; a level like "L1" must be allowed under
-- several grades, so uniqueness becomes (gradeId, code). Existing unlinked
-- rows (gradeId NULL) keep their distinct codes, so the new key holds.
-- Written without the prisma-diff TRY/CATCH wrapper because
-- scripts/apply-migration.mjs splits on ';' and runs statements one by one
-- inside its own transaction.

BEGIN TRAN;

ALTER TABLE [dbo].[Level] DROP CONSTRAINT [Level_code_key];

ALTER TABLE [dbo].[Level] ADD CONSTRAINT [Level_gradeId_code_key] UNIQUE ([gradeId], [code]);

COMMIT TRAN;
