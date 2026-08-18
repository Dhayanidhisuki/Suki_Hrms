IF COL_LENGTH('dbo.TOOLS_APP_USER', 'email') IS NULL
  ALTER TABLE [dbo].[TOOLS_APP_USER] ADD [email] NVARCHAR(150) NULL;

IF NOT EXISTS (
  SELECT 1 FROM sys.indexes
  WHERE [name] = 'TOOLS_APP_USER_email_unique'
    AND [object_id] = OBJECT_ID('dbo.TOOLS_APP_USER')
)
  EXEC(N'CREATE UNIQUE INDEX [TOOLS_APP_USER_email_unique]
    ON [dbo].[TOOLS_APP_USER]([email]) WHERE [email] IS NOT NULL');

IF NOT EXISTS (SELECT 1 FROM [dbo].[TOOLS_APP_MODULE] WHERE [MODULE_KEY] = 'email_notifications')
  INSERT INTO [dbo].[TOOLS_APP_MODULE]
    ([MODULE_KEY], [MODULE_LABEL], [MODULE_GROUP], [APPLICABLE_ACTIONS], [IS_BUILT], [CREATED_AT], [UPDATED_AT])
  VALUES
    ('email_notifications', 'Email Notifications', 'Notifications', 'RECEIVE_EMAIL', 1, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP);
ELSE
  UPDATE [dbo].[TOOLS_APP_MODULE]
  SET [MODULE_LABEL] = 'Email Notifications',
      [MODULE_GROUP] = 'Notifications',
      [APPLICABLE_ACTIONS] = 'RECEIVE_EMAIL',
      [IS_BUILT] = 1,
      [UPDATED_AT] = CURRENT_TIMESTAMP
  WHERE [MODULE_KEY] = 'email_notifications';
