CREATE PROC [FOS].[spLadingTypeInsert] 
    @Code int,
    @Title nvarchar(250),
    @Title2 nvarchar(250),
    @SlID int,
    @Creator int,
    @CreationDate datetime
AS 
	SET NOCOUNT ON 

	
	INSERT INTO [FOS].[LadingType] ([Code], [Title], [Title2], [SlID], [Version], [Creator], [CreationDate], [LastEditor], [LastEditionDate])
	SELECT @Code, @Title, @Title2, @SlID, 0, @Creator, @CreationDate, @Creator, @CreationDate
	
	-- Begin Return Select <- do not remove
	SELECT [LadingTypeID], [Version]
	FROM   [FOS].[LadingType]
	WHERE  [LadingTypeID] = SCOPE_IDENTITY()
	-- End Return Select <- do not remove
               

