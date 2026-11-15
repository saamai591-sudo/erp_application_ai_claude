
CREATE PROC [STC].[spRecountingInventoryInsert] 
    @RecountingInventoryTagID int,
    @Creator int,
    @CreationDate datetime,
    @LastEditor int,
    @LastEditionDate datetime,
    @StockReceiptID int,
    @OutgoingID int
	--WITH ENCRYPTION 
AS 
begin
	SET NOCOUNT ON 
	SET XACT_ABORT ON  
	
	INSERT INTO [STC].[RecountingInventory] ([RecountingInventoryTagID], [Version], [Creator], [CreationDate], [LastEditor], [LastEditionDate], [StockReceiptID], [OutgoingID])
	SELECT @RecountingInventoryTagID, 0, @Creator, @CreationDate, @LastEditor, @LastEditionDate, @StockReceiptID, @OutgoingID
	
	-- Begin Return Select <- do not remove
	SELECT [RecountingInventoryID], 
			[Version]
	FROM   [STC].[RecountingInventory]
	WHERE  [RecountingInventoryID] = SCOPE_IDENTITY()
	-- End Return Select <- do not remove
END
