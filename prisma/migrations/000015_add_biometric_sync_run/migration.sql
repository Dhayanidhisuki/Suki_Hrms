-- BiometricSyncRun: one row per device-API sync run (scheduled every N hours
-- from src/instrumentation.ts, or manual from the Biometric page). Additive
-- only. Written without the prisma-diff TRY/CATCH wrapper because
-- scripts/apply-migration.mjs splits on ';' and runs statements one by one
-- inside its own transaction.

BEGIN TRAN;

-- CreateTable
CREATE TABLE [dbo].[BiometricSyncRun] (
    [id] INT NOT NULL IDENTITY(1,1),
    [companyId] INT NOT NULL,
    [trigger] NVARCHAR(20) NOT NULL,
    [rangeStart] DATE NOT NULL,
    [rangeEnd] DATE NOT NULL,
    [status] NVARCHAR(20) NOT NULL CONSTRAINT [BiometricSyncRun_status_df] DEFAULT 'running',
    [rowsFetched] INT NOT NULL CONSTRAINT [BiometricSyncRun_rowsFetched_df] DEFAULT 0,
    [daysCreated] INT NOT NULL CONSTRAINT [BiometricSyncRun_daysCreated_df] DEFAULT 0,
    [daysUpdated] INT NOT NULL CONSTRAINT [BiometricSyncRun_daysUpdated_df] DEFAULT 0,
    [daysUnchanged] INT NOT NULL CONSTRAINT [BiometricSyncRun_daysUnchanged_df] DEFAULT 0,
    [skippedFrozen] INT NOT NULL CONSTRAINT [BiometricSyncRun_skippedFrozen_df] DEFAULT 0,
    [unmatchedUserIds] NVARCHAR(max),
    [error] NVARCHAR(2000),
    [triggeredByUserId] INT,
    [startedAt] DATETIME2 NOT NULL CONSTRAINT [BiometricSyncRun_startedAt_df] DEFAULT CURRENT_TIMESTAMP,
    [finishedAt] DATETIME2,
    CONSTRAINT [BiometricSyncRun_pkey] PRIMARY KEY CLUSTERED ([id])
);

-- CreateIndex
CREATE NONCLUSTERED INDEX [BiometricSyncRun_companyId_startedAt_idx] ON [dbo].[BiometricSyncRun]([companyId], [startedAt]);

COMMIT TRAN;
