CREATE    proc [PRM].[SpPlanningItemUpdate]
(
	 @PlanningItemID int
	,@ProductionAnalysisID int
	,@RowIndex  int
	,@StuffID int 
	,@MainQuantity decimal(30,4)
	,@CostCenterId int
	,@Version int
	,@LastEditor int
    ,@LastEditionDate datetime
)
--WITH ENCRYPTION
AS
BEGIN

update [PRM].[PlanningItem]
set			RowIndex  = @RowIndex 
           ,StuffID = @StuffID
           ,MainQuantity = @MainQuantity
           ,CostCenterId  = @CostCenterId 
           ,Version = Version + 1 
           ,LastEditor = @LastEditor 
           ,LastEditionDate  = @LastEditionDate 
where [PlanningItemID] = @PlanningItemID

select [Version]
from [PRM].[PlanningItem]
where [PlanningItemID] = @PlanningItemID
end
