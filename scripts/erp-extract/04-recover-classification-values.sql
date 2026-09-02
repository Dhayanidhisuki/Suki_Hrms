/*  ERPDB_KUN_HRMS — recover real classification values from EMPLOYEE
    Generated 31 August 2026.

    READ ONLY. These are the 12 queries that 03-extract-L0-L1-L2.sql's
    section 5.1 generated. Several of the masters these columns should
    reference (HRMS_DESIG_LEVEL_MASTER, HRMS_EMP_CLASS, SKILL_NAME_DETAILS,
    PROFICIENCY_MASTER) came back empty — this shows what's actually
    stored on the 479 live EMPLOYEE rows instead, with usage counts.

    Most useful single result in this file: EMP_LEVEL. It should settle
    whether the "Level: L1-L7" field seen in the UI is real data or a
    hardcoded dropdown with nothing behind it.
*/

USE ERPDB_KUN_HRMS;
GO

SELECT 'GRADE_CODE' AS column_name, [GRADE_CODE] AS value, COUNT(*) AS employee_count FROM EMPLOYEE WHERE [GRADE_CODE] IS NOT NULL GROUP BY [GRADE_CODE] ORDER BY employee_count DESC;
SELECT 'SHIFT_NAME' AS column_name, [SHIFT_NAME] AS value, COUNT(*) AS employee_count FROM EMPLOYEE WHERE [SHIFT_NAME] IS NOT NULL GROUP BY [SHIFT_NAME] ORDER BY employee_count DESC;
SELECT 'EMP_CLASS' AS column_name, [EMP_CLASS] AS value, COUNT(*) AS employee_count FROM EMPLOYEE WHERE [EMP_CLASS] IS NOT NULL GROUP BY [EMP_CLASS] ORDER BY employee_count DESC;
SELECT 'EMP_CAT' AS column_name, [EMP_CAT] AS value, COUNT(*) AS employee_count FROM EMPLOYEE WHERE [EMP_CAT] IS NOT NULL GROUP BY [EMP_CAT] ORDER BY employee_count DESC;
SELECT 'EMP_LEVEL' AS column_name, [EMP_LEVEL] AS value, COUNT(*) AS employee_count FROM EMPLOYEE WHERE [EMP_LEVEL] IS NOT NULL GROUP BY [EMP_LEVEL] ORDER BY employee_count DESC;
SELECT 'EMP_TYPE' AS column_name, [EMP_TYPE] AS value, COUNT(*) AS employee_count FROM EMPLOYEE WHERE [EMP_TYPE] IS NOT NULL GROUP BY [EMP_TYPE] ORDER BY employee_count DESC;
SELECT 'UNIT_NAME' AS column_name, [UNIT_NAME] AS value, COUNT(*) AS employee_count FROM EMPLOYEE WHERE [UNIT_NAME] IS NOT NULL GROUP BY [UNIT_NAME] ORDER BY employee_count DESC;
SELECT 'SHIFT' AS column_name, [SHIFT] AS value, COUNT(*) AS employee_count FROM EMPLOYEE WHERE [SHIFT] IS NOT NULL GROUP BY [SHIFT] ORDER BY employee_count DESC;
SELECT 'EMP_SUB_CAT' AS column_name, [EMP_SUB_CAT] AS value, COUNT(*) AS employee_count FROM EMPLOYEE WHERE [EMP_SUB_CAT] IS NOT NULL GROUP BY [EMP_SUB_CAT] ORDER BY employee_count DESC;
SELECT 'STATUS' AS column_name, [STATUS] AS value, COUNT(*) AS employee_count FROM EMPLOYEE WHERE [STATUS] IS NOT NULL GROUP BY [STATUS] ORDER BY employee_count DESC;
SELECT 'INDUCTION_STATUS' AS column_name, [INDUCTION_STATUS] AS value, COUNT(*) AS employee_count FROM EMPLOYEE WHERE [INDUCTION_STATUS] IS NOT NULL GROUP BY [INDUCTION_STATUS] ORDER BY employee_count DESC;
SELECT 'EMP_FEEDBACK_STATUS' AS column_name, [EMP_FEEDBACK_STATUS] AS value, COUNT(*) AS employee_count FROM EMPLOYEE WHERE [EMP_FEEDBACK_STATUS] IS NOT NULL GROUP BY [EMP_FEEDBACK_STATUS] ORDER BY employee_count DESC;
GO
