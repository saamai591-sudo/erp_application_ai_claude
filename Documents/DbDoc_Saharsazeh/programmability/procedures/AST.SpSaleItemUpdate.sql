CREATE     PROC [AST].[SpSaleItemUpdate] 
    @SaleItemID int,
    @SaleID int,
	@RowIndex int,
    @AssetID int,
    @Version int,
    @LastEditor int,
    @LastEditionDate datetime
--WITH ENCRYPTION
AS 
SET NOCOUNT ON 

	if @Version <> (Select [Version] from [AST].[SaleItem]
				where [SaleItemID] = @SaleItemID)
	begin
		RAISERROR('Version mismatch...', 16 , 10)
		return
	end

	set @Version = @Version +1 

		UPDATE [AST].[SaleItem]
		SET     [AssetID] = @AssetID, 
				[RowIndex] = @RowIndex,
				[Version] = @Version, 
				[LastEditor] = @LastEditor, 
				[LastEditionDate] = @LastEditionDate
		WHERE  [SaleItemID] = @SaleItemID
	
		-- Begin Return Select <- do not remove
		SELECT [Version]
		FROM   [AST].[SaleItem]
		WHERE  [SaleItemID] = @SaleItemID	
		-- End Return Select <- do not remove
