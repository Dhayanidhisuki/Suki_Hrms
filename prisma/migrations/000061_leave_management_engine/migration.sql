-- Leave Management engine (Step 1, tranche 4): transaction ledger, accrual
-- runs, leave-year configuration, in-service encashment requests, and the
-- BRD section 6 policy columns on LeaveMaster.
-- Spec: docs/BRD/04 - Leave Management - BRD.docx; schema section 21.
--
-- Additive only: 4 new tables; nullable/defaulted columns on LeaveMaster,
-- LeaveBalance and LeaveApplication; indexes. Nothing altered or dropped.


-- AlterTable
ALTER TABLE [dbo].[LeaveMaster] ADD [accrualBasis] NVARCHAR(20),
[annualCeilingDays] DECIMAL(6,2),
[applicableEmployeeTypes] NVARCHAR(300),
[applicableGender] NVARCHAR(10),
[backDatedAllowed] BIT NOT NULL CONSTRAINT [LeaveMaster_backDatedAllowed_df] DEFAULT 1,
[backDatedLimitDays] INT,
[carryForwardValidityMonths] INT,
[countIntermediateNonWorking] BIT NOT NULL CONSTRAINT [LeaveMaster_countIntermediateNonWorking_df] DEFAULT 1,
[countSandwichedNonWorking] BIT NOT NULL CONSTRAINT [LeaveMaster_countSandwichedNonWorking_df] DEFAULT 1,
[creditValidityDays] INT,
[cutOffDay] INT CONSTRAINT [LeaveMaster_cutOffDay_df] DEFAULT 15,
[displayOrder] INT,
[documentRequiredBeyondDays] DECIMAL(6,2),
[eventEntitlementDays] DECIMAL(6,2),
[halfDayAllowed] BIT NOT NULL CONSTRAINT [LeaveMaster_halfDayAllowed_df] DEFAULT 1,
[isEncashable] BIT NOT NULL CONSTRAINT [LeaveMaster_isEncashable_df] DEFAULT 0,
[isPaid] BIT NOT NULL CONSTRAINT [LeaveMaster_isPaid_df] DEFAULT 1,
[maxDaysPerApplication] DECIMAL(6,2),
[maxEncashableDaysAtExit] DECIMAL(6,2),
[maxEncashableDaysPerYear] DECIMAL(6,2),
[midPeriodJoinRule] NVARCHAR(24),
[minDaysPerApplication] DECIMAL(6,2),
[negativeBalanceAllowed] BIT NOT NULL CONSTRAINT [LeaveMaster_negativeBalanceAllowed_df] DEFAULT 0,
[noticeDays] INT,
[probationAccrualMode] NVARCHAR(20),
[roundingRule] NVARCHAR(20);

-- AlterTable
ALTER TABLE [dbo].[LeaveApplication] ADD [addressDuringLeave] NVARCHAR(300),
[calendarDays] DECIMAL(6,2),
[cancelledAt] DATETIME2,
[cancelledByUserId] INT,
[companyId] INT,
[contactDuringLeave] NVARCHAR(50),
[documentId] INT,
[nonWorkingDaysCounted] DECIMAL(6,2),
[outcomeOnExit] NVARCHAR(20),
[workflowRequestId] INT;

-- AlterTable
ALTER TABLE [dbo].[LeaveBalance] ADD [encashed] DECIMAL(5,2) NOT NULL CONSTRAINT [LeaveBalance_encashed_df] DEFAULT 0,
[expired] DECIMAL(5,2) NOT NULL CONSTRAINT [LeaveBalance_expired_df] DEFAULT 0,
[held] DECIMAL(5,2) NOT NULL CONSTRAINT [LeaveBalance_held_df] DEFAULT 0,
[lapsed] DECIMAL(5,2) NOT NULL CONSTRAINT [LeaveBalance_lapsed_df] DEFAULT 0,
[leaveYear] NVARCHAR(9),
[pendingApproval] DECIMAL(5,2) NOT NULL CONSTRAINT [LeaveBalance_pendingApproval_df] DEFAULT 0;

-- CreateTable
CREATE TABLE [dbo].[LeaveYearConfig] (
    [id] INT NOT NULL IDENTITY(1,1),
    [companyId] INT NOT NULL,
    [basis] NVARCHAR(12) NOT NULL CONSTRAINT [LeaveYearConfig_basis_df] DEFAULT 'FINANCIAL',
    [iseWindowStartMonth] INT NOT NULL CONSTRAINT [LeaveYearConfig_iseWindowStartMonth_df] DEFAULT 1,
    [iseWindowStartDay] INT NOT NULL CONSTRAINT [LeaveYearConfig_iseWindowStartDay_df] DEFAULT 1,
    [iseWindowEndMonth] INT NOT NULL CONSTRAINT [LeaveYearConfig_iseWindowEndMonth_df] DEFAULT 1,
    [iseWindowEndDay] INT NOT NULL CONSTRAINT [LeaveYearConfig_iseWindowEndDay_df] DEFAULT 31,
    [lapseWarningDays] NVARCHAR(40) NOT NULL CONSTRAINT [LeaveYearConfig_lapseWarningDays_df] DEFAULT '60,15',
    [accrualRunHour] INT NOT NULL CONSTRAINT [LeaveYearConfig_accrualRunHour_df] DEFAULT 1,
    [accrualRunMinute] INT NOT NULL CONSTRAINT [LeaveYearConfig_accrualRunMinute_df] DEFAULT 30,
    [createdAt] DATETIME2 NOT NULL CONSTRAINT [LeaveYearConfig_createdAt_df] DEFAULT CURRENT_TIMESTAMP,
    [updatedAt] DATETIME2 NOT NULL,
    CONSTRAINT [LeaveYearConfig_pkey] PRIMARY KEY CLUSTERED ([id]),
    CONSTRAINT [LeaveYearConfig_companyId_key] UNIQUE NONCLUSTERED ([companyId])
);

-- CreateTable
CREATE TABLE [dbo].[LeaveTransaction] (
    [id] INT NOT NULL IDENTITY(1,1),
    [companyId] INT NOT NULL,
    [employeeId] INT NOT NULL,
    [leaveMasterId] INT NOT NULL,
    [leaveYear] NVARCHAR(9) NOT NULL,
    [txnType] NVARCHAR(24) NOT NULL,
    [txnDate] DATE NOT NULL,
    [postedAt] DATETIME2 NOT NULL CONSTRAINT [LeaveTransaction_postedAt_df] DEFAULT CURRENT_TIMESTAMP,
    [days] DECIMAL(6,2) NOT NULL,
    [rawValue] DECIMAL(10,4),
    [isHeld] BIT NOT NULL CONSTRAINT [LeaveTransaction_isHeld_df] DEFAULT 0,
    [validUntil] DATE,
    [sourceRefType] NVARCHAR(30),
    [sourceRefId] INT,
    [reasonCode] NVARCHAR(30),
    [remark] NVARCHAR(500),
    [runId] INT,
    [createdByUserId] INT,
    CONSTRAINT [LeaveTransaction_pkey] PRIMARY KEY CLUSTERED ([id])
);

-- CreateTable
CREATE TABLE [dbo].[LeaveAccrualRun] (
    [id] INT NOT NULL IDENTITY(1,1),
    [companyId] INT NOT NULL,
    [leaveYear] NVARCHAR(9) NOT NULL,
    [period] NVARCHAR(7) NOT NULL,
    [runType] NVARCHAR(24) NOT NULL,
    [status] NVARCHAR(12) NOT NULL CONSTRAINT [LeaveAccrualRun_status_df] DEFAULT 'RUNNING',
    [employeesProcessed] INT NOT NULL CONSTRAINT [LeaveAccrualRun_employeesProcessed_df] DEFAULT 0,
    [txnsPosted] INT NOT NULL CONSTRAINT [LeaveAccrualRun_txnsPosted_df] DEFAULT 0,
    [exceptionsJson] NVARCHAR(max),
    [startedAt] DATETIME2 NOT NULL CONSTRAINT [LeaveAccrualRun_startedAt_df] DEFAULT CURRENT_TIMESTAMP,
    [finishedAt] DATETIME2,
    [triggeredByUserId] INT,
    [reason] NVARCHAR(500),
    CONSTRAINT [LeaveAccrualRun_pkey] PRIMARY KEY CLUSTERED ([id])
);

-- CreateTable
CREATE TABLE [dbo].[LeaveEncashmentRequest] (
    [id] INT NOT NULL IDENTITY(1,1),
    [companyId] INT NOT NULL,
    [employeeId] INT NOT NULL,
    [leaveMasterId] INT NOT NULL,
    [leaveYear] NVARCHAR(9) NOT NULL,
    [daysRequested] DECIMAL(6,2) NOT NULL,
    [daysApproved] DECIMAL(6,2),
    [estimatedAmount] DECIMAL(18,2),
    [finalAmount] DECIMAL(18,2),
    [status] NVARCHAR(20) NOT NULL CONSTRAINT [LeaveEncashmentRequest_status_df] DEFAULT 'SUBMITTED',
    [workflowRequestId] INT,
    [payrollRunId] INT,
    [requestedAt] DATETIME2 NOT NULL CONSTRAINT [LeaveEncashmentRequest_requestedAt_df] DEFAULT CURRENT_TIMESTAMP,
    [decidedAt] DATETIME2,
    [decidedByUserId] INT,
    [paidAt] DATETIME2,
    [remark] NVARCHAR(500),
    [createdAt] DATETIME2 NOT NULL CONSTRAINT [LeaveEncashmentRequest_createdAt_df] DEFAULT CURRENT_TIMESTAMP,
    [updatedAt] DATETIME2 NOT NULL,
    CONSTRAINT [LeaveEncashmentRequest_pkey] PRIMARY KEY CLUSTERED ([id])
);

-- CreateIndex
CREATE NONCLUSTERED INDEX [LeaveTransaction_companyId_employeeId_leaveMasterId_leaveYear_idx] ON [dbo].[LeaveTransaction]([companyId], [employeeId], [leaveMasterId], [leaveYear]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [LeaveTransaction_employeeId_txnDate_idx] ON [dbo].[LeaveTransaction]([employeeId], [txnDate]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [LeaveTransaction_runId_idx] ON [dbo].[LeaveTransaction]([runId]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [LeaveTransaction_sourceRefType_sourceRefId_idx] ON [dbo].[LeaveTransaction]([sourceRefType], [sourceRefId]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [LeaveAccrualRun_companyId_leaveYear_period_runType_idx] ON [dbo].[LeaveAccrualRun]([companyId], [leaveYear], [period], [runType]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [LeaveEncashmentRequest_companyId_employeeId_status_idx] ON [dbo].[LeaveEncashmentRequest]([companyId], [employeeId], [status]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [LeaveEncashmentRequest_companyId_leaveYear_status_idx] ON [dbo].[LeaveEncashmentRequest]([companyId], [leaveYear], [status]);

