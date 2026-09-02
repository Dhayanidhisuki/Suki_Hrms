-- ─────────────────────────────────────────────────────────────────────────────
-- Suki HRMS — Slab/Rate Overlap Prevention Triggers (Q5 — Option D approved)
--
-- Prevents overlapping (effectiveFrom, effectiveTo) date ranges for the same
-- `code` within each slab/rate table. Rolls back the INSERT/UPDATE if an
-- overlap is detected.
--
-- These triggers run AFTER INSERT and AFTER UPDATE on:
--   1. TDSSlab
--   2. ProfessionalTaxSlab
--   3. EsiRate
--   4. PfRate
--
-- Overlap logic: two ranges [A.effectiveFrom, A.effectiveTo] and
-- [B.effectiveFrom, B.effectiveTo] overlap when:
--   A.effectiveFrom < COALESCE(B.effectiveTo, '9999-12-31')
--   AND B.effectiveFrom < COALESCE(A.effectiveTo, '9999-12-31')
-- NULL effectiveTo = open-ended (currently active).
--
-- This file is executed as a raw SQL step after `prisma migrate dev`.
-- ─────────────────────────────────────────────────────────────────────────────

-- 1. TDSSlab
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
GO

-- 2. ProfessionalTaxSlab
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
GO

-- 3. EsiRate
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
GO

-- 4. PfRate
CREATE OR ALTER TRIGGER tr_PfRate_no_overlap
ON [PfRate]
AFTER INSERT, UPDATE
AS
BEGIN
  SET NOCOUNT ON;
  IF EXISTS (
    SELECT 1
    FROM inserted i
    JOIN [PfRate] t
      ON t.code = i.code
      AND t.id <> i.id
      AND t.effectiveFrom < COALESCE(i.effectiveTo, '9999-12-31T23:59:59')
      AND i.effectiveFrom < COALESCE(t.effectiveTo, '9999-12-31T23:59:59')
  )
  BEGIN
    ROLLBACK TRANSACTION;
    THROW 50004, 'Overlap detected: another PfRate record with the same code has an overlapping effective date range.', 1;
  END
END;
GO
