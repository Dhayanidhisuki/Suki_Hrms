-- NOTE: this script uses GO batch separators because the Employee.companyId
-- backfill (below) references a column added by an ALTER TABLE earlier in
-- the same script — SQL Server compiles a batch as a whole, so the new
-- column must be committed to a prior batch before later statements can
-- reference it. SET XACT_ABORT ON (instead of TRY/CATCH, which cannot span
-- GO-separated batches) means any error aborts and rolls back the whole
-- transaction, which persists correctly across GO boundaries on one session.
SET XACT_ABORT ON;

BEGIN TRAN;

-- DropForeignKey
ALTER TABLE [dbo].[JobInfo] DROP CONSTRAINT [JobInfo_unitId_fkey];

-- DropIndex (old global-unique employeeCode — replaced by companyId+employeeCode below)
ALTER TABLE [dbo].[Employee] DROP CONSTRAINT [Employee_employeeCode_key];

-- CreateTable Company (created early — existing Employee/Unit rows are backfilled
-- against the single seeded company below, before companyId is made NOT NULL)
CREATE TABLE [dbo].[Company] (
    [id] INT NOT NULL IDENTITY(1,1),
    [code] NVARCHAR(20) NOT NULL,
    [name] NVARCHAR(100) NOT NULL,
    [description] NVARCHAR(500),
    [isActive] BIT NOT NULL CONSTRAINT [Company_isActive_df] DEFAULT 1,
    [deletedAt] DATETIME2,
    [createdAt] DATETIME2 NOT NULL CONSTRAINT [Company_createdAt_df] DEFAULT CURRENT_TIMESTAMP,
    [updatedAt] DATETIME2 NOT NULL,
    CONSTRAINT [Company_pkey] PRIMARY KEY CLUSTERED ([id]),
    CONSTRAINT [Company_code_key] UNIQUE NONCLUSTERED ([code])
);

-- Seed the single confirmed company so existing Employee/Unit rows have a
-- value to backfill against (idempotent — scripts/seed-company-and-org.mjs
-- upserts on this same code afterwards).
INSERT INTO [dbo].[Company] ([code], [name], [isActive], [createdAt], [updatedAt])
VALUES ('KUNAERO', 'KUN AEROSPACE PRIVATE LIMITED', 1, SYSUTCDATETIME(), SYSUTCDATETIME());

-- AlterTable — companyId added NULLABLE first (Employee has existing rows;
-- NOT NULL with no default would fail). Backfilled + tightened below.
ALTER TABLE [dbo].[Employee] ADD [companyId] INT NULL,
[guestEmployee] BIT NOT NULL CONSTRAINT [Employee_guestEmployee_df] DEFAULT 0,
[inductionStatus] NVARCHAR(30),
[oldEmployeeCode] NVARCHAR(20),
[profilePhotoPath] NVARCHAR(500),
[signaturePath] NVARCHAR(500),
[title] NVARCHAR(10),
[userId] INT;

GO

-- AlterTable
ALTER TABLE [dbo].[JobInfo] ADD [additionalRole] NVARCHAR(100),
[allowedLossOfMinutes] INT,
[bonusApplicable] BIT NOT NULL CONSTRAINT [JobInfo_bonusApplicable_df] DEFAULT 0,
[companyContact1] NVARCHAR(20),
[companyContact2] NVARCHAR(20),
[dailySheetRequired] BIT NOT NULL CONSTRAINT [JobInfo_dailySheetRequired_df] DEFAULT 0,
[esiApplicable] BIT NOT NULL CONSTRAINT [JobInfo_esiApplicable_df] DEFAULT 0,
[fitnessCertificate] BIT NOT NULL CONSTRAINT [JobInfo_fitnessCertificate_df] DEFAULT 0,
[ipAddress1] NVARCHAR(50),
[ipAddress2] NVARCHAR(50),
[lossOfMinutesDeductionApplicable] BIT NOT NULL CONSTRAINT [JobInfo_lossOfMinutesDeductionApplicable_df] DEFAULT 0,
[ltaEligible] BIT NOT NULL CONSTRAINT [JobInfo_ltaEligible_df] DEFAULT 0,
[ndaDocument] BIT NOT NULL CONSTRAINT [JobInfo_ndaDocument_df] DEFAULT 0,
[numberOfLeavesAllowed] DECIMAL(5,2),
[officialEmail] NVARCHAR(100),
[overtimeAllowed] BIT NOT NULL CONSTRAINT [JobInfo_overtimeAllowed_df] DEFAULT 0,
[overtimeFactor] DECIMAL(5,2),
[overtimeRatePerHour] DECIMAL(18,2),
[paymentMode] NVARCHAR(20),
[permissionHours] DECIMAL(5,2),
[permissionRequestAllowed] BIT NOT NULL CONSTRAINT [JobInfo_permissionRequestAllowed_df] DEFAULT 0,
[petrolAllowance] BIT NOT NULL CONSTRAINT [JobInfo_petrolAllowance_df] DEFAULT 0,
[pfRestrictionAmount] DECIMAL(18,2),
[productionLine] NVARCHAR(100),
[professionalTaxApplicable] BIT NOT NULL CONSTRAINT [JobInfo_professionalTaxApplicable_df] DEFAULT 0,
[shiftRequired] BIT NOT NULL CONSTRAINT [JobInfo_shiftRequired_df] DEFAULT 0,
[subCategory] NVARCHAR(50),
[teamGroup] NVARCHAR(100),
[wageType] NVARCHAR(20);

-- AlterTable
ALTER TABLE [dbo].[PersonalDetails] DROP COLUMN [alternatePhone],
[emergencyContactName],
[emergencyContactPhone],
[emergencyContactRelation],
[mobileNumber],
[permanentAddress],
[presentAddress];
ALTER TABLE [dbo].[PersonalDetails] ADD [canteenAllowanceApplicable] BIT NOT NULL CONSTRAINT [PersonalDetails_canteenAllowanceApplicable_df] DEFAULT 0,
[heightCm] DECIMAL(5,2),
[internationalWorker] BIT NOT NULL CONSTRAINT [PersonalDetails_internationalWorker_df] DEFAULT 0,
[issuedMobileNumber] NVARCHAR(20),
[loanInstalmentMonth] NVARCHAR(20),
[marriageDate] DATETIME2,
[mobileDeductionApplicable] BIT NOT NULL CONSTRAINT [PersonalDetails_mobileDeductionApplicable_df] DEFAULT 0,
[numberOfChildren] INT,
[pantSize] NVARCHAR(10),
[physicallyChallengedCategory] NVARCHAR(50),
[shirtSize] NVARCHAR(10),
[shoeSize] NVARCHAR(10),
[weightKg] DECIMAL(5,2);

-- AlterTable — Unit has 0 existing rows, so NOT NULL with no default is safe as-is.
ALTER TABLE [dbo].[Unit] ADD [companyId] INT NOT NULL;

-- Backfill existing Employee rows against the seeded company, then tighten to NOT NULL.
UPDATE [dbo].[Employee] SET [companyId] = (SELECT [id] FROM [dbo].[Company] WHERE [code] = 'KUNAERO') WHERE [companyId] IS NULL;
ALTER TABLE [dbo].[Employee] ALTER COLUMN [companyId] INT NOT NULL;

-- CreateTable
CREATE TABLE [dbo].[EmployeeContactDetails] (
    [id] INT NOT NULL IDENTITY(1,1),
    [employeeId] INT NOT NULL,
    [permanentAddressLine1] NVARCHAR(200),
    [permanentAddressLine2] NVARCHAR(200),
    [permanentCity] NVARCHAR(100),
    [permanentState] NVARCHAR(100),
    [permanentPincode] NVARCHAR(10),
    [permanentPhone] NVARCHAR(20),
    [permanentMobile] NVARCHAR(20),
    [sameAsPermanent] BIT NOT NULL CONSTRAINT [EmployeeContactDetails_sameAsPermanent_df] DEFAULT 0,
    [presentAddressLine1] NVARCHAR(200),
    [presentAddressLine2] NVARCHAR(200),
    [presentCity] NVARCHAR(100),
    [presentState] NVARCHAR(100),
    [presentPincode] NVARCHAR(10),
    [presentPhone] NVARCHAR(20),
    [presentMobile] NVARCHAR(20),
    [createdAt] DATETIME2 NOT NULL CONSTRAINT [EmployeeContactDetails_createdAt_df] DEFAULT CURRENT_TIMESTAMP,
    [updatedAt] DATETIME2 NOT NULL,
    CONSTRAINT [EmployeeContactDetails_pkey] PRIMARY KEY CLUSTERED ([id]),
    CONSTRAINT [EmployeeContactDetails_employeeId_key] UNIQUE NONCLUSTERED ([employeeId])
);

-- CreateTable
CREATE TABLE [dbo].[EmployeeEmergencyContact] (
    [id] INT NOT NULL IDENTITY(1,1),
    [employeeId] INT NOT NULL,
    [contactName] NVARCHAR(100) NOT NULL,
    [relationship] NVARCHAR(50) NOT NULL,
    [address] NVARCHAR(500),
    [homePhone] NVARCHAR(20),
    [mobile] NVARCHAR(20),
    [alternatePhone] NVARCHAR(20),
    [email] NVARCHAR(100),
    [isPrimary] BIT NOT NULL CONSTRAINT [EmployeeEmergencyContact_isPrimary_df] DEFAULT 0,
    [remarks] NVARCHAR(500),
    [createdAt] DATETIME2 NOT NULL CONSTRAINT [EmployeeEmergencyContact_createdAt_df] DEFAULT CURRENT_TIMESTAMP,
    [updatedAt] DATETIME2 NOT NULL,
    CONSTRAINT [EmployeeEmergencyContact_pkey] PRIMARY KEY CLUSTERED ([id])
);

-- CreateTable
CREATE TABLE [dbo].[EmployeePassport] (
    [id] INT NOT NULL IDENTITY(1,1),
    [employeeId] INT NOT NULL,
    [passportNumber] NVARCHAR(30),
    [placeOfIssue] NVARCHAR(100),
    [countryOfIssue] NVARCHAR(50),
    [issueDate] DATETIME2,
    [expiryDate] DATETIME2,
    [filePath] NVARCHAR(500),
    [verificationStatus] NVARCHAR(20),
    [createdAt] DATETIME2 NOT NULL CONSTRAINT [EmployeePassport_createdAt_df] DEFAULT CURRENT_TIMESTAMP,
    [updatedAt] DATETIME2 NOT NULL,
    CONSTRAINT [EmployeePassport_pkey] PRIMARY KEY CLUSTERED ([id]),
    CONSTRAINT [EmployeePassport_employeeId_key] UNIQUE NONCLUSTERED ([employeeId])
);

-- CreateTable
CREATE TABLE [dbo].[EmployeeKyc] (
    [id] INT NOT NULL IDENTITY(1,1),
    [employeeId] INT NOT NULL,
    [pfNumber] NVARCHAR(30),
    [uanNumber] NVARCHAR(20),
    [esiNumber] NVARCHAR(20),
    [panNumberEnc] NVARCHAR(255),
    [aadhaarNumberEnc] NVARCHAR(255),
    [drivingLicenceNumber] NVARCHAR(30),
    [drivingLicenceExpiry] DATETIME2,
    [electionCardNumber] NVARCHAR(30),
    [rationCardNumber] NVARCHAR(30),
    [verificationStatus] NVARCHAR(20),
    [verifiedByUserId] INT,
    [verifiedDate] DATETIME2,
    [createdAt] DATETIME2 NOT NULL CONSTRAINT [EmployeeKyc_createdAt_df] DEFAULT CURRENT_TIMESTAMP,
    [updatedAt] DATETIME2 NOT NULL,
    CONSTRAINT [EmployeeKyc_pkey] PRIMARY KEY CLUSTERED ([id]),
    CONSTRAINT [EmployeeKyc_employeeId_key] UNIQUE NONCLUSTERED ([employeeId])
);

-- CreateTable
CREATE TABLE [dbo].[EmployeeSkill] (
    [id] INT NOT NULL IDENTITY(1,1),
    [employeeId] INT NOT NULL,
    [skillCategory] NVARCHAR(100),
    [skillName] NVARCHAR(100) NOT NULL,
    [proficiencyLevel] NVARCHAR(30),
    [levelPercentage] DECIMAL(5,2),
    [certified] BIT NOT NULL CONSTRAINT [EmployeeSkill_certified_df] DEFAULT 0,
    [certificateNumber] NVARCHAR(50),
    [certifiedDate] DATETIME2,
    [expiryDate] DATETIME2,
    [evaluatedBy] NVARCHAR(100),
    [remarks] NVARCHAR(500),
    [createdAt] DATETIME2 NOT NULL CONSTRAINT [EmployeeSkill_createdAt_df] DEFAULT CURRENT_TIMESTAMP,
    [updatedAt] DATETIME2 NOT NULL,
    CONSTRAINT [EmployeeSkill_pkey] PRIMARY KEY CLUSTERED ([id])
);

-- CreateTable
CREATE TABLE [dbo].[EmployeeActivity] (
    [id] INT NOT NULL IDENTITY(1,1),
    [employeeId] INT NOT NULL,
    [activityType] NVARCHAR(50) NOT NULL,
    [activityAt] DATETIME2 NOT NULL CONSTRAINT [EmployeeActivity_activityAt_df] DEFAULT CURRENT_TIMESTAMP,
    [performedByUserId] INT,
    [module] NVARCHAR(50) NOT NULL,
    [oldValue] NVARCHAR(2000),
    [newValue] NVARCHAR(2000),
    [remarks] NVARCHAR(500),
    [source] NVARCHAR(30),
    [relatedRecordId] INT,
    CONSTRAINT [EmployeeActivity_pkey] PRIMARY KEY CLUSTERED ([id])
);

-- CreateTable
CREATE TABLE [dbo].[SalaryComponent] (
    [id] INT NOT NULL IDENTITY(1,1),
    [code] NVARCHAR(30) NOT NULL,
    [name] NVARCHAR(100) NOT NULL,
    [type] NVARCHAR(30) NOT NULL,
    [isActive] BIT NOT NULL CONSTRAINT [SalaryComponent_isActive_df] DEFAULT 1,
    [deletedAt] DATETIME2,
    [createdAt] DATETIME2 NOT NULL CONSTRAINT [SalaryComponent_createdAt_df] DEFAULT CURRENT_TIMESTAMP,
    [updatedAt] DATETIME2 NOT NULL,
    CONSTRAINT [SalaryComponent_pkey] PRIMARY KEY CLUSTERED ([id]),
    CONSTRAINT [SalaryComponent_code_key] UNIQUE NONCLUSTERED ([code])
);

-- CreateTable
CREATE TABLE [dbo].[EmployeeSalaryRevision] (
    [id] INT NOT NULL IDENTITY(1,1),
    [employeeId] INT NOT NULL,
    [financialYear] NVARCHAR(10),
    [grossSalary] DECIMAL(18,2) NOT NULL,
    [netSalary] DECIMAL(18,2),
    [lastUpdatedByUserId] INT,
    [effectiveFrom] DATETIME2 NOT NULL,
    [effectiveTo] DATETIME2,
    [createdAt] DATETIME2 NOT NULL CONSTRAINT [EmployeeSalaryRevision_createdAt_df] DEFAULT CURRENT_TIMESTAMP,
    [updatedAt] DATETIME2 NOT NULL,
    CONSTRAINT [EmployeeSalaryRevision_pkey] PRIMARY KEY CLUSTERED ([id])
);

-- CreateTable
CREATE TABLE [dbo].[EmployeeSalaryComponent] (
    [id] INT NOT NULL IDENTITY(1,1),
    [salaryRevisionId] INT NOT NULL,
    [salaryComponentId] INT NOT NULL,
    [amount] DECIMAL(18,2) NOT NULL,
    CONSTRAINT [EmployeeSalaryComponent_pkey] PRIMARY KEY CLUSTERED ([id]),
    CONSTRAINT [EmployeeSalaryComponent_salaryRevisionId_salaryComponentId_key] UNIQUE NONCLUSTERED ([salaryRevisionId],[salaryComponentId])
);

-- CreateTable
CREATE TABLE [dbo].[EmployeeCtc] (
    [id] INT NOT NULL IDENTITY(1,1),
    [employeeId] INT NOT NULL,
    [basic] DECIMAL(18,2) NOT NULL,
    [specialAllowance] DECIMAL(18,2) NOT NULL CONSTRAINT [EmployeeCtc_specialAllowance_df] DEFAULT 0,
    [hra] DECIMAL(18,2) NOT NULL CONSTRAINT [EmployeeCtc_hra_df] DEFAULT 0,
    [conveyanceAllowance] DECIMAL(18,2) NOT NULL CONSTRAINT [EmployeeCtc_conveyanceAllowance_df] DEFAULT 0,
    [washAllowance] DECIMAL(18,2) NOT NULL CONSTRAINT [EmployeeCtc_washAllowance_df] DEFAULT 0,
    [canteen] DECIMAL(18,2) NOT NULL CONSTRAINT [EmployeeCtc_canteen_df] DEFAULT 0,
    [dislocationAllowance] DECIMAL(18,2) NOT NULL CONSTRAINT [EmployeeCtc_dislocationAllowance_df] DEFAULT 0,
    [otherAllowance] DECIMAL(18,2) NOT NULL CONSTRAINT [EmployeeCtc_otherAllowance_df] DEFAULT 0,
    [shiftAllowance] DECIMAL(18,2) NOT NULL CONSTRAINT [EmployeeCtc_shiftAllowance_df] DEFAULT 0,
    [attendanceBonus] DECIMAL(18,2) NOT NULL CONSTRAINT [EmployeeCtc_attendanceBonus_df] DEFAULT 0,
    [employeePf] DECIMAL(18,2) NOT NULL CONSTRAINT [EmployeeCtc_employeePf_df] DEFAULT 0,
    [employeeEsi] DECIMAL(18,2) NOT NULL CONSTRAINT [EmployeeCtc_employeeEsi_df] DEFAULT 0,
    [bonus] DECIMAL(18,2) NOT NULL CONSTRAINT [EmployeeCtc_bonus_df] DEFAULT 0,
    [lta] DECIMAL(18,2) NOT NULL CONSTRAINT [EmployeeCtc_lta_df] DEFAULT 0,
    [medicalClaim] DECIMAL(18,2) NOT NULL CONSTRAINT [EmployeeCtc_medicalClaim_df] DEFAULT 0,
    [gratuity] DECIMAL(18,2) NOT NULL CONSTRAINT [EmployeeCtc_gratuity_df] DEFAULT 0,
    [employerPf] DECIMAL(18,2) NOT NULL CONSTRAINT [EmployeeCtc_employerPf_df] DEFAULT 0,
    [employerEsi] DECIMAL(18,2) NOT NULL CONSTRAINT [EmployeeCtc_employerEsi_df] DEFAULT 0,
    [otherBenefits] DECIMAL(18,2) NOT NULL CONSTRAINT [EmployeeCtc_otherBenefits_df] DEFAULT 0,
    [nonMonetaryBenefits] DECIMAL(18,2) NOT NULL CONSTRAINT [EmployeeCtc_nonMonetaryBenefits_df] DEFAULT 0,
    [monthlyCtc] DECIMAL(18,2) NOT NULL,
    [annualCtc] DECIMAL(18,2) NOT NULL,
    [effectiveFrom] DATETIME2 NOT NULL,
    [effectiveTo] DATETIME2,
    [createdAt] DATETIME2 NOT NULL CONSTRAINT [EmployeeCtc_createdAt_df] DEFAULT CURRENT_TIMESTAMP,
    [updatedAt] DATETIME2 NOT NULL,
    CONSTRAINT [EmployeeCtc_pkey] PRIMARY KEY CLUSTERED ([id])
);

-- CreateIndex
CREATE NONCLUSTERED INDEX [EmployeeEmergencyContact_employeeId_idx] ON [dbo].[EmployeeEmergencyContact]([employeeId]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [EmployeeSkill_employeeId_idx] ON [dbo].[EmployeeSkill]([employeeId]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [EmployeeActivity_employeeId_idx] ON [dbo].[EmployeeActivity]([employeeId]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [EmployeeActivity_activityAt_idx] ON [dbo].[EmployeeActivity]([activityAt]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [EmployeeSalaryRevision_employeeId_idx] ON [dbo].[EmployeeSalaryRevision]([employeeId]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [EmployeeSalaryRevision_effectiveFrom_effectiveTo_idx] ON [dbo].[EmployeeSalaryRevision]([effectiveFrom], [effectiveTo]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [EmployeeCtc_employeeId_idx] ON [dbo].[EmployeeCtc]([employeeId]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [EmployeeCtc_effectiveFrom_effectiveTo_idx] ON [dbo].[EmployeeCtc]([effectiveFrom], [effectiveTo]);

-- CreateIndex — filtered (userId is nullable; a plain UNIQUE constraint would
-- treat multiple NULLs as duplicate keys on SQL Server).
CREATE UNIQUE NONCLUSTERED INDEX [Employee_userId_key] ON [dbo].[Employee]([userId]) WHERE [userId] IS NOT NULL;

-- CreateIndex
ALTER TABLE [dbo].[Employee] ADD CONSTRAINT [Employee_companyId_employeeCode_key] UNIQUE NONCLUSTERED ([companyId], [employeeCode]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [Unit_companyId_idx] ON [dbo].[Unit]([companyId]);

-- AddForeignKey
ALTER TABLE [dbo].[Unit] ADD CONSTRAINT [Unit_companyId_fkey] FOREIGN KEY ([companyId]) REFERENCES [dbo].[Company]([id]) ON DELETE NO ACTION ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE [dbo].[Employee] ADD CONSTRAINT [Employee_companyId_fkey] FOREIGN KEY ([companyId]) REFERENCES [dbo].[Company]([id]) ON DELETE NO ACTION ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE [dbo].[Employee] ADD CONSTRAINT [Employee_userId_fkey] FOREIGN KEY ([userId]) REFERENCES [dbo].[User]([id]) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE [dbo].[EmployeeContactDetails] ADD CONSTRAINT [EmployeeContactDetails_employeeId_fkey] FOREIGN KEY ([employeeId]) REFERENCES [dbo].[Employee]([id]) ON DELETE NO ACTION ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE [dbo].[EmployeeEmergencyContact] ADD CONSTRAINT [EmployeeEmergencyContact_employeeId_fkey] FOREIGN KEY ([employeeId]) REFERENCES [dbo].[Employee]([id]) ON DELETE NO ACTION ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE [dbo].[JobInfo] ADD CONSTRAINT [JobInfo_unitId_fkey] FOREIGN KEY ([unitId]) REFERENCES [dbo].[Unit]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[EmployeePassport] ADD CONSTRAINT [EmployeePassport_employeeId_fkey] FOREIGN KEY ([employeeId]) REFERENCES [dbo].[Employee]([id]) ON DELETE NO ACTION ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE [dbo].[EmployeeKyc] ADD CONSTRAINT [EmployeeKyc_employeeId_fkey] FOREIGN KEY ([employeeId]) REFERENCES [dbo].[Employee]([id]) ON DELETE NO ACTION ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE [dbo].[EmployeeSkill] ADD CONSTRAINT [EmployeeSkill_employeeId_fkey] FOREIGN KEY ([employeeId]) REFERENCES [dbo].[Employee]([id]) ON DELETE NO ACTION ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE [dbo].[EmployeeActivity] ADD CONSTRAINT [EmployeeActivity_employeeId_fkey] FOREIGN KEY ([employeeId]) REFERENCES [dbo].[Employee]([id]) ON DELETE NO ACTION ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE [dbo].[EmployeeSalaryRevision] ADD CONSTRAINT [EmployeeSalaryRevision_employeeId_fkey] FOREIGN KEY ([employeeId]) REFERENCES [dbo].[Employee]([id]) ON DELETE NO ACTION ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE [dbo].[EmployeeSalaryComponent] ADD CONSTRAINT [EmployeeSalaryComponent_salaryRevisionId_fkey] FOREIGN KEY ([salaryRevisionId]) REFERENCES [dbo].[EmployeeSalaryRevision]([id]) ON DELETE NO ACTION ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE [dbo].[EmployeeSalaryComponent] ADD CONSTRAINT [EmployeeSalaryComponent_salaryComponentId_fkey] FOREIGN KEY ([salaryComponentId]) REFERENCES [dbo].[SalaryComponent]([id]) ON DELETE NO ACTION ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE [dbo].[EmployeeCtc] ADD CONSTRAINT [EmployeeCtc_employeeId_fkey] FOREIGN KEY ([employeeId]) REFERENCES [dbo].[Employee]([id]) ON DELETE NO ACTION ON UPDATE CASCADE;

COMMIT TRAN;
