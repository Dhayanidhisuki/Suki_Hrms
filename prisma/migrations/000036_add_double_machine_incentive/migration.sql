-- Double Machine Incentive: one employee-month row for the BRD B5/B6
-- amounts (Double Machine, Att.Bonus, Shift Incentive, OT Weekly Inc,
-- Employee R). Additive only. Written without a TRY/CATCH wrapper because
-- scripts/apply-migration.mjs splits on ';' and runs statements one by one
-- inside its own transaction.

BEGIN TRAN;

CREATE TABLE [dbo].[DoubleMachineIncentive] (
    [id] INT NOT NULL IDENTITY(1,1),
    [companyId] INT NOT NULL,
    [employeeId] INT NOT NULL,
    [year] INT NOT NULL,
    [month] INT NOT NULL,
    [doubleMachine] DECIMAL(18, 2) NOT NULL CONSTRAINT [DoubleMachineIncentive_doubleMachine_df] DEFAULT 0,
    [attendanceBonus] DECIMAL(18, 2) NOT NULL CONSTRAINT [DoubleMachineIncentive_attendanceBonus_df] DEFAULT 0,
    [shiftIncentive] DECIMAL(18, 2) NOT NULL CONSTRAINT [DoubleMachineIncentive_shiftIncentive_df] DEFAULT 0,
    [otWeeklyInc] DECIMAL(18, 2) NOT NULL CONSTRAINT [DoubleMachineIncentive_otWeeklyInc_df] DEFAULT 0,
    [employeeR] DECIMAL(18, 2) NOT NULL CONSTRAINT [DoubleMachineIncentive_employeeR_df] DEFAULT 0,
    [status] NVARCHAR(20) NOT NULL CONSTRAINT [DoubleMachineIncentive_status_df] DEFAULT 'draft',
    [remarks] NVARCHAR(500) NULL,
    [createdByUserId] INT NULL,
    [updatedByUserId] INT NULL,
    [createdAt] DATETIME2 NOT NULL CONSTRAINT [DoubleMachineIncentive_createdAt_df] DEFAULT CURRENT_TIMESTAMP,
    [updatedAt] DATETIME2 NOT NULL,
    CONSTRAINT [DoubleMachineIncentive_pkey] PRIMARY KEY CLUSTERED ([id]),
    CONSTRAINT [DoubleMachineIncentive_employeeId_year_month_key] UNIQUE ([employeeId], [year], [month])
);

CREATE INDEX [DoubleMachineIncentive_companyId_year_month_idx] ON [dbo].[DoubleMachineIncentive]([companyId], [year], [month]);
CREATE INDEX [DoubleMachineIncentive_status_idx] ON [dbo].[DoubleMachineIncentive]([status]);

ALTER TABLE [dbo].[DoubleMachineIncentive] ADD CONSTRAINT [DoubleMachineIncentive_companyId_fkey] FOREIGN KEY ([companyId]) REFERENCES [dbo].[Company]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;
ALTER TABLE [dbo].[DoubleMachineIncentive] ADD CONSTRAINT [DoubleMachineIncentive_employeeId_fkey] FOREIGN KEY ([employeeId]) REFERENCES [dbo].[Employee]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

COMMIT TRAN;
