-- Phase 12: documents library, external training, IDP + program→competency
-- links for the recommendation engine (BRD §32, §35, §38, §48).

BEGIN TRAN;

ALTER TABLE dbo.TrainingProgram ADD competencyId INT NULL, skillId INT NULL;

CREATE TABLE dbo.TrainingDocument (
  id INT NOT NULL,
  companyId INT NOT NULL,
  title NVARCHAR(200) NOT NULL,
  docType NVARCHAR(30) NOT NULL CONSTRAINT TrainingDocument_docType_df DEFAULT 'MATERIAL',
  filePath NVARCHAR(500) NOT NULL,
  fileSize INT NULL,
  mimeType NVARCHAR(100) NULL,
  trainingScheduleId INT NULL,
  trainingProgramId INT NULL,
  employeeId INT NULL,
  uploadedByUserId INT NULL,
  remarks NVARCHAR(500) NULL,
  isActive BIT NOT NULL CONSTRAINT TrainingDocument_isActive_df DEFAULT 1,
  deletedAt DATETIME2 NULL,
  createdAt DATETIME2 NOT NULL CONSTRAINT TrainingDocument_createdAt_df DEFAULT CURRENT_TIMESTAMP,
  updatedAt DATETIME2 NOT NULL,
  CONSTRAINT TrainingDocument_pkey PRIMARY KEY (id)
);
CREATE INDEX TrainingDocument_companyId_trainingScheduleId_idx ON dbo.TrainingDocument (companyId, trainingScheduleId);
CREATE INDEX TrainingDocument_companyId_trainingProgramId_idx ON dbo.TrainingDocument (companyId, trainingProgramId);
CREATE INDEX TrainingDocument_companyId_employeeId_idx ON dbo.TrainingDocument (companyId, employeeId);

CREATE TABLE dbo.ExternalTraining (
  id INT NOT NULL,
  companyId INT NOT NULL,
  title NVARCHAR(200) NOT NULL,
  providerName NVARCHAR(200) NOT NULL,
  providerContact NVARCHAR(200) NULL,
  trainingProgramId INT NULL,
  employeeIds NVARCHAR(MAX) NULL,
  startDate DATE NULL,
  endDate DATE NULL,
  poNumber NVARCHAR(50) NULL,
  poAmount DECIMAL(18,2) NULL,
  invoiceNumber NVARCHAR(50) NULL,
  invoiceAmount DECIMAL(18,2) NULL,
  invoiceDate DATE NULL,
  paymentStatus NVARCHAR(20) NOT NULL CONSTRAINT ExternalTraining_paymentStatus_df DEFAULT 'UNPAID',
  paidAmount DECIMAL(18,2) NULL,
  paidDate DATE NULL,
  certificateIssued BIT NOT NULL CONSTRAINT ExternalTraining_certificateIssued_df DEFAULT 0,
  status NVARCHAR(20) NOT NULL CONSTRAINT ExternalTraining_status_df DEFAULT 'PLANNED',
  remarks NVARCHAR(500) NULL,
  isActive BIT NOT NULL CONSTRAINT ExternalTraining_isActive_df DEFAULT 1,
  deletedAt DATETIME2 NULL,
  createdAt DATETIME2 NOT NULL CONSTRAINT ExternalTraining_createdAt_df DEFAULT CURRENT_TIMESTAMP,
  updatedAt DATETIME2 NOT NULL,
  CONSTRAINT ExternalTraining_pkey PRIMARY KEY (id)
);
CREATE INDEX ExternalTraining_companyId_status_idx ON dbo.ExternalTraining (companyId, status);
CREATE INDEX ExternalTraining_companyId_providerName_idx ON dbo.ExternalTraining (companyId, providerName);

CREATE TABLE dbo.IndividualDevelopmentPlan (
  id INT NOT NULL,
  companyId INT NOT NULL,
  employeeId INT NOT NULL,
  title NVARCHAR(200) NOT NULL,
  goal NVARCHAR(500) NULL,
  competencyId INT NULL,
  skillId INT NULL,
  currentLevelId INT NULL,
  targetLevelId INT NULL,
  trainingProgramId INT NULL,
  mentorEmployeeId INT NULL,
  startDate DATE NULL,
  targetDate DATE NULL,
  progressNotes NVARCHAR(MAX) NULL,
  status NVARCHAR(20) NOT NULL CONSTRAINT IndividualDevelopmentPlan_status_df DEFAULT 'ACTIVE',
  approvedByUserId INT NULL,
  approvedAt DATETIME2 NULL,
  isActive BIT NOT NULL CONSTRAINT IndividualDevelopmentPlan_isActive_df DEFAULT 1,
  deletedAt DATETIME2 NULL,
  createdAt DATETIME2 NOT NULL CONSTRAINT IndividualDevelopmentPlan_createdAt_df DEFAULT CURRENT_TIMESTAMP,
  updatedAt DATETIME2 NOT NULL,
  CONSTRAINT IndividualDevelopmentPlan_pkey PRIMARY KEY (id)
);
CREATE INDEX IndividualDevelopmentPlan_companyId_employeeId_idx ON dbo.IndividualDevelopmentPlan (companyId, employeeId);
CREATE INDEX IndividualDevelopmentPlan_companyId_status_idx ON dbo.IndividualDevelopmentPlan (companyId, status);

COMMIT TRAN;
