-- DepartmentWeeklyOff: make the unique key company-scoped.
--
-- Department is a global master (no companyId), so the old key
-- (departmentId, weekOffDay) was shared across every company: two companies
-- could not both configure Saturday off for PRODUCTION, and a lookup by
-- (departmentId, weekOffDay) returned whichever company inserted first.
-- Safe on existing data — the old key was strictly stricter than the new one.

-- DropIndex
DROP INDEX [DepartmentWeeklyOff_departmentId_idx] ON [dbo].[DepartmentWeeklyOff];

-- DropIndex
DROP INDEX [DepartmentWeeklyOff_departmentId_weekOffDay_key] ON [dbo].[DepartmentWeeklyOff];

-- CreateIndex
CREATE NONCLUSTERED INDEX [DepartmentWeeklyOff_companyId_departmentId_idx]
    ON [dbo].[DepartmentWeeklyOff]([companyId], [departmentId]);

-- CreateIndex
ALTER TABLE [dbo].[DepartmentWeeklyOff]
    ADD CONSTRAINT [DepartmentWeeklyOff_companyId_departmentId_weekOffDay_key]
    UNIQUE NONCLUSTERED ([companyId], [departmentId], [weekOffDay]);
