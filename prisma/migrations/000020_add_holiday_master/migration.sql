-- HolidayMaster: per-company holiday calendar, closing the gap flagged
-- while building OT Approval (Sunday-vs-Holiday detection). Additive only.
-- Written without the prisma-diff TRY/CATCH wrapper because
-- scripts/apply-migration.mjs splits on ';' and runs statements one by one
-- inside its own transaction.

BEGIN TRAN;

-- CreateTable
CREATE TABLE [dbo].[HolidayMaster] (
    [id] INT NOT NULL IDENTITY(1,1),
    [companyId] INT NOT NULL,
    [date] DATE NOT NULL,
    [name] NVARCHAR(100) NOT NULL,
    [description] NVARCHAR(500),
    [isActive] BIT NOT NULL CONSTRAINT [HolidayMaster_isActive_df] DEFAULT 1,
    [deletedAt] DATETIME2,
    [createdAt] DATETIME2 NOT NULL CONSTRAINT [HolidayMaster_createdAt_df] DEFAULT CURRENT_TIMESTAMP,
    [updatedAt] DATETIME2 NOT NULL,
    CONSTRAINT [HolidayMaster_pkey] PRIMARY KEY CLUSTERED ([id]),
    CONSTRAINT [HolidayMaster_companyId_date_key] UNIQUE ([companyId], [date])
);

-- AddForeignKey
ALTER TABLE [dbo].[HolidayMaster] ADD CONSTRAINT [HolidayMaster_companyId_fkey] FOREIGN KEY ([companyId]) REFERENCES [dbo].[Company]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- CreateIndex
CREATE NONCLUSTERED INDEX [HolidayMaster_companyId_idx] ON [dbo].[HolidayMaster]([companyId]);

COMMIT TRAN;
