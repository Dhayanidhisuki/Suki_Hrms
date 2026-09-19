-- AlterTable: add wall-clock OT rounding slab to OTPlan.
-- Additive only — nullable, no existing rows affected (NULL = no rounding,
-- preserves today's behavior for every existing plan).

ALTER TABLE [OTPlan] ADD [roundingSlabMinutes] INT NULL;
