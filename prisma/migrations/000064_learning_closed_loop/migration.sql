-- Phase 1: Learning closed-loop lifecycle (BRD §7-8, §20-22, §36-37, §50)
-- All additive. No FK into Employee/JobInfo/User — only employeeId scalar +
-- the Learning-owned tables, so existing flows are not constrained.

BEGIN TRY

BEGIN TRAN;

-- CreateTable: TrainingNeedRequest (§7-8 TNA)
CREATE TABLE [dbo].[TrainingNeedRequest] (
    [id] INT NOT NULL IDENTITY(1,1),
    [companyId] INT NOT NULL,
    [employeeId] INT NOT NULL,
    [competencyId] INT,
    [trainingProgramId] INT,
    [source] NVARCHAR(30) CONSTRAINT [TrainingNeedRequest_source_df] DEFAULT 'SKILL_GAP',
    [reason] NVARCHAR(500),
    [priority] NVARCHAR(20) CONSTRAINT [TrainingNeedRequest_priority_df] DEFAULT 'MEDIUM',
    [status] NVARCHAR(20) NOT NULL CONSTRAINT [TrainingNeedRequest_status_df] DEFAULT 'DRAFT',
    [currentStageOrder] INT NOT NULL CONSTRAINT [TrainingNeedRequest_currentStageOrder_df] DEFAULT 0,
    [approvedByUserId] INT,
    [approvedAt] DATETIME2,
    [rejectionReason] NVARCHAR(500),
    [rejectedByUserId] INT,
    [rejectedAt] DATETIME2,
    [tnaReference] NVARCHAR(100),
    [isActive] BIT NOT NULL CONSTRAINT [TrainingNeedRequest_isActive_df] DEFAULT 1,
    [deletedAt] DATETIME2,
    [createdAt] DATETIME2 NOT NULL CONSTRAINT [TrainingNeedRequest_createdAt_df] DEFAULT CURRENT_TIMESTAMP,
    [updatedAt] DATETIME2 NOT NULL,
    CONSTRAINT [TrainingNeedRequest_pkey] PRIMARY KEY CLUSTERED ([id])
);

-- CreateTable: TrainingNomination (§20)
CREATE TABLE [dbo].[TrainingNomination] (
    [id] INT NOT NULL IDENTITY(1,1),
    [companyId] INT NOT NULL,
    [trainingScheduleId] INT NOT NULL,
    [employeeId] INT NOT NULL,
    [reason] NVARCHAR(200),
    [priority] NVARCHAR(20) CONSTRAINT [TrainingNomination_priority_df] DEFAULT 'MEDIUM',
    [nominationDate] DATETIME2 NOT NULL CONSTRAINT [TrainingNomination_nominationDate_df] DEFAULT CURRENT_TIMESTAMP,
    [status] NVARCHAR(20) NOT NULL CONSTRAINT [TrainingNomination_status_df] DEFAULT 'PENDING',
    [currentStageOrder] INT NOT NULL CONSTRAINT [TrainingNomination_currentStageOrder_df] DEFAULT 0,
    [approvedByUserId] INT,
    [approvedAt] DATETIME2,
    [rejectionReason] NVARCHAR(500),
    [rejectedByUserId] INT,
    [rejectedAt] DATETIME2,
    [isActive] BIT NOT NULL CONSTRAINT [TrainingNomination_isActive_df] DEFAULT 1,
    [deletedAt] DATETIME2,
    [createdAt] DATETIME2 NOT NULL CONSTRAINT [TrainingNomination_createdAt_df] DEFAULT CURRENT_TIMESTAMP,
    [updatedAt] DATETIME2 NOT NULL,
    CONSTRAINT [TrainingNomination_pkey] PRIMARY KEY CLUSTERED ([id])
);

-- Add FK: TrainingNomination -> TrainingSchedule (Cascade on schedule delete)
ALTER TABLE [dbo].[TrainingNomination]
    ADD CONSTRAINT [TrainingNomination_trainingScheduleId_fkey]
    FOREIGN KEY ([trainingScheduleId]) REFERENCES [dbo].[TrainingSchedule]([id])
    ON DELETE CASCADE;

-- CreateIndex: unique nomination per schedule per employee
CREATE UNIQUE NONCLUSTERED INDEX [TrainingNomination_companyId_trainingScheduleId_employeeId_key]
    ON [dbo].[TrainingNomination]([companyId], [trainingScheduleId], [employeeId]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [TrainingNomination_companyId_status_idx]
    ON [dbo].[TrainingNomination]([companyId], [status]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [TrainingNomination_companyId_employeeId_idx]
    ON [dbo].[TrainingNomination]([companyId], [employeeId]);

-- CreateTable: TrainingAttendance (§22)
CREATE TABLE [dbo].[TrainingAttendance] (
    [id] INT NOT NULL IDENTITY(1,1),
    [companyId] INT NOT NULL,
    [trainingScheduleId] INT NOT NULL,
    [employeeId] INT NOT NULL,
    [status] NVARCHAR(20) NOT NULL CONSTRAINT [TrainingAttendance_status_df] DEFAULT 'ABSENT',
    [attendedDuration] DECIMAL(8,2),
    [scheduledDuration] DECIMAL(8,2),
    [attendancePercent] DECIMAL(5,2),
    [markedByUserId] INT,
    [markedAt] DATETIME2,
    [remarks] NVARCHAR(500),
    [nominationId] INT,
    [isActive] BIT NOT NULL CONSTRAINT [TrainingAttendance_isActive_df] DEFAULT 1,
    [deletedAt] DATETIME2,
    [createdAt] DATETIME2 NOT NULL CONSTRAINT [TrainingAttendance_createdAt_df] DEFAULT CURRENT_TIMESTAMP,
    [updatedAt] DATETIME2 NOT NULL,
    CONSTRAINT [TrainingAttendance_pkey] PRIMARY KEY CLUSTERED ([id])
);

-- Add FK: TrainingAttendance -> TrainingSchedule (Cascade on schedule delete)
ALTER TABLE [dbo].[TrainingAttendance]
    ADD CONSTRAINT [TrainingAttendance_trainingScheduleId_fkey]
    FOREIGN KEY ([trainingScheduleId]) REFERENCES [dbo].[TrainingSchedule]([id])
    ON DELETE CASCADE;

-- Add FK: TrainingAttendance -> TrainingNomination (1:1, NoAction)
ALTER TABLE [dbo].[TrainingAttendance]
    ADD CONSTRAINT [TrainingAttendance_nominationId_fkey]
    FOREIGN KEY ([nominationId]) REFERENCES [dbo].[TrainingNomination]([id])
    ON DELETE NO ACTION;

-- unique nominationId (1:1 link)
CREATE UNIQUE NONCLUSTERED INDEX [TrainingAttendance_nominationId_key]
    ON [dbo].[TrainingAttendance]([nominationId]);

-- unique attendance per schedule per employee
CREATE UNIQUE NONCLUSTERED INDEX [TrainingAttendance_companyId_trainingScheduleId_employeeId_key]
    ON [dbo].[TrainingAttendance]([companyId], [trainingScheduleId], [employeeId]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [TrainingAttendance_companyId_trainingScheduleId_idx]
    ON [dbo].[TrainingAttendance]([companyId], [trainingScheduleId]);

-- CreateTable: TrainingFeedback (§37)
CREATE TABLE [dbo].[TrainingFeedback] (
    [id] INT NOT NULL IDENTITY(1,1),
    [companyId] INT NOT NULL,
    [trainingScheduleId] INT NOT NULL,
    [employeeId] INT NOT NULL,
    [trainerRating] INT,
    [contentRating] INT,
    [venueRating] INT,
    [overallRating] INT,
    [comments] NVARCHAR(1000),
    [submittedAt] DATETIME2 NOT NULL CONSTRAINT [TrainingFeedback_submittedAt_df] DEFAULT CURRENT_TIMESTAMP,
    [isActive] BIT NOT NULL CONSTRAINT [TrainingFeedback_isActive_df] DEFAULT 1,
    [deletedAt] DATETIME2,
    [createdAt] DATETIME2 NOT NULL CONSTRAINT [TrainingFeedback_createdAt_df] DEFAULT CURRENT_TIMESTAMP,
    [updatedAt] DATETIME2 NOT NULL,
    CONSTRAINT [TrainingFeedback_pkey] PRIMARY KEY CLUSTERED ([id])
);

-- Add FK: TrainingFeedback -> TrainingSchedule (Cascade on schedule delete)
ALTER TABLE [dbo].[TrainingFeedback]
    ADD CONSTRAINT [TrainingFeedback_trainingScheduleId_fkey]
    FOREIGN KEY ([trainingScheduleId]) REFERENCES [dbo].[TrainingSchedule]([id])
    ON DELETE CASCADE;

-- unique feedback per schedule per employee
CREATE UNIQUE NONCLUSTERED INDEX [TrainingFeedback_companyId_trainingScheduleId_employeeId_key]
    ON [dbo].[TrainingFeedback]([companyId], [trainingScheduleId], [employeeId]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [TrainingFeedback_companyId_trainingScheduleId_idx]
    ON [dbo].[TrainingFeedback]([companyId], [trainingScheduleId]);

-- CreateTable: TrainingHistory (§36)
CREATE TABLE [dbo].[TrainingHistory] (
    [id] INT NOT NULL IDENTITY(1,1),
    [companyId] INT NOT NULL,
    [employeeId] INT NOT NULL,
    [trainingScheduleId] INT,
    [trainingProgramId] INT,
    [programName] NVARCHAR(200) NOT NULL,
    [competencyId] INT,
    [scheduledDate] DATE,
    [method] NVARCHAR(50),
    [attendanceStatus] NVARCHAR(20),
    [attendancePercent] DECIMAL(5,2),
    [score] DECIMAL(8,2),
    [result] NVARCHAR(20),
    [certificateNumber] NVARCHAR(50),
    [certifiedDate] DATE,
    [trainerId] INT,
    [venueId] INT,
    [status] NVARCHAR(20) NOT NULL CONSTRAINT [TrainingHistory_status_df] DEFAULT 'COMPLETED',
    [isActive] BIT NOT NULL CONSTRAINT [TrainingHistory_isActive_df] DEFAULT 1,
    [deletedAt] DATETIME2,
    [createdAt] DATETIME2 NOT NULL CONSTRAINT [TrainingHistory_createdAt_df] DEFAULT CURRENT_TIMESTAMP,
    [updatedAt] DATETIME2 NOT NULL,
    CONSTRAINT [TrainingHistory_pkey] PRIMARY KEY CLUSTERED ([id])
);

-- CreateIndex
CREATE NONCLUSTERED INDEX [TrainingHistory_companyId_employeeId_idx]
    ON [dbo].[TrainingHistory]([companyId], [employeeId]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [TrainingHistory_companyId_trainingScheduleId_idx]
    ON [dbo].[TrainingHistory]([companyId], [trainingScheduleId]);

-- CreateIndex: TrainingNeedRequest
CREATE NONCLUSTERED INDEX [TrainingNeedRequest_companyId_status_idx]
    ON [dbo].[TrainingNeedRequest]([companyId], [status]);

CREATE NONCLUSTERED INDEX [TrainingNeedRequest_companyId_employeeId_idx]
    ON [dbo].[TrainingNeedRequest]([companyId], [employeeId]);

COMMIT TRAN;

END TRY
BEGIN CATCH
    ROLLBACK TRAN;
    THROW;
END CATCH
