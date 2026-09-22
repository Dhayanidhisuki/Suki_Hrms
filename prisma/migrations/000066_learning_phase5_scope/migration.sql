-- Phase 5: Remaining BRD scope (§13, §23, §33-35, §43-44)
-- All additive. No FK into Employee/User — only scalar ids and
-- Learning-owned tables, so existing flows are not constrained.

BEGIN TRY

BEGIN TRAN;

-- CreateTable: TrainingPolicy (§13)
CREATE TABLE [dbo].[TrainingPolicy] (
    [id] INT NOT NULL IDENTITY(1,1),
    [companyId] INT NOT NULL,
    [name] NVARCHAR(200) NOT NULL,
    [minAttendancePercent] INT,
    [assessmentRequired] BIT NOT NULL CONSTRAINT [TrainingPolicy_assessmentRequired_df] DEFAULT 0,
    [feedbackRequired] BIT NOT NULL CONSTRAINT [TrainingPolicy_feedbackRequired_df] DEFAULT 1,
    [nominationCutoffDays] INT,
    [externalBudgetCap] DECIMAL(18,2),
    [mandatoryTrainingGraceDays] INT,
    [effectiveFrom] DATE,
    [effectiveTo] DATE,
    [remarks] NVARCHAR(500),
    [isActive] BIT NOT NULL CONSTRAINT [TrainingPolicy_isActive_df] DEFAULT 1,
    [deletedAt] DATETIME2,
    [createdAt] DATETIME2 NOT NULL CONSTRAINT [TrainingPolicy_createdAt_df] DEFAULT CURRENT_TIMESTAMP,
    [updatedAt] DATETIME2 NOT NULL,
    CONSTRAINT [TrainingPolicy_pkey] PRIMARY KEY CLUSTERED ([id])
);
CREATE NONCLUSTERED INDEX [TrainingPolicy_companyId_idx] ON [dbo].[TrainingPolicy]([companyId]);

-- CreateTable: TrainingBudget (§34)
CREATE TABLE [dbo].[TrainingBudget] (
    [id] INT NOT NULL IDENTITY(1,1),
    [companyId] INT NOT NULL,
    [year] NVARCHAR(9) NOT NULL,
    [departmentId] INT,
    [allocatedAmount] DECIMAL(18,2) NOT NULL,
    [utilizedAmount] DECIMAL(18,2) NOT NULL CONSTRAINT [TrainingBudget_utilizedAmount_df] DEFAULT 0,
    [isActive] BIT NOT NULL CONSTRAINT [TrainingBudget_isActive_df] DEFAULT 1,
    [deletedAt] DATETIME2,
    [createdAt] DATETIME2 NOT NULL CONSTRAINT [TrainingBudget_createdAt_df] DEFAULT CURRENT_TIMESTAMP,
    [updatedAt] DATETIME2 NOT NULL,
    CONSTRAINT [TrainingBudget_pkey] PRIMARY KEY CLUSTERED ([id])
);
CREATE UNIQUE NONCLUSTERED INDEX [TrainingBudget_companyId_year_departmentId_key]
    ON [dbo].[TrainingBudget]([companyId], [year], [departmentId]);
CREATE NONCLUSTERED INDEX [TrainingBudget_companyId_year_idx] ON [dbo].[TrainingBudget]([companyId], [year]);

-- CreateTable: InductionProgram (§23)
CREATE TABLE [dbo].[InductionProgram] (
    [id] INT NOT NULL IDENTITY(1,1),
    [companyId] INT NOT NULL,
    [name] NVARCHAR(200) NOT NULL,
    [departmentId] INT,
    [designationId] INT,
    [durationDays] INT,
    [description] NVARCHAR(500),
    [isActive] BIT NOT NULL CONSTRAINT [InductionProgram_isActive_df] DEFAULT 1,
    [deletedAt] DATETIME2,
    [createdAt] DATETIME2 NOT NULL CONSTRAINT [InductionProgram_createdAt_df] DEFAULT CURRENT_TIMESTAMP,
    [updatedAt] DATETIME2 NOT NULL,
    CONSTRAINT [InductionProgram_pkey] PRIMARY KEY CLUSTERED ([id])
);
CREATE NONCLUSTERED INDEX [InductionProgram_companyId_departmentId_idx] ON [dbo].[InductionProgram]([companyId], [departmentId]);

-- CreateTable: InductionAssignment (§23)
CREATE TABLE [dbo].[InductionAssignment] (
    [id] INT NOT NULL IDENTITY(1,1),
    [companyId] INT NOT NULL,
    [inductionProgramId] INT NOT NULL,
    [employeeId] INT NOT NULL,
    [assignedDate] DATETIME2 NOT NULL CONSTRAINT [InductionAssignment_assignedDate_df] DEFAULT CURRENT_TIMESTAMP,
    [targetDate] DATE,
    [completedDate] DATE,
    [status] NVARCHAR(20) NOT NULL CONSTRAINT [InductionAssignment_status_df] DEFAULT 'PENDING',
    [isActive] BIT NOT NULL CONSTRAINT [InductionAssignment_isActive_df] DEFAULT 1,
    [deletedAt] DATETIME2,
    [createdAt] DATETIME2 NOT NULL CONSTRAINT [InductionAssignment_createdAt_df] DEFAULT CURRENT_TIMESTAMP,
    [updatedAt] DATETIME2 NOT NULL,
    CONSTRAINT [InductionAssignment_pkey] PRIMARY KEY CLUSTERED ([id])
);
ALTER TABLE [dbo].[InductionAssignment]
    ADD CONSTRAINT [InductionAssignment_inductionProgramId_fkey]
    FOREIGN KEY ([inductionProgramId]) REFERENCES [dbo].[InductionProgram]([id])
    ON DELETE NO ACTION;
CREATE UNIQUE NONCLUSTERED INDEX [InductionAssignment_companyId_inductionProgramId_employeeId_key]
    ON [dbo].[InductionAssignment]([companyId], [inductionProgramId], [employeeId]);
CREATE NONCLUSTERED INDEX [InductionAssignment_companyId_employeeId_idx] ON [dbo].[InductionAssignment]([companyId], [employeeId]);

-- CreateTable: OjtAssignment (§43)
CREATE TABLE [dbo].[OjtAssignment] (
    [id] INT NOT NULL IDENTITY(1,1),
    [companyId] INT NOT NULL,
    [employeeId] INT NOT NULL,
    [mentorEmployeeId] INT,
    [trainerId] INT,
    [competencyId] INT,
    [trainingProgramId] INT,
    [startDate] DATE,
    [endDate] DATE,
    [status] NVARCHAR(20) NOT NULL CONSTRAINT [OjtAssignment_status_df] DEFAULT 'IN_PROGRESS',
    [remarks] NVARCHAR(500),
    [isActive] BIT NOT NULL CONSTRAINT [OjtAssignment_isActive_df] DEFAULT 1,
    [deletedAt] DATETIME2,
    [createdAt] DATETIME2 NOT NULL CONSTRAINT [OjtAssignment_createdAt_df] DEFAULT CURRENT_TIMESTAMP,
    [updatedAt] DATETIME2 NOT NULL,
    CONSTRAINT [OjtAssignment_pkey] PRIMARY KEY CLUSTERED ([id])
);
CREATE NONCLUSTERED INDEX [OjtAssignment_companyId_employeeId_idx] ON [dbo].[OjtAssignment]([companyId], [employeeId]);

-- CreateTable: TrainingChecklist (§44)
CREATE TABLE [dbo].[TrainingChecklist] (
    [id] INT NOT NULL IDENTITY(1,1),
    [companyId] INT NOT NULL,
    [name] NVARCHAR(200) NOT NULL,
    [checklistType] NVARCHAR(30) NOT NULL CONSTRAINT [TrainingChecklist_checklistType_df] DEFAULT 'GENERAL',
    [isActive] BIT NOT NULL CONSTRAINT [TrainingChecklist_isActive_df] DEFAULT 1,
    [deletedAt] DATETIME2,
    [createdAt] DATETIME2 NOT NULL CONSTRAINT [TrainingChecklist_createdAt_df] DEFAULT CURRENT_TIMESTAMP,
    [updatedAt] DATETIME2 NOT NULL,
    CONSTRAINT [TrainingChecklist_pkey] PRIMARY KEY CLUSTERED ([id])
);
CREATE NONCLUSTERED INDEX [TrainingChecklist_companyId_idx] ON [dbo].[TrainingChecklist]([companyId]);

-- CreateTable: TrainingChecklistItem (§44)
CREATE TABLE [dbo].[TrainingChecklistItem] (
    [id] INT NOT NULL IDENTITY(1,1),
    [checklistId] INT NOT NULL,
    [label] NVARCHAR(300) NOT NULL,
    [sortOrder] INT NOT NULL CONSTRAINT [TrainingChecklistItem_sortOrder_df] DEFAULT 0,
    [isMandatory] BIT NOT NULL CONSTRAINT [TrainingChecklistItem_isMandatory_df] DEFAULT 0,
    [isActive] BIT NOT NULL CONSTRAINT [TrainingChecklistItem_isActive_df] DEFAULT 1,
    [deletedAt] DATETIME2,
    [createdAt] DATETIME2 NOT NULL CONSTRAINT [TrainingChecklistItem_createdAt_df] DEFAULT CURRENT_TIMESTAMP,
    [updatedAt] DATETIME2 NOT NULL,
    CONSTRAINT [TrainingChecklistItem_pkey] PRIMARY KEY CLUSTERED ([id])
);
ALTER TABLE [dbo].[TrainingChecklistItem]
    ADD CONSTRAINT [TrainingChecklistItem_checklistId_fkey]
    FOREIGN KEY ([checklistId]) REFERENCES [dbo].[TrainingChecklist]([id])
    ON DELETE CASCADE;
CREATE NONCLUSTERED INDEX [TrainingChecklistItem_checklistId_idx] ON [dbo].[TrainingChecklistItem]([checklistId]);

-- CreateTable: TrainingCertificate (§33)
CREATE TABLE [dbo].[TrainingCertificate] (
    [id] INT NOT NULL IDENTITY(1,1),
    [companyId] INT NOT NULL,
    [employeeId] INT NOT NULL,
    [trainingScheduleId] INT,
    [trainingProgramId] INT,
    [certificateNumber] NVARCHAR(50) NOT NULL,
    [issueDate] DATE,
    [expiryDate] DATE,
    [filePath] NVARCHAR(500),
    [issuedByUserId] INT,
    [isActive] BIT NOT NULL CONSTRAINT [TrainingCertificate_isActive_df] DEFAULT 1,
    [deletedAt] DATETIME2,
    [createdAt] DATETIME2 NOT NULL CONSTRAINT [TrainingCertificate_createdAt_df] DEFAULT CURRENT_TIMESTAMP,
    [updatedAt] DATETIME2 NOT NULL,
    CONSTRAINT [TrainingCertificate_pkey] PRIMARY KEY CLUSTERED ([id])
);
CREATE UNIQUE NONCLUSTERED INDEX [TrainingCertificate_companyId_certificateNumber_key]
    ON [dbo].[TrainingCertificate]([companyId], [certificateNumber]);
CREATE NONCLUSTERED INDEX [TrainingCertificate_companyId_employeeId_idx] ON [dbo].[TrainingCertificate]([companyId], [employeeId]);

COMMIT TRAN;

END TRY
BEGIN CATCH
    ROLLBACK TRAN;
    THROW;
END CATCH
