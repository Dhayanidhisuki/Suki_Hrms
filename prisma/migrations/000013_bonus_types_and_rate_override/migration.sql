-- Hand-authored (not a raw `prisma migrate diff` output) — same reason and
-- same EXEC(...) dynamic-SQL fix as migration 000012: adding a required
-- companyId to BonusRate (currently 1 row, implicitly global) needs a real
-- backfill, and a later statement in the same static batch can't reference
-- a column an earlier statement in that batch just added ("Invalid column
-- name"). GO batch separators don't work against this DB driver — confirmed
-- live in migration 000012 ("Incorrect syntax near 'GO'"). Backfilled to
-- companyId 1 (KUN Aerospace, the only live company) — the same target
-- migration 000012 used, since that's the one row this feature has been
-- seeded/tested against so far.
--
-- BonusRecord's two new columns (calculationType with a DEFAULT,
-- annualBonusWage nullable) don't need this treatment — SQL Server allows
-- adding either kind of column to a populated table in a single statement.

BEGIN TRAN;

DROP INDEX [BonusRate_effectiveFrom_effectiveTo_idx] ON [dbo].[BonusRate];

-- AlterTable
ALTER TABLE [dbo].[BonusRate] ADD [companyId] INT NULL;
ALTER TABLE [dbo].[BonusRate] ADD [calculationType] NVARCHAR(30) NOT NULL CONSTRAINT [BonusRate_calculationType_df] DEFAULT 'BASIC_PROJECTION';

-- AlterTable
ALTER TABLE [dbo].[BonusRecord] ADD [annualBonusWage] DECIMAL(18,2);
ALTER TABLE [dbo].[BonusRecord] ADD [calculationType] NVARCHAR(30) NOT NULL CONSTRAINT [BonusRecord_calculationType_df] DEFAULT 'BASIC_PROJECTION';

EXEC('
UPDATE [dbo].[BonusRate] SET [companyId] = 1 WHERE [companyId] IS NULL;

ALTER TABLE [dbo].[BonusRate] ALTER COLUMN [companyId] INT NOT NULL;

CREATE NONCLUSTERED INDEX [BonusRate_companyId_effectiveFrom_effectiveTo_idx] ON [dbo].[BonusRate]([companyId], [effectiveFrom], [effectiveTo]);

ALTER TABLE [dbo].[BonusRate] ADD CONSTRAINT [BonusRate_companyId_fkey] FOREIGN KEY ([companyId]) REFERENCES [dbo].[Company]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;
');

COMMIT TRAN;
