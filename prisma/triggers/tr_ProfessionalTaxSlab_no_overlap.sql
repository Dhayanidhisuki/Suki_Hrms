CREATE OR ALTER TRIGGER tr_ProfessionalTaxSlab_no_overlap
ON [ProfessionalTaxSlab]
AFTER INSERT, UPDATE
AS
BEGIN
  SET NOCOUNT ON;
  IF EXISTS (
    SELECT 1
    FROM inserted i
    JOIN [ProfessionalTaxSlab] t
      ON t.code = i.code
      AND t.id <> i.id
      AND t.effectiveFrom < COALESCE(i.effectiveTo, '9999-12-31T23:59:59')
      AND i.effectiveFrom < COALESCE(t.effectiveTo, '9999-12-31T23:59:59')
  )
  BEGIN
    ROLLBACK TRANSACTION;
    THROW 50002, 'Overlap detected: another ProfessionalTaxSlab record with the same code has an overlapping effective date range.', 1;
  END
END;
