CREATE OR ALTER TRIGGER tr_EmployeeSalaryRevision_no_overlap
ON [EmployeeSalaryRevision]
AFTER INSERT, UPDATE
AS
BEGIN
  SET NOCOUNT ON;
  IF EXISTS (
    SELECT 1
    FROM inserted i
    JOIN [EmployeeSalaryRevision] t
      ON t.employeeId = i.employeeId
      AND t.id <> i.id
      AND t.effectiveFrom < COALESCE(i.effectiveTo, '9999-12-31T23:59:59')
      AND i.effectiveFrom < COALESCE(t.effectiveTo, '9999-12-31T23:59:59')
  )
  BEGIN
    ROLLBACK TRANSACTION;
    THROW 50004, 'Overlap detected: this employee already has a salary revision with an overlapping effective date range.', 1;
  END
END;
