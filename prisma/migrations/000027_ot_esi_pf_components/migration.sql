-- KUN BRD review (2026-09-10), continued: OT Plan -> which SalaryComponent
-- the calculated OT amount pays through; ESI/PF -> which SalaryComponents
-- count toward the eligible-wage base (same includeInGratuity convention).
-- Additive only. Written without the prisma-diff TRY/CATCH wrapper because
-- scripts/apply-migration.mjs splits on ';' and runs statements one by one
-- inside its own transaction.

BEGIN TRAN;

ALTER TABLE [dbo].[SalaryComponent] ADD [includeInEsi] BIT NOT NULL CONSTRAINT [SalaryComponent_includeInEsi_df] DEFAULT 0;
ALTER TABLE [dbo].[SalaryComponent] ADD [includeInPf] BIT NOT NULL CONSTRAINT [SalaryComponent_includeInPf_df] DEFAULT 0;

ALTER TABLE [dbo].[OTPlan] ADD [payComponentId] INT NULL;
ALTER TABLE [dbo].[OTPlan] ADD CONSTRAINT [OTPlan_payComponentId_fkey] FOREIGN KEY ([payComponentId]) REFERENCES [dbo].[SalaryComponent]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;
CREATE NONCLUSTERED INDEX [OTPlan_payComponentId_idx] ON [dbo].[OTPlan]([payComponentId]);

COMMIT TRAN;
