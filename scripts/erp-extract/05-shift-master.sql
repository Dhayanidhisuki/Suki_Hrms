/*  ERPDB_KUN_HRMS — HRMS_SHIFT_MASTER column list and data
    Generated 31 August 2026.

    READ ONLY. Two SELECTs only: column list, then the 4 rows themselves.
    Not previously extracted — found via the 1.1 discovery query's full
    table list, not in the original 26-table scope.
*/

USE ERPDB_KUN_HRMS;
GO

SELECT  ORDINAL_POSITION, COLUMN_NAME, DATA_TYPE,
        CHARACTER_MAXIMUM_LENGTH, IS_NULLABLE
FROM    INFORMATION_SCHEMA.COLUMNS
WHERE   TABLE_NAME = 'HRMS_SHIFT_MASTER'
ORDER BY ORDINAL_POSITION;
GO

SELECT * FROM HRMS_SHIFT_MASTER;
GO
