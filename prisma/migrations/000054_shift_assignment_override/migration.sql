-- CreateTable: ShiftAssignmentOverride for per-employee, per-date shift overrides
CREATE TABLE [ShiftAssignmentOverride] (
    [id] INT IDENTITY(1,1) NOT NULL,
    [employeeId] INT NOT NULL,
    [date] DATE NOT NULL,
    [shiftMasterId] INT NOT NULL,
    [reason] NVARCHAR(500) NULL,
    [createdByUserId] INT NULL,
    [createdAt] DATETIME2 NOT NULL DEFAULT GETUTCDATE(),
    [updatedAt] DATETIME2 NOT NULL,

    CONSTRAINT [PK_ShiftAssignmentOverride] PRIMARY KEY ([id])
);

-- Create unique constraint on [employeeId, date]
CREATE UNIQUE INDEX [ShiftAssignmentOverride_employeeId_date_key] ON [ShiftAssignmentOverride] ([employeeId], [date]);

-- Create indexes
CREATE INDEX [ShiftAssignmentOverride_employeeId_idx] ON [ShiftAssignmentOverride] ([employeeId]);
CREATE INDEX [ShiftAssignmentOverride_date_idx] ON [ShiftAssignmentOverride] ([date]);

-- Add foreign key constraints
ALTER TABLE [ShiftAssignmentOverride] ADD CONSTRAINT [FK_ShiftAssignmentOverride_employee] FOREIGN KEY ([employeeId]) REFERENCES [Employee] ([id]);
ALTER TABLE [ShiftAssignmentOverride] ADD CONSTRAINT [FK_ShiftAssignmentOverride_shiftMaster] FOREIGN KEY ([shiftMasterId]) REFERENCES [ShiftMaster] ([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;
