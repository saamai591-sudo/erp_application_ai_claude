

CREATE   PROC [PRM].[spProductionStopReasonUpdate]
    @ProductionStopReasonID int,  	
	@Code nvarchar(100),
    @Title nvarchar(256),
    @Title2 nvarchar(256),
    @LastEditor int,
    @LastEditionDate datetime,
    @Version int
--WITH ENCRYPTION
AS 
SET NOCOUNT ON

	if @Version=(Select [Version] from PRM.ProductionStopReason
	where ProductionStopReasonID = @ProductionStopReasonID)
	begin	

		set @Version = @Version +1 

		UPDATE PRM.ProductionStopReason
		SET    Code = @Code,
		       Title = @Title, 
			   Title2 = @Title2, 
			   LastEditor = @LastEditor, 
			   LastEditionDate = @LastEditionDate, 
			   [Version] = @Version
		WHERE  ProductionStopReasonID = @ProductionStopReasonID
	
		-- Begin Return Select <- do not remove
		SELECT [Version]
		FROM   PRM.ProductionStopReason
		WHERE  ProductionStopReasonID = @ProductionStopReasonID
		-- End Return Select <- do not remove

	end
	else 
		RAISERROR('Version mismatch...', 16 , 10)
