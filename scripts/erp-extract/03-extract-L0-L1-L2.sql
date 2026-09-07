/*  ERPDB_KUN_HRMS — data extraction for layers L0, L1, L2
    Generated 31 August 2026.  Companion document: EXTRACT_L0_L1_L2.md

    READ ONLY.  Every statement is a SELECT.  Nothing is written, altered or
    dropped.  Safe to run on the live database; avoid the payroll window.

    Run section by section in SSMS.  For CSV: Query > Results To > Results to File.
    For JSON: run section 9 instead of sections 2 and 3.
*/

USE ERPDB_KUN_HRMS;
GO

/* ============================================================
   SECTION 1 — DISCOVERY
   ============================================================ */

-- 1.1  Every table in the database with its row count.  Send this first.
SELECT  s.name AS schema_name,
        t.name AS table_name,
        SUM(p.rows) AS row_count
FROM    sys.tables      t
JOIN    sys.schemas     s ON s.schema_id = t.schema_id
JOIN    sys.partitions  p ON p.object_id = t.object_id AND p.index_id IN (0,1)
GROUP BY s.name, t.name
ORDER BY row_count DESC, table_name;
GO

-- 1.2  Every table that references an employee (finds the sub-entity tables).
SELECT  c.TABLE_NAME,
        c.COLUMN_NAME,
        c.DATA_TYPE,
        (SELECT SUM(p.rows)
           FROM sys.partitions p
           JOIN sys.tables t2 ON t2.object_id = p.object_id
          WHERE t2.name = c.TABLE_NAME AND p.index_id IN (0,1)) AS row_count
FROM    INFORMATION_SCHEMA.COLUMNS c
WHERE   c.COLUMN_NAME IN ('EMP_CODE','EMPLOYEE_CODE','EMP_ID','EMPLOYEE_ID',
                          'EMP_NO','EMPLOYEE_NO','EMP_REF_NO','EMP_CD')
ORDER BY row_count DESC, c.TABLE_NAME;
GO

-- 1.3  Tables whose names suggest employee sub-entities, that actually hold rows.
SELECT  t.name AS table_name, SUM(p.rows) AS row_count
FROM    sys.tables t
JOIN    sys.partitions p ON p.object_id = t.object_id AND p.index_id IN (0,1)
WHERE   t.name LIKE '%EDU%'      OR t.name LIKE '%EXPER%'
     OR t.name LIKE '%QUALIF%'   OR t.name LIKE '%FAMILY%'
     OR t.name LIKE '%DEPEND%'   OR t.name LIKE '%NOMINEE%'
     OR t.name LIKE '%PASSPORT%' OR t.name LIKE '%DOCUMENT%'
     OR t.name LIKE '%ADDRESS%'  OR t.name LIKE '%CONTACT%'
     OR t.name LIKE '%BANK%'     OR t.name LIKE '%SKILL%'
     OR t.name LIKE '%ASSET%'    OR t.name LIKE '%KYC%'
     OR t.name LIKE '%EMERGENC%' OR t.name LIKE '%PREVIOUS%'
GROUP BY t.name
HAVING  SUM(p.rows) > 0
ORDER BY row_count DESC;
GO

-- 1.4  Find the user/login table (name never confirmed).
SELECT  t.name AS table_name, SUM(p.rows) AS row_count
FROM    sys.tables t
JOIN    sys.partitions p ON p.object_id = t.object_id AND p.index_id IN (0,1)
WHERE   t.name LIKE '%USER%'
GROUP BY t.name
ORDER BY row_count DESC;
GO

-- 1.5  Column list for one table.  Change the name and re-run as needed.
SELECT  ORDINAL_POSITION, COLUMN_NAME, DATA_TYPE,
        CHARACTER_MAXIMUM_LENGTH, IS_NULLABLE
FROM    INFORMATION_SCHEMA.COLUMNS
WHERE   TABLE_NAME = 'EMPLOYEE'
ORDER BY ORDINAL_POSITION;
GO


/* ============================================================
   SECTION 2 — L0  PLATFORM: roles, menus, page access
   Export every column EXCEPT any password or hash column.
   Use 1.5 on the user table first and exclude that column by name.
   ============================================================ */

SELECT * FROM ERP_ROLE_MASTER;
SELECT * FROM ERP_PAGE_ACCESS_MASTER;
SELECT * FROM ERP_MENU;
SELECT * FROM ERP_SUB_MENU;
SELECT * FROM ERP_PAGE_MASTER;
SELECT * FROM ERP_PAGE_MENU_USER_ROLE;
SELECT * FROM SUKI_ERP_USER_MODULE;
GO


/* ============================================================
   SECTION 3 — L1  ORGANIZATION MASTERS
   ============================================================ */

SELECT * FROM COMPANY_DETAILS;
SELECT * FROM COMPANY_CHILD_UNIT_DETAILS;

SELECT * FROM DEPT              ORDER BY SEQ_NO, DEPT_NAME;
SELECT * FROM CLASS_SUB_DEPT    ORDER BY CLASS_NAME;

SELECT * FROM HRMS_DESIG_MASTER ORDER BY SEQ_NO, NAME;
SELECT * FROM HRMS_DESIG_LEVEL_MASTER;
SELECT * FROM HRMS_GRADE_MASTER ORDER BY SEQ_NO, GRADE_CODE;

SELECT * FROM HRMS_EMP_CLASS;
SELECT * FROM HRMS_EMPLOYEE_TYPE_MASTER;

SELECT * FROM HRMS_DROPDOWN_MASTER ORDER BY TYPE, VALUE;
SELECT * FROM STATE_MASTER         ORDER BY STATE;
SELECT * FROM COUNTRY_MASTER;

SELECT * FROM SKILL_NAME_DETAILS;
SELECT * FROM PROFICIENCY_MASTER;
GO


/* ============================================================
   SECTION 4 — L2  EMPLOYEE MASTER
   PASSWORD column deliberately excluded — see ground rules. If a
   future re-run needs every other column, add them explicitly rather
   than using SELECT * here.
   ============================================================ */

SELECT EMP_CD, TITLE, FIRST_NAME, LAST_NAME, EN_NO, DESIG_CODE, GRADE_CODE,
       DEPT_NO, SHIFT_NAME, JOIN_DATE, CONFIRM_DATE, OLDEMP_CD, EMP_CLASS,
       EMP_CAT, EMP_LEVEL, EMP_TYPE, UNIT_NAME, EXIT_DATE, EXIT_REASON,
       LEFT_COMPANY, SHIFT, SHIFT_DURATION, DAILY_SHEET_REQ, TEAM_GROUP,
       PHOTO_FILENAME, NEXT_REV_DATE, ADDITIONAL_ROLE, RETIREMENT_DATE,
       FOR_GUEST_USER, CREAT_USER_ID_CD, CREAT_DT, LST_UPDT_USER_ID_CD,
       LST_UPDT_TS, HOME_MANAGER, BUSINESS_MANAGER, EMP_SUB_CAT, STATUS,
       VR_MANAGER, APPLICANT_ID, PETROL_ALLOWANCE, CONT_SUP_CODE,
       OFFER_LETTER, INDUCTION_STATUS, HIKE_DATE, IND_FLAG, HR_MANAGER,
       EMP_FEEDBACK_STATUS, PRODUCTION_LINE, EMP_SATISFAC_EMAIL_SEND_DT,
       EMP_FEEBACK_SUBMIT_DATE, EXIT_COMMENTS, REF_BY, REF_MODE,
       MANAGER_PERM, ATTENDANCE_REQ, SUPP_BUSINESS_PER, GRACE_MINS,
       EMP_PROBATION, SITE, REMARK, EXIT_EMP_FILENAME
       -- PASSWORD intentionally omitted
FROM   EMPLOYEE;
GO

/*  Sub-entity tables: run one SELECT * per table returned by 1.2 and 1.3.
    Expected from the field map, names to be confirmed:
      HRMS_EMP_SKILL_MATRIX, HRMS_EMP_MEMO, EMPLOYEE_TRANSFER, EMP_GRIEVANCE,
      plus education / experience / dependents / bank / documents / passport.  */


/* ============================================================
   SECTION 5 — RECOVERY: rebuild empty masters from employee rows
   ============================================================ */

-- 5.1  Generates one distinct-value query per classification column.
--      Run this, then copy the generated statements into a new window and run them.
SELECT  'SELECT ''' + COLUMN_NAME + ''' AS column_name, ' +
        QUOTENAME(COLUMN_NAME) + ' AS value, COUNT(*) AS employee_count ' +
        'FROM EMPLOYEE WHERE ' + QUOTENAME(COLUMN_NAME) + ' IS NOT NULL ' +
        'GROUP BY ' + QUOTENAME(COLUMN_NAME) + ' ORDER BY employee_count DESC;'
        AS query_to_run
FROM    INFORMATION_SCHEMA.COLUMNS
WHERE   TABLE_NAME = 'EMPLOYEE'
  AND   DATA_TYPE IN ('nvarchar','varchar','char','nchar')
  AND  (COLUMN_NAME LIKE '%CAT%'      OR COLUMN_NAME LIKE '%CLASS%'
     OR COLUMN_NAME LIKE '%TYPE%'     OR COLUMN_NAME LIKE '%GRADE%'
     OR COLUMN_NAME LIKE '%LEVEL%'    OR COLUMN_NAME LIKE '%DEPT%'
     OR COLUMN_NAME LIKE '%DESIG%'    OR COLUMN_NAME LIKE '%UNIT%'
     OR COLUMN_NAME LIKE '%SHIFT%'    OR COLUMN_NAME LIKE '%STATE%'
     OR COLUMN_NAME LIKE '%BANK%'     OR COLUMN_NAME LIKE '%RELIGION%'
     OR COLUMN_NAME LIKE '%BLOOD%'    OR COLUMN_NAME LIKE '%QUALIF%'
     OR COLUMN_NAME LIKE '%MARITAL%'  OR COLUMN_NAME LIKE '%STATUS%'
     OR COLUMN_NAME LIKE '%LOCATION%' OR COLUMN_NAME LIKE '%NATION%');
GO

-- 5.2  Which of the four manager roles are actually populated (blocker B2).
SELECT  COUNT(*) AS total_employees,
        SUM(CASE WHEN HOME_MANAGER     IS NOT NULL THEN 1 ELSE 0 END) AS has_home_manager,
        SUM(CASE WHEN BUSINESS_MANAGER IS NOT NULL THEN 1 ELSE 0 END) AS has_business_manager,
        SUM(CASE WHEN HR_MANAGER       IS NOT NULL THEN 1 ELSE 0 END) AS has_hr_manager,
        SUM(CASE WHEN VR_MANAGER       IS NOT NULL THEN 1 ELSE 0 END) AS has_vr_manager
FROM    EMPLOYEE;
GO

-- 5.3  Headcount by department and designation.  Confirm column names with 1.5 first.
SELECT  DEPT_NO, DESIG_CODE, COUNT(*) AS employee_count
FROM    EMPLOYEE
GROUP BY DEPT_NO, DESIG_CODE
ORDER BY employee_count DESC;
GO


/* ============================================================
   SECTION 6 — JSON alternative for L1
   One document per table.  Save the output as erp-L1-<table>.json
   ============================================================ */

SELECT * FROM DEPT                     FOR JSON PATH, INCLUDE_NULL_VALUES;
SELECT * FROM CLASS_SUB_DEPT           FOR JSON PATH, INCLUDE_NULL_VALUES;
SELECT * FROM COMPANY_DETAILS          FOR JSON PATH, INCLUDE_NULL_VALUES;
SELECT * FROM COMPANY_CHILD_UNIT_DETAILS FOR JSON PATH, INCLUDE_NULL_VALUES;
SELECT * FROM HRMS_DESIG_MASTER        FOR JSON PATH, INCLUDE_NULL_VALUES;
SELECT * FROM HRMS_GRADE_MASTER        FOR JSON PATH, INCLUDE_NULL_VALUES;
SELECT * FROM HRMS_EMP_CLASS           FOR JSON PATH, INCLUDE_NULL_VALUES;
SELECT * FROM HRMS_EMPLOYEE_TYPE_MASTER FOR JSON PATH, INCLUDE_NULL_VALUES;
SELECT * FROM HRMS_DROPDOWN_MASTER     FOR JSON PATH, INCLUDE_NULL_VALUES;
SELECT * FROM SKILL_NAME_DETAILS       FOR JSON PATH, INCLUDE_NULL_VALUES;
SELECT * FROM PROFICIENCY_MASTER       FOR JSON PATH, INCLUDE_NULL_VALUES;
GO


/* ============================================================
   SECTION 7 — Still outstanding, requested separately
   The two highest-priority tables in the whole project.
   ============================================================ */

SELECT * FROM HRMS_SALARY_COMPONENT;   -- 35 rows
SELECT * FROM HRMS_SALARY_LOGIC;       -- 57 rows
GO
