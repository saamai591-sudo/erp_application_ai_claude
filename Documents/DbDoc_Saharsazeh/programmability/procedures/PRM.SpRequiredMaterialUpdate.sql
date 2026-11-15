
CREATE    proc [PRM].[SpRequiredMaterialUpdate]
(
	 @RequiredMaterialID int
	,@ProductionAnalysisID int
	,@RowIndex int
	,@StuffID int
	,@RequiredQuantity decimal(30,4)
	,@DefiniteInventory decimal(30,4)
	,@IndefiniteInventory decimal(30,4)
	,@Shortage decimal(30,4)
	,@Adjustment decimal(30,4)
	,@ProductionOrder decimal(30,4)
	,@Version int
	,@LastEditor int
    ,@LastEditionDate datetime
	,@Reserved decimal(30,4)
	,@CostCenterId int
)
--WITH ENCRYPTION
AS
BEGIN

update [PRM].[RequiredMaterial]
set  ProductionAnalysisID = @ProductionAnalysisID
           ,RowIndex = @RowIndex
           ,StuffID = @StuffID
           ,RequiredQuantity = @RequiredQuantity
           ,DefiniteInventory = @DefiniteInventory
           ,IndefiniteInventory = @IndefiniteInventory
           ,Shortage = @Shortage
           ,Adjustment = @Adjustment
           ,ProductionOrder = @ProductionOrder
           ,version = version + 1
           ,LastEditor = @LastEditor
           ,LastEditionDate = @LastEditionDate
		   ,[Reserved] = @Reserved
		   ,CostCenterId = @CostCenterId
where RequiredMaterialID = @RequiredMaterialID

select [Version]
from [PRM].[RequiredMaterial]
where [RequiredMaterialID] = @RequiredMaterialID
end
