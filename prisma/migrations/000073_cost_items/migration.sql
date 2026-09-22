-- Phase 22 (§34): Training cost components — line-item spend against a
-- schedule or external training. New table, additive.

CREATE TABLE dbo.TrainingCostItem (
  id INT NOT NULL,
  companyId INT NOT NULL,
  trainingScheduleId INT NULL,
  externalTrainingId INT NULL,
  head NVARCHAR(30) NOT NULL,
  amount DECIMAL(18,2) NOT NULL,
  description NVARCHAR(300) NULL,
  isActive BIT NOT NULL CONSTRAINT TrainingCostItem_isActive_df DEFAULT 1,
  deletedAt DATETIME2 NULL,
  createdAt DATETIME2 NOT NULL CONSTRAINT TrainingCostItem_createdAt_df DEFAULT CURRENT_TIMESTAMP,
  updatedAt DATETIME2 NOT NULL,
  CONSTRAINT TrainingCostItem_pkey PRIMARY KEY (id)
);
CREATE INDEX TrainingCostItem_companyId_trainingScheduleId_idx ON dbo.TrainingCostItem (companyId, trainingScheduleId);
CREATE INDEX TrainingCostItem_companyId_externalTrainingId_idx ON dbo.TrainingCostItem (companyId, externalTrainingId);

CREATE SEQUENCE dbo.seq_TrainingCostItem AS INT START WITH 1 INCREMENT BY 1;
ALTER TABLE dbo.TrainingCostItem ADD CONSTRAINT TrainingCostItem_id_df DEFAULT NEXT VALUE FOR dbo.seq_TrainingCostItem FOR id;
