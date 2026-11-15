
------------------------------- modify [PRM].spProductionTimingUpdate ------------------------------------------------
CREATE     PROC [PRM].spProductionTimingUpdate
 (  @ProductionTimingID int,
    @StuffID int,
	@CostCenterId int,
	@ProductionTime decimal(18, 0),
	@Quantity decimal(30, 4),
	@CostDriverID int,
    @LastEditor int,
    @LastEditionDate datetime,
    @Version int)
--WITH ENCRYPTION
AS 
SET NOCOUNT ON
	if @Version=(Select [Version] from PRM.ProductionTiming
	where ProductionTimingID = @ProductionTimingID)
	begin	

		set @Version = @Version +1 

		UPDATE PRM.ProductionTiming
		SET    
			   StuffID = @StuffID, 
			   CostCenterId = @CostCenterId,
			   ProductionTime = @ProductionTime,
			   Quantity = @Quantity,
			   CostDriverID = @CostDriverID,
			   LastEditor = @LastEditor, 
			   LastEditionDate = @LastEditionDate, 
			   [Version] = @Version
		WHERE  ProductionTimingID = @ProductionTimingID
	
		-- Begin Return Select <- do not remove
		SELECT [Version]
		FROM   PRM.ProductionTiming
		WHERE  ProductionTimingID = @ProductionTimingID	
		-- End Return Select <- do not remove

	end
	else 
		RAISERROR('Version mismatch...', 16 , 10)
