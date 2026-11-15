

CREATE   PROC [PRM].[spProductionProcessItemUpdate]
    @ProductionProcessItemID int,  	
	@ProductionProcessID int,
    @RowIndex smallint,
    @WorkStationID int,
    @LastEditor int,
    @LastEditionDate datetime,
    @Version int
--WITH ENCRYPTION
AS 
SET NOCOUNT ON

	if @Version=(Select [Version] from PRM.ProductionProcessItem
	where ProductionProcessItemID = @ProductionProcessItemID)
	begin	

		set @Version = @Version +1 

		UPDATE PRM.ProductionProcessItem
		SET    ProductionProcessID = @ProductionProcessID,
		       RowIndex = @RowIndex, 
			   WorkStationID = @WorkStationID, 
			   LastEditor = @LastEditor, 
			   LastEditionDate = @LastEditionDate, 
			   [Version] = @Version
		WHERE  ProductionProcessItemID = @ProductionProcessItemID
	
		-- Begin Return Select <- do not remove
		SELECT [Version]
		FROM   PRM.ProductionProcessItem
		WHERE  ProductionProcessItemID = @ProductionProcessItemID	
		-- End Return Select <- do not remove

	end
	else 
		RAISERROR('Version mismatch...', 16 , 10)
