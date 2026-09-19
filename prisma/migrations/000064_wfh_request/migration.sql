-- CreateTable: WfhRequest
CREATE TABLE [WfhRequest] (
    [id] INT IDENTITY(1,1) NOT NULL,
    [employeeId] INT NOT NULL,
    [fromDate] DATE NOT NULL,
    [toDate] DATE NOT NULL,
    [reason] NVARCHAR(500) NOT NULL,
    [remarks] NVARCHAR(500) NULL,
    [status] NVARCHAR(20) NOT NULL DEFAULT 'pending_manager',
    [managerActionByUserId] INT NULL,
    [managerActionAt] DATETIME2 NULL,
    [managerRejectionReason] NVARCHAR(500) NULL,
    [approvedByUserId] INT NULL,
    [approvedAt] DATETIME2 NULL,
    [rejectionReason] NVARCHAR(500) NULL,
    [appliedAt] DATETIME2 NOT NULL DEFAULT GETUTCDATE(),
    [createdAt] DATETIME2 NOT NULL DEFAULT GETUTCDATE(),
    [updatedAt] DATETIME2 NOT NULL,

    CONSTRAINT [PK_WfhRequest] PRIMARY KEY ([id])
);

CREATE INDEX [WfhRequest_employeeId_idx] ON [WfhRequest] ([employeeId]);
CREATE INDEX [WfhRequest_status_idx] ON [WfhRequest] ([status]);

ALTER TABLE [WfhRequest] ADD CONSTRAINT [FK_WfhRequest_employee] FOREIGN KEY ([employeeId]) REFERENCES [Employee] ([id]);
