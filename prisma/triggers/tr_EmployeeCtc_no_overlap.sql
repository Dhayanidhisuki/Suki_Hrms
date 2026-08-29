CREATE OR ALTER TRIGGER tr_EmployeeCtc_no_overlap
ON [EmployeeCtc]
AFTER INSERT, UPDATE
AS
BEGIN
  SET NOCOUNT ON;
  IF EXISTS (
    SELECT 1
    FROM inserted i
    JOIN [EmployeeCtc] t
      ON t.employeeId = i.employeeId
      AND t.id <> i.id
      AND t.effectiveFrom < COALESCE(i.effectiveTo, '9999-12-31T23:59:59')
      AND i.effectiveFrom < COALESCE(t.effectiveTo, '9999-12-31T23:59:59')
  )
  BEGIN
    ROLLBACK TRANSACTION;
    THROW 50005, 'Overlap detected: this employee already has a CTC record with an overlapping effective date range.', 1;
  END
END;
