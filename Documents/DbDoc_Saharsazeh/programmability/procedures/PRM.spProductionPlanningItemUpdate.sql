

CREATE     PROC [PRM].[spProductionPlanningItemUpdate]
    @ProductionPlanningItemID int,  	
	@ProductionPlanningID int,
    @RowIndex smallint,
    @BaseType tinyint,
	@ProductionOrderItemID int,	
	@StuffID int,
	@MainQuantity decimal(30, 4),
	@SubQuantity decimal(30, 4),
	@CostCenterId int,
	@PlanningItemID int,
	@Description nvarchar(512),
	@Description2 nvarchar(512),
    @LastEditor int,
    @LastEditionDate datetime,
    @Version int
--WITH ENCRYPTION
AS 
SET NOCOUNT ON

	if @Version=(Select [Version] from PRM.ProductionPlanningItem
	where ProductionPlanningItemID = @ProductionPlanningItemID)
	begin	

		set @Version = @Version + 1 

		UPDATE PRM.ProductionPlanningItem
		SET    ProductionPlanningID = @ProductionPlanningID,
		       RowIndex = @RowIndex, 
			   BaseType = @BaseType, 
			   ProductionOrderItemID = @ProductionOrderItemID,
			   StuffID = @StuffID,
			   MainQuantity = @MainQuantity,
			   SubQuantity = @SubQuantity,		
			   CostCenterId = @CostCenterId,
			   PlanningItemID = @PlanningItemID,
			   Description = @Description,
			   Description2 = @Description2,
			   LastEditor = @LastEditor, 
			   LastEditionDate = @LastEditionDate, 
			   [Version] = @Version
		WHERE  ProductionPlanningItemID = @ProductionPlanningItemID
	
		-- Begin Return Select <- do not remove
		SELECT [Version]
		FROM   PRM.ProductionPlanningItem
		WHERE  ProductionPlanningItemID = @ProductionPlanningItemID
		-- End Return Select <- do not remove

	end
	else 
		RAISERROR('Version mismatch...', 16 , 10)
