CREATE PROC [STC].[spRecountingInventoryUpdate] 
    @RecountingInventoryID int,
    @RecountingInventoryTagID int,
    @Version int,
    @Creator int,
    @CreationDate datetime,
    @LastEditor int,
    @LastEditionDate datetime,
    @StockReceiptID int,
    @OutgoingID int
--WITH ENCRYPTION 
AS 
BEGIN
	SET NOCOUNT ON 

	if @Version <> (Select [Version] from [STC].[RecountingInventory]
	where [RecountingInventoryID] = @RecountingInventoryID)
		RAISERROR('Version mismatch...', 16 , 10)

		UPDATE [STC].[RecountingInventory]
		SET     [RecountingInventoryTagID] = @RecountingInventoryTagID, 
				[Version] = @Version + 1,
				[LastEditor] = @LastEditor, 
				[LastEditionDate] = @LastEditionDate
		WHERE  [RecountingInventoryID] = @RecountingInventoryID
	
		-- Begin Return Select <- do not remove
		SELECT  [Version] 
        FROM   [STC].[RecountingInventory]
		WHERE  [RecountingInventoryID] = @RecountingInventoryID	
		-- End Return Select <- do not remove
END
