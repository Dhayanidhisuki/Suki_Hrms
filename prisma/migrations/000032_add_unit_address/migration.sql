-- Unit (Branch / Unit master): adds a physical address field, shown as a
-- column on the Units list. Additive only. Written without the prisma-diff
-- TRY/CATCH wrapper because scripts/apply-migration.mjs splits on ';' and
-- runs statements one by one inside its own transaction.

BEGIN TRAN;

ALTER TABLE [dbo].[Unit] ADD [address] NVARCHAR(500) NULL;

COMMIT TRAN;
