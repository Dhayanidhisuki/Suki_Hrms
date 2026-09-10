-- Level -> Grade link: one grade has many levels, and an employee changes
-- level within their grade over time, so the Level master form offers the
-- grade list and the employee form filters Level by the chosen Grade.
-- Nullable so existing level rows keep loading; the API/form require it
-- for new and edited levels. Additive only. Written without the prisma-diff
-- TRY/CATCH wrapper because scripts/apply-migration.mjs splits on ';' and
-- runs statements one by one inside its own transaction.

BEGIN TRAN;

ALTER TABLE [dbo].[Level] ADD [gradeId] INT NULL;

ALTER TABLE [dbo].[Level] ADD CONSTRAINT [Level_gradeId_fkey] FOREIGN KEY ([gradeId]) REFERENCES [dbo].[Grade]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

CREATE NONCLUSTERED INDEX [Level_gradeId_idx] ON [dbo].[Level]([gradeId]);

COMMIT TRAN;
