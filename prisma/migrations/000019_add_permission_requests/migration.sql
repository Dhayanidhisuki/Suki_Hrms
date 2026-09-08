-- PermissionPolicy + PermissionRequest: the "Permission" half of BRD
-- section 6 (Comp-Off & Permission Rules) — employee short-leave-in-hours
-- requests, single-stage RBAC approval, checked against a per-company
-- monthly free-hours policy. Additive only. Written without the
-- prisma-diff TRY/CATCH wrapper because scripts/apply-migration.mjs splits
-- on ';' and runs statements one by one inside its own transaction.

BEGIN TRAN;

-- CreateTable
CREATE TABLE [dbo].[PermissionPolicy] (
    [id] INT NOT NULL IDENTITY(1,1),
    [companyId] INT NOT NULL,
    [freeHoursPerMonth] DECIMAL(4, 2) NOT NULL CONSTRAINT [PermissionPolicy_freeHoursPerMonth_df] DEFAULT 2,
    [createdAt] DATETIME2 NOT NULL CONSTRAINT [PermissionPolicy_createdAt_df] DEFAULT CURRENT_TIMESTAMP,
    [updatedAt] DATETIME2 NOT NULL,
    CONSTRAINT [PermissionPolicy_pkey] PRIMARY KEY CLUSTERED ([id]),
    CONSTRAINT [PermissionPolicy_companyId_key] UNIQUE ([companyId])
);

-- CreateTable
CREATE TABLE [dbo].[PermissionRequest] (
    [id] INT NOT NULL IDENTITY(1,1),
    [employeeId] INT NOT NULL,
    [date] DATE NOT NULL,
    [fromTime] DATETIME2 NOT NULL,
    [toTime] DATETIME2 NOT NULL,
    [hours] DECIMAL(4, 2) NOT NULL,
    [reason] NVARCHAR(500),
    [status] NVARCHAR(20) NOT NULL CONSTRAINT [PermissionRequest_status_df] DEFAULT 'pending',
    [approvedByUserId] INT,
    [approvedAt] DATETIME2,
    [rejectionReason] NVARCHAR(500),
    [exceedsAllowance] BIT NOT NULL CONSTRAINT [PermissionRequest_exceedsAllowance_df] DEFAULT 0,
    [excessHours] DECIMAL(4, 2) NOT NULL CONSTRAINT [PermissionRequest_excessHours_df] DEFAULT 0,
    [appliedAt] DATETIME2 NOT NULL CONSTRAINT [PermissionRequest_appliedAt_df] DEFAULT CURRENT_TIMESTAMP,
    [createdAt] DATETIME2 NOT NULL CONSTRAINT [PermissionRequest_createdAt_df] DEFAULT CURRENT_TIMESTAMP,
    [updatedAt] DATETIME2 NOT NULL,
    CONSTRAINT [PermissionRequest_pkey] PRIMARY KEY CLUSTERED ([id])
);

-- AddForeignKey
ALTER TABLE [dbo].[PermissionPolicy] ADD CONSTRAINT [PermissionPolicy_companyId_fkey] FOREIGN KEY ([companyId]) REFERENCES [dbo].[Company]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[PermissionRequest] ADD CONSTRAINT [PermissionRequest_employeeId_fkey] FOREIGN KEY ([employeeId]) REFERENCES [dbo].[Employee]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- CreateIndex
CREATE NONCLUSTERED INDEX [PermissionRequest_employeeId_idx] ON [dbo].[PermissionRequest]([employeeId]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [PermissionRequest_status_idx] ON [dbo].[PermissionRequest]([status]);

COMMIT TRAN;
