-- On-Duty requests: record the duration picked (half day / 3hr / 4hr / full
-- day — anything short of a full day is expected to be agreed with the
-- reporting manager beforehand) and a one-shot GPS location + timestamp
-- captured client-side at the moment the employee submits the request.
-- Additive-only, all columns nullable so every existing row keeps working.

BEGIN TRAN;

ALTER TABLE [dbo].[OnDutyRequest] ADD [durationType] NVARCHAR(20) NULL;
ALTER TABLE [dbo].[OnDutyRequest] ADD [latitude] FLOAT NULL;
ALTER TABLE [dbo].[OnDutyRequest] ADD [longitude] FLOAT NULL;
ALTER TABLE [dbo].[OnDutyRequest] ADD [locationCapturedAt] DATETIME2 NULL;

COMMIT TRAN;
