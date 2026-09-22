-- CreateTable ExpenseReimbursement
CREATE TABLE [dbo].[ExpenseReimbursement] (
    [id] INT NOT NULL IDENTITY(1,1),
    [companyId] INT NOT NULL,
    [employeeId] INT NOT NULL,
    [status] NVARCHAR(20) NOT NULL CONSTRAINT [DF_ExpenseReimbursement_status] DEFAULT 'DRAFT',
    [submissionDate] DATETIME2 NOT NULL CONSTRAINT [DF_ExpenseReimbursement_submissionDate] DEFAULT GETUTCDATE(),
    [purpose] NVARCHAR(100) NOT NULL,
    [description] NVARCHAR(MAX),
    [totalAmount] DECIMAL(18,2) NOT NULL,
    [approvedAmount] DECIMAL(18,2),
    [approvedBy] INT,
    [approvalDate] DATETIME2,
    [rejectionReason] NVARCHAR(500),
    [paymentDate] DATETIME2,
    [createdByUserId] INT,
    [createdAt] DATETIME2 NOT NULL CONSTRAINT [DF_ExpenseReimbursement_createdAt] DEFAULT GETUTCDATE(),
    [updatedAt] DATETIME2 NOT NULL CONSTRAINT [DF_ExpenseReimbursement_updatedAt] DEFAULT GETUTCDATE(),
    [deletedAt] DATETIME2,
    CONSTRAINT [PK_ExpenseReimbursement] PRIMARY KEY CLUSTERED ([id] ASC)
);

-- CreateTable ExpenseReimbursementItem
CREATE TABLE [dbo].[ExpenseReimbursementItem] (
    [id] INT NOT NULL IDENTITY(1,1),
    [expenseReimbursementId] INT NOT NULL,
    [category] NVARCHAR(30) NOT NULL,
    [description] NVARCHAR(500) NOT NULL,
    [amount] DECIMAL(18,2) NOT NULL,
    [receiptDate] DATE NOT NULL,
    [receiptAttachmentPath] NVARCHAR(MAX),
    [createdAt] DATETIME2 NOT NULL CONSTRAINT [DF_ExpenseReimbursementItem_createdAt] DEFAULT GETUTCDATE(),
    [updatedAt] DATETIME2 NOT NULL CONSTRAINT [DF_ExpenseReimbursementItem_updatedAt] DEFAULT GETUTCDATE(),
    CONSTRAINT [PK_ExpenseReimbursementItem] PRIMARY KEY CLUSTERED ([id] ASC),
    CONSTRAINT [FK_ExpenseReimbursementItem_ExpenseReimbursement_expenseReimbursementId] FOREIGN KEY ([expenseReimbursementId]) REFERENCES [dbo].[ExpenseReimbursement] ([id]) ON DELETE CASCADE
);

-- CreateIndex
CREATE NONCLUSTERED INDEX [IX_ExpenseReimbursement_companyId_employeeId_status] ON [dbo].[ExpenseReimbursement] ([companyId] ASC, [employeeId] ASC, [status] ASC);

-- CreateIndex
CREATE NONCLUSTERED INDEX [IX_ExpenseReimbursement_employeeId_submissionDate] ON [dbo].[ExpenseReimbursement] ([employeeId] ASC, [submissionDate] ASC);

-- CreateIndex
CREATE NONCLUSTERED INDEX [IX_ExpenseReimbursement_status] ON [dbo].[ExpenseReimbursement] ([status] ASC);

-- CreateIndex
CREATE NONCLUSTERED INDEX [IX_ExpenseReimbursementItem_expenseReimbursementId] ON [dbo].[ExpenseReimbursementItem] ([expenseReimbursementId] ASC);
