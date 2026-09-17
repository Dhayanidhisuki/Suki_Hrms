-- Registered address + contact on Company, printed on the letterhead of every
-- generated document. Replaces a hard-coded KUN address constant and a regex
-- that sniffed Company.description for something address-shaped.
--
-- Additive and nullable: existing rows keep working, and formatCompanyAddress()
-- falls back to description when these are empty.

IF COL_LENGTH('Company', 'addressLine1') IS NULL
  ALTER TABLE [Company] ADD [addressLine1] NVARCHAR(150) NULL;
IF COL_LENGTH('Company', 'addressLine2') IS NULL
  ALTER TABLE [Company] ADD [addressLine2] NVARCHAR(150) NULL;
IF COL_LENGTH('Company', 'city') IS NULL
  ALTER TABLE [Company] ADD [city] NVARCHAR(60) NULL;
IF COL_LENGTH('Company', 'state') IS NULL
  ALTER TABLE [Company] ADD [state] NVARCHAR(60) NULL;
IF COL_LENGTH('Company', 'pincode') IS NULL
  ALTER TABLE [Company] ADD [pincode] NVARCHAR(10) NULL;
IF COL_LENGTH('Company', 'phone') IS NULL
  ALTER TABLE [Company] ADD [phone] NVARCHAR(30) NULL;
IF COL_LENGTH('Company', 'email') IS NULL
  ALTER TABLE [Company] ADD [email] NVARCHAR(120) NULL;

-- Seed the one address the system previously hard-coded, so KUN letterheads
-- keep printing the same address they did before this migration. Only where
-- the field is still empty — never overwrite what an admin has entered.
EXEC(N'
UPDATE [Company]
SET [addressLine1] = N''Plot No. 22 & 23, Ambattur Industrial Estate'',
    [city]         = N''Chennai'',
    [state]        = N''Tamil Nadu'',
    [pincode]      = N''600058''
WHERE [addressLine1] IS NULL
  AND ([code] LIKE N''%KUN%'' OR [name] LIKE N''%KUN%'');
');
