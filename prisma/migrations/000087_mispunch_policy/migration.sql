-- MispunchPolicy: company-scoped singleton controlling how far back a
-- mis-punch (biometric correction) request can be dated, and how many an
-- employee may file per calendar month. Additive-only, same shape as
-- CompOffPolicy (see 000036_time_office_config).

BEGIN TRAN;

CREATE TABLE [dbo].[MispunchPolicy] (
    [id] INT NOT NULL IDENTITY(1,1),
    [companyId] INT NOT NULL,
    [maxBackdateDays] INT NOT NULL CONSTRAINT [DF_MispunchPolicy_maxBackdateDays] DEFAULT 60,
    [maxRequestsPerMonth] INT NOT NULL CONSTRAINT [DF_MispunchPolicy_maxRequestsPerMonth] DEFAULT 3,
    [isActive] BIT NOT NULL CONSTRAINT [DF_MispunchPolicy_isActive] DEFAULT 1,
    [createdAt] DATETIME2 NOT NULL CONSTRAINT [DF_MispunchPolicy_createdAt] DEFAULT CURRENT_TIMESTAMP,
    [updatedAt] DATETIME2 NOT NULL,
    CONSTRAINT [PK_MispunchPolicy] PRIMARY KEY CLUSTERED ([id]),
    CONSTRAINT [UQ_MispunchPolicy_companyId] UNIQUE ([companyId])
);

ALTER TABLE [dbo].[MispunchPolicy] ADD CONSTRAINT [FK_MispunchPolicy_Company] FOREIGN KEY ([companyId]) REFERENCES [dbo].[Company]([id]);

COMMIT TRAN;
