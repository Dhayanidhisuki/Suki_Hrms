-- Adds JobInfo.pfApplicable (mirrors the existing esiApplicable field) so an
-- employee's PF eligibility can be set once on Job Profile, then used both
-- as the default for a new PayrollLine.pfApplicable and by the Salary
-- Details "Deductions" preview.
ALTER TABLE [dbo].[JobInfo] ADD [pfApplicable] BIT NOT NULL CONSTRAINT [DF_JobInfo_pfApplicable] DEFAULT 1;
