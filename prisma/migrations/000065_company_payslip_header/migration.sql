-- Adds statutory payslip/Form-25B header fields to Company: printed address
-- and factory registration number. Additive, nullable.

ALTER TABLE [dbo].[Company] ADD [address] NVARCHAR(500), [factoryRegNo] NVARCHAR(50);
