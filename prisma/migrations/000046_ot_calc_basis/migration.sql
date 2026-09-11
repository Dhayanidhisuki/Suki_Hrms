-- AlterTable: Add OT calculation basis to OTPlan
ALTER TABLE [OTPlan] ADD [otCalculationBasis] NVARCHAR(20) NOT NULL CONSTRAINT [DF_OTPlan_otCalculationBasis] DEFAULT 'GROSS';
