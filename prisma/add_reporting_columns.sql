-- Add secondReportingManagerId to Employee table
IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('dbo.Employee') AND name = 'secondReportingManagerId')
  ALTER TABLE dbo.Employee ADD secondReportingManagerId INT NULL;

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'Employee_secondReportingManagerId_idx' AND object_id = OBJECT_ID('dbo.Employee'))
  CREATE INDEX Employee_secondReportingManagerId_idx ON dbo.Employee(secondReportingManagerId);

-- LeaveApplication: manager stage fields
IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('dbo.LeaveApplication') AND name = 'managerActionByUserId')
  ALTER TABLE dbo.LeaveApplication ADD managerActionByUserId INT NULL;

IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('dbo.LeaveApplication') AND name = 'managerActionAt')
  ALTER TABLE dbo.LeaveApplication ADD managerActionAt DATETIME2 NULL;

IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('dbo.LeaveApplication') AND name = 'managerRejectionReason')
  ALTER TABLE dbo.LeaveApplication ADD managerRejectionReason NVARCHAR(500) NULL;

-- PermissionRequest: manager stage fields
IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('dbo.PermissionRequest') AND name = 'managerActionByUserId')
  ALTER TABLE dbo.PermissionRequest ADD managerActionByUserId INT NULL;

IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('dbo.PermissionRequest') AND name = 'managerActionAt')
  ALTER TABLE dbo.PermissionRequest ADD managerActionAt DATETIME2 NULL;

IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('dbo.PermissionRequest') AND name = 'managerRejectionReason')
  ALTER TABLE dbo.PermissionRequest ADD managerRejectionReason NVARCHAR(500) NULL;

-- SalaryRevisionRequest: manager stage fields
IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('dbo.SalaryRevisionRequest') AND name = 'managerActionByUserId')
  ALTER TABLE dbo.SalaryRevisionRequest ADD managerActionByUserId INT NULL;

IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('dbo.SalaryRevisionRequest') AND name = 'managerActionAt')
  ALTER TABLE dbo.SalaryRevisionRequest ADD managerActionAt DATETIME2 NULL;

IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('dbo.SalaryRevisionRequest') AND name = 'managerRejectReason')
  ALTER TABLE dbo.SalaryRevisionRequest ADD managerRejectReason NVARCHAR(500) NULL;

-- JobInfo: manager recommendation fields for confirmation
IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('dbo.JobInfo') AND name = 'managerRecommendation')
  ALTER TABLE dbo.JobInfo ADD managerRecommendation NVARCHAR(20) NULL;

IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('dbo.JobInfo') AND name = 'managerRecommendationByUserId')
  ALTER TABLE dbo.JobInfo ADD managerRecommendationByUserId INT NULL;

IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('dbo.JobInfo') AND name = 'managerRecommendationAt')
  ALTER TABLE dbo.JobInfo ADD managerRecommendationAt DATETIME2 NULL;

IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('dbo.JobInfo') AND name = 'managerRemarks')
  ALTER TABLE dbo.JobInfo ADD managerRemarks NVARCHAR(500) NULL;
