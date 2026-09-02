CREATE OR ALTER TRIGGER tr_TDSSlab_no_overlap
ON [TDSSlab]
AFTER INSERT, UPDATE
AS
BEGIN
  SET NOCOUNT ON;
  IF EXISTS (
    SELECT 1
    FROM inserted i
    JOIN [TDSSlab] t
      ON t.code = i.code
      AND t.id <> i.id
      AND t.effectiveFrom < COALESCE(i.effectiveTo, '9999-12-31T23:59:59')
      AND i.effectiveFrom < COALESCE(t.effectiveTo, '9999-12-31T23:59:59')
  )
  BEGIN
    ROLLBACK TRANSACTION;
    THROW 50001, 'Overlap detected: another TDSSlab record with the same code has an overlapping effective date range.', 1;
  END
END;
