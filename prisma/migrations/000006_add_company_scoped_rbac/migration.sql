BEGIN TRY

BEGIN TRAN;

-- DropForeignKey
ALTER TABLE [dbo].[Employee] DROP CONSTRAINT [Employee_companyId_fkey];

-- DropForeignKey
ALTER TABLE [dbo].[Employee] DROP CONSTRAINT [Employee_userId_fkey];

-- DropForeignKey
ALTER TABLE [dbo].[User] DROP CONSTRAINT [User_roleId_fkey];

-- DropIndex
ALTER TABLE [dbo].[Role] DROP CONSTRAINT [Role_code_key];

-- AlterTable
ALTER TABLE [dbo].[Role] ADD [companyId] INT NOT NULL;

-- AlterTable
ALTER TABLE [dbo].[User] ALTER COLUMN [roleId] INT NULL;
ALTER TABLE [dbo].[User] ADD [companyId] INT,
[isSuperAdmin] BIT NOT NULL CONSTRAINT [User_isSuperAdmin_df] DEFAULT 0;

-- NOTE: `prisma migrate diff` also emitted `ALTER TABLE [dbo].[Employee] ADD
-- CONSTRAINT [Employee_userId_key] UNIQUE NONCLUSTERED ([userId])` here —
-- intentionally excluded, same reason documented in migration 000002:
-- Employee.userId already has a FILTERED unique index (WHERE userId IS NOT
-- NULL) from migration 000001; the plain version would fail/corrupt given
-- multiple NULL userId rows.

-- CreateIndex
CREATE NONCLUSTERED INDEX [Role_companyId_idx] ON [dbo].[Role]([companyId]);

-- CreateIndex
ALTER TABLE [dbo].[Role] ADD CONSTRAINT [Role_companyId_code_key] UNIQUE NONCLUSTERED ([companyId], [code]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [User_companyId_idx] ON [dbo].[User]([companyId]);

-- AddForeignKey
ALTER TABLE [dbo].[Role] ADD CONSTRAINT [Role_companyId_fkey] FOREIGN KEY ([companyId]) REFERENCES [dbo].[Company]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[User] ADD CONSTRAINT [User_companyId_fkey] FOREIGN KEY ([companyId]) REFERENCES [dbo].[Company]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[User] ADD CONSTRAINT [User_roleId_fkey] FOREIGN KEY ([roleId]) REFERENCES [dbo].[Role]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[Employee] ADD CONSTRAINT [Employee_companyId_fkey] FOREIGN KEY ([companyId]) REFERENCES [dbo].[Company]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[Employee] ADD CONSTRAINT [Employee_userId_fkey] FOREIGN KEY ([userId]) REFERENCES [dbo].[User]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

COMMIT TRAN;

END TRY
BEGIN CATCH

IF @@TRANCOUNT > 0
BEGIN
    ROLLBACK TRAN;
END;
THROW

END CATCH

