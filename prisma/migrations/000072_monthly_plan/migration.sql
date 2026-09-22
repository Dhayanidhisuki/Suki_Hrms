-- Phase 20 (§15): Monthly Training Plan — annual plan broken into monthly
-- execution plans with their own status workflow. All new tables, additive.

CREATE TABLE dbo.MonthlyTrainingPlan (
  id INT NOT NULL,
  companyId INT NOT NULL,
  trainingPlanId INT NULL,
  year INT NOT NULL,
  month INT NOT NULL,
  departmentId INT NULL,
  status NVARCHAR(20) NOT NULL CONSTRAINT MonthlyTrainingPlan_status_df DEFAULT 'DRAFT',
  remarks NVARCHAR(500) NULL,
  approvedByUserId INT NULL,
  approvedAt DATETIME2 NULL,
  isActive BIT NOT NULL CONSTRAINT MonthlyTrainingPlan_isActive_df DEFAULT 1,
  deletedAt DATETIME2 NULL,
  createdAt DATETIME2 NOT NULL CONSTRAINT MonthlyTrainingPlan_createdAt_df DEFAULT CURRENT_TIMESTAMP,
  updatedAt DATETIME2 NOT NULL,
  CONSTRAINT MonthlyTrainingPlan_pkey PRIMARY KEY (id)
);
CREATE INDEX MonthlyTrainingPlan_companyId_year_month_idx ON dbo.MonthlyTrainingPlan (companyId, year, month);

CREATE TABLE dbo.MonthlyTrainingPlanLine (
  id INT NOT NULL,
  companyId INT NOT NULL,
  monthlyPlanId INT NOT NULL,
  trainingProgramId INT NOT NULL,
  departmentId INT NULL,
  employeeGroup NVARCHAR(100) NULL,
  participantCount INT NULL,
  trainerId INT NULL,
  mentorEmployeeId INT NULL,
  plannedDate DATE NULL,
  duration DECIMAL(8,2) NULL,
  durationUnit NVARCHAR(20) NULL CONSTRAINT MonthlyTrainingPlanLine_durationUnit_df DEFAULT 'HOURS',
  venueId INT NULL,
  method NVARCHAR(50) NULL,
  budget DECIMAL(18,2) NULL,
  estimatedCost DECIMAL(18,2) NULL,
  status NVARCHAR(20) NOT NULL CONSTRAINT MonthlyTrainingPlanLine_status_df DEFAULT 'PLANNED',
  isActive BIT NOT NULL CONSTRAINT MonthlyTrainingPlanLine_isActive_df DEFAULT 1,
  deletedAt DATETIME2 NULL,
  createdAt DATETIME2 NOT NULL CONSTRAINT MonthlyTrainingPlanLine_createdAt_df DEFAULT CURRENT_TIMESTAMP,
  updatedAt DATETIME2 NOT NULL,
  CONSTRAINT MonthlyTrainingPlanLine_pkey PRIMARY KEY (id),
  CONSTRAINT MonthlyTrainingPlanLine_monthlyPlanId_fkey FOREIGN KEY (monthlyPlanId) REFERENCES dbo.MonthlyTrainingPlan (id) ON DELETE CASCADE,
  CONSTRAINT MonthlyTrainingPlanLine_trainingProgramId_fkey FOREIGN KEY (trainingProgramId) REFERENCES dbo.TrainingProgram (id)
);
CREATE INDEX MonthlyTrainingPlanLine_companyId_monthlyPlanId_idx ON dbo.MonthlyTrainingPlanLine (companyId, monthlyPlanId);

-- Sequence-backed id defaults (same pattern as other Learning tables).
CREATE SEQUENCE dbo.seq_MonthlyTrainingPlan AS INT START WITH 1 INCREMENT BY 1;
ALTER TABLE dbo.MonthlyTrainingPlan ADD CONSTRAINT MonthlyTrainingPlan_id_df DEFAULT NEXT VALUE FOR dbo.seq_MonthlyTrainingPlan FOR id;
CREATE SEQUENCE dbo.seq_MonthlyTrainingPlanLine AS INT START WITH 1 INCREMENT BY 1;
ALTER TABLE dbo.MonthlyTrainingPlanLine ADD CONSTRAINT MonthlyTrainingPlanLine_id_df DEFAULT NEXT VALUE FOR dbo.seq_MonthlyTrainingPlanLine FOR id;
