CREATE OR ALTER TRIGGER tr_EsiRate_no_overlap
ON [EsiRate]
AFTER INSERT, UPDATE
AS
BEGIN
  SET NOCOUNT ON;
  IF EXISTS (
    SELECT 1
    FROM inserted i
    JOIN [EsiRate] t
      ON t.code = i.code
      AND t.id <> i.id
      AND t.effectiveFrom < COALESCE(i.effectiveTo, '9999-12-31T23:59:59')
      AND i.effectiveFrom < COALESCE(t.effectiveTo, '9999-12-31T23:59:59')
  )
  BEGIN
    ROLLBACK TRANSACTION;
    THROW 50003, 'Overlap detected: another EsiRate record with the same code has an overlapping effective date range.', 1;
  END
END;
