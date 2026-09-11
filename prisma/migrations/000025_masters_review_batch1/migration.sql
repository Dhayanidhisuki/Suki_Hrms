-- KUN – HRMS Master Page review (2026-09-10), session 1: straightforward
-- field additions to existing masters agreed with the client. Deferred to
-- later sessions: Site Master, Reporting Structure, Deduction Rates,
-- Common Logic (Gross % split), Designation JD bulk import,
-- OT Plan / ESI / PF salary-component linking.
--
-- Additive only. Written without the prisma-diff TRY/CATCH wrapper because
-- scripts/apply-migration.mjs splits on ';' and runs statements one by one
-- inside its own transaction.

BEGIN TRAN;

-- 1. Department: sanctioned headcount (current headcount is derived, not stored)
ALTER TABLE [dbo].[Department] ADD [sanctionedHeadcount] INT NULL;

-- 2. Sub-Department: same sanctioned-headcount convention.
--    (The "Code" -> "Sub-Code" rename from the BRD is label-only; no column change.)
ALTER TABLE [dbo].[SubDepartment] ADD [sanctionedHeadcount] INT NULL;

-- 4. Designation: budget, experience, qualification, sanctioned headcount.
ALTER TABLE [dbo].[Designation] ADD [budget] DECIMAL(18, 2) NULL;
ALTER TABLE [dbo].[Designation] ADD [experienceYears] DECIMAL(4, 1) NULL;
ALTER TABLE [dbo].[Designation] ADD [qualification] NVARCHAR(200) NULL;
ALTER TABLE [dbo].[Designation] ADD [sanctionedHeadcount] INT NULL;

-- 9. Shift Master: night/snacks/meals allowances.
ALTER TABLE [dbo].[ShiftMaster] ADD [nightAllowed] BIT NOT NULL CONSTRAINT [ShiftMaster_nightAllowed_df] DEFAULT 0;
ALTER TABLE [dbo].[ShiftMaster] ADD [bufferMinutes] INT NOT NULL CONSTRAINT [ShiftMaster_bufferMinutes_df] DEFAULT 0;
ALTER TABLE [dbo].[ShiftMaster] ADD [snacksAllowed] BIT NOT NULL CONSTRAINT [ShiftMaster_snacksAllowed_df] DEFAULT 0;
ALTER TABLE [dbo].[ShiftMaster] ADD [mealsAllowed] BIT NOT NULL CONSTRAINT [ShiftMaster_mealsAllowed_df] DEFAULT 0;
ALTER TABLE [dbo].[ShiftMaster] ADD [snacksMealsDurationMinutes] INT NULL;

-- 13. Holiday Master: holiday type classification.
ALTER TABLE [dbo].[HolidayMaster] ADD [holidayType] NVARCHAR(20) NOT NULL CONSTRAINT [HolidayMaster_holidayType_df] DEFAULT 'OTHER';

-- 14. Loan Master: min/max sanctionable amount.
ALTER TABLE [dbo].[LoanType] ADD [minAmount] DECIMAL(18, 2) NULL;
ALTER TABLE [dbo].[LoanType] ADD [maxAmount] DECIMAL(18, 2) NULL;

COMMIT TRAN;
