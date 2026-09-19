-- CreateTable: OnDutyRequest
CREATE TABLE [OnDutyRequest] (
    [id] INT IDENTITY(1,1) NOT NULL,
    [employeeId] INT NOT NULL,
    [fromDate] DATE NOT NULL,
    [toDate] DATE NOT NULL,
    [location] NVARCHAR(200) NOT NULL,
    [purpose] NVARCHAR(500) NOT NULL,
    [customerProject] NVARCHAR(200) NULL,
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

    CONSTRAINT [PK_OnDutyRequest] PRIMARY KEY ([id])
);

CREATE INDEX [OnDutyRequest_employeeId_idx] ON [OnDutyRequest] ([employeeId]);
CREATE INDEX [OnDutyRequest_status_idx] ON [OnDutyRequest] ([status]);

ALTER TABLE [OnDutyRequest] ADD CONSTRAINT [FK_OnDutyRequest_employee] FOREIGN KEY ([employeeId]) REFERENCES [Employee] ([id]);
