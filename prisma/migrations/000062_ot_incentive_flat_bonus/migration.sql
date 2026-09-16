-- OT Incentive flat-bonus support: a slab can now pay a fixed monthly
-- bonus for crossing an OT-hours threshold, instead of only multiplying
-- OT pay. PayrollLine gets a separate otIncentiveAmount line so payroll
-- and the payslip can show it distinctly from otAmount.
-- Additive only: two new nullable/defaulted columns.

BEGIN TRY

BEGIN TRAN;

-- AlterTable
ALTER TABLE [dbo].[OTIncentiveSlab] ADD CONSTRAINT [OTIncentiveSlab_incentiveMultiplier_df] DEFAULT 1 FOR [incentiveMultiplier];
ALTER TABLE [dbo].[OTIncentiveSlab] ADD [flatBonusAmount] DECIMAL(18,2);

-- AlterTable
ALTER TABLE [dbo].[PayrollLine] ADD [otIncentiveAmount] DECIMAL(18,2) NOT NULL CONSTRAINT [PayrollLine_otIncentiveAmount_df] DEFAULT 0;

COMMIT TRAN;

END TRY
BEGIN CATCH

IF @@TRANCOUNT > 0
BEGIN
    ROLLBACK TRAN;
END;
THROW

END CATCH

