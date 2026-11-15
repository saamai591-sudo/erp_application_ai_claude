CREATE PROCEDURE [CFG].[TransferAttachementToAttachementDb]
AS
BEGIN
	DECLARE @DbName VARCHAR(512)
	
	SELECT @DbName = c.ConfigValue
	FROM   cfg.Configuration AS c
	WHERE  c.ConfigKey = 'AttachmentDB'
	
	IF @DbName IS NULL
	   OR @DbName = ''
	   OR @DbName = DB_NAME()
	BEGIN
		PRINT 'Is Equal'
	    RETURN 0
	END
	
	SET @DbName =  QUOTENAME(@DbName)
	
	DECLARE @Query NVARCHAR(MAX)
	
	SET @Query=N'
	SET IDENTITY_INSERT '+@DbName+'.[CFG].[FileAttachment] ON
	
	INSERT INTO '+@DbName+'.cfg.FileAttachment
	  (
	    FileAttachmentID ,
		MetaDataEntityID,
		[Date],
		[Description],
		Description2,
		[FileName],
		FileContent,
		Version,
		Creator,
		CreationDate,
		LastEditor,
		LastEditionDate,
		EntityRelatedID,
		FileAttachmentTypeID
	  )
	SELECT FileAttachmentID ,
	MetaDataEntityID,
	[Date],
	[Description],
	Description2,
	[FileName],
	FileContent,
	Version,
	Creator,
	CreationDate,
	LastEditor,
	LastEditionDate,
	EntityRelatedID,
	FileAttachmentTypeID
	FROM   cfg.FileAttachment 
	
	SET IDENTITY_INSERT '+@DbName+'.[CFG].[FileAttachment] OFF
	
	TRUNCATE TABLE [CFG].[FileAttachment]
	'
	
	EXEC  (@Query)

END
