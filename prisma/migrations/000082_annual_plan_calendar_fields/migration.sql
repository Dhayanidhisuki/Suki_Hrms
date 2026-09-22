-- Annual training calendar fields — all additive nullable columns.
-- Trainee category, internal/external mentor, manual departments, trainer type,
-- schedule period (quarterly/half/yearly/month-wise), remarks, postponement.

ALTER TABLE [dbo].[TrainingPlanLine] ADD
    [traineeCategory] NVARCHAR(20) NULL,
    [mentorType] NVARCHAR(20) NULL,
    [mentorEmployeeId] INT NULL,
    [externalMentorName] NVARCHAR(150) NULL,
    [trainerType] NVARCHAR(100) NULL,
    [targetDepartments] NVARCHAR(500) NULL,
    [schedulePeriod] NVARCHAR(20) NULL,
    [monthFrom] INT NULL,
    [monthTo] INT NULL,
    [remarks] NVARCHAR(500) NULL,
    [postponedTo] DATETIME2 NULL;
