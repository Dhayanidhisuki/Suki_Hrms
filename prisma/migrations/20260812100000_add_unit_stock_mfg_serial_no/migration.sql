-- Additive client calibration-register field. Existing ERP data is untouched.
IF OBJECT_ID(N'[dbo].[TOOLS_UNIT_STOCK]', N'U') IS NOT NULL
   AND COL_LENGTH(N'[dbo].[TOOLS_UNIT_STOCK]', N'MFG_SERIAL_NO') IS NULL
BEGIN
    ALTER TABLE [dbo].[TOOLS_UNIT_STOCK]
        ADD [MFG_SERIAL_NO] NVARCHAR(100) NULL;
END;
