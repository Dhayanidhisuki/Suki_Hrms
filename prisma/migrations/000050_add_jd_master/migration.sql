-- JD Master (JobDescription + versions/tags/sequence) and a minimal JobPosting
-- table so recruitment can attach a JD. Employee.jdId is optional reverse
-- linkage for usageCount. Written without the prisma-diff TRY/CATCH wrapper
-- because scripts/apply-migration.mjs splits on ';' and runs statements one
-- by one inside its own transaction.

BEGIN TRAN;

ALTER TABLE [dbo].[Employee] ADD [jdId] INT NULL;

CREATE TABLE [dbo].[JobDescription] (
    [id] INT NOT NULL IDENTITY(1,1),
    [jdCode] NVARCHAR(40) NOT NULL,
    [departmentId] INT NOT NULL,
    [designationId] INT NOT NULL,
    [title] NVARCHAR(200) NOT NULL,
    [description] NVARCHAR(MAX) NOT NULL,
    [jdFileUrl] NVARCHAR(500) NULL,
    [status] NVARCHAR(20) NOT NULL CONSTRAINT [JobDescription_status_df] DEFAULT 'Draft',
    [createdByUserId] INT NULL,
    [deletedAt] DATETIME2 NULL,
    [createdAt] DATETIME2 NOT NULL CONSTRAINT [JobDescription_createdAt_df] DEFAULT CURRENT_TIMESTAMP,
    [updatedAt] DATETIME2 NOT NULL,
    CONSTRAINT [JobDescription_pkey] PRIMARY KEY CLUSTERED ([id]),
    CONSTRAINT [JobDescription_jdCode_key] UNIQUE NONCLUSTERED ([jdCode])
);

CREATE TABLE [dbo].[JobDescriptionVersion] (
    [id] INT NOT NULL IDENTITY(1,1),
    [jobDescriptionId] INT NOT NULL,
    [title] NVARCHAR(200) NOT NULL,
    [description] NVARCHAR(MAX) NOT NULL,
    [jdFileUrl] NVARCHAR(500) NULL,
    [editedByUserId] INT NULL,
    [editedAt] DATETIME2 NOT NULL CONSTRAINT [JobDescriptionVersion_editedAt_df] DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT [JobDescriptionVersion_pkey] PRIMARY KEY CLUSTERED ([id])
);

CREATE TABLE [dbo].[JobDescriptionTag] (
    [id] INT NOT NULL IDENTITY(1,1),
    [jobDescriptionId] INT NOT NULL,
    [tag] NVARCHAR(50) NOT NULL,
    CONSTRAINT [JobDescriptionTag_pkey] PRIMARY KEY CLUSTERED ([id]),
    CONSTRAINT [JobDescriptionTag_jobDescriptionId_tag_key] UNIQUE NONCLUSTERED ([jobDescriptionId], [tag])
);

CREATE TABLE [dbo].[JobDescriptionSequence] (
    [departmentId] INT NOT NULL,
    [lastNumber] INT NOT NULL,
    CONSTRAINT [JobDescriptionSequence_pkey] PRIMARY KEY CLUSTERED ([departmentId])
);

CREATE TABLE [dbo].[JobPosting] (
    [id] INT NOT NULL IDENTITY(1,1),
    [title] NVARCHAR(200) NOT NULL,
    [departmentId] INT NULL,
    [designationId] INT NULL,
    [jdId] INT NULL,
    [status] NVARCHAR(20) NOT NULL CONSTRAINT [JobPosting_status_df] DEFAULT 'Open',
    [createdByUserId] INT NULL,
    [deletedAt] DATETIME2 NULL,
    [createdAt] DATETIME2 NOT NULL CONSTRAINT [JobPosting_createdAt_df] DEFAULT CURRENT_TIMESTAMP,
    [updatedAt] DATETIME2 NOT NULL,
    CONSTRAINT [JobPosting_pkey] PRIMARY KEY CLUSTERED ([id])
);

CREATE NONCLUSTERED INDEX [Employee_jdId_idx] ON [dbo].[Employee]([jdId]);
CREATE NONCLUSTERED INDEX [JobDescription_departmentId_idx] ON [dbo].[JobDescription]([departmentId]);
CREATE NONCLUSTERED INDEX [JobDescription_designationId_idx] ON [dbo].[JobDescription]([designationId]);
CREATE NONCLUSTERED INDEX [JobDescription_status_idx] ON [dbo].[JobDescription]([status]);
CREATE NONCLUSTERED INDEX [JobDescription_createdByUserId_idx] ON [dbo].[JobDescription]([createdByUserId]);
CREATE NONCLUSTERED INDEX [JobDescriptionVersion_jobDescriptionId_idx] ON [dbo].[JobDescriptionVersion]([jobDescriptionId]);
CREATE NONCLUSTERED INDEX [JobDescriptionVersion_editedByUserId_idx] ON [dbo].[JobDescriptionVersion]([editedByUserId]);
CREATE NONCLUSTERED INDEX [JobDescriptionTag_tag_idx] ON [dbo].[JobDescriptionTag]([tag]);
CREATE NONCLUSTERED INDEX [JobPosting_jdId_idx] ON [dbo].[JobPosting]([jdId]);
CREATE NONCLUSTERED INDEX [JobPosting_departmentId_idx] ON [dbo].[JobPosting]([departmentId]);
CREATE NONCLUSTERED INDEX [JobPosting_designationId_idx] ON [dbo].[JobPosting]([designationId]);
CREATE NONCLUSTERED INDEX [JobPosting_createdByUserId_idx] ON [dbo].[JobPosting]([createdByUserId]);

ALTER TABLE [dbo].[JobDescription] ADD CONSTRAINT [JobDescription_departmentId_fkey] FOREIGN KEY ([departmentId]) REFERENCES [dbo].[Department]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;
ALTER TABLE [dbo].[JobDescription] ADD CONSTRAINT [JobDescription_designationId_fkey] FOREIGN KEY ([designationId]) REFERENCES [dbo].[Designation]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;
ALTER TABLE [dbo].[JobDescription] ADD CONSTRAINT [JobDescription_createdByUserId_fkey] FOREIGN KEY ([createdByUserId]) REFERENCES [dbo].[User]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;
ALTER TABLE [dbo].[JobDescriptionVersion] ADD CONSTRAINT [JobDescriptionVersion_jobDescriptionId_fkey] FOREIGN KEY ([jobDescriptionId]) REFERENCES [dbo].[JobDescription]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;
ALTER TABLE [dbo].[JobDescriptionVersion] ADD CONSTRAINT [JobDescriptionVersion_editedByUserId_fkey] FOREIGN KEY ([editedByUserId]) REFERENCES [dbo].[User]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;
ALTER TABLE [dbo].[JobDescriptionTag] ADD CONSTRAINT [JobDescriptionTag_jobDescriptionId_fkey] FOREIGN KEY ([jobDescriptionId]) REFERENCES [dbo].[JobDescription]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;
ALTER TABLE [dbo].[Employee] ADD CONSTRAINT [Employee_jdId_fkey] FOREIGN KEY ([jdId]) REFERENCES [dbo].[JobDescription]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;
ALTER TABLE [dbo].[JobPosting] ADD CONSTRAINT [JobPosting_departmentId_fkey] FOREIGN KEY ([departmentId]) REFERENCES [dbo].[Department]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;
ALTER TABLE [dbo].[JobPosting] ADD CONSTRAINT [JobPosting_designationId_fkey] FOREIGN KEY ([designationId]) REFERENCES [dbo].[Designation]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;
ALTER TABLE [dbo].[JobPosting] ADD CONSTRAINT [JobPosting_jdId_fkey] FOREIGN KEY ([jdId]) REFERENCES [dbo].[JobDescription]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;
ALTER TABLE [dbo].[JobPosting] ADD CONSTRAINT [JobPosting_createdByUserId_fkey] FOREIGN KEY ([createdByUserId]) REFERENCES [dbo].[User]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

COMMIT TRAN;
