-- Adds JobInfo.probationPeriodMonths, set manually per employee at hire time
-- (per client decision) and used to server-compute probationEndDate =
-- joinDate + probationPeriodMonths. Purely additive, nullable column.
--
-- NOTE: spurious `Employee_userId_key` plain UNIQUE CONSTRAINT line from
-- `prisma migrate diff` intentionally excluded — see migration 000002's note.

ALTER TABLE [dbo].[JobInfo] ADD [probationPeriodMonths] INT;
