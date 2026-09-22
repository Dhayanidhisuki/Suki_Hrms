-- Removes PerformanceIncentivePercent — superseded immediately after
-- creation: the Performance Incentive Report now reads its percentage from
-- the existing PmsIncentive (companyPercent + managerPercent) instead of a
-- standalone entry screen. No other table references this one.

DROP TABLE [dbo].[PerformanceIncentivePercent];
