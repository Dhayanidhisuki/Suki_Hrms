BEGIN TRY

BEGIN TRAN;

-- CreateSchema
IF NOT EXISTS (SELECT * FROM sys.schemas WHERE name = N'dbo') EXEC sp_executesql N'CREATE SCHEMA [dbo];';

-- CreateTable
CREATE TABLE [dbo].[AssetMaster] (
    [id] INT NOT NULL IDENTITY(1,1),
    [code] NVARCHAR(20) NOT NULL,
    [name] NVARCHAR(100) NOT NULL,
    [description] NVARCHAR(500),
    [isActive] BIT NOT NULL CONSTRAINT [AssetMaster_isActive_df] DEFAULT 1,
    [deletedAt] DATETIME2,
    [createdAt] DATETIME2 NOT NULL CONSTRAINT [AssetMaster_createdAt_df] DEFAULT CURRENT_TIMESTAMP,
    [updatedAt] DATETIME2 NOT NULL,
    CONSTRAINT [AssetMaster_pkey] PRIMARY KEY CLUSTERED ([id] ASC),
    CONSTRAINT [AssetMaster_code_key] UNIQUE NONCLUSTERED ([code] ASC)
);

-- CreateTable
CREATE TABLE [dbo].[Category] (
    [id] INT NOT NULL IDENTITY(1,1),
    [code] NVARCHAR(20) NOT NULL,
    [name] NVARCHAR(100) NOT NULL,
    [description] NVARCHAR(500),
    [isActive] BIT NOT NULL CONSTRAINT [Category_isActive_df] DEFAULT 1,
    [deletedAt] DATETIME2,
    [createdAt] DATETIME2 NOT NULL CONSTRAINT [Category_createdAt_df] DEFAULT CURRENT_TIMESTAMP,
    [updatedAt] DATETIME2 NOT NULL,
    CONSTRAINT [Category_pkey] PRIMARY KEY CLUSTERED ([id] ASC),
    CONSTRAINT [Category_code_key] UNIQUE NONCLUSTERED ([code] ASC)
);

-- CreateTable
CREATE TABLE [dbo].[Department] (
    [id] INT NOT NULL IDENTITY(1,1),
    [code] NVARCHAR(20) NOT NULL,
    [name] NVARCHAR(100) NOT NULL,
    [description] NVARCHAR(500),
    [isActive] BIT NOT NULL CONSTRAINT [Department_isActive_df] DEFAULT 1,
    [deletedAt] DATETIME2,
    [createdAt] DATETIME2 NOT NULL CONSTRAINT [Department_createdAt_df] DEFAULT CURRENT_TIMESTAMP,
    [updatedAt] DATETIME2 NOT NULL,
    CONSTRAINT [Department_pkey] PRIMARY KEY CLUSTERED ([id] ASC),
    CONSTRAINT [Department_code_key] UNIQUE NONCLUSTERED ([code] ASC)
);

-- CreateTable
CREATE TABLE [dbo].[Designation] (
    [id] INT NOT NULL IDENTITY(1,1),
    [code] NVARCHAR(20) NOT NULL,
    [name] NVARCHAR(100) NOT NULL,
    [description] NVARCHAR(500),
    [isActive] BIT NOT NULL CONSTRAINT [Designation_isActive_df] DEFAULT 1,
    [deletedAt] DATETIME2,
    [createdAt] DATETIME2 NOT NULL CONSTRAINT [Designation_createdAt_df] DEFAULT CURRENT_TIMESTAMP,
    [updatedAt] DATETIME2 NOT NULL,
    CONSTRAINT [Designation_pkey] PRIMARY KEY CLUSTERED ([id] ASC),
    CONSTRAINT [Designation_code_key] UNIQUE NONCLUSTERED ([code] ASC)
);

-- CreateTable
CREATE TABLE [dbo].[DropdownMaster] (
    [id] INT NOT NULL IDENTITY(1,1),
    [category] NVARCHAR(50) NOT NULL,
    [label] NVARCHAR(100) NOT NULL,
    [value] NVARCHAR(100) NOT NULL,
    [sortOrder] INT NOT NULL CONSTRAINT [DropdownMaster_sortOrder_df] DEFAULT 0,
    [isActive] BIT NOT NULL CONSTRAINT [DropdownMaster_isActive_df] DEFAULT 1,
    [deletedAt] DATETIME2,
    [createdAt] DATETIME2 NOT NULL CONSTRAINT [DropdownMaster_createdAt_df] DEFAULT CURRENT_TIMESTAMP,
    [updatedAt] DATETIME2 NOT NULL,
    CONSTRAINT [DropdownMaster_pkey] PRIMARY KEY CLUSTERED ([id] ASC),
    CONSTRAINT [DropdownMaster_category_value_key] UNIQUE NONCLUSTERED ([category] ASC,[value] ASC)
);

-- CreateTable
CREATE TABLE [dbo].[Employee] (
    [id] INT NOT NULL IDENTITY(1,1),
    [employeeCode] NVARCHAR(20) NOT NULL,
    [firstName] NVARCHAR(100) NOT NULL,
    [middleName] NVARCHAR(100),
    [lastName] NVARCHAR(100) NOT NULL,
    [status] NVARCHAR(20) NOT NULL CONSTRAINT [Employee_status_df] DEFAULT 'active',
    [reportingManagerId] INT,
    [isActive] BIT NOT NULL CONSTRAINT [Employee_isActive_df] DEFAULT 1,
    [deletedAt] DATETIME2,
    [createdAt] DATETIME2 NOT NULL CONSTRAINT [Employee_createdAt_df] DEFAULT CURRENT_TIMESTAMP,
    [updatedAt] DATETIME2 NOT NULL,
    CONSTRAINT [Employee_pkey] PRIMARY KEY CLUSTERED ([id] ASC),
    CONSTRAINT [Employee_employeeCode_key] UNIQUE NONCLUSTERED ([employeeCode] ASC)
);

-- CreateTable
CREATE TABLE [dbo].[EmployeeAssetAllocation] (
    [id] INT NOT NULL IDENTITY(1,1),
    [employeeId] INT NOT NULL,
    [assetMasterId] INT NOT NULL,
    [allocatedDate] DATETIME2 NOT NULL CONSTRAINT [EmployeeAssetAllocation_allocatedDate_df] DEFAULT CURRENT_TIMESTAMP,
    [returnedDate] DATETIME2,
    [notes] NVARCHAR(500),
    [createdAt] DATETIME2 NOT NULL CONSTRAINT [EmployeeAssetAllocation_createdAt_df] DEFAULT CURRENT_TIMESTAMP,
    [updatedAt] DATETIME2 NOT NULL,
    CONSTRAINT [EmployeeAssetAllocation_pkey] PRIMARY KEY CLUSTERED ([id] ASC)
);

-- CreateTable
CREATE TABLE [dbo].[EmployeeBankDetail] (
    [id] INT NOT NULL IDENTITY(1,1),
    [employeeId] INT NOT NULL,
    [bankName] NVARCHAR(100),
    [branchName] NVARCHAR(100),
    [accountNumber] NVARCHAR(30),
    [ifscCode] NVARCHAR(20),
    [accountType] NVARCHAR(20),
    [isPrimary] BIT NOT NULL CONSTRAINT [EmployeeBankDetail_isPrimary_df] DEFAULT 1,
    [createdAt] DATETIME2 NOT NULL CONSTRAINT [EmployeeBankDetail_createdAt_df] DEFAULT CURRENT_TIMESTAMP,
    [updatedAt] DATETIME2 NOT NULL,
    CONSTRAINT [EmployeeBankDetail_pkey] PRIMARY KEY CLUSTERED ([id] ASC),
    CONSTRAINT [EmployeeBankDetail_employeeId_key] UNIQUE NONCLUSTERED ([employeeId] ASC)
);

-- CreateTable
CREATE TABLE [dbo].[EmployeeDependent] (
    [id] INT NOT NULL IDENTITY(1,1),
    [employeeId] INT NOT NULL,
    [name] NVARCHAR(100) NOT NULL,
    [relationship] NVARCHAR(50) NOT NULL,
    [dateOfBirth] DATETIME2,
    [isDependent] BIT NOT NULL CONSTRAINT [EmployeeDependent_isDependent_df] DEFAULT 1,
    [createdAt] DATETIME2 NOT NULL CONSTRAINT [EmployeeDependent_createdAt_df] DEFAULT CURRENT_TIMESTAMP,
    [updatedAt] DATETIME2 NOT NULL,
    CONSTRAINT [EmployeeDependent_pkey] PRIMARY KEY CLUSTERED ([id] ASC)
);

-- CreateTable
CREATE TABLE [dbo].[EmployeeDocument] (
    [id] INT NOT NULL IDENTITY(1,1),
    [employeeId] INT NOT NULL,
    [docType] NVARCHAR(30) NOT NULL,
    [docNumber] NVARCHAR(50),
    [fileName] NVARCHAR(200),
    [filePath] NVARCHAR(500),
    [issuedDate] DATETIME2,
    [expiryDate] DATETIME2,
    [isVerified] BIT NOT NULL CONSTRAINT [EmployeeDocument_isVerified_df] DEFAULT 0,
    [createdAt] DATETIME2 NOT NULL CONSTRAINT [EmployeeDocument_createdAt_df] DEFAULT CURRENT_TIMESTAMP,
    [updatedAt] DATETIME2 NOT NULL,
    CONSTRAINT [EmployeeDocument_pkey] PRIMARY KEY CLUSTERED ([id] ASC)
);

-- CreateTable
CREATE TABLE [dbo].[EmployeeEducation] (
    [id] INT NOT NULL IDENTITY(1,1),
    [employeeId] INT NOT NULL,
    [qualification] NVARCHAR(100) NOT NULL,
    [institution] NVARCHAR(200),
    [university] NVARCHAR(200),
    [yearOfPassing] INT,
    [percentage] DECIMAL(5,2),
    [createdAt] DATETIME2 NOT NULL CONSTRAINT [EmployeeEducation_createdAt_df] DEFAULT CURRENT_TIMESTAMP,
    [updatedAt] DATETIME2 NOT NULL,
    CONSTRAINT [EmployeeEducation_pkey] PRIMARY KEY CLUSTERED ([id] ASC)
);

-- CreateTable
CREATE TABLE [dbo].[EmployeeExperience] (
    [id] INT NOT NULL IDENTITY(1,1),
    [employeeId] INT NOT NULL,
    [companyName] NVARCHAR(100) NOT NULL,
    [designation] NVARCHAR(100) NOT NULL,
    [fromDate] DATETIME2 NOT NULL,
    [toDate] DATETIME2,
    [reasonForLeaving] NVARCHAR(500),
    [lastDrawnSalary] DECIMAL(18,2),
    [createdAt] DATETIME2 NOT NULL CONSTRAINT [EmployeeExperience_createdAt_df] DEFAULT CURRENT_TIMESTAMP,
    [updatedAt] DATETIME2 NOT NULL,
    CONSTRAINT [EmployeeExperience_pkey] PRIMARY KEY CLUSTERED ([id] ASC)
);

-- CreateTable
CREATE TABLE [dbo].[EmployeeType] (
    [id] INT NOT NULL IDENTITY(1,1),
    [code] NVARCHAR(20) NOT NULL,
    [name] NVARCHAR(100) NOT NULL,
    [description] NVARCHAR(500),
    [isActive] BIT NOT NULL CONSTRAINT [EmployeeType_isActive_df] DEFAULT 1,
    [deletedAt] DATETIME2,
    [createdAt] DATETIME2 NOT NULL CONSTRAINT [EmployeeType_createdAt_df] DEFAULT CURRENT_TIMESTAMP,
    [updatedAt] DATETIME2 NOT NULL,
    CONSTRAINT [EmployeeType_pkey] PRIMARY KEY CLUSTERED ([id] ASC),
    CONSTRAINT [EmployeeType_code_key] UNIQUE NONCLUSTERED ([code] ASC)
);

-- CreateTable
CREATE TABLE [dbo].[EsiRate] (
    [id] INT NOT NULL IDENTITY(1,1),
    [code] NVARCHAR(20) NOT NULL,
    [employeeContributionRate] DECIMAL(5,2) NOT NULL,
    [employerContributionRate] DECIMAL(5,2) NOT NULL,
    [wageCeilingMonthly] DECIMAL(18,2) NOT NULL,
    [effectiveFrom] DATETIME2 NOT NULL,
    [effectiveTo] DATETIME2,
    [isActive] BIT NOT NULL CONSTRAINT [EsiRate_isActive_df] DEFAULT 1,
    [createdAt] DATETIME2 NOT NULL CONSTRAINT [EsiRate_createdAt_df] DEFAULT CURRENT_TIMESTAMP,
    [updatedAt] DATETIME2 NOT NULL,
    CONSTRAINT [EsiRate_pkey] PRIMARY KEY CLUSTERED ([id] ASC)
);

-- CreateTable
CREATE TABLE [dbo].[ExitInterview] (
    [id] INT NOT NULL IDENTITY(1,1),
    [employeeId] INT NOT NULL,
    [exitDate] DATETIME2 NOT NULL,
    [exitReason] NVARCHAR(500),
    [exitType] NVARCHAR(20) NOT NULL,
    [interviewNotes] NVARCHAR(2000),
    [interviewDate] DATETIME2,
    [interviewedBy] NVARCHAR(100),
    [createdAt] DATETIME2 NOT NULL CONSTRAINT [ExitInterview_createdAt_df] DEFAULT CURRENT_TIMESTAMP,
    [updatedAt] DATETIME2 NOT NULL,
    CONSTRAINT [ExitInterview_pkey] PRIMARY KEY CLUSTERED ([id] ASC),
    CONSTRAINT [ExitInterview_employeeId_key] UNIQUE NONCLUSTERED ([employeeId] ASC)
);

-- CreateTable
CREATE TABLE [dbo].[Grade] (
    [id] INT NOT NULL IDENTITY(1,1),
    [code] NVARCHAR(20) NOT NULL,
    [name] NVARCHAR(100) NOT NULL,
    [description] NVARCHAR(500),
    [isActive] BIT NOT NULL CONSTRAINT [Grade_isActive_df] DEFAULT 1,
    [deletedAt] DATETIME2,
    [createdAt] DATETIME2 NOT NULL CONSTRAINT [Grade_createdAt_df] DEFAULT CURRENT_TIMESTAMP,
    [updatedAt] DATETIME2 NOT NULL,
    CONSTRAINT [Grade_pkey] PRIMARY KEY CLUSTERED ([id] ASC),
    CONSTRAINT [Grade_code_key] UNIQUE NONCLUSTERED ([code] ASC)
);

-- CreateTable
CREATE TABLE [dbo].[JobInfo] (
    [id] INT NOT NULL IDENTITY(1,1),
    [employeeId] INT NOT NULL,
    [departmentId] INT NOT NULL,
    [subDepartmentId] INT,
    [designationId] INT NOT NULL,
    [employeeTypeId] INT NOT NULL,
    [categoryId] INT,
    [gradeId] INT,
    [levelId] INT,
    [unitId] INT,
    [shiftMasterId] INT,
    [shiftPlanId] INT,
    [jobTitle] NVARCHAR(100),
    [joinDate] DATETIME2 NOT NULL,
    [confirmationDate] DATETIME2,
    [probationEndDate] DATETIME2,
    [effectiveFrom] DATETIME2 NOT NULL,
    [effectiveTo] DATETIME2,
    [createdAt] DATETIME2 NOT NULL CONSTRAINT [JobInfo_createdAt_df] DEFAULT CURRENT_TIMESTAMP,
    [updatedAt] DATETIME2 NOT NULL,
    CONSTRAINT [JobInfo_pkey] PRIMARY KEY CLUSTERED ([id] ASC)
);

-- CreateTable
CREATE TABLE [dbo].[LeaveMaster] (
    [id] INT NOT NULL IDENTITY(1,1),
    [code] NVARCHAR(20) NOT NULL,
    [name] NVARCHAR(100) NOT NULL,
    [description] NVARCHAR(500),
    [isActive] BIT NOT NULL CONSTRAINT [LeaveMaster_isActive_df] DEFAULT 1,
    [deletedAt] DATETIME2,
    [createdAt] DATETIME2 NOT NULL CONSTRAINT [LeaveMaster_createdAt_df] DEFAULT CURRENT_TIMESTAMP,
    [updatedAt] DATETIME2 NOT NULL,
    CONSTRAINT [LeaveMaster_pkey] PRIMARY KEY CLUSTERED ([id] ASC),
    CONSTRAINT [LeaveMaster_code_key] UNIQUE NONCLUSTERED ([code] ASC)
);

-- CreateTable
CREATE TABLE [dbo].[Level] (
    [id] INT NOT NULL IDENTITY(1,1),
    [code] NVARCHAR(20) NOT NULL,
    [name] NVARCHAR(100) NOT NULL,
    [description] NVARCHAR(500),
    [isActive] BIT NOT NULL CONSTRAINT [Level_isActive_df] DEFAULT 1,
    [deletedAt] DATETIME2,
    [createdAt] DATETIME2 NOT NULL CONSTRAINT [Level_createdAt_df] DEFAULT CURRENT_TIMESTAMP,
    [updatedAt] DATETIME2 NOT NULL,
    CONSTRAINT [Level_pkey] PRIMARY KEY CLUSTERED ([id] ASC),
    CONSTRAINT [Level_code_key] UNIQUE NONCLUSTERED ([code] ASC)
);

-- CreateTable
CREATE TABLE [dbo].[LoanType] (
    [id] INT NOT NULL IDENTITY(1,1),
    [code] NVARCHAR(20) NOT NULL,
    [name] NVARCHAR(100) NOT NULL,
    [description] NVARCHAR(500),
    [isActive] BIT NOT NULL CONSTRAINT [LoanType_isActive_df] DEFAULT 1,
    [deletedAt] DATETIME2,
    [createdAt] DATETIME2 NOT NULL CONSTRAINT [LoanType_createdAt_df] DEFAULT CURRENT_TIMESTAMP,
    [updatedAt] DATETIME2 NOT NULL,
    CONSTRAINT [LoanType_pkey] PRIMARY KEY CLUSTERED ([id] ASC),
    CONSTRAINT [LoanType_code_key] UNIQUE NONCLUSTERED ([code] ASC)
);

-- CreateTable
CREATE TABLE [dbo].[OTPlan] (
    [id] INT NOT NULL IDENTITY(1,1),
    [code] NVARCHAR(20) NOT NULL,
    [name] NVARCHAR(100) NOT NULL,
    [otRateMultiplier] DECIMAL(5,2) NOT NULL,
    [applicableAfterMinutes] INT NOT NULL CONSTRAINT [OTPlan_applicableAfterMinutes_df] DEFAULT 0,
    [maxOtHoursPerDay] INT,
    [description] NVARCHAR(500),
    [isActive] BIT NOT NULL CONSTRAINT [OTPlan_isActive_df] DEFAULT 1,
    [deletedAt] DATETIME2,
    [createdAt] DATETIME2 NOT NULL CONSTRAINT [OTPlan_createdAt_df] DEFAULT CURRENT_TIMESTAMP,
    [updatedAt] DATETIME2 NOT NULL,
    CONSTRAINT [OTPlan_pkey] PRIMARY KEY CLUSTERED ([id] ASC),
    CONSTRAINT [OTPlan_code_key] UNIQUE NONCLUSTERED ([code] ASC)
);

-- CreateTable
CREATE TABLE [dbo].[Permission] (
    [id] INT NOT NULL IDENTITY(1,1),
    [code] NVARCHAR(50) NOT NULL,
    [module] NVARCHAR(50) NOT NULL,
    [submodule] NVARCHAR(50),
    [page] NVARCHAR(50),
    [action] NVARCHAR(20) NOT NULL,
    [description] NVARCHAR(500),
    [isActive] BIT NOT NULL CONSTRAINT [Permission_isActive_df] DEFAULT 1,
    [deletedAt] DATETIME2,
    [createdAt] DATETIME2 NOT NULL CONSTRAINT [Permission_createdAt_df] DEFAULT CURRENT_TIMESTAMP,
    [updatedAt] DATETIME2 NOT NULL,
    CONSTRAINT [Permission_pkey] PRIMARY KEY CLUSTERED ([id] ASC),
    CONSTRAINT [Permission_code_key] UNIQUE NONCLUSTERED ([code] ASC)
);

-- CreateTable
CREATE TABLE [dbo].[PersonalDetails] (
    [id] INT NOT NULL IDENTITY(1,1),
    [employeeId] INT NOT NULL,
    [dateOfBirth] DATETIME2,
    [gender] NVARCHAR(20),
    [bloodGroup] NVARCHAR(10),
    [maritalStatus] NVARCHAR(20),
    [nationality] NVARCHAR(50),
    [religion] NVARCHAR(50),
    [category] NVARCHAR(50),
    [physicallyChallenged] BIT NOT NULL CONSTRAINT [PersonalDetails_physicallyChallenged_df] DEFAULT 0,
    [personalEmail] NVARCHAR(100),
    [mobileNumber] NVARCHAR(20),
    [alternatePhone] NVARCHAR(20),
    [presentAddress] NVARCHAR(500),
    [permanentAddress] NVARCHAR(500),
    [emergencyContactName] NVARCHAR(100),
    [emergencyContactPhone] NVARCHAR(20),
    [emergencyContactRelation] NVARCHAR(50),
    [createdAt] DATETIME2 NOT NULL CONSTRAINT [PersonalDetails_createdAt_df] DEFAULT CURRENT_TIMESTAMP,
    [updatedAt] DATETIME2 NOT NULL,
    CONSTRAINT [PersonalDetails_pkey] PRIMARY KEY CLUSTERED ([id] ASC),
    CONSTRAINT [PersonalDetails_employeeId_key] UNIQUE NONCLUSTERED ([employeeId] ASC)
);

-- CreateTable
CREATE TABLE [dbo].[PfRate] (
    [id] INT NOT NULL IDENTITY(1,1),
    [code] NVARCHAR(20) NOT NULL,
    [employeeContributionRate] DECIMAL(5,2) NOT NULL,
    [employerContributionRate] DECIMAL(5,2) NOT NULL,
    [pensionContributionRate] DECIMAL(5,2),
    [wageCeilingMonthly] DECIMAL(18,2) NOT NULL,
    [effectiveFrom] DATETIME2 NOT NULL,
    [effectiveTo] DATETIME2,
    [isActive] BIT NOT NULL CONSTRAINT [PfRate_isActive_df] DEFAULT 1,
    [createdAt] DATETIME2 NOT NULL CONSTRAINT [PfRate_createdAt_df] DEFAULT CURRENT_TIMESTAMP,
    [updatedAt] DATETIME2 NOT NULL,
    CONSTRAINT [PfRate_pkey] PRIMARY KEY CLUSTERED ([id] ASC)
);

-- CreateTable
CREATE TABLE [dbo].[ProfessionalTaxSlab] (
    [id] INT NOT NULL IDENTITY(1,1),
    [code] NVARCHAR(20) NOT NULL,
    [minSalary] DECIMAL(18,2) NOT NULL,
    [maxSalary] DECIMAL(18,2),
    [monthlyAmount] DECIMAL(18,2) NOT NULL,
    [effectiveFrom] DATETIME2 NOT NULL,
    [effectiveTo] DATETIME2,
    [isActive] BIT NOT NULL CONSTRAINT [ProfessionalTaxSlab_isActive_df] DEFAULT 1,
    [createdAt] DATETIME2 NOT NULL CONSTRAINT [ProfessionalTaxSlab_createdAt_df] DEFAULT CURRENT_TIMESTAMP,
    [updatedAt] DATETIME2 NOT NULL,
    CONSTRAINT [ProfessionalTaxSlab_pkey] PRIMARY KEY CLUSTERED ([id] ASC)
);

-- CreateTable
CREATE TABLE [dbo].[Role] (
    [id] INT NOT NULL IDENTITY(1,1),
    [code] NVARCHAR(20) NOT NULL,
    [name] NVARCHAR(100) NOT NULL,
    [description] NVARCHAR(500),
    [isActive] BIT NOT NULL CONSTRAINT [Role_isActive_df] DEFAULT 1,
    [deletedAt] DATETIME2,
    [createdAt] DATETIME2 NOT NULL CONSTRAINT [Role_createdAt_df] DEFAULT CURRENT_TIMESTAMP,
    [updatedAt] DATETIME2 NOT NULL,
    CONSTRAINT [Role_pkey] PRIMARY KEY CLUSTERED ([id] ASC),
    CONSTRAINT [Role_code_key] UNIQUE NONCLUSTERED ([code] ASC)
);

-- CreateTable
CREATE TABLE [dbo].[RolePermission] (
    [id] INT NOT NULL IDENTITY(1,1),
    [roleId] INT NOT NULL,
    [permissionId] INT NOT NULL,
    [createdAt] DATETIME2 NOT NULL CONSTRAINT [RolePermission_createdAt_df] DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT [RolePermission_pkey] PRIMARY KEY CLUSTERED ([id] ASC),
    CONSTRAINT [RolePermission_roleId_permissionId_key] UNIQUE NONCLUSTERED ([roleId] ASC,[permissionId] ASC)
);

-- CreateTable
CREATE TABLE [dbo].[SalaryStructure] (
    [id] INT NOT NULL IDENTITY(1,1),
    [employeeId] INT NOT NULL,
    [basic] DECIMAL(18,2) NOT NULL,
    [hra] DECIMAL(18,2) NOT NULL,
    [conveyanceAllowance] DECIMAL(18,2) NOT NULL CONSTRAINT [SalaryStructure_conveyanceAllowance_df] DEFAULT 0,
    [medicalAllowance] DECIMAL(18,2) NOT NULL CONSTRAINT [SalaryStructure_medicalAllowance_df] DEFAULT 0,
    [specialAllowance] DECIMAL(18,2) NOT NULL CONSTRAINT [SalaryStructure_specialAllowance_df] DEFAULT 0,
    [otherAllowance] DECIMAL(18,2) NOT NULL CONSTRAINT [SalaryStructure_otherAllowance_df] DEFAULT 0,
    [pfApplicable] BIT NOT NULL CONSTRAINT [SalaryStructure_pfApplicable_df] DEFAULT 1,
    [esiApplicable] BIT NOT NULL CONSTRAINT [SalaryStructure_esiApplicable_df] DEFAULT 0,
    [monthlyCtc] DECIMAL(18,2) NOT NULL,
    [annualCtc] DECIMAL(18,2) NOT NULL,
    [effectiveFrom] DATETIME2 NOT NULL,
    [effectiveTo] DATETIME2,
    [createdAt] DATETIME2 NOT NULL CONSTRAINT [SalaryStructure_createdAt_df] DEFAULT CURRENT_TIMESTAMP,
    [updatedAt] DATETIME2 NOT NULL,
    CONSTRAINT [SalaryStructure_pkey] PRIMARY KEY CLUSTERED ([id] ASC)
);

-- CreateTable
CREATE TABLE [dbo].[ShiftMaster] (
    [id] INT NOT NULL IDENTITY(1,1),
    [code] NVARCHAR(20) NOT NULL,
    [name] NVARCHAR(100) NOT NULL,
    [startTime] NVARCHAR(8) NOT NULL,
    [endTime] NVARCHAR(8) NOT NULL,
    [graceMinutes] INT NOT NULL CONSTRAINT [ShiftMaster_graceMinutes_df] DEFAULT 0,
    [description] NVARCHAR(500),
    [isActive] BIT NOT NULL CONSTRAINT [ShiftMaster_isActive_df] DEFAULT 1,
    [deletedAt] DATETIME2,
    [createdAt] DATETIME2 NOT NULL CONSTRAINT [ShiftMaster_createdAt_df] DEFAULT CURRENT_TIMESTAMP,
    [updatedAt] DATETIME2 NOT NULL,
    CONSTRAINT [ShiftMaster_pkey] PRIMARY KEY CLUSTERED ([id] ASC),
    CONSTRAINT [ShiftMaster_code_key] UNIQUE NONCLUSTERED ([code] ASC)
);

-- CreateTable
CREATE TABLE [dbo].[ShiftPlan] (
    [id] INT NOT NULL IDENTITY(1,1),
    [shiftMasterId] INT NOT NULL,
    [code] NVARCHAR(20) NOT NULL,
    [name] NVARCHAR(100) NOT NULL,
    [startTime] NVARCHAR(8),
    [endTime] NVARCHAR(8),
    [description] NVARCHAR(500),
    [isActive] BIT NOT NULL CONSTRAINT [ShiftPlan_isActive_df] DEFAULT 1,
    [deletedAt] DATETIME2,
    [createdAt] DATETIME2 NOT NULL CONSTRAINT [ShiftPlan_createdAt_df] DEFAULT CURRENT_TIMESTAMP,
    [updatedAt] DATETIME2 NOT NULL,
    CONSTRAINT [ShiftPlan_pkey] PRIMARY KEY CLUSTERED ([id] ASC),
    CONSTRAINT [ShiftPlan_code_key] UNIQUE NONCLUSTERED ([code] ASC)
);

-- CreateTable
CREATE TABLE [dbo].[SubDepartment] (
    [id] INT NOT NULL IDENTITY(1,1),
    [departmentId] INT NOT NULL,
    [code] NVARCHAR(20) NOT NULL,
    [name] NVARCHAR(100) NOT NULL,
    [description] NVARCHAR(500),
    [isActive] BIT NOT NULL CONSTRAINT [SubDepartment_isActive_df] DEFAULT 1,
    [deletedAt] DATETIME2,
    [createdAt] DATETIME2 NOT NULL CONSTRAINT [SubDepartment_createdAt_df] DEFAULT CURRENT_TIMESTAMP,
    [updatedAt] DATETIME2 NOT NULL,
    CONSTRAINT [SubDepartment_pkey] PRIMARY KEY CLUSTERED ([id] ASC),
    CONSTRAINT [SubDepartment_code_key] UNIQUE NONCLUSTERED ([code] ASC)
);

-- CreateTable
CREATE TABLE [dbo].[TDSSlab] (
    [id] INT NOT NULL IDENTITY(1,1),
    [code] NVARCHAR(20) NOT NULL,
    [minSalary] DECIMAL(18,2) NOT NULL,
    [maxSalary] DECIMAL(18,2),
    [ratePercent] DECIMAL(5,2) NOT NULL,
    [effectiveFrom] DATETIME2 NOT NULL,
    [effectiveTo] DATETIME2,
    [isActive] BIT NOT NULL CONSTRAINT [TDSSlab_isActive_df] DEFAULT 1,
    [createdAt] DATETIME2 NOT NULL CONSTRAINT [TDSSlab_createdAt_df] DEFAULT CURRENT_TIMESTAMP,
    [updatedAt] DATETIME2 NOT NULL,
    CONSTRAINT [TDSSlab_pkey] PRIMARY KEY CLUSTERED ([id] ASC)
);

-- CreateTable
CREATE TABLE [dbo].[Unit] (
    [id] INT NOT NULL IDENTITY(1,1),
    [code] NVARCHAR(20) NOT NULL,
    [name] NVARCHAR(100) NOT NULL,
    [description] NVARCHAR(500),
    [isActive] BIT NOT NULL CONSTRAINT [Unit_isActive_df] DEFAULT 1,
    [deletedAt] DATETIME2,
    [createdAt] DATETIME2 NOT NULL CONSTRAINT [Unit_createdAt_df] DEFAULT CURRENT_TIMESTAMP,
    [updatedAt] DATETIME2 NOT NULL,
    CONSTRAINT [Unit_pkey] PRIMARY KEY CLUSTERED ([id] ASC),
    CONSTRAINT [Unit_code_key] UNIQUE NONCLUSTERED ([code] ASC)
);

-- CreateTable
CREATE TABLE [dbo].[User] (
    [id] INT NOT NULL IDENTITY(1,1),
    [email] NVARCHAR(100) NOT NULL,
    [passwordHash] NVARCHAR(255) NOT NULL,
    [roleId] INT NOT NULL,
    [isActive] BIT NOT NULL CONSTRAINT [User_isActive_df] DEFAULT 1,
    [deletedAt] DATETIME2,
    [createdAt] DATETIME2 NOT NULL CONSTRAINT [User_createdAt_df] DEFAULT CURRENT_TIMESTAMP,
    [updatedAt] DATETIME2 NOT NULL,
    CONSTRAINT [User_pkey] PRIMARY KEY CLUSTERED ([id] ASC),
    CONSTRAINT [User_email_key] UNIQUE NONCLUSTERED ([email] ASC)
);

-- CreateIndex
CREATE NONCLUSTERED INDEX [DropdownMaster_category_idx] ON [dbo].[DropdownMaster]([category] ASC);

-- CreateIndex
CREATE NONCLUSTERED INDEX [Employee_reportingManagerId_idx] ON [dbo].[Employee]([reportingManagerId] ASC);

-- CreateIndex
CREATE NONCLUSTERED INDEX [Employee_status_idx] ON [dbo].[Employee]([status] ASC);

-- CreateIndex
CREATE NONCLUSTERED INDEX [EmployeeAssetAllocation_assetMasterId_idx] ON [dbo].[EmployeeAssetAllocation]([assetMasterId] ASC);

-- CreateIndex
CREATE NONCLUSTERED INDEX [EmployeeAssetAllocation_employeeId_idx] ON [dbo].[EmployeeAssetAllocation]([employeeId] ASC);

-- CreateIndex
CREATE NONCLUSTERED INDEX [EmployeeDependent_employeeId_idx] ON [dbo].[EmployeeDependent]([employeeId] ASC);

-- CreateIndex
CREATE NONCLUSTERED INDEX [EmployeeDocument_docType_idx] ON [dbo].[EmployeeDocument]([docType] ASC);

-- CreateIndex
CREATE NONCLUSTERED INDEX [EmployeeDocument_employeeId_idx] ON [dbo].[EmployeeDocument]([employeeId] ASC);

-- CreateIndex
CREATE NONCLUSTERED INDEX [EmployeeDocument_expiryDate_idx] ON [dbo].[EmployeeDocument]([expiryDate] ASC);

-- CreateIndex
CREATE NONCLUSTERED INDEX [EmployeeEducation_employeeId_idx] ON [dbo].[EmployeeEducation]([employeeId] ASC);

-- CreateIndex
CREATE NONCLUSTERED INDEX [EmployeeExperience_employeeId_idx] ON [dbo].[EmployeeExperience]([employeeId] ASC);

-- CreateIndex
CREATE NONCLUSTERED INDEX [EsiRate_code_idx] ON [dbo].[EsiRate]([code] ASC);

-- CreateIndex
CREATE NONCLUSTERED INDEX [EsiRate_effectiveFrom_effectiveTo_idx] ON [dbo].[EsiRate]([effectiveFrom] ASC, [effectiveTo] ASC);

-- CreateIndex
CREATE NONCLUSTERED INDEX [JobInfo_departmentId_idx] ON [dbo].[JobInfo]([departmentId] ASC);

-- CreateIndex
CREATE NONCLUSTERED INDEX [JobInfo_designationId_idx] ON [dbo].[JobInfo]([designationId] ASC);

-- CreateIndex
CREATE NONCLUSTERED INDEX [JobInfo_effectiveFrom_effectiveTo_idx] ON [dbo].[JobInfo]([effectiveFrom] ASC, [effectiveTo] ASC);

-- CreateIndex
CREATE NONCLUSTERED INDEX [JobInfo_employeeId_idx] ON [dbo].[JobInfo]([employeeId] ASC);

-- CreateIndex
CREATE NONCLUSTERED INDEX [Permission_module_submodule_page_idx] ON [dbo].[Permission]([module] ASC, [submodule] ASC, [page] ASC);

-- CreateIndex
CREATE NONCLUSTERED INDEX [PfRate_code_idx] ON [dbo].[PfRate]([code] ASC);

-- CreateIndex
CREATE NONCLUSTERED INDEX [PfRate_effectiveFrom_effectiveTo_idx] ON [dbo].[PfRate]([effectiveFrom] ASC, [effectiveTo] ASC);

-- CreateIndex
CREATE NONCLUSTERED INDEX [ProfessionalTaxSlab_code_idx] ON [dbo].[ProfessionalTaxSlab]([code] ASC);

-- CreateIndex
CREATE NONCLUSTERED INDEX [ProfessionalTaxSlab_effectiveFrom_effectiveTo_idx] ON [dbo].[ProfessionalTaxSlab]([effectiveFrom] ASC, [effectiveTo] ASC);

-- CreateIndex
CREATE NONCLUSTERED INDEX [RolePermission_permissionId_idx] ON [dbo].[RolePermission]([permissionId] ASC);

-- CreateIndex
CREATE NONCLUSTERED INDEX [SalaryStructure_effectiveFrom_effectiveTo_idx] ON [dbo].[SalaryStructure]([effectiveFrom] ASC, [effectiveTo] ASC);

-- CreateIndex
CREATE NONCLUSTERED INDEX [SalaryStructure_employeeId_idx] ON [dbo].[SalaryStructure]([employeeId] ASC);

-- CreateIndex
CREATE NONCLUSTERED INDEX [ShiftPlan_shiftMasterId_idx] ON [dbo].[ShiftPlan]([shiftMasterId] ASC);

-- CreateIndex
CREATE NONCLUSTERED INDEX [SubDepartment_departmentId_idx] ON [dbo].[SubDepartment]([departmentId] ASC);

-- CreateIndex
CREATE NONCLUSTERED INDEX [TDSSlab_code_idx] ON [dbo].[TDSSlab]([code] ASC);

-- CreateIndex
CREATE NONCLUSTERED INDEX [TDSSlab_effectiveFrom_effectiveTo_idx] ON [dbo].[TDSSlab]([effectiveFrom] ASC, [effectiveTo] ASC);

-- CreateIndex
CREATE NONCLUSTERED INDEX [User_roleId_idx] ON [dbo].[User]([roleId] ASC);

-- AddForeignKey
ALTER TABLE [dbo].[Employee] ADD CONSTRAINT [Employee_reportingManagerId_fkey] FOREIGN KEY ([reportingManagerId]) REFERENCES [dbo].[Employee]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[EmployeeAssetAllocation] ADD CONSTRAINT [EmployeeAssetAllocation_assetMasterId_fkey] FOREIGN KEY ([assetMasterId]) REFERENCES [dbo].[AssetMaster]([id]) ON DELETE NO ACTION ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE [dbo].[EmployeeAssetAllocation] ADD CONSTRAINT [EmployeeAssetAllocation_employeeId_fkey] FOREIGN KEY ([employeeId]) REFERENCES [dbo].[Employee]([id]) ON DELETE NO ACTION ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE [dbo].[EmployeeBankDetail] ADD CONSTRAINT [EmployeeBankDetail_employeeId_fkey] FOREIGN KEY ([employeeId]) REFERENCES [dbo].[Employee]([id]) ON DELETE NO ACTION ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE [dbo].[EmployeeDependent] ADD CONSTRAINT [EmployeeDependent_employeeId_fkey] FOREIGN KEY ([employeeId]) REFERENCES [dbo].[Employee]([id]) ON DELETE NO ACTION ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE [dbo].[EmployeeDocument] ADD CONSTRAINT [EmployeeDocument_employeeId_fkey] FOREIGN KEY ([employeeId]) REFERENCES [dbo].[Employee]([id]) ON DELETE NO ACTION ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE [dbo].[EmployeeEducation] ADD CONSTRAINT [EmployeeEducation_employeeId_fkey] FOREIGN KEY ([employeeId]) REFERENCES [dbo].[Employee]([id]) ON DELETE NO ACTION ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE [dbo].[EmployeeExperience] ADD CONSTRAINT [EmployeeExperience_employeeId_fkey] FOREIGN KEY ([employeeId]) REFERENCES [dbo].[Employee]([id]) ON DELETE NO ACTION ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE [dbo].[ExitInterview] ADD CONSTRAINT [ExitInterview_employeeId_fkey] FOREIGN KEY ([employeeId]) REFERENCES [dbo].[Employee]([id]) ON DELETE NO ACTION ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE [dbo].[JobInfo] ADD CONSTRAINT [JobInfo_categoryId_fkey] FOREIGN KEY ([categoryId]) REFERENCES [dbo].[Category]([id]) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE [dbo].[JobInfo] ADD CONSTRAINT [JobInfo_departmentId_fkey] FOREIGN KEY ([departmentId]) REFERENCES [dbo].[Department]([id]) ON DELETE NO ACTION ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE [dbo].[JobInfo] ADD CONSTRAINT [JobInfo_designationId_fkey] FOREIGN KEY ([designationId]) REFERENCES [dbo].[Designation]([id]) ON DELETE NO ACTION ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE [dbo].[JobInfo] ADD CONSTRAINT [JobInfo_employeeId_fkey] FOREIGN KEY ([employeeId]) REFERENCES [dbo].[Employee]([id]) ON DELETE NO ACTION ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE [dbo].[JobInfo] ADD CONSTRAINT [JobInfo_employeeTypeId_fkey] FOREIGN KEY ([employeeTypeId]) REFERENCES [dbo].[EmployeeType]([id]) ON DELETE NO ACTION ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE [dbo].[JobInfo] ADD CONSTRAINT [JobInfo_gradeId_fkey] FOREIGN KEY ([gradeId]) REFERENCES [dbo].[Grade]([id]) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE [dbo].[JobInfo] ADD CONSTRAINT [JobInfo_levelId_fkey] FOREIGN KEY ([levelId]) REFERENCES [dbo].[Level]([id]) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE [dbo].[JobInfo] ADD CONSTRAINT [JobInfo_shiftMasterId_fkey] FOREIGN KEY ([shiftMasterId]) REFERENCES [dbo].[ShiftMaster]([id]) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE [dbo].[JobInfo] ADD CONSTRAINT [JobInfo_shiftPlanId_fkey] FOREIGN KEY ([shiftPlanId]) REFERENCES [dbo].[ShiftPlan]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[JobInfo] ADD CONSTRAINT [JobInfo_subDepartmentId_fkey] FOREIGN KEY ([subDepartmentId]) REFERENCES [dbo].[SubDepartment]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[JobInfo] ADD CONSTRAINT [JobInfo_unitId_fkey] FOREIGN KEY ([unitId]) REFERENCES [dbo].[Unit]([id]) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE [dbo].[PersonalDetails] ADD CONSTRAINT [PersonalDetails_employeeId_fkey] FOREIGN KEY ([employeeId]) REFERENCES [dbo].[Employee]([id]) ON DELETE NO ACTION ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE [dbo].[RolePermission] ADD CONSTRAINT [RolePermission_permissionId_fkey] FOREIGN KEY ([permissionId]) REFERENCES [dbo].[Permission]([id]) ON DELETE NO ACTION ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE [dbo].[RolePermission] ADD CONSTRAINT [RolePermission_roleId_fkey] FOREIGN KEY ([roleId]) REFERENCES [dbo].[Role]([id]) ON DELETE NO ACTION ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE [dbo].[SalaryStructure] ADD CONSTRAINT [SalaryStructure_employeeId_fkey] FOREIGN KEY ([employeeId]) REFERENCES [dbo].[Employee]([id]) ON DELETE NO ACTION ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE [dbo].[ShiftPlan] ADD CONSTRAINT [ShiftPlan_shiftMasterId_fkey] FOREIGN KEY ([shiftMasterId]) REFERENCES [dbo].[ShiftMaster]([id]) ON DELETE NO ACTION ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE [dbo].[SubDepartment] ADD CONSTRAINT [SubDepartment_departmentId_fkey] FOREIGN KEY ([departmentId]) REFERENCES [dbo].[Department]([id]) ON DELETE NO ACTION ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE [dbo].[User] ADD CONSTRAINT [User_roleId_fkey] FOREIGN KEY ([roleId]) REFERENCES [dbo].[Role]([id]) ON DELETE NO ACTION ON UPDATE CASCADE;

COMMIT TRAN;

END TRY
BEGIN CATCH

IF @@TRANCOUNT > 0
BEGIN
    ROLLBACK TRAN;
END;
THROW

END CATCH

