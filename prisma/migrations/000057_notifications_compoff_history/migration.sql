-- AlterTable: add weekly-off/holiday worked flags to DailyAttendanceHistory
ALTER TABLE [DailyAttendanceHistory] ADD
    [isWeeklyOffWorked] BIT NOT NULL DEFAULT 0,
    [isHolidayWorked] BIT NOT NULL DEFAULT 0;

-- CreateTable: ShiftChangeNotification
CREATE TABLE [ShiftChangeNotification] (
    [id] INT IDENTITY(1,1) NOT NULL,
    [employeeId] INT NOT NULL,
    [date] DATE NOT NULL,
    [oldShiftMasterId] INT NULL,
    [newShiftMasterId] INT NOT NULL,
    [reason] NVARCHAR(500) NULL,
    [isRead] BIT NOT NULL DEFAULT 0,
    [createdByUserId] INT NULL,
    [createdAt] DATETIME2 NOT NULL DEFAULT GETUTCDATE(),

    CONSTRAINT [PK_ShiftChangeNotification] PRIMARY KEY ([id])
);

CREATE INDEX [ShiftChangeNotification_employeeId_idx] ON [ShiftChangeNotification] ([employeeId]);
CREATE INDEX [ShiftChangeNotification_isRead_idx] ON [ShiftChangeNotification] ([isRead]);

ALTER TABLE [ShiftChangeNotification] ADD CONSTRAINT [FK_ShiftChangeNotification_employee] FOREIGN KEY ([employeeId]) REFERENCES [Employee] ([id]);
ALTER TABLE [ShiftChangeNotification] ADD CONSTRAINT [FK_ShiftChangeNotification_oldShift] FOREIGN KEY ([oldShiftMasterId]) REFERENCES [ShiftMaster] ([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;
ALTER TABLE [ShiftChangeNotification] ADD CONSTRAINT [FK_ShiftChangeNotification_newShift] FOREIGN KEY ([newShiftMasterId]) REFERENCES [ShiftMaster] ([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- CreateTable: CompOffRequest
CREATE TABLE [CompOffRequest] (
    [id] INT IDENTITY(1,1) NOT NULL,
    [employeeId] INT NOT NULL,
    [workedDate] DATE NOT NULL,
    [requestedDate] DATE NOT NULL,
    [reason] NVARCHAR(500) NULL,
    [status] NVARCHAR(20) NOT NULL DEFAULT 'pending',
    [approvedByUserId] INT NULL,
    [approvedAt] DATETIME2 NULL,
    [rejectionReason] NVARCHAR(500) NULL,
    [rejectedByUserId] INT NULL,
    [rejectedAt] DATETIME2 NULL,
    [createdByUserId] INT NULL,
    [createdAt] DATETIME2 NOT NULL DEFAULT GETUTCDATE(),
    [updatedAt] DATETIME2 NOT NULL,

    CONSTRAINT [PK_CompOffRequest] PRIMARY KEY ([id])
);

CREATE INDEX [CompOffRequest_employeeId_idx] ON [CompOffRequest] ([employeeId]);
CREATE INDEX [CompOffRequest_status_idx] ON [CompOffRequest] ([status]);

ALTER TABLE [CompOffRequest] ADD CONSTRAINT [FK_CompOffRequest_employee] FOREIGN KEY ([employeeId]) REFERENCES [Employee] ([id]);
