/* ---------------------------------------------------------------
   ERP master tables — row counts
   Run this first. Read-only, takes about a second.
   --------------------------------------------------------------- */
USE ERPDB_KUN_HRMS;
GO

SELECT
    t.name                                   AS table_name,
    SUM(p.rows)                              AS row_count
FROM sys.tables t
JOIN sys.partitions p
     ON p.object_id = t.object_id
    AND p.index_id IN (0, 1)
WHERE t.name IN (
    'DEPT','CLASS_SUB_DEPT','COMPANY_DETAILS','COMPANY_CHILD_UNIT_DETAILS','STATE_MASTER',
    'HRMS_DESIG_MASTER','HRMS_DESIG_LEVEL_MASTER','HRMS_GRADE_MASTER','HRMS_EMP_CLASS',
    'HRMS_EMPLOYEE_TYPE_MASTER','HRMS_SHIFT_MASTER','HRMS_HOLIDAY_MASTER','HRMS_OVERTIME_SLAB',
    'HRMS_LEAVE_VALIDATE_MASTER','HRMS_ATTENDANCE_LOCATION_MASTER','HRMS_SALARY_COMPONENT',
    'HRMS_SALARY_LOGIC','PROF_TAX_SLAP_MASTER','TAX_SECTION_MASTER','TDS_TAX_CODE_MASTER',
    'HRMS_LOAN_MASTER','HRMS_COM_BANK_MASTER','MULTI_LEVEL_APPROVAL_MASTER',
    'HRMS_DROPDOWN_MASTER','PROFICIENCY_MASTER','SKILL_NAME_DETAILS'
)
GROUP BY t.name
ORDER BY t.name;
GO
