-- =====================================================================
-- Migration: add_tools_unit_stock
-- Additive only — no existing table or column is altered or dropped.
-- Creates TOOLS_UNIT_STOCK: one row per (GaugeAndTools, Used Unit) pair.
-- =====================================================================

BEGIN TRY

BEGIN TRAN;

-- CreateTable
CREATE TABLE [dbo].[TOOLS_UNIT_STOCK] (
    [ID]                  INT              NOT NULL IDENTITY(1,1),
    [REF_NO]              INT              NOT NULL,
    [UNIT_CODE]           NVARCHAR(50)     NOT NULL,

    -- Per-unit Make (Q2 Option B — serial-level MAKE left untouched)
    [MAKE]                NVARCHAR(50)     NULL,

    -- Quantity fields — nullable; populated manually post-import
    [QTY_TOTAL]           DECIMAL(10,3)    NULL,
    [QTY_IN]              DECIMAL(10,3)    NULL,
    [QTY_OUT]             DECIMAL(10,3)    NULL,
    [QTY_NEW]             DECIMAL(10,3)    NULL,
    [QTY_IN_USE]          DECIMAL(10,3)    NULL,

    -- Calibration snapshot — historical bulk-load from import sheet
    [CALIB_DATE]          DATETIME         NULL,
    [NEXT_CALIB_DATE]     DATETIME         NULL,
    [VALIDITY_DAYS]       INT              NULL,
    [OBSERVED_ERROR]      NVARCHAR(200)    NULL,
    [CALIB_AGENCY]        NVARCHAR(100)    NULL,

    -- Audit columns
    [CREAT_USER_ID_CD]    NVARCHAR(10)     NOT NULL,
    [CREAT_DT]            DATETIME         NOT NULL,
    [LST_UPDT_USER_ID_CD] NVARCHAR(10)     NULL,
    [LST_UPDT_TS]         DATETIME         NULL,

    CONSTRAINT [TOOLS_UNIT_STOCK_pkey] PRIMARY KEY CLUSTERED ([ID]),
    CONSTRAINT [TOOLS_UNIT_STOCK_ref_unit_uid]
        UNIQUE ([REF_NO], [UNIT_CODE])
);

-- CreateIndex
CREATE NONCLUSTERED INDEX [TOOLS_UNIT_STOCK_UNIT_CODE_idx]
    ON [dbo].[TOOLS_UNIT_STOCK]([UNIT_CODE]);

-- AddForeignKey
ALTER TABLE [dbo].[TOOLS_UNIT_STOCK]
    ADD CONSTRAINT [TOOLS_UNIT_STOCK_REF_NO_fkey]
    FOREIGN KEY ([REF_NO]) REFERENCES [dbo].[GAUGEANDTOOLS]([REF_NO])
    ON DELETE NO ACTION
    ON UPDATE NO ACTION;

COMMIT TRAN;

END TRY
BEGIN CATCH

IF @@TRANCOUNT > 0
BEGIN
    ROLLBACK TRAN;
END;
THROW

END CATCH
