

CREATE   PROC [PRM].[spProductionStopUpdate]
    @ProductionStopID int,  	
	@FromDate date,
	@StartHour decimal(18, 0),
	@ToDate date,
	@EndHour decimal(18, 0),
    @ProductionStopReasonID int,
    @StopType tinyint,
    @LastEditor int,
    @LastEditionDate datetime,
    @Version int
--WITH ENCRYPTION
AS 
SET NOCOUNT ON

	if @Version=(Select [Version] from PRM.ProductionStop
	where ProductionStopID = @ProductionStopID)
	begin	

		set @Version = @Version +1 

		UPDATE PRM.ProductionStop
		SET    FromDate = @FromDate,
		       StartHour = @StartHour, 
			   ToDate = @ToDate, 
			   EndHour = @EndHour, 
			   ProductionStopReasonID = @ProductionStopReasonID, 
			   StopType = @StopType, 
			   LastEditor = @LastEditor, 
			   LastEditionDate = @LastEditionDate, 
			   [Version] = @Version
		WHERE  ProductionStopID = @ProductionStopID
	
		-- Begin Return Select <- do not remove
		SELECT [Version]
		FROM   PRM.ProductionStop
		WHERE  ProductionStopID = @ProductionStopID
		-- End Return Select <- do not remove

	end
	else 
		RAISERROR('Version mismatch...', 16 , 10)
