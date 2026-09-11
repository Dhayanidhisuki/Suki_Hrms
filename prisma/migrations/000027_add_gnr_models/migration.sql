BEGIN TRY
  BEGIN TRANSACTION;

  CREATE TABLE GateNumberRegister (
    id                INT           NOT NULL IDENTITY(1,1) PRIMARY KEY,
    companyId         INT           NOT NULL,
    gnrNo             NVARCHAR(50)  NOT NULL UNIQUE,
    dcNo              NVARCHAR(100) NOT NULL,
    dcDate            DATE          NULL,
    movementType      NVARCHAR(50)  NOT NULL,
    status            NVARCHAR(30)  NOT NULL DEFAULT 'DRAFT',
    counterpartyType  NVARCHAR(20)  NULL,
    counterpartyName  NVARCHAR(200) NULL,
    transporterName   NVARCHAR(200) NULL,
    sourceLocation    NVARCHAR(200) NULL,
    destinationLocation NVARCHAR(200) NULL,
    contactName       NVARCHAR(100) NULL,
    contactMobile     NVARCHAR(15)  NULL,
    purchaseOrderRef  NVARCHAR(100) NULL,
    workOrderRef      NVARCHAR(100) NULL,
    authorizationRef  NVARCHAR(100) NULL,
    vehicleNumber     NVARCHAR(20)  NULL,
    vehicleType       NVARCHAR(50)  NULL,
    driverName        NVARCHAR(100) NULL,
    driverMobile      NVARCHAR(15)  NULL,
    driverId          NVARCHAR(50)  NULL,
    gateId            NVARCHAR(50)  NULL,
    inwardBy          INT           NULL,
    inwardTime        DATETIME2     NULL,
    inwardRemarks     NVARCHAR(500) NULL,
    outwardBy         INT           NULL,
    outwardTime       DATETIME2     NULL,
    outwardRemarks    NVARCHAR(500) NULL,
    authorizedBy      INT           NULL,
    authorizedAt      DATETIME2     NULL,
    exceptionReason   NVARCHAR(500) NULL,
    rejectionReason   NVARCHAR(500) NULL,
    dcDocumentUrl     NVARCHAR(500) NULL,
    supportingDocumentUrl NVARCHAR(500) NULL,
    createdBy         INT           NULL,
    createdAt         DATETIME2     NOT NULL DEFAULT GETDATE(),
    updatedBy         INT           NULL,
    updatedAt         DATETIME2     NOT NULL DEFAULT GETDATE(),
    deletedAt         DATETIME2     NULL,

    CONSTRAINT FK_GateNumberRegister_Company FOREIGN KEY (companyId) REFERENCES Company(id) ON DELETE NO ACTION ON UPDATE NO ACTION
  );

  CREATE INDEX IX_GateNumberRegister_companyId_status ON GateNumberRegister(companyId, status);
  CREATE INDEX IX_GateNumberRegister_companyId_dcNo ON GateNumberRegister(companyId, dcNo);
  CREATE INDEX IX_GateNumberRegister_companyId_movementType ON GateNumberRegister(companyId, movementType);

  CREATE TABLE GNRLineItem (
    id                  INT            NOT NULL IDENTITY(1,1) PRIMARY KEY,
    gnrId               INT            NOT NULL,
    materialDescription NVARCHAR(500)  NOT NULL,
    itemCode            NVARCHAR(100)  NULL,
    quantity            DECIMAL(18,4)  NULL,
    unit                NVARCHAR(30)   NULL,
    packageCount        INT            NULL,
    returnable          BIT            NOT NULL DEFAULT 0,
    receivedQuantity    DECIMAL(18,4)  NULL,
    remarks             NVARCHAR(500)  NULL,
    createdAt           DATETIME2      NOT NULL DEFAULT GETDATE(),
    updatedAt           DATETIME2      NOT NULL DEFAULT GETDATE(),

    CONSTRAINT FK_GNRLineItem_GateNumberRegister FOREIGN KEY (gnrId) REFERENCES GateNumberRegister(id) ON DELETE CASCADE ON UPDATE NO ACTION
  );

  CREATE INDEX IX_GNRLineItem_gnrId ON GNRLineItem(gnrId);

  COMMIT TRANSACTION;
END TRY
BEGIN CATCH
  IF @@TRANCOUNT > 0
    ROLLBACK TRANSACTION;
  THROW;
END CATCH;
