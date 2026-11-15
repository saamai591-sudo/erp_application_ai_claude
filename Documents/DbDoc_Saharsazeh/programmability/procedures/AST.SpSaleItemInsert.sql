CREATE     PROC [AST].[SpSaleItemInsert] 
    @SaleID int,
	@RowIndex int,
    @AssetID int,
    @Creator int,
    @CreationDate datetime
--WITH ENCRYPTION
AS 
SET NOCOUNT ON 

	INSERT INTO [AST].[SaleItem] ([SaleID],[RowIndex], [AssetID], [Version], [Creator], [CreationDate], [LastEditor], [LastEditionDate])
	SELECT @SaleID,@RowIndex, @AssetID, 0, @Creator, @CreationDate, @Creator, @CreationDate
	
	-- Begin Return Select <- do not remove
	SELECT [SaleItemID], [Version]
	FROM   [AST].[SaleItem]
	WHERE  [SaleItemID] = SCOPE_IDENTITY()
	-- End Return Select <- do not remove
