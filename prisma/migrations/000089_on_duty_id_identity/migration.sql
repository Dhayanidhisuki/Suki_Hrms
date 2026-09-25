-- Pre-existing bug fix, unrelated to the GPS/duration feature in
-- 000088_on_duty_gps: OnDutyRequest.id was never actually created as an
-- IDENTITY column in this database, despite the Prisma schema declaring
-- `@id @default(autoincrement())`. Every insert therefore fails with a
-- NULL-constraint violation on `id` — no On-Duty request has ever been
-- successfully created here. Table has 0 rows and nothing else references
-- it by id, so dropping/recreating the column is safe.

BEGIN TRAN;

ALTER TABLE [dbo].[OnDutyRequest] DROP CONSTRAINT [OnDutyRequest_pkey];
ALTER TABLE [dbo].[OnDutyRequest] DROP COLUMN [id];
ALTER TABLE [dbo].[OnDutyRequest] ADD [id] INT IDENTITY(1,1) NOT NULL;
ALTER TABLE [dbo].[OnDutyRequest] ADD CONSTRAINT [OnDutyRequest_pkey] PRIMARY KEY ([id]);

COMMIT TRAN;
