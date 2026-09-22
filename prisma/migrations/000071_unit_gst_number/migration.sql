-- AlterTable: add GSTIN column to Unit (branch/site/plant/work location).
-- Additive only — nullable, no existing rows affected.

ALTER TABLE [Unit] ADD [gstNumber] NVARCHAR(20) NULL;
