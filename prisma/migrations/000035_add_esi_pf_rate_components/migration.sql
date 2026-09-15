-- CreateTable: EsiRateComponent
CREATE TABLE [dbo].[EsiRateComponent] (
    [id] INT NOT NULL IDENTITY(1,1),
    [esiRateId] INT NOT NULL,
    [salaryComponentId] INT NOT NULL,
    [calculationType] NVARCHAR(10) NOT NULL,
    [value] DECIMAL(10,4) NOT NULL,
    [createdAt] DATETIME2 NOT NULL CONSTRAINT [EsiRateComponent_createdAt_df] DEFAULT CURRENT_TIMESTAMP,
    [updatedAt] DATETIME2 NOT NULL,
    CONSTRAINT [EsiRateComponent_pkey] PRIMARY KEY CLUSTERED ([id])
);

-- CreateTable: PfRateComponent
CREATE TABLE [dbo].[PfRateComponent] (
    [id] INT NOT NULL IDENTITY(1,1),
    [pfRateId] INT NOT NULL,
    [salaryComponentId] INT NOT NULL,
    [calculationType] NVARCHAR(10) NOT NULL,
    [value] DECIMAL(10,4) NOT NULL,
    [createdAt] DATETIME2 NOT NULL CONSTRAINT [PfRateComponent_createdAt_df] DEFAULT CURRENT_TIMESTAMP,
    [updatedAt] DATETIME2 NOT NULL,
    CONSTRAINT [PfRateComponent_pkey] PRIMARY KEY CLUSTERED ([id])
);

-- CreateIndex
CREATE NONCLUSTERED INDEX [EsiRateComponent_esiRateId_idx] ON [dbo].[EsiRateComponent]([esiRateId]);
CREATE NONCLUSTERED INDEX [EsiRateComponent_salaryComponentId_idx] ON [dbo].[EsiRateComponent]([salaryComponentId]);
CREATE NONCLUSTERED INDEX [PfRateComponent_pfRateId_idx] ON [dbo].[PfRateComponent]([pfRateId]);
CREATE NONCLUSTERED INDEX [PfRateComponent_salaryComponentId_idx] ON [dbo].[PfRateComponent]([salaryComponentId]);

-- AddForeignKey
ALTER TABLE [dbo].[EsiRateComponent] ADD CONSTRAINT [EsiRateComponent_esiRateId_fkey] FOREIGN KEY ([esiRateId]) REFERENCES [dbo].[EsiRate]([id]) ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE [dbo].[EsiRateComponent] ADD CONSTRAINT [EsiRateComponent_salaryComponentId_fkey] FOREIGN KEY ([salaryComponentId]) REFERENCES [dbo].[SalaryComponent]([id]) ON DELETE NO ACTION ON UPDATE CASCADE;
ALTER TABLE [dbo].[PfRateComponent] ADD CONSTRAINT [PfRateComponent_pfRateId_fkey] FOREIGN KEY ([pfRateId]) REFERENCES [dbo].[PfRate]([id]) ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE [dbo].[PfRateComponent] ADD CONSTRAINT [PfRateComponent_salaryComponentId_fkey] FOREIGN KEY ([salaryComponentId]) REFERENCES [dbo].[SalaryComponent]([id]) ON DELETE NO ACTION ON UPDATE CASCADE;
