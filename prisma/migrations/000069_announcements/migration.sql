-- Announcements & internal circulars on the employee portal.
-- KUN MoM 23/June/2025: "Enable announcement notifications on the employee
-- portal (e.g., policy updates, internal circulars)."

-- CreateTable: Announcement
CREATE TABLE [Announcement] (
    [id] INT IDENTITY(1,1) NOT NULL,
    [companyId] INT NOT NULL,
    [title] NVARCHAR(200) NOT NULL,
    [body] NVARCHAR(MAX) NOT NULL,
    [category] NVARCHAR(20) NOT NULL DEFAULT 'GENERAL',
    [priority] NVARCHAR(10) NOT NULL DEFAULT 'NORMAL',
    [status] NVARCHAR(12) NOT NULL DEFAULT 'DRAFT',
    [publishedAt] DATETIME2 NULL,
    [expiresAt] DATETIME2 NULL,
    [createdByUserId] INT NULL,
    [publishedByUserId] INT NULL,
    [deletedAt] DATETIME2 NULL,
    [createdAt] DATETIME2 NOT NULL DEFAULT GETUTCDATE(),
    [updatedAt] DATETIME2 NOT NULL,

    CONSTRAINT [PK_Announcement] PRIMARY KEY ([id])
);

CREATE INDEX [Announcement_companyId_status_publishedAt_idx] ON [Announcement] ([companyId], [status], [publishedAt]);

-- CreateTable: AnnouncementRead
CREATE TABLE [AnnouncementRead] (
    [id] INT IDENTITY(1,1) NOT NULL,
    [announcementId] INT NOT NULL,
    [employeeId] INT NOT NULL,
    [readAt] DATETIME2 NOT NULL DEFAULT GETUTCDATE(),

    CONSTRAINT [PK_AnnouncementRead] PRIMARY KEY ([id])
);

CREATE UNIQUE INDEX [AnnouncementRead_announcementId_employeeId_key] ON [AnnouncementRead] ([announcementId], [employeeId]);
CREATE INDEX [AnnouncementRead_employeeId_idx] ON [AnnouncementRead] ([employeeId]);

ALTER TABLE [AnnouncementRead] ADD CONSTRAINT [FK_AnnouncementRead_announcement] FOREIGN KEY ([announcementId]) REFERENCES [Announcement] ([id]);
ALTER TABLE [AnnouncementRead] ADD CONSTRAINT [FK_AnnouncementRead_employee] FOREIGN KEY ([employeeId]) REFERENCES [Employee] ([id]);

-- Permissions. Permission rows are global (no companyId); grants are per role.
INSERT INTO [Permission] ([code], [module], [submodule], [action], [description], [isActive], [createdAt], [updatedAt])
VALUES ('platform.announcement.view', 'platform', 'announcement', 'view', 'View announcements and circulars', 1, GETUTCDATE(), GETUTCDATE());

INSERT INTO [Permission] ([code], [module], [submodule], [action], [description], [isActive], [createdAt], [updatedAt])
VALUES ('platform.announcement.admin', 'platform', 'announcement', 'admin', 'Create, publish and archive announcements', 1, GETUTCDATE(), GETUTCDATE());

-- Grant view+admin to every company-admin / hr-admin role, view only to
-- hr-viewer — mirroring how platform.notification.* is already granted.
INSERT INTO [RolePermission] ([roleId], [permissionId], [createdAt])
SELECT r.[id], p.[id], GETUTCDATE()
FROM [Role] r
CROSS JOIN [Permission] p
WHERE p.[code] IN ('platform.announcement.view', 'platform.announcement.admin')
  AND r.[code] IN ('company-admin', 'hr-admin')
  AND r.[deletedAt] IS NULL
  AND NOT EXISTS (SELECT 1 FROM [RolePermission] rp WHERE rp.[roleId] = r.[id] AND rp.[permissionId] = p.[id]);

INSERT INTO [RolePermission] ([roleId], [permissionId], [createdAt])
SELECT r.[id], p.[id], GETUTCDATE()
FROM [Role] r
CROSS JOIN [Permission] p
WHERE p.[code] = 'platform.announcement.view'
  AND r.[code] = 'hr-viewer'
  AND r.[deletedAt] IS NULL
  AND NOT EXISTS (SELECT 1 FROM [RolePermission] rp WHERE rp.[roleId] = r.[id] AND rp.[permissionId] = p.[id]);

-- Notification event, one per company, so publishing can fan out through the
-- existing engine. In-app only: the MoM asks for notifications on the portal,
-- not another email blast.
INSERT INTO [NotificationEvent] ([companyId], [code], [name], [moduleCode], [category], [defaultPriority], [inAppEnabled], [emailEnabled], [smsEnabled], [pushEnabled], [isActive], [createdAt], [updatedAt])
SELECT c.[id], 'ANNOUNCEMENT_PUBLISHED', 'Announcement published', 'PLAT', 'INFORMATIONAL', 'NORMAL', 1, 0, 0, 0, 1, GETUTCDATE(), GETUTCDATE()
FROM [Company] c
WHERE NOT EXISTS (
  SELECT 1 FROM [NotificationEvent] e WHERE e.[companyId] = c.[id] AND e.[code] = 'ANNOUNCEMENT_PUBLISHED'
);

-- Matching in-app template. Without an active template every delivery is
-- recorded as FailedNoTemplate and no in-app row is written, so this is not
-- optional. Every placeholder is either supplied by the publisher
-- (Announcement.*) or carries a |default:, except Link.* which the dispatcher
-- treats as optional by policy.
INSERT INTO [NotificationTemplate] ([companyId], [code], [name], [eventCode], [channel], [language], [versionNo], [effectiveFrom], [subject], [bodyText], [status], [createdAt], [updatedAt])
SELECT c.[id], 'ANNOUNCEMENT_PUBLISHED_INAPP', 'Announcement published (in-app)', 'ANNOUNCEMENT_PUBLISHED', 'INAPP', 'en-IN', 1, '2026-01-01',
  '{{Announcement.Category|default:Announcement}}: {{Announcement.Title}}',
  'Dear {{Recipient.FirstName|default:Colleague}},' + CHAR(10) + CHAR(10) +
  '{{Announcement.Title}}' + CHAR(10) + CHAR(10) +
  'Open it on your portal: {{Link.Announcement}}' + CHAR(10) + CHAR(10) +
  'Regards,' + CHAR(10) + '{{Company.Name}}',
  'Active', GETUTCDATE(), GETUTCDATE()
FROM [Company] c
WHERE NOT EXISTS (
  SELECT 1 FROM [NotificationTemplate] t
  WHERE t.[companyId] = c.[id] AND t.[code] = 'ANNOUNCEMENT_PUBLISHED_INAPP' AND t.[versionNo] = 1
);
