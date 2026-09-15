-- Migration 000039: Add optional salaryComponentId to BenefitRateByEmployeeType

ALTER TABLE [dbo].[BenefitRateByEmployeeType] ADD [salaryComponentId] INT NULL;

CREATE NONCLUSTERED INDEX [BenefitRateByEmployeeType_salaryComponentId_idx] ON [dbo].[BenefitRateByEmployeeType]([salaryComponentId]);

ALTER TABLE [dbo].[BenefitRateByEmployeeType] ADD CONSTRAINT [BenefitRateByEmployeeType_salaryComponentId_fkey] FOREIGN KEY ([salaryComponentId]) REFERENCES [dbo].[SalaryComponent]([id]) ON DELETE NO ACTION ON UPDATE CASCADE;
