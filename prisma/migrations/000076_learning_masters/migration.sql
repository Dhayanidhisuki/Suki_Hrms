-- Phase 25 (BRD §17/18/19/47): Mentor, TrainingResource, TrainingProvider, CertificationMaster.

CREATE SEQUENCE [dbo].[TrainingMentor_seq] AS INT START WITH 1 INCREMENT BY 1;
CREATE TABLE [dbo].[TrainingMentor] (
    [id] INT NOT NULL CONSTRAINT [TrainingMentor_id_df] DEFAULT NEXT VALUE FOR [dbo].[TrainingMentor_seq],
    [companyId] INT NOT NULL,
    [employeeId] INT NULL,
    [name] NVARCHAR(100) NOT NULL,
    [email] NVARCHAR(100) NULL,
    [phone] NVARCHAR(20) NULL,
    [expertise] NVARCHAR(300) NULL,
    [role] NVARCHAR(100) NULL,
    [assignedToIds] NVARCHAR(MAX) NULL,
    [startDate] DATETIME2 NULL,
    [endDate] DATETIME2 NULL,
    [expectedOutcome] NVARCHAR(300) NULL,
    [notes] NVARCHAR(500) NULL,
    [isActive] BIT NOT NULL CONSTRAINT [TrainingMentor_isActive_df] DEFAULT 1,
    [deletedAt] DATETIME2 NULL,
    [createdAt] DATETIME2 NOT NULL CONSTRAINT [TrainingMentor_createdAt_df] DEFAULT CURRENT_TIMESTAMP,
    [updatedAt] DATETIME2 NOT NULL,
    CONSTRAINT [TrainingMentor_pkey] PRIMARY KEY CLUSTERED ([id])
);
CREATE NONCLUSTERED INDEX [TrainingMentor_companyId_idx] ON [dbo].[TrainingMentor]([companyId]);

CREATE SEQUENCE [dbo].[TrainingResource_seq] AS INT START WITH 1 INCREMENT BY 1;
CREATE TABLE [dbo].[TrainingResource] (
    [id] INT NOT NULL CONSTRAINT [TrainingResource_id_df] DEFAULT NEXT VALUE FOR [dbo].[TrainingResource_seq],
    [companyId] INT NOT NULL,
    [name] NVARCHAR(100) NOT NULL,
    [resourceType] NVARCHAR(50) NULL,
    [venueId] INT NULL,
    [serialNumber] NVARCHAR(100) NULL,
    [quantity] INT NOT NULL CONSTRAINT [TrainingResource_quantity_df] DEFAULT 1,
    [status] NVARCHAR(20) NOT NULL CONSTRAINT [TrainingResource_status_df] DEFAULT 'AVAILABLE',
    [notes] NVARCHAR(300) NULL,
    [isActive] BIT NOT NULL CONSTRAINT [TrainingResource_isActive_df] DEFAULT 1,
    [deletedAt] DATETIME2 NULL,
    [createdAt] DATETIME2 NOT NULL CONSTRAINT [TrainingResource_createdAt_df] DEFAULT CURRENT_TIMESTAMP,
    [updatedAt] DATETIME2 NOT NULL,
    CONSTRAINT [TrainingResource_pkey] PRIMARY KEY CLUSTERED ([id])
);
CREATE NONCLUSTERED INDEX [TrainingResource_companyId_idx] ON [dbo].[TrainingResource]([companyId]);

CREATE SEQUENCE [dbo].[TrainingProvider_seq] AS INT START WITH 1 INCREMENT BY 1;
CREATE TABLE [dbo].[TrainingProvider] (
    [id] INT NOT NULL CONSTRAINT [TrainingProvider_id_df] DEFAULT NEXT VALUE FOR [dbo].[TrainingProvider_seq],
    [companyId] INT NOT NULL,
    [name] NVARCHAR(150) NOT NULL,
    [contactName] NVARCHAR(100) NULL,
    [email] NVARCHAR(100) NULL,
    [phone] NVARCHAR(20) NULL,
    [website] NVARCHAR(200) NULL,
    [address] NVARCHAR(300) NULL,
    [categories] NVARCHAR(300) NULL,
    [rating] DECIMAL(3,1) NULL,
    [notes] NVARCHAR(500) NULL,
    [isActive] BIT NOT NULL CONSTRAINT [TrainingProvider_isActive_df] DEFAULT 1,
    [deletedAt] DATETIME2 NULL,
    [createdAt] DATETIME2 NOT NULL CONSTRAINT [TrainingProvider_createdAt_df] DEFAULT CURRENT_TIMESTAMP,
    [updatedAt] DATETIME2 NOT NULL,
    CONSTRAINT [TrainingProvider_pkey] PRIMARY KEY CLUSTERED ([id])
);
CREATE NONCLUSTERED INDEX [TrainingProvider_companyId_idx] ON [dbo].[TrainingProvider]([companyId]);

CREATE SEQUENCE [dbo].[CertificationMaster_seq] AS INT START WITH 1 INCREMENT BY 1;
CREATE TABLE [dbo].[CertificationMaster] (
    [id] INT NOT NULL CONSTRAINT [CertificationMaster_id_df] DEFAULT NEXT VALUE FOR [dbo].[CertificationMaster_seq],
    [companyId] INT NOT NULL,
    [name] NVARCHAR(150) NOT NULL,
    [issuingBody] NVARCHAR(150) NULL,
    [validityMonths] INT NULL,
    [category] NVARCHAR(100) NULL,
    [isMandatory] BIT NOT NULL CONSTRAINT [CertificationMaster_isMandatory_df] DEFAULT 0,
    [description] NVARCHAR(500) NULL,
    [isActive] BIT NOT NULL CONSTRAINT [CertificationMaster_isActive_df] DEFAULT 1,
    [deletedAt] DATETIME2 NULL,
    [createdAt] DATETIME2 NOT NULL CONSTRAINT [CertificationMaster_createdAt_df] DEFAULT CURRENT_TIMESTAMP,
    [updatedAt] DATETIME2 NOT NULL,
    CONSTRAINT [CertificationMaster_pkey] PRIMARY KEY CLUSTERED ([id])
);
CREATE NONCLUSTERED INDEX [CertificationMaster_companyId_idx] ON [dbo].[CertificationMaster]([companyId]);
