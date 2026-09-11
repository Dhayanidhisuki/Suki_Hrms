BEGIN TRY
  BEGIN TRANSACTION;

  CREATE TABLE VisitorNotificationLog (
    id                INT           NOT NULL IDENTITY(1,1) PRIMARY KEY,
    companyId         INT           NOT NULL,
    event             NVARCHAR(50)  NOT NULL,
    channel           NVARCHAR(20)  NOT NULL DEFAULT 'IN_APP',
    recipient         NVARCHAR(200) NOT NULL,
    subject           NVARCHAR(200) NULL,
    body              NVARCHAR(1000) NULL,
    status            NVARCHAR(20)  NOT NULL DEFAULT 'PENDING',
    visitorGatePassId INT           NULL,
    gnrId             INT           NULL,
    createdAt         DATETIME2     NOT NULL DEFAULT GETDATE(),
    sentAt            DATETIME2     NULL,
    readAt            DATETIME2     NULL,
    [error]           NVARCHAR(500) NULL
  );

  CREATE INDEX IX_VisitorNotificationLog_companyId_event ON VisitorNotificationLog(companyId, event);
  CREATE INDEX IX_VisitorNotificationLog_companyId_status ON VisitorNotificationLog(companyId, status);
  CREATE INDEX IX_VisitorNotificationLog_companyId_createdAt ON VisitorNotificationLog(companyId, createdAt);

  COMMIT TRANSACTION;
END TRY
BEGIN CATCH
  IF @@TRANCOUNT > 0
    ROLLBACK TRANSACTION;
  THROW;
END CATCH;
