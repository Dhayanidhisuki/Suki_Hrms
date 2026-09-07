-- MispunchCorrection: employee-submitted punch-correction request, reviewed
-- Reporting Manager then HR before DailyAttendance is touched. Additive
-- only. Written without the prisma-diff TRY/CATCH wrapper because
-- scripts/apply-migration.mjs splits on ';' and runs statements one by one
-- inside its own transaction.

BEGIN TRAN;

-- CreateTable
CREATE TABLE [dbo].[MispunchCorrection] (
    [id] INT NOT NULL IDENTITY(1,1),
    [employeeId] INT NOT NULL,
    [date] DATE NOT NULL,
    [requestedInTime] DATETIME2,
    [requestedOutTime] DATETIME2,
    [reason] NVARCHAR(500) NOT NULL,
    [status] NVARCHAR(20) NOT NULL CONSTRAINT [MispunchCorrection_status_df] DEFAULT 'pending_manager',
    [managerActionByUserId] INT,
    [managerActionAt] DATETIME2,
    [managerRejectionReason] NVARCHAR(500),
    [hrActionByUserId] INT,
    [hrActionAt] DATETIME2,
    [hrRejectionReason] NVARCHAR(500),
    [appliedAt] DATETIME2 NOT NULL CONSTRAINT [MispunchCorrection_appliedAt_df] DEFAULT CURRENT_TIMESTAMP,
    [createdAt] DATETIME2 NOT NULL CONSTRAINT [MispunchCorrection_createdAt_df] DEFAULT CURRENT_TIMESTAMP,
    [updatedAt] DATETIME2 NOT NULL,
    CONSTRAINT [MispunchCorrection_pkey] PRIMARY KEY CLUSTERED ([id])
);

-- AddForeignKey
ALTER TABLE [dbo].[MispunchCorrection] ADD CONSTRAINT [MispunchCorrection_employeeId_fkey] FOREIGN KEY ([employeeId]) REFERENCES [dbo].[Employee]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- CreateIndex
CREATE NONCLUSTERED INDEX [MispunchCorrection_employeeId_idx] ON [dbo].[MispunchCorrection]([employeeId]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [MispunchCorrection_status_idx] ON [dbo].[MispunchCorrection]([status]);

COMMIT TRAN;
