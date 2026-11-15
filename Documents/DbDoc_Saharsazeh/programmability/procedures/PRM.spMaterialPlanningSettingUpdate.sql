

CREATE   PROC [PRM].[spMaterialPlanningSettingUpdate]
    @MaterialPlanningSettingID int,  	
	@StuffID int,
    @StockReceiptTime smallint,
    @LastEditor int,
    @LastEditionDate datetime,
    @Version int
--WITH ENCRYPTION
AS 
SET NOCOUNT ON

	if @Version=(Select [Version] from PRM.MaterialPlanningSetting
	where MaterialPlanningSettingID = @MaterialPlanningSettingID)
	begin	

		set @Version = @Version +1 

		UPDATE PRM.MaterialPlanningSetting
		SET    StuffID = @StuffID,
		       StockReceiptTime = @StockReceiptTime, 			   			   
			   LastEditor = @LastEditor, 
			   LastEditionDate = @LastEditionDate, 
			   [Version] = @Version
		WHERE  MaterialPlanningSettingID = @MaterialPlanningSettingID
	
		-- Begin Return Select <- do not remove
		SELECT  [Version] 
		FROM   PRM.MaterialPlanningSetting
		WHERE  MaterialPlanningSettingID = @MaterialPlanningSettingID
		-- End Return Select <- do not remove

	end
	else 
		RAISERROR('Version mismatch...', 16 , 10)
