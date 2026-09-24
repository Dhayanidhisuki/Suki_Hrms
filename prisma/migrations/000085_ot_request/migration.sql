-- OTRequest: employee-submitted overtime request, reviewed Reporting
-- Manager then HR before DailyAttendance is touched — distinct from the
-- biometric-flagged OT queue /api/workforce/attendance/ot already approves.
-- Same shape as MispunchCorrection. Additive only. Written without the
-- prisma-diff TRY/CATCH wrapper because scripts/apply-migration.mjs splits
-- on ';' and runs statements one by one inside its own transaction.

BEGIN TRAN;

-- CreateTable
CREATE TABLE [dbo].[OTRequest] (
    [id] INT NOT NULL IDENTITY(1,1),
    [employeeId] INT NOT NULL,
    [date] DATE NOT NULL,
    [requestedMinutes] INT NOT NULL,
    [reason] NVARCHAR(500) NOT NULL,
    [status] NVARCHAR(20) NOT NULL CONSTRAINT [OTRequest_status_df] DEFAULT 'pending_manager',
    [managerActionByUserId] INT,
    [managerActionAt] DATETIME2,
    [managerRejectionReason] NVARCHAR(500),
    [hrActionByUserId] INT,
    [hrActionAt] DATETIME2,
    [hrRejectionReason] NVARCHAR(500),
    [appliedAt] DATETIME2 NOT NULL CONSTRAINT [OTRequest_appliedAt_df] DEFAULT CURRENT_TIMESTAMP,
    [createdAt] DATETIME2 NOT NULL CONSTRAINT [OTRequest_createdAt_df] DEFAULT CURRENT_TIMESTAMP,
    [updatedAt] DATETIME2 NOT NULL,
    CONSTRAINT [OTRequest_pkey] PRIMARY KEY CLUSTERED ([id])
);

-- AddForeignKey
ALTER TABLE [dbo].[OTRequest] ADD CONSTRAINT [OTRequest_employeeId_fkey] FOREIGN KEY ([employeeId]) REFERENCES [dbo].[Employee]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- CreateIndex
CREATE NONCLUSTERED INDEX [OTRequest_employeeId_idx] ON [dbo].[OTRequest]([employeeId]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [OTRequest_status_idx] ON [dbo].[OTRequest]([status]);

COMMIT TRAN;
