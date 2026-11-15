
CREATE    proc [PRM].[SpRequiredProductUpdate]
(	 @RequiredProductID int
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
	,@Planned decimal(30,4)
	,@Reserved decimal(30,4)
	,@CostCenterId int
)
--WITH ENCRYPTION
AS
BEGIN

update [PRM].[RequiredProduct]
set   RowIndex = @RowIndex
           ,StuffID = @StuffID
           ,RequiredQuantity = @RequiredQuantity
           ,DefiniteInventory = @DefiniteInventory
           ,IndefiniteInventory = @IndefiniteInventory
           ,Shortage = @Shortage
           ,Adjustment = @Adjustment
           ,ProductionOrder = @ProductionOrder
           ,version = version  + 1
           ,LastEditor = @LastEditor
           ,LastEditionDate = @LastEditionDate
		   ,Planned = @Planned
		   ,Reserved = @Reserved
		   ,CostCenterId = @CostCenterId
where RequiredProductID = @RequiredProductID

select [Version]
from [PRM].[RequiredProduct]
where RequiredProductID = @RequiredProductID
end
