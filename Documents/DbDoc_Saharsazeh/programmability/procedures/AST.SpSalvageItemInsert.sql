

CREATE   PROC [AST].[SpSalvageItemInsert] 
    @SalvageID int,
    @AssetID int,
	@Description nvarchar(1024) = NULL,
	@Description2 nvarchar(1024) = NULL,
    @Creator int,
    @CreationDate datetime
--WITH ENCRYPTION
AS 
SET NOCOUNT ON

	INSERT INTO [AST].[SalvageItem] ([SalvageID], [AssetID], [Description], [Description2], [Version], [Creator], [CreationDate], [LastEditor], [LastEditionDate])
	SELECT @SalvageID, @AssetID, @Description, @Description2, 0, @Creator, @CreationDate, @Creator, @CreationDate
	
	-- Begin Return Select <- do not remove
	SELECT [SalvageItemID], [Version]
	FROM   [AST].[SalvageItem]
	WHERE  [SalvageItemID] = SCOPE_IDENTITY()
	-- End Return Select <- do not remove
