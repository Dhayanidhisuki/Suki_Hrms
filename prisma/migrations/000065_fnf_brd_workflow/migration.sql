ALTER TABLE [ExitInterview] ADD [resignationDate] DATE NULL;
ALTER TABLE [ExitInterview] ADD [noticePeriodDays] INT NULL;
ALTER TABLE [ExitInterview] ADD [noticeServedDays] INT NULL;
ALTER TABLE [ExitInterview] ADD [noticeWaivedDays] INT NOT NULL CONSTRAINT [DF_ExitInterview_noticeWaivedDays] DEFAULT 0;
ALTER TABLE [ExitInterview] ADD [clearanceStatus] NVARCHAR(20) NOT NULL CONSTRAINT [DF_ExitInterview_clearanceStatus] DEFAULT 'PENDING';

ALTER TABLE [FullAndFinalConfig] ADD [salaryDivisor] INT NOT NULL CONSTRAINT [DF_FullAndFinalConfig_salaryDivisor] DEFAULT 30;
ALTER TABLE [FullAndFinalConfig] ADD [noticeRateBasis] NVARCHAR(20) NOT NULL CONSTRAINT [DF_FullAndFinalConfig_noticeRateBasis] DEFAULT 'GROSS';
ALTER TABLE [FullAndFinalConfig] ADD [includeTds] BIT NOT NULL CONSTRAINT [DF_FullAndFinalConfig_includeTds] DEFAULT 1;
ALTER TABLE [FullAndFinalConfig] ADD [includePf] BIT NOT NULL CONSTRAINT [DF_FullAndFinalConfig_includePf] DEFAULT 1;
ALTER TABLE [FullAndFinalConfig] ADD [includeEsi] BIT NOT NULL CONSTRAINT [DF_FullAndFinalConfig_includeEsi] DEFAULT 1;

ALTER TABLE [FnFSettlement] ADD [arrearsAmount] DECIMAL(18, 2) NOT NULL CONSTRAINT [DF_FnFSettlement_arrearsAmount] DEFAULT 0;
ALTER TABLE [FnFSettlement] ADD [incentiveAmount] DECIMAL(18, 2) NOT NULL CONSTRAINT [DF_FnFSettlement_incentiveAmount] DEFAULT 0;
ALTER TABLE [FnFSettlement] ADD [tdsDeduction] DECIMAL(18, 2) NOT NULL CONSTRAINT [DF_FnFSettlement_tdsDeduction] DEFAULT 0;
ALTER TABLE [FnFSettlement] ADD [pfDeduction] DECIMAL(18, 2) NOT NULL CONSTRAINT [DF_FnFSettlement_pfDeduction] DEFAULT 0;
ALTER TABLE [FnFSettlement] ADD [esiDeduction] DECIMAL(18, 2) NOT NULL CONSTRAINT [DF_FnFSettlement_esiDeduction] DEFAULT 0;
ALTER TABLE [FnFSettlement] ADD [payableDays] INT NOT NULL CONSTRAINT [DF_FnFSettlement_payableDays] DEFAULT 0;
ALTER TABLE [FnFSettlement] ADD [salaryDivisor] INT NOT NULL CONSTRAINT [DF_FnFSettlement_salaryDivisor] DEFAULT 30;
ALTER TABLE [FnFSettlement] ADD [noticeServedDays] INT NOT NULL CONSTRAINT [DF_FnFSettlement_noticeServedDays] DEFAULT 0;
ALTER TABLE [FnFSettlement] ADD [noticeWaivedDays] INT NOT NULL CONSTRAINT [DF_FnFSettlement_noticeWaivedDays] DEFAULT 0;
ALTER TABLE [FnFSettlement] ADD [noticeShortfallDays] INT NOT NULL CONSTRAINT [DF_FnFSettlement_noticeShortfallDays] DEFAULT 0;
ALTER TABLE [FnFSettlement] ADD [snapshotJson] NVARCHAR(MAX) NULL;
ALTER TABLE [FnFSettlement] ADD [overrideRemark] NVARCHAR(500) NULL;
ALTER TABLE [FnFSettlement] ADD [submittedByUserId] INT NULL;
ALTER TABLE [FnFSettlement] ADD [submittedAt] DATETIME2 NULL;
ALTER TABLE [FnFSettlement] ADD [completedAt] DATETIME2 NULL;

CREATE TABLE [FnFSettlementLine] (
  [id] INT NOT NULL IDENTITY(1,1),
  [settlementId] INT NOT NULL,
  [kind] NVARCHAR(20) NOT NULL,
  [code] NVARCHAR(40) NOT NULL,
  [name] NVARCHAR(120) NOT NULL,
  [source] NVARCHAR(20) NOT NULL CONSTRAINT [DF_FnFSettlementLine_source] DEFAULT 'SYSTEM',
  [amount] DECIMAL(18, 2) NOT NULL,
  [editable] BIT NOT NULL CONSTRAINT [DF_FnFSettlementLine_editable] DEFAULT 0,
  [remark] NVARCHAR(500) NULL,
  [sortOrder] INT NOT NULL CONSTRAINT [DF_FnFSettlementLine_sortOrder] DEFAULT 0,
  CONSTRAINT [FnFSettlementLine_pkey] PRIMARY KEY CLUSTERED ([id]),
  CONSTRAINT [FnFSettlementLine_settlementId_fkey] FOREIGN KEY ([settlementId]) REFERENCES [FnFSettlement]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION
);

CREATE INDEX [FnFSettlementLine_settlementId_idx] ON [FnFSettlementLine]([settlementId]);
