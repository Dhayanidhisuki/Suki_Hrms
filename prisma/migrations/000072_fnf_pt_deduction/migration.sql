-- Professional tax column on the F&F settlement.
--
-- The engine already emits a PT deduction line, so totals and net payable were
-- correct; only the per-component breakdown was missing it, leaving any report
-- that reads the named columns short by the PT amount.

IF COL_LENGTH('FnFSettlement', 'ptDeduction') IS NULL
  ALTER TABLE [FnFSettlement] ADD [ptDeduction] DECIMAL(18,2) NOT NULL
    CONSTRAINT [DF_FnFSettlement_ptDeduction] DEFAULT 0;
