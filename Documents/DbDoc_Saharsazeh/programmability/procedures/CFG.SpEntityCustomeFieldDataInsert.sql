
-----------------------------------------------
CREATE   PROC [CFG].SpEntityCustomeFieldDataInsert
	@EntityCustomeFieldID INT,
	@EntityID DECIMAL(18, 0),
	@Value NVARCHAR(MAX) = NULL,
	@LookupDataItemID INT=NULL,
	@Creator INT,
	@CreationDate DATETIME,
	@LastEditor INT,
	@LastEditionDate DATETIME
--WITH ENCRYPTION
AS 
	SET NOCOUNT ON 
	declare @id int
	INSERT INTO [CFG].[EntityCustomeFieldData]
	  (
		[EntityCustomeFieldID],
		[EntityID],
		[Value],
		LookupDataItemID,
		[Version],
		[Creator],
		[CreationDate],
		[LastEditor],
		[LastEditionDate]
	  )
	SELECT @EntityCustomeFieldID,
		   @EntityID,
		   @Value,
		   @LookupDataItemID,
		   0,
		   @Creator,
		   @CreationDate,
		   @LastEditor,
		   @LastEditionDate
	
	set @id	 =  SCOPE_IDENTITY();

	if object_id('RUL.UserDefiendBusinessRules_EntityCustomeFieldData') is not null 
	exec RUL.UserDefiendBusinessRules_EntityCustomeFieldData @id

		-- Begin Return Select <- do not remove
	SELECT [EntityCustomeFieldDataID],
		   [Version]
	FROM   [CFG].[EntityCustomeFieldData]
	WHERE  [EntityCustomeFieldDataID] = @id;
