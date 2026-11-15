
CREATE    proc [PRM].[SpRequiredMaterialCostCenterUpdate]
(	
	 @RequiredMaterialCostCenterID int
    ,@RequiredMaterialID int
    ,@CostCenterID int
	,@RequiredQuantity  decimal(36,10) 
	,@Version int
	,@LastEditor int
    ,@LastEditionDate datetime
)
--WITH ENCRYPTION
AS
BEGIN

update [PRM].[RequiredMaterialCostCenter]
set
            CostCenterID = @CostCenterID
           ,RequiredQuantity = @RequiredQuantity
           ,version = version + 1
           ,LastEditor = @LastEditor
           ,LastEditionDate = @LastEditionDate
where RequiredMaterialCostCenterID = @RequiredMaterialCostCenterID

select [Version]
from [PRM].[RequiredMaterialCostCenter]
where RequiredMaterialCostCenterID = @RequiredMaterialCostCenterID

end
