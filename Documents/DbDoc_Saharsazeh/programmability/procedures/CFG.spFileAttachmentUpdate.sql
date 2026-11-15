
----------------------------------------[CFG].[spFileAttachmentUpdate]-----------------------------------
CREATE   PROC [CFG].[spFileAttachmentUpdate]
	@FileAttachmentID INT,
	@MetaDataEntityID INT,
	@Date DATE = NULL,
	@Description NVARCHAR(MAX) = NULL,
	@Description2 NVARCHAR(MAX) = NULL,
	@FileName NVARCHAR(300) = NULL,
	@FileContent VARBINARY(MAX) = NULL,
	@Version INT,
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
	
DECLARE @DbName VARCHAR(512)
	
SELECT @DbName = c.ConfigValue
FROM   cfg.Configuration AS c
WHERE  c.ConfigKey = 'AttachmentDB'
	
	IF @DbName IS NULL
	   SET @DbName = ''
	else
	   SET @DbName = Quotename(@DbName) + '.'

	DECLARE @Query NVARCHAR(MAX);

	SELECT @FileAttachmentID AS C0,
		   @MetaDataEntityID AS C1,
		   @Date AS C2,
		   @Description AS C3,
		   @Description2 AS C4,
		   @FileName AS C5,
		   @FileContent AS C6,
		   @Version AS C7,
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
IF @Version <> (
	   SELECT [Version]
	   FROM    ' + @DbName
		  + N'[CFG].[FileAttachment]
	   WHERE  [FileAttachmentID] = @FileAttachmentID
   )
BEGIN
	RAISERROR(''Version mismatch...'', 16, 10)
	RETURN
END

SET @Version = @Version + 1 

UPDATE ' + @DbName
		  + N'[CFG].[FileAttachment]
SET    [MetaDataEntityID] = #T.C1,
	   [Date] = C2,
	   [Description] = C3,
	   [Description2] = C4,
	   [FileName] = C5,
	   [FileContent] = C6,
	   [Version] = C7,
	   [Creator] = C8,
	   [CreationDate] = C9,
	   [LastEditor] = C10,
	   [LastEditionDate] = C11,
	   [EntityRelatedID] = C12,
	   [FileAttachmentTypeID] = C13,
	   [Status] = C14
	   
from ' + @DbName + N'[CFG].[FileAttachment]
Inner join #T on ' + @DbName
		  + N'[CFG].[FileAttachment].FileAttachmentID
=#T.C0
	
		-- Begin Return Select <- do not remove
SELECT [Version]
FROM   ' + @DbName + N'[CFG].[FileAttachment]
WHERE  [FileAttachmentID] = @FileAttachmentID  ';

	PRINT @Query;

	EXECUTE sys.sp_executesql @Query,
							  N'
	@FileAttachmentID int,
	@Version INT',
							  @FileAttachmentID = @FileAttachmentID,
							  @Version = @Version;

-- End Return Select <- do not remove
END;
