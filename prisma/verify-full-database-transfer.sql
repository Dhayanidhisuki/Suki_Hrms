/*
  Full SQL Server database-transfer verification
  ------------------------------------------------
  Run this script against BOTH:
    1. Source: ERPDb_Manpro
    2. Target: Suki_Manpro_Tools

  Export every result set to files and compare them. This script is read-only.
  It uses metadata row counts (sys.dm_db_partition_stats), so it does not scan
  the contents of hundreds of large tables.
*/

SET NOCOUNT ON;

-- 1. Database identity and compatibility
SELECT
    @@SERVERNAME AS server_name,
    DB_NAME() AS database_name,
    d.database_id,
    d.compatibility_level,
    d.collation_name,
    d.recovery_model_desc,
    d.state_desc,
    d.user_access_desc,
    d.is_read_committed_snapshot_on,
    d.is_broker_enabled
FROM sys.databases d
WHERE d.name = DB_NAME();

-- 2. Complete user-table inventory and metadata row counts
-- Aggregate rows and columns separately to avoid multiplying row counts.
;WITH table_rows AS
(
    SELECT object_id, SUM(row_count) AS row_count
    FROM sys.dm_db_partition_stats
    WHERE index_id IN (0, 1)
    GROUP BY object_id
),
column_counts AS
(
    SELECT object_id, COUNT(*) AS column_count
    FROM sys.columns
    GROUP BY object_id
)
SELECT
    s.name AS schema_name,
    t.name AS table_name,
    ISNULL(r.row_count, 0) AS row_count,
    ISNULL(cc.column_count, 0) AS column_count,
    t.temporal_type_desc,
    t.is_memory_optimized,
    t.is_filetable
FROM sys.tables t
JOIN sys.schemas s ON s.schema_id = t.schema_id
LEFT JOIN table_rows r ON r.object_id = t.object_id
LEFT JOIN column_counts cc ON cc.object_id = t.object_id
WHERE t.is_ms_shipped = 0
ORDER BY s.name, t.name;

-- 3. Exact column definitions for every user table
SELECT
    s.name AS schema_name,
    t.name AS table_name,
    c.column_id,
    c.name AS column_name,
    ty.name AS data_type,
    c.max_length,
    c.precision,
    c.scale,
    c.is_nullable,
    c.is_identity,
    c.is_computed,
    dc.definition AS default_definition,
    cc.definition AS computed_definition
FROM sys.tables t
JOIN sys.schemas s ON s.schema_id = t.schema_id
JOIN sys.columns c ON c.object_id = t.object_id
JOIN sys.types ty ON ty.user_type_id = c.user_type_id
LEFT JOIN sys.default_constraints dc ON dc.object_id = c.default_object_id
LEFT JOIN sys.computed_columns cc
    ON cc.object_id = c.object_id AND cc.column_id = c.column_id
WHERE t.is_ms_shipped = 0
ORDER BY s.name, t.name, c.column_id;

-- 4. Primary keys, unique constraints and indexes.
-- One row per index column keeps this compatible with pre-2017 SQL Server.
SELECT
    s.name AS schema_name,
    t.name AS table_name,
    i.name AS index_name,
    i.type_desc,
    i.is_primary_key,
    i.is_unique,
    i.is_unique_constraint,
    i.is_disabled,
    ic.key_ordinal,
    ic.is_included_column,
    ic.index_column_id,
    c.name AS indexed_column,
    ic.is_descending_key
FROM sys.tables t
JOIN sys.schemas s ON s.schema_id = t.schema_id
JOIN sys.indexes i ON i.object_id = t.object_id
LEFT JOIN sys.index_columns ic
    ON ic.object_id = i.object_id AND ic.index_id = i.index_id
LEFT JOIN sys.columns c ON c.object_id = ic.object_id AND c.column_id = ic.column_id
WHERE t.is_ms_shipped = 0 AND i.index_id > 0
ORDER BY
    s.name, t.name, i.name,
    ic.is_included_column, ic.key_ordinal, ic.index_column_id;

-- 5. Foreign keys, including trust/disabled state
SELECT
    OBJECT_SCHEMA_NAME(fk.parent_object_id) AS child_schema,
    OBJECT_NAME(fk.parent_object_id) AS child_table,
    fk.name AS foreign_key_name,
    OBJECT_SCHEMA_NAME(fk.referenced_object_id) AS parent_schema,
    OBJECT_NAME(fk.referenced_object_id) AS parent_table,
    fk.delete_referential_action_desc,
    fk.update_referential_action_desc,
    fk.is_disabled,
    fk.is_not_trusted
FROM sys.foreign_keys fk
ORDER BY child_schema, child_table, foreign_key_name;

-- 6. All programmable/database objects that must survive a full restore
SELECT
    s.name AS schema_name,
    o.name AS object_name,
    o.type,
    o.type_desc,
    o.create_date,
    o.modify_date
FROM sys.objects o
JOIN sys.schemas s ON s.schema_id = o.schema_id
WHERE o.is_ms_shipped = 0
  AND o.type IN ('V', 'P', 'FN', 'IF', 'TF', 'TR', 'SO', 'SN')
ORDER BY o.type_desc, s.name, o.name;

-- 7. Sequences
SELECT
    SCHEMA_NAME(schema_id) AS schema_name,
    name AS sequence_name,
    start_value,
    increment,
    minimum_value,
    maximum_value,
    is_cycling,
    current_value
FROM sys.sequences
ORDER BY schema_name, sequence_name;

-- 8. Synonyms and their external targets
SELECT
    SCHEMA_NAME(schema_id) AS schema_name,
    name AS synonym_name,
    base_object_name
FROM sys.synonyms
ORDER BY schema_name, synonym_name;

-- 9. Dependencies that point outside the current database/server
SELECT DISTINCT
    OBJECT_SCHEMA_NAME(d.referencing_id) AS referencing_schema,
    OBJECT_NAME(d.referencing_id) AS referencing_object,
    o.type_desc AS referencing_type,
    d.referenced_server_name,
    d.referenced_database_name,
    d.referenced_schema_name,
    d.referenced_entity_name
FROM sys.sql_expression_dependencies d
LEFT JOIN sys.objects o ON o.object_id = d.referencing_id
WHERE d.referenced_server_name IS NOT NULL
   OR (d.referenced_database_name IS NOT NULL AND d.referenced_database_name <> DB_NAME())
ORDER BY referencing_schema, referencing_object;

-- 10. Database principals and role membership.
-- Database users transfer with the backup; SQL logins are server-level and must
-- be recreated/mapped separately on the target.
SELECT
    p.name AS principal_name,
    p.type_desc,
    p.authentication_type_desc,
    p.default_schema_name,
    p.sid
FROM sys.database_principals p
WHERE p.principal_id > 4
  AND p.type NOT IN ('A', 'R')
ORDER BY p.name;

SELECT
    role_principal.name AS database_role,
    member_principal.name AS member_name
FROM sys.database_role_members drm
JOIN sys.database_principals role_principal
    ON role_principal.principal_id = drm.role_principal_id
JOIN sys.database_principals member_principal
    ON member_principal.principal_id = drm.member_principal_id
ORDER BY database_role, member_name;

-- 11. One-line totals for quick source/target comparison
SELECT
    (SELECT COUNT(*) FROM sys.tables WHERE is_ms_shipped = 0) AS user_tables,
    (SELECT COUNT(*) FROM sys.views WHERE is_ms_shipped = 0) AS views,
    (SELECT COUNT(*) FROM sys.procedures WHERE is_ms_shipped = 0) AS procedures,
    (SELECT COUNT(*) FROM sys.objects WHERE is_ms_shipped = 0 AND type IN ('FN', 'IF', 'TF')) AS functions,
    (SELECT COUNT(*) FROM sys.triggers WHERE is_ms_shipped = 0) AS triggers,
    (SELECT COUNT(*) FROM sys.foreign_keys) AS foreign_keys,
    (SELECT COUNT(*) FROM sys.indexes WHERE index_id > 0 AND is_hypothetical = 0) AS indexes,
    (SELECT COUNT(*) FROM sys.sequences) AS sequences,
    (SELECT COUNT(*) FROM sys.synonyms) AS synonyms;
