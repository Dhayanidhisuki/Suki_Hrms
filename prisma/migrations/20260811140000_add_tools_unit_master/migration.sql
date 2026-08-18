-- =====================================================================
-- Migration: add_tools_unit_master
-- Additive only. Creates TOOLS_UNIT_MASTER (app-owned list of valid
-- unit names) and adds an FK from TOOLS_UNIT_STOCK.UNIT_CODE to it.
-- Seeds Unit 1, Unit 2, Unit 3.
-- =====================================================================

BEGIN TRY

BEGIN TRAN;

-- 1. Create the unit master table
CREATE TABLE [dbo].[TOOLS_UNIT_MASTER] (
    [ID]                  INT              NOT NULL IDENTITY(1,1),
    [UNIT_NAME]           NVARCHAR(100)    NOT NULL,
    [IS_ACTIVE]           BIT              NOT NULL CONSTRAINT [TOOLS_UNIT_MASTER_IS_ACTIVE_df] DEFAULT (1),
    [CREAT_USER_ID_CD]    NVARCHAR(10)     NOT NULL,
    [CREAT_DT]            DATETIME         NOT NULL,

    CONSTRAINT [TOOLS_UNIT_MASTER_pkey]         PRIMARY KEY CLUSTERED ([ID]),
    CONSTRAINT [TOOLS_UNIT_MASTER_UNIT_NAME_key] UNIQUE ([UNIT_NAME])
);

-- 2. Seed the three initial units
INSERT INTO [dbo].[TOOLS_UNIT_MASTER] ([UNIT_NAME], [IS_ACTIVE], [CREAT_USER_ID_CD], [CREAT_DT])
VALUES
    (N'Unit 1', 1, 'SYSTEM', GETDATE()),
    (N'Unit 2', 1, 'SYSTEM', GETDATE()),
    (N'Unit 3', 1, 'SYSTEM', GETDATE());

-- 3. Add FK from TOOLS_UNIT_STOCK.UNIT_CODE → TOOLS_UNIT_MASTER.UNIT_NAME
--    (TOOLS_UNIT_STOCK was created in the previous migration;
--     if it has no rows yet this is safe; if it does, they must all
--     have UNIT_CODE matching one of the seeded names)
ALTER TABLE [dbo].[TOOLS_UNIT_STOCK]
    ADD CONSTRAINT [TOOLS_UNIT_STOCK_UNIT_CODE_fkey]
    FOREIGN KEY ([UNIT_CODE]) REFERENCES [dbo].[TOOLS_UNIT_MASTER]([UNIT_NAME])
    ON DELETE NO ACTION
    ON UPDATE CASCADE;

COMMIT TRAN;

END TRY
BEGIN CATCH

IF @@TRANCOUNT > 0
BEGIN
    ROLLBACK TRAN;
END;
THROW

END CATCH
