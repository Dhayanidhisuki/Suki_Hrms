-- Adds per-allocation instance details to EmployeeAssetAllocation: serialNumber,
-- model, assetValue, expectedReturnDate. AssetMaster stays a category-level
-- catalog (e.g. "Laptop"); these columns capture the specific physical unit
-- handed to an employee. Purely additive, all nullable.
--
-- NOTE: spurious `Employee_userId_key` plain UNIQUE CONSTRAINT line from
-- `prisma migrate diff` intentionally excluded — see migration 000002's note.

ALTER TABLE [dbo].[EmployeeAssetAllocation] ADD [serialNumber] NVARCHAR(50);
ALTER TABLE [dbo].[EmployeeAssetAllocation] ADD [model] NVARCHAR(100);
ALTER TABLE [dbo].[EmployeeAssetAllocation] ADD [assetValue] DECIMAL(12,2);
ALTER TABLE [dbo].[EmployeeAssetAllocation] ADD [expectedReturnDate] DATETIME2;
