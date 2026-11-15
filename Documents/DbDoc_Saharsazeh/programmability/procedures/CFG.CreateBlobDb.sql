/************************************************************
 * Code formatted by SoftTree SQL Assistant © v9.5.444
 * Time: 4/15/2019 11:26:46 AM
 ************************************************************/

CREATE PROCEDURE [CFG].[CreateBlobDb](@DbName VARCHAR(100))
AS

	DECLARE @Query NVARCHAR(MAX),@DbFolder NVARCHAR(MAX)
	
	
	SELECT  TOP 1  @DbFolder=
	REVERSE(RIGHT(REVERSE(FileName),(LEN(FileName)-CHARINDEX('\', REVERSE(FileName),1))+1))  FROM sysfiles AS s
	
	if DB_ID(@DbName) IS NOT NULL
	BEGIN
		return
	END
	
	SET @Query = 
	    '
	    CREATE DATABASE [{0}] ON  PRIMARY 
            ( NAME = N''{0}'', FILENAME = N''{1}\{0}.mdf'',
                        FILEGROWTH = 262144KB 
                ),
            LOG ON 
            ( NAME = N''{0}_log'', FILENAME = N''{1}\{0}_log.ldf'',
                SIZE = 1024KB , FILEGROWTH = 10%
            )
            GO

    use [{0}]
	    
	    
	CREATE SCHEMA [CFG]
GO


/****** Object:  Table [CFG].[JsonLog]    Script Date: 4/10/2019 12:08:43 PM ******/
SET ANSI_NULLS ON
GO

SET QUOTED_IDENTIFIER ON
GO

CREATE TABLE [CFG].[JsonLog]
(
	[Id]                [bigint] IDENTITY(1, 1) NOT NULL,
	[TableId]           [int] NOT NULL,
	[ApplyDate]         [datetime] NOT NULL,
	[UserId]            [int] NOT NULL,
	[TransactionID]     [bigint] NOT NULL,
	[OperationType]     [tinyint] NOT NULL,
	[ComputerName]      [varchar](256) NOT NULL,
	CONSTRAINT [PK_JsonLog] PRIMARY KEY NONCLUSTERED([Id] ASC)WITH (
	    PAD_INDEX = OFF,
	    STATISTICS_NORECOMPUTE = OFF,
	    IGNORE_DUP_KEY = OFF,
	    ALLOW_ROW_LOCKS = ON,
	    ALLOW_PAGE_LOCKS = ON
	) ON [PRIMARY]
) ON [PRIMARY]
GO

/****** Object:  Table [CFG].[JsonLogItem]    Script Date: 4/10/2019 12:08:44 PM ******/
SET ANSI_NULLS ON
GO

SET QUOTED_IDENTIFIER ON
GO

CREATE TABLE [CFG].[JsonLogItem]
(
	[Id]                [bigint] IDENTITY(1, 1) NOT NULL,
	[JsonLogId]         [bigint] NOT NULL,
	[Value]             [nvarchar](4000) NULL,
	[EntityID]          [bigint] NOT NULL,
	[OperationType]     [tinyint] NOT NULL,
	CONSTRAINT [PK_JsonLogItem] PRIMARY KEY NONCLUSTERED([Id] ASC)WITH (
	    PAD_INDEX = OFF,
	    STATISTICS_NORECOMPUTE = OFF,
	    IGNORE_DUP_KEY = OFF,
	    ALLOW_ROW_LOCKS = ON,
	    ALLOW_PAGE_LOCKS = ON
	) ON [PRIMARY]
) ON [PRIMARY]
GO




ALTER TABLE [CFG].[JsonLogItem]  
WITH CHECK ADD CONSTRAINT [FK_JsonLogItem_JsonLog] FOREIGN KEY([JsonLogId])
     REFERENCES [CFG].[JsonLog] ([Id])
GO

ALTER TABLE [CFG].[JsonLogItem] CHECK CONSTRAINT [FK_JsonLogItem_JsonLog]
GO


/****** Object:  Table [CFG].[FileAttachment]    Script Date: 4/10/2019 12:11:38 PM ******/
SET ANSI_NULLS ON
GO

SET QUOTED_IDENTIFIER ON
GO

CREATE TABLE [CFG].[FileAttachment]
(
	[FileAttachmentID]     [int] IDENTITY(1, 1) NOT NULL,
	[MetaDataEntityID]     [int] NOT NULL,
	[Date]                 [date] NULL,
	[Description]          [nvarchar](MAX) NULL,
	[Description2]         [nvarchar](MAX) NULL,
	[FileName]             [nvarchar](300) NULL,
	[FileContent]          [varbinary](MAX) NULL,
	[Version]              [int] NOT NULL,
	[Creator]              [int] NOT NULL,
	[CreationDate]         [datetime] NOT NULL,
	[LastEditor]           [int] NOT NULL,
	[LastEditionDate]      [datetime] NOT NULL,
	[EntityRelatedID]      [int] NOT NULL,
	CONSTRAINT [PK__Attachme] PRIMARY KEY CLUSTERED([FileAttachmentID] ASC)WITH (
	    PAD_INDEX = OFF,
	    STATISTICS_NORECOMPUTE = OFF,
	    IGNORE_DUP_KEY = OFF,
	    ALLOW_ROW_LOCKS = ON,
	    ALLOW_PAGE_LOCKS = ON
	)
) ON [PRIMARY]
GO '
	
	
	
	SET @Query= REPLACE (@Query,'{0}',@DbName)
	SET @Query= REPLACE (@Query,'{1}',@DbFolder)
	
	SELECT @Query
--	EXEC @Query











