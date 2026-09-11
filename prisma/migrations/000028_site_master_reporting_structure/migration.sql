-- KUN BRD review (2026-09-10), continued:
--   3. Site Master — new company-scoped physical-location master (Unit
--      stays the legal/org entity, just relabelled "Branch / Unit" in the
--      UI; no schema change there).
--   5. Reporting Structure — Designation.reportsToId self-reference, an
--      org-chart template (which Designation a Designation reports to by
--      default), not a per-employee assignment.
--
-- Additive only. Written without the prisma-diff TRY/CATCH wrapper because
-- scripts/apply-migration.mjs splits on ';' and runs statements one by one
-- inside its own transaction.

BEGIN TRAN;

CREATE TABLE [dbo].[Site] (
    [id] INT NOT NULL IDENTITY(1,1),
    [companyId] INT NOT NULL,
    [code] NVARCHAR(20) NOT NULL,
    [name] NVARCHAR(100) NOT NULL,
    [address] NVARCHAR(500),
    [city] NVARCHAR(100),
    [state] NVARCHAR(100),
    [pinCode] NVARCHAR(10),
    [isActive] BIT NOT NULL CONSTRAINT [Site_isActive_df] DEFAULT 1,
    [deletedAt] DATETIME2,
    [createdAt] DATETIME2 NOT NULL CONSTRAINT [Site_createdAt_df] DEFAULT CURRENT_TIMESTAMP,
    [updatedAt] DATETIME2 NOT NULL,
    CONSTRAINT [Site_pkey] PRIMARY KEY CLUSTERED ([id]),
    CONSTRAINT [Site_code_key] UNIQUE ([code])
);

ALTER TABLE [dbo].[Site] ADD CONSTRAINT [Site_companyId_fkey] FOREIGN KEY ([companyId]) REFERENCES [dbo].[Company]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;
CREATE NONCLUSTERED INDEX [Site_companyId_idx] ON [dbo].[Site]([companyId]);

ALTER TABLE [dbo].[Designation] ADD [reportsToId] INT NULL;
ALTER TABLE [dbo].[Designation] ADD CONSTRAINT [Designation_reportsToId_fkey] FOREIGN KEY ([reportsToId]) REFERENCES [dbo].[Designation]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;
CREATE NONCLUSTERED INDEX [Designation_reportsToId_idx] ON [dbo].[Designation]([reportsToId]);

COMMIT TRAN;
