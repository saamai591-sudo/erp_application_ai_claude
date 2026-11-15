CREATE   PROC [AST].[SpDestructionItemInsert] 
    @DestructionID int,
    @AssetID int,
    @Creator int,
    @CreationDate datetime,
    @LastEditor int,
    @LastEditionDate datetime 
--WITH ENCRYPTION
AS 
	SET NOCOUNT ON 

	INSERT INTO [AST].[DestructionItem] ([DestructionID], [AssetID], [Version], [Creator], [CreationDate], [LastEditor], [LastEditionDate])
	SELECT @DestructionID, @AssetID, 0, @Creator, @CreationDate, @LastEditor, @LastEditionDate
	
	-- Begin Return Select <- do not remove
	SELECT [DestructionItemID], [Version]
	FROM   [AST].[DestructionItem]
	WHERE  [DestructionItemID] = SCOPE_IDENTITY()
	-- End Return Select <- do not remove
