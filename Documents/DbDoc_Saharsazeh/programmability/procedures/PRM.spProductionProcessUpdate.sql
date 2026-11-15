

CREATE   PROC [PRM].[spProductionProcessUpdate]
    @ProductionProcessID int,  	
	@Code nvarchar(100),
    @Title nvarchar(256),
    @Title2 nvarchar(256),
    @LastEditor int,
    @LastEditionDate datetime,
    @Version int
--WITH ENCRYPTION
AS 
SET NOCOUNT ON

	if @Version=(Select [Version] from PRM.ProductionProcess
	where ProductionProcessID = @ProductionProcessID)
	begin	

		set @Version = @Version +1 

		UPDATE PRM.ProductionProcess
		SET    Code = @Code,
		       Title = @Title, 
			   Title2 = @Title2, 
			   LastEditor = @LastEditor, 
			   LastEditionDate = @LastEditionDate, 
			   [Version] = @Version
		WHERE  ProductionProcessID = @ProductionProcessID
	
		-- Begin Return Select <- do not remove
		SELECT [Version]
		FROM   PRM.ProductionProcess
		WHERE  ProductionProcessID = @ProductionProcessID	
		-- End Return Select <- do not remove

	end
	else 
		RAISERROR('Version mismatch...', 16 , 10)
