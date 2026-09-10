-- Grade -> Designation link: a grade is defined under a designation, so the
-- Grade master form offers the designation list. Nullable so existing grade
-- rows keep loading; the API/form require it for new and edited grades.
-- Additive only. Written without the prisma-diff TRY/CATCH wrapper because
-- scripts/apply-migration.mjs splits on ';' and runs statements one by one
-- inside its own transaction.

BEGIN TRAN;

ALTER TABLE [dbo].[Grade] ADD [designationId] INT NULL;

ALTER TABLE [dbo].[Grade] ADD CONSTRAINT [Grade_designationId_fkey] FOREIGN KEY ([designationId]) REFERENCES [dbo].[Designation]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

CREATE NONCLUSTERED INDEX [Grade_designationId_idx] ON [dbo].[Grade]([designationId]);

COMMIT TRAN;
