-- Hand-authored (not a raw `prisma migrate diff` output like every prior
-- migration this session) — adding a required companyId to an already-
-- populated table needs a real backfill, not just DDL. Every SalaryComponent
-- row today is implicitly global; backfilled to companyId 1 (KUN Aerospace,
-- the only live, non-soft-deleted Company row in this DB) since that's the
-- company that has actually been using them. Any company created after this
-- migration gets its own starter catalog seeded by
-- POST /api/superadmin/companies/[id]/bootstrap-admin
-- (src/lib/defaultSalaryComponents.ts).
--
-- Everything after the ALTER TABLE ADD COLUMN statements runs inside
-- EXEC(...) dynamic SQL, not GO batch separators: SQL Server compiles a
-- static batch as a whole, so a later statement in the same batch can't
-- reference a column an earlier statement in that same batch just added
-- ("Invalid column name"). GO is a client-side batch separator that only
-- sqlcmd/SSMS understand — the SQL Server driver `prisma migrate deploy`
-- uses here sends the whole script as one batch and errors on literal `GO`
-- text ("Incorrect syntax near 'GO'"), confirmed live against this DB.
-- EXEC('...') sidesteps the problem entirely: the string is parsed at
-- runtime, after the column already exists.

BEGIN TRAN;

ALTER TABLE [dbo].[SalaryComponent] ADD [companyId] INT NULL;
ALTER TABLE [dbo].[SalaryComponent] ADD [isSystemDefined] BIT NOT NULL CONSTRAINT [SalaryComponent_isSystemDefined_df] DEFAULT 0;

EXEC('
UPDATE [dbo].[SalaryComponent] SET [companyId] = 1 WHERE [companyId] IS NULL;

UPDATE [dbo].[SalaryComponent] SET [isSystemDefined] = 1
  WHERE [code] IN (''BASIC'', ''PF'', ''ESI'', ''ARREAR_GROSS'', ''ARREAR_PF'', ''ARREAR_ESI'', ''BONUS'');

ALTER TABLE [dbo].[SalaryComponent] ALTER COLUMN [companyId] INT NOT NULL;

ALTER TABLE [dbo].[SalaryComponent] DROP CONSTRAINT [SalaryComponent_code_key];

CREATE UNIQUE NONCLUSTERED INDEX [SalaryComponent_companyId_code_key] ON [dbo].[SalaryComponent]([companyId], [code]);

ALTER TABLE [dbo].[SalaryComponent] ADD CONSTRAINT [SalaryComponent_companyId_fkey] FOREIGN KEY ([companyId]) REFERENCES [dbo].[Company]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;
');

COMMIT TRAN;
