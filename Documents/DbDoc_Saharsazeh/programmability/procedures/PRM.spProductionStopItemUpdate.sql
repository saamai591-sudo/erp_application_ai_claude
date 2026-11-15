

CREATE   PROC [PRM].[spProductionStopItemUpdate]
    @ProductionStopItemID int,  	
	@ProductionStopID int,
    @ProductionProcessID int,
    @LastEditor int,
    @LastEditionDate datetime,
    @Version int
--WITH ENCRYPTION
AS 
SET NOCOUNT ON

	if @Version=(Select [Version] from PRM.ProductionStopItem
	where ProductionStopItemID = @ProductionStopItemID)
	begin	

		set @Version = @Version +1 

		UPDATE PRM.ProductionStopItem
		SET    ProductionStopID = @ProductionStopID,
		       ProductionProcessID = @ProductionProcessID, 
			   LastEditor = @LastEditor, 
			   LastEditionDate = @LastEditionDate, 
			   [Version] = @Version
		WHERE  ProductionStopItemID = @ProductionStopItemID
	
		-- Begin Return Select <- do not remove
		SELECT [Version]
		FROM   PRM.ProductionStopItem
		WHERE  ProductionStopItemID = @ProductionStopItemID
		-- End Return Select <- do not remove

	end
	else 
		RAISERROR('Version mismatch...', 16 , 10)
