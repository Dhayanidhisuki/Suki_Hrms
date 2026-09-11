BEGIN TRY
  BEGIN TRANSACTION;

  ALTER TABLE VisitorGatePass ADD
    identityProofType   NVARCHAR(50)  NULL,
    identityProofNumber NVARCHAR(100) NULL,
    vehicleNumber       NVARCHAR(20)  NULL,
    vehicleType         NVARCHAR(50)  NULL,
    driverName          NVARCHAR(100) NULL,
    driverMobile        NVARCHAR(15)  NULL,
    remarks             NVARCHAR(500) NULL,
    approvedBy          INT           NULL,
    approvedAt          DATETIME2     NULL,
    approvalComments    NVARCHAR(500) NULL,
    rejectionReason     NVARCHAR(500) NULL,
    checkInGate         NVARCHAR(50)  NULL,
    checkOutGate        NVARCHAR(50)  NULL;

  COMMIT TRANSACTION;
END TRY
BEGIN CATCH
  IF @@TRANCOUNT > 0
    ROLLBACK TRANSACTION;
  THROW;
END CATCH;
