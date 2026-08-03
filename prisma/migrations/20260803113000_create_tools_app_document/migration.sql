-- Net-new isolated document metadata table for Tools Management.
-- Does NOT alter any existing ERP table, column, index, or FK.
-- File bytes live on disk under TOOL_DOCS_ROOT / storage/tool-docs.

BEGIN TRY
BEGIN TRAN;

IF OBJECT_ID(N'[dbo].[TOOLS_APP_DOCUMENT]', N'U') IS NULL
BEGIN
    CREATE TABLE [dbo].[TOOLS_APP_DOCUMENT] (
        [id] INT NOT NULL IDENTITY(1,1),
        [toolOrGaugeNo] NVARCHAR(25) NOT NULL,
        [toolRefNo] INT NULL,
        [docType] NVARCHAR(40) NOT NULL CONSTRAINT [TOOLS_APP_DOCUMENT_docType_df] DEFAULT 'OTHER',
        [originalName] NVARCHAR(255) NOT NULL,
        [storedName] NVARCHAR(255) NOT NULL,
        [mimeType] NVARCHAR(120) NOT NULL,
        [sizeBytes] INT NOT NULL,
        [calibRowId] INT NULL,
        [dcNo] NVARCHAR(20) NULL,
        [remarks] NVARCHAR(200) NULL,
        [creatUserIdCd] NVARCHAR(50) NOT NULL,
        [creatDt] DATETIME2 NOT NULL CONSTRAINT [TOOLS_APP_DOCUMENT_creatDt_df] DEFAULT CURRENT_TIMESTAMP,
        [deletedAt] DATETIME2 NULL,
        CONSTRAINT [TOOLS_APP_DOCUMENT_pkey] PRIMARY KEY CLUSTERED ([id])
    );

    CREATE NONCLUSTERED INDEX [TOOLS_APP_DOCUMENT_toolOrGaugeNo_idx]
        ON [dbo].[TOOLS_APP_DOCUMENT]([toolOrGaugeNo]);

    CREATE NONCLUSTERED INDEX [TOOLS_APP_DOCUMENT_calibRowId_idx]
        ON [dbo].[TOOLS_APP_DOCUMENT]([calibRowId])
        WHERE [calibRowId] IS NOT NULL;
END

COMMIT TRAN;
END TRY
BEGIN CATCH
    IF @@TRANCOUNT > 0 ROLLBACK TRAN;
    THROW;
END CATCH;
