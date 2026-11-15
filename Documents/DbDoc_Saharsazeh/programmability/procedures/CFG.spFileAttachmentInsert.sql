
----------------------------------------[CFG].[spFileAttachmentInsert]-----------------------------------
CREATE   PROC [CFG].[spFileAttachmentInsert]
	@MetaDataEntityID INT,
	@Date DATE = NULL,
	@Description NVARCHAR(MAX) = NULL,
	@Description2 NVARCHAR(MAX) = NULL,
	@FileName NVARCHAR(300) = NULL,
	@FileContent VARBINARY(MAX) = NULL,
	@Creator INT,
	@CreationDate DATETIME,
	@LastEditor INT,
	@LastEditionDate DATETIME,
	@EntityRelatedID INT,
	@FileAttachmentTypeID INT = NULL,
	@Status TINYINT
--WITH ENCRYPTION
AS
BEGIN
	SET NOCOUNT ON;

	DECLARE @DbName VARCHAR(512);

	SELECT @DbName = c.ConfigValue
	FROM CFG.Configuration AS c
	WHERE c.ConfigKey = 'AttachmentDB';

	IF @DbName IS NULL
		SET @DbName = '';
	ELSE
		SET @DbName = QUOTENAME(@DbName) + '.';

	DECLARE @Query NVARCHAR(MAX);

	SELECT @MetaDataEntityID AS C1,
		   @Date AS C2,
		   @Description AS C3,
		   @Description2 AS C4,
		   @FileName AS C5,
		   @FileContent AS C6,
		   0 AS C7,
		   @Creator AS C8,
		   @CreationDate AS C9,
		   @LastEditor AS C10,
		   @LastEditionDate AS C11,
		   @EntityRelatedID AS C12,
		   @FileAttachmentTypeID AS C13,
		   @Status AS C14
	INTO #T;

	SET @Query
		= N'
INSERT INTO ' + @DbName
		  + N'[CFG].[FileAttachment]
  (
	[MetaDataEntityID],
	[Date],
	[Description],
	[Description2],
	[FileName],
	[FileContent],
	[Version],
	[Creator],
	[CreationDate],
	[LastEditor],
	[LastEditionDate],
	[EntityRelatedID],
	[FileAttachmentTypeID],
	[Status]
  )
SELECT * from #T
	
	-- Begin Return Select <- do not remove
SELECT [FileAttachmentID],
	   [Version]
FROM   ' + @DbName + N'[CFG].[FileAttachment]
WHERE  [FileAttachmentID] = SCOPE_IDENTITY() ';
	-- End Return Select <- do not remove

	EXECUTE sys.sp_executesql @Query, N'';

END;
