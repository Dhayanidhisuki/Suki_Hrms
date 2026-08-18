DECLARE @NotificationModuleId INT = (
  SELECT [MODULE_ID] FROM [dbo].[TOOLS_APP_MODULE] WHERE [MODULE_KEY] = 'email_notifications'
);

IF @NotificationModuleId IS NOT NULL
BEGIN
  INSERT INTO [dbo].[TOOLS_APP_ROLE_PERMISSION_MATRIX] ([ROLE_ID], [MODULE_ID], [ACTION], [ALLOWED])
  SELECT r.[ROLE_ID], @NotificationModuleId, 'RECEIVE_EMAIL', 1
  FROM [dbo].[TOOLS_APP_ROLE] r
  WHERE r.[ROLE_NAME] IN ('Calibration Engineer', 'Quality Engineer', 'Quality Manager')
    AND NOT EXISTS (
      SELECT 1 FROM [dbo].[TOOLS_APP_ROLE_PERMISSION_MATRIX] p
      WHERE p.[ROLE_ID] = r.[ROLE_ID]
        AND p.[MODULE_ID] = @NotificationModuleId
        AND p.[ACTION] = 'RECEIVE_EMAIL'
    );
END;
