-- AlterTable: Add Phase 11 validation fields to PayrollValidationConfig
ALTER TABLE [PayrollValidationConfig] ADD [maxOtHoursPerMonth] DECIMAL(5,2);
ALTER TABLE [PayrollValidationConfig] ADD [maxOtPercentOfGross] DECIMAL(5,2);
ALTER TABLE [PayrollValidationConfig] ADD [checkGrossReconciliation] BIT NOT NULL CONSTRAINT [DF_PayrollValidationConfig_checkGrossReconciliation] DEFAULT 0;
ALTER TABLE [PayrollValidationConfig] ADD [maxLopDaysPerMonth] INT;
ALTER TABLE [PayrollValidationConfig] ADD [checkAttendanceFrozen] BIT NOT NULL CONSTRAINT [DF_PayrollValidationConfig_checkAttendanceFrozen] DEFAULT 0;
ALTER TABLE [PayrollValidationConfig] ADD [checkDuplicateComponents] BIT NOT NULL CONSTRAINT [DF_PayrollValidationConfig_checkDuplicateComponents] DEFAULT 1;
ALTER TABLE [PayrollValidationConfig] ADD [minPayableDays] DECIMAL(5,2);
ALTER TABLE [PayrollValidationConfig] ADD [warnIfZeroGross] BIT NOT NULL CONSTRAINT [DF_PayrollValidationConfig_warnIfZeroGross] DEFAULT 1;
