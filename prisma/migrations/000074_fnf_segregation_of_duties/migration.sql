-- Segregation of duties on Full & Final.
--
-- Purely additive: three nullable/defaulted columns, no table rebuild. The
-- destructive-rebuild pattern is deliberately avoided here — see
-- prisma/migrations/20260916192131_add-recruitment-module/DO_NOT_APPLY.md.

-- Actor stamps for the two approval-chain steps that did not record one.
ALTER TABLE [dbo].[FnFSettlement] ADD [managerApprovedByUserId] INT NULL;
ALTER TABLE [dbo].[FnFSettlement] ADD [managerApprovedAt] DATETIME2 NULL;
ALTER TABLE [dbo].[FnFSettlement] ADD [paidByUserId] INT NULL;

-- Enforced by default: a control that is off unless someone remembers to turn
-- it on is not a control.
ALTER TABLE [dbo].[FullAndFinalConfig]
  ADD [enforceSegregationOfDuties] BIT NOT NULL CONSTRAINT [DF_FnFConfig_enforceSoD] DEFAULT 1;
