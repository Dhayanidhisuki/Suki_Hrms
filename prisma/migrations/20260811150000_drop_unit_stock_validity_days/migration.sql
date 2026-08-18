-- =====================================================================
-- Migration: drop_unit_stock_validity_days
-- TOOLS_UNIT_STOCK.VALIDITY_DAYS must never be stored — it is a
-- point-in-time countdown (Next Calibration Due − CURRENT_DATE) and is
-- computed live wherever displayed. Only touches the app-owned
-- TOOLS_UNIT_STOCK table; no existing ERP table is altered.
-- =====================================================================

BEGIN TRY

BEGIN TRAN;

IF EXISTS (
    SELECT 1 FROM sys.columns
    WHERE object_id = OBJECT_ID(N'[dbo].[TOOLS_UNIT_STOCK]')
      AND name = N'VALIDITY_DAYS'
)
BEGIN
    ALTER TABLE [dbo].[TOOLS_UNIT_STOCK] DROP COLUMN [VALIDITY_DAYS];
END;

COMMIT TRAN;

END TRY
BEGIN CATCH

IF @@TRANCOUNT > 0
BEGIN
    ROLLBACK TRAN;
END;
THROW

END CATCH
