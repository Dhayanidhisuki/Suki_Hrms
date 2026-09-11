-- KUN BRD review (2026-09-10), item 4 (JD Upload): Designation.jobDescription
-- — populated via bulk Excel/CSV import (Designation Code + Job Description
-- columns), not typed per row in the Designation form. See
-- /masters/designations/jd-upload and POST /api/masters/designations/jd-bulk-import.
--
-- Additive only. Written without the prisma-diff TRY/CATCH wrapper because
-- scripts/apply-migration.mjs splits on ';' and runs statements one by one
-- inside its own transaction.

BEGIN TRAN;

ALTER TABLE [dbo].[Designation] ADD [jobDescription] NVARCHAR(MAX) NULL;

COMMIT TRAN;
