-- Create ERP_USER table in suki_tools_management
-- Run against: suki_tools_management

USE suki_tools_management;
GO

IF EXISTS (SELECT * FROM sys.tables WHERE name = 'ERP_USER')
    DROP TABLE dbo.ERP_USER;
GO

CREATE TABLE dbo.ERP_USER (
    USER_ID       VARCHAR(20)  NOT NULL,
    ROLE_NAME     VARCHAR(50)  NOT NULL,
    ADD_ROLE_NAME VARCHAR(50)  NULL,
    EMP_CD        VARCHAR(20)  NULL,
    IS_ACTIVE     BIT          NOT NULL DEFAULT 1,
    CONSTRAINT PK_ERP_USER PRIMARY KEY (USER_ID)
);
GO
