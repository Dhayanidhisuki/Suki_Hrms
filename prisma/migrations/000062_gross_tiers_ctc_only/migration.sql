-- SalaryComponent: CTC-only flag + Gross tier classification
ALTER TABLE "SalaryComponent" ADD "includeInGross" BIT NOT NULL DEFAULT 1;
ALTER TABLE "SalaryComponent" ADD "grossTier" NVARCHAR(20) NOT NULL DEFAULT 'ADDITIONAL';

-- PayrollLine: Gross tier breakdown + performance incentive (CTC-only payout)
ALTER TABLE "PayrollLine" ADD "fixedGross" DECIMAL(18, 2) NOT NULL DEFAULT 0;
ALTER TABLE "PayrollLine" ADD "additionalGross" DECIMAL(18, 2) NOT NULL DEFAULT 0;
ALTER TABLE "PayrollLine" ADD "performanceIncentive" DECIMAL(18, 2) NOT NULL DEFAULT 0;
