-- ═══════════════════════════════════════════════════════════════════
-- SUKI ERP → Sample DB (suki_tools_management) Complete Sync Script
-- Run while connected to the ORIGINAL ERP database
-- Both DBs must be on the same SQL Server instance
-- ═══════════════════════════════════════════════════════════════════

-- ═══════════════════════════════════════════════════════════════════
-- STEP 1: CLEAR SAMPLE DB TABLES (run on suki_tools_management)
-- ═══════════════════════════════════════════════════════════════════

USE suki_tools_management;

DELETE FROM GAUGE_CONTROL_CARD_TRANS;
DELETE FROM GAUGE_CONTROL_CARD;
DELETE FROM TOOLS_TRANS_RECEIVE_FOR_CALIBRATION;
DELETE FROM TOOLS_RECEIVE_FOR_CALIBRATION;
DELETE FROM TOOLS_TRANS_ISSUE_FOR_CALIBRATION;
DELETE FROM TOOLS_ISSUE_FOR_CALIBRATION;
DELETE FROM TOOLS_PO_SCH_TRANS;
DELETE FROM TOOLS_PO_SCH_MASTER;
DELETE FROM TOOLS_PO_RECEIVE_TRANS;
DELETE FROM TOOLS_PO_RECEIVE;
DELETE FROM TOOLS_CONSUMPTION_TRANS_ISSUE;
DELETE FROM TOOLS_ISSUE_RECEIVED_TRANS;
DELETE FROM TOOLS_ISSUE_RECEIVED;
DELETE FROM TOOLS_TRANS_ISSUE;
DELETE FROM GAUGE_TOOLS_ISSUE;
DELETE FROM TOOLS_MACHINE_TRANS;
DELETE FROM TOOLS_MAPPING;
DELETE FROM TOOLS_PRICE_MASTER;
DELETE FROM TOOLS_SPECIFICATION;
DELETE FROM TOOLS_DETAILS;
DELETE FROM GAUGE_SERIAL_NO;
DELETE FROM GAUGEANDTOOLS;
DELETE FROM QMS_OTHER_TOOLS_TYPE;
DELETE FROM OTHER_TOOLS_TYPE;
DELETE FROM GAUGE_TYPE;
DELETE FROM TOOLS_TYPE;
DELETE FROM SUBCONTRACTOR;
DELETE FROM SUPPLIER;
DELETE FROM EMPLOYEE;
DELETE FROM ERP_USER;

DBCC CHECKIDENT ('SUPPLIER', RESEED, 0);
DBCC CHECKIDENT ('SUBCONTRACTOR', RESEED, 0);
DBCC CHECKIDENT ('TOOLS_TYPE', RESEED, 0);
DBCC CHECKIDENT ('GAUGE_TYPE', RESEED, 0);
DBCC CHECKIDENT ('OTHER_TOOLS_TYPE', RESEED, 0);
DBCC CHECKIDENT ('QMS_OTHER_TOOLS_TYPE', RESEED, 0);
DBCC CHECKIDENT ('GAUGEANDTOOLS', RESEED, 0);
DBCC CHECKIDENT ('GAUGE_SERIAL_NO', RESEED, 0);
DBCC CHECKIDENT ('TOOLS_DETAILS', RESEED, 0);
DBCC CHECKIDENT ('TOOLS_SPECIFICATION', RESEED, 0);
DBCC CHECKIDENT ('TOOLS_PRICE_MASTER', RESEED, 0);
DBCC CHECKIDENT ('TOOLS_MAPPING', RESEED, 0);
DBCC CHECKIDENT ('TOOLS_MACHINE_TRANS', RESEED, 0);
DBCC CHECKIDENT ('GAUGE_TOOLS_ISSUE', RESEED, 0);
DBCC CHECKIDENT ('TOOLS_TRANS_ISSUE', RESEED, 0);
DBCC CHECKIDENT ('TOOLS_ISSUE_RECEIVED', RESEED, 0);
DBCC CHECKIDENT ('TOOLS_ISSUE_RECEIVED_TRANS', RESEED, 0);
DBCC CHECKIDENT ('TOOLS_CONSUMPTION_TRANS_ISSUE', RESEED, 0);
DBCC CHECKIDENT ('TOOLS_PO_RECEIVE', RESEED, 0);
DBCC CHECKIDENT ('TOOLS_PO_RECEIVE_TRANS', RESEED, 0);
DBCC CHECKIDENT ('TOOLS_PO_SCH_MASTER', RESEED, 0);
DBCC CHECKIDENT ('TOOLS_PO_SCH_TRANS', RESEED, 0);
DBCC CHECKIDENT ('TOOLS_ISSUE_FOR_CALIBRATION', RESEED, 0);
DBCC CHECKIDENT ('TOOLS_TRANS_ISSUE_FOR_CALIBRATION', RESEED, 0);
DBCC CHECKIDENT ('TOOLS_RECEIVE_FOR_CALIBRATION', RESEED, 0);
DBCC CHECKIDENT ('TOOLS_TRANS_RECEIVE_FOR_CALIBRATION', RESEED, 0);
DBCC CHECKIDENT ('GAUGE_CONTROL_CARD', RESEED, 0);
DBCC CHECKIDENT ('GAUGE_CONTROL_CARD_TRANS', RESEED, 0);


-- ═══════════════════════════════════════════════════════════════════
-- STEP 2: INSERT DATA (switch back to ERP database)
-- ═══════════════════════════════════════════════════════════════════

USE ERPDb_ESSKAY;
-- This script only READS from ERP tables — it never writes to them


-- ═══════════════════════════════════════════════════════════════════
-- 2.1 ERP_USER
-- ═══════════════════════════════════════════════════════════════════

INSERT INTO suki_tools_management.dbo.ERP_USER (
    USER_ID, ROLE_NAME, ADD_ROLE_NAME, EMP_CD, IS_ACTIVE
)
SELECT
    USER_ID,
    ISNULL(LEFT(ROLE_NAME, 50), 'Viewer'),
    LEFT(ADD_ROLE_NAME, 50),
    CAST(EMP_CD AS VARCHAR(20)),
    CASE WHEN STATUS = 'ACTIVE' THEN 1 ELSE 0 END
FROM ERP_USER;


-- ═══════════════════════════════════════════════════════════════════
-- 2.2 EMPLOYEE
-- ═══════════════════════════════════════════════════════════════════

INSERT INTO suki_tools_management.dbo.EMPLOYEE (
    EMP_CD, EMP_NAME, DEPT_NAME, DEPT_CODE, IS_ACTIVE
)
SELECT
    CAST(EMP_CD AS VARCHAR(20)),
    LTRIM(RTRIM(
        ISNULL(FIRST_NAME, '') +
        CASE WHEN ISNULL(LAST_NAME, '') <> '' AND ISNULL(LAST_NAME, '') <> '-----'
             THEN ' ' + LAST_NAME ELSE '' END
    )),
    NULL,
    CASE WHEN DEPT_NO IS NOT NULL AND DEPT_NO <> 0
         THEN CAST(DEPT_NO AS VARCHAR(20)) ELSE NULL END,
    CASE WHEN ISNULL(LEFT_COMPANY, 'No') = 'No' THEN 1 ELSE 0 END
FROM EMPLOYEE;


-- ═══════════════════════════════════════════════════════════════════
-- 2.3 SUPPLIER
-- ═══════════════════════════════════════════════════════════════════

SET IDENTITY_INSERT suki_tools_management.dbo.SUPPLIER ON;

INSERT INTO suki_tools_management.dbo.SUPPLIER (
    ID, SUP_CODE, SUP_NAME, ADDRESS, CITY, STATE, GSTIN, PHONE, EMAIL,
    BANK_NAME, ACCOUNT_NO, IFSC_CODE, APPROVED_SUPPLIER, STATUS,
    CREAT_USER_ID_CD, CREAT_DT, LST_UPDT_USER_ID_CD, LST_UPDT_DT
)
SELECT
    ROW_NUMBER() OVER (ORDER BY SUP_CODE),
    SUP_CODE,
    SUP_NAME,
    LTRIM(RTRIM(ISNULL(ADD1, '') +
        CASE WHEN ISNULL(ADD2, '') <> '' THEN ', ' + ADD2 ELSE '' END)),
    CITY,
    STATE,
    GSTIN,
    ISNULL(NULLIF(PHONE1, ''), PHONE2),
    EMAIL_ID,
    BANK_NAME,
    ACCOUNT_NUMBER,
    IFSC_CODE,
    CASE WHEN ISNULL(APPROVED_SUPPLIER, 'No') = 'Yes' THEN 1 ELSE 0 END,
    CASE WHEN ISNULL(STATUS, 'ACTIVE') = 'ACTIVE' THEN 'Active' ELSE 'Inactive' END,
    ISNULL(CREAT_USER_ID_CD, 'SYSTEM'),
    ISNULL(CREAT_DT, GETDATE()),
    LST_UPDT_USER_ID_CD,
    ISNULL(LST_UPDT_TS, GETDATE())
FROM SUPPLIER;

SET IDENTITY_INSERT suki_tools_management.dbo.SUPPLIER OFF;


-- ═══════════════════════════════════════════════════════════════════
-- 2.4 SUBCONTRACTOR
-- ═══════════════════════════════════════════════════════════════════

SET IDENTITY_INSERT suki_tools_management.dbo.SUBCONTRACTOR ON;

INSERT INTO suki_tools_management.dbo.SUBCONTRACTOR (
    ID, SUB_CODE, SUB_NAME, NATURE_OF_WORK, IS_STORE_VENDOR, IS_INHOUSE,
    IS_ISSUE_DC, ADDRESS, GSTIN, STATUS, CREAT_USER_ID_CD, CREAT_DT,
    LST_UPDT_USER_ID_CD, LST_UPDT_DT
)
SELECT
    ROW_NUMBER() OVER (ORDER BY SUB_CON_ID),
    CAST(SUB_CON_ID AS VARCHAR(20)),
    SUB_NAME,
    NATURE_OF_WORK,
    CASE WHEN ISNULL(IS_STORE_VENDOR, 'No') = 'Yes' THEN 1 ELSE 0 END,
    CASE WHEN ISNULL(IS_INHOUSE, 'No') = 'Yes' THEN 1 ELSE 0 END,
    CASE WHEN ISNULL(IS_ISSUE_DC, 'No') = 'Yes' THEN 1 ELSE 0 END,
    LTRIM(RTRIM(ISNULL(ADD1, '') +
        CASE WHEN ISNULL(ADD2, '') <> '' THEN ', ' + ADD2 ELSE '' END)),
    GSTIN,
    CASE WHEN ISNULL(STATUS, 'ACTIVE') = 'ACTIVE' THEN 'Active' ELSE 'Inactive' END,
    ISNULL(CREAT_USER_ID_CD, 'SYSTEM'),
    ISNULL(CREAT_DT, GETDATE()),
    LST_UPDT_USER_ID_CD,
    ISNULL(LST_UPDT_TS, GETDATE())
FROM SUBCONTRACTOR;

SET IDENTITY_INSERT suki_tools_management.dbo.SUBCONTRACTOR OFF;


-- ═══════════════════════════════════════════════════════════════════
-- 2.5 TOOLS_TYPE
-- ═══════════════════════════════════════════════════════════════════

SET IDENTITY_INSERT suki_tools_management.dbo.TOOLS_TYPE ON;

INSERT INTO suki_tools_management.dbo.TOOLS_TYPE (
    ID, CODE, NAME, DESCRIPTION, CREAT_USER_ID_CD, CREAT_DT
)
SELECT
    ROW_ID,
    CAST(ROW_ID AS VARCHAR(20)),
    TYPE_OF_TOOLS,
    NULL,
    ISNULL(CREAT_USER_ID_CD, 'SYSTEM'),
    ISNULL(CREAT_DT, GETDATE())
FROM TOOLS_TYPE;

SET IDENTITY_INSERT suki_tools_management.dbo.TOOLS_TYPE OFF;


-- ═══════════════════════════════════════════════════════════════════
-- 2.6 GAUGE_TYPE
-- ═══════════════════════════════════════════════════════════════════

SET IDENTITY_INSERT suki_tools_management.dbo.GAUGE_TYPE ON;

INSERT INTO suki_tools_management.dbo.GAUGE_TYPE (
    ID, CODE, NAME, DESCRIPTION, CREAT_USER_ID_CD, CREAT_DT
)
SELECT
    ROW_ID,
    CAST(ROW_ID AS VARCHAR(20)),
    TYPE_OF_GAUGE,
    NULL,
    ISNULL(CREAT_USER_ID_CD, 'SYSTEM'),
    ISNULL(CREAT_DT, GETDATE())
FROM GAUGE_TYPE;

SET IDENTITY_INSERT suki_tools_management.dbo.GAUGE_TYPE OFF;


-- ═══════════════════════════════════════════════════════════════════
-- 2.7 OTHER_TOOLS_TYPE
-- ═══════════════════════════════════════════════════════════════════

SET IDENTITY_INSERT suki_tools_management.dbo.OTHER_TOOLS_TYPE ON;

INSERT INTO suki_tools_management.dbo.OTHER_TOOLS_TYPE (
    ID, CODE, NAME, PREFIX_TOOLS_NO, PO_PREFIX, GRN_PREFIX, INDENT_PREFIX,
    CREAT_USER_ID_CD, CREAT_DT
)
SELECT
    ROW_ID,
    CAST(ROW_ID AS VARCHAR(20)),
    OTHER_TYPE,
    PREFIX_TOOLS_NO,
    PO_PREFIX,
    GRN_PREFIX,
    INDENT_PREFIX,
    ISNULL(CREAT_USER_ID_CD, 'SYSTEM'),
    ISNULL(CREAT_DT, GETDATE())
FROM OTHER_TOOLS_TYPE;

SET IDENTITY_INSERT suki_tools_management.dbo.OTHER_TOOLS_TYPE OFF;


-- ═══════════════════════════════════════════════════════════════════
-- 2.8 QMS_OTHER_TOOLS_TYPE
-- ═══════════════════════════════════════════════════════════════════

SET IDENTITY_INSERT suki_tools_management.dbo.QMS_OTHER_TOOLS_TYPE ON;

INSERT INTO suki_tools_management.dbo.QMS_OTHER_TOOLS_TYPE (
    ID, CODE, NAME, REF_GROUP_ID, CREAT_USER_ID_CD, CREAT_DT
)
SELECT
    ROW_ID,
    CAST(ROW_ID AS VARCHAR(20)),
    QMS_OTHER_TYPE_OF_TOOLS,
    REF_GROUP_ID,
    ISNULL(CREAT_USER_ID_CD, 'SYSTEM'),
    ISNULL(CREAT_DT, GETDATE())
FROM QMS_OTHER_TOOLS_TYPE;

SET IDENTITY_INSERT suki_tools_management.dbo.QMS_OTHER_TOOLS_TYPE OFF;


-- ═══════════════════════════════════════════════════════════════════
-- 2.9 GAUGEANDTOOLS (core tools registry)
-- ═══════════════════════════════════════════════════════════════════

SET IDENTITY_INSERT suki_tools_management.dbo.GAUGEANDTOOLS ON;

INSERT INTO suki_tools_management.dbo.GAUGEANDTOOLS (
    ID, TOOL_OR_GAUGE_NO, NAME, DES, SIZE, SHAPE, GROUPING, TYPE,
    SERIAL_NO_GEN_REQ, TOT_QTY, QTY_IN, QTY_OUT, QTY_NEW,
    LOCATION, DEPT_NAME, STATUS, CALIBRATION_FRQ_MONTHS, CALI_PLANNED_WHO,
    LAST_CALIBRATION_DATE, NEXT_C_DATE, SUP_CODE,
    CREAT_USER_ID_CD, LST_UPDT_USER_ID_CD, CREAT_DT, LST_UPDT_DT
)
SELECT
    REF_NO,
    TOOL_OR_GAUGE_NO,
    NAME,
    DES,
    SIZE,
    SHAPE,
    GROUPING,
    TYPE,
    CASE WHEN ISNULL(SERIAL_NO_GEN_REQ, 'No') IN ('Yes', '1', 'true') THEN 1 ELSE 0 END,
    ISNULL(TOT_QTY, 0),
    ISNULL(QTY_IN, 0),
    ISNULL(QTY_OUT, 0),
    ISNULL(QTY_NEW, 0),
    LOCATION,
    DEPT_NAME,
    ISNULL(STATUS, 'Available'),
    CALIBRATION_FRQ_MONTHS,
    CALI_PLANNED_WHO,
    NULL,
    NULL,
    NULL,
    ISNULL(CREAT_USER_ID_CD, 'SYSTEM'),
    LST_UPDT_USER_ID_CD,
    ISNULL(CREAT_DT, GETDATE()),
    ISNULL(LST_UPDT_TS, GETDATE())
FROM GAUGEANDTOOLS;

SET IDENTITY_INSERT suki_tools_management.dbo.GAUGEANDTOOLS OFF;


-- ═══════════════════════════════════════════════════════════════════
-- 2.10 GAUGE_SERIAL_NO
-- ═══════════════════════════════════════════════════════════════════

SET IDENTITY_INSERT suki_tools_management.dbo.GAUGE_SERIAL_NO ON;

INSERT INTO suki_tools_management.dbo.GAUGE_SERIAL_NO (
    ID, TOOL_OR_GAUGE_NO, SERIAL_NO, STATUS, CREAT_DT
)
SELECT
    gs.REF_NO,
    gs.TOOL_OR_GAUGE_NO,
    CAST(gs.SERIAL_NO AS VARCHAR(50)) + '-' + CAST(gs.REF_NO AS VARCHAR(10)),
    ISNULL(gs.STATUS, 'Available'),
    ISNULL(gs.CREAT_DT, GETDATE())
FROM GAUGE_SERIAL_NO gs
INNER JOIN GAUGEANDTOOLS g ON gs.TOOL_OR_GAUGE_NO = g.TOOL_OR_GAUGE_NO;

SET IDENTITY_INSERT suki_tools_management.dbo.GAUGE_SERIAL_NO OFF;


-- ═══════════════════════════════════════════════════════════════════
-- 2.11 TOOLS_DETAILS (unpivot ERP fixed columns → key-value pairs)
-- ═══════════════════════════════════════════════════════════════════

SET IDENTITY_INSERT suki_tools_management.dbo.TOOLS_DETAILS ON;

INSERT INTO suki_tools_management.dbo.TOOLS_DETAILS (
    ID, TOOL_OR_GAUGE_NO, DETAIL_KEY, DETAIL_VALUE, CREAT_DT
)
SELECT
    ROW_NUMBER() OVER (ORDER BY d.ROW_ID, kv.DetailKey),
    g.TOOL_OR_GAUGE_NO,
    kv.DetailKey,
    kv.DetailValue,
    ISNULL(d.CREAT_DT, GETDATE())
FROM TOOLS_DETAILS d
JOIN GAUGEANDTOOLS g ON d.TOOL_REF_NO = g.REF_NO
CROSS APPLY (
    VALUES ('NO_OF_CAVITY', CAST(d.NO_OF_CAVITY AS NVARCHAR(500))),
           ('RUNNING_CAVITY', CAST(d.RUNNING_CAVITY AS NVARCHAR(500))),
           ('TOOL_LIFE', CAST(d.TOOL_LIFE AS NVARCHAR(500))),
           ('BALANCE_TOOL_LIFE', CAST(d.BALANCE_TOOL_LIFE AS NVARCHAR(500))),
           ('RUNNING_TOOL_LIFE', CAST(d.RUNNING_TOOL_LIFE AS NVARCHAR(500))),
           ('SERVICE_TOOL_LIFE', CAST(d.SERVICE_TOOL_LIFE AS NVARCHAR(500))),
           ('HARDNESS', CAST(d.HARDNESS AS NVARCHAR(500))),
           ('SHRINKAGE', CAST(d.SHRINKAGE AS NVARCHAR(500))),
           ('COMPOUND_CODE', CAST(d.COMPOUND_CODE AS NVARCHAR(500))),
           ('DRAWING_NO', CAST(d.DRAWING_NO AS NVARCHAR(500))),
           ('RUNNING_SERVICE_LIFE', CAST(d.RUNNING_SERVICE_LIFE AS NVARCHAR(500)))
) kv(DetailKey, DetailValue)
WHERE kv.DetailValue IS NOT NULL;

SET IDENTITY_INSERT suki_tools_management.dbo.TOOLS_DETAILS OFF;


-- ═══════════════════════════════════════════════════════════════════
-- 2.12 TOOLS_SPECIFICATION
-- ═══════════════════════════════════════════════════════════════════

SET IDENTITY_INSERT suki_tools_management.dbo.TOOLS_SPECIFICATION ON;

INSERT INTO suki_tools_management.dbo.TOOLS_SPECIFICATION (
    ID, TOOL_OR_GAUGE_NO, SPEC_NAME, SPEC_VALUE, UNIT, CREAT_DT
)
SELECT
    ROW_ID,
    g.TOOL_OR_GAUGE_NO,
    PARAMETER,
    SPECIFICATION,
    NULL,
    ISNULL(s.CREAT_DT, GETDATE())
FROM TOOLS_SPECIFICATION s
JOIN GAUGEANDTOOLS g ON s.TOOL_REF_NO = g.REF_NO
WHERE s.PARAMETER IS NOT NULL;

SET IDENTITY_INSERT suki_tools_management.dbo.TOOLS_SPECIFICATION OFF;


-- ═══════════════════════════════════════════════════════════════════
-- 2.13 TOOLS_PRICE_MASTER
-- ═══════════════════════════════════════════════════════════════════

SET IDENTITY_INSERT suki_tools_management.dbo.TOOLS_PRICE_MASTER ON;

INSERT INTO suki_tools_management.dbo.TOOLS_PRICE_MASTER (
    ID, TOOL_OR_GAUGE_NO, EFFECTIVE_DATE, SUP_CODE, UNIT_RATE, GRN_NO,
    CREAT_USER_ID_CD, CREAT_DT
)
SELECT
    p.ROW_ID,
    g.TOOL_OR_GAUGE_NO,
    ISNULL(p.REV_DATE, GETDATE()),
    p.SUP_CODE,
    ISNULL(p.RATE, 0),
    NULL,
    ISNULL(p.CREAT_USER_ID_CD, 'SYSTEM'),
    ISNULL(p.CREAT_DT, GETDATE())
FROM TOOLS_PRICE_MASTER p
JOIN GAUGEANDTOOLS g ON p.TOOL_REF_NO = g.REF_NO;

SET IDENTITY_INSERT suki_tools_management.dbo.TOOLS_PRICE_MASTER OFF;


-- ═══════════════════════════════════════════════════════════════════
-- 2.14 TOOLS_MAPPING
-- ═══════════════════════════════════════════════════════════════════

SET IDENTITY_INSERT suki_tools_management.dbo.TOOLS_MAPPING ON;

INSERT INTO suki_tools_management.dbo.TOOLS_MAPPING (
    ID, TOOL_OR_GAUGE_NO, SUP_CODE, CREAT_DT
)
SELECT
    m.ROW_ID,
    g.TOOL_OR_GAUGE_NO,
    m.SUP_CODE,
    ISNULL(m.CREAT_DT, GETDATE())
FROM (
    SELECT m.ROW_ID, m.TOOL_REF_NO, m.SUP_CODE, m.CREAT_DT,
           ROW_NUMBER() OVER (PARTITION BY m.TOOL_REF_NO, m.SUP_CODE ORDER BY m.ROW_ID) AS rn
    FROM TOOLS_MAPPING m
    WHERE m.SUP_CODE IS NOT NULL
) m
JOIN GAUGEANDTOOLS g ON m.TOOL_REF_NO = g.REF_NO
INNER JOIN suki_tools_management.dbo.SUPPLIER s ON m.SUP_CODE = s.SUP_CODE
WHERE m.rn = 1;

SET IDENTITY_INSERT suki_tools_management.dbo.TOOLS_MAPPING OFF;


-- ═══════════════════════════════════════════════════════════════════
-- 2.15 TOOLS_MACHINE_TRANS
-- ═══════════════════════════════════════════════════════════════════

SET IDENTITY_INSERT suki_tools_management.dbo.TOOLS_MACHINE_TRANS ON;

INSERT INTO suki_tools_management.dbo.TOOLS_MACHINE_TRANS (
    ID, TOOL_OR_GAUGE_NO, MAC_CODE, CREAT_DT
)
SELECT
    t.ROW_ID,
    g.TOOL_OR_GAUGE_NO,
    t.MAC_CODE,
    ISNULL(t.CREAT_DT, GETDATE())
FROM TOOLS_MACHINE_TRANS t
JOIN GAUGEANDTOOLS g ON t.TOOL_REF_NO = g.REF_NO;

SET IDENTITY_INSERT suki_tools_management.dbo.TOOLS_MACHINE_TRANS OFF;


-- ═══════════════════════════════════════════════════════════════════
-- 2.16 GAUGE_TOOLS_ISSUE (header)
-- ═══════════════════════════════════════════════════════════════════

SET IDENTITY_INSERT suki_tools_management.dbo.GAUGE_TOOLS_ISSUE ON;

INSERT INTO suki_tools_management.dbo.GAUGE_TOOLS_ISSUE (
    ID, DC_NO, DEPT_NAME, PARTY_NAME, ISSUE_DATE, DUE_DATE, STATUS,
    CREAT_USER_ID_CD, CREAT_DT, LST_UPDT_USER_ID_CD, LST_UPDT_DT
)
SELECT
    ROW_NUMBER() OVER (ORDER BY DC_NO),
    DC_NO,
    ISNULL(ITEM_TYPE, 'General'),
    ISNULL(RECEIVE_NAME, 'Unknown'),
    ISNULL(ISSUE_DATE, GETDATE()),
    ISNULL(DUE_DATE, GETDATE()),
    'OPEN',
    ISNULL(CREAT_USER_ID_CD, 'SYSTEM'),
    ISNULL(CREAT_DT, GETDATE()),
    LST_UPDT_USER_ID_CD,
    ISNULL(LST_UPDT_TS, GETDATE())
FROM GAUGE_TOOLS_ISSUE;

SET IDENTITY_INSERT suki_tools_management.dbo.GAUGE_TOOLS_ISSUE OFF;


-- ═══════════════════════════════════════════════════════════════════
-- 2.17 TOOLS_TRANS_ISSUE (lines)
-- ═══════════════════════════════════════════════════════════════════

SET IDENTITY_INSERT suki_tools_management.dbo.TOOLS_TRANS_ISSUE ON;

INSERT INTO suki_tools_management.dbo.TOOLS_TRANS_ISSUE (
    ID, DC_NO, TOOL_OR_GAUGE_NO, QTY_ISSUED, QTY_RETURNED, REMAINING_QTY,
    STATUS, CREAT_DT
)
SELECT
    ROW_ID,
    DC_NO,
    TOOL_OR_GAUGE_NO,
    ISNULL(ISSUE_QTY, 0),
    0,
    ISNULL(ISSUE_QTY, 0),
    ISNULL(STATUS, 'Open'),
    ISNULL(CREAT_DT, GETDATE())
FROM TOOLS_TRANS_ISSUE
WHERE TOOL_OR_GAUGE_NO IS NOT NULL;

SET IDENTITY_INSERT suki_tools_management.dbo.TOOLS_TRANS_ISSUE OFF;


-- ═══════════════════════════════════════════════════════════════════
-- 2.18 TOOLS_ISSUE_RECEIVED (header)
-- ═══════════════════════════════════════════════════════════════════

SET IDENTITY_INSERT suki_tools_management.dbo.TOOLS_ISSUE_RECEIVED ON;

INSERT INTO suki_tools_management.dbo.TOOLS_ISSUE_RECEIVED (
    ID, RECEIVE_NO, DC_NO, RECEIVE_DATE, REMARKS, CREAT_USER_ID_CD, CREAT_DT
)
SELECT
    ROW_NUMBER() OVER (ORDER BY REC_NO),
    CAST(REC_NO AS VARCHAR(30)),
    DC_NO,
    ISNULL(RECEIVE_DATE, GETDATE()),
    STATUS,
    ISNULL(CREAT_USER_ID_CD, 'SYSTEM'),
    ISNULL(CREAT_DT, GETDATE())
FROM TOOLS_ISSUE_RECEIVED;

SET IDENTITY_INSERT suki_tools_management.dbo.TOOLS_ISSUE_RECEIVED OFF;


-- ═══════════════════════════════════════════════════════════════════
-- 2.19 TOOLS_ISSUE_RECEIVED_TRANS (lines)
-- ═══════════════════════════════════════════════════════════════════

SET IDENTITY_INSERT suki_tools_management.dbo.TOOLS_ISSUE_RECEIVED_TRANS ON;

INSERT INTO suki_tools_management.dbo.TOOLS_ISSUE_RECEIVED_TRANS (
    ID, RECEIVE_NO, TOOL_OR_GAUGE_NO, QTY_RETURNED, CREAT_DT
)
SELECT
    ROW_ID,
    CAST(REC_NO AS VARCHAR(30)),
    TOOL_OR_GAUGE_NO,
    ISNULL(QUANTITY, 0),
    ISNULL(CREAT_DT, GETDATE())
FROM TOOLS_ISSUE_RECEIVED_TRANS
WHERE TOOL_OR_GAUGE_NO IS NOT NULL;

SET IDENTITY_INSERT suki_tools_management.dbo.TOOLS_ISSUE_RECEIVED_TRANS OFF;


-- ═══════════════════════════════════════════════════════════════════
-- 2.20 TOOLS_CONSUMPTION_TRANS_ISSUE
-- ═══════════════════════════════════════════════════════════════════

SET IDENTITY_INSERT suki_tools_management.dbo.TOOLS_CONSUMPTION_TRANS_ISSUE ON;

INSERT INTO suki_tools_management.dbo.TOOLS_CONSUMPTION_TRANS_ISSUE (
    ID, DC_NO, TOOL_OR_GAUGE_NO, WORKSHEET_REF, QTY_CONSUMED,
    CONSUMPTION_DATE, VERIFIED_BY_SUPERVISOR, VERIFIED_BY,
    CREAT_USER_ID_CD, CREAT_DT
)
SELECT
    ROW_ID,
    ISNULL(ISSUE_REF_NO, ''),
    TOOL_OR_GAUGE_NO,
    ISNULL(WORK_SHEET_REF_NO, ''),
    ISNULL(QTY, 0),
    ISNULL(CREAT_DT, GETDATE()),
    CASE WHEN ISNULL(VERIFIED, 'No') = 'Yes' THEN 1 ELSE 0 END,
    LST_UPDT_USER_ID_CD,
    ISNULL(CREAT_USER_ID_CD, 'SYSTEM'),
    ISNULL(CREAT_DT, GETDATE())
FROM TOOLS_CONSUMPTION_TRANS_ISSUE
WHERE TOOL_OR_GAUGE_NO IS NOT NULL;

SET IDENTITY_INSERT suki_tools_management.dbo.TOOLS_CONSUMPTION_TRANS_ISSUE OFF;


-- ═══════════════════════════════════════════════════════════════════
-- 2.21 TOOLS_PO_RECEIVE (header / GRN)
-- ═══════════════════════════════════════════════════════════════════

SET IDENTITY_INSERT suki_tools_management.dbo.TOOLS_PO_RECEIVE ON;

INSERT INTO suki_tools_management.dbo.TOOLS_PO_RECEIVE (
    ID, GRN_NO, PO_REF, SUP_CODE, GRN_DATE, STATUS,
    CREAT_USER_ID_CD, CREAT_DT, LST_UPDT_DT
)
SELECT
    ROW_NUMBER() OVER (ORDER BY pr.GIR_NO),
    CAST(pr.GIR_NO AS VARCHAR(30)),
    ISNULL(pr.PO_ORDER_NO, ''),
    pr.SUP_CODE,
    ISNULL(pr.GIR_DATE, GETDATE()),
    ISNULL(pr.GIR_STATUS, 'Draft'),
    ISNULL(pr.CREAT_USER_ID_CD, 'SYSTEM'),
    ISNULL(pr.CREAT_DT, GETDATE()),
    ISNULL(pr.LST_UPDT_TS, GETDATE())
FROM TOOLS_PO_RECEIVE pr
INNER JOIN suki_tools_management.dbo.SUPPLIER s ON pr.SUP_CODE = s.SUP_CODE
WHERE pr.SUP_CODE IS NOT NULL AND pr.SUP_CODE <> '';

SET IDENTITY_INSERT suki_tools_management.dbo.TOOLS_PO_RECEIVE OFF;


-- ═══════════════════════════════════════════════════════════════════
-- 2.22 TOOLS_PO_RECEIVE_TRANS (lines)
-- ═══════════════════════════════════════════════════════════════════

SET IDENTITY_INSERT suki_tools_management.dbo.TOOLS_PO_RECEIVE_TRANS ON;

INSERT INTO suki_tools_management.dbo.TOOLS_PO_RECEIVE_TRANS (
    ID, GRN_NO, TOOL_OR_GAUGE_NO, PO_QTY, RECEIVED_QTY, PENDING_QTY,
    UNIT_RATE, CREAT_DT
)
SELECT
    t.ROW_ID,
    CAST(t.GIR_NO AS VARCHAR(30)),
    t.ITEM_CODE,
    ISNULL(t.QTY_ORDER, 0),
    ISNULL(t.REC_QTY, 0),
    ISNULL(t.QTY_ORDER, 0) - ISNULL(t.REC_QTY, 0),
    ISNULL(t.PRICE, 0),
    ISNULL(t.CREAT_DT, GETDATE())
FROM TOOLS_PO_RECEIVE_TRANS t
INNER JOIN TOOLS_PO_RECEIVE pr ON t.GIR_NO = pr.GIR_NO
INNER JOIN suki_tools_management.dbo.SUPPLIER s ON pr.SUP_CODE = s.SUP_CODE
WHERE t.ITEM_CODE IS NOT NULL AND t.ITEM_CODE <> '';

SET IDENTITY_INSERT suki_tools_management.dbo.TOOLS_PO_RECEIVE_TRANS OFF;


-- ═══════════════════════════════════════════════════════════════════
-- 2.23 TOOLS_PO_SCH_MASTER (derive SUP_CODE from TOOLS_PO_RECEIVE)
-- ═══════════════════════════════════════════════════════════════════

SET IDENTITY_INSERT suki_tools_management.dbo.TOOLS_PO_SCH_MASTER ON;

INSERT INTO suki_tools_management.dbo.TOOLS_PO_SCH_MASTER (
    ID, SCHEDULE_NO, PO_REF, SUP_CODE, CREATED_DATE, OVERALL_STATUS,
    CREAT_USER_ID_CD
)
SELECT
    s.ROW_ID,
    CAST(s.ROW_ID AS VARCHAR(30)),
    ISNULL(s.PO_ORDER_NO, ''),
    ISNULL(pr.SUP_CODE, ''),
    ISNULL(s.SCH_DATE, GETDATE()),
    ISNULL(s.STATUS, 'Pending'),
    ISNULL(s.CREAT_USER_ID_CD, 'SYSTEM')
FROM TOOLS_PO_SCH_MASTER s
LEFT JOIN (
    SELECT DISTINCT PO_ORDER_NO, SUP_CODE FROM TOOLS_PO_RECEIVE WHERE SUP_CODE IS NOT NULL
) pr ON s.PO_ORDER_NO = pr.PO_ORDER_NO
WHERE ISNULL(pr.SUP_CODE, '') <> '';

SET IDENTITY_INSERT suki_tools_management.dbo.TOOLS_PO_SCH_MASTER OFF;


-- ═══════════════════════════════════════════════════════════════════
-- 2.24 TOOLS_PO_SCH_TRANS (lines)
-- ═══════════════════════════════════════════════════════════════════

SET IDENTITY_INSERT suki_tools_management.dbo.TOOLS_PO_SCH_TRANS ON;

INSERT INTO suki_tools_management.dbo.TOOLS_PO_SCH_TRANS (
    ID, SCHEDULE_NO, TOOL_OR_GAUGE_NO, EXPECTED_DATE, EXPECTED_QTY,
    RECEIVED_QTY, STATUS
)
SELECT
    t.ROW_ID,
    CAST(t.REF_NO AS VARCHAR(30)),
    t.PO_TRANS_NO,
    ISNULL(t.CREAT_DT, GETDATE()),
    ISNULL(t.QTY, 0),
    0,
    ISNULL(t.SCH_STATUS, 'Pending')
FROM TOOLS_PO_SCH_TRANS t
INNER JOIN TOOLS_PO_SCH_MASTER m ON t.REF_NO = m.ROW_ID
WHERE t.PO_TRANS_NO IS NOT NULL;

SET IDENTITY_INSERT suki_tools_management.dbo.TOOLS_PO_SCH_TRANS OFF;


-- ═══════════════════════════════════════════════════════════════════
-- 2.25 TOOLS_ISSUE_FOR_CALIBRATION (header)
-- ═══════════════════════════════════════════════════════════════════

SET IDENTITY_INSERT suki_tools_management.dbo.TOOLS_ISSUE_FOR_CALIBRATION ON;

INSERT INTO suki_tools_management.dbo.TOOLS_ISSUE_FOR_CALIBRATION (
    ID, CALIB_DC_NO, ISSUE_TYPE, LAB_NAME, ISSUE_DATE, EXPECTED_RETURN_DATE,
    STATUS, CREAT_USER_ID_CD, CREAT_DT
)
SELECT
    ROW_NUMBER() OVER (ORDER BY DC_NO),
    CAST(DC_NO AS VARCHAR(30)),
    ISNULL(ISSUE_FOR, 'In-House'),
    RECEIVE_NAME,
    ISNULL(ISSUE_DATE, GETDATE()),
    DATEADD(day, 7, ISNULL(ISSUE_DATE, GETDATE())),
    'OPEN',
    ISNULL(CREAT_USER_ID_CD, 'SYSTEM'),
    ISNULL(CREAT_DT, GETDATE())
FROM TOOLS_ISSUE_FOR_CALIBRATION;

SET IDENTITY_INSERT suki_tools_management.dbo.TOOLS_ISSUE_FOR_CALIBRATION OFF;


-- ═══════════════════════════════════════════════════════════════════
-- 2.26 TOOLS_TRANS_ISSUE_FOR_CALIBRATION (lines)
-- ═══════════════════════════════════════════════════════════════════

SET IDENTITY_INSERT suki_tools_management.dbo.TOOLS_TRANS_ISSUE_FOR_CALIBRATION ON;

INSERT INTO suki_tools_management.dbo.TOOLS_TRANS_ISSUE_FOR_CALIBRATION (
    ID, CALIB_DC_NO, TOOL_OR_GAUGE_NO, SUB_CODE, LAST_CALIB_DATE, DUE_DATE,
    CREAT_DT
)
SELECT
    ROW_ID,
    CAST(DC_NO AS VARCHAR(30)),
    TOOL_OR_GAUGE_NO,
    NULL,
    CALIBRATED_DATE,
    ISNULL(DUE_DATE, CALIB_DUE_DATE),
    ISNULL(CREAT_DT, GETDATE())
FROM TOOLS_TRANS_ISSUE_FOR_CALIBRATION
WHERE TOOL_OR_GAUGE_NO IS NOT NULL;

SET IDENTITY_INSERT suki_tools_management.dbo.TOOLS_TRANS_ISSUE_FOR_CALIBRATION OFF;


-- ═══════════════════════════════════════════════════════════════════
-- 2.27 TOOLS_RECEIVE_FOR_CALIBRATION (header)
-- ═══════════════════════════════════════════════════════════════════

SET IDENTITY_INSERT suki_tools_management.dbo.TOOLS_RECEIVE_FOR_CALIBRATION ON;

INSERT INTO suki_tools_management.dbo.TOOLS_RECEIVE_FOR_CALIBRATION (
    ID, CALIB_RCV_NO, CALIB_DC_NO, RECEIVE_DATE, CREAT_USER_ID_CD, CREAT_DT
)
SELECT
    ROW_NUMBER() OVER (ORDER BY REC_NO),
    CAST(REC_NO AS VARCHAR(30)),
    CAST(DC_NO AS VARCHAR(30)),
    ISNULL(RECEIVE_DATE, GETDATE()),
    ISNULL(CREAT_USER_ID_CD, 'SYSTEM'),
    ISNULL(CREAT_DT, GETDATE())
FROM TOOLS_RECEIVE_FOR_CALIBRATION;

SET IDENTITY_INSERT suki_tools_management.dbo.TOOLS_RECEIVE_FOR_CALIBRATION OFF;


-- ═══════════════════════════════════════════════════════════════════
-- 2.28 TOOLS_TRANS_RECEIVE_FOR_CALIBRATION (lines)
-- Join with TOOLS_TRANS_ISSUE_FOR_CALIBRATION to get calibration results
-- ═══════════════════════════════════════════════════════════════════

SET IDENTITY_INSERT suki_tools_management.dbo.TOOLS_TRANS_RECEIVE_FOR_CALIBRATION ON;

INSERT INTO suki_tools_management.dbo.TOOLS_TRANS_RECEIVE_FOR_CALIBRATION (
    ID, CALIB_RCV_NO, TOOL_OR_GAUGE_NO, CALIBRATION_DATE, RESULT,
    NEXT_CALIB_DATE, CALI_RESULTS_FILE_NAME, REMARKS, CREAT_DT
)
SELECT
    r.ROW_ID,
    CAST(r.REC_NO AS VARCHAR(30)),
    r.TOOL_OR_GAUGE_NO,
    ISNULL(i.CALIBRATED_DATE, GETDATE()),
    ISNULL(i.RESULT_STATUS, 'Pass'),
    ISNULL(i.NXT_CALIB_DATE, DATEADD(month, 6, GETDATE())),
    i.CALI_RESULTS_FILE_NAME,
    ISNULL(r.DESCRIPTION, i.CALIB_RESULT_COMMENTS),
    ISNULL(r.CREAT_DT, GETDATE())
FROM TOOLS_TRANS_RECEIVE_FOR_CALIBRATION r
LEFT JOIN TOOLS_TRANS_ISSUE_FOR_CALIBRATION i
    ON r.DC_NO = i.DC_NO AND r.TOOL_OR_GAUGE_NO = i.TOOL_OR_GAUGE_NO
WHERE r.TOOL_OR_GAUGE_NO IS NOT NULL;

SET IDENTITY_INSERT suki_tools_management.dbo.TOOLS_TRANS_RECEIVE_FOR_CALIBRATION OFF;


-- ═══════════════════════════════════════════════════════════════════
-- 2.29 GAUGE_CONTROL_CARD
-- ═══════════════════════════════════════════════════════════════════

SET IDENTITY_INSERT suki_tools_management.dbo.GAUGE_CONTROL_CARD ON;

INSERT INTO suki_tools_management.dbo.GAUGE_CONTROL_CARD (
    ID, TOOL_OR_GAUGE_NO, LAST_CALIBRATION_DATE, NEXT_C_DATE,
    CALIBRATED_BY, LAST_RESULT, LST_UPDT_DT
)
SELECT
    ROW_ID,
    TOOL_OR_GAUGE_NO,
    NULL,
    NULL,
    NULL,
    NULL,
    ISNULL(LST_UPDT_TS, GETDATE())
FROM GAUGE_CONTROL_CARD
WHERE TOOL_OR_GAUGE_NO IS NOT NULL;

SET IDENTITY_INSERT suki_tools_management.dbo.GAUGE_CONTROL_CARD OFF;


-- ═══════════════════════════════════════════════════════════════════
-- 2.30 GAUGE_CONTROL_CARD_TRANS
-- Join with GAUGE_CONTROL_CARD to get TOOL_OR_GAUGE_NO
-- ═══════════════════════════════════════════════════════════════════

SET IDENTITY_INSERT suki_tools_management.dbo.GAUGE_CONTROL_CARD_TRANS ON;

INSERT INTO suki_tools_management.dbo.GAUGE_CONTROL_CARD_TRANS (
    ID, TOOL_OR_GAUGE_NO, CALIBRATION_DATE, CALIBRATED_BY, CALI_RESULTS,
    NEXT_C_DATE, CALI_RESULTS_FILE_NAME, REMARKS, CREAT_USER_ID_CD, CREAT_DT
)
SELECT
    t.ROW_ID,
    c.TOOL_OR_GAUGE_NO,
    ISNULL(t.C_DATE, GETDATE()),
    CAST(t.EMP_CODE AS VARCHAR(200)),
    'Pass',
    ISNULL(t.NEXT_C_DATE, DATEADD(month, 6, GETDATE())),
    NULL,
    t.REMARKS,
    ISNULL(t.CREAT_USER_ID_CD, 'SYSTEM'),
    ISNULL(t.CREAT_DT, GETDATE())
FROM GAUGE_CONTROL_CARD_TRANS t
INNER JOIN GAUGE_CONTROL_CARD c ON t.REF_NO = c.ROW_ID
WHERE c.TOOL_OR_GAUGE_NO IS NOT NULL;

SET IDENTITY_INSERT suki_tools_management.dbo.GAUGE_CONTROL_CARD_TRANS OFF;


-- ═══════════════════════════════════════════════════════════════════
-- STEP 3: UPDATE GAUGEANDTOOLS calibration dates from control card
-- ═══════════════════════════════════════════════════════════════════

USE suki_tools_management;

UPDATE g
SET
    g.LAST_CALIBRATION_DATE = cc.LAST_CALIBRATION_DATE,
    g.NEXT_C_DATE = cc.NEXT_C_DATE
FROM GAUGEANDTOOLS g
INNER JOIN (
    SELECT TOOL_OR_GAUGE_NO,
           MAX(CALIBRATION_DATE) AS LAST_CALIBRATION_DATE,
           MAX(NEXT_C_DATE) AS NEXT_C_DATE
    FROM GAUGE_CONTROL_CARD_TRANS
    GROUP BY TOOL_OR_GAUGE_NO
) cc ON g.TOOL_OR_GAUGE_NO = cc.TOOL_OR_GAUGE_NO;

-- Update control card with latest trans data
UPDATE cc
SET
    cc.LAST_CALIBRATION_DATE = lt.CALIBRATION_DATE,
    cc.NEXT_C_DATE = lt.NEXT_C_DATE,
    cc.CALIBRATED_BY = lt.CALIBRATED_BY,
    cc.LAST_RESULT = lt.CALI_RESULTS
FROM GAUGE_CONTROL_CARD cc
INNER JOIN (
    SELECT TOOL_OR_GAUGE_NO,
           CALIBRATION_DATE,
           NEXT_C_DATE,
           CALIBRATED_BY,
           CALI_RESULTS,
           ROW_NUMBER() OVER (PARTITION BY TOOL_OR_GAUGE_NO ORDER BY CALIBRATION_DATE DESC) AS rn
    FROM GAUGE_CONTROL_CARD_TRANS
) lt ON cc.TOOL_OR_GAUGE_NO = lt.TOOL_OR_GAUGE_NO AND lt.rn = 1;

PRINT 'Sync complete!';
