CREATE TABLE [dbo].[EmployeeDeductionExclusion] (
    [id] INT NOT NULL IDENTITY(1,1),
    [employeeId] INT NOT NULL,
    [deductionCode] NVARCHAR(20) NOT NULL,
    [createdAt] DATETIME2 NOT NULL CONSTRAINT [DF_EmployeeDeductionExclusion_createdAt] DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT [PK_EmployeeDeductionExclusion] PRIMARY KEY ([id])
);

ALTER TABLE [dbo].[EmployeeDeductionExclusion]
  ADD CONSTRAINT [EmployeeDeductionExclusion_employeeId_deductionCode_key] UNIQUE ([employeeId], [deductionCode]);

ALTER TABLE [dbo].[EmployeeDeductionExclusion]
  ADD CONSTRAINT [EmployeeDeductionExclusion_employeeId_fkey] FOREIGN KEY ([employeeId]) REFERENCES [dbo].[Employee]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;
