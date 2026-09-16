-- Shared Platform Services (Step 1, tranche 2): Workflow & Approval engine,
-- Notification service, Document service, Configuration Snapshot, Audit Trail.
-- Spec: docs/BRD/06 - Shared Platform Services - BRD.docx; schema section 19.
--
-- Purely additive: 16 new tables and their indexes. No existing table is
-- altered. Tables are prefixed (Workflow*, Notification*, PlatformDocument*)
-- to avoid the recruitment tables that exist in the database outside the
-- Prisma schema (DocumentType, EmailTemplate, SlaConfig).

-- CreateTable
CREATE TABLE [dbo].[WorkflowRequestType] (
    [id] INT NOT NULL IDENTITY(1,1),
    [companyId] INT NOT NULL,
    [code] NVARCHAR(30) NOT NULL,
    [name] NVARCHAR(120) NOT NULL,
    [moduleCode] NVARCHAR(4) NOT NULL,
    [handlerKey] NVARCHAR(60),
    [conditionFieldsUsed] NVARCHAR(200),
    [allowReturn] BIT NOT NULL CONSTRAINT [WorkflowRequestType_allowReturn_df] DEFAULT 1,
    [allowCancelAfterSubmit] BIT NOT NULL CONSTRAINT [WorkflowRequestType_allowCancelAfterSubmit_df] DEFAULT 1,
    [allowBulkApproval] BIT NOT NULL CONSTRAINT [WorkflowRequestType_allowBulkApproval_df] DEFAULT 0,
    [allowDelegation] BIT NOT NULL CONSTRAINT [WorkflowRequestType_allowDelegation_df] DEFAULT 1,
    [autoApproveOnExhaustion] BIT NOT NULL CONSTRAINT [WorkflowRequestType_autoApproveOnExhaustion_df] DEFAULT 0,
    [remarkMandatoryOnApprove] BIT NOT NULL CONSTRAINT [WorkflowRequestType_remarkMandatoryOnApprove_df] DEFAULT 0,
    [snapshotTypeCode] NVARCHAR(30),
    [retentionYears] INT NOT NULL CONSTRAINT [WorkflowRequestType_retentionYears_df] DEFAULT 8,
    [isActive] BIT NOT NULL CONSTRAINT [WorkflowRequestType_isActive_df] DEFAULT 1,
    [createdAt] DATETIME2 NOT NULL CONSTRAINT [WorkflowRequestType_createdAt_df] DEFAULT CURRENT_TIMESTAMP,
    [updatedAt] DATETIME2 NOT NULL,
    CONSTRAINT [WorkflowRequestType_pkey] PRIMARY KEY CLUSTERED ([id]),
    CONSTRAINT [WorkflowRequestType_companyId_code_key] UNIQUE NONCLUSTERED ([companyId],[code])
);

-- CreateTable
CREATE TABLE [dbo].[WorkflowMatrix] (
    [id] INT NOT NULL IDENTITY(1,1),
    [companyId] INT NOT NULL,
    [code] NVARCHAR(30) NOT NULL,
    [name] NVARCHAR(120) NOT NULL,
    [requestTypeCode] NVARCHAR(30) NOT NULL,
    [versionNo] INT NOT NULL CONSTRAINT [WorkflowMatrix_versionNo_df] DEFAULT 1,
    [effectiveFrom] DATE NOT NULL,
    [effectiveTo] DATE,
    [isFallback] BIT NOT NULL CONSTRAINT [WorkflowMatrix_isFallback_df] DEFAULT 0,
    [status] NVARCHAR(10) NOT NULL CONSTRAINT [WorkflowMatrix_status_df] DEFAULT 'Active',
    [minAmount] DECIMAL(18,2),
    [maxAmount] DECIMAL(18,2),
    [designationCodes] NVARCHAR(400),
    [departmentCodes] NVARCHAR(400),
    [gradeCodes] NVARCHAR(400),
    [employmentType] NVARCHAR(20),
    [locationCode] NVARCHAR(30),
    [costCentreCode] NVARCHAR(30),
    [requestSubType] NVARCHAR(30),
    [createdByUserId] INT,
    [createdAt] DATETIME2 NOT NULL CONSTRAINT [WorkflowMatrix_createdAt_df] DEFAULT CURRENT_TIMESTAMP,
    [updatedAt] DATETIME2 NOT NULL,
    CONSTRAINT [WorkflowMatrix_pkey] PRIMARY KEY CLUSTERED ([id]),
    CONSTRAINT [WorkflowMatrix_companyId_code_versionNo_key] UNIQUE NONCLUSTERED ([companyId],[code],[versionNo])
);

-- CreateTable
CREATE TABLE [dbo].[WorkflowMatrixLine] (
    [id] INT NOT NULL IDENTITY(1,1),
    [matrixId] INT NOT NULL,
    [levelNo] INT NOT NULL,
    [sequence] INT NOT NULL CONSTRAINT [WorkflowMatrixLine_sequence_df] DEFAULT 1,
    [parallelGroup] INT,
    [approverType] NVARCHAR(10) NOT NULL,
    [approverRef] NVARCHAR(60) NOT NULL,
    [mandatory] BIT NOT NULL CONSTRAINT [WorkflowMatrixLine_mandatory_df] DEFAULT 1,
    [quorumRule] NVARCHAR(12) NOT NULL CONSTRAINT [WorkflowMatrixLine_quorumRule_df] DEFAULT 'ALL',
    [quorumN] INT,
    [escalationDays] DECIMAL(4,1) NOT NULL CONSTRAINT [WorkflowMatrixLine_escalationDays_df] DEFAULT 2.0,
    [escalationTargetType] NVARCHAR(12) NOT NULL CONSTRAINT [WorkflowMatrixLine_escalationTargetType_df] DEFAULT 'POSITION',
    [escalationTargetRef] NVARCHAR(60),
    [escalationMode] NVARCHAR(8) NOT NULL CONSTRAINT [WorkflowMatrixLine_escalationMode_df] DEFAULT 'ADD',
    [maxEscalationHops] INT NOT NULL CONSTRAINT [WorkflowMatrixLine_maxEscalationHops_df] DEFAULT 2,
    [skipIfSameAsRequester] BIT NOT NULL CONSTRAINT [WorkflowMatrixLine_skipIfSameAsRequester_df] DEFAULT 1,
    [remarkMandatory] BIT NOT NULL CONSTRAINT [WorkflowMatrixLine_remarkMandatory_df] DEFAULT 0,
    CONSTRAINT [WorkflowMatrixLine_pkey] PRIMARY KEY CLUSTERED ([id])
);

-- CreateTable
CREATE TABLE [dbo].[WorkflowRequest] (
    [id] INT NOT NULL IDENTITY(1,1),
    [companyId] INT NOT NULL,
    [requestNo] NVARCHAR(30) NOT NULL,
    [requestTypeCode] NVARCHAR(30) NOT NULL,
    [moduleCode] NVARCHAR(4) NOT NULL,
    [sourceEntityType] NVARCHAR(40) NOT NULL,
    [sourceEntityId] INT NOT NULL,
    [title] NVARCHAR(200) NOT NULL,
    [requesterEmpId] INT NOT NULL,
    [requesterUserId] INT,
    [subjectEmpId] INT,
    [onBehalfOfEmpId] INT,
    [amount] DECIMAL(18,2),
    [requestSubType] NVARCHAR(30),
    [priority] NVARCHAR(10) NOT NULL CONSTRAINT [WorkflowRequest_priority_df] DEFAULT 'NORMAL',
    [payloadJson] NVARCHAR(max),
    [contextJson] NVARCHAR(max),
    [currentStatus] NVARCHAR(24) NOT NULL CONSTRAINT [WorkflowRequest_currentStatus_df] DEFAULT 'Draft',
    [currentLevel] INT NOT NULL CONSTRAINT [WorkflowRequest_currentLevel_df] DEFAULT 0,
    [matrixId] INT,
    [matrixVersionNo] INT,
    [snapshotId] INT,
    [levelEnteredAt] DATETIME2,
    [dueAt] DATETIME2,
    [slaBreachCount] INT NOT NULL CONSTRAINT [WorkflowRequest_slaBreachCount_df] DEFAULT 0,
    [escalationExhausted] BIT NOT NULL CONSTRAINT [WorkflowRequest_escalationExhausted_df] DEFAULT 0,
    [submittedAt] DATETIME2,
    [decidedAt] DATETIME2,
    [decisionRemark] NVARCHAR(1000),
    [validationErrorsJson] NVARCHAR(max),
    [reopenedFromRequestId] INT,
    [createdByUserId] INT,
    [createdAt] DATETIME2 NOT NULL CONSTRAINT [WorkflowRequest_createdAt_df] DEFAULT CURRENT_TIMESTAMP,
    [updatedAt] DATETIME2 NOT NULL,
    CONSTRAINT [WorkflowRequest_pkey] PRIMARY KEY CLUSTERED ([id]),
    CONSTRAINT [WorkflowRequest_companyId_requestNo_key] UNIQUE NONCLUSTERED ([companyId],[requestNo])
);

-- CreateTable
CREATE TABLE [dbo].[WorkflowSlot] (
    [id] INT NOT NULL IDENTITY(1,1),
    [requestId] INT NOT NULL,
    [levelNo] INT NOT NULL,
    [sequence] INT NOT NULL CONSTRAINT [WorkflowSlot_sequence_df] DEFAULT 1,
    [parallelGroup] INT,
    [approverType] NVARCHAR(10) NOT NULL,
    [approverRef] NVARCHAR(60) NOT NULL,
    [resolvedEmpId] INT,
    [resolvedUserId] INT,
    [isMandatory] BIT NOT NULL CONSTRAINT [WorkflowSlot_isMandatory_df] DEFAULT 1,
    [quorumRule] NVARCHAR(12) NOT NULL CONSTRAINT [WorkflowSlot_quorumRule_df] DEFAULT 'ALL',
    [quorumN] INT,
    [status] NVARCHAR(12) NOT NULL CONSTRAINT [WorkflowSlot_status_df] DEFAULT 'Pending',
    [escalationHop] INT NOT NULL CONSTRAINT [WorkflowSlot_escalationHop_df] DEFAULT 0,
    [actedByEmpId] INT,
    [actedByUserId] INT,
    [onBehalfOfEmpId] INT,
    [delegationId] INT,
    [actedAt] DATETIME2,
    [remark] NVARCHAR(500),
    [createdAt] DATETIME2 NOT NULL CONSTRAINT [WorkflowSlot_createdAt_df] DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT [WorkflowSlot_pkey] PRIMARY KEY CLUSTERED ([id])
);

-- CreateTable
CREATE TABLE [dbo].[WorkflowAction] (
    [id] INT NOT NULL IDENTITY(1,1),
    [companyId] INT NOT NULL,
    [requestId] INT NOT NULL,
    [verb] NVARCHAR(20) NOT NULL,
    [fromStatus] NVARCHAR(24),
    [toStatus] NVARCHAR(24) NOT NULL,
    [levelNo] INT,
    [actorUserId] INT,
    [actorEmpId] INT,
    [onBehalfOfEmpId] INT,
    [delegationId] INT,
    [remark] NVARCHAR(1000),
    [detailJson] NVARCHAR(max),
    [createdAt] DATETIME2 NOT NULL CONSTRAINT [WorkflowAction_createdAt_df] DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT [WorkflowAction_pkey] PRIMARY KEY CLUSTERED ([id])
);

-- CreateTable
CREATE TABLE [dbo].[WorkflowDelegation] (
    [id] INT NOT NULL IDENTITY(1,1),
    [companyId] INT NOT NULL,
    [delegatorEmpId] INT NOT NULL,
    [delegateEmpId] INT NOT NULL,
    [scopeType] NVARCHAR(12) NOT NULL CONSTRAINT [WorkflowDelegation_scopeType_df] DEFAULT 'ALL',
    [scopeRefList] NVARCHAR(400),
    [fromDate] DATE NOT NULL,
    [toDate] DATE NOT NULL,
    [amountCeiling] DECIMAL(18,2),
    [reasonCode] NVARCHAR(20) NOT NULL,
    [reasonText] NVARCHAR(500),
    [includeInFlight] BIT NOT NULL CONSTRAINT [WorkflowDelegation_includeInFlight_df] DEFAULT 1,
    [notifyDelegator] BIT NOT NULL CONSTRAINT [WorkflowDelegation_notifyDelegator_df] DEFAULT 1,
    [status] NVARCHAR(10) NOT NULL CONSTRAINT [WorkflowDelegation_status_df] DEFAULT 'Active',
    [approvalRequestId] INT,
    [revokedAt] DATETIME2,
    [revokedByUserId] INT,
    [createdByUserId] INT,
    [createdAt] DATETIME2 NOT NULL CONSTRAINT [WorkflowDelegation_createdAt_df] DEFAULT CURRENT_TIMESTAMP,
    [updatedAt] DATETIME2 NOT NULL,
    CONSTRAINT [WorkflowDelegation_pkey] PRIMARY KEY CLUSTERED ([id])
);

-- CreateTable
CREATE TABLE [dbo].[WorkflowEscalation] (
    [id] INT NOT NULL IDENTITY(1,1),
    [companyId] INT NOT NULL,
    [requestId] INT NOT NULL,
    [levelNo] INT NOT NULL,
    [hopNo] INT NOT NULL,
    [fromApproverEmpId] INT,
    [toApproverEmpId] INT,
    [mode] NVARCHAR(8) NOT NULL,
    [dueAtBefore] DATETIME2,
    [dueAtAfter] DATETIME2,
    [elapsedBusinessDays] DECIMAL(6,2),
    [triggerType] NVARCHAR(10) NOT NULL,
    [triggeredByUserId] INT,
    [reasonText] NVARCHAR(500),
    [createdAt] DATETIME2 NOT NULL CONSTRAINT [WorkflowEscalation_createdAt_df] DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT [WorkflowEscalation_pkey] PRIMARY KEY CLUSTERED ([id])
);

-- CreateTable
CREATE TABLE [dbo].[NotificationEvent] (
    [id] INT NOT NULL IDENTITY(1,1),
    [companyId] INT NOT NULL,
    [code] NVARCHAR(40) NOT NULL,
    [name] NVARCHAR(120) NOT NULL,
    [moduleCode] NVARCHAR(4) NOT NULL,
    [category] NVARCHAR(20) NOT NULL CONSTRAINT [NotificationEvent_category_df] DEFAULT 'TRANSACTIONAL',
    [defaultPriority] NVARCHAR(10) NOT NULL CONSTRAINT [NotificationEvent_defaultPriority_df] DEFAULT 'NORMAL',
    [defaultRecipients] NVARCHAR(400),
    [contextSchemaJson] NVARCHAR(max),
    [inAppEnabled] BIT NOT NULL CONSTRAINT [NotificationEvent_inAppEnabled_df] DEFAULT 1,
    [emailEnabled] BIT NOT NULL CONSTRAINT [NotificationEvent_emailEnabled_df] DEFAULT 1,
    [smsEnabled] BIT NOT NULL CONSTRAINT [NotificationEvent_smsEnabled_df] DEFAULT 0,
    [pushEnabled] BIT NOT NULL CONSTRAINT [NotificationEvent_pushEnabled_df] DEFAULT 0,
    [quietHoursExempt] BIT NOT NULL CONSTRAINT [NotificationEvent_quietHoursExempt_df] DEFAULT 0,
    [digestEligible] BIT NOT NULL CONSTRAINT [NotificationEvent_digestEligible_df] DEFAULT 0,
    [retentionDays] INT NOT NULL CONSTRAINT [NotificationEvent_retentionDays_df] DEFAULT 365,
    [isActive] BIT NOT NULL CONSTRAINT [NotificationEvent_isActive_df] DEFAULT 1,
    [createdAt] DATETIME2 NOT NULL CONSTRAINT [NotificationEvent_createdAt_df] DEFAULT CURRENT_TIMESTAMP,
    [updatedAt] DATETIME2 NOT NULL,
    CONSTRAINT [NotificationEvent_pkey] PRIMARY KEY CLUSTERED ([id]),
    CONSTRAINT [NotificationEvent_companyId_code_key] UNIQUE NONCLUSTERED ([companyId],[code])
);

-- CreateTable
CREATE TABLE [dbo].[NotificationTemplate] (
    [id] INT NOT NULL IDENTITY(1,1),
    [companyId] INT NOT NULL,
    [code] NVARCHAR(40) NOT NULL,
    [name] NVARCHAR(120) NOT NULL,
    [eventCode] NVARCHAR(40) NOT NULL,
    [channel] NVARCHAR(10) NOT NULL,
    [language] NVARCHAR(5) NOT NULL CONSTRAINT [NotificationTemplate_language_df] DEFAULT 'en-IN',
    [versionNo] INT NOT NULL CONSTRAINT [NotificationTemplate_versionNo_df] DEFAULT 1,
    [effectiveFrom] DATE NOT NULL,
    [effectiveTo] DATE,
    [subject] NVARCHAR(300),
    [bodyHtml] NVARCHAR(max),
    [bodyText] NVARCHAR(max) NOT NULL,
    [smsText] NVARCHAR(320),
    [designationFilter] NVARCHAR(200),
    [departmentFilter] NVARCHAR(200),
    [status] NVARCHAR(10) NOT NULL CONSTRAINT [NotificationTemplate_status_df] DEFAULT 'Active',
    [createdByUserId] INT,
    [createdAt] DATETIME2 NOT NULL CONSTRAINT [NotificationTemplate_createdAt_df] DEFAULT CURRENT_TIMESTAMP,
    [updatedAt] DATETIME2 NOT NULL,
    CONSTRAINT [NotificationTemplate_pkey] PRIMARY KEY CLUSTERED ([id]),
    CONSTRAINT [NotificationTemplate_companyId_code_versionNo_key] UNIQUE NONCLUSTERED ([companyId],[code],[versionNo])
);

-- CreateTable
CREATE TABLE [dbo].[NotificationDelivery] (
    [id] INT NOT NULL IDENTITY(1,1),
    [companyId] INT NOT NULL,
    [correlationId] NVARCHAR(60),
    [eventCode] NVARCHAR(40) NOT NULL,
    [eventInstanceId] NVARCHAR(60),
    [moduleCode] NVARCHAR(4),
    [sourceEntityType] NVARCHAR(40),
    [sourceEntityId] INT,
    [templateId] INT,
    [templateVersionNo] INT,
    [language] NVARCHAR(5),
    [channel] NVARCHAR(10) NOT NULL,
    [recipientType] NVARCHAR(12) NOT NULL,
    [recipientId] INT,
    [recipientAddress] NVARCHAR(320),
    [recipientAddressMasked] NVARCHAR(200),
    [recipientExpression] NVARCHAR(60),
    [renderedSubject] NVARCHAR(300),
    [renderedBody] NVARCHAR(max),
    [priority] NVARCHAR(10) NOT NULL CONSTRAINT [NotificationDelivery_priority_df] DEFAULT 'NORMAL',
    [status] NVARCHAR(32) NOT NULL CONSTRAINT [NotificationDelivery_status_df] DEFAULT 'Queued',
    [attemptCount] INT NOT NULL CONSTRAINT [NotificationDelivery_attemptCount_df] DEFAULT 0,
    [lastAttemptAt] DATETIME2,
    [nextAttemptAt] DATETIME2,
    [gatewayMessageId] NVARCHAR(120),
    [gatewayResponseCode] NVARCHAR(40),
    [gatewayResponseText] NVARCHAR(500),
    [failureReason] NVARCHAR(500),
    [queuedAt] DATETIME2 NOT NULL CONSTRAINT [NotificationDelivery_queuedAt_df] DEFAULT CURRENT_TIMESTAMP,
    [sentAt] DATETIME2,
    [deliveredAt] DATETIME2,
    [readAt] DATETIME2,
    [expiresAt] DATETIME2,
    [createdAt] DATETIME2 NOT NULL CONSTRAINT [NotificationDelivery_createdAt_df] DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT [NotificationDelivery_pkey] PRIMARY KEY CLUSTERED ([id])
);

-- CreateTable
CREATE TABLE [dbo].[NotificationInApp] (
    [id] INT NOT NULL IDENTITY(1,1),
    [companyId] INT NOT NULL,
    [deliveryId] INT,
    [recipientUserId] INT,
    [recipientEmpId] INT,
    [eventCode] NVARCHAR(40) NOT NULL,
    [title] NVARCHAR(300) NOT NULL,
    [body] NVARCHAR(max),
    [linkPath] NVARCHAR(500),
    [priority] NVARCHAR(10) NOT NULL CONSTRAINT [NotificationInApp_priority_df] DEFAULT 'NORMAL',
    [isRead] BIT NOT NULL CONSTRAINT [NotificationInApp_isRead_df] DEFAULT 0,
    [readAt] DATETIME2,
    [createdAt] DATETIME2 NOT NULL CONSTRAINT [NotificationInApp_createdAt_df] DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT [NotificationInApp_pkey] PRIMARY KEY CLUSTERED ([id])
);

-- CreateTable
CREATE TABLE [dbo].[PlatformDocumentType] (
    [id] INT NOT NULL IDENTITY(1,1),
    [companyId] INT NOT NULL,
    [code] NVARCHAR(30) NOT NULL,
    [name] NVARCHAR(120) NOT NULL,
    [category] NVARCHAR(30) NOT NULL,
    [appliesToEntity] NVARCHAR(20) NOT NULL,
    [documentClass] NVARCHAR(12) NOT NULL CONSTRAINT [PlatformDocumentType_documentClass_df] DEFAULT 'INTERNAL',
    [mandatoryFlag] BIT NOT NULL CONSTRAINT [PlatformDocumentType_mandatoryFlag_df] DEFAULT 0,
    [mandatoryFromStage] NVARCHAR(30),
    [applicableDepartment] NVARCHAR(200),
    [applicableDesignation] NVARCHAR(200),
    [applicableGrade] NVARCHAR(200),
    [applicableEmploymentType] NVARCHAR(200),
    [applicableLocation] NVARCHAR(200),
    [verificationRequired] BIT NOT NULL CONSTRAINT [PlatformDocumentType_verificationRequired_df] DEFAULT 1,
    [verifierRole] NVARCHAR(30),
    [expiryRequired] BIT NOT NULL CONSTRAINT [PlatformDocumentType_expiryRequired_df] DEFAULT 0,
    [expiryAlertOffsets] NVARCHAR(60),
    [allowedFileTypes] NVARCHAR(100) NOT NULL CONSTRAINT [PlatformDocumentType_allowedFileTypes_df] DEFAULT 'pdf,jpg,png',
    [maxFileSizeMb] INT NOT NULL CONSTRAINT [PlatformDocumentType_maxFileSizeMb_df] DEFAULT 5,
    [maxFileCount] INT NOT NULL CONSTRAINT [PlatformDocumentType_maxFileCount_df] DEFAULT 1,
    [retentionYears] INT NOT NULL CONSTRAINT [PlatformDocumentType_retentionYears_df] DEFAULT 8,
    [isActive] BIT NOT NULL CONSTRAINT [PlatformDocumentType_isActive_df] DEFAULT 1,
    [createdAt] DATETIME2 NOT NULL CONSTRAINT [PlatformDocumentType_createdAt_df] DEFAULT CURRENT_TIMESTAMP,
    [updatedAt] DATETIME2 NOT NULL,
    CONSTRAINT [PlatformDocumentType_pkey] PRIMARY KEY CLUSTERED ([id]),
    CONSTRAINT [PlatformDocumentType_companyId_code_key] UNIQUE NONCLUSTERED ([companyId],[code])
);

-- CreateTable
CREATE TABLE [dbo].[PlatformDocument] (
    [id] INT NOT NULL IDENTITY(1,1),
    [companyId] INT NOT NULL,
    [documentTypeId] INT NOT NULL,
    [ownerEntityType] NVARCHAR(20) NOT NULL,
    [ownerEntityId] INT NOT NULL,
    [documentRef] NVARCHAR(40) NOT NULL,
    [versionNo] INT NOT NULL CONSTRAINT [PlatformDocument_versionNo_df] DEFAULT 1,
    [supersedesDocumentId] INT,
    [supersededByDocumentId] INT,
    [storageKey] NVARCHAR(400) NOT NULL,
    [originalFileName] NVARCHAR(260) NOT NULL,
    [mimeType] NVARCHAR(100) NOT NULL,
    [fileSizeBytes] BIGINT NOT NULL,
    [sha256Hash] CHAR(64) NOT NULL,
    [identifierMasked] NVARCHAR(40),
    [issueDate] DATE,
    [expiryDate] DATE,
    [verificationStatus] NVARCHAR(24) NOT NULL CONSTRAINT [PlatformDocument_verificationStatus_df] DEFAULT 'Uploaded',
    [verifiedByUserId] INT,
    [verifiedAt] DATETIME2,
    [verificationRemark] NVARCHAR(500),
    [rejectionReasonCode] NVARCHAR(30),
    [scanStatus] NVARCHAR(12) NOT NULL CONSTRAINT [PlatformDocument_scanStatus_df] DEFAULT 'Skipped',
    [uploadedByUserId] INT,
    [uploadedAt] DATETIME2 NOT NULL CONSTRAINT [PlatformDocument_uploadedAt_df] DEFAULT CURRENT_TIMESTAMP,
    [deletedAt] DATETIME2,
    [createdAt] DATETIME2 NOT NULL CONSTRAINT [PlatformDocument_createdAt_df] DEFAULT CURRENT_TIMESTAMP,
    [updatedAt] DATETIME2 NOT NULL,
    CONSTRAINT [PlatformDocument_pkey] PRIMARY KEY CLUSTERED ([id]),
    CONSTRAINT [PlatformDocument_companyId_documentRef_key] UNIQUE NONCLUSTERED ([companyId],[documentRef])
);

-- CreateTable
CREATE TABLE [dbo].[ConfigSnapshot] (
    [id] INT NOT NULL IDENTITY(1,1),
    [companyId] INT NOT NULL,
    [snapshotTypeCode] NVARCHAR(30) NOT NULL,
    [sourceEntityType] NVARCHAR(40) NOT NULL,
    [sourceEntityId] INT NOT NULL,
    [triggerRequestId] INT,
    [contentJson] NVARCHAR(max) NOT NULL,
    [sha256Hash] CHAR(64) NOT NULL,
    [takenAt] DATETIME2 NOT NULL CONSTRAINT [ConfigSnapshot_takenAt_df] DEFAULT CURRENT_TIMESTAMP,
    [takenByUserId] INT,
    [supersededById] INT,
    [supersededAt] DATETIME2,
    [supersededReason] NVARCHAR(500),
    [note] NVARCHAR(500),
    CONSTRAINT [ConfigSnapshot_pkey] PRIMARY KEY CLUSTERED ([id])
);

-- CreateTable
CREATE TABLE [dbo].[AuditLog] (
    [id] INT NOT NULL IDENTITY(1,1),
    [companyId] INT,
    [entityType] NVARCHAR(60) NOT NULL,
    [entityId] INT,
    [entityRef] NVARCHAR(60),
    [action] NVARCHAR(30) NOT NULL,
    [actorUserId] INT,
    [actorEmpId] INT,
    [actorSource] NVARCHAR(20) NOT NULL CONSTRAINT [AuditLog_actorSource_df] DEFAULT 'user',
    [onBehalfOfEmpId] INT,
    [beforeJson] NVARCHAR(max),
    [afterJson] NVARCHAR(max),
    [changedFields] NVARCHAR(1000),
    [remark] NVARCHAR(1000),
    [correlationId] NVARCHAR(60),
    [ipAddress] NVARCHAR(45),
    [createdAt] DATETIME2 NOT NULL CONSTRAINT [AuditLog_createdAt_df] DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT [AuditLog_pkey] PRIMARY KEY CLUSTERED ([id])
);

-- CreateIndex
CREATE NONCLUSTERED INDEX [WorkflowMatrix_companyId_requestTypeCode_status_idx] ON [dbo].[WorkflowMatrix]([companyId], [requestTypeCode], [status]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [WorkflowMatrixLine_matrixId_levelNo_idx] ON [dbo].[WorkflowMatrixLine]([matrixId], [levelNo]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [WorkflowRequest_companyId_currentStatus_idx] ON [dbo].[WorkflowRequest]([companyId], [currentStatus]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [WorkflowRequest_companyId_requestTypeCode_sourceEntityType_sourceEntityId_idx] ON [dbo].[WorkflowRequest]([companyId], [requestTypeCode], [sourceEntityType], [sourceEntityId]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [WorkflowRequest_requesterEmpId_idx] ON [dbo].[WorkflowRequest]([requesterEmpId]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [WorkflowRequest_dueAt_idx] ON [dbo].[WorkflowRequest]([dueAt]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [WorkflowSlot_requestId_levelNo_idx] ON [dbo].[WorkflowSlot]([requestId], [levelNo]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [WorkflowSlot_resolvedEmpId_status_idx] ON [dbo].[WorkflowSlot]([resolvedEmpId], [status]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [WorkflowSlot_resolvedUserId_status_idx] ON [dbo].[WorkflowSlot]([resolvedUserId], [status]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [WorkflowAction_requestId_idx] ON [dbo].[WorkflowAction]([requestId]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [WorkflowAction_companyId_createdAt_idx] ON [dbo].[WorkflowAction]([companyId], [createdAt]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [WorkflowDelegation_companyId_delegatorEmpId_status_idx] ON [dbo].[WorkflowDelegation]([companyId], [delegatorEmpId], [status]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [WorkflowDelegation_companyId_delegateEmpId_status_idx] ON [dbo].[WorkflowDelegation]([companyId], [delegateEmpId], [status]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [WorkflowEscalation_requestId_idx] ON [dbo].[WorkflowEscalation]([requestId]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [WorkflowEscalation_companyId_createdAt_idx] ON [dbo].[WorkflowEscalation]([companyId], [createdAt]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [NotificationTemplate_companyId_eventCode_channel_status_idx] ON [dbo].[NotificationTemplate]([companyId], [eventCode], [channel], [status]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [NotificationDelivery_companyId_status_nextAttemptAt_idx] ON [dbo].[NotificationDelivery]([companyId], [status], [nextAttemptAt]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [NotificationDelivery_companyId_eventCode_idx] ON [dbo].[NotificationDelivery]([companyId], [eventCode]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [NotificationDelivery_recipientType_recipientId_idx] ON [dbo].[NotificationDelivery]([recipientType], [recipientId]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [NotificationDelivery_correlationId_idx] ON [dbo].[NotificationDelivery]([correlationId]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [NotificationInApp_companyId_recipientUserId_isRead_idx] ON [dbo].[NotificationInApp]([companyId], [recipientUserId], [isRead]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [NotificationInApp_companyId_recipientEmpId_isRead_idx] ON [dbo].[NotificationInApp]([companyId], [recipientEmpId], [isRead]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [PlatformDocument_companyId_ownerEntityType_ownerEntityId_idx] ON [dbo].[PlatformDocument]([companyId], [ownerEntityType], [ownerEntityId]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [PlatformDocument_companyId_documentTypeId_verificationStatus_idx] ON [dbo].[PlatformDocument]([companyId], [documentTypeId], [verificationStatus]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [PlatformDocument_expiryDate_idx] ON [dbo].[PlatformDocument]([expiryDate]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [ConfigSnapshot_companyId_snapshotTypeCode_sourceEntityType_sourceEntityId_idx] ON [dbo].[ConfigSnapshot]([companyId], [snapshotTypeCode], [sourceEntityType], [sourceEntityId]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [AuditLog_companyId_entityType_entityId_idx] ON [dbo].[AuditLog]([companyId], [entityType], [entityId]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [AuditLog_companyId_createdAt_idx] ON [dbo].[AuditLog]([companyId], [createdAt]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [AuditLog_actorUserId_idx] ON [dbo].[AuditLog]([actorUserId]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [AuditLog_correlationId_idx] ON [dbo].[AuditLog]([correlationId]);

