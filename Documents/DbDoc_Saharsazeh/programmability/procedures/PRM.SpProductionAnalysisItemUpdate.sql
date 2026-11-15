
CREATE    proc [PRM].[SpProductionAnalysisItemUpdate]
(
	@ProductionAnalysisItemID int
	,@ProductionAnalysisID int
	,@BaseType tinyint
	,@BaseID int
	,@RowIndex  int
	,@StuffID int 
	,@MainQuantity decimal(30,4)
	,@Version int
	,@LastEditor int
    ,@LastEditionDate datetime
	,@ProductionFormulaItemID int
	,@CostCenterId int
)
--WITH ENCRYPTION
AS
BEGIN

update [PRM].[ProductionAnalysisItem]
set  BaseType =   @BaseType
    ,BaseID = @BaseID
    ,RowIndex  = @RowIndex 
    ,StuffID = @StuffID
    ,MainQuantity = @MainQuantity
    ,Version = Version + 1 
    ,LastEditor = @LastEditor 
    ,LastEditionDate  = @LastEditionDate 
	,ProductionFormulaItemID = @ProductionFormulaItemID
	,CostCenterId = @CostCenterId
where [ProductionAnalysisItemID] = @ProductionAnalysisItemID

select [Version]
from [PRM].[ProductionAnalysisItem]
where [ProductionAnalysisItemID] = @ProductionAnalysisItemID
end
