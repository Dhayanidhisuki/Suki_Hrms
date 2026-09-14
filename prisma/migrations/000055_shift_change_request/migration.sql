-- CreateTable: ApprovalChainConfig
CREATE TABLE [ApprovalChainConfig] (
    [id] INT IDENTITY(1,1) NOT NULL,
    [companyId] INT NOT NULL,
    [module] NVARCHAR(50) NOT NULL,
    [stageName] NVARCHAR(50) NOT NULL,
    [stageOrder] INT NOT NULL,
    [approverType] NVARCHAR(20) NOT NULL,
    [approverRoleId] INT NULL,
    [approverUserId] INT NULL,
    [isActive] BIT NOT NULL DEFAULT 1,
    [createdAt] DATETIME2 NOT NULL DEFAULT GETUTCDATE(),
    [updatedAt] DATETIME2 NOT NULL,

    CONSTRAINT [PK_ApprovalChainConfig] PRIMARY KEY ([id])
);

CREATE UNIQUE INDEX [ApprovalChainConfig_companyId_module_stageOrder_key] ON [ApprovalChainConfig] ([companyId], [module], [stageOrder]);
CREATE INDEX [ApprovalChainConfig_companyId_module_idx] ON [ApprovalChainConfig] ([companyId], [module]);

ALTER TABLE [ApprovalChainConfig] ADD CONSTRAINT [FK_ApprovalChainConfig_company] FOREIGN KEY ([companyId]) REFERENCES [Company] ([id]);

-- CreateTable: ShiftChangeRequest
CREATE TABLE [ShiftChangeRequest] (
    [id] INT IDENTITY(1,1) NOT NULL,
    [employeeId] INT NOT NULL,
    [requestedDate] DATE NOT NULL,
    [currentShiftMasterId] INT NULL,
    [requestedShiftMasterId] INT NOT NULL,
    [reason] NVARCHAR(500) NULL,
    [status] NVARCHAR(20) NOT NULL DEFAULT 'pending',
    [currentStageOrder] INT NOT NULL DEFAULT 1,
    [approvedByUserId] INT NULL,
    [approvedAt] DATETIME2 NULL,
    [rejectionReason] NVARCHAR(500) NULL,
    [rejectedByUserId] INT NULL,
    [rejectedAt] DATETIME2 NULL,
    [createdByUserId] INT NULL,
    [createdAt] DATETIME2 NOT NULL DEFAULT GETUTCDATE(),
    [updatedAt] DATETIME2 NOT NULL,

    CONSTRAINT [PK_ShiftChangeRequest] PRIMARY KEY ([id])
);

CREATE INDEX [ShiftChangeRequest_employeeId_idx] ON [ShiftChangeRequest] ([employeeId]);
CREATE INDEX [ShiftChangeRequest_status_idx] ON [ShiftChangeRequest] ([status]);

ALTER TABLE [ShiftChangeRequest] ADD CONSTRAINT [FK_ShiftChangeRequest_employee] FOREIGN KEY ([employeeId]) REFERENCES [Employee] ([id]);
ALTER TABLE [ShiftChangeRequest] ADD CONSTRAINT [FK_ShiftChangeRequest_currentShift] FOREIGN KEY ([currentShiftMasterId]) REFERENCES [ShiftMaster] ([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;
ALTER TABLE [ShiftChangeRequest] ADD CONSTRAINT [FK_ShiftChangeRequest_requestedShift] FOREIGN KEY ([requestedShiftMasterId]) REFERENCES [ShiftMaster] ([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;
