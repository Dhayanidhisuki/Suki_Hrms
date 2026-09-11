-- KUN BRD review (2026-09-10), item 15 (Deduction Rates) — a catch-all,
-- company-scoped, versioned rate table for misc. statutory/company
-- deductions, with `isLop` flagging Loss-of-Pay rows per the client's
-- decision to fold that in here rather than a separate Common Logic
-- section. Read-only rate reference for now, same as GrossSplitRule.
--
-- Written without the prisma-diff TRY/CATCH wrapper because
-- scripts/apply-migration.mjs splits on ';' and runs statements one by one
-- inside its own transaction.

BEGIN TRAN;

CREATE TABLE [dbo].[DeductionRate] (
    [id] INT NOT NULL IDENTITY(1,1),
    [companyId] INT NOT NULL,
    [code] NVARCHAR(20) NOT NULL,
    [name] NVARCHAR(100) NOT NULL,
    [deductionType] NVARCHAR(10) NOT NULL,
    [rateValue] DECIMAL(10, 2) NOT NULL,
    [isLop] BIT NOT NULL CONSTRAINT [DeductionRate_isLop_df] DEFAULT 0,
    [effectiveFrom] DATETIME2 NOT NULL,
    [effectiveTo] DATETIME2,
    [isActive] BIT NOT NULL CONSTRAINT [DeductionRate_isActive_df] DEFAULT 1,
    [createdAt] DATETIME2 NOT NULL CONSTRAINT [DeductionRate_createdAt_df] DEFAULT CURRENT_TIMESTAMP,
    [updatedAt] DATETIME2 NOT NULL,
    CONSTRAINT [DeductionRate_pkey] PRIMARY KEY CLUSTERED ([id])
);

ALTER TABLE [dbo].[DeductionRate] ADD CONSTRAINT [DeductionRate_companyId_fkey] FOREIGN KEY ([companyId]) REFERENCES [dbo].[Company]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

CREATE NONCLUSTERED INDEX [DeductionRate_companyId_code_idx] ON [dbo].[DeductionRate]([companyId], [code]);
CREATE NONCLUSTERED INDEX [DeductionRate_effectiveFrom_effectiveTo_idx] ON [dbo].[DeductionRate]([effectiveFrom], [effectiveTo]);

COMMIT TRAN;
