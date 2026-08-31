/*
  Destructive standalone cleanup for Suki_Manpro_Tools only.

  Retains exactly:
    - 58 tables mapped in prisma/schema.prisma
    - 5 additional tables used by runtime raw SQL
    - dbo._prisma_migrations

  Preconditions were audited on 2026-08-27. Execute only after verifying the
  Suki_Manpro_Tools_before_unrelated_removal.bak recovery backup.
*/

SET NOCOUNT ON;
SET XACT_ABORT ON;

IF DB_NAME() <> N'Suki_Manpro_Tools'
    THROW 50000, 'Refusing to run outside Suki_Manpro_Tools.', 1;

DECLARE @keep TABLE
(
    schema_name sysname NOT NULL,
    table_name sysname NOT NULL,
    PRIMARY KEY (schema_name, table_name)
);

INSERT INTO @keep (schema_name, table_name)
VALUES
    (N'dbo', N'CALIBRATION_FREQUENCY_MASTER'),
    (N'dbo', N'COMMON_PURCHASE_ITEM'),
    (N'dbo', N'COMMON_PURCHASE_ORDER'),
    (N'dbo', N'COMPANY_DETAILS'),
    (N'dbo', N'DEPT'),
    (N'dbo', N'EMPLOYEE'),
    (N'dbo', N'ERP_USER'),
    (N'dbo', N'FINANCE_LEDGER_MASTER'),
    (N'dbo', N'GAUGEANDTOOLS'),
    (N'dbo', N'GAUGE_CONTROL_CARD'),
    (N'dbo', N'GAUGE_CONTROL_CARD_TRANS'),
    (N'dbo', N'GAUGE_SERIAL_NO'),
    (N'dbo', N'GAUGE_TOOLS_ISSUE'),
    (N'dbo', N'GAUGE_TYPE'),
    (N'dbo', N'LOCATION_MASTER'),
    (N'dbo', N'MATERIAL_REQUISITION_MASTER'),
    (N'dbo', N'MATERIAL_REQUISITION_TRANS'),
    (N'dbo', N'OTHER_TOOLS_TYPE'),
    (N'dbo', N'PURCHASE_APPROVAL'),
    (N'dbo', N'QMS_OTHER_TOOLS_TYPE'),
    (N'dbo', N'SUBCONTRACTOR'),
    (N'dbo', N'SUPPLIER'),
    (N'dbo', N'TOOLS_APP_CALIBRATION_AGENCY'),
    (N'dbo', N'TOOLS_APP_CALIBRATION_DEVIATION'),
    (N'dbo', N'TOOLS_APP_CALIBRATION_NOTIFICATION'),
    (N'dbo', N'TOOLS_APP_CALIBRATION_RESULT'),
    (N'dbo', N'TOOLS_APP_CALIBRATION_RESULT_OBS'),
    (N'dbo', N'TOOLS_APP_DOCUMENT'),
    (N'dbo', N'TOOLS_APP_INSTRUMENT_DEFECT'),
    (N'dbo', N'TOOLS_APP_INSTRUMENT_MASTER_DATA'),
    (N'dbo', N'TOOLS_APP_INSTRUMENT_SERVICE'),
    (N'dbo', N'TOOLS_APP_MODULE'),
    (N'dbo', N'TOOLS_APP_NOTIFICATION_RECIPIENT'),
    (N'dbo', N'TOOLS_APP_NOTIFICATION_SETTING'),
    (N'dbo', N'TOOLS_APP_ROLE'),
    (N'dbo', N'TOOLS_APP_ROLE_PERMISSION_MATRIX'),
    (N'dbo', N'TOOLS_APP_USER'),
    (N'dbo', N'TOOLS_APP_USER_ROLE'),
    (N'dbo', N'TOOLS_APP_USER_UNIT_SCOPE'),
    (N'dbo', N'TOOLS_CONSUMPTION_TRANS_ISSUE'),
    (N'dbo', N'TOOLS_DETAILS'),
    (N'dbo', N'TOOLS_ISSUE_FOR_CALIBRATION'),
    (N'dbo', N'TOOLS_ISSUE_RECEIVED'),
    (N'dbo', N'TOOLS_ISSUE_RECEIVED_TRANS'),
    (N'dbo', N'TOOLS_MACHINE_TRANS'),
    (N'dbo', N'TOOLS_MAPPING'),
    (N'dbo', N'TOOLS_PO_FINANCE'),
    (N'dbo', N'TOOLS_PO_FINANCE_LINE'),
    (N'dbo', N'TOOLS_PO_RECEIVE'),
    (N'dbo', N'TOOLS_PO_RECEIVE_TRANS'),
    (N'dbo', N'TOOLS_PO_SCH_MASTER'),
    (N'dbo', N'TOOLS_PO_SCH_TRANS'),
    (N'dbo', N'TOOLS_PRICE_MASTER'),
    (N'dbo', N'TOOLS_RECEIVE_FOR_CALIBRATION'),
    (N'dbo', N'TOOLS_ROLE_PERMISSION'),
    (N'dbo', N'TOOLS_SPECIFICATION'),
    (N'dbo', N'TOOLS_TRANS_ISSUE'),
    (N'dbo', N'TOOLS_TRANS_ISSUE_FOR_CALIBRATION'),
    (N'dbo', N'TOOLS_TRANS_RECEIVE_FOR_CALIBRATION'),
    (N'dbo', N'TOOLS_TYPE'),
    (N'dbo', N'TOOLS_UNIT_MASTER'),
    (N'dbo', N'TOOLS_UNIT_STOCK'),
    (N'dbo', N'UOM_MASTER'),
    (N'dbo', N'_prisma_migrations');

IF (SELECT COUNT(*) FROM sys.tables WHERE is_ms_shipped = 0) <> 792
    THROW 50001, 'Expected exactly 792 current user tables; no changes made.', 1;

IF EXISTS
(
    SELECT 1
    FROM @keep AS k
    LEFT JOIN sys.schemas AS s ON s.name = k.schema_name
    LEFT JOIN sys.tables AS t ON t.schema_id = s.schema_id AND t.name = k.table_name
    WHERE t.object_id IS NULL
)
    THROW 50002, 'One or more protected tables are missing; no changes made.', 1;

IF
(
    SELECT COUNT(*)
    FROM sys.tables AS t
    JOIN sys.schemas AS s ON s.schema_id = t.schema_id
    LEFT JOIN @keep AS k ON k.schema_name = s.name AND k.table_name = t.name
    WHERE t.is_ms_shipped = 0 AND k.table_name IS NULL
) <> 728
    THROW 50003, 'Expected exactly 728 unrelated tables; no changes made.', 1;

BEGIN TRY
    BEGIN TRANSACTION;

    DECLARE @sql nvarchar(max);

    -- No application code uses SQL views. Remove them first so they cannot
    -- become invalid after their underlying unrelated tables are removed.
    SELECT @sql =
    (
        SELECT N'DROP VIEW ' + QUOTENAME(s.name) + N'.' + QUOTENAME(v.name) + N';'
        FROM sys.views AS v
        JOIN sys.schemas AS s ON s.schema_id = v.schema_id
        WHERE v.is_ms_shipped = 0
        ORDER BY s.name, v.name
        FOR XML PATH(N''), TYPE
    ).value(N'.', N'nvarchar(max)');
    IF NULLIF(@sql, N'') IS NOT NULL EXEC sys.sp_executesql @sql;

    -- The only function present was production-card logic and is unrelated.
    SELECT @sql =
    (
        SELECT N'DROP FUNCTION ' + QUOTENAME(s.name) + N'.' + QUOTENAME(o.name) + N';'
        FROM sys.objects AS o
        JOIN sys.schemas AS s ON s.schema_id = o.schema_id
        WHERE o.is_ms_shipped = 0 AND o.type IN (N'FN', N'IF', N'TF')
        ORDER BY s.name, o.name
        FOR XML PATH(N''), TYPE
    ).value(N'.', N'nvarchar(max)');
    IF NULLIF(@sql, N'') IS NOT NULL EXEC sys.sp_executesql @sql;

    -- Remove only foreign keys touching a table that is not protected.
    SELECT @sql =
    (
        SELECT
            N'ALTER TABLE ' + QUOTENAME(OBJECT_SCHEMA_NAME(fk.parent_object_id)) + N'.' +
            QUOTENAME(OBJECT_NAME(fk.parent_object_id)) + N' DROP CONSTRAINT ' +
            QUOTENAME(fk.name) + N';'
        FROM sys.foreign_keys AS fk
        LEFT JOIN @keep AS child_keep
          ON child_keep.schema_name = OBJECT_SCHEMA_NAME(fk.parent_object_id)
         AND child_keep.table_name = OBJECT_NAME(fk.parent_object_id)
        LEFT JOIN @keep AS parent_keep
          ON parent_keep.schema_name = OBJECT_SCHEMA_NAME(fk.referenced_object_id)
         AND parent_keep.table_name = OBJECT_NAME(fk.referenced_object_id)
        WHERE child_keep.table_name IS NULL OR parent_keep.table_name IS NULL
        ORDER BY fk.name
        FOR XML PATH(N''), TYPE
    ).value(N'.', N'nvarchar(max)');
    IF NULLIF(@sql, N'') IS NOT NULL EXEC sys.sp_executesql @sql;

    SELECT @sql =
    (
        SELECT N'DROP TABLE ' + QUOTENAME(s.name) + N'.' + QUOTENAME(t.name) + N';'
        FROM sys.tables AS t
        JOIN sys.schemas AS s ON s.schema_id = t.schema_id
        LEFT JOIN @keep AS k ON k.schema_name = s.name AND k.table_name = t.name
        WHERE t.is_ms_shipped = 0 AND k.table_name IS NULL
        ORDER BY s.name, t.name
        FOR XML PATH(N''), TYPE
    ).value(N'.', N'nvarchar(max)');
    IF NULLIF(@sql, N'') IS NOT NULL EXEC sys.sp_executesql @sql;

    IF (SELECT COUNT(*) FROM sys.tables WHERE is_ms_shipped = 0) <> 64
        THROW 50004, 'Final table count is not 64; rolling back.', 1;

    IF EXISTS
    (
        SELECT 1
        FROM sys.tables AS t
        JOIN sys.schemas AS s ON s.schema_id = t.schema_id
        LEFT JOIN @keep AS k ON k.schema_name = s.name AND k.table_name = t.name
        WHERE t.is_ms_shipped = 0 AND k.table_name IS NULL
    )
        THROW 50005, 'An unprotected table remains; rolling back.', 1;

    COMMIT TRANSACTION;
END TRY
BEGIN CATCH
    IF @@TRANCOUNT > 0 ROLLBACK TRANSACTION;
    THROW;
END CATCH;

SELECT
    DB_NAME() AS database_name,
    (SELECT COUNT(*) FROM sys.tables WHERE is_ms_shipped = 0) AS remaining_user_tables,
    (SELECT COUNT(*) FROM sys.views WHERE is_ms_shipped = 0) AS remaining_views,
    (SELECT COUNT(*) FROM sys.objects WHERE is_ms_shipped = 0 AND type IN (N'FN', N'IF', N'TF')) AS remaining_functions;
