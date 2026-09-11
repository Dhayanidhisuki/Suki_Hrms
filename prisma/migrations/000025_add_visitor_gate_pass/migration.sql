-- 000025_add_visitor_gate_pass
-- Only the VisitorGatePass table + its indexes + its two FKs.
-- The live DB carries other branches' objects not present in this schema;
-- those diff noise lines were removed so this migration only adds Visitor.

BEGIN TRY

BEGIN TRAN;

-- CreateTable
CREATE TABLE [dbo].[VisitorGatePass] (
    [id] INT NOT NULL IDENTITY(1,1),
    [companyId] INT NOT NULL,
    [gatePassNo] NVARCHAR(50) NOT NULL,
    [passType] NVARCHAR(20) NOT NULL,
    [status] NVARCHAR(20) NOT NULL CONSTRAINT [VisitorGatePass_status_df] DEFAULT 'SCHEDULED',
    [visitorName] NVARCHAR(100) NOT NULL,
    [mobileNo] NVARCHAR(15) NOT NULL,
    [mobilePrefix] NVARCHAR(5) NOT NULL CONSTRAINT [VisitorGatePass_mobilePrefix_df] DEFAULT '+91',
    [visitorTypeValue] NVARCHAR(100),
    [partyName] NVARCHAR(200),
    [email] NVARCHAR(200),
    [address] NVARCHAR(500),
    [visitDate] DATE NOT NULL,
    [validFrom] DATETIME2 NOT NULL,
    [validTo] DATETIME2 NOT NULL,
    [plannedInTime] NVARCHAR(5),
    [plannedOutTime] NVARCHAR(5),
    [personToMeetId] INT NOT NULL,
    [noOfPersons] INT NOT NULL CONSTRAINT [VisitorGatePass_noOfPersons_df] DEFAULT 1,
    [purposeValue] NVARCHAR(100),
    [foodRequired] BIT NOT NULL CONSTRAINT [VisitorGatePass_foodRequired_df] DEFAULT 0,
    [foodCategory] NVARCHAR(50),
    [foodType] NVARCHAR(50),
    [gadgets] NVARCHAR(50),
    [checkInBy] INT,
    [checkInTime] DATETIME2,
    [checkOutBy] INT,
    [checkOutTime] DATETIME2,
    [qrToken] NVARCHAR(64) NOT NULL,
    [qrValidMinutes] INT NOT NULL CONSTRAINT [VisitorGatePass_qrValidMinutes_df] DEFAULT 1440,
    [createdBy] INT,
    [createdAt] DATETIME2 NOT NULL CONSTRAINT [VisitorGatePass_createdAt_df] DEFAULT CURRENT_TIMESTAMP,
    [updatedBy] INT,
    [updatedAt] DATETIME2 NOT NULL,
    [deletedAt] DATETIME2,
    CONSTRAINT [VisitorGatePass_pkey] PRIMARY KEY CLUSTERED ([id]),
    CONSTRAINT [VisitorGatePass_gatePassNo_key] UNIQUE NONCLUSTERED ([gatePassNo]),
    CONSTRAINT [VisitorGatePass_qrToken_key] UNIQUE NONCLUSTERED ([qrToken])
);

-- CreateIndex
CREATE NONCLUSTERED INDEX [VisitorGatePass_companyId_status_idx] ON [dbo].[VisitorGatePass]([companyId], [status]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [VisitorGatePass_companyId_visitDate_idx] ON [dbo].[VisitorGatePass]([companyId], [visitDate]);

-- AddForeignKey
ALTER TABLE [dbo].[VisitorGatePass] ADD CONSTRAINT [VisitorGatePass_companyId_fkey] FOREIGN KEY ([companyId]) REFERENCES [dbo].[Company]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[VisitorGatePass] ADD CONSTRAINT [VisitorGatePass_personToMeetId_fkey] FOREIGN KEY ([personToMeetId]) REFERENCES [dbo].[Employee]([id]) ON DELETE NO ACTION ON UPDATE CASCADE;

COMMIT TRAN;

END TRY
BEGIN CATCH

IF @@TRANCOUNT > 0
BEGIN
    ROLLBACK TRAN;
END;
THROW

END CATCH
