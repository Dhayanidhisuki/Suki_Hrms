-- Net-new isolated auth table for Tools Management.
-- Does NOT alter any existing ERP table, column, index, or FK.

BEGIN TRY
BEGIN TRAN;

IF OBJECT_ID(N'[dbo].[TOOLS_APP_USER]', N'U') IS NULL
BEGIN
    CREATE TABLE [dbo].[TOOLS_APP_USER] (
        [id] INT NOT NULL IDENTITY(1,1),
        [username] NVARCHAR(50) NOT NULL,
        [passwordHash] NVARCHAR(255) NOT NULL,
        [name] NVARCHAR(100) NOT NULL,
        [role] NVARCHAR(50) NOT NULL CONSTRAINT [TOOLS_APP_USER_role_df] DEFAULT 'Viewer',
        [erpUserCode] NVARCHAR(10) NULL,
        [isActive] BIT NOT NULL CONSTRAINT [TOOLS_APP_USER_isActive_df] DEFAULT 1,
        [deletedAt] DATETIME2 NULL,
        [createdAt] DATETIME2 NOT NULL CONSTRAINT [TOOLS_APP_USER_createdAt_df] DEFAULT CURRENT_TIMESTAMP,
        [updatedAt] DATETIME2 NOT NULL,
        CONSTRAINT [TOOLS_APP_USER_pkey] PRIMARY KEY CLUSTERED ([id])
    );

    CREATE UNIQUE NONCLUSTERED INDEX [TOOLS_APP_USER_username_key]
        ON [dbo].[TOOLS_APP_USER]([username]);
END

COMMIT TRAN;
END TRY
BEGIN CATCH
    IF @@TRANCOUNT > 0 ROLLBACK TRAN;
    THROW;
END CATCH;
