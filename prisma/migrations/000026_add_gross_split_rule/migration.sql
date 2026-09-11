-- Common Logic > Gross % Split (KUN BRD review, 2026-09-10): a company's
-- fixed percentage-of-Gross for each earning SalaryComponent. Additive new
-- table only. Read-only reference for now; wiring into Salary Revision's
-- component auto-fill is a later session.
--
-- Written without the prisma-diff TRY/CATCH wrapper because
-- scripts/apply-migration.mjs splits on ';' and runs statements one by one
-- inside its own transaction.

BEGIN TRAN;

CREATE TABLE [dbo].[GrossSplitRule] (
    [id] INT NOT NULL IDENTITY(1,1),
    [companyId] INT NOT NULL,
    [salaryComponentId] INT NOT NULL,
    [percentOfGross] DECIMAL(5, 2) NOT NULL,
    [isActive] BIT NOT NULL CONSTRAINT [GrossSplitRule_isActive_df] DEFAULT 1,
    [createdAt] DATETIME2 NOT NULL CONSTRAINT [GrossSplitRule_createdAt_df] DEFAULT CURRENT_TIMESTAMP,
    [updatedAt] DATETIME2 NOT NULL,
    CONSTRAINT [GrossSplitRule_pkey] PRIMARY KEY CLUSTERED ([id]),
    CONSTRAINT [GrossSplitRule_salaryComponentId_key] UNIQUE ([salaryComponentId])
);

ALTER TABLE [dbo].[GrossSplitRule] ADD CONSTRAINT [GrossSplitRule_companyId_fkey] FOREIGN KEY ([companyId]) REFERENCES [dbo].[Company]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;
ALTER TABLE [dbo].[GrossSplitRule] ADD CONSTRAINT [GrossSplitRule_salaryComponentId_fkey] FOREIGN KEY ([salaryComponentId]) REFERENCES [dbo].[SalaryComponent]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

CREATE NONCLUSTERED INDEX [GrossSplitRule_companyId_idx] ON [dbo].[GrossSplitRule]([companyId]);

COMMIT TRAN;
