-- CreateTable: DepartmentWeeklyOff
CREATE TABLE [DepartmentWeeklyOff] (
    [id] INT IDENTITY(1,1) NOT NULL,
    [companyId] INT NOT NULL,
    [departmentId] INT NOT NULL,
    [weekOffDay] INT NOT NULL,
    [isFrozen] BIT NOT NULL DEFAULT 0,
    [createdByUserId] INT NULL,
    [createdAt] DATETIME2 NOT NULL DEFAULT GETUTCDATE(),
    [updatedAt] DATETIME2 NOT NULL,

    CONSTRAINT [PK_DepartmentWeeklyOff] PRIMARY KEY ([id])
);

CREATE UNIQUE INDEX [DepartmentWeeklyOff_departmentId_weekOffDay_key] ON [DepartmentWeeklyOff] ([departmentId], [weekOffDay]);
CREATE INDEX [DepartmentWeeklyOff_departmentId_idx] ON [DepartmentWeeklyOff] ([departmentId]);

ALTER TABLE [DepartmentWeeklyOff] ADD CONSTRAINT [FK_DepartmentWeeklyOff_company] FOREIGN KEY ([companyId]) REFERENCES [Company] ([id]);
ALTER TABLE [DepartmentWeeklyOff] ADD CONSTRAINT [FK_DepartmentWeeklyOff_department] FOREIGN KEY ([departmentId]) REFERENCES [Department] ([id]);

-- CreateTable: LeaveTypeMaster
CREATE TABLE [LeaveTypeMaster] (
    [id] INT IDENTITY(1,1) NOT NULL,
    [companyId] INT NOT NULL,
    [code] NVARCHAR(20) NOT NULL,
    [name] NVARCHAR(100) NOT NULL,
    [color] NVARCHAR(20) NOT NULL,
    [description] NVARCHAR(500) NULL,
    [isActive] BIT NOT NULL DEFAULT 1,
    [deletedAt] DATETIME2 NULL,
    [createdAt] DATETIME2 NOT NULL DEFAULT GETUTCDATE(),
    [updatedAt] DATETIME2 NOT NULL,

    CONSTRAINT [PK_LeaveTypeMaster] PRIMARY KEY ([id])
);

CREATE UNIQUE INDEX [LeaveTypeMaster_companyId_code_key] ON [LeaveTypeMaster] ([companyId], [code]);
CREATE INDEX [LeaveTypeMaster_companyId_idx] ON [LeaveTypeMaster] ([companyId]);

ALTER TABLE [LeaveTypeMaster] ADD CONSTRAINT [FK_LeaveTypeMaster_company] FOREIGN KEY ([companyId]) REFERENCES [Company] ([id]);

-- CreateTable: YearlyLeaveCalendar
CREATE TABLE [YearlyLeaveCalendar] (
    [id] INT IDENTITY(1,1) NOT NULL,
    [companyId] INT NOT NULL,
    [date] DATE NOT NULL,
    [leaveTypeMasterId] INT NOT NULL,
    [name] NVARCHAR(100) NOT NULL,
    [description] NVARCHAR(500) NULL,
    [isActive] BIT NOT NULL DEFAULT 1,
    [deletedAt] DATETIME2 NULL,
    [createdAt] DATETIME2 NOT NULL DEFAULT GETUTCDATE(),
    [updatedAt] DATETIME2 NOT NULL,

    CONSTRAINT [PK_YearlyLeaveCalendar] PRIMARY KEY ([id])
);

CREATE UNIQUE INDEX [YearlyLeaveCalendar_companyId_date_key] ON [YearlyLeaveCalendar] ([companyId], [date]);
CREATE INDEX [YearlyLeaveCalendar_companyId_idx] ON [YearlyLeaveCalendar] ([companyId]);

ALTER TABLE [YearlyLeaveCalendar] ADD CONSTRAINT [FK_YearlyLeaveCalendar_company] FOREIGN KEY ([companyId]) REFERENCES [Company] ([id]);
ALTER TABLE [YearlyLeaveCalendar] ADD CONSTRAINT [FK_YearlyLeaveCalendar_leaveTypeMaster] FOREIGN KEY ([leaveTypeMasterId]) REFERENCES [LeaveTypeMaster] ([id]);
