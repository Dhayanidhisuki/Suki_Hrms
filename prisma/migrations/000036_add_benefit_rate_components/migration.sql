-- CreateTable: BenefitRateComponent
CREATE TABLE [dbo].[BenefitRateComponent] (
    [id] INT NOT NULL IDENTITY(1,1),
    [benefitRateId] INT NOT NULL,
    [salaryComponentId] INT NOT NULL,
    [calculationType] NVARCHAR(10) NOT NULL,
    [value] DECIMAL(10,4) NOT NULL,
    [createdAt] DATETIME2 NOT NULL CONSTRAINT [BenefitRateComponent_createdAt_df] DEFAULT CURRENT_TIMESTAMP,
    [updatedAt] DATETIME2 NOT NULL,
    CONSTRAINT [BenefitRateComponent_pkey] PRIMARY KEY CLUSTERED ([id])
);

-- CreateIndex
CREATE NONCLUSTERED INDEX [BenefitRateComponent_benefitRateId_idx] ON [dbo].[BenefitRateComponent]([benefitRateId]);
CREATE NONCLUSTERED INDEX [BenefitRateComponent_salaryComponentId_idx] ON [dbo].[BenefitRateComponent]([salaryComponentId]);

-- AddForeignKey
ALTER TABLE [dbo].[BenefitRateComponent] ADD CONSTRAINT [BenefitRateComponent_benefitRateId_fkey] FOREIGN KEY ([benefitRateId]) REFERENCES [dbo].[BenefitRateByEmployeeType]([id]) ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE [dbo].[BenefitRateComponent] ADD CONSTRAINT [BenefitRateComponent_salaryComponentId_fkey] FOREIGN KEY ([salaryComponentId]) REFERENCES [dbo].[SalaryComponent]([id]) ON DELETE NO ACTION ON UPDATE CASCADE;
