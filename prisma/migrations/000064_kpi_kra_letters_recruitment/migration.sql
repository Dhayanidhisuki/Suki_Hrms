-- KPI/KRA, HR letter register, recruitment applicants.

CREATE TABLE [KpiTemplate] (
  [id] INT NOT NULL IDENTITY(1,1),
  [companyId] INT NOT NULL,
  [code] NVARCHAR(30) NOT NULL,
  [kpiFor] NVARCHAR(20) NOT NULL CONSTRAINT [KpiTemplate_kpiFor_df] DEFAULT 'COMPANY',
  [departmentId] INT NULL,
  [designationId] INT NULL,
  [criteria] NVARCHAR(500) NOT NULL,
  [targetValue] NVARCHAR(100) NULL,
  [kpiType] NVARCHAR(20) NOT NULL CONSTRAINT [KpiTemplate_kpiType_df] DEFAULT 'QUANTITATIVE',
  [required] BIT NOT NULL CONSTRAINT [KpiTemplate_required_df] DEFAULT 0,
  [isActive] BIT NOT NULL CONSTRAINT [KpiTemplate_isActive_df] DEFAULT 1,
  [createdAt] DATETIME2 NOT NULL CONSTRAINT [KpiTemplate_createdAt_df] DEFAULT CURRENT_TIMESTAMP,
  [updatedAt] DATETIME2 NOT NULL CONSTRAINT [KpiTemplate_updatedAt_df] DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT [KpiTemplate_pkey] PRIMARY KEY ([id])
);
CREATE UNIQUE INDEX [KpiTemplate_companyId_code_key] ON [KpiTemplate]([companyId], [code]);
CREATE INDEX [KpiTemplate_companyId_kpiFor_idx] ON [KpiTemplate]([companyId], [kpiFor]);

CREATE TABLE [KpiGoal] (
  [id] INT NOT NULL IDENTITY(1,1),
  [companyId] INT NOT NULL,
  [name] NVARCHAR(200) NOT NULL,
  [measurementCriteria] NVARCHAR(500) NOT NULL,
  [monitoringFrequency] NVARCHAR(20) NOT NULL CONSTRAINT [KpiGoal_monitoringFrequency_df] DEFAULT 'MONTHLY',
  [reportingFrequency] NVARCHAR(20) NOT NULL CONSTRAINT [KpiGoal_reportingFrequency_df] DEFAULT 'QUARTERLY',
  [responsibility] NVARCHAR(200) NULL,
  [condition] NVARCHAR(200) NULL,
  [targetValue] NVARCHAR(100) NULL,
  [isActive] BIT NOT NULL CONSTRAINT [KpiGoal_isActive_df] DEFAULT 1,
  [createdAt] DATETIME2 NOT NULL CONSTRAINT [KpiGoal_createdAt_df] DEFAULT CURRENT_TIMESTAMP,
  [updatedAt] DATETIME2 NOT NULL CONSTRAINT [KpiGoal_updatedAt_df] DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT [KpiGoal_pkey] PRIMARY KEY ([id])
);
CREATE INDEX [KpiGoal_companyId_isActive_idx] ON [KpiGoal]([companyId], [isActive]);

CREATE TABLE [EmployeeKraCycle] (
  [id] INT NOT NULL IDENTITY(1,1),
  [companyId] INT NOT NULL,
  [employeeId] INT NOT NULL,
  [financialYear] NVARCHAR(9) NOT NULL,
  [periodLabel] NVARCHAR(20) NOT NULL CONSTRAINT [EmployeeKraCycle_periodLabel_df] DEFAULT 'ANNUAL',
  [status] NVARCHAR(20) NOT NULL CONSTRAINT [EmployeeKraCycle_status_df] DEFAULT 'DRAFT',
  [overallScore] DECIMAL(6,2) NULL,
  [managerRemark] NVARCHAR(1000) NULL,
  [submittedAt] DATETIME2 NULL,
  [lockedAt] DATETIME2 NULL,
  [createdAt] DATETIME2 NOT NULL CONSTRAINT [EmployeeKraCycle_createdAt_df] DEFAULT CURRENT_TIMESTAMP,
  [updatedAt] DATETIME2 NOT NULL CONSTRAINT [EmployeeKraCycle_updatedAt_df] DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT [EmployeeKraCycle_pkey] PRIMARY KEY ([id])
);
CREATE UNIQUE INDEX [EmployeeKraCycle_companyId_employeeId_financialYear_periodLabel_key] ON [EmployeeKraCycle]([companyId], [employeeId], [financialYear], [periodLabel]);
CREATE INDEX [EmployeeKraCycle_companyId_status_idx] ON [EmployeeKraCycle]([companyId], [status]);

CREATE TABLE [EmployeeKraLine] (
  [id] INT NOT NULL IDENTITY(1,1),
  [cycleId] INT NOT NULL,
  [kpiTemplateId] INT NULL,
  [goalId] INT NULL,
  [name] NVARCHAR(200) NOT NULL,
  [weightage] DECIMAL(5,2) NOT NULL,
  [targetValue] NVARCHAR(100) NULL,
  [actualValue] NVARCHAR(100) NULL,
  [score] DECIMAL(6,2) NULL,
  [maxScore] DECIMAL(6,2) NOT NULL CONSTRAINT [EmployeeKraLine_maxScore_df] DEFAULT 100,
  [createdAt] DATETIME2 NOT NULL CONSTRAINT [EmployeeKraLine_createdAt_df] DEFAULT CURRENT_TIMESTAMP,
  [updatedAt] DATETIME2 NOT NULL CONSTRAINT [EmployeeKraLine_updatedAt_df] DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT [EmployeeKraLine_pkey] PRIMARY KEY ([id]),
  CONSTRAINT [EmployeeKraLine_cycleId_fkey] FOREIGN KEY ([cycleId]) REFERENCES [EmployeeKraCycle]([id]) ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE INDEX [EmployeeKraLine_cycleId_idx] ON [EmployeeKraLine]([cycleId]);

CREATE TABLE [GeneratedHrLetter] (
  [id] INT NOT NULL IDENTITY(1,1),
  [companyId] INT NOT NULL,
  [letterType] NVARCHAR(40) NOT NULL,
  [referenceNo] NVARCHAR(60) NOT NULL,
  [employeeId] INT NULL,
  [applicantId] INT NULL,
  [issuedDate] DATE NOT NULL,
  [purpose] NVARCHAR(200) NULL,
  [bodySnapshot] NVARCHAR(MAX) NOT NULL,
  [platformDocumentId] INT NULL,
  [issuedByUserId] INT NULL,
  [createdAt] DATETIME2 NOT NULL CONSTRAINT [GeneratedHrLetter_createdAt_df] DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT [GeneratedHrLetter_pkey] PRIMARY KEY ([id])
);
CREATE UNIQUE INDEX [GeneratedHrLetter_companyId_referenceNo_key] ON [GeneratedHrLetter]([companyId], [referenceNo]);
CREATE INDEX [GeneratedHrLetter_companyId_letterType_idx] ON [GeneratedHrLetter]([companyId], [letterType]);
CREATE INDEX [GeneratedHrLetter_employeeId_idx] ON [GeneratedHrLetter]([employeeId]);
CREATE INDEX [GeneratedHrLetter_applicantId_idx] ON [GeneratedHrLetter]([applicantId]);

CREATE TABLE [LetterNumberSequence] (
  [companyId] INT NOT NULL,
  [letterType] NVARCHAR(40) NOT NULL,
  [year] INT NOT NULL,
  [lastNumber] INT NOT NULL,
  CONSTRAINT [LetterNumberSequence_pkey] PRIMARY KEY ([companyId], [letterType], [year])
);

CREATE TABLE [RecruitmentApplicant] (
  [id] INT NOT NULL IDENTITY(1,1),
  [companyId] INT NOT NULL,
  [applicationNo] NVARCHAR(40) NOT NULL,
  [applicantDate] DATE NOT NULL CONSTRAINT [RecruitmentApplicant_applicantDate_df] DEFAULT CURRENT_TIMESTAMP,
  [title] NVARCHAR(10) NULL,
  [firstName] NVARCHAR(100) NOT NULL,
  [lastName] NVARCHAR(100) NOT NULL,
  [mobile] NVARCHAR(20) NOT NULL,
  [email] NVARCHAR(100) NOT NULL,
  [dateOfBirth] DATE NULL,
  [aadhaarLast4] NVARCHAR(4) NULL,
  [departmentId] INT NULL,
  [designationId] INT NULL,
  [jobPostingId] INT NULL,
  [source] NVARCHAR(100) NULL,
  [referenceComments] NVARCHAR(500) NULL,
  [expectedSalary] DECIMAL(18,2) NULL,
  [noticePeriod] NVARCHAR(50) NULL,
  [availableJoinDate] DATE NULL,
  [proposedSalary] DECIMAL(18,2) NULL,
  [joiningDate] DATE NULL,
  [offerNo] NVARCHAR(50) NULL,
  [status] NVARCHAR(24) NOT NULL CONSTRAINT [RecruitmentApplicant_status_df] DEFAULT 'REGISTERED',
  [employeeId] INT NULL,
  [recruiterRemarks] NVARCHAR(1000) NULL,
  [createdAt] DATETIME2 NOT NULL CONSTRAINT [RecruitmentApplicant_createdAt_df] DEFAULT CURRENT_TIMESTAMP,
  [updatedAt] DATETIME2 NOT NULL CONSTRAINT [RecruitmentApplicant_updatedAt_df] DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT [RecruitmentApplicant_pkey] PRIMARY KEY ([id])
);
CREATE UNIQUE INDEX [RecruitmentApplicant_companyId_applicationNo_key] ON [RecruitmentApplicant]([companyId], [applicationNo]);
CREATE INDEX [RecruitmentApplicant_companyId_status_idx] ON [RecruitmentApplicant]([companyId], [status]);
CREATE INDEX [RecruitmentApplicant_companyId_mobile_idx] ON [RecruitmentApplicant]([companyId], [mobile]);
CREATE INDEX [RecruitmentApplicant_companyId_email_idx] ON [RecruitmentApplicant]([companyId], [email]);

CREATE TABLE [RecruitmentApplicationSequence] (
  [companyId] INT NOT NULL,
  [year] INT NOT NULL,
  [lastNumber] INT NOT NULL,
  CONSTRAINT [RecruitmentApplicationSequence_pkey] PRIMARY KEY ([companyId], [year])
);
