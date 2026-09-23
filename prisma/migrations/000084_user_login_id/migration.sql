-- AlterTable: add a reference Login ID (= linked Employee's employeeCode)
-- to User. Additive only — nullable, no existing rows affected.

ALTER TABLE [User] ADD [loginId] NVARCHAR(30) NULL;
