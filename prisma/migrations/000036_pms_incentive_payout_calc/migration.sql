-- PMS Incentive payout computation columns: the fixed "Performance
-- Incentive" salary component prorated by present days, scaled by PMS %,
-- with employee/employer ESI shares and net payout. Additive only.

BEGIN TRAN;

ALTER TABLE [dbo].[PmsIncentive] ADD
    [performanceIncentive] DECIMAL(18, 2) NOT NULL CONSTRAINT [PmsIncentive_performanceIncentive_df] DEFAULT 0,
    [monthDays] INT NOT NULL CONSTRAINT [PmsIncentive_monthDays_df] DEFAULT 0,
    [presentDays] DECIMAL(5, 2) NOT NULL CONSTRAINT [PmsIncentive_presentDays_df] DEFAULT 0,
    [incentiveMoney] DECIMAL(18, 2) NOT NULL CONSTRAINT [PmsIncentive_incentiveMoney_df] DEFAULT 0,
    [incentiveEarn] DECIMAL(18, 2) NOT NULL CONSTRAINT [PmsIncentive_incentiveEarn_df] DEFAULT 0,
    [employeeEsi] DECIMAL(18, 2) NOT NULL CONSTRAINT [PmsIncentive_employeeEsi_df] DEFAULT 0,
    [employerEsi] DECIMAL(18, 2) NOT NULL CONSTRAINT [PmsIncentive_employerEsi_df] DEFAULT 0,
    [pmsNet] DECIMAL(18, 2) NOT NULL CONSTRAINT [PmsIncentive_pmsNet_df] DEFAULT 0;

COMMIT TRAN;
