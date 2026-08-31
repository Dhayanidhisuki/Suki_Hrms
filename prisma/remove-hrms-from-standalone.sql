/*
  Standalone Tools database cleanup
  ---------------------------------
  Removes only dbo tables named HRMS_* and the six non-Tools BI views that
  directly depend on those tables.

  Guarded for the verified Suki_Manpro_Tools copy created on 2026-08-27.
  A verified full backup must exist before this script is executed.
*/

SET NOCOUNT ON;
SET XACT_ABORT ON;

IF DB_NAME() <> N'Suki_Manpro_Tools'
    THROW 50000, 'Refusing to run outside Suki_Manpro_Tools.', 1;

IF (SELECT COUNT(*) FROM sys.tables WHERE schema_id = SCHEMA_ID(N'dbo') AND name LIKE N'HRMS[_]%') <> 89
    THROW 50001, 'Expected exactly 89 dbo.HRMS_* tables; no changes made.', 1;

IF OBJECT_ID(N'dbo.GAUGEANDTOOLS', N'U') IS NULL
   OR OBJECT_ID(N'dbo.EMPLOYEE', N'U') IS NULL
   OR OBJECT_ID(N'dbo.ERP_USER', N'U') IS NULL
   OR OBJECT_ID(N'dbo.SUPPLIER', N'U') IS NULL
   OR OBJECT_ID(N'dbo.SUBCONTRACTOR', N'U') IS NULL
    THROW 50002, 'Required Tools/shared tables are missing; no changes made.', 1;

BEGIN TRY
    BEGIN TRANSACTION;

    DROP VIEW IF EXISTS dbo.BI_Emp_Contact_Details;
    DROP VIEW IF EXISTS dbo.BI_Emp_Designation_Details;
    DROP VIEW IF EXISTS dbo.BI_Emp_Leave_Details;
    DROP VIEW IF EXISTS dbo.BI_Holiday_Dates;
    DROP VIEW IF EXISTS dbo.BI_Emp_Pesonal_Details;
    DROP VIEW IF EXISTS dbo.BI_Internal_Quality_Rejection_Details;

    DECLARE
        @child_schema sysname,
        @child_table sysname,
        @foreign_key sysname,
        @sql nvarchar(max);

    DECLARE hrms_fk_cursor CURSOR LOCAL FAST_FORWARD FOR
        SELECT
            OBJECT_SCHEMA_NAME(fk.parent_object_id),
            OBJECT_NAME(fk.parent_object_id),
            fk.name
        FROM sys.foreign_keys AS fk
        WHERE OBJECT_NAME(fk.parent_object_id) LIKE N'HRMS[_]%'
           OR OBJECT_NAME(fk.referenced_object_id) LIKE N'HRMS[_]%';

    OPEN hrms_fk_cursor;
    FETCH NEXT FROM hrms_fk_cursor INTO @child_schema, @child_table, @foreign_key;

    WHILE @@FETCH_STATUS = 0
    BEGIN
        SET @sql = N'ALTER TABLE ' + QUOTENAME(@child_schema) + N'.' +
            QUOTENAME(@child_table) + N' DROP CONSTRAINT ' + QUOTENAME(@foreign_key) + N';';
        EXEC sys.sp_executesql @sql;
        FETCH NEXT FROM hrms_fk_cursor INTO @child_schema, @child_table, @foreign_key;
    END;

    CLOSE hrms_fk_cursor;
    DEALLOCATE hrms_fk_cursor;

    DECLARE @hrms_table sysname;
    DECLARE hrms_table_cursor CURSOR LOCAL FAST_FORWARD FOR
        SELECT name
        FROM sys.tables
        WHERE schema_id = SCHEMA_ID(N'dbo')
          AND name LIKE N'HRMS[_]%'
        ORDER BY name;

    OPEN hrms_table_cursor;
    FETCH NEXT FROM hrms_table_cursor INTO @hrms_table;

    WHILE @@FETCH_STATUS = 0
    BEGIN
        SET @sql = N'DROP TABLE dbo.' + QUOTENAME(@hrms_table) + N';';
        EXEC sys.sp_executesql @sql;
        FETCH NEXT FROM hrms_table_cursor INTO @hrms_table;
    END;

    CLOSE hrms_table_cursor;
    DEALLOCATE hrms_table_cursor;

    IF EXISTS (
        SELECT 1
        FROM sys.tables
        WHERE schema_id = SCHEMA_ID(N'dbo')
          AND name LIKE N'HRMS[_]%'
    )
        THROW 50003, 'One or more HRMS tables remain; rolling back.', 1;

    COMMIT TRANSACTION;
END TRY
BEGIN CATCH
    IF CURSOR_STATUS('local', 'hrms_fk_cursor') >= 0 CLOSE hrms_fk_cursor;
    IF CURSOR_STATUS('local', 'hrms_fk_cursor') >= -1 DEALLOCATE hrms_fk_cursor;
    IF CURSOR_STATUS('local', 'hrms_table_cursor') >= 0 CLOSE hrms_table_cursor;
    IF CURSOR_STATUS('local', 'hrms_table_cursor') >= -1 DEALLOCATE hrms_table_cursor;
    IF @@TRANCOUNT > 0 ROLLBACK TRANSACTION;
    THROW;
END CATCH;

SELECT
    DB_NAME() AS database_name,
    (SELECT COUNT(*) FROM sys.tables WHERE is_ms_shipped = 0) AS remaining_user_tables,
    (SELECT COUNT(*) FROM sys.tables WHERE name LIKE N'HRMS[_]%') AS remaining_hrms_tables;
